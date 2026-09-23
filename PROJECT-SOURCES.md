# 项目来源与归档边界

这份说明记录三台电脑之间的分工，避免把运行数据误认为源码，也避免公开上传私有环境文件。

| 来源 | 内容 | 公开仓库处理 |
| --- | --- | --- |
| 当前仓库 `ai-town-3d/` | Three.js 3D 展示端、角色模型、地形、建设季 UI、精选宣传截图 | 保留源码与必要素材 |
| 当前仓库 `ai-town-social-work/` | 原始 2D 前端 + Convex 社会模拟后端、居民记忆、对话、关系、行动与建设规则 | 保留源码、静态素材、测试和锁文件 |
| JanUbuntu `projects/ai-town` | 原始 AI Town 主项目及社会系统改动 | 已逐文件核对 Convex 核心源码；不直接携带整台机器的依赖和构建产物 |
| JanUbuntu `projects/ai-town-capture` | 宣传片、录屏、音频和测试截图 | 只保留精选静态素材，视频原件私有保存 |
| PCUbuntu | 当前 3D 预览、API 代理、运行中的世界数据和部署环境 | 不上传数据库、服务文件和机器路径 |
| JanUbuntu `ai-town-backups` | 世界快照、迁移备份和历史数据 | 私有归档，不上传 |

## 核对结果

- JanUbuntu 的 Convex 源文件共 57 个，均能在当前 `ai-town-social-work/convex/` 中找到。
- 逐文件校验后，核心 Convex 源码与 JanUbuntu 工作区一致。
- 当前仓库的 `ai-town-3d/` 是原野小镇的独立 3D 展示端。
- JanUbuntu 的前端修改属于原始 2D AI Town 界面；当前仓库用独立 3D 前端作为展示入口，因此不把两套前端混成一个启动命令。

## 不上传的内容

运行中的数据库、居民长期记忆、备份压缩包、`node_modules`、构建目录、录制视频、SSH/FRP/Ollama 服务配置和任何真实凭据均不进入公开仓库。需要在新机器部署时，应根据自己的 Convex、模型服务和代理环境重新配置。
