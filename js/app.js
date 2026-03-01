// js/app.js
import { Store } from './modules/store.js';
import { Timer } from './modules/timer.js';

/* =====================================================
   DOM REFERENCES
===================================================== */
const DOM = {
    app: document.getElementById('app'),
    testView: document.getElementById('testView'),
    resultView: document.getElementById('resultView'),
    questionText: document.getElementById('questionText'),
    optionsContainer: document.getElementById('optionsContainer'),
    questionGrid: document.getElementById('questionGrid'),
    questionCounter: document.getElementById('questionCounter'),
    progressFill: document.getElementById('progressFill'),
    timerDisplay: document.getElementById('timerDisplay'),
    finalScore: document.getElementById('finalScore'),
    resultsList: document.getElementById('resultsList'),
    scoreMessage: document.getElementById('scoreMessage'),
    subTitle: document.getElementById('subTitle'),
    // Buttons
    prevBtn: document.getElementById('prevBtn'),
    nextBtn: document.getElementById('nextBtn'),
    submitBtn: document.getElementById('submitBtn'),
    newTestBtn: document.getElementById('newTestBtn'),
    clearBtn: document.getElementById('clearBtn'),
    restartBtn: document.getElementById('restartFromResultsBtn'),
    darkToggle: document.getElementById('darkToggle')
};

/* =====================================================
   UTILITIES
===================================================== */
const Utils = {
    formatTime(seconds = 0) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    // Custom Modal System
    showModal(message, onConfirm) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000; animation: fadeIn 0.2s ease;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: var(--bg-surface); color: var(--text-primary);
            padding: 2rem; border-radius: 1.5rem; max-width: 400px;
            text-align: center; box-shadow: var(--shadow-xl);
            border: 1px solid var(--border);
        `;
        
        box.innerHTML = `
            <p style="margin-bottom: 1.5rem; font-size: 1.1rem; line-height: 1.5;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="modalCancel" style="background: var(--bg-base); color: var(--text-heading); border: 1px solid var(--border); padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Cancel</button>
                <button id="modalConfirm" style="background: var(--brand-gradient); color: white; border: none; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer;">Confirm</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        
        box.querySelector('#modalConfirm').onclick = () => { onConfirm(); close(); };
        box.querySelector('#modalCancel').onclick = close;
    },

    scrollPaletteToView(index) {
        if (!DOM.questionGrid) return;
        const btn = DOM.questionGrid.children[index];
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }
};

/* =====================================================
   TIMER
===================================================== */
let timerOffset = 0;
const timer = new Timer((sec) => {
    const total = sec + timerOffset;
    if (DOM.timerDisplay) DOM.timerDisplay.textContent = Utils.formatTime(total);
    Store.dispatch('TICK', total);
});

/* =====================================================
   RENDERING
===================================================== */
let previousIndex = -1;

function isValidState(state) {
    return (
        state &&
        Array.isArray(state.testSet) &&
        state.testSet.length > 0 &&
        typeof state.currentIndex === 'number' &&
        state.currentIndex >= 0 &&
        state.currentIndex < state.testSet.length
    );
}

function renderUI(state) {
    if (!state) return;

    // 1. Theme
    document.body.classList.toggle('dark-mode', !!state.darkMode);

    // 2. View Logic
    if (state.isFinished) {
        if (DOM.testView) DOM.testView.classList.add('hidden');
        if (DOM.resultView) DOM.resultView.classList.remove('hidden');
        renderResults(state);
        timer.stop();
        return;
    }

    if (!isValidState(state)) return; // Safety check

    if (DOM.testView) DOM.testView.classList.remove('hidden');
    if (DOM.resultView) DOM.resultView.classList.add('hidden');

    const currentQ = state.testSet[state.currentIndex];
    
    // 3. Update Question Content (Optimized)
    if (previousIndex !== state.currentIndex) {
        if (DOM.questionText) {
            DOM.questionText.style.opacity = 0;
            setTimeout(() => {
                DOM.questionText.textContent = currentQ.question || '';
                DOM.questionText.style.opacity = 1;
            }, 100);
        }
        previousIndex = state.currentIndex;
        Utils.scrollPaletteToView(state.currentIndex);
    }

    // 4. Update Indicators
    if (DOM.questionCounter) DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
    
    const answered = Store.getAnsweredCount();
    if (DOM.progressFill) DOM.progressFill.style.width = `${(answered / state.testSize) * 100}%`;

    // 5. Render Options
    const currentAns = state.userAnswers[state.currentIndex];
    if (DOM.optionsContainer) {
        DOM.optionsContainer.innerHTML = (currentQ.options || []).map((opt, idx) => `
            <label class="option-item ${currentAns === idx ? 'selected' : ''}" data-idx="${idx}">
                <input type="radio" name="opt" value="${idx}" ${currentAns === idx ? 'checked' : ''}>
                <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
                ${opt}
            </label>
        `).join('');
    }

    // 6. Navigation State
    if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentIndex === 0;
    if (DOM.nextBtn) DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

    // 7. Render Palette
    renderPalette(state);
}

function renderPalette(state) {
    if (!DOM.questionGrid) return;
    
    // Optimization: Only update classes if already rendered? 
    // For simplicity and robustness, we re-render the grid. It's fast enough for 50 items.
    DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
        const answered = state.userAnswers[idx] !== null;
        const current = idx === state.currentIndex;
        return `<button class="q-btn ${answered ? 'answered' : ''} ${current ? 'current' : ''}" data-idx="${idx}">${idx + 1}</button>`;
    }).join('');
}

function renderResults(state) {
    if (!state || !Array.isArray(state.testSet)) return;

    const score = Store.getScore();
    const percentage = (score / state.testSize) * 100;

    if (DOM.finalScore) DOM.finalScore.textContent = `${score} / ${state.testSize}`;
    
    if (DOM.scoreMessage) {
        DOM.scoreMessage.textContent = percentage >= 80 ? 'Excellent Performance! 🚀' : 
                                       percentage >= 50 ? 'Good Job. 💪' : 
                                       'Needs Improvement. 📚';
    }

    if (!DOM.resultsList) return;

    // Filters
    DOM.resultsList.innerHTML = `
        <div class="result-filters" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="correct">Correct</button>
            <button class="filter-btn" data-filter="wrong">Wrong</button>
        </div>
        <div class="result-items-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${renderResultItems(state, 'all')}
        </div>
    `;

    // Filter Listeners
    DOM.resultsList.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOM.resultsList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const container = DOM.resultsList.querySelector('.result-items-container');
            if(container) container.innerHTML = renderResultItems(state, e.target.dataset.filter);
        });
    });
}

function renderResultItems(state, filter) {
    return state.testSet.map((q, idx) => {
        const userAns = state.userAnswers[idx];
        const isCorrect = userAns === q.correct;

        if (filter === 'correct' && !isCorrect) return '';
        if (filter === 'wrong' && isCorrect) return '';

        return `
            <div class="result-item ${isCorrect ? 'correct' : 'wrong'}">
                <div class="result-question" style="font-weight:600; margin-bottom:4px;">Q${idx+1}: ${q.question}</div>
                <div class="result-answer" style="font-size:0.85rem; opacity:0.8;">
                    You: ${userAns !== null ? q.options[userAns] : 'Skipped'} <br>
                    Correct: ${q.options[q.correct]}
                </div>
            </div>
        `;
    }).join('');
}

/* =====================================================
   LISTENERS
===================================================== */
function initListeners() {
    // Options Selection
    if (DOM.optionsContainer) {
        DOM.optionsContainer.addEventListener('click', (e) => {
            const label = e.target.closest('.option-item');
            if (!label) return;
            const idx = parseInt(label.dataset.idx);
            if (!isNaN(idx)) Store.dispatch('SET_ANSWER', idx);
        });
    }

    // Navigation
    if (DOM.prevBtn) {
        DOM.prevBtn.addEventListener('click', () => {
            Store.dispatch('SET_INDEX', Store.state.currentIndex - 1);
        });
    }

    if (DOM.nextBtn) {
        DOM.nextBtn.addEventListener('click', () => {
            Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
        });
    }

    // Clear Button
    if (DOM.clearBtn) {
        DOM.clearBtn.addEventListener('click', () => {
            Store.dispatch('CLEAR_ANSWER');
        });
    }

    // Palette Grid Navigation (Delegation)
    if (DOM.questionGrid) {
        DOM.questionGrid.addEventListener('click', (e) => {
            if (e.target.classList.contains('q-btn')) {
                Store.dispatch('SET_INDEX', parseInt(e.target.dataset.idx));
            }
        });
    }

    // Top Level Actions
    if (DOM.submitBtn) {
        DOM.submitBtn.addEventListener('click', () => {
            const unanswered = Store.state.userAnswers.filter(a => a === null).length;
            if (unanswered > 0) {
                Utils.showModal(`You have ${unanswered} unanswered questions. Submit anyway?`, () => {
                    Store.dispatch('FINISH_TEST');
                });
            } else {
                Utils.showModal('Submit the test?', () => {
                    Store.dispatch('FINISH_TEST');
                });
            }
        });
    }

    // New Test Logic
    const startNewTest = () => {
        Store.dispatch('START_NEW_TEST');
        timerOffset = 0;
        timer.start();
        if(DOM.subTitle) DOM.subTitle.textContent = `${Store.state.testSize} Questions · Powered by JSON`;
    };

    if (DOM.newTestBtn) {
        DOM.newTestBtn.addEventListener('click', () => {
            Utils.showModal('Start a fresh test? Current progress will be lost.', startNewTest);
        });
    }
    
    if (DOM.restartBtn) {
        DOM.restartBtn.addEventListener('click', startNewTest);
    }

    if (DOM.darkToggle) {
        DOM.darkToggle.addEventListener('click', () => Store.dispatch('TOGGLE_DARK'));
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (Store.state.isFinished) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key;

        // Number keys 1-4 to select options
        if (key >= '1' && key <= '4') {
            const optIdx = parseInt(key) - 1;
            const q = Store.state.testSet[Store.state.currentIndex];
            if (q && optIdx < q.options.length) {
                Store.dispatch('SET_ANSWER', optIdx);
            }
        }

        // Arrow Navigation
        if (key === 'ArrowRight' || key === 'ArrowDown') {
            e.preventDefault();
            Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
            e.preventDefault();
            Store.dispatch('SET_INDEX', Store.state.currentIndex - 1);
        }
    });
}

/* =====================================================
   INIT
===================================================== */
async function init() {
    try {
        const res = await fetch('./data/questions.json');
        if (!res.ok) throw new Error('Failed to load JSON');
        const data = await res.json();

        const resumed = Store.init(data);
        Store.subscribe(renderUI);
        initListeners();

        if (resumed) {
            timerOffset = Store.state.timeElapsed || 0;
            timer.start();
            if(DOM.subTitle) DOM.subTitle.textContent = "Resumed session";
        } else {
            Store.dispatch('START_NEW_TEST');
            timer.start();
            if(DOM.subTitle) DOM.subTitle.textContent = `${Store.state.testSize} Questions · Ready`;
        }

        renderUI(Store.state);

    } catch (err) {
        console.error('Initialization error:', err);
        document.body.innerHTML = `
            <div style="padding:2rem;text-align:center;color:red;">
                <h3>⚠ Initialization Error</h3>
                <p>Could not load application data.</p>
            </div>
        `;
    }
}

init();
