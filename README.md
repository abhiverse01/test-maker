<div align="center">

<!-- HERO BANNER -->
<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=f59e0b&height=200&section=header&text=⚡%20Test%20Maker%20Engine&fontSize=52&fontColor=0c1018&fontAlignY=38&desc=Precision-crafted%20quiz%20platform.%20Zero%20backend.%20Pure%20speed.&descAlignY=60&descSize=16&descColor=0c1018&animation=fadeIn" />

<br/>

<!-- BADGES -->
![Status](https://img.shields.io/badge/STATUS-LIVE-f59e0b?style=for-the-badge&labelColor=0c1018&logo=statuspage&logoColor=f59e0b)
![Version](https://img.shields.io/badge/VERSION-4.2-f59e0b?style=for-the-badge&labelColor=0c1018)
![License](https://img.shields.io/badge/LICENSE-MIT-10b981?style=for-the-badge&labelColor=0c1018)
![Zero Dependencies](https://img.shields.io/badge/DEPENDENCIES-ZERO-06b6d4?style=for-the-badge&labelColor=0c1018)
![Free Forever](https://img.shields.io/badge/PRICE-FREE%20FOREVER-a78bfa?style=for-the-badge&labelColor=0c1018)

<br/>
<br/>

> **Drop a JSON. Get a test. No accounts, no servers, no friction.**
> 
> *Test Maker Engine is a free, open, fully client-side quiz platform built for educators, trainers, and anyone who just needs to run a clean, fast, beautiful test — right now.*

<br/>

</div>

---

## ⚡ What Is This?

**Test Maker Engine** is a zero-backend, fully browser-based quiz platform. You bring a `questions.json` file — it handles everything else.

No logins. No databases. No subscriptions. No tracking.  
Host it on GitHub Pages, Netlify, a USB drive, or your own server.  
Works anywhere HTML runs.

```
You  →  questions.json  →  drop it in  →  ⚡  →  live test
```

---

## 🎯 Features

| Feature | Detail |
|---|---|
| ⚡ **Instant Setup** | Drop your JSON, open `index.html` — done |
| 🎨 **Precision Dark UI** | Amber Command aesthetic · Syne + JetBrains Mono |
| 🌗 **Dark / Light Mode** | One click, persists across sessions |
| 💾 **Session Resume** | Close the tab, come back — nothing lost |
| 🔀 **Auto Shuffle** | Questions randomised every new test |
| 🗺️ **Question Palette** | Visual map of all 50 questions, answered/unanswered at a glance |
| ⏱️ **Live Timer** | Elapsed time with urgency mode past 45 min |
| ⌨️ **Full Keyboard Control** | `1–5` pick option · `A–E` pick option · `←→` navigate · `S` submit · `T` theme |
| 📊 **Rich Results** | Score ring · confetti · correct / wrong / skipped breakdown |
| 🔍 **Result Filters** | Filter by All · Correct · Wrong · Skipped |
| ♿ **Accessible** | ARIA live regions · focus traps · reduced-motion support |
| 📱 **Responsive** | Desktop → Tablet → Mobile, all layouts intentional |

---

## 🗂️ Question Format

Create a file called `questions.json` inside the `data/` folder.  
The format is a simple JSON array — one object per question.

```json
[
  {
    "question": "What does CPU stand for?",
    "options": [
      "Central Processing Unit",
      "Central Program Utility",
      "Computer Processing Unit",
      "Core Processor Unit"
    ],
    "correct": 0
  },
  {
    "question": "Which protocol is used to load websites?",
    "options": ["FTP", "SMTP", "HTTP", "SSH"],
    "correct": 2
  }
]
```

| Key | Type | Description |
|---|---|---|
| `question` | `string` | The question text |
| `options` | `string[]` | Array of 2–5 answer choices |
| `correct` | `number` | **Zero-based** index of the correct answer |

> **Tip:** You can have any number of questions. The engine randomly samples 50 per test session by default.

---

## 🚀 Getting Started

```bash
# 1. Clone or download
git clone https://github.com/yourusername/test-maker-engine.git
cd test-maker-engine

# 2. Add your questions
# → edit  data/questions.json

# 3. Open in browser
open index.html
# or serve locally:
npx serve .
```

**That's it.** No `npm install`. No build step. No config.

---

## 📁 Project Structure

```
test-maker-engine/
│
├── index.html              # Single-page app shell
│
├── data/
│   └── questions.json      # ← YOUR QUESTIONS GO HERE
│
├── css/
│   └── styles.css          # Godmode v4.2 — design system
│
└── js/
    ├── app.js              # Main render engine + UI logic
    └── modules/
        ├── store.js        # State management + localStorage
        └── timer.js        # Precision timer with resume
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| `1` `2` `3` `4` `5` | Select option by number |
| `A` `B` `C` `D` `E` | Select option by letter |
| `→` or `Enter` | Next question |
| `←` | Previous question |
| `Backspace` / `Delete` | Clear current answer |
| `S` | Open submit modal |
| `T` | Toggle dark / light theme |
| `Esc` | Close modal |

---

## 🛣️ Roadmap

Coming soon — this is an active project.

- [ ] **Timed Mode** — per-question or total countdown
- [ ] **Score Export** — download results as PDF / CSV
- [ ] **Multi-subject Pools** — tag questions by topic, filter per session
- [ ] **Explanation Mode** — show answer rationale after each question
- [ ] **Leaderboard** — local session high-score tracking
- [ ] **JSON Builder UI** — visual editor for creating question files without touching code
- [ ] **Embed Mode** — drop a test into any webpage with one script tag

---

## 🧑‍💻 Built By

<div align="center">

<br/>

**Abhishek Shah**  
*Building tools that are useful, fast, and actually look good.*

<br/>

[![Gmail](https://img.shields.io/badge/Gmail-abhishek.aimarine%40gmail.com-EA4335?style=for-the-badge&logo=gmail&logoColor=white&labelColor=0c1018)](mailto:abhishek.aimarine@gmail.com)
&nbsp;
[![LinkedIn](https://img.shields.io/badge/LinkedIn-theabhishekshah-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white&labelColor=0c1018)](https://linkedin.com/in/theabhishekshah)

<br/>

</div>

---

## 📄 License

MIT — free to use, fork, modify, and deploy.  
If you build something cool with it, a ⭐ is always appreciated.

---

<div align="center">

<img width="100%" src="https://capsule-render.vercel.app/api?type=waving&color=f59e0b&height=100&section=footer&fontColor=0c1018&animation=fadeIn" />

*Made with obsessive attention to detail.*

</div>
