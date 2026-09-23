# 原野小镇 · Social Simulation

[English](README.md) · [中文](README.zh-CN.md)

The original 2D client and Convex/TypeScript backend for 原野小镇. This package stores the persistent world, AI-driven NPC conversations, long-term memories, relationships, actions, and civic-season rules.

## Run locally

```bash
npm install
npm run dev
```

The frontend requires `VITE_CONVEX_URL`. The backend requires a Convex deployment and a model provider. Do not commit `.env` files or production secrets.

## Model providers

The backend supports local Ollama, OpenAI, Together, and custom OpenAI-compatible endpoints. Configure provider variables with `npx convex env set`; see the [root README](../README.md) for complete Ollama and API examples.

## Main commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the frontend and Convex development services |
| `npm run build` | Type-check and build the 2D client |
| `npm run test` | Run the backend test suite |
| `npm run lint` | Run ESLint |
| `npm run level-editor` | Start the map editor |

Runtime databases, backups, model downloads, and deployment-specific files are excluded from this repository.
