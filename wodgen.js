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
  /* HSPU·Muscle up은 벤치마크 원문에만 — 생성 와드는 대중적인 동작으로 */
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
  { name: "Cindy",     body: "20mins AMRAP\n5 Pull up\n10 Push up\n15 Air squat", sub7: false, noCap: true, link: ["press", "squat"] },
];

/* 월수금 벤치마크에는 Girls 외에 20분 내 완주 가능한 짧은 히어로/클래식도 포함 */
const MWF_EXTRA = [
  { name: "Randy",  body: "75 Power Snatch 75/55", capFix: 15, link: ["snatch"] },
  { name: "DT",     body: "5 Rounds of\n12 Deadlift 155/105\n9 Hang Power Clean 155/105\n6 Push Jerk 155/105", capFix: 20, link: ["clean", "press", "dead"] },
  { name: "JT",     body: "21-15-9\nHSPU\nRing dip\nPush up", capFix: 20, link: ["press"] },
  { name: "Burpee King", body: "50 Lateral burpee bar jump over", sub7: true, link: ["any"] },
  { name: "Amanda", body: "9-7-5\nMuscle up\nSquat Snatch 135/95", capFix: 15, link: ["snatch"] },
  { name: "Griff",  body: "800m Run\n400m Backwards Run\n800m Run\n400m Backwards Run", capFix: 20, link: ["any"] },
];
/* MWF_BENCH는 OPENS 정의 뒤에서 구성 (20분 내 오픈 와드 포함) */

/* ---------- 롱 벤치마크 / 히어로 / 게임즈 (화목용) ----------
   캡 20분 이하 와드는 선택 시 에르고 바이인이 자동으로 붙는다 */
const LONG_BENCH = [
  { name: "Murph",  body: "1 mile Run\n100 Pull up\n200 Push up\n300 Air squat\n1 mile Run\n(조끼 착용은 선택)", cap: 50 },
  { name: "The Seven", body: "7 Rounds of\n7 HSPU\n7 Thruster 135/95\n7 T2B\n7 Deadlift 245/165\n7 Burpee\n7 DB Snatch 50/35\n7 Pull up", cap: 49 },
  { name: "Kelly",  body: "5 Rounds of\n400m Run\n30 Box jump 24/20\n30 Wall ball 20/14", cap: 35 },
  { name: "Filthy Fifty", body: "50 Box jump\n50 Jumping pull up\n50 KB Swing 16/12\n50 Walking Lunge\n50 K2E\n50 Push Press 45/35\n50 Back extension\n50 Wall ball\n50 Burpee\n50 Double under", cap: 40 },
  { name: "DT",     body: "5 Rounds of\n12 Deadlift 155/105\n9 Hang Power Clean 155/105\n6 Push Jerk 155/105", cap: 20 },
  { name: "Randy",  body: "75 Power Snatch 75/55", cap: 15 },
  { name: "JT",     body: "21-15-9\nHSPU\nRing dip\nPush up", cap: 20 },
  { name: "Michael", body: "3 Rounds of\n800m Run\n50 Back extension\n50 Sit up", cap: 30 },
  { name: "Daniel", body: "50 Pull up\n400m Run\n21 Thruster 95/65\n800m Run\n21 Thruster 95/65\n400m Run\n50 Pull up", cap: 35 },
  { name: "Josh",   body: "21 OHS 95/65\n42 Pull up\n15 OHS 95/65\n30 Pull up\n9 OHS 95/65\n18 Pull up", cap: 25 },
  { name: "Jason",  body: "100 Air squat\n5 Muscle up\n75 Air squat\n10 Muscle up\n50 Air squat\n15 Muscle up\n25 Air squat\n20 Muscle up", cap: 35 },
  { name: "Badger", body: "3 Rounds of\n30 Squat Clean 95/65\n30 Pull up\n800m Run", cap: 45 },
  { name: "Nate",   body: "20mins AMRAP\n2 Muscle up\n4 HSPU\n8 KB Swing 32/24", cap: 20 },
  { name: "Griff",  body: "800m Run\n400m Backwards Run\n800m Run\n400m Backwards Run", cap: 20 },
  { name: "Ryan",   body: "5 Rounds of\n7 Muscle up\n21 Burpee", cap: 30 },
  { name: "Erin",   body: "5 Rounds of\n15 DB Split Clean 40/25\n21 Pull up", cap: 30 },
  { name: "Loredo", body: "6 Rounds of\n24 Air squat\n24 Push up\n24 Walking Lunge\n400m Run", cap: 40 },
  { name: "Hansen", body: "5 Rounds of\n30 KB Swing 32/24\n30 Burpee\n30 GHD Sit up", cap: 45 },
  { name: "Whitten", body: "5 Rounds of\n22 KB Swing 32/24\n22 Box jump 24/20\n400m Run\n22 Burpee\n22 Wall ball 20/14", cap: 45 },
  { name: "Manion", body: "7 Rounds of\n400m Run\n29 Back Squat 135/95", cap: 45 },
  { name: "Wittman", body: "7 Rounds of\n15 KB Swing 24/16\n15 Power Clean 95/65\n15 Box jump 24/20", cap: 40 },
  { name: "Klepto", body: "4 Rounds of\n27 Box jump 24/20\n20 Burpee\n11 Squat Clean 145/100", cap: 35 },
  { name: "Coe",    body: "10 Rounds of\n10 Thruster 95/65\n10 Ring push up", cap: 30 },
  { name: "Amanda", body: "9-7-5\nMuscle up\nSquat Snatch 135/95", cap: 15 },
  { name: "Games 2007", body: "1000m Row\n5 Rounds of\n25 Pull up\n7 Push Jerk 135/95", cap: 20 },
];
const OPENS = [
  { name: "OPEN 24.1", body: "21-15-9 (each arm)\nDB Snatch 50/35\nBurpee over DB", cap: 15 },
  { name: "OPEN 24.2", body: "20mins AMRAP\n300m Row\n10 Deadlift 185/125\n50 Double under", cap: 20 },
  { name: "OPEN 24.3", body: "5 Rounds of\n10 Thruster 95/65\n10 C2B Pull up\n1min Rest\n5 Rounds of\n10 Thruster 135/95\n10 Muscle up", cap: 15 },
  { name: "OPEN 25.1", body: "3-6-9-12-15...\nBurpee over DB\nDB Hang clean to OH 50/35\n+ 30ft Walking Lunge 매 라운드", cap: 15 },
  { name: "OPEN 25.2", body: "21 Pull up / 42 DU / 21 Thruster 95/65\n18 C2B / 36 DU / 18 Thruster 115/75\n15 Muscle up / 30 DU / 15 Thruster 135/85", cap: 15 },
  { name: "OPEN 26.1", body: "20-30-40-66-40-30-20\nWall ball 20/14\n18 Box jump over 매 구간 사이", cap: 12 },
  { name: "OPEN 23.1", body: "14mins AMRAP\n60cals Row\n50 T2B\n40 Wall ball 20/14\n30 Clean 135/95\n20 Muscle up", cap: 14 },
  { name: "OPEN 22.2", body: "1-2-3-4-5-6-7-8-9-10\n-9-8-7-6-5-4-3-2-1\nDeadlift 225/155\nBar facing burpee", cap: 10 },
  { name: "OPEN 21.2", body: "10-20-30-40-50\nDB Snatch 50/35\n15 Burpee box jump over 사이마다", cap: 20 },
  { name: "OPEN 21.3", body: "15 Front squat 95/65\n30 T2B\n15 Thruster\n(1min Rest)\n15 Front squat\n30 C2B Pull up\n15 Thruster\n(1min Rest)\n15 Front squat\n30 Bar Muscle up\n15 Thruster", cap: 15 },
  { name: "OPEN 20.1", body: "10 Rounds of\n8 Ground to Overhead 95/65\n10 Bar facing burpee", cap: 15 },
  { name: "OPEN 19.1", body: "15mins AMRAP\n19 Wall ball 20/14\n19cals Row", cap: 15 },
  { name: "OPEN 18.1", body: "20mins AMRAP\n8 T2B\n10 DB Hang Clean & Jerk 50/35\n14cals Row", cap: 20 },
  { name: "OPEN 16.1", body: "20mins AMRAP\n25ft OH Walking Lunge 95/65\n8 Burpee\n25ft OH Walking Lunge\n8 C2B Pull up", cap: 20 },
  { name: "OPEN 15.5", body: "27-21-15-9\ncals Row\nThruster 95/65", cap: 20 },
  { name: "OPEN 14.5", body: "21-18-15-12-9-6-3\nThruster 95/65\nBar facing burpee", cap: 25 },
  { name: "OPEN 12.1", body: "7mins Max Burpee", cap: 7 },
];

/* 오픈 와드는 짧아서(캡 20분 내) 월수금 벤치마크 풀에서 사용.
   화목은 캡 30분 이상 히어로/클래식만 — 바이인으로 볼륨을 채우지 않는다 */
const MWF_OPENS = OPENS.filter((o) => o.cap <= 20).map((o) => ({
  name: o.name, body: o.body, capFix: o.cap,
  noCap: /AMRAP|mins Max/.test(o.body), link: ["any"],
}));
const MWF_BENCH = GIRLS.concat(MWF_EXTRA, MWF_OPENS);

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
  /* 달리기: 트랙 1바퀴 = 100m — 무조건 100m 단위 (내림, 최소 100m) */
  if (moveName === "Run") return Math.max(100, Math.floor(m / 100) * 100);
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
  /* 파트너 스타일: 60% 2인 교대(전체 x1.3), 40% 싱크로 혼합(싱크로 동작은 스케일 없음) */
  if (opts.partner) opts = Object.assign({}, opts, { synchroMode: chance(0.4) });
  for (let attempt = 0; attempt < 16; attempt++) {
    const w = buildMetconOnce(targetMin, opts);
    if (!w) continue;
    /* 볼륨 검산: 목표 대비 -25% ~ +5%만 허용.
       부족하면 재조립(또는 빌더가 바이인으로 보충), 초과는 Rx'd 완주 불가라 탈락 */
    if (w.est && (w.est < targetMin * 0.75 || w.est > targetMin * 1.05)) continue;
    if (isRecentDup(w.sig) && !chance(0.05)) continue; // 95% 재추첨
    recordSig(w.sig);
    w.synchro = !!w.usedSynchro; /* 싱크로 라인이 실제로 들어간 경우만 */
    return w;
  }
  const w = buildMetconOnce(targetMin, opts) || {
    body: `${targetMin}mins AMRAP\n${amountFor(MOVE["Row"], 2)}m Row\n15 Air squat\n10 Sit up`,
    sig: "fallback",
  };
  recordSig(w.sig);
  w.synchro = !!w.usedSynchro;
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
  /* 치퍼는 항상 달리기 없이 구성. 달리기 필수 슬롯에서는 달리기를 담을 수 있는
     형식(라운드)만 추첨 대상 — 렙스킴(렙 동작만)·치퍼(달리기 금지)는 후보 제외 */
  const sub = weightedPick([
    ["rounds", 0.6],
    ["ladder", opts.requireRun ? 0 : 0.25],
    ["chipper", opts.mwf || opts.requireRun ? 0 : 0.15],
  ]);
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
/* 싱크로 대상 선정: 렙 기반·비에르고 동작 1~2개 (파트너 싱크로 혼합 스타일) */
function pickSynchroIdx(moves, opts) {
  const set = new Set();
  if (!opts.synchroMode) return set;
  const cands = moves.map((m, i) => ({ m, i })).filter((x) => !x.m.unit && !x.m.erg && !x.m.isRun);
  shuffle(cands).slice(0, Math.min(cands.length, ri(1, 2))).forEach((x) => set.add(x.i));
  return set;
}
const synchroLine = (line) => line.replace(/^(\S+)\s/, "$1 Synchro ");

function buildRounds(T, pool, mult, opts) {
  const k = opts.mwf ? ri(2, 3) : ri(3, 4);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < k) return null;
  const roundMin = opts.mwf ? ri(2, 4) : ri(4, 6);
  const rounds = Math.max(2, Math.round(T / roundMin));
  const per = roundMin / moves.length;
  const syn = pickSynchroIdx(moves, opts);
  const amounts = moves.map((m, i) => amountFor(m, per, syn.has(i) ? 1 : mult));
  /* 실제 표기 렙 기준으로 재검산 — 싱크로는 같이 수행이라 스케일·단축 없음 */
  const est = rounds * moves.reduce((s, m, i) =>
    s + (syn.has(i) ? minutesOf(m, amounts[i]) : estOf(m, amounts[i], mult)), 0);
  const lines = moves.map((m, i) => {
    const line = fmtLine(m, amounts[i], opts);
    return syn.has(i) ? synchroLine(line) : line;
  });
  const body = [
    `${rounds} Rounds For Time`,
    ...lines,
    capLine(est, opts.mwf ? 20 : 50),
  ].join("\n");
  return { body, sig: sigOf(moves, `rounds${rounds}`), est, usedSynchro: syn.size > 0 };
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
  /* 치퍼는 동작이 많아 달리기를 넣으면 동선이 겹침 — Run 제외 (에르고·기타로 대체) */
  const moves = pickMoves(pool.filter((m) => !m.isRun), k, ctx);
  if (moves.length < 8) return null;
  const per = T / moves.length;
  const syn = pickSynchroIdx(moves, opts);
  const amounts = moves.map((m, i) => amountFor(m, per, syn.has(i) ? 1 : mult));
  const est = moves.reduce((s, m, i) =>
    s + (syn.has(i) ? minutesOf(m, amounts[i]) : estOf(m, amounts[i], mult)), 0);
  const lines = moves.map((m, i) => {
    const line = fmtLine(m, amounts[i], opts);
    return syn.has(i) ? synchroLine(line) : line;
  });
  const body = [`For Time (Chipper)`, ...lines, capLine(est, opts.mwf ? 20 : 50)].join("\n");
  return { body, sig: sigOf(moves, "chip"), est, usedSynchro: syn.size > 0 };
}

function buildAmrap(T, pool, mult, opts) {
  const k = opts.mwf ? ri(2, 3) : ri(3, 5);
  const ctx = { hasBackSquat: opts.hasBackSquat };
  const moves = pickMoves(pool, k, ctx, opts.requireRun ? MOVE["Run"] : null);
  if (moves.length < k) return null;
  const roundMin = opts.mwf ? ri(2, 3) : ri(3, 5);
  const per = roundMin / moves.length;
  const syn = pickSynchroIdx(moves, opts);
  const lines = moves.map((m, i) => {
    const line = fmtLine(m, amountFor(m, per, syn.has(i) ? 1 : mult), opts);
    return syn.has(i) ? synchroLine(line) : line;
  });
  const body = [`${T}mins AMRAP`, ...lines].join("\n");
  return { body, sig: sigOf(moves, `amrap`), est: T, usedSynchro: syn.size > 0 };
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

function pickWeekLifts(prevWeek, nextWeek, fixedPos) {
  /* fixedPos: {0|1|2: lift} — 핀으로 고정된 요일(월=0, 수=1, 금=2)의 리프트 */
  fixedPos = fixedPos || {};
  /* 같은 구성 + 같은 순서면 충돌 (이전 주·다음 주 모두 검사) */
  const clash = (w, order) => w && w.order &&
    w.order.slice().sort().join() === order.slice().sort().join() &&
    w.order.join() === order.join();
  let lastOrder = null;
  for (let attempt = 0; attempt < 60; attempt++) {
    /* 고정 위치를 채운 뒤 나머지를 가중치 비복원 추출 */
    let pool = LIFT_WEIGHTS.filter((e) => !Object.values(fixedPos).includes(e[0]));
    const order = [null, null, null];
    for (const [pos, lift] of Object.entries(fixedPos)) order[+pos] = lift;
    for (let i = 0; i < 3; i++) {
      if (order[i]) continue;
      const k = weightedPick(pool.length ? pool : LIFT_WEIGHTS);
      order[i] = k;
      pool = pool.filter((e) => e[0] !== k);
    }
    lastOrder = order;
    if (clash(prevWeek, order) || clash(nextWeek, order)) continue;
    return order;
  }
  return lastOrder || shuffle(["squat", "clean", "press"]);
}

function rollVariants(order, fixedByLift) {
  /* 주 전체 제약을 고려해 변형 결정. fixedByLift: 핀으로 고정된 스트랭스 이름 */
  const fixed = fixedByLift || {};
  const week = { order, names: {}, flags: {} };
  const hasSnatch = order.includes("snatch");

  /* 고정 이름에서 파생되는 주간 플래그 */
  if (fixed.squat === "Thruster") week.flags.thruster = true;
  else if (fixed.squat) week.flags.squatVar = fixed.squat;
  if (fixed.clean && fixed.clean.indexOf("Clean & Jerk") >= 0) week.flags.cnj = true;
  if (fixed.press) week.flags.pressVar = fixed.press;
  const pinnedPushPress = fixed.press && fixed.press !== "Strict Press";

  /* squat 변형 (고정 아니면 롤. 쓰러스터는 C&J·푸시계열 고정 주에 불가) */
  if (order.includes("squat") && !fixed.squat) {
    if (!week.flags.cnj && !pinnedPushPress && chance(0.10)) week.flags.thruster = true;
    else {
      const r = R();
      week.flags.squatVar = r < 0.85 ? "Back Squat" : r < 0.95 ? "Front Squat" : "Overhead Squat";
      if (week.flags.squatVar === "Overhead Squat" && hasSnatch) week.flags.squatVar = "Back Squat"; // OHS 주에는 스내치 불가
    }
  }
  /* clean 변형: 20% C&J (쓰러스터 주·푸시계열 고정 주에는 불가) */
  if (order.includes("clean") && !fixed.clean) {
    if (!week.flags.thruster && !pinnedPushPress && chance(0.20)) week.flags.cnj = true;
  }
  /* press 변형: 1/3씩. C&J·쓰러스터 주에는 Strict만 */
  if (order.includes("press") && !fixed.press) {
    if (week.flags.cnj || week.flags.thruster) week.flags.pressVar = "Strict Press";
    else week.flags.pressVar = choice(["Strict Press", "Push Press", "Push Jerk"]);
  }
  /* 이름 결정 (고정 이름은 그대로) */
  const prefixRoll = () => { const r = R(); return r < 0.8 ? "" : r < 0.9 ? "Power " : "Squat "; };
  for (const lift of order) {
    if (fixed[lift]) { week.names[lift] = fixed[lift]; continue; }
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
    const seven = LONG_BENCH.find((b) => b.name === "The Seven");
    return { title: "The Seven (7/7)", body: seven.body + "\nTime cap 49mins", cat: "plum" };
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
    /* 상징 숫자(1190/1120)는 100m 트랙과 안 맞으니 정확한 거리가 가능한 로잉으로 */
    const runLead = isCardioDay ? `${fire ? 1190 : 1120}m Row Buy-in\n` : "";
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
function girlsFor(lift, week, dateStr) {
  /* 우선순위: 60일 중복 금지 > 리프트 연계 > 주 1회 벤치마크 충족 */
  const d0 = new Date(dateStr).getTime();
  const fresh = (n) => {
    const last = STATE.benchUse[n];
    return !last || Math.abs(d0 - new Date(last).getTime()) >= 60 * 86400000;
  };
  const linkKeys = [];
  if (lift === "squat") linkKeys.push(week.flags.thruster ? "thr" : "squat");
  if (week.flags.cnj && lift === "clean") linkKeys.push("cnj");
  linkKeys.push(lift);
  const linked = (g) => g.link.includes("any") || g.link.some((l) => linkKeys.includes(l));
  let cands = MWF_BENCH.filter((g) => linked(g) && fresh(g.name));
  if (!cands.length) cands = MWF_BENCH.filter((g) => fresh(g.name)); /* 연계보다 중복 금지 우선 */
  if (!cands.length) {
    /* 전부 최근 사용 -> 가장 오래된 것 */
    cands = [MWF_BENCH.reduce((a, b) =>
      new Date(STATE.benchUse[a.name] || 0) <= new Date(STATE.benchUse[b.name] || 0) ? a : b)];
  }
  const g = choice(cands);
  STATE.benchUse[g.name] = dateStr;
  let cap;
  if (g.noCap) cap = null; /* Cindy처럼 본문에 시간이 포함된 AMRAP */
  else if (g.capFix) cap = `Time cap ${g.capFix}mins`;
  else if (g.sub7) cap = chance(0.75) ? "Time cap 7mins" : "Time cap 15mins";
  else cap = `Time cap ${choice([15, 17, 20])}mins`;
  return { title: g.name, body: cap ? `${g.body}\n${cap}` : g.body, cat: "plum" };
}
function longBenchOrOpen(dateStr) {
  /* 화목 벤치마크: 온전한 수행 자체가 기록의 의미 — 바이인/캐시아웃 금지.
     캡 30분 미만 와드는 후보에서 제외. 같은 와드는 60일 이내 재등장 금지 */
  const d0 = new Date(dateStr).getTime();
  const fresh = (n) => {
    const last = STATE.benchUse[n];
    return !last || Math.abs(d0 - new Date(last).getTime()) >= 60 * 86400000;
  };
  /* The Seven은 7/7 기념일에 예약 — 평일 7/7 앞뒤 60일에는 랜덤 선택 금지 */
  const nearSeven = () => {
    const d = new Date(dateStr);
    for (const yy of [d.getFullYear() - 1, d.getFullYear(), d.getFullYear() + 1]) {
      const s = new Date(yy, 6, 7);
      if (s.getDay() === 0 || s.getDay() === 6) continue; /* 주말 7/7이면 기념 와드 없음 */
      if (Math.abs(d - s) / 86400000 < 60) return true;
    }
    return false;
  };
  const pool = LONG_BENCH.filter((b) =>
    b.cap >= 30 && !(b.name === "The Seven" && nearSeven()));
  let cands = pool.filter((b) => fresh(b.name));
  if (!cands.length) {
    /* 전부 최근 사용 -> 가장 오래전에 쓴 것으로 대체 */
    cands = [pool.reduce((a, b) =>
      new Date(STATE.benchUse[a.name] || 0) <= new Date(STATE.benchUse[b.name] || 0) ? a : b)];
  }
  const b = choice(cands);
  const out = { title: b.name, body: `${b.body}\nTime cap ${b.cap}mins`, cat: "plum" };
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

function generateWeek(monday, prevWeekState, nextWeekState, pins) {
  pins = pins || {}; /* {dow: 기존 day 객체} — 핀 고정된 날 (그대로 유지, 규칙이 이에 맞춰짐) */
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

  /* --- 핀 고정 정보 수집 --- */
  const pinnedDows = new Set(Object.keys(pins).map(Number));
  const posOfDow = { 1: 0, 3: 1, 5: 2 };
  const fixedPos = {}, fixedNames = {};
  for (const ds of Object.keys(pins)) {
    const dow = +ds, pd = pins[dow];
    if (pd.kind === "mwf") {
      fixedPos[posOfDow[dow]] = pd.strength.lift;
      if (pd.strength.pinned) fixedNames[pd.strength.lift] = pd.strength.body;
    }
  }
  const pinnedBench = Object.values(pins).some((d2) =>
    (d2.kind === "cardio" && (d2.cardio.benchmark || d2.cardio.special)) ||
    (d2.kind === "mwf" && d2.metcon && (d2.metcon.benchmark || d2.metcon.special)));
  const pinnedPartner = Object.values(pins).some((d2) =>
    (d2.kind === "cardio" && d2.cardio.partner) ||
    (d2.kind === "mwf" && d2.metcon && d2.metcon.partner));
  const pinnedGuess = Object.values(pins).some((d2) =>
    d2.kind === "mwf" && d2.metcon && d2.metcon.guess);

  /* --- 스트랭스 3종 + 변형 (이전·다음 주와 순서 충돌 금지, 핀 위치 고정) --- */
  const order = pickWeekLifts(prevWeekState, nextWeekState, fixedPos);
  const week = rollVariants(order, fixedNames);
  week.monday = isoWeekKey(monday);
  const liftByDow = { 1: order[0], 3: order[1], 5: order[2] };

  /* --- Mini Rox: 화(2)/목(4) 중 하나. 지난주와 같은 요일일 확률 25% --- */
  let mini;
  if (prevWeekState && prevWeekState.miniRox) {
    mini = chance(0.25) ? prevWeekState.miniRox : (prevWeekState.miniRox === 2 ? 4 : 2);
  } else mini = choice([2, 4]);
  if (hol[mini] && !hol[mini === 2 ? 4 : 2]) mini = mini === 2 ? 4 : 2;
  /* 핀 고려: 핀된 Mini Rox가 있으면 그 요일, 핀된 다른 내용이 자리를 차지하면 반대 요일로 */
  const pinnedMini = [2, 4].find((d2) => pins[d2] && pins[d2].kind === "cardio" && pins[d2].cardio.minirox);
  if (pinnedMini) mini = pinnedMini;
  else if (pins[mini]) {
    const other = mini === 2 ? 4 : 2;
    mini = (!pins[other] && !hol[other]) ? other : null;
  }
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
  /* 핀 걸린 날에는 기념일/이벤트를 배치하지 않음 — 사용자 고정이 우선 */
  if (specialDow !== null && pins[specialDow]) { specialDow = null; specialWod = null; }
  /* 기념일이 Mini Rox 요일과 겹치면 Mini Rox를 반대 요일로 */
  if (specialDow === mini) {
    const other = mini === 2 ? 4 : 2;
    if (!hol[other]) week.miniRox = other;
  }

  /* --- 벤치마크 요일 (핀에 이미 벤치마크가 있으면 충족, 핀 날 제외) --- */
  let benchDow = specialDow;
  if (benchDow === null && !pinnedBench) {
    const cands = workDows.filter((d) => d !== week.miniRox && !pinnedDows.has(d));
    benchDow = cands.length ? choice(cands) : null;
  }

  /* --- 파트너 요일: 벤치마크·Mini Rox·공휴일·핀 제외 후 최소 1개 + 각 15%
     (핀에 파트너 와드가 있으면 최소 1개는 충족) --- */
  const partnerEligible = workDows.filter((d) =>
    d !== week.miniRox && d !== benchDow && !pinnedDows.has(d));
  const partnerDows = new Set();
  if (!pinnedPartner && partnerEligible.length) partnerDows.add(choice(partnerEligible));
  for (const d of partnerEligible) if (chance(0.15)) partnerDows.add(d);

  /* --- Guess my Row/Ski: 2주에 최소 1회, 월수금(스트랭스 날) 파트너 메트콘 ---
     지난주에 없었으면 이번 주는 필수. 있었으면 25% 확률로 또 가능 */
  const needGuess = !(prevWeekState && prevWeekState.guess) ||
    (nextWeekState && !nextWeekState.guess); /* 다음 주(고정)가 비었으면 이번 주 필수 */
  week.guess = pinnedGuess; /* 핀에 Guess가 있으면 이번 주 충족 */
  let guessDow = null;
  if (!pinnedGuess && (needGuess || chance(0.25))) {
    const mwfCands = [1, 3, 5].filter((d) =>
      !hol[d] && d !== benchDow && d !== specialDow && !pinnedDows.has(d));
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
    /* 핀 고정된 날: 내용 유지. MWF는 핀 안 된 슬롯만 재생성 */
    if (pins[dow]) {
      const pd = pins[dow];
      if (pd.kind === "mwf") {
        const lift = pd.strength.lift;
        const strength = pd.strength.pinned
          ? pd.strength
          : { cat: LIFT_COLORS[lift], top: "5x5", body: week.names[lift], lift };
        let metcon = pd.metcon;
        if (!pd.metcon.pinned) {
          const T = choice([7, 8, 10, 12, 14, 15, 16, 18]);
          const w = composeMetcon(T, {
            pool: linkedPool(lift, week), mwf: true,
            hasBackSquat: strength.body === "Back Squat",
          });
          metcon = { cat: "white", body: w.body };
        }
        days[dow] = { kind: "mwf", strength, metcon, key: k };
      } else {
        days[dow] = pd; /* cardio·휴식·교대는 통째로 유지 */
      }
      continue;
    }
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
          body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
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
        const g = girlsFor(lift, week, k);
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
          body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
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
      if (d && d.kind === "cardio" && !d.cardio.minirox && !d.cardio.benchmark && !d.cardio.special && !d.cardio.pinned) cands.push(dw);
    }
    if (!cands.length) for (const dw of [1, 3, 5]) {
      const d = days[dw];
      if (d && d.kind === "mwf" && !d.metcon.benchmark && !d.metcon.special && !d.metcon.guess && !d.metcon.pinned) cands.push(dw);
    }
    if (cands.length) {
      const dw = choice(cands);
      const d = days[dw];
      if (d.kind === "cardio") {
        const partner = !!d.cardio.partner;
        const w = composeMetcon(choice([30, 35, 40]), { partner, requireRun: true });
        d.cardio = {
          title: partner ? "Partner WOD" : "",
          body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
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
          body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
          partner,
        };
      }
    }
  }
  /* 핀 고정된 벤치마크/기념일은 사용 기록 재기록 (재생성 purge에서 지워진 것 복원) */
  for (const ds of Object.keys(pins)) {
    const pd = pins[+ds];
    let t = null;
    if (pd.kind === "cardio" && (pd.cardio.benchmark || pd.cardio.special)) t = pd.cardio.body.split("\n")[0];
    if (pd.kind === "mwf" && pd.metcon && (pd.metcon.benchmark || pd.metcon.special)) t = pd.metcon.body.split("\n")[0];
    if (t) STATE.benchUse[t.replace(" (7/7)", "")] = pd.key;
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
  STATE.weekDays = STATE.weekDays || {}; /* 주 단위 생성본 캐시: { weekKey: {1..5: day} } */
  const thisKey = monthKey(year, month);
  const monthOfDate = (d) => monthKey(d.getFullYear(), d.getMonth());

  /* 경계 주 처리: 이웃 달에 이미 생성돼 있는 날은 "이미 한 운동"으로 간주해
     통째로 고정하고, 이 달에 속한 날들만 그 고정에 맞춰 재생성한다.
     (예: 8월에 7월을 재생성하면 6/29·6/30은 그대로 두고 7/1~7/3만 교체) */
  const plans = mondays.map((monday) => {
    const wk = isoWeekKey(monday);
    const neighborFixed = {};
    if (STATE.weekDays[wk]) {
      for (let dw = 1; dw <= 5; dw++) {
        const d2 = new Date(monday);
        d2.setDate(monday.getDate() + dw - 1);
        const mk2 = monthOfDate(d2);
        if (mk2 !== thisKey && STATE.months && STATE.months[mk2] && STATE.weekDays[wk][dw]) {
          neighborFixed[dw] = STATE.weekDays[wk][dw];
        }
      }
    }
    return { monday, wk, neighborFixed };
  });
  const regenSet = new Set(plans.map((p) => p.wk));

  /* 재생성 범위의 벤치마크 사용 기록 폐기 — 이웃 달 고정 날의 기록은
     generateWeek의 핀 재기록이 복원한다 */
  for (const p of plans) {
    const fri = new Date(p.monday);
    fri.setDate(p.monday.getDate() + 4);
    const start = dateKey(p.monday), end = dateKey(fri);
    for (const [bn, bd] of Object.entries(STATE.benchUse)) {
      if (bd >= start && bd <= end) delete STATE.benchUse[bn];
    }
  }

  /* 직전 주 상태 (localStorage) */
  const prevMonday = new Date(mondays[0]);
  prevMonday.setDate(prevMonday.getDate() - 7);
  let prevState = STATE.weeks[isoWeekKey(prevMonday)] || null;

  for (const p of plans) {
    /* 다음 주가 이번 생성 범위 밖의 기존 주라면 그 제약(리프트 순서·Guess)을 존중 */
    const nextMonday = new Date(p.monday);
    nextMonday.setDate(p.monday.getDate() + 7);
    const nextWk = isoWeekKey(nextMonday);
    const nextState = regenSet.has(nextWk) ? null : (STATE.weeks[nextWk] || null);

    /* 핀 수집: 사용자 핀(이 달 날) + 이웃 달 고정 날(하루 전체 강제 핀) */
    const prevDays = STATE.weekDays[p.wk];
    const pins = {};
    if (prevDays) {
      for (let dw = 1; dw <= 5; dw++) {
        const d2 = prevDays[dw];
        if (!d2) continue;
        const has =
          d2.kind === "mwf" ? !!(d2.strength.pinned || (d2.metcon && d2.metcon.pinned)) :
          d2.kind === "cardio" ? !!d2.cardio.pinned :
          (d2.kind === "rest" || d2.kind === "shift") ? !!d2.pinned : false;
        if (has) pins[dw] = d2;
      }
    }
    const fixedDows = new Set();
    for (const dwS of Object.keys(p.neighborFixed)) {
      const dw = +dwS;
      fixedDows.add(dw);
      pins[dw] = forcePinnedClone(p.neighborFixed[dw]);
    }

    const res = generateWeek(p.monday, prevState, nextState, pins);
    const days = res.days;
    /* 이웃 달 고정 날은 원본 그대로 복원 (강제 핀 플래그가 새어나가지 않게) */
    for (const dw of fixedDows) days[dw] = p.neighborFixed[dw];
    const wkState = { order: res.week.order, miniRox: res.week.miniRox, guess: res.week.guess };
    STATE.weeks[p.wk] = wkState;
    STATE.weekDays[p.wk] = days;
    prevState = wkState;

    for (let dow = 1; dow <= 5; dow++) {
      const day = days[dow];
      if (!day) continue;
      const d = new Date(p.monday);
      d.setDate(p.monday.getDate() + dow - 1);
      if (d.getMonth() !== month || d.getFullYear() !== year) {
        /* 이웃 달 날짜: 고정한 날은 건드리지 않고, 새로 생성된 날만 동기화 */
        const nk = monthOfDate(d);
        if (!fixedDows.has(dow) && STATE.months && STATE.months[nk]) STATE.months[nk][day.key] = day;
        continue;
      }
      schedule[day.key] = day;
    }
  }
  saveState(STATE);
  return schedule;
}

/* 이웃 달 고정용: 하루 전체를 핀 상태로 취급하는 얕은 클론 */
function forcePinnedClone(d) {
  if (d.kind === "mwf") {
    return { ...d, strength: { ...d.strength, pinned: true }, metcon: { ...d.metcon, pinned: true } };
  }
  if (d.kind === "cardio") return { ...d, cardio: { ...d.cardio, pinned: true } };
  if (d.kind === "rest" || d.kind === "shift") return { ...d, pinned: true };
  return d;
}

/* ---------- 월별 스케줄 보관 (월 이동·새로고침에도 유지) ---------- */
function monthKey(year, month) { return `${year}-${pad2(month + 1)}`; }
function storeMonth(year, month, schedule) {
  STATE.months = STATE.months || {};
  STATE.months[monthKey(year, month)] = schedule;
  /* 연필 수정·휴식 전환 등이 주 캐시에도 반영되도록 동기화 */
  STATE.weekDays = STATE.weekDays || {};
  for (const [k, day] of Object.entries(schedule)) {
    const dt = new Date(k);
    const dowJs = dt.getDay();
    if (dowJs < 1 || dowJs > 5) continue;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - (dowJs - 1));
    const wk = isoWeekKey(monday);
    if (STATE.weekDays[wk]) STATE.weekDays[wk][dowJs] = day;
  }
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

/* 스케줄 초기화 후 주 캐시 정리: 이 달에서 삭제된 날을 주 캐시에서도 제거해
   경계 주 재사용이 지워진 와드를 되살리지 않게 한다 (남긴 날은 storeMonth가 동기화) */
function clearMonthWeekCache(year, month, kept) {
  STATE.weekDays = STATE.weekDays || {};
  const days = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const dt = new Date(year, month, d);
    const dowJs = dt.getDay();
    if (dowJs < 1 || dowJs > 5) continue;
    const k = dateKey(dt);
    if (kept[k]) continue;
    const monday = new Date(dt);
    monday.setDate(dt.getDate() - (dowJs - 1));
    const wk = isoWeekKey(monday);
    if (STATE.weekDays[wk]) delete STATE.weekDays[wk][dowJs];
  }
  saveState(STATE);
}

/* ── 월수금 하루 통째 재추첨 ──
   스트랭스+메트콘을 연계해서 다시 뽑되, 핀·벤치마크·기념일·Guess와
   주간 제약(리프트 중복 금지, 인접 주 순서, C&J/쓰러스터/OHS 상호배제)을 지킨다 */
function rollSingleLiftName(lift, f) {
  const prefixRoll = () => { const r = R(); return r < 0.8 ? "" : r < 0.9 ? "Power " : "Squat "; };
  if (lift === "dead") return "Deadlift";
  if (lift === "press") {
    if (f.cnj || f.thruster) return "Strict Press";
    return choice(["Strict Press", "Push Press", "Push Jerk"]);
  }
  if (lift === "squat") {
    if (!f.cnj && !f.pushPress && chance(0.10)) return "Thruster";
    const r = R();
    let v = r < 0.85 ? "Back Squat" : r < 0.95 ? "Front Squat" : "Overhead Squat";
    if (v === "Overhead Squat" && f.hasSnatchElsewhere) v = "Back Squat";
    return v;
  }
  if (lift === "clean") {
    if (!f.thruster && !f.pushPress && chance(0.20)) return "Clean & Jerk";
    return (prefixRoll() + "Clean").replace("Squat Squat", "Squat");
  }
  if (lift === "snatch") {
    if (f.hasOHSElsewhere) return null; /* OHS 주에는 스내치 불가 -> 리프트 재추첨 */
    return (prefixRoll() + "Snatch").replace("Squat Squat", "Squat");
  }
  return null;
}
function regenMwfDay(day) {
  if (!day || day.kind !== "mwf") return day;
  const key = day.key;
  const dt = new Date(key);
  const dowJs = dt.getDay();
  const monday = new Date(dt);
  monday.setDate(dt.getDate() - (dowJs - 1));
  const wk = isoWeekKey(monday);
  const wd = STATE.weekDays[wk] || {};
  const others = [1, 3, 5].filter((d2) => d2 !== dowJs)
    .map((d2) => wd[d2])
    .filter((d2) => d2 && d2.kind === "mwf");
  const usedLifts = others.map((o) => o.strength.lift);
  const otherNames = others.map((o) => o.strength.body);
  const flags = {
    cnj: otherNames.some((n) => n.indexOf("Clean & Jerk") >= 0),
    thruster: otherNames.indexOf("Thruster") >= 0,
    pushPress: otherNames.indexOf("Push Press") >= 0 || otherNames.indexOf("Push Jerk") >= 0,
    hasSnatchElsewhere: usedLifts.indexOf("snatch") >= 0,
    hasOHSElsewhere: otherNames.indexOf("Overhead Squat") >= 0,
  };
  const sPinned = !!day.strength.pinned;
  const mPinned = !!day.metcon.pinned;
  const mKeep = mPinned || !!day.metcon.special || !!day.metcon.guess;

  let lift = day.strength.lift;
  let sName = day.strength.body;
  if (!sPinned) {
    /* 메트콘이 고정(핀·기념일·Guess)이거나 벤치마크면 연계 유지를 위해 리프트는 그대로 */
    const liftLocked = mKeep || !!day.metcon.benchmark;
    const clash = (w, order) => w && w.order &&
      w.order.slice().sort().join() === order.slice().sort().join() &&
      w.order.join() === order.join();
    const prevW = STATE.weeks[isoWeekKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7))];
    const nextW = STATE.weeks[isoWeekKey(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7))];
    for (let attempt = 0; attempt < 40; attempt++) {
      let cand = lift;
      if (!liftLocked) {
        const pool = LIFT_WEIGHTS.filter((e) => usedLifts.indexOf(e[0]) < 0);
        cand = weightedPick(pool.length ? pool : LIFT_WEIGHTS);
      }
      const nm = rollSingleLiftName(cand, flags);
      if (!nm) continue;
      const order = [1, 3, 5].map((d2) =>
        d2 === dowJs ? cand : (wd[d2] && wd[d2].kind === "mwf" ? wd[d2].strength.lift : null));
      if (order.every(Boolean) && (clash(prevW, order) || clash(nextW, order))) continue;
      lift = cand;
      sName = nm;
      break;
    }
    day.strength = { cat: LIFT_COLORS[lift], top: day.strength.top || "5x5", body: sName, lift };
  }

  const weekLike = { flags: { thruster: sName === "Thruster" }, names: {} };
  if (!mKeep) {
    if (day.metcon.benchmark) {
      /* 벤치마크 날은 벤치마크로 재추첨 (60일 쿨다운·리프트 연계 유지) */
      const g = girlsFor(lift, weekLike, key);
      day.metcon = { cat: "plum", body: `${g.title}\n\n${g.body}`, benchmark: true };
    } else {
      const partner = !!day.metcon.partner;
      const w = composeMetcon(choice([7, 8, 10, 12, 14, 15, 16, 18]), {
        pool: linkedPool(lift, weekLike), mwf: true, partner,
        hasBackSquat: sName === "Back Squat",
      });
      day.metcon = {
        cat: partner ? "teal" : "white",
        body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
        partner,
      };
    }
  }

  /* 주 상태·캐시 갱신 (리프트가 바뀌면 순서도 갱신) */
  wd[dowJs] = day;
  if (STATE.weeks[wk] && STATE.weeks[wk].order) {
    const posOf = { 1: 0, 3: 1, 5: 2 };
    const no = STATE.weeks[wk].order.slice();
    no[posOf[dowJs]] = lift;
    STATE.weeks[wk].order = no;
  }
  saveState(STATE);
  return day;
}

/* 하루 단위 재생성 (다시 뽑기) */
function regenDaySlot(day, slot) {
  if (day.kind === "cardio") {
    if (day.cardio.pinned || day.cardio.minirox || day.cardio.benchmark || day.cardio.special) return day;
    const T = choice([30, 35, 40]);
    const partner = !!day.cardio.partner;
    const w = composeMetcon(T, { partner, station: chance(0.25) });
    day.cardio = {
      title: partner ? "Partner WOD" : "",
      body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
      cat: partner ? "teal" : "yellow",
      partner,
    };
    saveState(STATE);
  } else if (day.kind === "mwf" && slot === "metcon") {
    /* Guess 게임은 2주 규칙에, 핀은 사용자 고정에 묶여 있어 재추첨 불가 */
    if (day.metcon.pinned || day.metcon.benchmark || day.metcon.special || day.metcon.guess) return day;
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
      body: (partner ? (w.synchro ? "Partner WOD\n\n" : "Partner WOD (2인 교대)\n\n") : "") + w.body,
      partner,
    };
    saveState(STATE);
  }
  return day;
}
