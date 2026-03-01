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

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s
                .toString()
                .padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s
            .toString()
            .padStart(2, '0')}`;
    },

    scrollPaletteToView(index) {
        if (!DOM.questionGrid) return;
        const btn = DOM.questionGrid.children[index];
        if (btn) {
            btn.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }
};

/* =====================================================
   TIMER
===================================================== */

let timerOffset = 0;

const timer = new Timer((sec) => {
    const total = sec + timerOffset;
    if (DOM.timerDisplay) {
        DOM.timerDisplay.textContent = Utils.formatTime(total);
    }
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

    document.body.classList.toggle('dark-mode', !!state.darkMode);

    if (state.isFinished) {
        if (DOM.testView) DOM.testView.classList.add('hidden');
        if (DOM.resultView) DOM.resultView.classList.remove('hidden');
        renderResults(state);
        timer.stop();
        return;
    }

    if (!isValidState(state)) return;

    if (DOM.testView) DOM.testView.classList.remove('hidden');
    if (DOM.resultView) DOM.resultView.classList.add('hidden');

    const currentQ = state.testSet[state.currentIndex];
    if (!currentQ) return;

    /* Question Text */
    if (previousIndex !== state.currentIndex) {
        if (DOM.questionText) {
            DOM.questionText.textContent = currentQ.question || '';
        }
        previousIndex = state.currentIndex;
        Utils.scrollPaletteToView(state.currentIndex);
    }

    /* Counter */
    if (DOM.questionCounter) {
        DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
    }

    /* Progress */
    const answered = Store.getAnsweredCount();
    const percent = (answered / state.testSize) * 100;
    if (DOM.progressFill) {
        DOM.progressFill.style.width = `${percent}%`;
    }

    /* Options */
    const currentAns = state.userAnswers[state.currentIndex];

    if (DOM.optionsContainer) {
        DOM.optionsContainer.innerHTML = (currentQ.options || [])
            .map((opt, idx) => {
                const selected = currentAns === idx;
                return `
                    <label class="option-item ${selected ? 'selected' : ''}" data-idx="${idx}">
                        <input type="radio" name="opt" value="${idx}" ${selected ? 'checked' : ''}>
                        <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
                        ${opt}
                    </label>
                `;
            })
            .join('');
    }

    /* Navigation */
    if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentIndex === 0;
    if (DOM.nextBtn)
        DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

    renderPalette(state);
}

function renderPalette(state) {
    if (!DOM.questionGrid) return;

    DOM.questionGrid.innerHTML = state.testSet
        .map((_, idx) => {
            const answered = state.userAnswers[idx] !== null;
            const current = idx === state.currentIndex;
            return `
                <button class="q-btn 
                    ${answered ? 'answered' : ''} 
                    ${current ? 'current' : ''}" 
                    data-idx="${idx}">
                    ${idx + 1}
                </button>
            `;
        })
        .join('');
}

/* =====================================================
   RESULTS
===================================================== */

function renderResults(state) {
    if (!state || !Array.isArray(state.testSet)) return;

    const score = Store.getScore();
    const timeTaken = state.timeElapsed || 0;
    const percentage = (score / state.testSize) * 100;

    if (DOM.finalScore) {
        DOM.finalScore.textContent = `${score} / ${state.testSize}`;
    }

    if (DOM.scoreMessage) {
        DOM.scoreMessage.textContent =
            percentage >= 80
                ? 'Excellent Performance 🚀'
                : percentage >= 50
                ? 'Good Job 💪'
                : 'Needs Improvement 📚';
    }

    if (!DOM.resultsList) return;

    DOM.resultsList.innerHTML = state.testSet
        .map((q, idx) => {
            const userAns = state.userAnswers[idx];
            const correct = q.correct;
            const isCorrect = userAns === correct;

            return `
                <div class="result-item ${isCorrect ? 'correct' : 'wrong'}">
                    <div>${q.question}</div>
                    <div>
                        You: ${
                            userAns !== null ? q.options[userAns] : 'Skipped'
                        } <br>
                        Correct: ${q.options[correct]}
                    </div>
                </div>
            `;
        })
        .join('');
}

/* =====================================================
   LISTENERS
===================================================== */

function initListeners() {
    if (DOM.optionsContainer) {
        DOM.optionsContainer.addEventListener('click', (e) => {
            const label = e.target.closest('.option-item');
            if (!label) return;
            const idx = parseInt(label.dataset.idx);
            if (!isNaN(idx)) {
                Store.dispatch('SET_ANSWER', idx);
            }
        });
    }

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

    if (DOM.submitBtn) {
        DOM.submitBtn.addEventListener('click', () => {
            Store.dispatch('FINISH_TEST');
        });
    }

    if (DOM.darkToggle) {
        DOM.darkToggle.addEventListener('click', () => {
            Store.dispatch('TOGGLE_DARK');
        });
    }
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
        } else {
            Store.dispatch('START_NEW_TEST');
            timer.start();
        }

        renderUI(Store.state);
    } catch (err) {
        console.error('Initialization error:', err);
        document.body.innerHTML = `
            <div style="padding:2rem;text-align:center;">
                <h3>⚠ Initialization Error</h3>
                <p>Make sure you're running on a local server and data/questions.json exists.</p>
            </div>
        `;
    }
}

init();
