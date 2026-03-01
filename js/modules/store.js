// js/modules/store.js

const STORAGE_KEY = 'godmode_mcq_state';

export const Store = {
    state: {
        questions: [],        // Full bank
        testSet: [],          // Current 50 questions
        userAnswers: [],      // Array of indices or null
        currentIndex: 0,
        isFinished: false,
        darkMode: false,
        testSize: 50
    },

    listeners: [],

    // Subscribe to state changes
    subscribe(fn) {
        this.listeners.push(fn);
    },

    // Notify all subscribers
    notify() {
        this.listeners.forEach(fn => fn(this.state));
    },

    // Load initial state (from JSON or LocalStorage)
    init(questions) {
        const saved = localStorage.getItem(STORAGE_KEY);
        this.state.questions = questions;
        
        if (saved) {
            const parsed = JSON.parse(saved);
            // Check if saved test is valid and recent (optional logic)
            if (parsed.testSet && parsed.testSet.length > 0) {
                this.state.testSet = parsed.testSet;
                this.state.userAnswers = parsed.userAnswers;
                this.state.currentIndex = parsed.currentIndex;
                this.state.darkMode = parsed.darkMode || false;
                return true; // Resumed
            }
        }
        return false; // Fresh start needed
    },

    // Save to LocalStorage
    save() {
        const { testSet, userAnswers, currentIndex, darkMode } = this.state;
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ testSet, userAnswers, currentIndex, darkMode }));
    },

    // Actions
    dispatch(action, payload) {
        switch(action) {
            case 'START_NEW_TEST':
                this.state.testSet = this.shuffleAndSelect(this.state.questions, this.state.testSize);
                this.state.userAnswers = new Array(this.state.testSize).fill(null);
                this.state.currentIndex = 0;
                this.state.isFinished = false;
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
                this.state.currentIndex = payload;
                this.save();
                break;

            case 'FINISH_TEST':
                this.state.isFinished = true;
                localStorage.removeItem(STORAGE_KEY); // Clear saved progress on finish
                break;

            case 'TOGGLE_DARK':
                this.state.darkMode = !this.state.darkMode;
                this.save();
                break;
        }
        this.notify();
    },

    // Helper
    shuffleAndSelect(arr, size) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
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
