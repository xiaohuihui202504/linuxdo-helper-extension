/**
 * Linux.do Helper - 内容脚本主入口
 */

(function () {
  'use strict';

  // 检查是否已初始化
  if (window.LDH_INITIALIZED) return;
  window.LDH_INITIALIZED = true;

  console.log('[Linux.do Helper] 初始化中...');

  // 等待页面加载完成
  const init = () => {
    try {
      // 创建点赞计数器
      const likeCounter = new LDH_LikeCounter();
      window.ldhLikeCounter = likeCounter;

      // 创建用户信息助手
      const userInfoHelper = new LDH_UserInfoHelper();
      window.ldhUserInfoHelper = userInfoHelper;

      // 创建自动滚动控制器
      const autoScroll = new LDH_AutoScrollController(likeCounter);
      window.ldhAutoScroll = autoScroll;

      // 创建UI
      const ui = new LDH_HelperUI(likeCounter, autoScroll, userInfoHelper);
      window.ldhUI = ui;

      // 监听URL变化
      let lastUrl = location.href;
      setInterval(() => {
        if (location.href !== lastUrl) {
          lastUrl = location.href;
          const isTopicPage = LDH_Utils.isTopicPage();

          // 更新文章工具区域显示状态
          const articleTools = document.querySelector('.ldh-article-tools');
          if (articleTools) {
            articleTools.classList.toggle('hidden', !isTopicPage);
          }

          // 更新自动滚动状态
          if (autoScroll) {
            autoScroll.isTopicPage = isTopicPage;
          }

          // 如果正在自动阅读且进入新的话题页，启动滚动
          if (autoScroll && autoScroll.autoRunning && isTopicPage) {
            setTimeout(() => {
              autoScroll.startScrolling();
              if (autoScroll.autoLikeEnabled) {
                autoScroll.autoLikeTopic();
              }
            }, 1000);
          }
        }
      }, 1000);

      // 恢复自动阅读状态
      const wasRunning = LDH_Storage.getSession('autoRunning', false);
      if (wasRunning) {
        setTimeout(() => {
          autoScroll.start();
        }, 2000);
      }

      // 监听来自popup的消息
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'togglePanel') {
          if (ui) {
            ui.toggleMinimize();
          }
        } else if (message.action === 'getStatus') {
          const response = {};
          if (likeCounter) {
            response.likeStatus = likeCounter.getStatus();
          }
          if (autoScroll) {
            response.readStats = {
              sessionRead: autoScroll.sessionReadCount,
              todayRead: autoScroll.todayReadCount,
              totalRead: autoScroll.totalReadCount
            };
          }
          sendResponse(response);
          return true; // 保持消息通道打开
        } else if (message.action === 'updateSetting') {
          const { key, value } = message;
          LDH_Storage.setSync(key, value);

          if (autoScroll && key in autoScroll) {
            autoScroll.updateSetting(key, value);
          }

          if (key === 'cleanModeEnabled' && ui) {
            ui.cleanModeEnabled = value;
            ui.applyCleanMode();
          }
          if (key === 'grayscaleModeEnabled' && ui) {
            ui.grayscaleModeEnabled = value;
            ui.applyGrayscaleMode();
          }

          // 更新UI中的开关状态
          if (ui && ui.container) {
            const toggle = ui.container.querySelector(`.ldh-toggle-input[data-key="${key}"]`);
            if (toggle) {
              toggle.checked = value;
            }
          }
        }
      });

      console.log('[Linux.do Helper] 初始化完成!');
    } catch (error) {
      console.error('[Linux.do Helper] 初始化失败:', error);
    }
  };

  // 确保DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
