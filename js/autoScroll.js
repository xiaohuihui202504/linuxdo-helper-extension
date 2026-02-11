/**
 * Linux.do Helper - 自动滚动/浏览模块
 */

class AutoScrollController {
  constructor(likeCounter) {
    this.likeCounter = likeCounter;
    this.isScrolling = false;
    this.autoRunning = false;
    this.scrollInterval = null;
    this.pauseTimeout = null;
    this.navigationTimeout = null;
    this.navigationGuardInterval = null;

    // 配置
    this.topicList = [];
    this.topicIndex = 0;
    this.readTopics = new Set();
    this.sessionReadCount = 0;
    this.totalReadCount = LDH_Storage.getSync('totalReadCount', 0);

    // 设置选项
    this.autoLikeEnabled = LDH_Storage.getSync('autoLikeEnabled', false);
    this.quickLikeEnabled = LDH_Storage.getSync('quickLikeEnabled', false);
    this.readUnreadEnabled = LDH_Storage.getSync('readUnreadEnabled', false);
    this.randomOrderEnabled = LDH_Storage.getSync('randomOrderEnabled', false);
    this.skipReadEnabled = LDH_Storage.getSync('skipReadEnabled', true);
    this.stopOnLikeLimitEnabled = LDH_Storage.getSync('stopOnLikeLimitEnabled', false);
    this.stopAfterReadEnabled = LDH_Storage.getSync('stopAfterReadEnabled', false);
    this.stopAfterReadCount = LDH_Storage.getSync('stopAfterReadCount', 10);
    this.topicLimit = LDH_Storage.getSync('topicLimit', 100);
    this.restTime = LDH_Storage.getSync('restTime', 10);
    this.likeFilterMode = LDH_Storage.getSync('likeFilterMode', 'off');
    this.likeMinThreshold = LDH_Storage.getSync('likeMinThreshold', 3);

    // 今日阅读计数
    this.todayReadCount = this.loadTodayReadCount();

    // 回调
    this.onStatusChange = null;
    this.onStatsUpdate = null;

    this.isTopicPage = LDH_Utils.isTopicPage();
    this.pageLoadTime = Date.now();
    this.lastPageUrl = window.location.href;

    // 加载已读帖子列表
    this.loadReadTopics();
  }

  loadReadTopics() {
    const stored = LDH_Storage.getSync('readTopics', []);
    this.readTopics = new Set(stored);
  }

  saveReadTopics() {
    // 只保留最近1000个已读帖子
    const arr = Array.from(this.readTopics).slice(-1000);
    LDH_Storage.setSync('readTopics', arr);
  }

  // 加载今日阅读数（按日期区分）
  loadTodayReadCount() {
    const today = new Date().toISOString().slice(0, 10);
    const stored = LDH_Storage.getSync('todayReadData', { date: '', count: 0 });
    if (stored.date === today) {
      return stored.count;
    }
    return 0;
  }

  // 保存今日阅读数
  saveTodayReadCount() {
    const today = new Date().toISOString().slice(0, 10);
    LDH_Storage.setSync('todayReadData', { date: today, count: this.todayReadCount });
  }

  // 开始自动阅读
  start() {
    if (this.autoRunning) return;

    // 检查点赞上限
    if (this.stopOnLikeLimitEnabled && this.likeCounter) {
      const status = this.likeCounter.getStatus();
      if (status.isInCooldown || status.remaining === 0) {
        LDH_Utils.showNotification('点赞已达上限，无法开始阅读');
        return;
      }
    }

    this.autoRunning = true;
    LDH_Storage.setSession('autoRunning', true);

    if (this.onStatusChange) {
      this.onStatusChange(true);
    }

    this.startNavigationGuard();

    if (this.isTopicPage) {
      this.startScrolling();
      if (this.autoLikeEnabled) {
        this.autoLikeTopic();
      }
    } else {
      this.getLatestTopics().then(() => this.navigateNextTopic());
    }
  }

  // 停止自动阅读
  stop() {
    this.autoRunning = false;
    this.stopScrolling();
    this.stopNavigationGuard();
    LDH_Storage.setSession('autoRunning', false);

    if (this.navigationTimeout) {
      clearTimeout(this.navigationTimeout);
      this.navigationTimeout = null;
    }

    if (this.onStatusChange) {
      this.onStatusChange(false);
    }
  }

  // 开始滚动
  startScrolling() {
    if (this.isScrolling) return;
    this.isScrolling = true;

    const config = LDH_CONFIG.scroll;

    const doScroll = async () => {
      if (!this.isScrolling || !this.autoRunning) return;

      // 模拟人类滚动行为
      let distance = LDH_Utils.random(config.minDistance, config.maxDistance);
      let speed = LDH_Utils.random(config.minSpeed, config.maxSpeed);

      // 偶尔快速滚动
      if (Math.random() < config.fastScrollChance) {
        distance = LDH_Utils.random(config.fastScrollMin, config.fastScrollMax);
        speed = LDH_Utils.random(50, 100);
      }

      window.scrollBy({
        top: distance,
        behavior: 'smooth'
      });

      // 检查是否到达底部
      if (LDH_Utils.isNearBottom()) {
        await LDH_Utils.sleep(LDH_CONFIG.time.loadWait);

        if (LDH_Utils.isPageLoaded()) {
          // 记录已读
          const topicId = this.getCurrentTopicId();
          if (topicId) {
            this.readTopics.add(topicId);
            this.saveReadTopics();
            this.sessionReadCount++;
            this.totalReadCount++;
            this.todayReadCount++;
            LDH_Storage.setSync('totalReadCount', this.totalReadCount);
            this.saveTodayReadCount();

            if (this.onStatsUpdate) {
              this.onStatsUpdate({
                sessionRead: this.sessionReadCount,
                totalRead: this.totalReadCount,
                todayRead: this.todayReadCount,
                remaining: this.topicList.length - this.topicIndex
              });
            }

            // 检查阅读数量限制
            if (this.stopAfterReadEnabled && this.sessionReadCount >= this.stopAfterReadCount) {
              console.log('[AutoScroll] 已达到阅读数量限制，停止阅读');
              this.stop();
              LDH_Utils.showNotification(`已达到阅读数量限制 (${this.stopAfterReadCount})，自动停止`);
              return;
            }
          }

          // 自动点赞
          if (this.autoLikeEnabled) {
            await this.autoLikeTopic();
          }

          // 导航到下一篇
          this.stopScrolling();
          await LDH_Utils.sleep(LDH_Utils.random(1000, 2000));
          await this.navigateNextTopic();
        }
      }

      // 随机暂停
      if (Math.random() < 0.1) {
        await LDH_Utils.sleep(LDH_Utils.random(config.minPause, config.maxPause));
      }
    };

    this.scrollInterval = setInterval(doScroll, LDH_CONFIG.scroll.checkInterval);
    doScroll();
  }

  // 停止滚动
  stopScrolling() {
    this.isScrolling = false;
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
    if (this.pauseTimeout) {
      clearTimeout(this.pauseTimeout);
      this.pauseTimeout = null;
    }
  }

  // 获取当前话题ID
  getCurrentTopicId() {
    const match = window.location.pathname.match(/\/t\/topic\/(\d+)/);
    return match ? match[1] : null;
  }

  // 获取最新话题列表
  async getLatestTopics() {
    try {
      const baseUrl = LDH_Utils.getBaseUrl();
      let url;

      if (this.readUnreadEnabled) {
        url = `${baseUrl}/unread.json?per_page=${this.topicLimit}`;
      } else {
        url = `${baseUrl}/latest.json?per_page=${this.topicLimit}`;
      }

      const response = await fetch(url);
      const data = await response.json();

      let topics = data.topic_list?.topics || [];

      // 跳过已读
      if (this.skipReadEnabled) {
        topics = topics.filter(t => !this.readTopics.has(String(t.id)));
      }

      // 随机顺序
      if (this.randomOrderEnabled) {
        topics = topics.sort(() => Math.random() - 0.5);
      }

      this.topicList = topics;
      this.topicIndex = 0;

      console.log(`[AutoScroll] 获取到 ${this.topicList.length} 个话题`);

      if (this.onStatsUpdate) {
        this.onStatsUpdate({
          sessionRead: this.sessionReadCount,
          totalRead: this.totalReadCount,
          todayRead: this.todayReadCount,
          remaining: this.topicList.length
        });
      }

      return this.topicList;
    } catch (error) {
      console.error('[AutoScroll] 获取话题列表失败:', error);
      return [];
    }
  }

  // 导航到下一个话题
  async navigateNextTopic() {
    if (!this.autoRunning) return;

    // 检查是否需要获取新的话题列表
    if (this.topicIndex >= this.topicList.length) {
      await this.getLatestTopics();
      if (this.topicList.length === 0) {
        console.log('[AutoScroll] 没有更多话题，停止阅读');
        this.stop();
        LDH_Utils.showNotification('没有更多话题可阅读');
        return;
      }
    }

    // 检查点赞上限
    if (this.stopOnLikeLimitEnabled && this.likeCounter) {
      const status = this.likeCounter.getStatus();
      if (status.isInCooldown || status.remaining === 0) {
        console.log('[AutoScroll] 点赞达到上限，停止阅读');
        this.stop();
        LDH_Utils.showNotification('点赞已达上限，自动停止阅读');
        return;
      }
    }

    const topic = this.topicList[this.topicIndex];
    this.topicIndex++;

    if (topic) {
      const url = `${LDH_Utils.getBaseUrl()}/t/topic/${topic.id}`;
      console.log(`[AutoScroll] 导航到话题: ${topic.title || topic.id}`);

      this.pageLoadTime = Date.now();
      window.location.href = url;
    }
  }

  // 自动点赞
  async autoLikeTopic() {
    if (!this.autoLikeEnabled) return;

    // 检查是否在允许的板块
    if (!this.isLikeAllowedInCurrentCategory()) {
      console.log('[AutoScroll] 当前板块不允许自动点赞');
      return;
    }

    // 检查点赞限制
    if (this.likeCounter) {
      const status = this.likeCounter.getStatus();
      if (status.isInCooldown || status.remaining === 0) {
        console.log('[AutoScroll] 点赞已达上限，跳过自动点赞');
        return;
      }
    }

    try {
      // 查找主帖的点赞按钮
      const posts = document.querySelectorAll('.topic-post');
      if (posts.length === 0) return;

      const firstPost = posts[0];

      // 检查点赞过滤
      if (this.likeFilterMode !== 'off') {
        const shouldLike = this.shouldLikePost(firstPost);
        if (!shouldLike.shouldLike) {
          console.log(`[AutoScroll] 跳过点赞: ${shouldLike.reason}`);
          return;
        }
      }

      // 查找点赞按钮
      const likeButton = firstPost.querySelector('.discourse-reactions-reaction-button:not(.has-reaction), .like-button:not(.has-like)');
      if (likeButton) {
        await LDH_Utils.sleep(LDH_Utils.random(500, 1500));
        likeButton.click();
        console.log('[AutoScroll] 已点赞主帖');
      }

      // 快速点赞回复
      if (this.quickLikeEnabled) {
        for (let i = 1; i < Math.min(posts.length, 5); i++) {
          const post = posts[i];
          const replyLikeBtn = post.querySelector('.discourse-reactions-reaction-button:not(.has-reaction), .like-button:not(.has-like)');
          if (replyLikeBtn) {
            await LDH_Utils.sleep(LDH_Utils.random(300, 800));
            replyLikeBtn.click();
          }
        }
      }
    } catch (error) {
      console.error('[AutoScroll] 自动点赞失败:', error);
    }
  }

  // 检查帖子是否应该点赞
  shouldLikePost(postElement) {
    if (this.likeFilterMode === 'off') {
      return { shouldLike: true, reason: 'filter_off' };
    }

    const likeCount = this.getPostLikeCount(postElement);

    if (this.likeFilterMode === 'threshold') {
      if (likeCount >= this.likeMinThreshold) {
        return { shouldLike: true, reason: 'threshold_passed', likeCount };
      } else {
        return { shouldLike: false, reason: 'below_threshold', likeCount };
      }
    } else if (this.likeFilterMode === 'probability') {
      if (likeCount <= 1) {
        return { shouldLike: false, reason: 'too_few_likes', likeCount };
      }
      const probability = Math.min(0.95, 0.2 + Math.log10(likeCount) * 0.35);
      const random = Math.random();
      if (random < probability) {
        return { shouldLike: true, reason: 'probability_passed', likeCount, probability };
      } else {
        return { shouldLike: false, reason: 'probability_failed', likeCount, probability };
      }
    }

    return { shouldLike: true, reason: 'unknown_mode' };
  }

  // 获取帖子点赞数
  getPostLikeCount(postElement) {
    const reactionButton = postElement.querySelector('.discourse-reactions-reaction-button');
    if (reactionButton) {
      const ariaLabel = reactionButton.getAttribute('aria-label');
      if (ariaLabel) {
        const match = ariaLabel.match(/(\d+)/);
        if (match) {
          return parseInt(match[1]);
        }
      }
      const countSpan = reactionButton.querySelector('.discourse-reactions-counter, .reaction-count, .like-count');
      if (countSpan) {
        const count = parseInt(countSpan.textContent.trim());
        if (!isNaN(count)) {
          return count;
        }
      }
    }
    return 0;
  }

  // 检查当前板块是否允许点赞
  isLikeAllowedInCurrentCategory() {
    const config = LDH_CONFIG.likeAllowedCategories;
    if (!config || !config.allowed || config.allowed.length === 0) {
      return true;
    }

    // 从页面获取板块信息
    const categoryLinks = document.querySelectorAll('.topic-category a, .category-name, .badge-category-bg');
    if (categoryLinks.length === 0) return true;

    let category = null;
    for (const link of categoryLinks) {
      const text = link.textContent?.trim();
      if (text) {
        category = text;
        break;
      }
    }

    if (!category) return true;

    // 检查是否在排除列表
    if (config.excluded && config.excluded.includes(category)) {
      return false;
    }

    // 检查是否在允许列表
    return config.allowed.includes(category);
  }

  // 启动导航守护
  startNavigationGuard() {
    if (this.navigationGuardInterval) {
      clearInterval(this.navigationGuardInterval);
    }

    this.pageLoadTime = Date.now();
    this.lastPageUrl = window.location.href;

    this.navigationGuardInterval = setInterval(() => {
      if (!this.autoRunning) return;

      const currentTime = Date.now();
      const timeOnPage = currentTime - this.pageLoadTime;
      const currentUrl = window.location.href;

      if (currentUrl !== this.lastPageUrl) {
        this.pageLoadTime = currentTime;
        this.lastPageUrl = currentUrl;
        this.isTopicPage = LDH_Utils.isTopicPage();

        // 新页面加载后开始滚动
        if (this.isTopicPage && !this.isScrolling) {
          setTimeout(() => {
            this.startScrolling();
            if (this.autoLikeEnabled) {
              this.autoLikeTopic();
            }
          }, 1000);
        }
        return;
      }

      // 检测卡住
      if (this.isTopicPage && timeOnPage > 60000 && !this.isScrolling) {
        console.warn('[AutoScroll] 检测到页面可能卡住，尝试恢复...');
        this.recoverFromStuck();
      }

      if (!this.isTopicPage && timeOnPage > 30000) {
        console.warn('[AutoScroll] 检测到在非文章页卡住，尝试恢复...');
        this.recoverFromStuck();
      }
    }, 5000);
  }

  // 停止导航守护
  stopNavigationGuard() {
    if (this.navigationGuardInterval) {
      clearInterval(this.navigationGuardInterval);
      this.navigationGuardInterval = null;
    }
  }

  // 从卡住状态恢复
  async recoverFromStuck() {
    this.stopScrolling();
    await LDH_Utils.sleep(1000);

    if (this.isTopicPage) {
      this.startScrolling();
    } else {
      if (this.topicList.length === 0) {
        await this.getLatestTopics();
      }
      await this.navigateNextTopic();
    }

    this.pageLoadTime = Date.now();
  }

  // 更新设置
  updateSetting(key, value) {
    this[key] = value;
    LDH_Storage.setSync(key, value);
  }
}

// 导出到全局
window.LDH_AutoScrollController = AutoScrollController;
