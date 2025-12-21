const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRID_SIZE = 20;
let CANVAS_WIDTH = 800;
let CANVAS_HEIGHT = 600;

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const mainMenu = document.getElementById('main-menu');
const highScoreList = document.getElementById('high-score-list');
const btn1P = document.getElementById('btn-1p');
const btn2P = document.getElementById('btn-2p');
const scoreBoard = document.getElementById('score-board');
const p2ScoreBox = document.getElementById('p2-score-box');
const dynamicLegend = document.getElementById('dynamic-legend');

const nameEntryScreen = document.getElementById('name-entry-screen');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');

const gameOverScreen = document.getElementById('game-over-screen');
const winnerText = document.getElementById('winner-text');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');
const btnResume = document.getElementById('btn-resume');

// Colors
const COLORS = {
    p1: '#00ff88',
    p2: '#00ccff',
    food: '#ff0055',
    grid: '#1a1a1a',
    bg: '#050505',
    // Powerups
    ghost: '#8800ff',
    white: '#ffffff',
    black: '#333333',
    orange: '#ff6600',
    cyan: '#00ffff',
    red: '#ff0000',
    silver: '#c0c0c0',
    pink: '#ff69b4',
    green: '#00ff00',
    brown: '#8b4513',
    blue: '#0000ff'
};

class Snake {
    constructor(id, color, startPos, startDir, controls) {
        this.id = id;
        this.color = color;
        this.body = [startPos];
        this.direction = startDir;
        this.nextDirection = startDir;
        this.controls = controls;
        this.isDead = false;
        this.score = 0;
        this.growPending = 0;

        // Effects
        this.ghostTimer = 0;
        this.frozenTimer = 0;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.magnetTimer = 0;
    }

    handleInput(key) {
        if (this.isDead || this.frozenTimer > 0) return;

        let { up, down, left, right } = this.controls;

        // Prevent reversing
        if (key === up && this.direction.y === 0) this.nextDirection = { x: 0, y: -1 };
        else if (key === down && this.direction.y === 0) this.nextDirection = { x: 0, y: 1 };
        else if (key === left && this.direction.x === 0) this.nextDirection = { x: -1, y: 0 };
        else if (key === right && this.direction.x === 0) this.nextDirection = { x: 1, y: 0 };
    }

    move(walls, isSingleMode, tickRate, onShieldBreak) {
        if (this.isDead) return;

        // Handle Timers (Use actual tick rate, usually ~100ms, not 16ms)
        if (this.ghostTimer > 0) this.ghostTimer -= tickRate;
        if (this.magnetTimer > 0) this.magnetTimer -= tickRate;
        if (this.shieldTimer > 0) this.shieldTimer -= tickRate;

        // Disable expired effects
        if (this.shieldTimer <= 0) this.hasShield = false;

        if (this.frozenTimer > 0) {
            this.frozenTimer -= tickRate;
            return; // Skip move if frozen
        }

        this.direction = this.nextDirection;

        // FIX: If snake is stopped (e.g. after Shield hit), DO NOT simulate movement
        // This prevents "Self Collision" (Head hitting Head) or weird visual states.
        if (this.direction.x === 0 && this.direction.y === 0) return;

        const head = this.body[0];
        const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

        // Border Collision
        if (newHead.x < 0 || newHead.x >= CANVAS_WIDTH / GRID_SIZE ||
            newHead.y < 0 || newHead.y >= CANVAS_HEIGHT / GRID_SIZE) {

            if (this.ghostTimer > 0) {
                // Wrap around
                if (newHead.x < 0) newHead.x = (CANVAS_WIDTH / GRID_SIZE) - 1;
                else if (newHead.x >= CANVAS_WIDTH / GRID_SIZE) newHead.x = 0;
                else if (newHead.y < 0) newHead.y = (CANVAS_HEIGHT / GRID_SIZE) - 1;
                else if (newHead.y >= CANVAS_HEIGHT / GRID_SIZE) newHead.y = 0;
            } else {
                if (this.hasShield) {
                    this.hasShield = false;
                    this.shieldTimer = 0;
                    if (onShieldBreak) onShieldBreak(head.x, head.y);

                    // CRITICAL FIX: Stop the snake! 
                    // Otherwise it hits the wall again in next frame and dies.
                    this.direction = { x: 0, y: 0 };
                    this.nextDirection = { x: 0, y: 0 };
                    return;
                }
                this.isDead = true;
                return;
            }
        }

        // Placed Wall Collision (Power-up Walls)
        if (walls) {
            for (let w of walls) {
                if (newHead.x === w.x && newHead.y === w.y) {
                    if (this.ghostTimer > 0) break; // Ghost passes through
                    if (this.hasShield) {
                        this.hasShield = false;
                        this.shieldTimer = 0;
                        if (onShieldBreak) onShieldBreak(newHead.x, newHead.y);

                        // CRITICAL FIX: Stop the snake!
                        this.direction = { x: 0, y: 0 };
                        this.nextDirection = { x: 0, y: 0 };
                        return;
                    }
                    this.isDead = true;
                    return;
                }
            }
        }

        this.body.unshift(newHead);
        if (this.growPending > 0) this.growPending--;
        else this.body.pop();
    }

    checkSelfCollision() {
        if (this.ghostTimer > 0) return false;
        const head = this.body[0];
        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) {
                if (this.hasShield) {
                    this.hasShield = false;
                    return false;
                }
                this.isDead = true;
                return true;
            }
        }
        return false;
    }
}

class Game {
    constructor() {
        this.snakes = [];
        this.foods = []; // Converted to Array for Multi-Food
        this.powerups = []; // Array of {x, y, type, createdAt}
        this.walls = []; // Array of {x, y}
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.gameMode = null;
        this.baseSpeed = 100;
        this.currentSpeed = 100;
        this.speedEffectTimer = 0;
        this.currentPendingScore = 0;
        this.totalFoodEaten = 0;

        // Spawning Timers
        this.lastPowerUpTime = 0;
        this.nextPowerUpDelay = 5000;

        // Power Up Types Definition
        this.powerUpTypes = {
            'ghost': { color: COLORS.ghost, label: 'Ghost' },
            'eraser': { color: COLORS.white, label: 'Eraser' },
            'blind': { color: COLORS.black, label: 'Blind' },
            'speed': { color: COLORS.orange, label: 'Speed' },
            'ice': { color: COLORS.cyan, label: 'Ice' },
            'bomb': { color: COLORS.red, label: 'Bomb' },
            'shield': { color: COLORS.silver, label: 'Shield' },
            'magnet': { color: COLORS.pink, label: 'Magnet' },
            'switch': { color: COLORS.green, label: 'Switch' },
            'wall': { color: COLORS.brown, label: 'Wall' },
            'slow': { color: COLORS.blue, label: 'Slow' }
        };

        this.initListeners();
        // Delay resize slightly to ensure layout is ready
        setTimeout(() => this.resize(), 50);
        window.addEventListener('resize', () => this.resize());
        this.loadHighScores();
        this.showMainMenu();
    }

    initListeners() {
        document.addEventListener('keydown', (e) => this.handleInput(e));
        if (btn1P) btn1P.addEventListener('click', () => this.startGame('single'));
        if (btn2P) btn2P.addEventListener('click', () => this.startGame('multi'));
        if (restartBtn) restartBtn.addEventListener('click', () => this.startGame(this.gameMode));
        if (menuBtn) menuBtn.addEventListener('click', () => this.showMainMenu());
        if (submitScoreBtn) submitScoreBtn.addEventListener('click', () => this.submitHighScore());
        if (btnResume) btnResume.addEventListener('click', () => this.togglePause());

        // Enter key for name entry
        if (playerNameInput) {
            playerNameInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') this.submitHighScore();
            });
        }
    }

    showMainMenu() {
        this.isRunning = false;
        this.isPaused = false;
        this.gameMode = null;
        if (mainMenu) {
            mainMenu.classList.remove('hidden');
            mainMenu.classList.add('active');
        }
        if (gameOverScreen) {
            gameOverScreen.classList.remove('active');
            gameOverScreen.classList.add('hidden');
        }
        if (nameEntryScreen) nameEntryScreen.classList.add('hidden');
        if (scoreBoard) scoreBoard.classList.add('hidden');
        if (dynamicLegend) dynamicLegend.innerHTML = '';

        // Hide Resume Button on Menu Open
        if (btnResume) btnResume.classList.add('hidden');

        this.loadHighScores();
        this.draw();
    }

    loadHighScores(highlightName = null, highlightScore = null) {
        if (!highScoreList) return;
        highScoreList.innerHTML = '<li>Loading...</li>';
        fetch('api.php')
            .then(res => res.json())
            .then(data => {
                highScoreList.innerHTML = '';
                if (!data || data.length === 0) {
                    highScoreList.innerHTML = '<li>No High Scores (Yet)</li>';
                    return;
                }

                let foundHighlight = false;

                // User Request: Limit to top 5 visibly
                const displayData = data.slice(0, 5);

                // If the user's new score is outside top 5, we should maybe show it?
                // For now, strict top 5 as requested by "skulle bare vise de 5 øverste".

                displayData.forEach((s, i) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>#${i + 1} ${s.name}</span> <span>${s.score} pts</span>`;

                    // Check for highlight match (strict name & score match)
                    if (highlightName && highlightScore && s.name === highlightName && s.score == highlightScore && !foundHighlight) {
                        li.classList.add('highlight');
                        foundHighlight = true; // Only highlight first match
                    }

                    highScoreList.appendChild(li);
                });

                // If user just submitted a score that isn't in top 5, maybe show a "You are #23" message?
                // Keeping it simple per "only top 5".

                localStorage.setItem('snake_highscores_cache', JSON.stringify(data));
            })
            .catch(() => highScoreList.innerHTML = '<li>Offline Mode</li>');
    }

    saveHighScore(name, score) {
        fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        }).then(() => this.loadHighScores(name, score)).catch(console.error);
    }

    checkHighScore(score) {
        try {
            const raw = localStorage.getItem('snake_highscores_cache');
            const scores = JSON.parse(raw || '[]');
            if (!Array.isArray(scores)) return true;
            if (scores.length < 20) return true;
            return score > scores[scores.length - 1].score;
        } catch (e) {
            console.error("HighScore Check Error", e);
            return false;
        }
    }

    submitHighScore() {
        if (!playerNameInput) return;
        const name = playerNameInput.value.trim() || "ANON";

        // Hide entry screen first
        nameEntryScreen.classList.add('hidden');
        nameEntryScreen.classList.remove('active');

        // Save and trigger Menu w/ Highlight
        this.saveHighScore(name, this.currentPendingScore);

        // Show main menu immediately (loading will happen)
        this.showMainMenu();
    }

    startGame(mode) {
        console.log("Starting Game Mode:", mode);
        this.gameMode = mode;
        this.resize();
        this.snakes = [];
        this.powerups = [];
        this.walls = [];
        this.baseSpeed = 100; // FIX: Hard reset base speed so it doesn't carry over
        this.currentSpeed = this.baseSpeed;
        this.totalFoodEaten = 0;
        this.isPaused = false;

        if (mode === 'single') {
            this.snakes.push(new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }));
        } else {
            this.snakes = [
                new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                    { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }),
                new Snake(2, COLORS.p2, { x: (CANVAS_WIDTH / GRID_SIZE) - 6, y: (CANVAS_HEIGHT / GRID_SIZE) - 6 }, { x: -1, y: 0 },
                    { up: 'w', down: 's', left: 'a', right: 'd' })
            ];
        }

        // Force a resize check BEFORE spawning to avoid 0x0 canvas -> Center Spawn Fallback
        this.resize();

        // Safety delay for spawn if canvas is somehow still weird, otherwise immediate
        if (CANVAS_WIDTH > 0 && CANVAS_HEIGHT > 0) {
            // Spawn 3 Foods initially (User Request: "Mer mat")
            this.spawnFood();
            this.spawnFood();
            this.spawnFood();
        } else {
            console.warn("Canvas dimensions invalid at start. Retrying spawn in 100ms");
            setTimeout(() => {
                this.spawnFood();
                this.spawnFood();
                this.spawnFood();
            }, 100);
        }

        this.isRunning = true;

        mainMenu.classList.remove('active');
        mainMenu.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        scoreBoard.classList.remove('hidden');

        if (p2ScoreBox) p2ScoreBox.style.display = mode === 'single' ? 'none' : 'flex';
        this.updateScoreUI();

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    resize() {
        const container = canvas.parentElement;
        // Fallback to window if container is missing or has 0 size
        let w = container ? container.clientWidth : window.innerWidth;
        let h = container ? container.clientHeight : window.innerHeight;

        // Extra Robustness: If container width is somehow 0 (e.g. collapsed flex),
        // try window and subtract padding guess.
        if (!w || w <= 10) w = window.innerWidth - 20;
        if (!h || h <= 10) h = window.innerHeight - 100; // Account for scoreboard

        // Final sanity check min sizes
        if (w < 300) w = 300;
        if (h < 300) h = 300;

        CANVAS_WIDTH = Math.floor((w - 4) / GRID_SIZE) * GRID_SIZE;
        CANVAS_HEIGHT = Math.floor((h - 4) / GRID_SIZE) * GRID_SIZE;

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        this.draw();
    }

    spawnFood() {
        // Limit max foods just in case, but aim for 3-5
        if (this.foods.length >= 5) return;

        let valid = false;
        let attempts = 0;

        if (CANVAS_WIDTH <= 0 || CANVAS_HEIGHT <= 0) this.resize();

        let maxX = Math.floor(CANVAS_WIDTH / GRID_SIZE);
        let maxY = Math.floor(CANVAS_HEIGHT / GRID_SIZE);

        if (maxX <= 1 || maxY <= 1) {
            maxX = 40;
            maxY = 30;
        }

        let newFood = {};

        while (!valid && attempts < 100) {
            attempts++;
            newFood = {
                x: Math.floor(Math.random() * maxX),
                y: Math.floor(Math.random() * maxY)
            };
            valid = !this.isOccupied(newFood);
        }

        if (!valid) {
            // Force Random if stuck
            newFood = {
                x: Math.floor(Math.random() * maxX),
                y: Math.floor(Math.random() * maxY)
            };
        }

        this.foods.push(newFood);
    }

    // ... spawnPowerUp omitted ...

    updateDynamicLegend() {
        if (!dynamicLegend) return;

        // Force Redraw Every Frame (Remove Caching to fix timer glitches)

        dynamicLegend.innerHTML = '';

        // 1. Draw Static Powerups (What is on the board to pick up)
        this.powerups.forEach(p => {
            const def = this.powerUpTypes[p.type];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="dot ${p.type}" style="background-color:${def.color}"></span> ${def.label}`;
            dynamicLegend.appendChild(div);
        });

        // 2. Draw Active Timers (What you have active)
        const s1 = this.snakes[0];
        // Note: We show timers even in Multi if we want, but sticking to Single for now to avoid clutter
        if (this.gameMode === 'single' && s1) {
            const activeGhost = s1.ghostTimer > 0;
            const activeShield = s1.hasShield;
            const activeMagnet = s1.magnetTimer > 0;

            if (activeGhost || activeShield || activeMagnet) {
                const div = document.createElement('div');
                div.className = 'legend-timers';
                let html = "";

                if (activeGhost) {
                    html += `<span style="color:${COLORS.ghost}">GHOST ${Math.ceil(s1.ghostTimer / 1000)}s</span> `;
                }
                if (activeShield) {
                    const t = s1.shieldTimer > 0 ? Math.ceil(s1.shieldTimer / 1000) + "s" : "∞";
                    html += `<span style="color:${COLORS.silver}">SHIELD ${t}</span> `;
                }
                if (activeMagnet) {
                    html += `<span style="color:${COLORS.pink}">MAGNET ${Math.ceil(s1.magnetTimer / 1000)}s</span> `;
                }

                div.innerHTML = html;
                dynamicLegend.appendChild(div);
            }
        }
    }

    spawnPowerUp() {
        if (this.powerups.length >= 5) return; // Increased limit slightly

        const types = Object.keys(this.powerUpTypes);
        let availableTypes = types;

        if (this.gameMode === 'single') {
            availableTypes = types.filter(t => !['eraser', 'blind', 'ice', 'switch'].includes(t));
        }

        if (this.totalFoodEaten < 10) {
            availableTypes = availableTypes.filter(t => t !== 'slow');
        }

        // Logic: Bomb is useless if nothing to destroy
        // (Check if there are walls OR other powerups to blow up)
        const hasTargets = (this.walls.length > 0 || this.powerups.length > 0);
        if (!hasTargets) {
            availableTypes = availableTypes.filter(t => t !== 'bomb');
        }

        // Logic: Boost 'Wall' frequency (User Request: "mange flere")
        // We add 'wall' multiple times to the array to increase probability
        if (availableTypes.includes('wall')) {
            availableTypes.push('wall');
            availableTypes.push('wall');
            availableTypes.push('wall'); // 4x chance total
        }

        if (availableTypes.length === 0) return;

        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

        let valid = false;
        let pos = {};
        let attempts = 0;
        while (!valid && attempts < 50) {
            attempts++;
            pos = {
                x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
                y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
                type: type,
                createdAt: Date.now()
            };
            valid = !this.isOccupied(pos);
        }
        if (valid) this.powerups.push(pos);
    }

    isOccupied(pos) {
        if (this.foods) {
            for (let f of this.foods) {
                if (f.x === pos.x && f.y === pos.y) return true;
            }
        }
        for (let snake of this.snakes) {
            for (let segment of snake.body) {
                if (pos.x === segment.x && pos.y === segment.y) return true;
            }
        }
        for (let w of this.walls) if (pos.x === w.x && pos.y === w.y) return true;
        for (let p of this.powerups) if (pos.x === p.x && pos.y === p.y) return true;
        return false;
    }

    handleInput(e) {
        if (e.key.toLowerCase() === 'p' && this.isRunning) {
            this.togglePause();
            return;
        }

        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        this.snakes.forEach(s => s.handleInput(e.key));
    }

    togglePause() {
        this.isPaused = !this.isPaused;

        if (this.isPaused) {
            mainMenu.classList.remove('hidden');
            mainMenu.classList.add('active');
            if (btnResume) btnResume.classList.remove('hidden');
        } else {
            mainMenu.classList.add('hidden');
            mainMenu.classList.remove('active');
            if (btnResume) btnResume.classList.add('hidden');

            this.lastTime = performance.now();
            this.loop(this.lastTime);
        }
    }

    gameOver(winnerIndex, skipNameEntry = false) {
        try {
            this.isRunning = false;
            this.isPaused = false;

            mainMenu.classList.remove('active');
            mainMenu.classList.add('hidden');
            nameEntryScreen.classList.add('hidden');

            if (this.gameMode === 'single' && !skipNameEntry) {
                const score = this.snakes[0].score;
                if (score > 0 && this.checkHighScore(score)) {
                    this.currentPendingScore = score;
                    if (playerNameInput) playerNameInput.value = "";
                    nameEntryScreen.classList.remove('hidden');
                    nameEntryScreen.classList.add('active');
                    if (playerNameInput) playerNameInput.focus();
                    return;
                }
            }

            let msg = "GAME OVER";
            let color = COLORS.p1;
            if (this.gameMode === 'multi') {
                if (winnerIndex === -1) { msg = "DRAW!"; color = "#fff"; }
                else if (winnerIndex === 0) { msg = "PLAYER 1 WINS!"; color = COLORS.p1; }
                else { msg = "PLAYER 2 WINS!"; color = COLORS.p2; }
            }

            if (winnerText) {
                winnerText.innerText = msg;
                winnerText.style.color = color;
            }

            gameOverScreen.classList.remove('hidden');
            gameOverScreen.classList.add('active');

            if (btnResume) btnResume.classList.add('hidden');
            if (dynamicLegend) dynamicLegend.innerHTML = '';
        } catch (err) {
            console.error(err);
            alert("Game Over!");
        }
    }

    triggerShieldEffect(x, y) {
        // Visual Flare
        const div = document.createElement('div');
        div.innerText = "SHIELD BLOCKED!";
        div.style.position = 'absolute';
        div.style.left = (x * GRID_SIZE) + 'px';
        div.style.top = (y * GRID_SIZE) + 'px';
        div.style.color = '#fff';
        div.style.fontWeight = 'bold';
        div.style.textShadow = '0 0 5px #000';
        div.style.zIndex = '100';
        div.style.pointerEvents = 'none';
        div.className = 'shield-broken-msg'; // Add class for animation
        document.body.appendChild(div);

        // Animate up and fade
        let op = 1;
        let top = y * GRID_SIZE;
        const anim = setInterval(() => {
            op -= 0.05;
            top -= 1;
            div.style.opacity = op;
            div.style.top = top + 'px';
            if (op <= 0) {
                clearInterval(anim);
                div.remove();
            }
        }, 50);

        // Flash Screen
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0'; flash.style.left = '0';
        flash.style.width = '100vw'; flash.style.height = '100vh';
        flash.style.background = 'rgba(255, 255, 255, 0.3)';
        flash.style.zIndex = '99';
        flash.style.pointerEvents = 'none';
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 100);
    }

    update() {
        if (this.isPaused) return;

        const now = Date.now();
        // Use true delta time for smoother timers if framerate dips
        const delta = now - this.lastTime;
        // Note: this.lastTime is updated at end of loop(), but here we need delta for logic. 
        // Actually, main loop passes timestamp. Let's stick to fixed time steps or just robust decrement.
        // Simple fix: Decrement by `this.currentSpeed` (which is tick rate) or roughly 16ms?
        // Actually, the loop runs at `currentSpeed` interval! 
        // Standard loop: requestAnimationFrame runs freely? 
        // NO. existing loop: `if (timestamp - this.lastTime < this.currentSpeed) return;` 
        // This means the loop runs at ~10 FPS (100ms) or 20 FPS (50ms). 
        // Decrementing timers by 16ms (60hz assumed) every 100ms means timers go 6x slower! 
        // FIX: Decrement by `this.currentSpeed` (the actual elapsed time per tick).

        const tickRate = this.currentSpeed;

        if (this.speedEffectTimer > 0) {
            this.speedEffectTimer -= tickRate;
            if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;
        }

        this.powerups = this.powerups.filter(p => now - p.createdAt < 5000);

        // Update Snakes (Collision & Movement)
        this.snakes.forEach(s => s.move(this.walls, this.gameMode === 'single', tickRate, (x, y) => this.triggerShieldEffect(x, y)));

        // Game Over Checks...
        if (this.gameMode === 'single') {
            if (this.snakes[0].isDead || this.snakes[0].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y))) {
                this.gameOver();
                return;
            }
        } else if (this.gameMode === 'multi') {
            let p1d = this.snakes[0].isDead || this.snakes[0].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y));
            let p2d = this.snakes[1].isDead || this.snakes[1].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y));


            // Head-to-Head/Body collision logic (omitted for brevity, assume same)
            const h1 = this.snakes[0].body[0];
            const h2 = this.snakes[1].body[0];
            this.snakes[1].body.forEach((seg, i) => { if (h1.x === seg.x && h1.y === seg.y) { if (i >= this.snakes[1].body.length - 2) p2d = true; else p1d = true; } });
            this.snakes[0].body.forEach((seg, i) => { if (h2.x === seg.x && h2.y === seg.y) { if (i >= this.snakes[0].body.length - 2) p1d = true; else p2d = true; } });
            if (h1.x === h2.x && h1.y === h2.y) { p1d = true; p2d = true; }

            if (p1d && p2d) { this.gameOver(-1); return; }
            if (p1d) { this.gameOver(1); return; }
            if (p2d) { this.gameOver(0); return; }
        }

        // Timed Powerup Spawning (Independent of eating)
        if (now - this.lastPowerUpTime > this.nextPowerUpDelay) {
            this.spawnPowerUp();
            this.lastPowerUpTime = now;
            // Randomize next delay: 5s to 15s
            this.nextPowerUpDelay = 5000 + Math.random() * 10000;
        }

        // Eat Food (Combined Magnet & Regular) - MULTI FOOD SUPPORT
        this.snakes.forEach(s => {
            let ate = false;
            let ateIndex = -1;

            for (let fIdx = 0; fIdx < this.foods.length; fIdx++) {
                const f = this.foods[fIdx];

                // Regular Eat
                if (s.body[0].x === f.x && s.body[0].y === f.y) {
                    ate = true;
                    ateIndex = fIdx;
                    break;
                }

                // Magnet Logic (Pull closest food)
                else if (s.magnetTimer > 0) {
                    const head = s.body[0];
                    const dx = f.x - head.x;
                    const dy = f.y - head.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < 15 && dist > 0) {
                        // Pull food closer
                        if (Math.abs(dx) > Math.abs(dy)) f.x -= Math.sign(dx);
                        else f.y -= Math.sign(dy);

                        // Check capture
                        if (s.body[0].x === f.x && s.body[0].y === f.y) {
                            ate = true;
                            ateIndex = fIdx;
                            break;
                        }
                    }
                }
            }

            if (ate && ateIndex !== -1) {
                // Remove the eaten piece
                this.foods.splice(ateIndex, 1);

                this.baseSpeed *= 0.99;
                if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;

                s.growPending++;
                s.score++;
                this.totalFoodEaten++;

                // Spawn Replacement right away to keep map full
                this.spawnFood();
                // Note: We do NOT spawnPowerUp here anymore, or we can do it rarely.
                // User asked for "random", not "just when eaten".
                // But maybe small chance?
                if (Math.random() < 0.2) this.spawnPowerUp();

                this.updateScoreUI();
            }
        });

        // Eat Powerups
        this.snakes.forEach((s, sIdx) => {
            const head = s.body[0];
            for (let i = 0; i < this.powerups.length; i++) {
                const p = this.powerups[i];
                if (head.x === p.x && head.y === p.y) {
                    this.applyPowerUp(s, p.type, sIdx);
                    this.powerups.splice(i, 1);
                    break;
                }
            }
        });
    }

    applyPowerUp(user, type, userIdx) {
        const enemy = this.snakes[userIdx === 0 ? 1 : 0];
        const isMulti = this.gameMode === 'multi';

        switch (type) {
            case 'ghost': user.ghostTimer = 5000; break;
            case 'speed':
                this.currentSpeed = 50;
                this.speedEffectTimer = 3000;
                break;
            case 'slow':
                this.baseSpeed = this.baseSpeed * 1.10;
                this.currentSpeed = this.baseSpeed;
                break;
            case 'bomb':
                this.spawnFood();
                this.powerups = [];
                this.walls = [];
                break;
            case 'shield':
                user.hasShield = true;
                user.shieldTimer = 10000; // FIX: Initialize timer!
                break;
            case 'magnet': user.magnetTimer = 10000; break;
            case 'wall':
                const tail = user.body[user.body.length - 1];
                this.walls.push({ x: tail.x, y: tail.y });
                break;
            case 'eraser':
                if (isMulti && enemy) {
                    const newLen = Math.max(1, Math.floor(enemy.body.length / 2));
                    enemy.body = enemy.body.slice(0, newLen);
                }
                break;
            case 'blind':
                document.querySelector('.game-container').classList.add('blinded');
                setTimeout(() => document.querySelector('.game-container').classList.remove('blinded'), 2000);
                break;
            case 'ice':
                if (isMulti && enemy) enemy.frozenTimer = 2000;
                break;
            case 'switch':
                if (isMulti && enemy) {
                    const tempBody = user.body; user.body = enemy.body; enemy.body = tempBody;
                    const tempDir = user.direction; user.direction = enemy.direction; enemy.direction = tempDir;
                }
                break;
        }
    }

    updateScoreUI() {
        if (scoreP1El && this.snakes[0]) scoreP1El.innerText = this.snakes[0].score;
        if (scoreP2El && this.snakes[1]) scoreP2El.innerText = this.snakes[1].score;
    }

    updateDynamicLegend() {
        if (!dynamicLegend) return;

        // Optimize: Only redraw if the SET of powerups changes, OR if the Ghost Timer needs update.
        // We will separate the static list from the timer to avoid full innerHTML trashing.

        const currentPowerups = this.powerups.map(p => p.type).sort().join(',');
        const activeGhost = (this.gameMode === 'single' && this.snakes[0] && this.snakes[0].ghostTimer > 0);

        // Timer Logic
        let timerText = "";
        if (activeGhost) {
            const secondsLeft = Math.ceil(this.snakes[0].ghostTimer / 1000);
            timerText = `GHOST (${secondsLeft}s)`;
        }

        const newStateSig = currentPowerups + "|" + timerText;
        if (this._lastLegendState === newStateSig) return;
        this._lastLegendState = newStateSig;

        dynamicLegend.innerHTML = '';

        // Draw standard icons
        this.powerups.forEach(p => {
            const def = this.powerUpTypes[p.type];
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="dot ${p.type}" style="background-color:${def.color}"></span> ${def.label}`;
            dynamicLegend.appendChild(div);
        });

        // Add Active Ghost Timer
        if (timerText) {
            const div = document.createElement('div');
            div.className = 'legend-item';
            div.innerHTML = `<span class="dot ghost" style="background-color:${COLORS.ghost}; box-shadow: 0 0 10px ${COLORS.ghost}"></span> ${timerText}`;
            dynamicLegend.appendChild(div);
        }
    }

    draw() {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Walls (Distinct Texture for Placed Walls)
        // Walls in this.walls are placed by powerups. Normal borders are implicit.
        this.walls.forEach(w => {
            // "Danger" style: Brown with Red X or border
            this.drawRect(w.x, w.y, COLORS.brown);
            // Draw a red X or inner square to signify danger
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.strokeRect(w.x * GRID_SIZE + 4, w.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);
        });

        // Draw Powerups
        this.powerups.forEach(p => {
            const def = this.powerUpTypes[p.type];
            this.drawRect(p.x, p.y, def ? def.color : '#fff', true);
        });

        // Draw Foods (Multi-Food)
        if (this.foods) {
            this.foods.forEach(f => {
                this.drawRect(f.x, f.y, COLORS.food, true);
            });
        }

        // Draw Snakes
        this.snakes.forEach(snake => {
            const snakeColor = snake.hasShield ? COLORS.silver :
                snake.ghostTimer > 0 ? COLORS.ghost : snake.color;
            snake.body.forEach((segment, index) => {
                const isHead = index === 0;
                if (snake.frozenTimer > 0) ctx.fillStyle = COLORS.cyan;
                else ctx.fillStyle = snakeColor;

                this.drawRect(segment.x, segment.y, ctx.fillStyle, isHead);
            });
        });

        this.updateDynamicLegend();
    }

    drawRect(x, y, color, glow = false) {
        ctx.fillStyle = color;
        if (glow) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = color;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.fillRect(x * GRID_SIZE + 1, y * GRID_SIZE + 1, GRID_SIZE - 2, GRID_SIZE - 2);
        ctx.shadowBlur = 0;
    }

    loop(timestamp) {
        if (!this.isRunning) return;
        if (this.isPaused) return;

        if (timestamp - this.lastTime < this.currentSpeed) {
            this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
            return;
        }
        this.lastTime = timestamp;
        this.update();
        this.draw();
        if (this.isRunning) this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
    }
}

const game = new Game();
