// CANVAS MOVED TO SCOPE
// --- GLOBAL DEBUG OVERLAY (v3.4) ---
// --- GLOBAL DEBUG OVERLAY (v3.4) ---
// HIDDEN FOR PRODUCTION
/*
const debugOverlay = document.createElement('ul');
debugOverlay.id = 'debug-log';
debugOverlay.style.position = 'fixed';
debugOverlay.style.top = '0';
debugOverlay.style.left = '0';
debugOverlay.style.width = '100%';
debugOverlay.style.height = '150px';
debugOverlay.style.overflowY = 'scroll';
debugOverlay.style.background = 'rgba(0,0,0,0.85)';
debugOverlay.style.color = '#0f0';
debugOverlay.style.fontSize = '12px';
debugOverlay.style.zIndex = '999999';
debugOverlay.style.pointerEvents = 'none';
debugOverlay.style.padding = '5px';
debugOverlay.style.fontFamily = 'monospace';
document.body.appendChild(debugOverlay);
*/

function log(msg) {
    // console.log(msg); // Reduced noise
    // if (typeof debugOverlay !== 'undefined') { ... }
}

// Trap Global Errors
window.onerror = function (msg, url, line) {
    log("CRITICAL ERROR: " + msg + " @ " + line);
    return false;
};

// Trap Unhandled Promises
window.addEventListener('unhandledrejection', function (event) {
    log("UNHANDLED PROMISE: " + event.reason);
});

// MAIN WRAPPER START
window.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('game-canvas');
    if (!canvas) { log("CRITICAL: Canvas not found!"); return; }
    const ctx = canvas.getContext('2d');

    log("v4.20 (Debug Sync Stats)...");
    // log("Screen: " + window.innerWidth + "x" + window.innerHeight);

    // FORCE TOUCH ACTION & NO SCROLL
    document.documentElement.style.touchAction = 'none';
    document.body.style.touchAction = 'none';
    // Prevent "Rubber banding" or "Pull to refresh"
    document.body.style.overflow = 'hidden';
    document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    if (canvas) canvas.style.touchAction = 'none';
    // -----------------------------------

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
            this.blindTimer = 0;
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
            if (this.blindTimer > 0) this.blindTimer -= tickRate;

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

            // Multiplayer Props
            this.peer = null;
            this.conn = null;
            this.isHost = false;
            this.isClient = false;
            this.remoteInput = { up: false, down: false, left: false, right: false };
            this.clientState = null; // For client to render

            this.initListeners();
            this.initMultiplayer(); // AUTO-RUN

            // Delay resize slightly to ensure layout is ready
            setTimeout(() => this.resize(), 50);
            window.addEventListener('resize', () => this.resize());
            this.loadHighScores();
            this.showMainMenu();
        }

        initMultiplayer() {
            const btnHost = document.getElementById('btn-host');
            const btnJoin = document.getElementById('btn-join');
            const btnConnect = document.getElementById('connect-btn');
            const lobbyBack = document.getElementById('lobby-back-btn');
            const joinBack = document.getElementById('join-back-btn');

            if (btnHost) btnHost.onclick = () => this.startHost();
            if (btnJoin) btnJoin.onclick = () => {
                document.getElementById('main-menu').classList.remove('active');
                document.getElementById('main-menu').classList.add('hidden');
                document.getElementById('join-screen').classList.remove('hidden');
                document.getElementById('join-screen').classList.add('active');
            };

            if (lobbyBack) lobbyBack.onclick = () => location.reload();
            if (joinBack) joinBack.onclick = () => location.reload();

            if (btnConnect) {
                btnConnect.onclick = () => {
                    const codeInput = document.getElementById('join-id-input');
                    if (codeInput && codeInput.value) {
                        this.joinGame(codeInput.value);
                    } else {
                        alert("Please enter a code!");
                    }
                };
            }

            // 2. Check URL for Auto-Join (?join=CODE)
            const urlParams = new URLSearchParams(window.location.search);
            const joinCode = urlParams.get('join');
            if (joinCode) {
                console.log("Auto-Joining:", joinCode);
                // Wait a sec for UI init
                setTimeout(() => this.joinGame(joinCode), 500);
            }
        }

        startHost() {
            // UI Swith
            document.getElementById('main-menu').classList.remove('active');
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('lobby-screen').classList.remove('hidden');
            document.getElementById('lobby-screen').classList.add('active');

            // Reset Status
            document.getElementById('host-id-display').innerText = "...";
            document.getElementById('host-status').innerText = "CONNECTING TO SERVER...";
            document.getElementById('host-status').style.color = "#ffff00";

            // Generate Random ID (4 letters)
            const hostId = Math.random().toString(36).substring(2, 6).toUpperCase();

            try {
                // Init Peer
                this.peer = new Peer(hostId);

                this.peer.on('open', (id) => {
                    console.log('My peer ID is: ' + id);
                    document.getElementById('host-id-display').innerText = id;
                    document.getElementById('host-status').innerText = "WAITING FOR PLAYER 2...";
                    document.getElementById('host-status').style.color = "#aaa";

                    // Gen QR
                    const url = location.protocol + '//' + location.host + location.pathname + '?join=' + id;
                    document.getElementById('qrcode').innerHTML = "";
                    new QRCode(document.getElementById("qrcode"), { text: url, width: 128, height: 128 });
                });

                this.peer.on('error', (err) => {
                    console.error("PeerJS Error:", err);
                    alert("HOST ERROR: " + err.type);
                });

                this.peer.on('connection', (conn) => {
                    console.log("Client connected!");
                    this.conn = conn;
                    this.isHost = true;

                    document.getElementById('host-status').innerText = "PLAYER 2 CONNECTED! STARTING...";
                    document.getElementById('host-status').style.color = "#00ff00";

                    // Setup Data Listener
                    conn.on('data', (data) => {
                        if (data.type === 'input') {
                            this.handleRemoteInput(data.key);
                        } else if (data.type === 'hello') {
                            // RESOLUTION SYNC
                            // alert("HOST RX HELLO: " + data.width + "x" + data.height); // DEBUG
                            console.log("Client Resolution:", data.width, data.height);
                            this.multiplayerTargetWidth = data.width;
                            this.multiplayerTargetHeight = data.height;
                            this.resize();
                        } else if (data.type === 'restart') {
                            this.startGame('multi');
                        }
                    });

                    conn.on('open', () => {
                        // Start Game after delay
                        setTimeout(() => {
                            document.getElementById('lobby-screen').classList.add('hidden');
                            document.getElementById('lobby-screen').classList.remove('active');
                            this.startGame('multi');
                        }, 500);
                    });
                });
            } catch (e) {
                alert("PeerJS Init Failed: " + e);
            }
        }

        initListeners() {
            document.addEventListener('keydown', (e) => this.handleInput(e));

            // Helper for reliable button clicks (Touch + Mouse)
            const bindButton = (btn, callback) => {
                if (!btn) return;
                btn.onclick = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    callback(e);
                };
                btn.ontouchend = (e) => {
                    e.preventDefault(); e.stopPropagation();
                    callback(e);
                };
            };

            bindButton(btn1P, () => { log("START: Single"); this.startGame('single'); });
            bindButton(btn2P, () => { log("START: Multi"); this.startGame('multi'); });

            bindButton(restartBtn, () => {
                log("RESTART CLICK");
                if (this.isClient && this.conn && this.conn.open) {
                    this.conn.send({ type: 'restart' });
                } else {
                    this.startGame(this.gameMode);
                }
            });

            bindButton(menuBtn, () => location.reload());
            bindButton(btnResume, () => this.togglePause());

            // Host/Join Buttons too (defined in initMultiplayer, but we can grab them here or leave them default?)
            // Let's rely on initMultiplayer for those, or re-bind them if we can access them.
            // Better to just fix them in initMultiplayer if they are broken.
            // Actually, initMultiplayer does `btnHost.onclick`. We should upgrade that too.

            if (submitScoreBtn) bindButton(submitScoreBtn, () => this.submitHighScore());

            // Global Touch Listeners (Window) for maximum reliability
            window.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
            window.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
            window.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });

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
            if (btnResume) btnResume.classList.add('hidden');

            this.loadHighScores();
            this.draw();
        }

        joinGame(hostId) {
            console.log("Joining Host:", hostId);

            // UI Feedback
            document.getElementById('main-menu').classList.remove('active');
            document.getElementById('main-menu').classList.add('hidden');
            document.getElementById('join-screen').classList.add('hidden');

            const lobby = document.getElementById('lobby-screen');
            lobby.classList.remove('hidden');
            lobby.classList.add('active');
            document.getElementById('qrcode').innerHTML = "";
            document.querySelector('#lobby-screen p').style.display = 'none';

            document.getElementById('host-id-display').innerText = hostId;
            const statusEl = document.getElementById('host-status');
            statusEl.innerText = "INITIALIZING CLIENT...";
            statusEl.style.color = "#ffff00";

            try {
                this.peer = new Peer();

                this.peer.on('open', (id) => {
                    statusEl.innerText = "FINDING HOST " + hostId + "...";

                    this.conn = this.peer.connect(hostId);

                    this.conn.on('open', () => {
                        statusEl.innerText = "CONNECTED! GETTING READY...";
                        statusEl.style.color = "#00ff00";
                        this.isClient = true;

                        // Send Resolution Hello
                        setTimeout(() => {
                            this.conn.send({
                                type: 'hello',
                                width: window.innerWidth,
                                height: window.innerHeight
                            });
                        }, 200);
                    });

                    this.conn.on('data', (data) => {
                        if (data.type === 'state') {
                            this.clientState = data;

                            // SYNC DIMENSIONS (New v3.8 Fix)
                            if (data.dims) {
                                if (CANVAS_WIDTH !== data.dims.w || CANVAS_HEIGHT !== data.dims.h) {
                                    console.log("SYNC DIMS:", data.dims);
                                    // PERSIST TARGETS so resize() uses them!
                                    this.multiplayerTargetWidth = data.dims.w;
                                    this.multiplayerTargetHeight = data.dims.h;

                                    // Apply immediately
                                    CANVAS_WIDTH = data.dims.w;
                                    CANVAS_HEIGHT = data.dims.h;
                                    canvas.width = CANVAS_WIDTH;
                                    canvas.height = CANVAS_HEIGHT;
                                    canvas.style.width = CANVAS_WIDTH + 'px';
                                    canvas.style.height = CANVAS_HEIGHT + 'px';
                                    log("SYNC APPLIED: " + CANVAS_WIDTH + "x" + CANVAS_HEIGHT); // User visible log
                                }
                            }

                            if (!this.isRunning) {
                                lobby.classList.add('hidden');
                                lobby.classList.remove('active');
                                this.startGame('multi');
                            }
                        }
                    });

                    this.conn.on('error', (err) => {
                        alert("CLIENT Connection Error: " + err);
                        location.reload();
                    });

                    setTimeout(() => {
                        if (!this.conn.open) {
                            alert("TIMEOUT: Could not connect to Host " + hostId + ".\nCheck firewalls?");
                            location.reload();
                        }
                    }, 8000);
                });

                this.peer.on('error', err => {
                    alert("CLIENT Peer Error: " + err.type);
                    location.reload();
                });

            } catch (e) {
                alert("CLIENT EXCEPTION: " + e);
                location.reload();
            }
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
                    const displayData = data.slice(0, 5);

                    displayData.forEach((s, i) => {
                        const li = document.createElement('li');
                        li.innerHTML = `<span>#${i + 1} ${s.name}</span> <span>${s.score} pts</span>`;

                        if (highlightName && highlightScore && s.name === highlightName && s.score == highlightScore && !foundHighlight) {
                            li.classList.add('highlight');
                            foundHighlight = true;
                        }
                        highScoreList.appendChild(li);
                    });

                    localStorage.setItem('snake_highscores_cache', JSON.stringify(data));
                })
                .catch(err => {
                    console.error("HighScore Load Error:", err);
                    if (highScoreList) highScoreList.innerHTML = '<li>Error loading scores.</li>';
                });
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
            // alert("STARTING GAME: " + mode);
            console.log("STARTING GAME MODE:", mode);

            try {
                this.gameMode = mode;
                this.resize();
                this.snakes = [];
                this.powerups = [];
                this.walls = [];
                this.baseSpeed = 100;
                this.currentSpeed = this.baseSpeed;
                this.totalFoodEaten = 0;
                this.isPaused = false;
                this.lastTime = performance.now();

                console.log("Initializing Snakes...");
                if (mode === 'single') {
                    const s1 = new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' });
                    this.snakes.push(s1);
                } else {
                    const s1 = new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' });

                    // Ensure valid start pos for P2
                    let p2x = Math.floor(CANVAS_WIDTH / GRID_SIZE) - 6;
                    let p2y = Math.floor(CANVAS_HEIGHT / GRID_SIZE) - 6;
                    if (p2x < 10) p2x = 20;
                    if (p2y < 10) p2y = 20;

                    const s2 = new Snake(2, COLORS.p2, { x: p2x, y: p2y }, { x: -1, y: 0 },
                        { up: 'w', down: 's', left: 'a', right: 'd' });

                    this.snakes = [s1, s2];
                }
                console.log("Snakes initialized:", this.snakes.length);

                // Force a resize check BEFORE spawning to avoid 0x0 canvas -> Center Spawn Fallback
                this.resize();

                // Validate Canvas Size
                if (CANVAS_WIDTH <= 0 || CANVAS_HEIGHT <= 0) {
                    console.error("CRITICAL: Canvas size 0. Forcing defaults.");
                    CANVAS_WIDTH = 800; CANVAS_HEIGHT = 600;
                    canvas.width = 800; canvas.height = 600;
                }

                // Safety delay for spawn if canvas is somehow still weird, otherwise immediate
                this.spawnFood();
                this.spawnFood();
                this.spawnFood();

                this.isRunning = true;

                mainMenu.classList.remove('active');
                mainMenu.classList.add('hidden');
                gameOverScreen.classList.add('hidden');
                scoreBoard.classList.remove('hidden');

                if (p2ScoreBox) p2ScoreBox.style.display = mode === 'single' ? 'none' : 'flex';
                this.updateScoreUI();

                if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
                this.loop(this.lastTime);

                console.log("Game Start Sequence Complete.");

            } catch (e) {
                console.error("START GAME ERROR:", e);
                alert("START ERROR: " + e.message);
            }
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
            if (this.multiplayerTargetWidth) {
                const mw = Math.floor((this.multiplayerTargetWidth - 4) / GRID_SIZE) * GRID_SIZE;
                const mh = Math.floor((this.multiplayerTargetHeight - 4) / GRID_SIZE) * GRID_SIZE;

                // Use smallest common denominator (min width/height)
                if (mw < CANVAS_WIDTH) CANVAS_WIDTH = mw;
                if (mh < CANVAS_HEIGHT) CANVAS_HEIGHT = mh;

                if (typeof log !== 'undefined') log(`RESIZE SYNC: Target=${this.multiplayerTargetWidth}x${this.multiplayerTargetHeight} -> Applied=${CANVAS_WIDTH}x${CANVAS_HEIGHT}`);
            } else {
                if (typeof log !== 'undefined') log(`RESIZE: ${CANVAS_WIDTH}x${CANVAS_HEIGHT} (No Sync Target)`);
            }

            // MULTIPLAYER RESOLUTION SYNC
            if (this.gameMode === 'multi') {
                if (this.isHost && this.multiplayerTargetWidth) {
                    // HOST: Must shrink to fit Client
                    const mw = Math.floor((this.multiplayerTargetWidth - 4) / GRID_SIZE) * GRID_SIZE;
                    const mh = Math.floor((this.multiplayerTargetHeight - 4) / GRID_SIZE) * GRID_SIZE;

                    if (mw < CANVAS_WIDTH) CANVAS_WIDTH = mw;
                    if (mh < CANVAS_HEIGHT) CANVAS_HEIGHT = mh;

                    // log("HOST SYNC: Shrinking to " + CANVAS_WIDTH + "x" + CANVAS_HEIGHT);
                }
                else if (this.isClient && this.multiplayerTargetWidth) {
                    // CLIENT: Must MATCH Host exactly (Host has already calculated the Min)
                    // NOTE: We trust the Host's 'dims' broadcast implicitly
                    CANVAS_WIDTH = this.multiplayerTargetWidth;
                    CANVAS_HEIGHT = this.multiplayerTargetHeight;
                    // log("CLIENT SYNC: Forcing " + CANVAS_WIDTH + "x" + CANVAS_HEIGHT);
                }
            }

            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;

            // FIX: Enforce 1:1 pixel mapping logic, but SCALE visually
            // canvas.style.width = CANVAS_WIDTH + 'px';
            // canvas.style.height = CANVAS_HEIGHT + 'px';

            // VISUAL SCALING (Fit to Window)
            const scaleX = window.innerWidth / CANVAS_WIDTH;
            const scaleY = window.innerHeight / CANVAS_HEIGHT;
            const scale = Math.min(scaleX, scaleY) * 0.95; // 95% to leave margin

            canvas.style.width = Math.floor(CANVAS_WIDTH * scale) + 'px';
            canvas.style.height = Math.floor(CANVAS_HEIGHT * scale) + 'px';

            // DEBUG DISPLAY (Temporary - Remove if distracting, but good for user proof)
            if (ctx) {
                // We can't draw here because draw() clears it.
                // We rely on log() or just the fact it works.
            }

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

            // Force Redraw Every Frame (No Caching)
            dynamicLegend.innerHTML = '';

            let renderPowerups = this.powerups || []; // Default to empty array

            // 1. Draw Static Powerups (Available on board)
            renderPowerups.forEach(p => {
                const def = this.powerUpTypes[p.type];
                const div = document.createElement('div');
                div.className = 'legend-item';
                div.innerHTML = `<span class="dot ${p.type}" style="background-color:${def.color}"></span> ${def.label}`;
                dynamicLegend.appendChild(div);
            });

            // 2. Draw Active Timers (Ghost Style: Individual rows)
            const s1 = this.snakes[0];
            if (s1) {

                // Helper to add a timer row
                const addTimer = (type, seconds, labelOverride = null) => {
                    const def = this.powerUpTypes[type];
                    const label = labelOverride || def.label;
                    const div = document.createElement('div');
                    div.className = 'legend-item'; // Use standard class
                    // Add specific styling to make it pop
                    div.style.color = '#fff';
                    div.style.fontWeight = 'bold';
                    div.style.textShadow = '0 0 5px ' + def.color;

                    div.innerHTML = `<span class="dot ${type}" style="background-color:${def.color}; box-shadow: 0 0 8px ${def.color}"></span> ${label} (${seconds}s)`;
                    dynamicLegend.appendChild(div);
                };

                if (s1.ghostTimer > 0) {
                    addTimer('ghost', Math.ceil(s1.ghostTimer / 1000), "GHOST");
                }
                if (s1.shieldTimer > 0) {
                    addTimer('shield', Math.ceil(s1.shieldTimer / 1000), "SHIELD");
                }
                if (s1.magnetTimer > 0) {
                    addTimer('magnet', Math.ceil(s1.magnetTimer / 1000), "MAGNET");
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

        handleTouchStart(e) {
            // Allow clicks on buttons/inputs/menu to pass through
            if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.menu-screen')) {
                // Do not prevent default
            } else {
                e.preventDefault();
            }

            const touch = e.changedTouches[0];
            this.touchStartX = touch.clientX;
            this.touchStartY = touch.clientY;
            if (typeof log !== 'undefined') log(`Start: ${Math.floor(this.touchStartX)},${Math.floor(this.touchStartY)}`);
        }

        handleTouchMove(e) {
            // Prevent scrolling if NOT inside menu
            if (!e.target.closest('.menu-screen')) {
                e.preventDefault();
            }

            if (!this.isRunning || this.isPaused) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;

            // Continuous Swipe Threshold (Lower than tap threshold slightly to feel responsive?)
            // Let's stick to 30px for "move detected"
            if (Math.abs(deltaX) > 30 || Math.abs(deltaY) > 30) {
                let key = '';
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    key = deltaX > 0 ? 'ArrowRight' : 'ArrowLeft';
                } else {
                    key = deltaY > 0 ? 'ArrowDown' : 'ArrowUp';
                }

                // Trigger Input
                if (this.snakes.length > 0) {
                    this.snakes[0].handleInput(key);
                }

                // RESET Start Position to current finger position
                // This is the key for "Continuous" swiping (Up -> Right without lifting)
                this.touchStartX = touch.clientX;
                this.touchStartY = touch.clientY;
            }
        }

        handleTouchEnd(e) {
            // Always allow button clicks to finish
            if (e.target.closest('button') || e.target.closest('input')) {
                return;
            }

            if (!e.target.closest('.menu-screen')) {
                e.preventDefault();
            }

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;

            if (typeof log !== 'undefined') log(`End dX:${Math.floor(deltaX)} dY:${Math.floor(deltaY)} Run:${this.isRunning} Paused:${this.isPaused}`);

            if (!this.isRunning || this.isPaused) return;

            // Threshold for swipe vs tap (Increased to 30px for stability)
            if (Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30) {
                if (typeof log !== 'undefined') log("Tap ignored (<30px)");
                return;
            }

            // Determine Direction
            let key = '';
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Horizontal
                key = deltaX > 0 ? 'ArrowRight' : 'ArrowLeft';
            } else {
                // Vertical
                key = deltaY > 0 ? 'ArrowDown' : 'ArrowUp';
            }

            if (typeof log !== 'undefined') log(`SWIPE: ${key}`);

            // Simulate "Networkable" Input
            if (typeof log !== 'undefined') log(`TOUCH -> HANDLE INPUT: ${key}`);
            this.handleInput({ key: key, preventDefault: () => { } });
        }

        handleRemoteInput(key) {
            if (typeof log !== 'undefined') log("HOST RX: " + key);

            if (this.snakes.length > 1 && this.snakes[1]) {
                const p2 = this.snakes[1];

                // MAP Arrows (from Client Touch) to WASD (Player 2 Local)
                let mappedKey = key;
                if (key === 'ArrowUp') mappedKey = 'w';
                if (key === 'ArrowDown') mappedKey = 's';
                if (key === 'ArrowLeft') mappedKey = 'a';
                if (key === 'ArrowRight') mappedKey = 'd';

                p2.handleInput(mappedKey);
            }
        }


        handleInput(e) {
            if (e.key.toLowerCase() === 'p' && this.isRunning && !this.isClient) {
                this.togglePause();
                return;
            }

            // Network Client Input
            if (this.isClient) {
                if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                    e.preventDefault();
                    if (typeof log !== 'undefined') log(`CLIENT INPUT: ${e.key} Send: ${this.conn && this.conn.open}`);
                    if (this.conn && this.conn.open) {
                        this.conn.send({ type: 'input', key: e.key });
                    }
                }
                return; // Client ONLY sends input, does not move locally
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
            // Note: this.lastTime is updated at end of loop(), but here we need delta for logic. 
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

            // Force Redraw Every Frame (No Caching)
            dynamicLegend.innerHTML = '';

            let renderPowerups = this.powerups;
            if (this.isClient && this.clientState) {
                renderPowerups = this.clientState.powerups;
            }

            // 1. Draw Static Powerups (Available on board)
            if (renderPowerups) {
                renderPowerups.forEach(p => {
                    const def = this.powerUpTypes[p.type];
                    const div = document.createElement('div');
                    div.className = 'legend-item';
                    div.innerHTML = `<span class="dot ${p.type}" style="background-color:${def.color}"></span> ${def.label}`;
                    dynamicLegend.appendChild(div);
                });
            }

            // 2. Draw Active Timers (Ghost Style: Individual rows)
            const s1 = this.snakes[0];
            if (this.gameMode === 'single' && s1) {

                // Helper to add a timer row
                const addTimer = (type, seconds, labelOverride = null) => {
                    const def = this.powerUpTypes[type];
                    const label = labelOverride || def.label;
                    const div = document.createElement('div');
                    div.className = 'legend-item'; // Use standard class
                    // Add specific styling to make it pop
                    div.style.color = '#fff';
                    div.style.fontWeight = 'bold';
                    div.style.textShadow = '0 0 5px ' + def.color;

                    div.innerHTML = `<span class="dot ${type}" style="background-color:${def.color}; box-shadow: 0 0 8px ${def.color}"></span> ${label} (${seconds}s)`;
                    dynamicLegend.appendChild(div);
                };

                if (s1.ghostTimer > 0) {
                    addTimer('ghost', Math.ceil(s1.ghostTimer / 1000), "GHOST");
                }
                if (s1.shieldTimer > 0) {
                    addTimer('shield', Math.ceil(s1.shieldTimer / 1000), "SHIELD");
                }
                if (s1.magnetTimer > 0) {
                    addTimer('magnet', Math.ceil(s1.magnetTimer / 1000), "MAGNET");
                }
            }
        }

        draw() {
            // CLIENT RENDER OVERRIDE
            let renderSnakes = this.snakes || [];
            let renderFoods = this.foods || [];
            let renderPowerups = this.powerups || [];
            let renderWalls = this.walls || [];

            if (this.isClient && this.clientState) {
                renderSnakes = this.clientState.snakes || [];
                renderFoods = this.clientState.foods || [];
                renderPowerups = this.clientState.powerups || [];
                renderWalls = this.clientState.walls || [];
                // Update Score UI from state
                if (scoreP1El && renderSnakes[0]) scoreP1El.innerText = renderSnakes[0].score;
                if (scoreP2El && renderSnakes[1]) scoreP2El.innerText = renderSnakes[1].score;
            }

            // Blind Effect Logic
            let isBlinded = false;
            renderSnakes.forEach(s => {
                if (s.blindTimer > 0) isBlinded = true;
            });

            const container = document.querySelector('.game-container');
            if (container) {
                if (isBlinded) container.classList.add('blinded');
                else container.classList.remove('blinded');
            }

            ctx.fillStyle = COLORS.bg;
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

            // Draw Stats for Debugging (Sync Proof)
            ctx.fillStyle = this.isHost ? '#00ff88' : '#00ccff';
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`LOGIC: ${CANVAS_WIDTH}x${CANVAS_HEIGHT}`, 10, 20);
            ctx.fillText(`VISUAL: ${canvas.width}x${canvas.height}`, 10, 35);
            ctx.fillText(`STYLE: ${canvas.style.width}x${canvas.style.height}`, 10, 50);
            if (this.multiplayerTargetWidth) {
                ctx.fillText(`TARGET: ${this.multiplayerTargetWidth}px`, 10, 65);
            }

            // Draw Walls (Distinct Texture for Placed Walls)
            // Walls in this.walls are placed by powerups. Normal borders are implicit.
            renderWalls.forEach(w => {
                // "Danger" style: Brown with Red X or border
                this.drawRect(w.x, w.y, COLORS.brown);
                // Draw a red X or inner square to signify danger
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.strokeRect(w.x * GRID_SIZE + 4, w.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);
            });

            // Draw Powerups
            renderPowerups.forEach(p => {
                const def = this.powerUpTypes[p.type];
                this.drawRect(p.x, p.y, def ? def.color : '#fff', true);
            });

            // Draw Foods (Multi-Food)
            if (renderFoods) {
                renderFoods.forEach(f => {
                    this.drawRect(f.x, f.y, COLORS.food, true);
                });
            }

            // Draw Snakes
            renderSnakes.forEach(snake => {
                const snakeColor = snake.hasShield ? COLORS.silver :
                    snake.ghostTimer > 0 ? COLORS.ghost :
                        snake.blindTimer > 0 ? '#0a0a0a' : snake.color; // Almost black, but slight vis checks allowed? No, make it dark.
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

        broadcastState() {
            if (!this.isHost || !this.conn || !this.conn.open) return;

            const state = {
                type: 'state',
                snakes: this.snakes,
                foods: this.foods,
                powerups: this.powerups,
                walls: this.walls,
                dims: { w: CANVAS_WIDTH, h: CANVAS_HEIGHT } // Send Host Dims
            };

            try {
                this.conn.send(state);
            } catch (e) {
                console.error("Broadcast Error:", e);
            }
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

            if (this.isHost) {
                this.broadcastState();
            }

            this.draw();
            if (this.isRunning) this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));
        }
    }

    // Initialize Game
    const game = new Game();
    game.initMultiplayer(); // Explicitly call this!
    game.loop(0);

}); // MAIN WRAPPER END
