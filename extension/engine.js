/* Independent queue and playback state, shared with the Node tests. */
globalThis.ShareMusic = (() => {
  class Queue {
    constructor(length, random = Math.random) {
      this.length = length; this.random = random;
      this.mode = 'sequence'; this.current = -1; this.bag = [];
    }
    setMode(mode) {
      this.mode = mode === 'random' ? 'random' : 'sequence';
      this.bag = [];
      // Switching to shuffle starts a new round excluding the playing song.
      if (this.mode === 'random' && this.current >= 0) this.bag = this.shuffle().filter(i => i !== this.current);
    }
    shuffle() {
      const items = Array.from({length:this.length}, (_,i)=>i);
      for (let i=items.length-1; i>0; i--) {
        const j=Math.floor(this.random()*(i+1));
        [items[i],items[j]]=[items[j],items[i]];
      }
      return items;
    }
    next() {
      if (!this.length) return -1;
      if (this.mode === 'random') {
        if (!this.bag.length) {
          this.bag = this.shuffle();
          if (this.length>1 && this.bag[0]===this.current) [this.bag[0],this.bag[1]]=[this.bag[1],this.bag[0]];
        }
        this.current = this.bag.shift();
      } else this.current = (this.current+1)%this.length;
      return this.current;
    }
  }
  class Player {
    constructor(tracks, audio, resolve, report) {
      this.tracks=tracks; this.audio=audio; this.resolve=resolve; this.report=report;
      this.queue=new Queue(tracks.length); this.active=false; this.version=0;
      this.failures=0; this.resolving=false;
    }
    async start() {
      this.active=true; this.failures=0;
      return this.next();
    }
    async next() {
      if (!this.active) return;
      const version=++this.version;
      this.resolving=true;
      this.audio.pause();
      const index=this.queue.next();
      if (index<0) {this.stop();this.report('页面没有可播放的歌曲');return;}
      const track=this.tracks[index];
      this.report(`加载中 · ${index+1}/${this.tracks.length} · ${track.title || track.id}`);
      try {
        const url=await this.resolve(track);
        if (version!==this.version || !this.active) return;
        this.audio.src=url;
        await this.audio.play();
        if (version!==this.version || !this.active) return;
        this.report(`正在播放 · ${index+1}/${this.tracks.length} · ${track.title || track.id}`);
      } catch (error) {
        if (version!==this.version || !this.active) return;
        if (error.name==='NotAllowedError') {
          this.report('请点击下方音频控件的播放按钮，继续当前歌曲');
        } else return this.failed();
      } finally {
        if (version===this.version) this.resolving=false;
      }
    }
    async failed() {
      if (!this.active) return;
      this.failures++;
      if (this.failures>=this.tracks.length) {
        this.stop(); this.report('全部歌曲连续加载失败，请确认网站验证和音源可用后重试'); return;
      }
      return this.next();
    }
    ended() {
      if (!this.active) return;
      this.failures=0; return this.next();
    }
    stop() {
      this.active=false; this.version++; this.resolving=false;
      this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load();
      this.report('已停止');
    }
  }
  function collectTracks(doc, base) {
    const tracks=[], seen=new Set();
    function add(href, title) {
      const url=new URL(href,base);
      const match=/^\/mp3\/([a-z0-9]+)\.html$/i.exec(url.pathname);
      if (url.origin!==new URL(base).origin || !match || seen.has(match[1])) return;
      seen.add(match[1]); tracks.push({id:match[1],title:title.trim(),url:url.href});
    }
    add(base, doc.querySelector('.djname h1')?.childNodes[0]?.textContent || doc.querySelector('h1')?.textContent || '当前歌曲');
    for (const link of doc.querySelectorAll('a[href]')) add(link.getAttribute('href'),link.textContent);
    return tracks;
  }
  function requestBody(id, date=new Date()) {
    const pad=n=>String(n).padStart(2,'0');
    const key=`${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}4c44`;
    return new URLSearchParams({id,type:'music',key});
  }
  return {Queue,Player,collectTracks,requestBody};
})();
