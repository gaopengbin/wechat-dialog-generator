# WeChat Dialog Generator 微信聊天记录生成器

> 在线生成逼真的微信聊天截图，支持文字、图片、红包、转账、语音等多种消息类型。纯前端实现，无需后端，保护隐私。

[![Deploy to GitHub Pages](https://github.com/gaopengbin/wechat-dialog-generator/actions/workflows/deploy.yml/badge.svg)](https://github.com/gaopengbin/wechat-dialog-generator/actions/workflows/deploy.yml)
[![GitHub](https://img.shields.io/github/license/gaopengbin/wechat-dialog-generator)](./LICENSE)

## 🔗 在线体验

👉 **[https://gaopengbin.github.io/wechat-dialog-generator/](https://gaopengbin.github.io/wechat-dialog-generator/)**

## ✨ 功能特性

- **多种消息类型** — 文字、图片、红包、转账、语音、时间节点
- **手动添加消息** — 可视化编辑器，逐条添加任意类型消息
- **批量导入** — 支持 Markdown / 纯文本格式批量导入聊天记录
- **AI 生成** — 内置豆包 / ChatGPT Prompt 模板，一键生成聊天内容
- **自定义头像** — 为每个用户上传自定义头像
- **设为自己** — 任意用户可标记为"自己"，消息自动切换左右方向
- **外观设置** — 自定义气泡颜色、联系人名称、时间、信号、电量等
- **高清截图** — 一键导出 1125×2436 高清 PNG 图片
- **长截图** — 支持完整聊天记录长图导出
- **复制到剪贴板** — 截图直接复制，方便粘贴分享
- **图片本地上传** — 图片消息支持点击上传本地图片
- **纯前端** — 无需服务器，所有数据本地处理，保护隐私

## 📖 使用方法

### 方式一：文本导入

在左侧文本框中粘贴聊天记录，支持以下格式：

```
**【3月1日 14:32】**

**张三**：你好，在忙不？
**李四**：不忙，怎么了？
**张三**：[图片]
**李四**：[红包]恭喜发财
**张三**：[转账]200:饭钱
**李四**：[语音]5
```

### 方式二：手动添加

导入用户后，通过「添加消息」面板逐条添加消息，支持选择发送人和消息类型。

### 方式三：AI 生成

展开「用豆包 / AI 生成聊天记录」面板，复制 Prompt 发给 AI，将返回内容粘贴导入即可。

## 🛠️ 技术栈

- **React 19** + **TypeScript**
- **Vite 8**
- **Tailwind CSS v4**
- **Lucide React** 图标库
- **html-to-image** 截图导出

## 🚀 本地开发

```bash
# 克隆仓库
git clone https://github.com/gaopengbin/wechat-dialog-generator.git
cd wechat-dialog-generator

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📝 消息格式参考

| 类型 | 格式 | 示例 |
|------|------|------|
| 文字 | `**用户名**：内容` | `**张三**：你好` |
| 图片 | `**用户名**：[图片]` 或 `**用户名**：[图片]URL` | `**张三**：[图片]` |
| 红包 | `**用户名**：[红包]备注` | `**张三**：[红包]恭喜发财` |
| 转账 | `**用户名**：[转账]金额:备注` | `**张三**：[转账]200:饭钱` |
| 语音 | `**用户名**：[语音]秒数` | `**张三**：[语音]5` |
| 时间 | `**【时间】**` | `**【3月1日 14:32】**` |

## 📄 License

MIT
