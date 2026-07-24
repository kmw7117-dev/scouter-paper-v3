# Scouter Paper v3

Scouter APM을 위한 커스텀 대시보드 (React + TypeScript + ECharts)

## Features
- 실시간 JVM Heap / GC 모니터링
- XLog(Profile) 트랜잭션 추적, 드래그 다중 선택
- 서비스 간 호출 토폴로지 그래프 (force-directed)
- 대시보드 / 토폴로지 탭 전환

## Setup

```bash
git clone https://github.com/kmw7117-dev/scouter-paper-v3.git
cd scouter-paper-v3
npm install
cp .env.example .env
# .env에서 VITE_SCOUTER_SERVER_URL을 자신의 Scouter Collector 주소로 수정
npm run dev
```

## Requirements
- Node.js 18+
- Scouter Server (Collector) with HTTP API enabled

## Screenshots

![Dashboard](docs/screenshot-dashboard.png)
![Topology](docs/screenshot-topology.png)

## License

MIT
