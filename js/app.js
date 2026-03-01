// js/app.js
import { Store } from './modules/store.js';
import { Timer } from './modules/timer.js';

// --- DOM References ---
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

// --- UI Renderer ---
function renderUI(state) {
    // Handle Dark Mode
    document.body.classList.toggle('dark-mode', state.darkMode);
    
    // Handle View Switching
    if (state.isFinished) {
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

    // Render Current Question
    const currentQ = state.testSet[state.currentIndex];
    DOM.questionText.textContent = currentQ.question;
    DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
    
    // Progress Bar
    const answeredCount = Store.getAnsweredCount();
    const percent = (answeredCount / state.testSize) * 100;
    DOM.progressFill.style.width = `${percent}%`;

    // Render Options
    const currentAns = state.userAnswers[state.currentIndex];
    DOM.optionsContainer.innerHTML = currentQ.options.map((opt, idx) => `
        <label class="option-item ${currentAns === idx ? 'selected' : ''}" data-idx="${idx}">
            <input type="radio" name="opt" value="${idx}" ${currentAns === idx ? 'checked' : ''}>
            <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
            ${opt}
        </label>
    `).join('');

    // Navigation Buttons
    DOM.prevBtn.disabled = state.currentIndex === 0;
    DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

    // Render Palette
    renderPalette(state);
}

function renderPalette(state) {
    DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
        const isAnswered = state.userAnswers[idx] !== null;
        const isCurrent = idx === state.currentIndex;
        return `<button class="q-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''}" data-idx="${idx}">${idx + 1}</button>`;
    }).join('');
}

function renderResults(state) {
    const score = Store.getScore();
    DOM.finalScore.textContent = `${score} / ${state.testSize}`;
    
    const percentage = (score / state.testSize) * 100;
    DOM.scoreMessage.textContent = percentage >= 80 ? "Excellent Performance! 🚀" : 
                                   percentage >= 50 ? "Good Job! Keep practicing. 💪" : 
                                   "Needs Improvement. 📚";

    DOM.resultsList.innerHTML = state.testSet.map((q, idx) => {
        const userAns = state.userAnswers[idx];
        const isCorrect = userAns === q.correct;
        
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

// --- Event Listeners ---
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

    DOM.clearBtn.addEventListener('click', () => Store.dispatch('CLEAR_ANSWER'));

    // Palette Navigation
    DOM.questionGrid.addEventListener('click', (e) => {
        if (e.target.classList.contains('q-btn')) {
            Store.dispatch('SET_INDEX', parseInt(e.target.dataset.idx));
        }
    });

    // Top Level Actions
    DOM.submitBtn.addEventListener('click', () => {
        const unanswered = Store.state.userAnswers.filter(a => a === null).length;
        if (unanswered === 0 || confirm(`You have ${unanswered} unanswered questions. Submit anyway?`)) {
            Store.dispatch('FINISH_TEST');
        }
    });

    const startTest = () => {
        Store.dispatch('START_NEW_TEST');
        timer.start();
        DOM.subTitle.textContent = `${Store.state.testSize} Questions · Powered by JSON`;
    };

    DOM.newTestBtn.addEventListener('click', startTest);
    DOM.restartBtn.addEventListener('click', startTest);

    DOM.darkToggle.addEventListener('click', () => Store.dispatch('TOGGLE_DARK'));
}

// --- Bootstrap ---
async function init() {
    try {
        // Load JSON data
        const res = await fetch('./data/questions.json');
        if (!res.ok) throw new Error('JSON load failed');
        const data = await res.json();

        // Initialize Store
        const resumed = Store.init(data);
        
        // Subscribe UI to Store
        Store.subscribe(renderUI);

        // Setup Events
        initListeners();

        // Initial Render
        if (resumed) {
            DOM.subTitle.textContent = "Resumed from previous session";
            timer.start(); // Ideally, we'd save timer state too, but this restarts it.
        } else {
            Store.dispatch('START_NEW_TEST');
            timer.start();
            DOM.subTitle.textContent = `${Store.state.testSize} Questions · Powered by JSON`;
        }
        
        renderUI(Store.state);

    } catch (err) {
        console.error(err);
        document.body.innerHTML = '<div style="text-align:center;padding:2rem;color:red;">Error loading application data. Ensure you are running on a local server (e.g., Live Server).</div>';
    }
}

init();
