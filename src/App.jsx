import { empraScore } from './empra.js';
import DisciplinePanel from './DisciplinePanel.jsx';
import { saveLocalDiscipline } from './localJournal.js';
import RiskPanel from './RiskPanel.jsx';
import { localDay, tradeSession } from './risk.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  Database,
  Download,
  Edit3,
  Eye,
  ImageIcon,
  LayoutDashboard,
  LineChart,
  ListChecks,
  Loader2,
  LogIn,
  LogOut,
  Lock,
  Menu,
  Newspaper,
  Plus,
  RefreshCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserPlus,
  WalletCards,
  X,
} from 'lucide-react';
import {
  MAX_LOCAL_SCREENSHOTS,
  clearLocalStore,
  assignLocalTrades,
  exportLocalAutoBackup,
  exportLocalBackup,
  importLocalBackup,
  listLocalAutoBackups,
  loadLocalStore,
  mergeImportedStore,
  writeLocalStore,
  createLocalAutoBackup,
  normalizeStore,
  requestPersistentStorage,
  restoreLocalAutoBackup,
  saveLocalAccounts,
  saveLocalItem,
  saveLocalPlaybooks,
  saveLocalSettings,
  saveLocalTrade,
  saveLocalTradeBatch,
  deleteLocalTrade,
} from './localJournal.js';
import {
  SESSION_OPTIONS,
  analyticsBreakdowns,
  calculateAdvancedStats,
  calendarStats,
  crossAnalysisMatrix,
  dataQualityReport,
  distributionBuckets,
  edgeSummary,
  equityPointsByPeriod,
  filterTrades,
  focusAreas,
  holdingTimeBreakdown,
  normalizeReviewStatus,
  normalizeTags,
  plannedVsActualStats,
  reviewQueue,
  timeOfDayBreakdown,
} from './analytics.js';
import {
  DIRECTIONS,
  OUTCOMES,
  RATINGS,
  buildJournalDraft,
  calculateStats,
  generateFollowups,
  JOURNAL_TEMPLATES,
  applyJournalTemplate,
  normalizeOutcome,
  normalizeRR,
  normalizeTimeInput,
  parseMoney,
  validateTrade,
} from './journalRules.js';
import { importNotionTrades, testNotionConnection } from './notionClient.js';

const today = new Date().toISOString().slice(0, 10);
const MAX_UPLOAD_IMAGE_BYTES = 20 * 1024 * 1024;

const emptyTrade = () => ({
  date: localDay(),
  asset: 'MNQ',
  account: 'Personal',
  direction: 'Short',
  outcome: 'Win',
  pnl: '',
  rr: '1.5',
  rating: 'A',
  strategy: 'NY AM Model',
  session: 'NY AM',
  entryTime: '',
  exitTime: '',
  playbookId: '',
  playbookName: '',
  setupName: '',
  entryReason: '',
  exitReason: '',
  plannedTarget: '',
  plannedStop: '',
  actualExit: '',
  followedPlanScore: '',
  lesson: '',
  setupTags: [],
  mistakeTags: [],
  emotion: '',
  tags: [],
  reviewStatus: 'needs_review',
  note: '',
  reviewed: false,
});

const tabs = [
  { id: 'discipline', label: 'Discipline', Icon: ListChecks },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'log', label: 'Trade Log', Icon: BookOpen },
  { id: 'capture', label: 'Add Trade', Icon: Plus },
  { id: 'reports', label: 'Analytics', Icon: BarChart3 },
  { id: 'risk', label: 'Risk Management', Icon: Shield },
  { id: 'accounts', label: 'Accounts', Icon: WalletCards },
  { id: 'playbooks', label: 'Playbooks', Icon: ListChecks },
  { id: 'daily', label: 'Daily Journal', Icon: CalendarDays },
  { id: 'settings', label: 'Settings', Icon: Settings },
];
const visibleTabIds = new Set(tabs.map(t=>t.id));

const defaultTradingRules = [
  'Mark draw on liquidity before entry',
  'Wait for sweep + displacement',
  'Move stop only when structure changes',
  'No chase after missed fill',
];

function normalizeDashboardRules(rules = []) {
  const list = Array.isArray(rules) && rules.length ? rules : defaultTradingRules;
  return list
    .map((rule, index) => {
      if (typeof rule === 'string') return { id: `rule-${index}`, text: rule, checked: false };
      return {
        id: rule.id || `rule-${index}`,
        text: String(rule.text || '').trim(),
        checked: Boolean(rule.checked),
      };
    })
    .filter((rule) => rule.text);
}

const reviewSectionLabels = ['Trade Summary', 'Setup', 'Execution', 'Psychology', 'News', 'What Worked', 'What To Improve'];

const publicNav = [
  { label: 'Product', target: 'product' },
  { label: 'Features', target: 'features' },
  { label: 'Workflow', target: 'workflow' },
  { label: 'Pricing', target: 'pricing' },
  { label: 'FAQ', target: 'faq' },
];

const previewTabs = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    eyebrow: 'Performance Review',
    title: 'See the day clearly before it becomes a blur.',
    body: 'Track net P&L, win rate, average RR, and your equity curve from the trades you actually reviewed.',
  },
  {
    id: 'log',
    label: 'Trade Log',
    eyebrow: 'Screenshot Context',
    title: 'Every execution stays attached to the story.',
    body: 'Review entries with screenshots, outcomes, notes, and review status without digging through separate tools.',
  },
  {
    id: 'daily',
    label: 'Daily Review',
    eyebrow: 'Session Prep',
    title: 'Turn the trading day into a repeatable process.',
    body: 'Capture bias, emotions, news, and symbols before and after the session so your review has context.',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    eyebrow: 'Pattern Work',
    title: 'Find what worked, what failed, and what to focus on next.',
    body: 'Write structured weekly reviews that connect behavior to outcome instead of leaving lessons scattered.',
  },
];

const marqueeItems = [
  'Screenshot-first capture',
  'Smart review prompts',
  'Trade log',
  'Equity curve',
  'Daily journal',
  'Analysis notes',
  'Private accounts',
  'Multiple screenshots',
];

const workflowSteps = [
  ['01', 'Capture screenshot', 'Drop execution screenshots before the memory fades.'],
  ['02', 'Fill trade ticket', 'Add date, asset, outcome, P&L, RR, account, and rating.'],
  ['03', 'Dump messy notes', 'Write the raw truth without formatting it first.'],
  ['04', 'Answer useful prompts', 'Only the relevant follow-up questions appear.'],
  ['05', 'Review patterns', 'Track the trades, stats, and lessons that keep repeating.'],
];

const faqItems = [
  ['Is this template free to run?', 'Yes. It runs locally and has no payment setup.'],
  ['Do I need an account?', 'No. The journal opens directly on your computer.'],
  ['Where is my data stored?', 'Trades and screenshots are saved in this browser on this computer.'],
  ['Are screenshots private?', 'Yes. Nothing is uploaded by this local template.'],
  ['Is this AI?', 'The current review helper is rule-based. It organizes your notes without inventing trade details.'],
  ['Can I export my data?', 'Yes. Export a ZIP backup from Settings.'],
];

function appPath(path) {
  return path || '/';
}

function scrollToPublicSection(target) {
  window.setTimeout(() => {
    const element = document.getElementById(target);
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.scrollY - 88;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, 80);
}

function money(value) {
  const number = Number(value || 0);
  return `${number >= 0 ? '+' : '-'}$${Math.abs(number).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function ratio(value) {
  return Number.isFinite(value) ? Number(value || 0).toFixed(2) : '∞';
}

function minutesLabel(value) {
  const minutes = Math.round(Number(value || 0));
  if (!minutes) return '0m';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function shotSrc(shot) {
  return shot?.dataUrl || shot?.url || '';
}

function isTemporaryExternalScreenshot(shot) {
  const url = shot?.externalUrl || shot?.url || '';
  return Boolean(url)
    && !shot?.dataUrl
    && !shot?.storagePath
    && (/prod-files-secure\.s3/iu.test(url) || /X-Amz-(Date|Expires|Signature)/u.test(url));
}

function screenshotFallbackLabel(shot, fallback = 'Screenshot unavailable') {
  if (isTemporaryExternalScreenshot(shot)) return 'Screenshot link expired';
  return shot?.name || fallback;
}

function ScreenshotImage({ shot = null, src = '', alt, fallbackLabel = '', className = '', fallbackClassName = '', iconSize = 26 }) {
  const initialSrc = src || shotSrc(shot);
  const [liveSrc, setLiveSrc] = useState(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLiveSrc(initialSrc);
    setFailed(false);
  }, [initialSrc, shot?.storagePath]);

  async function refreshOrFail() {
    setFailed(true);
  }

  if (!liveSrc || failed) {
    return (
      <div className={`screenshot-fallback ${fallbackClassName || className}`}>
        <ImageIcon size={iconSize} />
        <span>{fallbackLabel || alt || 'Screenshot unavailable'}</span>
      </div>
    );
  }

  return <img className={className} src={liveSrc} alt={alt} onError={refreshOrFail} />;
}

function primaryShot(trade, allowFallback = false) {
  const shots = trade.screenshots || [];
  const explicit = shots.find((shot) => shot.id === trade.primaryScreenshotId);
  if (explicit && explicit.kind !== 'news') return explicit;
  return shots.find((shot) => !shot.kind || shot.kind === 'execution')
    || shots.find((shot) => shot.kind !== 'news')
    || (allowFallback ? shots[0] : null);
}

function newsShots(trade) {
  const ids = new Set(trade.newsScreenshotIds || []);
  return (trade.screenshots || []).filter((shot) => shot.kind === 'news' || ids.has(shot.id));
}

function isPlaceholderRecord(trade) {
  const title = String(trade.title || '').trim().toLowerCase();
  const note = String(trade.note || '').trim().toLowerCase();
  const outcome = normalizeOutcome(trade);
  const pnl = String(trade.pnl ?? '').trim();
  const hasTradeResult = ['Win', 'Loss', 'BE', 'Missed'].includes(outcome) || Boolean(pnl);
  const hasScreenshots = Boolean((trade.screenshots || []).length);
  const hasUsableNote = note && note !== 'img' && note.length >= 12;
  const importedImageShell = title === 'img' && !hasScreenshots && !hasUsableNote;
  return importedImageShell || (title === 'img'
    && !hasTradeResult
    && !hasScreenshots
    && !hasUsableNote);
}

function isTradeRecord(trade) {
  const outcome = normalizeOutcome(trade);
  const pnl = String(trade.pnl ?? '').trim();
  const title = String(trade.title || '').toLowerCase();
  if (isPlaceholderRecord(trade)) return false;
  if (!pnl && /\b(weekly review|daily report|no trade)\b/u.test(title)) return false;
  return ['Win', 'Loss', 'BE', 'Missed'].includes(outcome) || Boolean(pnl);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file, maxWidth = 2200, quality = 0.82) {
  const dataUrl = await readFileAsDataUrl(file);
  if (!file.type.startsWith('image/') || typeof Image === 'undefined') {
    return { dataUrl, type: file.type, size: file.size, name: file.name };
  }
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        resolve({ dataUrl, type: file.type, size: file.size, name: file.name });
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      const preferredType = canvas.toDataURL('image/webp', quality).startsWith('data:image/webp')
        ? 'image/webp'
        : 'image/jpeg';
      const nextDataUrl = canvas.toDataURL(preferredType, quality);
      resolve({
        dataUrl: nextDataUrl,
        type: preferredType,
        size: Math.round((nextDataUrl.length * 3) / 4),
        name: file.name.replace(/\.[a-z0-9]+$/iu, preferredType === 'image/webp' ? '.webp' : '.jpg'),
      });
    };
    image.onerror = () => resolve({ dataUrl, type: file.type, size: file.size, name: file.name });
    image.src = dataUrl;
  });
}

function StatCard({ label, value, tone = 'neutral', sub, Icon }) {
  return (
    <div className={`metric-card ${tone}`}>
      <span className="metric-icon">{Icon && <Icon size={18} />}</span>
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function Notice({ tone = 'default', children }) {
  const Icon = tone === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`notice ${tone}`}>
      <Icon size={17} />
      <span>{children}</span>
    </div>
  );
}

const equityPeriodOptions = [
  ['daily', 'Daily'],
  ['weekly', 'Weekly'],
  ['monthly', 'Monthly'],
  ['total', 'Total'],
];

const equityPeriodNouns = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  total: 'trade',
};

function MiniChart({ trades }) {
  const [period, setPeriod] = useState('daily');
  const [hoverPoint, setHoverPoint] = useState(null);
  const chartRef = useRef(null);
  const points = useMemo(() => equityPointsByPeriod(trades, period), [trades, period]);
  const periodNoun = equityPeriodNouns[period] || 'period';
  const latestPoint = points.at(-1) || null;
  const bestPoint = points.slice().sort((a, b) => b.pnl - a.pnl)[0] || null;
  const worstPoint = points.slice().sort((a, b) => a.pnl - b.pnl)[0] || null;
  const losingPoint = worstPoint && worstPoint.pnl < 0 ? worstPoint : null;
  const displayPoint = hoverPoint || latestPoint;
  const displayValue = period === 'total' ? displayPoint?.value || 0 : displayPoint?.pnl || 0;
  const chartColor = 'var(--accent)';
  const width = 720;
  const height = 260;
  const values = points.map((point) => point.value).concat([0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chartPoints = points.map((point) => {
    const x = points.length === 1 ? width / 2 : (point.index / (points.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return { ...point, x, y };
  });
  const d = chartPoints.length === 1
    ? `M ${Math.max(0, chartPoints[0].x - 42).toFixed(1)} ${chartPoints[0].y.toFixed(1)} L ${Math.min(width, chartPoints[0].x + 42).toFixed(1)} ${chartPoints[0].y.toFixed(1)}`
    : chartPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const linePath = d || `M 0 ${height} L ${width} ${height}`;
  const fillPath = d ? `${d} L ${width} ${height} L 0 ${height} Z` : '';
  const hoverTooltip = hoverPoint ? {
    x: Math.max(8, Math.min(width - 190, hoverPoint.x + 16)),
    y: Math.max(8, Math.min(height - 62, hoverPoint.y < 78 ? hoverPoint.y + 20 : hoverPoint.y - 70)),
    width: 182,
    height: 54,
  } : null;

  useEffect(() => {
    if (!hoverPoint) return undefined;
    function clearHoverWhenOutside(event) {
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) return;
      const isOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
      if (isOutside) setHoverPoint(null);
    }
    window.addEventListener('mousemove', clearHoverWhenOutside);
    return () => window.removeEventListener('mousemove', clearHoverWhenOutside);
  }, [hoverPoint]);

  function interpolatedHoverPoint(x) {
    if (!chartPoints.length) return null;
    const clampedX = Math.max(0, Math.min(width, x));
    if (chartPoints.length === 1) {
      return { nearest: chartPoints[0], x: clampedX, y: chartPoints[0].y };
    }
    const rightIndex = chartPoints.findIndex((point) => point.x >= clampedX);
    const right = rightIndex === -1 ? chartPoints.at(-1) : chartPoints[rightIndex];
    const left = rightIndex <= 0 ? right : chartPoints[rightIndex - 1];
    const span = right.x - left.x || 1;
    const ratio = Math.max(0, Math.min(1, (clampedX - left.x) / span));
    const y = left.y + ((right.y - left.y) * ratio);
    const nearest = Math.abs(left.x - clampedX) <= Math.abs(right.x - clampedX) ? left : right;
    return { nearest, x: clampedX, y };
  }

  function updateHoverPoint(event) {
    if (!chartPoints.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const hover = interpolatedHoverPoint(x);
    if (!hover) return;
    setHoverPoint({ ...hover.nearest, x: hover.x, y: hover.y });
  }

  function changePeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setHoverPoint(null);
  }

  return (
    <div className="chart-card">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Equity Curve</span>
          <h2>Cumulative P&L</h2>
        </div>
        <div className="chart-actions">
          <div className="period-toggle" role="group" aria-label="Cumulative P&L period">
            {equityPeriodOptions.map(([value, label]) => (
              <button
                className={period === value ? 'active' : ''}
                key={value}
                type="button"
                onClick={() => changePeriod(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <strong className={`pnl-amount ${displayValue >= 0 ? 'green' : 'red'}`}>{money(displayValue)}</strong>
        </div>
      </div>
      <svg
        ref={chartRef}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Cumulative P&L chart"
        onMouseMove={updateHoverPoint}
        onPointerMove={updateHoverPoint}
        onMouseLeave={() => setHoverPoint(null)}
        onPointerLeave={() => setHoverPoint(null)}
        onMouseOut={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHoverPoint(null);
        }}
      >
        <defs>
          <linearGradient id="curveFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartColor} stopOpacity="0.38" />
            <stop offset="100%" stopColor={chartColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {fillPath && <path className="equity-fill" d={fillPath} fill="url(#curveFill)" />}
        <path className="equity-line" d={linePath} fill="none" stroke={chartColor} strokeWidth="4" strokeLinecap="round" />
        {hoverPoint && <line className="equity-guide" x1={hoverPoint.x} x2={hoverPoint.x} y1="0" y2={height} />}
        {hoverPoint && (
          <>
            <g className="equity-hover" transform={`translate(${hoverPoint.x} ${hoverPoint.y})`}>
              <circle className="equity-hover-halo" r="12" />
              <circle className="equity-hover-dot" r="5" />
            </g>
            {hoverTooltip && (
              <g className="equity-tooltip">
                <rect x={hoverTooltip.x} y={hoverTooltip.y} width={hoverTooltip.width} height={hoverTooltip.height} rx="12" />
                <text
                  className={`equity-tooltip-value ${hoverPoint.pnl >= 0 ? 'green' : 'red'}`}
                  x={hoverTooltip.x + 12}
                  y={hoverTooltip.y + 22}
                >
                  {money(hoverPoint.pnl)}
                </text>
                <text
                  className="equity-tooltip-meta"
                  x={hoverTooltip.x + 12}
                  y={hoverTooltip.y + 41}
                >
                  {hoverPoint.label} · Cum {money(hoverPoint.value)}
                </text>
              </g>
            )}
          </>
        )}
      </svg>
      <div className="chart-summary-grid">
        <div>
          <span>Total P&L</span>
          <strong className={(latestPoint?.value || 0) >= 0 ? 'green' : 'red'}>{money(latestPoint?.value || 0)}</strong>
          <small>{points.length} {periodNoun}{points.length === 1 ? '' : 's'} shown</small>
        </div>
        <div>
          <span>Latest {periodNoun}</span>
          <strong className={(latestPoint?.pnl || 0) >= 0 ? 'green' : 'red'}>{latestPoint ? money(latestPoint.pnl) : '$0'}</strong>
          {latestPoint && <small>{latestPoint.label}</small>}
        </div>
        <div>
          <span>Best {periodNoun}</span>
          <strong className="green">{bestPoint ? money(bestPoint.pnl) : '$0'}</strong>
          {bestPoint && <small>{bestPoint.label}</small>}
        </div>
        <div>
          <span>{losingPoint ? `Worst ${periodNoun}` : `Losing ${periodNoun}`}</span>
          <strong className={losingPoint ? 'red' : 'green'}>{losingPoint ? money(losingPoint.pnl) : 'None'}</strong>
          {losingPoint ? <small>{losingPoint.label}</small> : <small>No negative {periodNoun} in this view</small>}
        </div>
      </div>
    </div>
  );
}

function TradingRulesPanel({ rules = [], onSave }) {
  const [draft, setDraft] = useState(normalizeDashboardRules(rules));

  useEffect(() => {
    setDraft(normalizeDashboardRules(rules));
  }, [rules]);

  function commit(next) {
    const cleaned = normalizeDashboardRules(next);
    setDraft(cleaned);
    onSave(cleaned);
  }

  function updateRule(ruleId, patch, shouldCommit = false) {
    setDraft((current) => {
      const next = current.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule);
      if (shouldCommit) onSave(normalizeDashboardRules(next));
      return next;
    });
  }

  function addRule() {
    const next = draft.concat({ id: `rule-${Date.now()}`, text: '', checked: false });
    setDraft(next);
  }

  function removeRule(ruleId) {
    const next = draft.filter((rule) => rule.id !== ruleId);
    commit(next.length ? next : defaultTradingRules);
  }

  return (
    <section className="panel trading-rules-card">
      <div className="panel-head compact-head">
        <div>
          <span className="eyebrow">Daily Checklist</span>
          <h2>Trading Rules</h2>
        </div>
        <button className="secondary small-button" type="button" onClick={addRule}><Plus size={15} /> Add</button>
      </div>
      <div className="editable-rule-list">
        {draft.map((rule) => (
          <div className="editable-rule" key={rule.id}>
            <input
              aria-label={`Complete ${rule.text || 'trading rule'}`}
              checked={rule.checked}
              type="checkbox"
              onChange={(event) => updateRule(rule.id, { checked: event.target.checked }, true)}
            />
            <input
              aria-label="Trading rule text"
              value={rule.text}
              onBlur={() => commit(draft)}
              onChange={(event) => updateRule(rule.id, { text: event.target.value })}
              placeholder="Write your own rule..."
            />
            <button aria-label="Remove trading rule" className="ghost-icon" type="button" onClick={() => removeRule(rule.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard({ trades, accounts, settings, setTab, onSaveSettings, onReview }) {
  const realised=trades.filter(t=>t.realised!==false);
  const {stats,components,score}=empraScore(realised);
  const latest=trades.slice().sort((a,b)=>`${b.date}${b.createdAt||''}`.localeCompare(`${a.date}${a.createdAt||''}`)).slice(0,5);
  const days=calendarStats(realised).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const max=Math.max(1,...days.map(d=>Math.abs(d.netPnl)));
  return <div className="screen-grid empra-dashboard">
    <section className="dashboard-welcome"><div><span className="eyebrow">YOUR PERFORMANCE, IN PERSPECTIVE</span><h1>Every trade tells a story.</h1><p>Review your edge. Build your consistency.</p></div><span className="local-badge"><span/> Local journal · {stats.totalTrades} executions</span></section>
    <section className="metrics-grid performance-cards">
      <StatCard Icon={WalletCards} label="Net P&L" value={money(stats.netPnl)} tone={stats.netPnl>=0?'green':'red'} />
      <StatCard Icon={LineChart} label="Trade Expectancy" value={stats.totalTrades?money(stats.expectancy):'—'} />
      <StatCard Icon={BarChart3} label="Profit Factor" value={stats.totalTrades?(Number.isFinite(stats.profitFactor)?stats.profitFactor.toFixed(2):'∞'):'—'} />
      <StatCard Icon={Target} label="Win Rate" value={stats.decidedTrades?pct(stats.winRate):'—'} sub={`${stats.wins} wins · ${stats.losses} losses`} />
      <StatCard Icon={RefreshCcw} label="Average Win / Loss Ratio" value={stats.losses?stats.payoffRatio.toFixed(2):'—'} />
    </section>
    <div className="empra-charts">
      <section className="panel score-panel"><div className="panel-head"><h2>Empra Score</h2><Target size={18}/></div><div className="score-value">{score===null?'—':score}<small>/ 100</small></div><p>{score===null?'Not enough data':'A balanced view of your trading edge'}</p><svg viewBox="0 0 240 185" role="img" aria-label="Empra score component radar"><polygon points="120,15 220,165 20,165" fill="none" stroke="#393047"/><polygon points="120,50 185,148 55,148" fill="none" stroke="#393047"/><polygon points={components.map((v,i)=>{const p=[[120,15],[220,165],[20,165]][i];return `${120+(p[0]-120)*v/100},${115+(p[1]-115)*v/100}`;}).join(' ')} fill="#a78bfa44" stroke="#b59af8" strokeWidth="2"/></svg><div className="score-components">{['Win rate','Profit factor','Win/loss ratio'].map((label,i)=><span key={label}>{label}<strong>{stats.totalTrades?components[i].toFixed(0)+'%':'—'}</strong></span>)}</div><details><summary>How is this calculated?</summary><p>Minimum 20 realised executions, including 3 wins and 3 losses. Equal average of win rate, profit factor ÷ 2 and average win/loss ratio ÷ 2; each component capped at 100%. An original journal score.</p></details></section>
      <section className="panel cumulative-panel"><h2>Daily Cumulative Net P&L</h2><MiniChart trades={realised}/>{!days.length&&<p className="muted">No realised trades yet.</p>}</section>
      <section className="panel daily-pnl-panel"><h2>Net Daily P&L</h2>{days.length?<div className="daily-bars">{days.map(d=><button key={d.date} aria-label={`${d.date}: ${money(d.netPnl)}`} title={`${d.date}: ${money(d.netPnl)}`} onClick={()=>setTab('reports')}><span className={d.netPnl>=0?'positive-bar':'negative-bar'} style={{height:`${Math.max(2,Math.abs(d.netPnl)/max*46)}%`,[d.netPnl>=0?'bottom':'top']:'50%'}}/><small>{d.date.slice(5)}</small></button>)}</div>:<div className="chart-empty">No realised trades yet.<br/>Your daily results will appear here.</div>}<div className="rule-legend"><span><i className="yes"/>Profit</span><span><i className="no"/>Loss</span></div></section>
    </div>
    <div className="dashboard-bottom"><section className="panel"><div className="panel-head"><h2>Recent Trades</h2><button className="link-button" onClick={()=>setTab('log')}>View all →</button></div>{latest.length?latest.map(t=><button className="recent-execution" key={t.id} onClick={()=>onReview(t)}><span><strong>{t.asset}</strong><small>{t.date} · {t.account}</small></span><strong className={parseMoney(t.pnl)>=0?'green':'red'}>{money(parseMoney(t.pnl))}</strong></button>):<p className="chart-empty">Your first trade starts the story.<br/><button className="secondary" onClick={()=>setTab('capture')}>Add a trade</button></p>}</section><JournalCalendar trades={realised} onReview={onReview}/></div>
    <details className="panel"><summary>More performance metrics</summary><section className="metrics-grid extended-metrics">
      <StatCard Icon={WalletCards} label="Account Balance" value={money(accounts.reduce((sum,a)=>sum+Number(a.startingBalance||0),0)+stats.netPnl)}/>
      <StatCard Icon={Database} label="Today’s Realised P&L" value={money(calculateAdvancedStats(realised.filter(t=>t.date===localDay())).netPnl)}/>
      <StatCard Icon={BarChart3} label="Average Win" value={money(stats.averageWin)}/>
      <StatCard Icon={BarChart3} label="Average Loss" value={money(stats.averageLoss)}/>
      <StatCard Icon={RefreshCcw} label="Avg RR" value={stats.avgRR.toFixed(2)}/>
      <StatCard Icon={BarChart3} label="Max Drawdown" value={money(stats.maxDrawdown)} tone="red"/>
      <StatCard Icon={BookOpen} label="Total Trades" value={stats.totalTrades}/>
    </section><section className="account-strip">{accountSummaries(realised,accounts).map(account=><button className="account-card" key={account.id} onClick={()=>setTab('accounts')}><span>{account.name}</span><strong>{money(account.currentBalance)}</strong><small>{account.trades} trades · {money(account.stats.netPnl)} net</small></button>)}</section></details>
    <TradingRulesPanel rules={settings?.tradingRules||[]} onSave={tradingRules=>onSaveSettings({tradingRules})}/>
  </div>;
}

function JournalCalendar({trades,onReview}) {
 const [selectedMonth,setSelectedMonth]=useState(localDay().slice(0,7));
 const [selectedDay,setSelectedDay]=useState('');
 const days=calendarStats(trades.filter(t=>t.realised!==false));
 return <TradingCalendar days={days} monthOptions={[]} selectedMonth={selectedMonth} selectedDay={selectedDay} dayTrades={trades.filter(t=>t.date===selectedDay&&t.realised!==false)} onMonthChange={m=>{setSelectedMonth(m);setSelectedDay('');}} onDayClick={setSelectedDay} onClearDay={()=>setSelectedDay('')} onReview={onReview}/>;
}

function playbookRuleList(value) {
  return Array.isArray(value) ? value.join('\n') : String(value || '');
}

function parseRuleList(value) {
  return String(value || '')
    .split(/[\n,]/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function PlaybooksPanel({ playbooks = [], trades = [], onSave }) {
  const [draft, setDraft] = useState(playbooks.length ? playbooks : []);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(playbooks.length ? playbooks : []);
  }, [playbooks]);

  function addPlaybook() {
    setDraft((current) => current.concat({
      id: globalThis.crypto?.randomUUID?.() || `playbook-${Date.now()}`,
      name: 'New Playbook',
      market: 'MNQ',
      session: 'NY AM',
      setupRules: [],
      entryChecklist: [],
      invalidationRules: [],
      managementRules: [],
      mistakeWarnings: [],
      exampleNotes: '',
    }));
  }

  function update(index, key, value) {
    setDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function updateList(index, key, value) {
    update(index, key, parseRuleList(value));
  }

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      await onSave(draft);
      setMessage('Playbooks saved.');
    } catch (error) {
      setMessage(error.message || 'Playbooks could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  const linkedCounts = new Map();
  for (const trade of trades) {
    if (trade.playbookId) linkedCounts.set(trade.playbookId, (linkedCounts.get(trade.playbookId) || 0) + 1);
  }

  return (
    <div className="screen-grid">
      {message && <Notice tone={/saved/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Playbooks</span><h2>Trading Plans</h2></div>
          <div className="head-actions">
            <button className="secondary" type="button" onClick={addPlaybook}><Plus size={16} /> Add Playbook</button>
            <button className="primary" type="button" disabled={saving} onClick={save}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save Playbooks</button>
          </div>
        </div>
        <div className="playbook-grid">
          {draft.map((playbook, index) => (
            <article className="playbook-card" key={playbook.id || index}>
              <div className="panel-head compact-head">
                <div>
                  <span className="eyebrow">{linkedCounts.get(playbook.id) || 0} linked trades</span>
                  <h3>{playbook.name || 'Untitled Playbook'}</h3>
                </div>
                <button className="secondary icon-only" type="button" onClick={() => setDraft((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
              </div>
              <div className="form-grid">
                <Field label="Name"><input value={playbook.name || ''} onChange={(event) => update(index, 'name', event.target.value)} /></Field>
                <Field label="Market"><input value={playbook.market || ''} onChange={(event) => update(index, 'market', event.target.value.toUpperCase())} /></Field>
                <Field label="Session"><select value={playbook.session || ''} onChange={(event) => update(index, 'session', event.target.value)}><option value="">Any</option>{SESSION_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
              </div>
              <div className="split-panels compact">
                <Field label="Setup Rules"><textarea className="small-textarea" value={playbookRuleList(playbook.setupRules)} onChange={(event) => updateList(index, 'setupRules', event.target.value)} /></Field>
                <Field label="Entry Checklist"><textarea className="small-textarea" value={playbookRuleList(playbook.entryChecklist)} onChange={(event) => updateList(index, 'entryChecklist', event.target.value)} /></Field>
              </div>
              <div className="split-panels compact">
                <Field label="Invalidation Rules"><textarea className="small-textarea" value={playbookRuleList(playbook.invalidationRules)} onChange={(event) => updateList(index, 'invalidationRules', event.target.value)} /></Field>
                <Field label="Management Rules"><textarea className="small-textarea" value={playbookRuleList(playbook.managementRules)} onChange={(event) => updateList(index, 'managementRules', event.target.value)} /></Field>
              </div>
              <Field label="Mistake Warnings"><textarea className="small-textarea" value={playbookRuleList(playbook.mistakeWarnings)} onChange={(event) => updateList(index, 'mistakeWarnings', event.target.value)} /></Field>
              <Field label="Example Notes"><textarea className="small-textarea" value={playbook.exampleNotes || ''} onChange={(event) => update(index, 'exampleNotes', event.target.value)} placeholder="What this setup should look like when executed well." /></Field>
            </article>
          ))}
          {!draft.length && <p className="muted">No playbooks yet. Add one to define your rules before linking trades.</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

function timeInputDisplay(value) {
  const raw = String(value || '');
  return raw.includes('.') ? normalizeTimeInput(raw) : raw;
}

function TimeInput({ value, onChange }) {
  return (
    <div className="time-input-wrap">
      <input
        inputMode="numeric"
        placeholder="10:00"
        value={timeInputDisplay(value)}
        onBlur={(event) => onChange(normalizeTimeInput(event.target.value))}
        onChange={(event) => onChange(event.target.value.replace(/[.]/gu, ':'))}
      />
      <Clock size={15} aria-hidden="true" />
    </div>
  );
}

function tagValue(value) {
  if (typeof value === 'string') return value;
  return normalizeTags(value).join(', ');
}

function rrDisplay(value, fallback = 'No RR') {
  const normalized = normalizeRR(value);
  return normalized || fallback;
}

const capturePhases = [
  { id: 'ticket', label: 'Ticket', helper: 'Core trade info' },
  { id: 'screenshots', label: 'Screenshots', helper: 'Chart images' },
  { id: 'notes', label: 'Notes', helper: 'Tags and context' },
  { id: 'review', label: 'Review', helper: 'Check and save' },
];

function phaseForError(error = '') {
  if (/screenshot/i.test(error)) return 'screenshots';
  if (/note/i.test(error)) return 'notes';
  return 'ticket';
}

function tradeTagList(trade, camelKey, snakeKey) {
  const value = trade?.[camelKey];
  const hasValue = Array.isArray(value) ? value.length > 0 : String(value || '').trim();
  return normalizeTags(hasValue ? value : trade?.[snakeKey]);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function accountSummaries(trades, accounts = []) {
  return accounts.map(account => {
    const accountTrades = trades.filter(trade => trade.accountId === account.id);
    const stats = calculateAdvancedStats(accountTrades);
    return { ...account, stats, currentBalance: Number(account.startingBalance || 0) + stats.netPnl, trades: accountTrades.length };
  });
}

function Capture({ onSaved, defaultAccountId, activeTrade, accounts = [], playbooks = [], onCancelEdit, onSaveTrade }) {
  const [trade, setTrade] = useState(activeTrade || { ...emptyTrade(), accountId: defaultAccountId || '' });
  const [screenshots, setScreenshots] = useState(activeTrade?.screenshots || []);
  const [answers, setAnswers] = useState(activeTrade?.answers || {});
  const [selectedScreenshotId, setSelectedScreenshotId] = useState(activeTrade?.primaryScreenshotId || activeTrade?.screenshots?.[0]?.id || '');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const saveLock=useRef(false);
  const submissionId=useRef(crypto.randomUUID());
  const [executions,setExecutions]=useState({});
  const [phase, setPhase] = useState('ticket');
  const fileRef = useRef(null);
  const followups = useMemo(() => generateFollowups(trade.note, trade), [trade]);
  const draft = useMemo(() => buildJournalDraft({ ...trade, rr: normalizeRR(trade.rr) }, answers), [trade, answers]);
  const errors = [...validateTrade(trade, screenshots), ...(!trade.accountId ? ['Select a trading account.'] : [])];
  const phaseIndex = Math.max(0, capturePhases.findIndex((item) => item.id === phase));
  const isFinalPhase = phase === 'review';
  const selectedScreenshot = useMemo(() => (
    screenshots.find((shot) => shot.id === selectedScreenshotId)
    || primaryShot({ ...trade, screenshots }, true)
    || null
  ), [screenshots, selectedScreenshotId, trade.primaryScreenshotId]);

  useEffect(() => {
    setExecutions({});
    submissionId.current=crypto.randomUUID();
    setTrade(activeTrade || { ...emptyTrade(), accountId: defaultAccountId || '' });
    setScreenshots(activeTrade?.screenshots || []);
    setSelectedScreenshotId(activeTrade?.primaryScreenshotId || activeTrade?.screenshots?.[0]?.id || '');
    setAnswers(activeTrade?.answers || {});
    setMessage('');
    setPhase('ticket');
  }, [activeTrade]);

  useEffect(() => {
    if (!screenshots.length) {
      if (selectedScreenshotId) setSelectedScreenshotId('');
      return;
    }
    if (!selectedScreenshotId || !screenshots.some((shot) => shot.id === selectedScreenshotId)) {
      setSelectedScreenshotId(primaryShot({ ...trade, screenshots }, true)?.id || screenshots[0]?.id || '');
    }
  }, [screenshots, selectedScreenshotId, trade.primaryScreenshotId]);

  function update(key, value) {
    setTrade((current) => ({ ...current, [key]: value }));
  }

  function insertTemplate(templateId) {
    update('note', applyJournalTemplate(trade.note, templateId));
  }

  function changePhase(nextPhase) {
    setMessage('');
    setPhase(nextPhase);
  }

  function nextPhase() {
    const next = capturePhases[Math.min(phaseIndex + 1, capturePhases.length - 1)];
    changePhase(next.id);
  }

  function previousPhase() {
    const previous = capturePhases[Math.max(phaseIndex - 1, 0)];
    changePhase(previous.id);
  }

  async function addImageFiles(fileList) {
    const remaining = MAX_LOCAL_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      setMessage(`Limit is ${MAX_LOCAL_SCREENSHOTS} screenshots per trade.`);
      return;
    }
    const allImages = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (!allImages.length) return;
    const sizeSafeImages = allImages.filter((file) => file.size <= MAX_UPLOAD_IMAGE_BYTES);
    if (sizeSafeImages.length < allImages.length) {
      setMessage(`Skipped ${allImages.length - sizeSafeImages.length} image${allImages.length - sizeSafeImages.length === 1 ? '' : 's'} larger than 20 MB.`);
    }
    const files = sizeSafeImages.slice(0, remaining);
    if (!files.length) return;
    if (sizeSafeImages.length > remaining) setMessage(`Added ${remaining} screenshot${remaining === 1 ? '' : 's'}. Limit is ${MAX_LOCAL_SCREENSHOTS} per trade.`);
    const next = await Promise.all(files.map(async (file) => {
      const compressed = await compressImageFile(file);
      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${globalThis.crypto?.randomUUID?.() || Date.now()}`,
        name: compressed.name,
        size: compressed.size,
        type: compressed.type,
        kind: 'execution',
        dataUrl: compressed.dataUrl,
      };
    }));
    setScreenshots((current) => current.concat(next));
    if (next[0]?.id) setSelectedScreenshotId(next[0].id);
  }

  async function filesChanged(fileList) {
    await addImageFiles(fileList);
    if (fileRef.current) fileRef.current.value = '';
  }

  function removeScreenshot(shotId) {
    setScreenshots((current) => {
      const next = current.filter((item) => item.id !== shotId);
      setTrade((currentTrade) => {
        if (currentTrade.primaryScreenshotId !== shotId) return currentTrade;
        return {
          ...currentTrade,
          primaryScreenshotId: next.find((shot) => shot.kind !== 'news')?.id || next[0]?.id || '',
        };
      });
      return next;
    });
  }

  async function pasted(event) {
    const files = Array.from(event.clipboardData?.files || []).filter((file) => file.type.startsWith('image/'));
    if (!files.length) return;
    event.preventDefault();
    await addImageFiles(files);
  }

  async function save() {
    if(saveLock.current) return;
    if (errors.length) {
      setMessage(errors[0]);
      setPhase(phaseForError(errors[0]));
      return;
    }
    saveLock.current=true;
    setSaving(true);
    setMessage('');
    try {
      const primaryScreenshotId = screenshots.some((shot) => shot.id === trade.primaryScreenshotId)
        ? trade.primaryScreenshotId
        : screenshots.find((shot) => shot.kind !== 'news')?.id || screenshots[0]?.id || '';
      const payload = {
        ...trade,
        primaryScreenshotId,
        title: draft.title,
        rr: draft.rr,
        tags: normalizeTags(trade.tags).concat(draft.tags || []),
        setupTags: normalizeTags(trade.setupTags),
        mistakeTags: normalizeTags(trade.mistakeTags),
        entryTime: normalizeTimeInput(trade.entryTime),
        exitTime: normalizeTimeInput(trade.exitTime),
        reviewStatus: trade.reviewStatus || (trade.reviewed ? 'reviewed' : 'needs_review'),
        reviewed: (trade.reviewStatus || (trade.reviewed ? 'reviewed' : 'needs_review')) === 'reviewed',
        sections: draft.sections,
        answers,
        screenshots,
      };
      const selected=Object.entries(executions).filter(([id,e])=>e.selected&&id!==trade.accountId);
      if(!activeTrade) {
        await onSaveTrade(payload,[{accountId:trade.accountId,pnl:trade.pnl},...selected.map(([accountId,e])=>({accountId,pnl:e.pnl,entryTime:normalizeTimeInput(e.entryTime),exitTime:normalizeTimeInput(e.exitTime),actualExit:e.actualExit}))],submissionId.current);
      } else await onSaveTrade(payload);
      submissionId.current=crypto.randomUUID();
      setExecutions({});
      setTrade(emptyTrade());
      setScreenshots([]);
      setAnswers({});
      await onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      saveLock.current=false;
      setSaving(false);
    }
  }

  return (
    <div className="capture-grid">
      <section className="panel capture-form" onPaste={pasted}>
        <div className="panel-head">
          <div><span className="eyebrow">Capture</span><h2>{trade.id ? 'Edit Trade' : 'Add Trade'}</h2></div>
          <div className="head-actions">
            {trade.id && <button className="secondary" type="button" onClick={onCancelEdit}>Cancel Edit</button>}
            {phaseIndex > 0 && <button className="secondary" type="button" onClick={previousPhase}>Back</button>}
            {isFinalPhase
              ? <button className="primary" disabled={saving} onClick={save}>{saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />} Save Trade</button>
              : <button className="primary" type="button" onClick={nextPhase}>Next <ArrowRight size={17} /></button>}
          </div>
        </div>
        {message && <Notice tone={/saved|added/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
        <nav className="capture-phase-nav" aria-label="Trade capture steps">
          {capturePhases.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`${phase === item.id ? 'active' : ''} ${index < phaseIndex ? 'done' : ''}`}
              onClick={() => changePhase(item.id)}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{item.label}</strong>
              <small>{item.helper}</small>
            </button>
          ))}
        </nav>
        {phase === 'ticket' && <div className="form-grid trade-ticket-grid">
          <p>Date is the realised-result day in this computer’s local timezone. Entry and exit times are actual UK execution times. Leave unknown times blank.</p><Field label="Date"><input type="date" value={trade.date} onChange={(event) => update('date', event.target.value)} /></Field>
          <Field label="Asset"><input value={trade.asset} onChange={(event) => update('asset', event.target.value.toUpperCase())} /></Field>
          <Field label="Account">
            <select aria-label="Trade account" value={trade.accountId || ''} onChange={event => update('accountId', event.target.value)}><option value="">Select an account</option>{accounts.filter(a => !a.archived || a.id === activeTrade?.accountId).map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}</select>
          </Field>
          <Field label="Strategy"><input value={trade.strategy} onChange={(event) => update('strategy', event.target.value)} /></Field>
          <Field label="Session"><select value={trade.session || ''} onChange={(event) => update('session', event.target.value)}>{SESSION_OPTIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <p>Entry Time is the actual execution time in UK local time, not when you write this journal. P&L must already include all commissions and fees.</p><Field label="Entry Time"><TimeInput value={trade.entryTime || ''} onChange={(value) => update('entryTime', value)} /></Field>
          <label><input type="checkbox" checked={trade.realised !== false} onChange={e=>update('realised',e.target.checked)}/> Realised result (exclude open/unrealised positions from risk totals)</label><Field label="Exit Time"><TimeInput value={trade.exitTime || ''} onChange={(value) => update('exitTime', value)} /></Field>
          <Field label="Direction"><select value={trade.direction} onChange={(event) => update('direction', event.target.value)}>{DIRECTIONS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Outcome"><select value={trade.outcome} onChange={(event) => update('outcome', event.target.value)}>{OUTCOMES.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="P&L"><input value={trade.pnl} placeholder="+450 / -200" onChange={(event) => update('pnl', event.target.value)} /></Field>
          <Field label="RR"><input value={rrDisplay(trade.rr, '')} placeholder="1.5" onBlur={(event) => update('rr', normalizeRR(event.target.value))} onChange={(event) => update('rr', event.target.value)} /></Field>
          <Field label="Rating"><select value={trade.rating} onChange={(event) => update('rating', event.target.value)}>{RATINGS.map((item) => <option key={item}>{item}</option>)}</select></Field>
          <Field label="Emotion"><input value={trade.emotion || ''} onChange={(event) => update('emotion', event.target.value)} placeholder="Calm, rushed, patient..." /></Field>
        </div>}
        {!activeTrade && (phase==='ticket'||phase==='review') && <fieldset className="execution-accounts"><legend>Account executions</legend><p>Primary account: {accounts.find(a=>a.id===trade.accountId)?.name||'Select above'} · net P&L {trade.pnl||'required'}. Add other accounts below. Enter each account’s actual net result; fees are already included.</p>{accounts.filter(a=>!a.archived&&a.id!==trade.accountId).map(a=><div className="execution-row" key={a.id}><label><input type="checkbox" checked={!!executions[a.id]?.selected} onChange={e=>setExecutions({...executions,[a.id]:{pnl:'',entryTime:trade.entryTime,exitTime:trade.exitTime,actualExit:trade.actualExit,...executions[a.id],selected:e.target.checked}})}/>{a.name}</label>{executions[a.id]?.selected&&<div className="form-grid">{[['pnl','Net P&L'],['entryTime','Entry time'],['exitTime','Exit time'],['actualExit','Actual exit']].map(([key,label])=><label key={key}>{label} · {a.name}<input aria-label={`${label} ${a.name}`} value={executions[a.id][key]||''} onChange={e=>setExecutions({...executions,[a.id]:{...executions[a.id],[key]:e.target.value}})}/></label>)}</div>}</div>)}</fieldset>}
        {phase === 'ticket' && (
          <p className="phase-hint">Start with the trade ticket only. Screenshots, notes, and the final review come next.</p>
        )}
        <datalist id="account-options">
          {accounts.map((account) => <option key={account.id || account.name} value={account.name} />)}
        </datalist>
        {phase === 'notes' && <>
        <details className="capture-detail-drawer">
          <summary>
            <span>
              <strong>More trade details</strong>
              <small>Optional plan, exit, and lesson fields</small>
            </span>
            <ChevronDown size={17} />
          </summary>
          <div className="detail-drawer-body">
            <div className="journal-plan-grid">
              <Field label="Setup"><input value={trade.setupName || ''} onChange={(event) => update('setupName', event.target.value)} placeholder="NY AM SMT sweep, IFVG..." /></Field>
              <Field label="Planned Target"><input value={trade.plannedTarget || ''} onChange={(event) => update('plannedTarget', event.target.value)} placeholder="30020.25" /></Field>
              <Field label="Planned Stop"><input value={trade.plannedStop || ''} onChange={(event) => update('plannedStop', event.target.value)} placeholder="29940.00" /></Field>
              <Field label="Actual Exit"><input value={trade.actualExit || ''} onChange={(event) => update('actualExit', event.target.value)} placeholder="29982.50" /></Field>
              <Field label="Followed Plan %"><input type="number" min="0" max="100" value={trade.followedPlanScore || ''} onChange={(event) => update('followedPlanScore', event.target.value)} placeholder="0-100" /></Field>
            </div>
            <div className="journal-reason-grid">
              <Field label="Entry Reason"><textarea className="small-textarea" value={trade.entryReason || ''} onChange={(event) => update('entryReason', event.target.value)} placeholder="Why was entry allowed?" /></Field>
              <Field label="Exit Reason"><textarea className="small-textarea" value={trade.exitReason || ''} onChange={(event) => update('exitReason', event.target.value)} placeholder="Why did you exit?" /></Field>
            </div>
            <Field label="Lesson"><input value={trade.lesson || ''} onChange={(event) => update('lesson', event.target.value)} placeholder="One rule for the next trade." /></Field>
          </div>
        </details>
        <div className="journal-tags-grid">
          <Field label="Setup Tags"><input value={tagValue(trade.setupTags)} onBlur={(event) => update('setupTags', normalizeTags(event.target.value))} onChange={(event) => update('setupTags', event.target.value)} placeholder="SMT, IFVG, sweep" /></Field>
          <Field label="Mistake Tags"><input value={tagValue(trade.mistakeTags)} onBlur={(event) => update('mistakeTags', normalizeTags(event.target.value))} onChange={(event) => update('mistakeTags', event.target.value)} placeholder="Chase, early stop, revenge" /></Field>
        </div>
        <div className="template-strip">
          {JOURNAL_TEMPLATES.map((template) => (
            <button key={template.id} className="secondary" type="button" onClick={() => insertTemplate(template.id)}>
              <ClipboardCheck size={15} /> {template.label}
            </button>
          ))}
        </div>
        <Field label="Messy Note"><textarea className="messy-note-input" value={trade.note} onChange={(event) => update('note', event.target.value)} placeholder="Dump the trade truth here. Setup, execution, emotions, mistake, lesson." /></Field>
        </>}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(event) => filesChanged(event.target.files)} />
        {phase === 'screenshots' && <section className="capture-detail-block screenshot-compose">
          <div className="mini-section-head">
            <span className="eyebrow">Screenshots</span>
            <strong>Chart images</strong>
          </div>
          <div className={`capture-shot-preview ${selectedScreenshot ? '' : 'empty'}`}>
            {selectedScreenshot ? (
              <>
                <ScreenshotImage
                  shot={selectedScreenshot}
                  src={shotSrc(selectedScreenshot)}
                  alt={selectedScreenshot.name || 'Selected trade screenshot'}
                  fallbackLabel={screenshotFallbackLabel(selectedScreenshot)}
                  iconSize={34}
                />
                <div className="capture-shot-preview-meta">
                  <div>
                    <span className="eyebrow">Preview</span>
                    <strong>{selectedScreenshot.name || 'Selected screenshot'}</strong>
                  </div>
                  <span>{selectedScreenshot.kind || 'execution'} · {formatBytes(selectedScreenshot.size)}</span>
                </div>
              </>
            ) : (
              <button className="phase-dropzone" type="button" onClick={() => fileRef.current?.click()}>
                <div>
                  <h3>Add chart screenshots</h3>
                  <p>Drop in the trade screenshots you want to review.</p>
                </div>
                <UploadCloud size={22} />
              </button>
            )}
          </div>
          <button className="secondary" type="button" onClick={() => fileRef.current?.click()}><UploadCloud size={17} /> Add Screenshots</button>
          <div className="shot-grid">
            {screenshots.map((shot) => (
              <div
                className={`shot ${selectedScreenshot?.id === shot.id ? 'active' : ''}`}
                key={shot.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedScreenshotId(shot.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  setSelectedScreenshotId(shot.id);
                }}
              >
                <ScreenshotImage
                  shot={shot}
                  src={shotSrc(shot)}
                  alt={shot.name || 'Trade screenshot'}
                  fallbackLabel={screenshotFallbackLabel(shot)}
                />
                <div className="shot-controls">
                  <select value={shot.kind || 'execution'} onClick={(event) => event.stopPropagation()} onChange={(event) => setScreenshots((current) => current.map((item) => item.id === shot.id ? { ...item, kind: event.target.value } : item))}>
                    <option value="execution">Execution</option>
                    <option value="context">Context</option>
                    <option value="news">News</option>
                    <option value="other">Other</option>
                  </select>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Set primary screenshot"
                    onClick={(event) => {
                      event.stopPropagation();
                      update('primaryScreenshotId', shot.id);
                      setSelectedScreenshotId(shot.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      update('primaryScreenshotId', shot.id);
                      setSelectedScreenshotId(shot.id);
                    }}
                  >
                    {trade.primaryScreenshotId === shot.id ? <CheckCircle2 size={14} /> : <ImageIcon size={14} />}
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    title="Remove screenshot"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeScreenshot(shot.id);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      event.stopPropagation();
                      removeScreenshot(shot.id);
                    }}
                  >
                    <Trash2 size={14} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>}
        {phase === 'review' && (
          <section className="phase-review-card">
            <div>
              <span className="eyebrow">Final Check</span>
              <h3>{draft.title}</h3>
              <p>{screenshots.length} screenshot{screenshots.length === 1 ? '' : 's'} attached · {trade.note ? 'note added' : 'note missing'} · {rrDisplay(trade.rr)}</p>
            </div>
            {errors.length ? <Notice tone="error">{errors[0]}</Notice> : <Notice tone="success">Ready to save.</Notice>}
          </section>
        )}
      </section>

      <aside className="panel preview-panel">
        <div className="panel-head"><h2>Smart Review</h2><Sparkles size={18} /></div>
        <div className="followups">
          {followups.map((question, index) => (
            <Field key={question.id} label={`${index + 1}. ${question.label}`}>
              <input value={answers[question.id] || ''} placeholder={question.placeholder} onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))} />
            </Field>
          ))}
        </div>
        <div className="draft-body">
          {Object.entries(draft.sections).map(([title, body]) => (
            <section className="preview-section" key={title}><h3>{title}</h3><p>{body}</p></section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function TradeCard({ trade, onDelete, onEdit, onToggleReview, onReview, deleteBusy = false, reviewBusy = false }) {
  const firstShot = primaryShot(trade);
  const imageSrc = shotSrc(firstShot);
  const newsCount = newsShots(trade).length;
  const outcome = normalizeOutcome(trade);
  return (
    <article className="trade-card">
      <ScreenshotImage
        shot={firstShot}
        src={imageSrc}
        alt={trade.title || trade.asset || 'Trade screenshot'}
        fallbackLabel={screenshotFallbackLabel(firstShot, trade.title || 'Screenshot unavailable')}
        iconSize={26}
      />
      <div className="shot-badges">
        {firstShot?.kind && <span>{firstShot.kind}</span>}
        {newsCount > 0 && <span><Newspaper size={12} /> {newsCount}</span>}
      </div>
      <div>
        <span>{trade.account} · {trade.date} · {trade.strategy || 'No strategy'}</span>
        <h3>{trade.asset} {trade.direction}</h3>{trade.riskSession === false && <strong className="red">Outside permitted trading hours</strong>}{trade.riskSession === null && <small>Execution time unknown / not applicable</small>}
        <p>{trade.note || trade.title}</p>
      </div>
      <div className="trade-card-foot">
        <strong className={parseMoney(trade.pnl) >= 0 ? 'green' : 'red'}>{money(parseMoney(trade.pnl))}</strong>
        <span>{outcome || 'Unsorted'} · {rrDisplay(trade.rr)} · {normalizeReviewStatus(trade).replace('_', ' ')}</span>
      </div>
      <div className="icon-actions">
        {onReview && <button title="Review trade" disabled={reviewBusy || deleteBusy} onClick={() => onReview(trade)}><Eye size={15} /></button>}
        {onToggleReview && <button title={trade.reviewed ? 'Mark not reviewed' : 'Mark reviewed'} disabled={reviewBusy || deleteBusy} onClick={() => onToggleReview(trade)}>{reviewBusy ? <Loader2 className="spin" size={15} /> : <ClipboardCheck size={15} />}</button>}
        {onEdit && <button title="Edit trade" disabled={reviewBusy || deleteBusy} onClick={() => onEdit(trade)}><Edit3 size={15} /></button>}
        {onDelete && <button title="Delete" disabled={reviewBusy || deleteBusy} onClick={() => onDelete(trade.id)}>{deleteBusy ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}</button>}
      </div>
    </article>
  );
}

function cleanReviewText(value) {
  return String(value || '').replace(/\s+/gu, ' ').trim();
}

function displayReviewText(value) {
  return String(value || '').replace(/\n{3,}/gu, '\n\n').trim();
}

function sectionText(sections, label) {
  return cleanReviewText(sections?.[label]);
}

function firstUsefulText(...values) {
  return values.map(cleanReviewText).find((value) => value && !/^not specified\.?$/iu.test(value)) || '';
}

function buildCoachSummary(trade) {
  const sections = trade.sections || {};
  const outcome = normalizeOutcome(trade) || 'Unsorted';
  const pnl = parseMoney(trade.pnl);
  const setupTags = normalizeTags(trade.setupTags).join(', ');
  const mistakeTags = normalizeTags(trade.mistakeTags).join(', ');
  const planScoreValue = trade.followedPlanScore ?? trade.followed_plan_score;
  const hasPlanScore = planScoreValue !== null && planScoreValue !== undefined && String(planScoreValue).trim() !== '';
  const planScore = Number(planScoreValue);
  const note = cleanReviewText(trade.note || sectionText(sections, 'Raw Note'));
  const lowerNote = note.toLowerCase();
  const improvement = firstUsefulText(sectionText(sections, 'What To Improve'), sectionText(sections, 'Psychology'));
  const worked = firstUsefulText(sectionText(sections, 'What Worked'), sectionText(sections, 'Setup'));
  const setup = firstUsefulText(sectionText(sections, 'Setup'), setupTags && `Setup tags logged: ${setupTags}.`);
  let focus = improvement || 'The note does not specify one clear improvement yet. Add the exact mistake, trigger, and rule for the next trade.';

  if (/listen|influenc|vc|talking|other people/u.test(lowerNote)) {
    focus = 'Protect decision quality: take the trade from your own model, not from outside voices during execution.';
  } else if (/closed?.{0,18}early|too early|scared|fear/u.test(lowerNote)) {
    focus = 'The main leak is early exit pressure. Define the invalidation point before entry and do not close only because the trade feels uncomfortable.';
  } else if (/revenge|over.?trad|angry/u.test(lowerNote)) {
    focus = 'The main leak is emotional continuation. Add a hard cooldown after the first emotional close or rule break.';
  } else if (/stop|be|break.?even|moved/u.test(lowerNote)) {
    focus = 'The management rule is the review point: only move to break-even when structure changes, not because price is close or uncomfortable.';
  } else if (hasPlanScore && Number.isFinite(planScore) && planScore < 70) {
    focus = 'The highest priority is plan adherence. Define the rule that was broken and decide what blocks that same behavior next time.';
  } else if (mistakeTags) {
    focus = `Review the repeated mistake tags first: ${mistakeTags}.`;
  }

  return [
    {
      title: 'Quick Read',
      body: `${trade.asset || 'Trade'} ${trade.direction || ''} ended ${outcome} for ${money(pnl)}${rrDisplay(trade.rr, '') ? ` at ${rrDisplay(trade.rr, '')}` : ''}. ${setup || 'Main setup confirmation was not specified.'}`,
    },
    {
      title: 'What Mattered',
      body: trade.lesson
        ? `Lesson logged: ${trade.lesson}`
        : worked || 'There is not enough detail yet to isolate what worked. Add the entry trigger, confirmation, and management decision.',
    },
    {
      title: 'Main Improvement',
      body: focus,
    },
    {
      title: 'Next Trade Rule',
      body: firstUsefulText(sectionText(sections, 'What To Improve'), focus).replace(/^[-•]\s*/u, ''),
    },
  ];
}

function screenshotLabel(shot) {
  const kind = shot?.kind || 'execution';
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function tradeReviewTitle(trade) {
  const instrument = [trade.asset, trade.direction].filter(Boolean).join(' ').trim();
  const outcome = normalizeOutcome(trade);
  const generated = [instrument, trade.date, outcome].filter(Boolean).join(' - ');
  return generated || trade.title || 'Trade Review';
}

function TradeDetailPage({ trade, playbooks = [], onBack, onEdit, onToggleReview }) {
  const shots = trade.screenshots || [];
  const [selectedShotId, setSelectedShotId] = useState('');
  const preferredShot = primaryShot(trade, true) || shots[0] || null;
  const selectedShot = shots.find((shot) => shot.id === selectedShotId) || preferredShot;
  const selectedSrc = shotSrc(selectedShot);
  const sections = trade.sections || {};
  const outcome = normalizeOutcome(trade);
  const coachSummary = buildCoachSummary(trade);
  const playbook = playbooks.find((item) => item.id === trade.playbookId) || null;
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelectedShotId(preferredShot?.id || '');
  }, [preferredShot?.id, trade.id]);

  async function toggleReview() {
    setBusy(true);
    try {
      await onToggleReview(trade);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trade-detail-page">
      <section className="zella-review-hero">
        <div>
          <button className="link-button detail-back" type="button" onClick={onBack}>Back to Trade Log</button>
          <span className="eyebrow">Trade Review</span>
          <h2>{tradeReviewTitle(trade)}</h2>
        </div>
        <div className="detail-actions">
          <button className="secondary" type="button" onClick={() => onEdit(trade)}><Edit3 size={16} /> Edit Trade</button>
          <button className="secondary" type="button" disabled={busy} onClick={toggleReview}>
            {busy ? <Loader2 className="spin" size={16} /> : <ClipboardCheck size={16} />}
            {normalizeReviewStatus(trade) === 'reviewed' ? 'Mark Needs Review' : 'Mark Reviewed'}
          </button>
        </div>
      </section>

      <section className="zella-stat-strip">
        {[
          ['Account', trade.account || 'Not set'],
          ['Date', trade.date || 'Not set'],
          ['Asset', trade.asset || 'No asset'],
          ['Direction', trade.direction || 'No direction'],
          ['Outcome', outcome || 'Unsorted'],
          ['RR', rrDisplay(trade.rr)],
          ['P&L', money(parseMoney(trade.pnl))],
          ['Plan Score', trade.followedPlanScore === '' || trade.followedPlanScore === null || trade.followedPlanScore === undefined ? 'No score' : `${trade.followedPlanScore}%`],
          ['Playbook', trade.playbookName || playbook?.name || 'No playbook'],
        ].map(([label, value]) => (
          <article key={label}>
            <span>{label}</span>
            <strong className={label === 'P&L' ? (parseMoney(trade.pnl) >= 0 ? 'green' : 'red') : ''}>{value}</strong>
          </article>
        ))}
      </section>

      <div className="zella-review-layout">
        <main className="zella-main-column">
          <section className="zella-chart-card">
            <div className="zella-card-head">
              <div>
                <span className="eyebrow">Execution</span>
                <h3>{selectedShot ? screenshotLabel(selectedShot) : 'Screenshot'}</h3>
              </div>
              <span>{shots.length ? `${shots.length} screenshots` : 'No screenshots'}</span>
            </div>
            <div className="zella-chart-stage">
              <ScreenshotImage
                shot={selectedShot}
                src={selectedSrc}
                alt={selectedShot?.name || 'Trade screenshot'}
                fallbackLabel={screenshotFallbackLabel(selectedShot)}
                iconSize={34}
              />
            </div>
            {shots.length > 0 && (
              <div className="zella-shot-strip">
                {shots.map((shot, index) => (
                  <button
                    className={selectedShot?.id === shot.id ? 'active' : ''}
                    key={shot.id || `${shot.name}-${index}`}
                    type="button"
                    onClick={() => setSelectedShotId(shot.id)}
                  >
                    <ScreenshotImage
                      shot={shot}
                      src={shotSrc(shot)}
                      alt={shot.name || `Screenshot ${index + 1}`}
                      fallbackLabel={screenshotFallbackLabel(shot)}
                      fallbackClassName="thumb-fallback"
                    />
                    <span>{index + 1}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="zella-coach-card">
            <div className="zella-card-head">
              <div><span className="eyebrow">Rule-Based Summary</span><h3>Coach Review</h3></div>
              <Sparkles size={18} />
            </div>
            <div className="zella-coach-list">
              {coachSummary.map((item) => (
                <article key={item.title}>
                  <span>{item.title}</span>
                  <p>{item.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="zella-journal-card">
            <div className="zella-card-head">
              <div><span className="eyebrow">Journal</span><h3>Trade Notes</h3></div>
            </div>
            <div className="zella-section-list">
              <article>
                <span>Actual vs Planned</span>
                <p>{[
                  trade.plannedTarget && `Planned target: ${trade.plannedTarget}.`,
                  trade.plannedStop && `Planned stop: ${trade.plannedStop}.`,
                  trade.actualExit && `Actual exit: ${trade.actualExit}.`,
                  trade.entryReason && `Entry reason: ${trade.entryReason}`,
                  trade.exitReason && `Exit reason: ${trade.exitReason}`,
                  trade.lesson && `Lesson: ${trade.lesson}`,
                ].filter(Boolean).join(' ') || 'No planned target, stop, actual exit, or lesson was logged.'}</p>
              </article>
              {reviewSectionLabels.map((label) => (
                <article key={label}>
                  <span>{label}</span>
                  <p>{displayReviewText(sections[label]) || 'Not specified.'}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="zella-raw-card">
            <span className="eyebrow">Original Note</span>
            <h3>Raw Trade Notes</h3>
            <p>{displayReviewText(trade.note || sections['Raw Note']) || 'No raw note was saved for this trade.'}</p>
          </section>
        </main>

        <aside className="zella-review-sidebar">
          <section className="zella-meta-card">
            <span className="eyebrow">Context</span>
            <div>
              <strong>Playbook</strong>
              <p>{trade.playbookName || playbook?.name || 'No playbook linked'}</p>
            </div>
            <div>
              <strong>Setup</strong>
              <p>{trade.setupName || 'No setup name logged'}</p>
            </div>
            <div>
              <strong>Strategy</strong>
              <p>{trade.strategy || 'No strategy logged'}</p>
            </div>
            <div>
              <strong>Session</strong>
              <p>{trade.session || 'No session logged'}</p>
            </div>
            <div>
              <strong>Setup Tags</strong>
              <p>{normalizeTags(trade.setupTags).join(', ') || 'No setup tags'}</p>
            </div>
            <div>
              <strong>Mistake Tags</strong>
              <p>{normalizeTags(trade.mistakeTags).join(', ') || 'No mistake tags'}</p>
            </div>
            <div>
              <strong>Review Status</strong>
              <p>{normalizeReviewStatus(trade).replace('_', ' ')}</p>
            </div>
          </section>
          {playbook && (
            <section className="zella-meta-card">
              <span className="eyebrow">Playbook Rules</span>
              <div>
                <strong>Entry Checklist</strong>
                <ul className="clean-list">{(playbook.entryChecklist || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <strong>Invalidation</strong>
                <ul className="clean-list">{(playbook.invalidationRules || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div>
                <strong>Mistake Warnings</strong>
                <ul className="clean-list">{(playbook.mistakeWarnings || []).map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function TradeLog({ trades, onDelete, onEdit, onToggleReview, onReview }) {
  const [query, setQuery] = useState('');
  const [visibleCount,setVisibleCount]=useState(50);
  const [filter, setFilter] = useState('all');
  useEffect(()=>setVisibleCount(50),[query,filter]);
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [togglingId, setTogglingId] = useState('');
  const visible = trades
    .filter(isTradeRecord)
    .filter((trade) => filter === 'all' || (filter === 'review' ? normalizeReviewStatus(trade) === 'needs_review' : filter === 'archived' ? normalizeReviewStatus(trade) === 'archived' : normalizeOutcome(trade) === filter))
    .filter((trade) => `${trade.asset} ${trade.direction} ${normalizeOutcome(trade)} ${trade.strategy} ${trade.note}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  async function deleteTrade(id) {
    const trade = trades.find((item) => item.id === id);
    if (!window.confirm(`Delete ${trade?.title || `${trade?.asset || 'this'} trade`}? This removes its screenshots too.`)) return;
    setDeletingId(id);
    setMessage('');
    try {
      await onDelete(id);
      setMessage('Trade deleted.');
    } catch (error) {
      setMessage(error.message || 'Trade could not be deleted.');
    } finally {
      setDeletingId('');
    }
  }

  async function toggleTradeReview(trade) {
    setTogglingId(trade.id);
    setMessage('');
    try {
      await onToggleReview(trade);
      setMessage('Review status updated.');
    } catch (error) {
      setMessage(error.message || 'Review status could not be updated.');
    } finally {
      setTogglingId('');
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div><span className="eyebrow">Review</span><h2>Trade History</h2></div>
        <div className="head-actions">
          <select className="search" value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">All trades</option>
            <option value="review">Needs review</option>
            <option value="archived">Archived</option>
            <option value="Win">Wins</option>
            <option value="Loss">Losses</option>
            <option value="BE">Break-even</option>
            <option value="Missed">Missed</option>
          </select>
          <input className="search" placeholder="Search trades" value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
      </div>
      {message && <Notice tone={/deleted|updated/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
      <div className="trade-row-grid">{visible.slice(0,visibleCount).map((trade) => (
        <TradeCard
          key={trade.id}
          trade={trade}
          onDelete={deleteTrade}
          onEdit={onEdit}
          onReview={onReview}
          onToggleReview={toggleTradeReview}
          deleteBusy={deletingId === trade.id}
          reviewBusy={togglingId === trade.id}
        />
      ))}</div>
      {visible.length>50&&<div className="panel-head"><small>Showing {Math.min(visibleCount,visible.length)} of {visible.length} trades</small>{visibleCount<visible.length&&<button className="secondary" onClick={()=>setVisibleCount(n=>n+50)}>Load more trades</button>}</div>}
      {!visible.length && <p className="muted">No trades yet. Add one from Capture.</p>}
    </section>
  );
}

function Insights({trades,onReview}) {
 return <div className="screen-grid"><MiniChart trades={trades.filter(t=>t.realised!==false)}/><JournalCalendar trades={trades} onReview={onReview}/></div>;
}

function TradingCalendar({ days, monthOptions, selectedMonth, selectedDay, dayTrades, onMonthChange, onDayClick, onClearDay, onReview }) {
  const activeMonth = selectedMonth || monthOptions.at(-1) || today.slice(0, 7);
  const dayMap = new Map(days.map((day) => [day.date, day]));
  const monthDays = days.filter((day) => String(day.date || '').startsWith(activeMonth));
  const monthlyPnl = monthDays.reduce((sum, day) => sum + day.netPnl, 0);
  const monthlyTrades = monthDays.reduce((sum, day) => sum + day.trades, 0);
  const shiftMonth=offset=>{const [y,m]=activeMonth.split('-').map(Number);const d=new Date(Date.UTC(y,m-1+offset,1));return d.toISOString().slice(0,7);};
  const previousMonth=shiftMonth(-1), nextMonth=shiftMonth(1);
  const cells = calendarCells(activeMonth);

  return (
    <section className="panel trading-calendar">
      <div className="calendar-header">
        <div>
          <span className="eyebrow">Calendar</span>
          <h2>{formatMonthLabel(activeMonth)}</h2>
          <p>{monthlyTrades} trade{monthlyTrades === 1 ? '' : 's'} this month</p>
        </div>
        <strong className={monthlyPnl >= 0 ? 'green' : 'red'}>Monthly P/L: {money(monthlyPnl)}</strong>
        <div className="calendar-nav">
          <button className="secondary" type="button" disabled={!previousMonth} onClick={() => onMonthChange(previousMonth)}>Prev</button>
          <button className="secondary" type="button" disabled={!nextMonth} onClick={() => onMonthChange(nextMonth)}>Next</button>
        </div>
      </div>
      <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
      <div className="calendar-month-grid">
        {cells.map((cell) => {
          const day = dayMap.get(cell.date);
          const hasTrades = Boolean(day?.trades);
          const tone = !hasTrades ? 'empty' : day.netPnl >= 0 ? 'positive' : 'negative';
          return (
            <button
              key={cell.date}
              type="button"
              className={`${tone} ${cell.inMonth ? '' : 'outside'} ${selectedDay === cell.date ? 'active' : ''}`}
              disabled={!hasTrades}
              onClick={() => onDayClick(cell.date)}
            >
              <span>{cell.day}</span>
              {hasTrades && <>
                <strong>{money(day.netPnl)}</strong>
                <small>{day.trades} trade{day.trades === 1 ? '' : 's'}</small>
              </>}
            </button>
          );
        })}
      </div>
      {!days.length && <p className="muted">No calendar data yet.</p>}
      {selectedDay && (
        <div className="day-detail calendar-day-detail">
          <div className="panel-head">
            <div>
              <span className="eyebrow">Selected Day</span>
              <h3>{selectedDay}</h3>
            </div>
            <button className="link-button" type="button" onClick={onClearDay}>Clear</button>
          </div>
          <div className="calendar-trade-list">
            {dayTrades.map((trade) => (
              <button key={trade.id} type="button" onClick={() => onReview?.(trade)}>
                <span>{trade.asset || 'Trade'} {trade.direction || ''}</span>
                <strong className={parseMoney(trade.pnl) >= 0 ? 'green' : 'red'}>{money(parseMoney(trade.pnl))}</strong>
                <small>{trade.outcome || normalizeOutcome(trade)} · {rrDisplay(trade.rr, 'No RR')}</small>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function calendarCells(monthKey) {
  const [year, month] = String(monthKey || today.slice(0, 7)).split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const start = new Date(first);
  start.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const value = date.toISOString().slice(0, 10);
    return {
      date: value,
      day: date.getUTCDate(),
      inMonth: value.slice(0, 7) === monthKey,
    };
  });
}

function formatMonthLabel(monthKey) {
  const [year, month] = String(monthKey || '').split('-').map(Number);
  if (!year || !month) return 'Calendar';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function AnalyticsBrief({ summary, quality }) {
  const momentum = summary.momentum || {};
  const current = momentum.current || {};
  const previous = momentum.previous || null;
  const trendTone = !previous || momentum.expectancyDelta >= 0 ? 'green' : 'red';

  return (
    <section className="panel analytics-brief">
      <div className="panel-head">
        <div>
          <span className="eyebrow">Decision Layer</span>
          <h2>What The Data Is Saying</h2>
          <p className="muted">{summary.totalTrades} analyzed trades · rankings use at least {summary.minSample} trade{summary.minSample === 1 ? '' : 's'} per segment.</p>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="analytics-brief-grid">
        <EdgeCard
          eyebrow="Repeat This"
          title={summary.bestEdge ? `${summary.bestEdge.type}: ${summary.bestEdge.label}` : 'No clean edge yet'}
          value={summary.bestEdge ? money(summary.bestEdge.expectancy) : 'Add more trades'}
          detail={summary.bestEdge ? `${summary.bestEdge.trades} trades · ${money(summary.bestEdge.netPnl)} net · ${pct(summary.bestEdge.winRate)} win rate.` : 'Tag setups, sessions, and playbooks consistently to expose repeatable strengths.'}
          tone="green"
        />
        <EdgeCard
          eyebrow="Fix This"
          title={summary.biggestLeak ? `${summary.biggestLeak.type}: ${summary.biggestLeak.label}` : 'No repeated leak yet'}
          value={summary.biggestLeak ? money(summary.biggestLeak.expectancy) : 'Keep tagging mistakes'}
          detail={summary.biggestLeak ? `${summary.biggestLeak.trades} trades · ${money(summary.biggestLeak.netPnl)} net · ${pct(summary.biggestLeak.winRate)} win rate.` : 'Mistake tags need a few repeated samples before the journal can identify the main leak.'}
          tone="red"
        />
        <EdgeCard
          eyebrow="Recent Trend"
          title={previous ? `Last ${momentum.sampleSize} vs prior ${momentum.sampleSize}` : `Last ${momentum.sampleSize || 0} trades`}
          value={money(current.netPnl || 0)}
          detail={previous ? `${money(momentum.expectancyDelta)} expectancy change · ${pct(momentum.winRateDelta)} win-rate change.` : 'Not enough previous trades to compare yet.'}
          tone={trendTone}
        />
      </div>
      <DataQualityPanel report={quality} gap={summary.dataGap} />
    </section>
  );
}

function EdgeCard({ eyebrow, title, value, detail, tone = 'neutral' }) {
  return (
    <article className={`edge-card ${tone}`}>
      <span>{eyebrow}</span>
      <h3>{title}</h3>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function DataQualityPanel({ report, gap }) {
  return (
    <div className="quality-panel">
      <div className="quality-head">
        <div>
          <span className="eyebrow">Journal Quality</span>
          <h3>{pct(report.score)} complete</h3>
        </div>
        {gap && <p className="muted">Biggest cleanup group: {gap.label} ({gap.trades} trades)</p>}
      </div>
      <div className="quality-grid">
        {report.items.map((item) => (
          <div key={item.label} className={`quality-item ${item.tone}`}>
            <div>
              <span>{item.label}</span>
              <strong>{pct(item.value)}</strong>
            </div>
            <div className="quality-track"><i style={{ width: `${Math.min(100, Math.max(0, item.value))}%` }} /></div>
            <small>{item.detail}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function FocusPanel({ items }) {
  return (
    <section className="panel focus-panel">
      <div className="panel-head"><div><span className="eyebrow">Next Review</span><h2>Focus Areas</h2></div><Target size={18} /></div>
      <div className="focus-list">
        {items.map((item) => (
          <article key={`${item.title}-${item.value}`} className={item.tone}>
            <span>{item.title}</span>
            <strong>{item.value}</strong>
            <p>{item.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DistributionPanel({ title, rows }) {
  const maxTrades = Math.max(1, ...rows.map((row) => row.trades));
  return (
    <section className="panel distribution-panel">
      <div className="panel-head"><h2>{title}</h2></div>
      <div className="distribution-list">
        {rows.map((row) => {
          const width = `${Math.max(8, (row.trades / maxTrades) * 100)}%`;
          const tone = row.stats.netPnl >= 0 ? 'positive' : 'negative';
          return (
            <div key={row.label} className="distribution-row">
              <div className="distribution-top">
                <span>{row.label}</span>
                <strong className={row.stats.netPnl >= 0 ? 'green' : 'red'}>{money(row.stats.netPnl)}</strong>
              </div>
              <div className="distribution-track"><i className={tone} style={{ width }} /></div>
              <small>{row.trades} trades · {pct(row.stats.winRate)} win rate · {money(row.stats.expectancy)} expectancy</small>
            </div>
          );
        })}
        {!rows.length && <p className="muted">No distribution data yet.</p>}
      </div>
    </section>
  );
}

function MatrixPanel({ title, matrix, wide = false }) {
  return (
    <section className={`panel matrix-panel ${wide ? 'wide' : ''}`}>
      <div className="panel-head"><h2>{title}</h2></div>
      {matrix.rows.length ? (
        <div className="matrix-scroll">
          <table className="matrix-table">
            <thead>
              <tr>
                <th>Segment</th>
                {matrix.columns.map((column) => <th key={column}>{column}</th>)}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.label}>
                  <th>{row.label}</th>
                  {row.columns.map((cell) => (
                    <td key={`${row.label}-${cell.label}`} className={cell.stats.netPnl >= 0 ? 'positive' : 'negative'}>
                      <strong>{cell.trades ? money(cell.stats.netPnl) : '-'}</strong>
                      {cell.trades > 0 && <small>{cell.trades} trades · {pct(cell.stats.winRate)}</small>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No cross-analysis data yet.</p>
      )}
    </section>
  );
}

function RankPanel({ title, rows }) {
  return (
    <section className="panel">
      <div className="panel-head"><h2>{title}</h2></div>
      <div className="rank-list">
        {rows.map((row, rowIndex) => <div key={`${row[0]}-${rowIndex}`}>{row.map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`}>{cell}</span>)}</div>)}
        {!rows.length && <p className="muted">No data yet.</p>}
      </div>
    </section>
  );
}

function DailyEntryPanel({ entries, onSave }) {
  const [entry, setEntry] = useState({
    date: today,
    outlook: '',
    plan: '',
    emotions: '',
    news: '',
    symbols: '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setEntry((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const text = [
      entry.outlook && `Outlook: ${entry.outlook}`,
      entry.plan && `Game plan: ${entry.plan}`,
      entry.emotions && `Emotions: ${entry.emotions}`,
      entry.news && `News: ${entry.news}`,
      entry.symbols && `Symbols: ${entry.symbols}`,
    ].filter(Boolean).join('\n\n');
    setSaving(true);
    setMessage('');
    try {
      await onSave({ ...entry, text });
      setEntry({ date: today, outlook: '', plan: '', emotions: '', news: '', symbols: '' });
      setMessage('Daily entry saved.');
    } catch (error) {
      setMessage(error.message || 'Daily entry could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Daily Entry</span><h2>Session Plan</h2></div><CalendarDays size={18} /></div>
      {message && <Notice tone={/saved/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
      <div className="form-grid">
        <Field label="Date"><input type="date" value={entry.date} onChange={(event) => update('date', event.target.value)} /></Field>
        <Field label="Outlook"><input value={entry.outlook} onChange={(event) => update('outlook', event.target.value)} placeholder="Bullish, bearish, mixed, no trade." /></Field>
        <Field label="Emotions"><input value={entry.emotions} onChange={(event) => update('emotions', event.target.value)} placeholder="Calm, rushed, tired, patient." /></Field>
      </div>
      <Field label="Game Plan"><textarea className="small-textarea" value={entry.plan} onChange={(event) => update('plan', event.target.value)} placeholder="What needs to happen before you are allowed to trade?" /></Field>
      <div className="split-panels compact">
        <Field label="Major News"><textarea className="small-textarea" value={entry.news} onChange={(event) => update('news', event.target.value)} placeholder="Event, time, expected impact." /></Field>
        <Field label="Symbols Analysis"><textarea className="small-textarea" value={entry.symbols} onChange={(event) => update('symbols', event.target.value)} placeholder="NQ/MNQ context, bias, key levels." /></Field>
      </div>
      <button className="primary" type="button" onClick={save} disabled={saving || (!entry.outlook.trim() && !entry.plan.trim() && !entry.symbols.trim())}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save Daily Entry</button>
      <div className="entry-list">{entries.map((item) => <article key={item.id}><span>{item.date || item.createdAt?.slice(0, 10)}</span><p>{item.text}</p></article>)}</div>
    </section>
  );
}

function AnalysisPanel({ analyses, onSave }) {
  const [analysis, setAnalysis] = useState({
    date: today,
    title: 'Weekly Analysis',
    whatWorked: '',
    whatFailed: '',
    pattern: '',
    nextFocus: '',
  });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setAnalysis((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const text = [
      analysis.whatWorked && `What worked: ${analysis.whatWorked}`,
      analysis.whatFailed && `What failed: ${analysis.whatFailed}`,
      analysis.pattern && `Pattern: ${analysis.pattern}`,
      analysis.nextFocus && `Next focus: ${analysis.nextFocus}`,
    ].filter(Boolean).join('\n\n');
    setSaving(true);
    setMessage('');
    try {
      await onSave({ ...analysis, text });
      setAnalysis({ date: today, title: 'Weekly Analysis', whatWorked: '', whatFailed: '', pattern: '', nextFocus: '' });
      setMessage('Analysis saved.');
    } catch (error) {
      setMessage(error.message || 'Analysis could not be saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Review</span><h2>Analysis</h2></div><LineChart size={18} /></div>
      {message && <Notice tone={/saved/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
      <div className="form-grid">
        <Field label="Date"><input type="date" value={analysis.date} onChange={(event) => update('date', event.target.value)} /></Field>
        <Field label="Title"><input value={analysis.title} onChange={(event) => update('title', event.target.value)} /></Field>
      </div>
      <div className="split-panels compact">
        <Field label="What Worked"><textarea className="small-textarea" value={analysis.whatWorked} onChange={(event) => update('whatWorked', event.target.value)} /></Field>
        <Field label="What Failed"><textarea className="small-textarea" value={analysis.whatFailed} onChange={(event) => update('whatFailed', event.target.value)} /></Field>
      </div>
      <div className="split-panels compact">
        <Field label="Pattern"><textarea className="small-textarea" value={analysis.pattern} onChange={(event) => update('pattern', event.target.value)} /></Field>
        <Field label="Next Focus"><textarea className="small-textarea" value={analysis.nextFocus} onChange={(event) => update('nextFocus', event.target.value)} /></Field>
      </div>
      <button className="primary" type="button" onClick={save} disabled={saving || (!analysis.whatWorked.trim() && !analysis.whatFailed.trim() && !analysis.pattern.trim())}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Save Analysis</button>
      <div className="entry-list">{analyses.map((item) => <article key={item.id}><span>{item.date || item.createdAt?.slice(0, 10)}</span><h3>{item.title || 'Analysis'}</h3><p>{item.text}</p></article>)}</div>
    </section>
  );
}

function Accounts({ trades, accounts, onSave, onAssign }) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [assigning, setAssigning] = useState(false);
  const moveIds = trades.filter(t => t.accountId === sourceId).map(t => t.id);
  async function moveTrades() {
    if (!window.confirm(`Move ${moveIds.length} trades from ${accounts.find(a => a.id === sourceId)?.name} to ${accounts.find(a => a.id === targetId)?.name}? Notes and screenshots will be preserved. A recovery backup will be created first.`)) return;
    setAssigning(true);
    try { await onAssign(moveIds, targetId); setAssignmentMessage('Trades assigned.'); } catch (error) { setAssignmentMessage(error.message); } finally { setAssigning(false); }
  }
  const summaries = accountSummaries(trades, accounts);
  const [draft, setDraft] = useState(accounts.length ? accounts : [{ id: 'personal', name: 'Personal', startingBalance: 0 }]);

  useEffect(() => {
    setDraft(accounts.length ? accounts : [{ id: 'personal', name: 'Personal', startingBalance: 0 }]);
  }, [accounts]);

  function update(index, key, value) {
    setDraft((current) => current.map((account, itemIndex) => itemIndex === index ? { ...account, [key]: value } : account));
  }

  function addAccount() {
    setDraft((current) => current.concat({ id: globalThis.crypto?.randomUUID?.() || `account-${Date.now()}`, name: 'New Account', startingBalance: 0 }));
  }

  function removeAccount(index) {
    update(index, 'archived', !draft[index].archived);
  }

  return (
    <div className="screen-grid">
      <section className="metrics-grid">
        {summaries.map((account) => (
          <StatCard
            key={account.id}
            Icon={WalletCards}
            label={account.name}
            value={money(account.currentBalance)}
            sub={`${account.trades} trades · ${pct(account.stats.winRate)} win rate · Today: ${money(calculateAdvancedStats(trades.filter(t => t.accountId === account.id && t.date === new Date().toLocaleDateString('en-CA'))).netPnl)}${account.archived ? ' · Archived' : ''}`}
            tone={account.stats.netPnl >= 0 ? 'green' : 'red'}
          />
        ))}
      </section>
      <section className="panel">
        <div className="panel-head">
          <div><span className="eyebrow">Accounts</span><h2>Balances</h2><p>Existing trades keep their history. Edit a trade to assign or move it to an account. Archived accounts remain available for review.</p></div>
          <div className="head-actions">
            <button className="secondary" type="button" onClick={addAccount}><Plus size={16} /> Add Account</button>
            <button className="primary" type="button" onClick={async () => { try { await onSave(draft); window.alert('Accounts saved.'); } catch (error) { window.alert(error.message); } }}><Save size={16} /> Save Accounts</button>
          </div>
        </div>
        <div className="form-grid">
          <Field label="Move history from"><select value={sourceId} onChange={e => setSourceId(e.target.value)}><option value="">Select source account</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}</select></Field>
          <Field label="Move history to"><select value={targetId} onChange={e => setTargetId(e.target.value)}><option value="">Select destination account</option>{accounts.filter(a => !a.archived && a.id !== sourceId).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
          <button className="secondary" type="button" disabled={assigning || !moveIds.length || !targetId || sourceId === targetId} onClick={moveTrades}>Move {moveIds.length} trades</button>
        </div>
        {assignmentMessage && <Notice>{assignmentMessage}</Notice>}
        <div className="account-editor">
          {draft.map((account, index) => (
            <div className="account-edit-row" key={account.id || index}>
              <Field label="Account Name"><input aria-label="Account Name" value={account.name} onChange={(event) => update(index, 'name', event.target.value)} /><small>Account ID: {account.id}</small></Field>
              <Field label="Starting Balance"><input type="number" min="0" step="0.01" value={account.startingBalance || ''} onChange={(event) => update(index, 'startingBalance', Number(event.target.value || 0))} /></Field>
              <button className="secondary" type="button" onClick={() => removeAccount(index)}>{account.archived ? 'Reactivate' : 'Archive'}</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function SettingsPanel({ store, storageStatus, autoBackups = [], onExport, onImport, onClear, onImportNotion, onExportAutoBackup, onRestoreAutoBackup }) {
  const importRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [notionStatus, setNotionStatus] = useState(null);
  const latestBackup = autoBackups[0] || null;

  async function importChanged(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage('');
    try {
      await onImport(file);
      setMessage('Backup imported.');
    } catch (error) {
      setMessage(error.message || 'Backup could not be imported.');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function clearJournal() {
    if (!window.confirm('Clear all local trades, screenshots, playbooks, and notes? Export a backup first if you want to keep them.')) return;
    setBusy(true);
    setMessage('');
    try {
      await onClear();
      setMessage('Journal cleared.');
    } catch (error) {
      setMessage(error.message || 'Journal could not be cleared.');
    } finally {
      setBusy(false);
    }
  }

  async function restoreLatest() {
    if (!latestBackup) return;
    if (!window.confirm('Restore the latest automatic backup? This replaces the current local journal with that backup snapshot.')) return;
    setBusy(true);
    setMessage('');
    try {
      await onRestoreAutoBackup(latestBackup.id);
      setMessage('Automatic backup restored.');
    } catch (error) {
      setMessage(error.message || 'Automatic backup could not be restored.');
    } finally {
      setBusy(false);
    }
  }

  async function exportLatestAutoBackup() {
    if (!latestBackup) return;
    setBusy(true);
    setMessage('');
    try {
      await onExportAutoBackup(latestBackup.id);
      setMessage('Automatic backup downloaded.');
    } catch (error) {
      setMessage(error.message || 'Automatic backup could not be downloaded.');
    } finally {
      setBusy(false);
    }
  }

  async function checkNotion() {
    setBusy(true);
    setMessage('');
    try {
      const result = await testNotionConnection();
      setNotionStatus({ configured: true, hasToken: true, hasDatabaseId: true });
      setMessage(`Connected to Notion database: ${result.title}.`);
    } catch (error) {
      setMessage(error.message || 'Notion connection could not be verified.');
    } finally {
      setBusy(false);
    }
  }

  async function importFromNotion() {
    if (!window.confirm('Import trades from the configured Notion database? Existing imported trades with the same Notion page id will be updated instead of duplicated.')) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await onImportNotion();
      const warningText = result.warnings?.length ? ` ${result.warnings.length} warnings.` : '';
      setMessage(`Imported ${result.imported} Notion trades.${warningText}`);
    } catch (error) {
      setMessage(error.message || 'Notion import failed.');
    } finally {
      setBusy(false);
    }
  }

  const estimate = storageStatus?.estimate;
  const used = estimate?.usage ? formatBytes(estimate.usage) : 'Unknown';
  const quota = estimate?.quota ? formatBytes(estimate.quota) : 'Unknown';
  const tradeCount = store?.trades?.length || 0;
  const shotCount = (store?.trades || []).reduce((sum, trade) => sum + (trade.screenshots?.length || 0), 0);

  return (
    <section className="panel">
      <div className="panel-head"><div><span className="eyebrow">Local App</span><h2>Settings</h2></div><Settings size={18} /></div>
      {message && <Notice tone={/connected|imported|cleared|restored|downloaded/i.test(message) ? 'success' : 'error'}>{message}</Notice>}
      {!storageStatus?.persisted && (
        <Notice tone="error">Your browser did not confirm persistent storage. Export backups often so your screenshots are not lost if browser data is cleared.</Notice>
      )}
      <div className="settings-grid">
        <div className="settings-card">
          <Database size={20} />
          <h3>Local Storage</h3>
          <p>Your trades and screenshots are saved in this browser on this computer.</p>
          <code>{tradeCount} trades · {shotCount} screenshots · {used} used / {quota} available</code>
          <button className="secondary" type="button" disabled={busy} onClick={onExport}><Download size={16} /> Export Backup</button>
          <button className="secondary" type="button" disabled={busy} onClick={() => importRef.current?.click()}><UploadCloud size={16} /> Import Backup</button>
          <input ref={importRef} type="file" accept=".zip,application/zip" hidden onChange={importChanged} />
        </div>
        <div className="settings-card">
          <RefreshCcw size={20} />
          <h3>Automatic Backups</h3>
          <p>The app keeps recent recovery snapshots after saves and before resets. Export ZIP backups for protection outside this browser.</p>
          <code>{autoBackups.length} saved · Latest {latestBackup ? formatDateTime(latestBackup.createdAt) : 'not created yet'}</code>
          {latestBackup && <small>{latestBackup.tradeCount} trades · {latestBackup.shotCount} screenshots · {formatBytes(latestBackup.size)}</small>}
          <button className="secondary" type="button" disabled={busy || !latestBackup} onClick={exportLatestAutoBackup}><Download size={16} /> Download Latest Auto Backup</button>
          <button className="secondary" type="button" disabled={busy || !latestBackup} onClick={restoreLatest}><RefreshCcw size={16} /> Restore Latest Auto Backup</button>
        </div>
        <div className="settings-card price-card">
          <CheckCircle2 size={20} />
          <h3>Private By Default</h3>
          <strong>Offline-first</strong>
          <p>No login, external account, or paid service is required for this template.</p>
        </div>
        <div className="settings-card">
          <Download size={20} />
          <h3>Optional Notion Import</h3>
          <p>Import an existing Notion trading database into this local journal. The token stays in your local `.env.local`, never in the browser.</p>
          <code>{notionStatus?.configured ? 'Configured' : 'Click Check Connection after adding NOTION_TOKEN and NOTION_DATABASE_ID'}</code>
          <button className="secondary" type="button" disabled={busy} onClick={checkNotion}><RefreshCcw size={16} /> Check Connection</button>
          <button className="secondary" type="button" disabled={busy || !notionStatus?.configured} onClick={importFromNotion}><Download size={16} /> Import From Notion</button>
        </div>
        <div className="settings-card">
          <Trash2 size={20} />
          <h3>Reset Journal</h3>
          <p>Use this only when you want to return the template to a clean empty state.</p>
          <button className="secondary danger" type="button" disabled={busy} onClick={clearJournal}><Trash2 size={16} /> Clear Local Data</button>
        </div>
      </div>
    </section>
  );
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDateTime(value) {
  if (!value) return 'never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  return (
    <BrowserRouter>
      <ProductionApp />
    </BrowserRouter>
  );
}

function ProductionApp() {
  useEffect(()=>{
    const desktop=window.matchMedia('(min-width:851px)');
    const ensureDesktop=()=>{const sidebar=document.querySelector('.sidebar');if(desktop.matches&&sidebar)sidebar.open=true;};
    desktop.addEventListener('change',ensureDesktop);
    return ()=>desktop.removeEventListener('change',ensureDesktop);
  },[]);

  const [store, setStore] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [message, setMessage] = useState('');
  const [editingTrade, setEditingTrade] = useState(null);
  const [storageStatus, setStorageStatus] = useState(null);
  const [autoBackups, setAutoBackups] = useState([]);
  const routerNavigate = useNavigate();
  const location = useLocation();
  const route = location.pathname || '/';
  // Account changes can arrive while React Router is completing a review navigation.
  useEffect(()=>{
    if(!selectedAccountId||!route.startsWith('/app/trade/'))return;
    const tradeId=decodeURIComponent(route.slice('/app/trade/'.length));
    const reviewed=store?.trades.find(t=>t.id===tradeId);
    if(reviewed&&reviewed.accountId!==selectedAccountId)routerNavigate('/app');
  },[route,selectedAccountId,store,routerNavigate]);


  function navigate(path) {
    const next = appPath(path);
    if (route !== next) routerNavigate(next);
    if (next === '/pricing') {
      scrollToPublicSection('pricing-card');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function load() {
    const nextStore = await loadLocalStore();
    setStore(nextStore);
    setSelectedAccountId(current => nextStore.accounts.some(a => a.id === current) ? current : '');
    setAutoBackups(await listLocalAutoBackups());
    return nextStore;
  }

  async function refreshAutoBackups() {
    setAutoBackups(await listLocalAutoBackups());
  }

  useEffect(() => {
    requestPersistentStorage()
      .then(setStorageStatus)
      .catch(() => setStorageStatus({ supported: false, persisted: false, estimate: null }));
    load()
      .catch((error) => {
        setMessage(error.message);
      });
  }, []);

  async function removeTrade(id) {
    const nextStore = await deleteLocalTrade(store, id);
    setStore(nextStore);
    await refreshAutoBackups();
  }

  function editTrade(trade) {
    setMessage('');
    setEditingTrade(trade);
    navigate('/app/capture');
  }

  async function toggleReview(trade) {
    const nextStatus = normalizeReviewStatus(trade) === 'reviewed' ? 'needs_review' : 'reviewed';
    const nextStore = await saveLocalTrade(store, { ...trade, reviewStatus: nextStatus, reviewed: nextStatus === 'reviewed' });
    setStore(nextStore);
    await refreshAutoBackups();
  }

  async function saveItem(collection, item) {
    const nextStore = await saveLocalItem(store, collection, item);
    setStore(nextStore);
    await refreshAutoBackups();
  }

  async function saveAccounts(accounts) {
    const nextStore = await saveLocalAccounts(store, accounts);
    setStore(nextStore);
    await refreshAutoBackups();
  }

  async function savePlaybooks(playbooks) {
    const nextStore = await saveLocalPlaybooks(store, playbooks);
    setStore(nextStore);
    await refreshAutoBackups();
  }

  async function saveSettings(settings) {
    const nextStore = await saveLocalSettings(store, settings);
    setStore(nextStore);
    await refreshAutoBackups();
  }

  async function saveTrade(payload, executions, submissionId) {
    setMessage('');
    const next=executions?await saveLocalTradeBatch(store,payload,executions,submissionId):await saveLocalTrade(store,payload);
    setStore(next);
    return next;
  }

  async function exportBackup() {
    const blob = await exportLocalBackup(store);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trading-journal-backup-${today}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Backup exported.');
  }

  async function importBackup(file) {
    const imported = await importLocalBackup(file);
    const nextStore = await mergeImportedStore(store, imported);
    setStore(nextStore);
    await refreshAutoBackups();
    setMessage('Backup imported.');
  }

  async function importNotion() {
    const result = await importNotionTrades();
    await createLocalAutoBackup(store, 'before_notion_import');
    const incoming = normalizeStore({ accounts: store.accounts, trades: result.trades || [] });
    const rows = new Map(store.trades.map(t => [t.id, t]));
    for (const trade of incoming.trades) rows.set(trade.id, { ...trade, accountId: rows.get(trade.id)?.accountId || trade.accountId });
    const nextStore = await writeLocalStore({ ...store, accounts: incoming.accounts, trades: [...rows.values()] });
    setStore(nextStore);
    await refreshAutoBackups();
    setMessage(`Imported ${result.imported} Notion trades.`);
    return result;
  }

  async function clearJournal() {
    const nextStore = await clearLocalStore();
    setStore(nextStore);
    setEditingTrade(null);
    setSelectedAccountId('');
    await refreshAutoBackups();
    setMessage('Journal cleared.');
    navigate('/app');
  }

  async function exportAutoBackup(backupId) {
    const blob = await exportLocalAutoBackup(backupId);
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `trading-journal-auto-backup-${today}.zip`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('Automatic backup downloaded.');
  }

  async function restoreAutoBackup(backupId) {
    const nextStore = await restoreLocalAutoBackup(backupId);
    setStore(nextStore);
    setEditingTrade(null);
    setSelectedAccountId('');
    await refreshAutoBackups();
    setMessage('Automatic backup restored.');
    navigate('/app');
  }

  if (!store) {
    return <main className="app-shell loading">{message ? <section className="panel"><Notice tone="error">{message} Your saved journal has not been replaced.</Notice><button className="secondary" onClick={() => window.location.reload()}>Retry loading</button><button className="secondary" onClick={() => exportAutoBackup()}>Download Latest Auto Backup</button><button className="secondary" onClick={async () => { if (window.confirm('Restore the latest automatic backup? This replaces the saved journal after creating a recovery snapshot.')) { try { await restoreAutoBackup(); } catch (error) { setMessage(error.message); } } }}>Restore Latest Auto Backup</button></section> : <><Loader2 className="spin" /> Loading Trading Journal...</>}</main>;
  }

  const trades = (store.trades || []).map(t => ({ ...t, account: store.accounts.find(a => a.id === t.accountId)?.name || t.account }));
  const allTradeRecords = trades.filter(isTradeRecord);
  const tradeRecords = allTradeRecords.filter(t => !selectedAccountId || t.accountId === selectedAccountId);
  const selectedAccounts = (store.accounts || []).filter(a => !selectedAccountId || a.id === selectedAccountId);
  const appRoute = route === '/' ? '/app' : route;
  const rawTabFromRoute = appRoute.replace(/^\/app\/?/u, '') || 'dashboard';
  const tabFromRoute = ['analytics', 'analysis', 'queue'].includes(rawTabFromRoute) ? 'reports' : rawTabFromRoute;
  const tradeDetailMatch = /^trade\/(.+)$/u.exec(tabFromRoute);
  const tradeDetailId = tradeDetailMatch ? decodeURIComponent(tradeDetailMatch[1]) : '';
  const detailTrade = tradeDetailId ? allTradeRecords.find((trade) => trade.id === tradeDetailId) : null;
  const appTabs = tabs;
  const visibleAppTabs = appTabs.filter((item) => visibleTabIds.has(item.id));
  const unknownAppRoute = appRoute.startsWith('/app/') && !tradeDetailMatch && !appTabs.some((item) => item.id === tabFromRoute);
  const tab = tradeDetailMatch
    ? 'trade-detail'
    : unknownAppRoute
        ? 'not-found'
        : appTabs.some((item) => item.id === tabFromRoute) ? tabFromRoute : 'dashboard';
  const activeTab = tab === 'not-found'
      ? { label: 'Not Found', Icon: AlertCircle }
      : tab === 'trade-detail'
        ? { label: 'Trade Review', Icon: Eye }
        : appTabs.find((item) => item.id === tab) || appTabs[0];
  const ActiveIcon = activeTab.Icon || LayoutDashboard;
  const setTab = (id) => navigate(id === 'dashboard' ? '/app' : `/app/${id}`);
  const openTradeReview = (trade) => navigate(`/app/trade/${encodeURIComponent(trade.id)}`);

  return (
    <main className="app-shell journal-layout">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="app-mark">TJ</span>
          <div><p className="eyebrow">Local-first journal</p><h1>Trading Journal Template</h1></div>
        </div>
        <div className="topbar-actions">
          <select aria-label="View account" value={selectedAccountId} onChange={event => { setSelectedAccountId(event.target.value); setEditingTrade(null); if (tab === 'trade-detail') setTab('dashboard'); }}><option value="">All Accounts</option>{(store.accounts || []).map(a => <option key={a.id} value={a.id}>{a.name}{a.archived ? ' (archived)' : ''}</option>)}</select>
          <button className="secondary" type="button" onClick={exportBackup}><Download size={16} /> Export Backup</button>
          <button className="primary" onClick={() => setTab('capture')}><Plus size={17} /> Add Trade</button>
        </div>
      </header>

      <details className="sidebar" open onToggle={e=>{if(window.innerWidth>850&&!e.currentTarget.open)e.currentTarget.open=true;}}><summary><Menu size={18}/> Navigation</summary><div className="sidebar-brand"><span className="app-mark">E</span><div>EMPRA<small>TRADING JOURNAL</small></div></div><nav className="app-nav" aria-label="Main navigation">
        {visibleAppTabs.map(({ id, label, Icon }) => (
          <button key={id} aria-current={tab===id||(tab==='trade-detail'&&id==='log')?'page':undefined} className={tab === id || (tab === 'trade-detail' && id === 'log') ? 'active' : ''} onClick={() => setTab(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav></details>

      {message && <Notice tone={/imported|exported|saved|deleted|cleared/i.test(message) ? 'success' : 'error'}>{message}</Notice>}

      {tab !== 'trade-detail' && (
        <section className="section-title">
          <ActiveIcon size={20} />
          <h2>{activeTab.label}</h2>
        </section>
      )}

      {tab === 'not-found' && <section className="panel"><Notice tone="error">This app route does not exist.</Notice></section>}
      {tab === 'dashboard' && <Dashboard key={selectedAccountId} trades={tradeRecords} accounts={selectedAccounts} settings={store.settings || {}} setTab={setTab} onSaveSettings={saveSettings} onReview={openTradeReview} />}
      {tab === 'capture' && <Capture key={selectedAccountId} defaultAccountId={selectedAccounts.length === 1 && !selectedAccounts[0].archived ? selectedAccounts[0].id : ""} activeTrade={editingTrade} accounts={store.accounts || []} playbooks={store.playbooks || []} onCancelEdit={() => setEditingTrade(null)} onSaveTrade={saveTrade} onSaved={async () => { setEditingTrade(null); await load(); setMessage('Trade saved.'); }} />}
      {tab === 'log' && <TradeLog trades={tradeRecords.map(t=>({...t, riskSession: tradeSession(t,store.accounts.find(a=>a.id===t.accountId))}))} onDelete={removeTrade} onEdit={editTrade} onReview={openTradeReview} onToggleReview={toggleReview} />}
      {tab === 'trade-detail' && (detailTrade
        ? <TradeDetailPage trade={detailTrade} playbooks={store.playbooks || []} onBack={() => setTab('log')} onEdit={editTrade} onToggleReview={async (trade) => { await toggleReview(trade); await load(); }} />
        : <section className="panel"><Notice tone="error">This trade could not be found.</Notice><button className="secondary" type="button" onClick={() => setTab('log')}>Back to Trade Log</button></section>)}
      {tab === 'playbooks' && <PlaybooksPanel playbooks={store.playbooks || []} trades={tradeRecords} onSave={savePlaybooks} />}
      {tab === 'reports' && <Insights key={selectedAccountId} trades={tradeRecords} onReview={openTradeReview} />}
      {tab === 'discipline' && <DisciplinePanel key={selectedAccountId} store={store} accountId={selectedAccountId} onSave={async record=>{setStore(await saveLocalDiscipline(store,record));await refreshAutoBackups();}} onReview={openTradeReview} />}
      {tab === 'risk' && <RiskPanel key={selectedAccountId} store={store} accountId={selectedAccountId} onSave={saveAccounts} />}
      {tab === 'accounts' && <Accounts trades={allTradeRecords} accounts={store.accounts || []} onSave={saveAccounts} onAssign={async (ids, accountId) => { setStore(await assignLocalTrades(store, ids, accountId)); await refreshAutoBackups(); }} />}
      {tab === 'daily' && <DailyEntryPanel entries={store.entries || []} onSave={(entry) => saveItem('entries', entry)} />}
      {tab === 'settings' && <SettingsPanel store={store} storageStatus={storageStatus} autoBackups={autoBackups} onExport={exportBackup} onImport={importBackup} onClear={clearJournal} onImportNotion={importNotion} onExportAutoBackup={exportAutoBackup} onRestoreAutoBackup={restoreAutoBackup} />}
    </main>
  );
}
