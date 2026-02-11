/**
 * Linux.do Helper - Popup脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 加载设置
  const settings = await chrome.storage.local.get([
    'autoLikeEnabled',
    'cleanModeEnabled',
    'grayscaleModeEnabled',
    'totalReadCount',
    'todayReadCount'
  ]);

  // 更新开关状态
  document.getElementById('toggle-autolike').checked = settings.autoLikeEnabled || false;
  document.getElementById('toggle-clean').checked = settings.cleanModeEnabled || false;
  document.getElementById('toggle-grayscale').checked = settings.grayscaleModeEnabled || false;

  // 更新统计
  document.getElementById('total-read').textContent = settings.totalReadCount || 0;
  document.getElementById('today-read').textContent = settings.todayReadCount || 0;

  // 绑定开关事件
  document.getElementById('toggle-autolike').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ autoLikeEnabled: e.target.checked });
    notifyContentScript('autoLikeEnabled', e.target.checked);
  });

  document.getElementById('toggle-clean').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ cleanModeEnabled: e.target.checked });
    notifyContentScript('cleanModeEnabled', e.target.checked);
  });

  document.getElementById('toggle-grayscale').addEventListener('change', async (e) => {
    await chrome.storage.local.set({ grayscaleModeEnabled: e.target.checked });
    notifyContentScript('grayscaleModeEnabled', e.target.checked);
  });

  // 打开面板按钮
  document.getElementById('btn-open-panel').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (tab.url.includes('linux.do') || tab.url.includes('idcflare.com'))) {
      chrome.tabs.sendMessage(tab.id, { action: 'togglePanel' });
      window.close();
    } else {
      chrome.tabs.create({ url: 'https://linux.do' });
    }
  });

  // 刷新按钮
  document.getElementById('btn-refresh').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.reload(tab.id);
      window.close();
    }
  });

  // 从当前页面获取实时状态
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (tab.url?.includes('linux.do') || tab.url?.includes('idcflare.com'))) {
      chrome.tabs.sendMessage(tab.id, { action: 'getStatus' }, (response) => {
        if (response) {
          if (response.likeStatus) {
            const { remaining, limit } = response.likeStatus;
            document.getElementById('like-remaining').textContent = `${remaining}/${limit}`;

            // 根据剩余数量设置颜色
            const el = document.getElementById('like-remaining');
            const percentage = limit > 0 ? (remaining / limit) * 100 : 0;
            if (percentage > 50) {
              el.classList.remove('warning', 'error');
            } else if (percentage > 20) {
              el.classList.add('warning');
              el.classList.remove('error');
            } else {
              el.classList.add('error');
              el.classList.remove('warning');
            }
          }
          if (response.readStats) {
            document.getElementById('today-read').textContent = response.readStats.sessionRead || 0;
            document.getElementById('total-read').textContent = response.readStats.totalRead || 0;
          }
        }
      });
    }
  } catch (e) {
    console.log('无法获取当前页面状态:', e);
  }
});

// 通知内容脚本设置变更
async function notifyContentScript(key, value) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && (tab.url?.includes('linux.do') || tab.url?.includes('idcflare.com'))) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'updateSetting',
        key: key,
        value: value
      });
    }
  } catch (e) {
    console.log('无法通知内容脚本:', e);
  }
}
