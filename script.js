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
    streak: 0,
    setClockAnswer: { hour: 12, minute: 0 },
    settingsOpen: false,
    autoNextTimer: null
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
  initSounds();
  // Safari 需要使用者互動後才能播放音訊，首次點擊時解鎖
  document.addEventListener('click', function unlockAudio() {
    if (correctAudio) { correctAudio.play().then(function() { correctAudio.pause(); correctAudio.currentTime = 0; }).catch(function(){}); }
    if (wrongAudio) { wrongAudio.play().then(function() { wrongAudio.pause(); wrongAudio.currentTime = 0; }).catch(function(){}); }
    document.removeEventListener('click', unlockAudio);
  }, { once: true });
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
  clearAutoNext();
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
  clearAutoNext();
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
// 音效（base64 內嵌 WAV + Audio 元素，Safari 相容）
// ============================================================

var CORRECT_WAV = "data:audio/wav;base64,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";
var WRONG_WAV = "data:audio/wav;base64,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";

var correctAudio = null;
var wrongAudio = null;

function initSounds() {
  // 頁面載入時預建 Audio 元素
  try {
    correctAudio = new Audio(CORRECT_WAV);
    wrongAudio = new Audio(WRONG_WAV);
  } catch (e) {}
}

function playCorrectSound() {
  try {
    if (!correctAudio) initSounds();
    correctAudio.currentTime = 0;
    correctAudio.play();
  } catch (e) {}
}

function playWrongSound() {
  try {
    if (!wrongAudio) initSounds();
    wrongAudio.currentTime = 0;
    wrongAudio.play();
  } catch (e) {}
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

  // 分鐘數字（外圈 5, 10, 15...55）
  for (let m = 5; m <= 55; m += 5) {
    const angle = (m * 6 - 90) * Math.PI / 180;
    const mr = R + 13;
    const mx = CX + mr * Math.cos(angle);
    const my = CY + mr * Math.sin(angle);
    svg += `<text x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="400" fill="#999" class="minute-label">${m}</text>`;
  }
  // 外圈 00/60 位置
  svg += `<text x="${CX}" y="${CY - R - 13}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="400" fill="#999" class="minute-label">0</text>`;

  // 數字 1~12（小時）
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

  // 拖曳氣泡（預設隱藏）
  svg += `<g id="drag-bubble" style="display:none;">`;
  svg += `<circle id="bubble-bg" cx="0" cy="0" r="16" fill="#4a90d9" opacity="0.9"/>`;
  svg += `<text id="bubble-text" x="0" y="0" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="700" fill="#fff">0</text>`;
  svg += `</g>`;

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
    minute = snapMinute(minute, state.difficulty);
    setSetClockMinute(minute);
    showDragBubble(minute);
  } else if (dragging === 'hour') {
    let hour = Math.round(angle / 30);
    if (hour === 0) hour = 12;
    setSetClockHour(hour);
    hideDragBubble();
  }
}

function onPointerUp(e) {
  if (dragging) {
    hideDragBubble();
    dragging = null;
    clockSvg.releasePointerCapture(e.pointerId);
  }
}

function showDragBubble(minute) {
  const bubble = document.getElementById('drag-bubble');
  if (!bubble) return;
  // 氣泡位置在分針末端外側
  const rad = (minute * 6 - 90) * Math.PI / 180;
  const bx = CX + (MINUTE_HAND_LEN + 22) * Math.cos(rad);
  const by = CY + (MINUTE_HAND_LEN + 22) * Math.sin(rad);
  bubble.style.display = '';
  document.getElementById('bubble-bg').setAttribute('cx', bx);
  document.getElementById('bubble-bg').setAttribute('cy', by);
  const txt = document.getElementById('bubble-text');
  txt.setAttribute('x', bx);
  txt.setAttribute('y', by);
  txt.textContent = String(minute).padStart(2, '0');
}

function hideDragBubble() {
  const bubble = document.getElementById('drag-bubble');
  if (bubble) bubble.style.display = 'none';
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
    x: (e.clientX - rect.left) * 340 / rect.width - 20,
    y: (e.clientY - rect.top) * 340 / rect.height - 20
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
  if (state.answerResult.isCorrect) {
    state.stats.correct++;
    state.streak++;
    playCorrectSound();
  } else {
    state.streak = 0;
    playWrongSound();
  }

  renderResult();
  renderStats();
  updateBreadcrumb();

  // 連續答對 10 題，大慶祝
  if (state.streak > 0 && state.streak % 10 === 0) {
    showCelebration();
  }

  // 答對後 5 秒自動進入下一題
  clearAutoNext();
  if (state.answerResult.isCorrect) {
    state.autoNextTimer = setTimeout(function() {
      goToNextQuestion();
    }, 5000);
  }
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

function clearAutoNext() {
  if (state.autoNextTimer) {
    clearTimeout(state.autoNextTimer);
    state.autoNextTimer = null;
  }
}

function goToNextQuestion() {
  clearAutoNext();
  state.lastQuestion = state.currentQuestion;
  generateAndShow();
}

function resetStats() {
  clearAutoNext();
  state.stats = { total: 0, correct: 0 };
  state.streak = 0;
  state.answerResult = null;
  generateAndShow();
}

// ============================================================
// 慶祝動畫（連續答對 10 題）
// ============================================================

const CELEBRATE_MESSAGES = [
  '你太厲害了！',
  '超級棒！繼續加油！',
  '哇！時鐘大師！',
  '太強了！完美連續！',
  '好厲害呀！你是天才！',
  '連續十題全對！好棒好棒！'
];

const CELEBRATE_EMOJIS = ['🎉', '🌟', '⭐', '🏆', '💪', '👏', '🎊', '❤️', '🥳', '✨'];

function showCelebration() {
  // 建立覆蓋層
  var overlay = document.createElement('div');
  overlay.id = 'celebration-overlay';

  // 隨機訊息
  var msg = CELEBRATE_MESSAGES[Math.floor(Math.random() * CELEBRATE_MESSAGES.length)];

  // 產生紙花
  var confettiHtml = '';
  for (var i = 0; i < 40; i++) {
    var emoji = CELEBRATE_EMOJIS[Math.floor(Math.random() * CELEBRATE_EMOJIS.length)];
    var left = Math.random() * 100;
    var delay = Math.random() * 1.5;
    var size = 18 + Math.random() * 20;
    confettiHtml += '<span class="confetti" style="left:' + left + '%;animation-delay:' + delay.toFixed(2) + 's;font-size:' + size.toFixed(0) + 'px;">' + emoji + '</span>';
  }

  overlay.innerHTML = confettiHtml +
    '<div class="celebrate-content">' +
      '<div class="celebrate-emoji">🏆</div>' +
      '<div class="celebrate-streak">連續 ' + state.streak + ' 題全對！</div>' +
      '<div class="celebrate-msg">' + msg + '</div>' +
      '<button class="celebrate-btn" onclick="closeCelebration()">繼續挑戰</button>' +
    '</div>';

  document.body.appendChild(overlay);

  // 6 秒後自動關閉
  setTimeout(function() {
    closeCelebration();
  }, 6000);
}

function closeCelebration() {
  var overlay = document.getElementById('celebration-overlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(function() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 400);
  }
}

// ============================================================
// 啟動
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  init();
  setMode('set-clock');
});
