import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  Gauge,
  Pencil,
  Save,
  Search,
  Settings,
  Sparkles,
  Star,
  Store,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';

const STORAGE_KEYS = {
  machines: 'pachi_complete_machines_v12',
  sessions: 'pachi_complete_sessions_v12',
  settings: 'pachi_complete_settings_v12',
};

const EXCHANGE_PRESETS = {
  '25': { label: '25個(等価)', yenPerBall: 4.0, short: '等価' },
  '28': { label: '28個', yenPerBall: 3.57, short: '28個' },
  '30': { label: '30個', yenPerBall: 3.33, short: '30個' },
  '33': { label: '33個', yenPerBall: 3.03, short: '33個' },
  '40': { label: '40個', yenPerBall: 2.5, short: '40個' },
};

const EXCHANGE_ORDER = ['25', '28', '30', '33', '40'];

const defaultSettings = {
  evCalcMode: 'borderDiff',
  customEvPerSpinDiffPer1000Yen: 800,
  defaultCashUnitYen: 1000,
  subCashUnitYen: 500,
  defaultBallUnit: 250,
  yearMonthModeDefault: 'month',
  judgePlayDiff: 0.5,
  judgeWatchDiff: 0.0,
  expectedHours: 4,
  spinsPerHour: 200,
  shopProfiles: [],
};

function uid() {
  return crypto.randomUUID();
}

const defaultMachines = [
  {
    id: uid(),
    name: 'Pエヴァ15 未来への咆哮',
    shopDefault: '',
    border25: 17.8,
    border28: 18.7,
    border30: 19.4,
    border33: 20.2,
    border40: 0,
    payoutPerRound: 140,
    expectedBallsPerHit: 1400,
    totalProbability: 0,
    memo: '',
  },
  {
    id: uid(),
    name: 'ぱちんこ シン・エヴァンゲリオン Type レイ',
    shopDefault: '',
    border25: 17.1,
    border28: 18.1,
    border30: 18.6,
    border33: 19.5,
    border40: 0,
    payoutPerRound: 140,
    expectedBallsPerHit: 1400,
    memo: '',
  },
  {
    id: uid(),
    name: 'Pスーパー海物語IN沖縄6',
    shopDefault: '',
    border25: 18.0,
    border28: 0,
    border30: 0,
    border33: 0,
    border40: 0,
    payoutPerRound: 140,
    expectedBallsPerHit: 1400,
    memo: '',
  },
];

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthKey(dateStr) {
  return (dateStr || '').slice(0, 7);
}

function yearKey(dateStr) {
  return (dateStr || '').slice(0, 4);
}

function dateLabel(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clampNumber(v, min, max) {
  return Math.max(min, Math.min(max, numberOrZero(v)));
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function fmtYen(v) {
  return `${Math.round(v || 0).toLocaleString()}円`;
}

function fmtRate(v) {
  return Number.isFinite(v) ? Number(v).toFixed(2) : '-';
}

function fmtBall(v) {
  return `${Math.round(v || 0).toLocaleString()}玉`;
}

function cloneDeep(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSaveStatusMeta(status) {
  if (status === 'saving') return { label: '保存中…', className: 'text-amber-300' };
  if (status === 'saved') return { label: '保存済み', className: 'text-emerald-300' };
  return { label: '未保存変更あり', className: 'text-sky-300' };
}

function getRestartReasonLabel(reason, note = '') {
  if (reason === 'st') return '確変/ST後';
  if (reason === 'jitan') return '時短抜け後';
  if (reason === 'other') return note || 'その他';
  return '単発後';
}

function getChainResultLabel(chainCount) {
  const count = numberOrZero(chainCount);
  if (count <= 0) return '-';
  if (count === 1) return '単発';
  return `${count}連`;
}

function formatExpectationValue(value, unit) {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value || 0);
  if (unit === 'yen') return `${rounded >= 0 ? '+' : ''}${rounded.toLocaleString()}円`;
  return `${rounded >= 0 ? '+' : ''}${rounded.toLocaleString()}玉`;
}

function getBorderFieldByCategory(category) {
  if (category === '28') return 'border28';
  if (category === '30') return 'border30';
  if (category === '33') return 'border33';
  if (category === '40') return 'border40';
  return 'border25';
}

function getMachineBorderByCategory(machine, category) {
  if (!machine) return 0;
  return numberOrZero(machine[getBorderFieldByCategory(category)]);
}

function getExchangePreset(category) {
  return EXCHANGE_PRESETS[category] || EXCHANGE_PRESETS['25'];
}

function getShopProfileByName(shopProfiles, shopName) {
  const target = String(shopName || '').trim().toLowerCase();
  if (!target) return null;
  return (shopProfiles || []).find((profile) => String(profile.name || '').trim().toLowerCase() === target) || null;
}

function getWorkVolumeBalls(metrics) {
  return metrics.exchangeRate > 0 ? metrics.estimatedEVYen / metrics.exchangeRate : 0;
}

function calcTheoreticalValueMetrics(metrics, machine, hours, settings) {
  const rate = numberOrZero(metrics.spinPerThousand);
  const exchangeRate = numberOrZero(metrics.exchangeRate);
  const totalSpins = numberOrZero(metrics.totalSpins);
  const enteredHours = numberOrZero(hours);
  const totalProbability = numberOrZero(machine?.totalProbability);
  const averagePayout = numberOrZero(machine?.expectedBallsPerHit);
  const oneRoundPayout = numberOrZero(machine?.payoutPerRound);
  const holdRatio = clampNumber(metrics.holdBallRatio / 100, 0, 1);
  const normalSpinsPerHour = enteredHours > 0 && totalSpins > 0 ? totalSpins / enteredHours : numberOrZero(settings.spinsPerHour);

  if (rate <= 0 || exchangeRate <= 0 || totalProbability <= 0 || averagePayout <= 0) {
    return {
      totalProbability,
      averagePayout,
      oneRoundPayout,
      normalSpinsPerHour,
      holdUnitPriceYen: null,
      cashUnitPriceYen: null,
      mixedUnitPriceYen: null,
      workVolumeYen: null,
      workVolumeBalls: null,
      theoreticalHourlyYen: null,
    };
  }

  const holdUnitPriceYen = (averagePayout / totalProbability - 250 / rate) * exchangeRate;
  const cashUnitPriceYen = averagePayout / totalProbability * exchangeRate - 1000 / rate;
  const mixedUnitPriceYen = holdUnitPriceYen * holdRatio + cashUnitPriceYen * (1 - holdRatio);
  const workVolumeYen = mixedUnitPriceYen * totalSpins;
  const workVolumeBalls = exchangeRate > 0 ? workVolumeYen / exchangeRate : null;
  const theoreticalHourlyYen = normalSpinsPerHour > 0 ? mixedUnitPriceYen * normalSpinsPerHour : null;

  return {
    totalProbability,
    averagePayout,
    oneRoundPayout,
    normalSpinsPerHour,
    holdUnitPriceYen,
    cashUnitPriceYen,
    mixedUnitPriceYen,
    workVolumeYen,
    workVolumeBalls,
    theoreticalHourlyYen,
  };
}

function getContinueMoveDecision(currentDiff, candidateDiff) {
  if (candidateDiff - currentDiff >= 0.5) {
    return { verdict: '移動候補', comment: '候補台のほうが数字は上だぜ。空き台なら移動を検討だ。', positive: false };
  }
  if (currentDiff - candidateDiff >= 0.5) {
    return { verdict: '続行寄り', comment: '今の台のほうが強い。無理に動かなくてよさそうだぜ。', positive: true };
  }
  return { verdict: '様子見', comment: '大差はない。残り時間や店内状況で決めるのがよさそうだぜ。', positive: undefined };
}

function buildSectionRateHistoryPoints(session, settings) {
  const archivedPoints = session.rateHistoryPoints || [];
  const exchangeRate = getExchangePreset(session.exchangeCategory || '25').yenPerBall || 4;
  let baseSpins = archivedPoints.length ? numberOrZero(archivedPoints[archivedPoints.length - 1].totalSpins) : 0;
  let baseCashInvestYen = archivedPoints.length ? numberOrZero(archivedPoints[archivedPoints.length - 1].cashInvestYen) : 0;
  let baseBallInvestYen = archivedPoints.length ? numberOrZero(archivedPoints[archivedPoints.length - 1].ballInvestYen) : 0;
  let prevReading = numberOrZero(session.startRotation);
  const sectionIndex = (session.rateSections || []).length + 1;

  return (session.rateEntries || []).flatMap((entry, index) => {
    const reading = numberOrZero(entry.reading);
    if (!(reading > 0 && reading >= prevReading)) return [];
    const amount = numberOrZero(entry.amount);
    const spins = reading - prevReading;
    if (entry.kind === 'balls') {
      baseBallInvestYen += amount * exchangeRate;
    } else {
      baseCashInvestYen += amount;
    }
    baseSpins += spins;
    prevReading = reading;
    const totalInvestYen = baseCashInvestYen + baseBallInvestYen;
    const cumulativeRate = totalInvestYen > 0 ? baseSpins / (totalInvestYen / 1000) : 0;
    return [{
      id: `rate-point-${sectionIndex}-${entry.id}`,
      label: `${sectionIndex}-${index + 1}`,
      totalSpins: baseSpins,
      cashInvestYen: baseCashInvestYen,
      ballInvestYen: baseBallInvestYen,
      totalInvestYen,
      rate: cumulativeRate,
      reading,
      mode: entry.kind,
    }];
  });
}

function getSessionTrendData(session, settings) {
  const archivedPoints = session.rateHistoryPoints || [];
  const livePoints = buildSectionRateHistoryPoints(session, settings);
  return [...archivedPoints, ...livePoints];
}

function emptyRateEntry(kind = 'cash', amount = 1000, reading = '') {
  return {
    id: uid(),
    kind,
    amount: String(amount),
    reading,
  };
}

function emptySession(settings = defaultSettings) {
  return {
    id: uid(),
    date: todayStr(),
    shop: '',
    machineId: '__none__',
    machineNameSnapshot: '',
    machineFreeName: '',
    machineNumber: '',
    exchangeCategory: '25',
    startRotation: '',
    sessionBorderOverride: '',
    totalSpinsManual: '',
    returnedBalls: '',
    endingBalls: '',
    endingUpperBalls: '',
    actualBalanceYen: '',
    hours: '',
    notes: '',
    resultGoodMemo: '',
    resultBadMemo: '',
    rateHistoryPoints: [],
    tags: '',
    photos: [],
    firstHits: [],
    rateSections: [],
    currentInputMode: 'cash',
    status: 'draft',
    updatedAt: Date.now(),
    rateEntries: [emptyRateEntry('cash', settings.defaultCashUnitYen, '')],
  };
}

function hasMeaningfulSession(session) {
  return Boolean(
    session.shop ||
    session.machineId !== '__none__' ||
    session.machineFreeName ||
    session.machineNumber ||
    session.startRotation ||
    session.sessionBorderOverride ||
    session.notes ||
    session.tags ||
    (session.rateEntries || []).some((entry) => entry.reading || numberOrZero(entry.amount) > 0) ||
    (session.firstHits || []).length > 0 ||
    (session.rateSections || []).length > 0 ||
    (session.photos || []).length > 0
  );
}

function getDayStrength(balance, ev) {
  if (balance >= 50000 || ev >= 30000) return 'great';
  if (balance > 0 || ev > 0) return 'good';
  if (balance <= -50000 || ev <= -30000) return 'bad';
  if (balance < 0 || ev < 0) return 'weak';
  return 'none';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function appendLine(existing, line) {
  if (!line) return existing || '';
  return existing ? `${existing}
${line}` : line;
}

function calcEvYenFromRate(rate, border, investYen, settings) {
  if (border <= 0) return 0;
  const diff = rate - border;
  let evPer1000Yen = 0;
  if ((settings.evCalcMode || 'borderDiff') === 'customCoef') {
    evPer1000Yen = diff * numberOrZero(settings.customEvPerSpinDiffPer1000Yen || 800);
  } else {
    evPer1000Yen = border > 0 ? (diff / border) * 1000 : 0;
  }
  return evPer1000Yen * (investYen / 1000);
}

function calcRateMetrics(session, machine, settings) {
  const startRotation = numberOrZero(session.startRotation);
  const totalSpinsManual = numberOrZero(session.totalSpinsManual);
  const returnedBalls = numberOrZero(session.returnedBalls);
  const actualBalanceYenRaw = Number(session.actualBalanceYen);
  const hours = numberOrZero(session.hours);
  const exchangePreset = getExchangePreset(session.exchangeCategory || '25');
  const exchangeRate = numberOrZero(exchangePreset.yenPerBall) || 4;
  const machineBorder = session.sessionBorderOverride !== ''
    ? numberOrZero(session.sessionBorderOverride)
    : getMachineBorderByCategory(machine, session.exchangeCategory || '25');

  let currentCashInvestYen = 0;
  let currentBallInvestBalls = 0;
  let computedSpinsFromReadings = 0;
  let lastReading = startRotation;

  (session.rateEntries || []).forEach((entry) => {
    const amount = numberOrZero(entry.amount);
    const reading = numberOrZero(entry.reading);
    const isCompleted = reading > 0 && reading >= lastReading;
    if (!isCompleted) return;

    if (entry.kind === 'balls') {
      currentBallInvestBalls += amount;
    } else {
      currentCashInvestYen += amount;
    }

    computedSpinsFromReadings += reading - lastReading;
    lastReading = reading;
  });

  const currentSpins = totalSpinsManual || computedSpinsFromReadings;
  const currentEndRotation = startRotation + currentSpins;
  const currentBallInvestYen = currentBallInvestBalls * exchangeRate;
  const currentInvestYen = currentCashInvestYen + currentBallInvestYen;
  const currentSpinPerThousand = currentInvestYen > 0 ? currentSpins / (currentInvestYen / 1000) : 0;
  const currentEstimatedEVYen = currentInvestYen > 0 ? calcEvYenFromRate(currentSpinPerThousand, machineBorder, currentInvestYen, settings) : 0;

  const archived = (session.rateSections || []).reduce((acc, section) => {
    acc.spins += numberOrZero(section.spins);
    acc.investYen += numberOrZero(section.investYen);
    acc.cashInvestYen += numberOrZero(section.cashInvestYen);
    acc.ballInvestBalls += numberOrZero(section.ballInvestBalls);
    acc.ballInvestYen += numberOrZero(section.ballInvestYen);
    acc.estimatedEVYen += numberOrZero(section.estimatedEVYen);
    return acc;
  }, {
    spins: 0,
    investYen: 0,
    cashInvestYen: 0,
    ballInvestBalls: 0,
    ballInvestYen: 0,
    estimatedEVYen: 0,
  });

  const totalSpins = archived.spins + currentSpins;
  const endRotation = currentEndRotation;
  const cashInvestYen = archived.cashInvestYen + currentCashInvestYen;
  const ballInvestBalls = archived.ballInvestBalls + currentBallInvestBalls;
  const ballInvestYen = archived.ballInvestYen + currentBallInvestYen;
  const totalInvestYen = archived.investYen + currentInvestYen;
  const spinPerThousand = totalInvestYen > 0 ? totalSpins / (totalInvestYen / 1000) : 0;
  const holdBallRatio = totalInvestYen > 0 ? (ballInvestYen / totalInvestYen) * 100 : 0;
  const rateDiff = spinPerThousand - machineBorder;
  const estimatedEVYen = archived.estimatedEVYen + currentEstimatedEVYen;
  const returnYen = returnedBalls * exchangeRate;
  const autoBalanceYen = returnYen - totalInvestYen;
  const balanceYen = Number.isFinite(actualBalanceYenRaw) && session.actualBalanceYen !== '' ? actualBalanceYenRaw : autoBalanceYen;
  const yph = hours > 0 ? estimatedEVYen / hours : 0;

  return {
    exchangeRate,
    exchangeCategory: session.exchangeCategory || '25',
    startRotation,
    totalSpins,
    endRotation,
    totalInvestYen,
    cashInvestYen,
    ballInvestBalls,
    ballInvestYen,
    holdBallRatio,
    spinPerThousand,
    machineBorder,
    rateDiff,
    estimatedEVYen,
    returnYen,
    balanceYen,
    yph,
    currentSpins,
    currentEndRotation,
    currentInvestYen,
    currentCashInvestYen,
    currentBallInvestBalls,
    currentBallInvestYen,
    currentSpinPerThousand,
    currentEstimatedEVYen,
  };
}

function getRateTone(diff, border) {
  if (border <= 0) return 'border-white/10 bg-white/5';
  if (diff >= 1) return 'border-emerald-400/40 bg-emerald-500/20';
  if (diff >= 0) return 'border-emerald-400/20 bg-emerald-500/10';
  if (diff <= -1) return 'border-rose-400/40 bg-rose-500/20';
  return 'border-rose-400/20 bg-rose-500/10';
}

function SummaryMetric({ title, value, sub, positive }) {
  return (
    <Card className="rounded-3xl shadow-sm">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{title}</div>
        <div className={`mt-1 text-xl font-bold ${positive === undefined ? '' : positive ? 'text-emerald-600' : 'text-rose-600'}`}>{value}</div>
        {sub ? <div className="mt-1 text-xs text-muted-foreground">{sub}</div> : null}
      </CardContent>
    </Card>
  );
}

function FoldSummary({ title, total, count, children }) {
  return (
    <details className="rounded-3xl border bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="font-semibold">{title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{count}件</div>
          </div>
          <div className={`text-lg font-bold ${total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtYen(total)}</div>
        </div>
      </summary>
      <div className="border-t px-4 py-3">{children}</div>
    </details>
  );
}

function MonthCalendar({ currentMonth, sessions, selectedDate, onSelectDate, onPrev, onNext }) {
  const base = new Date(`${currentMonth}-01T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startWeekday = first.getDay();
  const daysInMonth = last.getDate();

  const dayMap = sessions.reduce((acc, s) => {
    if (!s.date?.startsWith(currentMonth)) return acc;
    const prev = acc[s.date] || { balance: 0, ev: 0, count: 0 };
    prev.balance += s.metrics.balanceYen;
    prev.ev += s.metrics.estimatedEVYen;
    prev.count += 1;
    acc[s.date] = prev;
    return acc;
  }, {});

  const cells = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);

  function dayClass(info) {
    if (!info) return 'bg-background';
    const level = getDayStrength(info.balance, info.ev);
    if (level === 'great') return 'bg-emerald-200 border-emerald-400';
    if (level === 'good') return 'bg-emerald-50 border-emerald-200';
    if (level === 'bad') return 'bg-rose-200 border-rose-400';
    if (level === 'weak') return 'bg-rose-50 border-rose-200';
    return 'bg-background';
  }

  return (
    <Card className="rounded-3xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="icon" className="rounded-2xl" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></Button>
          <CardTitle className="text-base">{year}年 {month + 1}月</CardTitle>
          <Button variant="outline" size="icon" className="rounded-2xl" onClick={onNext}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {['日', '月', '火', '水', '木', '金', '土'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((day, i) => {
            if (!day) return <div key={`empty-${i}`} className="aspect-square rounded-2xl bg-muted/20" />;
            const ds = `${currentMonth}-${String(day).padStart(2, '0')}`;
            const info = dayMap[ds];
            const selected = ds === selectedDate;
            return (
              <button
                key={ds}
                onClick={() => onSelectDate(ds)}
                className={`aspect-square rounded-2xl border p-1 text-left transition ${dayClass(info)} ${selected ? 'ring-2 ring-primary/30' : ''}`}
              >
                <div className="text-xs font-semibold">{day}</div>
                {info ? (
                  <div className="mt-1 space-y-0.5 text-[10px] leading-tight">
                    <div>{info.balance >= 0 ? '+' : ''}{Math.round(info.balance).toLocaleString()}円</div>
                    <div>EV {Math.round(info.ev).toLocaleString()}</div>
                    <div>{info.count}件</div>
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PachinkoCalculatorComplete() {
  const [machines, setMachines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);

  const [form, setForm] = useState(emptySession(defaultSettings));
  const [activeTab, setActiveTab] = useState('rate');
  const [search, setSearch] = useState('');
  const [periodMode, setPeriodMode] = useState(defaultSettings.yearMonthModeDefault);
  const [currentMonth, setCurrentMonth] = useState(todayStr().slice(0, 7));
  const [currentYear, setCurrentYear] = useState(todayStr().slice(0, 4));
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [machinePanelOpen, setMachinePanelOpen] = useState(false);
  const [advancedInvestOpen, setAdvancedInvestOpen] = useState(false);
  const [firstHitDialogOpen, setFirstHitDialogOpen] = useState(false);
  const [flashReadingId, setFlashReadingId] = useState('');
  const [undoStack, setUndoStack] = useState([]);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [expectDisplayUnit, setExpectDisplayUnit] = useState('balls');
  const [expectDetailBaseRate, setExpectDetailBaseRate] = useState(null);
  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [showResultRateGraph, setShowResultRateGraph] = useState(false);
  const [showMoneySwitchGraph, setShowMoneySwitchGraph] = useState(false);
  const [compareCandidateRate, setCompareCandidateRate] = useState('');
  const [compareCandidateBorder, setCompareCandidateBorder] = useState('');
  const [shopProfileDraft, setShopProfileDraft] = useState({ name: '', exchangeCategory: '25' });
  const readingInputRefs = useRef([]);
  const autosaveTimerRef = useRef(null);
  const skipAutosaveRef = useRef(false);

  const [judgeForm, setJudgeForm] = useState({ observedRate: '', border: '', note: '' });
  const [firstHitForm, setFirstHitForm] = useState({
    label: '初当たり1回目',
    rounds: '20',
    startBalls: '0',
    upperBalls: '100',
    endBalls: '',
    restartRotation: '0',
    restartReason: 'single',
    restartReasonNote: '',
    chainCount: '1',
  });
  const [machineDraft, setMachineDraft] = useState({
    name: '',
    shopDefault: '',
    border25: '',
    border28: '',
    border30: '',
    border33: '',
    border40: '',
    payoutPerRound: '',
    expectedBallsPerHit: '',
    totalProbability: '',
    memo: '',
  });

  useEffect(() => {
    const loadedMachines = loadJSON(STORAGE_KEYS.machines, defaultMachines);
    const loadedSessions = loadJSON(STORAGE_KEYS.sessions, []);
    const loadedSettings = { ...defaultSettings, ...loadJSON(STORAGE_KEYS.settings, defaultSettings) };
    setMachines(loadedMachines);
    setSessions(loadedSessions);
    setSettings(loadedSettings);
    const latestDraft = [...loadedSessions].filter((s) => s.status === 'draft').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];
    skipAutosaveRef.current = true;
    setUndoStack([]);
    setSaveStatus('saved');
    setForm(latestDraft ? { ...emptySession(loadedSettings), ...latestDraft } : emptySession(loadedSettings));
  }, []);

  useEffect(() => saveJSON(STORAGE_KEYS.machines, machines), [machines]);
  useEffect(() => saveJSON(STORAGE_KEYS.sessions, sessions), [sessions]);
  useEffect(() => saveJSON(STORAGE_KEYS.settings, settings), [settings]);

  const enrichedSessions = useMemo(() => sessions.map((s) => {
    const machine = machines.find((m) => m.id === s.machineId) || null;
    return { ...s, machine, metrics: calcRateMetrics(s, machine, settings) };
  }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)), [sessions, machines, settings]);

  const selectedMachine = form.machineId && form.machineId !== '__none__' ? machines.find((m) => m.id === form.machineId) || null : null;
  const formMetrics = calcRateMetrics(form, selectedMachine, settings);
  const saveStatusMeta = getSaveStatusMeta(saveStatus);
  const currentBorderInputValue = form.sessionBorderOverride !== '' ? form.sessionBorderOverride : (selectedMachine ? String(getMachineBorderByCategory(selectedMachine, form.exchangeCategory || '25') || '') : '');
  const currentObservedBaseRate = Math.floor(formMetrics.spinPerThousand || 0);
  const currentObservedTenthRate = Number((Math.round((formMetrics.spinPerThousand || 0) * 10) / 10).toFixed(1));
  const sessionTrendData = useMemo(() => getSessionTrendData(form, settings), [form, settings]);
  const moneySwitchData = useMemo(() => sessionTrendData.map((point) => ({
    label: point.label,
    totalSpins: point.totalSpins,
    cashInvestYen: point.cashInvestYen,
    ballInvestYen: point.ballInvestYen,
  })), [sessionTrendData]);
  const resultReturnedBalls = numberOrZero(form.endingBalls) + numberOrZero(form.endingUpperBalls);
  const resultPreviewMetrics = useMemo(() => calcRateMetrics({
    ...form,
    returnedBalls: resultReturnedBalls > 0 ? String(resultReturnedBalls) : form.returnedBalls,
  }, selectedMachine, settings), [form, resultReturnedBalls, selectedMachine, settings]);
  const currentDiffForCompare = formMetrics.spinPerThousand - formMetrics.machineBorder;
  const candidateDiffForCompare = numberOrZero(compareCandidateRate) - numberOrZero(compareCandidateBorder);
  const compareDecision = getContinueMoveDecision(currentDiffForCompare, candidateDiffForCompare);
  const recentShopPresets = useMemo(() => {
    const used = [];
    (settings.shopProfiles || []).forEach((profile) => {
      if (profile.name && !used.includes(profile.name)) used.push(profile.name);
    });
    enrichedSessions.forEach((session) => {
      if (session.shop && !used.includes(session.shop)) used.push(session.shop);
    });
    return used.slice(0, 6);
  }, [settings.shopProfiles, enrichedSessions]);
  const recentMachinePresets = useMemo(() => {
    const counts = {};
    enrichedSessions.forEach((session) => {
      const key = session.machineId && session.machineId !== '__none__' ? session.machineId : '';
      if (key) counts[key] = (counts[key] || 0) + 1;
    });
    const sortedIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([id]) => id);
    const withFallback = [...sortedIds, ...machines.map((machine) => machine.id).filter((id) => !sortedIds.includes(id))];
    return withFallback.slice(0, 6).map((id) => machines.find((machine) => machine.id === id)).filter(Boolean);
  }, [enrichedSessions, machines]);
  const theoreticalMetrics = useMemo(() => calcTheoreticalValueMetrics(formMetrics, selectedMachine, form.hours, settings), [formMetrics, selectedMachine, form.hours, settings]);

  useEffect(() => {
    setJudgeForm((prev) => ({
      ...prev,
      observedRate: prev.observedRate || (formMetrics.spinPerThousand ? String(Number(formMetrics.spinPerThousand.toFixed(2))) : ''),
      border: prev.border || (formMetrics.machineBorder ? String(formMetrics.machineBorder || '') : ''),
    }));
  }, [formMetrics.spinPerThousand, formMetrics.machineBorder]);

  const firstHitMetrics = useMemo(() => {
    const rounds = numberOrZero(firstHitForm.rounds);
    const startBalls = numberOrZero(firstHitForm.startBalls);
    const upperBalls = numberOrZero(firstHitForm.upperBalls);
    const endBalls = numberOrZero(firstHitForm.endBalls);
    const gainedBalls = Math.max(0, endBalls - (startBalls + upperBalls));
    const oneRound = rounds > 0 ? gainedBalls / rounds : 0;
    return { rounds, gainedBalls, oneRound };
  }, [firstHitForm]);

  const judgeMetrics = useMemo(() => {
    const observed = numberOrZero(judgeForm.observedRate);
    const border = numberOrZero(judgeForm.border);
    const diff = observed - border;
    const playDiff = numberOrZero(settings.judgePlayDiff);
    const watchDiff = numberOrZero(settings.judgeWatchDiff);
    const reliability = formMetrics.totalSpins >= 200 ? '高' : formMetrics.totalSpins >= 100 ? '中' : '低';
    let verdict = '判定不能';
    let tone = 'secondary';
    let comment = '回転率かボーダーを入れてくれ。';
    if (observed > 0 && border > 0) {
      if (diff >= playDiff && formMetrics.totalSpins >= 80) {
        verdict = '打てる';
        tone = 'default';
        comment = '今の数値なら続行候補だぜ。ブレはあるが、まだ追う価値がある。';
      } else if (diff >= watchDiff) {
        verdict = '様子見';
        tone = 'secondary';
        comment = 'ボーダー付近だな。もう少しサンプルを取ると精度が上がる。';
      } else {
        verdict = 'やめ候補';
        tone = 'destructive';
        comment = '今のところ弱い。根拠が増えない限り深追いは危険だぜ。';
      }
    }
    return { observed, border, diff, verdict, tone, comment, reliability };
  }, [judgeForm, settings, formMetrics.totalSpins]);

  const expectedHours = clampNumber(settings.expectedHours, 1, 10) || 4;
  const expectedSpins = expectedHours * (numberOrZero(settings.spinsPerHour) || 200);
  const expectationRows = useMemo(() => Array.from({ length: 15 }, (_, i) => 16 + i).map((rate) => ({
    rate,
    values: EXCHANGE_ORDER.map((category) => {
      const preset = getExchangePreset(category);
      const border = selectedMachine ? getMachineBorderByCategory(selectedMachine, category) : 0;
      const investYen = rate > 0 ? (expectedSpins / rate) * 1000 : 0;
      const evYen = border > 0 ? calcEvYenFromRate(rate, border, investYen, settings) : null;
      const evBalls = evYen !== null ? evYen / preset.yenPerBall : null;
      return { category, preset, border, evYen, evBalls };
    }),
  })), [expectedSpins, selectedMachine, settings]);

  const expectationDetailRows = useMemo(() => {
    if (expectDetailBaseRate === null) return [];
    return Array.from({ length: 10 }, (_, i) => Number((expectDetailBaseRate + i / 10).toFixed(1))).map((rate) => ({
      rate,
      values: EXCHANGE_ORDER.map((category) => {
        const preset = getExchangePreset(category);
        const border = selectedMachine ? getMachineBorderByCategory(selectedMachine, category) : 0;
        const investYen = rate > 0 ? (expectedSpins / rate) * 1000 : 0;
        const evYen = border > 0 ? calcEvYenFromRate(rate, border, investYen, settings) : null;
        const evBalls = evYen !== null ? evYen / preset.yenPerBall : null;
        return { category, preset, border, evYen, evBalls };
      }),
    }));
  }, [expectDetailBaseRate, expectedSpins, selectedMachine, settings]);

  const targetSessions = useMemo(() => enrichedSessions.filter((s) => periodMode === 'year' ? yearKey(s.date) === currentYear : monthKey(s.date) === currentMonth), [enrichedSessions, periodMode, currentMonth, currentYear]);
  const selectedDateSessions = enrichedSessions.filter((s) => s.date === selectedDate);

  const summary = targetSessions.reduce((acc, s) => {
    acc.balance += s.metrics.balanceYen;
    acc.ev += s.metrics.estimatedEVYen;
    acc.hours += numberOrZero(s.hours);
    acc.spins += s.metrics.totalSpins;
    acc.count += 1;
    return acc;
  }, { balance: 0, ev: 0, hours: 0, spins: 0, count: 0 });

  const trendChartData = useMemo(() => {
    if (periodMode === 'year') {
      const map = {};
      for (let i = 1; i <= 12; i += 1) map[`${currentYear}-${String(i).padStart(2, '0')}`] = { label: `${i}月`, balance: 0, ev: 0 };
      targetSessions.forEach((s) => {
        const key = monthKey(s.date);
        if (map[key]) {
          map[key].balance += s.metrics.balanceYen;
          map[key].ev += s.metrics.estimatedEVYen;
        }
      });
      return Object.values(map);
    }
    const sorted = [...targetSessions].sort((a, b) => (a.date > b.date ? 1 : -1));
    let balanceCum = 0;
    let evCum = 0;
    return sorted.map((s) => {
      balanceCum += s.metrics.balanceYen;
      evCum += s.metrics.estimatedEVYen;
      return { label: dateLabel(s.date), balance: balanceCum, ev: evCum };
    });
  }, [targetSessions, periodMode, currentYear]);

  const machineAggregate = useMemo(() => {
    const map = {};
    targetSessions.forEach((s) => {
      const key = s.machine?.name || s.machineFreeName || s.machineNameSnapshot || '未設定';
      if (!map[key]) map[key] = { name: key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => b.ev - a.ev);
  }, [targetSessions]);

  const shopAggregate = useMemo(() => {
    const map = {};
    targetSessions.forEach((s) => {
      const key = s.shop || '未入力';
      if (!map[key]) map[key] = { name: key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => b.ev - a.ev);
  }, [targetSessions]);

  const lifetimeSummary = useMemo(() => enrichedSessions.reduce((acc, s) => {
    acc.balance += s.metrics.balanceYen;
    acc.ev += s.metrics.estimatedEVYen;
    acc.count += 1;
    acc.spins += s.metrics.totalSpins;
    return acc;
  }, { balance: 0, ev: 0, count: 0, spins: 0 }), [enrichedSessions]);

  const yearSummaryRows = useMemo(() => {
    const map = {};
    enrichedSessions.forEach((s) => {
      const key = yearKey(s.date) || '未設定';
      if (!map[key]) map[key] = { key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [enrichedSessions]);

  const monthSummaryRows = useMemo(() => {
    const map = {};
    enrichedSessions.forEach((s) => {
      const key = monthKey(s.date) || '未設定';
      if (!map[key]) map[key] = { key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => (a.key < b.key ? 1 : -1));
  }, [enrichedSessions]);

  const monthlyReport = useMemo(() => {
    const monthSessions = enrichedSessions.filter((s) => monthKey(s.date) === currentMonth);
    const totals = monthSessions.reduce((acc, s) => {
      acc.balance += s.metrics.balanceYen;
      acc.ev += s.metrics.estimatedEVYen;
      acc.spins += s.metrics.totalSpins;
      acc.hours += numberOrZero(s.hours);
      acc.workBalls += getWorkVolumeBalls(s.metrics);
      acc.count += 1;
      return acc;
    }, { balance: 0, ev: 0, spins: 0, hours: 0, workBalls: 0, count: 0 });

    const dayMap = {};
    monthSessions.forEach((s) => {
      const key = s.date;
      if (!dayMap[key]) dayMap[key] = { balance: 0, ev: 0 };
      dayMap[key].balance += s.metrics.balanceYen;
      dayMap[key].ev += s.metrics.estimatedEVYen;
    });

    const dayRows = Object.entries(dayMap).map(([date, values]) => ({ date, ...values }));
    const plusDays = dayRows.filter((row) => row.balance > 0).length;
    const minusDays = dayRows.filter((row) => row.balance < 0).length;
    const evenDays = dayRows.filter((row) => row.balance === 0).length;

    const shopMap = {};
    const machineMap = {};
    monthSessions.forEach((s) => {
      const shopKey = s.shop || '店舗未入力';
      const machineKey = s.machine?.name || s.machineFreeName || s.machineNameSnapshot || '機種未設定';
      if (!shopMap[shopKey]) shopMap[shopKey] = { name: shopKey, balance: 0, ev: 0, count: 0 };
      if (!machineMap[machineKey]) machineMap[machineKey] = { name: machineKey, balance: 0, ev: 0, count: 0 };
      shopMap[shopKey].balance += s.metrics.balanceYen;
      shopMap[shopKey].ev += s.metrics.estimatedEVYen;
      shopMap[shopKey].count += 1;
      machineMap[machineKey].balance += s.metrics.balanceYen;
      machineMap[machineKey].ev += s.metrics.estimatedEVYen;
      machineMap[machineKey].count += 1;
    });

    const bestShop = Object.values(shopMap).sort((a, b) => b.ev - a.ev)[0] || null;
    const bestMachine = Object.values(machineMap).sort((a, b) => b.ev - a.ev)[0] || null;
    const averageRate = totals.spins > 0 && monthSessions.length > 0
      ? monthSessions.reduce((acc, s) => acc + s.metrics.spinPerThousand * s.metrics.totalSpins, 0) / totals.spins
      : 0;

    return {
      monthSessions,
      totals,
      plusDays,
      minusDays,
      evenDays,
      bestShop,
      bestMachine,
      averageRate,
    };
  }, [enrichedSessions, currentMonth]);

  const allShopSummaryRows = useMemo(() => {
    const map = {};
    enrichedSessions.forEach((s) => {
      const key = s.shop || '未入力';
      if (!map[key]) map[key] = { key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [enrichedSessions]);

  const allMachineSummaryRows = useMemo(() => {
    const map = {};
    enrichedSessions.forEach((s) => {
      const key = s.machine?.name || s.machineFreeName || s.machineNameSnapshot || '未設定';
      if (!map[key]) map[key] = { key, count: 0, balance: 0, ev: 0, spins: 0 };
      map[key].count += 1;
      map[key].balance += s.metrics.balanceYen;
      map[key].ev += s.metrics.estimatedEVYen;
      map[key].spins += s.metrics.totalSpins;
    });
    return Object.values(map).sort((a, b) => b.balance - a.balance);
  }, [enrichedSessions]);

  const filteredHistory = enrichedSessions.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [s.date, s.shop, s.machine?.name, s.machineNameSnapshot, s.machineFreeName, s.machineNumber, s.notes, s.tags, ...(s.firstHits || []).map((hit) => hit.label)].join(' ').toLowerCase().includes(q);
  });

  function buildPersistedSession(baseForm, nextStatus = baseForm.status || 'draft') {
    const machine = baseForm.machineId && baseForm.machineId !== '__none__' ? machines.find((m) => m.id === baseForm.machineId) || null : null;
    return {
      ...baseForm,
      machineNameSnapshot: machine?.name || baseForm.machineFreeName || baseForm.machineNameSnapshot || '',
      status: nextStatus,
      updatedAt: Date.now(),
    };
  }

  function upsertSession(payload) {
    setSessions((prev) => {
      const exists = prev.some((x) => x.id === payload.id);
      if (exists) return prev.map((x) => x.id === payload.id ? payload : x).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      return [payload, ...prev].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    });
  }

  function applyFormUpdate(updater, options = {}) {
    const { trackUndo = true, markDirty = true } = options;
    setForm((prev) => {
      if (trackUndo) setUndoStack((stack) => [cloneDeep(prev), ...stack].slice(0, 30));
      return typeof updater === 'function' ? updater(prev) : updater;
    });
    if (markDirty) setSaveStatus('dirty');
  }

  function undoLastChange() {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      const [latest, ...rest] = prev;
      skipAutosaveRef.current = true;
      setForm(latest);
      setSaveStatus('dirty');
      return rest;
    });
  }

  useEffect(() => {
    if (skipAutosaveRef.current) {
      skipAutosaveRef.current = false;
      return;
    }
    if (!hasMeaningfulSession(form) || form.status === 'completed') return;
    clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      setSaveStatus('saving');
      upsertSession(buildPersistedSession(form, 'draft'));
      setSaveStatus('saved');
    }, 700);
    return () => clearTimeout(autosaveTimerRef.current);
  }, [form, machines]);

  function updateForm(key, value) {
    applyFormUpdate((prev) => ({ ...prev, [key]: value }));
  }

  function applyShopValue(shopValue) {
    applyFormUpdate((prev) => {
      const matchedProfile = getShopProfileByName(settings.shopProfiles || [], shopValue);
      return {
        ...prev,
        shop: shopValue,
        exchangeCategory: matchedProfile?.exchangeCategory || prev.exchangeCategory,
        sessionBorderOverride: matchedProfile ? '' : prev.sessionBorderOverride,
      };
    });
  }

  function addShopProfile() {
    const name = String(shopProfileDraft.name || '').trim();
    if (!name) return;
    const nextProfile = { name, exchangeCategory: shopProfileDraft.exchangeCategory || '25' };
    setSettings((prev) => {
      const filtered = (prev.shopProfiles || []).filter((profile) => String(profile.name || '').trim().toLowerCase() !== name.toLowerCase());
      return { ...prev, shopProfiles: [...filtered, nextProfile] };
    });
    setShopProfileDraft({ name: '', exchangeCategory: '25' });
  }

  function removeShopProfile(name) {
    setSettings((prev) => ({
      ...prev,
      shopProfiles: (prev.shopProfiles || []).filter((profile) => profile.name !== name),
    }));
  }

  function openCompleteDialog() {
    setShowResultRateGraph(false);
    setShowMoneySwitchGraph(false);
    setResultDialogOpen(true);
  }

  function finalizeSession() {
    setSaveStatus('saving');
    const payloadBase = buildPersistedSession({
      ...form,
      returnedBalls: resultReturnedBalls > 0 ? String(resultReturnedBalls) : form.returnedBalls,
      notes: appendLine(
        appendLine(form.notes, form.resultGoodMemo ? `【良かった点】${form.resultGoodMemo}` : ''),
        form.resultBadMemo ? `【悪かった点】${form.resultBadMemo}` : ''
      ),
    }, 'completed');
    upsertSession(payloadBase);
    setSelectedDate(payloadBase.date);
    setCurrentMonth(monthKey(payloadBase.date));
    setCurrentYear(yearKey(payloadBase.date));
    skipAutosaveRef.current = true;
    setUndoStack([]);
    setForm(emptySession(settings));
    setSaveStatus('saved');
    setResultDialogOpen(false);
    setActiveTab('history');
  }

  function updateRateEntry(id, key, value) {
    applyFormUpdate((prev) => ({ ...prev, rateEntries: prev.rateEntries.map((entry) => entry.id === id ? { ...entry, [key]: value } : entry) }));
  }

  function setCurrentInputMode(mode) {
    applyFormUpdate((prev) => ({ ...prev, currentInputMode: mode }));
  }

  function syncBorderToMachine() {
    if (!selectedMachine || currentBorderInputValue === '') return;
    const field = getBorderFieldByCategory(form.exchangeCategory || '25');
    const nextBorder = numberOrZero(currentBorderInputValue);
    setMachines((prev) => prev.map((machine) => machine.id === selectedMachine.id ? { ...machine, [field]: nextBorder } : machine));
  }

  function moveFocusToNextReading(currentId, index, value) {
    const digits = String(value || '').replace(/[^0-9]/g, '');
    const previousValue = index === 0 ? form.startRotation : form.rateEntries[index - 1]?.reading;
    const prevDigits = String(previousValue || '').replace(/[^0-9]/g, '');
    const threshold = Math.max(2, prevDigits.length || 1);
    if (digits.length < threshold) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(10);
    setFlashReadingId(currentId);
    setTimeout(() => setFlashReadingId(''), 180);
    const nextExists = Boolean(form.rateEntries[index + 1]);
    if (!nextExists) {
      const nextKind = form.currentInputMode || 'cash';
      const nextAmount = nextKind === 'balls' ? numberOrZero(settings.defaultBallUnit) || 250 : numberOrZero(settings.defaultCashUnitYen) || 1000;
      applyFormUpdate((prev) => ({ ...prev, rateEntries: [...prev.rateEntries, emptyRateEntry(nextKind, nextAmount, '')] }));
      setTimeout(() => readingInputRefs.current[index + 1]?.focus(), 0);
      return;
    }
    setTimeout(() => {
      readingInputRefs.current[index + 1]?.focus();
      readingInputRefs.current[index + 1]?.select?.();
    }, 0);
  }

  function addRateEntry(kind = form.currentInputMode || 'cash', amount) {
    const baseAmount = amount ?? (kind === 'balls' ? numberOrZero(settings.defaultBallUnit) || 250 : numberOrZero(settings.defaultCashUnitYen) || 1000);
    applyFormUpdate((prev) => ({ ...prev, rateEntries: [...prev.rateEntries, emptyRateEntry(kind, baseAmount, '')] }));
  }

  function removeRateEntry(id) {
    applyFormUpdate((prev) => ({ ...prev, rateEntries: prev.rateEntries.length <= 1 ? prev.rateEntries : prev.rateEntries.filter((entry) => entry.id !== id) }));
  }

  function selectMachine(machineId) {
    if (machineId === '__none__') {
      applyFormUpdate((prev) => ({ ...prev, machineId: '__none__', sessionBorderOverride: '' }));
      return;
    }
    const machine = machines.find((m) => m.id === machineId);
    applyFormUpdate((prev) => {
      const nextShop = prev.shop || machine?.shopDefault || '';
      const matchedProfile = getShopProfileByName(settings.shopProfiles || [], nextShop);
      return {
        ...prev,
        machineId,
        shop: nextShop,
        machineFreeName: prev.machineFreeName || '',
        exchangeCategory: matchedProfile?.exchangeCategory || prev.exchangeCategory,
        sessionBorderOverride: '',
      };
    });
  }

  function createNewSession() {
    skipAutosaveRef.current = true;
    setUndoStack([]);
    setSaveStatus('saved');
    setForm(emptySession(settings));
    setActiveTab('rate');
  }

  function saveDraftNow() {
    setSaveStatus('saving');
    const payload = buildPersistedSession(form, 'draft');
    upsertSession(payload);
    skipAutosaveRef.current = true;
    setForm(payload);
    setSaveStatus('saved');
  }

  function completeSession() {
    openCompleteDialog();
  }

  function continueSession(session) {
    skipAutosaveRef.current = true;
    setUndoStack([]);
    setSaveStatus('saved');
    setForm({ ...emptySession(settings), ...session });
    setActiveTab('rate');
  }

  function duplicateSession(session) {
    skipAutosaveRef.current = true;
    setUndoStack([]);
    setSaveStatus('saved');
    setForm({
      ...emptySession(settings),
      ...session,
      id: uid(),
      date: todayStr(),
      status: 'draft',
      updatedAt: Date.now(),
      firstHits: [],
      rateSections: [],
      photos: [],
      rateEntries: [emptyRateEntry(session.currentInputMode || 'cash', (session.currentInputMode || 'cash') === 'balls' ? numberOrZero(settings.defaultBallUnit) || 250 : numberOrZero(settings.defaultCashUnitYen) || 1000, '')],
    });
    setActiveTab('rate');
  }

  function deleteSession(id) {
    setSessions((prev) => prev.filter((x) => x.id !== id));
  }

  async function addPhotos(files) {
    const list = Array.from(files || []).slice(0, 6);
    const images = [];
    for (const file of list) {
      const dataUrl = await readFileAsDataUrl(file);
      images.push({ id: uid(), name: file.name, dataUrl, createdAt: Date.now() });
    }
    applyFormUpdate((prev) => ({ ...prev, photos: [...(prev.photos || []), ...images].slice(0, 12) }));
  }

  function saveMachine() {
    if (!machineDraft.name.trim()) return;
    const payload = {
      id: uid(),
      name: machineDraft.name.trim(),
      shopDefault: machineDraft.shopDefault.trim(),
      border25: numberOrZero(machineDraft.border25),
      border28: numberOrZero(machineDraft.border28),
      border30: numberOrZero(machineDraft.border30),
      border33: numberOrZero(machineDraft.border33),
      border40: numberOrZero(machineDraft.border40),
      payoutPerRound: numberOrZero(machineDraft.payoutPerRound),
      expectedBallsPerHit: numberOrZero(machineDraft.expectedBallsPerHit),
      totalProbability: numberOrZero(machineDraft.totalProbability),
      memo: machineDraft.memo,
    };
    setMachines((prev) => [payload, ...prev]);
    setMachineDraft({ name: '', shopDefault: '', border25: '', border28: '', border30: '', border33: '', border40: '', payoutPerRound: '', expectedBallsPerHit: '', totalProbability: '', memo: '' });
  }

  function openFirstHitDialog() {
    const nextCount = (form.firstHits || []).length + 1;
    setFirstHitForm({ label: `初当たり${nextCount}回目`, rounds: '20', startBalls: '0', upperBalls: '100', endBalls: '', restartRotation: '0', restartReason: 'single', restartReasonNote: '', chainCount: '1' });
    setFirstHitDialogOpen(true);
  }

  function applyFirstHitOneRoundToMachine() {
    if (!selectedMachine) return;
    setMachines((prev) => prev.map((machine) => machine.id === selectedMachine.id ? { ...machine, payoutPerRound: Number(firstHitMetrics.oneRound.toFixed(1)) } : machine));
  }

  function completeFirstHit(restartAfter = false) {
    const label = firstHitForm.label || `初当たり${(form.firstHits || []).length + 1}回目`;
    const chainResultLabel = getChainResultLabel(firstHitForm.chainCount);
    const hit = {
      id: uid(),
      label,
      rounds: firstHitMetrics.rounds,
      startBalls: numberOrZero(firstHitForm.startBalls),
      upperBalls: numberOrZero(firstHitForm.upperBalls),
      endBalls: numberOrZero(firstHitForm.endBalls),
      gainedBalls: firstHitMetrics.gainedBalls,
      oneRound: Number(firstHitMetrics.oneRound.toFixed(1)),
      chainCount: numberOrZero(firstHitForm.chainCount),
      chainResultLabel,
    };
    const memoLine = `[${label}] ${hit.rounds}R / 獲得${Math.round(hit.gainedBalls)}玉 / 1R ${hit.oneRound.toFixed(1)} / ${chainResultLabel}`;

    applyFormUpdate((prev) => {
      const nextFormBase = { ...prev, firstHits: [...(prev.firstHits || []), hit], notes: appendLine(prev.notes, memoLine) };
      if (!restartAfter) return nextFormBase;
      const machine = nextFormBase.machineId && nextFormBase.machineId !== '__none__' ? machines.find((m) => m.id === nextFormBase.machineId) || null : null;
      const metrics = calcRateMetrics(nextFormBase, machine, settings);
      if (metrics.currentSpins <= 0 && metrics.currentInvestYen <= 0) return nextFormBase;
      const nextAmount = nextFormBase.currentInputMode === 'balls' ? numberOrZero(settings.defaultBallUnit) || 250 : numberOrZero(settings.defaultCashUnitYen) || 1000;
      const sectionLabel = `通常${(nextFormBase.rateSections || []).length + 1}区間`;
      const restartStartRotation = String(numberOrZero(firstHitForm.restartRotation));
      const restartReasonLabel = getRestartReasonLabel(firstHitForm.restartReason, firstHitForm.restartReasonNote);
      const section = {
        id: uid(), label: sectionLabel, startRotation: numberOrZero(nextFormBase.startRotation), endRotation: metrics.currentEndRotation,
        spins: metrics.currentSpins, investYen: metrics.currentInvestYen, cashInvestYen: metrics.currentCashInvestYen,
        ballInvestBalls: metrics.currentBallInvestBalls, ballInvestYen: metrics.currentBallInvestYen,
        spinPerThousand: Number(metrics.currentSpinPerThousand.toFixed(2)), estimatedEVYen: Math.round(metrics.currentEstimatedEVYen), restartReasonLabel,
      };
      const archivedPoints = buildSectionRateHistoryPoints(nextFormBase, settings);
      const restartLine = `[${sectionLabel}] ${section.spins}回転 / ${Math.round(section.investYen).toLocaleString()}円 / 累積 ${section.spinPerThousand.toFixed(2)} で区切って再スタート (${restartStartRotation}回転から / ${restartReasonLabel})`;
      return {
        ...nextFormBase,
        rateSections: [...(nextFormBase.rateSections || []), section],
        rateHistoryPoints: [...(nextFormBase.rateHistoryPoints || []), ...archivedPoints],
        startRotation: restartStartRotation,
        totalSpinsManual: '',
        rateEntries: [emptyRateEntry(nextFormBase.currentInputMode || 'cash', nextAmount, '')],
        notes: appendLine(nextFormBase.notes, restartLine),
      };
    });
    setFirstHitDialogOpen(false);
  }

  function removeFirstHit(hitId) {
    applyFormUpdate((prev) => ({ ...prev, firstHits: (prev.firstHits || []).filter((hit) => hit.id !== hitId) }));
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ machines, sessions, settings }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pachinko-complete-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result || '{}'));
        if (Array.isArray(data.machines)) setMachines(data.machines);
        if (Array.isArray(data.sessions)) setSessions(data.sessions);
        if (data.settings) setSettings({ ...defaultSettings, ...data.settings });
      } catch {
        alert('JSONの読み込みに失敗したぜ');
      }
    };
    reader.readAsText(file);
  }

  function moveMonth(delta) {
    const d = new Date(`${currentMonth}-01T00:00:00`);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function moveYear(delta) {
    setCurrentYear(String(Number(currentYear) + delta));
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <div className="mx-auto max-w-lg p-3 pb-36">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="overflow-hidden rounded-[28px] border-0 bg-slate-900 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-slate-300">PACHINKO ANALYZER</div>
                  <div className="mt-1 text-2xl font-bold">実戦・回転率 管理 完全版</div>
                  <div className="mt-1 text-sm text-slate-300">25/28/30/33/40 個別ボーダー参照に対応したぜ</div>
                </div>
                <div className="rounded-3xl bg-white/10 p-3"><BarChart3 className="h-7 w-7" /></div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mb-3 flex items-center gap-2">
          <Button variant={periodMode === 'month' ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setPeriodMode('month')}>月別</Button>
          <Button variant={periodMode === 'year' ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setPeriodMode('year')}>年別</Button>
          <div className="ml-auto flex items-center gap-2">
            {periodMode === 'month' ? (
              <>
                <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => moveMonth(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Badge variant="secondary" className="rounded-xl">{currentMonth}</Badge>
                <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => moveMonth(1)}><ChevronRight className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => moveYear(-1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Badge variant="secondary" className="rounded-xl">{currentYear}年</Badge>
                <Button variant="outline" size="icon" className="rounded-2xl" onClick={() => moveYear(1)}><ChevronRight className="h-4 w-4" /></Button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <SummaryMetric title="実収支" value={fmtYen(summary.balance)} positive={summary.balance >= 0} />
          <SummaryMetric title="期待値" value={fmtYen(summary.ev)} positive={summary.ev >= 0} />
          <SummaryMetric title="稼働件数" value={`${summary.count}件`} sub={`総回転 ${Math.round(summary.spins).toLocaleString()}回`} />
          <SummaryMetric title="時給期待値" value={summary.hours > 0 ? fmtYen(summary.ev / summary.hours) : '-'} sub={summary.hours > 0 ? `総時間 ${summary.hours.toFixed(1)}h` : '時間未入力'} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-auto min-w-max gap-2 rounded-2xl p-1.5">
              <TabsTrigger value="rate" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">回転率</TabsTrigger>
              <TabsTrigger value="expect" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">期待収支</TabsTrigger>
              <TabsTrigger value="judge" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">稼働判定</TabsTrigger>
              <TabsTrigger value="calendar" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">日別</TabsTrigger>
              <TabsTrigger value="analysis" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">まとめ</TabsTrigger>
              <TabsTrigger value="history" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">履歴</TabsTrigger>
              <TabsTrigger value="settings" className="min-w-fit flex-none rounded-2xl px-4 py-2 whitespace-nowrap">設定</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="rate" className="space-y-4">
            <Card className="overflow-hidden rounded-[28px] border-0 bg-slate-900 text-white shadow-md">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">RATE CALCULATOR</div>
                    <div className="mt-1 text-xl font-bold">回転率計算</div>
                    <div className="mt-1 flex items-center gap-2 text-xs">
                      <span className="text-slate-300">{form.status === 'completed' ? '終了済みセッション' : '途中保存は自動で入るぜ'}</span>
                      <span className={saveStatusMeta.className}>{saveStatusMeta.label}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {form.status === 'draft' ? <Badge className="rounded-xl">途中</Badge> : <Badge variant="secondary" className="rounded-xl">終了</Badge>}
                    <Button variant="secondary" className="rounded-2xl" onClick={createNewSession}>新規</Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <button type="button" onClick={() => setMachinePanelOpen((prev) => !prev)} className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left">
                    <div>
                      <div className="text-sm font-semibold text-white">台データ設定</div>
                      <div className="text-xs text-slate-300">店舗・機種・台番号・個別ボーダー設定</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-cyan-300 transition ${machinePanelOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {machinePanelOpen ? (
                    <div className="space-y-3 px-1 pb-1 pt-2">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-slate-300">日付</Label>
                          <Input type="date" value={form.date} onChange={(e) => updateForm('date', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" />
                        </div>
                        <div>
                          <Label className="text-slate-300">店舗名</Label>
                          <Input value={form.shop} onChange={(e) => applyShopValue(e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" placeholder="未入力でも可" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label className="text-slate-300">機種</Label>
                          <Select value={form.machineId || '__none__'} onValueChange={selectMachine}>
                            <SelectTrigger className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">未選択</SelectItem>
                              {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-slate-300">台番号</Label>
                          <Input value={form.machineNumber} onChange={(e) => updateForm('machineNumber', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" placeholder="任意" />
                        </div>
                      </div>

                      <div>
                        <Label className="text-slate-300">機種名フリー入力</Label>
                        <Input value={form.machineFreeName} onChange={(e) => updateForm('machineFreeName', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" placeholder="未登録時用" />
                      </div>

                      {(recentShopPresets.length > 0 || recentMachinePresets.length > 0) ? (
                        <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
                          <div className="mb-2 font-semibold text-white">入力補助プリセット</div>
                          {recentShopPresets.length > 0 ? (
                            <div className="mb-3">
                              <div className="mb-1 text-[11px] text-slate-400">店舗</div>
                              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {recentShopPresets.map((shopName) => (
                                  <Button key={shopName} type="button" size="sm" variant="secondary" className="rounded-2xl" onClick={() => applyShopValue(shopName)}>{shopName}</Button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                          {recentMachinePresets.length > 0 ? (
                            <div>
                              <div className="mb-1 text-[11px] text-slate-400">機種</div>
                              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                                {recentMachinePresets.map((machine) => (
                                  <Button key={machine.id} type="button" size="sm" variant="secondary" className="rounded-2xl" onClick={() => selectMachine(machine.id)}>{machine.name}</Button>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {selectedMachine ? (
                        <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-300 space-y-3">
                          <div>
                            <div className="mb-2 font-semibold text-white">登録ボーダー一覧</div>
                            <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                              {EXCHANGE_ORDER.map((category) => (
                                <div key={category} className="rounded-xl bg-white/5 p-2">
                                  <div>{getExchangePreset(category).short}</div>
                                  <div className="mt-1 font-bold text-cyan-300">{fmtRate(getMachineBorderByCategory(selectedMachine, category))}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-white/5 p-2">
                              <div>1R出玉</div>
                              <div className="mt-1 font-bold text-amber-300">{fmtRate(selectedMachine.payoutPerRound)}</div>
                            </div>
                            <div className="rounded-xl bg-white/5 p-2">
                              <div>平均獲得</div>
                              <div className="mt-1 font-bold text-amber-300">{Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉</div>
                            </div>
                            <div className="rounded-xl bg-white/5 p-2">
                              <div>トータル確率</div>
                              <div className="mt-1 font-bold text-amber-300">{selectedMachine.totalProbability ? fmtRate(selectedMachine.totalProbability) : '-'}</div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" className="w-full rounded-2xl">機種追加 / 個別ボーダー登録</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm rounded-3xl">
                          <DialogHeader>
                            <DialogTitle>機種データ追加</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-3">
                            <div>
                              <Label>機種名</Label>
                              <Input value={machineDraft.name} onChange={(e) => setMachineDraft((p) => ({ ...p, name: e.target.value }))} className="mt-1 rounded-2xl min-w-0" />
                            </div>
                            <div>
                              <Label>よく行く店舗(任意)</Label>
                              <Input value={machineDraft.shopDefault} onChange={(e) => setMachineDraft((p) => ({ ...p, shopDefault: e.target.value }))} className="mt-1 rounded-2xl min-w-0" />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <Label>25個(等価)</Label>
                                <Input value={machineDraft.border25} onChange={(e) => setMachineDraft((p) => ({ ...p, border25: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" />
                              </div>
                              <div>
                                <Label>28個</Label>
                                <Input value={machineDraft.border28} onChange={(e) => setMachineDraft((p) => ({ ...p, border28: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" />
                              </div>
                              <div>
                                <Label>30個</Label>
                                <Input value={machineDraft.border30} onChange={(e) => setMachineDraft((p) => ({ ...p, border30: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" />
                              </div>
                              <div>
                                <Label>33個</Label>
                                <Input value={machineDraft.border33} onChange={(e) => setMachineDraft((p) => ({ ...p, border33: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" />
                              </div>
                              <div>
                                <Label>40個</Label>
                                <Input value={machineDraft.border40} onChange={(e) => setMachineDraft((p) => ({ ...p, border40: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" />
                              </div>
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div>
                                <Label>1R出玉</Label>
                                <Input value={machineDraft.payoutPerRound} onChange={(e) => setMachineDraft((p) => ({ ...p, payoutPerRound: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" />
                              </div>
                              <div>
                                <Label>平均獲得出玉</Label>
                                <Input value={machineDraft.expectedBallsPerHit} onChange={(e) => setMachineDraft((p) => ({ ...p, expectedBallsPerHit: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" />
                              </div>
                              <div className="col-span-2">
                                <Label>トータル確率</Label>
                                <Input value={machineDraft.totalProbability} onChange={(e) => setMachineDraft((p) => ({ ...p, totalProbability: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" placeholder="例: 99.9 / 127.5" />
                              </div>
                            </div>
                            <div>
                              <Label>メモ</Label>
                              <Textarea value={machineDraft.memo} onChange={(e) => setMachineDraft((p) => ({ ...p, memo: e.target.value }))} className="mt-1 min-h-[90px] rounded-2xl" />
                            </div>
                            <Button className="w-full rounded-2xl" onClick={saveMachine}>保存</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button variant={form.exchangeCategory === '25' ? 'default' : 'secondary'} className="h-12 rounded-2xl" onClick={() => applyFormUpdate((prev) => ({ ...prev, exchangeCategory: '25', sessionBorderOverride: '' }))}>等価</Button>
                  <Button variant={form.exchangeCategory !== '25' ? 'default' : 'secondary'} className="h-12 rounded-2xl" onClick={() => applyFormUpdate((prev) => ({ ...prev, exchangeCategory: prev.exchangeCategory === '25' ? '28' : prev.exchangeCategory, sessionBorderOverride: '' }))}>非等価</Button>
                </div>
                {form.exchangeCategory !== '25' ? (
                  <div>
                    <Label>非等価種別</Label>
                    <Select value={form.exchangeCategory} onValueChange={(value) => applyFormUpdate((prev) => ({ ...prev, exchangeCategory: value, sessionBorderOverride: '' }))}>
                      <SelectTrigger className="mt-1 rounded-2xl min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="28">28個</SelectItem>
                        <SelectItem value="30">30個</SelectItem>
                        <SelectItem value="33">33個</SelectItem>
                        <SelectItem value="40">40個</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">累計回転数</div>
                    <div className="mt-1 text-xl font-bold">{Math.round(formMetrics.totalSpins)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">現在区間 {Math.round(formMetrics.currentSpins)}回</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">累積回転率</div>
                    <div className="mt-1 text-xl font-bold text-cyan-300">{fmtRate(formMetrics.spinPerThousand)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">現在区間 {fmtRate(formMetrics.currentSpinPerThousand)}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">現在ボーダー</div>
                    <Input value={currentBorderInputValue} onChange={(e) => updateForm('sessionBorderOverride', e.target.value)} className="mt-1 h-9 rounded-xl border-white/10 bg-transparent text-center text-white" inputMode="decimal" placeholder={selectedMachine ? String(getMachineBorderByCategory(selectedMachine, form.exchangeCategory || '25') || '') : '18.00'} />
                    <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{getExchangePreset(form.exchangeCategory || '25').short}</span>
                      {selectedMachine ? <button type="button" onClick={syncBorderToMachine} className="text-cyan-300 underline">選択交換率へ反映</button> : null}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">持ち玉比率</div>
                    <div className="mt-1 text-xl font-bold">{fmtRate(formMetrics.holdBallRatio)}%</div>
                    <div className="mt-1 text-[10px] text-slate-400">換金 {getExchangePreset(form.exchangeCategory || '25').label}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">仕事量(理論)</div>
                    <div className="mt-1 text-xl font-bold text-emerald-300">{theoreticalMetrics.workVolumeYen !== null ? fmtYen(theoreticalMetrics.workVolumeYen) : '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">{theoreticalMetrics.workVolumeBalls !== null ? `${Math.round(theoreticalMetrics.workVolumeBalls).toLocaleString()}玉` : 'トータル確率待ち'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">1R出玉</div>
                    <div className="mt-1 text-xl font-bold text-amber-300">{selectedMachine ? fmtRate(selectedMachine.payoutPerRound) : '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">平均 {selectedMachine?.expectedBallsPerHit ? `${Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉` : '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">通常回転時速</div>
                    <div className="mt-1 text-xl font-bold">{theoreticalMetrics.normalSpinsPerHour ? fmtRate(theoreticalMetrics.normalSpinsPerHour) : '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">hあたり通常回転</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">回転単価</div>
                    <div className={`mt-1 text-xl font-bold ${numberOrZero(theoreticalMetrics.mixedUnitPriceYen) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{theoreticalMetrics.mixedUnitPriceYen !== null ? `${theoreticalMetrics.mixedUnitPriceYen >= 0 ? '+' : ''}${fmtRate(theoreticalMetrics.mixedUnitPriceYen)}円` : '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">持玉/現金比率反映</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">時給(理論)</div>
                    <div className={`mt-1 text-xl font-bold ${numberOrZero(theoreticalMetrics.theoreticalHourlyYen) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{theoreticalMetrics.theoreticalHourlyYen !== null ? fmtYen(theoreticalMetrics.theoreticalHourlyYen) : '-'}</div>
                    <div className="mt-1 text-[10px] text-slate-400">回転単価×通常回転時速</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-[10px] text-slate-300">収支</div>
                    <div className={`mt-1 text-xl font-bold ${formMetrics.balanceYen >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtYen(formMetrics.balanceYen)}</div>
                    <div className="mt-1 text-[10px] text-slate-400">実収支/自動計算</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-3 text-[11px] text-slate-300">
                  回転単価は 1回転あたり期待値、仕事量(理論)は 回転単価×通常回転数 で算出するぜ。トータル確率・平均獲得出玉・1R出玉を機種データへ入れると自動反映される。
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button variant={form.currentInputMode === 'cash' ? 'default' : 'secondary'} className="h-12 rounded-2xl" onClick={() => setCurrentInputMode('cash')}>現金</Button>
                  <Button variant={form.currentInputMode === 'balls' ? 'default' : 'secondary'} className="h-12 rounded-2xl" onClick={() => setCurrentInputMode('balls')}>持ち玉</Button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
                  <button type="button" onClick={() => setAdvancedInvestOpen((prev) => !prev)} className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left">
                    <div>
                      <div className="text-sm font-semibold text-white">投資設定</div>
                      <div className="text-xs text-slate-300">基本は1000円。500円はここで出すぜ</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-cyan-300 transition ${advancedInvestOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {advancedInvestOpen ? (
                    <div className="space-y-3 px-1 pb-1 pt-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div><Label className="text-slate-300">現金標準</Label><Input value={settings.defaultCashUnitYen} onChange={(e) => setSettings((p) => ({ ...p, defaultCashUnitYen: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                        <div><Label className="text-slate-300">500円用</Label><Input value={settings.subCashUnitYen} onChange={(e) => setSettings((p) => ({ ...p, subCashUnitYen: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                        <div><Label className="text-slate-300">持ち玉標準</Label><Input value={settings.defaultBallUnit} onChange={(e) => setSettings((p) => ({ ...p, defaultBallUnit: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="secondary" className="rounded-2xl" onClick={() => addRateEntry('cash', numberOrZero(settings.subCashUnitYen) || 500)}>+500円行</Button>
                        <Button variant="secondary" className="rounded-2xl" onClick={() => addRateEntry('balls', numberOrZero(settings.defaultBallUnit) || 250)}>+持ち玉行</Button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <Label className="text-slate-300">打ち始め回転</Label>
                  <Input value={form.startRotation} onChange={(e) => updateForm('startRotation', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-transparent text-white" inputMode="numeric" placeholder="124" />
                  <div className="mt-1 text-[11px] text-slate-400">投資設定を開かなくても、ここでいつでも調整できるぜ。</div>
                </div>

                <div className="rounded-2xl border border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[60px_1fr_48px_58px_64px_34px] gap-2 bg-white/10 px-3 py-3 text-xs text-slate-300">
                    <div>前回転</div><div>現在回転</div><div>回転数</div><div>回転率</div><div>期待値</div><div></div>
                  </div>
                  <div className="h-[360px] space-y-2 overflow-y-auto p-3">
                    {form.rateEntries.map((entry, index) => {
                      const previousReading = index === 0 ? numberOrZero(form.startRotation) : numberOrZero(form.rateEntries[index - 1]?.reading);
                      const currentReading = numberOrZero(entry.reading);
                      const spins = currentReading > 0 && currentReading >= previousReading ? currentReading - previousReading : 0;
                      const amount = numberOrZero(entry.amount);
                      const entryInvestYen = entry.kind === 'balls' ? amount * formMetrics.exchangeRate : amount;
                      const rate = entryInvestYen > 0 ? spins / (entryInvestYen / 1000) : 0;
                      const border = numberOrZero(formMetrics.machineBorder);
                      const diff = rate - border;
                      const ev = border > 0 ? calcEvYenFromRate(rate, border, entryInvestYen, settings) : 0;
                      return (
                        <div key={entry.id} className={`grid grid-cols-[60px_1fr_48px_58px_64px_34px] gap-2 items-center rounded-2xl border px-2 py-2 text-sm ${getRateTone(diff, border)}`}>
                          <div className="text-center text-xs text-white">{previousReading || 0}</div>
                          <div className="space-y-1">
                            <Input
                              ref={(el) => { readingInputRefs.current[index] = el; }}
                              value={entry.reading}
                              onChange={(e) => { const nextValue = e.target.value; updateRateEntry(entry.id, 'reading', nextValue); moveFocusToNextReading(entry.id, index, nextValue); }}
                              className={`h-16 rounded-xl border-white/10 bg-transparent text-center text-white text-3xl font-bold transition ${flashReadingId === entry.id ? 'ring-2 ring-emerald-400 bg-emerald-500/20' : ''}`}
                              inputMode="numeric"
                              enterKeyHint="next"
                              placeholder="142"
                            />
                            <div className="flex gap-1">
                              <div className={`flex h-9 w-[58px] items-center justify-center rounded-xl text-xs ${entry.kind === 'balls' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'}`}>{entry.kind === 'balls' ? '持ち玉' : '現金'}</div>
                              <Input value={entry.amount} onChange={(e) => updateRateEntry(entry.id, 'amount', e.target.value)} className="h-9 rounded-xl border-white/10 bg-transparent text-center text-white text-sm" inputMode="numeric" enterKeyHint="done" placeholder={entry.kind === 'balls' ? '250' : '1000'} />
                            </div>
                          </div>
                          <div className="text-center font-bold text-cyan-300">{spins || 0}</div>
                          <div className="text-center text-xs text-cyan-300">{fmtRate(rate)}</div>
                          <div className={`${ev >= 0 ? 'text-emerald-300' : 'text-rose-300'} text-center text-xs`}>{border > 0 ? `¥${Math.round(ev)}` : '-'}</div>
                          <Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => removeRateEntry(entry.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => addRateEntry(form.currentInputMode, form.currentInputMode === 'balls' ? numberOrZero(settings.defaultBallUnit) || 250 : numberOrZero(settings.defaultCashUnitYen) || 1000)}>+入力行</Button>
                  <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-300">入力完了で次へ移動。最後なら次の行も自動追加だぜ。</div>
                </div>

                <div className="sticky bottom-20 z-10 rounded-3xl border border-white/10 bg-slate-950/90 p-3 backdrop-blur">
                  <div className="mb-2 text-xs text-slate-300">今日の1台サマリー</div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div><div className="text-slate-400">総回転</div><div className="mt-1 font-bold text-white">{Math.round(formMetrics.totalSpins)}</div></div>
                    <div><div className="text-slate-400">総投資</div><div className="mt-1 font-bold text-white">{fmtYen(formMetrics.totalInvestYen)}</div></div>
                    <div><div className="text-slate-400">累積率</div><div className="mt-1 font-bold text-cyan-300">{fmtRate(formMetrics.spinPerThousand)}</div></div>
                    <div><div className="text-slate-400">収支</div><div className={`mt-1 font-bold ${formMetrics.balanceYen >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtYen(formMetrics.balanceYen)}</div></div>
                  </div>
                </div>

                <Dialog open={firstHitDialogOpen} onOpenChange={setFirstHitDialogOpen}>
                  <DialogContent className="max-w-sm rounded-3xl border-0 bg-slate-900 text-white">
                    <DialogHeader><DialogTitle className="flex items-center gap-2 text-white"><Star className="h-4 w-4 text-yellow-400" />{firstHitForm.label}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <Button variant={firstHitForm.rounds === '10' ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setFirstHitForm((p) => ({ ...p, rounds: '10' }))}>10R</Button>
                        <Button variant={firstHitForm.rounds === '20' ? 'default' : 'secondary'} className="rounded-2xl" onClick={() => setFirstHitForm((p) => ({ ...p, rounds: '20' }))}>20R</Button>
                        <Input value={firstHitForm.rounds} onChange={(e) => setFirstHitForm((p) => ({ ...p, rounds: e.target.value }))} className="rounded-2xl border-white/10 bg-white/5 text-white text-center" inputMode="numeric" placeholder="直入力" />
                      </div>
                      <div className="space-y-3 rounded-2xl border border-white/10 p-3">
                        <div><Label className="text-slate-300">開始持ち玉</Label><Input value={firstHitForm.startBalls} onChange={(e) => setFirstHitForm((p) => ({ ...p, startBalls: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                        <div><Label className="text-slate-300">開始上皿玉数（任意）</Label><Input value={firstHitForm.upperBalls} onChange={(e) => setFirstHitForm((p) => ({ ...p, upperBalls: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                        <div><Label className="text-slate-300">終了持ち玉</Label><Input value={firstHitForm.endBalls} onChange={(e) => setFirstHitForm((p) => ({ ...p, endBalls: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div><Label className="text-slate-300">再スタート回転</Label><Input value={firstHitForm.restartRotation} onChange={(e) => setFirstHitForm((p) => ({ ...p, restartRotation: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" placeholder="0" /></div>
                          <div><Label className="text-slate-300">連チャン数</Label><Input value={firstHitForm.chainCount} onChange={(e) => setFirstHitForm((p) => ({ ...p, chainCount: e.target.value }))} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" placeholder="1" /></div>
                        </div>
                        <div>
                          <Label className="text-slate-300">再スタート理由</Label>
                          <Select value={firstHitForm.restartReason} onValueChange={(value) => setFirstHitForm((p) => ({ ...p, restartReason: value }))}>
                            <SelectTrigger className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">単発後</SelectItem>
                              <SelectItem value="st">確変/ST後</SelectItem>
                              <SelectItem value="jitan">時短抜け後</SelectItem>
                              <SelectItem value="other">その他</SelectItem>
                            </SelectContent>
                          </Select>
                          {firstHitForm.restartReason === 'other' ? <Input value={firstHitForm.restartReasonNote} onChange={(e) => setFirstHitForm((p) => ({ ...p, restartReasonNote: e.target.value }))} className="mt-2 rounded-2xl border-white/10 bg-white/5 text-white" placeholder="理由メモ" /> : null}
                          <div className="mt-1 text-[11px] text-slate-400">単発後は0、確変後や時短抜け後はその回転数を入れるんだぜ。</div>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white/5 p-4">
                        <div className="mb-3 text-sm font-semibold">計算結果</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between"><span className="text-slate-300">獲得出玉</span><span className="font-bold">{fmtBall(firstHitMetrics.gainedBalls)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-300">合計ラウンド</span><span className="font-bold">{firstHitMetrics.rounds || 0}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-300">1R出玉</span><span className="font-bold text-cyan-300">{fmtRate(firstHitMetrics.oneRound)}</span></div>
                          <div className="flex items-center justify-between"><span className="text-slate-300">連チャン結果</span><span className="font-bold">{getChainResultLabel(firstHitForm.chainCount)}</span></div>
                        </div>
                      </div>
                      {selectedMachine ? <Button variant="secondary" className="w-full rounded-2xl" onClick={applyFirstHitOneRoundToMachine}>この1R出玉を機種へ反映</Button> : <div className="text-xs text-amber-300">機種選択中なら、計算した1R出玉をその機種データへ反映できるぜ。</div>}
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="secondary" className="rounded-2xl" onClick={() => setFirstHitDialogOpen(false)}>キャンセル</Button>
                        <Button className="rounded-2xl" onClick={() => completeFirstHit(false)}>大当たり終了</Button>
                      </div>
                      <Button variant="secondary" className="w-full rounded-2xl" onClick={() => completeFirstHit(true)}>大当たり終了して回転率を再スタート</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label className="text-slate-300">回収玉</Label><Input value={form.returnedBalls} onChange={(e) => updateForm('returnedBalls', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" /></div>
                  <div><Label className="text-slate-300">実収支(任意上書き)</Label><Input value={form.actualBalanceYen} onChange={(e) => updateForm('actualBalanceYen', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" placeholder="未入力なら自動計算" /></div>
                  <div><Label className="text-slate-300">稼働時間</Label><Input value={form.hours} onChange={(e) => updateForm('hours', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" inputMode="numeric" placeholder="例: 3.5" /></div>
                  <div><Label className="text-slate-300">タグ</Label><Input value={form.tags} onChange={(e) => updateForm('tags', e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-white/5 text-white min-w-0" placeholder="特日, 強イベ" /></div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white">
                  <div className="mb-2 text-sm font-semibold">続行 / 移動 の簡易比較</div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-slate-300">候補台回転率</Label>
                      <Input value={compareCandidateRate} onChange={(e) => setCompareCandidateRate(e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-transparent text-white" inputMode="decimal" placeholder="18.2" />
                    </div>
                    <div>
                      <Label className="text-slate-300">候補台ボーダー</Label>
                      <Input value={compareCandidateBorder} onChange={(e) => setCompareCandidateBorder(e.target.value)} className="mt-1 rounded-2xl border-white/10 bg-transparent text-white" inputMode="decimal" placeholder="17.8" />
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-slate-400">今の台差玉感覚</div>
                      <div className={`mt-1 font-bold ${currentDiffForCompare >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{currentDiffForCompare >= 0 ? '+' : ''}{fmtRate(currentDiffForCompare)}</div>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-3">
                      <div className="text-slate-400">候補台差玉感覚</div>
                      <div className={`mt-1 font-bold ${candidateDiffForCompare >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{candidateDiffForCompare >= 0 ? '+' : ''}{fmtRate(candidateDiffForCompare)}</div>
                    </div>
                  </div>
                  <div className="mt-3 rounded-2xl bg-white/5 p-3 text-sm">
                    <div className={`font-bold ${compareDecision.positive === undefined ? 'text-white' : compareDecision.positive ? 'text-emerald-300' : 'text-amber-300'}`}>{compareDecision.verdict}</div>
                    <div className="mt-1 text-xs text-slate-300">{compareDecision.comment}</div>
                  </div>
                </div>

                {(form.rateSections || []).length > 0 ? <div className="space-y-2"><div className="text-sm font-semibold">回転率 再スタート履歴</div>{(form.rateSections || []).map((section) => <div key={section.id} className="rounded-2xl bg-white/5 px-3 py-3 text-sm"><div className="font-medium">{section.label}</div><div className="mt-1 text-xs text-slate-300">{section.startRotation}→{section.endRotation} / {section.spins}回転 / {Math.round(section.investYen).toLocaleString()}円 / 累積 {fmtRate(section.spinPerThousand)} / {section.restartReasonLabel || '再開'}</div></div>)}</div> : null}

                {(form.firstHits || []).length > 0 ? <div className="space-y-2"><div className="text-sm font-semibold">初当たり履歴</div>{(form.firstHits || []).map((hit) => <div key={hit.id} className="flex items-center justify-between rounded-2xl bg-white/5 px-3 py-3"><div><div className="font-medium">{hit.label}</div><div className="text-xs text-slate-300">{hit.rounds}R / 獲得{Math.round(hit.gainedBalls)}玉 / 1R {hit.oneRound.toFixed(1)} / {hit.chainResultLabel || getChainResultLabel(hit.chainCount)}</div></div><Button variant="ghost" size="icon" className="rounded-xl text-white hover:bg-white/10 hover:text-white" onClick={() => removeFirstHit(hit.id)}><Trash2 className="h-4 w-4" /></Button></div>)}</div> : null}

                <div>
                  <Label className="text-slate-300">メモ</Label>
                  <Textarea value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} className="mt-1 min-h-[90px] rounded-2xl border-white/10 bg-white/5 text-white" placeholder="初当たり結果は自動追記されるぜ" />
                </div>

                <div className="sticky bottom-3 z-20 space-y-2">
                  <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/90 px-3 py-2 text-xs backdrop-blur">
                    <span className={saveStatusMeta.className}>{saveStatusMeta.label}</span>
                    <Button variant="secondary" size="sm" className="rounded-2xl" onClick={undoLastChange} disabled={!undoStack.length}>取り消し</Button>
                  </div>
                  <div className="grid grid-cols-4 gap-2 rounded-3xl border border-white/10 bg-slate-950/90 p-2 backdrop-blur">
                    <Button onClick={openFirstHitDialog} variant="secondary" className="h-12 rounded-2xl text-sm"><Star className="mr-2 h-4 w-4" />初当たり</Button>
                    <Label className="cursor-pointer"><div className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white text-sm"><Camera className="mr-2 h-4 w-4" />写真</div><Input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addPhotos(e.target.files)} /></Label>
                    <Button onClick={saveDraftNow} variant="secondary" className="h-12 rounded-2xl text-sm"><Save className="mr-2 h-4 w-4" />保存</Button>
                    <Button onClick={completeSession} className="h-12 rounded-2xl text-sm"><CheckCircle2 className="mr-2 h-4 w-4" />終了</Button>
                  </div>
                </div>

                <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
                  <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader>
                      <DialogTitle>稼働結果</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <SummaryMetric title="総回転数" value={`${Math.round(resultPreviewMetrics.totalSpins)}回`} sub={`累積率 ${fmtRate(resultPreviewMetrics.spinPerThousand)}`} />
                        <SummaryMetric title="1R出玉" value={selectedMachine ? fmtRate(selectedMachine.payoutPerRound) : '-'} sub={`持ち玉比率 ${fmtRate(resultPreviewMetrics.holdBallRatio)}%`} />
                        <SummaryMetric title="期待値" value={fmtYen(resultPreviewMetrics.estimatedEVYen)} positive={resultPreviewMetrics.estimatedEVYen >= 0} sub={`仕事量 ${Math.round(getWorkVolumeBalls(resultPreviewMetrics)).toLocaleString()}玉`} />
                        <SummaryMetric title="収支" value={fmtYen(resultPreviewMetrics.balanceYen)} positive={resultPreviewMetrics.balanceYen >= 0} sub={`時給 ${resultPreviewMetrics.yph ? fmtYen(resultPreviewMetrics.yph) : '-'}`} />
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div>
                          <Label>終了時持ち玉</Label>
                          <Input value={form.endingBalls} onChange={(e) => updateForm('endingBalls', e.target.value)} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" placeholder="0" />
                        </div>
                        <div>
                          <Label>終了時上皿玉数</Label>
                          <Input value={form.endingUpperBalls} onChange={(e) => updateForm('endingUpperBalls', e.target.value)} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" placeholder="0" />
                        </div>
                        <div>
                          <Label>自動回収玉</Label>
                          <Input value={resultReturnedBalls} readOnly className="mt-1 rounded-2xl bg-muted/40" />
                        </div>
                        <div>
                          <Label>実収支(任意上書き)</Label>
                          <Input value={form.actualBalanceYen} onChange={(e) => updateForm('actualBalanceYen', e.target.value)} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" placeholder="未入力なら自動計算" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant={showResultRateGraph ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setShowResultRateGraph((prev) => !prev)}>回転率推移グラフ</Button>
                        <Button variant={showMoneySwitchGraph ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setShowMoneySwitchGraph((prev) => !prev)}>持ち玉/現金グラフ</Button>
                      </div>

                      {showResultRateGraph ? (
                        <div className="rounded-2xl border p-3">
                          <div className="mb-2 text-sm font-semibold">回転率の推移</div>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={sessionTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="rate" strokeWidth={2} dot={false} name="累積回転率" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : null}

                      {showMoneySwitchGraph ? (
                        <div className="rounded-2xl border p-3">
                          <div className="mb-2 text-sm font-semibold">持ち玉・現金の切り替え履歴</div>
                          <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={moneySwitchData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="label" />
                                <YAxis />
                                <Tooltip />
                                <Line type="monotone" dataKey="cashInvestYen" strokeWidth={2} dot={false} name="現金投資" />
                                <Line type="monotone" dataKey="ballInvestYen" strokeWidth={2} dot={false} name="持ち玉換算" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : null}

                      <div>
                        <Label>良かったメモ</Label>
                        <Textarea value={form.resultGoodMemo} onChange={(e) => updateForm('resultGoodMemo', e.target.value)} className="mt-1 min-h-[80px] rounded-2xl" placeholder="回った点、釘が良かった点、粘る根拠など" />
                      </div>
                      <div>
                        <Label>悪かった点 / やめ理由</Label>
                        <Textarea value={form.resultBadMemo} onChange={(e) => updateForm('resultBadMemo', e.target.value)} className="mt-1 min-h-[80px] rounded-2xl" placeholder="ヘソが閉まった、寄りが悪い、店移動理由など" />
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button variant="secondary" className="rounded-2xl" onClick={() => setResultDialogOpen(false)}>戻る</Button>
                        <Button className="rounded-2xl" onClick={finalizeSession}>結果を保存して終了</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expect" className="space-y-4">
            <Card className="overflow-hidden rounded-[28px] shadow-sm">
              <div className="bg-red-600 px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-lg font-bold">通常時 {Math.round(expectedSpins)} 回転（{expectedHours}時間）の期待収支一覧（単位: {expectDisplayUnit === 'yen' ? '円' : '玉'}）</div>
                  <Sparkles className="h-5 w-5" />
                </div>
              </div>
              <CardContent className="space-y-4 p-4">
                {!selectedMachine ? <div className="rounded-2xl border bg-muted/20 p-4 text-sm text-muted-foreground">期待収支は、機種データの 25/28/30/33/40 ボーダーを直参照する。まずは機種を選んでくれ。</div> : null}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label>稼働時間</Label>
                    <Select value={String(expectedHours)} onValueChange={(v) => setSettings((p) => ({ ...p, expectedHours: Number(v) }))}>
                      <SelectTrigger className="mt-1 rounded-2xl min-w-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((h) => <SelectItem key={h} value={String(h)}>{h}時間</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>表示単位</Label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      <Button variant={expectDisplayUnit === 'balls' ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setExpectDisplayUnit('balls')}>玉</Button>
                      <Button variant={expectDisplayUnit === 'yen' ? 'default' : 'outline'} className="rounded-2xl" onClick={() => setExpectDisplayUnit('yen')}>円</Button>
                    </div>
                  </div>
                </div>

                {selectedMachine ? (
                  <div className="rounded-2xl border p-3">
                    <div className="mb-2 text-sm font-semibold">参照ボーダー一覧</div>
                    <div className="grid grid-cols-5 gap-2 text-center text-sm">
                      {EXCHANGE_ORDER.map((category) => (
                        <div key={category} className="rounded-2xl bg-muted/30 p-3">
                          <div className="text-xs text-muted-foreground">{getExchangePreset(category).short}</div>
                          <div className="mt-1 font-bold text-cyan-700">{fmtRate(getMachineBorderByCategory(selectedMachine, category))}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                  期待収支ページは機種データの 25/28/30/33/40 の個別ボーダーをそのまま参照して計算するぜ。整数ボタンを押すと、その帯の 0.1 刻み詳細が出る。
                </div>

                <div className="rounded-2xl border p-3">
                  <div className="mb-2 text-sm font-semibold">回転率クイック選択</div>
                  <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {Array.from({ length: 15 }, (_, i) => 16 + i).map((rate) => (
                      <Button key={rate} variant={expectDetailBaseRate === rate ? 'default' : currentObservedBaseRate === rate ? 'secondary' : 'outline'} className="rounded-2xl" onClick={() => setExpectDetailBaseRate((prev) => prev === rate ? null : rate)}>{rate}回</Button>
                    ))}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full min-w-[760px] border-collapse text-center text-sm">
                    <thead>
                      <tr className="bg-sky-700 text-white">
                        <th className="border p-2">回転率</th>
                        {EXCHANGE_ORDER.map((category) => {
                          const preset = getExchangePreset(category);
                          const border = selectedMachine ? getMachineBorderByCategory(selectedMachine, category) : 0;
                          return (
                            <th key={category} className="border p-2">
                              <div>{preset.label}</div>
                              <div className="text-xs">({preset.short})</div>
                              <div className="text-[10px] opacity-80">B {fmtRate(border)}</div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {expectationRows.map((row) => (
                        <tr key={row.rate} className={currentObservedBaseRate === row.rate ? 'bg-amber-100' : ''}>
                          <td className="border bg-slate-100 p-2 font-bold">{row.rate}回</td>
                          {row.values.map((v) => {
                            const displayValue = expectDisplayUnit === 'yen' ? v.evYen : v.evBalls;
                            return <td key={`${row.rate}-${v.category}`} className={`border p-2 font-bold ${Number(displayValue) >= 0 ? 'text-red-600' : 'text-blue-700'}`}>{formatExpectationValue(displayValue, expectDisplayUnit)}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {expectDetailBaseRate !== null ? (
                  <div className="space-y-3">
                    <div className="text-sm font-semibold">{expectDetailBaseRate}回台の詳細（0.1刻み）</div>
                    <div className="overflow-x-auto rounded-2xl border">
                      <table className="w-full min-w-[760px] border-collapse text-center text-sm">
                        <thead>
                          <tr className="bg-slate-800 text-white">
                            <th className="border p-2">回転率</th>
                            {EXCHANGE_ORDER.map((category) => {
                              const preset = getExchangePreset(category);
                              const border = selectedMachine ? getMachineBorderByCategory(selectedMachine, category) : 0;
                              return (
                                <th key={`detail-${category}`} className="border p-2">
                                  <div>{preset.label}</div>
                                  <div className="text-xs">({preset.short})</div>
                                  <div className="text-[10px] opacity-80">B {fmtRate(border)}</div>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {expectationDetailRows.map((row) => (
                            <tr key={row.rate} className={currentObservedTenthRate === row.rate ? 'bg-amber-100' : ''}>
                              <td className="border bg-slate-100 p-2 font-bold">{row.rate.toFixed(1)}回</td>
                              {row.values.map((v) => {
                                const displayValue = expectDisplayUnit === 'yen' ? v.evYen : v.evBalls;
                                return <td key={`${row.rate}-${v.category}`} className={`border p-2 font-bold ${Number(displayValue) >= 0 ? 'text-red-600' : 'text-blue-700'}`}>{formatExpectationValue(displayValue, expectDisplayUnit)}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <SummaryMetric title="今の累積回転率" value={fmtRate(formMetrics.spinPerThousand)} sub="回転率ページ参照" />
                  <SummaryMetric title="参照機種" value={selectedMachine?.name || form.machineFreeName || '未設定'} sub={`現在選択 ${getExchangePreset(form.exchangeCategory || '25').short}`}></SummaryMetric>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="judge" className="space-y-4">
            <Card className="rounded-3xl shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Gauge className="h-5 w-5" />稼働判定</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border bg-muted/20 p-3 text-sm text-muted-foreground">回転率計算の数値を参照して、今の台が打てるかざっくり判断するページだぜ。</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div><Label>観測回転率</Label><Input value={judgeForm.observedRate} onChange={(e) => setJudgeForm((p) => ({ ...p, observedRate: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" /></div>
                  <div><Label>ボーダー</Label><Input value={judgeForm.border} onChange={(e) => setJudgeForm((p) => ({ ...p, border: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" /></div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setJudgeForm((p) => ({ ...p, observedRate: formMetrics.spinPerThousand ? String(Number(formMetrics.spinPerThousand.toFixed(2))) : '', border: formMetrics.machineBorder ? String(formMetrics.machineBorder || '') : p.border }))}>今の回転率を取り込む</Button>
                  <Button variant="secondary" className="rounded-2xl" onClick={() => setActiveTab('rate')}>回転率ページへ戻る</Button>
                </div>
                <Card className="rounded-3xl"><CardContent className="space-y-3 p-4"><div className="flex items-center justify-between"><div className="text-sm text-muted-foreground">判定</div><Badge variant={judgeMetrics.tone} className="rounded-xl">{judgeMetrics.verdict}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div>ボーダー差 <span className={`font-bold ${judgeMetrics.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{judgeMetrics.diff >= 0 ? '+' : ''}{fmtRate(judgeMetrics.diff)}</span></div><div>サンプル信頼度 <span className="font-bold">{judgeMetrics.reliability}</span></div><div>現在の総回転 <span className="font-bold">{Math.round(formMetrics.totalSpins)}回</span></div><div>参照機種 <span className="font-bold">{selectedMachine?.name || form.machineFreeName || '-'}</span></div></div><div className="rounded-2xl bg-muted/30 p-3 text-sm">{judgeMetrics.comment}</div><div className="text-xs text-muted-foreground">基準: 打てる {fmtRate(settings.judgePlayDiff)}以上 / 様子見 {fmtRate(settings.judgeWatchDiff)}以上</div></CardContent></Card>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <MonthCalendar currentMonth={currentMonth} sessions={enrichedSessions} selectedDate={selectedDate} onSelectDate={setSelectedDate} onPrev={() => moveMonth(-1)} onNext={() => moveMonth(1)} />
            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="text-lg">{selectedDate} の記録</CardTitle></CardHeader><CardContent className="space-y-3">{selectedDateSessions.length === 0 ? <div className="text-sm text-muted-foreground">この日はまだ未記録だぜ。</div> : selectedDateSessions.map((s) => {
                  const dayTrendData = getSessionTrendData(s, settings);
                  const machineName = s.machine?.name || s.machineFreeName || s.machineNameSnapshot || '機種未設定';
                  const oneRoundPayout = numberOrZero(s.machine?.payoutPerRound);
                  const workVolumeBalls = getWorkVolumeBalls(s.metrics);
                  return (
                    <details key={s.id} className="rounded-3xl border bg-white shadow-sm">
                      <summary className="cursor-pointer list-none p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-semibold">{machineName}</div>
                            <div className="mt-1 text-xs text-muted-foreground">{s.shop || '店舗未入力'} / 台{s.machineNumber || '-'} / {s.status === 'completed' ? '終了' : '途中'}</div>
                          </div>
                          <div className="text-right">
                            <div className={`text-lg font-bold ${s.metrics.balanceYen >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtYen(s.metrics.balanceYen)}</div>
                            <div className={`mt-1 text-xs font-semibold ${s.metrics.estimatedEVYen >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>期待値 {fmtYen(s.metrics.estimatedEVYen)}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground">記録を押すと詳細が開くぜ</div>
                      </summary>

                      <div className="space-y-4 border-t px-4 py-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">収支</div>
                            <div className={`mt-1 text-xl font-bold ${s.metrics.balanceYen >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtYen(s.metrics.balanceYen)}</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">仕事量</div>
                            <div className={`mt-1 text-xl font-bold ${workVolumeBalls >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{Math.round(workVolumeBalls).toLocaleString()}玉</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">期待値</div>
                            <div className={`mt-1 text-xl font-bold ${s.metrics.estimatedEVYen >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{fmtYen(s.metrics.estimatedEVYen)}</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">回転数</div>
                            <div className="mt-1 text-xl font-bold">{Math.round(s.metrics.totalSpins).toLocaleString()}回</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">回転率</div>
                            <div className="mt-1 text-xl font-bold text-cyan-700">{fmtRate(s.metrics.spinPerThousand)}</div>
                          </div>
                          <div className="rounded-2xl border p-3">
                            <div className="text-xs text-muted-foreground">初当たり</div>
                            <div className="mt-1 text-xl font-bold">{(s.firstHits || []).length}件</div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground">1R出玉</div>
                            <div className="mt-1 font-bold text-amber-600">{oneRoundPayout ? fmtRate(oneRoundPayout) : '-'}</div>
                          </div>
                          <div className="rounded-2xl bg-muted/20 p-3">
                            <div className="text-xs text-muted-foreground">持ち玉比率</div>
                            <div className="mt-1 font-bold">{fmtRate(s.metrics.holdBallRatio)}%</div>
                          </div>
                        </div>

                        <details className="rounded-2xl border bg-muted/20">
                          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">回転率推移グラフ</summary>
                          <div className="border-t p-3">
                            {dayTrendData.length > 0 ? (
                              <div className="h-56">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={dayTrendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="label" />
                                    <YAxis />
                                    <Tooltip />
                                    <Line type="monotone" dataKey="rate" strokeWidth={2} dot={false} name="累積回転率" />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">この記録はグラフ化できる回転率データがまだ少ないぜ。</div>
                            )}
                          </div>
                        </details>
                      </div>
                    </details>
                  );
                })}</CardContent></Card>
          </TabsContent>

          <TabsContent value="analysis" className="space-y-4">
            <Card className="overflow-hidden rounded-[28px] border-0 bg-slate-900 text-white shadow-md">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">MONTHLY REPORT</div>
                    <div className="mt-1 text-xl font-bold">{currentMonth} 月間レポート</div>
                    <div className="mt-1 text-sm text-slate-300">今月の収支・期待値・仕事量を1枚で見られるようにしたぜ</div>
                  </div>
                  <Badge className="rounded-xl" variant={monthlyReport.totals.balance >= 0 ? 'default' : 'destructive'}>{fmtYen(monthlyReport.totals.balance)}</Badge>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-slate-300">月間収支</div>
                    <div className={`mt-1 text-2xl font-bold ${monthlyReport.totals.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtYen(monthlyReport.totals.balance)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">稼働 {monthlyReport.totals.count}件</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-slate-300">月間期待値</div>
                    <div className={`mt-1 text-2xl font-bold ${monthlyReport.totals.ev >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{fmtYen(monthlyReport.totals.ev)}</div>
                    <div className="mt-1 text-[11px] text-slate-400">時給 {monthlyReport.totals.hours > 0 ? fmtYen(monthlyReport.totals.ev / monthlyReport.totals.hours) : '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-slate-300">月間仕事量</div>
                    <div className={`mt-1 text-2xl font-bold ${monthlyReport.totals.workBalls >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{Math.round(monthlyReport.totals.workBalls).toLocaleString()}玉</div>
                    <div className="mt-1 text-[11px] text-slate-400">総回転 {Math.round(monthlyReport.totals.spins).toLocaleString()}回</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <div className="text-xs text-slate-300">平均回転率</div>
                    <div className="mt-1 text-2xl font-bold text-cyan-300">{monthlyReport.averageRate ? fmtRate(monthlyReport.averageRate) : '-'}</div>
                    <div className="mt-1 text-[11px] text-slate-400">総時間 {monthlyReport.totals.hours ? monthlyReport.totals.hours.toFixed(1) : '0.0'}h</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <div className="text-xs text-slate-400">プラス日</div>
                    <div className="mt-1 text-xl font-bold text-emerald-300">{monthlyReport.plusDays}日</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <div className="text-xs text-slate-400">マイナス日</div>
                    <div className="mt-1 text-xl font-bold text-rose-300">{monthlyReport.minusDays}日</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3 text-center">
                    <div className="text-xs text-slate-400">トントン日</div>
                    <div className="mt-1 text-xl font-bold text-slate-200">{monthlyReport.evenDays}日</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="text-xs text-slate-400">今月の主力店舗</div>
                    <div className="mt-1 font-bold text-white">{monthlyReport.bestShop?.name || '-'}</div>
                    <div className="mt-1 text-xs text-slate-300">期待値 {monthlyReport.bestShop ? fmtYen(monthlyReport.bestShop.ev) : '-'}</div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <div className="text-xs text-slate-400">今月の主力機種</div>
                    <div className="mt-1 font-bold text-white">{monthlyReport.bestMachine?.name || '-'}</div>
                    <div className="mt-1 text-xs text-slate-300">期待値 {monthlyReport.bestMachine ? fmtYen(monthlyReport.bestMachine.ev) : '-'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="text-lg">推移グラフ</CardTitle></CardHeader><CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Line type="monotone" dataKey="balance" strokeWidth={2} dot={false} name="実収支" /><Line type="monotone" dataKey="ev" strokeWidth={2} dot={false} name="期待値" /></LineChart></ResponsiveContainer></div></CardContent></Card>
            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="text-lg flex items-center gap-2"><Store className="h-5 w-5" />店舗別集計</CardTitle></CardHeader><CardContent className="space-y-3">{shopAggregate.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : shopAggregate.map((row) => <div key={row.name} className="rounded-2xl border p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{row.name}</div><Badge className="rounded-xl" variant={row.balance >= 0 ? 'default' : 'destructive'}>{fmtYen(row.balance)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>期待値 {fmtYen(row.ev)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div><div>1件平均EV {fmtYen(row.count ? row.ev / row.count : 0)}</div></div></div>)}</CardContent></Card>
            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="text-lg">機種別集計</CardTitle></CardHeader><CardContent className="space-y-3">{machineAggregate.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : machineAggregate.map((row) => <div key={row.name} className="rounded-2xl border p-3"><div className="flex items-center justify-between gap-3"><div className="font-semibold">{row.name}</div><Badge className="rounded-xl" variant={row.ev >= 0 ? 'default' : 'destructive'}>{fmtYen(row.ev)}</Badge></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>実収支 {fmtYen(row.balance)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div><div>1件平均EV {fmtYen(row.count ? row.ev / row.count : 0)}</div></div></div>)}</CardContent></Card>
            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="text-lg">期間棒グラフ</CardTitle></CardHeader><CardContent><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={periodMode === 'year' ? trendChartData : machineAggregate.slice(0, 8).map((x) => ({ label: x.name.slice(0, 8), ev: x.ev }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="ev" /></BarChart></ResponsiveContainer></div></CardContent></Card>
            <FoldSummary title="生涯収支" total={lifetimeSummary.balance} count={lifetimeSummary.count}><div className="grid grid-cols-2 gap-3 text-sm"><div>期待値 <span className="font-bold">{fmtYen(lifetimeSummary.ev)}</span></div><div>総回転 <span className="font-bold">{Math.round(lifetimeSummary.spins).toLocaleString()}回</span></div></div></FoldSummary>
            <FoldSummary title="年別収支" total={yearSummaryRows.reduce((acc, row) => acc + row.balance, 0)} count={yearSummaryRows.length}><div className="space-y-2">{yearSummaryRows.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : yearSummaryRows.map((row) => <div key={row.key} className="rounded-2xl border p-3 text-sm"><div className="flex items-center justify-between"><div className="font-semibold">{row.key}年</div><div className={`${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold`}>{fmtYen(row.balance)}</div></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>期待値 {fmtYen(row.ev)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div></div></div>)}</div></FoldSummary>
            <FoldSummary title="月別収支" total={monthSummaryRows.reduce((acc, row) => acc + row.balance, 0)} count={monthSummaryRows.length}><div className="space-y-2">{monthSummaryRows.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : monthSummaryRows.map((row) => <div key={row.key} className="rounded-2xl border p-3 text-sm"><div className="flex items-center justify-between"><div className="font-semibold">{row.key}</div><div className={`${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold`}>{fmtYen(row.balance)}</div></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>期待値 {fmtYen(row.ev)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div></div></div>)}</div></FoldSummary>
            <FoldSummary title="店舗別収支" total={allShopSummaryRows.reduce((acc, row) => acc + row.balance, 0)} count={allShopSummaryRows.length}><div className="space-y-2">{allShopSummaryRows.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : allShopSummaryRows.map((row) => <div key={row.key} className="rounded-2xl border p-3 text-sm"><div className="flex items-center justify-between"><div className="font-semibold">{row.key}</div><div className={`${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold`}>{fmtYen(row.balance)}</div></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>期待値 {fmtYen(row.ev)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div></div></div>)}</div></FoldSummary>
            <FoldSummary title="機種別収支" total={allMachineSummaryRows.reduce((acc, row) => acc + row.balance, 0)} count={allMachineSummaryRows.length}><div className="space-y-2">{allMachineSummaryRows.length === 0 ? <div className="text-sm text-muted-foreground">まだデータがないぜ。</div> : allMachineSummaryRows.map((row) => <div key={row.key} className="rounded-2xl border p-3 text-sm"><div className="flex items-center justify-between"><div className="font-semibold">{row.key}</div><div className={`${row.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'} font-bold`}>{fmtYen(row.balance)}</div></div><div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground"><div>期待値 {fmtYen(row.ev)}</div><div>件数 {row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div></div></div>)}</div></FoldSummary>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card className="rounded-3xl shadow-sm"><CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="text-lg">履歴一覧</CardTitle><div className="relative w-40"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} className="rounded-2xl pl-9" placeholder="検索" /></div></div></CardHeader><CardContent className="space-y-3">{filteredHistory.length === 0 ? <div className="text-sm text-muted-foreground">履歴はまだないぜ。</div> : filteredHistory.map((s) => <motion.div key={s.id} layout><Card className="rounded-3xl border shadow-sm"><CardContent className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{s.machine?.name || s.machineFreeName || s.machineNameSnapshot || '機種未設定'}</div><div className="mt-1 text-xs text-muted-foreground">{s.date} / {s.shop || '店舗未入力'} / 台{s.machineNumber || '-'} / {getExchangePreset(s.exchangeCategory || '25').short}</div></div><div className="flex items-center gap-2">{s.status === 'draft' ? <Badge className="rounded-xl">途中</Badge> : <Badge variant="secondary" className="rounded-xl">終了</Badge>}<Badge className="rounded-xl" variant={s.metrics.balanceYen >= 0 ? 'default' : 'destructive'}>{fmtYen(s.metrics.balanceYen)}</Badge></div></div><div className="grid grid-cols-2 gap-2 text-sm"><div>期待値 <span className="font-semibold">{fmtYen(s.metrics.estimatedEVYen)}</span></div><div>千円回転 <span className="font-semibold">{fmtRate(s.metrics.spinPerThousand)}</span></div><div>ゲーム数 <span className="font-semibold">{Math.round(s.metrics.totalSpins).toLocaleString()}回</span></div><div>初当たり <span className="font-semibold">{(s.firstHits || []).length}件</span></div></div>{(s.firstHits || []).length > 0 ? <div className="space-y-1 text-xs text-muted-foreground">{s.firstHits.map((hit) => <div key={hit.id}>{hit.label}: {hit.rounds}R / 獲得{Math.round(hit.gainedBalls)}玉 / 1R {hit.oneRound.toFixed(1)} / {hit.chainResultLabel || getChainResultLabel(hit.chainCount)}</div>)}</div> : null}{s.notes ? <div className="whitespace-pre-wrap text-xs text-muted-foreground">{s.notes}</div> : null}
                          {(s.endingBalls || s.endingUpperBalls || s.resultGoodMemo || s.resultBadMemo) ? (
                            <div className="rounded-2xl bg-muted/30 p-3 text-xs text-muted-foreground">
                              <div>終了持ち玉 {Math.round(numberOrZero(s.endingBalls)).toLocaleString()}玉 / 上皿 {Math.round(numberOrZero(s.endingUpperBalls)).toLocaleString()}玉</div>
                              {s.resultGoodMemo ? <div className="mt-1">良かった点: {s.resultGoodMemo}</div> : null}
                              {s.resultBadMemo ? <div className="mt-1">悪かった点: {s.resultBadMemo}</div> : null}
                            </div>
                          ) : null}<div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><Button variant="outline" className="rounded-2xl" onClick={() => continueSession(s)}><Pencil className="mr-2 h-4 w-4" />続き入力</Button><Button variant="outline" className="rounded-2xl" onClick={() => duplicateSession(s)}><Copy className="mr-2 h-4 w-4" />複製</Button><Button variant="secondary" className="rounded-2xl" onClick={() => continueSession(s)}>詳細編集</Button><Button variant="destructive" className="rounded-2xl" onClick={() => deleteSession(s.id)}><Trash2 className="mr-2 h-4 w-4" />削除</Button></div></CardContent></Card></motion.div>)}</CardContent></Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Settings className="h-5 w-5" />期待値計算の詳細設定</CardTitle></CardHeader><CardContent className="space-y-4"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label>持ち玉標準(玉)</Label><Input value={settings.defaultBallUnit} onChange={(e) => setSettings((p) => ({ ...p, defaultBallUnit: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" /></div><div><Label>通常時回転/h</Label><Input value={settings.spinsPerHour} onChange={(e) => setSettings((p) => ({ ...p, spinsPerHour: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" /></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><Label>打てる基準差</Label><Input value={settings.judgePlayDiff} onChange={(e) => setSettings((p) => ({ ...p, judgePlayDiff: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" /></div><div><Label>様子見基準差</Label><Input value={settings.judgeWatchDiff} onChange={(e) => setSettings((p) => ({ ...p, judgeWatchDiff: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="decimal" /></div></div><div><Label>期待値算出モード</Label><Select value={settings.evCalcMode} onValueChange={(v) => setSettings((p) => ({ ...p, evCalcMode: v }))}><SelectTrigger className="mt-1 rounded-2xl min-w-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="borderDiff">ボーダー差の比率で計算</SelectItem><SelectItem value="customCoef">1回転差ごとの係数で計算</SelectItem></SelectContent></Select></div>{settings.evCalcMode === 'customCoef' ? <div><Label>1回転差あたり係数(円/1000円)</Label><Input value={settings.customEvPerSpinDiffPer1000Yen} onChange={(e) => setSettings((p) => ({ ...p, customEvPerSpinDiffPer1000Yen: e.target.value }))} className="mt-1 rounded-2xl min-w-0" inputMode="numeric" /></div> : null}</CardContent></Card>
            <Card className="rounded-3xl shadow-sm">
              <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Store className="h-5 w-5" />店舗ごとの換金率自動設定</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-[1fr_120px_72px] gap-2">
                  <Input value={shopProfileDraft.name} onChange={(e) => setShopProfileDraft((prev) => ({ ...prev, name: e.target.value }))} className="rounded-2xl" placeholder="店舗名" />
                  <Select value={shopProfileDraft.exchangeCategory} onValueChange={(value) => setShopProfileDraft((prev) => ({ ...prev, exchangeCategory: value }))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EXCHANGE_ORDER.map((category) => <SelectItem key={category} value={category}>{getExchangePreset(category).label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button className="rounded-2xl" onClick={addShopProfile}>追加</Button>
                </div>
                <div className="space-y-2">
                  {(settings.shopProfiles || []).length === 0 ? <div className="text-sm text-muted-foreground">まだ登録がないぜ。店舗名と交換率を結び付けておくと、店を入れた瞬間に自動反映される。</div> : (settings.shopProfiles || []).map((profile) => (
                    <div key={profile.name} className="flex items-center justify-between rounded-2xl border px-3 py-3 text-sm">
                      <div>
                        <div className="font-semibold">{profile.name}</div>
                        <div className="text-xs text-muted-foreground">{getExchangePreset(profile.exchangeCategory || '25').label}</div>
                      </div>
                      <Button variant="destructive" size="sm" className="rounded-2xl" onClick={() => removeShopProfile(profile.name)}>削除</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Database className="h-5 w-5" />データ管理</CardTitle></CardHeader><CardContent className="space-y-3"><Button variant="outline" className="w-full rounded-2xl" onClick={exportData}><Download className="mr-2 h-4 w-4" />JSONを書き出す</Button><Label className="cursor-pointer"><div className="inline-flex w-full items-center justify-center rounded-2xl border px-4 py-2 text-sm"><Upload className="mr-2 h-4 w-4" />JSONを読み込む</div><Input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} /></Label><div className="text-xs text-muted-foreground">途中保存も終了データも全部端末保存だ。画像を入れすぎると容量に当たるから、その時はJSON退避だぜ。</div></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
