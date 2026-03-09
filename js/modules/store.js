// js/modules/store.js — GODMODE v4.0
// Fixes: darkMode default true, getResults(), safe save, typed dispatch

const STORAGE_KEY    = 'testmaker_session_v4';
const SCHEMA_VERSION = 2.0;

export const Store = {

  /* ── STATE ─────────────────────────────────────────── */
  state: {
    questions:    [],
    testSet:      [],
    userAnswers:  [],
    currentIndex: 0,
    isFinished:   false,
    darkMode:     true,   // Dark is the default theme — was incorrectly false
    testSize:     50,
    timeElapsed:  0,
  },

  _listeners: [],

  /* ── SUBSCRIBE ──────────────────────────────────────── */
  subscribe(fn) {
    if (typeof fn !== 'function') throw new TypeError('[Store] listener must be a function');
    this._listeners.push(fn);
    // Returns unsubscribe function
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  },

  _notify() {
    // Shallow copy prevents accidental external mutation of state
    const snapshot = { ...this.state, userAnswers: [...this.state.userAnswers] };
    this._listeners.forEach(fn => {
      try { fn(snapshot); }
      catch (e) { console.error('[Store] Listener threw:', e); }
    });
  },

  /* ── INIT (load / resume) ───────────────────────────── */
  /**
   * Load questions into store, attempt to resume a saved session.
   * @param {Array}  questions  - Full question bank
   * @param {object} config     - Optional: { testSize }
   * @returns {boolean} true if a session was resumed
   */
  init(questions, config = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('[Store] questions must be a non-empty array');
    }

    this.state.questions = questions;
    if (config.testSize) this.state.testSize = config.testSize;

    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const saved = JSON.parse(raw);
        if (
          saved.version === SCHEMA_VERSION &&
          Array.isArray(saved.testSet) &&
          saved.testSet.length > 0 &&
          Array.isArray(saved.userAnswers)
        ) {
          Object.assign(this.state, {
            testSet:      saved.testSet,
            userAnswers:  saved.userAnswers,
            currentIndex: Math.max(0, saved.currentIndex ?? 0),
            darkMode:     saved.darkMode ?? true,
            timeElapsed:  saved.timeElapsed ?? 0,
            testSize:     saved.testSet.length,
            isFinished:   false,
          });
          console.info(`[Store] Session resumed — ${saved.testSet.length}q, ${saved.timeElapsed}s`);
          return true;
        }
      } catch (e) {
        console.warn('[Store] Corrupt session data, starting fresh.', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    return false;
  },

  /* ── PERSIST ────────────────────────────────────────── */
  _save() {
    try {
      const { testSet, userAnswers, currentIndex, darkMode, timeElapsed } = this.state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        version: SCHEMA_VERSION,
        testSet, userAnswers, currentIndex, darkMode, timeElapsed,
      }));
    } catch (e) {
      // e.g. QuotaExceededError — don't crash the app
      console.warn('[Store] localStorage save failed:', e.name);
    }
  },

  /* ── DISPATCH ───────────────────────────────────────── */
  dispatch(action, payload) {
    switch (action) {

      /* Start a fresh randomised test */
      case 'START_NEW_TEST': {
        const desired = this.state.testSize;
        const actual  = Math.min(desired, this.state.questions.length);
        this.state.testSet      = this._shuffle(this.state.questions, actual);
        this.state.testSize     = this.state.testSet.length;
        this.state.userAnswers  = new Array(this.state.testSize).fill(null);
        this.state.currentIndex = 0;
        this.state.isFinished   = false;
        this.state.timeElapsed  = 0;
        this._save();
        break;
      }

      /* Record an answer for the current question */
      case 'SET_ANSWER': {
        if (!Number.isInteger(payload) || payload < 0) break;
        const q = this.state.testSet[this.state.currentIndex];
        if (!q || payload >= (q.options?.length ?? 0)) break;
        this.state.userAnswers[this.state.currentIndex] = payload;
        this._save();
        break;
      }

      /* Clear the answer for the current question */
      case 'CLEAR_ANSWER': {
        this.state.userAnswers[this.state.currentIndex] = null;
        this._save();
        break;
      }

      /* Navigate to a question by index */
      case 'SET_INDEX': {
        const idx = payload;
        if (Number.isInteger(idx) && idx >= 0 && idx < this.state.testSize) {
          this.state.currentIndex = idx;
          this._save();
        }
        break;
      }

      /* Mark test as complete and clear saved session */
      case 'FINISH_TEST': {
        this.state.isFinished = true;
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
        break;
      }

      /* Toggle between dark / light theme */
      case 'TOGGLE_DARK': {
        this.state.darkMode = !this.state.darkMode;
        this._save();
        break;
      }

      /* Update elapsed time (throttled persist) */
      case 'TICK': {
        const t = payload;
        if (typeof t !== 'number') break;
        this.state.timeElapsed = t;
        // Persist every 15 seconds to limit writes
        if (t % 15 === 0) this._save();
        break;
      }

      default:
        console.warn(`[Store] Unknown action dispatched: "${action}"`);
        return; // Skip notify for unknown actions
    }

    this._notify();
  },

  /* ── HELPERS ────────────────────────────────────────── */

  /** Fisher-Yates shuffle + slice. Does not mutate the source array. */
  _shuffle(arr, size) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, size);
  },

  /** Number of answered questions in the current test. */
  getAnsweredCount() {
    return this.state.userAnswers.filter(a => a !== null).length;
  },

  /** Total correct answers. */
  getScore() {
    return this.state.testSet.reduce((acc, q, i) => {
      return acc + (this.state.userAnswers[i] === q.correct ? 1 : 0);
    }, 0);
  },

  /**
   * Full result breakdown — correct / wrong / skipped.
   * @returns {{ correct: number, wrong: number, skipped: number }}
   */
  getResults() {
    let correct = 0, wrong = 0, skipped = 0;
    this.state.testSet.forEach((q, i) => {
      const ans = this.state.userAnswers[i];
      if (ans === null)            skipped++;
      else if (ans === q.correct)  correct++;
      else                         wrong++;
    });
    return { correct, wrong, skipped };
  },
};
