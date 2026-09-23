# 原野小镇

[English](README.md) · [中文](README.zh-CN.md)

一个由 AI 驱动 NPC 的小镇：每位居民拥有自己的性格、关系、长期记忆和行动规则，会在持续运行的社会模拟中交谈、协作、冲突、投票并参与社区建设。

![原野小镇](ai-town-3d/live-town.png)

> 这是一个研究与展示项目：2D/3D 前端、社会模拟后端和模型服务可以分别运行，也可以组合成完整的实时小镇。

## 项目内容

| 目录 | 作用 |
| --- | --- |
| [`ai-town-3d`](ai-town-3d/) | Three.js + Vite 3D 展示端，包含居民、地形、建筑、观察站和建设季界面 |
| [`ai-town-social-work`](ai-town-social-work/) | 原始 2D AI Town 前端 + Convex/TypeScript 社会模拟后端，负责对话、记忆、关系、行动和社区建设规则 |
| [`CIVIC-SEASON.md`](CIVIC-SEASON.md) | 建设季系统的设计记录、边界和验证结果 |

## 亮点

- 8 位具有独立资料、关系和长期记忆的 AI 居民。
- NPC 的对话与社会行为由模型生成，同时受持久化记忆、关系和明确的行动规则约束。
- 从原始 64×48 地图映射出的可探索三维场景。
- 对话、位置和社会状态由后端驱动，断线时明确显示连接状态，不用随机动画伪装在线生活。
- 建设季包含医院、集市、河桥、财政、借款、投票、履约和社区邀请等机制。
- 树木远近分级、实例化和浏览器端视图烘焙，让复杂场景在普通设备上也能流畅观察。

## 快速开始：3D 展示端

```bash
cd ai-town-3d
npm install
npm run dev
```

然后打开终端提示的本地地址。生产构建：

```bash
npm run build
```

3D 展示端默认以本地静态资源运行；如果需要连接社会模拟后端，请在本地部署后端代理，并通过环境变量配置地址。不要把真实的局域网地址、SSH 密钥、数据库备份或模型凭据提交到仓库。

## 快速开始：2D 前端与社会模拟

```bash
cd ai-town-social-work
npm install
npm run dev
```

后端依赖 Convex 和模型服务。首次部署前请按 Convex 官方文档配置自己的部署环境与密钥；项目中的本地运行数据、快照和部署配置默认不会进入 Git。

## 接入模型

原野小镇通过 OpenAI 兼容的 `/v1/chat/completions` 接口驱动 NPC 对话和记忆嵌入，支持本地模型，也支持云端 API。模型密钥只应写入 Convex 环境变量，不要写进源码或提交到 Git。

### 方式一：本地 Ollama

安装并启动 [Ollama](https://ollama.com/)，准备一个对话模型和一个向量模型：

```bash
ollama pull qwen2.5:7b
ollama pull mxbai-embed-large
ollama serve
```

然后在 Convex 部署环境中设置：

```bash
npx convex env set OLLAMA_HOST http://127.0.0.1:11434
npx convex env set OLLAMA_MODEL qwen2.5:7b
npx convex env set OLLAMA_EMBEDDING_MODEL mxbai-embed-large
```

如果 Convex 运行在另一台机器，`OLLAMA_HOST` 必须填写 Convex 服务能够访问到的地址；不要直接把 Ollama 端口暴露到公网。

### 方式二：OpenAI 或其他云端 API

使用 OpenAI：

```bash
npx convex env set LLM_PROVIDER openai
npx convex env set OPENAI_API_KEY your-key
npx convex env set OPENAI_CHAT_MODEL gpt-4o-mini
npx convex env set OPENAI_EMBEDDING_MODEL text-embedding-3-small
```

也可以接入任何兼容 OpenAI 接口的服务：

```bash
npx convex env set LLM_API_URL https://your-provider.example.com
npx convex env set LLM_API_KEY your-key
npx convex env set LLM_MODEL your-chat-model
npx convex env set LLM_EMBEDDING_MODEL your-embedding-model
```

自定义服务需要同时提供聊天和嵌入接口，并确保嵌入维度与 `convex/util/llm.ts` 中的配置一致。前端还需要设置对应的 `VITE_CONVEX_URL`，连接到你的 Convex 部署。

## 操作

- 拖动旋转，右键平移，滚轮缩放。
- 点击居民或地图标记查看资料。
- `1`：全镇俯瞰；`3`：人物近景；`H`：隐藏界面。
- 在建设季面板查看项目、财政、邀请和投票状态。

## 素材与许可

场景使用 Three.js 示例素材、Poly Haven CC0 素材、Microsoft Rocketbox MIT 素材及 Renderpeople 免费样例。完整来源与许可说明见 [`ai-town-3d/public/assets/CREDITS.md`](ai-town-3d/public/assets/CREDITS.md)。请在重新分发或商业使用前分别核对上游许可条款。

## 当前边界

本项目是一个可运行的研究原型，不是完整商业游戏。玩家完整三维化、战斗/治疗专用动作和一部分交互仍在完善；模型服务、后端数据库和实时部署属于运行环境，不随本仓库的源码提交。

## 目录约定

仓库只保留可复现的源码、依赖锁文件、必要的静态展示素材和文档。`node_modules`、构建产物、运行中数据库、历史备份、录制视频、模型下载和私人局域网部署文件均被 `.gitignore` 排除。
