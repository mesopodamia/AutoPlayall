chrome.action.onClicked.addListener(async tab => {
  if (!tab.id) return;
  try {
    if (!/^https?:\/\//i.test(tab.url||'')) throw Error('仅支持普通 HTTP/HTTPS 网页');
    await chrome.scripting.executeScript({target:{tabId:tab.id},files:['engine.js','content.js']});
    await chrome.action.setBadgeText({tabId:tab.id,text:''});
    await chrome.action.setTitle({tabId:tab.id,title:'AutoPlayAll：扫描当前页面音频'});
  } catch {
    await chrome.action.setBadgeText({tabId:tab.id,text:'!'});
    await chrome.action.setTitle({tabId:tab.id,title:'无法访问此页面，请在普通网页中启用 AutoPlayAll'});
  }
});
