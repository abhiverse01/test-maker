// js/modules/store.js

const STORAGE_KEY = 'godmode_mcq_session_v2';
const HISTORY_KEY = 'godmode_mcq_history';
const SCHEMA_VERSION = 1.0; // Version control for localStorage

export const Store = {
    state: {
        questions: [],        // Full bank
        testSet: [],          // Current test questions
        userAnswers: [],      // Array of indices or null
        bookmarked: [],       // New: Bookmarked questions indices
        currentIndex: 0,
        isFinished: false,
        darkMode: false,
        testSize: 50,
        timeElapsed: 0,       // New: Persisted timer state
        startTime: null       // New: For timer calculations
    },

    listeners: [],
    history: [], // New: Stores past performance

    // --- Core System Methods ---

    subscribe(fn) {
        this.listeners.push(fn);
        // Return unsubscribe function for cleanup
        return () => this.listeners = this.listeners.filter(l => l !== fn);
    },

    notify() {
        // Optimized: Slice creates a copy to prevent mutation during iteration
        this.listeners.slice().forEach(fn => fn(this.state));
    },

    // --- Initialization & Persistence ---

    init(questions, config = {}) {
        this.state.questions = questions;
        this.state.testSize = config.testSize || 50;
        
        // Load History (Global stats)
        this._loadHistory();

        // Load Session State
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Schema Version Check: Prevent loading incompatible old states
                if (parsed.version === SCHEMA_VERSION && parsed.testSet && parsed.testSet.length > 0) {
                    this.state.testSet = parsed.testSet;
                    this.state.userAnswers = parsed.userAnswers;
                    this.state.currentIndex = parsed.currentIndex;
                    this.state.darkMode = parsed.darkMode || false;
                    this.state.bookmarked = parsed.bookmarked || [];
                    this.state.timeElapsed = parsed.timeElapsed || 0;
                    this.state.isFinished = false; // Never resume a finished state
                    return true; // Resumed successfully
                }
            } catch (e) {
                console.error("State corruption detected. Resetting.", e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        return false; // Fresh start needed
    },

    save() {
        const { testSet, userAnswers, currentIndex, darkMode, bookmarked, timeElapsed } = this.state;
        const payload = {
            version: SCHEMA_VERSION,
            testSet, 
            userAnswers, 
            currentIndex, 
            darkMode, 
            bookmarked,
            timeElapsed
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },

    // --- Actions (Dispatcher) ---

    dispatch(action, payload) {
        // Reducer pattern for predictable state updates
        switch(action) {
            case 'START_NEW_TEST':
                this._handleStartNewTest();
                break;
            
            case 'SET_ANSWER':
                // Payload: optionIndex
                this.state.userAnswers[this.state.currentIndex] = payload;
                this.save();
                break;

            case 'CLEAR_ANSWER':
                this.state.userAnswers[this.state.currentIndex] = null;
                this.save();
                break;

            case 'TOGGLE_BOOKMARK': // New Functionality
                const idx = this.state.currentIndex;
                const bmIdx = this.state.bookmarked.indexOf(idx);
                if (bmIdx > -1) {
                    this.state.bookmarked.splice(bmIdx, 1);
                } else {
                    this.state.bookmarked.push(idx);
                }
                this.save();
                break;

            case 'SET_INDEX':
                if (payload >= 0 && payload < this.state.testSize) {
                    this.state.currentIndex = payload;
                    this.save();
                }
                break;

            case 'FINISH_TEST':
                this._handleFinishTest();
                break;

            case 'TOGGLE_DARK':
                this.state.darkMode = !this.state.darkMode;
                this.save();
                break;
            
            case 'TICK': // New: Update timer without spamming save
                this.state.timeElapsed = payload;
                // Don't save to localstorage every second (performance), maybe every 10s?
                if (this.state.timeElapsed % 10 === 0) this.save(); 
                break;
        }
        
        this.notify();
    },

    // --- Subroutines & Helpers ---

    _handleStartNewTest() {
        this.state.testSet = this._shuffleAndSelect(this.state.questions, this.state.testSize);
        this.state.userAnswers = new Array(this.state.testSize).fill(null);
        this.state.bookmarked = [];
        this.state.currentIndex = 0;
        this.state.isFinished = false;
        this.state.timeElapsed = 0;
        this.save();
    },

    _handleFinishTest() {
        this.state.isFinished = true;
        this._updateHistory();
        localStorage.removeItem(STORAGE_KEY); // Clear session
    },

    // Fisher-Yates Shuffle Algorithm (Unbiased)
    _shuffleAndSelect(arr, size) {
        const shuffled = [...arr];
        let currentIndex = shuffled.length, randomIndex;

        // While there remain elements to shuffle.
        while (currentIndex !== 0) {
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            // Swap it with the current element.
            [shuffled[currentIndex], shuffled[randomIndex]] = [
                shuffled[randomIndex], shuffled[currentIndex]
            ];
        }

        return shuffled.slice(0, size);
    },

    _loadHistory() {
        try {
            const data = localStorage.getItem(HISTORY_KEY);
            if (data) this.history = JSON.parse(data);
        } catch (e) {
            this.history = [];
        }
    },

    _updateHistory() {
        const score = this.getScore();
        const { testSize, timeElapsed } = this.state;
        
        // Keep last 10 entries
        if (this.history.length >= 10) this.history.shift();
        
        this.history.push({
            date: new Date().toISOString(),
            score: score,
            total: testSize,
            time: timeElapsed
        });

        localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    },

    // --- Getters / Selectors ---

    getAnsweredCount() {
        return this.state.userAnswers.filter(a => a !== null).length;
    },

    getScore() {
        let correct = 0;
        this.state.testSet.forEach((q, i) => {
            if (this.state.userAnswers[i] === q.correct) correct++;
        });
        return correct;
    },

    // New: Helper to check if current question is bookmarked
    isCurrentBookmarked() {
        return this.state.bookmarked.includes(this.state.currentIndex);
    },

    // New: Get historical stats for dashboard/analytics
    getHistoryStats() {
        return this.history;
    }
};
