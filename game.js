const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRID_SIZE = 20;
const GAME_SPEED = 100;
let CANVAS_WIDTH = 800; // Default, will resize
let CANVAS_HEIGHT = 600; // Default, will resize

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

// Colors matching CSS
const COLORS = {
    p1: '#00ff88',
    p2: '#00ccff',
    food: '#ff0055',
    gold: '#ffd700', // Gold Orb
    blue: '#0000ff', // Blue Orb (Freeze/Slow)
    grid: '#1a1a1a',
    bg: '#050505'
};

class Snake {
    constructor(id, color, startPos, startDir, controls) {
        this.id = id;
        this.color = color;
        this.body = [startPos]; // Head is at index 0
        this.direction = startDir; // {x, y}
        this.nextDirection = startDir;
        this.controls = controls; // {up, down, left, right}
        this.isDead = false;
        this.score = 0;
        this.growPending = 0;
    }

    reset(startPos, startDir) {
        this.body = [startPos];
        this.direction = startDir;
        this.nextDirection = startDir;
        this.isDead = false;
        this.score = 0;
        this.growPending = 0;
    }

    handleInput(key) {
        if (this.isDead) return;

        const { up, down, left, right } = this.controls;
        // Prevent reversing direction
        if (key === up && this.direction.y === 0) {
            this.nextDirection = { x: 0, y: -1 };
        } else if (key === down && this.direction.y === 0) {
            this.nextDirection = { x: 0, y: 1 };
        } else if (key === left && this.direction.x === 0) {
            this.nextDirection = { x: -1, y: 0 };
        } else if (key === right && this.direction.x === 0) {
            this.nextDirection = { x: 1, y: 0 };
        }
    }

    move(isSinglePlayer = false) {
        if (this.isDead) return;

        this.direction = this.nextDirection;
        const head = this.body[0];
        const newHead = {
            x: head.x + this.direction.x,
            y: head.y + this.direction.y
        };

        // Wall Collision
        if (newHead.x < 0 || newHead.x >= CANVAS_WIDTH / GRID_SIZE ||
            newHead.y < 0 || newHead.y >= CANVAS_HEIGHT / GRID_SIZE) {
            this.isDead = true;
            return;
        }

        this.body.unshift(newHead);

        if (this.growPending > 0) {
            this.growPending--;
        } else {
            this.body.pop();
        }
    }

    checkSelfCollision() {
        const head = this.body[0];
        // Start from 1 to skip head
        for (let i = 1; i < this.body.length; i++) {
            if (head.x === this.body[i].x && head.y === this.body[i].y) {
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
        this.food = {}; // Now can be {x, y, type: 'normal'|'gold'|'blue'}
        this.isRunning = false;
        this.lastTime = 0;
        this.animationFrameId = null;
        this.gameMode = null; // 'single' or 'multi'

        this.baseSpeed = 100;
        this.currentSpeed = 100;
        this.speedEffectTimer = 0;

        this.currentPendingScore = 0; // For name entry

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
        nameEntryScreen.classList.remove('active');
        nameEntryScreen.classList.add('hidden'); // Hide Name entry
        scoreBoard.classList.add('hidden');

        this.loadHighScores();

        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    loadHighScores() {
        const scores = JSON.parse(localStorage.getItem('snake_highscores_v2') || '[]');
        highScoreList.innerHTML = '';
        if (scores.length === 0) {
            highScoreList.innerHTML = '<li>No High Scores Yet</li>';
            return;
        }
        // Take top 20
        scores.slice(0, 5).forEach((s, i) => { // Displaying top 5 on menu to keep it clean, storing 20
            const li = document.createElement('li');
            li.innerHTML = `<span>#${i + 1} ${s.name}</span> <span>${s.score} pts</span>`;
            highScoreList.appendChild(li);
        });
    }

    saveHighScore(name, score) {
        const scores = JSON.parse(localStorage.getItem('snake_highscores_v2') || '[]');
        scores.push({ name: name, score: score });
        scores.sort((a, b) => b.score - a.score);
        const topScores = scores.slice(0, 20); // Keep top 20
        localStorage.setItem('snake_highscores_v2', JSON.stringify(topScores));
    }

    checkHighScore(score) {
        const scores = JSON.parse(localStorage.getItem('snake_highscores_v2') || '[]');
        if (scores.length < 20) return true;
        return score > scores[scores.length - 1].score;
    }

    submitHighScore() {
        const name = playerNameInput.value.trim() || "ANON";
        this.saveHighScore(name, this.currentPendingScore);
        nameEntryScreen.classList.remove('active');
        nameEntryScreen.classList.add('hidden');
        this.gameOver(-1, true); // Show game over screen now
    }

    startGame(mode) {
        this.gameMode = mode;
        this.resize();

        // Reset Snakes
        this.snakes = [];
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

        this.currentSpeed = this.baseSpeed;
        this.speedEffectTimer = 0;
        this.spawnFood();
        this.isRunning = true;

        mainMenu.classList.remove('active');
        mainMenu.classList.add('hidden');
        gameOverScreen.classList.remove('active');
        gameOverScreen.classList.add('hidden');
        nameEntryScreen.classList.remove('active');
        nameEntryScreen.classList.add('hidden');
        scoreBoard.classList.remove('hidden');

        if (mode === 'single') {
            p2ScoreBox.style.display = 'none';
        } else {
            p2ScoreBox.style.display = 'flex';
        }

        this.updateScoreUI();

        if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
        this.lastTime = 0;
        this.loop(0);
    }

    resize() {
        const container = canvas.parentElement;
        const w = container.clientWidth - 10;
        const h = container.clientHeight - 10;

        CANVAS_WIDTH = Math.floor(w / GRID_SIZE) * GRID_SIZE;
        CANVAS_HEIGHT = Math.floor(h / GRID_SIZE) * GRID_SIZE;

        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;

        this.draw();
    }

    spawnFood() {
        let valid = false;
        let pos = {};
        let type = 'normal';

        // Power-up chance 20% (Increased from 10%)
        const rand = Math.random();
        if (rand < 0.10) type = 'gold'; // 10%
        else if (rand < 0.20) type = 'blue'; // 10%

        while (!valid) {
            pos = {
                x: Math.floor(Math.random() * (CANVAS_WIDTH / GRID_SIZE)),
                y: Math.floor(Math.random() * (CANVAS_HEIGHT / GRID_SIZE)),
                type: type
            };
            valid = true;

            for (let snake of this.snakes) {
                for (let segment of snake.body) {
                    if (pos.x === segment.x && pos.y === segment.y) {
                        valid = false;
                        break;
                    }
                }
                if (!valid) break;
            }
        }
        this.food = pos;
    }

    handleInput(e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
            e.preventDefault();
        }
        this.snakes.forEach(snake => snake.handleInput(e.key));
    }

    gameOver(winnerIndex, skipNameEntry = false) {
        this.isRunning = false;

        // Single Player High Score Check
        if (this.gameMode === 'single' && !skipNameEntry) {
            const score = this.snakes[0].score;
            if (this.checkHighScore(score) && score > 0) {
                this.currentPendingScore = score;
                playerNameInput.value = "";
                nameEntryScreen.classList.remove('hidden');
                nameEntryScreen.classList.add('active');
                playerNameInput.focus();
                return; // Wait for input
            }
        }

        let finalText = "";
        if (this.gameMode === 'single') {
            finalText = "GAME OVER";
            winnerText.style.color = COLORS.p1;
        } else {
            const winner = winnerIndex === -1 ? "DRAW!" :
                winnerIndex === 0 ? "PLAYER 1 WINS!" : "PLAYER 2 WINS!";
            finalText = winner;
            winnerText.style.color = winnerIndex === 0 ? COLORS.p1 :
                winnerIndex === 1 ? COLORS.p2 : '#fff';
        }

        winnerText.innerText = finalText;
        gameOverScreen.classList.remove('hidden');
        gameOverScreen.classList.add('active');
    }

    update(deltaTime) {
        // Handle Effects
        if (this.speedEffectTimer > 0) {
            this.speedEffectTimer -= 16; // Approx ms per frame
            if (this.speedEffectTimer <= 0) {
                this.currentSpeed = this.baseSpeed;
            }
        }

        // Move snakes
        this.snakes.forEach(snake => snake.move(this.gameMode === 'single'));

        // Collision Checks (omitted for brevity, same as before but handling results)
        if (this.gameMode === 'single') {
            const player = this.snakes[0];
            if (player.isDead || player.checkSelfCollision()) {
                this.gameOver(-1);
                return;
            }
        } else {
            // Multiplayer Collision (Same as previous)
            let p1Dead = this.snakes[0].isDead || this.snakes[0].checkSelfCollision();
            let p2Dead = this.snakes[1].isDead || this.snakes[1].checkSelfCollision();
            // Cross Collision
            for (let segment of this.snakes[1].body) {
                if (this.snakes[0].body[0].x === segment.x && this.snakes[0].body[0].y === segment.y) { p1Dead = true; break; }
            }
            for (let segment of this.snakes[0].body) {
                if (this.snakes[1].body[0].x === segment.x && this.snakes[1].body[0].y === segment.y) { p2Dead = true; break; }
            }
            if (this.snakes[0].body[0].x === this.snakes[1].body[0].x && this.snakes[0].body[0].y === this.snakes[1].body[0].y) { p1Dead = true; p2Dead = true; }

            if (p1Dead && p2Dead) { this.gameOver(-1); return; }
            else if (p1Dead) { this.gameOver(1); return; }
            else if (p2Dead) { this.gameOver(0); return; }
        }

        // Eat Food
        this.snakes.forEach(snake => {
            if (snake.body[0].x === this.food.x && snake.body[0].y === this.food.y) {
                // Determine effect based on type
                if (this.food.type === 'normal') {
                    snake.growPending++;
                    snake.score++;
                } else if (this.food.type === 'gold') {
                    snake.growPending += 3;
                    snake.score += 50;
                } else if (this.food.type === 'blue') {
                    snake.growPending++;
                    snake.score += 5;
                    // Slow down game
                    this.currentSpeed = 200; // Slower
                    this.speedEffectTimer = 5000; // 5 seconds
                }

                this.spawnFood();
                this.updateScoreUI();
            }
        });
    }

    updateScoreUI() {
        if (this.snakes[0]) scoreP1El.innerText = this.snakes[0].score;
        if (this.snakes[1]) scoreP2El.innerText = this.snakes[1].score;
    }

    draw() {
        // Clear Canvas
        ctx.fillStyle = COLORS.bg;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Food
        let foodColor = COLORS.food;
        if (this.food.type === 'gold') foodColor = COLORS.gold;
        if (this.food.type === 'blue') foodColor = COLORS.blue;
        this.drawRect(this.food.x, this.food.y, foodColor, true);

        // Draw Snakes
        this.snakes.forEach(snake => {
            snake.body.forEach((segment, index) => {
                const isHead = index === 0;
                this.drawRect(segment.x, segment.y, snake.color, isHead);
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
        ctx.shadowBlur = 0; // Reset
    }

    loop(timestamp) {
        if (!this.isRunning) return;

        // Throttle game loop for speed control
        if (timestamp - this.lastTime < this.currentSpeed) {
            this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
            return;
        }

        this.lastTime = timestamp;
        this.update();
        this.draw();

        if (this.isRunning) {
            this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
        }
    }
}

// Start the game instance
const game = new Game();
