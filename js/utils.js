/**
 * Linux.do Helper - 工具函数模块
 */

const Utils = {
  // 生成随机数
  random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,

  // 休眠函数
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  // 检查页面是否加载完成
  isPageLoaded: () => {
    const loadingElements = document.querySelectorAll('.loading, .infinite-scroll');
    return loadingElements.length === 0;
  },

  // 检查是否接近页面底部
  isNearBottom: () => {
    const { scrollHeight, clientHeight, scrollTop } = document.documentElement;
    return (scrollTop + clientHeight) >= (scrollHeight - 200);
  },

  // 防抖函数
  debounce: (func, wait) => {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // 节流函数
  throttle: (func, limit) => {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  // 格式化数字
  formatNumber: (value) => {
    return Number(value).toLocaleString('zh-CN');
  },

  // 格式化时间
  formatTime: (ms) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);

    if (h > 0) {
      return `${h}小时${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`;
    }
    return `${String(m).padStart(2, '0')}分${String(s).padStart(2, '0')}秒`;
  },

  // 获取当前域名
  getCurrentDomain: () => window.location.hostname,

  // 获取基础URL
  getBaseUrl: () => `https://${window.location.hostname}`,

  // 检查是否是话题页面
  isTopicPage: () => window.location.pathname.includes('/t/topic/'),

  // 获取CSRF Token
  getCsrfToken: () => {
    return document.querySelector('meta[name="csrf-token"]')?.content;
  },

  // 安全的JSON解析
  safeJsonParse: (str, defaultValue = null) => {
    try {
      return JSON.parse(str);
    } catch {
      return defaultValue;
    }
  },

  // 创建DOM元素
  createElement: (tag, options = {}) => {
    const element = document.createElement(tag);
    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;
    if (options.innerHTML) element.innerHTML = options.innerHTML;
    if (options.textContent) element.textContent = options.textContent;
    if (options.style) element.style.cssText = options.style;
    if (options.attributes) {
      Object.entries(options.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }
    return element;
  },

  // 显示通知
  showNotification: (message, duration = 3000) => {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 100000;
      font-size: 14px;
      max-width: 300px;
      animation: ldh-slideIn 0.3s ease-out;
    `;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transition = 'all 0.3s';
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }
};

// 配置常量
const CONFIG = {
  scroll: {
    minSpeed: 30,
    maxSpeed: 60,
    minDistance: 80,
    maxDistance: 150,
    checkInterval: 200,
    fastScrollChance: 0.15,
    fastScrollMin: 200,
    fastScrollMax: 400,
    minPause: 100,
    maxPause: 300
  },
  time: {
    browseTime: 3600000,  // 1小时
    restTime: 600000,     // 10分钟
    minPause: 100,
    maxPause: 300,
    loadWait: 800,
  },
  article: {
    commentLimit: 5000,
    topicListLimit: 100,
    retryLimit: 3
  },
  levelRequirements: {
    0: { // 0级升1级
      topics_entered: 5,
      posts_read_count: 30,
      time_read: 600
    },
    1: { // 1级升2级
      days_visited: 15,
      likes_given: 1,
      likes_received: 1,
      post_count: 3,
      topics_entered: 20,
      posts_read_count: 100,
      time_read: 3600
    }
  },
  // 每日点赞限制
  likeLimits: {
    0: 50, 1: 50, 2: 75, 3: 100, 4: 150
  },
  // 允许自动点赞的板块配置
  likeAllowedCategories: {
    allowed: [
      '开发调优', '国产替代', '资源荟萃', '文档共建',
      '非我莫属', '读书成诗', '前沿快讯', '福利羊毛',
      '搞七捻三', '社区孵化', '运营反馈'
    ],
    excluded: ['网盘资源', '跳蚤市场', '深海幽域', '积分乐园', '扬帆起航']
  }
};

// 国际化文本
const I18N = {
  zh: {
    panelTitle: 'Linux.do 助手',
    minimizedText: '助手',
    startReading: '开始阅读',
    stopReading: '停止阅读',
    autoLike: '自动点赞',
    quickLike: '快速点赞',
    cleanMode: '清爽模式',
    grayscaleMode: '黑白灰模式',
    readUnread: '读取未读',
    randomOrder: '随机阅读',
    skipRead: '跳过已读',
    likeRemaining: '剩余点赞',
    likeCooldown: '冷却中',
    clearCooldown: '清除冷却',
    batchShowInfo: '批量展示信息',
    randomFloor: '随机楼层',
    accountInfo: '账号信息',
    creditInfo: '积分信息',
    rankInfo: '排行榜',
    settings: '设置',
    loading: '加载中...',
    loadFailed: '加载失败',
    notLoggedIn: '未登录',
    refresh: '刷新',
    stopOnLikeLimit: '点赞停止',
    stopAfterRead: '阅读限制',
    sessionRead: '本次已读',
    todayRead: '今日阅读',
    totalRead: '总阅读',
    remaining: '剩余帖子',
    likeFilter: '点赞过滤',
    filterOff: '关闭',
    filterThreshold: '阈值',
    filterProbability: '概率',
    minLikeCount: '最低赞数',
    readCount: '阅读数量',
    sync: '同步',
    syncing: '同步中...',
    syncComplete: '同步完成',
    syncFailed: '同步失败',
    cooldownCleared: '点赞冷却已清除',
    noMoreTopics: '没有更多话题可阅读',
    likeLimitReached: '点赞已达上限',
    readLimitReached: '已达到阅读数量限制',
    autoStopped: '自动停止'
  },
  en: {
    panelTitle: 'Linux.do Helper',
    minimizedText: 'Help',
    startReading: 'Start Reading',
    stopReading: 'Stop Reading',
    autoLike: 'Auto Like',
    quickLike: 'Quick Like',
    cleanMode: 'Clean Mode',
    grayscaleMode: 'Grayscale',
    readUnread: 'Unread',
    randomOrder: 'Random',
    skipRead: 'Skip Read',
    likeRemaining: 'Remaining',
    likeCooldown: 'Cooldown',
    clearCooldown: 'Clear Cooldown',
    batchShowInfo: 'Batch Show Info',
    randomFloor: 'Random Floor',
    accountInfo: 'Account',
    creditInfo: 'Credits',
    rankInfo: 'Ranking',
    settings: 'Settings',
    loading: 'Loading...',
    loadFailed: 'Load Failed',
    notLoggedIn: 'Not logged in',
    refresh: 'Refresh',
    stopOnLikeLimit: 'Like Limit Stop',
    stopAfterRead: 'Read Limit',
    sessionRead: 'Session',
    todayRead: 'Today',
    totalRead: 'Total',
    remaining: 'Remaining',
    likeFilter: 'Like Filter',
    filterOff: 'Off',
    filterThreshold: 'Threshold',
    filterProbability: 'Probability',
    minLikeCount: 'Min Likes',
    readCount: 'Read Count',
    sync: 'Sync',
    syncing: 'Syncing...',
    syncComplete: 'Sync Complete',
    syncFailed: 'Sync Failed',
    cooldownCleared: 'Cooldown cleared',
    noMoreTopics: 'No more topics',
    likeLimitReached: 'Like limit reached',
    readLimitReached: 'Read limit reached',
    autoStopped: 'Auto stopped'
  }
};

// 导出到全局
window.LDH_Utils = Utils;
window.LDH_CONFIG = CONFIG;
window.LDH_I18N = I18N;
