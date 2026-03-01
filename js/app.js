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

// --- GODMODE UTILITIES ---
const Utils = {
    // Time Formatter (expands to hours if needed)
    formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        
        // If over an hour, show h:mm:ss, else mm:ss
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    },

    // Custom Modal System
    showModal(message, onConfirm, onCancel = () => {}) {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            z-index: 1000; animation: fadeIn 0.2s ease;
        `;

        const box = document.createElement('div');
        box.style.cssText = `
            background: var(--bg-secondary); color: var(--text-primary);
            padding: 2.5rem; border-radius: 1.5rem; max-width: 420px;
            text-align: center; box-shadow: var(--shadow-xl);
            border: 1px solid var(--border); transform: scale(0.95);
            animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        `;
        
        box.innerHTML = `
            <p style="margin-bottom: 2rem; font-size: 1.1rem; line-height: 1.6; font-weight: 500;">${message}</p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                <button id="modalCancel" style="
                    background: var(--bg-primary); color: var(--text-primary); 
                    border: 1px solid var(--border); padding: 0.8rem 1.5rem; 
                    border-radius: 0.75rem; font-weight: 600; cursor: pointer;
                ">Cancel</button>
                <button id="modalConfirm" style="
                    background: var(--accent-gradient); color: white; 
                    box-shadow: 0 4px 12px rgba(79,70,229,0.3); border: none;
                    padding: 0.8rem 1.5rem; border-radius: 0.75rem; 
                    font-weight: 600; cursor: pointer;
                ">Confirm</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);
        
        // Close handlers
        const close = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        };
        
        box.querySelector('#modalConfirm').onclick = () => { onConfirm(); close(); };
        box.querySelector('#modalCancel').onclick = () => { onCancel(); close(); };
    },

    // Scroll current question button into view in the palette
    scrollPaletteToView(index) {
        const btn = DOM.questionGrid.children[index];
        if (btn) {
            btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    },
    
    // Inject Bookmark Button (since we can't change HTML directly)
    injectBookmarkBtn() {
        if (document.getElementById('bookmarkBtn')) return;
        
        const btn = document.createElement('button');
        btn.id = 'bookmarkBtn';
        btn.className = 'btn-text';
        btn.innerHTML = '🔖 Save'; // Default state
        btn.style.cssText = 'margin-left: 0.5rem;';
        
        // Insert next to clear button
        DOM.clearBtn.insertAdjacentElement('afterend', btn);
        return btn;
    }
};

// --- TIMER SETUP ---
// We use an offset to handle resumed sessions
let timerOffset = 0; 
const timer = new Timer((sec) => {
    const totalSec = sec + timerOffset;
    DOM.timerDisplay.textContent = Utils.formatTime(totalSec);
    
    // Sync time to Store every second (for persistence)
    Store.dispatch('TICK', totalSec);
});

// --- UI RENDERER ---
let previousIndex = -1;
let bookmarkBtn = null;

function renderUI(state) {
    // 1. Dark Mode Handling
    document.body.classList.toggle('dark-mode', state.darkMode);

    // 2. View Switching Logic
    if (state.isFinished) {
        if (!DOM.resultView.classList.contains('hidden')) return; // Already rendered
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

    // 3. Define currentQ at the top level scope to fix ReferenceError
    const currentQ = state.testSet[state.currentIndex];

    // 4. Render Question & Options (Optimized: only if question changed)
    if (previousIndex !== state.currentIndex) {
        // Animate Question Text
        DOM.questionText.style.opacity = 0;
        DOM.questionText.style.transform = 'translateY(5px)';
        
        setTimeout(() => {
            DOM.questionText.textContent = currentQ.question;
            DOM.questionText.style.opacity = 1;
            DOM.questionText.style.transform = 'translateY(0)';
        }, 100); 

        previousIndex = state.currentIndex;
        
        // Scroll palette to view
        Utils.scrollPaletteToView(state.currentIndex);
        
        // Update Bookmark Button State
        updateBookmarkUI(state);
    }

    DOM.questionCounter.textContent = `${state.currentIndex + 1} / ${state.testSize}`;
    
    // 5. Progress Bar
    const answeredCount = Store.getAnsweredCount();
    const percent = (answeredCount / state.testSize) * 100;
    DOM.progressFill.style.width = `${percent}%`;

    // 6. Render Options
    const currentAns = state.userAnswers[state.currentIndex];
    DOM.optionsContainer.innerHTML = currentQ.options.map((opt, idx) => `
        <label class="option-item ${currentAns === idx ? 'selected' : ''}" data-idx="${idx}">
            <input type="radio" name="opt" value="${idx}" ${currentAns === idx ? 'checked' : ''}>
            <span class="option-prefix">${String.fromCharCode(65 + idx)}</span>
            ${opt}
        </label>
    `).join('');

    // 7. Navigation Buttons
    DOM.prevBtn.disabled = state.currentIndex === 0;
    DOM.nextBtn.disabled = state.currentIndex === state.testSize - 1;

    // 8. Render Palette
    renderPalette(state);
}

function updateBookmarkUI(state) {
    if (!bookmarkBtn) return;
    const isBookmarked = state.bookmarked.includes(state.currentIndex);
    bookmarkBtn.innerHTML = isBookmarked ? '🔖 Saved' : '📑 Save';
    bookmarkBtn.style.color = isBookmarked ? 'var(--accent)' : 'var(--text-secondary)';
}

function renderPalette(state) {
    DOM.questionGrid.innerHTML = state.testSet.map((_, idx) => {
        const isAnswered = state.userAnswers[idx] !== null;
        const isCurrent = idx === state.currentIndex;
        const isBookmarked = state.bookmarked.includes(idx);
        
        // Add 'bookmarked' class for CSS styling if needed
        return `<button class="q-btn ${isAnswered ? 'answered' : ''} ${isCurrent ? 'current' : ''} ${isBookmarked ? 'bookmarked' : ''}" data-idx="${idx}" title="Question ${idx+1}">${idx + 1}</button>`;
    }).join('');
}

function renderResults(state) {
    const score = Store.getScore();
    const timeTaken = state.timeElapsed || 0;
    
    DOM.finalScore.textContent = `${score} / ${state.testSize}`;
    
    // Calculate Stats
    const percentage = (score / state.testSize) * 100;
    const avgTimePerQ = (timeTaken / state.testSize).toFixed(1);
    
    DOM.scoreMessage.textContent = percentage >= 80 ? "Excellent Performance! 🚀" : 
                                   percentage >= 50 ? "Good Job! Keep practicing. 💪" : 
                                   "Needs Improvement. 📚";

    // Add Stats Row
    const statsHtml = `
        <div style="display:flex; justify-content:center; gap:2rem; margin: 1.5rem 0; color: var(--text-secondary); font-size:0.9rem;">
            <div>⏱️ Time: <strong>${Utils.formatTime(timeTaken)}</strong></div>
            <div>⚡ Avg: <strong>${avgTimePerQ}s/q</strong></div>
        </div>
    `;

    // Inject Filter Controls and Stats
    DOM.resultsList.innerHTML = `
        <div class="result-filters" style="display: flex; gap: 0.5rem; margin-bottom: 1rem; justify-content: center;">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="correct" style="color: var(--success);">Correct</button>
            <button class="filter-btn" data-filter="wrong" style="color: var(--error);">Wrong</button>
            <button class="filter-btn" data-filter="bookmark" style="color: var(--accent);">Bookmarks</button>
        </div>
        ${statsHtml}
        <div class="result-items-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${renderResultItems(state, 'all')}
        </div>
    `;

    // Add Filter Listeners
    DOM.resultsList.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            DOM.resultsList.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const container = DOM.resultsList.querySelector('.result-items-container');
            container.innerHTML = renderResultItems(state, e.target.dataset.filter);
        });
    });
}

function renderResultItems(state, filter) {
    return state.testSet.map((q, idx) => {
        const userAns = state.userAnswers[idx];
        const isCorrect = userAns === q.correct;
        const isBookmarked = state.bookmarked.includes(idx);

        // Filter Logic
        if (filter === 'correct' && !isCorrect) return '';
        if (filter === 'wrong' && isCorrect) return '';
        if (filter === 'bookmark' && !isBookmarked) return '';

        return `
            <div class="result-item ${isCorrect ? 'correct' : 'wrong'}">
                <div class="result-question">
                    <span style="opacity:0.5; margin-right:8px;">Q${idx+1}</span> 
                    ${q.question}
                    ${isBookmarked ? '🔖' : ''}
                </div>
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
    // Inject Bookmark Button
    bookmarkBtn = Utils.injectBookmarkBtn();

    // Options Delegation (with Auto-Advance feature)
    DOM.optionsContainer.addEventListener('click', (e) => {
        const label = e.target.closest('.option-item');
        if (!label) return;
        const idx = parseInt(label.dataset.idx);
        Store.dispatch('SET_ANSWER', idx);

        // GODMODE: Auto-advance to next question after selecting an answer
        // Only if not on the last question
        setTimeout(() => {
            if (Store.state.currentIndex < Store.state.testSize - 1) {
                // Optional: uncomment below to enable auto-advance
                // Store.dispatch('SET_INDEX', Store.state.currentIndex + 1);
            }
        }, 300); // Small delay for visual feedback
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

    // Bookmark Logic
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', () => Store.dispatch('TOGGLE_BOOKMARK'));
    }

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
        timerOffset = 0; // Reset offset
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
        if (Store.state.isFinished) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const key = e.key.toLowerCase();

        // Number keys 1-4 to select options
        if (key >= '1' && key <= '4') {
            const optIdx = parseInt(key) - 1;
            if (optIdx < Store.state.testSet[Store.state.currentIndex].options.length) {
                Store.dispatch('SET_ANSWER', optIdx);
            }
        }

        // Navigation Arrows
        if (key === 'arrowright' || key === 'arrowdown') {
            e.preventDefault();
            const newIdx = Store.state.currentIndex + 1;
            if (newIdx < Store.state.testSize) Store.dispatch('SET_INDEX', newIdx);
        }
        
        if (key === 'arrowleft' || key === 'arrowup') {
            e.preventDefault();
            const newIdx = Store.state.currentIndex - 1;
            if (newIdx >= 0) Store.dispatch('SET_INDEX', newIdx);
        }

        // Enter for Next/Submit
        if (key === 'enter') {
            if (Store.state.currentIndex === Store.state.testSize - 1) {
                DOM.submitBtn.click();
            } else {
                DOM.nextBtn.click();
            }
        }
        
        // 'B' for Bookmark
        if (key === 'b') {
            Store.dispatch('TOGGLE_BOOKMARK');
        }
        
        // 'C' for Clear
        if (key === 'c') {
            DOM.clearBtn.click();
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
            // Restore Timer Offset
            timerOffset = Store.state.timeElapsed || 0;
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
