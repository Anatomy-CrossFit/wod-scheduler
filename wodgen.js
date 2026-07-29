/* ============================================================
   wodgen.js — WOD 생성 로직
   기준: Rx'd 수행자 대부분이 완수 가능한 볼륨
   시간 모델: "2분 블록" — 아래 per2 값은 2분 동안 수행 가능한 양
   ============================================================ */
"use strict";

/* ---------- 랜덤 유틸 ---------- */
const R = Math.random;
const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
const choice = (a) => a[Math.floor(R() * a.length)];
const chance = (p) => R() < p;
function weightedPick(entries) {
  const tot = entries.reduce((s, e) => s + e[1], 0);
  let r = R() * tot;
  for (const [k, w] of entries) { r -= w; if (r <= 0) return k; }
  return entries[entries.length - 1][0];
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   동작 라이브러리
   per2: 2분 기준 수행량 (unit: reps | m | cal)
   flags:
     mono   유산소 단일 동작
     noRun  달리기와 같은 와드에 못 넣음 (공간 충돌: 버피/TGU/박스/월볼/싯업)
     rig    풀업바(랙) 사용 — 메트콘 안에서 Back Squat와 조합 불가
     single 기구 1개 (로프/슬레드/배틀로프/요크) — 10+스테이션 EMOM 전용
     erg    Bike/Ski — 6대뿐이라 스테이션·파트너 외에는 Row/Bike/Ski 택1로 표기
     alt    번갈아 하는 동작 — 반드시 짝수 렙
   tags: lower/upper/abs/press/clean/snatch/thr/full/mono
   ============================================================ */
const MOVES = [
  { n: "Run",  unit: "m",  per2: 400, mono: true, isRun: true, tags: ["mono"] },
  { n: "Row",  unit: "m",  per2: 500, mono: true, tags: ["mono"] },
  { n: "Ski",  unit: "m",  per2: 500, mono: true, erg: true, tags: ["mono"] },
  { n: "Bike", unit: "cal", per2: 15, mono: true, erg: true, tags: ["mono"] },

  { n: "Push up",        per2: 50,  tags: ["upper", "press"] },
  { n: "Air squat",      per2: 75,  tags: ["lower"] },
  { n: "Double under",   per2: 200, tags: ["lower"] },
  { n: "Burpee",         per2: 30,  noRun: true, tags: ["full"] },
  { n: "Box jump 24/20", per2: 40,  noRun: true, tags: ["lower"] },
  { n: "Sit up",         per2: 60,  noRun: true, tags: ["abs"] },
  { n: "Box step over",  per2: 30,  noRun: true, tags: ["lower"] },
  { n: "Burpee box jump over", per2: 20, noRun: true, tags: ["full"] },
  { n: "Bar facing burpee",    per2: 24, noRun: true, tags: ["full"] },
  { n: "Wall ball 20/14",      per2: 40, noRun: true, tags: ["lower", "thr"] },
  { n: "Walking Lunge",  per2: 60,  alt: true, tags: ["lower"] },
  { n: "Jumping Jack",   per2: 120, tags: ["mono"] },
  { n: "Mountain climber", per2: 100, alt: true, tags: ["abs"] },
  { n: "Russian twist",  per2: 80,  alt: true, tags: ["abs"] },
  { n: "V-up",           per2: 40,  tags: ["abs"] },
  { n: "Hollow rock",    per2: 50,  tags: ["abs"] },
  { n: "Back extension", per2: 50,  tags: ["abs"] },
  { n: "Plank shoulder tap", per2: 60, alt: true, tags: ["abs"] },

  { n: "Pull up",  per2: 30, rig: true, tags: ["upper"] },
  { n: "C2B Pull up", per2: 15, rig: true, tags: ["upper"] },
  { n: "T2B",      per2: 24, rig: true, tags: ["abs"] },
  { n: "K2E",      per2: 30, rig: true, tags: ["abs"] },
  { n: "HSPU",     per2: 20, tags: ["upper", "press"] },
  { n: "Ring dip", per2: 24, tags: ["upper", "press"] },

  /* 바벨·DB는 파운드 표기(시트 관례), KB는 kg */
  { n: "KB Swing 24/16",     per2: 40, tags: ["lower", "snatch"] },
  { n: "DB Snatch 50/35",    per2: 30, alt: true, tags: ["snatch", "full"] },
  { n: "DB Clean 50/35",     per2: 30, tags: ["clean"] },
  { n: "DB Thruster 50/35",  per2: 24, tags: ["thr", "lower"] },
  { n: "DB Lunge 50/35",     per2: 40, alt: true, tags: ["lower"] },
  { n: "Goblet Squat 24/16", per2: 40, tags: ["lower"] },
  { n: "TGU 24/16",          per2: 10, alt: true, noRun: true, tags: ["full"] },
  { n: "Thruster 95/65",     per2: 24, tags: ["thr", "lower", "press"] },
  { n: "Deadlift 185/125",   per2: 30, tags: ["dead"] },
  { n: "Power Clean 135/95", per2: 20, tags: ["clean"] },
  { n: "Hang Power Clean 135/95", per2: 24, tags: ["clean"] },
  { n: "Clean & Jerk 135/95", per2: 14, tags: ["clean", "press"] },
  { n: "Power Snatch 95/65", per2: 16, tags: ["snatch"] },
  { n: "OHS 95/65",          per2: 20, tags: ["snatch", "lower"] },
  { n: "Push Press 75/55",   per2: 30, tags: ["press", "upper"] },
  { n: "Strict Press 65/45", per2: 24, tags: ["press", "upper"] },
  { n: "Med ball clean 20/14", per2: 30, tags: ["clean"] },
  { n: "Farmer's Carry 24/16", unit: "m", per2: 100, tags: ["full"] },
  { n: "Sandbag carry",      unit: "m", per2: 80, tags: ["full"] },

  { n: "Rope climb",   per2: 5,  single: true, rig: true, tags: ["upper"] },
  { n: "Sled push",    unit: "m", per2: 60, single: true, tags: ["lower"] },
  { n: "Battle rope",  unit: "s", per2: 80, single: true, tags: ["upper"] },
  { n: "Yoke carry",   unit: "m", per2: 40, single: true, tags: ["full"] },
];
const MOVE = Object.fromEntries(MOVES.map((m) => [m.n, m]));

/* ---------- 벤치마크 (Girls — 월수금용) ----------
   sub7: 물리적으로 7분 내 완수 가능 → 75% 7분 / 25% 15분 캡
   그 외는 15~20분 캡 (capFix가 있으면 그 값) */
const GIRLS = [
  { name: "Fran",      body: "21-15-9\nThruster 95/65\nPull up", sub7: true,  link: ["thr", "press"] },
  { name: "Grace",     body: "30 Clean & Jerk 135/95",           sub7: true,  link: ["cnj", "clean"] },
  { name: "Isabel",    body: "30 Snatch 135/95",                 sub7: true,  link: ["snatch"] },
  { name: "Diane",     body: "21-15-9\nDeadlift 225/155\nHSPU",  sub7: true,  link: ["dead", "press"] },
  { name: "Elizabeth", body: "21-15-9\nClean 135/95\nRing dip",  sub7: true,  link: ["clean"] },
  { name: "Karen",     body: "150 Wall ball 20/14",              sub7: true,  link: ["squat", "thr"] },
  { name: "Annie",     body: "50-40-30-20-10\nDouble under\nSit up", sub7: false, link: ["abs", "dead"] },
  { name: "Helen",     body: "3 Rounds of\n400m Run\n21 KB Swing 24/16\n12 Pull up", sub7: false, link: ["snatch"] },
  { name: "Nancy",     body: "5 Rounds of\n400m Run\n15 OHS 95/65", sub7: false, link: ["squat", "snatch"] },
  { name: "Jackie",    body: "1000m Row\n50 Thruster 45/35\n30 Pull up", sub7: false, link: ["thr", "press"] },
  { name: "Cindy",     body: "20mins AMRAP\n5 Pull up\n10 Push up\n15 Air squat", sub7: false, capFix: 20, link: ["press", "squat"] },
];

/* ---------- 롱 벤치마크 / 히어로 / 오픈 (화목용, 30~50분) ---------- */
const LONG_BENCH = [
  { name: "Murph",  body: "1 mile Run\n100 Pull up\n200 Push up\n300 Air squat\n1 mile Run\n(조끼 착용은 선택)", cap: 50 },
  { name: "The Seven", body: "7 Rounds of\n7 HSPU\n7 Thruster 135/95\n7 T2B\n7 Deadlift 245/165\n7 Burpee\n7 DB Snatch 50/35\n7 Pull up", cap: 49 },
  { name: "Kelly",  body: "5 Rounds of\n400m Run\n30 Box jump 24/20\n30 Wall ball 20/14", cap: 35 },
  { name: "Filthy Fifty", body: "50 Box jump\n50 Jumping pull up\n50 KB Swing 16/12\n50 Walking Lunge\n50 K2E\n50 Push Press 45/35\n50 Back extension\n50 Wall ball\n50 Burpee\n50 Double under", cap: 40 },
];
const OPENS = [
  { name: "OPEN 24.1", body: "21-15-9 (each arm)\nDB Snatch 50/35\nBurpee over DB", cap: 15 },
  { name: "OPEN 24.2", body: "20mins AMRAP\n300m Row\n10 Deadlift 185/125\n50 Double under", cap: 20 },
  { name: "OPEN 24.3", body: "5 Rounds of\n10 Thruster 95/65\n10 C2B Pull up\n1min Rest\n5 Rounds of\n10 Thruster 135/95\n10 Muscle up", cap: 15 },
  { name: "OPEN 25.1", body: "3-6-9-12-15...\nBurpee over DB\nDB Hang clean to OH 50/35\n+ 30ft Walking Lunge 매 라운드", cap: 15 },
  { name: "OPEN 25.2", body: "21 Pull up / 42 DU / 21 Thruster 95/65\n18 C2B / 36 DU / 18 Thruster 115/75\n15 Muscle up / 30 DU / 15 Thruster 135/85", cap: 15 },
  { name: "OPEN 26.1", body: "20-30-40-66-40-30-20\nWall ball 20/14\n18 Box jump over 매 구간 사이", cap: 12 },
];

/* ---------- 대한민국 공휴일 (대체공휴일 포함, 2025~2027) ----------
   데이터 테이블 — 연도 추가 시 여기에 이어서 넣으면 됨 */
const HOLIDAYS = {
  "2025-01-01": "신정", "2025-01-28": "설연휴", "2025-01-29": "설날", "2025-01-30": "설연휴",
  "2025-03-01": "삼일절", "2025-03-03": "대체공휴일(삼일절)",
  "2025-05-05": "어린이날·부처님오신날", "2025-05-06": "대체공휴일",
  "2025-06-06": "현충일", "2025-08-15": "광복절", "2025-10-03": "개천절",
  "2025-10-05": "추석연휴", "2025-10-06": "추석", "2025-10-07": "추석연휴", "2025-10-08": "대체공휴일(추석)",
  "2025-10-09": "한글날", "2025-12-25": "성탄절",
  "2026-01-01": "신정", "2026-02-16": "설연휴", "2026-02-17": "설날", "2026-02-18": "설연휴",
  "2026-03-01": "삼일절", "2026-03-02": "대체공휴일(삼일절)",
  "2026-05-05": "어린이날", "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일(부처님오신날)",
  "2026-06-06": "현충일", "2026-08-15": "광복절", "2026-08-17": "대체공휴일(광복절)",
  "2026-09-24": "추석연휴", "2026-09-25": "추석", "2026-09-26": "추석연휴", "2026-09-28": "대체공휴일(추석)",
  "2026-10-03": "개천절", "2026-10-05": "대체공휴일(개천절)", "2026-10-09": "한글날", "2026-12-25": "성탄절",
  "2027-01-01": "신정", "2027-02-06": "설연휴", "2027-02-07": "설날", "2027-02-08": "설연휴", "2027-02-09": "대체공휴일(설)",
  "2027-03-01": "삼일절", "2027-05-05": "어린이날", "2027-05-13": "부처님오신날",
  "2027-06-06": "현충일", "2027-08-15": "광복절", "2027-08-16": "대체공휴일(광복절)",
  "2027-09-14": "추석연휴", "2027-09-15": "추석", "2027-09-16": "추석연휴",
  "2027-10-03": "개천절", "2027-10-04": "대체공휴일(개천절)", "2027-10-09": "한글날", "2027-10-11": "대체공휴일(한글날)",
  "2027-12-25": "성탄절", "2027-12-27": "대체공휴일(성탄절)",
};

/* ---------- GAMES / OPEN 첫 공개일 (KST) ----------
   시즌 일정이 확정되면 여기를 수정/추가.
   OPEN은 보통 목/금 공개 후 3~4일 기록 접수 — "첫 공개일"만 적는다.
   등록된 날은 모든 배치 규칙을 무시하고 그날 전체가 해당 표기로 잡힌다. */
const EVENT_DAYS = {
  "2027-02-26": "OPEN 27.1", /* 예상일 - 시즌 일정 확정 후 수정 */
  "2027-03-05": "OPEN 27.2", /* 예상일 - 시즌 일정 확정 후 수정 */
  "2027-03-12": "OPEN 27.3", /* 예상일 - 시즌 일정 확정 후 수정 */
  /* "2026-08-07": "GAMES",     게임스 첫 공개일 확정 시 기입 */
};

/* ---------- Mini Rox (고정 내용) ---------- */
const MINI_ROX_BODY = [
  "Mini Rox",
  "",
  "Time cap 44mins",
  "500m(M)/400m(W) Run",
  "50 Push up",
  "500m(M)/400m(W) Run",
  "500m Ski",
  "500m(M)/400m(W) Run",
  "100m Burpee broad jump",
  "500m(M)/400m(W) Run",
  "500m Row",
  "500m(M)/400m(W) Run",
  "50 DB Snatch",
  "500m(M)/400m(W) Run",
  "250m Lunge",
  "500m(M)/400m(W) Run",
  "250m Farmer's Carry",
  "500m(M)/400m(W) Run",
].join("\n");

/* ============================================================
   숫자 정리(깔끔한 렙) & 시간 계산
   ============================================================ */
function niceReps(x, opts = {}) {
  let v;
  if (x >= 40) v = Math.round(x / 10) * 10;
  else if (x >= 12) v = Math.round(x / 5) * 5;
  else v = Math.max(1, Math.round(x));
  if (opts.even && v % 2 !== 0) v += 1;
  return v;
}
function niceDist(m, moveName) {
  if (moveName === "Bike") return Math.max(5, Math.round(m / 5) * 5); // cal
  if (m >= 400) return Math.round(m / 100) * 100;
  return Math.max(50, Math.round(m / 50) * 50);
}
function amountFor(move, minutes, mult = 1) {
  const raw = (move.per2 * minutes / 2) * mult;
  if (move.unit === "m" || move.unit === "cal" || move.unit === "s")
    return niceDist(raw, move.n);
  return niceReps(raw, { even: !!move.alt });
}
function minutesOf(move, amount) {
  return (amount / move.per2) * 2;
}
function fmtAmount(move, amount) {
  if (move.unit === "m") return `${amount}m ${move.n}`;
  if (move.unit === "cal") return `${amount}cals ${move.n}`;
  if (move.unit === "s") return `${amount}s ${move.n}`;
  return `${amount} ${move.n}`;
}
/* Bike/Ski는 스테이션·파트너 외에는 Row/Bike/Ski 택1로 표기 */
function displayName(move, ctx) {
  if (move.erg && !ctx.station && !ctx.partner) {
    return move.unit === "cal" ? "Row/Bike/Ski" : `${move.n}/Row 택1`;
  }
  return move.n;
}
function fmtLine(move, amount, ctx = {}) {
  const name = displayName(move, ctx);
  if (move.unit === "m") return `${amount}m ${name}`;
  if (move.unit === "cal") return `${amount}cals ${name}`;
  if (move.unit === "s") return `${amount}s ${name}`;
  return `${amount} ${name}`;
}

/* ============================================================
   조합 제약
   ============================================================ */
function compatible(selected, cand, ctx) {
  if (selected.some((m) => m.n === cand.n)) return false;
  if (cand.single && !(ctx.station && ctx.stationCount >= 10)) return false;
  const hasRun = selected.some((m) => m.isRun) || cand.isRun;
  const hasNoRun = selected.some((m) => m.noRun) || cand.noRun;
  /* 달리기 + 공간동작: EMOM(매분 교대)만 예외 */
  if (hasRun && hasNoRun && !ctx.emom) {
    if (cand.isRun && selected.some((m) => m.noRun)) return false;
    if (cand.noRun && selected.some((m) => m.isRun)) return false;
  }
  /* Back Squat + 풀업바: 메트콘 내 구조적 불가 (EMOM으로도 안 됨) */
  if (ctx.hasBackSquat && cand.rig) return false;
  return true;
}
function pickMoves(pool, k, ctx, seed) {
  const sel = [];
  if (seed) sel.push(seed); /* 달리기 필수 등 강제 포함 동작 */
  const cands = shuffle(pool);
  for (const c of cands) {
    if (sel.length >= k) break;
    if (compatible(sel, c, ctx)) sel.push(c);
  }
  return sel;
}

/* ============================================================
   1년 중복 방지 (5% 허용)
   시그니처 = 정렬된 동작명 + 패턴 키. localStorage에 생성 이력 보관.
   ============================================================ */
const LS_KEY = "wodcal_v2";
function loadState() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; }
  catch { return {}; }
}
function saveState(st) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(st)); } catch {}
}
let STATE = loadState();
STATE.history = (STATE.history || []).filter(
  (h) => Date.now() - h.t < 370 * 24 * 3600 * 1000
);
STATE.weeks = STATE.weeks || {};
STATE.benchUse = STATE.benchUse || {}; /* 히어로/오픈 와드 마지막 배치일: { 이름: "YYYY-MM-DD" } */

function sigOf(moves, patternKey) {
  return patternKey + "|" + moves.map((m) => m.n).sort().join(",");
}
function isRecentDup(sig) {
  return STATE.history.some((h) => h.s === sig);
}
function recordSig(sig) {
  if (!STATE.history.some((h) => h.s === sig)) {
    STATE.history.push({ s: sig, t: Date.now() });
  }
}

/* ============================================================
   메트콘 컴포저
   targetMin 목표 시간, opts: {pool, partner, mwf(작은 메트콘), station 허용}
   For Time 70% / AMRAP 20% / EMOM 10%
   ============================================================ */
function composeMetcon(targetMin, opts = {}) {
  for (let attempt = 0; attempt < 16; attempt++) {
    const w = buildMetconOnce(targetMin, opts);
    if (!w) continue;
    /* 볼륨 검산: 목표 대비 -25% ~ +5%만 허용.
       부족하면 재조립(또는 빌더가 바이인으로 보충), 초과는 Rx'd 완주 불가라 탈락 */
    if (w.est && (w.est < targetMin * 0.75 || w.est > targetMin * 1.05)) continue;
    if (isRecentDup(w.sig) && !chance(0.05)) continue; // 95% 재추첨
    recordSig(w.sig);
    return w;
  }
  const w = buildMetconOnce(targetMin, opts) || {
    body: `${targetMin}mins AMRAP\n${amountFor(MOVE["Row"], 2)}m Row\n15 Air squat\n10 Sit up`,
    sig: "fallback",
  };
  recordSig(w.sig);
  return w;
}

function buildMetconOnce(targetMin, opts) {
  const mult = opts.partner ? 1.3 : 1;
  const pool = (opts.pool || MOVES).filter((m) => !m.single);
  const type = weightedPick([["ft", 0.7], ["amrap", 0.2], ["emom", 0.1]]);

  if (type === "emom") {
    /* 달리기 필수면 스테이션 EMOM 제외(로테이션 중 달리기는 공간 충돌) */
    return opts.station && !opts.mwf && !opts.requireRun
      ? buildStationEmom(targetMin, opts)
      : buildAltEmom(targetMin, pool, opts);
  }
  if (type === "amrap") return buildAmrap(targetMin, pool, mult, opts);
  /* For Time: 라운드 60% / 렙스킴 25% / 치퍼 15% (짧은 메트콘은 치퍼 제외) */
  let sub = weightedPick([["rounds", 0.6], ["ladder", 0.25], ["chipper", opts.mwf ? 0 : 0.15]]);
  if (opts.requireRun && sub === "ladder") sub = "rounds"; /* 렙스킴은 렙 동작만이라 */
  if (sub === "ladder") return buildLadder(targetMin, pool, mult, opts);
  if (sub === "chipper") return buildChipper(targetMin, pool, mult, opts);
  return buildRounds(targetMin, pool, mult, opts);
}

function capLine(estMin, maxCap = 50) {
  /* 타임캡은 "내용물 검산 시간" + 15% 여유.
     화목 최대 50분, 월수금 최대 20분 — Rx'd 기준 무조건 캡 안에 완주 가능해야 한다 */
  const cap = Math.min(maxCap, Math.ceil((estMin * 1.15) / 5) * 5);
  return `Time cap ${cap}mins`;
}
/* 표기된 수행량의 예상 소요시간(분). 파트너는 교대 수행이라
   같은 표기량을 mult배 빠르게 소화한다고 본다 */
function estOf(move, amount, mult) {
  return minutesOf(move, amount) / mult;
}

function buildRounds(T, pool, mult, opts) {
  const k = opts.mwf ? ri(2, 3) : ri(3, 4);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < k) return null;
  const roundMin = opts.mwf ? ri(2, 4) : ri(4, 6);
  const rounds = Math.max(2, Math.round(T / roundMin));
  const per = roundMin / moves.length;
  const amounts = moves.map((m) => amountFor(m, per, mult));
  /* 실제 표기 렙 기준으로 재검산 */
  const est = rounds * moves.reduce((s, m, i) => s + estOf(m, amounts[i], mult), 0);
  const lines = moves.map((m, i) => fmtLine(m, amounts[i], opts));
  const body = [
    `${rounds} Rounds For Time`,
    ...lines,
    capLine(est, opts.mwf ? 20 : 50),
  ].join("\n");
  return { body, sig: sigOf(moves, `rounds${rounds}`), est };
}

/* 렙스킴은 미리 정해둔 "깔끔한" 패턴만 사용 — 배율 조정으로 42-30-18 같은
   어색한 숫자를 만들지 않고, 목표 시간에 가장 가까운 패턴을 고른다.
   번갈아 하는 동작(alt)이 포함되면 전부 짝수인 패턴만. */
const LADDERS_ANY = [
  [21, 15, 9], [15, 12, 9], [12, 9, 6, 3], [30, 20, 10], [15, 10, 5],
  [50, 40, 30, 20, 10], [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
  [5, 10, 15, 20], [20, 15, 10, 5], [25, 20, 15, 10, 5],
];
const LADDERS_EVEN = [
  [30, 20, 10], [40, 30, 20, 10], [50, 40, 30, 20, 10],
  [20, 16, 12, 8, 4], [10, 8, 6, 4, 2], [2, 4, 6, 8, 10], [10, 20, 30],
];
function buildLadder(T, pool, mult, opts) {
  const k = ri(2, 3);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  /* 렙 기반 동작만 (거리 동작 제외) */
  const moves = pickMoves(pool.filter((m) => !m.unit), k, ctx);
  if (moves.length < k) return null;
  const pats = moves.some((m) => m.alt) ? LADDERS_EVEN : LADDERS_ANY;
  /* 각 패턴의 예상 시간(표기 렙 기준 검산)을 계산해 목표에 가장 가까운 것 선택 */
  let best = null, bestDiff = Infinity, bestEst = 0;
  for (const pat of shuffle(pats)) {
    const total = pat.reduce((a, b) => a + b, 0);
    const est = moves.reduce((s, m) => s + estOf(m, total, mult), 0);
    const diff = Math.abs(est - T);
    if (diff < bestDiff) { best = pat; bestDiff = diff; bestEst = est; }
  }
  const lines = [`For Time`, best.join("-"), ...moves.map((m) => displayName(m, opts))];
  /* 패턴만으로 목표 시간에 못 미치면 바이인/캐시아웃으로 채움 */
  let est = bestEst;
  const gap = T - bestEst;
  if (gap > T * 0.25) {
    const fillPool = MOVES.filter((m) => m.mono && !m.erg &&
      !(m.isRun && moves.some((x) => x.noRun)));
    const fill = choice(fillPool);
    const half = amountFor(fill, gap / 2, mult);
    lines.unshift(`Buy-in: ${fmtLine(fill, half, opts)}`);
    lines.push(`Cash-out: ${fmtLine(fill, half, opts)}`);
    est += 2 * estOf(fill, half, mult);
  }
  lines.push(capLine(est, opts.mwf ? 20 : 50));
  return { body: lines.join("\n"), sig: sigOf(moves, `lad${best[0]}-${best.length}`), est };
}

function buildChipper(T, pool, mult, opts) {
  const k = Math.min(ri(8, 11), 11);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < 8) return null;
  const per = T / moves.length;
  const amounts = moves.map((m) => amountFor(m, per, mult));
  const est = moves.reduce((s, m, i) => s + estOf(m, amounts[i], mult), 0);
  const lines = moves.map((m, i) => fmtLine(m, amounts[i], opts));
  const body = [`For Time (Chipper)`, ...lines, capLine(est, opts.mwf ? 20 : 50)].join("\n");
  return { body, sig: sigOf(moves, "chip"), est };
}

function buildAmrap(T, pool, mult, opts) {
  const k = opts.mwf ? ri(2, 3) : ri(3, 5);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < k) return null;
  const roundMin = opts.mwf ? ri(2, 3) : ri(3, 5);
  const per = roundMin / moves.length;
  const lines = moves.map((m) => fmtLine(m, amountFor(m, per, mult), opts));
  const body = [`${T}mins AMRAP`, ...lines].join("\n");
  return { body, sig: sigOf(moves, `amrap`), est: T };
}

function buildAltEmom(T, pool, opts) {
  /* 교대 EMOM. 달리기 포함 가능(매분 전원이 같은 스테이션이므로 공간 충돌 없음) */
  const k = opts.mwf ? 2 : ri(2, 4);
  const ctx = { emom: true, hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < k) return null;
  const Tn = Math.round(T / k) * k;
  const labels = k === 2 ? ["홀수분", "짝수분"] : moves.map((_, i) => `${i + 1}분`);
  const lines = moves.map((m, i) => {
    const amt = amountFor(m, 0.75); // 분당 45초 작업량
    return `${labels[i]}: ${fmtLine(m, amt, opts)}`;
  });
  const body = [`EMOM ${Tn}`, ...lines].join("\n");
  return { body, sig: sigOf(moves, "emom"), est: Tn };
}

function buildStationEmom(T, opts) {
  /* 2분 x 10+ 스테이션 — 로프클라임/슬레드 등 기구 1개 동작 사용 가능 */
  const k = Math.max(10, Math.min(15, Math.round(T / 2 / (chance(0.5) ? 2 : 1))));
  const rounds = T >= 2 * k * 1.5 ? 2 : 1;
  const ctx = { station: true, stationCount: k, emom: true };
  const singles = shuffle(MOVES.filter((m) => m.single)).slice(0, ri(1, 2));
  /* 스테이션 로테이션 중 달리기는 트랙-플로어 공간 충돌이라 제외 */
  const rest = pickMoves(MOVES.filter((m) => !m.single && !m.isRun), k - singles.length, ctx);
  const moves = shuffle(singles.concat(rest));
  if (moves.length < 10) return null;
  const lines = moves.map((m, i) => {
    const amt = amountFor(m, 1.5); // 스테이션당 90초 작업량
    return `${i + 1}) ${fmtLine(m, amt, { station: true })}`;
  });
  const head = rounds === 2
    ? `2 Rounds of EMOM 2mins x ${moves.length} stations`
    : `EMOM 2mins x ${moves.length} stations`;
  const body = [head, ...lines].join("\n");
  return { body, sig: sigOf(moves, "stmom"), est: 2 * moves.length * rounds };
}

/* ============================================================
   스트랭스 (월수금)
   확률: Squat/Press/Clean/Snatch 각 23%, Deadlift 8%
   ============================================================ */
const LIFT_WEIGHTS = [["squat", 23], ["press", 23], ["clean", 23], ["snatch", 23], ["dead", 8]];
const LIFT_COLORS = { squat: "red", clean: "blue", snatch: "purple", dead: "orange", press: "green" };

function pickWeekLifts(prevWeek) {
  for (let attempt = 0; attempt < 30; attempt++) {
    /* 가중치 비복원 추출 3개 */
    let pool = LIFT_WEIGHTS.slice();
    const lifts = [];
    for (let i = 0; i < 3; i++) {
      const k = weightedPick(pool);
      lifts.push(k);
      pool = pool.filter((e) => e[0] !== k);
    }
    const order = shuffle(lifts);
    /* 지난주와 같은 구성이면 순서가 반드시 달라야 함 */
    if (prevWeek && prevWeek.order &&
        prevWeek.order.slice().sort().join() === order.slice().sort().join() &&
        prevWeek.order.join() === order.join()) continue;
    return order;
  }
  return shuffle(["squat", "clean", "press"]);
}

function rollVariants(order) {
  /* 주 전체 제약을 고려해 변형 결정 */
  const week = { order, names: {}, flags: {} };
  const hasSnatch = order.includes("snatch");

  /* squat 변형 */
  if (order.includes("squat")) {
    if (chance(0.10)) week.flags.thruster = true;
    else {
      const r = R();
      week.flags.squatVar = r < 0.85 ? "Back Squat" : r < 0.95 ? "Front Squat" : "Overhead Squat";
      if (week.flags.squatVar === "Overhead Squat" && hasSnatch) week.flags.squatVar = "Back Squat"; // OHS 주에는 스내치 불가
    }
  }
  /* clean 변형: 20% C&J (쓰러스터 주면 불가) */
  if (order.includes("clean")) {
    if (!week.flags.thruster && chance(0.20)) week.flags.cnj = true;
  }
  /* press 변형: 1/3씩. C&J·쓰러스터 주에는 Strict만 */
  if (order.includes("press")) {
    if (week.flags.cnj || week.flags.thruster) week.flags.pressVar = "Strict Press";
    else week.flags.pressVar = choice(["Strict Press", "Push Press", "Push Jerk"]);
  }
  /* 이름 결정 */
  const prefixRoll = () => { const r = R(); return r < 0.8 ? "" : r < 0.9 ? "Power " : "Squat "; };
  for (const lift of order) {
    let nm;
    if (lift === "squat") nm = week.flags.thruster ? "Thruster" : week.flags.squatVar;
    else if (lift === "dead") nm = "Deadlift";
    else if (lift === "press") nm = week.flags.pressVar;
    else if (lift === "clean") nm = week.flags.cnj ? "Clean & Jerk" : prefixRoll() + "Clean";
    else if (lift === "snatch") nm = prefixRoll() + "Snatch";
    week.names[lift] = nm.replace("Squat Squat", "Squat");
  }
  return week;
}

/* 스트랭스 연계 메트콘 풀 */
function linkedPool(lift, week) {
  const t = (tags) => MOVES.filter((m) => !m.single && m.tags && m.tags.some((x) => tags.includes(x)));
  const mono = MOVES.filter((m) => m.mono);
  let pool;
  if (lift === "squat") {
    pool = week.flags.thruster ? t(["thr", "lower"]) : t(["lower"]);
  } else if (lift === "press") pool = t(["upper", "press", "abs"]);
  else if (lift === "dead") pool = t(["abs"]);
  else if (lift === "clean") pool = t(["clean", "full"]);
  else if (lift === "snatch") pool = t(["snatch"]);
  else pool = t(["full"]);
  return pool.concat(mono);
}

/* ============================================================
   기념일 와드
   ============================================================ */
function pad2(n) { return String(n).padStart(2, "0"); }
function commemorativeFor(date, isCardioDay) {
  const m = date.getMonth() + 1, d = date.getDate();
  const key = `${m}/${d}`;
  /* 7/7 -> The Seven */
  if (m === 7 && d === 7) {
    STATE.benchUse["The Seven"] = dateKey(date); /* 60일 쿨다운에 반영 */
    return { title: "The Seven (7/7)", body: LONG_BENCH[1].body + "\nTime cap 49mins", cat: "plum" };
  }
  /* 숫자 반복일 (6/6, 8/8 ...) */
  if (m === d) {
    const n = d;
    const k = Math.min(n, 6);
    const moves = pickMoves(MOVES.filter((x) => !x.single && !x.unit), k, {});
    const reps = isCardioDay ? n * 2 : n;
    const lines = moves.map((mv) => `${niceReps(reps, { even: !!mv.alt })} ${mv.n}`);
    const rounds = isCardioDay ? Math.max(n, 6) : n;
    return {
      title: `${m}/${d} 기념 WOD`,
      body: [`${rounds} Rounds For Time`, ...lines, isCardioDay ? capLine(40) : capLine(15, 20)].join("\n"),
      cat: "plum",
    };
  }
  /* 119 소방 / 112 경찰 */
  const fire = (m === 1 && d === 19) || (m === 11 && d === 9);
  const police = (m === 1 && d === 12) || (m === 11 && d === 2);
  if (fire || police) {
    const label = fire ? "119 소방 기념 WOD" : "112 경찰 기념 WOD";
    const scheme = fire ? [1, 1, 9] : [1, 1, 2];
    const rounds = fire ? 9 : 11;
    const reps = fire ? 11 : 12;
    const pool = MOVES.filter((x) => !x.single && !x.isRun && !x.unit);
    const moves = pickMoves(pool, 3, {});
    const lines = moves.map((mv) => `${niceReps(reps, { even: !!mv.alt })} ${mv.n}`);
    const runLead = isCardioDay ? `${fire ? 1190 : 1120}m Run Buy-in\n` : "";
    return {
      title: label,
      body: [`For Time`, runLead + `${rounds} Rounds of`, ...lines, isCardioDay ? capLine(40) : capLine(17, 20)].join("\n"),
      cat: "plum",
    };
  }
  return null;
}

/* 공휴일 기념 와드 (전날 배치) */
function holidayWod(name, date, isCardioDay) {
  const m = date.getMonth() + 1, d = date.getDate();
  const rounds = Math.max(2, Math.min(10, m));
  const reps = niceReps(d, {});
  const pool = MOVES.filter((x) => !x.single && !x.unit);
  const moves = pickMoves(pool, isCardioDay ? 4 : 3, {});
  const lines = moves.map((mv) => `${niceReps(reps, { even: !!mv.alt })} ${mv.n}`);
  return {
    title: `${name} 기념 WOD (${m}/${d})`,
    body: [`${rounds} Rounds For Time`, ...lines, isCardioDay ? capLine(40) : capLine(16, 20)].join("\n"),
    cat: "plum",
  };
}

/* ============================================================
   벤치마크 배치 (Girls / Hero·Open)
   ============================================================ */
function girlsFor(lift, week) {
  const linkKeys = [];
  if (lift === "squat") linkKeys.push(week.flags.thruster ? "thr" : "squat");
  if (week.flags.cnj && lift === "clean") linkKeys.push("cnj");
  linkKeys.push(lift);
  let cands = GIRLS.filter((g) => g.link.some((l) => linkKeys.includes(l)));
  if (!cands.length) cands = GIRLS;
  const g = choice(cands);
  let cap;
  if (g.capFix) cap = `${g.capFix}mins`;
  else if (g.sub7) cap = chance(0.75) ? "Time cap 7mins" : "Time cap 15mins";
  else cap = `Time cap ${choice([15, 17, 20])}mins`;
  return { title: g.name, body: `${g.body}\n${cap}`, cat: "plum" };
}
function longBenchOrOpen(dateStr) {
  /* 같은 히어로/오픈 와드는 60일(2달) 이내 재등장 금지 */
  const d0 = new Date(dateStr).getTime();
  const fresh = (n) => {
    const last = STATE.benchUse[n];
    return !last || Math.abs(d0 - new Date(last).getTime()) >= 60 * 86400000;
  };
  let heroes = LONG_BENCH.filter((b) => fresh(b.name));
  let opens = OPENS.filter((o) => fresh(o.name));
  if (!heroes.length && !opens.length) {
    /* 전부 최근 사용 -> 가장 오래전에 쓴 것으로 대체 */
    const all = LONG_BENCH.concat(OPENS);
    const lru = all.reduce((a, b) =>
      new Date(STATE.benchUse[a.name]) <= new Date(STATE.benchUse[b.name]) ? a : b);
    if (LONG_BENCH.includes(lru)) heroes = [lru]; else opens = [lru];
  }
  const useHero = heroes.length && (!opens.length || chance(0.6));
  let out;
  if (useHero) {
    const b = choice(heroes);
    out = { title: b.name, body: `${b.body}\nTime cap ${b.cap}mins`, cat: "plum" };
  } else {
    const o = choice(opens);
    /* 오픈 와드에는 공간동작(월볼/박스 등)이 흔해서 바이인은 에르고로만 */
    const buyin = choice(["2000m Row Buy-in", "1500m Ski Buy-in", "40cals Bike Buy-in"]);
    out = { title: o.name, body: `${buyin}\n${o.body}\nTime cap ${o.cap}mins (본 와드)`, cat: "plum" };
  }
  STATE.benchUse[out.title] = dateStr;
  return out;
}

/* Guess my Row/Ski — 스트랭스 날 파트너 게임 메트콘, 캡 20분 고정.
   룰은 모두가 알고 있으므로 이름과 캡만 표기 */
function guessGameWod() {
  const erg = chance(0.5) ? "Row" : "Ski";
  const body = [`Guess my ${erg}`, "", "Time cap 20mins"].join("\n");
  return { cat: "white", body, partner: true, guess: true };
}

/* ============================================================
   주 단위 생성
   ============================================================ */
function isoWeekKey(monday) {
  return `${monday.getFullYear()}-${pad2(monday.getMonth() + 1)}-${pad2(monday.getDate())}`;
}
function dateKey(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function generateWeek(monday, prevWeekState) {
  const days = {};   // dow(1~5) -> day object
  const dates = {};
  for (let i = 0; i < 5; i++) {
    const dt = new Date(monday);
    dt.setDate(monday.getDate() + i);
    dates[i + 1] = dt;
  }
  const hol = {};
  for (let dow = 1; dow <= 5; dow++) {
    const k = dateKey(dates[dow]);
    if (HOLIDAYS[k]) hol[dow] = HOLIDAYS[k];
  }
  const workDows = [1, 2, 3, 4, 5].filter((d) => !hol[d]);

  /* --- 스트랭스 3종 + 변형 --- */
  const order = pickWeekLifts(prevWeekState);
  const week = rollVariants(order);
  week.monday = isoWeekKey(monday);
  const liftByDow = { 1: order[0], 3: order[1], 5: order[2] };

  /* --- Mini Rox: 화(2)/목(4) 중 하나. 지난주와 같은 요일일 확률 25% --- */
  let mini;
  if (prevWeekState && prevWeekState.miniRox) {
    mini = chance(0.25) ? prevWeekState.miniRox : (prevWeekState.miniRox === 2 ? 4 : 2);
  } else mini = choice([2, 4]);
  if (hol[mini] && !hol[mini === 2 ? 4 : 2]) mini = mini === 2 ? 4 : 2;
  week.miniRox = mini;

  /* --- GAMES/OPEN 첫 공개일: 모든 배치 규칙보다 우선 --- */
  let specialDow = null, specialWod = null;
  for (let dow = 1; dow <= 5; dow++) {
    const ek = dateKey(dates[dow]);
    if (!hol[dow] && EVENT_DAYS[ek]) {
      specialDow = dow;
      specialWod = {
        title: EVENT_DAYS[ek],
        body: `${EVENT_DAYS[ek]}\n\n첫 공개일\n당일 발표 후 기입`,
        event: true,
      };
      break;
    }
  }

  /* --- 기념일 확인: 공휴일 전날 > 숫자 기념일 --- */
  for (let dow = 1; dow <= 5; dow++) {
    if (specialWod) break;
    if (!hol[dow]) continue;
    /* 공휴일 하루 전 운동일 찾기 (같은 주 내) */
    let eve = dow - 1;
    while (eve >= 1 && hol[eve]) eve--;
    if (eve >= 1 && !specialWod) {
      specialDow = eve;
      specialWod = holidayWod(hol[dow], dates[dow], eve === 2 || eve === 4);
    }
  }
  if (!specialWod) {
    for (const dow of workDows) {
      const c = commemorativeFor(dates[dow], dow === 2 || dow === 4);
      if (c) { specialDow = dow; specialWod = c; break; }
    }
  }
  /* 기념일이 Mini Rox 요일과 겹치면 Mini Rox를 반대 요일로 */
  if (specialDow === mini) {
    const other = mini === 2 ? 4 : 2;
    if (!hol[other]) week.miniRox = other;
  }

  /* --- 벤치마크 요일 (기념일 없을 때만 랜덤 선택) --- */
  let benchDow = specialDow;
  if (benchDow == null) {
    const cands = workDows.filter((d) => d !== week.miniRox);
    benchDow = cands.length ? choice(cands) : null;
  }

  /* --- 파트너 요일: 벤치마크·Mini Rox·공휴일 제외 후 최소 1개 + 각 15% --- */
  const partnerEligible = workDows.filter((d) => d !== week.miniRox && d !== benchDow);
  const partnerDows = new Set();
  if (partnerEligible.length) partnerDows.add(choice(partnerEligible));
  for (const d of partnerEligible) if (chance(0.15)) partnerDows.add(d);

  /* --- Guess my Row/Ski: 2주에 최소 1회, 월수금(스트랭스 날) 파트너 메트콘 ---
     지난주에 없었으면 이번 주는 필수. 있었으면 25% 확률로 또 가능 */
  const needGuess = !(prevWeekState && prevWeekState.guess);
  week.guess = false;
  let guessDow = null;
  if (needGuess || chance(0.25)) {
    const mwfCands = [1, 3, 5].filter((d) => !hol[d] && d !== benchDow && d !== specialDow);
    if (mwfCands.length) {
      guessDow = choice(mwfCands);
      partnerDows.add(guessDow);
      week.guess = true;
    }
  }

  /* --- 각 요일 생성 --- */
  for (let dow = 1; dow <= 5; dow++) {
    const dt = dates[dow];
    const k = dateKey(dt);
    if (hol[dow]) { days[dow] = { kind: "holiday", name: hol[dow], key: k }; continue; }
    /* GAMES/OPEN 첫 공개일: 그날 전체를 볼드 표기 셀로 (당일 아침 연필로 기입) */
    if (specialDow === dow && specialWod && specialWod.event) {
      days[dow] = {
        kind: "cardio",
        cardio: { title: specialWod.title, body: specialWod.body, cat: "plum", special: true, event: true },
        key: k,
      };
      continue;
    }
    const isCardio = dow === 2 || dow === 4;
    const partner = partnerDows.has(dow);

    if (isCardio) {
      /* 화·목: 유산소 30~50분 */
      let cardio;
      if (dow === week.miniRox && specialDow !== dow) {
        cardio = { title: "Mini Rox", body: MINI_ROX_BODY, cat: "yellow", minirox: true };
      } else if (specialDow === dow) {
        /* 기념일 와드: 이름을 본문 첫 줄에 */
        cardio = { title: specialWod.title, body: `${specialWod.title}\n\n${specialWod.body}`, cat: "plum", special: true };
      } else if (benchDow === dow) {
        /* 벤치마크: 이름(Murph, The Seven 등)을 본문 첫 줄에 */
        const b = longBenchOrOpen(k);
        cardio = { title: b.title, body: `${b.title}\n\n${b.body}`, cat: "plum", benchmark: true };
      } else {
        /* 내용물 30~42분 + 캡 최대 50분 (캡 = 검산 +15%) */
        const T = choice([30, 35, 40]);
        const w = composeMetcon(T, { partner, station: chance(0.25) });
        cardio = {
          title: partner ? "Partner WOD" : "",
          body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
          cat: partner ? "teal" : "yellow",
          partner,
        };
      }
      days[dow] = { kind: "cardio", cardio, key: k };
    } else {
      /* 월·수·금: 5x5 + 작은 메트콘 7~20분 */
      const lift = liftByDow[dow];
      const sname = week.names[lift];
      const strength = { cat: LIFT_COLORS[lift], top: "5x5", body: sname, lift };
      let metcon;
      if (dow === guessDow) {
        metcon = guessGameWod();
      } else if (specialDow === dow) {
        metcon = { cat: "plum", body: `${specialWod.title}\n\n${specialWod.body}`, special: true };
      } else if (benchDow === dow) {
        const g = girlsFor(lift, week);
        metcon = { cat: "plum", body: `${g.title}\n\n${g.body}`, benchmark: true };
      } else {
        const T = choice([7, 8, 10, 12, 14, 15, 16, 18]);
        const pool = linkedPool(lift, week);
        const w = composeMetcon(T, {
          pool, mwf: true, partner,
          hasBackSquat: sname === "Back Squat",
        });
        metcon = {
          cat: partner ? "teal" : "white",
          body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
          partner,
        };
      }
      days[dow] = { kind: "mwf", strength, metcon, key: k };
    }
  }

  /* --- 주간 달리기 규칙: Mini Rox 제외, 주 내 최소 1개 와드에 100m+ 달리기 --- */
  const runRe = /\d+m(?:\(M\))? Run|mile Run/;
  const weekHasRun = [1, 2, 3, 4, 5].some((dw) => {
    const d = days[dw];
    if (!d) return false;
    if (d.kind === "cardio") return !d.cardio.minirox && runRe.test(d.cardio.body);
    if (d.kind === "mwf") return runRe.test(d.metcon.body);
    return false;
  });
  if (!weekHasRun) {
    /* 자유 생성 슬롯(화목 유산소 우선, 없으면 월수금 메트콘)을 달리기 필수로 재조립 */
    const cands = [];
    for (const dw of [2, 4]) {
      const d = days[dw];
      if (d && d.kind === "cardio" && !d.cardio.minirox && !d.cardio.benchmark && !d.cardio.special) cands.push(dw);
    }
    if (!cands.length) for (const dw of [1, 3, 5]) {
      const d = days[dw];
      if (d && d.kind === "mwf" && !d.metcon.benchmark && !d.metcon.special && !d.metcon.guess) cands.push(dw);
    }
    if (cands.length) {
      const dw = choice(cands);
      const d = days[dw];
      if (d.kind === "cardio") {
        const partner = !!d.cardio.partner;
        const w = composeMetcon(choice([30, 35, 40]), { partner, requireRun: true });
        d.cardio = {
          title: partner ? "Partner WOD" : "",
          body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
          cat: partner ? "teal" : "yellow",
          partner,
        };
      } else {
        const lift = liftByDow[dw];
        const partner = !!d.metcon.partner;
        const w = composeMetcon(choice([7, 8, 10, 12, 14, 15, 16, 18]), {
          pool: linkedPool(lift, week), mwf: true, partner, requireRun: true,
          hasBackSquat: week.names[lift] === "Back Squat",
        });
        d.metcon = {
          cat: partner ? "teal" : "white",
          body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
          partner,
        };
      }
    }
  }
  return { week, days };
}

/* ============================================================
   월 단위 생성 (외부 API)
   ============================================================ */
function generateMonthSchedule(year, month /* 0-11 */) {
  const schedule = {};
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  /* 이 달의 평일을 포함하는 모든 주의 월요일 */
  const mondays = [];
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7)); // 그 주 월요일로
  while (cursor <= last) {
    mondays.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  /* 직전 주 상태 (localStorage) */
  const prevMonday = new Date(mondays[0]);
  prevMonday.setDate(prevMonday.getDate() - 7);
  let prevState = STATE.weeks[isoWeekKey(prevMonday)] || null;

  for (const monday of mondays) {
    const { week, days } = generateWeek(monday, prevState);
    STATE.weeks[isoWeekKey(monday)] = { order: week.order, miniRox: week.miniRox, guess: week.guess };
    prevState = { order: week.order, miniRox: week.miniRox, guess: week.guess };
    for (let dow = 1; dow <= 5; dow++) {
      const day = days[dow];
      if (!day) continue;
      const d = new Date(monday);
      d.setDate(monday.getDate() + dow - 1);
      if (d.getMonth() !== month || d.getFullYear() !== year) {
        /* 월 경계 주: 이웃 달이 이미 저장돼 있으면 그쪽 날짜도 이번 생성본으로
           동기화 — 주간 규칙(리프트 순서·Guess·MiniRox)이 달 경계에서 어긋나지 않게 */
        const nk = monthKey(d.getFullYear(), d.getMonth());
        if (STATE.months && STATE.months[nk]) STATE.months[nk][day.key] = day;
        continue;
      }
      schedule[day.key] = day;
    }
  }
  saveState(STATE);
  return schedule;
}

/* ---------- 월별 스케줄 보관 (월 이동·새로고침에도 유지) ---------- */
function monthKey(year, month) { return `${year}-${pad2(month + 1)}`; }
function storeMonth(year, month, schedule) {
  STATE.months = STATE.months || {};
  STATE.months[monthKey(year, month)] = schedule;
  saveState(STATE);
}
function loadMonth(year, month) {
  const sch = (STATE.months || {})[monthKey(year, month)] || null;
  if (sch) {
    /* 마이그레이션: 옛 형식(설명 포함) Guess 와드를 새 형식으로.
       연필로 직접 수정한 본문("모니터" 문구 없음)은 건드리지 않는다 */
    for (const day of Object.values(sch)) {
      if (day && day.kind === "mwf" && day.metcon && day.metcon.guess &&
          day.metcon.body.includes("모니터")) {
        const erg = day.metcon.body.includes("Ski") ? "Ski" : "Row";
        day.metcon.body = `Guess my ${erg}\n\nTime cap 20mins`;
        day.metcon.cat = "white";
      }
    }
  }
  return sch;
}
function listStoredMonths() {
  return Object.keys(STATE.months || {}).sort();
}

/* 하루 단위 재생성 (다시 뽑기) */
function regenDaySlot(day, slot) {
  if (day.kind === "cardio") {
    if (day.cardio.minirox || day.cardio.benchmark || day.cardio.special) return day;
    const T = choice([30, 35, 40]);
    const partner = !!day.cardio.partner;
    const w = composeMetcon(T, { partner, station: chance(0.25) });
    day.cardio = {
      title: partner ? "Partner WOD" : "",
      body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
      cat: partner ? "teal" : "yellow",
      partner,
    };
    saveState(STATE);
  } else if (day.kind === "mwf" && slot === "metcon") {
    /* Guess 게임은 2주 규칙에 묶여 있어 재추첨 불가 */
    if (day.metcon.benchmark || day.metcon.special || day.metcon.guess) return day;
    const T = choice([7, 8, 10, 12, 14, 15, 16, 18]);
    const lift = day.strength.lift;
    const week = { flags: {}, names: {} }; // 변형 정보 근사: 이름으로 판단
    if (day.strength.body === "Thruster") week.flags.thruster = true;
    const pool = linkedPool(lift, week);
    const partner = !!day.metcon.partner;
    const w = composeMetcon(T, {
      pool, mwf: true, partner,
      hasBackSquat: day.strength.body === "Back Squat",
    });
    day.metcon = {
      cat: partner ? "teal" : "white",
      body: (partner ? "Partner WOD (2인 교대)\n\n" : "") + w.body,
      partner,
    };
    saveState(STATE);
  }
  return day;
}
