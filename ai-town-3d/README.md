# 原野小镇

[English](README.md) · [中文](README.zh-CN.md)

The standalone realtime 3D client for 原野小镇. It renders AI-driven NPCs, their town, community projects, and observatory views from persistent backend state.

## Features

- Eight resident profiles with distinct models, names, relationships, health, memories, and locations.
- A 64×48 original map reconstructed as a navigable 3D scene with terrain, river, forest, windmill, buildings, and props.
- Live connection to backend positions, dialogue, resident profiles, observatory data, and civic-season state.
- Explicit connection failures and frozen state when the backend is unavailable; no random activity is used to fake an online world.
- Tree instancing, distance-based detail, baked view impostors, conservative collision bounds, and foot-to-terrain alignment for practical browser performance.

## Run locally

```bash
npm install
npm run dev
```

Build for production with `npm run build`. The Vite development server serves local static assets. A deployment-specific API proxy is required to connect this client to the social simulation backend.

## Controls

- Drag to orbit, right-click to pan, and scroll to zoom.
- Click a resident or map marker to inspect them.
- `1`: town overview; `3`: resident close-up; `H`: hide the interface.

## Backend and model service

The client consumes backend state; it does not run the NPC model itself. Use [`../ai-town-social-work`](../ai-town-social-work/) for the 2D client and Convex social simulation. Model setup instructions for local Ollama and OpenAI-compatible APIs are in the [root README](../README.md).

## Assets

Asset sources and licenses are documented in [`public/assets/CREDITS.md`](public/assets/CREDITS.md). The project uses Poly Haven CC0 assets, Microsoft Rocketbox MIT assets, Renderpeople free samples, and original procedural scene work. Check upstream terms before redistribution.

## Validation scripts

The `check-*.mjs` scripts validate rendering, resident uniqueness, face motion, pause/resume behavior, collision, and civic UI. Set `TOWN_URL` when running checks against a deployed preview. Private service files, machine paths, recordings, and backups are intentionally excluded from the repository.
