/**
 * Linux.do Helper - 点赞计数器模块
 */

class LikeCounter {
  constructor() {
    this.STORAGE_KEY = `ldh_likes_counter_${window.location.hostname}`;
    this.SYNC_INTERVAL = 30 * 60 * 1000; // 30分钟同步一次
    this.MAX_STORED_ITEMS = 500;

    this.state = {
      timestamps: [],
      cooldownUntil: 0,
      lastSync: 0,
      matched: true,
      userTrustLevel: null
    };

    this.currentUser = null;
    this.uiUpdateCallbacks = [];
    this.syncTimer = null;

    this.loadState();
    this.installInterceptors();
    this.startPeriodicSync();
  }

  // 加载状态
  loadState() {
    try {
      const stored = LDH_Storage.getSync(this.STORAGE_KEY, '{}');
      const parsed = typeof stored === 'string' ? JSON.parse(stored) : stored;
      this.state = { ...this.state, ...parsed };
      if (this.state.timestamps.length > this.MAX_STORED_ITEMS) {
        this.state.timestamps = this.state.timestamps.slice(0, this.MAX_STORED_ITEMS);
      }
    } catch (e) {
      console.error('[LikeCounter] 加载状态失败:', e);
      this.state = { timestamps: [], cooldownUntil: 0, lastSync: 0, matched: false, userTrustLevel: null };
    }
    this.cleanOldEntries();
  }

  // 保存状态
  saveState() {
    try {
      LDH_Storage.setSync(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error('[LikeCounter] 保存状态失败:', e);
    }
  }

  // 清理24小时前的过期记录
  cleanOldEntries() {
    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;

    this.state.timestamps = this.state.timestamps.filter(ts => ts > cutoff);
    this.state.timestamps.sort((a, b) => b - a);

    if (this.state.cooldownUntil > 0 && this.state.cooldownUntil < now) {
      const expectedBase = this.state.cooldownUntil - (24 * 60 * 60 * 1000);
      const beforeCount = this.state.timestamps.length;
      this.state.timestamps = this.state.timestamps.filter(ts =>
        ts < expectedBase || ts >= expectedBase + 5000
      );
      if (this.state.timestamps.length < beforeCount) {
        this.checkAndUpdateMismatch();
      }
      this.state.cooldownUntil = 0;
    }
  }

  // 检查并更新匹配状态
  checkAndUpdateMismatch() {
    const limit = this.getDailyLimit();
    const count = this.state.timestamps.length;
    this.state.matched = (count >= limit) ||
                         (this.state.lastSync === 0) ||
                         (this.state.lastSync > 0 && count === 0);
  }

  // 获取每日点赞限额
  getDailyLimit() {
    const limits = LDH_CONFIG.likeLimits;
    if (this.currentUser && limits[this.currentUser.trust_level] !== undefined) {
      return limits[this.currentUser.trust_level];
    }
    if (this.state.userTrustLevel !== null && limits[this.state.userTrustLevel] !== undefined) {
      return limits[this.state.userTrustLevel];
    }
    return 50; // 默认值
  }

  // 获取剩余可点赞数
  getRemainingLikes() {
    this.cleanOldEntries();
    const limit = this.getDailyLimit();
    const used = this.state.timestamps.length;
    return Math.max(0, limit - used);
  }

  // 获取已使用的点赞数
  getUsedLikes() {
    this.cleanOldEntries();
    return this.state.timestamps.length;
  }

  // 是否处于冷却期
  isInCooldown() {
    return this.state.cooldownUntil > Date.now();
  }

  // 获取冷却剩余时间
  getCooldownRemaining() {
    if (!this.isInCooldown()) return 0;
    return Math.max(0, this.state.cooldownUntil - Date.now());
  }

  // 格式化冷却时间
  formatCooldown() {
    const diff = this.getCooldownRemaining();
    if (diff <= 0) return null;
    return LDH_Utils.formatTime(diff);
  }

  // 处理点赞API响应
  processToggleResponse(url, data) {
    this.loadState();
    const now = Date.now();

    if (data.errors && data.error_type === 'rate_limit') {
      const waitSeconds = data.extras?.wait_seconds || 0;
      if (waitSeconds > 0) {
        this.state.cooldownUntil = now + (waitSeconds * 1000);
        console.log(`[LikeCounter] 触发限流，冷却 ${waitSeconds} 秒`);
      }

      const limit = this.getDailyLimit();
      const currentCount = this.state.timestamps.length;
      this.state.matched = (currentCount >= limit);

      if (currentCount < limit && waitSeconds > 0) {
        const needed = limit - currentCount;
        const placeholderBaseTime = (now + waitSeconds * 1000) - (24 * 60 * 60 * 1000);
        const safeNeeded = Math.min(needed, 200);
        for (let i = 0; i < safeNeeded; i++) {
          this.state.timestamps.push(placeholderBaseTime + i);
        }
        this.state.timestamps.sort((a, b) => b - a);
      }
    } else if (data.id || data.resource_post_id) {
      const isLike = !!data.current_user_reaction;
      if (isLike) {
        this.state.timestamps.push(now);
        console.log(`[LikeCounter] 记录点赞，当前已用 ${this.state.timestamps.length}/${this.getDailyLimit()}`);
      } else {
        if (this.state.timestamps.length > 0) {
          this.state.timestamps.shift();
          console.log(`[LikeCounter] 取消点赞，当前已用 ${this.state.timestamps.length}/${this.getDailyLimit()}`);
        }
        if (this.state.cooldownUntil > now) {
          this.state.cooldownUntil = 0;
        }
      }
    }

    this.saveState();
    this.notifyUIUpdate();
  }

  // 安装请求拦截器
  installInterceptors() {
    const self = this;

    // 拦截fetch
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = (typeof args[0] === 'string') ? args[0] : (args[0]?.url || '');
      const response = await originalFetch.apply(this, args);

      if (url && (url.includes('/toggle.json') || url.includes('/custom-reactions/') || url.includes('/discourse-reactions/'))) {
        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          self.processToggleResponse(url, data);
        } catch (e) {
          // 忽略解析错误
        }
      }
      return response;
    };

    // 拦截XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this._likeCounterUrl = url;
      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function () {
      const url = this._likeCounterUrl;
      if (url && (url.includes('/toggle.json') || url.includes('/custom-reactions/') || url.includes('/discourse-reactions/'))) {
        this.addEventListener('load', function () {
          try {
            const data = JSON.parse(this.responseText);
            self.processToggleResponse(url, data);
          } catch (e) {
            // 忽略解析错误
          }
        });
      }
      return originalSend.apply(this, arguments);
    };

    console.log('[LikeCounter] 拦截器已安装');
  }

  // 远程同步
  async syncRemote(force = false) {
    if (!force) {
      this.loadState();
      const lastSyncTime = this.state.lastSync || 0;
      const timeSinceLastSync = Date.now() - lastSyncTime;
      const minSyncInterval = 30 * 60 * 1000;
      if (timeSinceLastSync < minSyncInterval) {
        console.log(`[LikeCounter] 距离上次同步仅 ${Math.floor(timeSinceLastSync / 60000)} 分钟，跳过本次同步`);
        this.notifyUIUpdate();
        return;
      }
    }

    if (!this.currentUser) {
      await this.fetchCurrentUser();
      if (!this.currentUser) return;
    }

    const savedCooldown = this.state.cooldownUntil;
    this.cleanOldEntries();
    const username = this.currentUser.username;
    console.log(`[LikeCounter] 开始同步用户 ${username} 的点赞数据...`);

    try {
      const limit = this.getDailyLimit();

      // 尝试获取服务器冷却时间
      const serverCooldownTime = await this.fetchCooldownTime();

      // 如果服务器返回了冷却时间，说明已经达到限额
      if (serverCooldownTime > 0) {
        console.log(`[LikeCounter] 服务器确认已达限额，冷却时间: ${new Date(serverCooldownTime).toLocaleString()}`);
        const baseTime = serverCooldownTime - 24 * 60 * 60 * 1000;
        this.state.timestamps = [];
        for (let i = 0; i < limit; i++) {
          this.state.timestamps.push(baseTime + i * 60 * 1000);
        }
        this.state.cooldownUntil = serverCooldownTime;
        this.state.lastSync = Date.now();
        this.state.matched = true;
        LDH_Storage.setSync('likeResumeTime', serverCooldownTime);

        if (this.currentUser?.trust_level !== undefined) {
          this.state.userTrustLevel = this.currentUser.trust_level;
        }

        this.saveState();
        this.notifyUIUpdate();
        console.log(`[LikeCounter] 同步完成（服务器确认限额），已用 ${limit}/${limit}`);
        return;
      }

      const couldNotTest = serverCooldownTime === -1;

      const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
      const reactions = await this.fetchUserActions(username, cutoffTime);

      // 按post_id去重
      const postMap = new Map();
      for (const item of reactions) {
        if (!postMap.has(item.post_id) || postMap.get(item.post_id) < item.timestamp) {
          postMap.set(item.post_id, item.timestamp);
        }
      }
      const dedupedTimestamps = Array.from(postMap.values());

      console.log(`[LikeCounter] 从API获取到 ${reactions.length} 条记录，去重后 ${dedupedTimestamps.length} 个不同帖子`);

      // 处理冷却状态
      let effectiveCooldown = 0;
      if (savedCooldown > Date.now()) {
        effectiveCooldown = savedCooldown;
      }
      const bcLikeResumeTime = LDH_Storage.getSync('likeResumeTime', null);
      if (bcLikeResumeTime && bcLikeResumeTime > Date.now() && bcLikeResumeTime > effectiveCooldown) {
        effectiveCooldown = bcLikeResumeTime;
      }

      if (!couldNotTest && effectiveCooldown > 0) {
        console.log(`[LikeCounter] 服务器确认无限流，清除旧的冷却状态`);
        this.state.cooldownUntil = 0;
        LDH_Storage.setSync('likeResumeTime', null);
      } else if (couldNotTest && effectiveCooldown > 0) {
        if (dedupedTimestamps.length >= limit - 1) {
          this.state.cooldownUntil = effectiveCooldown;
        }
      }

      this.state.timestamps = dedupedTimestamps;
      this.state.lastSync = Date.now();
      this.state.matched = true;

      this.cleanOldEntries();

      if (this.state.timestamps.length >= limit) {
        const oldestTs = Math.min(...this.state.timestamps);
        const estimatedCooldown = oldestTs + 24 * 60 * 60 * 1000;
        if (estimatedCooldown > Date.now()) {
          this.state.cooldownUntil = estimatedCooldown;
          LDH_Storage.setSync('likeResumeTime', estimatedCooldown);
        }
      }

      if (this.currentUser?.trust_level !== undefined) {
        this.state.userTrustLevel = this.currentUser.trust_level;
      }

      this.saveState();
      this.notifyUIUpdate();
      console.log(`[LikeCounter] 同步完成，已用 ${this.state.timestamps.length}/${limit}`);
    } catch (e) {
      console.error('[LikeCounter] 同步失败:', e);
    }
  }

  // 获取服务器冷却时间（通过尝试点赞触发429响应）
  // 返回值: >0 冷却结束时间戳, 0 无限流, -1 无法测试
  async fetchCooldownTime() {
    try {
      const postElement = document.querySelector('[data-post-id]');
      let testPostId = postElement?.dataset?.postId;

      if (!testPostId) {
        console.log(`[LikeCounter] 页面上没有帖子，跳过冷却时间获取`);
        return -1;
      }

      const csrfToken = LDH_Utils.getCsrfToken();
      if (!csrfToken) {
        console.log(`[LikeCounter] 无法获取 CSRF token，跳过冷却时间获取`);
        return -1;
      }

      const response = await fetch(`${LDH_Utils.getBaseUrl()}/discourse-reactions/posts/${testPostId}/custom-reactions/heart/toggle.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken
        }
      });

      const data = await response.json();

      if (data.errors && data.error_type === 'rate_limit') {
        const waitSeconds = data.extras?.wait_seconds || 0;
        if (waitSeconds > 0) {
          const cooldownTime = Date.now() + (waitSeconds * 1000);
          console.log(`[LikeCounter] 服务器返回限流，需等待 ${waitSeconds} 秒`);
          return cooldownTime;
        }
      } else if (data.id || data.resource_post_id) {
        // 点赞成功，取消点赞
        console.log(`[LikeCounter] 意外：点赞成功，立即取消并返回0`);
        await fetch(`${LDH_Utils.getBaseUrl()}/discourse-reactions/posts/${testPostId}/custom-reactions/heart/toggle.json`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          }
        });
        return 0;
      }

      return -1;
    } catch (e) {
      console.error('[LikeCounter] 获取冷却时间失败:', e);
      return -1;
    }
  }

  // 获取当前用户
  async fetchCurrentUser() {
    try {
      let username = null;

      // 方法1：从Discourse全局对象获取
      const discourseUser = window.Discourse?.User?.current?.() ||
        window.Discourse?.currentUser ||
        window.User?.current?.();
      if (discourseUser?.username) {
        this.currentUser = discourseUser;
        username = discourseUser.username;
      }

      // 方法2：从preload数据获取
      if (!username) {
        try {
          const preloadData = document.getElementById('data-preloaded');
          if (preloadData) {
            const data = JSON.parse(preloadData.dataset.preloaded);
            if (data?.currentUser) {
              const cu = JSON.parse(data.currentUser);
              if (cu?.username) {
                this.currentUser = cu;
                username = cu.username;
              }
            }
          }
        } catch (e) { }
      }

      // 方法3：从用户头像alt获取
      if (!username) {
        const userMenuBtn = document.querySelector('.header-dropdown-toggle.current-user');
        if (userMenuBtn) {
          const img = userMenuBtn.querySelector('img[alt]');
          if (img && img.alt) {
            username = img.alt.trim().replace(/^@/, '');
            this.currentUser = { username };
          }
        }
      }

      // 方法4：从用户头像title获取
      if (!username) {
        const userAvatar = document.querySelector('.current-user img[title]');
        if (userAvatar && userAvatar.title) {
          username = userAvatar.title.trim().replace(/^@/, '');
          this.currentUser = { username };
        }
      }

      // 方法5：从用户链接href获取
      if (!username) {
        const currentUserLink = document.querySelector('a.current-user, .header-dropdown-toggle.current-user a');
        if (currentUserLink) {
          const href = currentUserLink.getAttribute('href');
          if (href && href.includes('/u/')) {
            username = href.split('/u/')[1].split('/')[0];
            if (username) {
              username = username.trim().replace(/^@/, '');
              this.currentUser = { username };
            }
          }
        }
      }

      // 方法6：从localStorage获取
      if (!username) {
        try {
          const stored = localStorage.getItem('discourse_current_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.username) {
              this.currentUser = parsed;
              username = parsed.username;
            }
          }
        } catch (e) { }
      }

      // 方法7（最后手段）：从API获取
      if (!username) {
        // 检查429冷却期
        const session429Until = LDH_Storage.getSync('session429Until', 0);
        if (session429Until > Date.now()) {
          console.log(`[LikeCounter] session/current 429 冷却期中，跳过`);
          return;
        }

        const response = await fetch(`${LDH_Utils.getBaseUrl()}/session/current.json`);
        if (response.status === 429) {
          console.warn('[LikeCounter] session/current 遇到 429，设置 30 分钟冷却');
          LDH_Storage.setSync('session429Until', Date.now() + 30 * 60 * 1000);
          return;
        }
        if (response.ok) {
          const data = await response.json();
          if (data.current_user) {
            this.currentUser = data.current_user;
          }
        }
      }
    } catch (e) {
      console.error('[LikeCounter] 获取用户信息失败:', e);
    }
  }

  // 获取用户点赞历史
  async fetchUserActions(username, cutoffTime) {
    const allItems = [];
    const cutoff = cutoffTime || (Date.now() - 24 * 60 * 60 * 1000);
    let offset = 0;
    let pages = 0;

    while (pages < 5) {
      try {
        const url = `${LDH_Utils.getBaseUrl()}/user_actions.json?limit=50&username=${username}&filter=1&offset=${offset}`;
        const response = await fetch(url);
        const res = await response.json();
        const items = res.user_actions || [];

        if (!items.length) break;

        let hasOld = false;
        for (const item of items) {
          const t = new Date(item.created_at).getTime();
          if (t > cutoff) {
            allItems.push({ post_id: item.post_id, timestamp: t });
          } else {
            hasOld = true;
          }
        }

        if (hasOld || items.length < 50) break;
        offset += 50;
        pages++;
      } catch (e) {
        console.error(`[LikeCounter] 获取点赞历史出错:`, e);
        break;
      }
    }

    return allItems;
  }

  // 启动定期同步
  startPeriodicSync() {
    setTimeout(() => this.syncRemote(), 3000);
    this.syncTimer = setInterval(() => {
      this.syncRemote();
    }, this.SYNC_INTERVAL);
  }

  // 设置当前用户
  setCurrentUser(user) {
    this.currentUser = user;
    this.notifyUIUpdate();
  }

  // UI更新回调
  onUIUpdate(callback) {
    this.uiUpdateCallbacks.push(callback);
  }

  notifyUIUpdate() {
    for (const callback of this.uiUpdateCallbacks) {
      try {
        callback(this.getStatus());
      } catch (e) {
        console.error('[LikeCounter] UI更新回调错误:', e);
      }
    }
  }

  // 获取当前状态
  getStatus() {
    this.cleanOldEntries();
    return {
      remaining: this.getRemainingLikes(),
      used: this.getUsedLikes(),
      limit: this.getDailyLimit(),
      isInCooldown: this.isInCooldown(),
      cooldownRemaining: this.getCooldownRemaining(),
      cooldownFormatted: this.formatCooldown(),
      cooldownUntil: this.state.cooldownUntil,
      matched: this.state.matched,
      lastSync: this.state.lastSync
    };
  }

  // 清除冷却
  clearCooldown() {
    this.state.cooldownUntil = 0;
    const now = Date.now();
    const recentCutoff = now - 60000;
    this.state.timestamps = this.state.timestamps.filter(ts => ts > recentCutoff || ts < now - 24 * 60 * 60 * 1000 + 60000);
    this.saveState();
    this.notifyUIUpdate();
    console.log('[LikeCounter] 冷却已清除');
  }

  // 手动触发同步
  manualSync() {
    return this.syncRemote(true);
  }
}

// 导出到全局
window.LDH_LikeCounter = LikeCounter;
