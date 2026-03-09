// js/app.js — GODMODE v4.0
// Fixes: theme class, timer resume, result filter structure, skipped filter,
//        modal tokens, all new DOM refs, options markup, submit label,
//        previousIndex reset, keyboard shortcuts expansion.
// New:   question transitions, confetti, result icons, urgency timer,
//        live submit label, palette mini-progress, dynamic stat pills,
//        injected CSS for modal/confetti/transitions.

import { Store } from './modules/store.js';
import { Timer  } from './modules/timer.js';


/* ═══════════════════════════════════════════════════════
   0. INJECT RUNTIME CSS (modal, confetti, transitions)
═══════════════════════════════════════════════════════ */
(function injectRuntimeStyles() {
  const style = document.createElement('style');
  style.id = 'runtime-styles';
  style.textContent = /* css */`

    /* ── Question text transition (JS-driven, not CSS anim) ── */
    .question-text {
      transition: opacity 130ms ease, transform 130ms ease;
    }
    .question-text.q-exit {
      opacity: 0;
      transform: translateY(5px);
    }

    /* ── Result question row ── */
    .result-question {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }

    /* ── Result icon badge ── */
    .result-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 20px; height: 20px;
      min-width: 20px;
      border-radius: 50%;
      font-size: 0.65rem;
      font-weight: 800;
      margin-top: 1px;
    }
    .result-icon--correct { background: var(--success-surface); color: var(--success-text); border: 1px solid var(--success-border); }
    .result-icon--wrong   { background: var(--error-surface);   color: var(--error-text);   border: 1px solid var(--error-border); }
    .result-icon--skipped { background: var(--bg-elevated);     color: var(--text-muted);   border: 1px solid var(--border-default); }

    /* ── Empty state in result list ── */
    .result-empty {
      text-align: center;
      padding: var(--sp-10);
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* ════════════════════════════════
       MODAL SYSTEM
    ════════════════════════════════ */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9000;
      opacity: 0;
      transition: opacity 200ms ease;
      padding: 1rem;
    }
    .modal-overlay.modal-in  { opacity: 1; }
    .modal-overlay.modal-out { opacity: 0; }

    .modal-box {
      background: var(--bg-surface);
      border: 1px solid var(--border-default);
      border-radius: var(--r-xl);
      padding: var(--sp-8);
      max-width: 420px;
      width: 100%;
      box-shadow: var(--shadow-xl), var(--glow-brand);
      text-align: center;
      transform: translateY(14px) scale(0.97);
      transition: transform 250ms var(--ease-out);
      position: relative;
    }
    .modal-overlay.modal-in .modal-box {
      transform: translateY(0) scale(1);
    }

    /* Top accent line on modal */
    .modal-box::before {
      content: '';
      position: absolute;
      top: 0; left: 10%; right: 10%;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--brand), transparent);
      opacity: 0.6;
      border-radius: var(--r-full);
    }

    .modal-title {
      font-size: 1.05rem;
      font-weight: 800;
      color: var(--text-display);
      letter-spacing: -0.02em;
      margin-bottom: var(--sp-3);
    }
    .modal-message {
      font-size: 0.88rem;
      color: var(--text-body);
      line-height: 1.6;
      margin-bottom: var(--sp-6);
    }
    .modal-message strong { color: var(--error-text); }

    .modal-actions {
      display: flex;
      gap: var(--sp-3);
      justify-content: center;
    }
    .modal-btn {
      font-family: var(--font-ui);
      font-weight: 600;
      font-size: 0.85rem;
      padding: var(--sp-3) var(--sp-6);
      border-radius: var(--r-lg);
      border: 1px solid var(--border-default);
      cursor: pointer;
      transition: all 150ms ease;
      background: var(--bg-panel);
      color: var(--text-body);
      outline: none;
    }
    .modal-btn:hover { background: var(--bg-elevated); color: var(--text-display); }
    .modal-btn:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }

    .modal-confirm {
      background: linear-gradient(135deg, var(--amber-hot), var(--amber-warm));
      color: #0c0e18;
      border-color: transparent;
      font-weight: 700;
    }
    .modal-confirm:hover { filter: brightness(1.08); transform: translateY(-1px); }

    .modal-confirm.is-danger {
      background: var(--error-surface);
      color: var(--error-text);
      border-color: var(--error-border);
      filter: none;
    }
    .modal-confirm.is-danger:hover {
      background: var(--error);
      color: #fff;
      filter: none;
    }

    /* ════════════════════════════════
       CONFETTI
    ════════════════════════════════ */
    @keyframes confetti-fall {
      0%   { transform: translateY(-10px) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(105vh) rotate(540deg); opacity: 0; }
    }
    .confetti-piece {
      position: fixed;
      z-index: 9999;
      pointer-events: none;
      border-radius: 2px;
      animation: confetti-fall linear forwards;
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
  // App shell
  app:              $('app'),
  testView:         $('testView'),
  resultView:       $('resultView'),

  // Question area
  questionLabel:    $('questionLabel'),
  questionText:     $('questionText'),
  optionsContainer: $('optionsContainer'),

  // Progress
  questionCounter:  $('questionCounter'),
  progressFill:     $('progressFill'),

  // Sidebar / palette
  questionGrid:     $('questionGrid'),
  paletteFill:      $('paletteFill'),
  answeredCount:    $('answeredCount'),
  totalCount:       $('totalCount'),

  // Timer
  timerDisplay:     $('timerDisplay'),
  timerBox:         $('timerBox'),

  // Results
  finalScore:       $('finalScore'),
  resultsList:      $('resultsList'),
  scoreMessage:     $('scoreMessage'),
  statCorrect:      $('statCorrect'),
  statWrong:        $('statWrong'),
  statSkipped:      $('statSkipped'),

  // Misc
  subTitle:         $('subTitle'),

  // Buttons
  prevBtn:          $('prevBtn'),
  nextBtn:          $('nextBtn'),
  submitBtn:        $('submitBtn'),
  newTestBtn:       $('newTestBtn'),
  clearBtn:         $('clearBtn'),
  restartBtn:       $('restartFromResultsBtn'),
  darkToggle:       $('darkToggle'),
};


/* ═══════════════════════════════════════════════════════
   2. UTILITIES
═══════════════════════════════════════════════════════ */
const Utils = {

  formatTime(seconds = 0) {
    return Timer.format(seconds);
  },

  /**
   * Show a themed modal dialog.
   * @param {{ title?, message, confirmLabel?, danger?, onConfirm }} opts
   */
  showModal({ title = '', message, confirmLabel = 'Confirm', danger = false, onConfirm }) {
    // Remove any stacked modal
    document.querySelector('.modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    if (title) overlay.setAttribute('aria-labelledby', 'modal-heading');

    overlay.innerHTML = `
      <div class="modal-box">
        ${title ? `<h3 class="modal-title" id="modal-heading">${title}</h3>` : ''}
        <p class="modal-message">${message}</p>
        <div class="modal-actions">
          <button class="modal-btn modal-cancel" type="button">Cancel</button>
          <button class="modal-btn modal-confirm${danger ? ' is-danger' : ''}" type="button">
            ${confirmLabel}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Animate in on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('modal-in'));
    });

    const close = () => {
      overlay.classList.remove('modal-in');
      overlay.classList.add('modal-out');
      setTimeout(() => overlay.remove(), 220);
    };

    const confirmBtn = overlay.querySelector('.modal-confirm');
    const cancelBtn  = overlay.querySelector('.modal-cancel');

    confirmBtn.addEventListener('click', () => { onConfirm(); close(); });
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Escape key
    const onKey = (e) => {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    // Focus confirm button for keyboard users
    confirmBtn.focus();
  },

  /** Smoothly scroll the palette to keep the current button visible. */
  scrollPaletteToView(index) {
    const btn = DOM.questionGrid?.children[index];
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  },

  /**
   * Confetti burst for high scores.
   * @param {number} percentage - Score percentage (0–100)
   */
  celebrate(percentage) {
    if (percentage < 75) return;

    const colors  = ['#f59e0b', '#22c55e', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c'];
    const count   = percentage >= 90 ? 90 : 55;
    const maxDelay = percentage >= 90 ? 2800 : 1800;

    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const el    = document.createElement('div');
        const size  = Math.random() * 8 + 5;
        const dur   = (Math.random() * 1.8 + 2).toFixed(2);
        const color = colors[Math.floor(Math.random() * colors.length)];

        el.className = 'confetti-piece';
        el.style.cssText = `
          left: ${Math.random() * 100}vw;
          top: -14px;
          width: ${size}px;
          height: ${size * (Math.random() > 0.5 ? 1 : 2.2)}px;
          background: ${color};
          border-radius: ${Math.random() > 0.4 ? '50%' : '2px'};
          animation-duration: ${dur}s;
          animation-delay: 0s;
          opacity: 1;
        `;

        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove(), { once: true });
      }, Math.random() * maxDelay);
    }
  },
};


/* ═══════════════════════════════════════════════════════
   3. TIMER
═══════════════════════════════════════════════════════ */
const timer = new Timer((sec) => {
  // sec already includes the resume offset (Timer.start(offset))
  if (DOM.timerDisplay) DOM.timerDisplay.textContent = Utils.formatTime(sec);
  Store.dispatch('TICK', sec);

  // Urgency: flag timer after 45 minutes (configurable)
  if (DOM.timerBox) {
    DOM.timerBox.classList.toggle('urgent', sec >= 2700);
  }
});


/* ═══════════════════════════════════════════════════════
   4. RENDER STATE
═══════════════════════════════════════════════════════ */
let _prevIndex    = -1;   // Tracks last rendered question index for transitions
let _activeFilter = 'all'; // Currently active result filter

/** Validate state has a renderable test in progress */
function isValidTestState(s) {
  return (
    s?.testSet?.length > 0 &&
    Number.isInteger(s.currentIndex) &&
    s.currentIndex >= 0 &&
    s.currentIndex < s.testSet.length
  );
}


/* ═══════════════════════════════════════════════════════
   5. MAIN RENDER FUNCTION
═══════════════════════════════════════════════════════ */
function renderUI(state) {
  if (!state) return;

  /* ── A. Theme
     New CSS: no class = dark (default), .light-mode = light
     Store: darkMode: true = dark, darkMode: false = light
  ── */
  document.body.classList.toggle('light-mode', !state.darkMode);
  DOM.darkToggle?.setAttribute('aria-pressed', String(!state.darkMode));

  /* ── B. View routing ── */
  if (state.isFinished) {
    DOM.testView?.classList.add('hidden');
    DOM.resultView?.classList.remove('hidden');
    renderResults(state);
    timer.stop();
    return;
  }

  if (!isValidTestState(state)) return;

  DOM.testView?.classList.remove('hidden');
  DOM.resultView?.classList.add('hidden');

  const q = state.testSet[state.currentIndex];

  /* ── C. Question transition (only on index change) ── */
  if (_prevIndex !== state.currentIndex) {
    _prevIndex = state.currentIndex;

    // Question label
    if (DOM.questionLabel) {
      DOM.questionLabel.textContent =
        `Question ${String(state.currentIndex + 1).padStart(2, '0')}`;
    }

    // Fade out → update → fade in
    if (DOM.questionText) {
      DOM.questionText.classList.add('q-exit');
      setTimeout(() => {
        if (DOM.questionText) {
          DOM.questionText.textContent = q.question ?? '';
          DOM.questionText.classList.remove('q-exit');
        }
      }, 130);
    }

    Utils.scrollPaletteToView(state.currentIndex);
  }

  /* ── D. Progress indicators ── */
  const answered  = Store.getAnsweredCount();
  const pct       = state.testSize > 0 ? (answered / state.testSize) * 100 : 0;
  const unanswered = state.testSize - answered;

  if (DOM.questionCounter) {
    DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
  }
  if (DOM.progressFill) {
    DOM.progressFill.style.width = `${pct}%`;
    DOM.progressFill.closest('[role="progressbar"]')?.setAttribute('aria-valuenow', Math.round(pct));
  }

  // Sidebar mini-progress
  if (DOM.paletteFill)   DOM.paletteFill.style.width = `${pct}%`;
  if (DOM.answeredCount) DOM.answeredCount.textContent = `${answered} answered`;
  if (DOM.totalCount)    DOM.totalCount.textContent    = `of ${state.testSize}`;

  /* ── E. Options ── */
  renderOptions(state, q);

  /* ── F. Nav buttons ── */
  if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentIndex === 0;
  if (DOM.nextBtn) DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

  /* ── G. Submit button — live label showing remaining ── */
  if (DOM.submitBtn) {
    DOM.submitBtn.textContent = unanswered > 0
      ? `Finish Test (${unanswered} left) 🏁`
      : 'Finish Test ✅';
  }

  /* ── H. Palette grid ── */
  renderPalette(state);
}


/* ═══════════════════════════════════════════════════════
   6. OPTIONS RENDERER
═══════════════════════════════════════════════════════ */
function renderOptions(state, q) {
  if (!DOM.optionsContainer || !q?.options?.length) return;

  const currentAns = state.userAnswers[state.currentIndex];

  // Build option divs (not label+input — CSS uses .option-item div)
  DOM.optionsContainer.innerHTML = q.options.map((opt, idx) => {
    const selected = currentAns === idx;
    return `
      <div
        class="option-item${selected ? ' selected' : ''}"
        role="radio"
        aria-checked="${selected}"
        tabindex="0"
        data-idx="${idx}"
      >
        <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
        <span class="option-text">${opt}</span>
      </div>
    `;
  }).join('');
}


/* ═══════════════════════════════════════════════════════
   7. PALETTE RENDERER
═══════════════════════════════════════════════════════ */
function renderPalette(state) {
  if (!DOM.questionGrid) return;

  DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
    const isAnswered = state.userAnswers[idx] !== null;
    const isCurrent  = idx === state.currentIndex;
    return `<button
      class="q-btn${isAnswered ? ' answered' : ''}${isCurrent ? ' current' : ''}"
      data-idx="${idx}"
      aria-label="Question ${idx + 1}${isAnswered ? ', answered' : ', unanswered'}"
      role="listitem"
    >${idx + 1}</button>`;
  }).join('');
}


/* ═══════════════════════════════════════════════════════
   8. RESULTS RENDERER
═══════════════════════════════════════════════════════ */
function renderResults(state) {
  if (!state?.testSet) return;

  const { correct, wrong, skipped } = Store.getResults();
  const total      = state.testSize;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;

  /* ── Score display ── */
  if (DOM.finalScore)   DOM.finalScore.textContent   = `${correct}/${total}`;
  if (DOM.statCorrect)  DOM.statCorrect.textContent  = correct;
  if (DOM.statWrong)    DOM.statWrong.textContent    = wrong;
  if (DOM.statSkipped)  DOM.statSkipped.textContent  = skipped;

  /* ── Score message ── */
  const msg = (() => {
    if (percentage >= 95) return 'Perfect! Absolutely flawless. 🏆';
    if (percentage >= 85) return 'Outstanding performance! 🚀';
    if (percentage >= 75) return 'Great work! Keep it up. 🎯';
    if (percentage >= 60) return 'Good effort. Review the mistakes. 📖';
    if (percentage >= 40) return 'Decent attempt. More practice needed. 💪';
    return 'Needs improvement. Don\'t give up! 📚';
  })();
  if (DOM.scoreMessage) DOM.scoreMessage.textContent = `${percentage}% — ${msg}`;

  /* ── Celebrate ── */
  Utils.celebrate(percentage);

  /* ── Bind filter buttons (already in HTML, just wire events) ──
     Fix: use querySelectorAll on resultView, NOT resultsList
     Previous bug: filters were injected INTO resultsList HTML
  ── */
  _activeFilter = 'all'; // Reset to all on new results

  document.querySelectorAll('#resultView .filter-btn').forEach(btn => {
    // Clone-replace to drop stale event listeners from previous result render
    const fresh = btn.cloneNode(true);
    btn.parentNode.replaceChild(fresh, btn);
  });

  document.querySelectorAll('#resultView .filter-btn').forEach(btn => {
    // Sync active state
    const isActive = btn.dataset.filter === _activeFilter;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));

    btn.addEventListener('click', () => {
      _activeFilter = btn.dataset.filter;

      document.querySelectorAll('#resultView .filter-btn').forEach(b => {
        const active = b === btn;
        b.classList.toggle('active', active);
        b.setAttribute('aria-pressed', String(active));
      });

      renderResultItems(state);
    });
  });

  /* ── Initial items render ── */
  renderResultItems(state);
}


/* ═══════════════════════════════════════════════════════
   9. RESULT ITEMS RENDERER (filter-aware)
═══════════════════════════════════════════════════════ */
function renderResultItems(state) {
  if (!DOM.resultsList || !state?.testSet) return;

  const { testSet, userAnswers } = state;

  const items = testSet.map((q, idx) => {
    const userAns   = userAnswers[idx];
    const isSkipped = userAns === null;
    const isCorrect = !isSkipped && userAns === q.correct;
    const isWrong   = !isSkipped && !isCorrect;

    // Filter gate
    if (_activeFilter === 'correct' && !isCorrect) return null;
    if (_activeFilter === 'wrong'   && !isWrong)   return null;
    if (_activeFilter === 'skipped' && !isSkipped)  return null;

    const kind      = isCorrect ? 'correct' : isWrong ? 'wrong' : 'skipped';
    const icon      = isCorrect ? '✓'       : isWrong ? '✗'     : '—';
    const userLabel = isSkipped ? 'Skipped' : q.options[userAns];

    return `
      <div class="result-item ${kind}" role="listitem">
        <div class="result-question">
          <span class="result-icon result-icon--${kind}" aria-hidden="true">${icon}</span>
          <span><strong>Q${idx + 1}:</strong> ${q.question}</span>
        </div>
        <div class="result-answer">
          <span class="${isWrong ? 'wrong-ans' : 'your-ans'}">
            Your answer: ${userLabel}
          </span>
          ${!isCorrect
            ? `<span class="correct-ans">Correct: ${q.options[q.correct]}</span>`
            : ''}
        </div>
      </div>
    `;
  }).filter(Boolean);

  if (items.length === 0) {
    DOM.resultsList.innerHTML = `
      <div class="result-empty">
        No ${_activeFilter === 'all' ? '' : _activeFilter + ' '}questions to show.
      </div>
    `;
  } else {
    DOM.resultsList.innerHTML = items.join('');
  }
}


/* ═══════════════════════════════════════════════════════
   10. EVENT LISTENERS
═══════════════════════════════════════════════════════ */
function initListeners() {

  /* ── Option: click ── */
  DOM.optionsContainer?.addEventListener('click', (e) => {
    const item = e.target.closest('.option-item');
    if (!item) return;
    const idx = parseInt(item.dataset.idx, 10);
    if (!isNaN(idx)) Store.dispatch('SET_ANSWER', idx);
  });

  /* ── Option: keyboard (Enter / Space) ── */
  DOM.optionsContainer?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('.option-item');
    if (!item) return;
    e.preventDefault();
    const idx = parseInt(item.dataset.idx, 10);
    if (!isNaN(idx)) Store.dispatch('SET_ANSWER', idx);
  });

  /* ── Navigation ── */
  DOM.prevBtn?.addEventListener('click', () =>
    Store.dispatch('SET_INDEX', Store.state.currentIndex - 1));

  DOM.nextBtn?.addEventListener('click', () =>
    Store.dispatch('SET_INDEX', Store.state.currentIndex + 1));

  DOM.clearBtn?.addEventListener('click', () =>
    Store.dispatch('CLEAR_ANSWER'));

  /* ── Palette grid (delegation) ── */
  DOM.questionGrid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.q-btn');
    if (btn) Store.dispatch('SET_INDEX', parseInt(btn.dataset.idx, 10));
  });

  /* ── Submit ── */
  DOM.submitBtn?.addEventListener('click', () => {
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

  /* ── Start new test (shared logic) ── */
  const startNewTest = () => {
    _prevIndex    = -1;   // Reset transition tracker
    _activeFilter = 'all';
    Store.dispatch('START_NEW_TEST');
    timer.start(0);       // Start fresh from zero (no offset)
    if (DOM.subTitle) {
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
    // Don't intercept when in modal, input field, or results view
    if (Store.state.isFinished) return;
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('.modal-overlay')) return;

    switch (e.key) {

      // 1–5: Select option by number
      case '1': case '2': case '3': case '4': case '5': {
        const optIdx = parseInt(e.key, 10) - 1;
        const q = Store.state.testSet?.[Store.state.currentIndex];
        if (q?.options && optIdx < q.options.length) {
          Store.dispatch('SET_ANSWER', optIdx);
        }
        break;
      }

      // A–E: Select option by letter
      case 'a': case 'b': case 'c': case 'd': case 'e': {
        if (e.ctrlKey || e.metaKey || e.altKey) break;
        const optIdx = e.key.toLowerCase().charCodeAt(0) - 97;
        const q = Store.state.testSet?.[Store.state.currentIndex];
        if (q?.options && optIdx < q.options.length) {
          Store.dispatch('SET_ANSWER', optIdx);
        }
        break;
      }

      // Arrow Right / Down: next question
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        if (!DOM.nextBtn?.disabled) {
          Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
        }
        break;

      // Arrow Left / Up: previous question
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        if (!DOM.prevBtn?.disabled) {
          Store.dispatch('SET_INDEX', Store.state.currentIndex - 1);
        }
        break;

      // Backspace / Delete: clear answer
      case 'Backspace':
      case 'Delete':
        Store.dispatch('CLEAR_ANSWER');
        break;

      // Enter: advance to next question
      case 'Enter':
        if (!DOM.nextBtn?.disabled) {
          Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
        }
        break;
    }
  });
}


/* ═══════════════════════════════════════════════════════
   11. INITIALISATION
═══════════════════════════════════════════════════════ */
async function init() {
  try {
    const res = await fetch('./data/questions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('questions.json must export a non-empty array of question objects.');
    }

    // Validate question schema (warn on bad entries)
    data.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || typeof q.correct !== 'number') {
        console.warn(`[Init] Question at index ${i} may be malformed:`, q);
      }
    });

    const resumed = Store.init(data);
    Store.subscribe(renderUI);
    initListeners();

    if (resumed) {
      // Resume: timer starts from saved elapsed time
      timer.start(Store.state.timeElapsed || 0);
      if (DOM.subTitle) DOM.subTitle.textContent = '↩ Session Resumed';
    } else {
      Store.dispatch('START_NEW_TEST');
      timer.start(0);
      if (DOM.subTitle) {
        DOM.subTitle.textContent = `${Store.state.testSize} Questions · Ready`;
      }
    }

    // Initial render
    renderUI(Store.state);

  } catch (err) {
    console.error('[Init] Fatal error:', err);

    if (DOM.app) {
      DOM.app.innerHTML = `
        <div style="
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; height: 100%; gap: 1rem;
          padding: 2rem; text-align: center;
        ">
          <div style="font-size: 2.5rem; line-height:1;">⚠️</div>
          <h2 style="
            color: var(--text-display);
            font-size: 1.2rem;
            font-weight: 800;
            letter-spacing: -0.02em;
          ">Initialization Failed</h2>
          <p style="
            color: var(--text-muted);
            font-size: 0.88rem;
            max-width: 360px;
            line-height: 1.6;
          ">
            ${err.message}<br>
            Ensure <code style="
              font-family: var(--font-mono);
              background: var(--bg-panel);
              padding: 2px 6px;
              border-radius: 4px;
            ">data/questions.json</code> exists and is valid.
          </p>
          <button
            onclick="location.reload()"
            style="
              background: linear-gradient(135deg, var(--amber-hot), var(--amber-warm));
              color: #0c0e18; border: none;
              padding: 0.75rem 1.75rem;
              border-radius: var(--r-lg);
              font-family: var(--font-ui);
              font-weight: 700; font-size: 0.9rem;
              cursor: pointer; margin-top: 0.5rem;
            "
          >↺ Retry</button>
        </div>
      `;
    }
  }
}

init();
