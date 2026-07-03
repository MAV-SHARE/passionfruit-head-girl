/* =========================================================
   百香果頭女孩 PASSIONFRUIT HEAD GIRL
   傾斜操控 · 程序生成 · PWA 離線遊戲
   ========================================================= */
(() => {
'use strict';

// 版本號(與 sw.js 的 CACHE 版本同步:v1.X.0 ↔ pfhg-vX)
const APP_VERSION = '1.12.0';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/* ---------- 工具 ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 視窗尺寸(視窗被最小化/尚未布局時可能為 0,給予安全預設)
const viewSize = () => ({
  w: window.innerWidth || 360,
  h: window.innerHeight || 640,
});
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;

// 種子隨機數(mulberry32):同關卡號永遠生成同一座迷宮
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 儲存 ---------- */
const store = {
  get(k, d) {
    try { const v = localStorage.getItem('nebula.' + k); return v === null ? d : JSON.parse(v); }
    catch { return d; }
  },
  set(k, v) { try { localStorage.setItem('nebula.' + k, JSON.stringify(v)); } catch {} }
};

const settings = {
  sensitivity: store.get('sensitivity', 1),
  sound: store.get('sound', true),
  vibrate: store.get('vibrate', true),
  playerName: store.get('playerName', ''),
  theme: store.get('theme', 'passion'),
};

/* ---------- 主題(視覺 + 物理碰撞規則) ---------- */
const THEMES = {
  // 預設:百香果 — 真實水果的滾動手感:幾乎不彈、阻力大、果形不正會搖晃、撞牆會擠壓
  passion: {
    icon: '✿',
    fruit: '百香果',
    season: '夏秋',
    h1: '百香果頭女孩',
    sub: 'PASSIONFRUIT HEAD GIRL',
    desc: '傾斜你的手機,讓百香果滾過果肉迷宮。<br>收集花朵、避開蟲蛀洞、滾進果汁漩渦。',
    startToast: '傾斜手機,讓百香果滾進果汁漩渦!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2300, friction: 2.6, restitution: 0.12, maxSpeed: 1000, wobble: 130, squash: true },
    style: {
      ball: 'passion', decor: 'passionSeeds',
      bg: ['#241007', '#130803'], leaf: '120, 158, 66',
      floor: ['#f0b23a', '#c07f1a'], grid: 'rgba(130, 75, 10, 0.12)',
      wall: ['#6e2a50', '#471733', '#5e2246'],
      wallShadow: 'rgba(40, 8, 20, 0.9)', sheen: 'rgba(255, 190, 160, 0.16)',
      trail: '200, 120, 40',
      goal: ['#ffe9a8', '#ffbe33', '255, 140, 20'], swirl: '150, 70, 5',
      holeRim: '94, 46, 16', crumb: 'rgba(140, 80, 30, 0.7)',
      flower: { petal: 'rgba(250, 246, 255, 0.95)', fringe: '#7b3fa0', center: '#ffd23e' },
      spark: '#ffcf7a', burst: '#ffbe33', vignette: 'rgba(18, 6, 0, 0.5)',
    },
  },
  // 蘋果 — 略帶彈性,但果形不對稱,滾動會偏出弧線、不走直線(curve)
  apple: {
    icon: '❀',
    fruit: '蘋果',
    season: '秋冬',
    h1: '百香果頭女孩',
    sub: '蘋果模式 APPLE',
    desc: '傾斜你的手機,讓蘋果滾過果園迷宮。<br>小心:蘋果滾起來會偏出弧線,不走直線!',
    startToast: '蘋果會滾出弧線,提前修正方向!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2400, friction: 2.2, restitution: 0.24, maxSpeed: 1100, wobble: 0, curve: 1.7, squash: false },
    style: {
      ball: 'apple', decor: 'appleCore',
      bg: ['#18200a', '#0b1004'], leaf: '150, 185, 80',
      floor: ['#fdf3d0', '#e0c188'], grid: 'rgba(160, 110, 40, 0.10)',
      wall: ['#c93b3b', '#8e1f2c', '#b83a4e'],
      wallShadow: 'rgba(60, 10, 12, 0.9)', sheen: 'rgba(255, 220, 210, 0.22)',
      trail: '210, 90, 80',
      goal: ['#fff0c0', '#ffc84d', '255, 160, 40'], swirl: '150, 60, 20',
      holeRim: '110, 70, 30', crumb: 'rgba(150, 100, 40, 0.7)',
      flower: { petal: 'rgba(255, 240, 246, 0.96)', fringe: '#e885a8', center: '#ffd23e' },
      spark: '#ffb3a0', burst: '#ff8a5c', vignette: 'rgba(8, 12, 0, 0.5)',
    },
  },
  // 鳳梨 — 最難滾:靜摩擦死區(deadzone,傾斜不夠推不動)、幾乎不彈、一路顛簸(jitter)
  pineapple: {
    icon: '✾',
    fruit: '鳳梨',
    season: '春夏',
    h1: '百香果頭女孩',
    sub: '鳳梨模式 PINEAPPLE',
    desc: '傾斜你的手機,推動不太會滾的鳳梨。<br>傾斜太小推不動,滾起來還會一路顛簸!',
    startToast: '鳳梨超難滾,傾斜要夠大才推得動!',
    fallToast: '掉進坑洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2700, friction: 3.4, restitution: 0.06, maxSpeed: 750, wobble: 0, jitter: 3200, deadzone: 0.14, squash: false },
    style: {
      ball: 'pineapple', decor: 'pineRings',
      bg: ['#20180a', '#100b04'], leaf: '110, 150, 60',
      floor: ['#ffd54f', '#d9a520'], grid: 'rgba(150, 100, 20, 0.14)',
      wall: ['#9a6b1f', '#6b4713', '#8a5d1d'],
      wallShadow: 'rgba(40, 25, 5, 0.9)', sheen: 'rgba(255, 230, 170, 0.18)',
      trail: '220, 160, 40',
      goal: ['#fff3b8', '#ffd23e', '255, 180, 20'], swirl: '140, 90, 10',
      holeRim: '100, 65, 20', crumb: 'rgba(150, 100, 30, 0.7)',
      flower: { petal: 'rgba(240, 230, 255, 0.95)', fringe: '#a05ac8', center: '#ffde55' },
      spark: '#ffe08a', burst: '#ffd23e', vignette: 'rgba(14, 10, 0, 0.5)',
    },
  },
  // 蓮霧(春)— 輕、脆、彈跳好,鐘形果會飄移
  waxapple: {
    icon: '❁',
    fruit: '蓮霧',
    season: '春',
    h1: '百香果頭女孩',
    sub: '蓮霧模式 WAX APPLE',
    desc: '傾斜你的手機,讓輕飄飄的蓮霧滾過迷宮。<br>它超會彈,還會微微飄移!',
    startToast: '蓮霧又輕又彈,小心彈過頭!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2600, friction: 1.6, restitution: 0.45, maxSpeed: 1200, wobble: 80, curve: 0.8, squash: true },
    style: {
      ball: 'waxapple', decor: 'none',
      bg: ['#16210c', '#0a1105'], leaf: '150, 190, 90',
      floor: ['#fbeef0', '#e6c4ca'], grid: 'rgba(180, 90, 100, 0.10)',
      wall: ['#e26370', '#a12c3e', '#cf4759'],
      wallShadow: 'rgba(70, 15, 25, 0.9)', sheen: 'rgba(255, 230, 235, 0.25)',
      trail: '230, 130, 140',
      goal: ['#ffe9ee', '#ff9fb0', '255, 110, 130'], swirl: '150, 40, 60',
      holeRim: '120, 50, 60', crumb: 'rgba(160, 80, 90, 0.7)',
      flower: { petal: 'rgba(255, 250, 252, 0.96)', fringe: '#d06a7a', center: '#ffd23e' },
      spark: '#ffc2cb', burst: '#ff9fb0', vignette: 'rgba(12, 6, 2, 0.5)',
    },
  },
  // 西瓜(夏)— 超重:起步慢、衝起來煞不住
  watermelon: {
    icon: '❂',
    fruit: '西瓜',
    season: '夏',
    h1: '百香果頭女孩',
    sub: '西瓜模式 WATERMELON',
    desc: '傾斜你的手機,推動沉甸甸的大西瓜。<br>起步很慢,但衝起來就煞不住了!',
    startToast: '西瓜超重!提早剎車,不然停不下來!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 1500, friction: 0.8, restitution: 0.2, maxSpeed: 1250, wobble: 0, squash: false },
    style: {
      ball: 'watermelon', decor: 'seeds',
      seed: { halo: 'rgba(255, 255, 255, 0.22)', body: '#1d1008', gloss: 'rgba(255, 255, 255, 0.5)' },
      bg: ['#0d1f10', '#06110a'], leaf: '120, 180, 90',
      floor: ['#ff6b6b', '#cf3540'], grid: 'rgba(120, 20, 25, 0.12)',
      wall: ['#3f9c4a', '#1e6b2d', '#2f8a3d'],
      wallShadow: 'rgba(8, 40, 15, 0.9)', sheen: 'rgba(220, 255, 220, 0.2)',
      trail: '255, 120, 120',
      goal: ['#ffd9d9', '#ff8080', '255, 80, 80'], swirl: '140, 20, 20',
      holeRim: '90, 20, 20', crumb: 'rgba(130, 40, 40, 0.7)',
      flower: { petal: 'rgba(255, 250, 240, 0.95)', fringe: '#3f9c4a', center: '#ffd23e' },
      spark: '#ffb3b3', burst: '#ff8080', vignette: 'rgba(4, 12, 4, 0.5)',
    },
  },
  // 柿子(秋)— 熟軟:黏答答超慢、幾乎不彈、撞牆大變形
  persimmon: {
    icon: '✽',
    fruit: '柿子',
    season: '秋',
    h1: '百香果頭女孩',
    sub: '柿子模式 PERSIMMON',
    desc: '傾斜你的手機,滾動熟透的軟柿子。<br>黏答答的超難推,撞牆還會軟軟變形。',
    startToast: '軟柿子黏答答,慢工出細活!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2100, friction: 3.6, restitution: 0.03, maxSpeed: 650, wobble: 0, squash: true },
    style: {
      ball: 'persimmon', decor: 'appleCore',
      bg: ['#231409', '#110903'], leaf: '170, 140, 60',
      floor: ['#ffb054', '#dd7f1e'], grid: 'rgba(150, 80, 10, 0.12)',
      wall: ['#e8722a', '#a84a10', '#d8641f'],
      wallShadow: 'rgba(60, 25, 5, 0.9)', sheen: 'rgba(255, 220, 180, 0.22)',
      trail: '230, 140, 60',
      goal: ['#fff0c8', '#ffc36b', '255, 150, 40'], swirl: '140, 70, 10',
      holeRim: '110, 55, 15', crumb: 'rgba(150, 100, 40, 0.7)',
      flower: { petal: 'rgba(255, 248, 235, 0.95)', fringe: '#c98a3a', center: '#ff9d2e' },
      spark: '#ffcf9a', burst: '#ffb14d', vignette: 'rgba(14, 8, 0, 0.5)',
    },
  },
  // 草莓(冬)— 圓錐果形:滾動大偏彎 + 搖晃
  strawberry: {
    icon: '✿',
    fruit: '草莓',
    season: '冬',
    h1: '百香果頭女孩',
    sub: '草莓模式 STRAWBERRY',
    desc: '傾斜你的手機,滾動圓錐形的草莓。<br>它不是球!滾起來會大轉彎又搖晃。',
    startToast: '草莓是圓錐形,會大轉彎,抓好方向!',
    fallToast: '掉進蟲蛀洞!從起點重來',
    clearTitle: '恭喜過關!',
    phys: { accel: 2500, friction: 2.0, restitution: 0.3, maxSpeed: 1050, wobble: 100, curve: 1.9, squash: false },
    style: {
      ball: 'strawberry', decor: 'seeds',
      seed: { halo: 'rgba(255, 255, 255, 0.18)', body: '#e8c53a', gloss: 'rgba(255, 255, 255, 0.7)' },
      bg: ['#1c0f14', '#0d0609'], leaf: '140, 180, 80',
      floor: ['#ff7a8a', '#d3435a'], grid: 'rgba(150, 30, 50, 0.12)',
      wall: ['#d43b52', '#96202f', '#c02c44'],
      wallShadow: 'rgba(60, 8, 18, 0.9)', sheen: 'rgba(255, 220, 225, 0.22)',
      trail: '255, 150, 160',
      goal: ['#ffe9ee', '#ff9fb0', '255, 110, 130'], swirl: '150, 30, 50',
      holeRim: '110, 30, 40', crumb: 'rgba(150, 60, 70, 0.7)',
      flower: { petal: 'rgba(255, 252, 250, 0.97)', fringe: '#7c9a3e', center: '#ffd23e' },
      spark: '#ffc2cb', burst: '#ff9fb0', vignette: 'rgba(12, 4, 8, 0.5)',
    },
  },
  // 星雲能量球 — 低摩擦、高彈性
  nebula: {
    icon: '★',
    h1: 'NEBULA MAZE',
    sub: '星雲迷宮',
    desc: '傾斜你的手機,引導光球穿越能量迷宮。<br>收集星星、躲避黑洞、抵達傳送門。',
    startToast: '傾斜手機,引導光球到傳送門!',
    fallToast: '被黑洞吞噬!從起點重來',
    clearTitle: '抵達傳送門!',
    phys: { accel: 2600, friction: 1.7, restitution: 0.38, maxSpeed: 1400, wobble: 0, squash: false },
  },
};
const theme = () => THEMES[settings.theme] || THEMES.passion;
function applyThemeClass() {
  const th = theme();
  document.body.className = th.style ? 'theme-' + settings.theme : '';
  const h1 = document.getElementById('title-main');
  if (h1) {
    h1.textContent = th.h1.replace(' ', ' ');
    document.getElementById('title-sub').textContent = th.sub;
    document.getElementById('title-desc').innerHTML = th.desc;
  }
}

/* ---------- 音效(WebAudio 即時合成,零素材) ---------- */
const sfx = (() => {
  let ac = null;
  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ac = new AC();
    }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, dur, type, vol, slide) {
    if (!settings.sound) return;
    const a = ensure(); if (!a) return;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, a.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), a.currentTime + dur);
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start();
    o.stop(a.currentTime + dur);
  }
  return {
    unlock: ensure,
    thud(strength) {
      // 水果系:低沉悶響;星雲:清脆撞擊
      if (theme().style) tone(55 + strength * 35, 0.12, 'sine', clamp(strength * 0.5, 0.04, 0.35), 0.4);
      else tone(90 + strength * 60, 0.08, 'triangle', clamp(strength * 0.4, 0.03, 0.3), 0.5);
    },
    star() { tone(880, 0.12, 'sine', 0.25); setTimeout(() => tone(1320, 0.18, 'sine', 0.22), 70); },
    goal() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sine', 0.22), i * 90)); },
    fall() { tone(300, 0.6, 'sawtooth', 0.18, 0.15); },
    click() { tone(600, 0.05, 'square', 0.08); },
    // 鋼珠撞軌道的金屬清脆聲
    ting(strength) { tone(900 + strength * 700, 0.045, 'triangle', clamp(strength * 0.3, 0.03, 0.2), 0.8); },
  };
})();

function buzz(pattern) {
  if (settings.vibrate && navigator.vibrate) { try { navigator.vibrate(pattern); } catch {} }
}

/* ---------- 傾斜輸入 ---------- */
const input = {
  tiltX: 0, tiltY: 0,          // 目前輸出 (-1 ~ 1)
  rawBeta: 0, rawGamma: 0,
  zeroBeta: 0, zeroGamma: 0,   // 校準零點
  hasSensor: false,
  keys: {},
  dragging: false,
  dragX: 0, dragY: 0, dragOX: 0, dragOY: 0,
};

const MAX_TILT_DEG = 22; // 傾斜多少度視為最大力

function onOrientation(e) {
  if (e.beta === null || e.gamma === null) return;
  input.hasSensor = true;
  let beta = e.beta, gamma = e.gamma;
  // 處理橫向螢幕:把感應軸轉回畫面座標
  const angle = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  let x, y;
  if (angle === 90)       { x = beta;  y = -gamma; }
  else if (angle === -90 || angle === 270) { x = -beta; y = gamma; }
  else if (angle === 180) { x = -gamma; y = -beta; }
  else                    { x = gamma; y = beta; }
  input.rawGamma = x; input.rawBeta = y;
  input.tiltX = clamp((x - input.zeroGamma) / MAX_TILT_DEG, -1, 1);
  input.tiltY = clamp((y - input.zeroBeta) / MAX_TILT_DEG, -1, 1);
}

/* ---------- 水平校準(把手機平放在桌面,以該平面為傾斜零點) ---------- */
const LEVEL_FLAT_DEG = 4;      // 視為水平的角度容差
const LEVEL_STABLE_MS = 600;   // 需要穩定維持的時間
let levelTimer = null;
let levelFrom = 'start';       // start | game
let levelFlatSince = 0;        // 開始持續水平的時間戳
let levelOpenedAt = 0;

function openLevelCalibration(from) {
  levelFrom = from;
  if (game.state === 'play') game.state = 'paused';
  levelFlatSince = 0;
  levelOpenedAt = performance.now();
  $('btn-level-confirm').disabled = true;
  const status = $('level-status');
  status.textContent = '偵測中…';
  status.classList.remove('ok');
  $('level-bubble').classList.remove('ok');
  show('screen-level');
  clearInterval(levelTimer);
  levelTimer = setInterval(updateLevelGauge, 50);
}

function updateLevelGauge() {
  const bubble = $('level-bubble');
  const status = $('level-status');
  const btn = $('btn-level-confirm');
  const now = performance.now();

  if (!input.hasSensor) {
    // 沒有感應器(或尚未收到資料):等 2 秒後放行
    if (now - levelOpenedAt > 2000) {
      status.textContent = '未偵測到傾斜感應器,可直接開始';
      btn.disabled = false;
    }
    return;
  }
  const gx = input.rawGamma, gy = input.rawBeta;
  // 氣泡位置(±30° 對應量表半徑)
  const ox = clamp(gx / 30, -1, 1) * 46;
  const oy = clamp(gy / 30, -1, 1) * 46;
  bubble.style.transform = `translate(${ox}px, ${oy}px)`;

  const flat = Math.abs(gx) < LEVEL_FLAT_DEG && Math.abs(gy) < LEVEL_FLAT_DEG;
  if (flat) {
    if (!levelFlatSince) levelFlatSince = now;
    if (now - levelFlatSince >= LEVEL_STABLE_MS) {
      status.textContent = '已偵測到水平 ✓ 請點選確認';
      status.classList.add('ok');
      bubble.classList.add('ok');
      btn.disabled = false;
    } else {
      status.textContent = '保持不動…';
    }
  } else {
    levelFlatSince = 0;
    const deg = Math.max(Math.abs(gx), Math.abs(gy)).toFixed(0);
    status.textContent = `目前傾斜約 ${deg}° — 請平放在桌面上`;
    status.classList.remove('ok');
    bubble.classList.remove('ok');
    btn.disabled = true;
  }
}

function closeLevelCalibration(doCalibrate) {
  clearInterval(levelTimer);
  levelTimer = null;
  if (doCalibrate && input.hasSensor) {
    input.zeroGamma = input.rawGamma;
    input.zeroBeta = input.rawBeta;
    toast('已校準 ✓ 之後以此角度為基準');
  }
  hide('screen-level');
  sfx.click();
  if (levelFrom === 'start') showSeries();
  else { game.state = 'play'; lastT = 0; }
}

async function requestSensor() {
  // iOS 13+ 需要在使用者手勢中請求權限
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const res = await DeviceOrientationEvent.requestPermission();
      if (res !== 'granted') { toast('未取得感應器權限,可用拖曳操作'); return; }
    } catch { /* 非 iOS 或已拒絕 */ }
  }
  window.addEventListener('deviceorientation', onOrientation);
}

// 鍵盤(桌面)
window.addEventListener('keydown', e => { input.keys[e.key] = true; });
window.addEventListener('keyup', e => { input.keys[e.key] = false; });

// 拖曳(桌面 / 無感應器後備):按住拖曳 = 虛擬傾斜
canvas.addEventListener('pointerdown', e => {
  input.dragging = true;
  input.dragOX = e.clientX; input.dragOY = e.clientY;
  input.dragX = 0; input.dragY = 0;
});
window.addEventListener('pointermove', e => {
  if (!input.dragging) return;
  input.dragX = clamp((e.clientX - input.dragOX) / 90, -1, 1);
  input.dragY = clamp((e.clientY - input.dragOY) / 90, -1, 1);
});
window.addEventListener('pointerup', () => {
  input.dragging = false; input.dragX = 0; input.dragY = 0;
});

function getTilt() {
  let x = 0, y = 0;
  if (input.hasSensor) { x = input.tiltX; y = input.tiltY; }
  if (input.keys.ArrowLeft || input.keys.a) x -= 1;
  if (input.keys.ArrowRight || input.keys.d) x += 1;
  if (input.keys.ArrowUp || input.keys.w) y -= 1;
  if (input.keys.ArrowDown || input.keys.s) y += 1;
  if (input.dragging) { x += input.dragX; y += input.dragY; }
  return { x: clamp(x, -1, 1) * settings.sensitivity, y: clamp(y, -1, 1) * settings.sensitivity };
}

/* ---------- 迷宮生成(遞迴回溯 + 打通環路) ---------- */
function generateMaze(cols, rows, rng, braid) {
  // 每格牆:[N, E, S, W]
  const cells = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ n: true, e: true, s: true, w: true, visited: false })));
  const stack = [[0, 0]];
  cells[0][0].visited = true;
  const DIRS = [
    { dx: 0, dy: -1, a: 'n', b: 's' },
    { dx: 1, dy: 0,  a: 'e', b: 'w' },
    { dx: 0, dy: 1,  a: 's', b: 'n' },
    { dx: -1, dy: 0, a: 'w', b: 'e' },
  ];
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = DIRS.filter(d => {
      const nx = cx + d.dx, ny = cy + d.dy;
      return nx >= 0 && nx < cols && ny >= 0 && ny < rows && !cells[ny][nx].visited;
    });
    if (!options.length) { stack.pop(); continue; }
    const d = options[Math.floor(rng() * options.length)];
    const nx = cx + d.dx, ny = cy + d.dy;
    cells[cy][cx][d.a] = false;
    cells[ny][nx][d.b] = false;
    cells[ny][nx].visited = true;
    stack.push([nx, ny]);
  }
  // braid:隨機打掉部分死路的牆,製造環路(提高後期關卡的路線選擇)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = cells[y][x];
      const wallCount = ['n', 'e', 's', 'w'].filter(k => c[k]).length;
      if (wallCount === 3 && rng() < braid) {
        const candidates = DIRS.filter(d => {
          const nx = x + d.dx, ny = y + d.dy;
          return c[d.a] && nx >= 0 && nx < cols && ny >= 0 && ny < rows;
        });
        if (candidates.length) {
          const d = candidates[Math.floor(rng() * candidates.length)];
          c[d.a] = false;
          cells[y + d.dy][x + d.dx][d.b] = false;
        }
      }
    }
  }
  return cells;
}

// BFS:回傳每格距離起點的步數(用來挑最遠處當終點 / 放星星)
function bfsDistances(cells, sx, sy) {
  const rows = cells.length, cols = cells[0].length;
  const dist = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  const q = [[sx, sy]];
  dist[sy][sx] = 0;
  while (q.length) {
    const [x, y] = q.shift();
    const c = cells[y][x], d = dist[y][x];
    if (!c.n && dist[y - 1][x] === -1) { dist[y - 1][x] = d + 1; q.push([x, y - 1]); }
    if (!c.s && dist[y + 1][x] === -1) { dist[y + 1][x] = d + 1; q.push([x, y + 1]); }
    if (!c.w && dist[y][x - 1] === -1) { dist[y][x - 1] = d + 1; q.push([x - 1, y]); }
    if (!c.e && dist[y][x + 1] === -1) { dist[y][x + 1] = d + 1; q.push([x + 1, y]); }
  }
  return dist;
}

/* ---------- 遊戲狀態 ---------- */
const game = {
  state: 'menu',        // menu | play | paused | clear | falling
  series: store.get('series', 'passion'),   // 目前系列
  mode: 'series',       // series | daily(每日時令關卡)
  levelIndex: 1,        // 系列內第幾關(1..10)
  diff: 1,              // 內部難度
  stage: 'maze',        // maze | board | path
  totalScore: store.get('totalScore', 0),
  bestScore: store.get('bestScore', 0),
  maze: null,
  pathCells: null,      // 獨木橋:棧道格子
  pathPoints: null,     // 獨木橋:棧道像素折線
  pathWidth: 0,
  railNorm: null,       // 滾珠軌道:正規化取樣點 {u,v,turn}
  railPoints: null,     // 滾珠軌道:像素取樣點
  railGapMask: null,    // 滾珠軌道:缺口遮罩(依取樣索引)
  railStarIdx: null,    // 滾珠軌道:檢查點所在取樣索引
  railHalfGap: 0,       // 軌道內半寬(球心可偏移量)
  railNear: 0,          // 最近取樣點快取(視窗化搜尋)
  railRespawnIdx: 0,    // 掉落後的重生取樣索引
  cols: 0, rows: 0,
  cellSize: 0, offX: 0, offY: 0, wallT: 0,
  walls: [],            // 碰撞矩形
  ball: { x: 0, y: 0, vx: 0, vy: 0, r: 10 },
  startCell: { x: 0, y: 0 },
  goal: { x: 0, y: 0, r: 0 },
  stars: [],            // {x, y, got}
  holes: [],            // {x, y, r}
  starsGot: 0,
  falls: 0,
  time: 0,
  fallAnim: 0,
  particles: [],
  shake: 0,
  wobbleT: 0,       // 百香果搖晃相位
  ballRot: 0,       // 滾動旋轉角(果皮斑點用)
  squash: null,     // 撞擊擠壓 {t, s, nx, ny}
  mazeLayer: null,      // 預先渲染的牆(效能)
  floorLayer: null,
};

// 背景星空(視差)
const starfield = [];
function initStarfield() {
  starfield.length = 0;
  for (let i = 0; i < 90; i++) {
    starfield.push({
      x: Math.random(), y: Math.random(),
      z: 0.3 + Math.random() * 0.7,          // 深度 → 視差幅度
      r: 0.4 + Math.random() * 1.4,
      tw: Math.random() * Math.PI * 2,
    });
  }
}

/* ---------- 關卡建置 ---------- */
function levelParams(lv) {
  return {
    short: clamp(6 + Math.floor(lv * 0.7), 6, 14),   // 短邊格數
    braid: clamp(0.05 + lv * 0.02, 0.05, 0.3),
    holes: lv >= 3 ? clamp(Math.floor((lv - 1) / 2), 1, 6) : 0,
  };
}

/* ---------- 系列制關卡(每系列 10 關,一關一關解鎖) ---------- */
const SERIES = [
  { id: 'passion', name: '百香果果園', icon: '🥭', theme: 'passion', stage: 'maze',
    desc: '經典迷宮,收集花朵抵達漩渦', diff: 1 },
  { id: 'board', name: '老街彈珠台', icon: '🎯', theme: 'passion', stage: 'board',
    desc: '坑洞板上依序闖過 ①②③', diff: 3 },
  { id: 'rail', name: '滾珠珠機台', icon: '🎢', theme: 'passion', stage: 'rail',
    desc: '沿黃銅軌道滾鋼珠,小心缺口!', diff: 2,
    // 鋼珠物理:好推、滑(低阻力)、撞軌道彈性高
    phys: { accel: 2500, friction: 1.2, restitution: 0.45, maxSpeed: 900, wobble: 0, squash: false } },
  { id: 'apple', name: '蘋果果園', icon: '🍎', theme: 'apple', stage: 'maze',
    desc: '蘋果會滾出弧線,不走直線', diff: 3 },
  { id: 'bridge', name: '高空獨木橋', icon: '🌉', theme: 'nebula', stage: 'path',
    desc: '懸空棧道,滾出邊緣就摔落', diff: 3,
    // 獨木橋專屬物理:慢速、高阻力、好控制(星雲原生物理太快太滑)
    phys: { accel: 2200, friction: 3.0, restitution: 0.1, maxSpeed: 700, wobble: 0, squash: false } },
  { id: 'pine', name: '鳳梨田', icon: '🍍', theme: 'pineapple', stage: 'maze',
    desc: '超難滾的鳳梨,顛簸前進', diff: 4 },
  { id: 'waxapple', name: '蓮霧樹下', icon: '🔔', theme: 'waxapple', stage: 'maze',
    desc: '春.蓮霧:超彈又會飄移', diff: 2 },
  { id: 'watermelon', name: '西瓜田', icon: '🍉', theme: 'watermelon', stage: 'maze',
    desc: '夏.西瓜:超重,衝起來煞不住', diff: 4 },
  { id: 'persimmon', name: '柿子園', icon: '🟠', theme: 'persimmon', stage: 'maze',
    desc: '秋.柿子:軟黏慢,撞牆大變形', diff: 3 },
  { id: 'strawberry', name: '草莓園', icon: '🍓', theme: 'strawberry', stage: 'maze',
    desc: '冬.草莓:圓錐形,滾動大轉彎', diff: 4 },
  { id: 'nebula', name: '星雲迷宮', icon: '🌌', theme: 'nebula', stage: 'maze',
    desc: '高速能量球,考驗反應', diff: 5 },
];
const SERIES_LEN = 10;
const seriesById = (id) => SERIES.find(s => s.id === id) || SERIES[0];

// 進度:{ seriesId: { "1": 星數, "2": 星數, ... } }
const progress = store.get('progress', {});
function starsOf(id, idx) {
  const p = progress[id];
  const v = p && p[idx];
  return typeof v === 'number' ? v : -1;          // -1 = 未通關
}
function clearedCount(id) {
  let n = 0;
  for (let i = 1; i <= SERIES_LEN; i++) if (starsOf(id, i) >= 0) n++;
  return n;
}
function unlockedIndex(id) {                       // 目前可挑戰的最遠關卡
  for (let i = 1; i <= SERIES_LEN; i++) if (starsOf(id, i) < 0) return i;
  return SERIES_LEN;
}
function saveStars(id, idx, stars) {
  if (!progress[id]) progress[id] = {};
  progress[id][idx] = Math.max(starsOf(id, idx), stars);
  store.set('progress', progress);
}

// 依螢幕比例決定格數(三種關卡型態共用)
function gridSize(lv) {
  const p = levelParams(lv);
  const { w, h } = viewSize();
  const portrait = h >= w;
  const ratio = Math.max(w, h) / Math.min(w, h);
  const longCells = clamp(Math.round(p.short * ratio), p.short, 24);
  game.cols = portrait ? p.short : longCells;
  game.rows = portrait ? longCells : p.short;
}

// 依 game.stage / game.diff 建置關卡(系列與每日關卡共用)
function constructStage(seed) {
  gridSize(game.diff);
  if (game.stage === 'maze') buildMazeStage(game.diff, seed);
  else if (game.stage === 'board') buildBoardStage(game.diff, seed);
  else if (game.stage === 'rail') buildRailStage(game.diff, seed);
  else buildPathStage(game.diff, seed);

  game.stars = [];
  game.starsGot = 0;
  game.falls = 0;
  game.time = 0;
  game.particles = [];
  game.goalHintT = -9;
  layout();
  resetBall();
  updateHUD();
}

function buildLevel(index) {
  const s = seriesById(game.series);
  game.mode = 'series';
  game.levelIndex = index;
  game.stage = s.stage;
  // 系列內難度遞增:第 1 關 = 系列基礎難度,之後每關 +1
  game.diff = s.diff + (index - 1);
  constructStage((SERIES.indexOf(s) + 1) * 131071 + index * 7919);
  if (game.stage === 'board') toast('依序通過 ①②③ 再進終點!');
  else if (game.stage === 'path') toast('沿著棧道走,別掉下去!');
  else if (game.stage === 'rail') toast('沿軌道滾到終點杯!經過缺口要走穩!');
  else if (index === 1) toast(theme().startToast);
}

/* ---------- 每日時令關卡 ----------
   依台灣水果產季,每天推廣一種當令水果;
   關卡由日期種子決定(所有玩家同一關),型態每日輪替 */
const MONTH_FRUITS = {
  1: ['strawberry', 'apple'],       // 冬:草莓、蘋果
  2: ['strawberry', 'waxapple'],
  3: ['waxapple', 'pineapple'],     // 春:蓮霧、鳳梨
  4: ['waxapple', 'pineapple'],
  5: ['pineapple', 'watermelon'],
  6: ['watermelon', 'passion'],     // 夏:西瓜、百香果
  7: ['watermelon', 'passion'],
  8: ['passion', 'watermelon'],
  9: ['persimmon', 'passion'],      // 秋:柿子、百香果
  10: ['persimmon', 'apple'],
  11: ['persimmon', 'apple'],
  12: ['strawberry', 'apple'],
};

function dailyInfo(d = new Date()) {
  const y = d.getFullYear();
  const doy = Math.floor((d - new Date(y, 0, 0)) / 86400000);
  const month = d.getMonth() + 1;
  const list = MONTH_FRUITS[month] || ['passion'];
  const themeId = list[doy % list.length];
  const stage = ['maze', 'board', 'path'][doy % 3];
  const ymd = `${y}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { themeId, stage, seed: y * 1000 + doy, ymd, doy };
}
function dailyDoneStars(ymd) {
  const v = store.get('dailyStars', {})[ymd];
  return typeof v === 'number' ? v : -1;
}

function enterDailyLevel() {
  const info = dailyInfo();
  const th = THEMES[info.themeId] || THEMES.passion;
  // 用該水果對應的迷宮系列當物理/顯示脈絡
  const s = SERIES.find(x => x.theme === info.themeId && x.stage === 'maze') || SERIES[0];
  game.series = s.id;
  game.mode = 'daily';
  settings.theme = info.themeId;
  applyThemeClass();
  hide('screen-series'); hide('screen-levels'); hide('screen-clear');
  show('hud');
  game.levelIndex = 1;
  game.stage = info.stage;
  game.diff = 5 + (info.doy % 3);
  constructStage(info.seed);
  game.state = 'play';
  lastT = 0;
  toast(`📅 今日時令:${th.fruit || ''}!${game.stage === 'board' ? '依序通過 ①②③!' : game.stage === 'path' ? '別掉下棧道!' : ''}`);
}

// 老街平衡彈珠台:整片坑洞、蜿蜒安全通道、依序闖關檢查點
function buildBoardStage(lv, seed) {
  const rng = mulberry32(seed + 54321);
  const { cols, rows } = game;
  game.maze = null;
  game.pathCells = null;

  // 蜿蜒安全通道(由下而上隨機左右擺)
  const channel = new Array(rows);
  let cx = Math.floor(cols / 2);
  for (let r = rows - 1; r >= 0; r--) {
    channel[r] = cx;
    cx = clamp(cx + Math.floor(rng() * 3) - 1, 1, cols - 2);
  }
  game.boardChannel = channel;

  // 坑洞:隔行整排,避開通道左右各一格;關卡越高洞越密
  const density = clamp(0.55 + lv * 0.025, 0.55, 0.88);
  game.holeCells = [];
  for (let r = 2; r < rows - 1; r += 2) {
    for (let c = 0; c < cols; c++) {
      if (Math.abs(c - channel[r]) <= 1) continue;
      if (rng() < density) game.holeCells.push({ x: c, y: r });
    }
  }

  // 檢查點 ①②③(由下而上,必須依序通過)
  const cpRows = [Math.floor(rows * 0.72), Math.floor(rows * 0.47), Math.floor(rows * 0.22)];
  game.starCells = cpRows.map(r => ({ x: channel[r], y: r }));
  game.startCell = { x: channel[rows - 1], y: rows - 1 };
  game.goalCell = { x: channel[0], y: 0 };
}

/* 老街滾珠珠機台:黃銅雙軌道蛇行來回,鋼珠被軌道夾住,
   但軌道上有缺口 — 經過缺口時偏離中線就會掉出去 */
function buildRailStage(lv, seed) {
  const rng = mulberry32(seed + 77777);
  game.maze = null;
  game.pathCells = null;
  game.holeCells = [];
  game.starCells = [];               // rail 不用格子座標(改用取樣索引)
  game.startCell = { x: 0, y: 0 };
  game.goalCell = { x: 0, y: 0 };

  // 蛇行軌道:數條水平直道 + 兩端 180° U 型彎(正規化座標 0..1)
  const runs = clamp(3 + Math.floor(lv / 3), 3, 6);
  const waveAmp = Math.min(0.35, lv * 0.05);          // 直道的波浪起伏(相對車道間距)
  const uL = 0.14, uR = 0.86;                          // 直道左右邊界
  const vTop = 0.08, vBot = 0.92;
  const laneGap = (vBot - vTop) / (runs - 1);
  const pts = [];
  for (let i = 0; i < runs; i++) {
    const v0 = vBot - i * laneGap;
    const leftToRight = i % 2 === 0;
    const N = 34;
    const phase = rng() * Math.PI * 2;
    const waves = 1.5 + rng() * 1.5;
    for (let k = 0; k <= N; k++) {
      const t2 = k / N;
      const u = leftToRight ? uL + (uR - uL) * t2 : uR - (uR - uL) * t2;
      const v = v0 + Math.sin(t2 * Math.PI * 2 * waves + phase) * waveAmp * laneGap * Math.sin(Math.PI * t2);
      pts.push({ u, v, turn: false });
    }
    // U 型彎接到下一條直道
    if (i < runs - 1) {
      const cu = leftToRight ? uR : uL;             // 彎道圓心 u(在端點外側轉)
      const cv = v0 - laneGap / 2;
      const R = laneGap / 2;
      const M = 14;
      for (let k = 1; k < M; k++) {
        const a = (k / M) * Math.PI;
        const dir = leftToRight ? 1 : -1;
        pts.push({ u: cu + Math.sin(a) * R * 0.55 * dir, v: cv + Math.cos(a) * R, turn: true });
      }
    }
  }
  game.railNorm = pts;

  // 缺口:只開在直道上,避開頭尾與彼此
  const nGaps = clamp(1 + Math.floor(lv / 2), 1, 6);
  const gapLen = 5;                                   // 取樣點數(約 1.5~2 顆球長)
  const mask = new Array(pts.length).fill(false);
  const taken = [];
  let tries = 0;
  while (taken.length < nGaps && tries++ < 200) {
    const s = 20 + Math.floor(rng() * (pts.length - 40));
    let ok = true;
    for (let k = s - 4; k < s + gapLen + 4; k++) if (pts[k].turn) { ok = false; break; }
    if (ok && taken.every(t2 => Math.abs(t2 - s) > 22)) {
      taken.push(s);
      for (let k = s; k < s + gapLen; k++) mask[k] = true;
    }
  }
  game.railGapMask = mask;

  // 檢查點:約 25% / 50% / 75% 處(避開缺口與彎道)
  game.railStarIdx = [0.25, 0.5, 0.75].map(f => {
    let i = Math.floor(pts.length * f);
    while (i < pts.length - 5 && (mask[i] || pts[i].turn)) i++;
    return i;
  });
  game.railRespawnIdx = 0;
  game.railNear = 0;
}

// 高空獨木橋:無牆棧道,離開路面就摔落
function buildPathStage(lv, seed) {
  const rng = mulberry32(seed + 99991);
  const { cols, rows } = game;
  game.maze = null;
  game.holeCells = [];

  // 蜿蜒棧道(每行一個節點;前期偏直,越後面越蜿蜒)
  const wiggle = clamp(0.3 + lv * 0.06, 0.35, 0.85);
  const channel = new Array(rows);
  let cx = Math.floor(cols / 2);
  for (let r = rows - 1; r >= 0; r--) {
    channel[r] = cx;
    const step = rng() < wiggle ? (rng() < 0.5 ? -1 : 1) : 0;
    cx = clamp(cx + step, 1, cols - 2);
  }
  game.pathCells = [];
  for (let r = rows - 1; r >= 0; r--) game.pathCells.push({ x: channel[r], y: r });

  const cpRows = [Math.floor(rows * 0.7), Math.floor(rows * 0.45), Math.floor(rows * 0.2)];
  game.starCells = cpRows.map(r => ({ x: channel[r], y: r }));
  game.startCell = { x: channel[rows - 1], y: rows - 1 };
  game.goalCell = { x: channel[0], y: 0 };
}

function buildMazeStage(lv, seed) {
  const p = levelParams(lv);
  const rng = mulberry32(seed + 12345);
  game.pathCells = null;
  game.maze = generateMaze(game.cols, game.rows, rng, p.braid);

  // 起點:左下角;終點:離起點最遠的格子
  const sx = 0, sy = game.rows - 1;
  const dist = bfsDistances(game.maze, sx, sy);
  let far = { x: 0, y: 0, d: -1 };
  const deadEnds = [];
  for (let y = 0; y < game.rows; y++) {
    for (let x = 0; x < game.cols; x++) {
      if (dist[y][x] > far.d) far = { x, y, d: dist[y][x] };
      const c = game.maze[y][x];
      const wc = ['n', 'e', 's', 'w'].filter(k => c[k]).length;
      if (wc >= 3 && !(x === sx && y === sy)) deadEnds.push({ x, y, d: dist[y][x] });
    }
  }
  game.startCell = { x: sx, y: sy };
  game.goalCell = { x: far.x, y: far.y };

  // 星星:挑距離適中偏遠的死路(不與終點重疊)
  deadEnds.sort((a, b) => b.d - a.d);
  const starCells = deadEnds.filter(c => !(c.x === far.x && c.y === far.y)).slice(0, 8);
  // 打散後取 3 個
  for (let i = starCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [starCells[i], starCells[j]] = [starCells[j], starCells[i]];
  }
  game.starCells = starCells.slice(0, 3);

  // 黑洞:放在通道中(距離起點/終點/星星至少 2 步的格子)
  game.holeCells = [];
  if (p.holes > 0) {
    const occupied = new Set([`${sx},${sy}`, `${far.x},${far.y}`, ...game.starCells.map(c => `${c.x},${c.y}`)]);
    const candidates = [];
    for (let y = 0; y < game.rows; y++) {
      for (let x = 0; x < game.cols; x++) {
        if (dist[y][x] >= 4 && Math.abs(dist[y][x] - far.d) >= 3 && !occupied.has(`${x},${y}`)) {
          candidates.push({ x, y });
        }
      }
    }
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    // 黑洞之間保持距離
    for (const c of candidates) {
      if (game.holeCells.length >= p.holes) break;
      if (game.holeCells.every(hc => Math.abs(hc.x - c.x) + Math.abs(hc.y - c.y) >= 3)) {
        game.holeCells.push(c);
      }
    }
  }
}

// 依視窗大小計算格子尺寸與所有幾何(轉向 / 縮放時重呼叫)
function layout() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = viewSize();
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const margin = 10;
  game.cellSize = Math.min((w - margin * 2) / game.cols, (h - margin * 2) / game.rows);
  game.offX = (w - game.cellSize * game.cols) / 2;
  game.offY = (h - game.cellSize * game.rows) / 2;
  game.wallT = Math.max(3, game.cellSize * 0.14);
  game.ball.r = game.cellSize * 0.28;

  const cc = (c) => ({
    x: game.offX + (c.x + 0.5) * game.cellSize,
    y: game.offY + (c.y + 0.5) * game.cellSize,
  });
  game.goal = { ...cc(game.goalCell), r: game.cellSize * 0.34 };
  game.stars = game.starCells.map((c, i) => ({ ...cc(c), got: game.stars[i] ? game.stars[i].got : false }));
  game.holes = game.holeCells.map(c => ({ ...cc(c), r: game.cellSize * 0.3 }));

  // 獨木橋:棧道折線(像素座標)與路寬(前期寬、後期窄)
  if (game.stage === 'path') {
    game.pathPoints = game.pathCells.map(c => cc(c));
    const widthFactor = clamp(1.5 - game.diff * 0.05, 1.0, 1.5);
    game.pathWidth = Math.max(game.ball.r * 3, game.cellSize * widthFactor);
  } else {
    game.pathPoints = null;
  }

  // 滾珠軌道:正規化取樣點 → 像素;終點與檢查點放在軌道上
  if (game.stage === 'rail') {
    const bw = game.cols * game.cellSize, bh = game.rows * game.cellSize;
    game.railPoints = game.railNorm.map(p => ({
      x: game.offX + p.u * bw,
      y: game.offY + p.v * bh,
    }));
    game.ball.r = Math.min(game.ball.r, game.cellSize * 0.26);
    game.railHalfGap = game.ball.r * 1.18;     // 軌道內緣比球稍寬
    const last = game.railPoints[game.railPoints.length - 1];
    game.goal = { x: last.x, y: last.y, r: game.cellSize * 0.34 };
    game.stars = game.railStarIdx.map((i, k) => ({
      ...game.railPoints[i],
      got: game.stars[k] ? game.stars[k].got : false,
    }));
    game.holes = [];
  } else {
    game.railPoints = null;
  }

  buildWallRects();
  renderMazeLayer();
}

function buildWallRects() {
  const { cols, rows, cellSize: s, offX, offY, wallT: t } = game;
  // 獨木橋/滾珠軌道:完全無牆(靠掉落/軌道約束判定)
  if (game.stage === 'path' || game.stage === 'rail') { game.walls = []; return; }
  const half = t / 2;
  const rects = [];
  const px = x => offX + x * s;
  const py = y => offY + y * s;
  // 外框
  rects.push({ x: px(0) - half, y: py(0) - half, w: cols * s + t, h: t });
  rects.push({ x: px(0) - half, y: py(rows) - half, w: cols * s + t, h: t });
  rects.push({ x: px(0) - half, y: py(0) - half, w: t, h: rows * s + t });
  rects.push({ x: px(cols) - half, y: py(0) - half, w: t, h: rows * s + t });
  // 內牆(迷宮限定;彈珠台只有外框)
  if (game.maze) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = game.maze[y][x];
        if (c.e && x < cols - 1) rects.push({ x: px(x + 1) - half, y: py(y) - half, w: t, h: s + t });
        if (c.s && y < rows - 1) rects.push({ x: px(x) - half, y: py(y + 1) - half, w: s + t, h: t });
      }
    }
  }
  game.walls = rects;
}

function resetBall() {
  const b = game.ball;
  if (game.stage === 'rail' && game.railPoints) {
    // 滾珠軌道:從最後通過的檢查點重生
    const p = game.railPoints[game.railRespawnIdx] || game.railPoints[0];
    b.x = p.x; b.y = p.y;
    game.railNear = game.railRespawnIdx;
  } else {
    b.x = game.offX + (game.startCell.x + 0.5) * game.cellSize;
    b.y = game.offY + (game.startCell.y + 0.5) * game.cellSize;
  }
  b.vx = 0; b.vy = 0;
}

/* ---------- 預渲染(牆 & 地板發光層,避免每幀 shadowBlur) ---------- */
function renderMazeLayer() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const { w, h } = viewSize();

  // 地板
  const floor = document.createElement('canvas');
  floor.width = w * dpr; floor.height = h * dpr;
  const fc = floor.getContext('2d');
  fc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const fx = game.offX, fy = game.offY, fw = game.cols * game.cellSize, fh = game.rows * game.cellSize;
  const style = theme().style;
  const grad = fc.createRadialGradient(fx + fw / 2, fy + fh / 2, 10, fx + fw / 2, fy + fh / 2, Math.max(fw, fh) * 0.75);
  if (style) {
    // 果肉地板
    grad.addColorStop(0, style.floor[0]);
    grad.addColorStop(1, style.floor[1]);
  } else {
    grad.addColorStop(0, 'rgba(24, 30, 66, 0.9)');
    grad.addColorStop(1, 'rgba(8, 10, 24, 0.9)');
  }
  const noFloor = game.stage === 'path' || game.stage === 'rail';   // 獨木橋/滾珠軌道:不畫一般地板
  if (!noFloor) {
    fc.fillStyle = grad;
    fc.fillRect(fx, fy, fw, fh);
  }
  if (!noFloor && style && (style.decor === 'passionSeeds' || style.decor === 'seeds')) {
    // 果肉上散落的籽(顏色依水果:百香果黑籽/西瓜黑籽/草莓金籽)
    const sc = style.seed || { halo: 'rgba(255, 220, 140, 0.5)', body: '#2e1608', gloss: 'rgba(255, 240, 200, 0.55)' };
    const nSeeds = Math.round(game.cols * game.rows * 0.7);
    for (let i = 0; i < nSeeds; i++) {
      const sx2 = fx + 4 + Math.random() * (fw - 8);
      const sy2 = fy + 4 + Math.random() * (fh - 8);
      const sr = game.cellSize * (0.04 + Math.random() * 0.035);
      const rot = Math.random() * Math.PI;
      fc.save();
      fc.translate(sx2, sy2); fc.rotate(rot);
      fc.fillStyle = sc.halo;
      fc.beginPath(); fc.ellipse(0, 0, sr * 1.9, sr * 1.5, 0, 0, Math.PI * 2); fc.fill();
      fc.fillStyle = sc.body;
      fc.beginPath(); fc.ellipse(0, 0, sr * 1.25, sr, 0, 0, Math.PI * 2); fc.fill();
      fc.fillStyle = sc.gloss;
      fc.beginPath(); fc.arc(-sr * 0.35, -sr * 0.3, sr * 0.3, 0, Math.PI * 2); fc.fill();
      fc.restore();
    }
  } else if (!noFloor && style && style.decor === 'appleCore') {
    // 蘋果:中央果核星形籽 + 放射狀果肉纖維
    const cx0 = fx + fw / 2, cy0 = fy + fh / 2;
    fc.save();
    fc.strokeStyle = 'rgba(190, 140, 70, 0.15)';
    fc.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      fc.beginPath();
      fc.moveTo(cx0 + Math.cos(a) * game.cellSize * 0.8, cy0 + Math.sin(a) * game.cellSize * 0.8);
      fc.lineTo(cx0 + Math.cos(a) * Math.max(fw, fh) * 0.5, cy0 + Math.sin(a) * Math.max(fw, fh) * 0.5);
      fc.stroke();
    }
    fc.strokeStyle = 'rgba(170, 120, 50, 0.3)';
    fc.lineWidth = 2;
    fc.beginPath(); fc.arc(cx0, cy0, game.cellSize * 0.75, 0, Math.PI * 2); fc.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      fc.save();
      fc.translate(cx0 + Math.cos(a) * game.cellSize * 0.42, cy0 + Math.sin(a) * game.cellSize * 0.42);
      fc.rotate(a + Math.PI / 2);
      fc.fillStyle = '#4a2c10';
      fc.beginPath(); fc.ellipse(0, 0, game.cellSize * 0.06, game.cellSize * 0.11, 0, 0, Math.PI * 2); fc.fill();
      fc.restore();
    }
    fc.restore();
  } else if (!noFloor && style && style.decor === 'pineRings') {
    // 鳳梨:同心果肉環紋 + 纖維短刻
    const cx0 = fx + fw / 2, cy0 = fy + fh / 2;
    fc.save();
    fc.strokeStyle = 'rgba(180, 120, 20, 0.18)';
    fc.lineWidth = Math.max(2, game.cellSize * 0.06);
    const maxR = Math.hypot(fw, fh) / 2;
    for (let r0 = game.cellSize * 0.8; r0 < maxR; r0 += game.cellSize * 1.1) {
      fc.beginPath(); fc.arc(cx0, cy0, r0, 0, Math.PI * 2); fc.stroke();
    }
    fc.strokeStyle = 'rgba(160, 105, 15, 0.22)';
    fc.lineWidth = 1.5;
    for (let i = 0; i < 60; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr0 = game.cellSize * 0.8 + Math.random() * (maxR - game.cellSize);
      const x1 = cx0 + Math.cos(a) * rr0, y1 = cy0 + Math.sin(a) * rr0;
      fc.beginPath();
      fc.moveTo(x1, y1);
      fc.lineTo(x1 + Math.cos(a) * game.cellSize * 0.18, y1 + Math.sin(a) * game.cellSize * 0.18);
      fc.stroke();
    }
    fc.fillStyle = 'rgba(255, 240, 180, 0.35)';
    fc.beginPath(); fc.arc(cx0, cy0, game.cellSize * 0.3, 0, Math.PI * 2); fc.fill();
    fc.restore();
  }
  // 淡格線
  if (!noFloor) {
    fc.strokeStyle = style ? style.grid : 'rgba(90, 120, 220, 0.07)';
    fc.lineWidth = 1;
    for (let x = 0; x <= game.cols; x++) {
      fc.beginPath(); fc.moveTo(fx + x * game.cellSize, fy); fc.lineTo(fx + x * game.cellSize, fy + fh); fc.stroke();
    }
    for (let y = 0; y <= game.rows; y++) {
      fc.beginPath(); fc.moveTo(fx, fy + y * game.cellSize); fc.lineTo(fx + fw, fy + y * game.cellSize); fc.stroke();
    }
  }

  // 老街彈珠台:整片坑洞烘焙進地板(靜態,省效能)
  if (game.stage === 'board') {
    const rim = style ? style.holeRim : '140, 60, 255';
    for (const hole of game.holes) {
      const g2 = fc.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hole.r * 1.3);
      g2.addColorStop(0, '#0a0503');
      g2.addColorStop(0.6, '#160a05');
      g2.addColorStop(0.85, `rgba(${rim}, 0.8)`);
      g2.addColorStop(1, `rgba(${rim}, 0)`);
      fc.fillStyle = g2;
      fc.beginPath();
      fc.arc(hole.x, hole.y, hole.r * 1.3, 0, Math.PI * 2);
      fc.fill();
    }
  }

  // 老街滾珠珠機台:木箱背景 + 黃銅雙軌道
  if (game.stage === 'rail' && game.railPoints) {
    // 木箱底板(直木紋)
    const wood = fc.createLinearGradient(0, 0, w, 0);
    wood.addColorStop(0, '#6b4a24');
    wood.addColorStop(0.5, '#8a6234');
    wood.addColorStop(1, '#63431f');
    fc.fillStyle = wood;
    fc.fillRect(0, 0, w, h);
    const plank = Math.max(48, w / 7);
    for (let x0 = plank; x0 < w; x0 += plank) {
      fc.strokeStyle = 'rgba(40, 22, 6, 0.45)';
      fc.lineWidth = 2;
      fc.beginPath(); fc.moveTo(x0, 0); fc.lineTo(x0, h); fc.stroke();
      fc.strokeStyle = 'rgba(255, 220, 160, 0.06)';
      fc.lineWidth = 6;
      fc.beginPath(); fc.moveTo(x0 - plank * 0.4, 0); fc.lineTo(x0 - plank * 0.4, h); fc.stroke();
    }

    const pts = game.railPoints;
    const mask = game.railGapMask;
    const tube = Math.max(3.5, game.ball.r * 0.42);          // 軌道管粗細
    const railOff = game.railHalfGap + tube * 0.5;           // 管中心離軌道中線
    // 法線
    const normals = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b2 = pts[Math.min(pts.length - 1, i + 1)];
      const dx2 = b2.x - a.x, dy2 = b2.y - a.y;
      const L = Math.hypot(dx2, dy2) || 1;
      return { x: -dy2 / L, y: dx2 / L };
    });
    // 軌道下方陰影(整條)
    fc.lineCap = 'round'; fc.lineJoin = 'round';
    fc.strokeStyle = 'rgba(30, 15, 2, 0.35)';
    fc.lineWidth = (game.railHalfGap + tube) * 2 + 4;
    fc.beginPath();
    fc.moveTo(pts[0].x + 2, pts[0].y + 4);
    for (let i = 1; i < pts.length; i++) fc.lineTo(pts[i].x + 2, pts[i].y + 4);
    fc.stroke();
    // 兩條黃銅管(缺口處斷開)
    const strokeRail = (side, color, width) => {
      fc.strokeStyle = color;
      fc.lineWidth = width;
      fc.beginPath();
      let pen = false;
      for (let i = 0; i < pts.length; i++) {
        if (mask[i]) { pen = false; continue; }
        const x0 = pts[i].x + normals[i].x * railOff * side;
        const y0 = pts[i].y + normals[i].y * railOff * side;
        if (!pen) { fc.moveTo(x0, y0); pen = true; }
        else fc.lineTo(x0, y0);
      }
      fc.stroke();
    };
    for (const side of [-1, 1]) {
      strokeRail(side, '#6e4d10', tube * 2 + 2);      // 外緣暗邊
      strokeRail(side, '#c9992e', tube * 2);          // 黃銅本體
      strokeRail(side, '#ffe08a', tube * 0.8);        // 高光
    }
    // 缺口端點紅色警示 + 端帽
    for (let i = 1; i < pts.length; i++) {
      const edge = mask[i] !== mask[i - 1];
      if (!edge) continue;
      const j = mask[i] ? i - 1 : i;
      for (const side of [-1, 1]) {
        const x0 = pts[j].x + normals[j].x * railOff * side;
        const y0 = pts[j].y + normals[j].y * railOff * side;
        fc.fillStyle = '#8a6a1f';
        fc.beginPath(); fc.arc(x0, y0, tube * 1.15, 0, Math.PI * 2); fc.fill();
        fc.fillStyle = '#e04a3a';
        fc.beginPath(); fc.arc(x0, y0, tube * 0.55, 0, Math.PI * 2); fc.fill();
      }
    }
    // 起點座
    fc.fillStyle = 'rgba(60, 40, 10, 0.8)';
    fc.beginPath(); fc.arc(pts[0].x, pts[0].y, game.ball.r * 1.6, 0, Math.PI * 2); fc.fill();
    fc.strokeStyle = '#c9992e'; fc.lineWidth = 2.5;
    fc.beginPath(); fc.arc(pts[0].x, pts[0].y, game.ball.r * 1.6, 0, Math.PI * 2); fc.stroke();
  }

  // 高空獨木橋:懸空棧道(周圍是深淵)
  if (game.stage === 'path' && game.pathPoints) {
    const pts = game.pathPoints;
    fc.lineCap = 'round';
    fc.lineJoin = 'round';
    const ribbon = (width, colorStyle) => {
      fc.strokeStyle = colorStyle;
      fc.lineWidth = width;
      fc.beginPath();
      fc.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) fc.lineTo(pts[i].x, pts[i].y);
      fc.stroke();
    };
    // 邊緣光
    ribbon(game.pathWidth + Math.max(8, game.cellSize * 0.22), style ? 'rgba(255, 200, 120, 0.22)' : 'rgba(120, 180, 255, 0.28)');
    // 棧道板面
    const deck = fc.createLinearGradient(fx, fy, fx, fy + fh);
    deck.addColorStop(0, style ? style.floor[0] : '#2a3468');
    deck.addColorStop(1, style ? style.floor[1] : '#141a3a');
    ribbon(game.pathWidth, deck);
    // 中線虛線
    fc.setLineDash([game.cellSize * 0.28, game.cellSize * 0.4]);
    ribbon(Math.max(1.5, game.cellSize * 0.05), style ? 'rgba(120, 70, 10, 0.4)' : 'rgba(180, 220, 255, 0.35)');
    fc.setLineDash([]);
  }
  game.floorLayer = floor;

  // 牆(霓虹漸層 + 發光)
  const layer = document.createElement('canvas');
  layer.width = w * dpr; layer.height = h * dpr;
  const lc = layer.getContext('2d');
  lc.setTransform(dpr, 0, 0, dpr, 0, 0);
  const wallGrad = lc.createLinearGradient(fx, fy, fx + fw, fy + fh);
  if (style) {
    // 果皮牆(略帶蠟質感)
    wallGrad.addColorStop(0, style.wall[0]);
    wallGrad.addColorStop(0.5, style.wall[1]);
    wallGrad.addColorStop(1, style.wall[2]);
    lc.shadowColor = style.wallShadow;
    lc.shadowBlur = Math.max(4, game.wallT * 0.9);
  } else {
    wallGrad.addColorStop(0, '#4de8ff');
    wallGrad.addColorStop(0.5, '#7a7dff');
    wallGrad.addColorStop(1, '#ff5ecf');
    lc.shadowColor = 'rgba(100, 150, 255, 0.8)';
    lc.shadowBlur = Math.max(6, game.wallT * 1.6);
  }
  lc.fillStyle = wallGrad;
  const rr = Math.min(4, game.wallT / 2);
  for (const r of game.walls) {
    lc.beginPath();
    if (lc.roundRect) lc.roundRect(r.x, r.y, r.w, r.h, rr); else lc.rect(r.x, r.y, r.w, r.h);
    lc.fill();
  }
  // 亮芯(星雲=發光核心;水果=果皮蠟質高光)
  lc.shadowBlur = 0;
  lc.fillStyle = style ? style.sheen : 'rgba(230, 245, 255, 0.35)';
  const inset = game.wallT * 0.3;
  for (const r of game.walls) {
    lc.beginPath();
    if (lc.roundRect) lc.roundRect(r.x + inset, r.y + inset, Math.max(1, r.w - inset * 2), Math.max(1, r.h - inset * 2), rr);
    else lc.rect(r.x + inset, r.y + inset, Math.max(1, r.w - inset * 2), Math.max(1, r.h - inset * 2));
    lc.fill();
  }
  game.mazeLayer = layer;
}

/* ---------- 物理(參數依主題而異;系列可覆寫,如獨木橋) ---------- */
function activePhys() {
  const s = seriesById(game.series);
  return s.phys || theme().phys;
}

function physicsStep(dt) {
  const b = game.ball;
  const ph = activePhys();
  const tilt = getTilt();
  const vs = viewSize(); const scale = Math.min(vs.w, vs.h) / 720;
  // 鳳梨:靜摩擦死區 — 傾斜量不到門檻推不動,超過後扣除門檻再出力
  let tx = tilt.x, ty = tilt.y;
  if (ph.deadzone) {
    const tm = Math.hypot(tx, ty);
    if (tm < ph.deadzone) { tx = 0; ty = 0; }
    else {
      const k = (tm - ph.deadzone) / (1 - ph.deadzone) / tm;
      tx *= k; ty *= k;
    }
  }
  b.vx += tx * ph.accel * scale * dt;
  b.vy += ty * ph.accel * scale * dt;
  const damp = Math.exp(-ph.friction * dt);
  b.vx *= damp; b.vy *= damp;
  let sp = Math.hypot(b.vx, b.vy);
  const maxSp = ph.maxSpeed * scale;
  if (sp > maxSp) { b.vx *= maxSp / sp; b.vy *= maxSp / sp; sp = maxSp; }

  // 百香果:果形不正,滾動時會左右搖晃偏移
  if (ph.wobble && sp > 30) {
    game.wobbleT += dt * (5 + sp / 150);
    const k = Math.sin(game.wobbleT * 6) * ph.wobble * scale * (sp / maxSp) * dt;
    const ux = -b.vy / sp, uy = b.vx / sp;
    b.vx += ux * k;
    b.vy += uy * k;
  }

  // 蘋果:果形不對稱,滾動方向持續偏彎(速度向量緩慢旋轉)
  if (ph.curve && sp > 30) {
    game.wobbleT += dt;
    const ang = ph.curve * (sp / maxSp) * Math.sin(game.wobbleT * 1.1) * dt;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const nvx = b.vx * ca - b.vy * sa;
    b.vy = b.vx * sa + b.vy * ca;
    b.vx = nvx;
  }

  // 鳳梨:表面凹凸,滾動時一路顛簸抖動
  if (ph.jitter && sp > 40) {
    b.vx += (Math.random() - 0.5) * ph.jitter * scale * dt;
    b.vy += (Math.random() - 0.5) * ph.jitter * scale * dt;
  }

  // 滾動旋轉(果皮斑點視覺用)
  game.ballRot += ((b.vx + b.vy) * dt) / Math.max(6, b.r);

  // 分段位移,避免高速穿牆
  const steps = clamp(Math.ceil((sp * dt) / (b.r * 0.5)), 1, 8);
  for (let i = 0; i < steps; i++) {
    b.x += (b.vx * dt) / steps;
    b.y += (b.vy * dt) / steps;
    collideWalls();
    if (game.stage === 'rail' && game.state === 'play') railConstrain(scale, ph);
  }

  // 獨木橋:球心越過棧道邊緣才摔落(允許半顆球懸空,較符合直覺)
  if (game.stage === 'path' && game.state === 'play' &&
      distToPath(b.x, b.y) > game.pathWidth / 2) {
    startFall({ x: b.x, y: b.y, r: b.r });
  }
}

/* 滾珠軌道約束:找最近軌道點,超出內半寬時 —
   一般路段被軌道彈回(金屬聲);缺口路段偏太多就掉出去 */
function railConstrain(scale, ph) {
  const b = game.ball;
  const pts = game.railPoints;
  if (!pts) return;
  // 視窗化最近點搜尋(軌道蛇行,不能全域找,會跳到相鄰車道)
  const W = 26;
  let i0 = clamp(game.railNear - W, 0, pts.length - 2);
  let i1 = clamp(game.railNear + W, 0, pts.length - 2);
  let best = Infinity, bi = game.railNear, bx = b.x, by = b.y;
  for (let i = i0; i <= i1; i++) {
    const ax = pts[i].x, ay = pts[i].y;
    const dx2 = pts[i + 1].x - ax, dy2 = pts[i + 1].y - ay;
    const L2 = dx2 * dx2 + dy2 * dy2 || 1;
    const tt = clamp(((b.x - ax) * dx2 + (b.y - ay) * dy2) / L2, 0, 1);
    const qx = ax + dx2 * tt, qy = ay + dy2 * tt;
    const d2 = dist2(b.x, b.y, qx, qy);
    if (d2 < best) { best = d2; bi = i; bx = qx; by = qy; }
  }
  game.railNear = bi;
  const d = Math.sqrt(best);
  const half = game.railHalfGap;
  if (d <= half) return;
  const inGap = game.railGapMask[bi] || game.railGapMask[Math.min(bi + 1, pts.length - 1)];
  if (inGap) {
    // 缺口:偏出超過半顆球 → 掉出軌道
    if (d > half + b.r * 0.7) startFall({ x: b.x, y: b.y, r: b.r });
    return;
  }
  // 被軌道擋回(橫向反彈)
  const nx = (b.x - bx) / d, ny = (b.y - by) / d;
  b.x = bx + nx * half;
  b.y = by + ny * half;
  const vn = b.vx * nx + b.vy * ny;
  if (vn > 0) {
    b.vx -= (1 + ph.restitution) * vn * nx;
    b.vy -= (1 + ph.restitution) * vn * ny;
    if (vn > 150 * scale) {
      const s = clamp(vn / (700 * scale), 0, 1);
      sfx.ting(s);
      buzz(Math.round(5 + s * 12));
      spawnSparks(b.x, b.y, 2 + Math.round(s * 3));
    }
  }
}

// 點到棧道折線的最短距離
function distToPath(px, py) {
  const pts = game.pathPoints;
  if (!pts || pts.length < 2) return 0;
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = pts[i].x, ay = pts[i].y;
    const dx = pts[i + 1].x - ax, dy = pts[i + 1].y - ay;
    const L2 = dx * dx + dy * dy || 1;
    const tt = clamp(((px - ax) * dx + (py - ay) * dy) / L2, 0, 1);
    best = Math.min(best, dist2(px, py, ax + dx * tt, ay + dy * tt));
  }
  return Math.sqrt(best);
}

function collideWalls() {
  const b = game.ball;
  const ph = activePhys();
  let hitSpeed = 0, hitNx = 0, hitNy = -1;
  for (const r of game.walls) {
    const cx = clamp(b.x, r.x, r.x + r.w);
    const cy = clamp(b.y, r.y, r.y + r.h);
    const dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= b.r * b.r) continue;
    const d = Math.sqrt(d2) || 0.0001;
    let nx, ny;
    if (d > 0.001) { nx = dx / d; ny = dy / d; }
    else {
      // 球心在牆內:沿較淺的軸推出
      const left = b.x - r.x, right = r.x + r.w - b.x, top = b.y - r.y, bottom = r.y + r.h - b.y;
      const m = Math.min(left, right, top, bottom);
      nx = m === left ? -1 : m === right ? 1 : 0;
      ny = m === top ? -1 : m === bottom ? 1 : 0;
    }
    const push = b.r - d;
    b.x += nx * push;
    b.y += ny * push;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
      if (-vn > hitSpeed) { hitSpeed = -vn; hitNx = nx; hitNy = ny; }
      b.vx -= (1 + ph.restitution) * vn * nx;
      b.vy -= (1 + ph.restitution) * vn * ny;
    }
  }
  const vs = viewSize(); const scale = Math.min(vs.w, vs.h) / 720;
  if (hitSpeed > 220 * scale) {
    const s = clamp(hitSpeed / (900 * scale), 0, 1);
    sfx.thud(s);
    buzz(Math.round(8 + s * 25));
    game.shake = Math.min(6, game.shake + s * 5);
    spawnSparks(b.x, b.y, 3 + Math.round(s * 5));
    // 百香果:撞牆擠壓變形(沿撞擊法線)
    if (ph.squash) game.squash = { t: 0, s, nx: hitNx, ny: hitNy };
  }
}

/* ---------- 遊戲邏輯 ---------- */
function checkPickups() {
  const b = game.ball;
  if (game.stage === 'board') {
    // 老街彈珠台:檢查點必須依序通過(只有下一個可以觸發)
    const s = game.stars[game.starsGot];
    if (s && !s.got && dist2(b.x, b.y, s.x, s.y) < (b.r + game.cellSize * 0.26) ** 2) {
      s.got = true;
      game.starsGot++;
      sfx.star();
      buzz([15, 30, 15]);
      spawnBurst(s.x, s.y, '#ffd66e', 16);
      updateHUD();
      if (game.starsGot < 3) toast(`通過 ${'①②③'[game.starsGot - 1]}!下一個:${'①②③'[game.starsGot]}`);
      else toast('全部通過!前往終點!');
    }
  } else {
    game.stars.forEach((s, si) => {
      if (!s.got && dist2(b.x, b.y, s.x, s.y) < (b.r + game.cellSize * 0.2) ** 2) {
        s.got = true;
        game.starsGot++;
        sfx.star();
        buzz([15, 30, 15]);
        spawnBurst(s.x, s.y, '#ffd66e', 16);
        // 滾珠軌道:通過檢查點後,掉落改從這裡重生
        if (game.stage === 'rail' && game.railStarIdx) {
          game.railRespawnIdx = Math.max(game.railRespawnIdx, game.railStarIdx[si]);
          toast(`檢查點!掉落會從這裡繼續`);
        }
        updateHUD();
      }
    });
  }
  // 掉洞判定:彈珠台洞多,判定放寬一點(0.66)比較公平
  const killF = game.stage === 'board' ? 0.66 : 0.75;
  for (const hole of game.holes) {
    if (dist2(b.x, b.y, hole.x, hole.y) < (hole.r * killF) ** 2) {
      startFall(hole);
      return;
    }
  }
  if (dist2(b.x, b.y, game.goal.x, game.goal.y) < (game.goal.r * 0.8) ** 2) {
    // 彈珠台:沒依序通過 ①②③ 前終點不開
    if (game.stage === 'board' && game.starsGot < 3) {
      if (game.time - game.goalHintT > 2) {
        game.goalHintT = game.time;
        toast(`終點未開!先通過 ${'①②③'[game.starsGot]}`);
      }
      return;
    }
    levelClear();
  }
}

function startFall(hole) {
  game.state = 'falling';
  game.fallAnim = 0;
  game.fallHole = hole;
  game.falls++;
  sfx.fall();
  buzz([60, 40, 80]);
}

function levelClear() {
  game.state = 'clear';
  sfx.goal();
  buzz([30, 50, 30, 50, 60]);
  spawnBurst(game.goal.x, game.goal.y, theme().style ? theme().style.burst : '#4de8ff', 30);

  // 星等:迷宮 = 收集數;彈珠台/獨木橋 = 依摔落次數(0 次滿星)
  const rating = game.stage === 'maze' ? game.starsGot : 3 - clamp(game.falls, 0, 2);
  if (game.mode === 'daily') {
    const info = dailyInfo();
    const ds = store.get('dailyStars', {});
    ds[info.ymd] = Math.max(typeof ds[info.ymd] === 'number' ? ds[info.ymd] : -1, rating);
    store.set('dailyStars', ds);
  } else {
    saveStars(game.series, game.levelIndex, rating);
  }

  const timeBonus = Math.max(0, 120 - Math.floor(game.time)) * 5;
  const starBonus = rating * 200;
  const noFall = game.falls === 0 ? 150 : 0;
  const levelScore = 300 + game.diff * 50 + timeBonus + starBonus + noFall;
  game.totalScore += levelScore;
  game.bestScore = Math.max(game.bestScore, game.totalScore);
  store.set('totalScore', game.totalScore);
  store.set('bestScore', game.bestScore);
  syncLeaderboard();
  checkAchievements();

  const s = seriesById(game.series);
  const isLast = game.mode !== 'daily' && game.levelIndex >= SERIES_LEN;
  document.getElementById('clear-title').textContent =
    game.mode === 'daily' ? `📅 今日${theme().fruit || ''}關卡完成!`
    : isLast ? `🏆 ${s.name} 全破!` : theme().clearTitle;
  const starsEl = document.getElementById('clear-stars');
  starsEl.innerHTML = [0, 1, 2].map(i =>
    `<span class="${i < rating ? '' : 'off'}">${theme().icon}</span>`).join('');
  document.getElementById('clear-time').textContent = fmtTime(game.time);
  document.getElementById('clear-score').textContent = '+' + levelScore;
  document.getElementById('clear-total').textContent = game.totalScore;
  const btnNext = document.getElementById('btn-next');
  btnNext.textContent = game.mode === 'daily' ? '返回選單'
    : isLast ? '返回系列選單' : `下一關(${game.levelIndex + 1}/${SERIES_LEN})➜`;
  setTimeout(() => show('screen-clear'), 650);
}

/* ---------- 粒子 ---------- */
function spawnSparks(x, y, n) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 140;
    const c = theme().style ? theme().style.spark : '#9fd8ff';
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, t: 0, c, r: 1.5 });
  }
}
function spawnBurst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, sp = 60 + Math.random() * 200;
    game.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.8, t: 0, c: color, r: 2.5 });
  }
}
function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.t += dt;
    if (p.t >= p.life) { game.particles.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.96; p.vy *= 0.96;
  }
}

/* ---------- 渲染 ---------- */
const trail = [];
let time0 = 0;

function draw(now) {
  const { w, h } = viewSize();
  const t = now / 1000;
  const tilt = getTilt();

  ctx.clearRect(0, 0, w, h);
  const style = theme().style;

  if (style) {
    // 果園夜色背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, style.bg[0]);
    bg.addColorStop(1, style.bg[1]);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // 視差飄葉
    for (const s of starfield) {
      const px = s.x * w - tilt.x * 30 * s.z;
      const py = ((s.y * h + t * 10 * s.z) % (h + 40)) - 20 - tilt.y * 20 * s.z;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(s.tw + t * 0.4 * s.z);
      ctx.fillStyle = `rgba(${style.leaf}, ${0.12 + 0.22 * s.z})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, s.r * 3.2, s.r * 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // 深空背景
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#070a1c');
    bg.addColorStop(1, '#04050d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // 視差星空(依傾斜移動 → 沉浸感)
    for (const s of starfield) {
      const px = s.x * w - tilt.x * 30 * s.z;
      const py = s.y * h - tilt.y * 30 * s.z;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.2 + s.tw));
      ctx.fillStyle = `rgba(200, 220, 255, ${alpha * s.z})`;
      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (!game.floorLayer) return;   // 尚未建立任何關卡(彈珠台/獨木橋沒有 maze,不能用 maze 判斷)

  // 畫面震動
  let sx = 0, sy = 0;
  if (game.shake > 0.1) {
    sx = (Math.random() - 0.5) * game.shake;
    sy = (Math.random() - 0.5) * game.shake;
    game.shake *= 0.86;
  }
  ctx.save();
  ctx.translate(sx, sy);

  // 地板 + 牆的立體陰影(依傾斜偏移 → 偽 3D)
  ctx.drawImage(game.floorLayer, 0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.filter = 'brightness(0.25) blur(2px)';
  ctx.drawImage(game.mazeLayer, tilt.x * 5, 4 + tilt.y * 5, w, h);
  ctx.filter = 'none';
  ctx.restore();

  // 陷阱:水果=果皮蟲蛀洞;星雲=黑洞(彈珠台的坑洞已烘焙進地板,跳過)
  for (const hole of (game.stage === 'board' ? [] : game.holes)) {
    const pulse = 1 + 0.06 * Math.sin(t * 3 + hole.x);
    if (style) {
      const g = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hole.r * 1.4);
      g.addColorStop(0, '#0c0402');
      g.addColorStop(0.55, '#1e0c04');
      g.addColorStop(0.82, `rgba(${style.holeRim}, 0.85)`);
      g.addColorStop(1, `rgba(${style.holeRim}, 0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r * 1.4, 0, Math.PI * 2);
      ctx.fill();
      // 咬痕碎屑
      ctx.fillStyle = style.crumb;
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + hole.x;
        ctx.beginPath();
        ctx.arc(hole.x + Math.cos(a) * hole.r * 1.05, hole.y + Math.sin(a) * hole.r * 1.05, hole.r * 0.12, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      const g = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, hole.r * 1.5 * pulse);
      g.addColorStop(0, '#000');
      g.addColorStop(0.55, '#0a0418');
      g.addColorStop(0.8, 'rgba(140, 60, 255, 0.5)');
      g.addColorStop(1, 'rgba(140, 60, 255, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r * 1.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // 吸積環
      ctx.strokeStyle = `rgba(190, 130, 255, ${0.5 + 0.3 * Math.sin(t * 4 + hole.y)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y, hole.r * pulse, t % (Math.PI * 2), (t % (Math.PI * 2)) + Math.PI * 1.4);
      ctx.stroke();
    }
  }

  // 收集物:彈珠台=編號檢查點;水果=花朵;星雲=星星
  if (game.stage === 'board') {
    game.stars.forEach((s, i) => {
      const done = s.got;
      const next = !done && i === game.starsGot;
      const R = game.cellSize * (next ? 0.3 + 0.03 * Math.sin(t * 5) : 0.25);
      if (next) {
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * 2.2);
        glow.addColorStop(0, 'rgba(255, 210, 62, 0.5)');
        glow.addColorStop(1, 'rgba(255, 210, 62, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, R * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = done ? 'rgba(90, 200, 120, 0.9)' : (next ? '#ffd23e' : 'rgba(210, 210, 220, 0.35)');
      ctx.beginPath();
      ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = done ? '#1c5c30' : 'rgba(60, 40, 5, 0.8)';
      ctx.lineWidth = Math.max(1.5, R * 0.12);
      ctx.stroke();
      ctx.fillStyle = done ? '#0c3316' : '#3a2405';
      ctx.font = `bold ${Math.round(R * 1.15)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(done ? '✓' : String(i + 1), s.x, s.y + R * 0.05);
    });
  } else if (game.stage === 'rail') {
    // 滾珠軌道:金色軸承檢查點
    for (const s of game.stars) {
      if (s.got) continue;
      const pulse = 1 + 0.12 * Math.sin(t * 4 + s.x);
      const R = game.cellSize * 0.15 * pulse;
      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, R * 2.6);
      glow.addColorStop(0, 'rgba(255, 214, 110, 0.5)');
      glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(s.x, s.y, R * 2.6, 0, Math.PI * 2); ctx.fill();
      const body = ctx.createRadialGradient(s.x - R * 0.35, s.y - R * 0.35, R * 0.1, s.x, s.y, R);
      body.addColorStop(0, '#fff3c4');
      body.addColorStop(0.5, '#ffd23e');
      body.addColorStop(1, '#b8860b');
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(s.x, s.y, R, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    for (const s of game.stars) {
      if (s.got) continue;
      const pulse = 1 + 0.15 * Math.sin(t * 4 + s.x);
      if (style) drawFlower(s.x, s.y, game.cellSize * 0.16 * pulse, t, style.flower);
      else drawStar(s.x, s.y, game.cellSize * 0.17 * pulse, t);
    }
  }

  // 終點:滾珠=銅杯;水果=果汁漩渦;星雲=傳送門
  {
    const g = game.goal;
    const pulse = 1 + 0.1 * Math.sin(t * 2.5);
    if (game.stage === 'rail') {
      const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 1.7 * pulse);
      glow.addColorStop(0, 'rgba(255, 214, 110, 0.55)');
      glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 1.7 * pulse, 0, Math.PI * 2); ctx.fill();
      // 杯身
      ctx.fillStyle = '#241203';
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.95, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = Math.max(3, g.r * 0.28);
      ctx.strokeStyle = '#c9992e';
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 0.95, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = Math.max(1.5, g.r * 0.1);
      ctx.strokeStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r * 1.06, 0, Math.PI * 2); ctx.stroke();
      // 旋轉光點
      const a = t * 2.2;
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(a) * g.r * 0.95, g.y + Math.sin(a) * g.r * 0.95, Math.max(1.5, g.r * 0.1), 0, Math.PI * 2);
      ctx.fill();
    } else if (style) {
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 1.6 * pulse);
      grad.addColorStop(0, style.goal[0]);
      grad.addColorStop(0.35, style.goal[1]);
      grad.addColorStop(0.7, `rgba(${style.goal[2]}, 0.55)`);
      grad.addColorStop(1, `rgba(${style.goal[2]}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * 1.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // 旋轉的果汁紋
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = `rgba(${style.swirl}, ${0.55 - k * 0.15})`;
        ctx.lineWidth = Math.max(1.5, g.r * 0.1) - k * 0.4;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r * (0.35 + k * 0.3) * pulse, t * (1.2 + k * 0.4), t * (1.2 + k * 0.4) + Math.PI * 1.3);
        ctx.stroke();
      }
    } else {
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r * 1.6 * pulse);
      grad.addColorStop(0, 'rgba(77, 232, 255, 0.9)');
      grad.addColorStop(0.4, 'rgba(110, 100, 255, 0.5)');
      grad.addColorStop(1, 'rgba(110, 100, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r * 1.6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      for (let k = 0; k < 2; k++) {
        ctx.strokeStyle = `rgba(160, 220, 255, ${0.8 - k * 0.35})`;
        ctx.lineWidth = 2 - k * 0.5;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r * (0.75 + k * 0.35) * pulse, -t * (1.5 + k), -t * (1.5 + k) + Math.PI * 1.5);
        ctx.stroke();
      }
    }
  }

  // 拖尾:鋼珠=銀灰;水果=淡淡的滾痕;星雲=發光拖尾
  const trailRGB = game.stage === 'rail' ? '208, 218, 228' : (style ? style.trail : '120, 210, 255');
  const trailA = game.stage === 'rail' ? 0.2 : (style ? 0.18 : 0.35);
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const a = (i / trail.length) * trailA;
    ctx.fillStyle = `rgba(${trailRGB}, ${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, game.ball.r * (0.3 + 0.6 * (i / trail.length)), 0, Math.PI * 2);
    ctx.fill();
  }

  // 光球
  if (game.state !== 'falling') {
    drawBall(game.ball.x, game.ball.y, game.ball.r);
  } else {
    // 掉入黑洞:縮小旋入
    const k = clamp(game.fallAnim / 0.7, 0, 1);
    const hx = lerp(game.ball.x, game.fallHole.x, k);
    const hy = lerp(game.ball.y, game.fallHole.y, k);
    drawBall(hx, hy, game.ball.r * (1 - k));
  }

  // 牆(最上層,球看起來在通道「裡面」)
  ctx.drawImage(game.mazeLayer, 0, 0, w, h);

  // 粒子
  for (const p of game.particles) {
    const a = 1 - p.t / p.life;
    ctx.fillStyle = p.c;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * a + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  // 暈影
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, style ? style.vignette : 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// 百香果果皮斑點(固定局部座標,隨滾動旋轉)
const SPECKLES = [];
for (let i = 0; i < 14; i++) {
  SPECKLES.push({ a: Math.random() * Math.PI * 2, d: 0.15 + Math.random() * 0.72, s: 0.05 + Math.random() * 0.08 });
}

function drawBall(x, y, r) {
  if (r <= 0.5) return;
  if (game.stage === 'rail') { drawSteelBall(x, y, r); return; }
  const style = theme().style;
  if (style) {
    const drawers = {
      passion: drawPassionBall,
      apple: drawAppleBall,
      pineapple: drawPineappleBall,
      waxapple: drawWaxappleBall,
      watermelon: drawWatermelonBall,
      persimmon: drawPersimmonBall,
      strawberry: drawStrawberryBall,
    };
    (drawers[style.ball] || drawPassionBall)(x, y, r);
    return;
  }
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.6);
  glow.addColorStop(0, 'rgba(140, 235, 255, 0.55)');
  glow.addColorStop(1, 'rgba(140, 235, 255, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.6, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.4, '#8ef0ff');
  body.addColorStop(1, '#1b6cff');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// 撞牆擠壓變形(沿撞擊法線;amount 控制軟硬)
function applySquash(amount) {
  if (game.squash && game.squash.t < 0.18) {
    const k = amount * game.squash.s * Math.sin((game.squash.t / 0.18) * Math.PI);
    const ang = Math.atan2(game.squash.ny, game.squash.nx);
    ctx.rotate(ang);
    ctx.scale(1 - k, 1 + k * 0.7);
    ctx.rotate(-ang);
  }
}

// 共用:水果落影
function fruitShadow(r) {
  ctx.fillStyle = 'rgba(22, 8, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.42, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
}

// 蓮霧:粉紅蠟質鐘形果(超亮蠟光 + 白色直紋)
function drawWaxappleBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  applySquash(0.25);
  fruitShadow(r);
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r);
  body.addColorStop(0, '#ffc7d0');
  body.addColorStop(0.5, '#e26370');
  body.addColorStop(1, '#a12c3e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 蠟質直紋 + 蒂頭(隨滾動旋轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.strokeStyle = 'rgba(255, 235, 240, 0.3)';
  ctx.lineWidth = Math.max(1, r * 0.1);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.55, a - 0.6, a + 0.6);
    ctx.stroke();
  }
  ctx.fillStyle = '#7c9a3e';
  ctx.beginPath(); ctx.arc(0, -r * 0.85, r * 0.13, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 超亮蠟光
  ctx.fillStyle = 'rgba(255, 250, 252, 0.65)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.34, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 西瓜:綠皮深綠條紋(隨滾動旋轉)
function drawWatermelonBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  fruitShadow(r);
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r);
  body.addColorStop(0, '#7ed184');
  body.addColorStop(0.55, '#2f8a3d');
  body.addColorStop(1, '#175c24');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 深綠波浪條紋
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(16, 62, 24, 0.75)';
  ctx.lineWidth = Math.max(2, r * 0.2);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * r * 0.55 - r * 0.12, -r);
    ctx.quadraticCurveTo(i * r * 0.55 + r * 0.18, 0, i * r * 0.55 - r * 0.12, r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(240, 255, 240, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 柿子:熟軟橙紅果(大變形 + 頂端綠色果萼)
function drawPersimmonBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  applySquash(0.5);   // 軟柿子:變形特別大
  fruitShadow(r);
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.12, 0, 0, r);
  body.addColorStop(0, '#ffb054');
  body.addColorStop(0.5, '#ed7d1e');
  body.addColorStop(1, '#b0500e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 果瓣淡紋 + 果萼(十字綠葉,隨滾動旋轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.strokeStyle = 'rgba(160, 80, 15, 0.3)';
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, r * 0.5, a - 0.5, a + 0.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#5d8a34';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i / 4) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.78, r * 0.1, r * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#4a6e28';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.09, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 熟軟果:柔霧光(不亮)
  ctx.fillStyle = 'rgba(255, 230, 200, 0.3)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 草莓:紅果 + 金色籽點 + 綠色蒂葉冠(隨滾動旋轉)
function drawStrawberryBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  fruitShadow(r);
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.12, 0, 0, r);
  body.addColorStop(0, '#ff8f9e');
  body.addColorStop(0.5, '#e0304a');
  body.addColorStop(1, '#951227');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 金色籽點 + 蒂葉冠(隨滾動旋轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.fillStyle = 'rgba(255, 224, 130, 0.9)';
  for (const sp of SPECKLES) {
    ctx.beginPath();
    ctx.ellipse(Math.cos(sp.a) * sp.d * r, Math.sin(sp.a) * sp.d * r, sp.s * r * 0.7, sp.s * r * 1.05, sp.a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#5d8a34';
  for (let i = -2; i <= 2; i++) {
    ctx.save();
    ctx.rotate(i * 0.38);
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, -r * 0.72);
    ctx.lineTo(0, -r * 1.12);
    ctx.lineTo(r * 0.1, -r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(255, 240, 244, 0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 鋼珠(鉻銀金屬球)
function drawSteelBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  // 落影
  ctx.fillStyle = 'rgba(20, 10, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(r * 0.1, r * 0.4, r * 0.95, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  // 球體(鉻)
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  body.addColorStop(0, '#ffffff');
  body.addColorStop(0.35, '#dfe5ec');
  body.addColorStop(0.7, '#9aa4b0');
  body.addColorStop(1, '#5a636e');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 環境反射(木箱暖色映在下半)
  ctx.fillStyle = 'rgba(150, 105, 50, 0.28)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.45, r * 0.62, r * 0.3, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 強高光
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.4, r * 0.22, r * 0.13, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPassionBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  // 撞牆擠壓變形(沿撞擊法線壓扁)
  if (game.squash && game.squash.t < 0.18) {
    const k = 0.32 * game.squash.s * Math.sin((game.squash.t / 0.18) * Math.PI);
    const ang = Math.atan2(game.squash.ny, game.squash.nx);
    ctx.rotate(ang);
    ctx.scale(1 - k, 1 + k * 0.7);
    ctx.rotate(-ang);
  }
  // 柔和落影(水果不發光,靠影子表現立體)
  ctx.fillStyle = 'rgba(25, 8, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.42, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // 果體
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
  body.addColorStop(0, '#a34866');
  body.addColorStop(0.45, '#6d1f42');
  body.addColorStop(1, '#3c0e24');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 果皮斑點 + 蒂頭(隨滾動旋轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.fillStyle = 'rgba(225, 165, 135, 0.3)';
  for (const sp of SPECKLES) {
    ctx.beginPath();
    ctx.arc(Math.cos(sp.a) * sp.d * r, Math.sin(sp.a) * sp.d * r, sp.s * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#7c9a3e';
  ctx.beginPath();
  ctx.arc(0, -r * 0.82, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 蠟質高光(固定光源方向,不隨旋轉)
  ctx.fillStyle = 'rgba(255, 235, 220, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.3, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 蘋果:紅果皮 + 蒂頭與葉子(隨滾動旋轉)
function drawAppleBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20, 8, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.42, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r);
  body.addColorStop(0, '#ff8a70');
  body.addColorStop(0.45, '#d92f2f');
  body.addColorStop(1, '#8e1420');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 淡色直紋 + 蒂頭與葉子(隨滾動旋轉,看得出在轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.strokeStyle = 'rgba(255, 200, 160, 0.22)';
  ctx.lineWidth = Math.max(1, r * 0.09);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25, r * 0.62, a - 0.5, a + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = '#6b4713';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.7);
  ctx.lineTo(0, -r * 1.05);
  ctx.stroke();
  ctx.fillStyle = '#6fae3d';
  ctx.beginPath();
  ctx.ellipse(r * 0.22, -r * 0.95, r * 0.26, r * 0.13, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 高光(固定光源)
  ctx.fillStyle = 'rgba(255, 240, 230, 0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.3, r * 0.17, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 鳳梨:金褐色菱格果皮 + 綠色葉冠(隨滾動旋轉)
function drawPineappleBall(x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(20, 12, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(r * 0.12, r * 0.42, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  const body = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.15, 0, 0, r);
  body.addColorStop(0, '#f2b53a');
  body.addColorStop(0.55, '#c98a20');
  body.addColorStop(1, '#8a5d1d');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  // 菱格紋 + 葉冠(隨滾動旋轉)
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.98, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = 'rgba(110, 70, 15, 0.5)';
  ctx.lineWidth = Math.max(1, r * 0.07);
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(-r + i * r * 0.55, -r);
    ctx.lineTo(r + i * r * 0.55, r);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(r + i * r * 0.55, -r);
    ctx.lineTo(-r + i * r * 0.55, r);
    ctx.stroke();
  }
  ctx.restore();
  ctx.save();
  ctx.rotate(game.ballRot);
  ctx.fillStyle = '#4f7d2a';
  for (let i = -1; i <= 1; i++) {
    ctx.save();
    ctx.rotate(i * 0.45);
    ctx.beginPath();
    ctx.moveTo(-r * 0.12, -r * 0.72);
    ctx.lineTo(0, -r * 1.35);
    ctx.lineTo(r * 0.12, -r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // 高光(固定光源)
  ctx.fillStyle = 'rgba(255, 240, 200, 0.4)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.42, r * 0.28, r * 0.15, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 花朵收集物(顏色依主題:百香果花 / 蘋果花 / 鳳梨花)
function drawFlower(x, y, r, t, colors) {
  const c = colors || { petal: 'rgba(250, 246, 255, 0.95)', fringe: '#7b3fa0', center: '#ffd23e' };
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.5 + x) * 0.12);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
  glow.addColorStop(0, 'rgba(255, 250, 235, 0.35)');
  glow.addColorStop(1, 'rgba(255, 250, 235, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.petal;
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate((i / 6) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(r * 1.05, 0, r * 1.0, r * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = c.fringe;
  ctx.lineWidth = Math.max(1, r * 0.12);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + t * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95);
    ctx.stroke();
  }
  ctx.fillStyle = c.center;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStar(x, y, r, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(t * 0.8);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 3);
  glow.addColorStop(0, 'rgba(255, 214, 110, 0.5)');
  glow.addColorStop(1, 'rgba(255, 214, 110, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd66e';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
    const a2 = a1 + Math.PI / 5;
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
    ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/* ---------- 主迴圈 ---------- */
let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (!lastT) { lastT = now; return; }
  const dt = clamp((now - lastT) / 1000, 0, 0.05);
  lastT = now;

  if (game.squash) {
    game.squash.t += dt;
    if (game.squash.t > 0.2) game.squash = null;
  }
  if (game.state === 'play') {
    game.time += dt;
    physicsStep(dt);
    checkPickups();
    trail.push({ x: game.ball.x, y: game.ball.y });
    if (trail.length > 14) trail.shift();
    if ((game.time * 10 | 0) !== ((game.time - dt) * 10 | 0)) updateHUD();
  } else if (game.state === 'falling') {
    game.fallAnim += dt;
    if (game.fallAnim >= 0.9) {
      resetBall();
      trail.length = 0;
      toast(game.stage === 'path' ? '從棧道上摔下去了!從起點重來'
        : game.stage === 'rail' ? '鋼珠掉出軌道!從檢查點繼續'
        : theme().fallToast);
      game.state = 'play';
    }
  }
  updateParticles(dt);
  draw(now);
}

/* ---------- UI ---------- */
const $ = id => document.getElementById(id);
function show(id) { $(id).classList.remove('hidden'); }
function hide(id) { $(id).classList.add('hidden'); }

let toastTimer = 0;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
}

function fmtTime(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function updateHUD() {
  const s = seriesById(game.series);
  $('hud-level').textContent = game.mode === 'daily'
    ? `📅 ${theme().fruit || '每日'}`
    : `${s.icon} ${game.levelIndex}/${SERIES_LEN}`;
  $('hud-stars').textContent = game.stage === 'board' ? `◎ ${game.starsGot}/3`
    : game.stage === 'rail' ? `◉ ${game.starsGot}/3`
    : `${theme().icon} ${game.starsGot}/3`;
  $('hud-time').textContent = fmtTime(game.time);
}

async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* iOS Safari 分頁模式不支援,靠 PWA 安裝達成全螢幕 */ }
  try {
    if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('portrait');
  } catch { /* 桌面或不支援時忽略 */ }
}

function startGame() {
  sfx.unlock();
  requestSensor();
  enterFullscreen();
  hide('screen-start');
  // 觸控裝置:先請玩家把手機平放校準,再進選單
  if ('ontouchstart' in window && typeof DeviceOrientationEvent !== 'undefined') {
    openLevelCalibration('start');
  } else {
    showSeries();
  }
}

/* ---------- 排行榜 & 成就 ---------- */
function playerName() {
  if (!settings.playerName) {
    settings.playerName = '玩家' + Math.floor(1000 + Math.random() * 9000);
    store.set('playerName', settings.playerName);
  }
  return settings.playerName;
}

function playerProfile() {
  let clears = 0;
  for (const s of SERIES) clears += clearedCount(s.id);
  return {
    name: playerName(),
    totalScore: game.totalScore,
    totalStars: totalStarsAll(),
    clears,
  };
}

// 上傳成績(未設定 Firebase 或離線時靜默略過)
function syncLeaderboard() {
  if (window.LB && window.LB.available()) window.LB.submit(playerProfile());
}

// 成就(由本機進度即時計算,不需伺服器)
function anyRating(n) {
  for (const s of SERIES) {
    for (let i = 1; i <= SERIES_LEN; i++) if (starsOf(s.id, i) >= n) return true;
  }
  return false;
}
const ACHIEVEMENTS = [
  { icon: '🎉', name: '初次過關', desc: '完成任何一個關卡', test: () => SERIES.some(s => clearedCount(s.id) > 0) },
  { icon: '⭐', name: '完美三星', desc: '任一關卡拿到 3 星', test: () => anyRating(3) },
  { icon: '🥭', name: '百香果達人', desc: '百香果果園 10 關全破', test: () => clearedCount('passion') >= SERIES_LEN },
  { icon: '🎯', name: '老街彈珠王', desc: '老街彈珠台 10 關全破', test: () => clearedCount('board') >= SERIES_LEN },
  { icon: '🍎', name: '蘋果獵人', desc: '蘋果果園 10 關全破', test: () => clearedCount('apple') >= SERIES_LEN },
  { icon: '🌉', name: '走索人', desc: '高空獨木橋 10 關全破', test: () => clearedCount('bridge') >= SERIES_LEN },
  { icon: '🍍', name: '鳳梨田霸主', desc: '鳳梨田 10 關全破', test: () => clearedCount('pine') >= SERIES_LEN },
  { icon: '🌌', name: '星際旅人', desc: '星雲迷宮 10 關全破', test: () => clearedCount('nebula') >= SERIES_LEN },
  { icon: '✨', name: '摘星者', desc: '總星數達 30', test: () => totalStarsAll() >= 30 },
  { icon: '🌠', name: '星海霸主', desc: '總星數達 120', test: () => totalStarsAll() >= 120 },
  { icon: '💰', name: '分數大戶', desc: '累計總分達 20000', test: () => game.totalScore >= 20000 },
  { icon: '👑', name: '全滿貫', desc: '所有系列全部通關', test: () => SERIES.every(s => clearedCount(s.id) >= SERIES_LEN) },
  // 新成就一律往後加(achSeen 以索引記錄,插中間會錯位)
  { icon: '🎢', name: '滾珠職人', desc: '滾珠珠機台 10 關全破', test: () => clearedCount('rail') >= SERIES_LEN },
  { icon: '🔔', name: '蓮霧輕功', desc: '蓮霧樹下 10 關全破', test: () => clearedCount('waxapple') >= SERIES_LEN },
  { icon: '🍉', name: '西瓜衝衝衝', desc: '西瓜田 10 關全破', test: () => clearedCount('watermelon') >= SERIES_LEN },
  { icon: '🟠', name: '柿柿如意', desc: '柿子園 10 關全破', test: () => clearedCount('persimmon') >= SERIES_LEN },
  { icon: '🍓', name: '草莓甜心', desc: '草莓園 10 關全破', test: () => clearedCount('strawberry') >= SERIES_LEN },
  { icon: '📅', name: '每日報到', desc: '完成 1 次每日時令關卡', test: () => Object.keys(store.get('dailyStars', {})).length >= 1 },
  { icon: '🗓️', name: '時令達人', desc: '完成 10 次每日時令關卡', test: () => Object.keys(store.get('dailyStars', {})).length >= 10 },
];
function unlockedAchievements() { return ACHIEVEMENTS.filter(a => a.test()); }

// 過關後檢查是否有新成就解鎖(彈提示)
function checkAchievements() {
  const seen = store.get('achSeen', []);
  const newly = [];
  ACHIEVEMENTS.forEach((a, i) => {
    if (!seen.includes(i) && a.test()) { seen.push(i); newly.push(a); }
  });
  if (newly.length) {
    store.set('achSeen', seen);
    setTimeout(() => toast(`🏅 成就解鎖:${newly.map(a => a.icon + a.name).join('、')}`), 1400);
  }
}

/* ---------- 排行榜畫面 ---------- */
let rankFrom = 'start';
function openRank(from) {
  rankFrom = from;
  hide('screen-start'); hide('screen-series');
  switchRankTab('world');
  renderMyTab();
  loadWorldTab();
  show('screen-rank');
}
function closeRank() {
  hide('screen-rank');
  if (rankFrom === 'series') show('screen-series');
  else show('screen-start');
}
function switchRankTab(tab) {
  $('tab-world').classList.toggle('active', tab === 'world');
  $('tab-me').classList.toggle('active', tab === 'me');
  $('rank-world').classList.toggle('hidden', tab !== 'world');
  $('rank-me').classList.toggle('hidden', tab !== 'me');
}
async function loadWorldTab() {
  const list = $('rank-list');
  if (!window.LB || !window.LB.available()) {
    list.innerHTML = '<div class="rank-empty">☁️ 尚未設定 Firebase,世界排行榜停用中。<br>你的進度與成就都保存在本機,<br>請看「我的成就」分頁。</div>';
    return;
  }
  list.innerHTML = '<div class="rank-empty">載入中…</div>';
  syncLeaderboard();  // 順便上傳自己的最新成績
  const rows = await window.LB.top(50);
  if (!rows) {
    list.innerHTML = `<div class="rank-empty">載入失敗:${window.LB.error() || '請檢查網路'}</div>`;
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<div class="rank-empty">還沒有任何紀錄,快去搶頭香!</div>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  const myUid = window.LB.uid();
  list.innerHTML = rows.map((r, i) => `
    <div class="rank-row${r.uid === myUid ? ' me' : ''}">
      <span class="r-rank">${medals[i] || (i + 1)}</span>
      <span class="r-name">${String(r.name || '玩家').slice(0, 12).replace(/[<>&]/g, '')}</span>
      <span class="r-stars">★${r.totalStars || 0}</span>
      <span class="r-score">${r.totalScore || 0}</span>
    </div>`).join('');
}
function renderMyTab() {
  const p = playerProfile();
  const unlocked = unlockedAchievements();
  $('me-stats').innerHTML = `
    <div class="me-name">${p.name} <button class="name-edit" id="btn-edit-name">✏️</button></div>
    <div class="me-grid">
      <div><b>${p.totalScore}</b><span>總分</span></div>
      <div><b>★${p.totalStars}</b><span>總星數</span></div>
      <div><b>${p.clears}</b><span>通關數</span></div>
      <div><b>${unlocked.length}/${ACHIEVEMENTS.length}</b><span>成就</span></div>
    </div>`;
  $('ach-list').innerHTML = ACHIEVEMENTS.map(a => {
    const ok = a.test();
    return `<div class="ach-row${ok ? '' : ' locked'}">
      <span class="a-icon">${ok ? a.icon : '🔒'}</span>
      <span class="a-info"><span class="a-name">${a.name}</span><span class="a-desc">${a.desc}</span></span>
      ${ok ? '<span class="a-ok">✓</span>' : ''}
    </div>`;
  }).join('');
  const editBtn = document.getElementById('btn-edit-name');
  if (editBtn) editBtn.onclick = () => {
    const n = prompt('輸入你的暱稱(最多 12 字):', playerName());
    if (n && n.trim()) {
      settings.playerName = n.trim().slice(0, 12);
      store.set('playerName', settings.playerName);
      renderMyTab();
      syncLeaderboard();
      toast('暱稱已更新');
    }
  };
}

/* ---------- 系列 / 關卡選單 ---------- */
function totalStarsAll() {
  let n = 0;
  for (const s of SERIES) for (let i = 1; i <= SERIES_LEN; i++) n += Math.max(0, starsOf(s.id, i));
  return n;
}

function showSeries() {
  game.state = 'menu';
  hide('hud'); hide('screen-clear'); hide('screen-levels');
  const list = $('series-list');
  list.innerHTML = '';
  // 每日時令關卡卡片(置頂)
  {
    const info = dailyInfo();
    const th = THEMES[info.themeId] || THEMES.passion;
    const fs = SERIES.find(x => x.theme === info.themeId && x.stage === 'maze') || SERIES[0];
    const ds = dailyDoneStars(info.ymd);
    const stageName = { maze: '迷宮', board: '彈珠台', path: '獨木橋' }[info.stage];
    const btn = document.createElement('button');
    btn.className = 'series-card daily';
    btn.innerHTML = `
      <span class="s-icon">📅</span>
      <span class="s-info">
        <span class="s-name">每日時令關卡${ds >= 0 ? ' ✅' : ''}</span>
        <span class="s-desc">今日推廣:${fs.icon} ${th.fruit}(${th.season}季水果.${stageName})</span>
      </span>
      <span class="s-prog">${ds >= 0 ? '★'.repeat(Math.max(1, ds)) : 'GO!'}</span>`;
    btn.addEventListener('click', () => { sfx.click(); enterDailyLevel(); });
    list.appendChild(btn);
  }
  for (const s of SERIES) {
    const cleared = clearedCount(s.id);
    let starSum = 0;
    for (let i = 1; i <= SERIES_LEN; i++) starSum += Math.max(0, starsOf(s.id, i));
    const btn = document.createElement('button');
    btn.className = 'series-card' + (cleared >= SERIES_LEN ? ' done' : '');
    btn.innerHTML = `
      <span class="s-icon">${s.icon}</span>
      <span class="s-info">
        <span class="s-name">${s.name}${cleared >= SERIES_LEN ? ' 🏆' : ''}</span>
        <span class="s-desc">${s.desc}</span>
        <span class="s-bar"><span class="s-bar-fill" style="width:${cleared * 10}%"></span></span>
      </span>
      <span class="s-prog">${cleared}/${SERIES_LEN}<br><small>★${starSum}</small></span>`;
    btn.addEventListener('click', () => { sfx.click(); showLevels(s.id); });
    list.appendChild(btn);
  }
  $('series-total').textContent = `總星數 ★${totalStarsAll()} / ${SERIES.length * SERIES_LEN * 3} · 總分 ${game.totalScore}`;
  show('screen-series');
}

function showLevels(id) {
  const s = seriesById(id);
  game.series = id;
  store.set('series', id);
  $('levels-title').textContent = `${s.icon} ${s.name}`;
  const grid = $('level-grid');
  grid.innerHTML = '';
  const unlocked = unlockedIndex(id);
  for (let i = 1; i <= SERIES_LEN; i++) {
    const st = starsOf(id, i);
    const btn = document.createElement('button');
    const locked = i > unlocked;
    btn.className = 'level-cell' + (st >= 0 ? ' cleared' : '') + (i === unlocked ? ' current' : '') + (locked ? ' locked' : '');
    btn.disabled = locked;
    btn.innerHTML = locked
      ? '🔒'
      : `<span class="lv-num">${i}</span><span class="lv-stars">${st >= 0 ? '★'.repeat(Math.max(1, st)) : ''}</span>`;
    if (!locked) btn.addEventListener('click', () => { sfx.click(); enterLevel(id, i); });
    grid.appendChild(btn);
  }
  hide('screen-series');
  show('screen-levels');
}

function enterLevel(id, index) {
  const s = seriesById(id);
  game.series = id;
  settings.theme = s.theme;          // 主題由系列決定
  applyThemeClass();
  hide('screen-levels'); hide('screen-series'); hide('screen-clear');
  show('hud');
  buildLevel(index);
  game.state = 'play';
  lastT = 0;
}

function updateBestLine() {
  const el = $('best-line');
  const stars = totalStarsAll();
  if (stars > 0 || game.bestScore > 0) {
    el.textContent = `總星數 ★${stars} · 最高總分 ${game.bestScore}`;
    $('btn-start').textContent = '繼續遊戲';
  } else {
    el.textContent = '';
  }
}

$('btn-start').addEventListener('click', startGame);
$('btn-calibrate').addEventListener('click', () => {
  if (input.hasSensor) openLevelCalibration('game');
  else toast('未偵測到感應器(電腦請用方向鍵或拖曳)');
});
$('btn-level-confirm').addEventListener('click', () => closeLevelCalibration(true));
$('btn-level-skip').addEventListener('click', () => closeLevelCalibration(true));
$('btn-next').addEventListener('click', () => {
  sfx.click();
  hide('screen-clear');
  if (game.mode === 'daily' || game.levelIndex >= SERIES_LEN) {
    showSeries();               // 每日關卡 / 系列全破 → 回選單
  } else {
    enterLevel(game.series, game.levelIndex + 1);
  }
});
$('btn-replay').addEventListener('click', () => {
  sfx.click();
  hide('screen-clear');
  if (game.mode === 'daily') enterDailyLevel();
  else enterLevel(game.series, game.levelIndex);
});
$('btn-clear-menu').addEventListener('click', () => {
  sfx.click();
  hide('screen-clear');
  if (game.mode === 'daily') showSeries();
  else showLevels(game.series);
});
$('btn-back-series').addEventListener('click', () => {
  sfx.click();
  showSeries();
});

// 設定
let settingsFrom = 'menu';
function openSettings(from) {
  settingsFrom = from;
  if (game.state === 'play') game.state = 'paused';
  $('set-sensitivity').value = settings.sensitivity;
  $('set-sound').checked = settings.sound;
  $('set-vibrate').checked = settings.vibrate;
  $('btn-exit-level').classList.toggle('hidden', from !== 'game');
  show('screen-settings');
}
$('btn-settings').addEventListener('click', () => openSettings('game'));
$('btn-settings-start').addEventListener('click', () => openSettings('menu'));
$('btn-rank-start').addEventListener('click', () => { sfx.click(); openRank('start'); });
$('btn-rank-series').addEventListener('click', () => { sfx.click(); openRank('series'); });
$('btn-close-rank').addEventListener('click', () => { sfx.click(); closeRank(); });
$('tab-world').addEventListener('click', () => { sfx.click(); switchRankTab('world'); });
$('tab-me').addEventListener('click', () => { sfx.click(); switchRankTab('me'); });
$('btn-close-settings').addEventListener('click', () => {
  settings.sensitivity = parseFloat($('set-sensitivity').value);
  settings.sound = $('set-sound').checked;
  settings.vibrate = $('set-vibrate').checked;
  store.set('sensitivity', settings.sensitivity);
  store.set('sound', settings.sound);
  store.set('vibrate', settings.vibrate);
  hide('screen-settings');
  if (settingsFrom === 'game') game.state = 'play';
  sfx.click();
});
$('btn-exit-level').addEventListener('click', () => {
  sfx.click();
  hide('screen-settings');
  showLevels(game.series);
});
$('btn-reset-progress').addEventListener('click', () => {
  if (!confirm('確定要重置所有進度與最高分?')) return;
  game.totalScore = 0; game.bestScore = 0;
  for (const k of Object.keys(progress)) delete progress[k];
  store.set('progress', progress);
  store.set('totalScore', 0);
  store.set('bestScore', 0);
  updateBestLine();
  toast('進度已重置');
});

// 轉向 / 縮放
window.addEventListener('resize', () => {
  if (game.cols) {
    // 以格為單位保留球的位置
    const relX = (game.ball.x - game.offX) / game.cellSize;
    const relY = (game.ball.y - game.offY) / game.cellSize;
    layout();
    game.ball.x = game.offX + relX * game.cellSize;
    game.ball.y = game.offY + relY * game.cellSize;
    trail.length = 0;
  } else {
    layout0();
  }
  initStarfield();
});

// 背景分頁時暫停計時
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') game.state = 'paused';
  else if (!document.hidden && game.state === 'paused' &&
           $('screen-settings').classList.contains('hidden') &&
           $('screen-level').classList.contains('hidden')) {
    game.state = 'play';
    lastT = 0;
  }
});

function layout0() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = viewSize().w * dpr;
  canvas.height = viewSize().h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ---------- 啟動 ---------- */
applyThemeClass();
layout0();
initStarfield();
updateBestLine();
$('version-line').textContent = `百香果頭女孩 v${APP_VERSION}`;
if (!('ontouchstart' in window)) {
  $('control-hint').textContent = '電腦:方向鍵 / WASD / 按住拖曳滑鼠';
}
requestAnimationFrame(loop);

// 除錯掛鉤(開發工具檢視內部狀態用,不影響遊戲)
window.__nebula = { game, input, getTilt, physicsStep, draw, buildLevel, checkPickups, openLevelCalibration, updateLevelGauge, closeLevelCalibration, SERIES, showSeries, showLevels, enterLevel, starsOf, distToPath, dailyInfo, enterDailyLevel, THEMES };

})();
