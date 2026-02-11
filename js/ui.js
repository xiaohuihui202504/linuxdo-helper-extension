/**
 * Linux.do Helper - UI界面模块
 */

class HelperUI {
  constructor(likeCounter, autoScroll, userInfoHelper) {
    this.likeCounter = likeCounter;
    this.autoScroll = autoScroll;
    this.userInfoHelper = userInfoHelper;

    this.container = null;
    this.isMinimized = LDH_Storage.getSync('panelMinimized', false);
    this.language = LDH_Storage.getSync('language', 'zh');
    this.cleanModeEnabled = LDH_Storage.getSync('cleanModeEnabled', false);
    this.grayscaleModeEnabled = LDH_Storage.getSync('grayscaleModeEnabled', false);
    this.themeColor = LDH_Storage.getSync('themeColor', 'purple');
    this.cfBypassEnabled = LDH_Storage.getSync('cfBypassEnabled', false);

    // 折叠状态
    this.sectionStates = LDH_Storage.getSync('sectionStates', {
      autoRead: true,
      accountInfo: false,
      credit: false,
      cdk: false,
      ranking: false,
      pluginSettings: false
    });

    // 冷却倒计时定时器
    this.cooldownTimer = null;

    this.themes = {
      purple: { primary: '#667eea', secondary: '#764ba2', label: 'themePurple' },
      blue: { primary: '#4facfe', secondary: '#00f2fe', label: 'themeBlue' },
      green: { primary: '#43e97b', secondary: '#38f9d7', label: 'themeGreen' },
      orange: { primary: '#fa709a', secondary: '#fee140', label: 'themeOrange' },
      pink: { primary: '#f093fb', secondary: '#f5576c', label: 'themePink' },
      dark: { primary: '#434343', secondary: '#000000', label: 'themeDark' }
    };

    this.init();
  }

  t(key) {
    return LDH_I18N[this.language]?.[key] || LDH_I18N['zh'][key] || key;
  }

  init() {
    this.createPanel();
    this.setupEventListeners();
    this.applyModes();
    this.setupCfBypass();

    // 注册点赞计数器UI更新回调
    if (this.likeCounter) {
      this.likeCounter.onUIUpdate(status => {
        this.updateLikeCounterUI(status);
        if (status.isInCooldown) {
          if (this.autoScroll && (this.autoScroll.autoLikeEnabled || this.autoScroll.quickLikeEnabled)) {
            this.autoScroll.updateSetting('autoLikeEnabled', false);
            this.autoScroll.updateSetting('quickLikeEnabled', false);
            this.container.querySelectorAll('.ldh-toggle-input').forEach(input => {
              if (input.dataset.key === 'autoLikeEnabled' || input.dataset.key === 'quickLikeEnabled') {
                input.checked = false;
              }
            });
          }
        }
      });
    }

    // 注册自动滚动状态回调
    if (this.autoScroll) {
      this.autoScroll.onStatusChange = (running) => this.updateAutoScrollStatus(running);
      this.autoScroll.onStatsUpdate = (stats) => this.updateReadStats(stats);
    }
  }

  createPanel() {
    this.container = LDH_Utils.createElement('div', {
      id: 'ldh-panel',
      className: `ldh-panel ${this.isMinimized ? 'minimized' : ''}`
    });

    const theme = this.themes[this.themeColor] || this.themes.purple;
    this.container.style.setProperty('--ldh-primary', theme.primary);
    this.container.style.setProperty('--ldh-secondary', theme.secondary);

    this.container.innerHTML = this.getPanelHTML();
    document.body.appendChild(this.container);
    this.makeDraggable();

    const savedPos = LDH_Storage.getSync('panelPosition', null);
    if (savedPos) {
      this.container.style.right = savedPos.right || '20px';
      this.container.style.top = savedPos.top || '100px';
    }
  }

  // 创建折叠区块头部
  createSectionHeader(icon, titleKey, sectionKey, extraHTML = '') {
    const isOpen = this.sectionStates[sectionKey] !== false;
    return `
      <div class="ldh-section-header" data-section="${sectionKey}">
        <span class="ldh-section-arrow">${isOpen ? '▼' : '▶'}</span>
        <span class="ldh-section-icon">${icon}</span>
        <span class="ldh-section-label">${this.t(titleKey)}</span>
        ${extraHTML}
      </div>
    `;
  }

  // 创建折叠区块内容容器
  createSectionBody(sectionKey, content) {
    const isOpen = this.sectionStates[sectionKey] !== false;
    return `<div class="ldh-section-body ${isOpen ? '' : 'hidden'}" data-section-body="${sectionKey}">${content}</div>`;
  }

  getPanelHTML() {
    const isTopicPage = LDH_Utils.isTopicPage();
    const likeFilterMode = LDH_Storage.getSync('likeFilterMode', 'off');
    const likeMinThreshold = LDH_Storage.getSync('likeMinThreshold', 3);
    const stopAfterReadEnabled = LDH_Storage.getSync('stopAfterReadEnabled', false);
    const stopAfterReadCount = LDH_Storage.getSync('stopAfterReadCount', 10);
    const topicLimit = LDH_Storage.getSync('topicLimit', 100);
    const restTime = LDH_Storage.getSync('restTime', 10);

    return `
      <div class="ldh-panel-header">
        <div class="ldh-panel-title">
          <span class="ldh-title-icon">📚</span>
          <span class="ldh-title-text">${this.t('panelTitle')}</span>
        </div>
        <div class="ldh-panel-controls">
          <button class="ldh-btn-icon ldh-btn-pause" title="暂停">⏸</button>
          <button class="ldh-btn-icon ldh-btn-minimize" title="${this.isMinimized ? '展开' : '最小化'}">
            ${this.isMinimized ? '▢' : '─'}
          </button>
        </div>
      </div>

      <div class="ldh-panel-content ${this.isMinimized ? 'hidden' : ''}">

        <!-- ========== 自动阅读区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('📖', 'sectionAutoRead', 'autoRead')}
          ${this.createSectionBody('autoRead', `
            <button class="ldh-btn-primary ldh-btn-start-reading">
              <span class="btn-icon">▶</span>
              <span class="btn-text">${this.t('startReading')}</span>
            </button>

            <!-- 阅读统计 -->
            <div class="ldh-stats-container">
              <div class="ldh-stat-item">
                <span class="ldh-stat-label">${this.t('sessionRead')}</span>
                <span class="ldh-stat-value" id="ldh-session-read">0</span>
              </div>
              <div class="ldh-stat-item">
                <span class="ldh-stat-label">${this.t('todayRead')}</span>
                <span class="ldh-stat-value" id="ldh-today-read">${this.autoScroll ? this.autoScroll.todayReadCount : 0}</span>
              </div>
              <div class="ldh-stat-item">
                <span class="ldh-stat-label">${this.t('totalRead')}</span>
                <span class="ldh-stat-value" id="ldh-total-read">${LDH_Storage.getSync('totalReadCount', 0)}</span>
              </div>
              <div class="ldh-stat-item">
                <span class="ldh-stat-label">${this.t('remaining')}</span>
                <span class="ldh-stat-value" id="ldh-remaining">0</span>
              </div>
            </div>

            <!-- 点赞计数 -->
            <div class="ldh-like-counter" id="ldh-like-counter">
              <div class="ldh-like-info">
                <span>❤️ ${this.t('likeRemaining')}</span>
                <span class="ldh-like-count">--/--</span>
              </div>
              <div class="ldh-like-progress">
                <div class="ldh-like-bar" style="width: 0%"></div>
              </div>
            </div>

            <!-- 清除冷却 & 同步按钮 -->
            <div class="ldh-button-row ldh-like-actions" style="display: none;">
              <button class="ldh-btn-secondary ldh-btn-clear-cooldown" title="${this.t('clearCooldown')}">
                <span>🔥</span> ${this.t('clearCooldown')}
              </button>
              <button class="ldh-btn-secondary ldh-btn-sync-likes" title="${this.t('sync')}">
                <span>🔄</span> ${this.t('sync')}
              </button>
            </div>

            <!-- 开关选项 -->
            <div class="ldh-toggle-grid">
              ${this.createToggle('autoLikeEnabled', this.t('autoLike'), '👍')}
              ${this.createToggle('quickLikeEnabled', this.t('quickLike'), '⚡')}
              ${this.createToggle('readUnreadEnabled', this.t('readUnread'), '📬')}
              ${this.createToggle('randomOrderEnabled', this.t('randomOrder'), '🔀')}
              ${this.createToggle('skipReadEnabled', this.t('skipRead'), '⏭️')}
              ${this.createToggle('stopOnLikeLimitEnabled', this.t('stopOnLikeLimit'), '❤️')}
              ${this.createToggle('stopAfterReadEnabled', this.t('stopAfterRead'), '🛑')}
            </div>

            <!-- 点赞过滤 -->
            <div class="ldh-filter-section">
              <label class="ldh-input-label">🎯 ${this.t('likeFilter')}</label>
              <div class="ldh-filter-options">
                <button class="ldh-filter-btn ${likeFilterMode === 'off' ? 'active' : ''}" data-filter="off">${this.t('filterOff')}</button>
                <button class="ldh-filter-btn ${likeFilterMode === 'threshold' ? 'active' : ''}" data-filter="threshold">${this.t('filterThreshold')}</button>
                <button class="ldh-filter-btn ${likeFilterMode === 'probability' ? 'active' : ''}" data-filter="probability">${this.t('filterProbability')}</button>
              </div>
              <div class="ldh-input-row ${likeFilterMode === 'threshold' ? '' : 'hidden'}" id="ldh-threshold-row">
                <label class="ldh-input-label">📊 ${this.t('minLikeCount')}</label>
                <input type="number" class="ldh-input-number" id="ldh-like-threshold"
                       value="${likeMinThreshold}" min="0" max="100" step="1">
              </div>
            </div>

            <!-- 滑块: 获取数量 -->
            <div class="ldh-slider-row">
              <label class="ldh-slider-label">📋 ${this.t('topicLimit')}</label>
              <div class="ldh-slider-wrap">
                <input type="range" class="ldh-slider" id="ldh-topic-limit" min="10" max="500" step="10" value="${topicLimit}">
                <span class="ldh-slider-value" id="ldh-topic-limit-val">${topicLimit}</span>
              </div>
            </div>

            <!-- 滑块: 休息时间 -->
            <div class="ldh-slider-row">
              <label class="ldh-slider-label">☕ ${this.t('restTimeLabel')}</label>
              <div class="ldh-slider-wrap">
                <input type="range" class="ldh-slider" id="ldh-rest-time" min="1" max="30" step="1" value="${restTime}">
                <span class="ldh-slider-value" id="ldh-rest-time-val">${restTime}</span>
              </div>
            </div>

            <!-- 滑块: 阅读数量 -->
            <div class="ldh-slider-row ${stopAfterReadEnabled ? '' : 'hidden'}" id="ldh-stop-after-read-row">
              <label class="ldh-slider-label">📖 ${this.t('readCount')}</label>
              <div class="ldh-slider-wrap">
                <input type="range" class="ldh-slider" id="ldh-stop-after-read-count" min="1" max="200" step="1" value="${stopAfterReadCount}">
                <span class="ldh-slider-value" id="ldh-stop-after-read-val">${stopAfterReadCount}</span>
              </div>
            </div>

            <!-- 当前阅读状态 -->
            <div class="ldh-reading-status">
              <div class="ldh-reading-status-row">
                <span class="ldh-reading-label">${this.t('currentReading')}:</span>
                <span class="ldh-reading-mode" id="ldh-reading-mode">${LDH_Storage.getSync('readUnreadEnabled', false) ? this.t('readingUnread') : this.t('readingLatest')}</span>
              </div>
              <div class="ldh-reading-status-row">
                <span class="ldh-reading-label">${this.t('remaining')}:</span>
                <span id="ldh-remaining-status">0</span>
              </div>
              <div class="ldh-reading-status-row">
                <span class="ldh-reading-label">${this.t('todayRead')}:</span>
                <span id="ldh-today-read-status">${this.autoScroll ? this.autoScroll.todayReadCount : 0}</span>
              </div>
            </div>
          `)}
        </div>

        <!-- ========== 账号信息区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('🏅', 'sectionAccountInfo', 'accountInfo')}
          ${this.createSectionBody('accountInfo', `
            <div id="ldh-account-info-content" class="ldh-data-content">
              <div class="ldh-loading">${this.t('loading')}</div>
            </div>
          `)}
        </div>

        <!-- ========== CREDIT 积分区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('💰', 'sectionCredit', 'credit')}
          ${this.createSectionBody('credit', `
            <div id="ldh-credit-content" class="ldh-data-content">
              <div class="ldh-loading">${this.t('loading')}</div>
            </div>
          `)}
        </div>

        <!-- ========== CDK 分数区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('🎮', 'sectionCdk', 'cdk')}
          ${this.createSectionBody('cdk', `
            <div id="ldh-cdk-content" class="ldh-data-content">
              <div class="ldh-loading">${this.t('loading')}</div>
            </div>
          `)}
        </div>

        <!-- ========== 排行榜区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('🏆', 'sectionRanking', 'ranking')}
          ${this.createSectionBody('ranking', `
            <div id="ldh-ranking-content" class="ldh-data-content">
              <div class="ldh-loading">${this.t('loading')}</div>
            </div>
          `)}
        </div>

        <!-- ========== 插件设置区 ========== -->
        <div class="ldh-section">
          ${this.createSectionHeader('⚙️', 'sectionPluginSettings', 'pluginSettings')}
          ${this.createSectionBody('pluginSettings', `
            <!-- 模式设置 -->
            <div class="ldh-subsection-title">${this.t('modeSettings')}</div>
            <div class="ldh-toggle-grid">
              ${this.createToggle('cleanModeEnabled', this.t('cleanMode'), '✨')}
              ${this.createToggle('grayscaleModeEnabled', this.t('grayscaleMode'), '🎨')}
            </div>

            <!-- 文章页功能 -->
            <div class="ldh-subsection-title">${this.t('sectionArticleTools')}</div>
            <div class="ldh-button-row">
              <button class="ldh-btn-secondary ldh-btn-random-floor">
                <span>🎲</span> ${this.t('randomFloor')}
              </button>
              <button class="ldh-btn-secondary ldh-btn-batch-info">
                <span>📊</span> ${this.t('batchShowInfo')}
              </button>
            </div>

            <!-- 语言切换 -->
            <div class="ldh-subsection-title">${this.t('langLabel')}</div>
            <div class="ldh-lang-toggle">
              <button class="ldh-lang-btn ${this.language === 'zh' ? 'active' : ''}" data-lang="zh">🇨🇳 中文</button>
              <button class="ldh-lang-btn ${this.language === 'en' ? 'active' : ''}" data-lang="en">us English</button>
            </div>

            <!-- 主题选择 -->
            <div class="ldh-subsection-title">${this.t('themeLabel')}</div>
            <div class="ldh-theme-grid">
              ${Object.entries(this.themes).map(([key, val]) => `
                <button class="ldh-theme-btn ${this.themeColor === key ? 'active' : ''}"
                        data-theme="${key}"
                        style="background: linear-gradient(135deg, ${val.primary}, ${val.secondary})">
                  <span class="ldh-theme-label">${this.t(val.label)}</span>
                </button>
              `).join('')}
            </div>

            <!-- 下载位置 -->
            <div class="ldh-subsection-title">📁 ${this.t('downloadLocation')}</div>
            <div class="ldh-info-box">
              <p>${this.t('downloadLocationDesc')}</p>
              <p class="ldh-info-path">${this.t('downloadLocationPath')}</p>
              <p class="ldh-info-tip">${this.t('downloadLocationTip')}</p>
            </div>

            <!-- CF 5秒盾 -->
            <div class="ldh-subsection-title">🛡️ ${this.t('cfBypassLabel')}</div>
            <div class="ldh-cf-section">
              <div class="ldh-cf-desc">${this.t('cfBypassDesc')}</div>
              <div class="ldh-toggle-grid" style="margin-top:6px;">
                ${this.createToggle('cfBypassEnabled', this.t('cfBypassLabel'), '🛡️')}
              </div>
              <button class="ldh-btn-secondary ldh-btn-cf-trigger" style="width:100%; margin-top:6px;">
                <span>⚡</span> ${this.t('cfManualTrigger')}
              </button>
            </div>
          `)}
        </div>
      </div>

      <!-- 最小化状态 -->
      <div class="ldh-minimized-content ${this.isMinimized ? '' : 'hidden'}">
        <span class="ldh-minimized-icon">📚</span>
        <span class="ldh-minimized-text">${this.t('minimizedText')}</span>
      </div>
    `;
  }

  createToggle(key, label, icon) {
    const checked = LDH_Storage.getSync(key, false);
    return `
      <label class="ldh-toggle-row">
        <span class="ldh-toggle-label">${icon} ${label}</span>
        <input type="checkbox" class="ldh-toggle-input" data-key="${key}" ${checked ? 'checked' : ''}>
        <span class="ldh-toggle-slider"></span>
      </label>
    `;
  }

  setupEventListeners() {
    // -------- 折叠区块头部点击 --------
    this.container.querySelectorAll('.ldh-section-header').forEach(header => {
      header.addEventListener('click', (e) => {
        const section = header.dataset.section;
        const body = this.container.querySelector(`[data-section-body="${section}"]`);
        const arrow = header.querySelector('.ldh-section-arrow');
        if (!body) return;

        const isOpen = !body.classList.contains('hidden');
        body.classList.toggle('hidden', isOpen);
        if (arrow) arrow.textContent = isOpen ? '▶' : '▼';

        this.sectionStates[section] = !isOpen;
        LDH_Storage.setSync('sectionStates', this.sectionStates);

        // 懒加载数据
        if (!isOpen) {
          this.loadSectionData(section);
        }
      });
    });

    // -------- 最小化按钮 --------
    this.container.querySelector('.ldh-btn-minimize')?.addEventListener('click', () => {
      this.toggleMinimize();
    });

    this.container.querySelector('.ldh-minimized-content')?.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // -------- 暂停按钮（开始/暂停阅读的快捷键） --------
    this.container.querySelector('.ldh-btn-pause')?.addEventListener('click', () => {
      if (this.autoScroll) {
        if (this.autoScroll.autoRunning) {
          this.autoScroll.stop();
        } else {
          this.autoScroll.start();
        }
      }
    });

    // -------- 开始阅读按钮 --------
    this.container.querySelector('.ldh-btn-start-reading')?.addEventListener('click', () => {
      if (this.autoScroll) {
        if (this.autoScroll.autoRunning) {
          this.autoScroll.stop();
        } else {
          this.autoScroll.start();
        }
      }
    });

    // -------- 开关事件 --------
    this.container.querySelectorAll('.ldh-toggle-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        const value = e.target.checked;
        LDH_Storage.setSync(key, value);

        if (this.autoScroll && key in this.autoScroll) {
          this.autoScroll.updateSetting(key, value);
        }

        if (key === 'cleanModeEnabled') {
          this.cleanModeEnabled = value;
          this.applyCleanMode();
        }
        if (key === 'grayscaleModeEnabled') {
          this.grayscaleModeEnabled = value;
          this.applyGrayscaleMode();
        }
        if (key === 'cfBypassEnabled') {
          this.cfBypassEnabled = value;
          this.setupCfBypass();
        }

        // 显示/隐藏阅读限制滑块
        if (key === 'stopAfterReadEnabled') {
          const row = this.container.querySelector('#ldh-stop-after-read-row');
          if (row) row.classList.toggle('hidden', !value);
        }

        // 更新阅读模式显示
        if (key === 'readUnreadEnabled') {
          const modeEl = this.container.querySelector('#ldh-reading-mode');
          if (modeEl) modeEl.textContent = value ? this.t('readingUnread') : this.t('readingLatest');
        }
      });
    });

    // -------- 滑块事件 --------
    this.setupSlider('ldh-topic-limit', 'ldh-topic-limit-val', 'topicLimit', (val) => {
      if (this.autoScroll) this.autoScroll.topicLimit = val;
    });
    this.setupSlider('ldh-rest-time', 'ldh-rest-time-val', 'restTime', (val) => {
      if (this.autoScroll) this.autoScroll.restTime = val;
    });
    this.setupSlider('ldh-stop-after-read-count', 'ldh-stop-after-read-val', 'stopAfterReadCount', (val) => {
      if (this.autoScroll) this.autoScroll.stopAfterReadCount = val;
    });

    // -------- 点赞过滤按钮 --------
    this.container.querySelectorAll('.ldh-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.filter;
        LDH_Storage.setSync('likeFilterMode', mode);
        if (this.autoScroll) this.autoScroll.likeFilterMode = mode;

        this.container.querySelectorAll('.ldh-filter-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.filter === mode);
        });
        const thresholdRow = this.container.querySelector('#ldh-threshold-row');
        if (thresholdRow) thresholdRow.classList.toggle('hidden', mode !== 'threshold');
      });
    });

    // -------- 点赞阈值 --------
    this.container.querySelector('#ldh-like-threshold')?.addEventListener('change', (e) => {
      const value = parseInt(e.target.value) || 3;
      LDH_Storage.setSync('likeMinThreshold', value);
      if (this.autoScroll) this.autoScroll.likeMinThreshold = value;
    });

    // -------- 清除冷却 --------
    this.container.querySelector('.ldh-btn-clear-cooldown')?.addEventListener('click', () => {
      if (this.likeCounter) {
        this.likeCounter.clearCooldown();
        LDH_Storage.setSync('likeResumeTime', null);
        LDH_Utils.showNotification(this.t('cooldownCleared'));
      }
    });

    // -------- 同步点赞 --------
    this.container.querySelector('.ldh-btn-sync-likes')?.addEventListener('click', async () => {
      if (this.likeCounter) {
        const btn = this.container.querySelector('.ldh-btn-sync-likes');
        btn.innerHTML = `<span>🔄</span> ${this.t('syncing')}`;
        btn.disabled = true;
        try {
          await this.likeCounter.manualSync();
          LDH_Utils.showNotification(this.t('syncComplete'));
        } catch (e) {
          LDH_Utils.showNotification(this.t('syncFailed'));
        }
        btn.innerHTML = `<span>🔄</span> ${this.t('sync')}`;
        btn.disabled = false;
      }
    });

    // -------- 语言切换 --------
    this.container.querySelectorAll('.ldh-lang-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.switchLanguage(e.target.dataset.lang);
      });
    });

    // -------- 主题切换 --------
    this.container.querySelectorAll('.ldh-theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = e.currentTarget.dataset.theme;
        this.switchTheme(theme);
      });
    });

    // -------- 随机楼层 --------
    this.container.querySelector('.ldh-btn-random-floor')?.addEventListener('click', () => {
      this.jumpToRandomFloor();
    });

    // -------- 批量展示信息 --------
    this.container.querySelector('.ldh-btn-batch-info')?.addEventListener('click', async () => {
      if (this.userInfoHelper) {
        const btn = this.container.querySelector('.ldh-btn-batch-info');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> ...';
        await this.userInfoHelper.revealAllVisibleReplies();
        btn.disabled = false;
        btn.innerHTML = `<span>📊</span> ${this.t('batchShowInfo')}`;
      }
    });

    // -------- CF 手动触发 --------
    this.container.querySelector('.ldh-btn-cf-trigger')?.addEventListener('click', () => {
      this.triggerCfChallenge();
    });

    // -------- 初始加载已打开区块的数据 --------
    setTimeout(() => {
      if (this.sectionStates.accountInfo) this.loadSectionData('accountInfo');
      if (this.sectionStates.credit) this.loadSectionData('credit');
      if (this.sectionStates.cdk) this.loadSectionData('cdk');
      if (this.sectionStates.ranking) this.loadSectionData('ranking');
    }, 1000);
  }

  setupSlider(sliderId, valueId, storageKey, callback) {
    const slider = this.container.querySelector(`#${sliderId}`);
    const valueEl = this.container.querySelector(`#${valueId}`);
    if (!slider) return;

    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (valueEl) valueEl.textContent = val;
    });

    slider.addEventListener('change', (e) => {
      const val = parseInt(e.target.value);
      LDH_Storage.setSync(storageKey, val);
      if (callback) callback(val);
    });
  }

  // ==================== 数据区块懒加载 ====================
  async loadSectionData(section) {
    switch (section) {
      case 'accountInfo': return this.loadAccountInfo();
      case 'credit': return this.loadCreditInfo();
      case 'cdk': return this.loadCdkInfo();
      case 'ranking': return this.loadRankingInfo();
    }
  }

  // -------- 账号信息 --------
  async loadAccountInfo(forceRefresh = false) {
    const container = this.container.querySelector('#ldh-account-info-content');
    if (!container) return;

    if (forceRefresh) {
      const refreshBtn = container.querySelector('.ldh-btn-refresh-account');
      if (refreshBtn) {
        refreshBtn.textContent = this.t('refreshing') || '刷新中...';
        refreshBtn.disabled = true;
      }
    } else {
      container.innerHTML = `<div class="ldh-loading">${this.t('loading')}</div>`;
    }

    const data = await LDH_AccountInfo.load(forceRefresh);
    if (!data) {
      container.innerHTML = `<div class="ldh-error">${this.t('notLoggedIn')}</div>`;
      return;
    }

    const { username, trustLevel, targetLevel, requirements, allMet, type } = data;

    // 标题：如果已满足要求显示 "Lv3 ✓"，否则显示 "Lv2 → Lv3"
    const headerTitle = allMet
      ? `Lv${targetLevel} ✓ (${username})`
      : `Lv${trustLevel} → Lv${targetLevel} (${username})`;

    let cacheInfo = '';
    if (data.fromCache) {
      const mins = Math.round(data.cacheAge / 60000);
      cacheInfo = `<span class="ldh-cache-badge">${this.t('cachedInfo')} ${mins}${this.t('minutesAgo')}</span>`;
    }

    let html = `
      <div class="ldh-account-header">
        <span class="ldh-level-badge">📊 ${headerTitle}</span>
        <button class="ldh-btn-tiny ldh-btn-refresh-account" title="${this.t('refresh')}">🔄 ${this.t('refresh')}</button>
      </div>
    `;

    // 渲染详细要求进度条（如果有要求数据）
    if (type === 'detailed' && requirements && requirements.length > 0) {
      requirements.forEach(req => {
        const currentMatch = String(req.current).match(/(\d+)/);
        const requiredMatch = String(req.required).match(/(\d+)/);
        const currentNum = currentMatch ? parseInt(currentMatch[1]) : 0;
        const requiredNum = requiredMatch ? parseInt(requiredMatch[1]) : 1;
        const progress = Math.min((currentNum / requiredNum) * 100, 100);
        const fillClass = req.isMet ? 'completed' : '';

        // 负面指标检测
        const isNegative = req.name.includes('被禁言') || req.name.includes('被封禁') ||
          req.name.includes('被举报') || req.name.includes('发起举报');
        const currentHtml = isNegative
          ? `<span style="color: #ff6b6b;">${req.current}</span>`
          : req.current;

        html += `
          <div class="ldh-trust-item">
            <span class="ldh-trust-name">${req.name}</span>
            <div class="ldh-trust-progress">
              <div class="ldh-trust-bar">
                <div class="ldh-trust-bar-fill ${fillClass}" style="width: ${progress}%"></div>
              </div>
              <span class="ldh-trust-value">${currentHtml}/${req.required}</span>
            </div>
          </div>
        `;
      });
    }

    // 总结状态
    if (allMet) {
      html += `
        <div class="ldh-trust-summary ldh-trust-met">
          ✅ ${this.t('meetsLevelReq').replace('{level}', targetLevel)}
        </div>
      `;
    } else if (type === 'detailed' && requirements.length > 0) {
      const unmetCount = requirements.length - (data.achievedCount || 0);
      html += `
        <div class="ldh-trust-summary ldh-trust-unmet">
          还需完成 ${unmetCount} 项升级到 Lv${targetLevel}
        </div>
      `;
    }

    html += cacheInfo;

    container.innerHTML = html;

    container.querySelector('.ldh-btn-refresh-account')?.addEventListener('click', () => {
      this.loadAccountInfo(true);
    });
  }

  // -------- CREDIT 积分 --------
  async loadCreditInfo(forceRefresh = false) {
    const container = this.container.querySelector('#ldh-credit-content');
    if (!container) return;

    if (!forceRefresh) {
      container.innerHTML = `<div class="ldh-loading">${this.t('loading')}</div>`;
    }

    const data = await LDH_Credit.load(forceRefresh);
    if (!data) {
      container.innerHTML = `
        <div class="ldh-error">${this.t('creditLoginRequired')}</div>
        <button class="ldh-btn-secondary ldh-btn-credit-login" style="width:100%; margin-top:6px;">
          <span>🔗</span> ${this.t('creditLoginRequired')}
        </button>
      `;
      container.querySelector('.ldh-btn-credit-login')?.addEventListener('click', () => {
        window.open('https://credit.linux.do', '_blank');
      });
      return;
    }

    const { userData, dailyStats, leaderboard } = data;
    const username = userData.nickname || userData.username || 'User';
    const credits = userData.available_balance || '0';
    const dailyLimit = userData.remain_quota || '0';
    const incomeTotal = userData.total_receive || '0';
    const expenseTotal = userData.total_payment || '0';

    // 处理每日收入
    let incomeHTML = '';
    if (dailyStats && dailyStats.length > 0) {
      const incomeItems = dailyStats
        .filter(item => parseFloat(item.income) !== 0)
        .map(item => {
          const date = item.date.substring(5).replace('-', '/');
          const income = parseFloat(item.income);
          const color = income > 0 ? '#7dffb3' : '#ff6b6b';
          const prefix = income > 0 ? '+' : '';
          return `<div class="ldh-income-item"><span>${date}</span><span style="color:${color}">${prefix}${income.toFixed(2)}</span></div>`;
        })
        .reverse();
      if (incomeItems.length > 0) {
        incomeHTML = `
          <div class="ldh-credit-subtitle">${this.t('recentIncome')}</div>
          <div class="ldh-income-list">${incomeItems.join('')}</div>
        `;
      }
    }

    let leaderboardHTML = '';
    if (leaderboard) {
      leaderboardHTML = `
        <div class="ldh-credit-row">
          <span>${this.t('tomorrowScore')}</span>
          <span class="ldh-credit-highlight">${leaderboard.dailyScore + parseFloat(credits)}</span>
        </div>
        <div class="ldh-credit-row">
          <span>${this.t('currentPoints')}</span>
          <span>${leaderboard.totalCredits} <small style="color:#87ceeb">${this.t('currentRank')} #${leaderboard.rank}</small></span>
        </div>
        <div class="ldh-credit-row">
          <span>${this.t('yesterdayPoints')}</span>
          <span>${leaderboard.dailyScore}</span>
        </div>
      `;
    }

    const updateTime = new Date().toLocaleTimeString(this.language === 'zh' ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    container.innerHTML = `
      <div class="ldh-account-header">
        <span>💰 ${username} ${this.t('userCredits')}</span>
        <button class="ldh-btn-tiny ldh-btn-refresh-credit" title="${this.t('refresh')}">🔄</button>
      </div>
      <div class="ldh-credit-main">
        <span class="ldh-credit-label">${this.t('creditAvailable')}</span>
        <span class="ldh-credit-value">${credits}</span>
      </div>
      ${leaderboardHTML}
      <div class="ldh-credit-row">
        <span>${this.t('dailyRemainQuota')}</span>
        <span>${dailyLimit}</span>
      </div>
      <div class="ldh-credit-row">
        <span>${this.t('totalIncome')}</span>
        <span style="color:#7dffb3">+${incomeTotal}</span>
      </div>
      <div class="ldh-credit-row">
        <span>${this.t('totalExpense')}</span>
        <span style="color:#ff6b6b">-${expenseTotal}</span>
      </div>
      ${incomeHTML}
      <div class="ldh-credit-footer">
        <a href="https://credit.linux.do/home" target="_blank" class="ldh-link">${this.t('viewDetails')}</a>
        <span class="ldh-update-time">${this.t('updateTime')}: ${updateTime}</span>
      </div>
    `;

    container.querySelector('.ldh-btn-refresh-credit')?.addEventListener('click', () => {
      this.loadCreditInfo(true);
    });
  }

  // -------- CDK 分数 --------
  async loadCdkInfo(forceRefresh = false) {
    const container = this.container.querySelector('#ldh-cdk-content');
    if (!container) return;

    if (!forceRefresh) {
      container.innerHTML = `<div class="ldh-loading">${this.t('loading')}</div>`;
    }

    const data = await LDH_Cdk.load(forceRefresh);
    if (!data) {
      container.innerHTML = `
        <div class="ldh-cdk-empty">
          <div class="ldh-cdk-icon">🎮</div>
          <div class="ldh-cdk-title">${this.t('cdkNotAuth')}</div>
          <div class="ldh-cdk-desc">${this.t('cdkAuthTip')}</div>
          <button class="ldh-btn-secondary ldh-btn-cdk-login" style="width:100%; margin-top:8px;">
            <span>🔗</span> ${this.t('cdkGoLogin')}
          </button>
        </div>
      `;
      container.querySelector('.ldh-btn-cdk-login')?.addEventListener('click', () => {
        window.open('https://cdk.linux.do', '_blank');
      });
      return;
    }

    const user = data.user || {};
    const score = user.score || user.total_score || 0;
    const username = user.username || user.nickname || '';

    container.innerHTML = `
      <div class="ldh-account-header">
        <span>🎮 CDK ${username ? '(' + username + ')' : ''}</span>
        <button class="ldh-btn-tiny ldh-btn-refresh-cdk" title="${this.t('refresh')}">🔄</button>
      </div>
      <div class="ldh-credit-main">
        <span class="ldh-credit-label">${this.t('cdkTotalScore')}</span>
        <span class="ldh-credit-value">${score}</span>
      </div>
    `;

    container.querySelector('.ldh-btn-refresh-cdk')?.addEventListener('click', () => {
      this.loadCdkInfo(true);
    });
  }

  // -------- 排行榜 --------
  async loadRankingInfo(forceRefresh = false) {
    const container = this.container.querySelector('#ldh-ranking-content');
    if (!container) return;

    if (!forceRefresh) {
      container.innerHTML = `<div class="ldh-loading">${this.t('loading')}</div>`;
    }

    const result = await LDH_Ranking.load(forceRefresh);
    if (!result || !result.data) {
      container.innerHTML = `<div class="ldh-error">${this.t('loadFailed')}</div>`;
      return;
    }

    const periods = LDH_Ranking.periods;
    const periodNames = {
      daily: 'dailyRank',
      weekly: 'weeklyRank',
      monthly: 'monthlyRank',
      quarterly: 'quarterlyRank',
      yearly: 'yearlyRank',
      all: 'allTimeRank'
    };

    let itemsHTML = result.data.map((item, idx) => {
      const period = periods[idx];
      const posText = item.position === '-' ? '-' : `#${item.position}`;
      return `
        <div class="ldh-rank-item">
          <span class="ldh-rank-name">${period.icon} ${this.t(periodNames[period.key])}</span>
          <span class="ldh-rank-data">
            <span class="ldh-rank-score">${item.score}${this.t('points')}</span>
            <span class="ldh-rank-pos">${posText}</span>
          </span>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ldh-account-header">
        <span>🏆 ${this.t('myRanking')}</span>
        <button class="ldh-btn-tiny ldh-btn-refresh-rank" title="${this.t('refresh')}">🔄 ${this.t('refresh')}</button>
      </div>
      ${itemsHTML}
    `;

    container.querySelector('.ldh-btn-refresh-rank')?.addEventListener('click', () => {
      this.loadRankingInfo(true);
    });
  }

  // ==================== CF 5秒盾 ====================
  setupCfBypass() {
    if (!this.cfBypassEnabled) return;

    // 检测 Cloudflare challenge 页面
    const checkCf = () => {
      const title = document.title.toLowerCase();
      const body = document.body?.innerText || '';
      if (title.includes('just a moment') || body.includes('Checking your browser')) {
        console.log('[CF Bypass] 检测到 CF 5秒盾，尝试自动处理');
        // Cloudflare challenge 页面会自动重定向，这里主要是恢复自动阅读状态
        LDH_Storage.setSession('cfDetected', true);
      }
    };
    setTimeout(checkCf, 2000);
  }

  triggerCfChallenge() {
    const baseUrl = LDH_Utils.getBaseUrl();
    window.open(`${baseUrl}/cdn-cgi/challenge-platform/h/g`, '_blank');
    LDH_Utils.showNotification('CF 验证页面已打开');
  }

  // ==================== 面板操作 ====================
  toggleMinimize() {
    this.isMinimized = !this.isMinimized;
    LDH_Storage.setSync('panelMinimized', this.isMinimized);

    this.container.classList.toggle('minimized', this.isMinimized);
    this.container.querySelector('.ldh-panel-content').classList.toggle('hidden', this.isMinimized);
    this.container.querySelector('.ldh-minimized-content').classList.toggle('hidden', !this.isMinimized);
    this.container.querySelector('.ldh-btn-minimize').innerHTML = this.isMinimized ? '▢' : '─';
  }

  switchLanguage(lang) {
    this.language = lang;
    LDH_Storage.setSync('language', lang);

    const pos = {
      right: this.container.style.right,
      top: this.container.style.top
    };
    this.container.remove();
    this.createPanel();
    this.container.style.right = pos.right;
    this.container.style.top = pos.top;
    this.setupEventListeners();
  }

  switchTheme(theme) {
    this.themeColor = theme;
    LDH_Storage.setSync('themeColor', theme);

    const themeColors = this.themes[theme] || this.themes.purple;
    this.container.style.setProperty('--ldh-primary', themeColors.primary);
    this.container.style.setProperty('--ldh-secondary', themeColors.secondary);

    this.container.querySelectorAll('.ldh-theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme);
    });
  }

  makeDraggable() {
    const header = this.container.querySelector('.ldh-panel-header');
    let isDragging = false;
    let startX, startY, startRight, startTop;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.ldh-panel-controls')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startRight = parseInt(this.container.style.right) || 20;
      startTop = parseInt(this.container.style.top) || 100;
      this.container.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const deltaX = startX - e.clientX;
      const deltaY = e.clientY - startY;
      this.container.style.right = `${startRight + deltaX}px`;
      this.container.style.top = `${startTop + deltaY}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.container.style.transition = '';
        LDH_Storage.setSync('panelPosition', {
          right: this.container.style.right,
          top: this.container.style.top
        });
      }
    });
  }

  updateLikeCounterUI(status) {
    const container = this.container.querySelector('#ldh-like-counter');
    if (!container) return;

    const { remaining, limit, isInCooldown, cooldownFormatted, matched } = status;

    if (this.cooldownTimer && !isInCooldown) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    const actionsRow = this.container.querySelector('.ldh-like-actions');
    if (actionsRow) {
      actionsRow.style.display = (isInCooldown || !matched) ? 'flex' : 'none';
    }

    if (isInCooldown) {
      container.innerHTML = `
        <div class="ldh-like-info ldh-cooldown">
          <span>🔥 ${this.t('likeCooldown')}</span>
          <span class="ldh-cooldown-time">${cooldownFormatted}</span>
        </div>
      `;

      if (!this.cooldownTimer) {
        this.cooldownTimer = setInterval(() => {
          if (!this.likeCounter) return;
          const newFormatted = this.likeCounter.formatCooldown();
          const timeSpan = container.querySelector('.ldh-cooldown-time');
          if (timeSpan && newFormatted) {
            timeSpan.textContent = newFormatted;
          } else if (!newFormatted) {
            clearInterval(this.cooldownTimer);
            this.cooldownTimer = null;
            this.updateLikeCounterUI(this.likeCounter.getStatus());
          }
        }, 1000);
      }
    } else {
      const percentage = limit > 0 ? Math.round((remaining / limit) * 100) : 0;
      const color = percentage > 50 ? '#7dffb3' : (percentage > 20 ? '#ffd700' : '#ff6b6b');

      container.innerHTML = `
        <div class="ldh-like-info">
          <span>${!matched ? '<span class="ldh-sync-warning" title="⚠️">⚠️</span> ' : ''}❤️ ${this.t('likeRemaining')}</span>
          <span class="ldh-like-count" style="color: ${color}">${remaining}/${limit}</span>
        </div>
        <div class="ldh-like-progress">
          <div class="ldh-like-bar" style="width: ${percentage}%; background: ${color}"></div>
        </div>
      `;
    }
  }

  updateAutoScrollStatus(running) {
    const btn = this.container.querySelector('.ldh-btn-start-reading');
    if (btn) {
      btn.innerHTML = running
        ? `<span class="btn-icon">⏸</span><span class="btn-text">${this.t('stopReading')}</span>`
        : `<span class="btn-icon">▶</span><span class="btn-text">${this.t('startReading')}</span>`;
      btn.classList.toggle('running', running);
    }
    // 更新暂停按钮
    const pauseBtn = this.container.querySelector('.ldh-btn-pause');
    if (pauseBtn) {
      pauseBtn.innerHTML = running ? '⏸' : '▶';
    }
  }

  updateReadStats(stats) {
    const updateEl = (id, value) => {
      const el = this.container.querySelector(id);
      if (el) el.textContent = value || 0;
    };

    updateEl('#ldh-session-read', stats.sessionRead);
    updateEl('#ldh-today-read', stats.todayRead);
    updateEl('#ldh-total-read', stats.totalRead);
    updateEl('#ldh-remaining', stats.remaining);
    updateEl('#ldh-remaining-status', stats.remaining);
    updateEl('#ldh-today-read-status', stats.todayRead);
  }

  jumpToRandomFloor() {
    const posts = document.querySelectorAll('.topic-post');
    if (posts.length === 0) {
      LDH_Utils.showNotification('未找到楼层');
      return;
    }
    const randomIndex = Math.floor(Math.random() * posts.length);
    const targetPost = posts[randomIndex];
    targetPost.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetPost.style.animation = 'ldh-highlight 1s ease-out';
    setTimeout(() => { targetPost.style.animation = ''; }, 1000);
    LDH_Utils.showNotification(`已跳转到第 ${randomIndex + 1} 楼`);
  }

  applyModes() {
    this.applyCleanMode();
    this.applyGrayscaleMode();
  }

  applyCleanMode() {
    document.body.classList.toggle('ldh-clean-mode', this.cleanModeEnabled);
  }

  applyGrayscaleMode() {
    document.body.classList.toggle('ldh-grayscale-mode', this.grayscaleModeEnabled);
  }
}

// 导出到全局
window.LDH_HelperUI = HelperUI;
