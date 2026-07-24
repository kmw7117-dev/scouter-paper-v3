[한국어](README.md) | [English](README.en.md)

# Scouter Paper v3

A custom dashboard for Scouter APM (React + TypeScript + ECharts)

🔗 [datagrid.co.kr](https://datagrid.co.kr) · [datagraphy.io.kr](https://datagraphy.io.kr)

> This project is an independent community dashboard that consumes the [Scouter](https://github.com/scouter-project/scouter) (Apache 2.0) HTTP Web API. It is not affiliated with the official Scouter project.

## Features
- Real-time JVM Heap / GC monitoring
- XLog (Profile) transaction tracing with drag-to-select
- Service call topology graph (force-directed)
- Dashboard / Topology tab switching

## Setup

```bash
git clone https://github.com/kmw7117-dev/scouter-paper-v3.git
cd scouter-paper-v3
npm install
cp .env.example .env
# In .env, set VITE_SCOUTER_SERVER_URL to your own Scouter Collector address
npm run dev
```

## Requirements
- Node.js 18+
- Scouter Server (Collector) with HTTP API enabled
- The Scouter Server's HTTP Web API must be enabled, and `VITE_SCOUTER_SERVER_URL` in `.env` must point to a live Scouter server for data to appear.
- If the frontend and Scouter server run on different hosts/ports, check CORS settings on the Scouter server side.
- By default, `npm run dev` is only accessible from localhost. To access it from another device, run `npm run dev -- --host`.

## Screenshots

![Dashboard](docs/screenshot-dashboard.png)
![Topology](docs/screenshot-topology.png)

## Feedback

Please file bugs or feature requests via [Issues](https://github.com/kmw7117-dev/scouter-paper-v3/issues).

## License

MIT
