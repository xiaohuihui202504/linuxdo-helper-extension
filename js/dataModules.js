/**
 * Linux.do Helper - 数据模块 (账号信息、CREDIT积分、CDK分数、排行榜)
 */

// API代理：通过background script发起跨域请求
async function ldhFetchAPI(url, options = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: 'fetchAPI', url, options },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, status: 0, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response || { ok: false, status: 0, error: 'No response' });
      }
    );
  });
}

// ==================== 账号信息模块 ====================
const AccountInfoModule = {
  cachedData: null,
  cacheTime: 0,
  currentUsername: null,

  // 获取当前用户名（多种DOM检测方法 + API兜底）
  async getCurrentUsername() {
    if (this.currentUsername) return this.currentUsername;

    // 方法1：从 Discourse preload 数据获取
    try {
      const preloadData = document.getElementById('data-preloaded');
      if (preloadData) {
        const data = JSON.parse(preloadData.dataset.preloaded);
        if (data?.currentUser) {
          const cu = JSON.parse(data.currentUser);
          if (cu?.username) {
            this.currentUsername = cu.username;
            return this.currentUsername;
          }
        }
      }
    } catch (e) { }

    // 方法2：从用户菜单头像 alt 获取
    try {
      const userMenuBtn = document.querySelector('.header-dropdown-toggle.current-user');
      if (userMenuBtn) {
        const img = userMenuBtn.querySelector('img[alt]');
        if (img && img.alt) {
          this.currentUsername = img.alt.trim().replace(/^@/, '');
          return this.currentUsername;
        }
      }
    } catch (e) { }

    // 方法3：从用户头像 title 获取
    try {
      const userAvatar = document.querySelector('.current-user img[title]');
      if (userAvatar && userAvatar.title) {
        this.currentUsername = userAvatar.title.trim().replace(/^@/, '');
        return this.currentUsername;
      }
    } catch (e) { }

    // 方法4：从当前用户链接 href 获取
    try {
      const currentUserLink = document.querySelector('a.current-user, .header-dropdown-toggle.current-user a');
      if (currentUserLink) {
        const href = currentUserLink.getAttribute('href');
        if (href && href.includes('/u/')) {
          const username = href.split('/u/')[1].split('/')[0];
          if (username) {
            this.currentUsername = username.trim().replace(/^@/, '');
            return this.currentUsername;
          }
        }
      }
    } catch (e) { }

    // 方法5：从导航栏用户头像链接获取
    try {
      const avatarLink = document.querySelector('#current-user a[href*="/u/"]');
      if (avatarLink) {
        const match = avatarLink.href.match(/\/u\/([^\/]+)/);
        if (match) {
          this.currentUsername = match[1].trim().replace(/^@/, '');
          return this.currentUsername;
        }
      }
    } catch (e) { }

    // 方法6：从 localStorage 获取
    try {
      const stored = localStorage.getItem('discourse_current_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.username) {
          this.currentUsername = parsed.username;
          return this.currentUsername;
        }
      }
    } catch (e) { }

    // 方法7：遍历页面用户链接（排除帖子列表）
    try {
      const userLinks = document.querySelectorAll('a[href*="/u/"]');
      for (const link of userLinks) {
        if (link.closest('.topic-list') || link.closest('.post-stream')) continue;
        const href = link.getAttribute('href');
        if (href && href.includes('/u/')) {
          const username = href.split('/u/')[1].split('/')[0];
          if (username) {
            this.currentUsername = username.trim().replace(/^@/, '');
            return this.currentUsername;
          }
        }
      }
    } catch (e) { }

    // 方法8（最后手段）：从 session/current.json API 获取
    try {
      const session429Until = parseInt(LDH_Storage.getSync('session429Until', 0));
      if (session429Until > Date.now()) {
        console.log('[AccountInfo] session/current 429 冷却中，跳过');
        return null;
      }
      const baseUrl = LDH_Utils.getBaseUrl();
      const response = await fetch(`${baseUrl}/session/current.json`, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (response.status === 429) {
        LDH_Storage.setSync('session429Until', Date.now() + 30 * 60 * 1000);
        return null;
      }
      if (response.ok) {
        const data = await response.json();
        if (data?.current_user?.username) {
          this.currentUsername = data.current_user.username;
          return this.currentUsername;
        }
      }
    } catch (e) {
      console.error('[AccountInfo] session/current 错误:', e);
    }

    return null;
  },

  async load(forceRefresh = false) {
    const now = Date.now();
    const cacheMaxAge = 30 * 60 * 1000; // 30分钟缓存

    if (!forceRefresh && this.cachedData && (now - this.cacheTime) < cacheMaxAge) {
      return { ...this.cachedData, fromCache: true, cacheAge: now - this.cacheTime };
    }

    const username = await this.getCurrentUsername();
    if (!username) return null;

    try {
      const domain = LDH_Utils.getCurrentDomain();

      // linux.do 使用 connect.linux.do 获取详细等级信息
      if (domain === 'linux.do') {
        return await this.fetchViaConnect(username, forceRefresh);
      }

      // 其他站点使用 summary.json
      return await this.fetchViaSummary(username);
    } catch (error) {
      console.error('[AccountInfo] 加载失败:', error);
      if (this.cachedData) {
        return { ...this.cachedData, fromCache: true, cacheAge: now - this.cacheTime };
      }
      return null;
    }
  },

  // 通过 connect.linux.do 获取信任等级数据（2级及以上用户的详细要求）
  async fetchViaConnect(username, forceRefresh) {
    try {
      const response = await ldhFetchAPI('https://connect.linux.do/', {
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        credentials: 'include'
      });

      if (!response.ok || !response.data) {
        console.log('[AccountInfo] connect.linux.do 请求失败，回退到 summary.json');
        return await this.fetchViaSummary(username);
      }

      const html = response.data;
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // 1. 从 <h1> 解析全局用户名和当前等级
      let globalUsername = username;
      let currentLevel = NaN;
      const h1 = tempDiv.querySelector('h1');
      if (h1) {
        const h1Text = h1.textContent.trim();
        const welcomeMatch = h1Text.match(/你好，\s*([^(\s]*)\s*\(?([^)]*)\)?\s*(\d+)级用户/i);
        if (welcomeMatch) {
          globalUsername = welcomeMatch[2] || welcomeMatch[1] || username;
          currentLevel = parseInt(welcomeMatch[3]);
          console.log(`[AccountInfo] 从<h1>解析: 用户名='${globalUsername}', 当前等级='${currentLevel}'`);
        }
      }

      // 2. 如果从 <h1> 无法解析等级，尝试从页面文本判断
      if (isNaN(currentLevel)) {
        const pageText = tempDiv.textContent || '';

        const levelRequirementMatch = pageText.match(/信任级别\s*(\d+)\s*的要求\s*(已达到|未达到)/);
        if (levelRequirementMatch) {
          const targetLevel = parseInt(levelRequirementMatch[1]);
          const status = levelRequirementMatch[2];
          currentLevel = status === '已达到' ? targetLevel : targetLevel - 1;
        }

        if (isNaN(currentLevel)) {
          const statusMatch = pageText.match(/(已达到|不符合)信任级别\s*(\d+)\s*要求/);
          if (statusMatch) {
            const targetLevel = parseInt(statusMatch[2]);
            currentLevel = statusMatch[1] === '已达到' ? targetLevel : targetLevel - 1;
          }
        }
      }

      // 3. 根据用户等级选择数据处理方式
      if (currentLevel >= 2) {
        // 高级用户：解析 connect.linux.do 页面表格
        return this.processHighLevelData(tempDiv, globalUsername, currentLevel);
      } else if (currentLevel >= 0) {
        // 低级用户：使用 summary.json + CONFIG 配置
        return await this.fetchLowLevelData(globalUsername, currentLevel);
      } else {
        // 无法解析等级，回退到 summary.json
        return await this.fetchViaSummary(username);
      }
    } catch (error) {
      console.error('[AccountInfo] connect.linux.do 错误:', error);
      return await this.fetchViaSummary(username);
    }
  },

  // 处理高级用户（2+）的 connect.linux.do 页面数据
  processHighLevelData(tempDiv, username, currentLevel) {
    // 查找包含"信任级别 X 的要求"的表格
    let targetInfoDiv = null;

    // 方案1: 新版页面 div.card
    const cardDivs = tempDiv.querySelectorAll('div.card');
    for (const div of cardDivs) {
      const h2 = div.querySelector('h2.card-title');
      if (h2 && h2.textContent.includes('信任级别') && h2.textContent.includes('的要求')) {
        targetInfoDiv = div;
        break;
      }
    }

    // 方案2: 旧版页面 div.bg-white.p-6.rounded-lg
    if (!targetInfoDiv) {
      const potentialDivs = tempDiv.querySelectorAll('div.bg-white.p-6.rounded-lg');
      for (const div of potentialDivs) {
        const h2 = div.querySelector('h2');
        if (h2 && h2.textContent.includes('信任级别')) {
          targetInfoDiv = div;
          break;
        }
      }
    }

    // 方案3: 通用查找
    if (!targetInfoDiv) {
      const allDivs = tempDiv.querySelectorAll('div');
      for (const div of allDivs) {
        const headings = div.querySelectorAll('h1, h2, h3');
        for (const heading of headings) {
          if (heading.textContent.includes('信任级别') && heading.textContent.includes('的要求')) {
            targetInfoDiv = div;
            break;
          }
        }
        if (targetInfoDiv) break;
      }
    }

    if (!targetInfoDiv) {
      // 找不到表格，返回简要信息
      const result = {
        username,
        trustLevel: currentLevel,
        targetLevel: currentLevel + 1,
        requirements: [],
        allMet: true,
        type: 'simple',
        fromCache: false
      };
      this.cachedData = result;
      this.cacheTime = Date.now();
      return result;
    }

    // 解析标题获取目标等级
    const h2 = targetInfoDiv.querySelector('h2');
    const titleMatch = h2?.textContent.match(/信任级别\s*(\d+)\s*的要求/);
    const targetLevel = titleMatch ? parseInt(titleMatch[1]) : currentLevel + 1;

    // 解析表格数据
    const tableRows = targetInfoDiv.querySelectorAll('table tbody tr');
    const requirements = [];

    tableRows.forEach((row) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 3) {
        const name = cells[0].textContent.trim();
        const required = cells[1].textContent.trim();
        const current = cells[2].textContent.trim();
        const isMet = cells[2].classList.contains('status-met') || cells[2].classList.contains('text-green-500');

        // 简化名称
        const simpleName = name
          .replace('已读帖子（所有时间）', '已读帖子')
          .replace('浏览的话题（所有时间）', '浏览话题')
          .replace('访问次数（过去', '访问次数(')
          .replace('个月）', '月)')
          .replace('回复次数（最近', '回复(近')
          .replace('天内）', '天)');

        requirements.push({ name: simpleName, current, required, isMet });
      }
    });

    const achievedCount = requirements.filter(r => r.isMet).length;
    const allMet = achievedCount === requirements.length;

    const result = {
      username,
      trustLevel: allMet ? targetLevel : targetLevel - 1,
      targetLevel,
      requirements,
      achievedCount,
      totalCount: requirements.length,
      allMet,
      type: 'detailed',
      fromCache: false
    };

    this.cachedData = result;
    this.cacheTime = Date.now();
    return result;
  },

  // 低级用户（0-1级）使用 summary.json + CONFIG
  async fetchLowLevelData(username, currentLevel) {
    const baseUrl = LDH_Utils.getBaseUrl();
    const summaryResponse = await fetch(`${baseUrl}/u/${username}/summary.json`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    if (!summaryResponse.ok) {
      throw new Error('无法获取用户summary数据');
    }

    const data = await summaryResponse.json();
    const userSummary = data.user_summary;
    const targetLevel = currentLevel + 1;
    const configReqs = LDH_CONFIG.levelRequirements[currentLevel];

    const requirements = [];
    if (configReqs && userSummary) {
      const keyLabels = {
        topics_entered: '浏览话题',
        posts_read_count: '已读帖子',
        time_read: '阅读时长(分)',
        days_visited: '访问天数',
        likes_given: '给出的赞',
        likes_received: '收到的赞',
        post_count: '帖子数量'
      };

      for (const [key, requiredValue] of Object.entries(configReqs)) {
        let currentValue = userSummary[key] || 0;
        let displayRequired = requiredValue;

        if (key === 'time_read') {
          currentValue = Math.floor(currentValue / 60);
          displayRequired = Math.floor(requiredValue / 60);
        }

        const isMet = key === 'time_read'
          ? (userSummary[key] || 0) >= requiredValue
          : currentValue >= requiredValue;

        requirements.push({
          name: keyLabels[key] || key,
          current: String(currentValue),
          required: String(displayRequired),
          isMet
        });
      }
    }

    const achievedCount = requirements.filter(r => r.isMet).length;
    const allMet = achievedCount === requirements.length;

    const result = {
      username,
      trustLevel: currentLevel,
      targetLevel,
      requirements,
      achievedCount,
      totalCount: requirements.length,
      allMet,
      type: 'detailed',
      fromCache: false
    };

    this.cachedData = result;
    this.cacheTime = Date.now();
    return result;
  },

  // 回退方案：仅使用 summary.json（简单模式）
  async fetchViaSummary(username) {
    const baseUrl = LDH_Utils.getBaseUrl();

    // 先获取 trust_level
    let trustLevel = 0;

    // 尝试从 session/current.json 获取
    try {
      const session429Until = parseInt(LDH_Storage.getSync('session429Until', 0));
      if (session429Until <= Date.now()) {
        const response = await fetch(`${baseUrl}/session/current.json`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' }
        });
        if (response.status === 429) {
          LDH_Storage.setSync('session429Until', Date.now() + 30 * 60 * 1000);
        } else if (response.ok) {
          const data = await response.json();
          if (data?.current_user) {
            trustLevel = data.current_user.trust_level || 0;
            if (!this.currentUsername) this.currentUsername = data.current_user.username;
          }
        }
      }
    } catch (e) { }

    // 获取 summary
    const summaryResponse = await fetch(`${baseUrl}/u/${username}/summary.json`, {
      credentials: 'include',
      headers: { 'Accept': 'application/json' }
    });

    let summary = null;
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      summary = summaryData?.user_summary;
    }

    const result = {
      username,
      trustLevel,
      targetLevel: trustLevel + 1,
      requirements: [],
      allMet: true,
      type: 'simple',
      summary,
      fromCache: false
    };

    this.cachedData = result;
    this.cacheTime = Date.now();
    return result;
  }
};

// ==================== CREDIT 积分模块 ====================
const CreditModule = {
  cachedUserData: null,
  cachedDailyStats: null,
  cachedLeaderboard: null,
  cacheTime: 0,

  async load(forceRefresh = false) {
    const now = Date.now();
    const cacheMaxAge = 5 * 60 * 1000;

    if (!forceRefresh && this.cachedUserData && (now - this.cacheTime) < cacheMaxAge) {
      return {
        userData: this.cachedUserData,
        dailyStats: this.cachedDailyStats,
        leaderboard: this.cachedLeaderboard,
        fromCache: true,
        cacheAge: now - this.cacheTime
      };
    }

    try {
      // 获取用户信息
      const userResponse = await ldhFetchAPI('https://credit.linux.do/api/v1/oauth/user-info', {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://credit.linux.do/home',
          'Origin': 'https://credit.linux.do'
        }
      });

      if (!userResponse.ok || userResponse.status === 401 || userResponse.status === 403) {
        return null;
      }

      const userJson = LDH_Utils.safeJsonParse(userResponse.data);
      if (!userJson?.data) return null;

      const userData = userJson.data;

      // 获取每日统计
      const dailyResponse = await ldhFetchAPI('https://credit.linux.do/api/v1/dashboard/stats/daily?days=7', {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://credit.linux.do/home',
          'Origin': 'https://credit.linux.do'
        }
      });

      let dailyStats = [];
      if (dailyResponse.ok) {
        const dailyJson = LDH_Utils.safeJsonParse(dailyResponse.data);
        if (dailyJson?.data && Array.isArray(dailyJson.data)) {
          dailyStats = dailyJson.data;
        }
      }

      // 获取排行榜数据（当前点数和排名）
      let leaderboard = null;
      const leaderboard429Until = parseInt(LDH_Storage.getSync('leaderboard429Until', 0));

      if (leaderboard429Until <= now) {
        try {
          const [dailyRankResp, allRankResp] = await Promise.all([
            fetch(`${LDH_Utils.getBaseUrl()}/leaderboard/1?period=daily`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            }),
            fetch(`${LDH_Utils.getBaseUrl()}/leaderboard/1?period=all`, {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            })
          ]);

          let got429 = false;
          if (dailyRankResp.status === 429 || allRankResp.status === 429) {
            got429 = true;
            LDH_Storage.setSync('leaderboard429Until', now + 30 * 60 * 1000);
          }

          if (!got429) {
            const dailyRankData = dailyRankResp.ok ? await dailyRankResp.json() : null;
            const allRankData = allRankResp.ok ? await allRankResp.json() : null;

            leaderboard = {
              totalCredits: allRankData?.personal?.user?.total_score || 0,
              rank: allRankData?.personal?.position || allRankData?.personal?.user?.position || 0,
              dailyScore: dailyRankData?.personal?.user?.total_score || 0
            };
          }
        } catch (e) {
          console.error('[Credit] Leaderboard fetch error:', e);
        }
      }

      if (!leaderboard) {
        leaderboard = this.cachedLeaderboard;
      }

      this.cachedUserData = userData;
      this.cachedDailyStats = dailyStats;
      this.cachedLeaderboard = leaderboard;
      this.cacheTime = now;

      return {
        userData,
        dailyStats,
        leaderboard,
        fromCache: false
      };
    } catch (error) {
      console.error('[Credit] 加载失败:', error);
      if (this.cachedUserData) {
        return {
          userData: this.cachedUserData,
          dailyStats: this.cachedDailyStats,
          leaderboard: this.cachedLeaderboard,
          fromCache: true,
          cacheAge: now - this.cacheTime
        };
      }
      return null;
    }
  }
};

// ==================== CDK 分数模块 ====================
const CdkModule = {
  cachedData: null,
  cacheTime: 0,

  async load(forceRefresh = false) {
    const now = Date.now();
    const cacheMaxAge = 5 * 60 * 1000;

    if (!forceRefresh && this.cachedData && (now - this.cacheTime) < cacheMaxAge) {
      return { ...this.cachedData, fromCache: true, cacheAge: now - this.cacheTime };
    }

    try {
      const response = await ldhFetchAPI('https://cdk.linux.do/api/v1/oauth/user-info', {
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });

      // 检查是否被 Cloudflare 拦截
      if (response.data && response.data.includes('Just a moment')) {
        console.log('[CDK] Cloudflare challenge detected');
        return null;
      }

      if (!response.ok || response.status === 401 || response.status === 403) {
        return null;
      }

      const json = LDH_Utils.safeJsonParse(response.data);
      let cdkData = null;

      if (json?.data) {
        cdkData = json.data;
      } else if (json && (json.username || json.score !== undefined)) {
        cdkData = json;
      }

      if (!cdkData) return null;

      const result = {
        user: cdkData.user || cdkData,
        received: cdkData.received || null,
        fromCache: false
      };

      this.cachedData = result;
      this.cacheTime = now;

      return result;
    } catch (error) {
      console.error('[CDK] 加载失败:', error);
      if (this.cachedData) {
        return { ...this.cachedData, fromCache: true, cacheAge: now - this.cacheTime };
      }
      return null;
    }
  }
};

// ==================== 排行榜模块 ====================
const RankingModule = {
  cachedData: null,
  cacheTime: 0,

  periods: [
    { key: 'daily', icon: '📅' },
    { key: 'weekly', icon: '📆' },
    { key: 'monthly', icon: '🗓️' },
    { key: 'quarterly', icon: '📊' },
    { key: 'yearly', icon: '📈' },
    { key: 'all', icon: '🏅' }
  ],

  async load(forceRefresh = false) {
    const now = Date.now();
    const cacheMaxAge = 10 * 60 * 1000; // 10分钟缓存

    if (!forceRefresh && this.cachedData && (now - this.cacheTime) < cacheMaxAge) {
      return { data: this.cachedData, fromCache: true };
    }

    try {
      const baseUrl = LDH_Utils.getBaseUrl();
      const results = await Promise.all(
        this.periods.map(period =>
          fetch(`${baseUrl}/leaderboard/1?period=${period.key}`, {
            credentials: 'include',
            headers: { 'Accept': 'application/json' }
          })
            .then(r => {
              if (r.status === 429) {
                return { score: 0, position: '-', rateLimit: true };
              }
              return r.ok ? r.json().then(data => {
                if (data?.personal?.user) {
                  return {
                    score: data.personal.user.total_score || 0,
                    position: data.personal.position || data.personal.user.position || 0
                  };
                }
                return { score: 0, position: '-' };
              }) : { score: 0, position: '-' };
            })
            .catch(() => ({ score: 0, position: '-' }))
        )
      );

      this.cachedData = results;
      this.cacheTime = now;

      return { data: results, fromCache: false };
    } catch (error) {
      console.error('[Ranking] 加载失败:', error);
      if (this.cachedData) {
        return { data: this.cachedData, fromCache: true };
      }
      return null;
    }
  }
};

// 导出到全局
window.LDH_AccountInfo = AccountInfoModule;
window.LDH_Credit = CreditModule;
window.LDH_Cdk = CdkModule;
window.LDH_Ranking = RankingModule;
window.ldhFetchAPI = ldhFetchAPI;
