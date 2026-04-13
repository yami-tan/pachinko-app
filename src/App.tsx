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
  Copy, Database, Download, Gauge, Palette, Pencil, Save, Search, Settings,
  Sparkles, Star, Store, Trash2, Upload,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, BarChart, Bar, ReferenceLine,
} from 'recharts';

const STORAGE_KEYS = {
  machines: 'pachi_complete_machines_v12',
  sessions: 'pachi_complete_sessions_v12',
  settings: 'pachi_complete_settings_v12',
};

const EXCHANGE_PRESETS = {
  '25':   { label: '25個(等価)',      yenPerBall: 4.0,          short: '等価'  },
  '26':   { label: '26個(3.85円)',    yenPerBall: 100/26,       short: '26個'  },
  '27':   { label: '27個(3.70円)',    yenPerBall: 100/27,       short: '27個'  },
  '27.5': { label: '27.5個(3.63円)', yenPerBall: 100/27.5,     short: '27.5個'},
  '28':   { label: '28個(3.57円)',    yenPerBall: 100/28,       short: '28個'  },
  '29':   { label: '29個(3.45円)',    yenPerBall: 100/29,       short: '29個'  },
  '30':   { label: '30個(3.33円)',    yenPerBall: 100/30,       short: '30個'  },
  '31':   { label: '31個(3.23円)',    yenPerBall: 100/31,       short: '31個'  },
  '32':   { label: '32個(3.13円)',    yenPerBall: 100/32,       short: '32個'  },
  '33':   { label: '33個(3.03円)',    yenPerBall: 100/33,       short: '33個'  },
  '34':   { label: '34個(2.94円)',    yenPerBall: 100/34,       short: '34個'  },
  '35':   { label: '35個(2.86円)',    yenPerBall: 100/35,       short: '35個'  },
  '40':   { label: '40個(2.50円)',    yenPerBall: 100/40,       short: '40個'  },
  '45':   { label: '45個(2.22円)',    yenPerBall: 100/45,       short: '45個'  },
};
const EXCHANGE_ORDER = ['25','26','27','27.5','28','29','30','31','32','33','34','35','40','45'];
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
  colorTheme: 'indigo',
  themeMode: 'light',
  stopLossYen: 30000,         // 損切りライン（円）
  stopLossEnabled: false,     // 損切りアラート有効
  belowBorderAlertSpins: 500, // 連続ボーダー以下回転数でアラート
};

function uid() { return crypto.randomUUID(); }

const defaultMachines = [
  { id: uid(), name: 'Pエヴァ15 未来への咆哮', shopDefault: '', border25: 17.8, border28: 18.7, border30: 19.4, border33: 20.2, border40: 0, payoutPerRound: 140, expectedBallsPerHit: 1400, totalProbability: 9.49, memo: '', kanaReading: 'えゔぁじゅうごみらいへのほうこうえびえばeva' },
  { id: uid(), name: 'ぱちんこ シン・エヴァンゲリオン Type レイ', shopDefault: '', border25: 17.1, border28: 18.1, border30: 18.6, border33: 19.5, border40: 0, payoutPerRound: 140, expectedBallsPerHit: 1400, totalProbability: 9.33, memo: '', kanaReading: 'しんえゔぁんげりおんたいぷれいえびeva' },
  { id: uid(), name: 'Pスーパー海物語IN沖縄6', shopDefault: '', border25: 18.0, border28: 0, border30: 0, border33: 0, border40: 0, payoutPerRound: 137.25, expectedBallsPerHit: 1400, totalProbability: 9.67, memo: '', kanaReading: 'すーぱーうみものがたりおきなわかいものがたりうみかい' },
];

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function calcElapsedHours(start, end) {
  if(!start||!end) return null;
  const [sh,sm]=start.split(':').map(Number);
  const [eh,em]=end.split(':').map(Number);
  const mins=(eh*60+em)-(sh*60+sm);
  if(mins<=0) return null;
  return mins/60;
}
function fmtElapsed(hours) {
  if(!hours||hours<=0) return null;
  const h=Math.floor(hours);
  const m=Math.round((hours-h)*60);
  return h>0?(m>0?`${h}時間${m}分`:`${h}時間`):(m>0?`${m}分`:null);
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

// ── あいまい検索用：ひらがな↔カタカナ・全角半角正規化 ──
function normalizeForSearch(str) {
  return String(str||'')
    .toLowerCase()
    // カタカナ→ひらがな
    .replace(/[\u30A1-\u30F6]/g, c=>String.fromCharCode(c.charCodeAt(0)-0x60))
    // 全角英数→半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0))
    // 空白除去
    .replace(/\s/g,'');
}
// テキスト内にqueryの文字が順番に含まれるか（あいまい）
function fuzzyContains(target, query) {
  const t=normalizeForSearch(target);
  const q=normalizeForSearch(query);
  if(!q) return true;
  if(t.includes(q)) return true;
  let ti=0;
  for(let qi=0;qi<q.length;qi++){
    const idx=t.indexOf(q[qi],ti);
    if(idx===-1) return false;
    ti=idx+1;
  }
  return true;
}
// 機種名 + kanaReading を合わせてマッチ
function fuzzyMatch(target, query) {
  return fuzzyContains(target, query);
}
// kanaReadingを含む機種マッチ
function fuzzyMatchMachine(machine, query) {
  if(!query) return true;
  return fuzzyContains(machine.name, query) || fuzzyContains(machine.kanaReading||'', query);
}

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
  // 25以下（等価）
  if(c==='25'||c==='26'||c==='27'||c==='27.5') return 'border25';
  // 28近辺
  if(c==='28'||c==='29') return 'border28';
  // 30近辺
  if(c==='30'||c==='31'||c==='32') return 'border30';
  // 33以上
  if(c==='33'||c==='34'||c==='35'||c==='40'||c==='45') return 'border33';
  return 'border25';
}
function getMachineBorderByCategory(m,c) { if(!m)return 0; return numberOrZero(m[getBorderFieldByCategory(c)]); }
function getExchangePreset(c) { return EXCHANGE_PRESETS[c]||EXCHANGE_PRESETS['25']; }
function getShopProfileByName(profiles,name) {
  const t=String(name||'').trim().toLowerCase(); if(!t)return null;
  return (profiles||[]).find(p=>String(p.name||'').trim().toLowerCase()===t)||null;
}
// 仕事量(円)を返す：総R数・1R平均出玉・換金率・現金投資が揃っている場合は新計算式
// 揃っていない場合は旧式（estimatedEVYen）にフォールバック
function getWorkVolumeYen(m) {
  if(m.workVolumeYen!==null&&m.workVolumeYen!==undefined) return m.workVolumeYen;
  return null; // 計算不能（機種データ未入力）
}
function getWorkVolumeBalls(m) { return m.exchangeRate>0?getWorkVolumeYen(m)/m.exchangeRate:0; }

function calcTheoreticalValueMetrics(metrics,machine,hours,settings) {
  const rate=numberOrZero(metrics.spinPerThousand), exchangeRate=numberOrZero(metrics.exchangeRate);
  const totalSpins=numberOrZero(metrics.totalSpins), enteredHours=numberOrZero(hours);
  const totalProbability=numberOrZero(machine?.totalProbability), averagePayout=numberOrZero(machine?.expectedBallsPerHit);
  const oneRoundPayout=numberOrZero(machine?.payoutPerRound);
  const holdRatio=clampNumber(metrics.holdBallRatio/100,0,1);
  const normalSpinsPerHour=enteredHours>0&&totalSpins>0?totalSpins/enteredHours:numberOrZero(settings.spinsPerHour);
  if(rate<=0||exchangeRate<=0||totalProbability<=0||oneRoundPayout<=0) return { totalProbability,averagePayout,oneRoundPayout,normalSpinsPerHour,holdUnitPriceYen:null,cashUnitPriceYen:null,mixedUnitPriceYen:null,workVolumeYen:null,workVolumeBalls:null,theoreticalHourlyYen:null };
  const holdUnitPriceYen=(oneRoundPayout/totalProbability-250/rate)*exchangeRate;
  const cashUnitPriceYen=oneRoundPayout/totalProbability*exchangeRate-1000/rate;
  const mixedUnitPriceYen=holdUnitPriceYen*holdRatio+cashUnitPriceYen*(1-holdRatio);
  const workVolumeYen=mixedUnitPriceYen*totalSpins;
  const workVolumeBalls=exchangeRate>0?workVolumeYen/exchangeRate:null;
  const theoreticalHourlyYen=normalSpinsPerHour>0?mixedUnitPriceYen*normalSpinsPerHour:null;
  return { totalProbability,averagePayout,oneRoundPayout,normalSpinsPerHour,holdUnitPriceYen,cashUnitPriceYen,mixedUnitPriceYen,workVolumeYen,workVolumeBalls,theoreticalHourlyYen };
}

function buildSectionRateHistoryPoints(session,settings) {
  const archived=session.rateHistoryPoints||[];
  // 持ち玉は常に1玉=4円固定で投資額換算
  const BALL_UNIT_PRICE=4;
  let baseSpins=archived.length?numberOrZero(archived[archived.length-1].totalSpins):0;
  let baseCashInvestYen=archived.length?numberOrZero(archived[archived.length-1].cashInvestYen):0;
  let baseBallInvestYen=archived.length?numberOrZero(archived[archived.length-1].ballInvestYen):0;
  let prevReading=numberOrZero(session.startRotation);
  const si=(session.rateSections||[]).length+1;
  return (session.rateEntries||[]).flatMap((entry,index)=>{
    const reading=numberOrZero(entry.reading);
    if(!(reading>0&&reading>=prevReading)) return [];
    const amount=numberOrZero(entry.amount), spins=reading-prevReading;
    if(entry.kind==='balls') baseBallInvestYen+=amount*BALL_UNIT_PRICE; else baseCashInvestYen+=amount;
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
  return { id:uid(),date:todayStr(),shop:'',machineId:'__none__',machineNameSnapshot:'',machineFreeName:'',machineNumber:'',exchangeCategory:'25',startRotation:'',sessionBorderOverride:'',totalSpinsManual:'',returnedBalls:'',endingBalls:'',endingUpperBalls:'',actualBalanceYen:'',hours:'',notes:'',freeMemo:'',inheritNotes:'',resultGoodMemo:'',resultBadMemo:'',rateHistoryPoints:[],tags:'',photos:[],firstHits:[],rateSections:[],measurementLogs:[],currentInputMode:'cash',startTime:'',endTime:'',status:'draft',updatedAt:Date.now(),rateEntries:[emptyRateEntry('cash',settings.defaultCashUnitYen,'')],inheritedCashInvestYen:0,inheritedBalanceYen:0,inheritedBalls:0 };
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
  // 持ち玉は等価非等価問わず常に1玉=4円で投資額換算（貸し玉単価）
  const BALL_UNIT_PRICE = 4;
  const cBallYen=cBalls*BALL_UNIT_PRICE, cInvestYen=cCash+cBallYen;
  const cRate=cInvestYen>0?currentSpins/(cInvestYen/1000):0;
  const cEVYen=cInvestYen>0?calcEvYenFromRate(cRate,machineBorder,cInvestYen,settings):0;
  const archived=(session.rateSections||[]).reduce((acc,s)=>{ acc.spins+=numberOrZero(s.spins); acc.investYen+=numberOrZero(s.investYen); acc.cashInvestYen+=numberOrZero(s.cashInvestYen); acc.ballInvestBalls+=numberOrZero(s.ballInvestBalls); acc.ballInvestYen+=numberOrZero(s.ballInvestYen); acc.estimatedEVYen+=numberOrZero(s.estimatedEVYen); return acc; },{spins:0,investYen:0,cashInvestYen:0,ballInvestBalls:0,ballInvestYen:0,estimatedEVYen:0});
  const totalSpins=archived.spins+currentSpins;
  const cashInvestYen=archived.cashInvestYen+cCash, ballInvestBalls=archived.ballInvestBalls+cBalls;
  const ballInvestYen=archived.ballInvestYen+cBallYen, totalInvestYen=archived.investYen+cInvestYen;
  const spinPerThousand=totalInvestYen>0?totalSpins/(totalInvestYen/1000):0;
  const holdBallRatio=totalInvestYen>0?(ballInvestYen/totalInvestYen)*100:0;
  const estimatedEVYen=archived.estimatedEVYen+cEVYen;
  const returnYen=returnedBalls*exchangeRate;  // 返却玉は換金率で計算

  // ── measurementLogs の累積 ──
  // jackpot_beforeはrateSectionsに既に含まれているため除外（二重カウント防止）
  const logs=(session.measurementLogs||[]).filter(l=>l.kind!=='jackpot_before');
  const logTotals=logs.reduce((a,l)=>{
    // cashInvestYenが未保存の古いログはinvestYenをそのまま使う
    const logCash=l.cashInvestYen!=null?numberOrZero(l.cashInvestYen):numberOrZero(l.investYen);
    const logBallYen=l.ballInvestYen!=null?numberOrZero(l.ballInvestYen):0;
    // 回転率計算用合計：cashInvestYenがあればcash+ball、なければinvestYenそのまま
    const logTotal=l.cashInvestYen!=null?(logCash+logBallYen):numberOrZero(l.investYen);
    return {
      spins:     a.spins     + numberOrZero(l.spins),
      investYen: a.investYen + logTotal,
      cashInvest:a.cashInvest+ logCash,
      ballBalls: a.ballBalls + numberOrZero(l.ballInvestBalls),
      ballYen:   a.ballYen   + logBallYen,
      evYen:     a.evYen     + numberOrZero(l.estimatedEVYen),
    };
  },{spins:0,investYen:0,cashInvest:0,ballBalls:0,ballYen:0,evYen:0});

  // ── 引き継ぎデータの加算 ──
  const inheritedCash=numberOrZero(session.inheritedCashInvestYen);
  const inheritedBal=numberOrZero(session.inheritedBalanceYen);
  const inheritedBallsBase=numberOrZero(session.inheritedBalls);

  // ── 全計測を合算した totals ──
  const allTotalSpins    = logTotals.spins     + totalSpins;
  const allTotalInvestYen= logTotals.investYen + totalInvestYen;             // 回転率計算用（今セッションのみ・引き継ぎ現金は含めない）
  const allCashInvestYen = logTotals.cashInvest+ cashInvestYen + inheritedCash;   // 表示・収支用（現金のみ＋引き継ぎ現金）
  const allBallInvestBalls=logTotals.ballBalls + ballInvestBalls;
  const allBallInvestYen = logTotals.ballYen   + ballInvestYen;
  const allEstimatedEVYen= logTotals.evYen     + estimatedEVYen;
  // 回転率は現金＋持ち玉の合計で計算（実際の消費量ベース）
  const allSpinPerThousand=allTotalInvestYen>0?allTotalSpins/(allTotalInvestYen/1000):spinPerThousand;
  const allHoldBallRatio=allTotalInvestYen>0?(allBallInvestYen/allTotalInvestYen)*100:holdBallRatio;

  // ── 持ち玉残枚数 ──
  const lastFirstHit=(session.firstHits||[]).slice(-1)[0];
  const lastEndBalls=numberOrZero(lastFirstHit?.endBalls);
  const ballsBase=lastEndBalls>0?lastEndBalls:inheritedBallsBase;
  // 大当たり後は現在枠＋アーカイブ済み投資玉を引く（measurementLogsも含む）
  const ballsDeducted=lastEndBalls>0?(logTotals.ballBalls+cBalls):allBallInvestBalls;
  const currentBalls=ballsBase>0?Math.max(0,ballsBase-ballsDeducted):null;
  const currentBallsYen=currentBalls!==null?currentBalls*exchangeRate:null;  // 持ち玉は換金率で計算

  // ── 収支：残り持ち玉の価値 − 今回の現金投資のみ + 引き継ぎ収支補正 ──
  const todayCashInvestYen = allCashInvestYen - inheritedCash;
  // 持ち玉引き継ぎ時：inheritedBal - inheritedBalls×換金率 を補正値として使う
  // （開始時点の balance = currentBallsYen - 0 + 補正値 = inheritedBal になる）
  const useInheritedBal = inheritedBallsBase > 0
    ? inheritedBal - inheritedBallsBase * exchangeRate   // 引き継ぎ持ち玉も換金率で計算
    : inheritedBal;
  const autoBalanceYen=currentBalls!==null
    ? (currentBallsYen - todayCashInvestYen) + useInheritedBal   // 持ち玉あり
    : (returnYen - todayCashInvestYen) + useInheritedBal;         // 持ち玉なし
  const balanceYen=Number.isFinite(actualBalanceYenRaw)&&session.actualBalanceYen!==''?actualBalanceYenRaw:autoBalanceYen;
  const yph=hours>0?allEstimatedEVYen/hours:0;

  // ── 総R数・1R平均出玉（仕事量計算用） ──
  const totalRounds=(session.firstHits||[]).reduce((a,h)=>a+numberOrZero(h.rounds),0);
  const oneRoundPayout=numberOrZero(machine?.payoutPerRound);
  const totalProbability=numberOrZero(machine?.totalProbability);
  // 仕事量 = 実収支 − (実際R数 − 理論R数) × 1R平均出玉 × 換金率
  // 理論R数 = 通常回転数 ÷ トータル確率分母
  // 運（出玉の引き）を除いた台の回転率による純粋な稼ぎ
  const theoreticalRounds=totalProbability>0?allTotalSpins/totalProbability:0;
  const workVolumeYen=(oneRoundPayout>0&&totalProbability>0)
    ? balanceYen - (totalRounds - theoreticalRounds)*oneRoundPayout*exchangeRate
    : null;

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
    totalRounds, oneRoundPayout, workVolumeYen,
    // ── 回転率計算専用（内部用） ──
    totalInvestYenForRate: allTotalInvestYen,
    // ── 現在枠のみ（詳細・行計算用） ──
    currentFrameSpins:    totalSpins,
    currentFrameInvestYen:totalInvestYen,
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

/* ─── カラーテーマ定義 ─── */
const COLOR_THEMES = {
  indigo: { primary:'#4f46e5', primaryLight:'#eef2ff', primaryMid:'#c7d2fe', accent:'#0ea5e9', accentLight:'#e0f2fe', tableHeader:'#312e81' },
  sky:    { primary:'#0284c7', primaryLight:'#e0f2fe', primaryMid:'#bae6fd', accent:'#6366f1', accentLight:'#ede9fe', tableHeader:'#0c4a6e' },
  emerald:{ primary:'#059669', primaryLight:'#ecfdf5', primaryMid:'#a7f3d0', accent:'#0ea5e9', accentLight:'#e0f2fe', tableHeader:'#065f46' },
  rose:   { primary:'#e11d48', primaryLight:'#fff1f2', primaryMid:'#fecdd3', accent:'#f97316', accentLight:'#fff7ed', tableHeader:'#9f1239' },
  amber:  { primary:'#d97706', primaryLight:'#fffbeb', primaryMid:'#fde68a', accent:'#0ea5e9', accentLight:'#e0f2fe', tableHeader:'#78350f' },
  violet: { primary:'#7c3aed', primaryLight:'#f5f3ff', primaryMid:'#ddd6fe', accent:'#ec4899', accentLight:'#fdf2f8', tableHeader:'#4c1d95' },
};

function buildColorSystem(theme='indigo', dark=false) {
  const t=COLOR_THEMES[theme]||COLOR_THEMES.indigo;
  if(dark) return {
    bg:'#0f172a', card:'#1e293b', border:'#334155',
    primary:t.primary, primaryLight:'rgba(255,255,255,0.06)', primaryMid:'rgba(255,255,255,0.15)',
    accent:t.accent, accentLight:'rgba(255,255,255,0.06)',
    positive:'#34d399', positiveBg:'rgba(52,211,153,0.12)', positiveBorder:'rgba(52,211,153,0.3)',
    negative:'#fb7185', negativeBg:'rgba(251,113,133,0.12)', negativeBorder:'rgba(251,113,133,0.3)',
    textPrimary:'#f1f5f9', textSecondary:'#94a3b8', textMuted:'#64748b',
    amber:'#fbbf24', amberBg:'rgba(251,191,36,0.12)', amberBorder:'rgba(251,191,36,0.3)',
    tablePositive:'#34d399', tablePositiveBg:'rgba(52,211,153,0.15)',
    tableNegative:'#fb7185', tableNegativeBg:'rgba(251,113,133,0.15)',
    tableHeader: t.tableHeader,
  };
  return {
    bg:'#f0f4ff', card:'#ffffff', border:'#e2e8f0',
    primary:t.primary, primaryLight:t.primaryLight, primaryMid:t.primaryMid,
    accent:t.accent, accentLight:t.accentLight,
    positive:'#059669', positiveBg:'#ecfdf5', positiveBorder:'#a7f3d0',
    negative:'#dc2626', negativeBg:'#fff1f2', negativeBorder:'#fecdd3',
    textPrimary:'#0f172a', textSecondary:'#475569', textMuted:'#94a3b8',
    amber:'#d97706', amberBg:'#fffbeb', amberBorder:'#fde68a',
    tablePositive:'#065f46', tablePositiveBg:'#d1fae5',
    tableNegative:'#9f1239', tableNegativeBg:'#ffe4e6',
    tableHeader: t.tableHeader,
  };
}

// 後でstateベースに差し替えるのでグローバル版は仮置き
let C = buildColorSystem('indigo', false);

function getRateTone(diff, border, dark=false) {
  if(dark){
    if(border<=0) return { bg:'#1e293b', border:'#334155', text:'#94a3b8' };
    if(diff>=1)   return { bg:'rgba(52,211,153,0.15)', border:'rgba(52,211,153,0.4)', text:'#34d399' };
    if(diff>=0)   return { bg:'rgba(52,211,153,0.08)', border:'rgba(52,211,153,0.25)', text:'#6ee7b7' };
    if(diff<=-1)  return { bg:'rgba(251,113,133,0.15)', border:'rgba(251,113,133,0.4)', text:'#fb7185' };
    return { bg:'rgba(251,113,133,0.08)', border:'rgba(251,113,133,0.25)', text:'#fda4af' };
  }
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
    <button onClick={onClick} style={{ padding:'6px 16px', borderRadius:999, border:`1.5px solid ${active?C.primary:C.border}`, background:active?C.primary:C.card, color:active?'white':C.textSecondary, fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.15s', whiteSpace:'nowrap' }}>
      {children}
    </button>
  );
}

function MonthCalendar({ currentMonth, sessions, selectedDate, onSelectDate, onPrev, onNext, isDark }) {
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
    if(!info) return { background:isDark?C.card:C.bg, border:`1px solid ${C.border}`, outline:sel?`2px solid ${C.primary}`:undefined };
    const lvl=getDayStrength(info.balance,info.ev);
    const bg=isDark
      ? (lvl==='great'?'rgba(52,211,153,0.25)':lvl==='good'?'rgba(52,211,153,0.12)':lvl==='bad'?'rgba(251,113,133,0.25)':lvl==='weak'?'rgba(251,113,133,0.12)':C.card)
      : (lvl==='great'?'#d1fae5':lvl==='good'?'#ecfdf5':lvl==='bad'?'#ffe4e6':lvl==='weak'?'#fff1f2':C.card);
    const bd=isDark
      ? (lvl==='great'?'rgba(52,211,153,0.5)':lvl==='good'?'rgba(52,211,153,0.3)':lvl==='bad'?'rgba(251,113,133,0.5)':lvl==='weak'?'rgba(251,113,133,0.3)':C.border)
      : (lvl==='great'?'#6ee7b7':lvl==='good'?'#bbf7d0':lvl==='bad'?'#fca5a5':lvl==='weak'?'#fecaca':C.border);
    return { background:bg, border:`1.5px solid ${bd}`, outline:sel?`2px solid ${C.primary}`:undefined };
  }
  return (
    <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ padding:'12px 14px 0', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <button onClick={onPrev} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronLeft size={15} color={C.textSecondary}/></button>
        <div style={{ fontWeight:700, color:C.textPrimary, fontSize:15 }}>{year}年 {month+1}月</div>
        <button onClick={onNext} style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronRight size={15} color={C.textSecondary}/></button>
      </div>
      <div style={{ padding:'10px 8px 12px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
          {['日','月','火','水','木','金','土'].map(d=><div key={d} style={{ textAlign:'center',fontSize:10,color:C.textMuted,fontWeight:600 }}>{d}</div>)}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {cells.map((day,i)=>{
            if(!day) return <div key={`e${i}`} style={{ aspectRatio:'1',borderRadius:8,background:isDark?C.card:C.bg }}/>;
            const ds=`${currentMonth}-${String(day).padStart(2,'0')}`;
            const info=dayMap[ds];
            return (
              <button key={ds} onClick={()=>onSelectDate(ds)} style={{ aspectRatio:'1',borderRadius:8,padding:'3px 2px',textAlign:'center',cursor:'pointer',transition:'all 0.1s',...dayStyle(info,ds) }}>
                <div style={{ fontSize:12,fontWeight:700,color:C.textPrimary,lineHeight:1 }}>{day}</div>
                {info&&<div style={{ marginTop:1,fontSize:8,lineHeight:1.2,color:C.textSecondary }}>
                  <div style={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{info.balance>=0?'+':''}{Math.round(info.balance/1000)}k</div>
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

  // ── ダークモード判定 ──
  const [sysDark,setSysDark]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [bgImage,setBgImage]=useState(()=>{try{return localStorage.getItem('pachi_bg_image')||null;}catch{return null;}});
  const [bgOpacity,setBgOpacity]=useState(()=>{try{return Number(localStorage.getItem('pachi_bg_opacity'))||0.15;}catch{return 0.15;}});

  function handleBgImageUpload(file) {
    if(!file) return;
    const reader=new FileReader();
    reader.onload=e=>{
      const dataUrl=e.target.result;
      setBgImage(dataUrl);
      try{localStorage.setItem('pachi_bg_image',dataUrl);}catch{alert('画像が大きすぎて保存できないぜ。もう少し小さい画像を使ってくれ。');}
    };
    reader.readAsDataURL(file);
  }
  function removeBgImage() {
    setBgImage(null);
    try{localStorage.removeItem('pachi_bg_image');}catch{}
  }
  function updateBgOpacity(v) {
    setBgOpacity(v);
    try{localStorage.setItem('pachi_bg_opacity',String(v));}catch{}
  }
  useEffect(()=>{
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const handler=e=>setSysDark(e.matches);
    mq.addEventListener('change',handler);
    return ()=>mq.removeEventListener('change',handler);
  },[]);
  const isDark=settings.themeMode==='dark'||(settings.themeMode==='system'&&sysDark);
  C=buildColorSystem(settings.colorTheme||'indigo', isDark);
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
  const [editingHitId,setEditingHitId]=useState(null); // 編集中の初当たりID
  const [hitEditForm,setHitEditForm]=useState({restartRotation:'0',restartReason:'single',restartReasonNote:'',rounds:'0',hitSpins:'',remainingHolds:'',chainCount:'0',notes:''});
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
  const [shopProfileDraft,setShopProfileDraft]=useState({name:'',exchangeCategory:'25',specialDays:'',specialDayList:[],notes:''});
  const [editingShopName,setEditingShopName]=useState(null); // 編集中の店舗名
  const [shopEditDraft,setShopEditDraft]=useState({name:'',exchangeCategory:'25',specialDays:'',specialDayList:[],notes:''});
  const [shopProfileOpen,setShopProfileOpen]=useState(false);
  const [shopProfilePage,setShopProfilePage]=useState(0);
  const SHOP_PAGE_SIZE=20;
  const readingInputRefs=useRef([]);
  const autosaveTimerRef=useRef(null);
  const skipAutosaveRef=useRef(false);
  const [judgeForm,setJudgeForm]=useState({observedRate:'',border:'',note:''});
  // ── ボーダーライン算出 ──
  const [borderCalc,setBorderCalc]=useState({
    oneRoundPayout:'',      // 1R平均出玉
    totalRatePer1R:'',      // 1Rトータル確率（分母）
    holdBallRatioInput:'',  // 持ち玉比率(%)
    exchangeCategory:'25',  // 交換率
    showExtended:false,     // ±5超を表示するか
    planHours:4,            // 稼働想定時間（1〜11h）
    selectedBorderMachineId:'', // ボーダー算出用に選んだ機種ID
    expandedIntRows: [],    // 展開中の整数行（Set的に使用）
  });
  const [firstHitForm,setFirstHitForm]=useState({ label:'初当たり1回目',rounds:'0',startBalls:'0',upperBalls:'0',endBalls:'',hitSpins:'',cashInvestInput:'',restartRotation:'0',restartReason:'single',restartReasonNote:'',chainCount:'0',remainingHolds:'' });
  const firstHitDialogOpenTimeRef=useRef(0);
  const [firstHitStep,setFirstHitStep]=useState(1); // 1:R数 2:持ち玉 3:ゲーム数・確認
  const [machineDraft,setMachineDraft]=useState({ name:'',border25:'',border28:'',border30:'',border33:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',kanaReading:'' });
  const [editMachineId,setEditMachineId]=useState(null);
  const [editMachineDialogOpen,setEditMachineDialogOpen]=useState(false);
  const [addMachineDialogOpen,setAddMachineDialogOpen]=useState(false);
  const [machineListDialogOpen,setMachineListDialogOpen]=useState(false);
  const [shopListDialogOpen,setShopListDialogOpen]=useState(false);
  const [favoriteMachineIds,setFavoriteMachineIds]=useState(()=>{try{return JSON.parse(localStorage.getItem('pachi_favorites')||'[]');}catch{return [];}});
  const [favoriteShopNames,setFavoriteShopNames]=useState(()=>{try{return JSON.parse(localStorage.getItem('pachi_fav_shops')||'[]');}catch{return [];}});
  const [machineListTab,setMachineListTab]=useState('all'); // 'all' | 'fav'
  const [shopListTab,setShopListTab]=useState('all'); // 'all' | 'fav'
  const toggleFavorite=(id)=>{setFavoriteMachineIds(prev=>{const next=prev.includes(id)?prev.filter(x=>x!==id):[...prev,id];try{localStorage.setItem('pachi_favorites',JSON.stringify(next));}catch{}return next;});};
  const toggleFavoriteShop=(name)=>{setFavoriteShopNames(prev=>{const next=prev.includes(name)?prev.filter(x=>x!==name):[...prev,name];try{localStorage.setItem('pachi_fav_shops',JSON.stringify(next));}catch{}return next;});};
  const [deleteConfirmOpen,setDeleteConfirmOpen]=useState(false);
  const [inheritConfirmSessionId,setInheritConfirmSessionId]=useState(null);
  const [inheritDialogOpen,setInheritDialogOpen]=useState(false);
  const [inheritOptions,setInheritOptions]=useState({cashInvest:true,balance:true,balls:true,shop:true});
  const [resetConfirmOpen,setResetConfirmOpen]=useState(false);
  const [tableMoveConfirmOpen,setTableMoveConfirmOpen]=useState(false);
  const [stopLossAlertOpen,setStopLossAlertOpen]=useState(false);
  const [belowBorderAlertOpen,setBelowBorderAlertOpen]=useState(false);
  const belowBorderAlertSpinsRef=useRef(0); // 最後にアラートを出した回転数
  const [showHomeWidget,setShowHomeWidget]=useState(false);
  const [swipeStates,setSwipeStates]=useState({});
  const swipeTouchStart=useRef({});
  const [nailGrades,setNailGrades]=useState(()=>{try{return JSON.parse(localStorage.getItem('pachi_nail_grades')||'{}');}catch{return {};}});
  const [hesoDirections,setHesoDirections]=useState(()=>{try{return JSON.parse(localStorage.getItem('pachi_heso_dirs')||'[]');}catch{return [];}});
  const [nailMemo,setNailMemo]=useState(()=>{try{return JSON.parse(localStorage.getItem('pachi_nail_memo')||'{"tables":[],"machineName":""}');}catch{return {tables:[],machineName:''};}}); 
  const [nailTableInput,setNailTableInput]=useState('');
  function setNailGrade(id,grade){setNailGrades(p=>{const n={...p,[id]:p[id]===grade?'':grade};try{localStorage.setItem('pachi_nail_grades',JSON.stringify(n));}catch{}return n;});}
  function toggleHesoDir(dir){setHesoDirections(p=>{let n;if(p.includes(dir)){n=p.filter(d=>d!==dir);}else if(p.length<2){n=[...p,dir];}else{n=[p[1],dir];}try{localStorage.setItem('pachi_heso_dirs',JSON.stringify(n));}catch{}return n;});}
  function updateNailMemo(key,val){setNailMemo(p=>{const n={...p,[key]:val};try{localStorage.setItem('pachi_nail_memo',JSON.stringify(n));}catch{}return n;});}
  function addNailTableNum(){const num=nailTableInput.trim();if(!num||isNaN(Number(num)))return;setNailMemo(p=>{if(p.tables&&p.tables.some(t=>t.num===Number(num)))return p;const tables=[...(p.tables||[]),{num:Number(num),machine:''}].slice(0,10);const n={...p,tables};try{localStorage.setItem('pachi_nail_memo',JSON.stringify(n));}catch{}return n;});setNailTableInput('');}
  function removeNailTable(num){setNailMemo(p=>{const n={...p,tables:(p.tables||[]).filter(t=>t.num!==num)};try{localStorage.setItem('pachi_nail_memo',JSON.stringify(n));}catch{}return n;});}
  function updateTableMachine(num,machine){setNailMemo(p=>{const n={...p,tables:(p.tables||[]).map(t=>t.num===num?{...t,machine}:t)};try{localStorage.setItem('pachi_nail_memo',JSON.stringify(n));}catch{}return n;});}

  // 振り分けカウンター
  const DEFAULT_COUNTERS = [
    {id:'stage',  label:'ステージ入賞', color:'#ec4899', bg:'rgba(236,72,153,0.12)', border:'rgba(236,72,153,0.4)', count:0},
    {id:'fusha',  label:'風車振り分け',  color:'#10b981', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.4)', count:0},
    {id:'koboshi',label:'こぼし',         color:'#f59e0b', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.4)', count:0},
    {id:'warp',   label:'ワープ抜け',    color:'#3b82f6', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.4)', count:0},
    {id:'other1', label:'カスタム1',     color:'#8b5cf6', bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.4)', count:0},
    {id:'other2', label:'カスタム2',     color:'#6b7280', bg:'rgba(107,114,128,0.12)', border:'rgba(107,114,128,0.4)', count:0},
  ];
  const [counters,setCounters]=useState(()=>{try{const s=localStorage.getItem('pachi_counters');return s?JSON.parse(s):DEFAULT_COUNTERS;}catch{return DEFAULT_COUNTERS;}});
  const [counterLabels,setCounterLabels]=useState(()=>{try{const s=localStorage.getItem('pachi_counter_labels');return s?JSON.parse(s):DEFAULT_COUNTERS.map(c=>c.label);}catch{return DEFAULT_COUNTERS.map(c=>c.label);}});
  // カウンター履歴（セッションごとに保存）
  const [counterHistory,setCounterHistory]=useState(()=>{try{const s=localStorage.getItem('pachi_counter_history');return s?JSON.parse(s):[];}catch{return [];}});

  // カウンターの変更をlocalStorageに自動保存
  useEffect(()=>{try{localStorage.setItem('pachi_counters',JSON.stringify(counters));}catch{}},[counters]);
  useEffect(()=>{try{localStorage.setItem('pachi_counter_labels',JSON.stringify(counterLabels));}catch{}},[counterLabels]);

  // カウンターをセッションと共に履歴保存する関数
  function saveCounterSnapshot() {
    if(counters.every(c=>c.count===0)) return;
    const snap={
      id:uid(), date:todayStr(), sessionId:form.id,
      totalSpins:Math.round(formMetrics.allTotalSpins),
      shop:form.shop, machine:form.machine?.name||form.machineFreeName||'',
      counts:counters.map((c,i)=>({id:c.id,label:counterLabels[i],count:c.count,color:c.color})),
    };
    setCounterHistory(prev=>{const next=[snap,...prev].slice(0,50);try{localStorage.setItem('pachi_counter_history',JSON.stringify(next));}catch{}return next;});
  }
  const [machineSearchQuery,setMachineSearchQuery]=useState('');
  const [borderMachineSearchQuery,setBorderMachineSearchQuery]=useState('');
  const [shopSuggestOpen,setShopSuggestOpen]=useState(false);

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

  // 初当たり記録から1R出玉の平均を算出
  const avgOneRoundFromHits=useMemo(()=>{
    const hits=(form.firstHits||[]).filter(h=>h.oneRound>0);
    if(hits.length===0) return null;
    const avg=hits.reduce((a,h)=>a+h.oneRound,0)/hits.length;
    return Number(avg.toFixed(1));
  },[form.firstHits]);
  const saveStatusMeta=getSaveStatusMeta(saveStatus);
  // 自動算出ボーダー（手動登録なし・1R出玉＆確率あり）
  const autoCalcBorder=useMemo(()=>{
    if(!selectedMachine) return 0;
    const oneR=numberOrZero(selectedMachine.payoutPerRound);
    const prob=numberOrZero(selectedMachine.totalProbability);
    if(oneR<=0||prob<=0) return 0;
    const cat=form.exchangeCategory||'25';
    const coeff=numberOrZero(cat)*10||250;
    return coeff/(oneR/prob);
  },[selectedMachine,form.exchangeCategory]);
  const currentBorderInputValue=form.sessionBorderOverride!==''
    ? form.sessionBorderOverride
    : selectedMachine
      ? (getMachineBorderByCategory(selectedMachine,form.exchangeCategory||'25')>0
          ? String(getMachineBorderByCategory(selectedMachine,form.exchangeCategory||'25'))
          : (autoCalcBorder>0 ? String(Number(autoCalcBorder.toFixed(2))) : ''))
      : '';
  const currentObservedBaseRate=Math.floor(formMetrics.spinPerThousand||0);
  const expectTargetTenthRate=Number((Math.round(((numberOrZero(expectManualRateInput)||formMetrics.spinPerThousand||0)*10))/10).toFixed(1));
  const sessionTrendData=useMemo(()=>getSessionTrendData(form,settings),[form,settings]);
  const moneySwitchData=useMemo(()=>sessionTrendData.map(p=>({label:p.label,totalSpins:p.totalSpins,cashInvestYen:p.cashInvestYen,ballInvestYen:p.ballInvestYen})),[sessionTrendData]);
  const resultReturnedBalls=numberOrZero(form.endingBalls)+numberOrZero(form.endingUpperBalls);
  const resultPreviewMetrics=useMemo(()=>calcRateMetrics({...form,returnedBalls:resultReturnedBalls>0?String(resultReturnedBalls):form.returnedBalls},selectedMachine,settings),[form,resultReturnedBalls,selectedMachine,settings]);
  const recentShopPresets=useMemo(()=>{ const u=[]; (settings.shopProfiles||[]).forEach(p=>{if(p.name&&!u.includes(p.name))u.push(p.name);}); enrichedSessions.forEach(s=>{if(s.shop&&!u.includes(s.shop))u.push(s.shop);}); return u; },[settings.shopProfiles,enrichedSessions]);
  const recentMachinePresets=useMemo(()=>{ const seen=new Set(); const sorted=[...enrichedSessions].sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)); const recentIds=[]; sorted.forEach(s=>{const k=s.machineId&&s.machineId!=='__none__'?s.machineId:'';if(k&&!seen.has(k)){seen.add(k);recentIds.push(k);}}); return recentIds.slice(0,7).map(id=>machines.find(m=>m.id===id)).filter(Boolean); },[enrichedSessions,machines]);
  const theoreticalMetrics=useMemo(()=>calcTheoreticalValueMetrics(formMetrics,selectedMachine,form.hours,settings),[formMetrics,selectedMachine,form.hours,settings]);

  useEffect(()=>{ setJudgeForm(p=>({...p,observedRate:p.observedRate||(formMetrics.spinPerThousand?String(Number(formMetrics.spinPerThousand.toFixed(2))):''),border:p.border||(formMetrics.machineBorder?String(formMetrics.machineBorder||''):'')})); },[formMetrics.spinPerThousand,formMetrics.machineBorder]);

  // 損切りアラート検知
  useEffect(()=>{
    if(!settings.stopLossEnabled) return;
    const loss=-formMetrics.balanceYen;
    const limit=numberOrZero(settings.stopLossYen);
    if(loss>=limit&&limit>0&&!stopLossAlertOpen&&formMetrics.totalSpins>0){
      setStopLossAlertOpen(true);
    }
  },[formMetrics.balanceYen, settings.stopLossEnabled, settings.stopLossYen]);

  // 連続ボーダー以下アラート検知（マイルストーンごとに再通知）
  useEffect(()=>{
    const threshold=numberOrZero(settings.belowBorderAlertSpins)||500;
    const border=formMetrics.machineBorder;
    if(!border||border<=0) return;
    const spins=formMetrics.totalSpins;
    if(spins<threshold) return;
    if(formMetrics.rateDiff>=0) { belowBorderAlertSpinsRef.current=0; return; }
    // 次のマイルストーン（500回転ごと）に達したらアラート
    const milestone=Math.floor(spins/threshold)*threshold;
    if(milestone>belowBorderAlertSpinsRef.current){
      belowBorderAlertSpinsRef.current=milestone;
      setBelowBorderAlertOpen(true);
    }
  },[formMetrics.totalSpins, formMetrics.rateDiff, formMetrics.machineBorder]);

  // ボーダー算出タブのdisplayBorderを回転率タブのボーダーに自動反映
  // （持ち玉比率考慮ボーダーが算出されたとき、ユーザーが手動上書きしていない場合のみ）
  const borderCalcDisplayBorder=useMemo(()=>{
    const bc=borderCalc;
    const oneR=numberOrZero(bc.oneRoundPayout);
    const totalRateDenom=numberOrZero(bc.totalRatePer1R);
    if(oneR<=0||totalRateDenom<=0) return 0;
    const cat=bc.exchangeCategory||'25';
    // COEFFは1000円で買える玉数（等価:250、28個:280...）
    const COEFF={'25':250,'26':260,'27':270,'27.5':275,'28':280,'29':290,'30':300,'31':310,'32':320,'33':330,'34':340,'35':350,'40':400,'45':450};
    const coeff=COEFF[cat]||250;
    const equivBorder=250/(oneR/totalRateDenom);
    const cashBorder=coeff/(oneR/totalRateDenom);
    const holdRatio=numberOrZero(bc.holdBallRatioInput)/100;
    // 等価：等価ボーダーをそのまま使用
    // 非等価：持ち玉比率考慮ボーダー（mixedBorder）を使用
    if(cat==='25') return equivBorder;
    const mixedBorder=equivBorder>0&&cashBorder>0
      ? equivBorder*holdRatio+cashBorder*(1-holdRatio) : cashBorder;
    return mixedBorder;
  },[borderCalc]);

  const [borderCalcAutoApplied,setBorderCalcAutoApplied]=useState(false); // 自動反映済みフラグ

  useEffect(()=>{
    if(borderCalcDisplayBorder<=0) return;
    // ユーザーが手動でボーダーを変更している場合は上書きしない
    // borderCalcAutoApplied がfalse（まだ自動反映していない）か、
    // または値が変わった場合のみ反映
    setBorderCalcAutoApplied(prev=>{
      const newVal=String(Number(borderCalcDisplayBorder.toFixed(2)));
      if(!prev){
        applyFormUpdate(p=>({...p,sessionBorderOverride:newVal}),{trackUndo:false,markDirty:false});
        return true;
      }
      return prev;
    });
  },[borderCalcDisplayBorder]);

  // ボーダー算出タブの値が変わったら自動反映フラグをリセット
  useEffect(()=>{
    setBorderCalcAutoApplied(false);
  },[borderCalc.oneRoundPayout, borderCalc.totalRatePer1R, borderCalc.exchangeCategory, borderCalc.holdBallRatioInput]);

  // ボーダー算出タブを開いた時 or 機種変更時 → 機種・持ち玉比率を自動同期
  useEffect(()=>{
    if(activeTab!=='judge') return;
    setBorderCalc(p=>{
      const m=selectedMachine;
      const holdRatio=Math.round(formMetrics.holdBallRatio);
      const exchCat=form.exchangeCategory||'25';
      return {
        ...p,
        // 機種が選択されていれば自動で選択
        selectedBorderMachineId: m ? m.id : p.selectedBorderMachineId,
        oneRoundPayout: m ? (avgOneRoundFromHits!==null ? String(avgOneRoundFromHits) : String(m.payoutPerRound||'')) : p.oneRoundPayout,
        totalRatePer1R: m && m.totalProbability>0 ? String(m.totalProbability) : p.totalRatePer1R,
        // 回転率の交換率を同期
        exchangeCategory: exchCat,
        // 非等価の場合は回転率の持ち玉比率を自動入力
        holdBallRatioInput: (exchCat!=='25' && holdRatio>0) ? String(holdRatio) : p.holdBallRatioInput,
      };
    });
  },[activeTab, form.machineId, form.exchangeCategory, formMetrics.holdBallRatio, avgOneRoundFromHits]);

  const firstHitMetrics=useMemo(()=>{ const rounds=numberOrZero(firstHitForm.rounds),startBalls=numberOrZero(firstHitForm.startBalls),upperBalls=numberOrZero(firstHitForm.upperBalls),endBalls=numberOrZero(firstHitForm.endBalls); const gainedBalls=Math.max(0,endBalls-(startBalls+upperBalls)); const oneRound=rounds>0&&gainedBalls>0?gainedBalls/rounds:0; return {rounds,gainedBalls,oneRound}; },[firstHitForm]);

  const judgeMetrics=useMemo(()=>{ const observed=numberOrZero(judgeForm.observedRate),border=numberOrZero(judgeForm.border),diff=observed-border; const playDiff=numberOrZero(settings.judgePlayDiff),watchDiff=numberOrZero(settings.judgeWatchDiff); const reliability=formMetrics.totalSpins>=200?'高':formMetrics.totalSpins>=100?'中':'低'; let verdict='判定不能',tone='secondary',comment='回転率かボーダーを入れてくれ。'; if(observed>0&&border>0){if(diff>=playDiff&&formMetrics.totalSpins>=80){verdict='打てる';tone='default';comment='今の数値なら続行候補だぜ。ブレはあるが、まだ追う価値がある。';}else if(diff>=watchDiff){verdict='様子見';tone='secondary';comment='ボーダー付近だな。もう少しサンプルを取ると精度が上がる。';}else{verdict='やめ候補';tone='destructive';comment='今のところ弱い。根拠が増えない限り深追いは危険だぜ。';}} return {observed,border,diff,verdict,tone,comment,reliability}; },[judgeForm,settings,formMetrics.totalSpins]);

  const expectedHours=clampNumber(settings.expectedHours,1,10)||4;
  const expectedSpins=expectedHours*(numberOrZero(settings.spinsPerHour)||200);

  const expectationRows=useMemo(()=>Array.from({length:15},(_,i)=>16+i).map(rate=>({rate,values:EXCHANGE_ORDER.map(category=>{const preset=getExchangePreset(category);const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,category):0;const border=mb>0?mb:DEFAULT_BORDER;const investYen=rate>0?(expectedSpins/rate)*1000:0;const evYen=calcEvYenFromRate(rate,border,investYen,settings);return {category,preset,border,evYen,evBalls:evYen/preset.yenPerBall};})})),[expectedSpins,selectedMachine,settings]);
  const expectationDetailRows=useMemo(()=>{ if(expectDetailBaseRate===null)return []; return Array.from({length:10},(_,i)=>Number((expectDetailBaseRate+i/10).toFixed(1))).map(rate=>({rate,values:EXCHANGE_ORDER.map(category=>{const preset=getExchangePreset(category);const mb=selectedMachine?getMachineBorderByCategory(selectedMachine,category):0;const border=mb>0?mb:DEFAULT_BORDER;const investYen=rate>0?(expectedSpins/rate)*1000:0;const evYen=calcEvYenFromRate(rate,border,investYen,settings);return {category,preset,border,evYen,evBalls:evYen/preset.yenPerBall};})})); },[expectDetailBaseRate,expectedSpins,selectedMachine,settings]);

  const targetSessions=useMemo(()=>enrichedSessions.filter(s=>periodMode==='year'?yearKey(s.date)===currentYear:monthKey(s.date)===currentMonth),[enrichedSessions,periodMode,currentMonth,currentYear]);
  const selectedDateSessions=enrichedSessions.filter(s=>s.date===selectedDate);

  const trendChartData=useMemo(()=>{ if(periodMode==='year'){const map={}; for(let i=1;i<=12;i++) map[`${currentYear}-${String(i).padStart(2,'0')}`]={label:`${i}月`,balance:0,work:0}; targetSessions.forEach(s=>{const k=monthKey(s.date); if(map[k]){map[k].balance+=s.metrics.balanceYen; map[k].work+=(getWorkVolumeYen(s.metrics)??0);}}); return Object.values(map); } const sorted=[...targetSessions].sort((a,b)=>a.date>b.date?1:-1); let bc=0,wc=0; return sorted.map(s=>{bc+=s.metrics.balanceYen; wc+=(getWorkVolumeYen(s.metrics)??0); return {label:dateLabel(s.date),balance:bc,work:wc};}); },[targetSessions,periodMode,currentYear]);
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
  function applyFormUpdate(u,opts={}) { const {trackUndo=true,markDirty=true}=opts; setForm(prev=>{if(trackUndo)setUndoStack(s=>[cloneDeep(prev),...s].slice(0,10)); return typeof u==='function'?u(prev):u;}); if(markDirty)setSaveStatus('dirty'); }
  function undoLastChange() { setUndoStack(prev=>{if(!prev.length)return prev; const [l,...r]=prev; skipAutosaveRef.current=true; setForm(l); setSaveStatus('dirty'); return r;}); }

  useEffect(()=>{ if(skipAutosaveRef.current){skipAutosaveRef.current=false;return;} if(!hasMeaningfulSession(form)||form.status==='completed')return; clearTimeout(autosaveTimerRef.current); autosaveTimerRef.current=setTimeout(()=>{setSaveStatus('saving'); upsertSession(buildPersistedSession(form,'draft')); setSaveStatus('saved');},700); return ()=>clearTimeout(autosaveTimerRef.current); },[form,machines]);

  function updateForm(k,v) { applyFormUpdate(p=>({...p,[k]:v})); }
  function applyShopValue(v) { applyFormUpdate(p=>{ const mp=getShopProfileByName(settings.shopProfiles||[],v); return {...p,shop:v,exchangeCategory:mp?.exchangeCategory||p.exchangeCategory,sessionBorderOverride:mp?'':p.sessionBorderOverride}; }); }
  function addShopProfile() { const name=String(shopProfileDraft.name||'').trim(); if(!name)return; const np={name,exchangeCategory:shopProfileDraft.exchangeCategory||'25',specialDays:shopProfileDraft.specialDays||'',specialDayList:(shopProfileDraft.specialDayList||[]).filter(d=>d.day),notes:shopProfileDraft.notes||''}; setSettings(p=>{const f=(p.shopProfiles||[]).filter(pr=>String(pr.name||'').trim().toLowerCase()!==name.toLowerCase()); return {...p,shopProfiles:[...f,np]};}); setShopProfileDraft({name:'',exchangeCategory:'25',specialDays:'',specialDayList:[],notes:''}); }
  function saveShopEdit() { const name=String(shopEditDraft.name||'').trim(); if(!name)return; setSettings(p=>{const updated=(p.shopProfiles||[]).map(pr=>pr.name===editingShopName?{...pr,...shopEditDraft,name}:pr); return {...p,shopProfiles:updated};}); setEditingShopName(null); }
  function removeShopProfile(name) { setSettings(p=>({...p,shopProfiles:(p.shopProfiles||[]).filter(pr=>pr.name!==name)})); }
  function openCompleteDialog() {
    const endTime=nowTimeStr();
    const elapsed=calcElapsedHours(form.startTime,endTime);
    applyFormUpdate(p=>({...p, endTime, hours:elapsed!==null?String(Math.round(elapsed*10)/10):p.hours}));
    // キーボードを確実に閉じてからダイアログを開く
    if(document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setTimeout(()=>{ setShowResultRateGraph(false); setShowMoneySwitchGraph(false); setResultDialogOpen(true); }, 50);
  }
  function finalizeSession() {
    setSaveStatus('saving');
    // freeMemo・inheritNotes・自動notesを統合してnotesに保存
    const autoNotes=(form.firstHits||[]).map((hit,i)=>
      `[初当たり${i+1}回目] ${hit.rounds}R / 獲得${Math.round(hit.gainedBalls)}玉 / 1R ${hit.oneRound>0?hit.oneRound.toFixed(1):'-'} / ${hit.chainResultLabel||'単発'}`
    ).join('\n');
    const inheritPart=form.inheritNotes||'';
    const freePart=form.freeMemo||'';
    const goodPart=form.resultGoodMemo?`【良かった点】${form.resultGoodMemo}`:'';
    const badPart=form.resultBadMemo?`【悪かった点】${form.resultBadMemo}`:'';
    const combined=[inheritPart,autoNotes,freePart,goodPart,badPart].filter(Boolean).join('\n');
    const p=buildPersistedSession({...form,returnedBalls:resultReturnedBalls>0?String(resultReturnedBalls):form.returnedBalls,notes:combined,nailGrades:{...nailGrades},hesoDirections:[...hesoDirections]},'completed');
    upsertSession(p); setSelectedDate(p.date); setCurrentMonth(monthKey(p.date)); setCurrentYear(yearKey(p.date));
    // 釘チェックをリセット
    setNailGrades({}); setHesoDirections([]);
    try{localStorage.removeItem('pachi_nail_grades');localStorage.removeItem('pachi_heso_dirs');}catch{}
    skipAutosaveRef.current=true; setUndoStack([]); setForm(emptySession(settings)); setSaveStatus('saved'); setResultDialogOpen(false); setActiveTab('history');
  }
  function updateRateEntry(id,k,v) { applyFormUpdate(p=>({...p,rateEntries:p.rateEntries.map(e=>e.id===id?{...e,[k]:v}:e)})); }
  function setCurrentInputMode(m) {
    const defaultAmount = m==='balls'
      ? (numberOrZero(settings.defaultBallUnit)||250)
      : (numberOrZero(settings.defaultCashUnitYen)||1000);
    applyFormUpdate(p=>{
      // 最後の未確定投資行のkindと金額を切り替える
      const entries = p.rateEntries||[];
      const lastIdx = [...entries].map((e,i)=>({e,i})).reverse()
        .find(({e})=>!numberOrZero(e.reading)&&e.kind!=='restart'&&e.kind!=='jackpot_after')?.i;
      const newEntries = lastIdx!=null
        ? entries.map((e,i)=>i===lastIdx?{...e,kind:m,amount:String(defaultAmount)}:e)
        : entries;
      return {...p, currentInputMode:m, rateEntries:newEntries};
    });
  }
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
    // 最初の入力時にstartTimeを記録
    applyFormUpdate(p=>{
      const updated=checkAndArchiveIfNeeded(p);
      if(!p.startTime&&idx===0) return {...updated, startTime:nowTimeStr()};
      return updated;
    });

    // ── 実際の時速を計算してspinsPerHourを自動更新 ──
    const currentReading=numberOrZero(val);
    const startRot=numberOrZero(form.startRotation);
    const startT=form.startTime;
    if(currentReading>startRot&&startT){
      const elapsedH=calcElapsedHours(startT,nowTimeStr());
      if(elapsedH>=0.05){ // 3分以上経過した場合のみ更新（誤値防止）
        const realSpinsPerHour=Math.round((currentReading-startRot)/elapsedH);
        if(realSpinsPerHour>=100&&realSpinsPerHour<=500){ // 異常値フィルタ
          setSettings(p=>({...p,spinsPerHour:realSpinsPerHour}));
        }
      }
    }

    const ne=Boolean(form.rateEntries[idx+1]);
    if(!ne){
      // 持ち玉残量に応じてモード自動切替
      const curBalls=formMetrics.currentBalls;
      const autoKind=curBalls!==null&&curBalls>0?'balls':(curBalls===0?'cash':form.currentInputMode||'cash');
      const na=autoKind==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000;
      applyFormUpdate(p=>{
        const updated=checkAndArchiveIfNeeded({...p,rateEntries:[...p.rateEntries,emptyRateEntry(autoKind,na,'')],currentInputMode:autoKind});
        if(!p.startTime) return {...updated, startTime:nowTimeStr()};
        return updated;
      });
      setTimeout(()=>readingInputRefs.current[idx+1]?.focus(),0);
      return;
    }
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

  // 10枠目が追加されたときに自動アーカイブ
  function checkAndArchiveIfNeeded(p) {
    // restart・jackpot_after行を除いた実質的な投資行数をカウント
    const validEntries=(p.rateEntries||[]).filter(e=>e.kind!=='restart'&&e.kind!=='jackpot_after');
    if(validEntries.length>=11) {
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
  function createNewSession() {
    skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm(emptySession(settings)); setActiveTab('rate');
    setNailGrades({}); setHesoDirections([]);
    try{localStorage.removeItem('pachi_nail_grades');localStorage.removeItem('pachi_heso_dirs');}catch{}
  }

  // 引き継ぎダイアログを開く（完了済みセッション全件対象）
  const completedSessions=useMemo(()=>enrichedSessions.filter(s=>s.status==='completed').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)),[enrichedSessions]);
  const [inheritSessionIndex,setInheritSessionIndex]=useState(0);

  function openInheritDialog() {
    if(completedSessions.length===0){ alert('引き継ぎ可能な完了済み記録がないぜ。'); return; }
    setInheritSessionIndex(0);
    setInheritConfirmSessionId(completedSessions[0].id);
    setInheritOptions({cashInvest:true,balance:true,balls:true,shop:true});
    setInheritDialogOpen(true);
  }

  function moveInheritSession(dir) {
    const next=Math.max(0,Math.min(completedSessions.length-1,inheritSessionIndex+dir));
    setInheritSessionIndex(next);
    setInheritConfirmSessionId(completedSessions[next].id);
    setInheritOptions({cashInvest:true,balance:true,balls:true,shop:true});
  }

  // 引き継ぎを実行
  function executeInherit() {
    const s=enrichedSessions.find(e=>e.id===inheritConfirmSessionId);
    if(!s){ setInheritDialogOpen(false); return; }
    const base=emptySession(settings);
    const newForm={
      ...base,
      shop: inheritOptions.shop ? (s.shop||base.shop) : base.shop,
      exchangeCategory: inheritOptions.shop ? (s.exchangeCategory||base.exchangeCategory) : base.exchangeCategory,
      // 引き継ぎフィールド
      inheritedCashInvestYen: inheritOptions.cashInvest ? s.metrics.cashInvestYen : 0,
      inheritedBalanceYen:    inheritOptions.balance    ? s.metrics.balanceYen    : 0,
      inheritedBalls:         (inheritOptions.balls && s.metrics.currentBalls>0) ? s.metrics.currentBalls : 0,
    };
    // 持ち玉を引き継ぐ場合：持ち玉モードに切り替え（rateEntriesはリセット、初期投資行は空）
    if(inheritOptions.balls && s.metrics.currentBalls>0){
      newForm.currentInputMode='balls';
      newForm.rateEntries=[emptyRateEntry('balls',numberOrZero(settings.defaultBallUnit)||250,'')];
    }
    // 引き継ぎ内容をinheritNotesに記録（notesとは分離）
    const lines=[];
    if(inheritOptions.shop && s.shop) lines.push(`🏪 引継店舗: ${s.shop}`);
    if(inheritOptions.cashInvest) lines.push(`💴 引継現金投資: ${fmtYen(s.metrics.cashInvestYen)}`);
    if(inheritOptions.balance) lines.push(`💰 引継収支: ${fmtYen(s.metrics.balanceYen)}`);
    if(inheritOptions.balls && s.metrics.currentBalls>0) lines.push(`🎰 引継持ち玉: ${s.metrics.currentBalls.toLocaleString()}玉`);
    newForm.inheritNotes=lines.join('\n');
    newForm.notes='';
    skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved');
    setForm(newForm);
    setInheritDialogOpen(false);
    setActiveTab('rate');
  }
  function saveDraftNow() { setSaveStatus('saving'); const p=buildPersistedSession(form,'draft'); upsertSession(p); skipAutosaveRef.current=true; setForm(p); setSaveStatus('saved'); }

  // 台移動：現在の記録を完了保存して同日同店舗で新規セッション開始
  function executeTableMove() {
    setSaveStatus('saving');
    const p=buildPersistedSession(form,'completed');
    upsertSession(p);
    skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved');
    const inheritBalls=formMetrics.currentBalls||0;
    const newForm={
      ...emptySession(settings),
      date:form.date,
      shop:form.shop,
      exchangeCategory:form.exchangeCategory,
      currentInputMode: inheritBalls>0?'balls':'cash',
      inheritedBalls: inheritBalls,
      inheritedBalanceYen: inheritBalls>0 ? inheritBalls*formMetrics.exchangeRate : 0,
    };
    setForm(newForm);
    setTableMoveConfirmOpen(false);
    setActiveTab('rate');
    // 台移動時に振り分けカウンターと連続ボーダーアラートをリセット
    setCounters(DEFAULT_COUNTERS);
    setBelowBorderAlertOpen(false);
    belowBorderAlertSpinsRef.current=0;
  }
  function continueSession(s) { skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm({...emptySession(settings),...s}); setActiveTab('rate'); }

  function continueSessionWithInherit(s, inherit) {
    skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved');
    if(inherit && s.metrics.currentBalls!==null && s.metrics.currentBalls>0) {
      // 持ち玉を引き継いで新枠開始
      const newSession={
        ...emptySession(settings),
        ...s,
        currentInputMode:'balls',
        rateEntries:[{ id:uid(), kind:'balls', amount:String(s.metrics.currentBalls), reading:'' }],
        // 前回の現金投資をメモに記録
        notes: s.notes ? s.notes + '\n【引継ぎ】前回現金投資 '+fmtYen(s.metrics.cashInvestYen)+' / 引継ぎ持ち玉 '+s.metrics.currentBalls+'玉' : '【引継ぎ】前回現金投資 '+fmtYen(s.metrics.cashInvestYen)+' / 引継ぎ持ち玉 '+s.metrics.currentBalls+'玉',
      };
      setForm(newSession);
    } else {
      setForm({...emptySession(settings),...s});
    }
    setInheritConfirmSessionId(null);
    setActiveTab('rate');
  }
  function completeSessionById(s) {
    const p=buildPersistedSession({...s},'completed');
    upsertSession(p);
    setSelectedDate(p.date);
    setCurrentMonth(monthKey(p.date));
    setCurrentYear(yearKey(p.date));
  }
  function duplicateSession(s) { skipAutosaveRef.current=true; setUndoStack([]); setSaveStatus('saved'); setForm({...emptySession(settings),...s,id:uid(),date:todayStr(),status:'draft',updatedAt:Date.now(),firstHits:[],rateSections:[],photos:[],rateEntries:[emptyRateEntry(s.currentInputMode||'cash',(s.currentInputMode||'cash')==='balls'?numberOrZero(settings.defaultBallUnit)||250:numberOrZero(settings.defaultCashUnitYen)||1000,'')]}); setActiveTab('rate'); }
  function deleteSession(id) { setSessions(p=>p.filter(x=>x.id!==id)); }
  async function addPhotos(files) { const list=Array.from(files||[]).slice(0,6); const images=[]; for(const f of list){const d=await readFileAsDataUrl(f); images.push({id:uid(),name:f.name,dataUrl:d,createdAt:Date.now()});} applyFormUpdate(p=>({...p,photos:[...(p.photos||[]),...images].slice(0,12)})); }
  function saveMachine() { if(!machineDraft.name.trim())return; const newM={id:uid(),name:machineDraft.name.trim(),shopDefault:'',border25:numberOrZero(machineDraft.border25),border28:numberOrZero(machineDraft.border28),border30:numberOrZero(machineDraft.border30),border33:numberOrZero(machineDraft.border33),border40:0,payoutPerRound:numberOrZero(machineDraft.payoutPerRound),expectedBallsPerHit:numberOrZero(machineDraft.expectedBallsPerHit),totalProbability:numberOrZero(machineDraft.totalProbability),kanaReading:machineDraft.kanaReading||'',memo:''}; setMachines(prev=>[newM,...prev]); setMachineDraft({name:'',border25:'',border28:'',border30:'',border33:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',kanaReading:''}); setAddMachineDialogOpen(false); }
  function openEditMachine(m) {
    setEditMachineId(m.id);
    setMachineDraft({name:m.name,border25:String(m.border25||''),border28:String(m.border28||''),border30:String(m.border30||''),border33:String(m.border33||''),payoutPerRound:String(m.payoutPerRound||''),expectedBallsPerHit:String(m.expectedBallsPerHit||''),totalProbability:String(m.totalProbability||''),kanaReading:m.kanaReading||''});
    setEditMachineDialogOpen(true);
  }
  function saveEditMachine() {
    if(!machineDraft.name.trim()||!editMachineId) return;
    setMachines(prev=>prev.map(m=>m.id===editMachineId?{...m,name:machineDraft.name.trim(),border25:numberOrZero(machineDraft.border25),border28:numberOrZero(machineDraft.border28),border30:numberOrZero(machineDraft.border30),border33:numberOrZero(machineDraft.border33),payoutPerRound:numberOrZero(machineDraft.payoutPerRound),expectedBallsPerHit:numberOrZero(machineDraft.expectedBallsPerHit),totalProbability:numberOrZero(machineDraft.totalProbability),kanaReading:machineDraft.kanaReading||''}:m));
    setEditMachineDialogOpen(false);
    setEditMachineId(null);
    setMachineDraft({name:'',border25:'',border28:'',border30:'',border33:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',kanaReading:''});
  }
  function deleteMachine(id) {
    setMachines(prev=>prev.filter(m=>m.id!==id));
    if(form.machineId===id) applyFormUpdate(p=>({...p,machineId:'__none__',sessionBorderOverride:''}));
    setDeleteConfirmOpen(false);
    setEditMachineDialogOpen(false);
    setEditMachineId(null);
  }
  function openFirstHitDialog() { const nc=(form.firstHits||[]).length+1; firstHitDialogOpenTimeRef.current=Date.now(); setFirstHitForm({label:`初当たり${nc}回目`,rounds:'0',startBalls:'0',upperBalls:'0',endBalls:'',hitSpins:'',cashInvestInput:'',restartRotation:'0',restartReason:'single',restartReasonNote:'',chainCount:'0',remainingHolds:''}); setFirstHitStep(1); setFirstHitDialogOpen(true); }
  function undoLastFirstHit() { const hits=form.firstHits||[]; if(!hits.length)return; const last=hits[hits.length-1]; applyFormUpdate(p=>{ const newNotes=last?.memoLine?p.notes.split('\n').filter(line=>line!==last.memoLine).join('\n'):p.notes; return {...p,firstHits:p.firstHits.slice(0,-1),notes:newNotes}; }); }
  function applyFirstHitOneRoundToMachine() { if(!selectedMachine)return; setMachines(p=>p.map(m=>m.id===selectedMachine.id?{...m,payoutPerRound:Number(firstHitMetrics.oneRound.toFixed(1))}:m)); }
  function completeFirstHit(restartAfter=false) {
    const label=firstHitForm.label||`初当たり${(form.firstHits||[]).length+1}回目`;
    const crl=getChainResultLabel(firstHitForm.chainCount);
    const rh=numberOrZero(firstHitForm.remainingHolds);
    const rhStr=rh>0?(' / 残り保留'+rh+'個'):'';
    const ml='['+label+'] '+firstHitMetrics.rounds+'R / 獲得'+Math.round(firstHitMetrics.gainedBalls)+'玉 / 1R '+Number(firstHitMetrics.oneRound.toFixed(1))+' / '+crl+rhStr;
    // 連チャン時間（ダイアログを開いてから完了するまでの秒数）
    const chainTimeSec=firstHitDialogOpenTimeRef.current>0
      ? Math.round((Date.now()-firstHitDialogOpenTimeRef.current)/1000)
      : 0;
    const hit={id:uid(),label,rounds:firstHitMetrics.rounds,startBalls:numberOrZero(firstHitForm.startBalls),upperBalls:numberOrZero(firstHitForm.upperBalls),endBalls:numberOrZero(firstHitForm.endBalls),gainedBalls:firstHitMetrics.gainedBalls,oneRound:Number(firstHitMetrics.oneRound.toFixed(1)),chainCount:numberOrZero(firstHitForm.chainCount),chainResultLabel:crl,remainingHolds:rh,memoLine:ml,hitSpins:numberOrZero(firstHitForm.hitSpins),chainTimeSec};

    // 差玉投資行の自動生成
    const hitSpins=numberOrZero(firstHitForm.hitSpins);
    const startBalls=numberOrZero(firstHitForm.startBalls);
    const upperBalls=numberOrZero(firstHitForm.upperBalls);
    const effectiveStartBalls=startBalls+upperBalls; // 開始持ち玉+上皿玉数
    const effectiveHitSpins=hitSpins+(rh||0); // 初当たりゲーム数+残り保留数
    const currentBallsNow=formMetrics.currentBalls;
    const lastReadingNow=(form.rateEntries||[]).reduce((last,e)=>{
      const r=numberOrZero(e.reading); return (r>0&&r>last)?r:last;
    }, numberOrZero(form.startRotation));
    const spinsUsed=lastReadingNow>0?Math.max(0,effectiveHitSpins-lastReadingNow):effectiveHitSpins;
    const diffBalls=(currentBallsNow!==null&&hitSpins>0&&effectiveStartBalls<currentBallsNow)
      ? (currentBallsNow - effectiveStartBalls)
      : 0;

    // 現金モード：未確定の最新投資行の金額をcashInvestInputで上書き
    const cashInvestInput=numberOrZero(firstHitForm.cashInvestInput);
    // 開始持ち玉+上皿玉を差し引いた純投資額
    const netCashInvest=form.currentInputMode==='cash'&&cashInvestInput>0
      ? Math.max(0, cashInvestInput - effectiveStartBalls*4)
      : 0;

    applyFormUpdate(prev=>{
      let nb={
        ...prev,
        firstHits:[...(prev.firstHits||[]),hit],
        notes:appendLine(prev.notes,ml),
        inheritedCashInvestYen:numberOrZero(prev.inheritedCashInvestYen),
      };

      // 現金モード：cashInvestInputが入力されていたら未確定の最新投資行を純投資額で上書き
      if(form.currentInputMode==='cash'&&netCashInvest>0){
        const entries=nb.rateEntries||[];
        const lastEmptyIdx=[...entries].reverse().findIndex(e=>e.kind==='cash'&&!numberOrZero(e.reading));
        if(lastEmptyIdx>=0){
          const realIdx=entries.length-1-lastEmptyIdx;
          const newEntries=entries.map((e,i)=>i===realIdx?{...e,amount:String(netCashInvest)}:e);
          nb={...nb,rateEntries:newEntries};
        }
      }

      // 差玉がある場合：差玉分の持ち玉投資行を挿入（hitSpinsあり）
      if(diffBalls>0&&hitSpins>0){
        const diffEntry={id:uid(),kind:'balls',amount:String(diffBalls),reading:String(hitSpins)};
        const entries=nb.rateEntries||[];
        const lastEmpty=entries.findIndex(e=>!numberOrZero(e.reading));
        const insertAt=lastEmpty>=0?lastEmpty:entries.length;
        const newEntries=[...entries.slice(0,insertAt),diffEntry,...entries.slice(insertAt)];
        nb={...nb,rateEntries:newEntries};
      } else if(diffBalls>0&&hitSpins<=0){
        // hitSpinsなしでも差玉がある場合→reading空のまま差玉行を追加（後で手動入力可）
        const diffEntry={id:uid(),kind:'balls',amount:String(diffBalls),reading:''};
        const entries=nb.rateEntries||[];
        const lastEmpty=entries.findIndex(e=>!numberOrZero(e.reading));
        const insertAt=lastEmpty>=0?lastEmpty:entries.length;
        const newEntries=[...entries.slice(0,insertAt),diffEntry,...entries.slice(insertAt)];
        nb={...nb,rateEntries:newEntries};
      } else if(hitSpins>0&&hitSpins>lastReadingNow){
        // 差玉なし（現金モード等）でもhitSpinsを最新の未入力reading欄に自動セット
        const entries=nb.rateEntries||[];
        const lastEmptyIdx=entries.findIndex(e=>!numberOrZero(e.reading));
        if(lastEmptyIdx>=0){
          const newEntries=entries.map((e,i)=>i===lastEmptyIdx?{...e,reading:String(hitSpins)}:e);
          nb={...nb,rateEntries:newEntries};
        } else {
          const newEntry={id:uid(),kind:nb.currentInputMode||'cash',amount:'0',reading:String(hitSpins)};
          nb={...nb,rateEntries:[...entries,newEntry]};
        }
      }

      if(!restartAfter)return nb;
      const m=nb.machineId&&nb.machineId!=='__none__'?machines.find(m=>m.id===nb.machineId)||null:null;
      const met=calcRateMetrics(nb,m,settings);
      const rsr=numberOrZero(firstHitForm.restartRotation);
      const rrl=getRestartReasonLabel(firstHitForm.restartReason,firstHitForm.restartReasonNote);
      const sl=`通常${(nb.rateSections||[]).length+1}区間`;
      const rl='['+sl+'] '+met.currentSpins+'回転 / '+Math.round(met.currentInvestYen).toLocaleString()+'円 / '+Number(met.currentSpinPerThousand.toFixed(2))+' で区切って再スタート ('+rsr+'回転から / '+rrl+')';

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

      // ② 大当たり終了後の行
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
    // 1R出玉を機種へ自動反映（機種選択済みかつ1R出玉が算出されている場合）
    if(selectedMachine&&firstHitMetrics.oneRound>0){
      applyFirstHitOneRoundToMachine();
    }
  }
  function removeFirstHit(hid) { applyFormUpdate(p=>{ const hit=(p.firstHits||[]).find(h=>h.id===hid); const newNotes=hit?.memoLine?p.notes.split('\n').filter(l=>l!==hit.memoLine).join('\n'):p.notes; return {...p,firstHits:(p.firstHits||[]).filter(h=>h.id!==hid),notes:newNotes}; }); }

  function openHitEdit(hit) {
    setHitEditForm({
      restartRotation: String(hit.restartRotation||'0'),
      restartReason:   hit.restartReason||'single',
      restartReasonNote: hit.restartReasonNote||'',
      rounds:          String(hit.rounds||'0'),
      hitSpins:        String(hit.hitSpins||''),
      remainingHolds:  String(hit.remainingHolds||''),
      chainCount:      String(hit.chainCount||'0'),
      notes:           hit.notes||'',
    });
    setEditingHitId(hit.id);
  }

  function saveHitEdit() {
    applyFormUpdate(p=>({
      ...p,
      firstHits:(p.firstHits||[]).map(h=>{
        if(h.id!==editingHitId) return h;
        return {
          ...h,
          restartRotation: numberOrZero(hitEditForm.restartRotation),
          restartReason:   hitEditForm.restartReason,
          restartReasonNote: hitEditForm.restartReasonNote,
          rounds:          numberOrZero(hitEditForm.rounds),
          hitSpins:        numberOrZero(hitEditForm.hitSpins),
          remainingHolds:  numberOrZero(hitEditForm.remainingHolds),
          chainCount:      numberOrZero(hitEditForm.chainCount),
          notes:           hitEditForm.notes,
        };
      }),
    }));
    setEditingHitId(null);
  }
  function exportData() { const blob=new Blob([JSON.stringify({machines,sessions,settings},null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`pachinko-complete-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url); }
  function importData(file) { const r=new FileReader(); r.onload=()=>{ try { const d=JSON.parse(String(r.result||'{}')); if(Array.isArray(d.machines))setMachines(d.machines); if(Array.isArray(d.sessions))setSessions(d.sessions); if(d.settings)setSettings({...defaultSettings,...d.settings}); } catch { alert('JSONの読み込みに失敗したぜ'); } }; r.readAsText(file); }
  function moveMonth(delta) { const d=new Date(`${currentMonth}-01T00:00:00`); d.setMonth(d.getMonth()+delta); setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`); }
  function moveYear(delta) { setCurrentYear(String(Number(currentYear)+delta)); }

  /* ─── スタイル定数 ─── */
  const cardStyle={ background:C.card, border:`1px solid ${C.border}`, borderRadius:24, overflow:'hidden', boxShadow:'0 2px 8px rgba(0,0,0,0.07)' };
  const inputStyle={ background:C.card, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'13px 16px', fontSize:16, color:C.textPrimary, width:'100%', boxSizing:'border-box', outline:'none' };
  const labelStyle={ fontSize:13, fontWeight:600, color:C.textSecondary, display:'block', marginBottom:6 };
  const btnPrimary={ background:C.primary, color:'white', border:'none', borderRadius:14, padding:'14px 20px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };
  const btnSecondary={ background:C.primaryLight, color:C.primary, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'14px 20px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };
  const btnOutline={ background:C.card, color:C.textSecondary, border:`1.5px solid ${C.border}`, borderRadius:14, padding:'14px 20px', fontWeight:600, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', gap:6, justifyContent:'center' };

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
    {id:'rate',    label:'📊 回転率'},
    {id:'judge',   label:'🎯 ボーダー'},
    {id:'nail',    label:'🔨 釘メモ'},
    {id:'calendar',label:'📅 日別'},
    {id:'analysis',label:'📈 まとめ'},
    {id:'history', label:'📝 履歴'},
    {id:'counter', label:'🎯 振り分け'},
    {id:'settings',label:'⚙️ 設定'},
  ];

  return (
    <div style={{ minHeight:'100vh', background:C.bg, fontFamily:'system-ui,-apple-system,sans-serif', color:C.textPrimary, position:'relative' }}>
      {/* 背景画像オーバーレイ */}
      {bgImage&&(
        <div style={{
          position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
          backgroundImage:`url(${bgImage})`,
          backgroundSize:'cover', backgroundPosition:'center', backgroundRepeat:'no-repeat',
          opacity:bgOpacity,
        }}/>
      )}
      <div style={{ maxWidth:520, margin:'0 auto', padding:'10px 8px 130px', position:'relative', zIndex:1 }}>

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

        {/* ─── 特日お知らせバナー ─── */}
        {(()=>{
          const today=todayStr();
          const todayDate=new Date(today+'T00:00:00');
          const todayDay=todayDate.getDate(); // 今日の日付（1〜31）
          // 全店舗の特日テキストを解析して今日が該当するか判定
          const matched=(settings.shopProfiles||[]).filter(p=>{
            const todayDay=todayDate.getDate();
            // specialDayList（カレンダー形式）から判定
            if((p.specialDayList||[]).some(d=>Number(d.day)===todayDay)) return true;
            if(!p.specialDays) return false;
            const text=p.specialDays;
            const nums=[];
            const matchSuffix=text.match(/(\d+)のつく日/g);
            if(matchSuffix) matchSuffix.forEach(m=>{const n=Number(m.match(/\d+/)[0]); if(n>=0&&n<=9&&todayDay%10===n) nums.push(n);});
            const matchDay=text.match(/(\d+)日/g);
            if(matchDay) matchDay.forEach(m=>{const n=Number(m.match(/\d+/)[0]); if(n===todayDay) nums.push(n);});
            const matchNum=text.match(/\b(\d{1,2})\b/g);
            if(matchNum) matchNum.forEach(m=>{
              const n=Number(m);
              if(n>=1&&n<=31&&(n===todayDay||(n<=9&&todayDay%10===n&&todayDay!==n))) nums.push(n);
            });
            return nums.length>0;
          });
          if(matched.length===0) return null;
          return (
            <div style={{ marginBottom:12, display:'flex', flexDirection:'column', gap:8 }}>
              {matched.map(p=>(
                <div key={p.name} style={{ background:'linear-gradient(135deg,#fef3c7,#fde68a)', border:`1.5px solid #f59e0b`, borderRadius:16, padding:'12px 16px', display:'flex', alignItems:'flex-start', gap:12 }}>
                  <div style={{ fontSize:24, flexShrink:0 }}>📅</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:14, color:'#92400e' }}>本日は特日・イベント日かもしれないぜ！</div>
                    <div style={{ fontWeight:700, fontSize:15, color:'#78350f', marginTop:2 }}>{p.name}</div>
                    {(p.specialDayList||[]).filter(d=>Number(d.day)===todayDate.getDate()).map((d,i)=>(
                      <div key={i} style={{ fontSize:13, color:'#92400e', marginTop:3, fontWeight:700 }}>
                        📅 {d.day}日{d.label?` — ${d.label}`:''}
                      </div>
                    ))}
                    {p.specialDays&&<div style={{ fontSize:12, color:'#92400e', marginTop:2 }}>📅 {p.specialDays}</div>}
                    {p.notes&&<div style={{ fontSize:12, color:'#a16207', marginTop:3 }}>📝 {p.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ─── ホームサマリーウィジェット ─── */}
        {(()=>{
          const today=todayStr();
          const todaySessions=enrichedSessions.filter(s=>s.date===today&&s.status==='completed');
          const todayBalance=todaySessions.reduce((a,s)=>a+s.metrics.balanceYen,0);
          const todayEV=todaySessions.reduce((a,s)=>a+s.metrics.estimatedEVYen,0);
          const lastSession=[...enrichedSessions].filter(s=>s.status==='completed').sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0))[0];
          const daysSinceLast=lastSession?Math.floor((Date.now()-new Date(lastSession.date+'T00:00:00').getTime())/(1000*60*60*24)):null;
          const monthSessions=enrichedSessions.filter(s=>monthKey(s.date)===monthKey(today));
          const monthEV=monthSessions.reduce((a,s)=>a+s.metrics.estimatedEVYen,0);
          if(todaySessions.length===0&&!lastSession) return null;
          return (
            <details open={showHomeWidget} onToggle={e=>setShowHomeWidget(e.currentTarget.open)}
              style={{ marginBottom:12, background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
              <summary style={{ cursor:'pointer', listStyle:'none', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.textPrimary }}>🏠 今日のサマリー</div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  {todaySessions.length>0&&<span style={{ fontSize:13, fontWeight:700, color:todayBalance>=0?C.positive:C.negative }}>{fmtYen(todayBalance)}</span>}
                  <ChevronDown size={14} color={C.textMuted} style={{ transform:showHomeWidget?'rotate(180deg)':'none', transition:'0.2s' }}/>
                </div>
              </summary>
              <div style={{ padding:'10px 14px', borderTop:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                <div style={{ textAlign:'center', background:todayBalance>=0?C.positiveBg:C.negativeBg, borderRadius:12, padding:'8px 6px' }}>
                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>今日の収支</div>
                  <div style={{ fontSize:16, fontWeight:800, color:todayBalance>=0?C.positive:C.negative, marginTop:2 }}>{todaySessions.length>0?fmtYen(todayBalance):'未記録'}</div>
                </div>
                <div style={{ textAlign:'center', background:C.accentLight, borderRadius:12, padding:'8px 6px' }}>
                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>今月期待値</div>
                  <div style={{ fontSize:16, fontWeight:800, color:monthEV>=0?C.positive:C.negative, marginTop:2 }}>{fmtYen(Math.round(monthEV))}</div>
                </div>
                <div style={{ textAlign:'center', background:C.primaryLight, borderRadius:12, padding:'8px 6px' }}>
                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>前回から</div>
                  <div style={{ fontSize:16, fontWeight:800, color:C.primary, marginTop:2 }}>{daysSinceLast!==null?`${daysSinceLast}日前`:'初回'}</div>
                </div>
              </div>
            </details>
          );
        })()}

        {/* ─── タブ ─── */}
        <div style={{ marginBottom:16 }}>
          {/* 上段：よく使う4タブ */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:5 }}>
            {TABS.slice(0,4).map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                style={{ padding:'10px 4px', borderRadius:14, border:`1.5px solid ${activeTab===t.id?C.primary:C.border}`, background:activeTab===t.id?C.primary:C.card, color:activeTab===t.id?'white':C.textSecondary, fontWeight:activeTab===t.id?700:500, fontSize:12, cursor:'pointer', transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                <span style={{ fontSize:16 }}>{t.label.match(/^\p{Emoji}/u)?.[0]||''}</span>
                <span style={{ fontSize:11 }}>{t.label.replace(/^\p{Emoji}\s*/u,'')}</span>
              </button>
            ))}
          </div>
          {/* 下段：残り4タブ */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
            {TABS.slice(4).map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                style={{ padding:'8px 4px', borderRadius:12, border:`1.5px solid ${activeTab===t.id?C.primary:C.border}`, background:activeTab===t.id?C.primary:isDark?'rgba(255,255,255,0.03)':'#f8fafc', color:activeTab===t.id?'white':C.textSecondary, fontWeight:activeTab===t.id?700:400, fontSize:11, cursor:'pointer', transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
                <span>{t.label.match(/^\p{Emoji}/u)?.[0]||''}</span>
                <span>{t.label.replace(/^\p{Emoji}\s*/u,'')}</span>
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
                    <button onClick={openInheritDialog} style={{ background:'rgba(255,255,255,0.2)', border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:12, padding:'8px 14px', fontSize:13, fontWeight:700, color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                      🔗 引き継ぎ
                    </button>
                    <button onClick={()=>setResetConfirmOpen(true)} style={{ background:'rgba(239,68,68,0.25)', border:'1.5px solid rgba(239,68,68,0.5)', borderRadius:12, padding:'8px 14px', fontSize:13, fontWeight:700, color:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                      🔄 リセット
                    </button>
                  </div>
                </div>
              </div>

              {/* 引き継ぎダイアログ */}
              {inheritDialogOpen&&(()=>{
                const s=enrichedSessions.find(e=>e.id===inheritConfirmSessionId);
                if(!s) return null;
                const hasBalls=s.metrics.currentBalls!==null&&s.metrics.currentBalls>0;
                const total=completedSessions.length;
                const idx=inheritSessionIndex;
                return (
                  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
                    <div style={{ background:C.card, borderRadius:24, padding:'20px', width:'100%', maxWidth:400, maxHeight:'90vh', overflow:'auto' }}>
                      <div style={{ fontWeight:800, fontSize:16, color:C.textPrimary, marginBottom:4 }}>🔗 引き継ぎ</div>
                      <div style={{ fontSize:12, color:C.textMuted, marginBottom:12 }}>引き継ぐ記録を選んでチェックを入れてください</div>

                      {/* スライドナビ */}
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <button onClick={()=>moveInheritSession(-1)} disabled={idx===0}
                          style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.border}`, background:idx===0?(isDark?'#1e293b':'#f1f5f9'):C.card, cursor:idx===0?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <ChevronLeft size={16} color={idx===0?C.textMuted:C.primary}/>
                        </button>
                        <div style={{ flex:1, background:isDark?'rgba(255,255,255,0.05)':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                            <div style={{ fontWeight:700, color:C.textPrimary, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:8 }}>
                              {s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定'}
                            </div>
                            <span style={{ fontSize:11, color:C.textMuted, flexShrink:0 }}>{idx+1}/{total}</span>
                          </div>
                          <div style={{ fontSize:11, color:C.textMuted, marginBottom:6 }}>{s.date} / {s.shop||'店舗未入力'}</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12 }}>
                            <div>現金投資: <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(s.metrics.cashInvestYen)}</span></div>
                            <div>収支: <span style={{ fontWeight:700, color:s.metrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(s.metrics.balanceYen)}</span></div>
                            {hasBalls&&<div style={{ gridColumn:'1/-1' }}>持ち玉: <span style={{ fontWeight:700, color:C.amber }}>{s.metrics.currentBalls.toLocaleString()}玉</span></div>}
                          </div>
                        </div>
                        <button onClick={()=>moveInheritSession(1)} disabled={idx===total-1}
                          style={{ width:36, height:36, borderRadius:10, border:`1px solid ${C.border}`, background:idx===total-1?(isDark?'#1e293b':'#f1f5f9'):C.card, cursor:idx===total-1?'default':'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <ChevronRight size={16} color={idx===total-1?C.textMuted:C.primary}/>
                        </button>
                      </div>

                      {/* ドットインジケーター */}
                      {total>1&&(
                        <div style={{ display:'flex', justifyContent:'center', gap:5, marginBottom:14 }}>
                          {Array.from({length:Math.min(total,7)}).map((_,i)=>{
                            const dotIdx=total<=7?i:Math.round(i*(total-1)/6);
                            const isActive=total<=7?i===idx:Math.abs(dotIdx-idx)<=Math.round((total-1)/12);
                            return <div key={i} style={{ width:isActive?16:6, height:6, borderRadius:3, background:isActive?C.primary:C.border, transition:'all 0.2s' }}/>;
                          })}
                        </div>
                      )}

                      {/* チェックボックス */}
                      <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
                        {[
                          ['shop','🏪 店舗名・換金率を引き継ぐ',true],
                          ['cashInvest','💴 現金投資をメモに記録',true],
                          ['balance','💰 収支をメモに記録',true],
                          ['balls', hasBalls?`🎰 持ち玉（${s.metrics.currentBalls?.toLocaleString()}玉）を引き継ぐ`:'🎰 持ち玉（なし）', hasBalls],
                        ].map(([key,label,enabled])=>(
                          <label key={key} style={{ display:'flex', alignItems:'center', gap:10, cursor:enabled?'pointer':'default', opacity:enabled?1:0.4 }}>
                            <input type="checkbox" checked={inheritOptions[key]&&enabled} disabled={!enabled}
                              onChange={e=>setInheritOptions(p=>({...p,[key]:e.target.checked}))}
                              style={{ width:18, height:18, cursor:enabled?'pointer':'default' }}/>
                            <span style={{ fontSize:13, color:C.textPrimary, fontWeight:500 }}>{label}</span>
                          </label>
                        ))}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <button onClick={()=>setInheritDialogOpen(false)}
                          style={{ padding:'12px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                          キャンセル
                        </button>
                        <button onClick={executeInherit}
                          style={{ padding:'12px', borderRadius:14, border:'none', background:C.primary, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                          🔗 引き継いで新規
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* リセット確認ダイアログ */}
              {resetConfirmOpen&&(
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
                  <div style={{ background:C.card, borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:360 }}>
                    <div style={{ textAlign:'center', marginBottom:16 }}>
                      <div style={{ fontSize:36, marginBottom:8 }}>🔄</div>
                      <div style={{ fontWeight:800, fontSize:17, color:C.textPrimary, marginBottom:6 }}>回転率をリセット</div>
                      <div style={{ fontSize:13, color:C.textMuted, lineHeight:'1.6' }}>
                        現在の回転率計算の内容を<br/>
                        <b style={{ color:C.negative }}>全て削除</b>して新しく始めます。<br/>
                        この操作は取り消せません。
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <button onClick={()=>setResetConfirmOpen(false)}
                        style={{ padding:'13px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                        キャンセル
                      </button>
                      <button onClick={()=>{ createNewSession(); setResetConfirmOpen(false); }}
                        style={{ padding:'13px', borderRadius:14, border:'none', background:'#ef4444', color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                        リセットする
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:16 }}>
                {/* 台データ設定アコーディオン */}
                <div style={{ border:`2px solid ${machinePanelOpen?'#f0abfc':'#e9d5ff'}`, borderRadius:20, overflow:'hidden', boxShadow:machinePanelOpen?'0 4px 20px rgba(217,70,219,0.15)':'0 2px 8px rgba(0,0,0,0.04)', transition:'box-shadow 0.2s' }}>
                  <button onClick={()=>setMachinePanelOpen(p=>!p)} style={{ width:'100%', background:isDark?'rgba(217,70,219,0.15)':'linear-gradient(135deg,#fdf4ff,#fae8ff)', border:'none', padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:22 }}>🎰</div>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontWeight:800, color:'#a21caf', fontSize:14 }}>台データ設定</div>
                        <div style={{ fontSize:11, color:isDark?'#e879f9':'#c026d3', marginTop:2 }}>
                          {machinePanelOpen ? '▼ 店舗・機種・台番号・ボーダー設定' : (form.shop||form.machineNameSnapshot||form.machineFreeName ? `📍 ${form.shop||'店舗未入力'} / ${form.machine?.name||form.machineFreeName||form.machineNameSnapshot||'機種未選択'}` : '店舗・機種・台番号・ボーダー設定')}
                        </div>
                      </div>
                    </div>
                    <div style={{ background:isDark?'rgba(217,70,219,0.2)':'#f5d0fe', borderRadius:10, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#a21caf' }}>{machinePanelOpen?'閉じる':'開く'}</span>
                      <ChevronDown size={14} color="#a21caf" style={{ transform:machinePanelOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                    </div>
                  </button>
                  {machinePanelOpen&&(
                    <div style={{ background:isDark?'rgba(217,70,219,0.05)':'#fdf4ff', borderTop:'1.5px dashed #f0abfc', padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        <div><label style={labelStyle}>日付</label><input type="date" value={form.date} onChange={e=>updateForm('date',e.target.value)} style={inputStyle}/></div>
                        <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
                          <div style={{ flex:1, position:'relative' }}>
                            <label style={labelStyle}>店舗名</label>
                            <input
                              value={form.shop}
                              onChange={e=>{ applyShopValue(e.target.value); setShopSuggestOpen(true); }}
                              onFocus={()=>setShopSuggestOpen(true)}
                              onBlur={()=>setTimeout(()=>setShopSuggestOpen(false),150)}
                              style={inputStyle}
                              placeholder="店舗名を入力…"
                            />
                            {shopSuggestOpen&&form.shop.trim()&&(()=>{
                              const hits=recentShopPresets.filter(n=>fuzzyMatch(n,form.shop)).slice(0,8);
                              return hits.length>0?(
                                <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:50, border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', background:C.card, boxShadow:'0 4px 16px rgba(0,0,0,0.12)', marginTop:4 }}>
                                  {hits.map((n,i)=>(
                                    <button key={n} onMouseDown={()=>{applyShopValue(n);setShopSuggestOpen(false);}}
                                      style={{ width:'100%', display:'block', padding:'10px 14px', border:'none', borderBottom:i<hits.length-1?`1px solid ${C.border}`:'none', background:C.card, cursor:'pointer', textAlign:'left', fontSize:13, color:C.textPrimary, fontWeight: n===form.shop?700:400 }}>
                                      {n}
                                    </button>
                                  ))}
                                </div>
                              ):null;
                            })()}
                          </div>
                          <button onClick={()=>setShopListDialogOpen(true)}
                            style={{ padding:'13px 12px', borderRadius:14, border:`1.5px solid ${C.border}`, background:C.card, color:C.primary, fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                            📋 一覧
                          </button>
                        </div>

                        {/* 店舗一覧ダイアログ */}
                        {shopListDialogOpen&&(
                          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={()=>setShopListDialogOpen(false)}>
                            <div style={{ background:C.card, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, maxHeight:'70vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
                              <div style={{ padding:'14px 18px 10px', borderBottom:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                                  <div style={{ fontWeight:800, fontSize:15, color:C.textPrimary }}>🏪 店舗を選ぶ</div>
                                  <button onClick={()=>setShopListDialogOpen(false)} style={{ background:'none', border:'none', fontSize:20, color:C.textMuted, cursor:'pointer' }}>✕</button>
                                </div>
                                <div style={{ display:'flex', gap:8 }}>
                                  {[['all','全て'],['fav','⭐ お気に入り']].map(([tab,label])=>(
                                    <button key={tab} onClick={()=>setShopListTab(tab)}
                                      style={{ padding:'6px 14px', borderRadius:10, border:`1.5px solid ${shopListTab===tab?C.primary:C.border}`, background:shopListTab===tab?C.primary:'transparent', color:shopListTab===tab?'white':C.textSecondary, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                                      {label}
                                    </button>
                                  ))}
                                  <span style={{ fontSize:11, color:C.textMuted, alignSelf:'center', marginLeft:'auto' }}>
                                    {shopListTab==='fav'?`${favoriteShopNames.length}件`:`全${recentShopPresets.length}件`}
                                  </span>
                                </div>
                              </div>
                              <div style={{ overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'8px 14px', flex:1 }}>
                                {(shopListTab==='fav'?recentShopPresets.filter(n=>favoriteShopNames.includes(n)):recentShopPresets).map(n=>{
                                  const profile=(settings.shopProfiles||[]).find(p=>p.name===n);
                                  return (
                                  <div key={n} style={{ display:'flex', alignItems:'center', borderBottom:`1px solid ${C.border}`, marginBottom:2 }}>
                                    <button onClick={e=>{e.stopPropagation();toggleFavoriteShop(n);}}
                                      style={{ background:'none', border:'none', fontSize:20, padding:'0 8px 0 0', cursor:'pointer', flexShrink:0, opacity:favoriteShopNames.includes(n)?1:0.3 }}>
                                      ⭐
                                    </button>
                                    <button onClick={()=>{applyShopValue(n);setShopListDialogOpen(false);}}
                                      style={{ flex:1, display:'flex', flexDirection:'column', justifyContent:'center', padding:'11px 8px 11px 0', border:'none', background:form.shop===n?C.primaryLight:C.card, cursor:'pointer', textAlign:'left', borderRadius:12 }}>
                                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                        <span style={{ fontSize:14, fontWeight:form.shop===n?700:400, color:form.shop===n?C.primary:C.textPrimary }}>{n}</span>
                                        {form.shop===n&&<span style={{ fontSize:12, color:C.primary }}>✓ 選択中</span>}
                                      </div>
                                      {profile?.specialDays&&<div style={{ fontSize:11, color:C.primary, marginTop:3 }}>📅 {profile.specialDays}</div>}
                                      {profile?.notes&&<div style={{ fontSize:11, color:C.textMuted, marginTop:2, lineHeight:1.4 }}>📝 {profile.notes}</div>}
                                    </button>
                                  </div>
                                  );
                                })}
                                {shopListTab==='fav'&&favoriteShopNames.length===0&&(
                                  <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:13 }}>⭐ をタップしてお気に入り登録するぜ</div>
                                )}
                                {shopListTab==='all'&&recentShopPresets.length===0&&(
                                  <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:13 }}>まだ店舗が登録されていないぜ</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {/* 店舗メモ */}
                        <div>
                          <label style={labelStyle}>店舗メモ（任意）</label>
                          <input value={form.shopMemo||''} onChange={e=>updateForm('shopMemo',e.target.value)} style={{ ...inputStyle, fontSize:13 }} placeholder="釘調整メモなど…"/>
                        </div>
                      </div>

                      {/* 機種選択（検索型） */}
                      <div>
                        <label style={labelStyle}>機種</label>
                        {selectedMachine&&(
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, background:C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:12, padding:'8px 12px' }}>
                            <span style={{ fontSize:13, fontWeight:700, color:C.primary, flex:1 }}>✅ {selectedMachine.name}</span>
                            <button onClick={()=>selectMachine('__none__')} style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:12 }}>✕ 解除</button>
                          </div>
                        )}
                        {/* 検索ボックス＋一覧ボタン */}
                        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                          <div style={{ flex:1, position:'relative' }}>
                            <input
                              value={machineSearchQuery}
                              onChange={e=>setMachineSearchQuery(e.target.value)}
                              style={{ ...inputStyle, paddingLeft:36 }}
                              placeholder="機種名を入力して検索…"
                            />
                            <Search size={15} color={C.textMuted} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                          </div>
                          <button onClick={()=>setMachineListDialogOpen(true)}
                            style={{ padding:'13px 12px', borderRadius:14, border:`1.5px solid ${C.border}`, background:C.card, color:C.primary, fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}>
                            📋 一覧
                          </button>
                        </div>
                        {/* テキスト入力時のサジェスト */}
                        {machineSearchQuery.trim()&&(()=>{
                          const q=machineSearchQuery.trim();
                          const hits=machines.filter(m=>fuzzyMatchMachine(m,q)).slice(0,12);
                          return hits.length>0?(
                            <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginTop:4 }}>
                              {hits.map((m,i)=>(
                                <button key={m.id} onClick={()=>{selectMachine(m.id);setMachineSearchQuery('');}}
                                  style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', border:'none', borderBottom:i<hits.length-1?`1px solid ${C.border}`:'none', background:form.machineId===m.id?C.primaryLight:C.card, cursor:'pointer', textAlign:'left' }}>
                                  <span style={{ fontSize:13, fontWeight:form.machineId===m.id?700:400, color:form.machineId===m.id?C.primary:C.textPrimary }}>{m.name}</span>
                                  {m.totalProbability>0&&<span style={{ fontSize:10, color:'#9333ea', background:isDark?'rgba(147,51,234,0.12)':'#fdf4ff', borderRadius:6, padding:'2px 6px' }}>確率✓</span>}
                                </button>
                              ))}
                            </div>
                          ):(
                            <div style={{ marginTop:4, fontSize:12, color:C.textMuted, padding:'6px 12px' }}>一致する機種が見つからないぜ</div>
                          );
                        })()}
                        {/* 直近5台 */}
                        {!machineSearchQuery.trim()&&recentMachinePresets.slice(0,5).length>0&&(
                          <div style={{ marginTop:6 }}>
                            <div style={{ fontSize:11, color:C.textMuted, marginBottom:4, fontWeight:600 }}>🕐 直近の機種（最大5件）</div>
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {recentMachinePresets.slice(0,5).map(m=>(
                                <button key={m.id} onClick={()=>selectMachine(m.id)}
                                  style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 12px', borderRadius:10, border:`1.5px solid ${form.machineId===m.id?C.primary:C.border}`, background:form.machineId===m.id?C.primaryLight:C.card, cursor:'pointer', textAlign:'left' }}>
                                  <span style={{ fontSize:13, fontWeight:form.machineId===m.id?700:400, color:form.machineId===m.id?C.primary:C.textPrimary, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</span>
                                  {favoriteMachineIds.includes(m.id)&&<span style={{ fontSize:14, flexShrink:0 }}>⭐</span>}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 機種一覧ダイアログ（お気に入りタブ付き） */}
                        {machineListDialogOpen&&(
                          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={()=>setMachineListDialogOpen(false)}>
                            <div style={{ background:C.card, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, maxHeight:'75vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
                              <div style={{ padding:'14px 18px 10px', borderBottom:`1px solid ${C.border}` }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                                  <div style={{ fontWeight:800, fontSize:15, color:C.textPrimary }}>🎰 機種を選ぶ</div>
                                  <button onClick={()=>setMachineListDialogOpen(false)} style={{ background:'none', border:'none', fontSize:20, color:C.textMuted, cursor:'pointer' }}>✕</button>
                                </div>
                                {/* タブ：全て ／ お気に入り */}
                                <div style={{ display:'flex', gap:8 }}>
                                  {[['all','全て'],['fav','⭐ お気に入り']].map(([tab,label])=>(
                                    <button key={tab} onClick={()=>setMachineListTab(tab)}
                                      style={{ padding:'6px 14px', borderRadius:10, border:`1.5px solid ${machineListTab===tab?C.primary:C.border}`, background:machineListTab===tab?C.primary:'transparent', color:machineListTab===tab?'white':C.textSecondary, fontWeight:700, fontSize:12, cursor:'pointer' }}>
                                      {label}
                                    </button>
                                  ))}
                                  <span style={{ fontSize:11, color:C.textMuted, alignSelf:'center', marginLeft:'auto' }}>
                                    {machineListTab==='fav'?`${favoriteMachineIds.length}件`:`全${machines.length}件`}
                                  </span>
                                </div>
                              </div>
                              <div style={{ overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'8px 14px', flex:1 }}>
                                {(machineListTab==='fav'?machines.filter(m=>favoriteMachineIds.includes(m.id)):machines).map(m=>(
                                  <div key={m.id} style={{ display:'flex', alignItems:'center', borderBottom:`1px solid ${C.border}`, marginBottom:2 }}>
                                    <button onClick={e=>{e.stopPropagation();toggleFavorite(m.id);}}
                                      style={{ background:'none', border:'none', fontSize:20, padding:'0 8px 0 0', cursor:'pointer', flexShrink:0, opacity:favoriteMachineIds.includes(m.id)?1:0.3 }}>
                                      ⭐
                                    </button>
                                    <button onClick={()=>{selectMachine(m.id);setMachineSearchQuery('');setMachineListDialogOpen(false);}}
                                      style={{ flex:1, display:'flex', justifyContent:'space-between', alignItems:'center', padding:'13px 8px 13px 0', border:'none', background:form.machineId===m.id?C.primaryLight:C.card, cursor:'pointer', textAlign:'left', borderRadius:12 }}>
                                      <div>
                                        <div style={{ fontSize:14, fontWeight:form.machineId===m.id?700:400, color:form.machineId===m.id?C.primary:C.textPrimary }}>{m.name}</div>
                                        {m.border25>0&&<div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>等価B: {m.border25} / 確率: {m.totalProbability||'-'}</div>}
                                      </div>
                                      <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                                        {m.totalProbability>0&&<span style={{ fontSize:10, color:'#9333ea', background:isDark?'rgba(147,51,234,0.12)':'#fdf4ff', borderRadius:6, padding:'2px 6px' }}>確率✓</span>}
                                        {form.machineId===m.id&&<span style={{ fontSize:12, color:C.primary }}>✓</span>}
                                      </div>
                                    </button>
                                  </div>
                                ))}
                                {machineListTab==='fav'&&favoriteMachineIds.length===0&&(
                                  <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:13 }}>⭐ をタップしてお気に入り登録するぜ</div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                        <div><label style={labelStyle}>台番号</label><input value={form.machineNumber} onChange={e=>updateForm('machineNumber',e.target.value)} style={inputStyle} placeholder="任意"/></div>
                        <div><label style={labelStyle}>機種名フリー入力</label><input value={form.machineFreeName} onChange={e=>updateForm('machineFreeName',e.target.value)} style={inputStyle} placeholder="未登録時用"/></div>
                      </div>

                      {selectedMachine&&(
                        <div style={{ background:isDark?'#1e293b':'#f8fafc', borderRadius:12, padding:'10px 12px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                            <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary }}>登録ボーダー一覧</div>
                            <button
                              onClick={()=>openEditMachine(selectedMachine)}
                              style={{ background:C.primaryLight, color:C.primary, border:`1px solid ${C.primaryMid}`, borderRadius:8, padding:'4px 12px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                              ✏️ 内容を変更
                            </button>
                          </div>
                          {(()=>{
                            const oneR=numberOrZero(selectedMachine.payoutPerRound);
                            const prob=numberOrZero(selectedMachine.totalProbability);
                            const canAuto=oneR>0&&prob>0;
                            return (
                              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                                {EXCHANGE_ORDER.map(cat=>{
                                  const manual=getMachineBorderByCategory(selectedMachine,cat);
                                  const coeff=numberOrZero(cat)*10||250;
                                  const auto=canAuto&&manual<=0?coeff/(oneR/prob):0;
                                  const val=manual>0?manual:auto;
                                  const isAuto=manual<=0&&auto>0;
                                  return (
                                    <div key={cat} style={{ background:C.card, border:`1px solid ${isAuto?C.primaryMid:C.border}`, borderRadius:10, padding:'6px 4px', textAlign:'center' }}>
                                      <div style={{ fontSize:10, color:C.textMuted }}>{getExchangePreset(cat).short}</div>
                                      <div style={{ fontSize:14, fontWeight:700, color:isAuto?C.primary:C.accent, marginTop:2 }}>{val>0?fmtRate(val):'0.00'}</div>
                                      {isAuto&&<div style={{ fontSize:8, color:C.primary }}>自動</div>}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                            {[['1R出玉',fmtRate(selectedMachine.payoutPerRound)],['平均獲得',`${Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉`],['トータル確率',selectedMachine.totalProbability?fmtRate(selectedMachine.totalProbability):'-']].map(([l,v])=>(
                              <div key={l} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:10, padding:'6px 4px', textAlign:'center' }}>
                                <div style={{ fontSize:10, color:C.textMuted }}>{l}</div>
                                <div style={{ fontSize:13, fontWeight:700, color:C.amber, marginTop:2 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <Dialog open={addMachineDialogOpen} onOpenChange={setAddMachineDialogOpen}>
                        <DialogTrigger asChild>
                          <button onClick={()=>{setMachineDraft({name:'',border25:'',border28:'',border30:'',border33:'',payoutPerRound:'',expectedBallsPerHit:'',totalProbability:'',kanaReading:''});setAddMachineDialogOpen(true);}} style={{ ...btnSecondary, width:'100%' }}>機種追加 / 個別ボーダー登録</button>
                        </DialogTrigger>
                        <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                          <DialogHeader><DialogTitle>機種データ追加</DialogTitle></DialogHeader>
                          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                            <div><Label>機種名</Label><Input value={machineDraft.name} onChange={e=>setMachineDraft(p=>({...p,name:e.target.value}))} className="mt-1 rounded-2xl"/></div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                              {[['border25','25個(等価)'],['border28','28個'],['border30','30個'],['border33','33個']].map(([k,l])=>(
                                <div key={k}><Label>{l}</Label><Input value={machineDraft[k]} onChange={e=>setMachineDraft(p=>({...p,[k]:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal"/></div>
                              ))}
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                              <div><Label>1R出玉</Label><Input value={machineDraft.payoutPerRound} onChange={e=>setMachineDraft(p=>({...p,payoutPerRound:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                              <div><Label>平均獲得出玉</Label><Input value={machineDraft.expectedBallsPerHit} onChange={e=>setMachineDraft(p=>({...p,expectedBallsPerHit:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                              <div style={{ gridColumn:'1/-1' }}><Label>トータル確率</Label><Input value={machineDraft.totalProbability} onChange={e=>setMachineDraft(p=>({...p,totalProbability:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal" placeholder="例: 9.49"/></div>
                            </div>
                            <div><Label>よみがな・検索キーワード（任意）</Label><Input value={machineDraft.kanaReading} onChange={e=>setMachineDraft(p=>({...p,kanaReading:e.target.value}))} className="mt-1 rounded-2xl" placeholder="例: うみものがたりかい"/></div>
                            <Button className="w-full rounded-2xl" onClick={saveMachine}>保存</Button>
                          </div>
                        </DialogContent>
                      </Dialog>

                      {/* 機種編集ダイアログ */}
                      <Dialog open={editMachineDialogOpen} onOpenChange={open=>{setEditMachineDialogOpen(open); if(!open)setDeleteConfirmOpen(false);}}>
                        <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                          <DialogHeader><DialogTitle>機種データを変更</DialogTitle></DialogHeader>
                          {!deleteConfirmOpen?(
                            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                              <div><Label>機種名</Label><Input value={machineDraft.name} onChange={e=>setMachineDraft(p=>({...p,name:e.target.value}))} className="mt-1 rounded-2xl"/></div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                {[['border25','25個(等価)'],['border28','28個'],['border30','30個'],['border33','33個']].map(([k,l])=>(
                                  <div key={k}><Label>{l}</Label><Input value={machineDraft[k]} onChange={e=>setMachineDraft(p=>({...p,[k]:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal"/></div>
                                ))}
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                <div><Label>1R出玉</Label><Input value={machineDraft.payoutPerRound} onChange={e=>setMachineDraft(p=>({...p,payoutPerRound:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                                <div><Label>平均獲得出玉</Label><Input value={machineDraft.expectedBallsPerHit} onChange={e=>setMachineDraft(p=>({...p,expectedBallsPerHit:e.target.value}))} className="mt-1 rounded-2xl" inputMode="numeric"/></div>
                                <div style={{ gridColumn:'1/-1' }}><Label>トータル確率</Label><Input value={machineDraft.totalProbability} onChange={e=>setMachineDraft(p=>({...p,totalProbability:e.target.value}))} className="mt-1 rounded-2xl" inputMode="decimal" placeholder="例: 9.49"/></div>
                              </div>
                              <div><Label>よみがな・検索キーワード（任意）</Label><Input value={machineDraft.kanaReading} onChange={e=>setMachineDraft(p=>({...p,kanaReading:e.target.value}))} className="mt-1 rounded-2xl" placeholder="例: うみものがたりかい"/></div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                                <Button variant="secondary" className="rounded-2xl" onClick={()=>setEditMachineDialogOpen(false)}>キャンセル</Button>
                                <Button className="rounded-2xl" onClick={saveEditMachine}>変更を保存</Button>
                              </div>
                              {/* 削除ボタン */}
                              <button onClick={()=>setDeleteConfirmOpen(true)}
                                style={{ width:'100%', padding:'11px', borderRadius:14, border:`1.5px solid ${C.negativeBorder}`, background:C.card, color:C.negative, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                🗑 この機種を削除する
                              </button>
                            </div>
                          ):(
                            /* 削除確認画面 */
                            <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'4px 0' }}>
                              <div style={{ background:C.negativeBg, border:`1.5px solid ${C.negativeBorder}`, borderRadius:14, padding:'16px', textAlign:'center' }}>
                                <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
                                <div style={{ fontWeight:800, color:C.negative, fontSize:16, marginBottom:6 }}>本当に削除しますか？</div>
                                <div style={{ fontSize:13, color:C.textSecondary, fontWeight:600 }}>「{machineDraft.name}」</div>
                                <div style={{ fontSize:12, color:C.textMuted, marginTop:8 }}>削除すると元に戻せません。この機種に紐づくセッションは保持されますが、機種データ自体は消えるぜ。</div>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                <button onClick={()=>setDeleteConfirmOpen(false)}
                                  style={{ padding:'12px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                  キャンセル
                                </button>
                                <button onClick={()=>deleteMachine(editMachineId)}
                                  style={{ padding:'12px', borderRadius:14, border:'none', background:C.negative, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                                  削除する
                                </button>
                              </div>
                            </div>
                          )}
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
                        {EXCHANGE_ORDER.filter(v=>v!=='25').map(v=><SelectItem key={v} value={v}>{getExchangePreset(v).label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* 指標グリッド（折りたたみ） */}
                <div style={{ border:`2px solid ${metricsPanelOpen?C.accentLight:'#bae6fd'}`, borderRadius:20, overflow:'hidden', boxShadow:metricsPanelOpen?'0 4px 20px rgba(14,165,233,0.15)':'0 2px 8px rgba(0,0,0,0.04)', transition:'box-shadow 0.2s' }}>
                  {/* ヘッダー：上段に収支・回転率を大きく、下段に補足 */}
                  <button
                    onClick={()=>setMetricsPanelOpen(p=>!p)}
                    style={{ width:'100%', background:isDark?'rgba(14,165,233,0.12)':'linear-gradient(135deg,#f0f9ff,#e0f2fe)', border:'none', padding:'13px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
                  >
                    <div style={{ flex:1 }}>
                      {/* 上段：収支・回転率を大きく */}
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:8 }}>
                        <div style={{ background:formMetrics.balanceYen>=0?C.positiveBg:C.negativeBg, border:`1.5px solid ${formMetrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:12, padding:'8px 10px', textAlign:'center' }}>
                          <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>💰 収支</div>
                          <div style={{ fontSize:22, fontWeight:900, color:formMetrics.balanceYen>=0?C.positive:C.negative, marginTop:2 }}>{fmtYen(formMetrics.balanceYen)}</div>
                        </div>
                        <div style={{ background:C.accentLight, border:`1.5px solid #bae6fd`, borderRadius:12, padding:'8px 10px', textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>📊 平均回転率</div>
                          <div style={{ fontSize:22, fontWeight:900, color:C.accent, marginTop:2 }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                        </div>
                      </div>
                      {/* 下段：補足情報を小さく */}
                      <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                        <div style={{ textAlign:'left' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>🎯 ボーダー</div>
                          <div style={{ fontSize:15, fontWeight:800, color:'#7c3aed' }}>{currentBorderInputValue||DEFAULT_BORDER}</div>
                        </div>
                        {formMetrics.machineBorder>0&&(
                          <div style={{ textAlign:'left' }}>
                            <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>差</div>
                            <div style={{ fontSize:15, fontWeight:800, color:formMetrics.rateDiff>=0?C.positive:C.negative }}>{formMetrics.rateDiff>=0?'+':''}{fmtRate(formMetrics.rateDiff)}</div>
                          </div>
                        )}
                        {formMetrics.currentBalls!==null&&(
                          <div style={{ textAlign:'left' }}>
                            <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>🎰 持ち玉</div>
                            <div style={{ fontSize:15, fontWeight:800, color:C.amber }}>{formMetrics.currentBalls.toLocaleString()}玉</div>
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginLeft:10, flexShrink:0 }}>
                      <ChevronDown size={18} color={C.accent} style={{ transform:metricsPanelOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                      <div style={{ fontSize:10, color:C.textMuted, textAlign:'center', marginTop:2 }}>詳細</div>
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
                          <input value={currentBorderInputValue} onChange={e=>updateForm('sessionBorderOverride',e.target.value)} style={{ ...inputStyle, border:`1.5px solid ${C.primaryMid}`, background:C.card, textAlign:'center', fontWeight:700, fontSize:18, color:C.primary, padding:'6px 10px' }} inputMode="decimal" placeholder="18.00"/>
                          <div style={{ marginTop:4, display:'flex', justifyContent:'space-between', fontSize:10, color:C.textMuted }}>
                            <span>{getExchangePreset(form.exchangeCategory||'25').short}</span>
                            {selectedMachine&&<button onClick={syncBorderToMachine} style={{ background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:10, fontWeight:600 }}>機種へ反映</button>}
                          </div>
                        </div>
                        <MetricBox label="持ち玉比率" value={`${fmtRate(formMetrics.holdBallRatio)}%`} sub={getExchangePreset(form.exchangeCategory||'25').label}/>
                        <MetricBox label="仕事量(理論)" value={theoreticalMetrics.workVolumeYen!==null?fmtYen(theoreticalMetrics.workVolumeYen):'-'} sub={theoreticalMetrics.workVolumeBalls!==null?`${Math.round(theoreticalMetrics.workVolumeBalls).toLocaleString()}玉`:'確率入力待ち'} color={C.positive}/>
                        <MetricBox
                          label="1R出玉（実測平均）"
                          value={avgOneRoundFromHits!==null?fmtRate(avgOneRoundFromHits):(selectedMachine?fmtRate(selectedMachine.payoutPerRound):'-')}
                          sub={avgOneRoundFromHits!==null
                            ? `${(form.firstHits||[]).filter(h=>h.oneRound>0).length}回の初当たりから算出`
                            : (selectedMachine?.expectedBallsPerHit?`機種登録値 / 平均${Math.round(numberOrZero(selectedMachine.expectedBallsPerHit)).toLocaleString()}玉`:'初当たり記録なし')
                          }
                          color={C.amber}
                        />
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
                {form.currentInputMode==='balls'&&(
                  <div>
                    <label style={labelStyle}>持ち玉数（玉）</label>
                    <input
                      value={form.inheritedBalls>0?String(form.inheritedBalls):(form.currentBallsInput||'')}
                      onChange={e=>{
                        const v=e.target.value;
                        applyFormUpdate(p=>({...p,currentBallsInput:v,inheritedBalls:numberOrZero(v)}));
                      }}
                      style={{ ...inputStyle, textAlign:'center', fontWeight:700, fontSize:18, color:C.amber }}
                      inputMode="numeric"
                      placeholder="例: 2500"
                    />
                    {/* 残り持ち玉をリアルタイム表示 */}
                    {formMetrics.currentBalls!==null&&formMetrics.ballInvestBalls>0&&(
                      <div style={{ marginTop:6, background:C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:10, padding:'8px 12px', fontSize:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ color:C.textSecondary }}>残り持ち玉</span>
                        <span style={{ fontWeight:800, fontSize:16, color:C.amber }}>{formMetrics.currentBalls.toLocaleString()}玉</span>
                      </div>
                    )}
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>
                      持ち玉の初期数を入力してください。ゲーム数を入力すると上のサマリーの持ち玉が減っていくぜ。
                    </div>
                  </div>
                )}

                {/* 投資設定アコーディオン */}
                <div style={{ border:`2px solid ${advancedInvestOpen?'#86efac':'#bbf7d0'}`, borderRadius:20, overflow:'hidden', boxShadow:advancedInvestOpen?'0 4px 20px rgba(22,163,74,0.15)':'0 2px 8px rgba(0,0,0,0.04)', transition:'box-shadow 0.2s' }}>
                  <button onClick={()=>setAdvancedInvestOpen(p=>!p)} style={{ width:'100%', background:isDark?'rgba(22,163,74,0.15)':'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:'none', padding:'12px 18px', display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ fontSize:20 }}>💴</div>
                      <div style={{ textAlign:'left' }}>
                        <div style={{ fontWeight:800, color:'#15803d', fontSize:13 }}>投資設定</div>
                        <div style={{ fontSize:11, color:isDark?'#4ade80':'#16a34a', marginTop:1 }}>500円行・持ち玉行の追加</div>
                      </div>
                    </div>
                    <div style={{ background:isDark?'rgba(22,163,74,0.2)':'#bbf7d0', borderRadius:10, padding:'4px 10px', display:'flex', alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:11, fontWeight:700, color:'#15803d' }}>{advancedInvestOpen?'閉じる':'開く'}</span>
                      <ChevronDown size={14} color="#15803d" style={{ transform:advancedInvestOpen?'rotate(180deg)':'none', transition:'0.2s' }}/>
                    </div>
                  </button>
                  {advancedInvestOpen&&(
                    <div style={{ background:isDark?'rgba(22,163,74,0.05)':'#f0fdf4', borderTop:'1.5px dashed #86efac', padding:'12px 16px', display:'flex', flexDirection:'column', gap:10 }}>
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
                  <input value={form.startRotation} onChange={e=>{
                    const v=e.target.value;
                    applyFormUpdate(p=>({...p,startRotation:v,...(!p.startTime&&v.trim()?{startTime:nowTimeStr()}:{})}));
                  }} style={{ ...inputStyle, border:`1.5px solid ${C.primaryMid}` }} inputMode="numeric" placeholder="124"/>
                </div>

                {/* 回転率入力リスト（スマホ2段カード形式） */}
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {form.rateEntries.map((entry,index)=>{
                    const prevR=index===0?numberOrZero(form.startRotation):numberOrZero(form.rateEntries[index-1]?.reading);
                    const curR=numberOrZero(entry.reading);
                    const hasReading=curR>0&&curR>=prevR;
                    const spins=hasReading?curR-prevR:0;
                    const amount=numberOrZero(entry.amount);
                    // 持ち玉は常に1玉=4円固定で回転率計算（収支用の換金率とは別）
                    const entryInvestYen=entry.kind==='balls'?amount*4:amount;
                    const rate=entryInvestYen>0&&spins>0?spins/(entryInvestYen/1000):0;
                    const border=numberOrZero(formMetrics.machineBorder);
                    const diff=rate-border;
                    const tone=getRateTone(diff,border,isDark);
                    const ev=border>0&&rate>0?calcEvYenFromRate(rate,border,entryInvestYen,settings):0;
                    const isFocused=flashReadingId===entry.id;
                    const isRestart=entry.kind==='restart';
                    const swipeX=swipeStates[entry.id]||0;
                    const showDelete=swipeX<-60;
                    return (
                      <div key={entry.id} style={{ position:'relative', overflow:'hidden', borderRadius:16 }}>
                        {/* スワイプ削除背景 */}
                        {showDelete&&(
                          <div style={{ position:'absolute', right:0, top:0, bottom:0, width:80, background:C.negative, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'0 16px 16px 0', zIndex:1 }}>
                            <button onClick={()=>{removeRateEntry(entry.id);setSwipeStates(p=>({...p,[entry.id]:0}));}}
                              style={{ background:'none', border:'none', color:'white', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, fontSize:11, fontWeight:700 }}>
                              <Trash2 size={18} color="white"/>削除
                            </button>
                          </div>
                        )}
                        <div
                          style={{
                            border:`2px solid ${isRestart?'#fde68a':isFocused?'#10b981':hasReading?tone.border:C.border}`,
                            borderRadius:16,
                            background:isRestart?(isDark?'rgba(251,191,36,0.12)':'#fffbeb'):isFocused?(isDark?'rgba(16,185,129,0.12)':'#ecfdf5'):hasReading?tone.bg:C.card,
                            overflow:'hidden',
                            transition:swipeX===0?'transform 0.2s':'none',
                            transform:`translateX(${Math.min(0,swipeX)}px)`,
                            position:'relative', zIndex:2,
                          }}
                          onTouchStart={e=>{swipeTouchStart.current[entry.id]=e.touches[0].clientX;}}
                          onTouchMove={e=>{
                            const dx=e.touches[0].clientX-(swipeTouchStart.current[entry.id]||0);
                            if(dx<0) setSwipeStates(p=>({...p,[entry.id]:Math.max(-80,dx)}));
                          }}
                          onTouchEnd={()=>{
                            const x=swipeStates[entry.id]||0;
                            if(x>-40) setSwipeStates(p=>({...p,[entry.id]:0}));
                            else setSwipeStates(p=>({...p,[entry.id]:-80}));
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
                                background:C.card, color:C.textPrimary,
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
                                <span style={{ padding:'7px 14px', borderRadius:8, fontWeight:700, fontSize:13, background:isDark?'rgba(147,51,234,0.12)':'#fdf4ff', color:'#9333ea', border:'1.5px solid #e9d5ff' }}>
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
                                  style={{ flex:1, textAlign:'right', fontSize:16, fontWeight:700, border:`1.5px solid ${C.border}`, borderRadius:8, padding:'7px 10px', background:C.card, color:C.textPrimary, outline:'none', width:'100%', boxSizing:'border-box' }}
                                  inputMode="numeric" enterKeyHint="done"
                                  placeholder={entry.kind==='balls'?'250':'1000'}
                                />
                              </div>
                            )}
                          </div>
                          {/* 削除 */}
                          <button
                            onClick={()=>removeRateEntry(entry.id)}
                            style={{ flexShrink:0, width:34, height:34, borderRadius:10, border:`1px solid ${C.border}`, background:C.card, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginTop:16 }}
                          >
                            <Trash2 size={15} color={C.textMuted}/>
                          </button>
                        </div>
                        {/* 下段：計算結果（入力済みのみ表示） */}
                        {hasReading&&(
                          <div style={{ borderTop:`1px solid ${hasReading?tone.border:C.border}`, background:hasReading?tone.bg:(isDark?'rgba(255,255,255,0.03)':'rgba(255,255,255,0.8)') }}>
                            {/* 数値行 */}
                            <div style={{ padding:'8px 14px', display:'flex', gap:0 }}>
                              {[
                                ['回転数', spins+'回', C.accent],
                                ['回転率', fmtRate(rate), tone.text],
                                ['ボーダー差', border>0?(diff>=0?'+':'')+fmtRate(diff):'—', diff>=0?C.positive:C.negative],
                                ['期待値', border>0?`¥${Math.round(ev)}`:'—', ev>=0?C.positive:C.negative],
                              ].map(([l,v,c],i,arr)=>(
                                <div key={l} style={{ flex:1, textAlign:'center', borderRight:i<arr.length-1?`1px solid ${C.border}`:'none', padding:'0 4px' }}>
                                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{l}</div>
                                  <div style={{ marginTop:2, fontSize:13, fontWeight:800, color:c }}>{v}</div>
                                </div>
                              ))}
                            </div>
                            {/* ミニ累積回転率グラフ（2行以上ある場合のみ） */}
                            {sessionTrendData.length>1&&(
                              <div style={{ padding:'0 8px 6px', height:36 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={sessionTrendData} margin={{top:2,bottom:2,left:0,right:0}}>
                                    {border>0&&<ReferenceLine y={border} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1}/>}
                                    <Line type="monotone" dataKey="rate" stroke={tone.text||C.accent} strokeWidth={1.5} dot={false} isAnimationActive={false}/>
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                          </div>
                        )}
                        </div>
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
                    style={{ background:isDark?'rgba(251,191,36,0.12)':'#fffbeb', color:'#d97706', border:'2px solid #fde68a', borderRadius:14, padding:'14px', fontWeight:700, fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                  >
                    🔄 再スタート
                  </button>
                </div>

                {/* 再スタートダイアログ */}
                <Dialog open={restartDialogOpen} onOpenChange={setRestartDialogOpen}>
                  <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                    <DialogHeader><DialogTitle>再スタート</DialogTitle></DialogHeader>
                    <div style={{ display:'flex', flexDirection:'column', gap:16, padding:'4px 0' }}>
                      <div style={{ background:isDark?'rgba(251,191,36,0.12)':'#fffbeb', border:'1.5px solid #fde68a', borderRadius:12, padding:'12px 14px', fontSize:13, color:'#92400e' }}>
                        大当たり終了後など、回転率を区切って再スタートする際に使うぜ。再スタート時点のゲーム数を入力してくれ。
                      </div>
                      <div>
                        <label style={{ fontSize:13, fontWeight:600, color:C.textSecondary, display:'block', marginBottom:8 }}>再スタート時のゲーム数</label>
                        <input
                          value={restartRotationInput}
                          onChange={e=>setRestartRotationInput(e.target.value)}
                          style={{ width:'100%', boxSizing:'border-box', fontSize:28, fontWeight:800, textAlign:'center', border:'2px solid #fde68a', borderRadius:14, padding:'14px', color:C.textPrimary, outline:'none', background:C.card }}
                          inputMode="numeric"
                          placeholder="例: 243"
                          autoFocus
                        />
                        <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>入力しない場合は空欄のまま決定してください</div>
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

                {/* 非等価アドバイスバナー（スティッキーサマリー直上） */}
                {(()=>{
                  if(form.exchangeCategory==='25') return null;
                  const tm=theoreticalMetrics;
                  if(tm.cashUnitPriceYen===null||tm.holdUnitPriceYen===null) return null;
                  if(formMetrics.totalSpins<50) return null; // 回転数少ない時は非表示
                  const cashOk=tm.cashUnitPriceYen>=0;
                  const holdOk=tm.holdUnitPriceYen>=0;
                  if(cashOk&&holdOk) return null; // 両方プラスは表示不要
                  if(!cashOk&&holdOk){
                    // 現金NG・持ち玉OK
                    return (
                      <div style={{ background:isDark?'rgba(22,163,74,0.12)':'linear-gradient(135deg,#f0fdf4,#dcfce7)', border:`1.5px solid #86efac`, borderRadius:16, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start', marginBottom:6 }}>
                        <div style={{ fontSize:20, flexShrink:0 }}>💡</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:13, color:isDark?'#4ade80':'#166534', marginBottom:3 }}>持ち玉なら期待値あり！</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12, marginBottom:4 }}>
                            <div style={{ background:isDark?'rgba(220,38,38,0.15)':'rgba(220,38,38,0.08)', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>現金</div>
                              <div style={{ fontWeight:800, color:'#dc2626' }}>{fmtRate(tm.cashUnitPriceYen)}円/回転</div>
                              <div style={{ fontSize:10, color:'#dc2626' }}>ボーダー以下❌</div>
                            </div>
                            <div style={{ background:isDark?'rgba(22,163,74,0.15)':'rgba(22,163,74,0.08)', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>持ち玉</div>
                              <div style={{ fontWeight:800, color:'#16a34a' }}>+{fmtRate(tm.holdUnitPriceYen)}円/回転</div>
                              <div style={{ fontSize:10, color:'#16a34a' }}>期待値あり✅</div>
                            </div>
                          </div>
                          <div style={{ fontSize:11, color:isDark?'#86efac':'#166534' }}>
                            現金追加は避けて持ち玉で打ち続けよう！
                          </div>
                        </div>
                      </div>
                    );
                  }
                  if(!cashOk&&!holdOk){
                    // 両方NG
                    return (
                      <div style={{ background:isDark?'rgba(239,68,68,0.12)':'linear-gradient(135deg,#fff1f2,#ffe4e6)', border:`1.5px solid ${C.negativeBorder}`, borderRadius:16, padding:'12px 14px', display:'flex', gap:10, alignItems:'flex-start', marginBottom:6 }}>
                        <div style={{ fontSize:20, flexShrink:0 }}>⚠️</div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontWeight:800, fontSize:13, color:isDark?'#f87171':'#991b1b', marginBottom:3 }}>現金・持ち玉ともにボーダー以下</div>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, fontSize:12, marginBottom:4 }}>
                            <div style={{ background:isDark?'rgba(220,38,38,0.15)':'rgba(220,38,38,0.08)', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>現金</div>
                              <div style={{ fontWeight:800, color:'#dc2626' }}>{fmtRate(tm.cashUnitPriceYen)}円/回転</div>
                              <div style={{ fontSize:10, color:'#dc2626' }}>ボーダー以下❌</div>
                            </div>
                            <div style={{ background:isDark?'rgba(220,38,38,0.15)':'rgba(220,38,38,0.08)', borderRadius:8, padding:'5px 8px', textAlign:'center' }}>
                              <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>持ち玉</div>
                              <div style={{ fontWeight:800, color:'#dc2626' }}>{fmtRate(tm.holdUnitPriceYen)}円/回転</div>
                              <div style={{ fontSize:10, color:'#dc2626' }}>ボーダー以下❌</div>
                            </div>
                          </div>
                          <div style={{ fontSize:11, color:isDark?'#fca5a5':'#991b1b' }}>
                            台移動か撤退を検討しよう！
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* スティッキーサマリー */}
                <div style={{ position:'sticky', bottom:80, zIndex:10, background:isDark?'rgba(15,23,42,0.97)':'rgba(255,255,255,0.97)', border:`1px solid ${C.border}`, borderRadius:20, padding:'12px 16px', backdropFilter:'blur(12px)', boxShadow:'0 -2px 20px rgba(0,0,0,0.12)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>今日の1台サマリー</div>
                    {formMetrics.machineBorder>0&&(
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ fontSize:11, color:C.textMuted }}>ボーダー差</span>
                        <span style={{ fontSize:15, fontWeight:800, color:formMetrics.rateDiff>=0?C.positive:C.negative, background:formMetrics.rateDiff>=0?C.positiveBg:C.negativeBg, border:`1px solid ${formMetrics.rateDiff>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:8, padding:'2px 8px' }}>
                          {formMetrics.rateDiff>=0?'▲':'▼'}{Math.abs(formMetrics.rateDiff).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* 収支・回転率を大きく中央に */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <div style={{ background:formMetrics.balanceYen>=0?C.positiveBg:C.negativeBg, border:`1.5px solid ${formMetrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:14, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:C.textMuted, fontWeight:600, marginBottom:2 }}>収支</div>
                      <div style={{ fontSize:18, fontWeight:900, color:formMetrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(formMetrics.balanceYen)}</div>
                    </div>
                    <div style={{ background:C.accentLight, border:`1.5px solid #bae6fd`, borderRadius:14, padding:'8px 10px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:C.textMuted, fontWeight:600, marginBottom:2 }}>平均回転率</div>
                      <div style={{ fontSize:18, fontWeight:900, color:C.accent }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:`repeat(${formMetrics.ballInvestBalls>0||formMetrics.currentBalls!==null?4:3},1fr)`, gap:4, textAlign:'center' }}>
                    {[
                      ['総回転', Math.round(formMetrics.totalSpins)+'回', null],
                      ['現金投資', fmtYen(formMetrics.totalInvestYen), null],
                      ...((formMetrics.ballInvestBalls>0||formMetrics.currentBalls!==null)?[['玉投資', formMetrics.ballInvestBalls.toLocaleString()+'玉', C.amber]]:[]),
                      ['総投資', fmtYen(Math.round(formMetrics.cashInvestYen+(formMetrics.ballInvestYen||0))), C.primary],
                    ].map(([l,v,c])=>(
                      <div key={l} style={{ background:isDark?'#1e293b':'#f8fafc', borderRadius:10, padding:'5px 2px' }}>
                        <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
                        <div style={{ marginTop:2, fontWeight:700, fontSize:11, color:c||C.textPrimary, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 過去計測履歴（10枠ごとのアーカイブ） */}
                {(form.measurementLogs||[]).length>0&&(
                  <details style={{ border:`1px solid ${C.border}`, borderRadius:16, background:C.card, overflow:'hidden' }}>
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
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>10枠計測</div>
                          <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{(form.measurementLogs||[]).filter(l=>l.kind==='normal'||!l.kind).length}回</div>
                        </div>
                        <div style={{ textAlign:'center' }}>
                          <div style={{ fontSize:10, color:'#0369a1', fontWeight:600 }}>全総回転</div>
                          <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{Math.round(formMetrics.allTotalSpins).toLocaleString()}回</div>
                        </div>
                      </div>

                      {/* 1万円/2500玉計測（normal） */}
                      {(form.measurementLogs||[]).filter(l=>l.kind==='normal'||!l.kind).length>0&&(
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.textSecondary, marginBottom:6, paddingLeft:2 }}>📋 10枠ごとの計測</div>
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
                                  <div>現金投資 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(numberOrZero(log.cashInvestYen)||log.investYen)}</span></div>
                                  {numberOrZero(log.ballInvestBalls)>0
                                    ? <div>持ち玉投資 <span style={{ fontWeight:700, color:C.amber }}>{Math.round(log.ballInvestBalls)}玉</span></div>
                                    : <div>ボーダー比 <span style={{ fontWeight:700, color:overBorder?C.positive:C.negative }}>{overBorder?'↑上回':'↓下回'}</span></div>
                                  }
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
                              <div key={log.id} style={{ border:`1.5px solid #e9d5ff`, borderRadius:12, padding:'11px 14px', marginBottom:6, background:isDark?'rgba(147,51,234,0.12)':'#fdf4ff' }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                                  <div style={{ fontWeight:700, color:'#7c3aed', fontSize:13 }}>{log.label}</div>
                                  <span style={{ fontSize:14, fontWeight:800, color:overBorder?C.positive:C.negative }}>{fmtRate(log.rate)}</span>
                                </div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:12, color:C.textSecondary }}>
                                  <div>回転数 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(log.spins).toLocaleString()}回</span></div>
                                  <div>現金投資 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(numberOrZero(log.cashInvestYen)||log.investYen)}</span></div>
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
                  <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-base">
                        <Star className="h-4 w-4 text-amber-400"/>{firstHitForm.label}
                      </DialogTitle>
                      {/* ステップインジケーター */}
                      <div style={{ display:'flex', gap:6, alignItems:'center', marginTop:8 }}>
                        {[['1','R数'],['2','持ち玉'],['3','確認']].map(([n,label],i)=>(
                          <React.Fragment key={n}>
                            <button onClick={()=>setFirstHitStep(Number(n))}
                              style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 10px', borderRadius:20, border:'none', cursor:'pointer',
                                background:firstHitStep===Number(n)?C.primary:isDark?'rgba(255,255,255,0.08)':'#f1f5f9',
                                color:firstHitStep===Number(n)?'white':C.textMuted, fontWeight:firstHitStep===Number(n)?700:400, fontSize:11 }}>
                              <span style={{ width:16, height:16, borderRadius:'50%', background:firstHitStep===Number(n)?'rgba(255,255,255,0.3)':'transparent', border:`1.5px solid ${firstHitStep===Number(n)?'white':C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700 }}>{n}</span>
                              {label}
                            </button>
                            {i<2&&<div style={{ height:1, flex:1, background:C.border }}/>}
                          </React.Fragment>
                        ))}
                      </div>
                    </DialogHeader>
                    <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                      {/* R数入力（1〜10ボタン累積＋直接入力） */}
                      <div style={{ border:`2px solid ${C.primaryMid}`, borderRadius:16, overflow:'hidden' }}>
                        <div style={{ background:isDark?'rgba(99,102,241,0.15)':'#eef2ff', padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div>
                            <div style={{ fontWeight:800, fontSize:13, color:C.primary }}>R数入力</div>
                            <div style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>ボタンを押すたびに加算・直接入力も可</div>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <button onClick={()=>setFirstHitForm(p=>{
                              const lastR=numberOrZero(p._lastR);
                              const curR=numberOrZero(p.rounds);
                              const curC=numberOrZero(p.chainCount);
                              if(lastR<=0||curR<=0) return p;
                              const prevR=Math.max(0,curR-lastR);
                              const prevC=Math.max(0,curC-1);
                              return {...p,rounds:String(prevR),chainCount:String(prevC),_lastR:0,restartReason:prevC<=1?'single':p.restartReason};
                            })}
                              style={{ background:isDark?'rgba(99,102,241,0.15)':C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:8, padding:'4px 8px', fontSize:11, color:C.primary, fontWeight:700, cursor:'pointer' }}>
                              ↩ 戻す
                            </button>
                            <button onClick={()=>setFirstHitForm(p=>({...p,rounds:'0',chainCount:'0'}))}
                              style={{ background:C.negativeBg, border:`1px solid ${C.negativeBorder}`, borderRadius:8, padding:'4px 10px', fontSize:11, color:C.negative, fontWeight:700, cursor:'pointer' }}>
                              リセット
                            </button>
                            <div style={{ fontSize:28, fontWeight:900, color:C.primary, minWidth:60, textAlign:'center' }}>
                              {numberOrZero(firstHitForm.rounds)}R
                            </div>
                          </div>
                        </div>
                        <div style={{ padding:'10px 12px' }}>
                          {/* 1〜10ボタン */}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:6, marginBottom:8 }}>
                            {[1,2,3,4,5,6,7,8,9,10].map(r=>(
                              <button key={r} onClick={()=>setFirstHitForm(p=>{
                                const newChain=numberOrZero(p.chainCount)+1;
                                return {...p,rounds:String(numberOrZero(p.rounds)+r),chainCount:String(newChain),restartReason:newChain>1?'st':p.restartReason,_lastR:r};
                              })}
                                style={{ padding:'10px 0', borderRadius:10, border:`1.5px solid ${C.primaryMid}`, background:isDark?'rgba(99,102,241,0.1)':C.primaryLight, color:C.primary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                +{r}
                              </button>
                            ))}
                          </div>
                          {/* 直接入力 */}
                          <Input value={firstHitForm.rounds} onChange={e=>setFirstHitForm(p=>({...p,rounds:e.target.value}))} className="rounded-xl h-9 text-center text-sm" inputMode="numeric" placeholder="直接入力"/>
                        </div>
                      </div>
                      {/* 持ち玉・回転 2列グリッド */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl border p-2">
                        <div><Label className="text-xs">開始持ち玉</Label><Input value={firstHitForm.startBalls} onChange={e=>setFirstHitForm(p=>({...p,startBalls:e.target.value}))} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric"/></div>
                        <div><Label className="text-xs">終了持ち玉</Label><Input value={firstHitForm.endBalls} onChange={e=>setFirstHitForm(p=>({...p,endBalls:e.target.value}))} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric"/></div>
                        <div><Label className="text-xs">上皿玉数(任意)</Label><Input value={firstHitForm.upperBalls} onChange={e=>setFirstHitForm(p=>({...p,upperBalls:e.target.value}))} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric"/></div>
                        <div><Label className="text-xs">連チャン数</Label><Input value={firstHitForm.chainCount} onChange={e=>{const v=e.target.value; const n=numberOrZero(v); setFirstHitForm(p=>({...p,chainCount:v,restartReason:n>1?'st':p.restartReason}));}} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric" placeholder="1"/></div>
                        <div><Label className="text-xs">再スタート回転</Label><Input value={firstHitForm.restartRotation} onChange={e=>{const v=e.target.value; setFirstHitForm(p=>({...p,restartRotation:v,...(numberOrZero(p.chainCount)<=1&&numberOrZero(v)>0?{restartReason:'jitan'}:{}),...(numberOrZero(p.chainCount)<=1&&numberOrZero(v)<=0?{restartReason:'single'}:{})}));}} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric" placeholder="0"/></div>
                        <div><Label className="text-xs">残り保留数</Label><Input value={firstHitForm.remainingHolds} onChange={e=>setFirstHitForm(p=>({...p,remainingHolds:e.target.value}))} className="mt-1 rounded-xl h-9 text-sm" inputMode="numeric" placeholder="例: 3"/></div>
                      </div>
                      {/* 初当たりゲーム数（差玉/現金投資計算用） */}
                      <div style={{ border:`2px solid ${C.amberBorder}`, borderRadius:16, overflow:'hidden', background:C.amberBg }}>
                        <div style={{ background:isDark?'rgba(245,158,11,0.2)':'#fef3c7', padding:'10px 14px', borderBottom:`1px solid ${C.amberBorder}` }}>
                          <div style={{ fontWeight:800, fontSize:14, color:C.amber }}>🎯 初当たりゲーム数</div>
                          <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>大当りが来たゲーム数（任意）</div>
                        </div>
                        <div style={{ padding:'10px 14px' }}>
                          <Input value={firstHitForm.hitSpins} onChange={e=>setFirstHitForm(p=>({...p,hitSpins:e.target.value}))} className="rounded-xl text-center font-bold" style={{ fontSize:28, height:56, color:C.amber }} inputMode="numeric" placeholder="例: 301"/>
                          {/* 現金モード時の投資額入力欄 */}
                          {form.currentInputMode==='cash'&&(
                            <div style={{ marginTop:10 }}>
                              {/* 現在の投資状況サマリー */}
                              <div style={{ background:isDark?'rgba(245,158,11,0.08)':'#fffbeb', border:`1px solid ${C.amberBorder}`, borderRadius:12, padding:'10px 14px', marginBottom:8 }}>
                                <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:6 }}>📊 現在の投資状況</div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:12 }}>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>現金投資</div>
                                    <div style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(formMetrics.cashInvestYen)}</div>
                                  </div>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>総回転</div>
                                    <div style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(formMetrics.allTotalSpins)}回</div>
                                  </div>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>平均回転率</div>
                                    <div style={{ fontWeight:700, color:C.accent }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                                  </div>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>収支</div>
                                    <div style={{ fontWeight:700, color:formMetrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(formMetrics.balanceYen)}</div>
                                  </div>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>ボーダー</div>
                                    <div style={{ fontWeight:700, color:'#7c3aed' }}>{formMetrics.machineBorder>0?fmtRate(formMetrics.machineBorder):'-'}</div>
                                  </div>
                                  <div style={{ textAlign:'center' }}>
                                    <div style={{ fontSize:10, color:C.textMuted }}>差</div>
                                    <div style={{ fontWeight:700, color:formMetrics.rateDiff>=0?C.positive:C.negative }}>{formMetrics.machineBorder>0?(formMetrics.rateDiff>=0?'+':'')+fmtRate(formMetrics.rateDiff):'-'}</div>
                                  </div>
                                </div>
                              </div>
                              <Label className="text-xs" style={{ color:C.amber, fontWeight:700 }}>💴 この区間の現金投資額</Label>
                              <Input value={firstHitForm.cashInvestInput} onChange={e=>setFirstHitForm(p=>({...p,cashInvestInput:e.target.value}))} className="mt-1 rounded-xl h-10 text-center font-bold" style={{ color:C.amber }} inputMode="numeric" placeholder="例: 5000"/>
                            </div>
                          )}
                          {(()=>{
                            const hitSpins=numberOrZero(firstHitForm.hitSpins);
                            const startBalls=numberOrZero(firstHitForm.startBalls);
                            const upperBalls=numberOrZero(firstHitForm.upperBalls);
                            const remainingHolds=numberOrZero(firstHitForm.remainingHolds);
                            const effectiveStart=startBalls+upperBalls;
                            const effectiveHit=hitSpins+remainingHolds;
                            const lastReading=(form.rateEntries||[]).reduce((last,e)=>{
                              const r=numberOrZero(e.reading); return (r>0&&r>last)?r:last;
                            }, numberOrZero(form.startRotation));
                            const spinsUsed=lastReading>0?Math.max(0,effectiveHit-lastReading):effectiveHit;
                            const isCash=form.currentInputMode==='cash';
                            const curBalls=formMetrics.currentBalls;

                            if(isCash){
                              const cashInvest=numberOrZero(firstHitForm.cashInvestInput);
                              if(hitSpins<=0||cashInvest<=0) return (
                                <div style={{ fontSize:11, color:C.textMuted, marginTop:8 }}>初当たりゲーム数と現金投資額を入力すると回転率を計算するぜ。</div>
                              );
                              const netThisSection=Math.max(0,cashInvest-(effectiveStart*4)); // 開始持ち玉+上皿玉を差し引いた純投資
                              // 既存投資：確定済みのみ（未確定行はcashInvestInputで上書きされる）
                              const confirmedInvest=formMetrics.cashInvestYen+(formMetrics.ballInvestYen||0);
                              const totalInvestForRate=confirmedInvest+netThisSection;
                              const rate=totalInvestForRate>0?hitSpins/(totalInvestForRate/1000):0;
                              return (
                                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                                  <div style={{ background:isDark?'rgba(245,158,11,0.1)':'white', borderRadius:10, padding:'8px 12px', border:`1px solid ${C.amberBorder}` }}>
                                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>計算の内訳</div>
                                    <div style={{ fontSize:12, color:C.amber, lineHeight:'1.8' }}>
                                      この区間の純投資: {cashInvest.toLocaleString()}円 − ({startBalls}{upperBalls>0?'+'+upperBalls:''})玉×4 = <b>{fmtYen(netThisSection)}</b><br/>
                                      今までの確定投資: <b>{fmtYen(confirmedInvest)}</b><br/>
                                      合計投資: {fmtYen(confirmedInvest)} + {fmtYen(netThisSection)} = <b>{fmtYen(totalInvestForRate)}</b><br/>
                                      総ゲーム数: <b>{hitSpins}回転</b>
                                    </div>
                                  </div>
                                  <div style={{ background:isDark?'rgba(245,158,11,0.15)':'#fffbeb', borderRadius:12, padding:'10px 14px', border:`1.5px solid ${C.amberBorder}`, textAlign:'center' }}>
                                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>算出回転率</div>
                                    <div style={{ fontSize:28, fontWeight:900, color:C.amber }}>{fmtRate(rate)}<span style={{ fontSize:13, fontWeight:600, marginLeft:4 }}>回/千円</span></div>
                                  </div>
                                  <div style={{ fontSize:10, color:C.textMuted }}>✅ 純投資{fmtYen(netThisSection)}が現金投資に加算されるぜ</div>
                                </div>
                              );
                            } else {
                              if(hitSpins<=0||curBalls===null||effectiveStart>=curBalls) return (
                                <div style={{ marginTop:10 }}>
                                  {/* 持ち玉モードの現在の投資状況 */}
                                  <div style={{ background:isDark?'rgba(245,158,11,0.08)':'#fffbeb', border:`1px solid ${C.amberBorder}`, borderRadius:12, padding:'10px 14px', marginBottom:6 }}>
                                    <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:6 }}>📊 現在の投資状況</div>
                                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, fontSize:12 }}>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>現金投資</div>
                                        <div style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(formMetrics.cashInvestYen)}</div>
                                      </div>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>持ち玉投資</div>
                                        <div style={{ fontWeight:700, color:C.amber }}>{Math.round(formMetrics.ballInvestBalls||0).toLocaleString()}玉</div>
                                      </div>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>残り持ち玉</div>
                                        <div style={{ fontWeight:700, color:C.amber }}>{curBalls!==null?curBalls.toLocaleString()+'玉':'-'}</div>
                                      </div>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>総回転</div>
                                        <div style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(formMetrics.allTotalSpins)}回</div>
                                      </div>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>平均回転率</div>
                                        <div style={{ fontWeight:700, color:C.accent }}>{fmtRate(formMetrics.avgSpinPerThousand)}</div>
                                      </div>
                                      <div style={{ textAlign:'center' }}>
                                        <div style={{ fontSize:10, color:C.textMuted }}>収支</div>
                                        <div style={{ fontWeight:700, color:formMetrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(formMetrics.balanceYen)}</div>
                                      </div>
                                    </div>
                                  </div>
                                  <div style={{ fontSize:11, color:C.textMuted }}>開始持ち玉を入力すると差玉から回転率を自動計算するぜ。</div>
                                </div>
                              );
                              const diff=curBalls-effectiveStart;
                              const thisInvestYen=diff*4;
                              // 持ち玉モードも既存確定投資+この区間の差玉で総合計算
                              const existingInvestBalls=formMetrics.cashInvestYen+(formMetrics.ballInvestYen||0);
                              const totalInvestForRate=existingInvestBalls+thisInvestYen;
                              const rate=totalInvestForRate>0?hitSpins/(totalInvestForRate/1000):0;
                              return (
                                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                                  <div style={{ background:isDark?'rgba(245,158,11,0.1)':'white', borderRadius:10, padding:'8px 12px', border:`1px solid ${C.amberBorder}` }}>
                                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>計算の内訳</div>
                                    <div style={{ fontSize:12, color:C.amber, lineHeight:'1.8' }}>
                                      差玉: {curBalls.toLocaleString()} − ({startBalls}{upperBalls>0?'+'+upperBalls:''}) = <b>{diff.toLocaleString()}玉</b>（{fmtYen(thisInvestYen)}）<br/>
                                      今までの総投資: <b>{fmtYen(existingInvestBalls)}</b><br/>
                                      合計投資: {fmtYen(existingInvestBalls)} + {fmtYen(thisInvestYen)} = <b>{fmtYen(totalInvestForRate)}</b><br/>
                                      総ゲーム数: <b>{hitSpins}回転</b>
                                    </div>
                                  </div>
                                  <div style={{ background:isDark?'rgba(245,158,11,0.15)':'#fffbeb', borderRadius:12, padding:'10px 14px', border:`1.5px solid ${C.amberBorder}`, textAlign:'center' }}>
                                    <div style={{ fontSize:11, color:C.textMuted, marginBottom:2 }}>算出回転率</div>
                                    <div style={{ fontSize:28, fontWeight:900, color:C.amber }}>{fmtRate(rate)}<span style={{ fontSize:13, fontWeight:600, marginLeft:4 }}>回/千円</span></div>
                                  </div>
                                  <div style={{ fontSize:10, color:C.textMuted }}>✅ 大当たり終了時に持ち玉{diff.toLocaleString()}玉 / {hitSpins}回転の投資行へ自動追加</div>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>
                      {/* 再スタート理由 */}
                      <div>
                        <Label className="text-xs">再スタート理由</Label>
                        <Select value={firstHitForm.restartReason} onValueChange={v=>setFirstHitForm(p=>({...p,restartReason:v}))}>
                          <SelectTrigger className="mt-1 rounded-xl h-9 text-sm"><span>{getRestartReasonLabel(firstHitForm.restartReason,firstHitForm.restartReasonNote)}</span></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="single">単発後</SelectItem><SelectItem value="st">確変/ST後</SelectItem>
                            <SelectItem value="jitan">時短抜け後</SelectItem><SelectItem value="other">その他</SelectItem>
                          </SelectContent>
                        </Select>
                        {firstHitForm.restartReason==='other'&&<Input value={firstHitForm.restartReasonNote} onChange={e=>setFirstHitForm(p=>({...p,restartReasonNote:e.target.value}))} className="mt-1 rounded-xl h-9 text-sm" placeholder="理由メモ"/>}
                      </div>
                      {/* 計算結果（コンパクト） */}
                      <div style={{ background:isDark?C.card:'#f8fafc', borderRadius:10, padding:'8px 12px' }}>
                        <div style={{ fontWeight:600, fontSize:12, color:C.textPrimary, marginBottom:4 }}>計算結果</div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2px 12px', fontSize:12 }}>
                          {[
                            ['獲得出玉', firstHitMetrics.gainedBalls>0?fmtBall(firstHitMetrics.gainedBalls):'-'],
                            ['1R出玉', firstHitMetrics.oneRound>0?fmtRate(firstHitMetrics.oneRound):(firstHitMetrics.gainedBalls>0&&firstHitMetrics.rounds<=0?'R数入力待ち':'-')],
                            ['合計R', firstHitMetrics.rounds>0?String(firstHitMetrics.rounds)+'R':'未入力'],
                            ['連チャン', getChainResultLabel(firstHitForm.chainCount)],
                          ].map(([l,v])=>(
                            <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', borderBottom:`1px solid ${C.border}` }}>
                              <span style={{ color:C.textMuted }}>{l}</span>
                              <span style={{ fontWeight:700, color:l==='1R出玉'&&v==='R数入力待ち'?C.amber:C.textPrimary }}>{v}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedMachine&&firstHitMetrics.oneRound>0&&(
                        <div style={{ fontSize:10, color:C.positive, textAlign:'center' }}>✅ 1R出玉 {fmtRate(firstHitMetrics.oneRound)} を機種へ自動反映します</div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="rounded-xl h-9 text-sm" onClick={()=>setFirstHitDialogOpen(false)}>キャンセル</Button>
                        <Button className="rounded-xl text-sm" style={{ height:'auto', padding:'10px 12px', lineHeight:1.3, whiteSpace:'normal', wordBreak:'keep-all' }} onClick={()=>completeFirstHit(true)}>終了して<br/>回転率を再スタート</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* 時間など */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={labelStyle}>打ち始め時間</label>
                    <input
                      value={form.startTime||''}
                      onChange={e=>updateForm('startTime',e.target.value)}
                      style={{ ...inputStyle, textAlign:'center', fontWeight:700, fontSize:18, color:C.primary }}
                      type="time"
                    />
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>最初のゲーム数入力時に自動記録されるぜ。手動変更も可。</div>
                  </div>
                  <div><label style={labelStyle}>タグ</label><input value={form.tags} onChange={e=>updateForm('tags',e.target.value)} style={inputStyle} placeholder="特日, 強イベ"/></div>
                </div>

                {(form.rateSections||[]).length>0&&(
                  <div>
                    <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:8, fontSize:14 }}>回転率 再スタート履歴</div>
                    {(form.rateSections||[]).map(s=>(
                      <div key={s.id} style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 14px', marginBottom:6 }}>
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
                      <div key={hit.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'13px 16px', marginBottom:8 }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                            <div style={{ fontWeight:700, color:C.textPrimary, fontSize:14 }}>{hit.label}</div>
                            {hit.hitSpins>0&&<div style={{ fontSize:12, fontWeight:700, color:C.amber, background:isDark?'rgba(245,158,11,0.15)':C.amberBg, border:`1px solid ${C.amberBorder}`, borderRadius:8, padding:'2px 8px' }}>🎯 初当たり{hit.hitSpins}回転</div>}
                          </div>
                          <div style={{ fontSize:12, color:C.textSecondary, marginTop:3 }}>{hit.rounds}R / 獲得{Math.round(hit.gainedBalls)}玉 / 1R {hit.oneRound.toFixed(1)} / {hit.chainResultLabel||getChainResultLabel(hit.chainCount)}</div>
                          {hit.restartRotation>0&&<div style={{ fontSize:12, color:C.primary, marginTop:3, fontWeight:600 }}>🔄 再スタート: {hit.restartRotation}回転</div>}
                          {hit.hitSpins>0&&hit.remainingHolds>0&&(
                            <div style={{ fontSize:12, color:C.amber, marginTop:3, fontWeight:600 }}>
                              {hit.hitSpins}回転 + 残{hit.remainingHolds}保留 = <b>{hit.hitSpins+hit.remainingHolds}回転</b>
                            </div>
                          )}
                          {(!hit.hitSpins||hit.hitSpins<=0)&&hit.remainingHolds>0&&<div style={{ fontSize:12, color:'#0369a1', marginTop:2, fontWeight:600 }}>残り保留: {hit.remainingHolds}個</div>}
                          {!hit.restartRotation&&<div style={{ fontSize:11, color:C.textMuted, marginTop:3 }}>⚠️ 再スタート回転未入力</div>}
                        </div>
                        <div style={{ display:'flex', gap:6, flexShrink:0, marginLeft:8 }}>
                          <button onClick={()=>openHitEdit(hit)}
                            style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.primaryMid}`,background:C.primaryLight,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',color:C.primary,fontSize:13,fontWeight:700 }}>✏️</button>
                          <button onClick={()=>removeFirstHit(hit.id)}
                            style={{ width:34,height:34,borderRadius:10,border:`1px solid ${C.border}`,background:C.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}><Trash2 size={15} color={C.textMuted}/></button>
                        </div>
                      </div>
                    ))}

                    {/* 初当たり記録 編集ダイアログ */}
                    {editingHitId&&(()=>{
                      const targetHit=(form.firstHits||[]).find(h=>h.id===editingHitId);
                      if(!targetHit) return null;
                      return (
                        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={()=>setEditingHitId(null)}>
                          <div style={{ background:C.card, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
                            <div style={{ padding:'16px 18px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                              <div>
                                <div style={{ fontWeight:800, fontSize:15, color:C.textPrimary }}>✏️ {targetHit.label} を修正</div>
                                <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>記録を後から修正できるぜ</div>
                              </div>
                              <button onClick={()=>setEditingHitId(null)} style={{ background:'none', border:'none', fontSize:20, color:C.textMuted, cursor:'pointer' }}>✕</button>
                            </div>
                            <div style={{ overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'16px 18px', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
                              {/* 再スタート回転（救済の主目的） */}
                              <div style={{ background:isDark?'rgba(99,102,241,0.1)':C.primaryLight, border:`1.5px solid ${C.primaryMid}`, borderRadius:14, padding:'14px 16px' }}>
                                <div style={{ fontWeight:700, fontSize:13, color:C.primary, marginBottom:10 }}>🔄 再スタート回転（よく忘れるやつ）</div>
                                <div>
                                  <label style={labelStyle}>再スタート回転数</label>
                                  <input value={hitEditForm.restartRotation}
                                    onChange={e=>{
                                      const v=e.target.value;
                                      setHitEditForm(p=>({...p,restartRotation:v,
                                        ...(numberOrZero(p.chainCount)<=1&&numberOrZero(v)>0?{restartReason:'jitan'}:{}),
                                        ...(numberOrZero(p.chainCount)<=1&&numberOrZero(v)<=0?{restartReason:'single'}:{}),
                                      }));
                                    }}
                                    style={{ ...inputStyle, fontSize:20, textAlign:'center', fontWeight:700, color:C.primary, padding:'12px' }}
                                    inputMode="numeric" placeholder="例: 153"/>
                                </div>
                                <div style={{ marginTop:10 }}>
                                  <label style={labelStyle}>再スタート理由</label>
                                  <Select value={hitEditForm.restartReason} onValueChange={v=>setHitEditForm(p=>({...p,restartReason:v}))}>
                                    <SelectTrigger className="rounded-2xl h-11"><span>{getRestartReasonLabel(hitEditForm.restartReason,hitEditForm.restartReasonNote)}</span></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="single">単発後</SelectItem>
                                      <SelectItem value="st">確変/ST後</SelectItem>
                                      <SelectItem value="jitan">時短抜け後</SelectItem>
                                      <SelectItem value="other">その他</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  {hitEditForm.restartReason==='other'&&<input value={hitEditForm.restartReasonNote} onChange={e=>setHitEditForm(p=>({...p,restartReasonNote:e.target.value}))} style={{ ...inputStyle, marginTop:6 }} placeholder="理由メモ"/>}
                                </div>
                              </div>
                              {/* その他の項目 */}
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                <div>
                                  <label style={labelStyle}>合計R数</label>
                                  <input value={hitEditForm.rounds} onChange={e=>setHitEditForm(p=>({...p,rounds:e.target.value}))} style={{ ...inputStyle, textAlign:'center', fontWeight:700 }} inputMode="numeric"/>
                                </div>
                                <div>
                                  <label style={labelStyle}>連チャン数</label>
                                  <input value={hitEditForm.chainCount} onChange={e=>setHitEditForm(p=>({...p,chainCount:e.target.value}))} style={{ ...inputStyle, textAlign:'center', fontWeight:700 }} inputMode="numeric"/>
                                </div>
                                <div>
                                  <label style={labelStyle}>初当たりゲーム数</label>
                                  <input value={hitEditForm.hitSpins} onChange={e=>setHitEditForm(p=>({...p,hitSpins:e.target.value}))} style={{ ...inputStyle, textAlign:'center' }} inputMode="numeric" placeholder="任意"/>
                                </div>
                                <div>
                                  <label style={labelStyle}>残り保留数</label>
                                  <input value={hitEditForm.remainingHolds} onChange={e=>setHitEditForm(p=>({...p,remainingHolds:e.target.value}))} style={{ ...inputStyle, textAlign:'center' }} inputMode="numeric" placeholder="任意"/>
                                </div>
                              </div>
                              <div>
                                <label style={labelStyle}>メモ</label>
                                <input value={hitEditForm.notes} onChange={e=>setHitEditForm(p=>({...p,notes:e.target.value}))} style={inputStyle} placeholder="備考など…"/>
                              </div>
                            </div>
                            <div style={{ padding:'12px 18px 24px', borderTop:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                              <button onClick={()=>setEditingHitId(null)}
                                style={{ padding:'13px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                                キャンセル
                              </button>
                              <button onClick={saveHitEdit}
                                style={{ padding:'13px', borderRadius:14, border:'none', background:C.primary, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                                💾 保存する
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {/* 引き継ぎメモ（引き継ぎ時のみ表示） */}
                  {form.inheritNotes&&(
                    <div style={{ background:isDark?'rgba(99,102,241,0.12)':'#eef2ff', border:`1px solid #c7d2fe`, borderRadius:14, padding:'10px 14px' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.primary, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span>🔗 引き継ぎ情報</span>
                        <button onClick={()=>applyFormUpdate(p=>({...p,inheritNotes:''}))} style={{ background:'none', border:'none', fontSize:11, color:C.textMuted, cursor:'pointer' }}>✕ 消す</button>
                      </div>
                      {form.inheritNotes.split('\n').filter(Boolean).map((line,i)=>(
                        <div key={i} style={{ fontSize:12, color:isDark?'#a5b4fc':C.primary, lineHeight:'1.8' }}>{line}</div>
                      ))}
                    </div>
                  )}

                  {/* 初当たり記録テーブル（自動生成・読み取り専用） */}
                  {(form.firstHits||[]).length>0&&(
                    <div style={{ border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                      <div style={{ fontSize:11, fontWeight:700, color:C.textPrimary, padding:'8px 14px', background:isDark?'rgba(255,255,255,0.05)':'#f8fafc', borderBottom:`1px solid ${C.border}` }}>
                        ⭐ 初当たり記録（{form.firstHits.length}回）
                      </div>
                      <div style={{ overflowX:'auto' }}>
                        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                          <thead>
                            <tr style={{ background:isDark?'rgba(255,255,255,0.03)':'#f8fafc' }}>
                              {['回目','R数','獲得玉','1R','連チャン','時間'].map(h=>(
                                <th key={h} style={{ padding:'6px 8px', textAlign:'center', color:C.textMuted, fontWeight:600, borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {form.firstHits.map((hit,i)=>(
                              <tr key={hit.id} style={{ borderBottom:i<form.firstHits.length-1?`1px solid ${C.border}`:'none', background:i%2===0?(isDark?'rgba(255,255,255,0.02)':'#fafafa'):'transparent' }}>
                                <td style={{ padding:'7px 8px', textAlign:'center', color:C.textMuted, fontWeight:600 }}>{i+1}</td>
                                <td style={{ padding:'7px 8px', textAlign:'center', fontWeight:700, color:C.textPrimary }}>{hit.rounds}R</td>
                                <td style={{ padding:'7px 8px', textAlign:'center', color:C.positive }}>{Math.round(hit.gainedBalls).toLocaleString()}</td>
                                <td style={{ padding:'7px 8px', textAlign:'center', color:C.accent }}>{hit.oneRound>0?hit.oneRound.toFixed(1):'-'}</td>
                                <td style={{ padding:'7px 8px', textAlign:'center', color:C.textSecondary, whiteSpace:'nowrap' }}>{hit.chainResultLabel||'単発'}</td>
                                <td style={{ padding:'7px 8px', textAlign:'center', color:C.textMuted, whiteSpace:'nowrap' }}>
                                  {hit.chainTimeSec>0
                                    ? hit.chainTimeSec>=60
                                      ? `${Math.floor(hit.chainTimeSec/60)}分${hit.chainTimeSec%60}秒`
                                      : `${hit.chainTimeSec}秒`
                                    : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 1万円ごとの回転率（開閉式） */}
                  {(()=>{
                    // rateEntries + rateSections + measurementLogs から1万円ごとの区切りを生成
                    const allPoints=[...(form.rateHistoryPoints||[]),...(()=>{
                      const archived=form.rateHistoryPoints||[];
                      let baseSpins=archived.length?numberOrZero(archived[archived.length-1].totalSpins):0;
                      let baseCashInvestYen=archived.length?numberOrZero(archived[archived.length-1].cashInvestYen):0;
                      let baseBallInvestYen=archived.length?numberOrZero(archived[archived.length-1].ballInvestYen):0;
                      let prevReading=numberOrZero(form.startRotation);
                      return (form.rateEntries||[]).flatMap((entry,index)=>{
                        const reading=numberOrZero(entry.reading);
                        if(!(reading>0&&reading>=prevReading)) return [];
                        const amount=numberOrZero(entry.amount),spins=reading-prevReading;
                        if(entry.kind==='balls') baseBallInvestYen+=amount*4; else baseCashInvestYen+=amount;
                        baseSpins+=spins; prevReading=reading;
                        const totalInvestYen=baseCashInvestYen+baseBallInvestYen;
                        return [{totalSpins:baseSpins,cashInvestYen:baseCashInvestYen,ballInvestYen:baseBallInvestYen,totalInvestYen}];
                      });
                    })()];
                    if(allPoints.length<2) return null;
                    // 1万円ごとに区切ってスピン数を集計
                    const segments=[];
                    let segIdx=1;
                    let prevThreshold=0;
                    let prevSpins=0;
                    allPoints.forEach(p=>{
                      while(p.totalInvestYen>=segIdx*10000){
                        const threshold=segIdx*10000;
                        // 線形補間でspinsを推定
                        const prevP=allPoints.filter(x=>x.totalInvestYen<threshold).slice(-1)[0];
                        const nextP=allPoints.find(x=>x.totalInvestYen>=threshold);
                        if(prevP&&nextP&&nextP.totalInvestYen>prevP.totalInvestYen){
                          const ratio=(threshold-prevP.totalInvestYen)/(nextP.totalInvestYen-prevP.totalInvestYen);
                          const spinsAtThreshold=prevP.totalSpins+(nextP.totalSpins-prevP.totalSpins)*ratio;
                          const segSpins=Math.round(spinsAtThreshold-prevSpins);
                          segments.push({label:`${segIdx}万円目`,spins:segSpins,rate:segSpins/10});
                          prevSpins=spinsAtThreshold;
                        }
                        segIdx++;
                      }
                    });
                    // 最後の区間（端数）
                    const lastP=allPoints[allPoints.length-1];
                    const remainInvest=lastP.totalInvestYen%(10000);
                    if(remainInvest>0&&lastP.totalSpins>prevSpins){
                      const segSpins=Math.round(lastP.totalSpins-prevSpins);
                      segments.push({label:`${segIdx}万円目(途中)`,spins:segSpins,rate:segSpins/(remainInvest/1000)});
                    }
                    if(segments.length===0) return null;
                    const avgRate=segments.reduce((a,s)=>a+s.rate,0)/segments.length;
                    const border=formMetrics.machineBorder||0;
                    return (
                      <details style={{ border:`1px solid ${C.border}`, borderRadius:14, overflow:'hidden' }}>
                        <summary style={{ cursor:'pointer', listStyle:'none', padding:'12px 14px', background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <div style={{ fontWeight:700, fontSize:13, color:C.textPrimary }}>💴 1万円ごとの回転率</div>
                          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                            <span style={{ fontSize:12, color:C.textMuted }}>{segments.length}区間 / 平均 <b style={{ color:C.accent }}>{fmtRate(avgRate)}</b></span>
                            <ChevronDown size={14} color={C.textMuted}/>
                          </div>
                        </summary>
                        <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                          {segments.map((seg,i)=>{
                            const diff=seg.rate-border;
                            const good=border>0?diff>=0:seg.rate>=avgRate;
                            return (
                              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:good?(isDark?'rgba(16,185,129,0.08)':'#f0fdf4'):(isDark?'rgba(239,68,68,0.08)':'#fef2f2'), border:`1px solid ${good?C.positiveBorder:C.negativeBorder}`, borderRadius:10, padding:'8px 12px' }}>
                                <div style={{ fontSize:12, color:C.textSecondary, fontWeight:600 }}>{seg.label}</div>
                                <div style={{ display:'flex', gap:12, alignItems:'center' }}>
                                  <span style={{ fontSize:11, color:C.textMuted }}>{seg.spins.toLocaleString()}回転</span>
                                  <span style={{ fontSize:16, fontWeight:800, color:good?C.positive:C.negative }}>{fmtRate(seg.rate)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </details>
                    );
                  })()}

                  {/* 自由メモ */}
                  <div>
                    <label style={labelStyle}>自由メモ</label>
                    <Textarea value={form.freeMemo||''} onChange={e=>updateForm('freeMemo',e.target.value)} className="rounded-2xl min-h-[70px]" placeholder="感想・気づきなど自由に書けるぜ"/>
                  </div>
                </div>

                {/* 下部アクションバー */}
                <div style={{ position:'sticky', bottom:4, zIndex:20, display:'flex', flexDirection:'column', gap:6 }}>
                  {/* 保存状態 + 戻るボタン */}
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:isDark?'rgba(15,23,42,0.96)':'rgba(255,255,255,0.96)', border:`1px solid ${C.border}`, borderRadius:14, padding:'7px 12px', backdropFilter:'blur(12px)' }}>
                    <span style={{ fontSize:12, fontWeight:600, color:saveStatusMeta.color }}>{saveStatusMeta.label}</span>
                    <button onClick={undoLastChange} disabled={!undoStack.length}
                      style={{ ...btnOutline, padding:'5px 12px', fontSize:11, opacity:undoStack.length?1:0.35, display:'flex', alignItems:'center', gap:4 }}>
                      <span>↩ 戻す</span>
                      {undoStack.length>0&&(
                        <span style={{ background:C.primary, color:'white', borderRadius:8, fontSize:10, fontWeight:700, padding:'1px 5px' }}>
                          {undoStack.length}
                        </span>
                      )}
                    </button>
                  </div>
                  {/* メインボタン2つ（大） */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <button onClick={openFirstHitDialog}
                      style={{ ...btnSecondary, padding:'14px', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, borderRadius:16 }}>
                      <Star size={18}/> 初当たり
                    </button>
                    <button onClick={openCompleteDialog}
                      style={{ ...btnPrimary, padding:'14px', fontSize:14, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, borderRadius:16 }}>
                      <CheckCircle2 size={18}/> 終了
                    </button>
                  </div>
                  {/* サブボタン：台移動のみ */}
                  <div style={{ display:'flex', justifyContent:'center' }}>
                    <button onClick={()=>setTableMoveConfirmOpen(true)}
                      style={{ ...btnSecondary, padding:'10px 32px', fontSize:13, fontWeight:700, display:'flex', alignItems:'center', gap:6, borderRadius:14 }}>
                      <span style={{ fontSize:16 }}>🚶</span><span>台移動</span>
                    </button>
                  </div>

                  {/* 台移動確認ダイアログ */}
                  {tableMoveConfirmOpen&&(
                    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                      <div style={{ background:C.card, borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:360 }}>
                        <div style={{ textAlign:'center', marginBottom:16 }}>
                          <div style={{ fontSize:36, marginBottom:8 }}>🚶</div>
                          <div style={{ fontWeight:800, fontSize:17, color:C.textPrimary, marginBottom:6 }}>台移動</div>
                          <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.6 }}>
                            現在の記録を<b>完了</b>として保存し<br/>
                            同日・同店舗で新しい台の記録を始めます。
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <button onClick={()=>setTableMoveConfirmOpen(false)}
                            style={{ padding:13, borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                            キャンセル
                          </button>
                          <button onClick={executeTableMove}
                            style={{ padding:13, borderRadius:14, border:'none', background:C.primary, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                            🚶 移動する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 損切りアラートダイアログ */}
                  {stopLossAlertOpen&&(
                    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                      <div style={{ background:C.card, borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:360, border:`2px solid ${C.negativeBorder}` }}>
                        <div style={{ textAlign:'center', marginBottom:16 }}>
                          <div style={{ fontSize:40, marginBottom:8 }}>⚠️</div>
                          <div style={{ fontWeight:800, fontSize:18, color:C.negative, marginBottom:8 }}>損切りライン到達</div>
                          <div style={{ fontSize:28, fontWeight:900, color:C.negative, marginBottom:8 }}>{fmtYen(formMetrics.balanceYen)}</div>
                          <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.6 }}>
                            設定した損切りライン<b>{fmtYen(numberOrZero(settings.stopLossYen))}</b>に達しました。
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <button onClick={()=>{setStopLossAlertOpen(false); openCompleteDialog();}}
                            style={{ padding:13, borderRadius:14, border:'none', background:C.negative, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                            やめる（終了する）
                          </button>
                          <button onClick={()=>setStopLossAlertOpen(false)}
                            style={{ padding:12, borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            続行する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 連続ボーダー以下アラートダイアログ */}
                  {belowBorderAlertOpen&&(
                    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:1001, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                      <div style={{ background:C.card, borderRadius:24, padding:'24px 20px', width:'100%', maxWidth:360, border:`2px solid ${C.amberBorder}` }}>
                        <div style={{ textAlign:'center', marginBottom:16 }}>
                          <div style={{ fontSize:40, marginBottom:8 }}>🤔</div>
                          <div style={{ fontWeight:800, fontSize:18, color:C.amber, marginBottom:8 }}>やめ候補</div>
                          <div style={{ fontSize:26, fontWeight:900, color:C.negative, marginBottom:8 }}>{fmtRate(formMetrics.avgSpinPerThousand)}<span style={{ fontSize:14 }}>回/千円</span></div>
                          <div style={{ fontSize:13, color:C.textMuted, lineHeight:1.7 }}>
                            <b>{Math.round(formMetrics.totalSpins).toLocaleString()}回転</b>でボーダー<b>{fmtRate(formMetrics.machineBorder)}</b>を<br/>
                            下回り続けています。<br/>
                            台移動や撤退を検討してみてはどうだぜ？
                          </div>
                        </div>
                        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                          <button onClick={()=>{setBelowBorderAlertOpen(false); setTableMoveConfirmOpen(true);}}
                            style={{ padding:13, borderRadius:14, border:'none', background:C.amber, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                            🚶 台移動する
                          </button>
                          <button onClick={()=>{setBelowBorderAlertOpen(false); openCompleteDialog();}}
                            style={{ padding:12, borderRadius:14, border:`1px solid ${C.negativeBorder}`, background:C.card, color:C.negative, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            終了する
                          </button>
                          <button onClick={()=>setBelowBorderAlertOpen(false)}
                            style={{ padding:12, borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            続行する
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 結果ダイアログ */}
                <Dialog open={resultDialogOpen} onOpenChange={setResultDialogOpen}>
                  <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                    <DialogHeader><DialogTitle className="text-base">稼働結果</DialogTitle></DialogHeader>
                    {/* フォーカス受け皿（キーボード自動表示防止） */}
                    <span tabIndex={0} style={{ position:'absolute', opacity:0, pointerEvents:'none', width:0, height:0 }} aria-hidden="true"/>
                    <div className="space-y-2 max-h-[82vh] overflow-y-auto pr-1">
                      {/* 時刻サマリー */}
                      {(form.startTime||form.endTime)&&(
                        <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'8px 12px', display:'flex', justifyContent:'space-around', alignItems:'center' }}>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>打ち始め</div>
                            <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{form.startTime||'--:--'}</div>
                          </div>
                          <div style={{ fontSize:14, color:C.textMuted }}>→</div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>終了</div>
                            <div style={{ fontSize:18, fontWeight:800, color:C.primary }}>{form.endTime||'--:--'}</div>
                          </div>
                          <div style={{ textAlign:'center' }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>稼働</div>
                            <div style={{ fontSize:14, fontWeight:800, color:C.accent }}>{fmtElapsed(calcElapsedHours(form.startTime,form.endTime))||'-'}</div>
                          </div>
                        </div>
                      )}
                      {/* 指標4枚 */}
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['総回転数',`${Math.round(resultPreviewMetrics.totalSpins)}回`,`回転率 ${fmtRate(resultPreviewMetrics.spinPerThousand)}`,null],
                          ['1R出玉',selectedMachine?fmtRate(selectedMachine.payoutPerRound):'-',`持ち玉比率 ${fmtRate(resultPreviewMetrics.holdBallRatio)}%`,null],
                          ['期待値',fmtYen(resultPreviewMetrics.estimatedEVYen),null,resultPreviewMetrics.estimatedEVYen>=0],
                          ['収支',fmtYen(resultPreviewMetrics.balanceYen),null,resultPreviewMetrics.balanceYen>=0],
                        ].map(([t,v,s,pos])=>(
                          <div key={t} style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 12px' }}>
                            <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{t}</div>
                            <div style={{ fontSize:16, fontWeight:700, marginTop:2, color:pos===null||pos===undefined?C.textPrimary:pos?C.positive:C.negative }}>{v}</div>
                            {s&&<div style={{ fontSize:10, color:C.textMuted, marginTop:1 }}>{s}</div>}
                          </div>
                        ))}
                      </div>
                      {/* 投資サマリー */}
                      {(()=>{
                        const cashInv=resultPreviewMetrics.cashInvestYen||0;
                        const ballInvBalls=resultPreviewMetrics.ballInvestBalls||0;
                        const ballInvYen=resultPreviewMetrics.ballInvestYen||0;
                        const totalInv=cashInv+ballInvYen;
                        if(totalInv<=0) return null;
                        return (
                          <div style={{ background:isDark?'rgba(255,255,255,0.04)':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:14, padding:'10px 14px' }}>
                            <div style={{ fontSize:11, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>💴 投資内訳</div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                              {[
                                ['現金投資', fmtYen(cashInv), C.textPrimary],
                                ['玉投資', ballInvBalls>0?`${Math.round(ballInvBalls).toLocaleString()}玉`:'0玉', ballInvBalls>0?C.amber:C.textMuted],
                                ['総投資', fmtYen(Math.round(totalInv)), C.primary],
                              ].map(([l,v,c])=>(
                                <div key={l} style={{ textAlign:'center' }}>
                                  <div style={{ fontSize:10, color:C.textMuted, fontWeight:600 }}>{l}</div>
                                  <div style={{ fontSize:13, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
                                  {l==='玉投資'&&ballInvYen>0&&<div style={{ fontSize:9, color:C.textMuted }}>{fmtYen(Math.round(ballInvYen))}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      {/* 終了時持ち玉（自動入力・編集可） */}
                      <div>
                        <Label className="text-xs">終了時持ち玉（自動入力）</Label>
                        <Input
                          value={form.endingBalls!==''?form.endingBalls:(formMetrics.currentBalls!==null?String(formMetrics.currentBalls):'')}
                          onChange={e=>updateForm('endingBalls',e.target.value)}
                          className="mt-1 rounded-xl h-9 text-sm"
                          inputMode="numeric"
                          placeholder={formMetrics.currentBalls!==null?String(formMetrics.currentBalls):'0'}
                          autoComplete="off"
                        />
                        {formMetrics.currentBalls!==null&&<div style={{ fontSize:10, color:C.textMuted, marginTop:3 }}>持ち玉 {formMetrics.currentBalls.toLocaleString()}玉 から自動入力。変更する場合は直接入力してください。</div>}
                      </div>
                      {/* グラフ切替 */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant={showResultRateGraph?'default':'outline'} className="rounded-xl h-8 text-xs" onClick={()=>setShowResultRateGraph(p=>!p)}>回転率グラフ</Button>
                        <Button variant={showMoneySwitchGraph?'default':'outline'} className="rounded-xl h-8 text-xs" onClick={()=>setShowMoneySwitchGraph(p=>!p)}>持ち玉/現金グラフ</Button>
                      </div>
                      {showResultRateGraph&&<div className="rounded-xl border p-2"><div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={sessionTrendData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis domain={[10,25]} tick={{fontSize:10}}/><Tooltip/><ReferenceLine y={resultPreviewMetrics.machineBorder||0} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{value:"B",position:"right",fontSize:9,fill:"#ef4444"}}/><Line type="monotone" dataKey="rate" strokeWidth={2} dot={false} stroke={C.accent} name="累積回転率"/></LineChart></ResponsiveContainer></div></div>}
                      {showMoneySwitchGraph&&<div className="rounded-xl border p-2"><div className="h-36"><ResponsiveContainer width="100%" height="100%"><LineChart data={moneySwitchData}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="label" tick={{fontSize:10}}/><YAxis tick={{fontSize:10}}/><Tooltip/><Line type="monotone" dataKey="cashInvestYen" stroke={C.accent} strokeWidth={2} dot={false} name="現金投資"/><Line type="monotone" dataKey="ballInvestYen" stroke={C.positive} strokeWidth={2} dot={false} name="持ち玉換算"/></LineChart></ResponsiveContainer></div></div>}
                      {/* メモ */}
                      <div><Label className="text-xs">良かった点</Label><Textarea value={form.resultGoodMemo} onChange={e=>updateForm('resultGoodMemo',e.target.value)} className="mt-1 min-h-[56px] rounded-xl text-sm" placeholder="回った点、釘が良かった点など"/></div>
                      <div><Label className="text-xs">悪かった点 / やめ理由</Label><Textarea value={form.resultBadMemo} onChange={e=>updateForm('resultBadMemo',e.target.value)} className="mt-1 min-h-[56px] rounded-xl text-sm" placeholder="ヘソが閉まった、寄りが悪いなど"/></div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="secondary" className="rounded-xl h-10" onClick={()=>setResultDialogOpen(false)}>戻る</Button>
                        <Button className="rounded-xl h-10 text-sm font-bold" onClick={finalizeSession}>保存して終了</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>
        )}
        {/* ══════════════════ 稼働判定タブ ══════════════════ */}
        {activeTab==='judge'&&(()=>{
          // ── ボーダーライン算出ロジック ──
          const bc=borderCalc;
          // 係数：等価250 / 玉数×10（1000円で買える玉数）
          const COEFF={'25':250,'26':260,'27':270,'27.5':275,'28':280,'29':290,'30':300,'31':310,'32':320,'33':330,'34':340,'35':350,'40':400,'45':450};
          const coeff=COEFF[bc.exchangeCategory]||250;
          const oneR=numberOrZero(bc.oneRoundPayout);
          const totalRateDenom=numberOrZero(bc.totalRatePer1R);
          // 等価ボーダー = 係数 / (1R平均出玉 / 1Rトータル確率分母)
          const equivBorder=(oneR>0&&totalRateDenom>0)
            ? 250/(oneR/totalRateDenom) : 0;
          const cashBorder=(oneR>0&&totalRateDenom>0)
            ? coeff/(oneR/totalRateDenom) : 0;
          // 持ち玉比率考慮ボーダー
          const holdRatio=numberOrZero(bc.holdBallRatioInput)/100;
          const mixedBorder=(equivBorder>0&&cashBorder>0)
            ? equivBorder*holdRatio + cashBorder*(1-holdRatio) : cashBorder;
          // 現在の回転率（回転率タブから連携）
          const currentRate=formMetrics.avgSpinPerThousand||0;
          const displayBorder=bc.exchangeCategory==='25'?equivBorder:mixedBorder;
          // 稼働想定：選択時間 × 通常回転200回/h
          const spinsPerH=numberOrZero(settings.spinsPerHour)||200;
          const planHours=bc.planHours||4;
          const planSpins=planHours*spinsPerH;
          function calcEVForRate(rate){
            if(rate<=0) return null;
            const exchangeRate=getExchangePreset(bc.exchangeCategory||'25').yenPerBall;
            // 1R出玉とトータル確率が入力されている場合は正確な式で計算
            if(oneR>0&&totalRateDenom>0){
              // 1回転あたりの期待出玉 = 1R出玉 ÷ 確率分母（= 平均大当たり間隔）
              const payoutPerSpin = oneR / totalRateDenom;
              // 持ち玉1回転単価（円）= (期待出玉 − 250÷回転率) × 換金率
              const holdEvPerSpin = (payoutPerSpin - 250 / rate) * exchangeRate;
              // 現金1回転単価（円）= 期待出玉 × 換金率 − 1000÷回転率
              const cashEvPerSpin = payoutPerSpin * exchangeRate - 1000 / rate;
              // 混合EV = (持ち玉単価×持ち玉比率 + 現金単価×現金比率) × 総回転数
              const mixedEvPerSpin = holdRatio * holdEvPerSpin + (1 - holdRatio) * cashEvPerSpin;
              return mixedEvPerSpin * planSpins;
            }
            // 入力不足の場合はボーダー差分による近似
            if(displayBorder<=0) return null;
            const investYen=(planSpins/rate)*1000;
            return calcEvYenFromRate(rate,displayBorder,investYen,settings);
          }
          // ボーダー算出用に選んだ機種
          const borderMachine=bc.selectedBorderMachineId
            ? machines.find(m=>m.id===bc.selectedBorderMachineId)||null
            : selectedMachine;
          // 表示する整数レンジ
          // 通常: ボーダー-5 〜 33回転固定 / 拡張: ボーダー-10 〜 33回転固定
          const maxRange=bc.showExtended?10:5;
          const intRows=[];
          if(displayBorder>0){
            const base=Math.floor(displayBorder);
            const minVal=Math.max(1, base-maxRange);
            const maxVal=Math.max(33, base+maxRange+1); // 必ず33回転まで表示
            for(let v=minVal;v<=maxVal;v++){
              intRows.push(v);
            }
          }

          return (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* ヘッダー */}
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,#7c3aed,#4f46e5)`, padding:'16px 18px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <Gauge size={22} color="white"/>
                  <div>
                    <div style={{ fontSize:18, fontWeight:800, color:'white' }}>ボーダーライン算出</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.75)', marginTop:2 }}>1R平均出玉 × トータル確率から正確に算出するぜ</div>
                  </div>
                </div>
              </div>
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>

                {/* 計算式説明 */}
                <div style={{ background:C.accentLight, border:`1px solid #bae6fd`, borderRadius:12, padding:'11px 14px', fontSize:12, color:'#0369a1', lineHeight:1.7 }}>
                  <div style={{ fontWeight:700, marginBottom:4 }}>📐 算出式（正確なボーダーライン）</div>
                  <div>等価(25個)： <b>250 ÷ (1R平均出玉 ÷ 1Rトータル確率分母)</b></div>
                  <div>非等価28個： <b>280 ÷ (1R平均出玉 ÷ 1Rトータル確率分母)</b></div>
                  <div>非等価30個： <b>300 ÷ 〃</b> ／ 非等価33個： <b>330 ÷ 〃</b></div>
                  <div style={{ marginTop:4 }}>持ち玉考慮： <b>等価B×持ち玉比率 + 現金B×(1−持ち玉比率)</b></div>
                </div>

                {/* 機種から呼び出し（検索型） */}
                <div>
                  <label style={labelStyle}>📦 登録機種から呼び出す</label>
                  {/* 選択中の機種表示 */}
                  {borderMachine&&(
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8, background:'#f5f3ff', border:'1.5px solid #c4b5fd', borderRadius:12, padding:'8px 12px' }}>
                      <span style={{ fontSize:13, fontWeight:700, color:'#7c3aed', flex:1 }}>✅ {borderMachine.name}</span>
                      <button onClick={()=>setBorderCalc(p=>({...p,selectedBorderMachineId:'__none__',oneRoundPayout:'',totalRatePer1R:''}))} style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:12 }}>✕ 解除</button>
                    </div>
                  )}
                  {/* 検索ボックス */}
                  <div style={{ position:'relative' }}>
                    <input
                      value={borderMachineSearchQuery}
                      onChange={e=>setBorderMachineSearchQuery(e.target.value)}
                      style={{ ...inputStyle, paddingLeft:36 }}
                      placeholder="機種名を入力して検索…"
                    />
                    <Search size={15} color={C.textMuted} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                  </div>
                  {/* サジェスト */}
                  {borderMachineSearchQuery.trim()&&(()=>{
                    const q=borderMachineSearchQuery.trim();
                    const hits=machines.filter(m=>fuzzyMatchMachine(m,q)).slice(0,8);
                    return hits.length>0?(
                      <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden', marginTop:4 }}>
                        {hits.map((m,i)=>{
                          const isSel=bc.selectedBorderMachineId===m.id||(bc.selectedBorderMachineId===''&&selectedMachine?.id===m.id);
                          return (
                            <button key={m.id} onClick={()=>{setBorderCalc(p=>({...p,selectedBorderMachineId:m.id,oneRoundPayout:String(m.payoutPerRound||''),totalRatePer1R:m.totalProbability>0?String(m.totalProbability):''}));setBorderMachineSearchQuery('');}}
                              style={{ width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', border:'none', borderBottom:i<hits.length-1?`1px solid ${C.border}`:'none', background:isSel?'#f5f3ff':'white', cursor:'pointer', textAlign:'left' }}>
                              <span style={{ fontSize:13, fontWeight:isSel?700:400, color:isSel?'#7c3aed':C.textPrimary }}>{m.name}</span>
                              {m.totalProbability>0&&<span style={{ fontSize:10, color:'#9333ea', background:isDark?'rgba(147,51,234,0.12)':'#fdf4ff', borderRadius:6, padding:'2px 6px' }}>確率✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    ):(
                      <div style={{ marginTop:4, fontSize:12, color:C.textMuted, padding:'6px 12px' }}>一致する機種が見つからないぜ</div>
                    );
                  })()}
                  {/* 直近7件 */}
                  {!borderMachineSearchQuery.trim()&&(
                    <div style={{ marginTop:8 }}>
                      <div style={{ fontSize:11, color:C.textMuted, marginBottom:6, fontWeight:600 }}>🕐 直近の機種（最大7件）</div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                        {recentMachinePresets.map(m=>{
                          const isSel=bc.selectedBorderMachineId===m.id||(bc.selectedBorderMachineId===''&&selectedMachine?.id===m.id);
                          return (
                            <button key={m.id} onClick={()=>setBorderCalc(p=>({...p,selectedBorderMachineId:m.id,oneRoundPayout:String(m.payoutPerRound||''),totalRatePer1R:m.totalProbability>0?String(m.totalProbability):''}))}
                              style={{ padding:'6px 12px', borderRadius:10, border:`1.5px solid ${isSel?'#7c3aed':C.border}`, background:isSel?'#7c3aed':'white', color:isSel?'white':C.textSecondary, fontWeight:isSel?700:500, fontSize:12, cursor:'pointer' }}>
                              {m.name.length>12?m.name.slice(0,12)+'…':m.name}
                              {m.totalProbability>0&&<span style={{ marginLeft:4, fontSize:10, opacity:0.8 }}>✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>✓マークは確率が登録済みの機種。</div>
                </div>

                {/* 交換率切替 */}
                <div>
                  <label style={labelStyle}>交換率</label>
                  <Select value={bc.exchangeCategory} onValueChange={v=>{
                    const holdRatio=Math.round(formMetrics.holdBallRatio);
                    setBorderCalc(p=>({
                      ...p,
                      exchangeCategory:v,
                      holdBallRatioInput: v!=='25' && (!p.holdBallRatioInput||p.holdBallRatioInput==='0') && holdRatio>0
                        ? String(holdRatio)
                        : p.holdBallRatioInput,
                    }));
                  }}>
                    <SelectTrigger className="rounded-2xl"><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {EXCHANGE_ORDER.map(v=><SelectItem key={v} value={v}>{getExchangePreset(v).label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* 入力欄 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={labelStyle}>1R平均出玉（玉）</label>
                    <input value={bc.oneRoundPayout} onChange={e=>setBorderCalc(p=>({...p,oneRoundPayout:e.target.value}))}
                      style={inputStyle} inputMode="decimal" placeholder="例: 140"/>
                    {/* 初当たり実測平均があれば優先表示 */}
                    {avgOneRoundFromHits!==null&&(
                      <div style={{ fontSize:11, color:C.amber, marginTop:4, fontWeight:600 }}>
                        🎰 初当たり実測平均: {fmtRate(avgOneRoundFromHits)}玉（{(form.firstHits||[]).filter(h=>h.oneRound>0).length}回）
                        <button onClick={()=>setBorderCalc(p=>({...p,oneRoundPayout:String(avgOneRoundFromHits)}))}
                          style={{ marginLeft:6, background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:11, fontWeight:600 }}>取り込む</button>
                      </div>
                    )}
                    {borderMachine&&<div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>
                      機種登録値: {fmtRate(borderMachine.payoutPerRound)}玉
                      <button onClick={()=>setBorderCalc(p=>({...p,oneRoundPayout:String(borderMachine.payoutPerRound||'')}))}
                        style={{ marginLeft:6, background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:11, fontWeight:600 }}>取り込む</button>
                    </div>}
                  </div>
                  <div>
                    <label style={labelStyle}>1Rトータル確率（分母）</label>
                    <input value={bc.totalRatePer1R} onChange={e=>setBorderCalc(p=>({...p,totalRatePer1R:e.target.value}))}
                      style={inputStyle} inputMode="decimal" placeholder="例: 9.49"/>
                    {borderMachine&&borderMachine.totalProbability>0&&<div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>
                      機種登録値: {fmtRate(borderMachine.totalProbability)}
                      <button onClick={()=>setBorderCalc(p=>({...p,totalRatePer1R:String(borderMachine.totalProbability||'')}))}
                        style={{ marginLeft:6, background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:11, fontWeight:600 }}>取り込む</button>
                    </div>}
                  </div>
                </div>

                {bc.exchangeCategory!=='25'&&(
                  <div>
                    <label style={labelStyle}>持ち玉比率（%）</label>
                    <input value={bc.holdBallRatioInput} onChange={e=>setBorderCalc(p=>({...p,holdBallRatioInput:e.target.value}))}
                      style={inputStyle} inputMode="decimal" placeholder="例: 60"/>
                    <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>
                      {bc.holdBallRatioInput&&Number(bc.holdBallRatioInput)===Math.round(formMetrics.holdBallRatio)&&formMetrics.holdBallRatio>0
                        ? <span style={{ color:C.positive, fontWeight:600 }}>✅ 回転率タブから自動入力（{bc.holdBallRatioInput}%）</span>
                        : <>入力なし=現金のみ(0%)で計算。<button onClick={()=>setBorderCalc(p=>({...p,holdBallRatioInput:String(Math.round(formMetrics.holdBallRatio))}))}
                            style={{ marginLeft:4, background:'none', border:'none', color:C.accent, cursor:'pointer', fontSize:11, fontWeight:600 }}>回転率から取込（{Math.round(formMetrics.holdBallRatio)}%）</button></>
                      }
                    </div>
                  </div>
                )}

                {/* 回転率連携ボタン */}
                <button onClick={()=>setBorderCalc(p=>({...p,
                  exchangeCategory:form.exchangeCategory||'25',
                  holdBallRatioInput:String(Math.round(formMetrics.holdBallRatio)),
                  selectedBorderMachineId:selectedMachine?.id||p.selectedBorderMachineId,
                  // 初当たり実測平均があれば優先、なければ機種登録値
                  oneRoundPayout:avgOneRoundFromHits!==null?String(avgOneRoundFromHits):(selectedMachine?String(selectedMachine.payoutPerRound||''):p.oneRoundPayout),
                  totalRatePer1R:selectedMachine&&selectedMachine.totalProbability>0?String(selectedMachine.totalProbability):p.totalRatePer1R,
                }))} style={{ ...btnSecondary, width:'100%' }}>
                  🔗 回転率タブの現在値・機種情報を全て取り込む
                  {avgOneRoundFromHits!==null&&<span style={{ fontSize:10, marginLeft:4, color:C.amber }}>（1R実測平均あり）</span>}
                </button>

                {/* 算出結果 */}
                {displayBorder>0&&(
                  <div style={{ background:`linear-gradient(135deg,#f5f3ff,#ede9fe)`, border:`2px solid #c4b5fd`, borderRadius:18, padding:'16px' }}>
                    <div style={{ fontSize:13, color:'#6d28d9', fontWeight:700, marginBottom:12 }}>算出ボーダーライン</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <div style={{ background:C.card, borderRadius:12, padding:'12px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>等価ボーダー</div>
                        <div style={{ fontSize:24, fontWeight:800, color:'#7c3aed', marginTop:4 }}>{fmtRate(equivBorder)}</div>
                        <div style={{ fontSize:10, color:C.textMuted }}>回転/千円</div>
                      </div>
                      {bc.exchangeCategory!=='25'&&(
                        <div style={{ background:C.card, borderRadius:12, padding:'12px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>現金ボーダー({getExchangePreset(bc.exchangeCategory).label})</div>
                          <div style={{ fontSize:24, fontWeight:800, color:C.primary, marginTop:4 }}>{fmtRate(cashBorder)}</div>
                          <div style={{ fontSize:10, color:C.textMuted }}>回転/千円</div>
                        </div>
                      )}
                      {bc.exchangeCategory!=='25'&&holdRatio>0&&(
                        <div style={{ background:C.card, borderRadius:12, padding:'12px', textAlign:'center', gridColumn:'1/-1' }}>
                          <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>持ち玉比率{Math.round(holdRatio*100)}%考慮ボーダー</div>
                          <div style={{ fontSize:28, fontWeight:800, color:'#7c3aed', marginTop:4 }}>{fmtRate(mixedBorder)}</div>
                          <div style={{ fontSize:10, color:C.textMuted }}>回転/千円（メイン判定値）</div>
                        </div>
                      )}
                    </div>
                    {/* 現在の回転率との比較 */}
                    {currentRate>0&&(
                      <div style={{ marginTop:12, background:C.card, borderRadius:12, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div>
                          <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>現在の平均回転率</div>
                          <div style={{ fontSize:22, fontWeight:800, color:C.accent }}>{fmtRate(currentRate)}</div>
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>ボーダー差</div>
                          <div style={{ fontSize:22, fontWeight:800, color:currentRate>=displayBorder?C.positive:C.negative }}>
                            {currentRate>=displayBorder?'+':''}{(currentRate-displayBorder).toFixed(2)}
                          </div>
                        </div>
                        <div style={{ background:currentRate>=displayBorder?C.positiveBg:C.negativeBg, border:`1.5px solid ${currentRate>=displayBorder?C.positiveBorder:C.negativeBorder}`, borderRadius:10, padding:'8px 14px', fontWeight:800, fontSize:14, color:currentRate>=displayBorder?C.positive:C.negative }}>
                          {currentRate>=displayBorder?'▲ ボーダー超え':'▼ ボーダー未達'}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 期待値テーブル */}
            {displayBorder>0&&(
              <div style={cardStyle}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15, color:C.textPrimary }}>回転率別 期待値一覧</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>ボーダー <b style={{color:'#7c3aed'}}>{fmtRate(displayBorder)}</b> 基準 / {planHours}h（{planSpins}回転）想定 / 最大33回転まで表示</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>行をタップすると0.1刻みの詳細を表示するぜ</div>
                    </div>
                    <button onClick={()=>setBorderCalc(p=>({...p,showExtended:!p.showExtended,expandedIntRows:[]}))}
                      style={{ padding:'8px 14px', borderRadius:10, border:`1.5px solid ${C.primaryMid}`, background:bc.showExtended?C.primary:C.primaryLight, color:bc.showExtended?'white':C.primary, fontWeight:700, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
                      {bc.showExtended?'±5に戻す':'±10まで'}
                    </button>
                  </div>
                  {/* 稼働時間切替ボタン */}
                  <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:2 }}>
                    <div style={{ display:'flex', gap:6, minWidth:'max-content' }}>
                      {Array.from({length:11},(_,i)=>i+1).map(h=>(
                        <button key={h} onClick={()=>setBorderCalc(p=>({...p,planHours:h}))}
                          style={{ padding:'6px 12px', borderRadius:10, border:`2px solid ${bc.planHours===h?'#7c3aed':C.border}`, background:bc.planHours===h?'#7c3aed':C.card, color:bc.planHours===h?'white':C.textSecondary, fontWeight:bc.planHours===h?700:500, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
                          {h}h
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:3 }}>
                  {intRows.map(intRate=>{
                    const evInt=calcEVForRate(intRate);
                    const diffInt=intRate-displayBorder;
                    const isBorderRow=intRate===Math.round(displayBorder);
                    const isExpanded=(bc.expandedIntRows||[]).includes(intRate);
                    const isCurrentInt=Math.round(currentRate)===intRate;

                    return (
                      <div key={intRate}>
                        {/* 整数行（メイン） */}
                        <button
                          onClick={()=>setBorderCalc(p=>({
                            ...p,
                            expandedIntRows: (p.expandedIntRows||[]).includes(intRate)
                              ? (p.expandedIntRows||[]).filter(r=>r!==intRate)
                              : [...(p.expandedIntRows||[]), intRate]
                          }))}
                          style={{ width:'100%', display:'grid', gridTemplateColumns:'80px 1fr 110px 24px', alignItems:'center', gap:8, padding:'11px 12px', borderRadius:isExpanded?'12px 12px 0 0':12, border:`1.5px solid ${isBorderRow?'#7c3aed':evInt>=0?C.positiveBorder:C.negativeBorder}`, background:isBorderRow?'#f5f3ff':evInt>=0?C.positiveBg:C.negativeBg, cursor:'pointer', textAlign:'left', marginBottom:0 }}>
                          <div style={{ fontWeight:800, fontSize:16, color:isBorderRow?'#7c3aed':C.textPrimary }}>
                            {intRate}回
                            {isBorderRow&&<span style={{ fontSize:10, marginLeft:4, color:'#7c3aed' }}>★B</span>}
                            {isCurrentInt&&!isExpanded&&<span style={{ fontSize:10, marginLeft:4, color:C.accent }}>◀現在</span>}
                          </div>
                          <div style={{ height:8, borderRadius:4, background:evInt>=0?C.positiveBorder:C.negativeBorder, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${Math.min(100,Math.abs((diffInt/displayBorder)*100*5))}%`, background:evInt>=0?C.positive:C.negative, borderRadius:4 }}/>
                          </div>
                          <div style={{ textAlign:'right', fontWeight:800, fontSize:16, color:evInt===null?C.textMuted:evInt>=0?C.positive:C.negative }}>
                            {evInt===null?'-':`${evInt>=0?'+':''}${Math.round(evInt).toLocaleString()}円`}
                          </div>
                          <div style={{ fontSize:12, color:C.textMuted, textAlign:'center' }}>{isExpanded?'▲':'▼'}</div>
                        </button>

                        {/* 詳細行（0.1刻み x0〜x9） */}
                        {isExpanded&&(
                          <div style={{ border:`1.5px solid ${isBorderRow?'#7c3aed':evInt>=0?C.positiveBorder:C.negativeBorder}`, borderTop:'none', borderRadius:'0 0 12px 12px', overflow:'hidden', marginBottom:2 }}>
                            {Array.from({length:10},(_,i)=>{
                              const rate=Number((intRate+i*0.1).toFixed(1));
                              const ev=calcEVForRate(rate);
                              const diff=rate-displayBorder;
                              const isBorder=Math.abs(diff)<0.06;
                              const isCurrentRate=Math.abs(rate-currentRate)<0.06;
                              return (
                                <div key={rate} style={{ display:'grid', gridTemplateColumns:'76px 1fr 110px', alignItems:'center', gap:8, padding:'7px 12px', background:isBorder?'#f5f3ff':isCurrentRate?C.accentLight:isDark?'rgba(255,255,255,0.03)':i%2===0?'rgba(0,0,0,0.01)':C.card, borderTop:`1px solid ${C.border}` }}>
                                  <div style={{ fontSize:13, fontWeight:isBorder||isCurrentRate?800:500, color:isBorder?'#7c3aed':isCurrentRate?C.accent:C.textSecondary }}>
                                    {rate.toFixed(1)}回
                                    {isBorder&&<span style={{ fontSize:9, marginLeft:3, color:'#7c3aed' }}>★B</span>}
                                    {isCurrentRate&&<span style={{ fontSize:9, marginLeft:3, color:C.accent }}>◀現在</span>}
                                  </div>
                                  <div style={{ height:6, borderRadius:4, background:ev>=0?C.positiveBorder:C.negativeBorder, overflow:'hidden' }}>
                                    <div style={{ height:'100%', width:`${Math.min(100,Math.abs((diff/displayBorder)*100*5))}%`, background:ev>=0?C.positive:C.negative, borderRadius:4 }}/>
                                  </div>
                                  <div style={{ textAlign:'right', fontSize:13, fontWeight:isBorder||isCurrentRate?800:600, color:ev===null?C.textMuted:ev>=0?C.positive:C.negative }}>
                                    {ev===null?'-':`${ev>=0?'+':''}${Math.round(ev).toLocaleString()}円`}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 入力未完了メッセージ */}
            {displayBorder<=0&&(
              <div style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:16, padding:'28px 20px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📐</div>
                <div style={{ fontWeight:700, color:C.textPrimary, marginBottom:6 }}>1R平均出玉とトータル確率を入力してください</div>
                <div style={{ fontSize:13, color:C.textMuted }}>機種データに登録済みの場合は「取り込む」ボタンで自動入力されるぜ。</div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══════════════════ 釘メモ/簡易メモタブ ══════════════════ */}
        {activeTab==='nail'&&(()=>{
          const NAIL_ITEMS=[
            {id:'heso', label:'ヘソ釘', icon:'🎯'},
            {id:'jump', label:'ジャンプ釘', icon:'↗️'},
            {id:'michi',label:'道釘', icon:'➡️'},
            {id:'fusha',label:'風車上', icon:'🌀'},
            {id:'kob',  label:'こぼし', icon:'💧'},
            {id:'warp', label:'ワープ', icon:'🕳️'},
            {id:'stage',label:'ステージ', icon:'🎪'},
          ];
          const NAIL_GRADES=['◎','○','△','✕'];
          const GRADE_STYLE={
            '◎':{bg:isDark?'rgba(22,163,74,0.25)':'#dcfce7',border:'#86efac',text:'#16a34a',active:'#16a34a'},
            '○':{bg:isDark?'rgba(59,130,246,0.25)':'#dbeafe',border:'#93c5fd',text:'#2563eb',active:'#2563eb'},
            '△':{bg:isDark?'rgba(245,158,11,0.25)':'#fef3c7',border:'#fcd34d',text:'#d97706',active:'#d97706'},
            '✕':{bg:isDark?'rgba(239,68,68,0.25)':'#fee2e2',border:'#fca5a5',text:'#dc2626',active:'#dc2626'},
          };
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* 釘メモセクション */}
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden' }}>
                <div style={{ background:`linear-gradient(135deg,#1e1b4b,#312e81)`, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontWeight:800, fontSize:15, color:'white' }}>🔨 釘チェック</div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:2 }}>各釘の状態を評価しよう</div>
                  </div>
                  <button onClick={()=>{setNailGrades({});setHesoDirections([]);try{localStorage.removeItem('pachi_nail_grades');localStorage.removeItem('pachi_heso_dirs');}catch{}}}
                    style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:10, padding:'6px 12px', color:'white', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                    リセット
                  </button>
                </div>
                <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                  {NAIL_ITEMS.map(item=>{
                    const selected=nailGrades[item.id]||'';
                    return (
                      <div key={item.id}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          {/* 項目名 */}
                          <div style={{ width:74, flexShrink:0 }}>
                            <div style={{ fontSize:13, fontWeight:700, color:C.textPrimary }}>{item.label}</div>
                            {selected&&<div style={{ fontSize:10, fontWeight:700, color:GRADE_STYLE[selected].active, marginTop:1 }}>{selected}</div>}
                          </div>
                          {/* 4ボタン */}
                          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, flex:1 }}>
                            {NAIL_GRADES.map(g=>{
                              const isSel=selected===g;
                              const s=GRADE_STYLE[g];
                              return (
                                <button key={g} onClick={()=>setNailGrade(item.id,g)}
                                  style={{ padding:'10px 0', borderRadius:12, border:`2px solid ${isSel?s.active:C.border}`, background:isSel?s.bg:C.card, color:isSel?s.active:C.textMuted, fontWeight:isSel?800:500, fontSize:16, cursor:'pointer', transition:'all 0.12s' }}>
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        {/* ヘソ釘のみ方向ボタン追加（最大2選択） */}
                        {item.id==='heso'&&(
                          <div style={{ marginTop:6, marginLeft:84 }}>
                            <div style={{ fontSize:10, color:C.textMuted, marginBottom:4 }}>方向（最大2つ選択可）</div>
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5 }}>
                              {[
                                {dir:'上',    bg:isDark?'rgba(22,163,74,0.25)':'#dcfce7', border:'#86efac', text:'#16a34a'},
                                {dir:'下',    bg:isDark?'rgba(239,68,68,0.25)':'#fee2e2', border:'#fca5a5', text:'#dc2626'},
                                {dir:'右あけ',bg:isDark?'rgba(245,158,11,0.25)':'#fef3c7', border:'#fcd34d', text:'#d97706'},
                                {dir:'左あけ',bg:isDark?'rgba(59,130,246,0.25)':'#dbeafe', border:'#93c5fd', text:'#2563eb'},
                              ].map(({dir,bg,border,text})=>{
                                const isSel=(hesoDirections||[]).includes(dir);
                                return (
                                  <button key={dir} onClick={()=>toggleHesoDir(dir)}
                                    style={{ padding:'9px 0', borderRadius:10, border:`2px solid ${isSel?text:C.border}`, background:isSel?bg:C.card, color:isSel?text:C.textMuted, fontWeight:isSel?800:400, fontSize:12, cursor:'pointer', transition:'all 0.12s' }}>
                                    {dir}
                                  </button>
                                );
                              })}
                            </div>
                            {hesoDirections&&hesoDirections.length>0&&(
                              <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>
                                選択中: {hesoDirections.join(' ＋ ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 簡易メモセクション */}
              <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:20, overflow:'hidden' }}>
                <div style={{ background:`linear-gradient(135deg,#0c4a6e,#0369a1)`, padding:'14px 18px' }}>
                  <div style={{ fontWeight:800, fontSize:15, color:'white' }}>📋 簡易メモ</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.65)', marginTop:2 }}>気になる台番・機種名をメモしよう</div>
                </div>
                <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                  {/* 台番入力 */}
                  <div>
                    <label style={{ fontSize:12, fontWeight:700, color:C.textPrimary, display:'block', marginBottom:8 }}>気になる台番を追加</label>
                    <div style={{ display:'flex', gap:8 }}>
                      <input
                        value={nailTableInput}
                        onChange={e=>setNailTableInput(e.target.value.replace(/[^0-9]/g,''))}
                        onKeyDown={e=>e.key==='Enter'&&addNailTableNum()}
                        style={{ ...inputStyle, flex:1, fontSize:18, fontWeight:700, textAlign:'center', padding:'12px' }}
                        inputMode="numeric" placeholder="台番号"
                      />
                      <button onClick={addNailTableNum}
                        style={{ padding:'12px 18px', borderRadius:14, border:'none', background:C.primary, color:'white', fontWeight:800, fontSize:14, cursor:'pointer', flexShrink:0 }}>
                        追加
                      </button>
                    </div>
                  </div>
                  {/* 登録済み台番カード一覧（各台に機種名入力欄） */}
                  {nailMemo.tables&&nailMemo.tables.length>0?(
                    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary }}>登録済み台（{nailMemo.tables.length}件）</div>
                      {nailMemo.tables.map(t=>(
                        <div key={t.num} style={{ background:isDark?'rgba(255,255,255,0.04)':'#f8fafc', border:`1.5px solid ${C.border}`, borderRadius:14, padding:'12px 14px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ background:C.primary, color:'white', borderRadius:8, padding:'4px 10px', fontWeight:800, fontSize:16 }}>
                                {t.num}番
                              </div>
                              {t.machine&&<div style={{ fontSize:12, color:C.textSecondary, fontWeight:600 }}>{t.machine}</div>}
                            </div>
                            <button onClick={()=>removeNailTable(t.num)}
                              style={{ background:C.negativeBg, border:`1px solid ${C.negativeBorder}`, borderRadius:8, padding:'4px 10px', color:C.negative, fontSize:11, fontWeight:700, cursor:'pointer' }}>
                              削除
                            </button>
                          </div>
                          <input
                            value={t.machine||''}
                            onChange={e=>updateTableMachine(t.num,e.target.value)}
                            style={{ ...inputStyle, fontSize:13, padding:'8px 12px' }}
                            placeholder="機種名を入力（任意）"
                          />
                        </div>
                      ))}
                    </div>
                  ):(
                    <div style={{ fontSize:12, color:C.textMuted }}>台番を追加してみよう（最大10件）</div>
                  )}
                  {/* グローバル機種メモ */}
                  <div>
                    <label style={{ fontSize:12, fontWeight:700, color:C.textPrimary, display:'block', marginBottom:8 }}>その他メモ</label>
                    <input
                      value={nailMemo.machineName||''}
                      onChange={e=>updateNailMemo('machineName',e.target.value)}
                      style={{ ...inputStyle, fontSize:14, padding:'11px 14px' }}
                      placeholder="気になること・新台情報など"
                    />
                  </div>
                  {/* クリアボタン */}
                  {((nailMemo.tables&&nailMemo.tables.length>0)||nailMemo.machineName)&&(
                    <button onClick={()=>{updateNailMemo('tables',[]);updateNailMemo('machineName','');}}
                      style={{ padding:'10px', borderRadius:12, border:`1px solid ${C.border}`, background:C.card, color:C.textMuted, fontSize:12, cursor:'pointer' }}>
                      メモをクリア
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══════════════════ 振り分けカウンタータブ ══════════════════ */}
        {activeTab==='counter'&&(()=>{
          const totalSpins=Math.round(formMetrics.allTotalSpins)||0;
          const totalCount=counters.reduce((a,c)=>a+c.count,0);
          const hasAnyCount=totalCount>0;
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* ヘッダー */}
              <div style={{ background:`linear-gradient(135deg,#1e1b4b,#4c1d95)`, borderRadius:20, padding:'16px 18px', color:'white' }}>
                <div style={{ fontSize:11, letterSpacing:'0.2em', color:'rgba(255,255,255,0.6)', fontWeight:700, marginBottom:4 }}>振り分けカウンター</div>
                <div style={{ display:'flex', gap:16, alignItems:'flex-end' }}>
                  <div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>総回転（回転率タブ連携）</div>
                    <div style={{ fontSize:28, fontWeight:900 }}>{totalSpins.toLocaleString()}<span style={{ fontSize:13, marginLeft:4 }}>回転</span></div>
                  </div>
                  {hasAnyCount&&<div>
                    <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)' }}>合計カウント</div>
                    <div style={{ fontSize:20, fontWeight:800 }}>{totalCount}</div>
                  </div>}
                </div>
                {!hasAnyCount&&<div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', marginTop:6 }}>ボタンを押して振り分けを記録しよう</div>}
              </div>

              {/* カウンターグリッド */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                {counters.map((c,idx)=>{
                  const rate=totalSpins>0?((c.count/totalSpins)*100).toFixed(1):null;
                  return (
                    <div key={c.id} style={{ background:C.card, border:`2px solid ${c.count>0?c.border:C.border}`, borderRadius:20, overflow:'hidden', transition:'all 0.15s' }}>
                      {/* ラベル編集 */}
                      <div style={{ padding:'10px 12px 4px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <input
                          value={counterLabels[idx]}
                          onChange={e=>{const v=e.target.value; setCounterLabels(p=>{const n=[...p];n[idx]=v;return n;});}}
                          onBlur={e=>{const v=e.target.value.trim()||DEFAULT_COUNTERS[idx].label; setCounterLabels(p=>{const n=[...p];n[idx]=v;return n;});}}
                          style={{ fontSize:11, fontWeight:700, color:c.count>0?c.color:C.textMuted, background:'none', border:'none', outline:'none', width:'100%', padding:0 }}
                        />
                        {c.count>0&&(
                          <button onClick={()=>setCounters(p=>p.map((x,i)=>i===idx?{...x,count:Math.max(0,x.count-1)}:x))}
                            style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:14, padding:'0 2px', flexShrink:0 }}>−</button>
                        )}
                      </div>
                      {/* 大ボタン */}
                      <button
                        onClick={()=>setCounters(p=>p.map((x,i)=>i===idx?{...x,count:x.count+1}:x))}
                        style={{ width:'100%', minHeight:90, background:c.count>0?c.bg:'transparent', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, transition:'all 0.1s', activeOpacity:0.8 }}
                      >
                        <div style={{ fontSize:36, fontWeight:900, color:c.count>0?c.color:C.textMuted, lineHeight:1 }}>{c.count}</div>
                        {rate!==null&&c.count>0?(
                          <div style={{ fontSize:13, fontWeight:700, color:c.color }}>{rate}%</div>
                        ):(
                          <div style={{ fontSize:11, color:C.textMuted }}>タップで+1</div>
                        )}
                      </button>
                      {/* 進捗バー */}
                      {totalSpins>0&&c.count>0&&(
                        <div style={{ height:4, background:C.border }}>
                          <div style={{ height:'100%', width:`${Math.min(100,(c.count/totalSpins)*100)}%`, background:c.color, transition:'width 0.3s', maxWidth:'100%' }}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 合計サマリー表 */}
              {hasAnyCount&&(
                <div style={{ background:C.card, border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
                  <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, padding:'10px 14px', background:isDark?'rgba(255,255,255,0.04)':'#f8fafc', borderBottom:`1px solid ${C.border}` }}>
                    📊 振り分け結果サマリー
                    {totalSpins>0&&<span style={{ fontSize:11, color:C.textMuted, fontWeight:400, marginLeft:8 }}>（総回転{totalSpins.toLocaleString()}回転ベース）</span>}
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead>
                      <tr style={{ background:isDark?'rgba(255,255,255,0.03)':'#fafafa' }}>
                        {['項目','回数','決定率'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'center', color:C.textMuted, fontWeight:600, borderBottom:`1px solid ${C.border}`, fontSize:11 }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {counters.filter(c=>c.count>0).map((c,i,arr)=>{
                        const rate=totalSpins>0?((c.count/totalSpins)*100).toFixed(2):'-';
                        return (
                          <tr key={c.id} style={{ borderBottom:i<arr.length-1?`1px solid ${C.border}`:'none' }}>
                            <td style={{ padding:'9px 12px', display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ width:10, height:10, borderRadius:'50%', background:c.color, flexShrink:0 }}/>
                              <span style={{ fontWeight:600, color:C.textPrimary }}>{counterLabels[counters.indexOf(c)]}</span>
                            </td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700, color:c.color }}>{c.count}</td>
                            <td style={{ padding:'9px 12px', textAlign:'center', fontWeight:700, color:totalSpins>0?c.color:C.textMuted }}>
                              {totalSpins>0?`${rate}%`:'記録なし'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* リセットボタン */}
              {hasAnyCount&&(
                <button onClick={()=>{saveCounterSnapshot();setCounters(DEFAULT_COUNTERS);}}
                  style={{ padding:'12px', borderRadius:14, border:`1.5px solid ${C.negativeBorder}`, background:C.card, color:C.negative, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                  🔄 カウンターをリセット（履歴に保存）
                </button>
              )}
            </div>
          );
        })()}

        {/* ══════════════════ 日別タブ ══════════════════ */}
        {activeTab==='calendar'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* 月次サマリー */}
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,${C.primary},#7c3aed)`, padding:'12px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:700, fontSize:15, color:'white' }}>{currentMonth} のまとめ</div>
                <div style={{ fontSize:12, color:'rgba(255,255,255,0.8)' }}>稼働 {monthlyReport.totals.count}件</div>
              </div>
              <div style={{ padding:'12px 14px' }}>
                {(()=>{
                  const monthWorkYen=monthlyReport.monthSessions.reduce((a,s)=>a+(getWorkVolumeYen(s.metrics)??0),0);
                  return (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                      <div style={{ background:monthlyReport.totals.balance>=0?C.positiveBg:C.negativeBg, border:`1.5px solid ${monthlyReport.totals.balance>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:14, padding:'12px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>月間収支</div>
                        <div style={{ fontSize:22, fontWeight:800, color:monthlyReport.totals.balance>=0?C.positive:C.negative, marginTop:4 }}>{fmtYen(monthlyReport.totals.balance)}</div>
                        <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>稼働{monthlyReport.totals.count}件</div>
                      </div>
                      <div style={{ background:monthWorkYen>=0?C.positiveBg:C.negativeBg, border:`1.5px solid ${monthWorkYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:14, padding:'12px', textAlign:'center' }}>
                        <div style={{ fontSize:11, color:C.textMuted, fontWeight:600 }}>月間仕事量</div>
                        <div style={{ fontSize:22, fontWeight:800, color:monthWorkYen>=0?C.positive:C.negative, marginTop:4 }}>{fmtYen(Math.round(monthWorkYen))}</div>
                        <div style={{ fontSize:10, color:C.textMuted, marginTop:2 }}>-</div>
                      </div>
                    </div>
                  );
                })()}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                  {[['プラス日',monthlyReport.plusDays+'日',C.positive],['マイナス日',monthlyReport.minusDays+'日',C.negative]].map(([l,v,c])=>(
                    <div key={l} style={{ background:isDark?'#1e293b':'#f8fafc', borderRadius:10, padding:'8px', textAlign:'center' }}>
                      <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <MonthCalendar currentMonth={currentMonth} sessions={enrichedSessions} selectedDate={selectedDate} onSelectDate={setSelectedDate} onPrev={()=>moveMonth(-1)} onNext={()=>moveMonth(1)} isDark={isDark}/>
            <div style={cardStyle}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontWeight:700, fontSize:16, color:C.textPrimary }}>{selectedDate} の記録</div>
                {selectedDateSessions.length>0&&(()=>{
                  const dayBalance=selectedDateSessions.reduce((a,s)=>a+s.metrics.balanceYen,0);
                  const dayWork=selectedDateSessions.reduce((a,s)=>a+(getWorkVolumeYen(s.metrics)??0),0);
                  return (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginTop:10 }}>
                      {[['収支',fmtYen(Math.round(dayBalance)),dayBalance>=0],['仕事量',fmtYen(Math.round(dayWork)),dayWork>=0]].map(([l,v,pos])=>(
                        <div key={l} style={{ background:pos?C.positiveBg:C.negativeBg, border:`1px solid ${pos?C.positiveBorder:C.negativeBorder}`, borderRadius:10, padding:'8px', textAlign:'center' }}>
                          <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>{l}</div>
                          <div style={{ fontSize:13, fontWeight:800, color:pos?C.positive:C.negative, marginTop:2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                {selectedDateSessions.length===0?<div style={{ textAlign:"center", padding:"32px 20px", color:C.textMuted }}><div style={{ fontSize:40, marginBottom:12 }}>📅</div><div style={{ fontSize:15, fontWeight:700, color:C.textSecondary, marginBottom:6 }}>この日は未記録</div><div style={{ fontSize:12 }}>回転率タブで記録を始めよう！</div></div>:selectedDateSessions.map(s=>{
                  const td=getSessionTrendData(s,settings);
                  const mn=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定';
                  const wv=getWorkVolumeYen(s.metrics);
                  return (
                    <details key={s.id} style={{ border:`1px solid ${s.metrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}`, borderRadius:16, background:C.card, overflow:'hidden', borderLeft:`4px solid ${s.metrics.balanceYen>=0?C.positive:C.negative}` }}>
                      <summary style={{ cursor:'pointer', listStyle:'none', padding:'14px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                          <div>
                            <div style={{ fontWeight:700, color:C.textPrimary }}>{mn}</div>
                            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>
                              {s.shop||'店舗未入力'} / 台{s.machineNumber||'-'} / {s.status==='completed'?'終了':'途中'}
                              <span style={{ marginLeft:6, background:s.exchangeCategory==='25'?C.primaryLight:C.amberBg, color:s.exchangeCategory==='25'?C.primary:C.amber, border:`1px solid ${s.exchangeCategory==='25'?C.primaryMid:C.amberBorder}`, borderRadius:6, padding:'1px 6px', fontSize:10, fontWeight:700 }}>
                                {getExchangePreset(s.exchangeCategory||'25').label}
                              </span>
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:17, fontWeight:700, color:s.metrics.balanceYen>=0?C.positive:C.negative }}>{fmtYen(s.metrics.balanceYen)}</div>
                            <div style={{ fontSize:11, fontWeight:600, color:s.metrics.estimatedEVYen>=0?C.positive:C.negative }}>EV {fmtYen(s.metrics.estimatedEVYen)}</div>
                          </div>
                        </div>
                        <div style={{ marginTop:6, fontSize:11, color:C.textMuted }}>タップで詳細を表示</div>
                      </summary>
                      <div style={{ borderTop:`1px solid ${C.border}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:12 }}>
                        {/* 店舗名・台番号 編集欄 */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          <div>
                            <label style={{ fontSize:11, color:C.textMuted, fontWeight:600, display:'block', marginBottom:4 }}>店舗名</label>
                            <input
                              value={s.shop||''}
                              onChange={e=>{const v=e.target.value;upsertSession({...s,shop:v,updatedAt:Date.now()});}}
                              style={{ width:'100%', boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, background:C.card, color:C.textPrimary }}
                              placeholder="店舗名"
                            />
                          </div>
                          <div>
                            <label style={{ fontSize:11, color:C.textMuted, fontWeight:600, display:'block', marginBottom:4 }}>台番号</label>
                            <input
                              value={s.machineNumber||''}
                              onChange={e=>{const v=e.target.value;upsertSession({...s,machineNumber:v,updatedAt:Date.now()});}}
                              style={{ width:'100%', boxSizing:'border-box', border:`1px solid ${C.border}`, borderRadius:10, padding:'8px 10px', fontSize:13, background:C.card, color:C.textPrimary }}
                              placeholder="台番号"
                            />
                          </div>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          {(()=>{
                            const machine=s.machine||machines.find(m=>m.id===s.machineId)||null;
                            const tm=calcTheoreticalValueMetrics(s.metrics,machine,numberOrZero(s.hours),settings);
                            const unitPrice=tm.mixedUnitPriceYen;
                            return [
                              ['収支',fmtYen(s.metrics.balanceYen),s.metrics.balanceYen>=0],
                              ['仕事量',wv!==null?fmtYen(Math.round(wv)):'-',wv!==null?wv>=0:null],
                              ['回転単価',unitPrice!==null?`${unitPrice>=0?'+':''}${fmtRate(unitPrice)}円`:'-',unitPrice!==null?unitPrice>=0:null],
                            ].map(([l,v,pos])=>(
                              <div key={l} style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                                <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                                <div style={{ fontSize:16, fontWeight:700, marginTop:3, color:pos===null?C.textPrimary:pos?C.positive:C.negative }}>{v}</div>
                              </div>
                            ));
                          })()}
                          <div style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                            <div style={{ fontSize:11, color:C.textMuted }}>総回転数</div>
                            <div style={{ fontSize:16, fontWeight:700, marginTop:3, color:C.textPrimary }}>{Math.round(s.metrics.totalSpins).toLocaleString()}回</div>
                            <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>回転率 {fmtRate(s.metrics.avgSpinPerThousand)}</div>
                          </div>
                          {/* 合計R・1R出玉 */}
                          {(()=>{
                            const totalR=(s.firstHits||[]).reduce((a,h)=>a+numberOrZero(h.rounds),0);
                            const avgOneR=(()=>{const hits=(s.firstHits||[]).filter(h=>h.oneRound>0);return hits.length>0?(hits.reduce((a,h)=>a+h.oneRound,0)/hits.length):0;})();
                            const machine=s.machine||machines.find(m=>m.id===s.machineId)||null;
                            const machineOneR=machine?.payoutPerRound||0;
                            const oneRDisplay=avgOneR>0?avgOneR:machineOneR;
                            return (
                              <>
                                <div style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                                  <div style={{ fontSize:11, color:C.textMuted }}>合計R数</div>
                                  <div style={{ fontSize:16, fontWeight:700, marginTop:3, color:C.primary }}>{totalR>0?totalR+'R':'未記録'}</div>
                                  {totalR>0&&<div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{(s.firstHits||[]).length}回の初当たり</div>}
                                </div>
                                <div style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                                  <div style={{ fontSize:11, color:C.textMuted }}>1R出玉</div>
                                  <div style={{ fontSize:16, fontWeight:700, marginTop:3, color:C.accent }}>{oneRDisplay>0?fmtRate(oneRDisplay):'未記録'}</div>
                                  {avgOneR>0&&<div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>実測平均値</div>}
                                  {avgOneR===0&&machineOneR>0&&<div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>機種登録値</div>}
                                </div>
                              </>
                            );
                          })()}
                          {/* 通常回転時速 */}
                          {(()=>{
                            const machine=s.machine||machines.find(m=>m.id===s.machineId)||null;
                            const tm=calcTheoreticalValueMetrics(s.metrics,machine,numberOrZero(s.hours),settings);
                            const sph=tm.normalSpinsPerHour;
                            if(!sph||sph<=0) return null;
                            const AVERAGE=200;
                            const diff=sph-AVERAGE;
                            const pct=Math.round((sph/AVERAGE)*100);
                            // 速い(>220)→緑・やや速い(>180)→水色・平均付近→グレー・やや遅い(>150)→黄・遅い(<=150)→赤
                            const color=sph>220?'#16a34a':sph>180?'#0284c7':sph>150?C.textMuted:'#d97706';
                            const bg=sph>220?(isDark?'rgba(22,163,74,0.12)':'#f0fdf4'):sph>180?(isDark?'rgba(2,132,199,0.12)':'#e0f2fe'):sph>150?(isDark?'rgba(255,255,255,0.03)':'#f8fafc'):(isDark?'rgba(245,158,11,0.12)':'#fef3c7');
                            const border=sph>220?'#86efac':sph>180?'#7dd3fc':sph>150?C.border:'#fcd34d';
                            const label=sph>220?'速い ✅':sph>180?'やや速い':sph>150?'平均的':sph>120?'やや遅い':'遅い ⚠️';
                            return (
                              <div style={{ gridColumn:'1/-1', background:bg, border:`1.5px solid ${border}`, borderRadius:12, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div>
                                  <div style={{ fontSize:11, color:C.textMuted, fontWeight:600, marginBottom:2 }}>⏱ 通常回転時速</div>
                                  <div style={{ fontSize:11, color:C.textMuted }}>平均200回転/h比較</div>
                                </div>
                                <div style={{ textAlign:'right' }}>
                                  <div style={{ fontSize:22, fontWeight:900, color }}>{Math.round(sph)}<span style={{ fontSize:12, fontWeight:600, marginLeft:3 }}>回/h</span></div>
                                  <div style={{ fontSize:11, fontWeight:700, color, marginTop:1 }}>
                                    {diff>=0?'+':''}{Math.round(diff)}回 （{pct}%） {label}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* 投資内訳 */}
                          <div style={{ gridColumn:'1/-1', background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:12, padding:'10px 12px' }}>
                            <div style={{ fontSize:11, color:C.textMuted, marginBottom:6, fontWeight:600 }}>💴 投資内訳</div>
                            <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12 }}>
                              <div>現金投資 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(s.metrics.cashInvestYen)}</span></div>
                              {s.metrics.ballInvestBalls>0&&<div>玉投資 <span style={{ fontWeight:700, color:C.amber }}>{Math.round(s.metrics.ballInvestBalls).toLocaleString()}玉（{fmtYen(Math.round(s.metrics.ballInvestYen))}）</span></div>}
                              <div>総投資 <span style={{ fontWeight:700, color:C.primary }}>{fmtYen(Math.round(s.metrics.cashInvestYen+s.metrics.ballInvestYen))}</span></div>
                            </div>
                          </div>
                        </div>

                        {/* 釘チェック記録 */}
                        {s.nailGrades&&Object.keys(s.nailGrades).some(k=>s.nailGrades[k])&&(()=>{
                          const NAIL_LABELS={heso:'ヘソ釘',jump:'ジャンプ釘',michi:'道釘',fusha:'風車上',kob:'こぼし',warp:'ワープ',stage:'ステージ'};
                          const GRADE_C={'◎':'#16a34a','○':'#2563eb','△':'#d97706','✕':'#dc2626'};
                          const GRADE_BG={'◎':isDark?'rgba(22,163,74,0.15)':'#dcfce7','○':isDark?'rgba(59,130,246,0.15)':'#dbeafe','△':isDark?'rgba(245,158,11,0.15)':'#fef3c7','✕':isDark?'rgba(239,68,68,0.15)':'#fee2e2'};
                          const DIR_C={上:'#16a34a',下:'#dc2626',右あけ:'#d97706',左あけ:'#2563eb'};
                          return (
                            <div style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                              <div style={{ background:isDark?'rgba(49,30,129,0.2)':'#f5f3ff', padding:'8px 12px', borderBottom:`1px solid ${C.border}` }}>
                                <div style={{ fontWeight:700, fontSize:12, color:'#6d28d9' }}>🔨 釘チェック記録</div>
                              </div>
                              <div style={{ padding:'10px 12px' }}>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                  {Object.entries(s.nailGrades).filter(([,g])=>g).map(([id,grade])=>(
                                    <div key={id} style={{ display:'flex', alignItems:'center', gap:4, background:GRADE_BG[grade], border:`1px solid ${GRADE_C[grade]}40`, borderRadius:8, padding:'4px 8px' }}>
                                      <span style={{ fontSize:11, color:C.textSecondary }}>{NAIL_LABELS[id]||id}</span>
                                      <span style={{ fontSize:14, fontWeight:800, color:GRADE_C[grade] }}>{grade}</span>
                                    </div>
                                  ))}
                                  {s.hesoDirections&&s.hesoDirections.length>0&&s.hesoDirections.map(dir=>(
                                    <div key={dir} style={{ display:'flex', alignItems:'center', gap:4, background:isDark?'rgba(99,102,241,0.15)':C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:8, padding:'4px 8px' }}>
                                      <span style={{ fontSize:11, color:C.textSecondary }}>ヘソ方向</span>
                                      <span style={{ fontSize:12, fontWeight:700, color:DIR_C[dir]||C.primary }}>{dir}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                        {td.length>0&&<div style={{ height:180 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={td}><CartesianGrid strokeDasharray="3 3" stroke={C.border}/><XAxis dataKey="label" tick={{fontSize:11}}/><YAxis domain={[10,25]} tick={{fontSize:11}}/><Tooltip/>{s.metrics.machineBorder>0&&<ReferenceLine y={s.metrics.machineBorder} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1.5} label={{value:"B",position:"right",fontSize:10,fill:"#ef4444"}}/>}<Line type="monotone" dataKey="rate" stroke={C.accent} strokeWidth={2} dot={false} name="累積回転率"/></LineChart></ResponsiveContainer></div>}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button style={{ width:'100%', padding:'10px', borderRadius:12, border:`1.5px solid ${C.negativeBorder}`, background:C.card, color:C.negative, fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                              <Trash2 size={14}/>この記録を削除
                            </button>
                          </DialogTrigger>
                          <DialogContent className="max-w-sm rounded-3xl" onOpenAutoFocus={e=>e.preventDefault()}>
                            <DialogHeader><DialogTitle>記録を削除しますか？</DialogTitle></DialogHeader>
                            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                              <div style={{ background:C.negativeBg, border:`1.5px solid ${C.negativeBorder}`, borderRadius:14, padding:'16px', textAlign:'center' }}>
                                <div style={{ fontSize:28, marginBottom:8 }}>⚠️</div>
                                <div style={{ fontWeight:700, color:C.textPrimary, fontSize:14, marginBottom:4 }}>{mn}</div>
                                <div style={{ fontSize:12, color:C.textSecondary }}>{s.date} / {s.shop||'店舗未入力'}</div>
                                <div style={{ fontSize:12, color:C.textMuted, marginTop:8 }}>削除すると元に戻せないぜ。</div>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                                <DialogTrigger asChild><button style={{ padding:'12px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>キャンセル</button></DialogTrigger>
                                <DialogTrigger asChild><button onClick={()=>deleteSession(s.id)} style={{ padding:'12px', borderRadius:14, border:'none', background:C.negative, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>削除する</button></DialogTrigger>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ まとめタブ ══════════════════ */}
        {activeTab==='analysis'&&(()=>{
          // 全期間の機種・店舗集計
          const allMMap={}, allSMap={};
          // 店舗は「店舗名×日付」でまとめて1日1エントリとする
          const allSDayMap={};
          enrichedSessions.forEach(s=>{
            const mk=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定';
            const sk=s.shop||'店舗未入力';
            const sdKey=`${sk}__${s.date}`;
            if(!allMMap[mk]) allMMap[mk]={name:mk,count:0,balance:0,work:0};
            if(!allSDayMap[sdKey]) allSDayMap[sdKey]={name:sk,date:s.date,balance:0,work:0};
            allMMap[mk].count+=1; allMMap[mk].balance+=s.metrics.balanceYen; allMMap[mk].work+=(getWorkVolumeYen(s.metrics)??0);
            allSDayMap[sdKey].balance+=s.metrics.balanceYen; allSDayMap[sdKey].work+=(getWorkVolumeYen(s.metrics)??0);
          });
          // 店舗ごとに日別エントリを集約
          Object.values(allSDayMap).forEach(d=>{
            const sk=d.name;
            if(!allSMap[sk]) allSMap[sk]={name:sk,count:0,balance:0,work:0};
            allSMap[sk].count+=1; allSMap[sk].balance+=d.balance; allSMap[sk].work+=d.work;
          });
          const allMRows=Object.values(allMMap), allSRows=Object.values(allSMap);
          // 月次ランキング用
          const ms=monthlyReport.monthSessions;
          const mMap={}, sMap={};
          const mSDayMap={};
          ms.forEach(s=>{
            const mk=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定';
            const sk=s.shop||'店舗未入力';
            const sdKey=`${sk}__${s.date}`;
            if(!mMap[mk]) mMap[mk]={name:mk,count:0,balance:0,work:0};
            if(!mSDayMap[sdKey]) mSDayMap[sdKey]={name:sk,date:s.date,balance:0,work:0};
            mMap[mk].count+=1; mMap[mk].balance+=s.metrics.balanceYen; mMap[mk].work+=(getWorkVolumeYen(s.metrics)??0);
            mSDayMap[sdKey].balance+=s.metrics.balanceYen; mSDayMap[sdKey].work+=(getWorkVolumeYen(s.metrics)??0);
          });
          Object.values(mSDayMap).forEach(d=>{
            const sk=d.name;
            if(!sMap[sk]) sMap[sk]={name:sk,count:0,balance:0,work:0};
            sMap[sk].count+=1; sMap[sk].balance+=d.balance; sMap[sk].work+=d.work;
          });
          const mRows=Object.values(mMap), sRows=Object.values(sMap);
          const MEDALS=['🥇','🥈','🥉','4️⃣','5️⃣'];
          const MEDAL_BG=['rgba(245,158,11,0.15)','rgba(148,163,184,0.1)','rgba(180,83,9,0.1)','rgba(100,116,139,0.08)','rgba(100,116,139,0.08)'];
          const MEDAL_COLORS=['#f59e0b','#94a3b8','#b45309','#64748b','#64748b'];
          function RankCard({title,sub,rows,comment,gradBg,borderColor}){
            return (
              <details style={{ borderRadius:14, overflow:'hidden', border:`1.5px solid ${borderColor}` }}>
                <summary style={{ cursor:'pointer', listStyle:'none', padding:'12px 14px', background:gradBg }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary }}>{title}</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:1 }}>{sub}</div>
                    </div>
                    <ChevronDown size={15} color={C.textMuted}/>
                  </div>
                </summary>
                <div style={{ padding:'10px 14px', background:C.card, display:'flex', flexDirection:'column', gap:6 }}>
                  {rows.length===0
                    ? <div style={{ fontSize:12, color:C.textMuted, textAlign:'center', padding:'12px' }}>データなし</div>
                    : rows.map((row,i)=>(
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, background:isDark?MEDAL_BG[i]:i===0?'#fffbeb':'#fafafa', border:`1px solid ${i===0?'#fde68a':C.border}` }}>
                        <div style={{ fontSize:20, width:28, textAlign:'center', flexShrink:0 }}>{MEDALS[i]}</div>
                        <div style={{ flex:1, fontWeight:i===0?700:500, color:i===0?MEDAL_COLORS[i]:C.textPrimary, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.name}</div>
                        <div style={{ fontWeight:800, color:i===0?MEDAL_COLORS[i]:C.textSecondary, fontSize:14, flexShrink:0 }}>{row.value}</div>
                      </div>
                    ))
                  }
                  <div style={{ background:isDark?'rgba(99,102,241,0.15)':'#eef2ff', border:`1px solid #c7d2fe`, borderRadius:10, padding:'10px 12px', marginTop:4, fontSize:12, color:isDark?'#a5b4fc':C.primary }}>
                    💬 {comment(rows)}
                  </div>
                </div>
              </details>
            );
          }
          const monthRankDefs=[
            {title:'🎰 稼働回数ランキング',sub:'今月一番お世話になった機種',rows:[...mRows].sort((a,b)=>b.count-a.count).slice(0,5).map(r=>({name:r.name,value:`${r.count}回`})),comment:r=>r.length>0?`「${r[0].name}」が今月のエース！${r[0].value}も向き合ったぜ 💪`:'まだデータがないぜ',gradBg:isDark?'rgba(251,191,36,0.1)':'linear-gradient(135deg,#fef3c7,#fffbeb)',borderColor:'#fde68a'},
            {title:'🏪 よく行く店舗ランキング',sub:'今月お気に入りの店はどこだ？',rows:[...sRows].sort((a,b)=>b.count-a.count).slice(0,5).map(r=>({name:r.name,value:`${r.count}回`})),comment:r=>r.length>0?`「${r[0].name}」が今月のホーム！通いすぎには注意だぜ 😏`:'まだデータがないぜ',gradBg:isDark?'rgba(14,165,233,0.1)':'linear-gradient(135deg,#e0f2fe,#f0f9ff)',borderColor:'#bae6fd'},
            {title:'💰 仕事量ランキング',sub:'今月最も稼いだ機種はどれだ',rows:[...mRows].sort((a,b)=>b.work-a.work).slice(0,5).map(r=>({name:r.name,value:fmtYen(Math.round(r.work))})),comment:r=>r.length>0?`「${r[0].name}」が今月最大の稼ぎ頭！${r[0].value}の仕事量はさすがだぜ ✨`:'まだデータがないぜ',gradBg:isDark?'rgba(5,150,105,0.1)':'linear-gradient(135deg,#ecfdf5,#f0fdf4)',borderColor:'#a7f3d0'},
            {title:'📈 プラス収支ランキング',sub:'今月笑顔で帰れた機種TOP5',rows:[...mRows].filter(r=>r.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5).map(r=>({name:r.name,value:fmtYen(r.balance)})),comment:r=>r.length>0?`「${r[0].name}」で${r[0].value}のプラス！この調子で頼むぜ 🎉`:'今月はプラス台なし…次は頑張れ！',gradBg:isDark?'rgba(52,211,153,0.1)':'linear-gradient(135deg,#ecfdf5,#f0fdf4)',borderColor:'#6ee7b7'},
            {title:'📉 マイナス収支ランキング',sub:'今月お財布が泣いた機種TOP5',rows:[...mRows].filter(r=>r.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,5).map(r=>({name:r.name,value:fmtYen(r.balance)})),comment:r=>r.length>0?`「${r[0].name}」が今月の刺客…${r[0].value}は痛かったぜ 😢`:'今月はマイナス台なし！完璧だぜ 🎊',gradBg:isDark?'rgba(251,113,133,0.1)':'linear-gradient(135deg,#fff1f2,#fff5f5)',borderColor:'#fecdd3'},
          ];
          const allTimeRankDefs=[
            {title:'🎰 生涯稼働回数ランキング',sub:'今まで一番お世話になった機種',rows:[...allMRows].sort((a,b)=>b.count-a.count).slice(0,5).map(r=>({name:r.name,value:`${r.count}回`})),comment:r=>r.length>0?`「${r[0].name}」が生涯のエース！合計${r[0].value}の長い付き合いだぜ 👑`:'まだデータがないぜ',gradBg:isDark?'rgba(251,191,36,0.1)':'linear-gradient(135deg,#fef3c7,#fffbeb)',borderColor:'#fde68a'},
            {title:'🏪 生涯来店回数ランキング',sub:'今まで一番通った店はどこだ',rows:[...allSRows].sort((a,b)=>b.count-a.count).slice(0,5).map(r=>({name:r.name,value:`${r.count}回`})),comment:r=>r.length>0?`「${r[0].name}」がホームグラウンド！${r[0].value}も通ったとはすごいぜ 🏠`:'まだデータがないぜ',gradBg:isDark?'rgba(14,165,233,0.1)':'linear-gradient(135deg,#e0f2fe,#f0f9ff)',borderColor:'#bae6fd'},
            {title:'💰 生涯仕事量ランキング',sub:'今まで最も稼いだ機種TOP5',rows:[...allMRows].sort((a,b)=>b.work-a.work).slice(0,5).map(r=>({name:r.name,value:fmtYen(Math.round(r.work))})),comment:r=>r.length>0?`「${r[0].name}」が生涯最大の稼ぎ頭！総計${r[0].value}の仕事量は圧巻だぜ ✨`:'まだデータがないぜ',gradBg:isDark?'rgba(5,150,105,0.1)':'linear-gradient(135deg,#ecfdf5,#f0fdf4)',borderColor:'#a7f3d0'},
            {title:'📈 生涯プラス収支ランキング',sub:'今まで最も笑顔をくれた機種TOP5',rows:[...allMRows].filter(r=>r.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5).map(r=>({name:r.name,value:fmtYen(r.balance)})),comment:r=>r.length>0?`「${r[0].name}」が生涯最大の功労者！${r[0].value}の恩は一生忘れないぜ 🌟`:'プラス台の記録なし',gradBg:isDark?'rgba(52,211,153,0.1)':'linear-gradient(135deg,#ecfdf5,#f0fdf4)',borderColor:'#6ee7b7'},
            {title:'📉 生涯マイナス収支ランキング',sub:'今まで最もお財布を削った機種TOP5',rows:[...allMRows].filter(r=>r.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,5).map(r=>({name:r.name,value:fmtYen(r.balance)})),comment:r=>r.length>0?`「${r[0].name}」が生涯最大の天敵…${r[0].value}の傷は深いぜ。もう許さん 😤`:'マイナス台の記録なし、完璧だぜ！',gradBg:isDark?'rgba(251,113,133,0.1)':'linear-gradient(135deg,#fff1f2,#fff5f5)',borderColor:'#fecdd3'},
          ];
          return (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* 年間レポート（矢印ナビ付き） */}
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,#1e293b,#334155)`, padding:'14px 20px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <button onClick={()=>moveYear(-1)} style={{ width:34,height:34,borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronLeft size={16} color="white"/></button>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:10, letterSpacing:'0.2em', color:'rgba(255,255,255,0.6)', textTransform:'uppercase', fontWeight:700 }}>YEARLY REPORT</div>
                  <div style={{ marginTop:2, fontSize:17, fontWeight:800, color:'white' }}>{currentYear} 年間レポート</div>
                </div>
                <button onClick={()=>moveYear(1)} style={{ width:34,height:34,borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer' }}><ChevronRight size={16} color="white"/></button>
              </div>
              <div style={{ padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
                {(()=>{
                  const yr=enrichedSessions.filter(s=>yearKey(s.date)===currentYear);
                  const yBal=yr.reduce((a,s)=>a+s.metrics.balanceYen,0);
                  const yEV=yr.reduce((a,s)=>a+s.metrics.estimatedEVYen,0);
                  const yWork=yr.reduce((a,s)=>a+(getWorkVolumeYen(s.metrics)??0),0);
                  const yHours=yr.reduce((a,s)=>a+numberOrZero(s.hours),0);
                  const ySpins=yr.reduce((a,s)=>a+s.metrics.totalSpins,0);
                  return (<>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                      <SummaryMetric title="年間収支" value={fmtYen(yBal)} positive={yBal>=0} sub={`稼働 ${yr.length}件`}/>
                      <SummaryMetric title="年間仕事量" value={fmtYen(Math.round(yWork))} positive={yWork>=0} sub="-"/>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[['総回転',`${Math.round(ySpins).toLocaleString()}回`],['総時間',`${yHours.toFixed(1)}h`]].map(([l,v])=>(
                        <div key={l} style={{ background:isDark?'#1e293b':'#f8fafc', border:`1px solid ${C.border}`, borderRadius:10, padding:'10px', textAlign:'center' }}>
                          <div style={{ fontSize:11, color:C.textMuted }}>{l}</div>
                          <div style={{ fontWeight:700, color:C.textPrimary, marginTop:2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </>);
                })()}
              </div>
            </div>

            {/* 今月のランキング */}
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,#7c3aed,#4f46e5)`, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'white' }}>🏆 今月のランキング</div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.7)', marginTop:2 }}>{currentMonth} のTOP5</div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>moveMonth(-1)} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'4px 10px', color:'white', fontSize:12, cursor:'pointer', fontWeight:600 }}>◀ 前月</button>
                  <button onClick={()=>moveMonth(1)} style={{ background:'rgba(255,255,255,0.15)', border:'none', borderRadius:8, padding:'4px 10px', color:'white', fontSize:12, cursor:'pointer', fontWeight:600 }}>次月 ▶</button>
                </div>
              </div>
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                {ms.length===0
                  ? <div style={{ fontSize:13, color:C.textMuted, textAlign:'center', padding:'16px' }}>今月のデータはまだないぜ。</div>
                  : monthRankDefs.map((rk,i)=><RankCard key={i} {...rk}/>)
                }
              </div>
            </div>

            {/* 生涯ランキング */}
            <div style={{ ...cardStyle, overflow:'hidden' }}>
              <div style={{ background:`linear-gradient(135deg,#0f172a,#1e293b)`, padding:'14px 18px' }}>
                <div style={{ fontSize:16, fontWeight:800, color:'white' }}>👑 生涯ランキング</div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.6)', marginTop:2 }}>全記録から永久保存版のTOP5だぜ</div>
              </div>
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:8 }}>
                {enrichedSessions.length===0
                  ? <div style={{ fontSize:13, color:C.textMuted, textAlign:'center', padding:'16px' }}>まだデータがないぜ。</div>
                  : allTimeRankDefs.map((rk,i)=><RankCard key={i} {...rk}/>)
                }
              </div>
            </div>

            <div style={cardStyle}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                <div style={{ fontWeight:700, color:C.textPrimary }}>📈 推移グラフ（収支 vs 仕事量）</div>
                <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>収支と仕事量の差が運の影響を示すぜ</div>
              </div>
              <div style={{ padding:'14px 16px' }}>
                <div style={{ height:200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                      <XAxis dataKey="label" tick={{fontSize:11,fill:C.textMuted}}/>
                      <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
                      <Tooltip formatter={(v,n)=>[fmtYen(v),n]}/>
                      <ReferenceLine y={0} stroke={C.border} strokeWidth={1.5}/>
                      <Line type="monotone" dataKey="balance" stroke={C.positive} strokeWidth={2.5} dot={false} name="実収支"/>
                      <Line type="monotone" dataKey="work" stroke={C.accent} strokeWidth={2} dot={false} strokeDasharray="5 3" name="仕事量"/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display:'flex', gap:16, justifyContent:'center', marginTop:8, fontSize:11 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:20, height:3, background:C.positive, borderRadius:2 }}/><span style={{ color:C.textMuted }}>実収支</span></div>
                  <div style={{ display:'flex', alignItems:'center', gap:4 }}><div style={{ width:20, height:2, background:C.accent, borderRadius:2, opacity:0.7 }}/><span style={{ color:C.textMuted }}>仕事量（点線）</span></div>
                </div>
              </div>
            </div>

            {/* ⑥ 週次比較グラフ */}
            {(()=>{
              const today=new Date();
              const dow=today.getDay();
              const thisWeekStart=new Date(today); thisWeekStart.setDate(today.getDate()-dow); thisWeekStart.setHours(0,0,0,0);
              const lastWeekStart=new Date(thisWeekStart); lastWeekStart.setDate(thisWeekStart.getDate()-7);
              const fmt=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
              const thisWeekDates=Array.from({length:7},(_,i)=>{const d=new Date(thisWeekStart);d.setDate(d.getDate()+i);return fmt(d);});
              const lastWeekDates=Array.from({length:7},(_,i)=>{const d=new Date(lastWeekStart);d.setDate(d.getDate()+i);return fmt(d);});
              const dayLabels=['日','月','火','水','木','金','土'];
              const thisWeekData=thisWeekDates.map((date,i)=>{
                const ss=enrichedSessions.filter(s=>s.date===date);
                return {label:dayLabels[i],balance:ss.reduce((a,s)=>a+s.metrics.balanceYen,0),ev:ss.reduce((a,s)=>a+s.metrics.estimatedEVYen,0),date};
              });
              const lastWeekData=lastWeekDates.map((date,i)=>{
                const ss=enrichedSessions.filter(s=>s.date===date);
                return {label:dayLabels[i],balance:ss.reduce((a,s)=>a+s.metrics.balanceYen,0)};
              });
              const combined=thisWeekDates.map((date,i)=>({
                label:dayLabels[i],
                今週:thisWeekData[i].balance||null,
                先週:lastWeekData[i].balance||null,
              }));
              const thisTotal=thisWeekData.reduce((a,d)=>a+d.balance,0);
              const lastTotal=lastWeekData.reduce((a,d)=>a+d.balance,0);
              return (
                <div style={cardStyle}>
                  <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div style={{ fontWeight:700, color:C.textPrimary }}>📅 週次比較</div>
                        <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>今週 vs 先週の収支比較</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:11, color:C.textMuted }}>今週合計</div>
                        <div style={{ fontWeight:800, fontSize:16, color:thisTotal>=0?C.positive:C.negative }}>{fmtYen(thisTotal)}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ padding:'14px 16px' }}>
                    <div style={{ height:160 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={combined} barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                          <XAxis dataKey="label" tick={{fontSize:11,fill:C.textMuted}}/>
                          <YAxis tick={{fontSize:11,fill:C.textMuted}}/>
                          <Tooltip formatter={(v,n)=>[fmtYen(v),n]}/>
                          <ReferenceLine y={0} stroke={C.border}/>
                          <Bar dataKey="先週" fill={isDark?'#475569':'#cbd5e1'} radius={[4,4,0,0]}/>
                          <Bar dataKey="今週" fill={C.primary} radius={[4,4,0,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', marginTop:8, fontSize:12 }}>
                      <span style={{ color:C.textMuted }}>先週合計: <b style={{ color:lastTotal>=0?C.positive:C.negative }}>{fmtYen(lastTotal)}</b></span>
                      <span style={{ color:C.textMuted }}>差: <b style={{ color:thisTotal-lastTotal>=0?C.positive:C.negative }}>{fmtYen(thisTotal-lastTotal)}</b></span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <FoldSummary title="生涯収支" total={lifetimeSummary.balance} count={lifetimeSummary.count}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
                <div style={{ color:C.textSecondary }}>期待値 <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(lifetimeSummary.ev)}</span></div>
                <div style={{ color:C.textSecondary }}>総回転 <span style={{ fontWeight:700, color:C.textPrimary }}>{Math.round(lifetimeSummary.spins).toLocaleString()}回</span></div>
              </div>
            </FoldSummary>

            {/* ⑭ 振り分けカウンター統計 */}
            {(()=>{
              // 現在のカウンターが記録されている場合のみ表示
              const activeCounts=counters.filter(c=>c.count>0);
              const totalSpins=Math.round(formMetrics.allTotalSpins)||0;
              // 履歴がある場合は平均も計算
              const historyWithCounts=counterHistory.filter(h=>h.counts&&h.counts.some(c=>c.count>0));
              if(activeCounts.length===0&&historyWithCounts.length===0) return null;
              return (
                <details style={{ border:`1px solid ${C.border}`, borderRadius:16, overflow:'hidden' }}>
                  <summary style={{ cursor:'pointer', listStyle:'none', padding:'14px 16px', background:isDark?'rgba(255,255,255,0.03)':'#f8fafc', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary }}>🎯 振り分けカウンター統計</div>
                      <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>
                        {activeCounts.length>0?`現セッション記録あり`:'履歴のみ'}
                        {historyWithCounts.length>0&&` / 過去${historyWithCounts.length}セッション`}
                      </div>
                    </div>
                    <ChevronDown size={16} color={C.textMuted}/>
                  </summary>
                  <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                    {/* 現セッションの振り分け */}
                    {activeCounts.length>0&&totalSpins>0&&(
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>📊 現セッション（総回転{totalSpins.toLocaleString()}回転）</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                          {activeCounts.map((c,_,arr)=>{
                            const pct=totalSpins>0?(c.count/totalSpins*100):0;
                            const label=counterLabels[counters.indexOf(c)];
                            return (
                              <div key={c.id}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                    <div style={{ width:8, height:8, borderRadius:'50%', background:c.color }}/>
                                    <span style={{ fontSize:12, fontWeight:600, color:C.textPrimary }}>{label}</span>
                                  </div>
                                  <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                                    <span style={{ fontSize:11, color:C.textMuted }}>{c.count}回</span>
                                    <span style={{ fontSize:13, fontWeight:800, color:c.color }}>{pct.toFixed(2)}%</span>
                                  </div>
                                </div>
                                <div style={{ height:6, background:isDark?'rgba(255,255,255,0.08)':'#f1f5f9', borderRadius:3 }}>
                                  <div style={{ height:'100%', width:`${Math.min(100,pct*3)}%`, background:c.color, borderRadius:3, transition:'width 0.4s', maxWidth:'100%' }}/>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {activeCounts.length>0&&totalSpins===0&&(
                      <div style={{ fontSize:12, color:C.textMuted }}>回転率タブにデータを入力すると決定率が計算されるぜ</div>
                    )}
                    {/* 過去セッション履歴 */}
                    {historyWithCounts.length>0&&(
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:C.textPrimary, marginBottom:8 }}>📋 過去の振り分け履歴（最新{Math.min(5,historyWithCounts.length)}件）</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          {historyWithCounts.slice(0,5).map(h=>(
                            <div key={h.id} style={{ border:`1px solid ${C.border}`, borderRadius:12, overflow:'hidden' }}>
                              <div style={{ background:isDark?'rgba(255,255,255,0.04)':'#f8fafc', padding:'8px 12px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                                <div style={{ fontSize:12, fontWeight:600, color:C.textPrimary }}>{h.date}{h.shop?` / ${h.shop}`:''}{h.machine?` / ${h.machine}`:''}</div>
                                <div style={{ fontSize:11, color:C.textMuted }}>{h.totalSpins>0?`${h.totalSpins.toLocaleString()}回転`:''}</div>
                              </div>
                              <div style={{ padding:'8px 12px', display:'flex', flexWrap:'wrap', gap:8 }}>
                                {h.counts.filter(c=>c.count>0).map(c=>{
                                  const pct=h.totalSpins>0?(c.count/h.totalSpins*100).toFixed(2):'-';
                                  return (
                                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:5, background:isDark?'rgba(255,255,255,0.05)':'#f8fafc', borderRadius:8, padding:'4px 8px', border:`1px solid ${C.border}` }}>
                                      <div style={{ width:7, height:7, borderRadius:'50%', background:c.color }}/>
                                      <span style={{ fontSize:11, color:C.textSecondary }}>{c.label}</span>
                                      <span style={{ fontSize:12, fontWeight:700, color:c.color }}>{pct}%</span>
                                      <span style={{ fontSize:10, color:C.textMuted }}>({c.count})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              );
            })()}
            <FoldSummary title="年別収支" total={yearSummaryRows.reduce((a,r)=>a+r.balance,0)} count={yearSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {yearSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:yearSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><div style={{ fontWeight:600 }}>{row.key}</div><div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}><div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div></div>
                  </div>
                ))}
              </div>
            </FoldSummary>
            <FoldSummary title="月別収支" total={monthSummaryRows.reduce((a,r)=>a+r.balance,0)} count={monthSummaryRows.length}>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {monthSummaryRows.length===0?<div style={{ fontSize:13, color:C.textMuted }}>まだデータがないぜ。</div>:monthSummaryRows.map(row=>(
                  <div key={row.key} style={{ border:`1px solid ${C.border}`, borderRadius:10, padding:'10px 12px', fontSize:13 }}>
                    <div style={{ display:'flex', justifyContent:'space-between' }}><div style={{ fontWeight:600 }}>{row.key}</div><div style={{ fontWeight:700, color:row.balance>=0?C.positive:C.negative }}>{fmtYen(row.balance)}</div></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4, marginTop:5, fontSize:12, color:C.textSecondary }}><div>EV {fmtYen(row.ev)}</div><div>{row.count}件</div></div>
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
          );
        })()}

        {/* ══════════════════ 履歴タブ ══════════════════ */}
        {activeTab==='history'&&(()=>{
          const today=todayStr();
          // 当日セッション（下書き・完了問わず）
          const todaySessions=filteredHistory.filter(s=>s.date===today);
          // 過去日付のセッション（ある場合はカレンダーへ誘導）
          const pastDates=[...new Set(filteredHistory.filter(s=>s.date!==today).map(s=>s.date))].sort((a,b)=>b.localeCompare(a));

          return (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* ヘッダー */}
            <div style={{ ...cardStyle }}>
              <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:12 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:16, color:C.textPrimary }}>今日の履歴</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{today} / {todaySessions.length}件</div>
                </div>
                <div style={{ position:'relative' }}>
                  <Search size={14} color={C.textMuted} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)' }}/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inputStyle, paddingLeft:30, fontSize:13, width:140 }} placeholder="検索"/>
                </div>
              </div>

              <div style={{ padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
                {todaySessions.length===0?(
                  <div style={{ textAlign:'center', padding:'24px', color:C.textMuted, fontSize:13 }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>📋</div>
                    今日の履歴はまだないぜ。
                  </div>
                ):todaySessions.map(s=>{
                  const machineName=s.machine?.name||s.machineFreeName||s.machineNameSnapshot||'機種未設定';
                  const hasBalls=s.metrics.currentBalls!==null;
                  const hasInheritData=hasBalls&&s.metrics.currentBalls>0;
                  const showInheritConfirm=inheritConfirmSessionId===s.id;
                  return (
                    <div key={s.id} style={{ border:`1.5px solid ${s.status==='completed'?C.positiveBorder:C.primaryMid}`, borderRadius:16, overflow:'hidden', background:C.card }}>
                      {/* ステータスバー */}
                      <div style={{ background:s.status==='completed'?C.positiveBg:C.primaryLight, padding:'6px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:11, fontWeight:700, color:s.status==='completed'?C.positive:C.primary }}>
                          {s.status==='completed'?'✅ 完了':'🎮 稼働中'}
                        </span>
                        <span style={{ fontSize:11, color:C.textMuted }}>{s.date} / {getExchangePreset(s.exchangeCategory||'25').short}</span>
                      </div>

                      <div style={{ padding:'12px 14px' }}>
                        {/* 機種・店舗 */}
                        <div style={{ fontWeight:700, color:C.textPrimary, fontSize:14, marginBottom:4 }}>{machineName}</div>
                        <div style={{ fontSize:11, color:C.textMuted, marginBottom:10 }}>{s.shop||'店舗未入力'} / 台{s.machineNumber||'-'}</div>

                        {/* 主要指標グリッド（収支・持ち玉・平均回転率） */}
                        <div style={{ display:'grid', gridTemplateColumns:`repeat(${hasBalls?3:2},1fr)`, gap:6, marginBottom:10 }}>
                          <div style={{ background:s.metrics.balanceYen>=0?C.positiveBg:C.negativeBg, borderRadius:10, padding:'8px', textAlign:'center', border:`1px solid ${s.metrics.balanceYen>=0?C.positiveBorder:C.negativeBorder}` }}>
                            <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>収支</div>
                            <div style={{ fontSize:15, fontWeight:800, color:s.metrics.balanceYen>=0?C.positive:C.negative, marginTop:2 }}>{fmtYen(s.metrics.balanceYen)}</div>
                          </div>
                          {hasBalls&&(
                            <div style={{ background:s.metrics.currentBalls>0?C.amberBg:isDark?C.card:'#f8fafc', borderRadius:10, padding:'8px', textAlign:'center', border:`1px solid ${s.metrics.currentBalls>0?C.amberBorder:C.border}` }}>
                              <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>持ち玉</div>
                              <div style={{ fontSize:15, fontWeight:800, color:s.metrics.currentBalls>0?C.amber:C.textMuted, marginTop:2 }}>{s.metrics.currentBalls.toLocaleString()}玉</div>
                            </div>
                          )}
                          <div style={{ background:C.accentLight, borderRadius:10, padding:'8px', textAlign:'center', border:`1px solid #bae6fd` }}>
                            <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>平均回転率</div>
                            <div style={{ fontSize:15, fontWeight:800, color:C.accent, marginTop:2 }}>{fmtRate(s.metrics.avgSpinPerThousand)}</div>
                          </div>
                        </div>

                        {/* サブ指標 */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, fontSize:11, color:C.textSecondary, marginBottom:10 }}>
                          <div>総回転 <span style={{ fontWeight:600, color:C.textPrimary }}>{Math.round(s.metrics.totalSpins).toLocaleString()}回</span></div>
                          <div>現金投資 <span style={{ fontWeight:600, color:C.textPrimary }}>{fmtYen(s.metrics.cashInvestYen)}</span></div>
                          <div>初当たり <span style={{ fontWeight:600, color:C.textPrimary }}>{(s.firstHits||[]).length}件</span></div>
                          {s.metrics.ballInvestBalls>0&&<div>玉投資 <span style={{ fontWeight:600, color:C.amber }}>{Math.round(s.metrics.ballInvestBalls).toLocaleString()}玉</span></div>}
                          <div>総投資 <span style={{ fontWeight:600, color:C.primary }}>{fmtYen(Math.round(s.metrics.cashInvestYen+s.metrics.ballInvestYen))}</span></div>
                          {s.startTime&&<div>打ち始め <span style={{ fontWeight:600, color:C.primary }}>{s.startTime}</span></div>}
                          {s.endTime&&<div>終了 <span style={{ fontWeight:600, color:C.primary }}>{s.endTime}</span></div>}
                          {s.startTime&&s.endTime&&fmtElapsed(calcElapsedHours(s.startTime,s.endTime))&&(
                            <div>稼働 <span style={{ fontWeight:600, color:C.accent }}>{fmtElapsed(calcElapsedHours(s.startTime,s.endTime))}</span></div>
                          )}
                        </div>

                        {/* 引き継ぎ確認バナー */}
                        {showInheritConfirm&&(
                          <div style={{ background:isDark?'rgba(251,191,36,0.12)':'#fffbeb', border:`1.5px solid ${C.amberBorder}`, borderRadius:12, padding:'12px 14px', marginBottom:10 }}>
                            <div style={{ fontWeight:700, color:C.amber, fontSize:13, marginBottom:6 }}>📋 データを引き継ぎますか？</div>
                            <div style={{ fontSize:12, color:C.textSecondary, marginBottom:10, lineHeight:1.6 }}>
                              <div>💰 前回の現金投資: <span style={{ fontWeight:700, color:C.textPrimary }}>{fmtYen(s.metrics.cashInvestYen)}</span></div>
                              {s.metrics.currentBalls>0&&<div>🎰 引継ぎ持ち玉: <span style={{ fontWeight:700, color:C.amber }}>{s.metrics.currentBalls.toLocaleString()}玉</span></div>}
                            </div>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                              <button onClick={()=>continueSessionWithInherit(s,false)}
                                style={{ padding:'9px', borderRadius:10, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:600, fontSize:12, cursor:'pointer' }}>
                                引き継がない
                              </button>
                              <button onClick={()=>continueSessionWithInherit(s,true)}
                                style={{ padding:'9px', borderRadius:10, border:'none', background:C.amber, color:'white', fontWeight:700, fontSize:12, cursor:'pointer' }}>
                                🎰 持ち玉を引き継ぐ
                              </button>
                            </div>
                          </div>
                        )}

                        {/* ボタン */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                          <button
                            onClick={()=>{
                              if(hasInheritData&&!showInheritConfirm) {
                                setInheritConfirmSessionId(s.id);
                              } else if(!hasInheritData) {
                                continueSession(s);
                              }
                            }}
                            style={{ ...btnOutline, padding:'8px', fontSize:12 }}>
                            <Pencil size={13}/>{showInheritConfirm?'確認中':'編集'}
                          </button>
                          {s.status!=='completed'&&(
                            <button onClick={()=>completeSessionById(s)}
                              style={{ background:C.positive, color:'white', border:'none', borderRadius:14, padding:'8px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontWeight:700 }}>
                              ✅ 完了
                            </button>
                          )}
                          <button onClick={()=>deleteSession(s.id)}
                            style={{ background:C.negativeBg, color:C.negative, border:`1px solid ${C.negativeBorder}`, borderRadius:14, padding:'8px', fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4, fontWeight:600, gridColumn:s.status==='completed'?'2/-1':'auto' }}>
                            <Trash2 size={13}/>削除
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 過去の履歴 → 日別へ誘導 */}
            {pastDates.length>0&&(
              <div style={{ ...cardStyle }}>
                <div style={{ padding:'14px 18px', borderBottom:`1px solid ${C.border}` }}>
                  <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary }}>📅 過去の履歴</div>
                  <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{pastDates.length}日分 / 日別タブで詳細確認できるぜ</div>
                </div>
                <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                  {pastDates.slice(0,5).map(date=>{
                    const daySessions=filteredHistory.filter(s=>s.date===date);
                    const dayBalance=daySessions.reduce((a,s)=>a+s.metrics.balanceYen,0);
                    return (
                      <button key={date} onClick={()=>{setSelectedDate(date);setCurrentMonth(monthKey(date));setActiveTab('calendar');}}
                        style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', border:`1px solid ${C.border}`, borderRadius:12, background:C.card, cursor:'pointer', textAlign:'left' }}>
                        <div>
                          <div style={{ fontWeight:600, color:C.textPrimary, fontSize:13 }}>{date}</div>
                          <div style={{ fontSize:11, color:C.textMuted, marginTop:2 }}>{daySessions.length}件</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <span style={{ fontWeight:700, fontSize:14, color:dayBalance>=0?C.positive:C.negative }}>{fmtYen(dayBalance)}</span>
                          <ChevronDown size={14} color={C.textMuted} style={{ transform:'rotate(-90deg)' }}/>
                        </div>
                      </button>
                    );
                  })}
                  {pastDates.length>5&&(
                    <button onClick={()=>setActiveTab('calendar')} style={{ ...btnSecondary, width:'100%', fontSize:13 }}>
                      すべて日別で見る（{pastDates.length}日分）
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          );
        })()}

        {/* ══════════════════ 設定タブ ══════════════════ */}
        {activeTab==='settings'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { title:'カラーテーマ', icon:<Palette size={16} color={C.primary}/>, content:(
                <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                  {/* テーマモード */}
                  <div>
                    <label style={labelStyle}>テーマモード</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                      {[['light','☀️ ライト'],['dark','🌙 ダーク'],['system','⚙️ システム']].map(([v,l])=>(
                        <button key={v} onClick={()=>setSettings(p=>({...p,themeMode:v}))}
                          style={{ padding:'10px 4px', borderRadius:12, border:`2px solid ${(settings.themeMode||'light')===v?C.primary:C.border}`, background:(settings.themeMode||'light')===v?C.primary:C.card, color:(settings.themeMode||'light')===v?'white':C.textSecondary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    {settings.themeMode==='system'&&<div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>現在: {sysDark?'ダーク':'ライト'}モード適用中</div>}
                  </div>

                  {/* 背景画像 */}
                  <div>
                    <label style={labelStyle}>背景画像</label>
                    {bgImage?(
                      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                        {/* プレビュー */}
                        <div style={{ position:'relative', borderRadius:16, overflow:'hidden', border:`1px solid ${C.border}`, height:120 }}>
                          <img src={bgImage} alt="背景プレビュー" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          <div style={{ position:'absolute', inset:0, background:`rgba(0,0,0,${0.5-bgOpacity})`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ color:'white', fontSize:12, fontWeight:700, textShadow:'0 1px 3px rgba(0,0,0,0.8)' }}>プレビュー（透明度 {Math.round(bgOpacity*100)}%）</span>
                          </div>
                        </div>
                        {/* 透明度スライダー */}
                        <div>
                          <label style={labelStyle}>透明度（低いほど薄い）</label>
                          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                            <span style={{ fontSize:12, color:C.textMuted, minWidth:24 }}>薄</span>
                            <input type="range" min="0.03" max="0.5" step="0.01" value={bgOpacity}
                              onChange={e=>updateBgOpacity(Number(e.target.value))}
                              style={{ flex:1, accentColor:C.primary }}/>
                            <span style={{ fontSize:12, color:C.textMuted, minWidth:24 }}>濃</span>
                          </div>
                        </div>
                        {/* 変更・削除ボタン */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                          <label style={{ cursor:'pointer' }}>
                            <div style={{ ...btnSecondary, padding:'11px', fontWeight:700, fontSize:13, justifyContent:'center' }}>🖼 画像を変更</div>
                            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleBgImageUpload(e.target.files[0])}/>
                          </label>
                          <button onClick={removeBgImage}
                            style={{ padding:'11px', borderRadius:14, border:`1.5px solid ${C.negativeBorder}`, background:C.card, color:C.negative, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            🗑 背景を削除
                          </button>
                        </div>
                      </div>
                    ):(
                      <div>
                        <label style={{ cursor:'pointer', display:'block' }}>
                          <div style={{ border:`2px dashed ${C.border}`, borderRadius:16, padding:'28px 20px', textAlign:'center', background:isDark?'rgba(255,255,255,0.02)':'#f8fafc' }}>
                            <div style={{ fontSize:36, marginBottom:8 }}>🖼</div>
                            <div style={{ fontWeight:700, fontSize:14, color:C.textPrimary, marginBottom:4 }}>タップして画像を選択</div>
                            <div style={{ fontSize:12, color:C.textMuted }}>好きな画像を背景に設定できるぜ<br/>（JPG・PNG・GIF対応）</div>
                          </div>
                          <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&handleBgImageUpload(e.target.files[0])}/>
                        </label>
                        <div style={{ fontSize:11, color:C.textMuted, marginTop:6 }}>※ 画像はこの端末にのみ保存されるぜ。大きすぎる画像は保存できない場合があるぜ。</div>
                      </div>
                    )}
                  </div>
                  {/* カラーテーマ選択 */}
                  <div>
                    <label style={labelStyle}>アクセントカラー</label>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
                      {[
                        ['indigo','インディゴ','#4f46e5'],
                        ['sky',   'スカイ',    '#0284c7'],
                        ['emerald','エメラルド','#059669'],
                        ['rose',  'ローズ',    '#e11d48'],
                        ['amber', 'アンバー',  '#d97706'],
                        ['violet','バイオレット','#7c3aed'],
                      ].map(([v,l,hex])=>(
                        <button key={v} onClick={()=>setSettings(p=>({...p,colorTheme:v}))}
                          style={{ padding:'12px 8px', borderRadius:14, border:`2px solid ${(settings.colorTheme||'indigo')===v?hex:C.border}`, background:(settings.colorTheme||'indigo')===v?hex:C.card, color:(settings.colorTheme||'indigo')===v?'white':C.textSecondary, fontWeight:700, fontSize:12, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:hex, border:`3px solid ${(settings.colorTheme||'indigo')===v?'rgba(255,255,255,0.6)':C.border}` }}/>
                          {l}
                          {(settings.colorTheme||'indigo')===v&&<span style={{ fontSize:10 }}>✓ 選択中</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ background:C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'10px 14px', fontSize:12, color:C.textSecondary }}>
                    💡 変更は即時反映されるぜ。好みのカラーで使ってくれ。
                  </div>
                </div>
              )},
              { title:'期待値計算の詳細設定', icon:<Settings size={16} color={C.primary}/>, content:(
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {/* 損切りライン設定 */}
                  <div style={{ background:isDark?'rgba(239,68,68,0.08)':'#fff1f2', border:`1px solid ${C.negativeBorder}`, borderRadius:14, padding:'12px 14px' }}>
                    <div style={{ fontWeight:700, fontSize:13, color:C.negative, marginBottom:10 }}>⚠️ 損切りライン</div>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                      <label style={{ fontSize:13, color:C.textPrimary, flex:1 }}>損切りアラート</label>
                      <button onClick={()=>setSettings(p=>({...p,stopLossEnabled:!p.stopLossEnabled}))}
                        style={{ width:44, height:24, borderRadius:12, background:settings.stopLossEnabled?C.negative:'#cbd5e1', border:'none', cursor:'pointer', position:'relative', transition:'0.2s' }}>
                        <div style={{ width:18, height:18, borderRadius:'50%', background:'white', position:'absolute', top:3, left:settings.stopLossEnabled?23:3, transition:'0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                      </button>
                    </div>
                    {settings.stopLossEnabled&&(
                      <div>
                        <label style={labelStyle}>損切りライン（円）</label>
                        <input value={settings.stopLossYen} onChange={e=>setSettings(p=>({...p,stopLossYen:e.target.value}))} style={inputStyle} inputMode="numeric" placeholder="30000"/>
                        <div style={{ fontSize:11, color:C.textMuted, marginTop:4 }}>この金額を超えた損失が出るとアラートが表示されるぜ</div>
                      </div>
                    )}
                  </div>
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
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {/* 追加フォーム（常時展開） */}
                  <div style={{ border:`1.5px solid ${C.primaryMid}`, borderRadius:16, padding:'16px 16px', display:'flex', flexDirection:'column', gap:12, background:isDark?'rgba(99,102,241,0.05)':C.primaryLight }}>
                    <div style={{ fontWeight:700, fontSize:14, color:C.primary }}>🏪 新しい店舗を登録</div>
                    <div>
                      <label style={labelStyle}>店舗名</label>
                      <input value={shopProfileDraft.name} onChange={e=>setShopProfileDraft(p=>({...p,name:e.target.value}))}
                        style={{ ...inputStyle, fontSize:16, padding:'12px 14px', fontWeight:600 }} placeholder="例：○○パチンコ"/>
                    </div>
                    <div>
                      <label style={labelStyle}>換金率</label>
                      <Select value={shopProfileDraft.exchangeCategory} onValueChange={v=>setShopProfileDraft(p=>({...p,exchangeCategory:v}))}>
                        <SelectTrigger className="rounded-2xl h-12 text-base"><SelectValue/></SelectTrigger>
                        <SelectContent>{EXCHANGE_ORDER.map(c=><SelectItem key={c} value={c}>{getExchangePreset(c).label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label style={labelStyle}>特日・イベント日（カレンダー登録・最大5つ）</label>
                      {/* カレンダー形式の特日登録 */}
                      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                        {(shopProfileDraft.specialDayList||[]).map((sd,i)=>(
                          <div key={i} style={{ display:'flex', gap:8, alignItems:'center', background:isDark?'rgba(99,102,241,0.08)':C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'8px 10px' }}>
                            {/* 日付選択（1〜31） */}
                            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                              <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>日</div>
                              <select value={sd.day||''} onChange={e=>{
                                const v=e.target.value;
                                setShopProfileDraft(p=>{const l=[...(p.specialDayList||[])];l[i]={...l[i],day:v};return {...p,specialDayList:l};});
                              }} style={{ width:52, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 4px', background:C.card, color:C.textPrimary, fontSize:14, fontWeight:700, textAlign:'center', cursor:'pointer' }}>
                                <option value="">--</option>
                                {Array.from({length:31},(_,j)=>j+1).map(d=><option key={d} value={d}>{d}日</option>)}
                              </select>
                            </div>
                            {/* ラベル */}
                            <div style={{ flex:1 }}>
                              <div style={{ fontSize:9, color:C.textMuted, fontWeight:600, marginBottom:2 }}>種別（任意）</div>
                              <input value={sd.label||''} onChange={e=>{
                                const v=e.target.value;
                                setShopProfileDraft(p=>{const l=[...(p.specialDayList||[])];l[i]={...l[i],label:v};return {...p,specialDayList:l};});
                              }} style={{ width:'100%', border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 8px', background:C.card, color:C.textPrimary, fontSize:13, boxSizing:'border-box' }} placeholder="例：特日・強イベなど"/>
                            </div>
                            <button onClick={()=>setShopProfileDraft(p=>({...p,specialDayList:(p.specialDayList||[]).filter((_,j)=>j!==i)}))}
                              style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:18, padding:'0 2px', flexShrink:0 }}>✕</button>
                          </div>
                        ))}
                        {(shopProfileDraft.specialDayList||[]).length<5&&(
                          <button onClick={()=>setShopProfileDraft(p=>({...p,specialDayList:[...(p.specialDayList||[]),{day:'',label:''}]}))}
                            style={{ padding:'9px', borderRadius:12, border:`1.5px dashed ${C.primaryMid}`, background:'transparent', color:C.primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                            ＋ 特日を追加（残り{5-(shopProfileDraft.specialDayList||[]).length}枠）
                          </button>
                        )}
                      </div>
                      {/* テキスト入力（そのまま残す） */}
                      <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>またはテキストで自由入力</div>
                      <input value={shopProfileDraft.specialDays} onChange={e=>setShopProfileDraft(p=>({...p,specialDays:e.target.value}))}
                        style={{ ...inputStyle, fontSize:13, padding:'10px 14px' }} placeholder="例：毎週火・木、1/7のつく日"/>
                    </div>
                    <div>
                      <label style={labelStyle}>注意点・メモ（任意）</label>
                      <textarea value={shopProfileDraft.notes} onChange={e=>setShopProfileDraft(p=>({...p,notes:e.target.value}))}
                        style={{ ...inputStyle, fontSize:14, padding:'11px 14px', minHeight:72, resize:'vertical', fontFamily:'inherit' }}
                        placeholder="例：釘が渋い、出玉が良いなど…"/>
                    </div>
                    <button onClick={()=>{addShopProfile(); setShopProfilePage(Math.floor(((settings.shopProfiles||[]).length)/SHOP_PAGE_SIZE));}}
                      style={{ ...btnPrimary, padding:'13px', fontSize:15, fontWeight:700 }}>
                      ＋ 登録する
                    </button>
                  </div>

                  {/* 登録一覧＋ページネーション */}
                  {(()=>{
                    const profiles=settings.shopProfiles||[];
                    const totalPages=Math.ceil(profiles.length/SHOP_PAGE_SIZE);
                    const page=Math.min(shopProfilePage,Math.max(0,totalPages-1));
                    const pageProfiles=profiles.slice(page*SHOP_PAGE_SIZE,(page+1)*SHOP_PAGE_SIZE);
                    return profiles.length===0
                      ? <div style={{ fontSize:13, color:C.textMuted }}>まだ登録がないぜ。</div>
                      : (
                        <>
                          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                            {pageProfiles.map(p=>(
                              <div key={p.name} style={{ border:`1px solid ${C.border}`, borderRadius:14, padding:'12px 14px', background:C.card }}>
                                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontWeight:700, fontSize:15, color:C.textPrimary }}>{p.name}</div>
                                    <div style={{ fontSize:12, color:C.textMuted, marginTop:2 }}>{getExchangePreset(p.exchangeCategory||'25').label}</div>
                                    {p.specialDays&&<div style={{ fontSize:12, color:C.primary, marginTop:4, background:C.primaryLight, borderRadius:8, padding:'3px 8px', display:'inline-block' }}>📅 {p.specialDays}</div>}
                                    {(p.specialDayList||[]).filter(d=>d.day).length>0&&(
                                      <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
                                        {(p.specialDayList||[]).filter(d=>d.day).map((d,i)=>(
                                          <span key={i} style={{ background:C.primaryLight, color:C.primary, border:`1px solid ${C.primaryMid}`, borderRadius:8, padding:'2px 8px', fontSize:12, fontWeight:600 }}>
                                            📅 {d.day}日{d.label?` (${d.label})`:''}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                    {p.notes&&<div style={{ fontSize:12, color:C.textSecondary, marginTop:4, lineHeight:1.5 }}>📝 {p.notes}</div>}
                                  </div>
                                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                                    <button onClick={()=>{setShopEditDraft({name:p.name,exchangeCategory:p.exchangeCategory||'25',specialDays:p.specialDays||'',specialDayList:p.specialDayList||[],notes:p.notes||''});setEditingShopName(p.name);}}
                                      style={{ background:C.primaryLight, color:C.primary, border:`1px solid ${C.primaryMid}`, borderRadius:10, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>編集</button>
                                    <button onClick={()=>removeShopProfile(p.name)} style={{ background:C.negativeBg, color:C.negative, border:`1px solid ${C.negativeBorder}`, borderRadius:10, padding:'6px 12px', fontSize:12, fontWeight:600, cursor:'pointer' }}>削除</button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                          {totalPages>1&&(
                            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                              <button onClick={()=>setShopProfilePage(p=>Math.max(0,p-1))} disabled={page===0}
                                style={{ padding:'6px 14px', borderRadius:10, border:`1px solid ${C.border}`, background:page===0?isDark?'#1e293b':'#f8fafc':C.card, color:page===0?C.textMuted:C.primary, fontWeight:600, fontSize:12, cursor:page===0?'default':'pointer' }}>
                                ◀ 前
                              </button>
                              <span style={{ fontSize:12, color:C.textMuted }}>{page+1} / {totalPages} ページ（{profiles.length}件）</span>
                              <button onClick={()=>setShopProfilePage(p=>Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
                                style={{ padding:'6px 14px', borderRadius:10, border:`1px solid ${C.border}`, background:page===totalPages-1?isDark?'#1e293b':'#f8fafc':C.card, color:page===totalPages-1?C.textMuted:C.primary, fontWeight:600, fontSize:12, cursor:page===totalPages-1?'default':'pointer' }}>
                                次 ▶
                              </button>
                            </div>
                          )}
                        </>
                      );
                  })()}
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

        {/* 店舗編集ダイアログ */}
        {editingShopName&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }} onClick={()=>setEditingShopName(null)}>
            <div style={{ background:C.card, borderRadius:'24px 24px 0 0', width:'100%', maxWidth:520, maxHeight:'85vh', display:'flex', flexDirection:'column' }} onClick={e=>e.stopPropagation()}>
              <div style={{ padding:'16px 18px 12px', borderBottom:`1px solid ${C.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div style={{ fontWeight:800, fontSize:15, color:C.textPrimary }}>✏️ 店舗を編集</div>
                <button onClick={()=>setEditingShopName(null)} style={{ background:'none', border:'none', fontSize:20, color:C.textMuted, cursor:'pointer' }}>✕</button>
              </div>
              <div style={{ overflowY:'auto', WebkitOverflowScrolling:'touch', padding:'16px 18px', flex:1, display:'flex', flexDirection:'column', gap:14 }}>
                <div>
                  <label style={labelStyle}>店舗名</label>
                  <input value={shopEditDraft.name} onChange={e=>setShopEditDraft(p=>({...p,name:e.target.value}))}
                    style={{ ...inputStyle, fontSize:16, padding:'12px 14px', fontWeight:600 }} placeholder="例：○○パチンコ"/>
                </div>
                <div>
                  <label style={labelStyle}>換金率</label>
                  <Select value={shopEditDraft.exchangeCategory} onValueChange={v=>setShopEditDraft(p=>({...p,exchangeCategory:v}))}>
                    <SelectTrigger className="rounded-2xl h-12 text-base"><SelectValue/></SelectTrigger>
                    <SelectContent>{EXCHANGE_ORDER.map(c=><SelectItem key={c} value={c}>{getExchangePreset(c).label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label style={labelStyle}>特日・イベント日（カレンダー登録・最大5つ）</label>
                  <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:8 }}>
                    {(shopEditDraft.specialDayList||[]).map((sd,i)=>(
                      <div key={i} style={{ display:'flex', gap:8, alignItems:'center', background:isDark?'rgba(99,102,241,0.08)':C.primaryLight, border:`1px solid ${C.primaryMid}`, borderRadius:12, padding:'8px 10px' }}>
                        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                          <div style={{ fontSize:9, color:C.textMuted, fontWeight:600 }}>日</div>
                          <select value={sd.day||''} onChange={e=>{
                            const v=e.target.value;
                            setShopEditDraft(p=>{const l=[...(p.specialDayList||[])];l[i]={...l[i],day:v};return {...p,specialDayList:l};});
                          }} style={{ width:52, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 4px', background:C.card, color:C.textPrimary, fontSize:14, fontWeight:700, textAlign:'center', cursor:'pointer' }}>
                            <option value="">--</option>
                            {Array.from({length:31},(_,j)=>j+1).map(d=><option key={d} value={d}>{d}日</option>)}
                          </select>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ fontSize:9, color:C.textMuted, fontWeight:600, marginBottom:2 }}>種別（任意）</div>
                          <input value={sd.label||''} onChange={e=>{
                            const v=e.target.value;
                            setShopEditDraft(p=>{const l=[...(p.specialDayList||[])];l[i]={...l[i],label:v};return {...p,specialDayList:l};});
                          }} style={{ width:'100%', border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 8px', background:C.card, color:C.textPrimary, fontSize:13, boxSizing:'border-box' }} placeholder="例：特日・強イベなど"/>
                        </div>
                        <button onClick={()=>setShopEditDraft(p=>({...p,specialDayList:(p.specialDayList||[]).filter((_,j)=>j!==i)}))}
                          style={{ background:'none', border:'none', color:C.textMuted, cursor:'pointer', fontSize:18, padding:'0 2px', flexShrink:0 }}>✕</button>
                      </div>
                    ))}
                    {(shopEditDraft.specialDayList||[]).length<5&&(
                      <button onClick={()=>setShopEditDraft(p=>({...p,specialDayList:[...(p.specialDayList||[]),{day:'',label:''}]}))}
                        style={{ padding:'9px', borderRadius:12, border:`1.5px dashed ${C.primaryMid}`, background:'transparent', color:C.primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                        ＋ 特日を追加（残り{5-(shopEditDraft.specialDayList||[]).length}枠）
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:C.textMuted, marginBottom:4 }}>またはテキストで自由入力</div>
                  <input value={shopEditDraft.specialDays} onChange={e=>setShopEditDraft(p=>({...p,specialDays:e.target.value}))}
                    style={{ ...inputStyle, fontSize:13, padding:'10px 14px' }} placeholder="例：毎週火・木、1/7のつく日"/>
                </div>
                <div>
                  <label style={labelStyle}>注意点・メモ（任意）</label>
                  <textarea value={shopEditDraft.notes} onChange={e=>setShopEditDraft(p=>({...p,notes:e.target.value}))}
                    style={{ ...inputStyle, fontSize:14, padding:'11px 14px', minHeight:80, resize:'vertical', fontFamily:'inherit' }}
                    placeholder="例：釘が渋い、出玉が良いなど…"/>
                </div>
              </div>
              <div style={{ padding:'12px 18px 24px', borderTop:`1px solid ${C.border}`, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <button onClick={()=>setEditingShopName(null)}
                  style={{ padding:'13px', borderRadius:14, border:`1px solid ${C.border}`, background:C.card, color:C.textSecondary, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                  キャンセル
                </button>
                <button onClick={saveShopEdit}
                  style={{ padding:'13px', borderRadius:14, border:'none', background:C.primary, color:'white', fontWeight:800, fontSize:14, cursor:'pointer' }}>
                  💾 保存する
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}