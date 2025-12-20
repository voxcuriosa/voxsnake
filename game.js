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
        this.invertedTimer = 0;
    }

    handleInput(key) {
        if (this.isDead || this.frozenTimer > 0) return;

        let { up, down, left, right } = this.controls;

        // Handle Inverted Controls (Not implemented as separate powerup yet, but logic ready)
        if (this.invertedTimer > 0) {
            // Swap controls? (skipped for now to keep simple)
        }

        // Prevent reversing
        if (key === up && this.direction.y === 0) this.nextDirection = { x: 0, y: -1 };
        else if (key === down && this.direction.y === 0) this.nextDirection = { x: 0, y: 1 };
        else if (key === left && this.direction.x === 0) this.nextDirection = { x: -1, y: 0 };
        else if (key === right && this.direction.x === 0) this.nextDirection = { x: 1, y: 0 };
    }

    move(isSinglePlayer) {
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
                    // Bounce back? or just stop? Let's stop to save them but they lose turn
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
        this.powerups = []; // Array of {x, y, type}
        this.walls = []; // Array of {x, y}
        this.isRunning = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.gameMode = null;
        this.baseSpeed = 100;
        this.currentSpeed = 100;
        this.speedEffectTimer = 0;
        this.currentPendingScore = 0;

        // Power Up Types Definition
        this.powerUpTypes = {
            'ghost': { color: COLORS.ghost, label: 'Ghost' },
            'eraser': { color: COLORS.white, label: 'Eraser' }, // Combat
            'blind': { color: COLORS.black, label: 'Blind' }, // Combat
            'speed': { color: COLORS.orange, label: 'Speed' },
            'ice': { color: COLORS.cyan, label: 'Ice' }, // Combat
            'bomb': { color: COLORS.red, label: 'Bomb' },
            'shield': { color: COLORS.silver, label: 'Shield' },
            'magnet': { color: COLORS.pink, label: 'Magnet' },
            'switch': { color: COLORS.green, label: 'Switch' }, // Combat
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
        document.querySelector('.game-container').classList.remove('blinded');
        this.loadHighScores();
        this.draw(); // Clear screen
    }

    // High Score Methods (Using API)
    loadHighScores() {
        const list = document.getElementById('high-score-list');
        list.innerHTML = '<li>Loading...</li>';
        fetch('api.php')
            .then(res => res.json())
            .then(data => {
                list.innerHTML = '';
                if (!data || data.length === 0) {
                    list.innerHTML = '<li>No High Scores (Yet)</li>';
                    return;
                }
                data.forEach((s, i) => {
                    const li = document.createElement('li');
                    li.innerHTML = `<span>#${i + 1} ${s.name}</span> <span>${s.score} pts</span>`;
                    list.appendChild(li);
                });
                localStorage.setItem('snake_highscores_cache', JSON.stringify(data));
            })
            .catch(() => list.innerHTML = '<li>Offline Mode</li>');
    }

    saveHighScore(name, score) {
        fetch('api.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, score })
        }).then(() => this.loadHighScores()).catch(console.error);
    }

    checkHighScore(score) {
        const scores = JSON.parse(localStorage.getItem('snake_highscores_cache') || '[]');
        if (scores.length < 20) return true;
        return score > scores[scores.length - 1].score;
    }

    submitHighScore() {
        const name = playerNameInput.value.trim() || "ANON";
        this.saveHighScore(name, this.currentPendingScore);
        nameEntryScreen.classList.add('hidden');
        this.gameOver(-1, true);
    }

    startGame(mode) {
        this.gameMode = mode;
        this.resize();
        this.snakes = [];
        this.powerups = [];
        this.walls = [];
        this.currentSpeed = this.baseSpeed;

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

        this.spawnFood();
        this.isRunning = true;
        mainMenu.classList.remove('active');
        mainMenu.classList.add('hidden');
        gameOverScreen.classList.add('hidden');
        scoreBoard.classList.remove('hidden');
        document.querySelector('.game-container').classList.remove('blinded');

        p2ScoreBox.style.display = mode === 'single' ? 'none' : 'flex';
        this.updateScoreUI();

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastTime = 0;
        this.loop(0);
    }

    resize() {
        const container = canvas.parentElement;
        if (!container) return;
        CANVAS_WIDTH = Math.floor((container.clientWidth - 10) / GRID_SIZE) * GRID_SIZE;
        CANVAS_HEIGHT = Math.floor((container.clientHeight - 10) / GRID_SIZE) * GRID_SIZE;
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        this.draw();
    }

    spawnFood() {
        let valid = false;
        while (!valid) {
            this.food = {
                x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
                y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE))
            };
            valid = !this.isOccupied(this.food);
        }
    }

    spawnPowerUp() {
        if (this.powerups.length >= 3) return; // Max 3

        // Pick random type
        const types = Object.keys(this.powerUpTypes);
        let availableTypes = types;
        if (this.gameMode === 'single') {
            availableTypes = types.filter(t => !['eraser', 'blind', 'ice', 'switch'].includes(t));
        }
        const type = availableTypes[Math.floor(Math.random() * availableTypes.length)];

        let valid = false;
        let pos = {};
        while (!valid) {
            pos = {
                x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
                y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
                type: type
            };
            valid = !this.isOccupied(pos);
        }
        this.powerups.push(pos);
    }

    isOccupied(pos) {
        for (let snake of this.snakes) {
            for (let segment of snake.body) {
                if (pos.x === segment.x && pos.y === segment.y) return true;
            }
        }
        for (let w of this.walls) if (pos.x === w.x && pos.y === w.y) return true;
        return false;
    }

    handleInput(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
        this.snakes.forEach(s => s.handleInput(e.key));
    }

    gameOver(winnerIndex, skipNameEntry = false) {
        this.isRunning = false;
        if (this.gameMode === 'single' && !skipNameEntry) {
            const score = this.snakes[0].score;
            if (this.checkHighScore(score) && score > 0) {
                this.currentPendingScore = score;
                playerNameInput.value = "";
                nameEntryScreen.classList.remove('hidden');
                playerNameInput.focus();
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

        winnerText.innerText = msg;
        winnerText.style.color = color;
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('active');
    }

    update() {
        // Timers
        if (this.speedEffectTimer > 0) {
            this.speedEffectTimer -= 16;
            if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;
        }

        // Move
        this.snakes.forEach(s => s.move(this.gameMode === 'single'));

        // Check game over
        if (this.gameMode === 'single') {
            if (this.snakes[0].isDead || this.snakes[0].checkSelfCollision()) {
                this.gameOver();
                return;
            }
        } if (this.gameMode === 'multi') {
            let p1d = this.snakes[0].isDead || this.snakes[0].checkSelfCollision();
            let p2d = this.snakes[1].isDead || this.snakes[1].checkSelfCollision();

            // Head collisions handled in move checks or here?
            const h1 = this.snakes[0].body[0];
            const h2 = this.snakes[1].body[0];

            // Tail Biting
            // P1 hitting P2
            this.snakes[1].body.forEach((seg, i) => {
                if (h1.x === seg.x && h1.y === seg.y) {
                    if (i >= this.snakes[1].body.length - 2) p2d = true; // Tail bite
                    else p1d = true; // Crash
                }
            });
            // P2 hitting P1
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

        // Eat Food
        this.snakes.forEach(s => {
            if (s.body[0].x === this.food.x && s.body[0].y === this.food.y) {
                // Determine effect? No, food is just growth + speed up
                this.baseSpeed *= 0.99;
                if (this.speedEffectTimer <= 0) this.currentSpeed = this.baseSpeed;
                s.growPending++;
                s.score++;
                this.spawnFood();
                this.spawnPowerUp(); // Chance to spawn powerup
                this.updateScoreUI();

                // Magnet check: if magnet active, pull food? (Too complex for now, skip visual pull)
            }
        });

        // Powerups
        this.snakes.forEach((s, sIdx) => {
            const head = s.body[0];
            // Check Powerup Collision
            for (let i = 0; i < this.powerups.length; i++) {
                const p = this.powerups[i];
                if (head.x === p.x && head.y === p.y) {
                    this.applyPowerUp(s, p.type, sIdx);
                    this.powerups.splice(i, 1);
                    break;
                }
            }
            // Magnet Effect (Simple: Eat adjacent food)
            if (s.magnetTimer > 0) {
                if (Math.abs(head.x - this.food.x) <= 2 && Math.abs(head.y - this.food.y) <= 2) {
                    // Sucked in!
                    this.food.x = head.x; this.food.y = head.y; // Teleport food to mouth next frame
                }
            }
        });

        // Randomly spawn powerups over time? No, on eat is better.
    }

    applyPowerUp(user, type, userIdx) {
        const enemy = this.snakes[userIdx === 0 ? 1 : 0];

        switch (type) {
            case 'ghost': user.ghostTimer = 5000; break;
            case 'speed':
                this.currentSpeed = 50;
                this.speedEffectTimer = 3000;
                break;
            case 'slow':
                this.currentSpeed = 200;
                this.speedEffectTimer = 5000;
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
                if (enemy && this.gameMode === 'multi') {
                    const newLen = Math.max(1, Math.floor(enemy.body.length / 2));
                    enemy.body = enemy.body.slice(0, newLen);
                }
                break;
            case 'blind':
                // CSS effect
                document.querySelector('.game-container').classList.add('blinded');
                setTimeout(() => document.querySelector('.game-container').classList.remove('blinded'), 2000);
                break;
            case 'ice':
                if (enemy) enemy.frozenTimer = 2000;
                break;
            case 'switch':
                if (enemy) {
                    const tempBody = user.body; user.body = enemy.body; enemy.body = tempBody;
                    const tempDir = user.direction; user.direction = enemy.direction; enemy.direction = tempDir;
                    // Keep scores/controls, swap physical presence
                }
                break;
        }
    }

    updateScoreUI() {
        if (this.snakes[0]) scoreP1El.innerText = this.snakes[0].score;
        if (this.snakes[1]) scoreP2El.innerText = this.snakes[1].score;
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
