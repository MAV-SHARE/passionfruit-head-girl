/* =========================================================
   百香果頭女孩 PASSIONFRUIT HEAD GIRL
   傾斜操控 · 程序生成 · PWA 離線遊戲
   ========================================================= */
(() => {
'use strict';

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
  theme: store.get('theme', 'passion'),
};

/* ---------- 主題(視覺 + 物理碰撞規則) ---------- */
const THEMES = {
  // 預設:百香果 — 真實水果的滾動手感:幾乎不彈、阻力大、果形不正會搖晃、撞牆會擠壓
  passion: {
    icon: '✿',
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
  if (levelFrom === 'start') beginPlay();
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
  state: 'menu',        // menu | play | clear | falling
  level: store.get('level', 1),
  totalScore: store.get('totalScore', 0),
  bestLevel: store.get('bestLevel', 1),
  bestScore: store.get('bestScore', 0),
  maze: null,
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

function buildLevel(lv) {
  const p = levelParams(lv);
  const rng = mulberry32(lv * 7919 + 12345);
  const { w, h } = viewSize();
  const portrait = h >= w;
  const shortCells = p.short;
  const ratio = Math.max(w, h) / Math.min(w, h);
  const longCells = clamp(Math.round(shortCells * ratio), shortCells, 24);
  game.cols = portrait ? shortCells : longCells;
  game.rows = portrait ? longCells : shortCells;
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

  game.stars = [];
  game.starsGot = 0;
  game.falls = 0;
  game.time = 0;
  game.particles = [];
  layout();
  resetBall();
  updateHUD();
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

  buildWallRects();
  renderMazeLayer();
}

function buildWallRects() {
  const { cols, rows, cellSize: s, offX, offY, wallT: t } = game;
  const half = t / 2;
  const rects = [];
  const px = x => offX + x * s;
  const py = y => offY + y * s;
  // 外框
  rects.push({ x: px(0) - half, y: py(0) - half, w: cols * s + t, h: t });
  rects.push({ x: px(0) - half, y: py(rows) - half, w: cols * s + t, h: t });
  rects.push({ x: px(0) - half, y: py(0) - half, w: t, h: rows * s + t });
  rects.push({ x: px(cols) - half, y: py(0) - half, w: t, h: rows * s + t });
  // 內牆(只取每格的 e 與 s,避免重複)
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const c = game.maze[y][x];
      if (c.e && x < cols - 1) rects.push({ x: px(x + 1) - half, y: py(y) - half, w: t, h: s + t });
      if (c.s && y < rows - 1) rects.push({ x: px(x) - half, y: py(y + 1) - half, w: s + t, h: t });
    }
  }
  game.walls = rects;
}

function resetBall() {
  const b = game.ball;
  b.x = game.offX + (game.startCell.x + 0.5) * game.cellSize;
  b.y = game.offY + (game.startCell.y + 0.5) * game.cellSize;
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
  fc.fillStyle = grad;
  fc.fillRect(fx, fy, fw, fh);
  if (style && style.decor === 'passionSeeds') {
    // 百香果:散落的黑籽(帶果凍光澤)
    const nSeeds = Math.round(game.cols * game.rows * 0.7);
    for (let i = 0; i < nSeeds; i++) {
      const sx2 = fx + 4 + Math.random() * (fw - 8);
      const sy2 = fy + 4 + Math.random() * (fh - 8);
      const sr = game.cellSize * (0.04 + Math.random() * 0.035);
      const rot = Math.random() * Math.PI;
      fc.save();
      fc.translate(sx2, sy2); fc.rotate(rot);
      fc.fillStyle = 'rgba(255, 220, 140, 0.5)';
      fc.beginPath(); fc.ellipse(0, 0, sr * 1.9, sr * 1.5, 0, 0, Math.PI * 2); fc.fill();
      fc.fillStyle = '#2e1608';
      fc.beginPath(); fc.ellipse(0, 0, sr * 1.25, sr, 0, 0, Math.PI * 2); fc.fill();
      fc.fillStyle = 'rgba(255, 240, 200, 0.55)';
      fc.beginPath(); fc.arc(-sr * 0.35, -sr * 0.3, sr * 0.3, 0, Math.PI * 2); fc.fill();
      fc.restore();
    }
  } else if (style && style.decor === 'appleCore') {
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
  } else if (style && style.decor === 'pineRings') {
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
  fc.strokeStyle = style ? style.grid : 'rgba(90, 120, 220, 0.07)';
  fc.lineWidth = 1;
  for (let x = 0; x <= game.cols; x++) {
    fc.beginPath(); fc.moveTo(fx + x * game.cellSize, fy); fc.lineTo(fx + x * game.cellSize, fy + fh); fc.stroke();
  }
  for (let y = 0; y <= game.rows; y++) {
    fc.beginPath(); fc.moveTo(fx, fy + y * game.cellSize); fc.lineTo(fx + fw, fy + y * game.cellSize); fc.stroke();
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

/* ---------- 物理(參數依主題而異) ---------- */
function physicsStep(dt) {
  const b = game.ball;
  const ph = theme().phys;
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
  }
}

function collideWalls() {
  const b = game.ball;
  const ph = theme().phys;
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
  for (const s of game.stars) {
    if (!s.got && dist2(b.x, b.y, s.x, s.y) < (b.r + game.cellSize * 0.2) ** 2) {
      s.got = true;
      game.starsGot++;
      sfx.star();
      buzz([15, 30, 15]);
      spawnBurst(s.x, s.y, '#ffd66e', 16);
      updateHUD();
    }
  }
  for (const hole of game.holes) {
    if (dist2(b.x, b.y, hole.x, hole.y) < (hole.r * 0.75) ** 2) {
      startFall(hole);
      return;
    }
  }
  if (dist2(b.x, b.y, game.goal.x, game.goal.y) < (game.goal.r * 0.8) ** 2) {
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

  const timeBonus = Math.max(0, 120 - Math.floor(game.time)) * 5;
  const starBonus = game.starsGot * 200;
  const noFall = game.falls === 0 ? 150 : 0;
  const levelScore = 300 + game.level * 50 + timeBonus + starBonus + noFall;
  game.totalScore += levelScore;
  game.bestLevel = Math.max(game.bestLevel, game.level + 1);
  game.bestScore = Math.max(game.bestScore, game.totalScore);
  store.set('level', game.level + 1);
  store.set('totalScore', game.totalScore);
  store.set('bestLevel', game.bestLevel);
  store.set('bestScore', game.bestScore);

  document.getElementById('clear-title').textContent = theme().clearTitle;
  const starsEl = document.getElementById('clear-stars');
  starsEl.innerHTML = [0, 1, 2].map(i =>
    `<span class="${i < game.starsGot ? '' : 'off'}">${theme().icon}</span>`).join('');
  document.getElementById('clear-time').textContent = fmtTime(game.time);
  document.getElementById('clear-score').textContent = '+' + levelScore;
  document.getElementById('clear-total').textContent = game.totalScore;
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

  if (!game.maze) return;

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

  // 陷阱:水果=果皮蟲蛀洞;星雲=黑洞
  for (const hole of game.holes) {
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

  // 收集物:水果=花朵;星雲=星星
  for (const s of game.stars) {
    if (s.got) continue;
    const pulse = 1 + 0.15 * Math.sin(t * 4 + s.x);
    if (style) drawFlower(s.x, s.y, game.cellSize * 0.16 * pulse, t, style.flower);
    else drawStar(s.x, s.y, game.cellSize * 0.17 * pulse, t);
  }

  // 終點:百香果=果汁漩渦;星雲=傳送門
  {
    const g = game.goal;
    const pulse = 1 + 0.1 * Math.sin(t * 2.5);
    if (style) {
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

  // 拖尾:水果=淡淡的滾痕;星雲=發光拖尾
  const trailRGB = style ? style.trail : '120, 210, 255';
  const trailA = style ? 0.18 : 0.35;
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
  const style = theme().style;
  if (style) {
    if (style.ball === 'passion') drawPassionBall(x, y, r);
    else if (style.ball === 'apple') drawAppleBall(x, y, r);
    else drawPineappleBall(x, y, r);
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
      toast(theme().fallToast);
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
  $('hud-level').textContent = 'LV ' + game.level;
  $('hud-stars').textContent = `${theme().icon} ${game.starsGot}/3`;
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
  // 觸控裝置:先請玩家把手機平放校準,再開始
  if ('ontouchstart' in window && typeof DeviceOrientationEvent !== 'undefined') {
    openLevelCalibration('start');
  } else {
    beginPlay();
  }
}

function beginPlay() {
  show('hud');
  buildLevel(game.level);
  game.state = 'play';
  lastT = 0;
  if (game.level === 1) toast(theme().startToast);
}

function updateBestLine() {
  const el = $('best-line');
  if (game.bestScore > 0) {
    el.textContent = `最高紀錄:LV ${game.bestLevel} · ${game.bestScore} 分`;
    $('btn-start').textContent = game.level > 1 ? `繼續遊戲(LV ${game.level})` : '開始遊戲';
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
  game.level++;
  store.set('level', game.level);
  hide('screen-clear');
  buildLevel(game.level);
  game.state = 'play';
});
$('btn-replay').addEventListener('click', () => {
  sfx.click();
  hide('screen-clear');
  buildLevel(game.level);
  game.state = 'play';
});

// 設定
let settingsFrom = 'menu';
function openSettings(from) {
  settingsFrom = from;
  if (game.state === 'play') game.state = 'paused';
  $('set-sensitivity').value = settings.sensitivity;
  $('set-sound').checked = settings.sound;
  $('set-vibrate').checked = settings.vibrate;
  $('set-theme').value = settings.theme;
  show('screen-settings');
}
$('btn-settings').addEventListener('click', () => openSettings('game'));
$('btn-settings-start').addEventListener('click', () => openSettings('menu'));
$('btn-close-settings').addEventListener('click', () => {
  settings.sensitivity = parseFloat($('set-sensitivity').value);
  settings.sound = $('set-sound').checked;
  settings.vibrate = $('set-vibrate').checked;
  const newTheme = $('set-theme').value;
  const themeChanged = newTheme !== settings.theme;
  settings.theme = newTheme;
  store.set('sensitivity', settings.sensitivity);
  store.set('sound', settings.sound);
  store.set('vibrate', settings.vibrate);
  store.set('theme', settings.theme);
  if (themeChanged) {
    applyThemeClass();
    if (game.maze) renderMazeLayer();  // 重繪牆與地板
    trail.length = 0;
    updateHUD();
  }
  hide('screen-settings');
  if (settingsFrom === 'game') game.state = 'play';
  sfx.click();
});
$('btn-reset-progress').addEventListener('click', () => {
  if (!confirm('確定要重置所有進度與最高分?')) return;
  game.level = 1; game.totalScore = 0; game.bestLevel = 1; game.bestScore = 0;
  store.set('level', 1); store.set('totalScore', 0);
  store.set('bestLevel', 1); store.set('bestScore', 0);
  updateBestLine();
  toast('進度已重置');
});

// 轉向 / 縮放
window.addEventListener('resize', () => {
  if (game.maze) {
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
if (!('ontouchstart' in window)) {
  $('control-hint').textContent = '電腦:方向鍵 / WASD / 按住拖曳滑鼠';
}
requestAnimationFrame(loop);

// 除錯掛鉤(開發工具檢視內部狀態用,不影響遊戲)
window.__nebula = { game, input, getTilt, physicsStep, draw, buildLevel, checkPickups, openLevelCalibration, updateLevelGauge, closeLevelCalibration };

})();
