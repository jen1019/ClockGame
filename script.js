// ============================================================
// 狀態管理
// ============================================================

function getDefaultState() {
  return {
    mode: 'set-clock',        // 'set-clock' | 'read-clock'
    difficulty: 'normal',     // 'easy' | 'normal' | 'hard'
    currentQuestion: null,    // { hour, minute }
    lastQuestion: null,       // { hour, minute } | null
    answerResult: null,       // { isCorrect, message } | null
    stats: { total: 0, correct: 0 },
    setClockAnswer: { hour: 12, minute: 0 },
    settingsOpen: false
  };
}

let state = getDefaultState();

// ============================================================
// DOM 快取
// ============================================================

const $ = (sel) => document.querySelector(sel);
let clockSvg, questionText, resultArea;

// ============================================================
// 初始化
// ============================================================

function init() {
  clockSvg = $('#clock');
  questionText = $('#question-text');
  resultArea = $('#result-area');

  renderClockFace();
  bindEvents();
  populateHourSelect();
  renderReadClockSelectors();
  generateAndShow();
}

function bindEvents() {
  // 設定面板開關
  $('#btn-settings').addEventListener('click', toggleSettings);

  // 模式切換
  document.querySelectorAll('#mode-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  // 難易度切換
  document.querySelectorAll('#difficulty-buttons button').forEach((btn) => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.diff));
  });

  // 語音
  $('#btn-speak').addEventListener('click', speakQuestion);
  $('#btn-speak-again').addEventListener('click', speakQuestion);

  // 送出 / 下一題 / 重新開始
  $('#btn-submit').addEventListener('click', submitAnswer);
  $('#btn-next').addEventListener('click', goToNextQuestion);
  $('#btn-reset').addEventListener('click', resetStats);

  // 指針拖曳
  clockSvg.addEventListener('pointerdown', onPointerDown);
  clockSvg.addEventListener('pointermove', onPointerMove);
  clockSvg.addEventListener('pointerup', onPointerUp);
}

// ============================================================
// 設定面板
// ============================================================

function toggleSettings() {
  state.settingsOpen = !state.settingsOpen;
  $('#settings-panel').classList.toggle('hidden', !state.settingsOpen);
  $('#btn-settings').classList.toggle('open', state.settingsOpen);
}

function updateBreadcrumb() {
  const modeNames = { 'set-clock': '聽時間撥時鐘', 'read-clock': '看時鐘回答時間' };
  const diffNames = { 'easy': '簡單', 'normal': '普通', 'hard': '困難' };
  $('#crumb-mode').textContent = modeNames[state.mode];
  $('#crumb-diff').textContent = diffNames[state.difficulty];
  const { correct, total } = state.stats;
  $('#crumb-stats').textContent = total > 0 ? (correct + ' / ' + total) : '';
}

// ============================================================
// 模式 / 難易度切換
// ============================================================

function setMode(mode) {
  state.mode = mode;
  state.answerResult = null;

  document.querySelectorAll('#mode-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });

  // 顯示/隱藏控制區
  $('#set-clock-controls').style.display = mode === 'set-clock' ? '' : 'none';
  $('#read-clock-controls').classList.toggle('hidden', mode !== 'read-clock');

  // 語音按鈕只在模式 A 顯示
  $('#speech-buttons').style.display = mode === 'set-clock' ? '' : 'none';

  generateAndShow();
  updateBreadcrumb();
}

function setDifficulty(level) {
  state.difficulty = level;
  state.answerResult = null;

  document.querySelectorAll('#difficulty-buttons button').forEach((b) => {
    b.classList.toggle('active', b.dataset.diff === level);
  });

  renderReadClockSelectors();
  generateAndShow();
  updateBreadcrumb();
}

// ============================================================
// 題目產生
// ============================================================

function generateQuestion(mode, difficulty, lastQuestion) {
  let hour, minute;
  let attempt = 0;

  do {
    hour = getRandomHour();
    minute = getRandomMinuteByDifficulty(difficulty);
    attempt++;
  } while (
    lastQuestion &&
    lastQuestion.hour === hour &&
    lastQuestion.minute === minute &&
    attempt < 50
  );

  return { hour, minute };
}

function getRandomHour() {
  return Math.floor(Math.random() * 12) + 1;
}

function getRandomMinuteByDifficulty(difficulty) {
  if (difficulty === 'easy') {
    return [0, 15, 30, 45][Math.floor(Math.random() * 4)];
  }
  if (difficulty === 'normal') {
    return Math.floor(Math.random() * 12) * 5;
  }
  return Math.floor(Math.random() * 60);
}

// ============================================================
// 中文時間文字
// ============================================================

const CN_NUMS = [
  '', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十',
  '三十一', '三十二', '三十三', '三十四', '三十五', '三十六', '三十七', '三十八', '三十九', '四十',
  '四十一', '四十二', '四十三', '四十四', '四十五', '四十六', '四十七', '四十八', '四十九', '五十',
  '五十一', '五十二', '五十三', '五十四', '五十五', '五十六', '五十七', '五十八', '五十九'
];

function formatTimeText(hour, minute, difficulty) {
  const h = CN_NUMS[hour];
  if (minute === 0) return h + '點';
  if (minute === 30 && difficulty === 'easy') return h + '點半';
  return h + '點' + CN_NUMS[minute] + '分';
}

function formatAnswerText(hour, minute) {
  return hour + ' 點 ' + String(minute).padStart(2, '0') + ' 分';
}

// ============================================================
// 語音
// ============================================================

function speakQuestion() {
  if (!window.speechSynthesis || !state.currentQuestion) return;
  stopSpeaking();

  const { hour, minute } = state.currentQuestion;
  const timeStr = formatTimeText(hour, minute, state.difficulty);
  const text = '請把時鐘撥到' + timeStr;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-TW';
  utter.rate = 0.9;
  speechSynthesis.speak(utter);
}

function stopSpeaking() {
  if (window.speechSynthesis) speechSynthesis.cancel();
}

// ============================================================
// 音效（Web Audio API）
// ============================================================

function playCorrectSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    // 第一個音：C5
    var osc1 = ctx.createOscillator();
    var g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.value = 523;
    g1.gain.value = 0.5;
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(0);
    osc1.stop(ctx.currentTime + 0.15);
    // 第二個音：E5
    var osc2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 659;
    g2.gain.value = 0.5;
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.15);
    osc2.stop(ctx.currentTime + 0.4);
    osc2.onended = function() { ctx.close(); };
  } catch (e) { /* 音效失敗不影響遊戲 */ }
}

function playWrongSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    // 第一個音：E4
    var osc1 = ctx.createOscillator();
    var g1 = ctx.createGain();
    osc1.type = 'square';
    osc1.frequency.value = 330;
    g1.gain.value = 0.4;
    osc1.connect(g1);
    g1.connect(ctx.destination);
    osc1.start(0);
    osc1.stop(ctx.currentTime + 0.2);
    // 第二個音：C4
    var osc2 = ctx.createOscillator();
    var g2 = ctx.createGain();
    osc2.type = 'square';
    osc2.frequency.value = 220;
    g2.gain.value = 0.4;
    osc2.connect(g2);
    g2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.5);
    osc2.onended = function() { ctx.close(); };
  } catch (e) { /* 音效失敗不影響遊戲 */ }
}

// ============================================================
// 時鐘 SVG
// ============================================================

const CX = 150, CY = 150, R = 140;
const HOUR_HAND_LEN = 75;
const MINUTE_HAND_LEN = 110;

function renderClockFace() {
  let svg = '';

  // 鐘面
  svg += `<circle cx="${CX}" cy="${CY}" r="${R}" fill="#fff" stroke="#333" stroke-width="3"/>`;

  // 刻度
  for (let i = 0; i < 60; i++) {
    const angle = (i * 6 - 90) * Math.PI / 180;
    const isMajor = i % 5 === 0;
    const r1 = R - (isMajor ? 15 : 8);
    const r2 = R - 3;
    svg += `<line x1="${CX + r1 * Math.cos(angle)}" y1="${CY + r1 * Math.sin(angle)}" x2="${CX + r2 * Math.cos(angle)}" y2="${CY + r2 * Math.sin(angle)}" stroke="#555" stroke-width="${isMajor ? 2.5 : 1}"/>`;
  }

  // 數字 1~12
  for (let n = 1; n <= 12; n++) {
    const angle = (n * 30 - 90) * Math.PI / 180;
    const nr = R - 30;
    svg += `<text x="${CX + nr * Math.cos(angle)}" y="${CY + nr * Math.sin(angle)}" text-anchor="middle" dominant-baseline="central" font-size="20" font-weight="700" fill="#333">${n}</text>`;
  }

  // 分針（細、藍色）— 先畫，在下層
  svg += `<line id="hand-minute" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - MINUTE_HAND_LEN}" stroke="#4a90d9" stroke-width="4" stroke-linecap="round"/>`;

  // 分針拖曳區
  svg += `<line id="minute-hit" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - MINUTE_HAND_LEN}" stroke="transparent" stroke-width="28" stroke-linecap="round" class="hand-interactive"/>`;

  // 時針（粗、深色）— 後畫，在上層
  svg += `<line id="hand-hour" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - HOUR_HAND_LEN}" stroke="#333" stroke-width="7" stroke-linecap="round"/>`;

  // 時針拖曳區（最上層，重疊時優先攔截）
  svg += `<line id="hour-hit" x1="${CX}" y1="${CY}" x2="${CX}" y2="${CY - HOUR_HAND_LEN}" stroke="transparent" stroke-width="30" stroke-linecap="round" class="hand-interactive"/>`;

  // 中心圓點
  svg += `<circle cx="${CX}" cy="${CY}" r="6" fill="#333"/>`;

  clockSvg.innerHTML = svg;
}

function updateClockHands(hour, minute) {
  const minuteAngle = minute * 6;
  const hourAngle = (hour % 12) * 30 + minute * 0.5;

  const mRad = (minuteAngle - 90) * Math.PI / 180;
  const hRad = (hourAngle - 90) * Math.PI / 180;

  const mx = CX + MINUTE_HAND_LEN * Math.cos(mRad);
  const my = CY + MINUTE_HAND_LEN * Math.sin(mRad);
  const hx = CX + HOUR_HAND_LEN * Math.cos(hRad);
  const hy = CY + HOUR_HAND_LEN * Math.sin(hRad);

  // 分針
  const handMinute = document.getElementById('hand-minute');
  const minuteHit = document.getElementById('minute-hit');
  if (handMinute) { handMinute.setAttribute('x2', mx); handMinute.setAttribute('y2', my); }
  if (minuteHit) { minuteHit.setAttribute('x2', mx); minuteHit.setAttribute('y2', my); }

  // 時針
  const handHour = document.getElementById('hand-hour');
  const hourHit = document.getElementById('hour-hit');
  if (handHour) { handHour.setAttribute('x2', hx); handHour.setAttribute('y2', hy); }
  if (hourHit) { hourHit.setAttribute('x2', hx); hourHit.setAttribute('y2', hy); }
}

// ============================================================
// 指針拖曳（時針 + 分針皆可拖）
// ============================================================

let dragging = null; // 'hour' | 'minute' | null

function onPointerDown(e) {
  if (state.mode !== 'set-clock') return;

  const pt = svgPoint(e);
  const target = e.target;

  // 時針拖曳區在 SVG 最上層，重疊時優先拖時針
  if (target.id === 'hour-hit' || target.id === 'hand-hour') {
    dragging = 'hour';
  } else if (target.id === 'minute-hit' || target.id === 'hand-minute') {
    dragging = 'minute';
  } else {
    // 距離判斷：時針優先
    const hourEnd = getHandEnd(state.setClockAnswer.hour, state.setClockAnswer.minute, 'hour');
    const minuteEnd = getHandEnd(state.setClockAnswer.hour, state.setClockAnswer.minute, 'minute');
    const dHour = distToSegment(pt, { x: CX, y: CY }, hourEnd);
    const dMin = distToSegment(pt, { x: CX, y: CY }, minuteEnd);

    if (dHour < 25 && dHour <= dMin) {
      dragging = 'hour';
    } else if (dMin < 25) {
      dragging = 'minute';
    } else {
      return;
    }
  }

  clockSvg.setPointerCapture(e.pointerId);
  e.preventDefault();
}

function onPointerMove(e) {
  if (!dragging) return;
  e.preventDefault();

  const pt = svgPoint(e);
  const dx = pt.x - CX;
  const dy = pt.y - CY;
  // 角度：從正上方順時針
  let angle = Math.atan2(dx, -dy) * 180 / Math.PI;
  if (angle < 0) angle += 360;

  if (dragging === 'minute') {
    let minute = Math.round(angle / 6);
    if (minute === 60) minute = 0;
    // 依難易度吸附到對應刻度
    minute = snapMinute(minute, state.difficulty);
    setSetClockMinute(minute);
  } else if (dragging === 'hour') {
    // 將角度轉為 1~12
    let hour = Math.round(angle / 30);
    if (hour === 0) hour = 12;
    setSetClockHour(hour);
  }
}

function onPointerUp(e) {
  if (dragging) {
    dragging = null;
    clockSvg.releasePointerCapture(e.pointerId);
  }
}

// 取得指針末端座標
function getHandEnd(hour, minute, which) {
  if (which === 'minute') {
    const rad = (minute * 6 - 90) * Math.PI / 180;
    return { x: CX + MINUTE_HAND_LEN * Math.cos(rad), y: CY + MINUTE_HAND_LEN * Math.sin(rad) };
  }
  const hAngle = (hour % 12) * 30 + minute * 0.5;
  const rad = (hAngle - 90) * Math.PI / 180;
  return { x: CX + HOUR_HAND_LEN * Math.cos(rad), y: CY + HOUR_HAND_LEN * Math.sin(rad) };
}

// 點到線段距離
function distToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function svgPoint(e) {
  const rect = clockSvg.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * 300 / rect.width,
    y: (e.clientY - rect.top) * 300 / rect.height
  };
}

// 依難易度將分鐘吸附到最近的合法刻度
function snapMinute(minute, difficulty) {
  if (difficulty === 'easy') {
    // 吸附到 0, 15, 30, 45
    return Math.round(minute / 15) * 15 % 60;
  }
  if (difficulty === 'normal') {
    // 吸附到 0, 5, 10, ..., 55
    return Math.round(minute / 5) * 5 % 60;
  }
  // hard：不吸附
  return minute;
}

function enableSetClockInteraction() {
  document.querySelectorAll('.hand-interactive').forEach((el) => {
    el.style.display = '';
  });
}

function disableSetClockInteraction() {
  dragging = null;
  document.querySelectorAll('.hand-interactive').forEach((el) => {
    el.style.display = 'none';
  });
}

// ============================================================
// 模式 A 操作
// ============================================================

function setSetClockMinute(minute) {
  state.setClockAnswer.minute = minute;
  updateClockHands(state.setClockAnswer.hour, minute);
  renderCurrentTimeDisplay();
}

function setSetClockHour(hour) {
  if (hour < 1) hour = 12;
  if (hour > 12) hour = 1;
  state.setClockAnswer.hour = hour;
  updateClockHands(hour, state.setClockAnswer.minute);
  renderCurrentTimeDisplay();
}

function renderCurrentTimeDisplay() {
  // 不再顯示時間文字，留空
}

// ============================================================
// 模式 B 下拉選單
// ============================================================

function populateHourSelect() {
  const sel = $('#select-hour');
  sel.innerHTML = '';
  for (let h = 1; h <= 12; h++) {
    const opt = document.createElement('option');
    opt.value = h;
    opt.textContent = h;
    sel.appendChild(opt);
  }
}

function renderReadClockSelectors() {
  const sel = $('#select-minute');
  if (!sel) return;
  sel.innerHTML = '';

  let minutes;
  if (state.difficulty === 'easy') {
    minutes = [0, 15, 30, 45];
  } else if (state.difficulty === 'normal') {
    minutes = [];
    for (let i = 0; i < 60; i += 5) minutes.push(i);
  } else {
    minutes = [];
    for (let i = 0; i < 60; i++) minutes.push(i);
  }

  minutes.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = String(m).padStart(2, '0');
    sel.appendChild(opt);
  });
}

// ============================================================
// 答案判斷
// ============================================================

function submitAnswer() {
  if (!state.currentQuestion) return;

  const correct = state.currentQuestion;
  let userHour, userMinute;

  if (state.mode === 'set-clock') {
    userHour = state.setClockAnswer.hour;
    userMinute = state.setClockAnswer.minute;
    state.answerResult = checkSetClockAnswer({ hour: userHour, minute: userMinute }, correct, state.difficulty);
  } else {
    userHour = parseInt($('#select-hour').value, 10);
    userMinute = parseInt($('#select-minute').value, 10);
    state.answerResult = checkReadClockAnswer({ hour: userHour, minute: userMinute }, correct);
  }

  state.stats.total++;
  if (state.answerResult.isCorrect) state.stats.correct++;

  // 播放音效
  if (state.answerResult.isCorrect) {
    playCorrectSound();
  } else {
    playWrongSound();
  }

  renderResult();
  renderStats();
  updateBreadcrumb();
}

function checkSetClockAnswer(user, correct, difficulty) {
  if (user.hour !== correct.hour) {
    return { isCorrect: false, message: '答錯了，正確答案是 ' + formatAnswerText(correct.hour, correct.minute) };
  }

  const diff = Math.abs(user.minute - correct.minute);
  const minDiff = Math.min(diff, 60 - diff);

  if (minDiff === 0) {
    return { isCorrect: true, message: '答對了！' };
  }
  return { isCorrect: false, message: '答錯了，正確答案是 ' + formatAnswerText(correct.hour, correct.minute) };
}

function checkReadClockAnswer(user, correct) {
  if (user.hour === correct.hour && user.minute === correct.minute) {
    return { isCorrect: true, message: '答對了！' };
  }
  return { isCorrect: false, message: '答錯了，正確答案是 ' + formatAnswerText(correct.hour, correct.minute) };
}

// ============================================================
// UI 渲染
// ============================================================

function renderQuestion() {
  if (!state.currentQuestion) return;
  const { hour, minute } = state.currentQuestion;

  if (state.mode === 'set-clock') {
    questionText.textContent = '請把時鐘撥到 ' + formatTimeText(hour, minute, state.difficulty);
  } else {
    questionText.textContent = '這個時鐘顯示幾點幾分？';
  }
}

function renderResult() {
  if (!state.answerResult) {
    resultArea.textContent = '';
    resultArea.className = '';
    return;
  }
  resultArea.textContent = state.answerResult.message;
  resultArea.className = state.answerResult.isCorrect ? 'correct' : 'wrong';
}

function renderStats() {
  $('#stat-total').textContent = state.stats.total;
  $('#stat-correct').textContent = state.stats.correct;
  const rate = state.stats.total > 0 ? Math.round(state.stats.correct / state.stats.total * 100) : 0;
  $('#stat-rate').textContent = rate;
}

function renderAll() {
  renderQuestion();
  renderResult();
  renderStats();
  renderCurrentTimeDisplay();
  updateBreadcrumb();
}

// ============================================================
// 題目流程
// ============================================================

function generateAndShow() {
  state.currentQuestion = generateQuestion(state.mode, state.difficulty, state.lastQuestion);
  state.answerResult = null;

  if (state.mode === 'set-clock') {
    state.setClockAnswer = { hour: 12, minute: 0 };
    updateClockHands(12, 0);
    enableSetClockInteraction();
  } else {
    updateClockHands(state.currentQuestion.hour, state.currentQuestion.minute);
    disableSetClockInteraction();
  }

  renderAll();

  if (state.mode === 'set-clock') {
    speakQuestion();
  }
}

function goToNextQuestion() {
  state.lastQuestion = state.currentQuestion;
  generateAndShow();
}

function resetStats() {
  state.stats = { total: 0, correct: 0 };
  state.answerResult = null;
  generateAndShow();
}

// ============================================================
// 啟動
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  init();
  setMode('set-clock');
});
