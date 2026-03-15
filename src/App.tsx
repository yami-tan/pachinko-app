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
  BarChart3, Camera, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Copy, Database, Download, Gauge, Pencil, Save, Search, Settings,
  Sparkles, Star, Store, Trash2, Upload,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar,
} from 'recharts';

const STORAGE_KEYS = {
  machines: 'pachi_complete_machines_v12',
  sessions: 'pachi_complete_sessions_v12',
  settings: 'pachi_complete_settings_v12',
};

const EXCHANGE_PRESETS = {
  '25': { label: '25個(等価)', yenPerBall: 4.0, short: '等価' },
  '28': { label: '28個', yenPerBall: 3.5, short: '28個' },
  '30': { label: '30個', yenPerBall: 3.3, short: '30個' },
  '33': { label: '33個', yenPerBall: 3.0, short: '33個' },
};
const EXCHANGE_ORDER = ['25', '28', '30', '33'];
const DEFAULT_BORDER = 17;

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

function uid() { return crypto.randomUUID(); }

const defaultMachines = [
  { id: uid(), name: 'Pエヴァ15 未来への咆哮', shopDefault: '', border25: 17.8, border28: 18.7, border30: 19.4, border33: 20.2, border40: 0, payoutPerRound: 140, expectedBallsPerHit: 1400, totalProbability: 0, memo: '' },
  { id: uid(), name: 'ぱちんこ シン・エヴァンゲリオン Type レイ', shopDefault: '', border25: 17.1, border28: 18.1, border30: 18.6, border33: 19.5, border40: 0, payoutPerRound: 140, expectedBallsPerHit: 1400, memo: '' },
  { id: uid(), name: 'Pスーパー海物語IN沖縄6', shopDefault: '', border25: 18.0, border28: 0, border30: 0, border33: 0, border40: 0, payoutPerRound: 140, expectedBallsPerHit: 1400, memo: '' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthKey(s) { return (s||'').slice(0,7); }
function yearKey(s) { return (s||'').slice(0,4); }
function dateLabel(s) { if(!s) return ''; const d=new Date(`${s}T00:00:00`); return `${d.getMonth()+1}/${d.getDate()}`; }
function numberOrZero(v) { const n=Number(v); return Number.isFinite(n)?n:0; }
function clampNumber(v,min,max) { return Math.max(min,Math.min(max,numberOrZero(v))); }
function loadJSON(key,fallback) { try { const r=localStorage.getItem(key); return r?JSON.parse(r):fallback; } catch { return fallback; } }
function saveJSON(key,value) { localStorage.setItem(key,JSON.stringify(value)); }
function fmtYen(v) { return `${Math.round(v||0).toLocaleString()}円`; }
function fmtRate(v) { return Number.isFinite(v)?Number(v).toFixed(2):'-'; }
function fmtBall(v) { return `${Math.round(v||0).toLocaleString()}玉`; }
function cloneDeep(v) { return JSON.parse(JSON.stringify(v)); }

function getSaveStatusMeta(s) {
  if(s==='saving') return { label:'保存中…', color:'#f59e0b' };
  if(s==='saved') return { label:'保存済み', color:'#10b981' };
  return { label:'未保存変更あり', color:'#3b82f6' };
}
function getRestartReasonLabel(r,n='') {
  if(r==='st') return '確変/ST後'; if(r==='jitan') return '時短抜け後';
  if(r==='other') return n||'その他'; return '単発後';
}
function getChainResultLabel(c) { const n=numberOrZero(c); if(n<=0)return '-'; if(n===1)return '単発'; return `${n}連`; }
function formatExpectationValue(value, unit) {
  if(!Number.isFinite(value)) return '-';
  const r=Math.round(value||0);
  if(unit==='yen') return `${r>=0?'+':''}${r.toLocaleString()}円`;
  return `${r>=0?'+':''}${r.toLocaleString()}玉`;
}
function getBorderFieldByCategory(c) {
  if(c==='28')return 'border28'; if(c==='30')return 'border30';
  if(c==='33')return 'border33'; if(c==='40')return 'border40'; return 'border25';
}
function getMachineBorderByCategory(m,c) { if(!m)return 0; return numberOrZero(m[getBorderFieldByCategory(c)]); }
function getExchangePreset(c) { return EXCHANGE_PRESETS[c]||EXCHANGE_PRESETS['25']; }
function getShopProfileByName(profiles,name) {
  const t=String(name||'').trim().toLowerCase(); if(!t)return null;
  return (profiles||[]).find(p=>String(p.name||'').trim().toLowerCase()===t)||null;
}
function getWorkVolumeBalls(m) { return m.exchangeRate>0?m.estimatedEVYen/m.exchangeRate:0; }

function calcTheoreticalValueMetrics(metrics,machine,hours,settings) {
  const rate=numberOrZero(metrics.spinPerThousand), exchangeRate=numberOrZero(metrics.exchangeRate);
  const totalSpins=numberOrZero(metrics.totalSpins), enteredHours=numberOrZero(hours);
  const totalProbability=numberOrZero(machine?.totalProbability), averagePayout=numberOrZero(machine?.expectedBallsPerHit);
  const oneRoundPayout=numberOrZero(machine?.payoutPerRound);
  const holdRatio=clampNumber(metrics.holdBallRatio/100,0,1);
  const normalSpinsPerHour=enteredHours>0&&totalSpins>0?totalSpins/enteredHours:numberOrZero(settings.spinsPerHour);
  if(rate<=0||exchangeRate<=0||totalProbability<=0||averagePayout<=0) return { totalProbability,averagePayout,oneRoundPayout,normalSpinsPerHour,holdUnitPriceYen:null,cashUnitPriceYen:null,mixedUnitPriceYen:null,workVolumeYen:null,workVolumeBalls:null,theoreticalHourlyYen:null };
  const holdUnitPriceYen=(averagePayout/totalProbability-250/rate)*exchangeRate;
  const cashUnitPriceYen=averagePayout/totalProbability*exchangeRate-1000/rate;
  const mixedUnitPriceYen=holdUnitPriceYen*holdRatio+cashUnitPriceYen*(1-holdRatio);
  const workVolumeYen=mixedUnitPriceYen*totalSpins;
  const workVolumeBalls=exchangeRate>0?workVolumeYen/exchangeRate:null;
  const theoreticalHourlyYen=normalSpinsPerHour>0?mixedUnitPriceYen*normalSpinsPerHour:null;
  return { totalProbability,averagePayout,oneRoundPayout,normalSpinsPerHour,holdUnitPriceYen,cashUnitPriceYen,mixedUnitPriceYen,workVolumeYen,workVolumeBalls,theoreticalHourlyYen };
}

function getContinueMoveDecision(cur,cand) {
  if(cand-cur>=0.5) return { verdict:'移動候補', comment:'候補台のほうが数字は上だぜ。空き台なら移動を検討だ。', positive:false };
  if(cur-cand>=0.5) return { verdict:'続行寄り', comment:'今の台のほうが強い。無理に動かなくてよさそうだぜ。', positive:true };
  return { verdict:'様子見', comment:'大差はない。残り時間や店内状況で決めるのがよさそうだぜ。', positive:undefined };
}

function buildSectionRateHistoryPoints(session,settings) {
  const archived=session.rateHistoryPoints||[];
  const exchangeRate=getExchangePreset(session.exchangeCategory||'25').yenPerBall||4;
  let baseSpins=archived.length?numberOrZero(archived[archived.length-1].totalSpins):0;
  let baseCashInvestYen=archived.length?numberOrZero(archived[archived.length-1].cashInvestYen):0;
  let baseBallInvestYen=archived.length?numberOrZero(archived[archived.length-1].ballInvestYen):0;
  let prevReading=numberOrZero(session.startRotation);
  const si=(session.rateSections||[]).length+1;
  return (session.rateEntries||[]).flatMap((entry,index)=>{
    const reading=numberOrZero(entry.reading);
    if(!(reading>0&&reading>=prevReading)) return [];
    const amount=numberOrZero(entry.amount), spins=reading-prevReading;
    if(entry.kind==='balls') baseBallInvestYen+=amount*exchangeRate; else baseCashInvestYen+=amount;
    baseSpins+=spins; prevReading=reading;
    const totalInvestYen=baseCashInvestYen+baseBallInvestYen;
    const cumulativeRate=totalInvestYen>0?baseSpins/(totalInvestYen/1000):0;
    return [{ id:`rate-point-${si}-${entry.id}`,label:`${si}-${index+1}`,totalSpins:baseSpins,cashInvestYen:baseCashInvestYen,ballInvestYen:baseBallInvestYen,totalInvestYen,rate:cumulativeRate,reading,mode:entry.kind }];
  });
}

function getSessionTrendData(session,settings) {
  return [...(session.rateHistoryPoints||[]),...buildSectionRateHistoryPoints(session,settings)];
}

function emptyRateEntry(kind='cash',amount=1000,reading='') { return { id:uid(),kind,amount:String(amount),reading }; }

function emptySession(settings=defaultSettings) {
  return { id:uid(),date:todayStr(),shop:'',machineId:'__none__',machineNameSnapshot:'',machineFreeName:'',machineNumber:'',exchangeCategory:'25',startRotation:'',sessionBorderOverride:'',totalSpinsManual:'',returnedBalls:'',endingBalls:'',endingUpperBalls:'',actualBalanceYen:'',hours:'',notes:'',resultGoodMemo:'',resultBadMemo:'',rateHistoryPoints:[],tags:'',photos:[],firstHits:[],rateSections:[],measurementLogs:[],currentInputMode:'cash',status:'draft',updatedAt:Date.now(),rateEntries:[emptyRateEntry('cash',settings.defaultCashUnitYen,'')] };
}

function hasMeaningfulSession(s) {
  return Boolean(s.shop||s.machineId!=='__none__'||s.machineFreeName||s.machineNumber||s.startRotation||s.sessionBorderOverride||s.notes||s.tags||(s.rateEntries||[]).some(e=>e.reading||numberOrZero(e.amount)>0)||(s.firstHits||[]).length>0||(s.rateSections||[]).length>0||(s.photos||[]).length>0);
}

function getDayStrength(balance,ev) {
  if(balance>=50000||ev>=30000) return 'great';
  if(balance>0||ev>0) return 'good';
  if(balance<=-50000||ev<=-30000) return 'bad';
  if(balance<0||ev<0) return 'weak';
  return 'none';
}

function readFileAsDataUrl(file) {
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result||'')); r.onerror=rej; r.readAsDataURL(file); });
}

function appendLine(e,l) { if(!l)return e||''; return e?`${e}\n${l}`:l; }

function calcEvYenFromRate(rate,border,investYen,settings) {
  if(border<=0)return 0;
  const diff=rate-border;
  let evPer1000Yen=0;
  if((settings.evCalcMode||'borderDiff')==='customCoef') evPer1000Yen=diff*numberOrZero(settings.customEvPerSpinDiffPer1000Yen||800);
  else evPer1000Yen=border>0?(diff/border)*1000:0;
  return evPer1000Yen*(investYen/1000);
}

function calcRateMetrics(session,machine,settings) {
  const startRotation=numberOrZero(session.startRotation);
  const totalSpinsManual=numberOrZero(session.totalSpinsManual);
  const returnedBalls=numberOrZero(session.returnedBalls);
  const actualBalanceYenRaw=Number(session.actualBalanceYen);
  const hours=numberOrZero(session.hours);
  const exchangePreset=getExchangePreset(session.exchangeCategory||'25');
  const exchangeRate=numberOrZero(exchangePreset.yenPerBall)||4;
  const machineBorder=session.sessionBorderOverride!==''?numberOrZero(session.sessionBorderOverride):getMachineBorderByCategory(machine,session.exchangeCategory||'25');
  let cCash=0,cBalls=0,cSpins=0,last=startRotation;
  (session.rateEntries||[]).forEach(e=>{
    const amount=numberOrZero(e.amount),reading=numberOrZero(e.reading);
    if(!(reading>0&&reading>=last))return;
    // restart・jackpot_afterは回転数カウントのみ（投資0）
    if(e.kind!=='restart'&&e.kind!=='jackpot_after'){
      if(e.kind==='balls')cBalls+=amount; else cCash+=amount;
    }
    cSpins+=reading-last; last=reading;
  });
  const currentSpins=totalSpinsManual||cSpins;
  const currentEndRotation=startRotation+currentSpins;
  const cBallYen=cBalls*exchangeRate, cInvestYen=cCash+cBallYen;
  const cRate=cInvestYen>0?currentSpins/(cInvestYen/1000):0;
  const cEVYen=cInvestYen>0?calcEvYenFromRate(cRate,machineBorder,cInvestYen,settings):0;
  const archived=(session.rateSections||[]).reduce((acc,s)=>{ acc.spins+=numberOrZero(s.spins); acc.investYen+=numberOrZero(s.investYen); acc.cashInvestYen+=numberOrZero(s.cashInvestYen); acc.ballInvestBalls+=numberOrZero(s.ballInvestBalls); acc.ballInvestYen+=numberOrZero(s.ballInvestYen); acc.estimatedEVYen+=numberOrZero(s.estimatedEVYen); return acc; },{spins:0,investYen:0,cashInvestYen:0,ballInvestBalls:0,ballInvestYen:0,estimatedEVYen:0});
  const totalSpins=archived.spins+currentSpins;
  const cashInvestYen=archived.cashInvestYen+cCash, ballInvestBalls=archived.ballInvestBalls+cBalls;
  const ballInvestYen=archived.ballInvestYen+cBallYen, totalInvestYen=archived.investYen+cInvestYen;
  const spinPerThousand=totalInvestYen>0?totalSpins/(totalInvestYen/1000):0;
  const holdBallRatio=totalInvestYen>0?(ballInvestYen/totalInvestYen)*100:0;
  const estimatedEVYen=archived.estimatedEVYen+cEVYen;
  const returnYen=returnedBalls*exchangeRate;

  // ── measurementLogs の累積 ──
  const logs=session.measurementLogs||[];
  const logTotals=logs.reduce((a,l)=>({
    spins:     a.spins     + numberOrZero(l.spins),
    investYen: a.investYen + numberOrZero(l.investYen),
    cashInvest:a.cashInvest+ numberOrZero(l.cashInvestYen),
    ballBalls: a.ballBalls + numberOrZero(l.ballInvestBalls),
    ballYen:   a.ballYen   + numberOrZero(l.ballInvestYen),
    evYen:     a.evYen     + numberOrZero(l.estimatedEVYen),
  }),{spins:0,investYen:0,cashInvest:0,ballBalls:0,ballYen:0,evYen:0});

  // ── 全計測を合算した totals ──
  const allTotalSpins    = logTotals.spins     + totalSpins;
  const allTotalInvestYen= logTotals.investYen + totalInvestYen;   // 回転率計算用（現金+持ち玉）
  const allCashInvestYen = logTotals.cashInvest+ cashInvestYen;    // 表示・収支用（現金のみ）
  const allBallInvestBalls=logTotals.ballBalls + ballInvestBalls;
  const allBallInvestYen = logTotals.ballYen   + ballInvestYen;
  const allEstimatedEVYen= logTotals.evYen     + estimatedEVYen;
  // 回転率は現金＋持ち玉の合計で計算（実際の消費量ベース）
  const allSpinPerThousand=allTotalInvestYen>0?allTotalSpins/(allTotalInvestYen/1000):spinPerThousand;
  const allHoldBallRatio=allTotalInvestYen>0?(allBallInvestYen/allTotalInvestYen)*100:holdBallRatio;

  // ── 持ち玉残枚数（全持ち玉投資を差し引いた残り） ──
  const lastFirstHit=(session.firstHits||[]).slice(-1)[0];
  const lastEndBalls=numberOrZero(lastFirstHit?.endBalls);
  const currentBalls=lastEndBalls>0?Math.max(0,lastEndBalls-allBallInvestBalls):null;
  const currentBallsYen=currentBalls!==null?currentBalls*exchangeRate:null;

  // ── 収支：残り持ち玉の価値 − 現金投資のみ ──
  // 例: 持ち玉5620玉(等価22480円) - 現金34000円 = -11520円
  const autoBalanceYen=currentBalls!==null
    ? (currentBallsYen - allCashInvestYen)          // 持ち玉あり: 残り玉価値 − 現金
    : (returnYen - allCashInvestYen);                // 持ち玉なし: 回収玉価値 − 現金
  const balanceYen=Number.isFinite(actualBalanceYenRaw)&&session.actualBalanceYen!==''?actualBalanceYenRaw:autoBalanceYen;
  const yph=hours>0?allEstimatedEVYen/hours:0;

  return {
    exchangeRate, exchangeCategory:session.exchangeCategory||'25',
    startRotation,
    // ── メイン表示 ──
    totalSpins:     allTotalSpins,
    totalInvestYen: allCashInvestYen,      // ★ 表示は現金のみ
    cashInvestYen:  allCashInvestYen,
    ballInvestBalls:allBallInvestBalls,
    ballInvestYen:  allBallInvestYen,
    holdBallRatio:  allHoldBallRatio,
    spinPerThousand:allSpinPerThousand,    // 回転率は現金+持ち玉で計算
    avgSpinPerThousand: allSpinPerThousand,
    estimatedEVYen: allEstimatedEVYen,
    // ── 回転率計算専用（内部用） ──
    totalInvestYenForRate: allTotalInvestYen,
    // ── 現在枠のみ（詳細・行計算用） ──
    currentFrameSpins:    totalSpins,
    currentFrameInvestYen:totalInvestYen,
    currentFrameRate:     spinPerThousand,
    currentFrameRate:     spinPerThousand,
    allTotalSpins, allTotalInvestYen, allCashInvestYen, allBallInvestBalls, allBallInvestYen,
    machineBorder, rateDiff:allSpinPerThousand-machineBorder,
    returnYen, balanceYen, yph,
    currentBalls, currentBallsYen,
    currentSpins, currentEndRotation,
    currentInvestYen:cInvestYen, currentCashInvestYen:cCash,
    currentBallInvestBalls:cBalls, currentBallInvestYen:cBallYen,
    currentSpinPerThousand:cRate, currentEstimatedEVYen:cEVYen,
    endRotation:currentEndRotation,
  };
}

/* ─── カラーシステム ─── */
// ライト系テーマ: 白ベース、インディゴアクセント、グリーン/ローズで正負
const C = {
  bg: '#f0f4ff',
  card: '#ffffff',
  border: '#e2e8f0',
  primary: '#4f46e5',        // インディゴ
  primaryLight: '#eef2ff',
  primaryMid: '#c7d2fe',
  accent: '#0ea5e9',         // スカイブルー
  accentLight: '#e0f2fe',
  positive: '#059669',       // エメラルド
  positiveBg: '#ecfdf5',
  positiveBorder: '#a7f3d0',
  negative: '#dc2626',       // レッド
  negativeBg: '#fff1f2',
  negativeBorder: '#fecdd3',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  amber: '#d97706',
  amberBg: '#fffbeb',
  amberBorder: '#fde68a',
  // テーブル用
  tablePositive: '#065f46',   // 濃いグリーン（白背景での可読性）
  tablePositiveBg: '#d1fae5',
  tableNegative: '#9f1239',   // 濃いローズ（白背景での可読性）
  tableNegativeBg: '#ffe4e6',
  tableHeader: '#312e81',     // ディープインディゴ
};

function getRateTone(diff, border) {
  if(border<=0) return { bg:'#f8fafc', border:'#e2e8f0', text:'#475569' };
  if(diff>=1) return { bg:'#ecfdf5', border:'#6ee7b7', text:'#065f46' };
  if(diff>=0) return { bg:'#f0fdf4', border:'#bbf7d0', text:'#166534' };
  if(diff<=-1) return { bg:'#fff1f2', border:'#fecdd3', text:'#9f1239' };
  return { bg:'#fff5f5', border:'#fecaca', text:'#991b1b' };
}

/* ─── 共通コンポーネント ─── */
function SummaryMetric({ title, value, sub, positive }) {
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, padding:'14px 16px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase' }}>{title}</div>
      <div style={{ marginTop:4, fontSize:20, fontWeight:700, color: positive===undefined ? C.textPrimary : positive ? C.positive : C.negative }}>{value}</div>
      {sub && <div style={{ marginTop:3, fontSize:11, color:C.textMuted }}>{sub}</div>}
    </div>
  );
}

function FoldSummary({ title, total, count, children }) {
  return (
    <details style={{ borderRadius:20, border:`1px solid ${C.border}`, background:C.card, boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <summary style={{ cursor:'pointer', listStyle:'none', padding:'14px 18px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
          <div>
            <div style={{ fontWeight:700, color:C.textPrimary }}>{title}</div>
            <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{count}件</div>
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:total>=0?C.positive:C.negative }}>{fmtYen(total)}</div>
        </div>
      </summary>
      <div style={{ borderTop:`1px solid ${C.border}`, padding:'12px 18px' }}>{children}</div>
    </details>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{ padding:'6px 16px', borderRadius:999, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:'white', color:active?'white':C.textSecondary, fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
      {children}
    </button>
  );
}

function MonthCalendar({ currentMonth, sessions, selectedDate, onSelectDate, onPrev, onNext }) {
  const base=new Date(`${currentMonth}-01T00:00:00`);
  const year=base.getFullYear(), month=base.getMonth();
  const first=new Date(year,month,1), last=new Date(year,month+1,0);
  const startWeekday=first.getDay(), daysInMonth=last.getDate();
  const dayMap=sessions.reduce((acc,s)=>{
    if(!s.date?.startsWith(currentMonth)) return acc;
    const prev=acc[s.date]||{balance:0,ev:0,count:0};
    prev.balance+=s.metrics.balanceYen; prev.ev+=s.metrics.estimatedEVYen; prev.count+=1;
    acc[s.date]=prev; return acc;
  },{});
  const cells=[];
  for(let i=0;i<startWeekday;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  while(cells.length%7!==0) cells.push(null);
  function dayStyle(info,ds) {
    const sel=ds===selectedDate;
    if(!info) return { background:'#f8fafc', border:`1px solid ${C.border}`, outline:sel?`2px solid ${C.primary}`:undefined };
    const lvl=getDayStrength(info.balance,info.ev);
    const bg=lvl==='great'?'#d1fae5':lvl==='good'?'#ecfdf5':lvl==='bad'?'#ffe4e6':lvl==='weak'?'#fff1f2':'white';
    const bd=lvl==='great'?'#6ee7b7':lvl==='good'?'#bbf7d0':lvl==='bad'?'#fca5a5':lvl==='weak'?'#fecaca':C.border;
    return { background:bg, border:`1.5px solid ${bd}`, outline:sel?`2px solid ${C.primary}`:undefined };
  }
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'16px 18px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onPrev} style={{ width:36,height:36,borderRadius:12,border:`1px solid ${C.border}`,background:'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronLeft size={16} color={C.textSecondary}/></button>
        <div style={{ fontWeight:700, color:C.textPrimary }}>{year}年 {month+1}月</div>
        <button onClick={onNext} style={{ width:36,height:36,borderRadius:12,border:`1px solid ${C.border}`,background:'white',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronRight size={16} color={C.textSecondary}/></button>
      </div>
      <div style={{ padding:'12px 16px 16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
          {['日','月','火','水','木','金','土'].map(d=><div key={d} style={{ textAlign:'center',fontSize:11,color:C.textMuted,fontWeight:600 }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
          {cells.map((day,i)=>{
            if(!day) return <div key={`e${i}`} style={{ aspectRatio:'1',borderRadius:12,background:'#f8fafc' }}/>;
            const ds=`${currentMonth}-${String(day).padStart(2,'0')}`;
            const info=dayMap[ds];
            return (
              <button key={ds} onClick={()=>onSelectDate(ds)} style={{ aspectRatio:'1',borderRadius:12,padding:4,textAlign:'left',cursor:'pointer',transition:'all 0.1s',...dayStyle(info,ds) }}>
                <div style={{ fontSize:11,fontWeight:700,color:C.textPrimary }}>{day}</div>
                {info&&<div style={{ marginTop:2,fontSize:9,lineHeight:1.3,color:C.textSecondary }}>
                  <div>{info.balance>=0?'+':''}{Math.round(info.balance/1000)}k</div>
                  <div>{info.count}件</div>
                </div>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── メインコンポーネント ─── */
export default function PachinkoCalculatorComplete() {
  const [machines,setMachines]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [settings,setSettings]=useState(defaultSettings);
  const [form,setForm]=useState(emptySession(defaultSettings));
  const [activeTab,setActiveTab]=useState('rate');
  const [search,setSearch]=useState('');
  const [periodMode,setPeriodMode]=useState('month');
  const [currentMonth,setCurrentMonth]=useState(todayStr().slice(0,7));
  const [currentYear,setCurrentYear]=useState(todayStr().slice(0,4));
  const [selectedDate,setSelectedDate]=useState(todayStr());
  const [machinePanelOpen,setMachinePanelOpen]=useState(false);
  const [advancedInvestOpen,setAdvancedInvestOpen]=useState(false);
  const [metricsPanelOpen,setMetricsPanelOpen]=useState(false);
  const [firstHitDialogOpen,setFirstHitDialogOpen]=useState(false);
  const [restartDialogOpen,setRestartDialogOpen]=useState(false);
  const [restartRotationInput,setRestartRotationInput]=useState('');
  const [flashReadingId,setFlashReadingId]=useState('');
  const [undoStack,setUndoStack]=useState([]);
  const [saveStatus,setSaveStatus]=useState('saved');
  const [expectDisplayUnit,setExpectDisplayUnit]=useState('balls');
  const [expectDetailBaseRate,setExpectDetailBaseRate]=useState(null);
  const [expectManualRateInput,setExpectManualRateInput]=useState('');
  const [resultDialogOpen,setResultDialogOpen]=useState(false);
  const [showResultRateGraph,setShowResultRateGraph]=useState(false);
  const [showMoneySwitchGraph,setShowMoneySwitchGraph]=useState(false);
  const [compareCandidateRate,setCompareCandidateRate]=useState('');
  const [compareCandidateBorder,setCompareCandidateBorder]=useState('');
  const [shopProfileDraft,setShopProfileDraft]=useState({name:'',exchangeCategory:'25'});
  const readingInputRefs=useRef([]);
  const autosaveTimerRef=useRef(null);
  const skipAutosaveRef=useRef(false);
  const [judgeForm,setJudgeForm]=useState({observedRate:'',border:'',note:''});
  const [firstHitForm,setFirstHitForm]=useState({ label:'初当たり1回目',rounds:'20',startBalls:'0',upperBalls:'100',endBalls:'',restartRotation:'0',restartReason:'single',restartReasonNote:'',chainCount:'1',remainingHolds:'' });
  const [machineDraft,setMachineDraft]=useState({ name:'',shopDefault:'',border25:'',border28:'',border30:'',border33:'',border40:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',memo:'' });

  useEffect(()=>{
    const lm=loadJSON(STORAGE_KEYS.machines,defaultMachines);
    const ls=loadJSON(STORAGE_KEYS.sessions,[]);
    const lset={...defaultSettings,...loadJSON(STORAGE_KEYS.settings,defaultSettings)};
    setMachines(lm); setSessions(ls); setSettings(lset);
    const draft=[...ls].filter(s=>s.status==='draft').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
    skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved');
    setForm(draft?{...emptySession(lset),...draft}:emptySession(lset));
  },[]);
  useEffect(()=>saveJSON(STORAGE_KEYS.machines,machines),[machines]);
  useEffect(()=>saveJSON(STORAGE_KEYS.sessions,sessions),[sessions]);
  useEffect(()=>saveJSON(STORAGE_KEYS.settings,settings),[settings]);

  const enrichedSessions=useMemo(()=>sessions.map(s=>{ const m=machines.find(m=>m.id===s.machineId)||null; return {...s,machine:m,metrics:calcRateMetrics(s,m,settings)}; }).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)),[sessions,machines,settings]);
  const selectedMachine=form.machineId&&form.machineId!=='__none__'?machines.find(m=>m.id===form.machineId)||null:null;
  const formMetrics=calcRateMetrics(form,selectedMachine,settings);
  const saveStatusMeta=getSaveStatusMeta(saveStatus);
  const currentBorderInputValue=form.sessionBorderOverride!==''?form.sessionBorderOverride:(selectedMachine?String(getMachineBorderByCategory(selectedMachine,form.exchangeCategory||'25')||''):'');
  const currentObservedBaseRate=Math.floor(formMetrics.spinPerThousand||0);
  const expectTargetTenthRate=Number((Math.round(((numberOrZero(expectManualRateInput)||formMetrics.spinPerThousand||0)*10))/10).toFixed(1));
  const sessionTrendData=useMemo(()=>getSessionTrendData(form,settings),[form,settings]);
  const moneySwitchData=useMemo(()=>sessionTrendData.map(p=>({label:p.label,totalSpins:p.totalSpins,cashInvestYen:p.cashInvestYen,ballInvestYen:p.ballInvestYen})),[sessionTrendData]);
  const resultReturnedBalls=numberOrZero(form.endingBalls)+numberOrZero(form.endingUpperBalls);
  const resultPreviewMetrics=useMemo(()=>calcRateMetrics({...form,returnedBalls:resultReturnedBalls>0?String(resultReturnedBalls):form.returnedBalls},selectedMachine,settings),[form,resultReturnedBalls,selectedMachine,settings]);
  const currentDiffForCompare=formMetrics.spinPerThousand-formMetrics.machineBorder;
  const candidateDiffForCompare=numberOrZero(compareCandidateRate)-numberOrZero(compareCandidateBorder);
  const compareDecision=getContinueMoveDecision(currentDiffForCompare,candidateDiffForCompare);
  const recentShopPresets=useMemo(()=>{ const u=[]; (settings.shopProfiles||[]).forEach(p=>{if(p.name&&!u.includes(p.name))u.push(p.name);}); enrichedSessions.forEach(s=>{if(s.shop&&!u.includes(s.shop))u.push(s.shop);}); return u.slice(0,6); },[settings.shopProfiles,enrichedSessions]);
  const recentMachinePresets=useMemo(()=>{ const c={}; enrichedSessions.forEach(s=>{ const k=s.machineId&&s.machineId!=='__none__'?s.machineId:''; if(k)c[k]=(c[k]||0)+1; }); const sorted=Object.entries(c).sort((a,b)=>b[1]-a[1]).map(([id])=>id); return [...sorted,...machines.map(m=>m.id).filter(id=>!sorted.includes(id))].slice(0,6).map(id=>machines.find(m=>m.id===id)).filter(Boolean); },[enrichedSessions,machines]);
  const theoreticalMetrics=useMemo(()=>calcTheoreticalValueMetrics(formMetrics,selectedMachine,form.hours,settings),[formMetrics,selectedMachine,form.hours,settings]);

  useEffect(()=>{ setJudgeForm(p=>({...p,observedRate:p.observedRate||(formMetrics.spinPerThousand?String(Number(formMetrics.spinPerThousand.toFixed(2))):''),border:p.border||(formMetrics.machineBorder?String(formMetrics.machineBorder||''):'')})); },[formMetrics.spinPerThousand,formMetrics.machineBorder]);

  const firstHitMetrics=useMemo(()=>{ const rounds=numberOrZero(firstHitForm.rounds),startBalls=numberOrZero(firstHitForm.startBalls),upperBalls=numberOrZero(firstHitForm.upperBalls),endBalls=numberOrZero(firstHitForm.endBalls); const gainedBalls=Math.max(0,endBalls-(startBalls+upperBalls)); return {rounds,gainedBalls,oneRound:rounds>0?gainedBalls/rounds:0}; },[firstHitForm]);

  const judgeMetrics=useMemo(()=>{ const observed=numberOrZero(judgeForm.observedRate),border=numberOrZero(judgeForm.border),diff=observed-border; const playDiff=numberOrZero(settings.judgePlayDiff),watchDiff=numberOrZero(settings.judgeWatchDiff); const reliability=formMetrics.totalSpins>=200?'高':formMetrics.totalSpins>=100?'中':'低'; let verdict='判定不能',tone='secondary',comment='回転率かボーダーを入れてくれ。'; if(observed>0&&border>0){if(diff>=playDiff&&formMetrics.totalSpins>=80){verdict='打てる';tone='default';comment='今の数値なら続行候補だぜ。ブレはあるが、まだ追う価値がある。';}else if(diff>=watchDiff){verdict='様子見';tone='secondary';comment='ボーダー付近だな。もう少しサンプルを取ると精度が上がる。';}else{verdict='やめ候補';tone='destructive';comment='今のところ弱い。根拠が増えない限り深追いは危険だぜ。';}} return {observed,border,diff,verdict,tone,comment,reliability}; },[judgeForm,settings,formMetrics.totalSpins]);

  const expectedHours=clampNumber(settings.expectedHours,1,10)||4;
  const expectedSpins=expectedHours*(numberOrZero(settings.spinsPerHour)||200);

  const expectationRows=useMemo(()=>Array.from({length:15},(_,i)=>16+i).map(rate=>({rate,values:EXCHANGE_ORDER.map(category=>{const preset=getExchangePreset(category);const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,category):0;const border=mb>0?mb:DEFAULT_BORDER;const investYen=rate>0?(expectedSpins/rate)*1000:0;const evYen=calcEvYenFromRate(rate,border,investYen,settings);return {category,preset,border,evYen,evBalls:evYen/preset.yenPerBall};})})),[expectedSpins,selectedMachine,settings]);
  const expectationDetailRows=useMemo(()=>{ if(expectDetailBaseRate===null)return []; return Array.from({length:10},(_,i)=>Number((expectDetailBaseRate+i/10).toFixed(1))).map(rate=>({rate,values:EXCHANGE_ORDER.map(category=>{const preset=getExchangePreset(category);const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,category):0;const border=mb>0?mb:DEFAULT_BORDER;const investYen=rate>0?(expectedSpins/rate)*1000:0;const evYen=calcEvYenFromRate(rate,border,investYen,settings);return {category,preset,border,evYen,evBalls:evYen/preset.yenPerBall};})})); },[expectDetailBaseRate,expectedSpins,selectedMachine,settings]);

  const targetSessions=useMemo(()=>enrichedSessions.filter(s=>periodMode==='year'?yearKey(s.date)===currentYear:monthKey(s.date)===currentMonth),[enrichedSessions,periodMode,currentMonth,currentYear]);
  const selectedDateSessions=enrichedSessions.filter(s=>s.date===selectedDate);
  const summary=targetSessions.reduce((acc,s)=>{ acc.balance+=s.metrics.balanceYen; acc.ev+=s.metrics.estimatedEVYen; acc.hours+=numberOrZero(s.hours); acc.spins+=s.metrics.totalSpins; acc.count+=1; return acc; },{balance:0,ev:0,hours:0,spins:0,count:0});

  const trendChartData=useMemo(()=>{ if(periodMode==='year'){const map={}; for(let i=1;i<=12;i++) map[`${currentYear}-${String(i).padStart(2,'0')}`]={label:`${i}月`,balance:0,ev:0}; targetSessions.forEach(s=>{const k=monthKey(s.date); if(map[k]){map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen;}}); return Object.values(map); } const sorted=[...targetSessions].sort((a,b)=>a.date>b.date?1:-1); let bc=0,ec=0; return sorted.map(s=>{bc+=s.metrics.balanceYen; ec+=s.metrics.estimatedEVYen; return {label:dateLabel(s.date),balance:bc,ev:ec};}); },[targetSessions,periodMode,currentYear]);
  const machineAggregate=useMemo(()=>{ const map={}; targetSessions.forEach(s=>{const k=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'未設定'; if(!map[k])map[k]={name:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>b.ev-a.ev); },[targetSessions]);
  const shopAggregate=useMemo(()=>{ const map={}; targetSessions.forEach(s=>{const k=s.shop||'未入力'; if(!map[k])map[k]={name:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>b.ev-a.ev); },[targetSessions]);
  const lifetimeSummary=useMemo(()=>enrichedSessions.reduce((acc,s)=>({balance:acc.balance+s.metrics.balanceYen,ev:acc.ev+s.metrics.estimatedEVYen,count:acc.count+1,spins:acc.spins+s.metrics.totalSpins}),{balance:0,ev:0,count:0,spins:0}),[enrichedSessions]);
  const yearSummaryRows=useMemo(()=>{ const map={}; enrichedSessions.forEach(s=>{const k=yearKey(s.date)||'未設定'; if(!map[k])map[k]={key:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>a.key<b.key?1:-1); },[enrichedSessions]);
  const monthSummaryRows=useMemo(()=>{ const map={}; enrichedSessions.forEach(s=>{const k=monthKey(s.date)||'未設定'; if(!map[k])map[k]={key:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>a.key<b.key?1:-1); },[enrichedSessions]);
  const monthlyReport=useMemo(()=>{ const ms=enrichedSessions.filter(s=>monthKey(s.date)===currentMonth); const totals=ms.reduce((acc,s)=>({balance:acc.balance+s.metrics.balanceYen,ev:acc.ev+s.metrics.estimatedEVYen,spins:acc.spins+s.metrics.totalSpins,hours:acc.hours+numberOrZero(s.hours),workBalls:acc.workBalls+getWorkVolumeBalls(s.metrics),count:acc.count+1}),{balance:0,ev:0,spins:0,hours:0,workBalls:0,count:0}); const dayMap={}; ms.forEach(s=>{if(!dayMap[s.date])dayMap[s.date]={balance:0,ev:0}; dayMap[s.date].balance+=s.metrics.balanceYen; dayMap[s.date].ev+=s.metrics.estimatedEVYen;}); const dr=Object.entries(dayMap).map(([d,v])=>({date:d,...v})); const plusDays=dr.filter(r=>r.balance>0).length,minusDays=dr.filter(r=>r.balance<0).length,evenDays=dr.filter(r=>r.balance===0).length; const shopMap={},machineMap={}; ms.forEach(s=>{const sk=s.shop||'店舗未入力',mk=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定'; if(!shopMap[sk])shopMap[sk]={name:sk,balance:0,ev:0,count:0}; if(!machineMap[mk])machineMap[mk]={name:mk,balance:0,ev:0,count:0}; shopMap[sk].balance+=s.metrics.balanceYen; shopMap[sk].ev+=s.metrics.estimatedEVYen; shopMap[sk].count+=1; machineMap[mk].balance+=s.metrics.balanceYen; machineMap[mk].ev+=s.metrics.estimatedEVYen; machineMap[mk].count+=1;}); const bestShop=Object.values(shopMap).sort((a,b)=>b.ev-a.ev)[0]||null,bestMachine=Object.values(machineMap).sort((a,b)=>b.ev-a.ev)[0]||null; const averageRate=totals.spins>0&&ms.length>0?ms.reduce((acc,s)=>acc+s.metrics.spinPerThousand*s.metrics.totalSpins,0)/totals.spins:0; return {monthSessions:ms,totals,plusDays,minusDays,evenDays,bestShop,bestMachine,averageRate}; },[enrichedSessions,currentMonth]);
  const allShopSummaryRows=useMemo(()=>{ const map={}; enrichedSessions.forEach(s=>{const k=s.shop||'未入力'; if(!map[k])map[k]={key:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>b.balance-a.balance); },[enrichedSessions]);
  const allMachineSummaryRows=useMemo(()=>{ const map={}; enrichedSessions.forEach(s=>{const k=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'未設定'; if(!map[k])map[k]={key:k,count:0,balance:0,ev:0,spins:0}; map[k].count+=1; map[k].balance+=s.metrics.balanceYen; map[k].ev+=s.metrics.estimatedEVYen; map[k].spins+=s.metrics.totalSpins;}); return Object.values(map).sort((a,b)=>b.balance-a.balance); },[enrichedSessions]);
  const filteredHistory=enrichedSessions.filter(s=>{ const q=search.trim().toLowerCase(); if(!q)return true; return [s.date,s.shop,s.machine?.name,s.machineNameSnapshot,s.machineFreeName,s.machineNumber,s.notes,s.tags,...(s.firstHits||[]).map(h=>h.label)].join(' ').toLowerCase().includes(q); });

  function buildPersistedSession(f,ns=f.status||'draft') { const m=f.machineId&&f.machineId!=='__none__'?machines.find(m=>m.id===f.machineId)||null:null; return {...f,machineNameSnapshot:m?.name||f.machineFreeName||f.machineNameSnapshot||'',status:ns,updatedAt:Date.now()}; }
  function upsertSession(p) { setSessions(prev=>{ const e=prev.some(x=>x.id===p.id); if(e)return prev.map(x=>x.id===p.id?p:x).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); return [p,...prev].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); }); }
  function applyFormUpdate(u,opts={}) { const {trackUndo=true,markDirty=true}=opts; setForm(prev=>{if(trackUndo)setUndoStack(s=>[cloneDeep(prev),...s].slice(0,30)); return typeof u==='function'?u(prev):u;}); if(markDirty)setSaveStatus('dirty'); }
  function undoLastChange() { setUndoStack(prev=>{if(!prev.length)return prev; const [l,...r]=prev; skipAutosaveRef.current=true; setForm(l); setSaveStatus('dirty'); return r;}); }

  useEffect(()=>{ if(skipAutosaveRef.current){skipAutosaveRef.current=false;return;} if(!hasMeaningfulSession(form)||form.status==='completed')return; clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current=setTimeout(()=>{setSaveStatus('saving'); upsertSession(buildPersistedSession(form,'draft')); setSaveStatus('saved');},700); return ()=>clearTimeout(autosaveTimerRef.current); },[form,machines]);

  function updateForm(k,v) { applyFormUpdate(p=>({...p,[k]:v})); }
  function applyShopValue(v) { applyFormUpdate(p=>{ const mp=getShopProfileByName(settings.shopProfiles||[],v); return {...p,shop:v,exchangeCategory:mp?.exchangeCategory||p.exchangeCategory,sessionBorderOverride:mp?'':p.sessionBorderOverride}; }); }
  function addShopProfile() { const name=String(shopProfileDraft.name||'').trim(); if(!name)return; const np={name,exchangeCategory:shopProfileDraft.exchangeCategory||'25'}; setSettings(p=>{const f=(p.shopProfiles||[]).filter(pr=>String(pr.name||'').trim().toLowerCase()!==name.toLowerCase()); return {...p,shopProfiles:[...f,np]};}); setShopProfileDraft({name:'',exchangeCategory:'25'}); }
  function removeShopProfile(name) { setSettings(p=>({...p,shopProfiles:(p.shopProfiles||[]).filter(pr=>pr.name!==name)})); }
  function openCompleteDialog() { setShowResultRateGraph(false); setShowMoneySwitchGraph(false); setResultDialogOpen(true); }
  function finalizeSession() { setSaveStatus('saving'); const p=buildPersistedSession({...form,returnedBalls:resultReturnedBalls>0?String(resultReturnedBalls):form.returnedBalls,notes:appendLine(appendLine(form.notes,form.resultGoodMemo?`【良かった点】${form.resultGoodMemo}`:''),form.resultBadMemo?`【悪かった点】${form.resultBadMemo}`:'')  },'completed'); upsertSession(p); setSelectedDate(p.date); setCurrentMonth(monthKey(p.date)); setCurrentYear(yearKey(p.date)); skipAutosaveRef.current=true; setUndoStack([]); setForm(emptySession(settings)); setSaveStatus('saved'); setResultDialogOpen(false); setActiveTab('history'); }
  function updateRateEntry(id,k,v) { applyFormUpdate(p=>({...p,rateEntries:p.rateEntries.map(e=>e.id===id?{...e,[k]:v}:e)})); }
  function setCurrentInputMode(m) { applyFormUpdate(p=>({...p,currentInputMode:m})); }
  function syncBorderToMachine() { if(!selectedMachine||currentBorderInputValue==='')return; const f=getBorderFieldByCategory(form.exchangeCategory||'25'); setMachines(p=>p.map(m=>m.id===selectedMachine.id?{...m,[f]:numberOrZero(currentBorderInputValue)}:m)); }
  function moveFocusToNextReading(cid,idx,val) {
    const digs=String(val||'').replace(/[^0-9]/g,'');
    const prevEntry=idx===0?form.startRotation:form.rateEntries[idx-1]?.reading;
    const prevVal=numberOrZero(prevEntry);
    // しきい値: 前回値が980超なら4桁、80超なら3桁、それ以外は2桁
    const th=prevVal>980?4:prevVal>80?3:2;
    if(digs.length<th)return;
    if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(10);
    setFlashReadingId(cid); setTimeout(()=>setFlashReadingId(''),180);
    const ne=Boolean(form.rateEntries[idx+1]);
    if(!ne){
      const nk=form.currentInputMode||'cash';
      const na=nk==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000;
      applyFormUpdate(p=>checkAndArchiveIfNeeded({...p,rateEntries:[...p.rateEntries,emptyRateEntry(nk,na,'')]}));
      setTimeout(()=>readingInputRefs.current[idx+1]?.focus(),0);
      return;
    }
    applyFormUpdate(p=>checkAndArchiveIfNeeded(p));
    setTimeout(()=>{readingInputRefs.current[idx+1]?.focus(); readingInputRefs.current[idx+1]?.select?.();},0);
  }
  function addRateEntry(kind=form.currentInputMode||'cash',amount) { const ba=amount??(kind==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000); applyFormUpdate(p=>({...p,rateEntries:[...p.rateEntries,emptyRateEntry(kind,ba,'')]})); }

  // 1万円(現金)or 2500玉(持ち玉)達成で自動アーカイブ
  function archiveMeasurement(p, kind='normal', labelOverride='') {
    const machine=p.machineId&&p.machineId!=='__none__'?machines.find(m=>m.id===p.machineId)||null:null;
    const met=calcRateMetrics(p,machine,settings);
    const spins=met.currentSpins;
    const investYen=met.currentInvestYen;
    if(spins<=0&&investYen<=0) return p;
    const logCount=(p.measurementLogs||[]).length+1;
    // 現在枠の最後のゲーム数を取得（入力済みのものだけ対象）
    const lastReading=(p.rateEntries||[]).reduce((last,e)=>{
      const r=numberOrZero(e.reading);
      return (r>0&&r>last)?r:last;
    },numberOrZero(p.startRotation));
    // もし measurementLogs に endReading があればそれも考慮
    const prevLogEndReading=(p.measurementLogs||[]).reduce((last,l)=>{
      const r=numberOrZero(l.endReading); return r>last?r:last;
    },0);
    const baseReading=Math.max(lastReading,prevLogEndReading);
    const newLog={
      id:uid(),
      kind,
      label:labelOverride||(kind==='jackpot_before'?`大当たり前 計測${logCount}`:`計測${logCount}`),
      entries:[...p.rateEntries],
      spins,
      investYen,
      cashInvestYen: met.currentCashInvestYen,
      ballInvestBalls: met.currentBallInvestBalls,
      ballInvestYen: met.currentBallInvestYen,
      estimatedEVYen: met.currentEstimatedEVYen,
      rate:Number(met.currentSpinPerThousand.toFixed(2)),
      endReading: baseReading,
      createdAt:Date.now(),
    };
    const defaultKind=met.currentBalls!==null&&met.currentBalls>0?'balls':'cash';
    const defaultAmount=defaultKind==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000;
    const nextEntry=emptyRateEntry(defaultKind,defaultAmount,'');
    return {
      ...p,
      measurementLogs:[...(p.measurementLogs||[]),newLog],
      // 新枠のstartRotationを前枠の最終ゲーム数に設定（継続計測）
      startRotation: kind==='normal'?String(baseReading):p.startRotation,
      rateEntries:[nextEntry],
    };
  }

  // 投資行更新時・ゲーム数入力時に1万円/2500玉チェック
  function checkAndArchiveIfNeeded(p) {
    const machine=p.machineId&&p.machineId!=='__none__'?machines.find(m=>m.id===p.machineId)||null:null;
    const met=calcRateMetrics(p,machine,settings);
    const hasBalls=met.currentBalls!==null&&met.currentBalls>=0;
    const threshold=hasBalls?2500*met.exchangeRate:10000; // 玉なら2500玉相当円、現金なら1万円
    if(met.currentInvestYen>=threshold) {
      return archiveMeasurement(p);
    }
    return p;
  }

  // 持ち玉があるとき自動で持ち玉モードに切り替え
  useEffect(()=>{
    if(formMetrics.currentBalls!==null&&formMetrics.currentBalls>0&&form.currentInputMode!=='balls') {
      applyFormUpdate(p=>({...p,currentInputMode:'balls'}),{trackUndo:false,markDirty:false});
    }
  },[formMetrics.currentBalls]);

  function applyRestart() {
    const rotation=restartRotationInput.trim();
    applyFormUpdate(p=>({
      ...p,
      rateEntries:[...p.rateEntries, { id:uid(), kind:'restart', amount:'0', reading:rotation }],
    }));
    setRestartDialogOpen(false);
    setRestartRotationInput('');
  }
  function removeRateEntry(id) { applyFormUpdate(p=>({...p,rateEntries:p.rateEntries.length<=1?p.rateEntries:p.rateEntries.filter(e=>e.id!==id)})); }
  function selectMachine(machineId) { if(machineId==='__none__'){applyFormUpdate(p=>({...p,machineId:'__none__',sessionBorderOverride:''}));return;} const m=machines.find(m=>m.id===machineId); applyFormUpdate(p=>{ const ns=p.shop||m?.shopDefault||''; const mp=getShopProfileByName(settings.shopProfiles||[],ns); return {...p,machineId,shop:ns,machineFreeName:p.machineFreeName||'',exchangeCategory:mp?.exchangeCategory||p.exchangeCategory,sessionBorderOverride:''}; }); }
  function createNewSession() { skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm(emptySession(settings)); setActiveTab('rate'); }
  function saveDraftNow() { setSaveStatus('saving'); const p=buildPersistedSession(form,'draft'); upsertSession(p); skipAutosaveRef.current=true; setForm(p); setSaveStatus('saved'); }
  function continueSession(s) { skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm({...emptySession(settings),...s}); setActiveTab('rate'); }
  function duplicateSession(s) { skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm({...emptySession(settings),...s,id:uid(),date:todayStr(),status:'draft',updatedAt:Date.now(),firstHits:[],rateSections:[],photos:[],rateEntries:[emptyRateEntry(s.currentInputMode||'cash',(s.currentInputMode||'cash')==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000,'')]}); setActiveTab('rate'); }
  function deleteSession(id) { setSessions(p=>p.filter(x=>x.id!==id)); }
  async function addPhotos(files) { const list=Array.from(files||[]).slice(0,6); const images=[]; for(const f of list){const d=await readFileAsDataUrl(f); images.push({id:uid(),name:f.name,dataUrl:d,createdAt:Date.now()});} applyFormUpdate(p=>({...p,photos:[...(p.photos||[]),...images].slice(0,12)})); }
  function saveMachine() { if(!machineDraft.name.trim())return; const p={id:uid(),name:machineDraft.name.trim(),shopDefault:machineDraft.shopDefault.trim(),border25:numberOrZero(machineDraft.border25),border28:numberOrZero(machineDraft.border28),border30:numberOrZero(machineDraft.border30),border33:numberOrZero(machineDraft.border33),border40:numberOrZero(machineDraft.border40),payoutPerRound:numberOrZero(machineDraft.payoutPerRound),expectedBallsPerHit:numberOrZero(machineDraft.expectedBallsPerHit),totalProbability:numberOrZero(machineDraft.totalProbability),memo:machineDraft.memo}; setMachines(p=>[p,...p]); setMachineDraft({name:'',shopDefault:'',border25:'',border28:'',border30:'',border33:'',border40:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',memo:''}); }
  function openFirstHitDialog() { const nc=(form.firstHits||[]).length+1; setFirstHitForm({label:`初当たり${nc}回目`,rounds:'20',startBalls:'0',upperBalls:'100',endBalls:'',restartRotation:'0',restartReason:'single',restartReasonNote:'',chainCount:'1',remainingHolds:''}); setFirstHitDialogOpen(true); }
  function undoLastFirstHit() { const hits=form.firstHits||[]; if(!hits.length)return; const last=hits[hits.length-1]; applyFormUpdate(p=>{ const newNotes=last?.memoLine?p.notes.split('\n').filter(line=>line!==last.memoLine).join('\n'):p.notes; return {...p,firstHits:p.firstHits.slice(0,-1),notes:newNotes}; }); }
  function applyFirstHitOneRoundToMachine() { if(!selectedMachine)return; setMachines(p=>p.map(m=>m.id===selectedMachine.id?{...m,payoutPerRound:Number(firstHitMetrics.oneRound.toFixed(1))}:m)); }
  function completeFirstHit(restartAfter=false) {
    const label=firstHitForm.label||`初当たり${(form.firstHits||[]).length+1}回目`;
    const crl=getChainResultLabel(firstHitForm.chainCount);
    const rh=numberOrZero(firstHitForm.remainingHolds);
    const rhStr=rh>0?` / 残り保留${rh}個`:'';
    const ml=`[${label}] ${firstHitMetrics.rounds}R / 獲得${Math.round(firstHitMetrics.gainedBalls)}玉 / 1R ${Number(firstHitMetrics.oneRound.toFixed(1))} / ${crl}${rhStr}`;
    const hit={id:uid(),label,rounds:firstHitMetrics.rounds,startBalls:numberOrZero(firstHitForm.startBalls),upperBalls:numberOrZero(firstHitForm.upperBalls),endBalls:numberOrZero(firstHitForm.endBalls),gainedBalls:firstHitMetrics.gainedBalls,oneRound:Number(firstHitMetrics.oneRound.toFixed(1)),chainCount:numberOrZero(firstHitForm.chainCount),chainResultLabel:crl,remainingHolds:rh,memoLine:ml};
    applyFormUpdate(prev=>{
      const nb={...prev,firstHits:[...(prev.firstHits||[]),hit],notes:appendLine(prev.notes,ml)};
      if(!restartAfter)return nb;
      const m=nb.machineId&&nb.machineId!=='__none__'?machines.find(m=>m.id===nb.machineId)||null:null;
      const met=calcRateMetrics(nb,m,settings);
      const rsr=numberOrZero(firstHitForm.restartRotation);
      const rrl=getRestartReasonLabel(firstHitForm.restartReason,firstHitForm.restartReasonNote);
      const sl=`通常${(nb.rateSections||[]).length+1}区間`;
      const rl=`[${sl}] ${met.currentSpins}回転 / ${Math.round(met.currentInvestYen).toLocaleString()}円 / ${Number(met.currentSpinPerThousand.toFixed(2))} で区切って再スタート (${rsr}回転から / ${rrl})`;

      // ① 大当たり前の計測をアーカイブ（kind:'jackpot_before'）
      const logCount=(nb.measurementLogs||[]).length+1;
      const jackpotLog={
        id:uid(),
        kind:'jackpot_before',
        label:`大当たり前 計測${logCount}`,
        entries:[...nb.rateEntries],
        spins:met.currentSpins,
        investYen:met.currentInvestYen,
        cashInvestYen:met.currentCashInvestYen,
        ballInvestBalls:met.currentBallInvestBalls,
        ballInvestYen:met.currentBallInvestYen,
        estimatedEVYen:met.currentEstimatedEVYen,
        rate:Number(met.currentSpinPerThousand.toFixed(2)),
        endReading:met.currentEndRotation,
        createdAt:Date.now(),
      };

      // ② 大当たり終了後の行: ゲーム数=再スタート回転、種別='jackpot_after'
      const afterEntry={ id:uid(), kind:'jackpot_after', amount:'0', reading:rsr>0?String(rsr):'' };
      const na=nb.currentInputMode==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000;
      const nextEntry=emptyRateEntry(nb.currentInputMode||'cash',na,'');

      const sec={id:uid(),label:sl,startRotation:numberOrZero(nb.startRotation),endRotation:met.currentEndRotation,spins:met.currentSpins,investYen:met.currentInvestYen,cashInvestYen:met.currentCashInvestYen,ballInvestBalls:met.currentBallInvestBalls,ballInvestYen:met.currentBallInvestYen,spinPerThousand:Number(met.currentSpinPerThousand.toFixed(2)),estimatedEVYen:Math.round(met.currentEstimatedEVYen),restartReasonLabel:rrl};
      const ap=buildSectionRateHistoryPoints(nb,settings);

      return {
        ...nb,
        measurementLogs:[...(nb.measurementLogs||[]),jackpotLog],
        rateSections:[...(nb.rateSections||[]),sec],
        rateHistoryPoints:[...(nb.rateHistoryPoints||[]),...ap],
        startRotation:rsr>0?String(rsr):nb.startRotation,
        totalSpinsManual:'',
        rateEntries:[afterEntry, nextEntry],
        notes:appendLine(nb.notes,rl),
      };
    });
    setFirstHitDialogOpen(false);
  }
  function removeFirstHit(hid) { applyFormUpdate(p=>{ const hit=(p.firstHits||[]).find(h=>h.id===hid); const newNotes=hit?.memoLine?p.notes.split('\n').filter(l=>l!==hit.memoLine).join('\n'):p.notes; return {...p,firstHits:(p.firstHits||[]).filter(h=>h.id!==hid),notes:newNotes}; }); }
  function exportData() { const blob=new Blob([JSON.stringify({machines,sessions,settings},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`pachinko-complete-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url); }
  function importData(file) { const r=new FileReader(); r.onload=()=>{ try { const d=JSON.parse(String(r.result||'{}')); if(Array.isArray(d.machines))setMachines(d.machines); if(Array.isArray(d.sessions))setSessions(d.sessions); if(d.settings)setSettings({...defaultSettings,...d.settings}); } catch { alert('JSONの読み込みに失敗したぜ'); } }; r.readAsText(file); }
  function moveMonth(delta) { const d=new Date(`${currentMonth}-01T00:00:00`); d.setMonth(d.getMonth()+delta); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
  function moveYear(delta) { setCurrentYear(String(Number(currentYear)+delta)); }

  /* ─── スタイル定数 ─── */
  const cardStyle={ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' };
  const inputStyle={ background:'white', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 16px', fontSize:16, color:C.textPrimary, width:'100%', boxSizing:'border-box', outline:'none' };
  const labelStyle={ fontSize:13, fontWeight:600, color:C.textSecondary, display:'block', marginBottom:6 };
  const btnPrimary={ background:C.primary, color:'white', border:'none', borderRadius:14, padding:'14px 20px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };
  const btnSecondary={ background:C.primaryLight, color:C.primary, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'14px 20px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };
  const btnOutline={ background:'white', color:C.textSecondary, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'14px 20px', fontWeight:600, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };

  // 指標カード（ライト版）
  function MetricBox({ label, value, sub, color }) {
    return (
      <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'14px 16px' }}>
        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
        <div style={{ marginTop:5, fontSize:20, fontWeight:700, color:color||C.primary }}>{value}</div>
        {sub&&<div style={{ marginTop:3, fontSize:11, color:C.textMuted }}>{sub}</div>}
      </div>
    );
  }

  const TABS = [
    {id:'rate',label:'回転率'},
    {id:'expect',label:'期待収支'},
    {id:'judge',label:'稼働判定'},
    {id:'calendar',label:'日別'},
    {id:'analysis',label:'まとめ'},
    {id:'history',label:'履歴'},
    {id:'settings',label:'設定'},
  ];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'system-ui,-apple-system,sans-serif', color:C.textPrimary }}>
      <div style={{ maxWidth:520, margin:'0 auto', padding:'14px 14px 130px' }}>

        {/* ─── ヘッダー ─── */}
        <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} style={{marginBottom:16}}>
          <div style={{ background:`linear-gradient(135deg, ${C.primary} 0%, #7c3aed 100%)`, borderRadius:24, padding:'20px 22px', boxShadow:'0 4px 20px rgba(79,70,229,0.3)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
              <div>
                <div style={{ fontSize:10, letterSpacing:'0.25em', color:'rgba(255,255,255,0.7)', textTransform:'uppercase', fontWeight:700 }}>PACHINKO ANALYZER</div>
                <div style={{ marginTop:4, fontSize:22, fontWeight:800, color:'white' }}>実戦・回転率管理</div>
                <div style={{ marginTop:3, fontSize:12, color:'rgba(255,255,255,0.75)' }}>25/28/30/33/40 個別ボーダー対応</div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.15)', borderRadius:16, padding:12 }}>
                <BarChart3 size={28} color="white"/>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ─── 期間切替 ─── */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <Chip active={periodMode==='month'} onClick={()=>setPeriodMode('month')}>月別</Chip>
          <Chip active={periodMode==='year'} onClick={()=>setPeriodMode('year')}>年別</Chip>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
            {periodMode==='month'?(
              <>
                <button onClick={()=>moveMonth(-1)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><ChevronLeft size={15} color={C.textSecondary}/></button>
                <span style={{ fontSize:13,fontWeight:700,color:C.textPrimary,padding:'0 8px' }}>{currentMonth}</span>
                <button onClick={()=>moveMonth(1)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><ChevronRight size={15} color={C.textSecondary}/></button>
              </>
            ):(
              <>
                <button onClick={()=>moveYear(-1)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><ChevronLeft size={15} color={C.textSecondary}/></button>
                <span style={{ fontSize:13,fontWeight:700,color:C.textPrimary,padding:'0 8px' }}>{currentYear}年</span>
                <button onClick={()=>moveYear(1)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><ChevronRight size={15} color={C.textSecondary}/></button>
              </>
            )}
          </div>
        </div>

        {/* ─── サマリー4枚 ─── */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
          <SummaryMetric title="実収支" value={fmtYen(summary.balance)} positive={summary.balance>=0}/>
          <SummaryMetric title="期待値" value={fmtYen(summary.ev)} positive={summary.ev>=0}/>
          <SummaryMetric title="稼働件数" value={`${summary.count}件`} sub={`総回転 ${Math.round(summary.spins).toLocaleString()}回`}/>
          <SummaryMetric title="時給期待値" value={summary.hours>0?fmtYen(summary.ev/summary.hours):'-'} sub={summary.hours>0?`総時間 ${summary.hours.toFixed(1)}h`:'時間未入力'}/>
        </div>

        {/* ─── タブ ─── */}
        <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', marginBottom:16, scrollbarWidth:'none' }}>
          <div style={{ display:'inline-flex', gap:6, background:'white', borderRadius:18, padding:6, border:`1px solid ${C.border}`, boxShadow:'0 1px 4px rgba(0,0,0,0.06)', minWidth:'max-content' }}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{ padding:'7px 16px', borderRadius:12, border:'none', background:activeTab===t.id?C.primary:'transparent', color:activeTab===t.id?'white':C.textSecondary, fontWeight:activeTab===t.id?700:500, fontSize:13, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════ 回転率タブ ══════════════════ */}
        {activeTab==='rate'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={cardStyle}>
              <div style={{ background:`linear-gradient(135deg, ${C.primary}, #7c3aed)`, padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, letterSpacing:'0.2em', color:'rgba(255,255,255,0.7)', textTransform:'uppercase', fontWeight:700 }}>RATE CALCULATOR</div>
                    <div style={{ marginTop:4, fontSize:18, fontWeight:800, color:'white' }}>回転率計算</div>
                    <div style={{ marginTop:3, fontSize:12, color:'rgba(255,255,255,0.7)', display:'flex', gap:10 }}>
                      <span>{form.status==='completed'?'終了済み':'自動保存中'}</span>
                      <span style={{ color:saveStatusMeta.color }}>{saveStatusMeta.label}</span>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    <span style={{ background:'rgba(255,255,255,0.2)', color:'white', borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:600 }}>{form.status==='draft'?'途中':'終了'}</span>
                    <button onClick={createNewSession} style={{ ...btnOutline, padding:'7px 14px', fontSize:12, borderColor:'rgba(255,255,255,0.3)', color:'white', background:'rgba(255,255,255,0.15)' }}>新規</button>
                  </div>
                </div>
              </div>

              <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>
                {/* 台データ設定アコーディオン */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
                  <button onClick={()=>setMachinePanelOpen(p=>!p)} style={{ width:'100%', background:C.primaryLight, border:'none', padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontWeight:700, color:C.primary, fontSize:14 }}>台データ設定</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>店舗・機種・台番号・ボーダー設定</div>
                    </div>
                    <ChevronDown size={16} color={C.primary} style={{ transform:machinePanelOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                  </button>
                  {machinePanelOpen&&(
                    <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div><label style={labelStyle}>日付</label><input type="date" value={form.date} onChange={e=>updateForm('date',e.target.value)} style={inputStyle}/></div>
                        <div><label style={labelStyle}>店舗名</label><input value={form.shop} onChange={e=>applyShopValue(e.target.value)} style={inputStyle} placeholder="未入力でも可"/></div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div>
                          <label style={labelStyle}>機種</label>
                          <Select value={form.machineId||'__none__'} onValueChange={selectMachine}>
                            <SelectTrigger style={{ ...inputStyle, height:40 }}><span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedMachine?.name||'未選択'}</span></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">未選択</SelectItem>
                              {machines.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div><label style={labelStyle}>台番号</label><input value={form.machineNumber} onChange={e=>updateForm('machineNumber',e.target.value)} style={inputStyle} placeholder="任意"/></div>
                      </div>
                      <div><label style={labelStyle}>機種名フリー入力</label><input value={form.machineFreeName} onChange={e=>updateForm('machineFreeName',e.target.value)} style={inputStyle} placeholder="未登録時用"/></div>

                      {(recentShopPresets.length>0||recentMachinePresets.length>0)&&(
                        <div style={{ background:C.primaryLight, borderRadius:12, padding:'10px 12px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:C.primary, marginBottom:8 }}>入力補助プリセット</div>
                          {recentShopPresets.length>0&&(
                            <div style={{ marginBottom:8 }}>
                              <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>店舗</div>
                              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
                                {recentShopPresets.map(n=><button key={n} onClick={()=>applyShopValue(n)} style={{ ...btnSecondary, padding:'5px 12px', fontSize:12, whiteSpace:'nowrap', flexShrink:0 }}>{n}</button>)}
                              </div>
                            </div>
                          )}
                          {recentMachinePresets.length>0&&(
                            <div>
                              <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>機種</div>
                              <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4 }}>
                                {recentMachinePresets.map(m=><button key={m.id} onClick={()=>selectMachine(m.id)} style={{ ...btnSecondary, padding:'5px 12px', fontSize:12, whiteSpace:'nowrap', flexShrink:0 }}>{m.name}</button>)}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {selectedMachine&&(
                        <div style={{ background:'#f8fafc', borderRadius:12, padding:'10px 12px' }}>
                          <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>登録ボーダー一覧</div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:10 }}>
                            {EXCHANGE_ORDER.map(cat=>(
                              <div key={cat} style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'6px 4px', textAlign:'center' }}>
                                <div style={{ fontSize:10, color:C.textMuted }}>{getExchangePreset(cat).short}</div>
                                <div style={{ fontSize:14, fontWeight:700, color:C.accent, marginTop:2 }}>{fmtRate(getMachineBorderByCategory(selectedMachine,cat))}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                            {[['1R出玉',fmtRate(selectedMachine.payoutPerRound)],['平均獲得',`${Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉`],['確率',selectedMachine.totalProbability?fmtRate(selectedMachine.totalProbability):'-']].map(([l,v])=>(
                              <div key={l} style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'6px 4px', textAlign:'center' }}>
                                <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
                                <div style={{ fontSize:13, fontWeight:700, color:C.amber, marginTop:2 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Dialog>
                        <DialogTrigger asChild>
                          <button style={{ ...btnSecondary, width:'100%' }}>機種追加 / 個別ボーダー登録</button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm rounded-3xl">
                          <DialogHeader><DialogTitle>機種データ追加</DialogTitle></DialogHeader>
                          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                            <div><Label>機種名</Label><Input value={machineDraft.name} onChange={e=>setMachineDraft(p=>({...p,name:e.target.value}))} className="mt-1 rounded-2xl"/></div>
                            <div><Label>よく行く店舗(任意)</Label><Input value={machineDraft.shopDefault} onChange={e=>setMachineDraft(p=>({...p,shopDefault:e.target.value}))} className="mt-1 rounded-2xl"/></div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                              {[['border25','25個(等価)'],['border28','28個'],['border30','30個'],['border33','33個'],['border40','40個']].map(([k,l])=>(
                                <div key={k}><Label>{l}</Label><Input value={machineDraft[k]} onChange={e=>setMachineDraft(p=>({...p,[k]:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal"/></div>
                              ))}
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                              <div><Label>1R出玉</Label><Input value={machineDraft.payoutPerRound} onChange={e=>setMachineDraft(p=>({...p,payoutPerRound:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                              <div><Label>平均獲得出玉</Label><Input value={machineDraft.expectedBallsPerHit} onChange={e=>setMachineDraft(p=>({...p,expectedBallsPerHit:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                              <div style={{ gridColumn:'1/-1' }}><Label>トータル確率</Label><Input value={machineDraft.totalProbability} onChange={e=>setMachineDraft(p=>({...p,totalProbability:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal" placeholder="例: 99.9"/></div>
                            </div>
                            <div><Label>メモ</Label><Textarea value={machineDraft.memo} onChange={e=>setMachineDraft(p=>({...p,memo:e.target.value}))} className="mt-1 min-h-[70px] rounded-2xl"/></div>
                            <Button className="w-full rounded-2xl" onClick={saveMachine}>保存</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>

                {/* 等価/非等価 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <button onClick={()=>applyFormUpdate(p=>({...p,exchangeCategory:'25',sessionBorderOverride:''}))} style={{ ...(form.exchangeCategory==='25'?btnPrimary:btnOutline), padding:'12px' }}>等価</button>
                  <button onClick={()=>applyFormUpdate(p=>({...p,exchangeCategory:p.exchangeCategory==='25'?'28':p.exchangeCategory,sessionBorderOverride:''}))} style={{ ...(form.exchangeCategory!=='25'?btnPrimary:btnOutline), padding:'12px' }}>非等価</button>
                </div>
                {form.exchangeCategory!=='25'&&(
                  <div>
                    <label style={labelStyle}>非等価種別</label>
                    <Select value={form.exchangeCategory} onValueChange={v=>applyFormUpdate(p=>({...p,exchangeCategory:v,sessionBorderOverride:''}))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {['28','30','33'].map(v=><SelectItem key={v} value={v}>{v}個</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 指標グリッド（折りたたみ） */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
                  {/* ヘッダー：常時表示の主要2指標＋開閉ボタン */}
                  <button
                    onClick={()=>setMetricsPanelOpen(p=>!p)}
                    style={{ width:'100%', background:C.primaryLight, border:'none', padding:'13px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                  >
                    <div style={{ display:'flex', gap:14, alignItems:'center', flexWrap:'wrap' }}>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>平均回転率</div>
                        <div style={{ fontSize:20, fontWeight:800, color:C.accent }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                      </div>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>ボーダー</div>
                        <div style={{ fontSize:20, fontWeight:800, color:C.primary }}>{currentBorderInputValue||DEFAULT_BORDER}</div>
                      </div>
                      {formMetrics.currentBalls!==null&&(
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>持ち玉</div>
                          <div style={{ fontSize:20, fontWeight:800, color:C.amber }}>{formMetrics.currentBalls.toLocaleString()}玉</div>
                        </div>
                      )}
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>収支</div>
                        <div style={{ fontSize:20, fontWeight:800, color:formMetrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(formMetrics.balanceYen)}</div>
                      </div>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ fontSize:12, color:C.primary, fontWeight:600 }}>{metricsPanelOpen?'閉じる':'詳細'}</span>
                      <ChevronDown size={16} color={C.primary} style={{ transform:metricsPanelOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                    </div>
                  </button>

                  {/* 展開時：全指標グリッド */}
                  {metricsPanelOpen&&(
                    <div style={{ padding:'12px 12px 14px', display:'flex', flexDirection:'column', gap:8, borderTop:`1px solid ${C.border}` }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <MetricBox label="累計回転数" value={Math.round(formMetrics.allTotalSpins)} sub={`現在枠 ${Math.round(formMetrics.currentFrameSpins)}回`}/>
                        <MetricBox label="平均回転率" value={fmtRate(formMetrics.avgSpinPerThousand)} sub={`現在枠 ${fmtRate(formMetrics.currentFrameRate)}`} color={C.accent}/>
                        <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'12px 14px' }}>
                          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>現在ボーダー</div>
                          <input value={currentBorderInputValue} onChange={e=>updateForm('sessionBorderOverride',e.target.value)} style={{ ...inputStyle, border:`1.5px solid ${C.primaryMid}`, background:'white', textAlign:'center', fontWeight:700, fontSize:18, color:C.primary, padding:'6px 10px' }} inputMode="decimal" placeholder="18.00"/>
                          <div style={{ marginTop:4, display:'flex', justifyContent:'space-between', fontSize:10, color:C.textMuted }}>
                            <span>{getExchangePreset(form.exchangeCategory||'25').short}</span>
                            {selectedMachine&&<button onClick={syncBorderToMachine} style={{ background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:10, fontWeight:600 }}>機種へ反映</button>}
                          </div>
                        </div>
                        <MetricBox label="持ち玉比率" value={`${fmtRate(formMetrics.holdBallRatio)}%`} sub={getExchangePreset(form.exchangeCategory||'25').label}/>
                        <MetricBox label="仕事量(理論)" value={theoreticalMetrics.workVolumeYen!==null?fmtYen(theoreticalMetrics.workVolumeYen):'-'} sub={theoreticalMetrics.workVolumeBalls!==null?`${Math.round(theoreticalMetrics.workVolumeBalls).toLocaleString()}玉`:'確率入力待ち'} color={C.positive}/>
                        <MetricBox label="1R出玉" value={selectedMachine?fmtRate(selectedMachine.payoutPerRound):'-'} sub={selectedMachine?.expectedBallsPerHit?`平均 ${Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉`:'-'} color={C.amber}/>
                        <MetricBox label="通常回転時速" value={theoreticalMetrics.normalSpinsPerHour?fmtRate(theoreticalMetrics.normalSpinsPerHour):'-'} sub="h あたり通常回転"/>
                        <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'12px 14px' }}>
                          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>回転単価</div>
                          <div style={{ marginTop:4, fontSize:18, fontWeight:700, color:theoreticalMetrics.mixedUnitPriceYen===null?C.textMuted:numberOrZero(theoreticalMetrics.mixedUnitPriceYen)>=0?C.positive:C.negative }}>{theoreticalMetrics.mixedUnitPriceYen!==null?`${theoreticalMetrics.mixedUnitPriceYen>=0?'+':''}${fmtRate(theoreticalMetrics.mixedUnitPriceYen)}円`:'-'}</div>
                          <div style={{ marginTop:2, fontSize:10, color:C.textMuted }}>持玉/現金比率反映</div>
                        </div>
                        <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'12px 14px' }}>
                          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>時給(理論)</div>
                          <div style={{ marginTop:4, fontSize:18, fontWeight:700, color:theoreticalMetrics.theoreticalHourlyYen===null?C.textMuted:numberOrZero(theoreticalMetrics.theoreticalHourlyYen)>=0?C.positive:C.negative }}>{theoreticalMetrics.theoreticalHourlyYen!==null?fmtYen(theoreticalMetrics.theoreticalHourlyYen):'-'}</div>
                          <div style={{ marginTop:2, fontSize:10, color:C.textMuted }}>回転単価×時速</div>
                        </div>
                        <div style={{ background:formMetrics.balanceYen>=0?C.positiveBg:C.negativeBg, border:`1px solid ${formMetrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:16, padding:'12px 14px' }}>
                          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.06em' }}>収支</div>
                          <div style={{ marginTop:4, fontSize:18, fontWeight:700, color:formMetrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(formMetrics.balanceYen)}</div>
                          <div style={{ marginTop:2, fontSize:10, color:C.textMuted }}>実収支/自動計算</div>
                        </div>
                      </div>
                      <div style={{ background:C.accentLight, border:`1px solid #bae6fd`, borderRadius:12, padding:'10px 14px', fontSize:11, color:'#0369a1' }}>
                        回転単価は1回転あたり期待値。仕事量(理論)は回転単価×通常回転数。トータル確率・平均獲得出玉・1R出玉を機種データへ入れると自動反映されるぜ。
                      </div>
                    </div>
                  )}
                </div>

                {/* 現金/持ち玉 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  <button onClick={()=>setCurrentInputMode('cash')} style={{ ...(form.currentInputMode==='cash'?btnPrimary:btnOutline), padding:'12px' }}>現金</button>
                  <button onClick={()=>setCurrentInputMode('balls')} style={{ ...(form.currentInputMode==='balls'?btnPrimary:btnOutline), padding:'12px' }}>持ち玉</button>
                </div>

                {/* 投資設定アコーディオン */}
                <div style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
                  <button onClick={()=>setAdvancedInvestOpen(p=>!p)} style={{ width:'100%', background:C.primaryLight, border:'none', padding:'11px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                    <div style={{ textAlign:'left' }}>
                      <div style={{ fontWeight:700, color:C.primary, fontSize:13 }}>投資設定</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>500円行・持ち玉行の追加</div>
                    </div>
                    <ChevronDown size={16} color={C.primary} style={{ transform:advancedInvestOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                  </button>
                  {advancedInvestOpen&&(
                    <div style={{ padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                        <div><label style={labelStyle}>現金標準</label><input value={settings.defaultCashUnitYen} onChange={e=>setSettings(p=>({...p,defaultCashUnitYen:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>
                        <div><label style={labelStyle}>500円用</label><input value={settings.subCashUnitYen} onChange={e=>setSettings(p=>({...p,subCashUnitYen:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>
                        <div><label style={labelStyle}>持ち玉標準</label><input value={settings.defaultBallUnit} onChange={e=>setSettings(p=>({...p,defaultBallUnit:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <button onClick={()=>addRateEntry('cash',numberOrZero(settings.subCashUnitYen)||500)} style={btnSecondary}>+500円行</button>
                        <button onClick={()=>addRateEntry('balls',numberOrZero(settings.defaultBallUnit)||250)} style={btnSecondary}>+持ち玉行</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* 打ち始め回転 */}
                <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:16, padding:'12px 14px' }}>
                  <label style={{ ...labelStyle, color:C.primary }}>打ち始め回転数</label>
                  <input value={form.startRotation} onChange={e=>updateForm('startRotation',e.target.value)} style={{ ...inputStyle, border:`1.5px solid ${C.primaryMid}` }} inputMode="numeric" placeholder="124"/>
                </div>

                {/* 回転率入力リスト（スマホ2段カード形式） */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {form.rateEntries.map((entry,index)=>{
                    const prevR=index===0?numberOrZero(form.startRotation):numberOrZero(form.rateEntries[index-1]?.reading);
                    const curR=numberOrZero(entry.reading);
                    const hasReading=curR>0&&curR>=prevR;
                    const spins=hasReading?curR-prevR:0;
                    const amount=numberOrZero(entry.amount);
                    const entryInvestYen=entry.kind==='balls'?amount*formMetrics.exchangeRate:amount;
                    const rate=entryInvestYen>0&&spins>0?spins/(entryInvestYen/1000):0;
                    const border=numberOrZero(formMetrics.machineBorder);
                    const diff=rate-border;
                    const tone=getRateTone(diff,border);
                    const ev=border>0&&rate>0?calcEvYenFromRate(rate,border,entryInvestYen,settings):0;
                    const isFocused=flashReadingId===entry.id;
                    const isRestart=entry.kind==='restart';
                    return (
                      <div
                        key={entry.id}
                        style={{
                          border:`2px solid ${isRestart?'#fde68a':isFocused?'#10b981':hasReading?tone.border:C.border}`,
                          borderRadius:16,
                          background:isRestart?'#fffbeb':isFocused?'#ecfdf5':hasReading?tone.bg:'white',
                          overflow:'hidden',
                          transition:'all 0.15s',
                        }}
                      >
                        {/* 上段：ゲーム数入力 ＋ 投資種別・金額 ＋ 削除 */}
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 12px' }}>
                          {/* ゲーム数（大きく） */}
                          <div style={{ flex:'0 0 90px' }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, marginBottom:3 }}>ゲーム数</div>
                            <input
                              ref={el=>{readingInputRefs.current[index]=el;}}
                              value={entry.reading}
                              onChange={e=>{const v=e.target.value; updateRateEntry(entry.id,'reading',v); moveFocusToNextReading(entry.id,index,v);}}
                              style={{
                                width:'100%', boxSizing:'border-box',
                                textAlign:'center', fontSize:24, fontWeight:800,
                                border:`2px solid ${isFocused?'#10b981':C.border}`,
                                borderRadius:10, padding:'8px 4px',
                                background:'white', color:C.textPrimary,
                                outline:'none',
                              }}
                              inputMode="numeric" enterKeyHint="next" placeholder="—"
                            />
                          </div>
                          {/* 投資 */}
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600, marginBottom:3 }}>投資</div>
                            {entry.kind==='restart' ? (
                              <div style={{ display:'flex', alignItems:'center', height:40 }}>
                                <span style={{ padding:'7px 14px', borderRadius:8, fontWeight:700, fontSize:13, background:'#fef3c7', color:'#d97706', border:'1.5px solid #fde68a' }}>
                                  🔄 再スタート
                                </span>
                              </div>
                            ) : entry.kind==='jackpot_after' ? (
                              <div style={{ display:'flex', alignItems:'center', height:40 }}>
                                <span style={{ padding:'7px 14px', borderRadius:8, fontWeight:700, fontSize:13, background:'#fdf4ff', color:'#9333ea', border:'1.5px solid #e9d5ff' }}>
                                  🎰 大当たり終了後
                                </span>
                              </div>
                            ) : (
                              <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                                <button
                                  onClick={()=>updateRateEntry(entry.id,'kind',entry.kind==='balls'?'cash':'balls')}
                                  style={{ flexShrink:0, padding:'7px 10px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:12, background:entry.kind==='balls'?C.positiveBg:C.accentLight, color:entry.kind==='balls'?C.positive:C.accent }}
                                >
                                  {entry.kind==='balls'?'持ち玉':'現金'}
                                </button>
                                <input
                                  value={entry.amount}
                                  onChange={e=>updateRateEntry(entry.id,'amount',e.target.value)}
                                  style={{ flex:1, textAlign:'right', fontSize:16, fontWeight:700, border:`1.5px solid ${C.border}`, borderRadius:8, padding:'7px 10px', background:'white', color:C.textPrimary, outline:'none', width:'100%', boxSizing:'border-box' }}
                                  inputMode="numeric" enterKeyHint="done"
                                  placeholder={entry.kind==='balls'?'250':'1000'}
                                />
                              </div>
                            )}
                          </div>
                          {/* 削除 */}
                          <button
                            onClick={()=>removeRateEntry(entry.id)}
                            style={{ flexShrink:0, width:34, height:34, borderRadius:10, border:`1px solid ${C.border}`, background:'white', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginTop:16 }}
                          >
                            <Trash2 size={15} color={C.textMuted}/>
                          </button>
                        </div>
                        {/* 下段：計算結果（入力済みのみ表示） */}
                        {hasReading&&(
                          <div style={{ borderTop:`1px solid ${hasReading?tone.border:C.border}`, background:'rgba(255,255,255,0.6)', padding:'8px 14px', display:'flex', gap:0 }}>
                            {[
                              ['回転数', spins+'回', C.accent],
                              ['回転率', fmtRate(rate), tone.text],
                              ['期待値', border>0?`¥${Math.round(ev)}`:'—', ev>=0?C.positive:C.negative],
                            ].map(([l,v,c],i,arr)=>(
                              <div key={l} style={{ flex:1, textAlign:'center', borderRight:i<arr.length-1?`1px solid ${C.border}`:'none', padding:'0 4px' }}>
                                <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{l}</div>
                                <div style={{ marginTop:2, fontSize:15, fontWeight:800, color:c }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* ボタン2列 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <button
                    onClick={()=>addRateEntry(form.currentInputMode, form.currentInputMode==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000)}
                    style={{ ...btnSecondary, padding:'14px', fontSize:15 }}
                  >
                    ＋投資行を追加
                  </button>
                  <button
                    onClick={()=>{ setRestartRotationInput(''); setRestartDialogOpen(true); }}
                    style={{ background:'#fffbeb', color:'#d97706', border:'2px solid #fde68a', borderRadius:14, padding:'14px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                  >
                    🔄 再スタート
                  </button>
                </div>

                {/* 再スタートダイアログ */}
                <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
                  <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader><DialogTitle>再スタート</DialogTitle></DialogHeader>
                    <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'4px 0' }}>
                      <div style={{ background:'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#92400e' }}>
                        大当たり終了後など、回転率を区切って再スタートする際に使うぜ。再スタート時点のゲーム数を入力してくれ。
                      </div>
                      <div>
                        <label style={{ fontSize:13, fontWeight:600, color:'#475569', display:'block', marginBottom:8 }}>再スタート時のゲーム数</label>
                        <input
                          value={restartRotationInput}
                          onChange={e=>setRestartRotationInput(e.target.value)}
                          style={{ width:'100%', boxSizing:'border-box', fontSize:28, fontWeight:800, textAlign:'center', border:'2px solid #fde68a', borderRadius:14, padding:'14px', color:'#0f172a', outline:'none', background:'white' }}
                          inputMode="numeric"
                          placeholder="例: 243"
                          autoFocus
                        />
                        <div style={{ fontSize:11, color:'#94a3b8', marginTop:6 }}>入力しない場合は空欄のまま決定してください</div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <Button variant="secondary" className="rounded-2xl" onClick={()=>setRestartDialogOpen(false)}>キャンセル</Button>
                        <button
                          onClick={applyRestart}
                          style={{ background:'#d97706', color:'white', border:'none', borderRadius:14, padding:'12px', fontWeight:700, fontSize:15, cursor:'pointer' }}
                        >
                          決定
                        </button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* スティッキーサマリー */}
                <div style={{ position:'sticky', bottom:80, zIndex:10, background:'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:20, padding:'12px 16px', backdropFilter:'blur(12px)', boxShadow:'0 -2px 16px rgba(0,0,0,0.08)' }}>
                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:8 }}>今日の1台サマリー</div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${formMetrics.currentBalls!==null?5:4},1fr)`, gap:4, textAlign:'center' }}>
                    {[
                      ['総回転', Math.round(formMetrics.totalSpins)+'回', null],
                      ['現金投資', fmtYen(formMetrics.totalInvestYen), null],
                      ['平均率', fmtRate(formMetrics.avgSpinPerThousand), C.accent],
                      ...(formMetrics.currentBalls!==null?[['持ち玉', formMetrics.currentBalls.toLocaleString()+'玉', C.amber]]:[]),
                      ['収支', fmtYen(formMetrics.balanceYen), formMetrics.balanceYen>=0?C.positive:C.negative],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{ background:'#f8fafc', borderRadius:10, padding:'6px 2px' }}>
                        <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
                        <div style={{ marginTop:2, fontWeight:700, fontSize:12, color:c||C.textPrimary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 過去計測履歴（1万円/2500玉ごとのアーカイブ） */}
                {(form.measurementLogs||[]).length>0&&(
                  <details style={{ border:`1px solid ${C.border}`, borderRadius:16, background:'white', overflow:'hidden' }}>
                    <summary style={{ cursor:'pointer', listStyle:'none', padding:'13px 16px', background:C.primaryLight }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontWeight:700, color:C.primary, fontSize:14 }}>📊 過去の計測結果</div>
                          <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{(form.measurementLogs||[]).length}件 / 全計測の平均: {fmtRate(formMetrics.avgSpinPerThousand)} / 全{Math.round(formMetrics.allTotalSpins).toLocaleString()}回転</div>
                        </div>
                        <ChevronDown size={16} color={C.primary}/>
                      </div>
                    </summary>
                    <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                      {/* 全計測の平均サマリー */}
                      <div style={{ background:C.accentLight, border:`1px solid #bae6fd`, borderRadius:12, padding:'10px 14px', display:'flex', gap:20 }}>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>全計測 平均回転率</div>
                          <div style={{ fontSize:18, fontWeight:800, color:C.accent }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>計測回数</div>
                          <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{(form.measurementLogs||[]).length}回</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>全総回転</div>
                          <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{Math.round(formMetrics.allTotalSpins).toLocaleString()}回</div>
                        </div>
                      </div>

                      {/* 1万円/2500玉計測（normal） */}
                      {(form.measurementLogs||[]).filter(l=>l.kind==='normal'||!l.kind).length>0&&(
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.textSecondary, marginBottom:6, paddingLeft:2 }}>💰 1万円/2500玉 計測</div>
                          {[...(form.measurementLogs||[])].filter(l=>l.kind==='normal'||!l.kind).reverse().map(log=>{
                            const overBorder=log.rate>=(formMetrics.machineBorder||DEFAULT_BORDER);
                            return (
                              <div key={log.id} style={{ border:`1.5px solid ${overBorder?C.positiveBorder:C.negativeBorder}`, borderRadius:12, padding:'11px 14px', marginBottom:6, background:overBorder?C.positiveBg:C.negativeBg }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                  <div style={{ fontWeight:700, color:C.textPrimary, fontSize:13 }}>{log.label}</div>
                                  <span style={{ fontSize:14, fontWeight:800, color:overBorder?C.positive:C.negative }}>{fmtRate(log.rate)}</span>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:12, color:C.textSecondary }}>
                                  <div>回転数 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(log.spins).toLocaleString()}回</span></div>
                                  <div>投資 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(log.investYen)}</span></div>
                                  <div>ボーダー比 <span style={{ fontWeight:700, color:overBorder?C.positive:C.negative }}>{overBorder?'↑上回':'↓下回'}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 大当たり前計測（jackpot_before） */}
                      {(form.measurementLogs||[]).filter(l=>l.kind==='jackpot_before').length>0&&(
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:'#7c3aed', marginBottom:6, paddingLeft:2 }}>🎰 大当たり前の計測</div>
                          {[...(form.measurementLogs||[])].filter(l=>l.kind==='jackpot_before').reverse().map(log=>{
                            const overBorder=log.rate>=(formMetrics.machineBorder||DEFAULT_BORDER);
                            return (
                              <div key={log.id} style={{ border:`1.5px solid #e9d5ff`, borderRadius:12, padding:'11px 14px', marginBottom:6, background:'#fdf4ff' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                  <div style={{ fontWeight:700, color:'#7c3aed', fontSize:13 }}>{log.label}</div>
                                  <span style={{ fontSize:14, fontWeight:800, color:overBorder?C.positive:C.negative }}>{fmtRate(log.rate)}</span>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:12, color:C.textSecondary }}>
                                  <div>回転数 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(log.spins).toLocaleString()}回</span></div>
                                  <div>投資 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(log.investYen)}</span></div>
                                  <div>終了ゲーム <span style={{ fontWeight:700, color:C.textPrimary }}>{log.endReading||'-'}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {/* 初当たりDialog */}
                <Dialog open={firstHitDialogOpen} onOpenChange={setFirstHitDialogOpen}>
                  <DialogContent className="max-w-sm rounded-3xl">
                    <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-400"/>{firstHitForm.label}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-2">
                        <Button variant={firstHitForm.rounds==='10'?'default':'secondary'} className="rounded-2xl" onClick={()=>setFirstHitForm(p=>({...p,rounds:'10'}))}>10R</Button>
                        <Button variant={firstHitForm.rounds==='20'?'default':'secondary'} className="rounded-2xl" onClick={()=>setFirstHitForm(p=>({...p,rounds:'20'}))}>20R</Button>
                        <Input value={firstHitForm.rounds} onChange={e=>setFirstHitForm(p=>({...p,rounds:e.target.value}))} className="rounded-2xl text-center" inputMode="numeric" placeholder="直入力"/>
                      </div>
                      <div className="space-y-3 rounded-2xl border p-3">
                        <div><Label>開始持ち玉</Label><Input value={firstHitForm.startBalls} onChange={e=>setFirstHitForm(p=>({...p,startBalls:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                        <div><Label>開始上皿玉数（任意）</Label><Input value={firstHitForm.upperBalls} onChange={e=>setFirstHitForm(p=>({...p,upperBalls:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                        <div><Label>終了持ち玉</Label><Input value={firstHitForm.endBalls} onChange={e=>setFirstHitForm(p=>({...p,endBalls:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label>再スタート回転</Label><Input value={firstHitForm.restartRotation} onChange={e=>setFirstHitForm(p=>({...p,restartRotation:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="0"/></div>
                          <div><Label>連チャン数</Label><Input value={firstHitForm.chainCount} onChange={e=>setFirstHitForm(p=>({...p,chainCount:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="1"/></div>
                        </div>
                        <div>
                          <Label style={{display:'flex',alignItems:'center',gap:6}}>
                            残り保留数
                            <span style={{fontSize:11,color:'#0369a1',background:'#e0f2fe',borderRadius:6,padding:'1px 7px',fontWeight:600}}>メモ自動記入</span>
                          </Label>
                          <Input value={firstHitForm.remainingHolds} onChange={e=>setFirstHitForm(p=>({...p,remainingHolds:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="例: 3"/>
                          <div style={{fontSize:11,color:'#94a3b8',marginTop:4}}>大当たり終了時に残っていた保留数。回転率計算の参考になるぜ。</div>
                        </div>
                        <div>
                          <Label>再スタート理由</Label>
                          <Select value={firstHitForm.restartReason} onValueChange={v=>setFirstHitForm(p=>({...p,restartReason:v}))}>
                            <SelectTrigger className="mt-1 rounded-2xl"><span>{getRestartReasonLabel(firstHitForm.restartReason,firstHitForm.restartReasonNote)}</span></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">単発後</SelectItem><SelectItem value="st">確変/ST後</SelectItem>
                              <SelectItem value="jitan">時短抜け後</SelectItem><SelectItem value="other">その他</SelectItem>
                            </SelectContent>
                          </Select>
                          {firstHitForm.restartReason==='other'&&<Input value={firstHitForm.restartReasonNote} onChange={e=>setFirstHitForm(p=>({...p,restartReasonNote:e.target.value}))} className="mt-2 rounded-2xl" placeholder="理由メモ"/>}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
                        <div className="font-semibold">計算結果</div>
                        {[['獲得出玉',fmtBall(firstHitMetrics.gainedBalls)],['合計R',String(firstHitMetrics.rounds||0)],['1R出玉',fmtRate(firstHitMetrics.oneRound)],['連チャン',getChainResultLabel(firstHitForm.chainCount)],['残り保留',firstHitForm.remainingHolds?`${firstHitForm.remainingHolds}個`:'-']].map(([l,v])=>(
                          <div key={l} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-bold">{v}</span></div>
                        ))}
                      </div>
                      {selectedMachine?<Button variant="secondary" className="w-full rounded-2xl" onClick={applyFirstHitOneRoundToMachine}>この1R出玉を機種へ反映</Button>:<div className="text-xs text-amber-600">機種選択中なら1R出玉をその機種データへ反映できるぜ。</div>}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="rounded-2xl" onClick={()=>setFirstHitDialogOpen(false)}>キャンセル</Button>
                        <Button className="rounded-2xl" onClick={()=>completeFirstHit(false)}>大当たり終了</Button>
                      </div>
                      <Button variant="secondary" className="w-full rounded-2xl" onClick={()=>completeFirstHit(true)}>大当たり終了して回転率を再スタート</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* 回収玉・時間など */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div><label style={labelStyle}>回収玉</label><input value={form.returnedBalls} onChange={e=>updateForm('returnedBalls',e.target.value)} style={inputStyle} inputMode="numeric"/></div>
                  <div><label style={labelStyle}>実収支(任意上書き)</label><input value={form.actualBalanceYen} onChange={e=>updateForm('actualBalanceYen',e.target.value)} style={inputStyle} inputMode="numeric" placeholder="未入力で自動"/></div>
                  <div><label style={labelStyle}>稼働時間</label><input value={form.hours} onChange={e=>updateForm('hours',e.target.value)} style={inputStyle} inputMode="numeric" placeholder="例: 3.5"/></div>
                  <div><label style={labelStyle}>タグ</label><input value={form.tags} onChange={e=>updateForm('tags',e.target.value)} style={inputStyle} placeholder="特日, 強イベ"/></div>
                </div>

                {/* 続行/移動比較 */}
                <div style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:16, padding:'14px 16px' }}>
                  <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:10, fontSize:14 }}>続行 / 移動の簡易比較</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    <div><label style={labelStyle}>候補台回転率</label><input value={compareCandidateRate} onChange={e=>setCompareCandidateRate(e.target.value)} style={inputStyle} inputMode="decimal" placeholder="18.2"/></div>
                    <div><label style={labelStyle}>候補台ボーダー</label><input value={compareCandidateBorder} onChange={e=>setCompareCandidateBorder(e.target.value)} style={inputStyle} inputMode="decimal" placeholder="17.8"/></div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                    {[['今の台差',currentDiffForCompare],['候補台差',candidateDiffForCompare]].map(([l,d])=>(
                      <div key={l} style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                        <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                        <div style={{ marginTop:4, fontSize:16, fontWeight:700, color:d>=0?C.positive:C.negative }}>{d>=0?'+':''}{fmtRate(d)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'10px 14px' }}>
                    <div style={{ fontWeight:700, color:compareDecision.positive===undefined?C.primary:compareDecision.positive?C.positive:C.negative }}>{compareDecision.verdict}</div>
                    <div style={{ marginTop:4, fontSize:12, color:C.textSecondary }}>{compareDecision.comment}</div>
                  </div>
                </div>

                {(form.rateSections||[]).length>0&&(
                  <div>
                    <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:8, fontSize:14 }}>回転率 再スタート履歴</div>
                    {(form.rateSections||[]).map(s=>(
                      <div key={s.id} style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 14px', marginBottom:6 }}>
                        <div style={{ fontWeight:600, color:C.textPrimary }}>{s.label}</div>
                        <div style={{ fontSize:11, color:C.textSecondary, marginTop:3 }}>{s.startRotation}→{s.endRotation} / {s.spins}回転 / {Math.round(s.investYen).toLocaleString()}円 / 累積 {fmtRate(s.spinPerThousand)} / {s.restartReasonLabel||'再開'}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(form.firstHits||[]).length>0&&(
                  <div>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <div style={{ fontWeight:700, color:C.textPrimary, fontSize:15 }}>初当たり履歴</div>
                      <button
                        onClick={undoLastFirstHit}
                        style={{ background:'#fff7ed', color:'#c2410c', border:'1.5px solid #fed7aa', borderRadius:10, padding:'6px 14px', fontSize:12, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}
                      >
                        ↩ 最後の1件を取り消す
                      </button>
                    </div>
                    {(form.firstHits||[]).map(hit=>(
                      <div key={hit.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 16px', marginBottom:8 }}>
                        <div>
                          <div style={{ fontWeight:700, color:C.textPrimary, fontSize:14 }}>{hit.label}</div>
                          <div style={{ fontSize:12, color:C.textSecondary, marginTop:3 }}>{hit.rounds}R / 獲得{Math.round(hit.gainedBalls)}玉 / 1R {hit.oneRound.toFixed(1)} / {hit.chainResultLabel||getChainResultLabel(hit.chainCount)}</div>
                          {hit.remainingHolds>0&&<div style={{ fontSize:12, color:'#0369a1', marginTop:2, fontWeight:600 }}>残り保留: {hit.remainingHolds}個</div>}
                        </div>
                        <button onClick={()=>removeFirstHit(hit.id)} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:'white',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}><Trash2 size={15} color={C.textMuted}/></button>
                      </div>
                    ))}
                  </div>
                )}

                <div>
                  <label style={labelStyle}>初当たりメモ</label>
                  <Textarea value={form.notes} onChange={e=>updateForm('notes',e.target.value)} className="rounded-2xl min-h-[80px]" placeholder="初当たり結果は自動追記されるぜ"/>
                </div>

                {/* 下部アクションバー */}
                <div style={{ position:'sticky', bottom:4, zIndex:20, display:'flex', flexDirection:'column', gap:6 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:16, padding:'8px 14px', backdropFilter:'blur(12px)' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:saveStatusMeta.color }}>{saveStatusMeta.label}</span>
                    <button onClick={undoLastChange} disabled={!undoStack.length} style={{ ...btnOutline, padding:'6px 14px', fontSize:12, opacity:undoStack.length?1:0.4 }}>取り消し</button>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, background:'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:18, padding:8, backdropFilter:'blur(12px)' }}>
                    <button onClick={openFirstHitDialog} style={{ ...btnSecondary, padding:'10px 6px', fontSize:12, flexDirection:'column', gap:3 }}><Star size={15}/><span>初当たり</span></button>
                    <label style={{ cursor:'pointer' }}>
                      <div style={{ ...btnSecondary, padding:'10px 6px', fontSize:12, flexDirection:'column', gap:3 }}><Camera size={15}/><span>写真</span></div>
                      <input type="file" accept="image/*" multiple style={{ display:'none' }} onChange={e=>e.target.files&&addPhotos(e.target.files)}/>
                    </label>
                    <button onClick={saveDraftNow} style={{ ...btnSecondary, padding:'10px 6px', fontSize:12, flexDirection:'column', gap:3 }}><Save size={15}/><span>保存</span></button>
                    <button onClick={openCompleteDialog} style={{ ...btnPrimary, padding:'10px 6px', fontSize:12, flexDirection:'column', gap:3 }}><CheckCircle2 size={15}/><span>終了</span></button>
                  </div>
                </div>

                {/* 結果ダイアログ */}
                <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
                  <DialogContent className="max-w-md rounded-3xl">
                    <DialogHeader><DialogTitle>稼働結果</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <SummaryMetric title="総回転数" value={`${Math.round(resultPreviewMetrics.totalSpins)}回`} sub={`累積率 ${fmtRate(resultPreviewMetrics.spinPerThousand)}`}/>
                        <SummaryMetric title="1R出玉" value={selectedMachine?fmtRate(selectedMachine.payoutPerRound):'-'} sub={`持ち玉比率 ${fmtRate(resultPreviewMetrics.holdBallRatio)}%`}/>
                        <SummaryMetric title="期待値" value={fmtYen(resultPreviewMetrics.estimatedEVYen)} positive={resultPreviewMetrics.estimatedEVYen>=0}/>
                        <SummaryMetric title="収支" value={fmtYen(resultPreviewMetrics.balanceYen)} positive={resultPreviewMetrics.balanceYen>=0}/>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label>終了時持ち玉</Label><Input value={form.endingBalls} onChange={e=>updateForm('endingBalls',e.target.value)} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="0"/></div>
                        <div><Label>終了時上皿玉数</Label><Input value={form.endingUpperBalls} onChange={e=>updateForm('endingUpperBalls',e.target.value)} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="0"/></div>
                        <div><Label>自動回収玉</Label><Input value={resultReturnedBalls} readOnly className="mt-1 rounded-2xl bg-muted/40"/></div>
                        <div><Label>実収支(任意上書き)</Label><Input value={form.actualBalanceYen} onChange={e=>updateForm('actualBalanceYen',e.target.value)} className="mt-1 rounded-2xl" inputMode="numeric" placeholder="未入力なら自動"/></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant={showResultRateGraph?'default':'outline'} className="rounded-2xl" onClick={()=>setShowResultRateGraph(p=>!p)}>回転率グラフ</Button>
                        <Button variant={showMoneySwitchGraph?'default':'outline'} className="rounded-2xl" onClick={()=>setShowMoneySwitchGraph(p=>!p)}>持ち玉/現金グラフ</Button>
                      </div>
                      {showResultRateGraph&&<div className="rounded-2xl border p-3"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={sessionTrendData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="rate" strokeWidth={2} dot={false} stroke={C.accent} name="累積回転率"/></LineChart></ResponsiveContainer></div></div>}
                      {showMoneySwitchGraph&&<div className="rounded-2xl border p-3"><div className="h-48"><ResponsiveContainer width="100%" height="100%"><LineChart data={moneySwitchData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label"/><YAxis/><Tooltip/><Line type="monotone" dataKey="cashInvestYen" stroke={C.accent} strokeWidth={2} dot={false} name="現金投資"/><Line type="monotone" dataKey="ballInvestYen" stroke={C.positive} strokeWidth={2} dot={false} name="持ち玉換算"/></LineChart></ResponsiveContainer></div></div>}
                      <div><Label>良かったメモ</Label><Textarea value={form.resultGoodMemo} onChange={e=>updateForm('resultGoodMemo',e.target.value)} className="mt-1 min-h-[70px] rounded-2xl" placeholder="回った点、釘が良かった点など"/></div>
                      <div><Label>悪かった点 / やめ理由</Label><Textarea value={form.resultBadMemo} onChange={e=>updateForm('resultBadMemo',e.target.value)} className="mt-1 min-h-[70px] rounded-2xl" placeholder="ヘソが閉まった、寄りが悪いなど"/></div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="rounded-2xl" onClick={()=>setResultDialogOpen(false)}>戻る</Button>
                        <Button className="rounded-2xl" onClick={finalizeSession}>結果を保存して終了</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ 期待収支タブ ══════════════════ */}
        {activeTab==='expect'&&(
          <div style={cardStyle}>
            <div style={{ background:`linear-gradient(135deg, #0ea5e9, #6366f1)`, padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontSize:15, fontWeight:800, color:'white' }}>通常時 {Math.round(expectedSpins)} 回転（{expectedHours}時間）の期待収支</div>
                <Sparkles size={20} color="white"/>
              </div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:4 }}>単位: {expectDisplayUnit==='yen'?'円':'玉'}</div>
            </div>
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
              {!selectedMachine&&(
                <div style={{ background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:14, padding:'10px 14px', fontSize:13, color:C.amber }}>
                  機種未選択のため、全交換率のボーダーを <strong>{DEFAULT_BORDER}回転</strong> として計算しているぜ。機種を選ぶと実際のボーダーで表示されるぜ。
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={labelStyle}>稼働時間</label>
                  <Select value={String(expectedHours)} onValueChange={v=>setSettings(p=>({...p,expectedHours:Number(v)}))}>
                    <SelectTrigger className="rounded-2xl"><SelectValue/></SelectTrigger>
                    <SelectContent>{Array.from({length:10},(_,i)=>i+1).map(h=><SelectItem key={h} value={String(h)}>{h}時間</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>表示単位</label>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                    <button onClick={()=>setExpectDisplayUnit('balls')} style={{ ...(expectDisplayUnit==='balls'?btnPrimary:btnOutline), padding:'10px 6px' }}>玉</button>
                    <button onClick={()=>setExpectDisplayUnit('yen')} style={{ ...(expectDisplayUnit==='yen'?btnPrimary:btnOutline), padding:'10px 6px' }}>円</button>
                  </div>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <label style={labelStyle}>回転率を入力</label>
                  <input value={expectManualRateInput} onChange={e=>{ const v=e.target.value; setExpectManualRateInput(v); const p=Number(v); if(Number.isFinite(p)&&p>0) setExpectDetailBaseRate(Math.floor(p)); }} style={inputStyle} inputMode="decimal" placeholder={formMetrics.spinPerThousand?fmtRate(formMetrics.spinPerThousand):'17.5'}/>
                  <div style={{ marginTop:4, fontSize:11, color:C.textMuted }}>未入力なら現在の累積回転率を使うぜ。</div>
                </div>
                <div>
                  <label style={labelStyle}>今の累積回転率</label>
                  <div style={{ background:C.accentLight, border:`1px solid #bae6fd`, borderRadius:14, padding:'10px 14px', fontSize:20, fontWeight:800, color:C.accent }}>{fmtRate(formMetrics.spinPerThousand)}</div>
                </div>
              </div>

              {selectedMachine&&(
                <div style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'12px' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>参照ボーダー一覧</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6 }}>
                    {EXCHANGE_ORDER.map(cat=>(
                      <div key={cat} style={{ background:'white', border:`1px solid ${C.border}`, borderRadius:10, padding:'7px 4px', textAlign:'center' }}>
                        <div style={{ fontSize:10, color:C.textMuted }}>{getExchangePreset(cat).short}</div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.accent, marginTop:2 }}>{fmtRate(getMachineBorderByCategory(selectedMachine,cat))}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 回転率クイック選択 */}
              <div style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'12px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>回転率クイック選択</div>
                <div style={{ display:'flex', gap:6, overflowX:'auto', paddingBottom:4, WebkitOverflowScrolling:'touch' }}>
                  {Array.from({length:15},(_,i)=>16+i).map(rate=>(
                    <button key={rate} onClick={()=>setExpectDetailBaseRate(p=>p===rate?null:rate)} style={{ flexShrink:0, padding:'6px 13px', borderRadius:10, border:`1.5px solid ${expectDetailBaseRate===rate?C.primary:currentObservedBaseRate===rate?C.accent:C.border}`, background:expectDetailBaseRate===rate?C.primary:currentObservedBaseRate===rate?C.accentLight:'white', color:expectDetailBaseRate===rate?'white':currentObservedBaseRate===rate?C.accent:C.textSecondary, fontWeight:600, fontSize:13, cursor:'pointer', whiteSpace:'nowrap' }}>{rate}回</button>
                  ))}
                </div>
              </div>

              {/* ── メインテーブル（視認性改善版）── */}
              <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', borderRadius:14, border:`1px solid ${C.border}` }}>
                <table style={{ minWidth:540, width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead>
                    <tr style={{ background:`linear-gradient(135deg, #312e81, #4f46e5)` }}>
                      <th style={{ padding:'10px 12px', color:'white', fontWeight:700, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid rgba(255,255,255,0.15)` }}>回転率</th>
                      {EXCHANGE_ORDER.map(cat=>{
                        const preset=getExchangePreset(cat);
                        const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,cat):0;
                        const border=mb>0?mb:DEFAULT_BORDER;
                        return (
                          <th key={cat} style={{ padding:'10px 8px', color:'white', fontWeight:700, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid rgba(255,255,255,0.15)` }}>
                            <div>{preset.label}</div>
                            <div style={{ fontSize:11, opacity:0.75, marginTop:2 }}>B {fmtRate(border)}</div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {expectationRows.map((row,ri)=>{
                      const isHighlight=currentObservedBaseRate===row.rate;
                      return (
                        <tr key={row.rate} style={{ background:isHighlight?'#fef9c3':ri%2===0?'white':'#f8fafc' }}>
                          <td style={{ padding:'9px 12px', fontWeight:700, color:C.textPrimary, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid ${C.border}`, background:isHighlight?'#fde68a':ri%2===0?'#f1f5f9':'#e8eef5' }}>
                            {isHighlight&&<span style={{ marginRight:4, fontSize:11 }}>▶</span>}{row.rate}回
                          </td>
                          {row.values.map(v=>{
                            const dv=expectDisplayUnit==='yen'?v.evYen:v.evBalls;
                            const pos=Number(dv)>=0;
                            return (
                              <td key={`${row.rate}-${v.category}`} style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, whiteSpace:'nowrap', borderRight:`1px solid ${C.border}`, color:pos?C.tablePositive:C.tableNegative, background:isHighlight?'#fef9c3':pos?'transparent':'transparent' }}>
                                {formatExpectationValue(dv,expectDisplayUnit)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* 凡例 */}
              <div style={{ display:'flex', gap:16, fontSize:12 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:12,height:12,borderRadius:3,background:C.positiveBg,border:`1.5px solid ${C.positiveBorder}`,display:'inline-block' }}></span><span style={{ color:C.tablePositive, fontWeight:600 }}>プラス期待値</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:12,height:12,borderRadius:3,background:C.negativeBg,border:`1.5px solid ${C.negativeBorder}`,display:'inline-block' }}></span><span style={{ color:C.tableNegative, fontWeight:600 }}>マイナス期待値</span></div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ width:12,height:12,borderRadius:3,background:'#fde68a',border:'1.5px solid #f59e0b',display:'inline-block' }}></span><span style={{ color:C.amber, fontWeight:600 }}>現在の回転率</span></div>
              </div>

              {/* 詳細テーブル */}
              {expectDetailBaseRate!==null&&(
                <div>
                  <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:8, fontSize:14 }}>{expectDetailBaseRate}回台の詳細（0.1刻み）</div>
                  <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', borderRadius:14, border:`1px solid ${C.border}` }}>
                    <table style={{ minWidth:540, width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                      <thead>
                        <tr style={{ background:`linear-gradient(135deg, #1e293b, #334155)` }}>
                          <th style={{ padding:'10px 12px', color:'white', fontWeight:700, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid rgba(255,255,255,0.15)` }}>回転率</th>
                          {EXCHANGE_ORDER.map(cat=>{
                            const preset=getExchangePreset(cat);
                            const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,cat):0;
                            const border=mb>0?mb:DEFAULT_BORDER;
                            return <th key={cat} style={{ padding:'10px 8px', color:'white', fontWeight:700, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid rgba(255,255,255,0.15)` }}><div>{preset.label}</div><div style={{ fontSize:11, opacity:0.7, marginTop:2 }}>B {fmtRate(border)}</div></th>;
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {expectationDetailRows.map((row,ri)=>{
                          const isHL=expectTargetTenthRate===row.rate;
                          return (
                            <tr key={row.rate} style={{ background:isHL?'#fef9c3':ri%2===0?'white':'#f8fafc' }}>
                              <td style={{ padding:'9px 12px', fontWeight:700, color:C.textPrimary, textAlign:'center', whiteSpace:'nowrap', borderRight:`1px solid ${C.border}`, background:isHL?'#fde68a':ri%2===0?'#f1f5f9':'#e8eef5' }}>
                                {isHL&&<span style={{ marginRight:4, fontSize:11 }}>▶</span>}{row.rate.toFixed(1)}回
                              </td>
                              {row.values.map(v=>{
                                const dv=expectDisplayUnit==='yen'?v.evYen:v.evBalls;
                                const pos=Number(dv)>=0;
                                return <td key={`${row.rate}-${v.category}`} style={{ padding:'9px 8px', textAlign:'center', fontWeight:700, whiteSpace:'nowrap', borderRight:`1px solid ${C.border}`, color:pos?C.tablePositive:C.tableNegative }}>{formatExpectationValue(dv,expectDisplayUnit)}</td>;
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <SummaryMetric title="今の累積回転率" value={fmtRate(formMetrics.spinPerThousand)} sub="回転率ページ参照"/>
                <SummaryMetric title="参照機種" value={selectedMachine?.name||form.machineFreeName||`デフォルト(B:${DEFAULT_BORDER})`} sub={`現在: ${getExchangePreset(form.exchangeCategory||'25').short}`}/>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ 稼働判定タブ ══════════════════ */}
        {activeTab==='judge'&&(
          <div style={cardStyle}>
            <div style={{ padding:'16px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
              <Gauge size={20} color={C.primary}/>
              <div style={{ fontWeight:700, fontSize:16, color:C.textPrimary }}>稼働判定</div>
            </div>
            <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ background:C.accentLight, border:`1px solid #bae6fd`, borderRadius:12, padding:'10px 14px', fontSize:12, color:'#0369a1' }}>回転率計算の数値を参照して、今の台が打てるかざっくり判断するページだぜ。</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={labelStyle}>観測回転率</label><input value={judgeForm.observedRate} onChange={e=>setJudgeForm(p=>({...p,observedRate:e.target.value}))} style={inputStyle} inputMode="decimal"/></div>
                <div><label style={labelStyle}>ボーダー</label><input value={judgeForm.border} onChange={e=>setJudgeForm(p=>({...p,border:e.target.value}))} style={inputStyle} inputMode="decimal"/></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                <button onClick={()=>setJudgeForm(p=>({...p,observedRate:formMetrics.spinPerThousand?String(Number(formMetrics.spinPerThousand.toFixed(2))):'',border:formMetrics.machineBorder?String(formMetrics.machineBorder||''):p.border}))} style={btnSecondary}>今の回転率を取り込む</button>
                <button onClick={()=>setActiveTab('rate')} style={btnOutline}>回転率ページへ</button>
              </div>
              <div style={{ background:judgeMetrics.tone==='default'?C.positiveBg:judgeMetrics.tone==='destructive'?C.negativeBg:'#f8fafc', border:`1.5px solid ${judgeMetrics.tone==='default'?C.positiveBorder:judgeMetrics.tone==='destructive'?C.negativeBorder:C.border}`, borderRadius:16, padding:'16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                  <div style={{ fontSize:12, color:C.textMuted }}>判定</div>
                  <span style={{ background:judgeMetrics.tone==='default'?C.positive:judgeMetrics.tone==='destructive'?C.negative:C.textSecondary, color:'white', borderRadius:8, padding:'4px 12px', fontSize:13, fontWeight:700 }}>{judgeMetrics.verdict}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12, fontSize:13 }}>
                  <div style={{ color:C.textSecondary }}>ボーダー差 <span style={{ fontWeight:700, color:judgeMetrics.diff>=0?C.positive:C.negative }}>{judgeMetrics.diff>=0?'+':''}{fmtRate(judgeMetrics.diff)}</span></div>
                  <div style={{ color:C.textSecondary }}>信頼度 <span style={{ fontWeight:700, color:C.textPrimary }}>{judgeMetrics.reliability}</span></div>
                  <div style={{ color:C.textSecondary }}>総回転 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(formMetrics.totalSpins)}回</span></div>
                  <div style={{ color:C.textSecondary }}>機種 <span style={{ fontWeight:700, color:C.textPrimary }}>{selectedMachine?.name||'-'}</span></div>
                </div>
                <div style={{ background:'rgba(255,255,255,0.6)', borderRadius:10, padding:'10px 12px', fontSize:13, color:C.textPrimary }}>{judgeMetrics.comment}</div>
                <div style={{ marginTop:8, fontSize:11, color:C.textMuted }}>基準: 打てる {fmtRate(settings.judgePlayDiff)}以上 / 様子見 {fmtRate(settings.judgeWatchDiff)}以上</div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ 日別タブ ══════════════════ */}
        {activeTab==='calendar'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <MonthCalendar currentMonth={currentMonth} sessions={enrichedSessions} selectedDate={selectedDate} onSelectDate={setSelectedDate} onPrev={()=>moveMonth(-1)} onNext={()=>moveMonth(1)}/>
            <div style={cardStyle}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontWeight:700, fontSize:16, color:C.textPrimary }}>{selectedDate} の記録</div>
              </div>
              <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                {selectedDateSessions.length===0?<div style={{ fontSize:13, color:C.textMuted }}>この日はまだ未記録だぜ。</div>:selectedDateSessions.map(s=>{
                  const td=getSessionTrendData(s,settings);
                  const mn=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定';
                  const wv=getWorkVolumeBalls(s.metrics);
                  return (
                    <details key={s.id} style={{ border:`1px solid ${C.border}`, borderRadius:16, background:'white', overflow:'hidden' }}>
                      <summary style={{ cursor:'pointer', listStyle:'none', padding:'14px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                          <div>
                            <div style={{ fontWeight:700, color:C.textPrimary }}>{mn}</div>
                            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{s.shop||'店舗未入力'} / 台{s.machineNumber||'-'} / {s.status==='completed'?'終了':'途中'}</div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:17, fontWeight:700, color:s.metrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(s.metrics.balanceYen)}</div>
                            <div style={{ fontSize:11, fontWeight:600, color:s.metrics.estimatedEVYen>=0?C.positive:C.negative }}>EV {fmtYen(s.metrics.estimatedEVYen)}</div>
                          </div>
                        </div>
                        <div style={{ marginTop:6, fontSize:11, color:C.textMuted }}>タップで詳細を表示</div>
                      </summary>
                      <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          {[['収支',fmtYen(s.metrics.balanceYen),s.metrics.balanceYen>=0],['仕事量',`${Math.round(wv).toLocaleString()}玉`,wv>=0],['期待値',fmtYen(s.metrics.estimatedEVYen),s.metrics.estimatedEVYen>=0],['回転数',`${Math.round(s.metrics.totalSpins).toLocaleString()}回`,null]].map(([l,v,pos])=>(
                            <div key={l} style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                              <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                              <div style={{ fontSize:16, fontWeight:700, marginTop:3, color:pos===null?C.textPrimary:pos?C.positive:C.negative }}>{v}</div>
                            </div>
                          ))}
                        </div>
                        {td.length>0&&<div style={{ height:180 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={td}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/><Line type="monotone" dataKey="rate" stroke={C.accent} strokeWidth={2} dot={false} name="累積回転率"/></LineChart></ResponsiveContainer></div>}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ まとめタブ ══════════════════ */}
        {activeTab==='analysis'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg, #1e293b, #334155)`, padding:'18px 20px' }}>
                <div style={{ fontSize:10, letterSpacing:'0.2em', color:'rgba(255,255,255,0.6)', textTransform:'uppercase', fontWeight:700 }}>MONTHLY REPORT</div>
                <div style={{ marginTop:4, fontSize:18, fontWeight:800, color:'white' }}>{currentMonth} 月間レポート</div>
              </div>
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  {[[`月間収支`,fmtYen(monthlyReport.totals.balance),monthlyReport.totals.balance>=0,'稼働 '+monthlyReport.totals.count+'件'],[`月間期待値`,fmtYen(monthlyReport.totals.ev),monthlyReport.totals.ev>=0,monthlyReport.totals.hours>0?'時給 '+fmtYen(monthlyReport.totals.ev/monthlyReport.totals.hours):'-'],[`月間仕事量`,`${Math.round(monthlyReport.totals.workBalls).toLocaleString()}玉`,monthlyReport.totals.workBalls>=0,`総回転 ${Math.round(monthlyReport.totals.spins).toLocaleString()}回`],[`平均回転率`,monthlyReport.averageRate?fmtRate(monthlyReport.averageRate):'-',null,`総時間 ${monthlyReport.totals.hours?monthlyReport.totals.hours.toFixed(1):'0.0'}h`]].map(([t,v,pos,s])=>(
                    <SummaryMetric key={t} title={t} value={v} positive={pos===null?undefined:pos} sub={s}/>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                  {[['プラス日',monthlyReport.plusDays+'日',C.positive],['マイナス日',monthlyReport.minusDays+'日',C.negative],['トントン日',monthlyReport.evenDays+'日',C.textSecondary]].map(([l,v,c])=>(
                    <div key={l} style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px', textAlign:'center' }}>
                      <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                      <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:4 }}>{v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[['今月の主力店舗',monthlyReport.bestShop?.name||'-',monthlyReport.bestShop?fmtYen(monthlyReport.bestShop.ev):'-'],['今月の主力機種',monthlyReport.bestMachine?.name||'-',monthlyReport.bestMachine?fmtYen(monthlyReport.bestMachine.ev):'-']].map(([l,n,v])=>(
                    <div key={l} style={{ background:'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                      <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                      <div style={{ fontWeight:700, color:C.textPrimary, marginTop:3, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{n}</div>
                      <div style={{ fontSize:11, color:C.textSecondary, marginTop:2 }}>EV {v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}><div style={{ fontWeight:700, color:C.textPrimary }}>推移グラフ</div></div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="label" tick={{fontSize:11,fill:C.textMuted}}/>
                      <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
                      <Tooltip/>
                      <Line type="monotone" dataKey="balance" stroke={C.positive} strokeWidth={2} dot={false} name="実収支"/>
                      <Line type="monotone" dataKey="ev" stroke={C.accent} strokeWidth={2} dot={false} name="期待値"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {[['店舗別集計',shopAggregate,'name'],['機種別集計',machineAggregate,'name']].map(([title,rows,key])=>(
              <div key={title} style={cardStyle}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}><div style={{ fontWeight:700, color:C.textPrimary }}>{title}</div></div>
                <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  {rows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:rows.map(row=>(
                    <div key={row[key]} style={{ border:`1px solid ${C.border}`, borderRadius:12, padding:'12px 14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, marginBottom:8 }}>
                        <div style={{ fontWeight:700, color:C.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row[key]}</div>
                        <span style={{ background:row.balance>=0?C.positiveBg:C.negativeBg, color:row.balance>=0?C.positive:C.negative, border:`1px solid ${row.balance>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:700, whiteSpace:'nowrap' }}>{fmtYen(row.balance)}</span>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12, color:C.textSecondary }}>
                        <div>期待値 <span style={{ fontWeight:600, color:C.textPrimary }}>{fmtYen(row.ev)}</span></div>
                        <div>件数 <span style={{ fontWeight:600, color:C.textPrimary }}>{row.count}件</span></div>
                        <div>総回転 <span style={{ fontWeight:600, color:C.textPrimary }}>{Math.round(row.spins).toLocaleString()}回</span></div>
                        <div>平均EV <span style={{ fontWeight:600, color:C.textPrimary }}>{fmtYen(row.count?row.ev/row.count:0)}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ height:200 }}>
              <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:8 }}>期間棒グラフ</div>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodMode==='year'?trendChartData:machineAggregate.slice(0,8).map(x=>({label:x.name.slice(0,8),ev:x.ev}))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="label" tick={{fontSize:10,fill:C.textMuted}}/>
                  <YAxis tick={{fontSize:10,fill:C.textMuted}}/>
                  <Tooltip/>
                  <Bar dataKey="ev" fill={C.primary} radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <FoldSummary title="生涯収支" total={lifetimeSummary.balance} count={lifetimeSummary.count}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
                <div style={{ color:C.textSecondary }}>期待値 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(lifetimeSummary.ev)}</span></div>
                <div style={{ color:C.textSecondary }}>総回転 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(lifetimeSummary.spins).toLocaleString()}回</span></div>
              </div>
            </FoldSummary>
            <FoldSummary title="年別収支" total={yearSummaryRows.reduce((a,r)=>a+r.balance,0)} count={yearSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {yearSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:yearSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <div style={{ fontWeight:600 }}>{row.key}年</div>
                      <div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}>
                      <div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div><div>総回転 {Math.round(row.spins).toLocaleString()}回</div>
                    </div>
                  </div>
                ))}
              </div>
            </FoldSummary>
            <FoldSummary title="月別収支" total={monthSummaryRows.reduce((a,r)=>a+r.balance,0)} count={monthSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {monthSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:monthSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <div style={{ fontWeight:600 }}>{row.key}</div>
                      <div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}>
                      <div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div>
                    </div>
                  </div>
                ))}
              </div>
            </FoldSummary>
            <FoldSummary title="店舗別収支" total={allShopSummaryRows.reduce((a,r)=>a+r.balance,0)} count={allShopSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {allShopSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:allShopSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><div style={{ fontWeight:600 }}>{row.key}</div><div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}><div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div></div>
                  </div>
                ))}
              </div>
            </FoldSummary>
            <FoldSummary title="機種別収支" total={allMachineSummaryRows.reduce((a,r)=>a+r.balance,0)} count={allMachineSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {allMachineSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:allMachineSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><div style={{ fontWeight:600 }}>{row.key}</div><div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}><div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div></div>
                  </div>
                ))}
              </div>
            </FoldSummary>
          </div>
        )}

        {/* ══════════════════ 履歴タブ ══════════════════ */}
        {activeTab==='history'&&(
          <div style={cardStyle}>
            <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
              <div style={{ fontWeight:700, fontSize:16, color:C.textPrimary }}>履歴一覧</div>
              <div style={{ position:'relative', width:160 }}>
                <Search size={14} color={C.textMuted} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft:30, fontSize:13 }} placeholder="検索"/>
              </div>
            </div>
            <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
              {filteredHistory.length===0?<div style={{ fontSize:13, color:C.textMuted }}>履歴はまだないぜ。</div>:filteredHistory.map(s=>(
                <motion.div key={s.id} layout>
                  <div style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden', background:'white' }}>
                    <div style={{ padding:'14px 16px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8, marginBottom:10 }}>
                        <div>
                          <div style={{ fontWeight:700, color:C.textPrimary }}>{s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定'}</div>
                          <div style={{ fontSize:11, color:C.textMuted, marginTop:3 }}>{s.date} / {s.shop||'店舗未入力'} / 台{s.machineNumber||'-'} / {getExchangePreset(s.exchangeCategory||'25').short}</div>
                        </div>
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <span style={{ background:s.status==='draft'?C.primaryLight:'#f1f5f9', color:s.status==='draft'?C.primary:C.textSecondary, borderRadius:7, padding:'2px 8px', fontSize:11, fontWeight:600 }}>{s.status==='draft'?'途中':'終了'}</span>
                          <span style={{ background:s.metrics.balanceYen>=0?C.positiveBg:C.negativeBg, color:s.metrics.balanceYen>=0?C.positive:C.negative, border:`1px solid ${s.metrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:8, padding:'3px 10px', fontSize:12, fontWeight:700 }}>{fmtYen(s.metrics.balanceYen)}</span>
                        </div>
                      </div>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12, color:C.textSecondary, marginBottom:10 }}>
                        <div>期待値 <span style={{ fontWeight:600, color:s.metrics.estimatedEVYen>=0?C.positive:C.negative }}>{fmtYen(s.metrics.estimatedEVYen)}</span></div>
                        <div>千円回転 <span style={{ fontWeight:600, color:C.accent }}>{fmtRate(s.metrics.spinPerThousand)}</span></div>
                        <div>ゲーム数 <span style={{ fontWeight:600, color:C.textPrimary }}>{Math.round(s.metrics.totalSpins).toLocaleString()}回</span></div>
                        <div>初当たり <span style={{ fontWeight:600, color:C.textPrimary }}>{(s.firstHits||[]).length}件</span></div>
                      </div>
                      {(s.firstHits||[]).length>0&&<div style={{ marginBottom:8, fontSize:11, color:C.textSecondary }}>{s.firstHits.map(h=><div key={h.id}>{h.label}: {h.rounds}R / 獲得{Math.round(h.gainedBalls)}玉 / 1R {h.oneRound.toFixed(1)} / {h.chainResultLabel||getChainResultLabel(h.chainCount)}</div>)}</div>}
                      {s.notes&&<div style={{ whiteSpace:'pre-wrap', fontSize:11, color:C.textSecondary, marginBottom:8 }}>{s.notes}</div>}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                        <button onClick={()=>continueSession(s)} style={{ ...btnOutline, padding:'8px', fontSize:12 }}><Pencil size={13}/>続き入力</button>
                        <button onClick={()=>duplicateSession(s)} style={{ ...btnOutline, padding:'8px', fontSize:12 }}><Copy size={13}/>複製</button>
                        <button onClick={()=>continueSession(s)} style={{ ...btnSecondary, padding:'8px', fontSize:12 }}>詳細編集</button>
                        <button onClick={()=>deleteSession(s.id)} style={{ background:C.negativeBg, color:C.negative, border:`1px solid ${C.negativeBorder}`, borderRadius:14, padding:'8px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontWeight:600 }}><Trash2 size={13}/>削除</button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* ══════════════════ 設定タブ ══════════════════ */}
        {activeTab==='settings'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { title:'期待値計算の詳細設定', icon:<Settings size={16} color={C.primary}/>, content:(
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                    <div><label style={labelStyle}>持ち玉標準(玉)</label><input value={settings.defaultBallUnit} onChange={e=>setSettings(p=>({...p,defaultBallUnit:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>
                    <div><label style={labelStyle}>通常時回転/h</label><input value={settings.spinsPerHour} onChange={e=>setSettings(p=>({...p,spinsPerHour:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>
                    <div><label style={labelStyle}>打てる基準差</label><input value={settings.judgePlayDiff} onChange={e=>setSettings(p=>({...p,judgePlayDiff:e.target.value}))} style={inputStyle} inputMode="decimal"/></div>
                    <div><label style={labelStyle}>様子見基準差</label><input value={settings.judgeWatchDiff} onChange={e=>setSettings(p=>({...p,judgeWatchDiff:e.target.value}))} style={inputStyle} inputMode="decimal"/></div>
                  </div>
                  <div>
                    <label style={labelStyle}>期待値算出モード</label>
                    <Select value={settings.evCalcMode} onValueChange={v=>setSettings(p=>({...p,evCalcMode:v}))}>
                      <SelectTrigger className="rounded-2xl"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="borderDiff">ボーダー差の比率で計算</SelectItem><SelectItem value="customCoef">1回転差ごとの係数で計算</SelectItem></SelectContent>
                    </Select>
                  </div>
                  {settings.evCalcMode==='customCoef'&&<div><label style={labelStyle}>1回転差あたり係数(円/1000円)</label><input value={settings.customEvPerSpinDiffPer1000Yen} onChange={e=>setSettings(p=>({...p,customEvPerSpinDiffPer1000Yen:e.target.value}))} style={inputStyle} inputMode="numeric"/></div>}
                </div>
              )},
              { title:'店舗ごとの換金率自動設定', icon:<Store size={16} color={C.primary}/>, content:(
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:8 }}>
                    <input value={shopProfileDraft.name} onChange={e=>setShopProfileDraft(p=>({...p,name:e.target.value}))} style={inputStyle} placeholder="店舗名"/>
                    <Select value={shopProfileDraft.exchangeCategory} onValueChange={v=>setShopProfileDraft(p=>({...p,exchangeCategory:v}))}>
                      <SelectTrigger className="rounded-2xl w-28"><SelectValue/></SelectTrigger>
                      <SelectContent>{EXCHANGE_ORDER.map(c=><SelectItem key={c} value={c}>{getExchangePreset(c).label}</SelectItem>)}</SelectContent>
                    </Select>
                    <button onClick={addShopProfile} style={{ ...btnPrimary, padding:'9px 16px', whiteSpace:'nowrap' }}>追加</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {(settings.shopProfiles||[]).length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだ登録がないぜ。店舗名と交換率を結び付けておくと、店を入れた瞬間に自動反映されるぜ。</div>:(settings.shopProfiles||[]).map(p=>(
                      <div key={p.name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 14px' }}>
                        <div>
                          <div style={{ fontWeight:600, color:C.textPrimary }}>{p.name}</div>
                          <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{getExchangePreset(p.exchangeCategory||'25').label}</div>
                        </div>
                        <button onClick={()=>removeShopProfile(p.name)} style={{ background:C.negativeBg, color:C.negative, border:`1px solid ${C.negativeBorder}`, borderRadius:10, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>削除</button>
                      </div>
                    ))}
                  </div>
                </div>
              )},
              { title:'データ管理', icon:<Database size={16} color={C.primary}/>, content:(
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  <button onClick={exportData} style={{ ...btnOutline, width:'100%' }}><Download size={15}/>JSONを書き出す</button>
                  <label style={{ cursor:'pointer', display:'block' }}>
                    <div style={{ ...btnOutline, width:'100%', boxSizing:'border-box' }}><Upload size={15}/>JSONを読み込む</div>
                    <input type="file" accept="application/json" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&importData(e.target.files[0])}/>
                  </label>
                  <div style={{ fontSize:12, color:C.textMuted }}>途中保存も終了データも全部端末保存だ。画像を入れすぎると容量に当たるから、その時はJSON退避だぜ。</div>
                </div>
              )},
            ].map(({title,icon,content})=>(
              <div key={title} style={cardStyle}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', alignItems:'center', gap:8 }}>
                  {icon}<div style={{ fontWeight:700, fontSize:15, color:C.textPrimary }}>{title}</div>
                </div>
                <div style={{ padding:'16px' }}>{content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}