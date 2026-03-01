// js/modules/store.js

const STORAGE_KEY = 'godmode_mcq_session_v2';
const SCHEMA_VERSION = 1.1;

export const Store = {
    state: {
        questions: [],
        testSet: [],
        userAnswers: [],
        currentIndex: 0,
        isFinished: false,
        darkMode: false,
        testSize: 50, // Target size
        timeElapsed: 0
    },

    listeners: [],

    subscribe(fn) {
        this.listeners.push(fn);
        return () => this.listeners = this.listeners.filter(l => l !== fn);
    },

    notify() {
        this.listeners.slice().forEach(fn => fn(this.state));
    },

    init(questions, config = {}) {
        this.state.questions = questions;
        
        // Attempt Resume
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.version === SCHEMA_VERSION && parsed.testSet && parsed.testSet.length > 0) {
                    this.state.testSet = parsed.testSet;
                    this.state.userAnswers = parsed.userAnswers;
                    this.state.currentIndex = parsed.currentIndex;
                    this.state.darkMode = parsed.darkMode || false;
                    this.state.timeElapsed = parsed.timeElapsed || 0;
                    this.state.testSize = parsed.testSet.length; // Sync size
                    this.state.isFinished = false;
                    return true;
                }
            } catch (e) {
                console.error("State corruption", e);
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        return false;
    },

    save() {
        const { testSet, userAnswers, currentIndex, darkMode, timeElapsed } = this.state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            version: SCHEMA_VERSION,
            testSet, userAnswers, currentIndex, darkMode, timeElapsed
        }));
    },

    dispatch(action, payload) {
        switch(action) {
            case 'START_NEW_TEST':
                const desiredSize = this.state.testSize;
                // FIX: Ensure we don't ask for more questions than exist
                const actualSize = Math.min(desiredSize, this.state.questions.length);
                this.state.testSet = this._shuffleAndSelect(this.state.questions, actualSize);
                // FIX: Sync testSize to actual set length
                this.state.testSize = this.state.testSet.length; 
                this.state.userAnswers = new Array(this.state.testSize).fill(null);
                this.state.currentIndex = 0;
                this.state.isFinished = false;
                this.state.timeElapsed = 0;
                this.save();
                break;
            
            case 'SET_ANSWER':
                this.state.userAnswers[this.state.currentIndex] = payload;
                this.save();
                break;

            case 'CLEAR_ANSWER':
                this.state.userAnswers[this.state.currentIndex] = null;
                this.save();
                break;

            case 'SET_INDEX':
                // FIX: Strict bounds checking
                if (payload >= 0 && payload < this.state.testSize) {
                    this.state.currentIndex = payload;
                    this.save();
                }
                break;

            case 'FINISH_TEST':
                this.state.isFinished = true;
                localStorage.removeItem(STORAGE_KEY);
                break;

            case 'TOGGLE_DARK':
                this.state.darkMode = !this.state.darkMode;
                this.save();
                break;
            
            case 'TICK':
                this.state.timeElapsed = payload;
                // Throttle save to every 10s for performance
                if (this.state.timeElapsed % 10 === 0) this.save(); 
                break;
        }
        this.notify();
    },

    // Proper Fisher-Yates Shuffle
    _shuffleAndSelect(arr, size) {
        const shuffled = [...arr];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled.slice(0, size);
    },

    getAnsweredCount() {
        return this.state.userAnswers.filter(a => a !== null).length;
    },

    getScore() {
        let correct = 0;
        this.state.testSet.forEach((q, i) => {
            if (this.state.userAnswers[i] === q.correct) correct++;
        });
        return correct;
    }
};
