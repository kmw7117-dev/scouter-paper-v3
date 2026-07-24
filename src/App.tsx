import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts';
import { scouterApi } from './services/scouterApi';
interface Agent {
  objHash: string;
  objName: string;
  objType: string;
  alive: boolean;
}

function AgentIcon({ objType }: { objType: string }) {
  const t = (objType || '').toLowerCase();
  if (t === 'linux') return <span className="text-2xl align-middle">🐧</span>;
  if (t === 'windows' || t === 'win32') return <span className="text-2xl align-middle">🪟</span>;
  if (t === 'unix' || t === 'aix' || t === 'hpux' || t === 'sunos' || t === 'solaris') return <span className="text-2xl align-middle">🖥️</span>;
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" className="inline-block align-middle">
      <path d="M8 1.5c0 .8-.9.8-.9 1.6s.9.8.9 1.6" stroke="#9ca3af" strokeWidth="1" fill="none" strokeLinecap="round">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
      </path>
      <path d="M12 1.5c0 .8-.9.8-.9 1.6s.9.8.9 1.6" stroke="#9ca3af" strokeWidth="1" fill="none" strokeLinecap="round">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" begin="0.6s" repeatCount="indefinite" />
      </path>
      <path d="M4 9h13v6a4 4 0 01-4 4H8a4 4 0 01-4-4V9z" fill="#f59e0b" />
      <path d="M17 10.5h1.5a2 2 0 010 4H17" stroke="#f59e0b" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function buildProfileTree(steps: any[]) {
  const nodeMap: Record<string, any> = {};
  steps.forEach((s, i) => {
    nodeMap[String(s.step?.index ?? i)] = { ...s, children: [] as any[] };
  });
  const roots: any[] = [];
  steps.forEach((s, i) => {
    const idx = String(s.step?.index ?? i);
    const parentIdx = String(s.step?.parent ?? '-1');
    const node = nodeMap[idx];
    if (parentIdx !== '-1' && nodeMap[parentIdx]) {
      nodeMap[parentIdx].children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function stepColor(typeName: string) {
  if (typeName === 'SQL3' || typeName === 'SQL') return 'text-amber-300';
  if (typeName === 'METHOD') return 'text-blue-300';
  return 'text-gray-400';
}

function ProfileNode({ node, depth }: { node: any; depth: number }) {
  const step = node.step || {};
  const elapsed = step.elapsed !== undefined ? `${step.elapsed}ms` : '';
  return (
    <div>
      <div style={{ paddingLeft: `${depth * 16}px` }} className="py-0.5 text-xs">
        <span className="text-gray-500 mr-2">[{step.stepTypeName}]</span>
        <span className={stepColor(step.stepTypeName)}>{node.mainValue}</span>
        {elapsed && <span className="text-gray-500 ml-2">({elapsed})</span>}
        {step.param && <span className="text-gray-600 ml-2">param: {step.param}</span>}
      </div>
      {node.children?.map((child: any, i: number) => (
        <ProfileNode key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function computeTimeRatio(steps: any[]) {
  const categories: Record<string, { time: number; steps: any[] }> = {
    CPU: { time: 0, steps: [] },
    SQL: { time: 0, steps: [] },
    API: { time: 0, steps: [] },
    METHOD: { time: 0, steps: [] },
    MSG: { time: 0, steps: [] },
  };
  let total = 1;
  let accountedElapsed = 0;
  steps.forEach((s) => {
    const st = s.step || {};
    const elapsed = Number(st.elapsed || 0);
    const cputime = Number(st.cputime || 0);
    if (cputime > 0) {
      categories.CPU.time += cputime;
      categories.CPU.steps.push(s);
    }
    const typeName = st.stepTypeName || '';
    if (typeName.startsWith('SQL')) {
      categories.SQL.time += elapsed;
      categories.SQL.steps.push(s);
      accountedElapsed += elapsed;
    } else if (typeName === 'APICALL' || typeName === 'API') {
      categories.API.time += elapsed;
      categories.API.steps.push(s);
      accountedElapsed += elapsed;
    } else if (typeName === 'METHOD') {
      categories.METHOD.time += elapsed;
      categories.METHOD.steps.push(s);
      accountedElapsed += elapsed;
    } else if (typeName.includes('MESSAGE')) {
      categories.MSG.time += elapsed;
      categories.MSG.steps.push(s);
      accountedElapsed += elapsed;
    }
    const endPoint = Number(st.start_time || 0) + elapsed;
    if (endPoint > total) total = endPoint;
  });
  const idle = Math.max(total - accountedElapsed, 0);
  return { categories, idle, total };
}

const CATEGORY_COLORS: Record<string, string> = {
  CPU: 'bg-rose-700',
  SQL: 'bg-blue-600',
  API: 'bg-green-600',
  METHOD: 'bg-sky-600',
  MSG: 'bg-gray-500',
  IDLE: 'bg-indigo-600',
};

function TimeRatioBar({
  steps,
  selected,
  onSelect,
}: {
  steps: any[];
  selected: string | null;
  onSelect: (name: string | null) => void;
}) {
  const { categories, idle, total } = computeTimeRatio(steps);
  const pct = (v: number) => (total > 0 ? (v / total) * 100 : 0);
  const allCats = { ...categories, IDLE: { time: idle, steps: [] as any[] } };

  return (
    <div className="mb-4">
      <div className="bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-300 mb-2">TIME RATIO</div>
      <div className="flex flex-wrap items-center gap-4 text-xs mb-2 px-3">
        {Object.entries(allCats).map(([name, c]) => (
          <span
            key={name}
            className={`cursor-pointer hover:underline ${selected === name ? 'text-white font-semibold' : ''}`}
            onClick={() => onSelect(selected === name ? null : name)}
          >
            <span className={`inline-block w-3 h-3 mr-1 align-middle ${CATEGORY_COLORS[name]}`} />
            {name} ({c.time}ms)
          </span>
        ))}
      </div>
      <div className="w-full h-8 bg-gray-700 rounded overflow-hidden flex text-xs mx-3" style={{ width: 'calc(100% - 1.5rem)' }}>
        {Object.entries(allCats).filter(([name]) => name !== 'CPU').map(([name, c]) => (
          c.time > 0 && (
            <div
              key={name}
              style={{ width: `${pct(c.time)}%` }}
              className={`${CATEGORY_COLORS[name]} flex items-center justify-center text-white cursor-pointer hover:opacity-100 ${selected === name ? 'opacity-100 ring-2 ring-inset ring-white' : 'opacity-90'}`}
              onClick={() => onSelect(selected === name ? null : name)}
            >
              {pct(c.time).toFixed(1)}% ({c.time}ms)
            </div>
          )
        ))}
      </div>
      {selected && (
        <div className="mx-3 mt-2 bg-gray-900 border border-gray-700 rounded p-2 max-h-40 overflow-auto">
          <div className="text-xs text-gray-400 mb-1">{selected} 상세 ({allCats[selected].steps.length}건)</div>
          {allCats[selected].steps.length === 0 ? (
            <div className="text-xs text-gray-600">개별 스텝 없음 (측정 안 된 유휴 시간)</div>
          ) : (
            allCats[selected].steps
              .slice()
              .sort((a: any, b: any) => Number(b.step?.elapsed || 0) - Number(a.step?.elapsed || 0))
              .map((s: any, i: number) => (
                <div key={i} className="text-xs text-gray-300 py-0.5 flex justify-between gap-2">
                  <span className="truncate">{s.mainValue}</span>
                  <span className="text-amber-300 shrink-0">{s.step?.elapsed ?? s.step?.cputime}ms</span>
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}
function stepBarColor(typeName: string) {
  if (typeName?.startsWith('SQL')) return 'bg-blue-600';
  if (typeName === 'METHOD') return 'bg-sky-500';
  if (typeName === 'APICALL' || typeName === 'API') return 'bg-green-600';
  return 'bg-gray-500';
}

function ProfileGantt({ steps, highlightHashes }: { steps: any[]; highlightHashes: Set<string> | null }) {
  const { total } = computeTimeRatio(steps);
  const rawStep = total / 6;
  const niceSteps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  const tickStep = niceSteps.find((s) => s >= rawStep) || Math.ceil(rawStep / 100) * 100;
  const ticks: number[] = [];
  for (let t = 0; t <= total; t += tickStep) ticks.push(t);
  if (ticks[ticks.length - 1] !== total) ticks.push(total);

  return (
    <div>
      <div className="bg-gray-900 px-3 py-1 text-xs font-semibold text-gray-300 mb-2">PROFILE STEP</div>
      <div className="flex text-[10px] text-gray-500 border-b border-gray-700 pb-1 mb-1 ml-40 mr-3">
        {ticks.map((t, i) => (
          <div key={i} style={{ width: `${100 / (ticks.length - 1 || 1)}%` }}>{t}ms</div>
        ))}
      </div>
      <div className="mx-3">
        {steps.map((s, i) => {
          const st = s.step || {};
          const elapsed = Number(st.elapsed || 0);
          const startTime = Number(st.start_time || 0);
          const pct = total > 0 ? (elapsed / total) * 100 : 0;
          const leftPct = total > 0 ? (startTime / total) * 100 : 0;
          const isHighlighted = highlightHashes ? highlightHashes.has(String(st.hash)) : false;
          const dimmed = highlightHashes && !isHighlighted;
          return (
            <div
              className={`flex items-start text-xs py-1 border-b transition-colors ${
                isHighlighted ? 'bg-amber-500/10 border-amber-500/40' : 'border-gray-800'
              } ${dimmed ? 'opacity-30' : ''}`}
              key={i}
            >
              <div className="w-6 text-gray-500 pt-1">{i}</div>
              <div className="w-32 text-gray-400 leading-tight">
                <div>{st.stepTypeName}</div>
                <div className="text-amber-300">{elapsed} ms</div>
                <div className="text-gray-600">{pct.toFixed(1)}%</div>
              </div>
              <div className="flex-1 relative h-4 mt-1">
                <div
                  className={`absolute h-4 ${stepBarColor(st.stepTypeName)} ${isHighlighted ? 'ring-2 ring-white' : ''}`}
                  style={{ left: `${leftPct}%`, width: `${Math.max(pct, 0.3)}%` }}
                  title={s.mainValue}
                />
              </div>
              <div className="ml-2 text-gray-400 truncate max-w-md pt-1" title={s.mainValue}>{s.mainValue}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileDetailPanel({ steps }: { steps: any[] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const { categories, idle } = computeTimeRatio(steps);
  const allCats = { ...categories, IDLE: { time: idle, steps: [] as any[] } };
  const highlightHashes = selected
    ? new Set(allCats[selected].steps.map((s: any) => String(s.step?.hash)))
    : null;

  return (
    <div>
      <TimeRatioBar steps={steps} selected={selected} onSelect={setSelected} />
      <ProfileGantt steps={steps} highlightHashes={highlightHashes} />
    </div>
  );
}
export default function App() {
  const cpuChartRef = useRef<HTMLDivElement>(null);
  const gcChartRef = useRef<HTMLDivElement>(null);
  const xlogChartRef = useRef<HTMLDivElement>(null);
  const xlogChartIns = useRef<echarts.ECharts | null>(null);
  const topologyChartRef = useRef<HTMLDivElement>(null);
  const topologyChartIns = useRef<echarts.ECharts | null>(null);
  const nodePositions = useRef<Record<string, { x: number; y: number }>>({});

  const cpuChartIns = useRef<echarts.ECharts | null>(null);
  const gcChartIns = useRef<echarts.ECharts | null>(null);

  // 실제 API에서 받아올 에이전트 상태 목록
  const [agents, setAgents] = useState<Agent[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'topology'>('dashboard');

  // 차트 데이터 상태
  const [gcData, setGcData] = useState<number[]>(new Array(10).fill(0));
  const [gcTimeLabels, setGcTimeLabels] = useState<string[]>(new Array(10).fill('--:--:--'));
  const [cpuData, setCpuData] = useState<number[]>(new Array(10).fill(0));
  const [heapSeries, setHeapSeries] = useState<Record<string, number[]>>({});
  const [timeLabels, setTimeLabels] = useState<string[]>(new Array(10).fill('--:--:--'));
  const [xlogPoints, setXlogPoints] = useState<{ time: number; elapsed: number; service: string; txid: string; agent: string }[]>([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const RANGE_OPTIONS = [
    { label: '5분', ms: 5 * 60 * 1000 },
    { label: '10분', ms: 10 * 60 * 1000 },
    { label: '20분', ms: 20 * 60 * 1000 },
    { label: '60분', ms: 60 * 60 * 1000 },
    { label: '1일', ms: 24 * 60 * 60 * 1000 },
    { label: '1주', ms: 7 * 24 * 60 * 60 * 1000 },
    { label: '1개월', ms: 30 * 24 * 60 * 60 * 1000 },
    { label: '3개월', ms: 90 * 24 * 60 * 60 * 1000 },
  ];
  const [selectedRangeMs, setSelectedRangeMs] = useState(RANGE_OPTIONS[0].ms);
  const [historicalPoints, setHistoricalPoints] = useState<{ time: number; elapsed: number; service: string; txid: string; agent: string }[] | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [profileData, setProfileData] = useState<any>(null);
  const [selectedXlogList, setSelectedXlogList] = useState<{ time: number; elapsed: number; service: string; txid: string; agent: string }[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  // 기간 선택이 60분 초과(히스토리 모드)일 때 날짜×에이전트 조합을 병렬로 조회
  useEffect(() => {
    const isHistorical = selectedRangeMs > 60 * 60 * 1000;
    if (!isHistorical || !selectedAgent) {
      setHistoricalPoints(null);
      return;
    }
    const targetHashes = selectedAgent.objHash === 'ALL_JVM'
      ? agents.filter(a => a.objType !== 'linux' && a.objType !== 'windows').map(a => a.objHash)
      : [selectedAgent.objHash];
    if (targetHashes.length === 0) {
      setHistoricalPoints([]);
      return;
    }
    let cancelled = false;
    async function fetchHistorical() {
      setHistoricalLoading(true);
      const agentMap: Record<string, string> = {};
      agents.forEach(a => { agentMap[a.objHash] = a.objName; });

      const end = Date.now();
      const start = end - selectedRangeMs;
      const dayMs = 24 * 60 * 60 * 1000;

      const jobs: { yyyymmdd: string; dayStart: number; dayEnd: number; hash: string }[] = [];
      for (let day = start - (start % dayMs); day <= end; day += dayMs) {
        const d = new Date(day);
        const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
        const dayStart = Math.max(day, start);
        const dayEnd = Math.min(day + dayMs - 1, end);
        targetHashes.forEach(hash => jobs.push({ yyyymmdd, dayStart, dayEnd, hash }));
      }

      const results = await Promise.all(
        jobs.map(job => scouterApi.searchXlog(job.yyyymmdd, job.dayStart, job.dayEnd, job.hash))
      );
      if (cancelled) return;

      const collected: { time: number; elapsed: number; service: string; txid: string; agent: string }[] = [];
      results.forEach(result => {
        const xlogs = Array.isArray(result) ? result : result?.xlogs;
        if (Array.isArray(xlogs)) {
          xlogs.forEach((x: any) => {
            collected.push({
              time: Number(x.endTime),
              elapsed: Number(x.elapsed),
              service: x.service,
              agent: agentMap[x.objHash] || x.objHash,
              txid: x.txid,
            });
          });
        }
      });

      setHistoricalPoints(collected.slice(0, 3000));
      setHistoricalLoading(false);
    }
    fetchHistorical();
    return () => { cancelled = true; };
  }, [selectedRangeMs, selectedAgent, agents]);
  // nowTick: 2초마다 현재 시각 갱신 (XLog 시간축을 트래픽 유무와 무관하게 흐르게 함)
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  // 1. 에이전트 목록 5초마다 갱신 (죽은 에이전트는 자동 제외)
  useEffect(() => {
    async function fetchAgents() {
      const data = await scouterApi.getAgents();
      if (data && Array.isArray(data)) {
        const aliveAgents = data.filter((a: Agent) => a.alive);
        setAgents(aliveAgents);
        setSelectedAgent(prev => {
          if (prev && (prev.objHash === 'ALL_JVM' || aliveAgents.some((a: Agent) => a.objHash === prev.objHash))) return prev;
          return aliveAgents.length > 0 ? aliveAgents[0] : null;
        });
      }
    }
    fetchAgents();
    const interval = setInterval(fetchAgents, 5000);
    return () => clearInterval(interval);
  }, []);

  // 2. Heap Used 차트 렌더링 루프 (전체 JVM 선택 시 JVM별 개별 라인 + 범례)
  useEffect(() => {
    if (!cpuChartRef.current) return;
    if (!cpuChartIns.current) {
      cpuChartIns.current = echarts.init(cpuChartRef.current, 'dark', { backgroundColor: 'transparent' });
    }
    const names = Object.keys(heapSeries);
    const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa', '#22d3ee', '#f472b6'];
    const series = names.map((name, i) => ({
      name,
      data: heapSeries[name],
      type: 'line',
      smooth: true,
      showSymbol: false,
      itemStyle: { color: palette[i % palette.length] },
      ...(names.length === 1 ? {
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(16, 185, 129, 0.5)' },
            { offset: 1, color: 'rgba(16, 185, 129, 0)' }
          ])
        }
      } : {}),
    }));
    cpuChartIns.current.setOption({
      grid: { top: names.length > 1 ? 50 : 30, bottom: 30, left: 50, right: 20 },
      legend: names.length > 1 ? { top: 4, textStyle: { color: '#9ca3af', fontSize: 11 } } : undefined,
      tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
      xAxis: { type: 'category', data: timeLabels, axisLine: { lineStyle: { color: '#4b5563' } } },
      yAxis: { type: 'value', name: 'MB', splitLine: { lineStyle: { color: '#374151' } } },
      series,
    });
  }, [heapSeries, timeLabels]);
  // 3. 2초마다 Heap Used 폴링 (선택된 에이전트 기준, "전체" 선택 시 JVM별로 개별 추적)
  useEffect(() => {
    if (!selectedAgent) return;
    const targetAgents = selectedAgent.objHash === 'ALL_JVM'
      ? agents.filter(a => a.objType !== 'linux' && a.objType !== 'windows')
      : [selectedAgent];
    if (targetAgents.length === 0) return;
    const targetHash = targetAgents.map(a => a.objHash).join(',');
    setHeapSeries(prev => {
      const next: Record<string, number[]> = {};
      targetAgents.forEach(a => {
        next[a.objName] = prev[a.objName] ?? new Array(10).fill(0);
      });
      return next;
    });
    const interval = setInterval(async () => {
      const data = await scouterApi.getHeapUsed(targetHash);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const valueByHash: Record<string, number> = {};
      if (Array.isArray(data)) {
        data.forEach((d: any) => { valueByHash[d.objHash] = Number(d.value || 0); });
      }
      setHeapSeries(prev => {
        const next: Record<string, number[]> = {};
        targetAgents.forEach(a => {
          const arr = prev[a.objName] ?? new Array(10).fill(0);
          const v = valueByHash[a.objHash] ?? 0;
          next[a.objName] = [...arr.slice(1), Number(v.toFixed(1))];
        });
        return next;
      });
      setTimeLabels(prev => [...prev.slice(1), timeStr]);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedAgent, agents]);
  // 3.5 GC Count 폴링 (선택된 에이전트 기준, "전체" 선택 시 모든 JVM 합산)
  useEffect(() => {
    if (!selectedAgent) return;
    const targetHash = selectedAgent.objHash === 'ALL_JVM'
      ? agents.filter(a => a.objType !== 'linux' && a.objType !== 'windows').map(a => a.objHash).join(',')
      : selectedAgent.objHash;
    if (!targetHash) return;
    const interval = setInterval(async () => {
      const data = await scouterApi.getGcCount(targetHash);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      const realGcValue = Array.isArray(data) ? data.reduce((sum: number, d: any) => sum + Number(d.value || 0), 0) : 0;
      setGcData(prev => [...prev.slice(1), realGcValue]);
      setGcTimeLabels(prev => [...prev.slice(1), timeStr]);
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedAgent, agents]);

  // 3.6 XLog 폴링 (선택된 에이전트 기준, "전체" 선택 시 모든 JVM 합산)
  useEffect(() => {
    if (!selectedAgent) return;
    const targetHash = selectedAgent.objHash === 'ALL_JVM'
      ? agents.filter(a => a.objType !== 'linux' && a.objType !== 'windows').map(a => a.objHash).join(',')
      : selectedAgent.objHash;
    if (!targetHash) return;
    const interval = setInterval(async () => {
      const data = await scouterApi.getXLog(targetHash);
      const xlogs = data?.result?.xlogs;
      if (Array.isArray(xlogs) && xlogs.length > 0) {
        const newPoints = xlogs.map((x: any) => ({
          time: Number(x.endTime),
          elapsed: Number(x.elapsed),
          txid: x.txid,
          service: x.service,
          agent: x.objName
        }));
        setXlogPoints(prev => [...prev, ...newPoints].slice(-100));
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [selectedAgent, agents]);
  // 4. GC Count 차트 렌더링 (실시간)
  useEffect(() => {
    if (!gcChartRef.current) return;
    if (!gcChartIns.current) {
      gcChartIns.current = echarts.init(gcChartRef.current, 'dark', { backgroundColor: 'transparent' });
    }
    gcChartIns.current.setOption({
      grid: { top: 30, bottom: 30, left: 40, right: 20 },
      xAxis: { type: 'category', data: gcTimeLabels, axisLine: { lineStyle: { color: '#4b5563' } } },
      yAxis: { type: 'value', splitLine: { lineStyle: { color: '#374151' } } },
      series: [{ data: gcData, type: 'bar', itemStyle: { color: '#10b981' } }]
    });
  }, [gcData, gcTimeLabels]);
  // 5. XLog 차트 렌더링 (실시간 또는 히스토리, x축: 시각, y축: 응답시간 ms, 드래그로 다중 선택)
  useEffect(() => {
    if (!xlogChartRef.current) return;
    if (!xlogChartIns.current) {
      xlogChartIns.current = echarts.init(xlogChartRef.current, 'dark', { backgroundColor: 'transparent' });
    }
    const chart = xlogChartIns.current;
    const displayPoints = historicalPoints ?? xlogPoints;
    const chartMax = historicalPoints ? Date.now() : nowTick;
    const chartMin = chartMax - selectedRangeMs;

    function openProfile(time: number, txid: string) {
      const kstDate = new Date(time + 9 * 60 * 60 * 1000);
      const yyyymmdd = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
      setProfileLoading(true);
      setProfileData(null);
      scouterApi.getProfile(yyyymmdd, txid).then((data) => {
        setProfileData(data);
        setProfileLoading(false);
      });
    }

    chart.setOption({
      grid: { top: 20, bottom: 30, left: 50, right: 20 },
      xAxis: { type: 'time', min: chartMin, max: chartMax, axisLine: { lineStyle: { color: '#4b5563' } } },
      yAxis: { type: 'value', name: 'ms', splitLine: { lineStyle: { color: '#374151' } } },
      tooltip: {
        trigger: 'item',
        formatter: (p: any) => `${new Date(p.data[0]).toLocaleString("ko-KR", { hour12: false })}<br/>${p.data[2]}<br/>${p.data[1]} ms`
      },
      brush: {
        toolbox: ['rect', 'clear'],
        xAxisIndex: 0,
        throttleType: 'debounce',
        throttleDelay: 200,
        outOfBrush: { colorAlpha: 0.15 },
      },
      series: [{
        symbolSize: 6,
        data: displayPoints.map(p => [p.time, p.elapsed, p.service, p.txid]),
        type: 'scatter',
        itemStyle: { color: '#f59e0b' }
      }]
    });

    chart.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'brush',
      brushOption: { brushType: 'rect', brushMode: 'single' },
    });

    chart.off('click');
    chart.on('click', (params: any) => {
      openProfile(params.data[0], params.data[3]);
    });

    chart.off('brushSelected');
    chart.on('brushSelected', (params: any) => {
      const batch = params.batch && params.batch[0];
      const indices: number[] = (batch && batch.selected && batch.selected[0] && batch.selected[0].dataIndex) || [];
      if (indices.length === 0) {
        setSelectedXlogList([]);
        return;
      }
      const list = indices
        .map(i => displayPoints[i])
        .filter(Boolean)
        .sort((a, b) => b.time - a.time);
      setSelectedXlogList(list);
    });
  }, [xlogPoints, nowTick, historicalPoints, selectedRangeMs]);
  // 6. Topology 데이터 10초마다 폴링 (에이전트 간 호출 관계)
  useEffect(() => {
    if (agents.length === 0) return;
    async function fetchTopology() {
      const objHashes = agents.map(a => a.objHash).join(',');
      const data = await scouterApi.getTopology(objHashes);
      if (Array.isArray(data)) setInteractions(data);
    }
    fetchTopology();
    const interval = setInterval(fetchTopology, 10000);
    return () => clearInterval(interval);
  }, [agents]);

  // 7. Topology 그래프 렌더링 (초기 force 배치 후 위치 고정)
  useEffect(() => {
    if (!topologyChartRef.current) return;
    if (activeTab !== 'topology') return;
    if (!topologyChartIns.current) {
      topologyChartIns.current = echarts.init(topologyChartRef.current, 'dark', { backgroundColor: 'transparent' });
    }
    const chart = topologyChartIns.current;
    const agentMap: Record<string, Agent> = {};
    agents.forEach(a => { agentMap[a.objHash] = a; });

    const nodeMap: Record<string, any> = {};
    const edges: any[] = [];

    function ensureNode(id: string, name: string, category: string) {
      if (!nodeMap[id]) {
        nodeMap[id] = { id, name, category, symbolSize: category === 'CLIENT' ? 34 : 46, value: 0 };
      }
      return nodeMap[id];
    }

    interactions.forEach((it: any) => {
      const count = Number(it.count || 0);
      const errorCount = Number(it.errorCount || 0);
      const totalElapsed = Number(it.totalElapsed || 0);
      const period = Number(it.period || 30);
      const avgElapsed = count > 0 ? (totalElapsed / count).toFixed(1) : '0.0';
      const errRate = count > 0 ? ((errorCount / count) * 100).toFixed(1) : '0.0';
      const speed = (count / period).toFixed(2);

      let sourceId: string, sourceName: string, sourceCat: string;
      let targetId: string, targetName: string, targetCat: string;

      if (it.interactionType === 'INTR_NORMAL_INCOMING') {
        sourceId = `CLIENT_${it.toObjHash}`;
        sourceName = 'OUTSIDE';
        sourceCat = 'CLIENT';
        targetId = it.toObjHash;
        targetName = it.toObjName;
        const agentType = agentMap[it.toObjHash]?.objType;
        targetCat = agentType === 'linux' || agentType === 'windows' ? 'HOST' : 'JVM';
      } else if (it.interactionType === 'INTR_DB_CALL') {
        sourceId = it.fromObjHash;
        sourceName = it.fromObjName;
        sourceCat = 'JVM';
        targetId = it.toObjHash;
        targetName = (it.toObjName || '').split('?')[0];
        targetCat = 'DB';
      } else {
        sourceId = it.fromObjHash;
        sourceName = it.fromObjName;
        sourceCat = agentMap[it.fromObjHash] ? 'JVM' : 'EXTERNAL';
        targetId = it.toObjHash;
        targetName = it.toObjName;
        targetCat = agentMap[it.toObjHash] ? 'JVM' : 'EXTERNAL';
      }

      ensureNode(sourceId, sourceName, sourceCat);
      ensureNode(targetId, targetName, targetCat);

      edges.push({
        source: sourceId,
        target: targetId,
        value: count,
        lineStyle: {
          width: Math.min(1 + count / 5, 6),
          color: errorCount > 0 ? '#ef4444' : '#60a5fa',
          curveness: 0.2,
        },
        label: {
          show: true,
          formatter: `${speed}/s  ${errRate}%  ${avgElapsed}ms`,
          fontSize: 10,
          color: '#d1d5db',
        },
        symbol: ['none', 'arrow'],
        symbolSize: 8,
        effect: {
          show: count > 0,
          period: 3,
          trailLength: 0.3,
          symbolSize: 5,
          color: '#fbbf24',
        },
      });
    });

    const categoryOrder = ['CLIENT', 'JVM', 'HOST', 'DB', 'EXTERNAL'];
    const categoryColors: Record<string, string> = {
      CLIENT: '#22c55e',
      JVM: '#f59e0b',
      HOST: '#38bdf8',
      DB: '#818cf8',
      EXTERNAL: '#9ca3af',
    };
    const catIndex: Record<string, number> = {};
    categoryOrder.forEach((name, i) => { catIndex[name] = i; });
    const categories = categoryOrder.map(name => ({ name, itemStyle: { color: categoryColors[name] } }));

    const allIds = Object.keys(nodeMap);
    const hasAllPositions = allIds.length > 0 && allIds.every(id => nodePositions.current[id]);

    const nodes = Object.values(nodeMap).map((n: any) => {
      const pos = nodePositions.current[n.id];
      return {
        ...n,
        catName: n.category,
        category: catIndex[n.category] ?? categoryOrder.length,
        itemStyle: { color: categoryColors[n.category] || '#9ca3af' },
        label: {
          show: true,
          formatter: (params: any) => `${params.data.catName}\n${params.data.name}`,
          color: '#e5e7eb',
          fontSize: 11,
          position: 'bottom',
        },
        ...(pos ? { x: pos.x, y: pos.y, fixed: true } : {}),
      };
    });

    chart.setOption({
      tooltip: {},
      legend: {
        data: categoryOrder,
        top: 4,
        left: 4,
        textStyle: { color: '#9ca3af', fontSize: 11 },
        itemWidth: 12,
        itemHeight: 12,
      },
      series: [{
        type: 'graph',
        layout: hasAllPositions ? 'none' : 'force',
        roam: true,
        draggable: true,
        categories,
        force: { repulsion: 220, edgeLength: 140, gravity: 0.15 },
        data: nodes,
        edges,
        emphasis: { focus: 'adjacency', lineStyle: { width: 8 } },
      }],
    });

    function captureAllPositions() {
      const seriesData = chart.getModel().getSeriesByIndex(0)?.getData();
      if (!seriesData) return;
      seriesData.each((idx: number) => {
        const raw = seriesData.getRawDataItem(idx);
        const layout = seriesData.getItemLayout(idx);
        if (raw && layout) {
          nodePositions.current[raw.id] = { x: layout[0], y: layout[1] };
        }
      });
    }

    chart.off('finished');
    chart.on('finished', captureAllPositions);

    chart.off('dragend');
    chart.on('dragend', (params: any) => {
      if (params.dataType === 'node') {
        const layout = chart.getModel().getSeriesByIndex(0).getData().getItemLayout(params.dataIndex);
        if (layout) {
          nodePositions.current[params.data.id] = { x: layout[0], y: layout[1] };
        }
      }
    });
  }, [interactions, agents, activeTab]);
  useEffect(() => {
    if (activeTab === 'topology') {
      setTimeout(() => topologyChartIns.current?.resize(), 0);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <span className="text-xl font-bold tracking-wider text-blue-400">SCOUTER PAPER v3.0</span>
          <span className="bg-gray-700 text-xs px-2 py-0.5 rounded text-gray-300">OSS</span>
        </div>
        <div className="text-sm text-gray-400">
          Server: <span className="text-green-400 font-mono">{import.meta.env.VITE_SERVER_LABEL || 'localhost'}</span>
        </div>
      </header>
      <div className="bg-gray-800 border-b border-gray-700 px-6 flex space-x-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          대시보드
        </button>
        <button
          onClick={() => setActiveTab('topology')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'topology' ? 'border-blue-400 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
        >
          토폴로지
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 사이드바: 실제 API 데이터 반영 */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4 flex flex-col space-y-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Objects / Agents</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            <div
              onClick={() => setSelectedAgent({ objHash: 'ALL_JVM', objName: '전체 JVM', objType: 'ALL', alive: true })}
              className={`p-2 border rounded cursor-pointer text-sm font-semibold transition-colors ${
                selectedAgent?.objHash === 'ALL_JVM'
                  ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                  : 'hover:bg-gray-700 border-transparent text-gray-300 hover:text-gray-100'
              }`}
            >
              📊 전체 JVM
            </div>
            {agents.length === 0 ? (
              <div className="text-xs text-gray-500 p-2">에이전트를 불러오는 중...</div>
            ) : (
              agents.map(agent => (
                <div
                  key={agent.objHash}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-2 border rounded cursor-pointer text-sm font-medium transition-colors ${
                    selectedAgent?.objHash === agent.objHash
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'hover:bg-gray-700 border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <AgentIcon objType={agent.objType} /> <span className="align-middle">{agent.objName}</span>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* 메인 대시보드 영역 */}
        <main className="flex-1 p-6 overflow-y-auto bg-gray-900">
          <div className={activeTab === 'dashboard' ? 'grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-max' : 'hidden'}>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 h-64 flex flex-col">
            <div className="text-sm font-semibold text-gray-300 mb-2">GC Count / Time</div>
            <div ref={gcChartRef} className="flex-1 w-full" />
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 h-64 flex flex-col">
            <div className="text-sm font-semibold text-gray-300 mb-2">
              Heap Used (MB) {selectedAgent && `- ${selectedAgent.objName}`}
            </div>
            <div ref={cpuChartRef} className="flex-1 w-full" />
          </div>

          <div className={`bg-gray-800 border border-gray-700 rounded-lg p-4 md:col-span-2 flex flex-col ${selectedXlogList.length > 0 ? '' : 'h-72'}`}>
            <div className="text-sm font-semibold text-gray-300 mb-2">XLog (Profile)</div>
            <div className="flex flex-wrap gap-1 mb-2">
              {RANGE_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setSelectedRangeMs(opt.ms)}
                  className={`px-2 py-0.5 text-xs rounded border ${
                    selectedRangeMs === opt.ms
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300'
                      : 'border-gray-700 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              {historicalLoading && <span className="text-xs text-gray-500 ml-2">불러오는 중...</span>}
            </div>
            <div ref={xlogChartRef} className="flex-1 w-full" />
            {selectedXlogList.length > 0 && (
              <div className="mt-2 bg-gray-900 border border-gray-700 rounded p-2 max-h-40 overflow-auto">
                <div className="flex justify-between items-center mb-1">
                  <div className="text-xs text-gray-400">선택된 트랜잭션 ({selectedXlogList.length}건)</div>
                  <button
                    className="text-xs text-gray-500 hover:text-gray-300"
                    onClick={() => setSelectedXlogList([])}
                  >
                    닫기 ✕
                  </button>
                </div>
                <div className="flex justify-between gap-2 text-[10px] text-gray-500 uppercase border-b border-gray-800 pb-1 mb-1">
                  <span className="shrink-0">시각</span>
                  <span className="flex-1">서비스</span>
                  <span className="shrink-0">JVM</span>
                  <span className="shrink-0">응답시간</span>
                </div>
                {selectedXlogList.map((p, i) => (
                  <div
                    key={i}
                    className="flex justify-between gap-2 text-xs text-gray-300 py-0.5 hover:bg-gray-800 cursor-pointer"
                    onClick={() => {
                      const kstDate = new Date(p.time + 9 * 60 * 60 * 1000);
                      const yyyymmdd = kstDate.toISOString().slice(0, 10).replace(/-/g, '');
                      setProfileLoading(true);
                      setProfileData(null);
                      scouterApi.getProfile(yyyymmdd, p.txid).then((data) => {
                        setProfileData(data);
                        setProfileLoading(false);
                      });
                    }}
                  >
                    <span className="text-gray-500 shrink-0">{new Date(p.time).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    <span className="truncate flex-1">{p.service}</span>
                    <span className="text-gray-400 shrink-0 text-xs">{p.agent}</span>
                    <span className="text-amber-300 shrink-0">{p.elapsed}ms</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>
          <div className={activeTab === 'topology' ? 'h-[calc(100vh-140px)]' : 'hidden'}>
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 h-full flex flex-col">
            <div className="text-sm font-semibold text-gray-300 mb-2">Topology</div>
            <div ref={topologyChartRef} className="flex-1 w-full" />
          </div>
          </div>
        </main>
        {(profileLoading || profileData) && (
          <div
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
            onClick={() => { setProfileData(null); setProfileLoading(false); }}
          >
            <div
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 w-3/4 max-h-[80vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm font-semibold text-gray-300">Profile Detail</div>
                <button
                  className="text-gray-400 hover:text-gray-200 text-sm"
                  onClick={() => { setProfileData(null); setProfileLoading(false); }}
                >
                  닫기 ✕
                </button>
              </div>
              {profileLoading ? (
                <div className="text-gray-400 text-sm">불러오는 중...</div>
              ) : (
                <div>
                  <ProfileDetailPanel steps={profileData || []} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
