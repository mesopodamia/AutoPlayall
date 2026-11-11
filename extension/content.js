(() => {
  'use strict';
  if (document.getElementById('autoplayall-panel')) return;
  const tracks=AutoPlayall.collectTracks(document,location.href);
  // Verification pages have no player or song links: wait for normal navigation.
  if (!tracks.length || !document.querySelector('#player, .play_list, a[href*="/mp3/"]')) return;
  const host=document.createElement('div'); host.id='autoplayall-panel';
  const root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>
    :host{all:initial;position:fixed;bottom:20px;right:20px;z-index:2147483646;font-family:system-ui,sans-serif;color:#25212a}
    section{width:min(360px,calc(100vw - 32px));background:#fff;border:1px solid #edd5df;border-radius:14px;padding:16px;box-shadow:0 8px 36px #0003;box-sizing:border-box}
    header{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:16px;font-weight:700}
    p{font-size:13px;line-height:1.6;margin:10px 0;overflow-wrap:anywhere}
    .actions{display:flex;gap:8px;flex-wrap:wrap}button,select{font:13px system-ui;border:1px solid #dbcbd2;background:white;color:#25212a;border-radius:7px;padding:7px 10px;cursor:pointer}
    #start{background:#ce2c74;color:white;border-color:#ce2c74}button:focus-visible,select:focus-visible{outline:2px solid #ce2c74;outline-offset:2px}
    audio{display:block;width:100%;height:40px;margin:12px 0}details{font-size:12px;margin-top:10px}ol{max-height:140px;overflow:auto;padding-left:25px;line-height:1.8}li.current{font-weight:bold;color:#ce2c74}
    section.small .body{display:none}#fold{padding:3px 9px}
    .hint{color:#746772;font-size:12px}
  </style><section><header><span>AutoPlayall · ${tracks.length} 首</span><button id="fold" aria-label="收起面板">收起</button></header>
  <div class="body"><p id="status" role="status" aria-live="polite">点击开始，播放当前页面全部歌曲</p>
  <div class="actions"><select id="mode" aria-label="播放方式"><option value="sequence">顺序循环</option><option value="random">随机不重复</option></select><button id="start">开始播放</button><button id="next">下一首</button><button id="stop">停止</button></div>
  <audio controls preload="auto"></audio><p class="hint">随机模式每轮播完前不重复；只使用当前页的歌曲列表。</p><details><summary>查看播放队列</summary><ol></ol></details></div></section>`;
  document.documentElement.append(host);
  const $=s=>root.querySelector(s);
  const audio=$('audio');
  const rows=tracks.map(t=>{const li=document.createElement('li');li.textContent=t.title; $('ol').append(li);return li;});
  let timer;
  const player=new AutoPlayall.Player(tracks,audio,async track=>{
    const response=await fetch('/js/play.php',{
      method:'POST',credentials:'same-origin',
      body:AutoPlayall.requestBody(track.id),signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Error('音源请求失败');
    const data=await response.json();
    if (data.msg!=1 || !data.url) throw Error('音源暂不可用');
    const url=new URL(data.url,location.origin);
    if (!['https:','http:'].includes(url.protocol)) throw Error('音频地址格式错误');
    if (location.protocol==='https:' && url.protocol==='http:') url.protocol='https:';
    return url.href;
  },message=>{
    $('#status').textContent=message;
    rows.forEach((row,i)=>row.classList.toggle('current',i===player.queue.current));
  });
  const silenceSite=()=>document.querySelectorAll('audio,video').forEach(el=>el.pause());
  document.addEventListener('play',event=>{
    if (player.active && event.target instanceof HTMLMediaElement) event.target.pause();
  },true);
  $('#start').addEventListener('click',()=>{
    if (player.active) {audio.play().catch(()=>{$('#status').textContent='请点击音频控件播放，或停止后重新开始';});return;}
    silenceSite(); void player.start();
  });
  $('#next').addEventListener('click',()=>{silenceSite(); if(player.active) void player.next();else void player.start();});
  $('#stop').addEventListener('click',()=>player.stop());
  $('#mode').addEventListener('change',event=>player.queue.setMode(event.target.value));
  $('#fold').addEventListener('click',()=>{
    const small=$('section').classList.toggle('small'); $('#fold').textContent=small?'展开':'收起';
    $('#fold').setAttribute('aria-label',small?'展开面板':'收起面板');
  });
  audio.addEventListener('ended',()=>{clearTimeout(timer);void player.ended();});
  audio.addEventListener('error',()=>{clearTimeout(timer);if(!player.resolving) void player.failed();});
  audio.addEventListener('loadstart',()=>{
    clearTimeout(timer);
    timer=setTimeout(()=>{if(player.active) void player.failed();},30000);
  });
  audio.addEventListener('canplay',()=>clearTimeout(timer));
  audio.addEventListener('emptied',()=>clearTimeout(timer));
})();
