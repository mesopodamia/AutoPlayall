const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={URL,URLSearchParams};
vm.runInNewContext(fs.readFileSync('extension/engine.js','utf8'),context);
const api=context.AutoPlayAll;
const node=(attrs={},textContent='')=>({getAttribute:key=>attrs[key]??null,textContent,currentSrc:attrs.currentSrc||'',querySelectorAll:()=>attrs.sources||[]});
function doc(audios=[],links=[]) {
  return {baseURI:'https://example.test/music/',querySelector:()=>null,querySelectorAll:s=>s==='audio'?audios:s==='a[href]'?links:[]};
}
test('通用模式发现audio及直接音频链接，解析相对地址并去重',()=>{
  const d=doc([node({src:'one.mp3',title:'第一首'})],[node({href:'one.mp3'},'重复'),node({href:'two.M4A?token=abc'},'第二首'),node({href:'/about'},'关于')]);
  const tracks=api.collectGenericTracks(d,'https://example.test/music/');
  assert.equal(tracks.length,2);assert.equal(tracks[0].url,'https://example.test/music/one.mp3');
  assert.equal(tracks[1].title,'第二首');assert.equal(tracks[1].kind,'direct');
});
test('audio使用当前源优先，source列表是同一歌曲的备选格式',()=>{
  const d=doc([node({currentSrc:'https://cdn.test/stream?id=2',src:'fallback.mp3',sources:[node({src:'other.ogg'})]}),node({sources:[node({src:'first.ogg'}),node({src:'second.mp3'})]})]);
  const tracks=api.collectGenericTracks(d,'https://example.test/');
  assert.equal(tracks.length,2);assert.equal(tracks[0].url,'https://cdn.test/stream?id=2');
  assert.equal(tracks[1].url,'https://example.test/music/first.ogg');
});
test('忽略blob、无效URL、脚本及非音频链接，保留跨域和签名参数',()=>{
  const tracks=api.collectGenericTracks(doc([node({src:'blob:https://example.test/123'})],[node({href:'javascript:alert(1)'}),node({href:'https://['}),node({href:'https://cdn.test/song.mp3?sig=xyz#part'},'跨域')]),'https://example.test/');
  assert.equal(tracks.length,1);assert.equal(tracks[0].url,'https://cdn.test/song.mp3?sig=xyz');
});
test('网站专用适配只在准确的4c44域名启用',()=>{
  assert.equal(api.isSupportedSite('https://www.4c44.com/mp3/a.html'),true);
  assert.equal(api.isSupportedSite('https://4c44.com/mp3/a.html'),true);
  assert.equal(api.isSupportedSite('https://4c44.com.evil.test/mp3/a.html'),false);
});
test('顺序和随机队列仍覆盖全部歌曲',()=>{
  const q=new api.Queue(3,()=>0.5);
  assert.equal([q.next(),q.next(),q.next(),q.next()].join(','),'0,1,2,0');
  q.setMode('random');assert.equal(new Set([q.next(),q.next()]).size,2);
});
test('结束切歌且停止使未返回请求失效',async()=>{
  const audio={src:'',pause(){},play:async()=>{},removeAttribute(){this.src='';},load(){}};
  let finish;
  const player=new api.Player([{id:'a',url:'https://cdn.test/a.mp3'},{id:'b',url:'https://cdn.test/b.mp3'}],audio,async t=>t.url,()=>{});
  await player.start();assert.match(audio.src,/a.mp3$/);
  await player.ended();assert.match(audio.src,/b.mp3$/);
  player.resolve=()=>new Promise(r=>finish=r);
  const pending=player.next();player.stop();finish('https://cdn.test/stale.mp3');
  await pending;assert.equal(audio.src,'');
});
async function activate(tab,fail=false) {
  let listener;const injected=[],badges=[];
  const chrome={action:{onClicked:{addListener:fn=>listener=fn},setBadgeText:async x=>badges.push(x.text),setTitle:async()=>{}},scripting:{executeScript:async x=>{if(fail)throw Error('restricted');injected.push(x);}}};
  vm.runInNewContext(fs.readFileSync('extension/background.js','utf8'),{chrome});
  await listener(tab);return {injected,badges};
}
test('工具栏只向当前页注入脚本',async()=>{
  const {injected,badges}=await activate({id:10,url:'https://example.test/music'});
  assert.equal(injected.length,1);assert.equal(injected[0].target.tabId,10);
  assert.equal(Array.from(injected[0].files).join(','),'engine.js,content.js');
  assert.equal(injected[0].target.allFrames,undefined);assert.equal(badges.at(-1),'');
});
test('内部页面和注入失败均显示提示',async()=>{
  const internal=await activate({id:1,url:'chrome://extensions/'});
  assert.equal(internal.injected.length,0);assert.equal(internal.badges.at(-1),'!');
  assert.equal((await activate({id:2,url:'https://example.test/'},true)).badges.at(-1),'!');
});
