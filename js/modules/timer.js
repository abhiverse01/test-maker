// js/modules/timer.js

export class Timer {
    constructor(callback) {
        this.interval = null;
        this.seconds = 0;
        this.callback = callback;
    }

    start() {
        this.stop();
        this.seconds = 0;
        this.interval = setInterval(() => {
            this.seconds++;
            this.callback(this.seconds);
        }, 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    static format(sec) {
        const m = Math.floor(sec / 60).toString().padStart(2, '0');
        const s = (sec % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }
}
