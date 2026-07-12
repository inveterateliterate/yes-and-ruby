const slides = document.querySelectorAll('.slide');
const progress = document.getElementById('progress');
const slideNum = document.getElementById('slideNum');
const helpOverlay = document.getElementById('helpOverlay');
let current = 0;
let presenterWindow = null;
let startTime = null;
let timerInterval = null;

// ── Slide navigation ──
function show(n, broadcast = true) {
  if (n < 0 || n >= slides.length) return;
  slides[current].classList.remove('active');
  current = n;
  slides[current].classList.add('active');
  progress.style.width = ((current + 1) / slides.length * 100) + '%';
  slideNum.textContent = (current + 1) + ' / ' + slides.length;

  // Sync via localStorage
  if (broadcast) {
    localStorage.setItem('slide-sync', JSON.stringify({ slide: current, time: Date.now() }));
  }

  // Update presenter window if open
  updatePresenterWindow();
}

// ── Help overlay ──
function toggleHelp() {
  helpOverlay.classList.toggle('visible');
}

// ── Fullscreen ──
function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {
      console.log('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// ── Timer ──
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function startTimer() {
  if (!startTime) {
    startTime = Date.now();
    localStorage.setItem('slide-timer-start', startTime.toString());
  }
}

function getElapsedTime() {
  if (!startTime) {
    const stored = localStorage.getItem('slide-timer-start');
    if (stored) startTime = parseInt(stored);
  }
  return startTime ? Date.now() - startTime : 0;
}

// ── Presenter mode ──
function openPresenterMode() {
  if (presenterWindow && !presenterWindow.closed) {
    presenterWindow.focus();
    return;
  }

  startTimer();
  const baseUrl = window.location.href.split('?')[0].split('#')[0];

  const presenterHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Presenter View</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg: #0a0e17;
    --bg-card: #111827;
    --text: #E5E7EB;
    --muted: #9CA3AF;
    --teal: #14B8A6;
    --pink: #FF69B4;
    --lavender: #A78BFA;
    --border: rgba(255,255,255,0.08);
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Outfit', sans-serif;
    background: var(--bg);
    color: var(--text);
    height: 100vh;
    overflow: hidden;
  }

  .presenter-layout {
    display: grid;
    grid-template-columns: 240px 1fr;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    gap: 12px;
    padding: 12px;
  }

  .header {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  .timer {
    font-family: 'JetBrains Mono', monospace;
    font-size: 36px;
    font-weight: 600;
    color: var(--teal);
  }

  .slide-counter {
    font-size: 18px;
    color: var(--muted);
  }

  .slide-counter .current {
    font-size: 28px;
    color: var(--text);
    font-weight: 700;
  }

  .controls {
    display: flex;
    gap: 8px;
  }

  .btn {
    font-family: 'Outfit', sans-serif;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn:hover {
    background: rgba(255,255,255,0.05);
    border-color: var(--teal);
  }

  .previews {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preview-card {
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
    padding: 8px;
    display: flex;
    flex-direction: column;
  }

  .preview-card.current-card {
    flex: 1.2;
    border-color: var(--teal);
  }

  .preview-card.next-card {
    flex: 1;
  }

  .preview-card h3 {
    font-size: 10px;
    font-weight: 600;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 1.5px;
    margin-bottom: 6px;
  }

  .preview-card.current-card h3 { color: var(--teal); }

  .slide-frame {
    flex: 1;
    background: #000;
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .slide-frame iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: 1280px;
    height: 720px;
    border: none;
    pointer-events: none;
    transform-origin: top left;
  }

  .slide-frame.end-card {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-size: 13px;
  }

  .notes-panel {
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
    padding: 20px 28px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .notes-panel h3 {
    font-size: 11px;
    font-weight: 600;
    color: var(--pink);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 14px;
    flex-shrink: 0;
  }

  .notes-content {
    font-size: 22px;
    line-height: 1.6;
    color: var(--text);
    flex: 1;
  }

  .notes-content.empty {
    color: var(--muted);
    font-style: italic;
    font-size: 20px;
  }

  .progress-bar {
    grid-column: 1 / -1;
    height: 3px;
    background: rgba(255,255,255,0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--teal), var(--lavender), var(--pink));
    transition: width 0.3s ease;
  }
</style>
</head>
<body>
<div class="presenter-layout">
  <div class="header">
    <div class="timer" id="timer">00:00</div>
    <div class="slide-counter">
      <span class="current" id="currentNum">1</span> / <span id="totalNum">1</span>
    </div>
    <div class="controls">
      <button class="btn" onclick="resetTimer()">Reset</button>
      <button class="btn" onclick="window.opener && window.opener.toggleFullscreen()">Fullscreen</button>
    </div>
  </div>

  <div class="previews">
    <div class="preview-card current-card">
      <h3>Current</h3>
      <div class="slide-frame" id="currentFrame"></div>
    </div>
    <div class="preview-card next-card">
      <h3>Next</h3>
      <div class="slide-frame" id="nextFrame"></div>
    </div>
  </div>

  <div class="notes-panel">
    <h3>Speaker Notes</h3>
    <div class="notes-content" id="notes">No notes for this slide.</div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" id="progressFill"></div>
  </div>
</div>

<script>
  let timerStart = parseInt(localStorage.getItem('slide-timer-start')) || Date.now();
  const baseUrl = '${baseUrl}';

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
  }

  function updateTimer() {
    const elapsed = Date.now() - timerStart;
    document.getElementById('timer').textContent = formatTime(elapsed);
  }

  function resetTimer() {
    timerStart = Date.now();
    localStorage.setItem('slide-timer-start', timerStart.toString());
    updateTimer();
  }

  function scaleIframes() {
    document.querySelectorAll('.slide-frame').forEach(frame => {
      const iframe = frame.querySelector('iframe');
      if (!iframe) return;
      const scale = Math.min(frame.clientWidth / 1280, frame.clientHeight / 720);
      iframe.style.transform = 'scale(' + scale + ')';
    });
  }

  window.addEventListener('resize', scaleIframes);
  setTimeout(scaleIframes, 150);

  setInterval(updateTimer, 1000);
  updateTimer();

  window.addEventListener('storage', (e) => {
    if (e.key === 'slide-timer-start') {
      timerStart = parseInt(e.newValue);
    }
  });
<\/script>
</body>
</html>`;

  presenterWindow = window.open('', 'presenter', 'width=1000,height=650');
  presenterWindow.document.write(presenterHTML);
  presenterWindow.document.close();

  setTimeout(() => updatePresenterWindow(), 150);
}

function updatePresenterWindow() {
  if (!presenterWindow || presenterWindow.closed) return;

  const doc = presenterWindow.document;
  if (!doc.getElementById('currentNum')) return;

  doc.getElementById('currentNum').textContent = current + 1;
  doc.getElementById('totalNum').textContent = slides.length;

  const progressPercent = ((current + 1) / slides.length * 100);
  doc.getElementById('progressFill').style.width = progressPercent + '%';

  const currentNotes = slides[current].dataset.notes || '';
  const notesEl = doc.getElementById('notes');
  if (currentNotes) {
    notesEl.innerHTML = currentNotes.replace(/\n/g, '<br>');
    notesEl.classList.remove('empty');
  } else {
    notesEl.textContent = 'No notes for this slide.';
    notesEl.classList.add('empty');
  }

  updateSlideFrame(doc.getElementById('currentFrame'), current);
  updateSlideFrame(doc.getElementById('nextFrame'), current + 1);
}

function updateSlideFrame(container, slideIndex) {
  if (!container) return;
  const baseUrl = window.location.href.split('?')[0].split('#')[0];

  if (slideIndex >= slides.length) {
    container.innerHTML = '';
    container.classList.add('end-card');
    container.textContent = 'End';
    return;
  }

  container.classList.remove('end-card');

  let iframe = container.querySelector('iframe');
  const expectedSrc = baseUrl + '?slide=' + slideIndex + '&preview=1';

  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.src = expectedSrc;
    container.innerHTML = '';
    container.appendChild(iframe);
    iframe.onload = () => {
      const scale = Math.min(container.clientWidth / 1280, container.clientHeight / 720);
      iframe.style.transform = 'scale(' + scale + ')';
    };
  } else if (!iframe.src.endsWith('slide=' + slideIndex + '&preview=1')) {
    iframe.src = expectedSrc;
  }
}

function updatePresenterFromStorage(slideNum) {
  show(slideNum, false);
}

// ── Handle preview mode (loaded in presenter iframe) ──
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('preview')) {
  document.getElementById('progress').style.display = 'none';
  document.getElementById('slideNum').style.display = 'none';
  document.getElementById('helpOverlay').style.display = 'none';
  const requestedSlide = parseInt(urlParams.get('slide')) || 0;
  setTimeout(() => show(requestedSlide, false), 0);
}

// ── Keyboard handling ──
document.addEventListener('keydown', (e) => {
  // Close help on any key if visible
  if (helpOverlay.classList.contains('visible')) {
    toggleHelp();
    return;
  }

  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault();
    startTimer();
    show(current + 1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    show(current - 1);
  }
  if (e.key === 'Home') {
    e.preventDefault();
    show(0);
  }
  if (e.key === 'End') {
    e.preventDefault();
    show(slides.length - 1);
  }
  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    openPresenterMode();
  }
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    toggleFullscreen();
  }
  if (e.key === 'h' || e.key === 'H' || e.key === '?') {
    e.preventDefault();
    toggleHelp();
  }
});

// ── Touch support ──
let touchStartX = 0;
document.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; });
document.addEventListener('touchend', (e) => {
  const diff = touchStartX - e.changedTouches[0].clientX;
  if (Math.abs(diff) > 50) {
    startTimer();
    diff > 0 ? show(current + 1) : show(current - 1);
  }
});

// ── Listen for sync from presenter window ──
window.addEventListener('storage', (e) => {
  if (e.key === 'slide-sync') {
    const data = JSON.parse(e.newValue);
    show(data.slide, false);
  }
});

// ── Initialize ──
show(0, false);
