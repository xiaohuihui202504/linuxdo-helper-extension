# Linux.do 小助手

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-v1.0.0-green.svg)
![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-brightgreen.svg)
![Stars](https://img.shields.io/github/stars/xiaohuihui202504/linuxdo-helper-extension.svg)

> Linux.do 论坛增强工具 — 自动浏览、智能点赞、用户信息展示，让论坛体验更高效

## 项目介绍

Linux.do 小助手是一款专为 [linux.do](https://linux.do) 论坛设计的浏览器扩展（Chrome / Edge / Arc 等 Chromium 内核浏览器），集成自动浏览、点赞计数与配额管理、用户信息速览、界面美化等功能，帮助用户高效使用论坛、轻松管理账号等级。

### 核心亮点

- 模拟人类浏览行为的智能自动滚动
- 基于信任等级的点赞配额精准追踪
- 一键查看帖子作者详细信息
- 多主题配色 + 简洁模式 + 中英双语

## 功能清单

| 功能模块 | 功能说明 | 状态 |
|---------|---------|------|
| 自动浏览 | 智能滚动阅读，支持未读优先、随机顺序、跳过已读、限定篇数 | ✅ |
| 阅读统计 | 本次/今日/累计阅读数据统计 | ✅ |
| 点赞计数 | 24 小时点赞实时追踪，按信任等级显示配额（Lv0-Lv4: 50-150） | ✅ |
| 冷却倒计时 | 触发频率限制时显示精确冷却倒计时 | ✅ |
| 自动点赞 | 浏览时自动为主贴点赞，可开启回复快速点赞（最多 5 条） | ✅ |
| 点赞过滤 | 阈值模式（最低点赞数）/ 概率模式（基于热度）/ 分区白名单黑名单 | ✅ |
| 用户信息 | 悬浮查看用户注册天数、发帖数、回复数、信任等级 | ✅ |
| 批量查看 | 一键加载当前页面所有用户信息 | ✅ |
| 简洁模式 | 隐藏侧边栏和导航栏，专注阅读 | ✅ |
| 灰度模式 | 页面灰度化显示 | ✅ |
| 主题配色 | 6 种配色方案：紫 / 蓝 / 绿 / 橙 / 粉 / 暗 | ✅ |
| 多语言 | 支持中文和英文界面切换 | ✅ |
| 随机楼层 | 随机跳转到帖子中的某一楼 | ✅ |

## 安装说明

### 环境要求

- Chrome 88+ / Edge 88+ / Arc 或其他 Chromium 内核浏览器
- 支持 Manifest V3 的浏览器版本

### 安装步骤

1. 下载项目代码：

```bash
git clone https://github.com/xiaohuihui202504/linuxdo-helper-extension.git
```

2. 打开 Chrome 浏览器，进入扩展管理页面：

```
chrome://extensions/
```

3. 开启右上角的 **开发者模式**

   ![image-20260211172137027](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/image-20260211172137027.png)

4. 点击 **加载已解压的扩展程序**，选择项目根目录

   ![image-20260211172304060](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/image-20260211172304060.png)

   ![image-20260211172329726](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/image-20260211172329726.png)

5. 扩展安装完成，访问 [linux.do](https://linux.do) 即可看到右上角的浮动面板

   ![img](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/517133078f3ebaf5233ea5e107256aa9.png)

> 同样适用于 Edge、Arc 等 Chromium 内核浏览器。Edge 的扩展管理页面为 `edge://extensions/`。

## 使用说明

### 快速开始

1. 安装扩展后，访问 [linux.do](https://linux.do) 论坛
2. 页面右上角会出现浮动控制面板
3. 通过面板中的开关控制各项功能

### 功能操作

| 操作 | 说明 |
|------|------|
| 开启自动浏览 | 打开面板中的「自动浏览」开关，扩展将自动滚动阅读帖子 |
| 配置浏览策略 | 可选：仅未读、随机顺序、跳过已读、限定篇数 |
| 开启自动点赞 | 打开「自动点赞」开关，浏览时自动为主贴点赞 |
| 点赞过滤 | 选择阈值模式或概率模式，控制点赞策略 |
| 查看用户信息 | 帖子旁悬浮 📊 按钮，点击加载用户详情 |
| 切换主题 | 面板底部选择配色方案 |
| 简洁模式 | 开启后隐藏论坛侧边栏和导航栏 |
| 查看统计 | 点击浏览器工具栏扩展图标，查看阅读和点赞统计 |

### 信任等级与点赞配额

| 信任等级 | 每日点赞上限 |
|---------|-------------|
| Lv0 | 50 |
| Lv1 | 50 |
| Lv2 | 75 |
| Lv3 | 100 |
| Lv4 | 150 |

## 项目结构

```
linuxdo-helper-extension/
├── manifest.json          # 扩展配置（Manifest V3）
├── popup.html             # 弹出页面
├── popup.js               # 弹出页面逻辑
├── css/
│   └── panel.css          # 浮动面板样式
├── js/
│   ├── content.js         # 内容脚本入口
│   ├── background.js      # Service Worker
│   ├── utils.js           # 工具函数与配置常量
│   ├── storage.js         # 存储抽象层（Chrome Storage + localStorage）
│   ├── likeCounter.js     # 点赞计数、配额管理与服务器同步
│   ├── userInfo.js        # 用户信息获取与展示
│   ├── autoScroll.js      # 自动浏览控制器
│   └── ui.js              # 浮动面板 UI
└── icons/                 # 扩展图标（16/32/48/128px）
```

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Chrome Extension Manifest | V3 | 扩展规范 |
| JavaScript | ES6+ | 核心逻辑 |
| CSS3 | - | UI 样式（渐变、动画、Grid 布局） |
| Chrome Storage API | - | 数据持久化 |
| Discourse API | - | 论坛数据交互 |

## 开发指南

### 本地开发

```bash
# 克隆项目
git clone https://github.com/xiaohuihui202504/linuxdo-helper-extension.git

# 在 Chrome 中加载扩展（开发者模式）
# chrome://extensions/ → 加载已解压的扩展程序 → 选择项目目录

# 修改代码后，在扩展管理页面点击刷新按钮即可生效
```

### 模块说明

| 模块 | 文件 | 职责 |
|------|------|------|
| 工具层 | `utils.js` | DOM 操作、随机化、页面检测、全局配置常量 |
| 存储层 | `storage.js` | Chrome Storage API 封装，localStorage 回退 |
| 点赞模块 | `likeCounter.js` | 拦截请求追踪点赞、24 小时配额管理、服务器同步 |
| 用户模块 | `userInfo.js` | 多策略获取用户信息、缓存、批量加载 |
| 浏览模块 | `autoScroll.js` | 智能滚动、话题导航、阅读统计 |
| UI 模块 | `ui.js` | 浮动面板、主题切换、多语言、交互控制 |
| 入口 | `content.js` | 内容脚本初始化，模块组装 |
| 后台 | `background.js` | Service Worker 生命周期管理 |

### 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m "feat: add your feature"`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 常见问题

<details>
<summary>扩展安装后页面没有出现浮动面板？</summary>

1. 确认已访问 `linux.do` 域名下的页面
2. 在 `chrome://extensions/` 检查扩展是否已启用
3. 尝试刷新页面或重新加载扩展

</details>

<details>
<summary>点赞计数不准确怎么办？</summary>

点击面板中的「同步」按钮手动与服务器同步点赞数据。扩展每 30 分钟也会自动同步一次。

</details>

<details>
<summary>自动浏览时页面卡在某个位置不动了？</summary>

扩展内置了超时检测机制，正常情况下会自动恢复。如果长时间未恢复，可以手动关闭再开启自动浏览开关。

</details>

<details>
<summary>支持 Firefox 吗？</summary>

目前仅支持 Chromium 内核浏览器（Chrome、Edge、Arc 等），暂不支持 Firefox。

</details>

## 支持的站点

| 站点 | 地址 |
|------|------|
| Linux.do 主站 | `https://linux.do` |
| Connect | `https://connect.linux.do` |
| Credit | `https://credit.linux.do` |
| CDK | `https://cdk.linux.do` |

## 路线图

### 计划功能

- [ ] Firefox 浏览器支持
- [ ] 扩展商店发布（Chrome Web Store）
- [ ] 数据导出与统计报表
- [ ] 自定义快捷键

### 优化项

- [ ] 点赞策略更多自定义选项
- [ ] 用户信息缓存优化
- [ ] 面板 UI 响应式适配

## 致谢

- [linux.do](https://linux.do) — 提供优秀的中文技术社区平台
- [Discourse](https://www.discourse.org/) — 开源论坛框架
- 所有为本项目提出建议和反馈的用户

## 技术交流群

欢迎加入技术交流群，分享使用心得和功能建议：

![技术交流群](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/Screenshot_20260210_085255_com.tencent.mm.jpg)

## 联系作者

- **微信**: laohaibao2025
- **邮箱**: 75271002@qq.com

![微信二维码](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/Screenshot_20260123_095617_com.tencent.mm.jpg)

## 打赏

如果这个项目对你有帮助，欢迎请作者喝杯咖啡 ☕

**微信支付**

![微信支付](https://mypicture-1258720957.cos.ap-nanjing.myqcloud.com/Obsidian/image-20250914152855543.png)

## License

本项目基于 [MIT License](LICENSE) 开源。

## Star History

如果觉得项目不错，欢迎点个 Star ⭐

[![Star History Chart](https://api.star-history.com/svg?repos=xiaohuihui202504/linuxdo-helper-extension&type=Date)](https://star-history.com/#xiaohuihui202504/linuxdo-helper-extension&Date)
