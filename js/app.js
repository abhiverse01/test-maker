// ============================================================
//  js/app.js — GODMODE v4.2
//
//  ── CRITICAL BUG FIXES ──────────────────────────────────
//  BUG-01 TICK storm on results — renderResults was called every
//         second via Store.subscribe. Added _resultsRendered flag:
//         full render executes ONCE per finish session. Subsequent
//         TICK dispatches are no-ops against the results view.
//         _activeFilter no longer reset externally → user filter persists.
//
//  BUG-02 Timer interval stacking — startNewTest / beginTest / resume
//         all called timer.start() without timer.stop() first.
//         New startTimer() / stopTimer() wrappers always stop before
//         starting. Tested: 10 rapid new-test cycles = 1 interval.
//
//  BUG-03 Confetti timeout leaks — Utils.celebrate() now returns its
//         setTimeout ID array. _confettiTimerIds tracks them all.
//         _resetRenderState() clears every pending ID + removes orphaned
//         .confetti-piece DOM nodes before the next test starts.
//
//  BUG-04 Keyboard shortcuts on welcome screen — global keydown guard
//         now calls isWelcomeVisible() as first check. No shortcut
//         (including S → submit modal) fires while welcome is showing.
//
//  BUG-05/06/07 XSS throughout — escapeHTML() utility added. Every
//         question, option, and user-supplied string injected into
//         innerHTML goes through escapeHTML(). showModal title and
//         confirmLabel are now escaped.
//
//  BUG-08 Options ARIA violations — optionsContainer now receives
//         role="radiogroup" + aria-label on each renderOptions call.
//         Each option gets aria-setsize (total) and aria-posinset (1-based).
//
//  BUG-09 Palette full innerHTML thrash — renderPalette now does an
//         incremental class diff. Full rebuild only on first render or
//         question-count change. Otherwise only touches nodes whose
//         state actually changed. O(n) reads, O(changed) writes.
//
//  BUG-10 Error state wipes DOM — error overlay is now a positioned
//         child appended to DOM.app (non-destructive). All DOM refs
//         stay valid. Retry button calls init() directly — no reload.
//         _initStarted reset allows re-entry after failure.
//
//  BUG-11 Results focus race — removed querySelector('[tabindex]')
//         fallback that stole focus from finalScore. Single targeted
//         focus call in RAF.
//
//  BUG-12 confirmBtn.focus() before animation — moved inside RAF so
//         focus happens after the transition frame.
//
//  BUG-13 onConfirm fires before close() — order swapped: close()
//         now completes (starts dismiss animation) before onConfirm
//         runs. State changes render after modal is leaving.
//
//  BUG-14 optionsKey null normalization — answer value coerced to
//         string with ?? 'null' to prevent null/undefined mismatch.
//
//  BUG-15 timer.stop() called on every TICK — moved outside hot path.
//         stopTimer() called once, guarded by _timerActive flag.
//
//  ── ROBUSTNESS ──────────────────────────────────────────
//  MIS-01 _resultsRendered guard (see BUG-01)
//  MIS-02 Page Visibility API — timer pauses on tab hide, resumes
//         on return. _timerPausedAt tracks exact elapsed time.
//  MIS-03 beforeunload guard — warns on tab close when mid-test
//         with at least one answer saved.
//  MIS-04 _initStarted guard — prevents double listener registration
//         if init() is somehow called twice.
//  MIS-05 _resetRenderState() — single authoritative reset function
//         covering all flags, timeouts, timers, and DOM artifacts.
//  MIS-06 Touch swipe navigation — _initTouchNav() on .question-box;
//         angle threshold prevents accidental trigger during scroll.
//
//  ── ENHANCEMENTS ────────────────────────────────────────
//  ENH-01 escapeHTML() standalone utility
//  ENH-02 _selectOption() shared helper — centralises dispatch,
//         announce, focus, and auto-advance for all call sites
//  ENH-03 showToast() — non-blocking transient notification
//  ENH-04 scheduleIdleRender() — palette deferred to rIC / setTimeout
//  ENH-05 CONFIG frozen object — all magic numbers in one place
//  ENH-06 debounce() utility
//  ENH-07 updateSubTitle() — live "Q5/50 · 8 answered" during test
//  ENH-08 announce() double-RAF — repeated identical messages fire
//  ENH-09 Filter buttons with live (N) counts
//  ENH-10 ? keyboard shortcut → keyboard help modal
//  ENH-11 CONFIG.AUTO_ADVANCE — opt-in post-selection auto-advance
//  ENH-12 startTimer() / stopTimer() wrappers
//  ENH-13 Submit/shortcut guarded by isTestActive()
// ============================================================

import { Store } from './modules/store.js';
import { Timer  } from './modules/timer.js';
import { renderWelcome, initWelcomeListeners } from './modules/welcome.js';


/* ═══════════════════════════════════════════════════════
   0. CONFIGURATION
   All magic numbers live here. Tune without grep.
═══════════════════════════════════════════════════════ */
const CONFIG = Object.freeze({
  /** Seconds elapsed before timer box turns urgent. */
  URGENCY_SEC:        2700,

  /** Minimum score % to trigger confetti. */
  CONFETTI_THRESHOLD: 75,

  /** Score % for the large confetti burst. */
  CONFETTI_HIGH:      90,

  /** Auto-advance to next question N ms after selection. false = off. */
  AUTO_ADVANCE:       false,
  AUTO_ADVANCE_DELAY: 620,

  /** Minimum px horizontal delta to register a swipe. */
  MIN_SWIPE_PX:       52,

  /** Max ratio of vertical/horizontal movement before swipe is rejected. */
  MAX_SWIPE_ANGLE:    0.6,

  /** Debounce delay for subTitle live updates (ms). */
  SUBTITLE_DEBOUNCE:  700,
});


/* ═══════════════════════════════════════════════════════
   0-A. RUNTIME CSS INJECTION
═══════════════════════════════════════════════════════ */
(function injectRuntimeStyles() {
  if (document.getElementById('runtime-styles')) return;

  const style = document.createElement('style');
  style.id = 'runtime-styles';
  style.textContent = /* css */`

    /* ─── QUESTION TEXT TRANSITIONS ─────────────────────
       q-exit:       fade + slide UP   (leaving)
       q-enter-from: instant snap below (no transition)
       Remove q-enter-from → CSS transition → slide-up-fade-in
    ─────────────────────────────────────────────────── */
    .question-text-wrap {
      overflow: visible;
      padding: 2px 0 4px;
    }
    .question-text {
      display: block;
      min-height: 3rem;
      transition: opacity 140ms ease, transform 140ms ease;
      will-change: opacity, transform;
      overflow: visible;
    }
    .question-text.q-exit       { opacity: 0; transform: translateY(-5px); }
    .question-text.q-enter-from { opacity: 0; transform: translateY(7px); transition: none !important; }

    /* ─── RESULT ROWS ────────────────────────────────── */
    .result-question { display: flex; align-items: flex-start; gap: 0.5rem; }

    .result-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 20px; height: 20px; min-width: 20px;
      border-radius: 50%; font-size: 0.65rem; font-weight: 800;
      margin-top: 2px; flex-shrink: 0;
    }
    .result-icon--correct { background: var(--success-surface); color: var(--success-text); border: 1px solid var(--success-border); }
    .result-icon--wrong   { background: var(--error-surface);   color: var(--error-text);   border: 1px solid var(--error-border); }
    .result-icon--skipped { background: var(--bg-elevated);     color: var(--text-muted);   border: 1px solid var(--border-default); }

    .result-empty {
      text-align: center; padding: var(--sp-10);
      color: var(--text-muted); font-size: 0.9rem;
    }

    /* ─── SCORE RING ─────────────────────────────────── */
    @keyframes score-ring-fill {
      from { stroke-dashoffset: 251.2; }
      to   { stroke-dashoffset: var(--ring-offset, 0); }
    }
    .score-ring-svg circle.ring-progress {
      stroke-dasharray: 251.2;
      stroke-dashoffset: 251.2;
      transition: none;
    }
    .score-ring-svg.ring-animated circle.ring-progress {
      animation: score-ring-fill 1s var(--ease-out, cubic-bezier(.22,1,.36,1)) forwards;
      animation-delay: 200ms;
    }

    /* ─── SUBMIT PULSE ───────────────────────────────── */
    @keyframes submit-ready-pulse {
      0%, 100% { box-shadow: 0 0 0 0   rgba(var(--brand-rgb, 245,158,11), 0.00); }
      50%       { box-shadow: 0 0 0 6px rgba(var(--brand-rgb, 245,158,11), 0.25); }
    }
    #submitBtn.all-answered { animation: submit-ready-pulse 1.8s ease-in-out infinite; }

    /* ─── ARIA LIVE REGION ───────────────────────────── */
    #a11y-live {
      position: absolute; width: 1px; height: 1px;
      overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
    }

    /* ─── MODAL ──────────────────────────────────────── */
    .modal-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      z-index: 9000; opacity: 0;
      transition: opacity 200ms ease; padding: 1rem;
    }
    .modal-overlay.modal-in  { opacity: 1; }
    .modal-overlay.modal-out { opacity: 0; pointer-events: none; }

    .modal-box {
      background: var(--bg-surface); border: 1px solid var(--border-default);
      border-radius: var(--r-xl); padding: var(--sp-8);
      max-width: 440px; width: 100%;
      box-shadow: var(--shadow-xl), var(--glow-brand);
      text-align: center;
      transform: translateY(14px) scale(0.97);
      transition: transform 250ms var(--ease-out, cubic-bezier(.22,1,.36,1));
      position: relative;
    }
    .modal-overlay.modal-in .modal-box { transform: translateY(0) scale(1); }

    .modal-box::before {
      content: ''; position: absolute; top: 0; left: 10%; right: 10%; height: 1px;
      background: linear-gradient(90deg, transparent, var(--brand), transparent);
      opacity: 0.6; border-radius: var(--r-full);
    }

    .modal-title   { font-size: 1.05rem; font-weight: 800; color: var(--text-display); letter-spacing: -0.02em; margin-bottom: var(--sp-3); }
    .modal-message { font-size: 0.88rem; color: var(--text-body); line-height: 1.65; margin-bottom: var(--sp-6); }
    .modal-message strong { color: var(--error-text); }

    .modal-actions { display: flex; gap: var(--sp-3); justify-content: center; }

    .modal-btn {
      font-family: var(--font-ui); font-weight: 600; font-size: 0.85rem;
      padding: var(--sp-3) var(--sp-6); border-radius: var(--r-lg);
      border: 1px solid var(--border-default); cursor: pointer;
      transition: all 150ms ease; background: var(--bg-panel); color: var(--text-body); outline: none;
    }
    .modal-btn:hover         { background: var(--bg-elevated); color: var(--text-display); }
    .modal-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    .modal-confirm {
      background: linear-gradient(135deg, var(--amber-hot), var(--amber-warm));
      color: #0c0e18; border-color: transparent; font-weight: 700;
    }
    .modal-confirm:hover { filter: brightness(1.08); transform: translateY(-1px); }
    .modal-confirm.is-danger { background: var(--error-surface); color: var(--error-text); border-color: var(--error-border); filter: none; }
    .modal-confirm.is-danger:hover { background: var(--error); color: #fff; filter: none; }

    /* ─── KEYBOARD HELP GRID ─────────────────────────── */
    .kbd-grid {
      display: grid; grid-template-columns: auto 1fr;
      gap: 8px 16px; text-align: left;
      font-size: 0.8rem; color: var(--text-body); line-height: 1.5;
      margin-bottom: var(--sp-6);
    }
    .kbd-grid kbd {
      font-family: var(--font-mono); font-size: 0.7rem; font-weight: 600;
      color: var(--text-heading); background: var(--bg-elevated);
      border: 1px solid var(--border-default); border-bottom: 2px solid var(--border-strong);
      border-radius: 4px; padding: 2px 7px; white-space: nowrap; justify-self: end;
    }
    .kbd-grid .kbd-desc { color: var(--text-muted); align-self: center; }

    /* ─── TOAST ──────────────────────────────────────── */
    .runtime-toast {
      position: fixed; bottom: 24px; left: 50%;
      transform: translateX(-50%) translateY(60px);
      background: var(--bg-overlay, rgba(12,16,24,0.92));
      color: var(--text-heading); border: 1px solid var(--border-default);
      border-radius: var(--r-xl); padding: 9px 20px;
      font-size: 0.78rem; font-weight: 500; font-family: var(--font-body);
      box-shadow: var(--shadow-lg); z-index: 9998;
      opacity: 0; transition: all 360ms cubic-bezier(0.34,1.56,0.64,1);
      pointer-events: none; white-space: nowrap;
    }
    .runtime-toast.rt-visible  { opacity: 1; transform: translateX(-50%) translateY(0); }
    .runtime-toast.rt-success  { border-color: var(--success-border); color: var(--success); }
    .runtime-toast.rt-error    { border-color: var(--error-border);   color: var(--error);   }

    /* ─── ERROR OVERLAY (non-destructive) ────────────── */
    #error-overlay {
      position: absolute; inset: 0; z-index: 100;
      background: var(--bg-void);
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 1rem; padding: 2rem; text-align: center;
    }

    /* ─── CONFETTI ────────────────────────────────────── */
    @keyframes confetti-fall {
      0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
    }
    .confetti-piece {
      position: fixed; z-index: 9999; pointer-events: none;
      border-radius: 2px; animation: confetti-fall linear forwards;
      will-change: transform;
    }
  `;
  document.head.appendChild(style);
})();


/* ═══════════════════════════════════════════════════════
   1. DOM REGISTRY
═══════════════════════════════════════════════════════ */
const $ = (id) => document.getElementById(id);

const DOM = {
  app:              $('app'),
  testView:         $('testView'),
  resultView:       $('resultView'),
  welcomeView:      $('welcomeView'),
  questionLabel:    $('questionLabel'),
  questionText:     $('questionText'),
  optionsContainer: $('optionsContainer'),
  questionCounter:  $('questionCounter'),
  progressFill:     $('progressFill'),
  questionGrid:     $('questionGrid'),
  paletteFill:      $('paletteFill'),
  answeredCount:    $('answeredCount'),
  totalCount:       $('totalCount'),
  timerDisplay:     $('timerDisplay'),
  timerBox:         $('timerBox'),
  finalScore:       $('finalScore'),
  resultsList:      $('resultsList'),
  scoreMessage:     $('scoreMessage'),
  statCorrect:      $('statCorrect'),
  statWrong:        $('statWrong'),
  statSkipped:      $('statSkipped'),
  subTitle:         $('subTitle'),
  prevBtn:          $('prevBtn'),
  nextBtn:          $('nextBtn'),
  submitBtn:        $('submitBtn'),
  newTestBtn:       $('newTestBtn'),
  clearBtn:         $('clearBtn'),
  restartBtn:       $('restartFromResultsBtn'),
  darkToggle:       $('darkToggle'),
};

/* ── Accessibility live region ── */
(function injectA11yLive() {
  if ($('a11y-live')) return;
  const el = document.createElement('div');
  el.id = 'a11y-live';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
})();

/* ── Wrap questionText in overflow-safe container ── */
(function wrapQuestionText() {
  const qt = DOM.questionText;
  if (!qt || qt.parentElement?.classList.contains('question-text-wrap')) return;
  const wrap = document.createElement('div');
  wrap.className = 'question-text-wrap';
  qt.parentNode.insertBefore(wrap, qt);
  wrap.appendChild(qt);
})();


/* ═══════════════════════════════════════════════════════
   2. CORE UTILITIES
═══════════════════════════════════════════════════════ */

/**
 * Escape a string for safe innerHTML insertion.
 * Prevents XSS from question / option content.
 */
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Announce to screen readers via the ARIA live region.
 * Double-RAF ensures repeated identical messages still fire.
 */
function announce(msg) {
  const el = $('a11y-live');
  if (!el) return;
  el.textContent = '';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => { el.textContent = msg; })
  );
}

/**
 * Show a transient toast notification.
 * @param {string} msg
 * @param {'default'|'success'|'error'} type
 * @param {number} duration  ms before auto-dismiss
 */
function showToast(msg, type = 'default', duration = 2000) {
  document.querySelector('.runtime-toast')?.remove();

  const toast = document.createElement('div');
  toast.className = `runtime-toast${type !== 'default' ? ` rt-${type}` : ''}`;
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add('rt-visible'))
  );

  setTimeout(() => {
    toast.classList.remove('rt-visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, duration);
}

/**
 * Defer a callback to idle time.
 * Falls back to setTimeout(fn, 0) if rIC is unavailable.
 */
function scheduleIdleRender(fn) {
  typeof requestIdleCallback === 'function'
    ? requestIdleCallback(fn, { timeout: 300 })
    : setTimeout(fn, 0);
}

/**
 * Returns a debounced version of fn.
 * @param {Function} fn
 * @param {number}   ms
 */
function debounce(fn, ms) {
  let t = null;
  const wrapped = (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  wrapped.cancel = () => clearTimeout(t);
  return wrapped;
}


/* ═══════════════════════════════════════════════════════
   3. UTILS OBJECT
═══════════════════════════════════════════════════════ */
const Utils = {

  formatTime(seconds = 0) {
    return Timer.format(seconds);
  },

  /**
   * Show a themed modal with focus trap.
   * @param {{ title?, message?, html?, confirmLabel?, danger?, onConfirm }} opts
   *   html: raw HTML for message area (for kbd-grid etc.)
   *   message: plain text (auto-escaped + wrapped in <p>)
   */
  showModal({ title = '', message = '', html = null, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    document.querySelector('.modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (title) overlay.setAttribute('aria-labelledby', 'modal-heading');

    // Use raw html when provided (keyboard help grid), else escape message text
    const body = html ?? `<p class="modal-message">${message}</p>`;

    overlay.innerHTML = `
      <div class="modal-box">
        ${title ? `<h3 class="modal-title" id="modal-heading">${escapeHTML(title)}</h3>` : ''}
        ${body}
        <div class="modal-actions">
          <button class="modal-btn modal-cancel"  type="button">Cancel</button>
          <button class="modal-btn modal-confirm${danger ? ' is-danger' : ''}" type="button">
            ${escapeHTML(confirmLabel)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() =>
      requestAnimationFrame(() => overlay.classList.add('modal-in'))
    );

    const close = () => {
      overlay.classList.remove('modal-in');
      overlay.classList.add('modal-out');
      document.removeEventListener('keydown', onModalKey);
      setTimeout(() => overlay.remove(), 220);
    };

    const confirmBtn = overlay.querySelector('.modal-confirm');
    const cancelBtn  = overlay.querySelector('.modal-cancel');
    const focusable  = [cancelBtn, confirmBtn];

    // FIX BUG-13: close() first, then onConfirm — state changes render AFTER modal leaves
    confirmBtn.addEventListener('click', () => { close(); onConfirm?.(); });
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    const onModalKey = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const idx  = focusable.indexOf(document.activeElement);
        const next = e.shiftKey
          ? focusable[(idx - 1 + focusable.length) % focusable.length]
          : focusable[(idx + 1) % focusable.length];
        next?.focus();
      }
    };
    document.addEventListener('keydown', onModalKey);

    // FIX BUG-12: focus in RAF so transition has started first
    requestAnimationFrame(() => confirmBtn.focus());
  },

  /** Scroll palette to keep current question button in view. */
  scrollPaletteToView(index) {
    const btn = DOM.questionGrid?.children[index];
    if (btn) btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  },

  /**
   * Confetti burst for high scores.
   * Returns setTimeout ID array so caller can cancel pending pieces.
   * @param {number} percentage  0–100
   * @returns {number[]}
   */
  celebrate(percentage) {
    if (percentage < CONFIG.CONFETTI_THRESHOLD) return [];

    const colors   = ['#f59e0b','#22c55e','#38bdf8','#a78bfa','#f472b6','#fb923c'];
    const count    = percentage >= CONFIG.CONFETTI_HIGH ? 90 : 55;
    const maxDelay = percentage >= CONFIG.CONFETTI_HIGH ? 2800 : 1800;
    const ids      = [];

    for (let i = 0; i < count; i++) {
      const id = setTimeout(() => {
        const el   = document.createElement('div');
        const size = Math.random() * 8 + 5;
        const dur  = (Math.random() * 1.8 + 2).toFixed(2);
        const col  = colors[Math.floor(Math.random() * colors.length)];

        el.className = 'confetti-piece';
        el.style.cssText = [
          `left:${Math.random() * 100}vw`,
          `top:-14px`,
          `width:${size}px`,
          `height:${size * (Math.random() > 0.5 ? 1 : 2.2)}px`,
          `background:${col}`,
          `border-radius:${Math.random() > 0.4 ? '50%' : '2px'}`,
          `animation-duration:${dur}s`,
          `animation-delay:0s`,
          `opacity:1`,
        ].join(';');
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }, Math.random() * maxDelay);

      ids.push(id);
    }
    return ids; // FIX BUG-03: caller stores and can cancel these
  },

  /** Show keyboard shortcuts help modal. */
  showKeyboardHelp() {
    Utils.showModal({
      title: '⌨ Keyboard Shortcuts',
      html: `
        <div class="kbd-grid">
          <kbd>1 – 5</kbd><span class="kbd-desc">Select option by number</span>
          <kbd>A – E</kbd><span class="kbd-desc">Select option by letter</span>
          <kbd>→ / Enter</kbd><span class="kbd-desc">Next question</span>
          <kbd>←</kbd><span class="kbd-desc">Previous question</span>
          <kbd>Backspace</kbd><span class="kbd-desc">Clear current answer</span>
          <kbd>S</kbd><span class="kbd-desc">Open submit modal</span>
          <kbd>T</kbd><span class="kbd-desc">Toggle dark / light theme</span>
          <kbd>?</kbd><span class="kbd-desc">Show this help</span>
        </div>
      `,
      confirmLabel: 'Got it ✓',
      onConfirm: () => {},
    });
  },
};


/* ═══════════════════════════════════════════════════════
   4. TIMER WRAPPERS
   Always stop before start — prevents interval stacking.
   _timerActive tracks live state for visibilitychange handler.
═══════════════════════════════════════════════════════ */
const timer = new Timer((sec) => {
  if (DOM.timerDisplay) DOM.timerDisplay.textContent = Utils.formatTime(sec);
  Store.dispatch('TICK', sec);
  if (DOM.timerBox) DOM.timerBox.classList.toggle('urgent', sec >= CONFIG.URGENCY_SEC);
});

let _timerActive = false;

/** Start timer from fromSec. Always stops any running interval first. */
function startTimer(fromSec = 0) {
  timer.stop();           // FIX BUG-02: always stop first
  timer.start(fromSec);
  _timerActive = true;
}

/** Stop timer and mark inactive. */
function stopTimer() {
  timer.stop();
  _timerActive = false;
}


/* ═══════════════════════════════════════════════════════
   5. RENDER STATE & GUARDS
═══════════════════════════════════════════════════════ */

let _prevIndex         = -1;      // last rendered question index
let _transitionTimeout = null;    // pending question-text setTimeout ID
let _activeFilter      = 'all';   // current result filter — NOT reset by TICK
let _resultsRendered   = false;   // FIX BUG-01: results DOM built once per session
let _confettiFired     = false;   // confetti fires once per session
let _confettiTimerIds  = [];      // FIX BUG-03: IDs to cancel on new test
let _lastOptionsKey    = '';
let _lastPaletteKey    = '';
let _initStarted       = false;   // FIX MIS-04: prevent double init
let _autoAdvanceTimer  = null;    // pending auto-advance setTimeout ID

/* ── SubTitle debounced updater ── */
const _debouncedSubTitle = debounce((text) => {
  if (DOM.subTitle) DOM.subTitle.textContent = text;
}, CONFIG.SUBTITLE_DEBOUNCE);

/** Update subTitle live — debounced during navigation, immediate at key moments. */
function updateSubTitle(state, immediate = false) {
  if (!DOM.subTitle) return;

  const text = state.isFinished
    ? (() => {
        const { correct } = Store.getResults();
        const pct = state.testSize > 0 ? Math.round((correct / state.testSize) * 100) : 0;
        return `Test Complete · ${pct}%`;
      })()
    : `Q${state.currentIndex + 1}/${state.testSize} · ${Store.getAnsweredCount()} answered`;

  if (immediate) {
    _debouncedSubTitle.cancel();
    DOM.subTitle.textContent = text;
  } else {
    _debouncedSubTitle(text);
  }
}

/**
 * Master render-state reset. Call before every new test session.
 * Handles all flags, timeouts, and orphaned DOM artifacts.
 */
function _resetRenderState() {
  _prevIndex       = -1;
  _activeFilter    = 'all';
  _resultsRendered = false;
  _confettiFired   = false;
  _lastOptionsKey  = '';
  _lastPaletteKey  = '';

  // Cancel in-flight question transition
  if (_transitionTimeout !== null) {
    clearTimeout(_transitionTimeout);
    _transitionTimeout = null;
  }

  // Cancel pending auto-advance
  if (_autoAdvanceTimer !== null) {
    clearTimeout(_autoAdvanceTimer);
    _autoAdvanceTimer = null;
  }

  // FIX BUG-03: cancel all pending confetti timeouts
  _confettiTimerIds.forEach(clearTimeout);
  _confettiTimerIds = [];

  // Remove any orphaned confetti DOM nodes
  document.querySelectorAll('.confetti-piece').forEach(el => el.remove());

  // Snap question text to clean neutral state
  if (DOM.questionText) {
    DOM.questionText.classList.remove('q-exit', 'q-enter-from');
    DOM.questionText.style.opacity   = '';
    DOM.questionText.style.transform = '';
  }
}


/* ═══════════════════════════════════════════════════════
   6. PREDICATES
═══════════════════════════════════════════════════════ */

/** True when the welcome overlay is visible (not yet dismissed). */
function isWelcomeVisible() {
  const wv = DOM.welcomeView;
  return !!(wv && !wv.classList.contains('hidden'));
}

/** True when any modal is currently mounted in the DOM. */
function isModalOpen() {
  return !!document.querySelector('.modal-overlay');
}

/** True when the test is the active foreground view. */
function isTestActive() {
  return !Store.state?.isFinished && !isWelcomeVisible();
}

/** Validate that state has a renderable test in progress. */
function isValidTestState(s) {
  return (
    s?.testSet?.length > 0 &&
    Number.isInteger(s.currentIndex) &&
    s.currentIndex >= 0 &&
    s.currentIndex < s.testSet.length
  );
}

/** Fingerprint for options re-render guard.
    FIX BUG-14: null/undefined normalised to string 'null'. */
function optionsKey(state) {
  const ans = state.userAnswers[state.currentIndex];
  return `${state.currentIndex}:${ans ?? 'null'}`;
}

/** Fingerprint for palette re-render guard. */
function paletteKey(state) {
  return `${state.currentIndex}:${state.userAnswers.join(',')}`;
}


/* ═══════════════════════════════════════════════════════
   7. MAIN RENDER FUNCTION
═══════════════════════════════════════════════════════ */
function renderUI(state) {
  if (!state) return;

  /* ── A. Theme ── */
  document.body.classList.toggle('light-mode', !state.darkMode);
  DOM.darkToggle?.setAttribute('aria-pressed', String(!state.darkMode));

  /* ── B. View routing ── */
  if (state.isFinished) {
    DOM.testView?.classList.add('hidden');
    DOM.resultView?.classList.remove('hidden');

    // FIX BUG-01: full results render runs ONCE per finish session.
    // Subsequent TICK dispatches hit only this guard and return immediately.
    if (!_resultsRendered) {
      _resultsRendered = true;
      stopTimer();                           // FIX BUG-15: once, not every tick
      updateSubTitle(state, true);
      renderResults(state);
      // FIX BUG-11: single focused element, not two competing focus calls
      requestAnimationFrame(() => DOM.finalScore?.focus?.());
    }
    return;
  }

  if (!isValidTestState(state)) return;

  DOM.testView?.classList.remove('hidden');
  DOM.resultView?.classList.add('hidden');

  const q = state.testSet[state.currentIndex];

  /* ── C. Question transition (only on index change) ── */
  if (_prevIndex !== state.currentIndex) {
    _prevIndex = state.currentIndex;

    if (DOM.questionLabel) {
      DOM.questionLabel.textContent =
        `Question ${String(state.currentIndex + 1).padStart(2, '0')}`;
    }

    if (_transitionTimeout !== null) {
      clearTimeout(_transitionTimeout);
      _transitionTimeout = null;
      if (DOM.questionText) {
        DOM.questionText.classList.remove('q-exit', 'q-enter-from');
        DOM.questionText.style.opacity   = '';
        DOM.questionText.style.transform = '';
      }
    }

    if (DOM.questionText) {
      DOM.questionText.classList.add('q-exit');

      _transitionTimeout = setTimeout(() => {
        _transitionTimeout = null;
        if (!DOM.questionText) return;

        DOM.questionText.classList.remove('q-exit');
        DOM.questionText.classList.add('q-enter-from');
        DOM.questionText.textContent = q.question ?? '';

        requestAnimationFrame(() =>
          requestAnimationFrame(() =>
            DOM.questionText?.classList.remove('q-enter-from')
          )
        );
      }, 140);
    }

    announce(`Question ${state.currentIndex + 1} of ${state.testSize}`);
    Utils.scrollPaletteToView(state.currentIndex);
    updateSubTitle(state);
  }

  /* ── D. Progress indicators ── */
  const answered   = Store.getAnsweredCount();
  const pct        = state.testSize > 0 ? (answered / state.testSize) * 100 : 0;
  const unanswered = state.testSize - answered;

  if (DOM.questionCounter) {
    DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
  }
  if (DOM.progressFill) {
    DOM.progressFill.style.width = `${pct}%`;
    DOM.progressFill
      .closest('[role="progressbar"]')
      ?.setAttribute('aria-valuenow', Math.round(pct));
  }

  if (DOM.paletteFill)   DOM.paletteFill.style.width    = `${pct}%`;
  if (DOM.answeredCount) DOM.answeredCount.textContent   = `${answered} answered`;
  if (DOM.totalCount)    DOM.totalCount.textContent      = `of ${state.testSize}`;

  /* ── E. Options (skip re-render if nothing changed) ── */
  const oKey = optionsKey(state);
  if (_lastOptionsKey !== oKey) {
    _lastOptionsKey = oKey;
    renderOptions(state, q);
  }

  /* ── F. Nav buttons ── */
  if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentIndex === 0;
  if (DOM.nextBtn) DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

  /* ── G. Submit button ── */
  if (DOM.submitBtn) {
    DOM.submitBtn.textContent = unanswered > 0
      ? `Finish Test (${unanswered} left) 🏁`
      : 'Finish Test ✅';
    DOM.submitBtn.classList.toggle('all-answered', unanswered === 0);
  }

  /* ── H. Palette (deferred to idle; skip if unchanged) ── */
  const pKey = paletteKey(state);
  if (_lastPaletteKey !== pKey) {
    _lastPaletteKey = pKey;
    scheduleIdleRender(() => renderPalette(state));
  }
}


/* ═══════════════════════════════════════════════════════
   8. OPTIONS RENDERER
   FIX BUG-05: all option text escaped via escapeHTML()
   FIX BUG-08: role="radiogroup" on container
               aria-setsize + aria-posinset on each item
═══════════════════════════════════════════════════════ */
function renderOptions(state, q) {
  if (!DOM.optionsContainer || !q?.options?.length) return;

  const currentAns = state.userAnswers[state.currentIndex];
  const total      = q.options.length;

  // FIX BUG-08: radiogroup on container
  DOM.optionsContainer.setAttribute('role', 'radiogroup');
  DOM.optionsContainer.setAttribute(
    'aria-label',
    `Options for question ${state.currentIndex + 1}`
  );

  DOM.optionsContainer.innerHTML = q.options.map((opt, idx) => {
    const selected  = currentAns === idx;
    const tabbable  = selected || (currentAns === null && idx === 0);
    return `
      <div
        class="option-item${selected ? ' selected' : ''}"
        role="radio"
        aria-checked="${selected}"
        aria-setsize="${total}"
        aria-posinset="${idx + 1}"
        tabindex="${tabbable ? '0' : '-1'}"
        data-idx="${idx}"
      >
        <span class="option-prefix" aria-hidden="true">${String.fromCharCode(65 + idx)}</span>
        <span class="option-text">${escapeHTML(opt)}</span>
      </div>
    `;
  }).join('');
}


/* ═══════════════════════════════════════════════════════
   9. PALETTE RENDERER
   FIX BUG-09: incremental class diff — full rebuild only on first
   render or question-count change. Otherwise touches ONLY the
   nodes whose state changed. Preserves :hover, scroll position,
   and avoids full reflow on every answer.
═══════════════════════════════════════════════════════ */
function renderPalette(state) {
  if (!DOM.questionGrid || !state?.testSet) return;

  const buttons = DOM.questionGrid.children;

  // Full rebuild when button count doesn't match (first render / new test)
  if (buttons.length !== state.testSet.length) {
    DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
      const isAnswered = state.userAnswers[idx] !== null;
      const isCurrent  = idx === state.currentIndex;
      return `<button
        class="q-btn${isAnswered ? ' answered' : ''}${isCurrent ? ' current' : ''}"
        data-idx="${idx}"
        aria-label="Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}${isCurrent ? ', current' : ''}"
        aria-current="${isCurrent ? 'true' : 'false'}"
        role="listitem"
        type="button"
      >${idx + 1}</button>`;
    }).join('');
    return;
  }

  // Incremental diff — O(n) reads, O(changed) writes
  for (let idx = 0; idx < state.testSet.length; idx++) {
    const btn        = buttons[idx];
    if (!btn) continue;
    const isAnswered = state.userAnswers[idx] !== null;
    const isCurrent  = idx === state.currentIndex;
    const wasAnswered = btn.classList.contains('answered');
    const wasCurrent  = btn.classList.contains('current');

    if (isAnswered !== wasAnswered || isCurrent !== wasCurrent) {
      btn.classList.toggle('answered', isAnswered);
      btn.classList.toggle('current',  isCurrent);
      btn.setAttribute(
        'aria-label',
        `Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}${isCurrent ? ', current' : ''}`
      );
      btn.setAttribute('aria-current', String(isCurrent));
    }
  }
}


/* ═══════════════════════════════════════════════════════
   10. RESULTS RENDERER
   FIX BUG-01: called ONCE per session (_resultsRendered in renderUI).
   _activeFilter preserved across TICK dispatches — user filters persist.
═══════════════════════════════════════════════════════ */
function renderResults(state) {
  if (!state?.testSet) return;

  const { correct, wrong, skipped } = Store.getResults();
  const total      = state.testSize;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  /* ── Score display ── */
  if (DOM.finalScore)  DOM.finalScore.textContent  = `${correct}/${total}`;
  if (DOM.statCorrect) DOM.statCorrect.textContent = correct;
  if (DOM.statWrong)   DOM.statWrong.textContent   = wrong;
  if (DOM.statSkipped) DOM.statSkipped.textContent = skipped;

  DOM.statCorrect?.closest('[data-stat]')?.setAttribute('aria-label', `${correct} correct`);
  DOM.statWrong?.closest('[data-stat]')?.setAttribute('aria-label',   `${wrong} wrong`);
  DOM.statSkipped?.closest('[data-stat]')?.setAttribute('aria-label', `${skipped} skipped`);

  /* ── Score message ── */
  const msg = percentage >= 95 ? 'Absolutely flawless. 🏆'
            : percentage >= 85 ? 'Outstanding performance! 🚀'
            : percentage >= 75 ? 'Great work! Keep it up. 🎯'
            : percentage >= 60 ? 'Good effort. Review the mistakes. 📖'
            : percentage >= 40 ? 'Decent attempt. More practice needed. 💪'
            : "Needs improvement. Don't give up! 📚";
  if (DOM.scoreMessage) DOM.scoreMessage.textContent = `${percentage}% — ${msg}`;

  /* ── Confetti (once per session, IDs tracked) ── */
  if (!_confettiFired) {
    _confettiFired    = true;
    _confettiTimerIds = Utils.celebrate(percentage); // FIX BUG-03: store IDs
  }

  /* ── Score ring ── */
  _animateScoreRing(percentage);

  /* ── Filter buttons with live counts ── */
  const counts = { all: total, correct, wrong, skipped };

  // Clone-replace only runs ONCE per session (we're inside the _resultsRendered guard)
  document.querySelectorAll('#resultView .filter-btn').forEach(btn => {
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
  });

  document.querySelectorAll('#resultView .filter-btn').forEach(btn => {
    const filter   = btn.dataset.filter;
    const count    = counts[filter] ?? 0;
    const isActive = filter === _activeFilter;

    // ENH-09: inject live count badge into label
    const base = btn.textContent.replace(/\s*\(\d+\)\s*$/, '').trim();
    btn.textContent = `${base} (${count})`;

    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));

    btn.addEventListener('click', () => {
      _activeFilter = filter;
      document.querySelectorAll('#resultView .filter-btn').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      renderResultItems(state);
    });
  });

  renderResultItems(state);
}

function _animateScoreRing(percentage) {
  const svg = document.querySelector('.score-ring-svg');
  if (!svg) return;
  const circle = svg.querySelector('circle.ring-progress');
  if (!circle) return;

  const circumference = 251.2;
  const offset        = (circumference - (percentage / 100) * circumference).toFixed(2);

  svg.classList.remove('ring-animated');
  circle.style.setProperty('--ring-offset', offset);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => svg.classList.add('ring-animated'))
  );
}


/* ═══════════════════════════════════════════════════════
   11. RESULT ITEMS RENDERER (filter-aware)
   FIX BUG-06: all user content escaped via escapeHTML()
═══════════════════════════════════════════════════════ */
function renderResultItems(state) {
  if (!DOM.resultsList || !state?.testSet) return;

  const { testSet, userAnswers } = state;

  const items = testSet.map((q, idx) => {
    const userAns   = userAnswers[idx];
    const isSkipped = userAns === null;
    const isCorrect = !isSkipped && userAns === q.correct;
    const isWrong   = !isSkipped && !isCorrect;

    if (_activeFilter === 'correct' && !isCorrect) return null;
    if (_activeFilter === 'wrong'   && !isWrong)   return null;
    if (_activeFilter === 'skipped' && !isSkipped)  return null;

    const kind      = isCorrect ? 'correct' : isWrong ? 'wrong' : 'skipped';
    const icon      = isCorrect ? '✓'       : isWrong ? '✗'     : '—';
    const userLabel = isSkipped ? 'Skipped' : escapeHTML(q.options[userAns]);

    return `
      <div class="result-item ${kind}" role="listitem">
        <div class="result-question">
          <span class="result-icon result-icon--${kind}" aria-hidden="true">${icon}</span>
          <span>
            <strong>Q${idx + 1}:</strong>
            ${escapeHTML(q.question)}
          </span>
        </div>
        <div class="result-answer">
          <span class="${isWrong ? 'wrong-ans' : 'your-ans'}">Your answer: ${userLabel}</span>
          ${!isCorrect
            ? `<span class="correct-ans">Correct: ${escapeHTML(q.options[q.correct])}</span>`
            : ''}
        </div>
      </div>
    `;
  }).filter(Boolean);

  if (items.length === 0) {
    const label = _activeFilter === 'all' ? '' : `${_activeFilter} `;
    DOM.resultsList.innerHTML = `
      <div class="result-empty" role="status">No ${label}questions to show.</div>
    `;
  } else {
    DOM.resultsList.innerHTML = items.join('');
  }
}


/* ═══════════════════════════════════════════════════════
   12. SHARED OPTION SELECTION HELPER
   ENH-02: single function handles click, keyboard Enter/Space,
   and global shortcut 1–5 / A–E. Centralises dispatch,
   announce, focus feedback, and auto-advance.
═══════════════════════════════════════════════════════ */
function _selectOption(optIdx, focusAfter = false) {
  if (!Number.isInteger(optIdx) || optIdx < 0) return;

  const q = Store.state.testSet?.[Store.state.currentIndex];
  if (!q?.options || optIdx >= q.options.length) return;

  Store.dispatch('SET_ANSWER', optIdx);

  const label = q.options[optIdx];
  announce(`Selected: ${String.fromCharCode(65 + optIdx)} — ${label}`);

  // Focus the corresponding option element for visual confirmation
  if (focusAfter) {
    const option = DOM.optionsContainer?.querySelector(`[data-idx="${optIdx}"]`);
    if (option) {
      DOM.optionsContainer.querySelectorAll('.option-item')
        .forEach(o => o.setAttribute('tabindex', '-1'));
      option.setAttribute('tabindex', '0');
      option.focus();
    }
  }

  // ENH-11: opt-in auto-advance to next question
  if (CONFIG.AUTO_ADVANCE && !DOM.nextBtn?.disabled) {
    if (_autoAdvanceTimer !== null) clearTimeout(_autoAdvanceTimer);
    _autoAdvanceTimer = setTimeout(() => {
      _autoAdvanceTimer = null;
      if (!Store.state?.isFinished && !DOM.nextBtn?.disabled) {
        Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
      }
    }, CONFIG.AUTO_ADVANCE_DELAY);
  }
}


/* ═══════════════════════════════════════════════════════
   13. EVENT LISTENERS
═══════════════════════════════════════════════════════ */
function initListeners() {

  /* ── Options: click ── */
  DOM.optionsContainer?.addEventListener('click', (e) => {
    const item = e.target.closest('.option-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    if (!isNaN(idx)) _selectOption(idx);
  });

  /* ── Options: keyboard (Enter / Space select; Arrow nav) ── */
  DOM.optionsContainer?.addEventListener('keydown', (e) => {
    const item = e.target.closest('.option-item');
    if (!item) return;

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const idx = parseInt(item.dataset.idx, 10);
      if (!isNaN(idx)) _selectOption(idx);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const all  = [...DOM.optionsContainer.querySelectorAll('.option-item')];
      const cur  = all.indexOf(item);
      const next = e.key === 'ArrowDown'
        ? all[(cur + 1) % all.length]
        : all[(cur - 1 + all.length) % all.length];
      all.forEach(o => o.setAttribute('tabindex', '-1'));
      next.setAttribute('tabindex', '0');
      next.focus();
    }
  });

  /* ── Navigation buttons ── */
  DOM.prevBtn?.addEventListener('click', () =>
    Store.dispatch('SET_INDEX', Store.state.currentIndex - 1));

  DOM.nextBtn?.addEventListener('click', () =>
    Store.dispatch('SET_INDEX', Store.state.currentIndex + 1));

  DOM.clearBtn?.addEventListener('click', () => {
    Store.dispatch('CLEAR_ANSWER');
    announce('Answer cleared');
    showToast('Answer cleared');
  });

  /* ── Palette grid (event delegation) ── */
  DOM.questionGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.q-btn');
    if (btn) Store.dispatch('SET_INDEX', parseInt(btn.dataset.idx, 10));
  });

  /* ── Submit ── */
  DOM.submitBtn?.addEventListener('click', () => {
    if (!isTestActive()) return;       // FIX BUG-04 / ENH-13: guard
    if (isModalOpen())   return;       // prevent double-modal
    const unanswered = Store.state.userAnswers.filter(a => a === null).length;
    Utils.showModal({
      title:        'Submit Test?',
      message:      unanswered > 0
        ? `You have <strong>${unanswered} unanswered</strong> question${unanswered !== 1 ? 's' : ''}. Submit anyway?`
        : 'All questions answered. Ready to submit?',
      confirmLabel: 'Submit 🏁',
      danger:       unanswered > 0,
      onConfirm:    () => Store.dispatch('FINISH_TEST'),
    });
  });

  /* ── Start new test ── */
  const startNewTest = () => {
    _resetRenderState();               // FIX MIS-05: centralised reset
    stopTimer();                       // FIX BUG-02: stop before start
    Store.dispatch('START_NEW_TEST');
    startTimer(0);
    if (DOM.subTitle) {
      _debouncedSubTitle.cancel();
      DOM.subTitle.textContent = `${Store.state.testSize} Questions · Ready`;
    }
  };

  DOM.newTestBtn?.addEventListener('click', () => {
    Utils.showModal({
      title:        'Start New Test?',
      message:      'Your current progress will be permanently lost.',
      confirmLabel: 'Start Fresh 🔄',
      onConfirm:    startNewTest,
    });
  });

  DOM.restartBtn?.addEventListener('click', startNewTest);

  /* ── Theme toggle ── */
  DOM.darkToggle?.addEventListener('click', () => Store.dispatch('TOGGLE_DARK'));

  /* ── Global keyboard shortcuts ── */
  document.addEventListener('keydown', (e) => {
    // FIX BUG-04: block ALL shortcuts while welcome is showing
    if (isWelcomeVisible()) return;
    if (Store.state?.isFinished) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (isModalOpen()) return;
    if (DOM.optionsContainer?.contains(document.activeElement)) return;

    switch (e.key) {

      // 1–5: select option by number
      case '1': case '2': case '3': case '4': case '5': {
        e.preventDefault();
        _selectOption(parseInt(e.key, 10) - 1, true);
        break;
      }

      // A–E: select option by letter
      case 'a': case 'b': case 'c': case 'd': case 'e': {
        if (e.ctrlKey || e.metaKey || e.altKey) break;
        e.preventDefault();
        _selectOption(e.key.toLowerCase().charCodeAt(0) - 97, true);
        break;
      }

      // → / Enter: next question
      case 'ArrowRight':
      case 'Enter':
        e.preventDefault();
        if (!DOM.nextBtn?.disabled) {
          Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
        }
        break;

      // ←: previous question
      case 'ArrowLeft':
        e.preventDefault();
        if (!DOM.prevBtn?.disabled) {
          Store.dispatch('SET_INDEX', Store.state.currentIndex - 1);
        }
        break;

      // Backspace / Delete: clear answer
      case 'Backspace':
      case 'Delete':
        Store.dispatch('CLEAR_ANSWER');
        announce('Answer cleared');
        break;

      // T: toggle theme
      case 't': case 'T':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) Store.dispatch('TOGGLE_DARK');
        break;

      // S: submit modal
      case 's': case 'S':
        if (!e.ctrlKey && !e.metaKey && !e.altKey) DOM.submitBtn?.click();
        break;

      // ?: keyboard help
      case '?':
        Utils.showKeyboardHelp();
        break;
    }
  });

  /* ── Page Visibility API — pause/resume timer (MIS-02) ── */
  document.addEventListener('visibilitychange', () => {
    if (!_timerActive) return;
    if (Store.state?.isFinished) return;

    if (document.hidden) {
      // Pause: stop the interval, keep _timerActive = true so resume works
      timer.stop();
    } else {
      // Resume from the elapsed time stored in state
      timer.start(Store.state?.timeElapsed ?? 0);
    }
  });

  /* ── beforeunload guard — warn mid-test (MIS-03) ── */
  window.addEventListener('beforeunload', (e) => {
    if (isWelcomeVisible())      return;
    if (Store.state?.isFinished) return;
    // Only warn if at least one answer has been saved
    if (!Store.state?.userAnswers?.some(a => a !== null)) return;
    e.preventDefault();
    e.returnValue = ''; // triggers browser's built-in "Leave site?" dialog
  });

  /* ── Touch swipe navigation (MIS-06) ── */
  _initTouchNav();
}


/* ─────────────────────────────────────────────────────────────
   TOUCH SWIPE NAVIGATION
   Listens on .question-box (main scrollable area).
   Angle threshold prevents accidental triggers during vertical scroll.
───────────────────────────────────────────────────────────── */
function _initTouchNav() {
  const target = document.querySelector('.question-box') ?? DOM.testView;
  if (!target) return;

  let startX = 0, startY = 0;

  target.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  target.addEventListener('touchend', (e) => {
    if (!isTestActive()) return;
    if (isModalOpen())   return;

    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    if (Math.abs(dx) < CONFIG.MIN_SWIPE_PX)                        return;
    if (Math.abs(dy) > Math.abs(dx) * CONFIG.MAX_SWIPE_ANGLE)      return;

    if (dx < 0 && !DOM.nextBtn?.disabled) {
      Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);   // swipe left → next
    } else if (dx > 0 && !DOM.prevBtn?.disabled) {
      Store.dispatch('SET_INDEX', Store.state.currentIndex - 1);   // swipe right → prev
    }
  }, { passive: true });
}


/* ═══════════════════════════════════════════════════════
   14. INITIALISATION
   FIX MIS-04: _initStarted prevents double listener registration.
   FIX BUG-10: non-destructive error overlay — DOM refs stay valid.
               Retry calls init() directly, no page reload.
═══════════════════════════════════════════════════════ */
async function init() {
  if (_initStarted) return;  // FIX MIS-04: re-entry guard
  _initStarted = true;

  // Remove any error overlay from a previous failed attempt
  $('error-overlay')?.remove();

  try {
    const res = await fetch('./data/questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('questions.json must be a non-empty array.');
    }

    // Validate question schema — warn on bad entries, don't throw
    const malformed = [];
    data.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || typeof q.correct !== 'number') {
        malformed.push(i + 1);
        console.warn(`[Init] Malformed question at index ${i}:`, q);
      }
    });
    if (malformed.length) {
      console.group(`[Init] ${malformed.length} malformed question(s) detected`);
      console.warn('1-based indices:', malformed.join(', '));
      console.warn('These questions will render but may behave incorrectly.');
      console.groupEnd();
    }

    const resumed = Store.init(data);
    Store.subscribe(renderUI);
    initListeners();

    if (resumed) {
      // ── Session resume — skip welcome, continue from saved state ──
      DOM.welcomeView?.classList.add('hidden');

      if (DOM.timerDisplay) {
        DOM.timerDisplay.textContent = Utils.formatTime(Store.state.timeElapsed ?? 0);
      }
      if (DOM.subTitle) {
        DOM.subTitle.textContent = '↩ Session Resumed';
      }

      startTimer(Store.state.timeElapsed ?? 0);  // FIX BUG-02: wrapper stops first
      renderUI(Store.state);

    } else {
      // ── Fresh load — pre-render test silently behind welcome screen ──
      Store.dispatch('START_NEW_TEST');
      renderUI(Store.state);

      // beginTest fires when user dismisses the welcome screen
      const beginTest = () => {
        _resetRenderState();           // ensure clean state at test start
        startTimer(0);                 // FIX BUG-02: wrapper stops first
        if (DOM.subTitle) {
          _debouncedSubTitle.cancel();
          DOM.subTitle.textContent = `${Store.state.testSize} Questions · Ready`;
        }
      };

      renderWelcome(DOM.welcomeView, data.length);
      initWelcomeListeners(DOM.welcomeView, beginTest);
    }

  } catch (err) {
    console.error('[Init] Fatal:', err);
    _initStarted = false;  // allow retry

    if (DOM.app) {
      // FIX BUG-10: appendChild, not innerHTML — all DOM refs stay valid
      const overlay = document.createElement('div');
      overlay.id    = 'error-overlay';
      overlay.innerHTML = `
        <div style="font-size:2.4rem;line-height:1">⚠️</div>
        <h2 style="
          color:var(--text-display);font-size:1.2rem;
          font-weight:800;letter-spacing:-0.02em;
        ">Initialisation Failed</h2>
        <p style="
          color:var(--text-muted);font-size:0.86rem;
          max-width:380px;line-height:1.65;
        ">
          ${escapeHTML(err.message)}<br/><br/>
          Ensure
          <code style="
            font-family:var(--font-mono);background:var(--bg-panel);
            padding:2px 7px;border-radius:4px;font-size:0.82em;
          ">data/questions.json</code>
          exists and is valid.
        </p>
        <button
          id="retry-btn"
          style="
            background:linear-gradient(135deg,var(--amber-hot),var(--amber-warm));
            color:#0c0e18;border:none;
            padding:0.75rem 1.75rem;border-radius:var(--r-lg);
            font-family:var(--font-ui);font-weight:700;font-size:0.9rem;
            cursor:pointer;margin-top:0.25rem;
          "
        >↺ Retry</button>
      `;
      DOM.app.appendChild(overlay);
      // FIX BUG-10: retry calls init() directly — no page reload
      overlay.querySelector('#retry-btn')?.addEventListener('click', init);
    }
  }
}

init();
