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
const dynamicLegend = document.getElementById('dynamic-legend'); // New Legend

const nameEntryScreen = document.getElementById('name-entry-screen');
const playerNameInput = document.getElementById('player-name-input');
const submitScoreBtn = document.getElementById('submit-score-btn');

const gameOverScreen = document.getElementById('game-over-screen');
const winnerText = document.getElementById('winner-text');
const restartBtn = document.getElementById('restart-btn');
const menuBtn = document.getElementById('menu-btn');
const scoreP1El = document.getElementById('score-p1');
const scoreP2El = document.getElementById('score-p2');

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

    move() {
        if (this.isDead) return;

        // Handle Timers
        if (this.ghostTimer > 0) this.ghostTimer -= 16;
        if (this.frozenTimer > 0) {
            this.frozenTimer -= 16;
            return; // Skip move if frozen
        }
        if (this.magnetTimer > 0) this.magnetTimer -= 16;

        this.direction = this.nextDirection;
        const head = this.body[0];
        const newHead = { x: head.x + this.direction.x, y: head.y + this.direction.y };

        // Wall Collision
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
                    return;
                }
                this.isDead = true;
                return;
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
                    // Move body back? No, just ignore this frame logic but allow movement away
                    // Actually complex to ignore self collision without moving head back
                    // Simple fix: Remove shield, ignore collision this frame
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
        this.food = {};
        this.powerups = []; // Array of {x, y, type, createdAt}
        this.walls = []; // Array of {x, y}
        this.isRunning = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.gameMode = null;
        this.baseSpeed = 100;
        this.currentSpeed = 100;
        this.speedEffectTimer = 0;
        this.currentPendingScore = 0;
        this.totalFoodEaten = 0;

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
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.loadHighScores();
        this.showMainMenu();
    }

    initListeners() {
        document.addEventListener('keydown', (e) => this.handleInput(e));
        btn1P.addEventListener('click', () => this.startGame('single'));
        btn2P.addEventListener('click', () => this.startGame('multi'));
        restartBtn.addEventListener('click', () => this.startGame(this.gameMode));
        menuBtn.addEventListener('click', () => this.showMainMenu());
        submitScoreBtn.addEventListener('click', () => this.submitHighScore());
    }

    showMainMenu() {
        this.isRunning = false;
        this.gameMode = null;
        mainMenu.classList.remove('hidden');
        mainMenu.classList.add('active');
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');
        nameEntryScreen.classList.add('hidden');
        scoreBoard.classList.add('hidden');
        dynamicLegend.innerHTML = '';

        // Hide Resume Button on Menu Open (Reset)
        const btnResume = document.getElementById('btn-resume');
        if (btnResume) btnResume.classList.add('hidden');

        this.loadHighScores();
        this.draw();
    }

    // ... (unchanged methods) ...

    gameOver(winnerIndex, skipNameEntry = false) {
        // Simple, robust visibility reset
        try {
            this.isRunning = false;
            this.isPaused = false;

            // Force hide other screens
            mainMenu.classList.add('hidden');
            mainMenu.classList.remove('active');
            nameEntryScreen.classList.add('hidden');

            // Single Player High Score
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

            // Game Over Screen
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

            const btnResume = document.getElementById('btn-resume');
            if (btnResume) btnResume.classList.add('hidden');

            if (dynamicLegend) dynamicLegend.innerHTML = '';
        } catch (err) {
            console.error(err);
            alert("Game Over!");
        }
    }

    update() {
        if (this.isPaused) return;

        if (this.speedEffectTimer > 0) {
            this.speedEffectTimer -= 16;
            if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;
        }

        const now = Date.now();
        this.powerups = this.powerups.filter(p => now - p.createdAt < 5000);

        this.snakes.forEach(s => s.move(this.gameMode === 'single'));

        if (this.gameMode === 'single') {
            if (this.snakes[0].isDead || this.snakes[0].checkSelfCollision()) {
                this.gameOver();
                return;
            }
        } else if (this.gameMode === 'multi') {
            let p1d = this.snakes[0].isDead || this.snakes[0].checkSelfCollision();
            let p2d = this.snakes[1].isDead || this.snakes[1].checkSelfCollision();

            const h1 = this.snakes[0].body[0];
            const h2 = this.snakes[1].body[0];

            this.snakes[1].body.forEach((seg, i) => {
                if (h1.x === seg.x && h1.y === seg.y) {
                    if (i >= this.snakes[1].body.length - 2) p2d = true;
                    else p1d = true;
                }
            });
            this.snakes[0].body.forEach((seg, i) => {
                if (h2.x === seg.x && h2.y === seg.y) {
                    if (i >= this.snakes[0].body.length - 2) p1d = true;
                    else p2d = true;
                }
            });

            if (h1.x === h2.x && h1.y === h2.y) { p1d = true; p2d = true; }

            if (p1d && p2d) { this.gameOver(-1); return; }
            if (p1d) { this.gameOver(1); return; }
            if (p2d) { this.gameOver(0); return; }
        }

        this.snakes.forEach(s => {
            if (s.body[0].x === this.food.x && s.body[0].y === this.food.y) {
                this.baseSpeed *= 0.99;
                if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;

                s.growPending++;
                s.score++;
                this.totalFoodEaten++;

                this.spawnFood();
                this.spawnPowerUp();
                this.updateScoreUI();

                // Magnet Effect (Triggered on eat? No, magnet is active state)
            }
            // Magnet Logic (Continuous)
            if (s.magnetTimer > 0) {
                // Move food towards head if close
                const head = s.body[0];
                const dx = this.food.x - head.x;
                const dy = this.food.y - head.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 15 && dist > 0) { // Increased Range to 15
                    // Stronger pull: Move every frame (100% chance)
                    if (Math.abs(dx) > Math.abs(dy)) {
                        this.food.x -= Math.sign(dx);
                    } else {
                        this.food.y -= Math.sign(dy);
                    }
                }
            }
        });

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
                // Slows speed by 10% of CURRENT speed (which is currentSpeed + some amount)
                // Actually user requested: "Senker speed med 10% av nåværende speed"
                // Slower = Higher ms value. 
                // Logic: currentSpeed (ms) * 1.10 = 10% slower (larger delay)
                this.currentSpeed = this.currentSpeed * 1.10;
                // Applies to base speed too so it stacks? Or just temporary effect?
                // Request said "Blue... senker speed". Usually implied temporary or permanent?
                // Let's make it a temporary effect for 5s like others, OR permanent? 
                // "Blue is available after 10 bits... it lowers speed". Sound beneficial for high speed.
                // Let's make it PERMANENT reduction to baseSpeed to help control
                this.baseSpeed = this.baseSpeed * 1.10;
                this.currentSpeed = this.baseSpeed;
                break;
            case 'bomb':
                this.spawnFood();
                this.powerups = [];
                this.walls = [];
                break;
            case 'shield': user.hasShield = true; break;
            case 'magnet': user.magnetTimer = 10000; break;
            case 'wall':
                if (user.body.length > 1) {
                    const tail = user.body[user.body.length - 1];
                    this.walls.push({ x: tail.x, y: tail.y });
                }
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
        if (this.snakes[0]) scoreP1El.innerText = this.snakes[0].score;
        if (this.snakes[1]) scoreP2El.innerText = this.snakes[1].score;
    }

    updateDynamicLegend() {
        // Clear current
        dynamicLegend.innerHTML = '';

        // Add Food
        // const foodItem = document.createElement('div');
        // foodItem.className = 'legend-item';
        // foodItem.innerHTML = `<span class="dot normal"></span> EAT`;
        // dynamicLegend.appendChild(foodItem);

        // Add Active Powerups
        this.powerups.forEach(p => {
            const def = this.powerUpTypes[p.type];
            const div = document.createElement('div');
            div.className = 'legend-item';
            // Use existing dot styles but with inline color override strictly for legend if needed
            // Actually style.css has .dot.blue etc. so use class
            div.innerHTML = `<span class="dot ${p.type}" style="background-color:${def.color}"></span> ${def.label}`;
            dynamicLegend.appendChild(div);
        });
    }

    draw() {
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Walls
        ctx.fillStyle = COLORS.brown;
        this.walls.forEach(w => {
            this.drawRect(w.x, w.y, COLORS.brown);
        });

        // Draw Powerups
        this.powerups.forEach(p => {
            const def = this.powerUpTypes[p.type];
            this.drawRect(p.x, p.y, def ? def.color : '#fff', true);
        });

        // Draw Food
        this.drawRect(this.food.x, this.food.y, COLORS.food, true);

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

        // Update Legend (Visual)
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
