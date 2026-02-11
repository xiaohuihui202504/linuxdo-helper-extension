/**
 * Linux.do Helper - 后台服务脚本
 */

// 监听安装事件
chrome.runtime.onInstalled.addListener((details) => {
  console.log('[Linux.do Helper] 插件已安装', details.reason);

  // 设置默认值
  chrome.storage.local.get(['language', 'themeColor'], (result) => {
    if (!result.language) {
      chrome.storage.local.set({ language: 'zh' });
    }
    if (!result.themeColor) {
      chrome.storage.local.set({ themeColor: 'purple' });
    }
  });
});

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSettings') {
    chrome.storage.local.get(null, (settings) => {
      sendResponse(settings);
    });
    return true; // 异步响应
  }

  if (request.action === 'saveSetting') {
    chrome.storage.local.set({ [request.key]: request.value }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === 'openTab') {
    chrome.tabs.create({ url: request.url });
    sendResponse({ success: true });
  }
});

// 监听标签页更新
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    const url = tab.url || '';
    if (url.includes('linux.do') || url.includes('idcflare.com')) {
      // 可以在这里添加标签页相关的逻辑
      console.log('[Linux.do Helper] 检测到目标页面:', url);
    }
  }
});
