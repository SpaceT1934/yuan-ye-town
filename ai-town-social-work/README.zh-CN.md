# 原野小镇 · 社会模拟

[English](README.md) · [中文](README.zh-CN.md)

原野小镇的原始 2D 客户端和 Convex/TypeScript 后端。这里保存持续运行的小镇世界、AI 驱动 NPC 的对话、长期记忆、关系、行动和建设季规则。

## 本地运行

```bash
npm install
npm run dev
```

前端需要配置 `VITE_CONVEX_URL`；后端需要 Convex 部署和模型服务。不要提交 `.env` 文件或生产密钥。

## 模型服务

后端支持本地 Ollama、OpenAI、Together 以及自定义 OpenAI 兼容接口。请使用 `npx convex env set` 配置变量；完整的 Ollama 和 API 示例见[根目录首页](../README.zh-CN.md)。

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动前端和 Convex 开发服务 |
| `npm run build` | 类型检查并构建 2D 客户端 |
| `npm run test` | 运行后端测试 |
| `npm run lint` | 执行 ESLint |
| `npm run level-editor` | 启动地图编辑器 |

运行中的数据库、备份、模型下载和部署专用文件不会进入仓库。
