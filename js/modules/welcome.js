// ============================================================
//  js/modules/welcome.js — GODMODE v4.2
//  Self-contained welcome screen module.
//
//  Integration surface (3 touch-points only):
//    HTML  : add <div id="welcomeView"></div> inside .app-container
//    app.js: import { renderWelcome, initWelcomeListeners } from './modules/welcome.js';
//            add DOM.welcomeView = $('welcomeView');
//            call renderWelcome(DOM.welcomeView) + initWelcomeListeners(DOM.welcomeView, startTest)
//    CSS   : append welcome-styles block to styles.css
// ============================================================

/* ─────────────────────────────────────────────────────────────
   HTML TEMPLATE
───────────────────────────────────────────────────────────── */
function buildHTML(qCount) {
  return /* html */`

    <!-- Ambient layers -->
    <div class="wv-blob wv-blob-1" aria-hidden="true"></div>
    <div class="wv-blob wv-blob-2" aria-hidden="true"></div>
    <div class="wv-blob wv-blob-3" aria-hidden="true"></div>
    <div class="wv-dots"           aria-hidden="true"></div>

    <!-- Frame chrome -->
    <div class="wv-top-bar"        aria-hidden="true"></div>
    <div class="wv-corner wv-corner--tl" aria-hidden="true"></div>
    <div class="wv-corner wv-corner--tr" aria-hidden="true"></div>
    <div class="wv-corner wv-corner--bl" aria-hidden="true"></div>
    <div class="wv-corner wv-corner--br" aria-hidden="true"></div>

    <!-- Scrolling ticker strip -->
    <div class="wv-ticker" aria-hidden="true">
      <div class="wv-ticker-track">
        <span>⚡ TEST MAKER ENGINE</span><span class="wv-sep">·</span>
        <span>OPEN SOURCE</span><span class="wv-sep">·</span>
        <span>FREE FOREVER</span><span class="wv-sep">·</span>
        <span>ZERO BACKEND</span><span class="wv-sep">·</span>
        <span>DROP A JSON · RUN A TEST</span><span class="wv-sep">·</span>
        <span>⚡ TEST MAKER ENGINE</span><span class="wv-sep">·</span>
        <span>OPEN SOURCE</span><span class="wv-sep">·</span>
        <span>FREE FOREVER</span><span class="wv-sep">·</span>
        <span>ZERO BACKEND</span><span class="wv-sep">·</span>
        <span>DROP A JSON · RUN A TEST</span><span class="wv-sep">·</span>
      </div>
    </div>

    <!-- ── MAIN STAGE ── -->
    <main class="wv-main" role="main">

      <!-- Eyebrow badge -->
      <div class="wv-eyebrow wv-anim" style="--d:0ms">
        <span class="wv-pulse-dot" aria-hidden="true"></span>
        Open Source Quiz Platform
      </div>

      <!-- Wordmark -->
      <div class="wv-brand wv-anim" style="--d:70ms" aria-label="Test Maker Engine">
        <span class="wv-bolt" aria-hidden="true">⚡</span>
        <div class="wv-name">
          <span class="wv-n1">Test</span>
          <span class="wv-n2">Maker</span>
          <span class="wv-n3">Engine</span>
        </div>
      </div>

      <!-- Tagline -->
      <p class="wv-tagline wv-anim" style="--d:140ms">
        Drop a JSON&thinsp;—&thinsp;get a beautiful, randomised test.<br/>
        No backend. No login. No cost. Ever.
      </p>

      <!-- Feature pills -->
      <div class="wv-pills wv-anim" style="--d:210ms" role="list">
        <span class="wv-pill wv-amber" role="listitem">⚡ Zero Backend</span>
        <span class="wv-pill wv-cyan"  role="listitem">🔀 Auto Shuffle</span>
        <span class="wv-pill wv-green" role="listitem">💾 Session Resume</span>
        <span class="wv-pill wv-ghost" role="listitem">⌨ Keyboard First</span>
        <span class="wv-pill wv-ghost" role="listitem">🌗 Dark · Light</span>
      </div>

      <!-- JSON snippet -->
      <figure class="wv-code wv-anim" style="--d:290ms" aria-label="questions.json format">
        <div class="wv-code-bar" aria-hidden="true">
          <span class="wv-dot wv-dot-r"></span>
          <span class="wv-dot wv-dot-y"></span>
          <span class="wv-dot wv-dot-g"></span>
          <span class="wv-code-name">data/questions.json</span>
        </div>
        <pre class="wv-code-pre"><span class="s-bracket">[</span>
  <span class="s-bracket">{</span>
    <span class="s-key">"question"</span><span class="s-dim">:</span> <span class="s-str">"What is the capital of France?"</span><span class="s-dim">,</span>
    <span class="s-key">"options"</span><span class="s-dim">: [</span><span class="s-str">"Berlin"</span><span class="s-dim">,</span> <span class="s-str">"Madrid"</span><span class="s-dim">,</span> <span class="s-ok">"Paris"</span><span class="s-dim">,</span> <span class="s-str">"Rome"</span><span class="s-dim">],</span>
    <span class="s-key">"correct"</span><span class="s-dim">:</span>  <span class="s-num">2</span>
  <span class="s-bracket">}</span>
<span class="s-bracket">]</span></pre>
        <figcaption class="wv-code-caption">
          <span class="wv-code-caption-dot"></span>
          <strong>${qCount}</strong> questions loaded
        </figcaption>
      </figure>

      <!-- CTA -->
      <div class="wv-cta wv-anim" style="--d:370ms">
        <button id="wv-begin" class="wv-begin-btn" type="button" aria-label="Begin Test">
          <span class="wv-btn-bolt"  aria-hidden="true">⚡</span>
          <span class="wv-btn-label">Begin Test</span>
          <span class="wv-btn-arrow" aria-hidden="true">→</span>
        </button>
        <p class="wv-hint">
          <kbd>Enter</kbd> to begin &nbsp;·&nbsp; <kbd>T</kbd> toggle theme
        </p>
      </div>

    </main>

    <!-- Footer -->
    <footer class="wv-foot wv-anim" style="--d:440ms">
      <span class="wv-ver">v4.2</span>
      <span class="wv-mid-dot" aria-hidden="true">·</span>
      <span>Built by
        <a href="https://linkedin.com/in/theabhishekshah"
           target="_blank" rel="noopener noreferrer"
           class="wv-link">Abhishek Shah</a>
      </span>
      <span class="wv-mid-dot" aria-hidden="true">·</span>
      <span class="wv-free">Free &amp; Open Source</span>
    </footer>
  `;
}


/* ─────────────────────────────────────────────────────────────
   DISMISS — slides screen up + fades, then hides + calls back
───────────────────────────────────────────────────────────── */
function dismiss(el, cb) {
  el.classList.add('wv-leaving');
  el.addEventListener('animationend', () => {
    el.classList.add('hidden');
    el.classList.remove('wv-leaving');
    cb?.();
  }, { once: true });
}


/* ─────────────────────────────────────────────────────────────
   PUBLIC API
───────────────────────────────────────────────────────────── */

/**
 * Render the welcome screen HTML into `el`.
 * Idempotent — safe to call twice.
 * @param {HTMLElement} el       — #welcomeView
 * @param {number}      qCount  — total questions loaded (shown in snippet caption)
 */
export function renderWelcome(el, qCount = 50) {
  if (!el || el.dataset.wvReady) return;
  el.innerHTML = buildHTML(qCount);
  el.dataset.wvReady = 'true';

  // Trigger entrance animations on next two paint frames
  // (first RAF guarantees DOM is attached; second fires transitions)
  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      el.querySelectorAll('.wv-anim').forEach(n => n.classList.add('wv-in'))
    )
  );
}

/**
 * Wire the Begin button and Enter key to start the test.
 * @param {HTMLElement} el        — #welcomeView
 * @param {Function}    startTest — callback that starts the test (your `startNewTest`)
 */
export function initWelcomeListeners(el, startTest) {
  if (!el) return;

  const go = () => dismiss(el, startTest);

  el.querySelector('#wv-begin')?.addEventListener('click', go);

  // Enter key — only fires when welcome is visible and no modal is open
  const onKey = e => {
    if (e.key !== 'Enter') return;
    if (el.classList.contains('hidden'))  { document.removeEventListener('keydown', onKey); return; }
    if (document.querySelector('[role="dialog"]')) return;
    go();
  };
  document.addEventListener('keydown', onKey);
}
