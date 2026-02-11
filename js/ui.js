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

    // 冷却倒计时定时器
    this.cooldownTimer = null;

    this.themes = {
      purple: { primary: '#667eea', secondary: '#764ba2' },
      blue: { primary: '#4facfe', secondary: '#00f2fe' },
      green: { primary: '#43e97b', secondary: '#38f9d7' },
      orange: { primary: '#fa709a', secondary: '#fee140' },
      pink: { primary: '#f093fb', secondary: '#f5576c' },
      dark: { primary: '#434343', secondary: '#000000' }
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

    // 注册点赞计数器UI更新回调
    if (this.likeCounter) {
      this.likeCounter.onUIUpdate(status => {
        this.updateLikeCounterUI(status);

        // 如果进入冷却状态，自动关闭点赞开关
        if (status.isInCooldown) {
          if (this.autoScroll && (this.autoScroll.autoLikeEnabled || this.autoScroll.quickLikeEnabled)) {
            this.autoScroll.updateSetting('autoLikeEnabled', false);
            this.autoScroll.updateSetting('quickLikeEnabled', false);
            // 更新UI中的开关状态
            this.container.querySelectorAll('.ldh-toggle-input').forEach(input => {
              if (input.dataset.key === 'autoLikeEnabled' || input.dataset.key === 'quickLikeEnabled') {
                input.checked = false;
              }
            });
            console.log('[UI] 检测到冷却，已自动关闭点赞功能');
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
    // 创建主容器
    this.container = LDH_Utils.createElement('div', {
      id: 'ldh-panel',
      className: `ldh-panel ${this.isMinimized ? 'minimized' : ''}`
    });

    const theme = this.themes[this.themeColor] || this.themes.purple;
    this.container.style.setProperty('--ldh-primary', theme.primary);
    this.container.style.setProperty('--ldh-secondary', theme.secondary);

    // 创建面板内容
    this.container.innerHTML = this.getPanelHTML();

    document.body.appendChild(this.container);
    this.makeDraggable();

    // 初始化位置
    const savedPos = LDH_Storage.getSync('panelPosition', null);
    if (savedPos) {
      this.container.style.right = savedPos.right || '20px';
      this.container.style.top = savedPos.top || '100px';
    }
  }

  getPanelHTML() {
    const isTopicPage = LDH_Utils.isTopicPage();
    const likeFilterMode = LDH_Storage.getSync('likeFilterMode', 'off');
    const likeMinThreshold = LDH_Storage.getSync('likeMinThreshold', 3);
    const stopAfterReadEnabled = LDH_Storage.getSync('stopAfterReadEnabled', false);
    const stopAfterReadCount = LDH_Storage.getSync('stopAfterReadCount', 10);

    return `
      <div class="ldh-panel-header">
        <div class="ldh-panel-title">
          <span class="ldh-title-icon">📚</span>
          <span class="ldh-title-text">${this.t('panelTitle')}</span>
        </div>
        <div class="ldh-panel-controls">
          <button class="ldh-btn-icon ldh-btn-minimize" title="${this.isMinimized ? '展开' : '最小化'}">
            ${this.isMinimized ? '▢' : '─'}
          </button>
        </div>
      </div>

      <div class="ldh-panel-content ${this.isMinimized ? 'hidden' : ''}">
        <!-- 自动阅读区 -->
        <div class="ldh-section">
          <div class="ldh-section-title">📖 自动阅读</div>
          <button class="ldh-btn-primary ldh-btn-start-reading">
            <span class="btn-icon">▶</span>
            <span class="btn-text">${this.t('startReading')}</span>
          </button>

          <!-- 阅读统计 -->
          <div class="ldh-stats-container">
            <div class="ldh-stat-item">
              <span class="ldh-stat-label">本次已读</span>
              <span class="ldh-stat-value" id="ldh-session-read">0</span>
            </div>
            <div class="ldh-stat-item">
              <span class="ldh-stat-label">今日阅读</span>
              <span class="ldh-stat-value" id="ldh-today-read">${this.autoScroll ? this.autoScroll.todayReadCount : 0}</span>
            </div>
            <div class="ldh-stat-item">
              <span class="ldh-stat-label">总阅读</span>
              <span class="ldh-stat-value" id="ldh-total-read">${LDH_Storage.getSync('totalReadCount', 0)}</span>
            </div>
            <div class="ldh-stat-item">
              <span class="ldh-stat-label">剩余帖子</span>
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
            <button class="ldh-btn-secondary ldh-btn-sync-likes" title="同步点赞数据">
              <span>🔄</span> 同步
            </button>
          </div>

          <!-- 开关选项 -->
          <div class="ldh-toggle-grid">
            ${this.createToggle('autoLikeEnabled', this.t('autoLike'), '👍')}
            ${this.createToggle('quickLikeEnabled', this.t('quickLike'), '⚡')}
            ${this.createToggle('readUnreadEnabled', this.t('readUnread'), '📬')}
            ${this.createToggle('randomOrderEnabled', this.t('randomOrder'), '🔀')}
            ${this.createToggle('skipReadEnabled', this.t('skipRead'), '⏭️')}
            ${this.createToggle('stopOnLikeLimitEnabled', '点赞停止', '❤️')}
            ${this.createToggle('stopAfterReadEnabled', '阅读限制', '🛑')}
          </div>

          <!-- 阅读限制数量 -->
          <div class="ldh-input-row ${stopAfterReadEnabled ? '' : 'hidden'}" id="ldh-stop-after-read-row">
            <label class="ldh-input-label">📖 阅读数量</label>
            <input type="number" class="ldh-input-number" id="ldh-stop-after-read-count"
                   value="${stopAfterReadCount}" min="1" max="1000" step="1">
          </div>

          <!-- 点赞过滤 -->
          <div class="ldh-filter-section">
            <label class="ldh-input-label">🎯 点赞过滤</label>
            <div class="ldh-filter-options">
              <button class="ldh-filter-btn ${likeFilterMode === 'off' ? 'active' : ''}" data-filter="off">关闭</button>
              <button class="ldh-filter-btn ${likeFilterMode === 'threshold' ? 'active' : ''}" data-filter="threshold">阈值</button>
              <button class="ldh-filter-btn ${likeFilterMode === 'probability' ? 'active' : ''}" data-filter="probability">概率</button>
            </div>
            <div class="ldh-input-row ${likeFilterMode === 'threshold' ? '' : 'hidden'}" id="ldh-threshold-row">
              <label class="ldh-input-label">📊 最低赞数</label>
              <input type="number" class="ldh-input-number" id="ldh-like-threshold"
                     value="${likeMinThreshold}" min="0" max="100" step="1">
            </div>
          </div>
        </div>

        <!-- 文章页工具 -->
        <div class="ldh-section ldh-article-tools ${isTopicPage ? '' : 'hidden'}">
          <div class="ldh-section-title">📝 文章工具</div>
          <div class="ldh-button-row">
            <button class="ldh-btn-secondary ldh-btn-random-floor">
              <span>🎲</span> ${this.t('randomFloor')}
            </button>
            <button class="ldh-btn-secondary ldh-btn-batch-info">
              <span>📊</span> ${this.t('batchShowInfo')}
            </button>
          </div>
        </div>

        <!-- 模式设置 -->
        <div class="ldh-section">
          <div class="ldh-section-title">⚙️ 模式设置</div>
          <div class="ldh-toggle-grid">
            ${this.createToggle('cleanModeEnabled', this.t('cleanMode'), '✨')}
            ${this.createToggle('grayscaleModeEnabled', this.t('grayscaleMode'), '🎨')}
          </div>
        </div>

        <!-- 语言切换 -->
        <div class="ldh-section">
          <div class="ldh-lang-toggle">
            <button class="ldh-lang-btn ${this.language === 'zh' ? 'active' : ''}" data-lang="zh">🇨🇳 中文</button>
            <button class="ldh-lang-btn ${this.language === 'en' ? 'active' : ''}" data-lang="en">🇺🇸 English</button>
          </div>
        </div>

        <!-- 主题选择 -->
        <div class="ldh-section">
          <div class="ldh-section-title">🎨 主题配色</div>
          <div class="ldh-theme-grid">
            ${Object.keys(this.themes).map(t => `
              <button class="ldh-theme-btn ${this.themeColor === t ? 'active' : ''}"
                      data-theme="${t}"
                      style="background: linear-gradient(135deg, ${this.themes[t].primary}, ${this.themes[t].secondary})">
              </button>
            `).join('')}
          </div>
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
    // 最小化按钮
    this.container.querySelector('.ldh-btn-minimize')?.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // 点击最小化状态展开
    this.container.querySelector('.ldh-minimized-content')?.addEventListener('click', () => {
      this.toggleMinimize();
    });

    // 开始阅读按钮
    this.container.querySelector('.ldh-btn-start-reading')?.addEventListener('click', () => {
      if (this.autoScroll) {
        if (this.autoScroll.autoRunning) {
          this.autoScroll.stop();
        } else {
          this.autoScroll.start();
        }
      }
    });

    // 开关事件
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

        // 显示/隐藏阅读限制数量输入
        if (key === 'stopAfterReadEnabled') {
          const row = this.container.querySelector('#ldh-stop-after-read-row');
          if (row) {
            row.classList.toggle('hidden', !value);
          }
        }
      });
    });

    // 阅读限制数量输入
    this.container.querySelector('#ldh-stop-after-read-count')?.addEventListener('change', (e) => {
      const value = parseInt(e.target.value) || 10;
      LDH_Storage.setSync('stopAfterReadCount', value);
      if (this.autoScroll) {
        this.autoScroll.stopAfterReadCount = value;
      }
    });

    // 点赞过滤按钮
    this.container.querySelectorAll('.ldh-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = e.target.dataset.filter;
        LDH_Storage.setSync('likeFilterMode', mode);
        if (this.autoScroll) {
          this.autoScroll.likeFilterMode = mode;
        }

        // 更新按钮状态
        this.container.querySelectorAll('.ldh-filter-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.filter === mode);
        });

        // 显示/隐藏阈值输入
        const thresholdRow = this.container.querySelector('#ldh-threshold-row');
        if (thresholdRow) {
          thresholdRow.classList.toggle('hidden', mode !== 'threshold');
        }
      });
    });

    // 点赞阈值输入
    this.container.querySelector('#ldh-like-threshold')?.addEventListener('change', (e) => {
      const value = parseInt(e.target.value) || 3;
      LDH_Storage.setSync('likeMinThreshold', value);
      if (this.autoScroll) {
        this.autoScroll.likeMinThreshold = value;
      }
    });

    // 清除冷却按钮
    this.container.querySelector('.ldh-btn-clear-cooldown')?.addEventListener('click', () => {
      if (this.likeCounter) {
        this.likeCounter.clearCooldown();
        LDH_Storage.setSync('likeResumeTime', null);
        LDH_Utils.showNotification('点赞冷却已清除');
      }
    });

    // 同步点赞数据按钮
    this.container.querySelector('.ldh-btn-sync-likes')?.addEventListener('click', async () => {
      if (this.likeCounter) {
        const btn = this.container.querySelector('.ldh-btn-sync-likes');
        btn.innerHTML = '<span>🔄</span> 同步中...';
        btn.disabled = true;
        try {
          await this.likeCounter.manualSync();
          LDH_Utils.showNotification('同步完成');
        } catch (e) {
          LDH_Utils.showNotification('同步失败');
        }
        btn.innerHTML = '<span>🔄</span> 同步';
        btn.disabled = false;
      }
    });

    // 语言切换
    this.container.querySelectorAll('.ldh-lang-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const lang = e.target.dataset.lang;
        this.switchLanguage(lang);
      });
    });

    // 主题切换
    this.container.querySelectorAll('.ldh-theme-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const theme = e.target.dataset.theme;
        this.switchTheme(theme);
      });
    });

    // 随机楼层按钮
    this.container.querySelector('.ldh-btn-random-floor')?.addEventListener('click', () => {
      this.jumpToRandomFloor();
    });

    // 批量展示信息按钮
    this.container.querySelector('.ldh-btn-batch-info')?.addEventListener('click', async () => {
      if (this.userInfoHelper) {
        const btn = this.container.querySelector('.ldh-btn-batch-info');
        btn.disabled = true;
        btn.innerHTML = '<span>⏳</span> 加载中...';
        await this.userInfoHelper.revealAllVisibleReplies();
        btn.disabled = false;
        btn.innerHTML = `<span>📊</span> ${this.t('batchShowInfo')}`;
      }
    });
  }

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

    // 更新语言按钮状态
    this.container.querySelectorAll('.ldh-lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // 重新创建面板
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

    // 更新主题按钮状态
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

    // 清除之前的冷却倒计时定时器
    if (this.cooldownTimer && !isInCooldown) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }

    // 显示/隐藏 清除冷却 & 同步 按钮
    const actionsRow = this.container.querySelector('.ldh-like-actions');
    if (actionsRow) {
      const shouldShow = isInCooldown || !matched;
      actionsRow.style.display = shouldShow ? 'flex' : 'none';
    }

    if (isInCooldown) {
      container.innerHTML = `
        <div class="ldh-like-info ldh-cooldown">
          <span>🔥 ${this.t('likeCooldown')}</span>
          <span class="ldh-cooldown-time">${cooldownFormatted}</span>
        </div>
      `;

      // 启动倒计时更新
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
          <span>${!matched ? '<span class="ldh-sync-warning" title="计数可能不准确">⚠️</span> ' : ''}❤️ ${this.t('likeRemaining')}</span>
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
  }

  updateReadStats(stats) {
    const sessionEl = this.container.querySelector('#ldh-session-read');
    const todayEl = this.container.querySelector('#ldh-today-read');
    const totalEl = this.container.querySelector('#ldh-total-read');
    const remainingEl = this.container.querySelector('#ldh-remaining');

    if (sessionEl) sessionEl.textContent = stats.sessionRead || 0;
    if (todayEl) todayEl.textContent = stats.todayRead || 0;
    if (totalEl) totalEl.textContent = stats.totalRead || 0;
    if (remainingEl) remainingEl.textContent = stats.remaining || 0;
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
    setTimeout(() => {
      targetPost.style.animation = '';
    }, 1000);
    LDH_Utils.showNotification(`已跳转到第 ${randomIndex + 1} 楼`);
  }

  applyModes() {
    this.applyCleanMode();
    this.applyGrayscaleMode();
  }

  applyCleanMode() {
    if (this.cleanModeEnabled) {
      document.body.classList.add('ldh-clean-mode');
    } else {
      document.body.classList.remove('ldh-clean-mode');
    }
  }

  applyGrayscaleMode() {
    if (this.grayscaleModeEnabled) {
      document.body.classList.add('ldh-grayscale-mode');
    } else {
      document.body.classList.remove('ldh-grayscale-mode');
    }
  }
}

// 导出到全局
window.LDH_HelperUI = HelperUI;
