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

// Trap Global Errors (Alert User)
window.onerror = function (msg, url, line) {
    log("CRITICAL ERROR: " + msg + " @ " + line);
    // alert("GLOBAL ERROR: " + msg); // Uncomment for extreme debugging
    return false;
};

window.addEventListener('unhandledrejection', function (event) {
    log("UNHANDLED PROMISE: " + event.reason);
});

// MAIN WRAPPER START
window.addEventListener('DOMContentLoaded', () => {

    const canvas = document.getElementById('game-canvas');
    if (!canvas) { log("CRITICAL: Canvas not found!"); return; }
    const ctx = canvas.getContext('2d');

    log("v4.8 (High Score Screen + Cache Fix)...");
    // alert("VERSION 1.15 UPDATE INSTALLED! \n(Trykk OK for å starte)");
    // alert("VERSION 6.3 INSTALLED! \nCache broken successfully.");
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

    // High Score Screen Elements
    const btnHighScores = document.getElementById('btn-highscores');
    const highScoreScreen = document.getElementById('high-score-screen');
    const btnBackHighScores = document.getElementById('btn-back-highscores');

    // Colors
    const COLORS = {
        p1: '#00ff88',
        p2: '#00ccff',
        food: '#ff0055',
        grid: '#1a1a1a',
        bg: '#000814', // Deep Navy (User Preference v4.2)
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
            this.wallTrapTimer = 0; // New v1.25 (Replaces Ghost in 2P)
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
            if (this.wallTrapTimer > 0) this.wallTrapTimer -= tickRate;

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

                // v1.25: Start Wrapping Logic
                // Single Player: Wraps ONLY with Ghost
                // Multiplayer: Wraps ALWAYS UNLESS Wall Trapped
                const isMulti = !isSingleMode;
                const canWrap = (isSingleMode && this.ghostTimer > 0) ||
                    (isMulti && this.wallTrapTimer <= 0);

                if (canWrap) {
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

                        // MINE LOGIC: Allow Owner to pass through their own walls (Multiplayer)
                        if (w.ownerId !== undefined && w.ownerId === this.id) {
                            // Safe! (It's a mine, and I placed it)
                            break;
                        }

                        if (this.hasShield) {
                            this.hasShield = false;
                            this.shieldTimer = 0;
                            if (onShieldBreak) onShieldBreak(newHead.x, newHead.y);

                            // CRITICAL FIX: Stop movement
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

        checkSelfCollision(onShieldBreak) {
            // Invulnerability check
            if (this.invulnerable || this.ghostTimer > 0) return false;

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
            this.projectiles = []; // Array of {x, y, dx, dy, ownerId, createdAt}
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

            // Check params for Test Mode
            const urlParams = new URLSearchParams(window.location.search);
            this.testMode = urlParams.get('test'); // 'torpedo'
            if (this.testMode) {
                console.log("TEST MODE ACTIVE:", this.testMode);
                // alert("TEST MODE: " + this.testMode); // Debugging
            }

            // Platform Detection
            this.platform = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'mobile' : 'pc';
            this.viewingPlatform = this.platform;

            // Power Up Types Definition
            this.powerUpTypes = {
                'ghost': { color: COLORS.ghost, label: 'Wall Trap' },
                'eraser': { color: COLORS.white, label: 'Eraser' },
                'blind': { color: COLORS.black, label: 'Blind' },
                'speed': { color: COLORS.orange, label: 'Speed' },
                'ice': { color: COLORS.cyan, label: 'Ice' },
                'bomb': { color: COLORS.red, label: 'Bomb' },
                'shield': { color: COLORS.silver, label: 'Shield' },
                'magnet': { color: COLORS.pink, label: 'Magnet' },
                'switch': { color: COLORS.green, label: 'Switch' },
                'wall': { color: COLORS.brown, label: 'Wall' },
                'slow': { color: COLORS.blue, label: 'Slow' },
                'torpedo': { color: '#FFD700', label: 'TORPEDO' }
            };

            // Multiplayer Props
            this.peer = null;
            this.conn = null;
            this.isHost = false;
            this.isClient = false;
            this.remoteInput = { up: false, down: false, left: false, right: false };
            this.clientState = null;

            this.initListeners();
            this.initMultiplayer();

            // Delay resize
            setTimeout(() => this.resize(), 50);
            window.addEventListener('resize', () => this.resize());
            this.loadHighScores();

            if (!this.autoJoining) {
                this.showMainMenu();
            }
            if (this.btnBackHighScores) {
                this.bindButton('btn-back-highscores', () => {
                    this.showMainMenu();
                });
            }
        }

        initMultiplayer() {
            const btnHost = document.getElementById('btn-host');
            const btnJoin = document.getElementById('btn-join');
            // FIX: ID Mismatch (html: connect-btn, js: btn-connect)
            // HTML ID is 'connect-btn'
            const btnConnect = document.getElementById('connect-btn');
            const lobbyBack = document.getElementById('lobby-back-btn');
            const joinBack = document.getElementById('join-back-btn');

            if (btnHost) {
                btnHost.onclick = (e) => {
                    if (e) e.preventDefault();
                    this.startHost();
                };
                btnHost.ontouchend = (e) => {
                    if (e) e.preventDefault();
                    this.startHost();
                };
            }

            if (btnJoin) btnJoin.onclick = (e) => {
                if (e) e.preventDefault();
                this.hideAllScreens();
                const js = document.getElementById('join-screen');
                js.classList.remove('hidden');
                js.classList.remove('nuclear-hidden');
                js.classList.add('active');
                js.style.display = 'flex';
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
                this.autoJoining = true; // Flag to prevent Main Menu
                // Ensure Main Menu is hidden
                const mm = document.getElementById('main-menu');
                if (mm) { mm.classList.add('hidden'); mm.classList.remove('active'); }

                // Show JOIN screen immediately to indicate activity (or Lobby if we had one for client)
                // Actually joinGame handles UI switch, so just call it.
                // Wait a tiny bit for PeerJS to be ready? No, new Peer() is in joinGame.
                setTimeout(() => this.joinGame(joinCode), 500);
            }
        }

        stopGame() {
            this.isRunning = false;
            this.isPaused = false;
            if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
            // Optional: Clear canvas?
            // const ctx = canvas.getContext('2d');
            // ctx.clearRect(0, 0, canvas.width, canvas.height); 
            // Better to leave it as background or explicitly clear if desired.
        }

        hideAllScreens() {
            // Ensure Nuclear Class Exists
            if (!document.getElementById('nuclear-style')) {
                const style = document.createElement('style');
                style.id = 'nuclear-style';
                style.innerHTML = '.nuclear-hidden { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
                document.head.appendChild(style);
            }

            const screens = document.querySelectorAll('.menu-screen');
            screens.forEach(s => {
                s.classList.add('hidden');
                s.classList.add('nuclear-hidden'); // NUKE IT
                s.classList.remove('active');
                s.style.display = 'none'; // TRIPLE KILL
            });
        }

        startHost() {
            this.stopGame(); // KILL ANY RUNNING GAME

            // 1. Reset UI State completely
            this.hideAllScreens();
            // DOUBLE TAP MAIN MENU
            const mm = document.getElementById('main-menu');
            if (mm) {
                mm.classList.add('hidden');
                mm.classList.add('nuclear-hidden');
                mm.classList.remove('active');
                mm.style.display = 'none';
            }

            // 2. Show Lobby
            const lobby = document.getElementById('lobby-screen');
            if (lobby) {
                lobby.classList.remove('hidden');
                lobby.classList.remove('nuclear-hidden'); // UN-NUKE
                lobby.classList.add('active');
                lobby.style.display = 'flex'; // Force Flex
            }

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

                    // Share Button Handler
                    const shareBtn = document.getElementById('lobby-share-btn');
                    if (shareBtn) {
                        shareBtn.onclick = async () => {
                            if (navigator.share) {
                                try {
                                    await navigator.share({
                                        title: 'Neon Snake Game',
                                        text: 'Join my Neon Snake game!',
                                        url: url
                                    });
                                    console.log('Shared successfully');
                                } catch (err) {
                                    console.error('Share failed:', err);
                                }
                            } else {
                                // Fallback: Copy to Clipboard
                                try {
                                    await navigator.clipboard.writeText(url);
                                    alert("Link copied to clipboard!");
                                } catch (err) {
                                    prompt("Copy this link:", url);
                                }
                            }
                        };
                    }
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

                    // Setup Data Listener (Robus Re-implementation)
                    // If conn was already open, 'data' might fire immediately
                    // If not, we wait.

                    // Clear previous to avoid duplicates? (PeerJS usually handles this per conn instance)

                    conn.on('data', (data) => {
                        console.log("RX:", data); // Global Data Debug
                        if (data.type === 'input') {
                            this.handleRemoteInput(data.key);
                        } else if (data.type === 'hello') {
                            // RESOLUTION SYNC
                            // alert("HOST RX HELLO: " + data.width + "x" + data.height); // DEBUG
                            console.log("Client Resolution:", data.width, data.height);
                            // Lock it in
                            this.multiplayerTargetWidth = data.width;
                            this.multiplayerTargetHeight = data.height;

                            try {
                                this.resize();
                            } catch (e) { console.error("Resize Error:", e); }

                            // Visual Confirmation of Sync
                            const status = document.getElementById('host-status');
                            if (status) {
                                status.innerText = `SYNCED WITH CLIENT (${data.width}x${data.height})`;
                                status.style.color = "#00ff88";
                                status.style.textShadow = "0 0 10px #00ff88";
                            }
                        } else if (data.type === 'restart') {
                            this.startGame('multi');
                        } else if (data.type === 'gameover') {
                            this.gameOver(data.winner);
                        }
                    });

                    const handleOpen = () => {
                        // Start Game after delay
                        setTimeout(() => {
                            this.hideAllScreens();
                            this.startGame('multi');
                        }, 500);
                    };

                    if (conn.open) {
                        handleOpen();
                    } else {
                        conn.on('open', handleOpen);
                    }
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

            // High Score Navigation
            const btnHighScores = document.getElementById('btn-highscores');
            const btnBackHighScores = document.getElementById('btn-back-highscores');
            const highScoreScreen = document.getElementById('high-score-screen');

            // TABS
            const tabMobile = document.getElementById('tab-mobile');
            const tabPC = document.getElementById('tab-pc');

            if (tabMobile) bindButton(tabMobile, () => this.updateTabs('mobile') || this.loadHighScores('mobile'));
            if (tabPC) bindButton(tabPC, () => this.updateTabs('pc') || this.loadHighScores('pc'));

            if (btnHighScores) {
                bindButton(btnHighScores, () => {
                    if (mainMenu) mainMenu.classList.add('hidden');
                    this.showHighScoreScreen(); // Use new helper
                });
            } else {
                console.error("High Score Button NOT FOUND");
            }

            bindButton(btnBackHighScores, () => {
                if (highScoreScreen) {
                    highScoreScreen.classList.add('hidden');
                    highScoreScreen.classList.remove('active');
                }
                this.showMainMenu(); // Return to Main Menu
            });
        }

        showMainMenu() {
            this.isRunning = false;
            this.isPaused = false;
            this.gameMode = null;

            this.hideAllScreens();

            this.hideAllScreens();

            if (mainMenu) {
                mainMenu.classList.remove('hidden');
                mainMenu.classList.remove('nuclear-hidden');
                mainMenu.classList.add('active');
                mainMenu.style.display = 'flex'; // Reset to flex
            }
            if (gameOverScreen) {
                gameOverScreen.classList.remove('active');
                gameOverScreen.classList.add('hidden');
            }
            if (nameEntryScreen) nameEntryScreen.classList.add('hidden');
            if (scoreBoard) scoreBoard.classList.add('hidden');
            if (dynamicLegend) dynamicLegend.innerHTML = '';
            if (btnResume) btnResume.classList.add('hidden');

            // Ensure High Score screen is hidden
            const highScoreScreen = document.getElementById('high-score-screen');
            if (highScoreScreen) {
                highScoreScreen.classList.add('hidden');
                highScoreScreen.classList.remove('active');
                highScoreScreen.classList.add('nuclear-hidden');
            }

            this.loadHighScores();
            this.draw();
        }

        joinGame(hostId) {
            console.log("Joining Host:", hostId);
            this.stopGame(); // KILL ANY RUNNING GAME

            // UI Feedback
            this.hideAllScreens();
            const mm = document.getElementById('main-menu');
            if (mm) {
                mm.style.display = 'none';
                mm.classList.add('nuclear-hidden');
            }

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
                        statusEl.innerText = "CONNECTED! SYNCING...";
                        statusEl.style.color = "#00ff00";
                        this.isClient = true;

                        // Start Hello Loop (Keep Alive & Sync Enforcer)
                        this.helloInterval = setInterval(() => {
                            if (this.conn && this.conn.open) {
                                this.conn.send({
                                    type: 'hello',
                                    width: window.innerWidth,
                                    height: window.innerHeight
                                });
                            }
                        }, 1000);
                    });

                    this.conn.on('data', (data) => {
                        // 1. STATE UPATE
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
                                }
                            }

                            if (!this.isRunning) {
                                lobby.classList.add('hidden');
                                lobby.classList.remove('active');
                                this.startGame('multi');
                            }
                        }
                        // 2. GAME OVER
                        else if (data.type === 'gameover') {
                            console.log("CLIENT RX GAMEOVER:", data.winner); // Debug
                            this.gameOver(data.winner);
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

        // --- HIGH SCORE SYSTEM (v4.94) ---

        checkHighScore(score) {
            try {
                // Check against cache for current platform or default
                const type = this.platform || 'mobile';
                const raw = localStorage.getItem('snake_highscores_cache_' + type);
                const scores = JSON.parse(raw || '[]');
                if (!Array.isArray(scores)) return true;
                if (scores.length < 50) return true;
                return score > scores[scores.length - 1].score;
            } catch (e) {
                console.error("HighScore Check Error", e);
                return true;
            }
        }

        submitHighScore() {
            if (!playerNameInput) return;
            const name = playerNameInput.value.trim().toUpperCase() || "ANON";
            const score = this.currentPendingScore;
            const type = this.platform || 'mobile';

            if (submitScoreBtn) {
                submitScoreBtn.disabled = true;
                submitScoreBtn.innerText = "SAVING...";
            }

            // Hide entry screen first
            nameEntryScreen.classList.add('hidden');
            nameEntryScreen.classList.remove('active');

            fetch('api.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, score: score, type: type })
            })
                .then(res => res.json())
                .then(data => {
                    this.updateTabs(type);
                    this.loadHighScores(type);
                    this.showHighScoreScreen();

                    if (submitScoreBtn) {
                        submitScoreBtn.disabled = false;
                        submitScoreBtn.innerText = "SUBMIT";
                    }
                })
                .catch(err => {
                    console.error(err);
                    alert("Failed to save score. Offline?");
                    this.showMainMenu();
                    if (submitScoreBtn) {
                        submitScoreBtn.disabled = false;
                        submitScoreBtn.innerText = "RETRY";
                    }
                });
        }

        showHighScoreScreen() {
            if (nameEntryScreen) nameEntryScreen.classList.add('hidden');
            if (mainMenu) mainMenu.classList.add('hidden');
            if (gameOverScreen) gameOverScreen.classList.add('hidden');

            const highScoreScreen = document.getElementById('high-score-screen');
            if (highScoreScreen) {
                highScoreScreen.classList.remove('hidden');
                highScoreScreen.classList.remove('nuclear-hidden');
                highScoreScreen.classList.add('active');
                highScoreScreen.style.display = 'flex';

                // Set active tab logic
                this.updateTabs(this.viewingPlatform || this.platform);
                this.loadHighScores(this.viewingPlatform || this.platform);
            }
        }

        updateTabs(activeType) {
            this.viewingPlatform = activeType;
            const tM = document.getElementById('tab-mobile');
            const tP = document.getElementById('tab-pc');

            if (tM && tP) {
                if (activeType === 'mobile') {
                    tM.classList.remove('secondary'); tM.classList.add('active');
                    tP.classList.add('secondary'); tP.classList.remove('active');
                    tP.style.opacity = '0.5'; tM.style.opacity = '1';
                } else {
                    tP.classList.remove('secondary'); tP.classList.add('active');
                    tM.classList.add('secondary'); tM.classList.remove('active');
                    tM.style.opacity = '0.5'; tP.style.opacity = '1';
                }
            }
        }

        loadHighScores(type = 'mobile') {
            const list = document.getElementById('high-score-list');
            if (!list) return;

            list.innerHTML = '<li style="text-align:center;">LOADING...</li>';

            // Cache key per platform
            const cacheKey = 'snake_highscores_cache_' + type;

            // Try Cache First
            try {
                const raw = localStorage.getItem(cacheKey);
                if (raw) {
                    const data = JSON.parse(raw);
                    this.renderHighScores(data);
                }
            } catch (e) { }

            // Fetch Live
            fetch('api.php?type=' + type + '&t=' + Date.now())
                .then(res => res.json())
                .then(data => {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                    this.renderHighScores(data);
                })
                .catch(err => {
                    console.error("Score Load Error", err);
                    list.innerHTML = '<li style="text-align:center; color:#ff5555;">OFFLINE - SHOWING CACHE</li>';
                    setTimeout(() => {
                        const raw = localStorage.getItem(cacheKey);
                        if (raw) this.renderHighScores(JSON.parse(raw));
                    }, 1000);
                });
        }

        renderHighScores(data) {
            const list = document.getElementById('high-score-list');
            if (!list) return;
            list.innerHTML = '';

            if (!data || data.length === 0) {
                list.innerHTML = '<li style="text-align:center; color:#888;">NO SCORES YET</li>';
                return;
            }

            data.forEach((entry, index) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${index + 1}. ${entry.name}</span> <span>${entry.score}</span>`;
                list.appendChild(li);
            });
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
                this.projectiles = [];
                this.baseSpeed = 100;
                this.currentSpeed = this.baseSpeed;
                this.totalFoodEaten = 0;
                this.isPaused = false;
                this.lastTime = performance.now();

                console.log("Initializing Snakes...");
                if (mode === 'single') {
                    const s1 = new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' });

                    // SPAWN PROTECTION (Fix Immediate Crash)
                    s1.invulnerable = true;
                    setTimeout(() => s1.invulnerable = false, 2000);

                    this.snakes.push(s1);
                } else {
                    const s1 = new Snake(1, COLORS.p1, { x: 5, y: 5 }, { x: 1, y: 0 },
                        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' });

                    // Ensure valid start pos for P2 (Relative to Grid Size)
                    const gridW = Math.floor(CANVAS_WIDTH / GRID_SIZE);
                    const gridH = Math.floor(CANVAS_HEIGHT / GRID_SIZE);

                    let p2x = gridW - 5;
                    let p2y = gridH - 5;

                    // Safety Bounds (ensure at least inside map)
                    if (p2x < 2) p2x = gridW - 2;
                    if (p2y < 2) p2y = gridH - 2;
                    if (p2x >= gridW) p2x = gridW - 1; // Strict Clamp

                    const s2 = new Snake(2, COLORS.p2, { x: p2x, y: p2y }, { x: -1, y: 0 },
                        { up: 'w', down: 's', left: 'a', right: 'd' });

                    // SPAWN PROTECTION
                    s2.invulnerable = true;
                    setTimeout(() => s2.invulnerable = false, 2000);

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

                this.hideAllScreens();
                scoreBoard.classList.remove('hidden');

                if (p2ScoreBox) p2ScoreBox.style.display = mode === 'single' ? 'none' : 'flex';
                this.updateScoreUI();

                if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);

                // FORCE FIRST BROADCAST to ensure Client starts immediately
                this.broadcastState();

                this.loop(this.lastTime);

                console.log("Game Start Sequence Complete.");

            } catch (e) {
                console.error("START GAME ERROR:", e);
                alert("START ERROR: " + e.message);
            }
        }

        resize() {
            const container = canvas.parentElement;
            // Native Window/Container Dimensions
            let availableW = container ? container.clientWidth : window.innerWidth;
            let availableH = container ? container.clientHeight : window.innerHeight;

            // BORDER & SAFETY (CSS applies 2px border = 4px total)
            availableW -= 4;
            availableH -= 4;

            // Robustness
            if (!availableW || availableW <= 10) availableW = window.innerWidth - 4;
            if (!availableH || availableH <= 10) availableH = window.innerHeight - 4;

            // MOBILE SAFE AREA (Bottom Bar)
            // If on mobile (height > width usually), subtract a tiny bit to avoid the white bar covering grid
            // But only if we are using full window height
            if (availableH >= window.innerHeight - 50 && availableH > availableW) {
                availableH -= 40; // 40px safety for swipe bar/notch
            }

            if (availableW < 300) availableW = 300;
            if (availableH < 300) availableH = 300;

            // 1. Determine LOGICAL Resolution
            // Default: Fit to available space
            let logicalW = availableW;
            let logicalH = availableH;

            // Multiplayer Override: Force SYNC
            // Ensure we use target width anytime it is available (Host or Client Logic already sets it)
            if (this.multiplayerTargetWidth) {
                if (typeof log !== 'undefined') log(`FORCE SYNC: Using Target ${this.multiplayerTargetWidth}x${this.multiplayerTargetHeight} (Mode: ${this.gameMode})`);
                // Use the smallest constraint to ensure it fits on ALL screens
                logicalW = Math.min(availableW, this.multiplayerTargetWidth);
                logicalH = Math.min(availableH, this.multiplayerTargetHeight);
            }

            // Snap to Grid
            CANVAS_WIDTH = Math.floor((logicalW - 4) / GRID_SIZE) * GRID_SIZE;
            CANVAS_HEIGHT = Math.floor((logicalH - 4) / GRID_SIZE) * GRID_SIZE;

            // Update Canvas Logical Size
            canvas.width = CANVAS_WIDTH;
            canvas.height = CANVAS_HEIGHT;

            // 2. Visual Scaling (Fit to Window via CSS)
            // We want the canvas to be as big as possible on screen, but locked to aspect ratio.
            const scaleX = availableW / CANVAS_WIDTH;
            const scaleY = availableH / CANVAS_HEIGHT;
            const scale = Math.min(scaleX, scaleY) * 0.95; // 95% margin

            canvas.style.width = Math.floor(CANVAS_WIDTH * scale) + 'px';
            canvas.style.height = Math.floor(CANVAS_HEIGHT * scale) + 'px';

            // Center the canvas if needed (flex does this usually, but good to be sure)
            // canvas.style.marginTop = ... handled by flex center

            // 3. UI Updates based on device
            const btn1P = document.getElementById('btn-1p');
            if (btn1P) {
                if (window.innerWidth < 768) btn1P.innerText = "START GAME";
                else btn1P.innerText = "1 PLAYER";
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
            if (this.powerups.length >= 5) return;

            let type = '';

            // TEST MODE OVERRIDE
            if (this.testMode && this.powerUpTypes[this.testMode]) {
                type = this.testMode;
            } else {
                let availableTypes = Object.keys(this.powerUpTypes);

                if (this.gameMode === 'single') {
                    // Exclude multiplayer-only powerups in single player
                    availableTypes = availableTypes.filter(t => !['eraser', 'blind', 'ice', 'switch', 'torpedo'].includes(t));
                }

                if (this.totalFoodEaten < 10) {
                    availableTypes = availableTypes.filter(t => t !== 'slow');
                }

                // Logic: Bomb is useless if nothing to destroy
                const hasTargets = (this.walls.length > 0 || this.powerups.length > 0);
                if (!hasTargets) {
                    availableTypes = availableTypes.filter(t => t !== 'bomb');
                }

                // Logic: Boost 'Wall' frequency
                if (availableTypes.includes('wall')) {
                    availableTypes.push('wall');
                    availableTypes.push('wall');
                    availableTypes.push('wall');
                }

                if (availableTypes.length === 0) return;
                type = availableTypes[Math.floor(Math.random() * availableTypes.length)];
            }

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
            for (let proj of this.projectiles) if (pos.x === proj.x && pos.y === proj.y) return true; // Check projectiles
            return false;
        }

        handleTouchStart(e) {
            // FAILSAFE RESTART (Tap Screen if Game Over)
            if (!this.isRunning && this.restartZone) {
                location.reload(); // Simple restart
                return;
            }

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
            // Prevent scrolling if NOT inside menu OR if checking high scores
            // FIX: Allow default behavior (scrolling) if target is within a scrollable area
            if (e.target.closest('.scrollable') || e.target.closest('#high-score-list')) {
                e.stopPropagation(); // Stop game logic from seeing this
                return; // LET DEFAULT SCROLL HAPPEN
            } else if (!e.target.closest('.menu-screen')) {
                e.preventDefault();
            }

            if (!this.isRunning || this.isPaused) return;

            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - this.touchStartX;
            const deltaY = touch.clientY - this.touchStartY;

            // Continuous Swipe Threshold (Lower than tap threshold slightly to feel responsive?)
            // REDUCED TO 15px for ultra-responsive continuous control
            if (Math.abs(deltaX) > 15 || Math.abs(deltaY) > 15) {
                let key = '';
                if (Math.abs(deltaX) > Math.abs(deltaY)) {
                    key = deltaX > 0 ? 'ArrowRight' : 'ArrowLeft';
                } else {
                    key = deltaY > 0 ? 'ArrowDown' : 'ArrowUp';
                }

                if (typeof log !== 'undefined') log(`CONT SWIPE: ${key}`);
                this.handleInput({ key: key, preventDefault: () => { } });

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

            // Threshold for swipe vs tap (Reduced to 10px for responsiveness)
            if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
                // if (typeof log !== 'undefined') log("Tap ignored (<10px)");
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

            if (typeof log !== 'undefined') log(`SWIPE END: ${key}`);
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
                        // Record for visual feedback
                        this.lastClientInputKey = e.key;
                        this.lastClientInputTime = Date.now();
                    }
                }
                return; // Client ONLY sends input, does not move locally
            }

            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
            this.snakes.forEach(s => s.handleInput(e.key));
        }

        togglePause() {
            this.isPaused = !this.isPaused;

            const uiLayer = document.getElementById('ui-layer');
            if (uiLayer) uiLayer.style.display = 'block';

            if (this.isPaused) {
                mainMenu.classList.remove('hidden');
                mainMenu.classList.remove('nuclear-hidden'); // UN-NUKE
                mainMenu.classList.add('active');
                mainMenu.style.display = 'flex';
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

                // SHOW MASTER UI
                const uiLayer = document.getElementById('ui-layer');
                if (uiLayer) {
                    uiLayer.style.display = 'block';
                    // Force reflow
                    uiLayer.offsetHeight;
                }

                mainMenu.classList.remove('active');
                mainMenu.classList.add('hidden');
                nameEntryScreen.classList.add('hidden');

                if (this.gameMode === 'single' && !skipNameEntry) {
                    const score = this.snakes[0].score;
                    // Require at least 5 points to trigger Name Entry (anti-spam)
                    // Also triggers if it qualifies for the list (beat #20)
                    if (score > 5 && this.checkHighScore(score)) {
                        this.currentPendingScore = score;
                        if (playerNameInput) playerNameInput.value = "";

                        // CALCULATE DISPLAY RANK
                        try {
                            const raw = localStorage.getItem('snake_highscores_cache');
                            const scores = JSON.parse(raw || '[]');
                            // Count how many scores are better or equal (simple rank)
                            // Actually, if we insert this score, where would it land?
                            // It lands after everyone with GREATER OR EQUAL score? No, usually after greater.
                            // Let's count how many are STRICTLY greater.
                            const better = scores.filter(s => s.score >= score).length;
                            const rank = better + 1;

                            const rankMsg = document.getElementById('rank-msg');
                            if (rankMsg) {
                                rankMsg.innerText = `CONGRATULATIONS, YOU ARE NUMBER ${rank}`;
                            }
                        } catch (e) { }

                        nameEntryScreen.classList.remove('hidden');
                        nameEntryScreen.classList.remove('nuclear-hidden'); // UN-NUKE NAME ENTRY
                        nameEntryScreen.classList.add('active');
                        nameEntryScreen.style.display = 'flex';
                        // FORCE VISIBILITY (Like Game Over)
                        nameEntryScreen.style.opacity = '1';
                        nameEntryScreen.style.visibility = 'visible';
                        nameEntryScreen.style.pointerEvents = 'auto';

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
                gameOverScreen.classList.remove('nuclear-hidden'); // UN-NUKE
                gameOverScreen.classList.add('active');
                gameOverScreen.style.display = 'flex';
                // FORCE VISIBILITY
                gameOverScreen.style.opacity = '1';
                gameOverScreen.style.visibility = 'visible';
                gameOverScreen.style.pointerEvents = 'auto';

                if (btnResume) btnResume.classList.add('hidden');
                if (dynamicLegend) dynamicLegend.innerHTML = '';

                // SYNC GAME OVER
                if (this.isHost) {
                    this.broadcastGameOver(winnerIndex);
                }

            } catch (err) {
                console.error(err);
                alert("Game Over!");
            }
        }

        broadcastGameOver(winnerIndex) {
            if (!this.isHost || !this.conn || !this.conn.open) return;

            // REDUNDANT BROADCAST (Fix for Mobile Packet Loss)
            // Send 10 times over 1 second to ensure delivery
            let count = 0;
            const spam = setInterval(() => {
                if (this.conn && this.conn.open) {
                    try {
                        this.conn.send({ type: 'gameover', winner: winnerIndex });
                    } catch (e) { }
                }
                count++;
                if (count >= 10) clearInterval(spam);
            }, 100);
        }

        // Fix Restart Button visibility for Client
        // Ensure buttons are rebound or checked in GameOver
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
            // CRITICAL FIX: Client is a PURE RENDERER. Do not run local physics!
            if (this.isClient) return;

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

            // Power-Up Lifespan
            const duration = (this.gameMode === 'multi' && this.platform === 'pc') ? 15000 : 5000;
            this.powerups = this.powerups.filter(p => now - p.createdAt < duration);

            // Capture OLD HEADS (Before Move) for Swap Detection
            const oldH1 = this.snakes[0] ? { x: this.snakes[0].body[0].x, y: this.snakes[0].body[0].y } : null;
            const oldH2 = this.snakes[1] ? { x: this.snakes[1].body[0].x, y: this.snakes[1].body[0].y } : null;

            // Update Snakes (Collision & Movement)
            this.snakes.forEach(s => s.move(this.walls, this.gameMode === 'single', this.currentSpeed, (x, y) => {
                // Shield Break Callback (Particles?)
                this.triggerShieldEffect(x, y);
            }));

            this.updateProjectiles(this.currentSpeed); // Move projectiles

            this.checkCollisions();    // GAME OVER CHECKS - ROBUST MODE
            // Use snake count to ensure Multi physics runs even if gameMode string is glitchy
            if (this.snakes.length === 1) {
                if (this.snakes[0].isDead || this.snakes[0].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y))) {
                    this.gameOver();
                    return;
                }
            } else if (this.snakes.length > 1) {
                let p1d = this.snakes[0].isDead || this.snakes[0].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y));
                let p2d = this.snakes[1].isDead || this.snakes[1].checkSelfCollision((x, y) => this.triggerShieldEffect(x, y));

                // Head-to-Head/Body collision logic
                const h1 = this.snakes[0].body[0];
                const h2 = this.snakes[1].body[0];
                const headOn = (h1.x === h2.x && h1.y === h2.y);

                // P1 Head hits P2 Body
                // If Head-on, we skip index 0 here and handle it in specific block
                this.snakes[1].body.forEach((seg, idx) => {
                    if (headOn && idx === 0) return; // Handled later

                    if (h1.x === seg.x && h1.y === seg.y) {
                        // COLLISION!
                        if (this.snakes[0].hasShield) {
                            // P1 has shield: Survives crash
                            this.snakes[0].hasShield = false;
                            this.triggerShieldEffect(h1.x, h1.y);

                            // SHIELD SMASH: If P2 does NOT have shield (and we hit body)
                            // P2 dies! (Shield as weapon)
                            if (!this.snakes[1].hasShield) {
                                p2d = true;
                            }
                            // If P2 HAS shield, P2 survives, P1 shield just broke. 
                            // (Bouncing off Armor)
                        } else {
                            // No shield: P1 dies
                            p1d = true;
                        }
                    }
                });

                // P2 Head hits P1 Body
                this.snakes[0].body.forEach((seg, idx) => {
                    if (headOn && idx === 0) return;

                    if (h2.x === seg.x && h2.y === seg.y) {
                        if (this.snakes[1].hasShield) {
                            this.snakes[1].hasShield = false;
                            this.triggerShieldEffect(h2.x, h2.y);
                            if (!this.snakes[0].hasShield) {
                                p1d = true; // SMASH
                            }
                        } else {
                            p2d = true;
                        }
                    }
                });

                // HEAD-ON COLLISION (Same Tile)
                if (headOn) {
                    const p1Shield = this.snakes[0].hasShield;
                    const p2Shield = this.snakes[1].hasShield;

                    if (p1Shield && p2Shield) {
                        // BOUNCE / MUTUAL BREAK
                        this.snakes[0].hasShield = false;
                        this.snakes[1].hasShield = false;
                        this.triggerShieldEffect(h1.x, h1.y);
                        // No deaths
                    } else if (p1Shield) {
                        // P1 Wins
                        this.snakes[0].hasShield = false;
                        this.triggerShieldEffect(h1.x, h1.y);
                        p2d = true;
                    } else if (p2Shield) {
                        // P2 Wins
                        this.snakes[1].hasShield = false;
                        this.triggerShieldEffect(h1.x, h1.y);
                        p1d = true;
                    } else {
                        // NO SHIELDS: MUTUAL DESTRUCTION
                        p1d = true;
                        p2d = true;
                    }
                }

                // HEAD SWAP COLLISION (Passed through each other)
                if (oldH1 && oldH2) {
                    if (h1.x === oldH2.x && h1.y === oldH2.y && h2.x === oldH1.x && h2.y === oldH1.y) {
                        // FIX: Check Shields!
                        const p1Shield = this.snakes[0].hasShield;
                        const p2Shield = this.snakes[1].hasShield;

                        if (p1Shield && p2Shield) {
                            this.snakes[0].hasShield = false;
                            this.snakes[1].hasShield = false;
                            this.triggerShieldEffect(h1.x, h1.y);
                        } else if (p1Shield) {
                            p2d = true;
                            this.snakes[0].hasShield = false;
                        } else if (p2Shield) {
                            p1d = true;
                            this.snakes[1].hasShield = false;
                        } else {
                            p1d = true; p2d = true;
                            console.log("CRITICAL: HEAD SWAP DETECTED! FORCE GAME OVER.");
                        }
                    }
                }

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

        checkCollisions() {
            // 5. Check Projectile Collisions
            if (this.projectiles.length > 0) {
                for (let pIndex = this.projectiles.length - 1; pIndex >= 0; pIndex--) {
                    const p = this.projectiles[pIndex];
                    let projectileHit = false;

                    for (let s of this.snakes) {
                        // Don't hit owner
                        if (s.id === p.ownerId) continue;

                        // Check Head Collision
                        const head = s.body[0];
                        if (head.x === p.x && head.y === p.y) {
                            // Hit!
                            if (s.hasShield) {
                                s.hasShield = false;
                                projectileHit = true;
                                this.triggerShieldEffect(p.x, p.y);
                            } else {
                                s.isDead = true;
                                projectileHit = true;
                            }
                        }
                        // Check Body Collision? (Optional: Destroy projectile if it hits body?)
                        // "Dreper motstanderen hvis den treffer motstanderen" usually means any part.
                        for (let i = 1; i < s.body.length; i++) {
                            if (s.body[i].x === p.x && s.body[i].y === p.y) {
                                if (s.hasShield) {
                                    s.hasShield = false;
                                    projectileHit = true;
                                    this.triggerShieldEffect(p.x, p.y);
                                } else {
                                    s.isDead = true;
                                    projectileHit = true;
                                }
                            }
                        }
                    }
                    if (projectileHit) {
                        this.projectiles.splice(pIndex, 1); // Destroy projectile
                    }
                }
            }

            // 6. Check Deaths
            const deadSnakes = this.snakes.filter(s => s.isDead);
            if (deadSnakes.length > 0) {
                // Determine winner based on who is dead
                if (this.snakes.length === 1) {
                    this.gameOver(0); // Single player, player 1 died
                } else if (this.snakes.length > 1) {
                    const p1Dead = this.snakes[0].isDead;
                    const p2Dead = this.snakes[1].isDead;

                    if (p1Dead && p2Dead) {
                        this.gameOver(-1); // Draw
                    } else if (p1Dead) {
                        this.gameOver(1); // Player 1 died, Player 2 wins
                    } else if (p2Dead) {
                        this.gameOver(0); // Player 2 died, Player 1 wins
                    }
                }
            }
        }

        applyPowerUp(user, type, userIdx) {
            const enemy = this.snakes[userIdx === 0 ? 1 : 0];
            const isMulti = this.gameMode === 'multi';

            switch (type) {
                case 'blind':
                    if (isMulti && enemy) {
                        // PC: 2 seconds (Invisible Snake)
                        // Mobile: 5 seconds (Black Screen) - though invisible snake works there too if logic applied
                        // User specifically asked for this change for 2P PC.
                        const duration = (this.platform === 'pc') ? 2000 : 5000;
                        enemy.blindTimer = duration;
                    }
                    break;
                case 'ghost':
                    if (isMulti && enemy) {
                        enemy.wallTrapTimer = 10000;
                        // Feedback? Done in Draw/Legend
                    } else {
                        user.ghostTimer = 5000;
                    }
                    break;
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
                    // Multi: Add Owner ID for Safe Passage
                    // Single: No owner needed (or same logic works if ID matches)
                    this.walls.push({ x: tail.x, y: tail.y, ownerId: user.id });
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
                case 'torpedo':
                    this.fireTorpedo(user);
                    break;
            }
        }

        fireTorpedo(user) {
            const head = user.body[0];
            const dirs = [
                { x: 0, y: -1 }, // Up
                { x: 0, y: 1 },  // Down
                { x: -1, y: 0 }, // Left
                { x: 1, y: 0 }   // Right
            ];

            dirs.forEach(d => {
                this.projectiles.push({
                    x: head.x + d.x,
                    y: head.y + d.y,
                    dx: d.x,
                    dy: d.y,
                    ownerId: user.id,
                    createdAt: Date.now()
                });
            });
        }

        updateProjectiles(tickRate) {
            const now = Date.now();
            for (let i = this.projectiles.length - 1; i >= 0; i--) {
                const p = this.projectiles[i];

                // Move (Grid based movement?)
                // To make it smooth/fast, maybe move every tick?
                // Let's move 1 grid per tick for now.
                p.x += p.dx;
                p.y += p.dy;

                // WRAPPING LOGIC (Through Walls)
                const gridW = CANVAS_WIDTH / GRID_SIZE;
                const gridH = CANVAS_HEIGHT / GRID_SIZE;

                if (p.x < 0) p.x = Math.floor(gridW - 1);
                if (p.x >= gridW) p.x = 0;
                if (p.y < 0) p.y = Math.floor(gridH - 1);
                if (p.y >= gridH) p.y = 0;

                // Wall Collision: IGNORED (Ghost Projectiles)
                // if (this.walls.some(w => w.x === p.x && w.y === p.y)) {
                //    this.projectiles.splice(i, 1);
                //    continue;
                // }

                // Timeout (5 seconds)
                if (now - p.createdAt > 5000) {
                    this.projectiles.splice(i, 1);
                    continue;
                }
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
            const s2 = this.snakes[1];

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

            if (this.gameMode === 'single' && s1) {
                if (s1.ghostTimer > 0) {
                    addTimer('ghost', Math.ceil(s1.ghostTimer / 1000), "GHOST");
                }
                if (s1.shieldTimer > 0) {
                    addTimer('shield', Math.ceil(s1.shieldTimer / 1000), "SHIELD");
                }
                if (s1.magnetTimer > 0) {
                    addTimer('magnet', Math.ceil(s1.magnetTimer / 1000), "MAGNET");
                }
            } else if (this.gameMode === 'multi') {
                // Multi Mode Legends (e.g. Wall Trap)
                // Check BOTH players for Wall Trap
                if (s1 && s1.wallTrapTimer > 0) {
                    addTimer('ghost', Math.ceil(s1.wallTrapTimer / 1000), "P1 TRAPPED");
                }
                if (s2 && s2.wallTrapTimer > 0) {
                    addTimer('ghost', Math.ceil(s2.wallTrapTimer / 1000), "P2 TRAPPED");
                }
            }
        }

        draw() {
            try {
                // 1. BACKGROUND
                ctx.fillStyle = COLORS.bg;
                ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

                // 2. MAIN WORLD RENDER (Protected)
                try {
                    let renderSnakes = this.isClient && this.clientState ? this.clientState.snakes : (this.snakes || []);
                    let renderFoods = this.isClient && this.clientState ? this.clientState.foods : (this.foods || []);
                    let renderPowerups = this.isClient && this.clientState ? this.clientState.powerups : (this.powerups || []);
                    let renderWalls = this.isClient && this.clientState ? this.clientState.walls : (this.walls || []);
                    let renderProjectiles = this.isClient && this.clientState ? (this.clientState.projectiles || []) : (this.projectiles || []);

                    // Walls / Mines
                    renderWalls.forEach(w => {
                        this.drawRect(w.x, w.y, COLORS.brown);

                        // Default Border
                        let borderColor = '#ff0000'; // Default red border for walls

                        // MINE VISUALIZATION
                        if (w.ownerId) {
                            // Determine Color based on Owner ID
                            // We don't have easy access to snake index by ID here without searching, 
                            // but we can assume ID 'p1'/'p2' or search.
                            // Actually, let's just use specific colors if we can match IDs?
                            // Simpler: If it has an ownerId, it's a Mine.
                            // Let's try to match to snake colors.
                            const ownerSnake = renderSnakes.find(s => s.id === w.ownerId);
                            if (ownerSnake) {
                                borderColor = ownerSnake.color;
                            } else {
                                // Fallback if snake not found (e.g. disconnected)
                                borderColor = '#ffff00';
                            }

                            // Draw Mine Indicator (Inner Dot)
                            ctx.fillStyle = borderColor;
                            const cx = w.x * GRID_SIZE + GRID_SIZE / 2;
                            const cy = w.y * GRID_SIZE + GRID_SIZE / 2;
                            ctx.beginPath();
                            ctx.arc(cx, cy, GRID_SIZE / 4, 0, Math.PI * 2);
                            ctx.fill();
                        }

                        ctx.strokeStyle = borderColor;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(w.x * GRID_SIZE + 4, w.y * GRID_SIZE + 4, GRID_SIZE - 8, GRID_SIZE - 8);
                    });

                    // Powerups
                    renderPowerups.forEach(p => {
                        const def = this.powerUpTypes[p.type];
                        this.drawRect(p.x, p.y, def ? def.color : '#fff', true);
                    });

                    // Foods
                    renderFoods.forEach(f => {
                        this.drawRect(f.x, f.y, COLORS.food, true);
                    });

                    // Projectiles (Torpedoes) - FIX: MISSING RENDER LOOP
                    renderProjectiles.forEach(p => {
                        // Draw simple yellow circle/rect
                        ctx.fillStyle = '#FFD700'; // Gold
                        ctx.beginPath();
                        const cx = p.x * GRID_SIZE + GRID_SIZE / 2;
                        const cy = p.y * GRID_SIZE + GRID_SIZE / 2;
                        ctx.arc(cx, cy, GRID_SIZE / 3, 0, Math.PI * 2);
                        ctx.fill();

                        // Glow
                        ctx.shadowBlur = 10;
                        ctx.shadowColor = '#FFD700';
                        ctx.fill();
                        ctx.shadowBlur = 0;
                    });

                    // Snakes
                    renderSnakes.forEach(snake => {
                        // BLIND LOGIC (PC Multi)
                        // If PC Multi, Blinded Snake becomes invisible (User Request)
                        if (this.gameMode === 'multi' && this.platform === 'pc' && snake.blindTimer > 0) {
                            return; // Skip rendering this snake entirely
                        }

                        const snakeColor = snake.hasShield ? COLORS.silver :
                            snake.ghostTimer > 0 ? COLORS.ghost :
                                snake.blindTimer > 0 ? '#0a0a0a' : snake.color;

                        // FIX: BLIND EFFECT (Client Side Visual - Mobile/Single)
                        // If *my* entry has blindTimer > 0, blind the screen
                        if (this.gameMode === 'single' && snake.blindTimer > 0) {
                            if (document.querySelector('.game-container'))
                                document.querySelector('.game-container').classList.add('blinded');
                        } else if (this.gameMode === 'single') {
                            if (document.querySelector('.game-container'))
                                document.querySelector('.game-container').classList.remove('blinded');
                        }

                        snake.body.forEach((segment, index) => {
                            const isHead = index === 0;
                            if (snake.frozenTimer > 0) ctx.fillStyle = COLORS.cyan;
                            else ctx.fillStyle = snakeColor;
                            this.drawRect(segment.x, segment.y, ctx.fillStyle, isHead);
                        });
                    });

                    // Legend
                    // FIX: Override Ghost label for Single Player
                    if (this.gameMode === 'single') {
                        this.powerUpTypes['ghost'].label = 'GHOST';
                    } else {
                        this.powerUpTypes['ghost'].label = 'Wall Trap';
                    }
                    this.updateDynamicLegend();

                } catch (e) {
                    console.error("WORLD RENDER CRASH:", e);
                }

                // Draw Projectiles
                renderProjectiles.forEach(p => {
                    // Pulsing Gold Diamond
                    const size = GRID_SIZE / 2;
                    const center = (GRID_SIZE - size) / 2;
                    ctx.fillStyle = '#FFD700';
                    ctx.shadowBlur = 10;
                    ctx.shadowColor = '#FFD700';
                    ctx.fillRect(p.x * GRID_SIZE + center, p.y * GRID_SIZE + center, size, size);
                    ctx.shadowBlur = 0;
                });

                // 3. UI LAYERS (ON TOP)

                // CLEAN UI
                if (this.isRunning) {
                    const uiLayer = document.getElementById('ui-layer');
                    if (uiLayer && uiLayer.style.display !== 'none') uiLayer.style.setProperty('display', 'none', 'important');
                    const join = document.getElementById('join-screen');
                    if (join && join.style.display !== 'none') join.style.setProperty('display', 'none', 'important');
                }

            } catch (fatalE) {
                console.error("FATAL DRAW ERROR:", fatalE);
            }
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
                projectiles: this.projectiles,
                dims: { w: CANVAS_WIDTH, h: CANVAS_HEIGHT } // Send Host Dims
            };

            try {
                this.conn.send(state);
            } catch (e) {
                console.error("Broadcast Error:", e);
            }
        }

        loop(timestamp) {
            // 1. SCHEDULE NEXT FRAME IMMEDIATELY (True Unstoppable Loop)
            this.animationFrameId = requestAnimationFrame((ts) => this.loop(ts));

            // 2. LOGIC
            if (this.isRunning && !this.isPaused) {
                if (timestamp - this.lastTime > this.currentSpeed) {
                    this.lastTime = timestamp;
                    try {
                        this.update();
                    } catch (e) {
                        console.error("UPDATE CRASH:", e);
                        this.isRunning = false;
                    }
                    if (this.isHost) {
                        try { this.broadcastState(); } catch (e) { }
                    }
                }
            }

            // 3. RENDER
            this.draw();
        }
    }

    // Initialize Game
    const game = new Game();
    // game.initMultiplayer(); // REMOVED REDUNDANT CALL
    game.loop(0);

    // Hard Reload if version mismatch (Simple check)
    if (location.search.indexOf('v=5.6') === -1) {
        // console.log("Updating URL version...");
        // history.replaceState({}, '', location.pathname + '?v=5.6');
    }

}); // MAIN WRAPPER END
