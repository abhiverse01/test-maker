// js/modules/timer.js
// Fixes: start(offset) for session resume, reset(), private naming

export class Timer {
  #interval = null;
  #seconds  = 0;
  #callback = null;

  constructor(callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('[Timer] callback must be a function');
    }
    this.#callback = callback;
  }

  /**
   * Start counting from `fromSeconds` (default 0).
   * Always stops any existing interval first.
   * @param {number} fromSeconds - Resume offset (seconds already elapsed)
   */
  start(fromSeconds = 0) {
    this.stop();
    this.#seconds = Math.max(0, Math.floor(fromSeconds));

    this.#interval = setInterval(() => {
      this.#seconds++;
      this.#callback(this.#seconds);
    }, 1000);
  }

  /** Pause the timer without resetting the counter. */
  stop() {
    if (this.#interval !== null) {
      clearInterval(this.#interval);
      this.#interval = null;
    }
  }

  /** Stop and zero out the counter. */
  reset() {
    this.stop();
    this.#seconds = 0;
  }

  /** @returns {boolean} Whether the timer is currently running. */
  get running() {
    return this.#interval !== null;
  }

  /** @returns {number} Current elapsed seconds. */
  get seconds() {
    return this.#seconds;
  }

  /**
   * Format seconds as MM:SS or H:MM:SS.
   * @param {number} sec
   * @returns {string}
   */
  static format(sec) {
    const s = Math.max(0, Math.floor(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }
}
