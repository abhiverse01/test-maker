// js/app.js
import { Store } from './modules/store.js';
import { Timer } from './modules/timer.js';

// --- DOM REFERENCES ---
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

const timer = new Timer((sec) => {
    DOM.timerDisplay.textContent = Timer.format(sec);
});

// --- UTILS ---
const Utils = {
    // Custom Modal System (replaces native confirm/alert)
    showModal(message, onConfirm, onCancel = () => {}) {
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
            background: var(--bg-secondary); color: var(--text-primary);
            padding: 2rem; border-radius: 1.5rem; max-width: 400px;
            text-align: center; box-shadow: var(--shadow-xl);
            border: 1px solid var(--border);
        `;
        
        box.innerHTML = `
            <p style="margin-bottom: 1.5rem; font-size: 1.1rem; line-height: 1.5;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="modalCancel" style="background: var(--neutral-bg); color: var(--text-primary); border: 1px solid var(--border);">Cancel</button>
                <button id="modalConfirm" style="background: var(--accent-gradient); color: white; box-shadow: 0 4px 12px rgba(79,70,229,0.3);">Confirm</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const close = () => overlay.remove();
        
        box.querySelector('#modalConfirm').onclick = () => { onConfirm(); close(); };
        box.querySelector('#modalCancel').onclick = () => { onCancel(); close(); };
    },

    // Scroll current question button into view in the palette
    scrollPaletteToView(index) {
        const btn = DOM.questionGrid.children[index];
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        }
    }
};

// --- UI RENDERER ---
let previousIndex = -1;

function renderUI(state) {
    // 1. Dark Mode Handling
    document.body.classList.toggle('dark-mode', state.darkMode);

    // 2. View Switching Logic
    if (state.isFinished) {
        if (!DOM.resultView.classList.contains('hidden')) return; // Already finished
        DOM.testView.classList.add('hidden');
        DOM.resultView.classList.remove('hidden');
        renderResults(state);
        timer.stop();
        return;
    } else {
        DOM.testView.classList.remove('hidden');
        DOM.resultView.classList.add('hidden');
    }

    if (!state.testSet || state.testSet.length === 0) return;

    // 3. Render Question & Options (Optimized: only if question changed)
    if (previousIndex !== state.currentIndex) {
        const currentQ = state.testSet[state.currentIndex];
        
        // Animate Question Text
        DOM.questionText.style.opacity = 0;
        DOM.questionText.style.transform = 'translateY(5px)';
        
        setTimeout(() => {
            DOM.questionText.textContent = currentQ.question;
            DOM.questionText.style.opacity = 1;
            DOM.questionText.style.transform = 'translateY(0)';
        }, 100); // Quick transition

        previousIndex = state.currentIndex;
        
        // Scroll palette to view
        Utils.scrollPaletteToView(state.currentIndex);
    }

    DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
    
    // 4. Progress Bar
    const answeredCount = Store.getAnsweredCount();
    const percent = (answeredCount / state.testSize) * 100;
    DOM.progressFill.style.width = `${percent}%`;

    // 5. Render Options
    const currentAns = state.userAnswers[state.currentIndex];
    DOM.optionsContainer.innerHTML = currentQ.options.map((opt, idx) => `
        <label class="option-item ${currentAns === idx ? 'selected' : ''}" data-idx="${idx}">
            <input type="radio" name="opt" value="${idx}" ${currentAns === idx ? 'checked' : ''}>
            <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
            ${opt}
        </label>
    `).join('');

    // 6. Navigation Buttons
    DOM.prevBtn.disabled = state.currentIndex === 0;
    DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

    // 7. Render Palette
    renderPalette(state);
}

function renderPalette(state) {
    // Optimization: Only update buttons that changed state if performance becomes an issue.
    // For 50 items, re-rendering is fine.
    DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
        const isAnswered = state.userAnswers[idx] !== null;
        const isCurrent = idx === state.currentIndex;
        return `<button class="q-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" data-idx="${idx}" title="Jump to Question ${idx+1}">${idx + 1}</button>`;
    }).join('');
}

function renderResults(state) {
    const score = Store.getScore();
    DOM.finalScore.textContent = `${score} / ${state.testSize}`;
    
    const percentage = (score / state.testSize) * 100;
    DOM.scoreMessage.textContent = percentage >= 80 ? "Excellent Performance! 🚀" : 
                                   percentage >= 50 ? "Good Job! Keep practicing. 💪" : 
                                   "Needs Improvement. 📚";

    // Inject Filter Controls
    DOM.resultsList.innerHTML = `
        <div class="result-filters" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; justify-content: center;">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="correct" style="color: var(--success);">Correct</button>
            <button class="filter-btn" data-filter="wrong" style="color: var(--error);">Wrong</button>
        </div>
        <div class="result-items-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${renderResultItems(state, 'all')}
        </div>
    `;

    // Add Filter Listeners
    DOM.resultsList.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Style active state
            DOM.resultsList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            // Re-render list
            const container = DOM.resultsList.querySelector('.result-items-container');
            container.innerHTML = renderResultItems(state, e.target.dataset.filter);
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
                <div class="result-question">Q${idx+1}: ${q.question}</div>
                <div class="result-answer">
                    <span style="color: ${isCorrect ? 'var(--success)' : 'var(--error)'}">
                        You: ${userAns !== null ? q.options[userAns] : 'Skipped'}
                    </span>
                    <span>Correct: ${q.options[q.correct]}</span>
                </div>
            </div>
        `;
    }).join('');
}

// --- EVENT LISTENERS ---
function initListeners() {
    // Options Delegation
    DOM.optionsContainer.addEventListener('click', (e) => {
        const label = e.target.closest('.option-item');
        if (!label) return;
        const idx = parseInt(label.dataset.idx);
        Store.dispatch('SET_ANSWER', idx);
    });

    // Navigation
    DOM.prevBtn.addEventListener('click', () => {
        const newIdx = Store.state.currentIndex - 1;
        if (newIdx >= 0) Store.dispatch('SET_INDEX', newIdx);
    });

    DOM.nextBtn.addEventListener('click', () => {
        const newIdx = Store.state.currentIndex + 1;
        if (newIdx < Store.state.testSize) Store.dispatch('SET_INDEX', newIdx);
    });

    DOM.clearBtn.addEventListener('click', () => {
        if (Store.state.userAnswers[Store.state.currentIndex] !== null) {
            Store.dispatch('CLEAR_ANSWER');
        }
    });

    // Palette Navigation (Delegated)
    DOM.questionGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('q-btn')) {
            Store.dispatch('SET_INDEX', parseInt(e.target.dataset.idx));
        }
    });

    // Top Level Actions
    DOM.submitBtn.addEventListener('click', () => {
        const unanswered = Store.state.userAnswers.filter(a => a === null).length;
        if (unanswered > 0) {
            Utils.showModal(
                `You have <strong>${unanswered} unanswered questions</strong>.<br>Are you sure you want to submit?`,
                () => Store.dispatch('FINISH_TEST')
            );
        } else {
            Utils.showModal(
                `You have answered all questions. Ready to see your results?`,
                () => Store.dispatch('FINISH_TEST')
            );
        }
    });

    const startTest = () => {
        Store.dispatch('START_NEW_TEST');
        timer.start();
        DOM.subTitle.textContent = `${Store.state.testSize} Questions · Powered by JSON`;
    };

    DOM.newTestBtn.addEventListener('click', () => {
        Utils.showModal(
            'Start a fresh test? Current progress will be lost.',
            startTest
        );
    });
    
    DOM.restartBtn.addEventListener('click', startTest);

    DOM.darkToggle.addEventListener('click', () => Store.dispatch('TOGGLE_DARK'));

    // --- GODMODE: KEYBOARD SHORTCUTS ---
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input field (unlikely here, but good practice)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key;

        // Number keys 1-4 to select options
        if (key >= '1' && key <= '4') {
            const optIdx = parseInt(key) - 1;
            if (optIdx < Store.state.testSet[Store.state.currentIndex].options.length) {
                Store.dispatch('SET_ANSWER', optIdx);
            }
        }

        // Arrow Keys for Navigation
        if (key === 'ArrowRight' || key === 'ArrowDown') {
            e.preventDefault();
            const newIdx = Store.state.currentIndex + 1;
            if (newIdx < Store.state.testSize) Store.dispatch('SET_INDEX', newIdx);
        }
        
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
            e.preventDefault();
            const newIdx = Store.state.currentIndex - 1;
            if (newIdx >= 0) Store.dispatch('SET_INDEX', newIdx);
        }

        // Spacebar or Enter for Next/Submit (context aware)
        if (key === 'Enter') {
            // If on last question, maybe submit, else next
            if (Store.state.currentIndex === Store.state.testSize - 1) {
                DOM.submitBtn.click();
            } else {
                DOM.nextBtn.click();
            }
        }
    });
}

// --- BOOTSTRAP ---
async function init() {
    try {
        const res = await fetch('./data/questions.json');
        if (!res.ok) throw new Error('JSON load failed');
        const data = await res.json();

        const resumed = Store.init(data);
        Store.subscribe(renderUI);
        initListeners();

        if (resumed) {
            DOM.subTitle.textContent = "Resumed from previous session";
            timer.start(); 
        } else {
            Store.dispatch('START_NEW_TEST');
            timer.start();
            DOM.subTitle.textContent = `${Store.state.testSize} Questions · Powered by JSON`;
        }
        
        renderUI(Store.state);

    } catch (err) {
        console.error(err);
        document.body.innerHTML = `
            <div style="text-align:center;padding:2rem;color:var(--error); background:var(--bg-secondary); border-radius:1rem; max-width:400px; margin:2rem auto;">
                <h3 style="margin-bottom:1rem;">⚠️ Initialization Error</h3>
                <p style="font-size:0.9rem; opacity:0.8;">Could not load question bank. Ensure you are running on a local server (e.g., Live Server) and <code>data/questions.json</code> exists.</p>
            </div>
        `;
    }
}

init();
