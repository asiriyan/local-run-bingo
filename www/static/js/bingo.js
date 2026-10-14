// bingo.js - Complete Bingo game with database and sound integration
// This file contains all the game logic, database functions, and sound effects
//
// ⚙️ LOCKING SYSTEM — fixed in this version:
//   - locking() now derives pattern positions from each REGISTERED player's real
//     cartela (pulled from `bingoCartela`, the same data mainOne() uses), instead
//     of one hardcoded generic layout. Matches how the old PHP-era source.js did it.
//   - `active` (whether locking applies at all this game) is decided ONCE per game,
//     via shouldLockingBeActive(), at load and on reset. locking() itself no longer
//     re-rolls the probability on every call — that double-roll was why locking
//     never fired in testing (empty playingmatch history made the inner reroll
//     always return false).
//   - innerCross / outerCross / innerEdges are folded in as toggle-gated extra
//     patterns on top of the always-on base patterns (corners, diamond, rows/cols
//     analogues, diagonals), controlled by bonusSettings.inner_cross_enabled /
//     outer_cross_enabled / inner_edges_enabled from the dashboard.

// ================================================================
// STATE & VARIABLES
// ================================================================
let calledNumbers = [];
let gameSavedToDatabase = false;
let gameState = 'idle';
let lastCalledNum = null; // Track for yellow→green transition

const stakeamount = localStorage.getItem('stakeamount');
const cashVal = localStorage.getItem('cash');
const players = localStorage.getItem('players');
const earn = localStorage.getItem('earn') ?? 0;

let gameNo = localStorage.getItem('game');
let currentGame = Number(gameNo) || 1;

const isNewGame = document.referrer.includes('newgame.html') || localStorage.getItem('isNewGame') === 'true';
let randomNumber = localStorage.getItem('randomNumber');
if (!randomNumber) { randomNumber = Date.now().toString().slice(0, 10); localStorage.setItem('randomNumber', randomNumber); }

let wholeNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let remainingNumbers = [...wholeNumbers];
let autoIntervalId = null;
let callinterval = 4000;
let selectedLanguage = 'mnorb';

// Locking system variables
let active = false;

let beforeCalled = [];
let lockedNumbers = []; // Track locked numbers to restore later
let lastGameStats = []; // Track last 3 games' call counts
let playingmatch = geCookie('playingmatch') ?? []; // Track game call counts from cookies

// Registered players for this game (used by locking() to find real cartela layouts)
let allSelected = [];
function loadAllSelectedForLocking() {
    const raw = localStorage.getItem('allselected');
    allSelected = raw ? raw.split(',').map(Number).filter(n => !isNaN(n)) : [];
}
loadAllSelectedForLocking();

// ================================================================
// BONUS ENGINE — settings pulled from agent_bonus_settings (dashboard.php)
// ================================================================
let bonusSettings = {
    four_call_bonus_enabled: false, four_call_bonus_amount: 0,
    eight_call_bonus_enabled: false, eight_call_bonus_amount: 0,
    edge_diagonal_bonus_enabled: false, edge_diagonal_bonus_amount: 0,
    row_column_bonus_enabled: false, row_column_bonus_amount: 0,
    free_bingo_enabled: false, free_bingo_amount: 0, free_bingo_call_threshold: 15,
    happy_hour_enabled: false, happy_hour_min_amount: 0, happy_hour_max_amount: 0, happy_hour_probability: 0,
    happy_hour_start_time: '00:00', happy_hour_end_time: '23:59',
    // ── Pattern toggles (ON/OFF only, no bonus amount) ──
    inner_edges_enabled: false,
    inner_cross_enabled: false,
    outer_cross_enabled: false
};

async function loadBonusSettings() {
    try {
        const r = await fetch('/api/get-bonus-settings', { headers: { 'Accept': 'application/json' } });
        const d = await r.json();
        if (d && d.success && d.settings) {
            Object.keys(bonusSettings).forEach(k => {
                if (d.settings[k] !== undefined && d.settings[k] !== null) {
                    bonusSettings[k] = (typeof bonusSettings[k] === 'boolean') ? !!Number(d.settings[k]) : Number(d.settings[k]);
                }
            });
        }
    } catch (e) { /* keep defaults (all off) if endpoint is not wired up yet */ }
}

function randRange(min, max) { min = Number(min) || 0; max = Number(max) || 0; if (max < min) [min, max] = [max, min]; return Math.round((min + Math.random() * (max - min)) * 100) / 100; }

// ===== HAPPY HOUR POPUP FUNCTIONS =====
function checkTimeInRange(currentTimeStr, startTime, endTime) {
    // Convert to strings if they're numbers
    const timeStr = String(currentTimeStr);
    const startStr = String(startTime);
    const endStr = String(endTime);

    // Handle case where end time is next day
    const [curH, curM] = timeStr.split(':').map(Number);
    const [startH, startM] = startStr.split(':').map(Number);
    const [endH, endM] = endStr.split(':').map(Number);

    const currentTime = curH * 60 + curM;
    const startTimeMin = startH * 60 + startM;
    const endTimeMin = endH * 60 + endM;

    // If end time is earlier than start time, it spans midnight
    if (endTimeMin < startTimeMin) {
        return currentTime >= startTimeMin || currentTime <= endTimeMin;
    }
    return currentTime >= startTimeMin && currentTime <= endTimeMin;
}

function showHappyHourPopup(amount) {
    const modal = document.getElementById('happyHourModal');
    const amountEl = document.getElementById('happyHourAmount');
    const content = modal.querySelector('.happy-hour-content');
    const starsContainer = modal.querySelector('.stars-container');

    if (!modal) return;

    // Set amount
    amountEl.textContent = `+${amount} birr`;

    // Create stars
    createStars(starsContainer);

    // Show modal
    modal.classList.add('active');

    // Play sound (you'll provide the path later)
    playHappyHourSound();

    // Hide after 3 seconds
    setTimeout(() => {
        modal.classList.remove('active');
    }, 3000);
}

function createStars(container) {
    container.innerHTML = '';
    const numStars = 50;
    for (let i = 0; i < numStars; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 100}%`;
        star.style.animationDelay = `${Math.random() * 2}s`;
        star.style.opacity = Math.random() * 0.5 + 0.5;
        container.appendChild(star);
    }
}

function playHappyHourSound() {
    // Placeholder - you'll provide the sound file path later
    // Example: new Audio('static/js/sound/happy-hour.mp3').play();
    try {
        const audio = new Audio('static/js/sound/firework.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.log('Audio play failed:', e));
    } catch (e) {
        console.log('Audio not available');
    }
}

function showBonusToast(message) {
    const host = document.getElementById('bonusToastHost');
    if (!host) return;
    const el = document.createElement('div');
    el.className = 'bonus-toast';
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => el.remove(), 3200);
}

async function awardBonus(type, amount, cartelaNumber) {
    amount = Number(amount) || 0;
    if (amount <= 0) return;
    const labels = { four_call: '⚡ 4-Call Bonus', eight_call: '⚡ 8-Call Bonus', edge_diagonal: '💎 Edge + Diagonal Bonus', row_column: '💎 Row + Column Bonus', free_bingo: '🎁 Free Bingo Bonus', happy_hour: '🎉 Happy Hour Bonus' };
    showBonusToast(`${labels[type] || 'Bonus'} +${amount} birr!`);
    const bonuscarted = JSON.parse(localStorage.getItem('bonuscarted')) || [];
    bonuscarted.push(amount);
    localStorage.setItem('bonuscarted', JSON.stringify(bonuscarted));
    try {
        await sqlAPI.request('log_bonus', {
            randomNumber: localStorage.getItem('randomNumber'),
            game: currentGame,
            cartela: cartelaNumber || checkNumValue || 0,
            type, amount,
            calls: calledNumbers.length,
            triggeringNumber: selectedNumber
        });
    } catch (e) { /* non-fatal — bonus already reflected client-side */ }
}

// Renders a bold/animated status badge instead of static markup
function renderStatusBadge(kind, text) {
    const icons = { bingo: '🏆', missed: '😩', ongoing: '⏳', out: '🤔', free: '🎁', bonus: '💎' };
    return `<span class="status-badge status-${kind}"><span class="badge-icon">${icons[kind] || '•'}</span>${text}</span>`;
}

// Classic result sounds (bingo.mp3 / missed.mp3 / nobingo.mp3 / notregister.mp3) — restored
// from source.js. Only the "with confirmation tone" language variants play these, exactly as
// the old file gated it (fb, mfb, db, mnorb).
function playResultSound(kind) {
    if (!['fb', 'mfb', 'db', 'mnorb'].includes(selectedLanguage)) return;
    try {
        const audio = new Audio(`static/js/sound/${kind}.mp3`);
        audio.play().catch(() => {});
    } catch (e) { /* non-fatal */ }
}
function playStartStopSound(action) {
    // action: 'start' or 'stop'
    const folder = (selectedLanguage === 'f' || selectedLanguage === 'fb') ? 'fsound' : 'msound';
    try {
        const audio = new Audio(`static/js/sound/${folder}/${action}.mp3`);
        audio.play().catch(() => {}); // fire-and-forget, never blocks the caller
    } catch (e) { /* non-fatal */ }
}

// ================================================================
// SQL API — Database Functions
// ================================================================
class SQLAPI {
    constructor() { this.baseURL = '/api/'; this.isNewGame = isNewGame; if (this.isNewGame) localStorage.setItem('isNewGame', 'true'); }
    async request(endpoint, data = {}) {
        try { const r = await fetch(this.baseURL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const t = await r.text(); try { return JSON.parse(t); } catch(e) { return { success: false, error: 'Invalid JSON' }; } }
        catch(e) { return { success: false, error: e.message }; }
    }
    async getBalance() {
        try { const r = await fetch(this.baseURL + 'checkbalance?t=' + Date.now(), { method: 'GET', headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' } }); if (!r.ok) return { success: false, balance: "0.00" }; const t = await r.text(); try { const d = JSON.parse(t); if (typeof d.balance === 'number') d.balance = d.balance.toFixed(2); else if (!d.balance) d.balance = "0.00"; return d; } catch(e) { return { success: false, balance: "0.00" }; } }
        catch(e) { return { success: false, balance: "0.00" }; }
    }
    async saveGame(data) { return await this.request('savegame', data); }
    async updateEarnings(data) { return await this.request('update', data); }
    async updateBonus(data) { return await this.request('updatebonus', data); }
    async getLastRow() { try { const r = await fetch(this.baseURL + 'lastrow'); const t = await r.text(); try { return JSON.parse(t); } catch(e) { return { success: true, data: { game: 0 }, _fallback: true }; } } catch(e) { return { success: true, data: { game: 0 }, _fallback: true }; } }
    showLowBalanceAlert(msg) { const d = document.createElement('div'); d.textContent = msg || "Low balance"; d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ffeb3b;color:#333;padding:12px 20px;border-radius:8px;z-index:1000;font-weight:bold;'; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
    showBalanceModal() { const m = document.createElement('div'); m.id = 'balance-modal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;'; m.innerHTML = '<div style="background:white;padding:30px;border-radius:10px;text-align:center;max-width:400px;"><h3 style="color:#f13219;">Insufficient Balance</h3><p style="margin:15px 0;color:#333;">Please recharge.</p><button onclick="window.location.href=\'index.html\'" style="background:#f13219;color:white;border:none;padding:10px 30px;border-radius:5px;cursor:pointer;">OK</button></div>'; document.body.appendChild(m); }
    async testPHPAccess() {}
}
const sqlAPI = new SQLAPI();

function getCurrentDate() { const n = new Date(); return { currentDate: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` }; }

// Reset happy hour trigger at midnight
function checkAndResetHappyHourTrigger() {
    const { currentDate } = getCurrentDate();
    const triggerKey = `happy_hour_triggered_${currentDate}`;
    const lastTriggered = localStorage.getItem(triggerKey);

    // If this is a new day, clear the trigger
    if (lastTriggered) {
        const lastDate = lastTriggered.split('_')[1];
        if (lastDate !== currentDate) {
            localStorage.removeItem(triggerKey);
        }
    }
}
function seCookie(name, value, hours) { const d = new Date(); d.setTime(d.getTime() + hours*60*60*1000); document.cookie = `${name}=${JSON.stringify(value)}; expires=${d.toUTCString()}; path=/`; }
function geCookie(name) { for (let c of document.cookie.split("; ")) { let [k,v] = c.split("="); if (k === name) { try { return JSON.parse(v || "[]"); } catch(e) { return v; } } } return []; }
function deleteCookie(n) { document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`; }

async function checkUserBalance() {
    try { const r = await fetch(sqlAPI.baseURL + 'checkbalance?t=' + Date.now()); const t = await r.text(); let b = 0; try { const d = JSON.parse(t); b = parseFloat(d.balance || 0); } catch(e) { const m = t.match(/\d+\.?\d*/); if(m) b = parseFloat(m[0]); } if(isNaN(b)) b = 0; if(b<=-100){sqlAPI.showBalanceModal();return false;} if(b<=25){sqlAPI.showLowBalanceAlert();} return true; }
    catch(e) { sqlAPI.showBalanceModal(); return false; }
}
async function saveGameData(gd) {
    const rn = localStorage.getItem('randomNumber'); if(!rn) return;
    const {currentDate} = getCurrentDate(); let w = JSON.parse(localStorage.getItem('winner'))||[];
    // Normalize status to lowercase: 'ongoing' or 'finished'
    const status = gd.status ? gd.status.toLowerCase() : 'ongoing';
    const data = { game: gd.Game||currentGame, cash: gd.Stake||localStorage.getItem('cash'), winwin: w.length===0?'-':`[${w.join(',')}]`, free: gd.free||'-', calls: gd.calls||calledNumbers.length, sumBonus: gd.bonus||bonusadd(), status: status, players: gd.Player||localStorage.getItem('players'), dateobj: currentDate, realtime: new Date().toISOString(), randomNumber: rn };
    await sqlAPI.saveGame(data);
}
async function getCurrentGameNumber() { currentGame = Number(localStorage.getItem('game'))||1; const el = document.getElementById('games'); el.innerHTML=currentGame; return currentGame; }
function bonusadd() { return (JSON.parse(localStorage.getItem('bonuscarted'))||[]).reduce((t,c)=>t+c,0); }
async function addEarningsOnLoad() { if(sqlAPI.isNewGame && !localStorage.getItem('earningsSaved') && localStorage.getItem('randomNumber')) { const e=localStorage.getItem('earn')||0, c=localStorage.getItem('cash')||0, {currentDate}=getCurrentDate(), b=Number(e)*0.1; const r=await sqlAPI.updateEarnings({game:currentGame,earn:e,fulldate:currentDate,cash:c,balance:b}); if(r.success){localStorage.setItem('earningsSaved','true');localStorage.removeItem('isNewGame');} } }
async function saveGamePeriodically() { if(calledNumbers.length===0) return; const rn=localStorage.getItem('randomNumber'); if(!rn) return; try { const {currentDate}=getCurrentDate(); let w=JSON.parse(localStorage.getItem('winner'))||[]; const gd={randomNumber:rn,game:parseInt(currentGame)||1,cash:parseFloat(localStorage.getItem('cash'))||0,players:parseInt(localStorage.getItem('players'))||0,dateobj:currentDate,realtime:new Date().toISOString().slice(0,19).replace('T',' '),winwin:w.length===0?'-':`[${w.join(',')}]`,free:'-',calls:calledNumbers.length,sumBonus:parseFloat(bonusadd())||0,status:calledNumbers.length>=75?'finished':'ongoing'}; const r=await sqlAPI.saveGame(gd); if(r.success) gameSavedToDatabase=true; } catch(e){} }

// ================================================================
// FIX OLD 'ONGOING' GAMES - Called when loading games
// ================================================================
async function fixOldOngoingGames() {
    try {
        console.log('🔍 Checking for old ongoing games to fix...');
        const response = await fetch('/api/fix-ongoing-games');
        if (response.ok) {
            const result = await response.json();
            if (result.success && result.fixedCount > 0) {
                console.log(`✅ Fixed ${result.fixedCount} old ongoing games!`);
            } else {
                console.log('✅ No old ongoing games found or already fixed.');
            }
        } else {
            console.warn('⚠️ Could not fetch fix endpoint, skipping check.');
        }
    } catch (error) {
        console.warn('⚠️ Error checking for old games:', error.message);
    }
}
function startAutoSave() { setInterval(saveGamePeriodically, 5000); setTimeout(saveGamePeriodically, 1000); }

// ================================================================
// BINGO BOARD — Column layout (B=1-15, I=16-30...)
// ================================================================
function createBingoBoard() {
    const board = document.getElementById('bingoBoard');
    board.innerHTML = '';
    const letters = ['B','I','N','G','O'];
    const letterClasses = ['letter-b-bg','letter-i-bg','letter-n-bg','letter-g-bg','letter-o-bg'];
    for (let col = 0; col < 5; col++) {
        const colDiv = document.createElement('div');
        colDiv.className = 'bingo-col';
        const header = document.createElement('div');
        header.className = `bingo-letter-header ${letterClasses[col]}`;
        header.textContent = letters[col];
        colDiv.appendChild(header);
        const numbersDiv = document.createElement('div');
        numbersDiv.className = 'bingo-numbers-col';
        for (let row = 0; row < 15; row++) {
            const num = col * 15 + row + 1;
            const cell = document.createElement('div');
            cell.className = 'bingo-cell';
            cell.dataset.number = num;
            cell.id = `cell-${num}`;
            cell.textContent = num;
            numbersDiv.appendChild(cell);
        }
        colDiv.appendChild(numbersDiv);
        board.appendChild(colDiv);
    }
}
// ================================================================
// HIGHLIGHT: just-called (yellow+blink+bounce) → called (green)
// ================================================================
function highlightNumber(num) {
    // Previous just-called → now green (blink stops, solid green takes over)
    if (lastCalledNum !== null) {
        const prevCell = document.getElementById(`cell-${lastCalledNum}`);
        if (prevCell) {
            prevCell.classList.remove('just-called', 'blink');
            prevCell.classList.add('called');
        }
    }
    // New just-called → blink/bounce/size-pulse
    const cell = document.getElementById(`cell-${num}`);
    if (cell) {
        cell.classList.add('just-called', 'blink');
    }
    lastCalledNum = num;
}

// ================================================================
// RECENT CALLS
// ================================================================
function updateRecentCalls() {
    const container = document.getElementById('lastCalledNumbers');
    const recent = calledNumbers.slice(-5).reverse();
    container.innerHTML = '';
    const colors = [
        'linear-gradient(135deg, #ef4444, #dc2626)',
        'linear-gradient(135deg, #3b82f6, #2563eb)',
        'linear-gradient(135deg, #22c55e, #16a34a)',
        'linear-gradient(135deg, #eab308, #ca8a04)',
        'linear-gradient(135deg, #a855f7, #9333ea)'
    ];
    for (let i = 0; i < 5; i++) {
        const ball = document.createElement('div');
        ball.className = 'recent-ball';
        if (i < recent.length) {
            const num = recent[i];
            ball.textContent = num;
            const colIdx = Math.floor((num - 1) / 15);
            // First ball (most recent) gets yellow if it's the current call
            if (i === 0) {
                ball.style.background = 'linear-gradient(135deg, #eab308, #ca8a04)';
                ball.style.transform = 'scale(1.15)';
                ball.style.boxShadow = '0 4px 16px rgba(234,179,8,0.5)';
            } else {
                ball.style.background = colors[colIdx];
            }
        } else {
            ball.textContent = '-';
            ball.style.opacity = '0.2';
            ball.style.background = 'rgba(100,116,139,0.3)';
        }
        container.appendChild(ball);
    }
}

function updateTotalCalled() {
    const el = document.getElementById('total-called');
    el.textContent = calledNumbers.length;
    el.classList.add('stat-pop');
    setTimeout(() => el.classList.remove('stat-pop'), 400);
    localStorage.setItem('called', calledNumbers.length);
}

// ================================================================
// THREE.JS SPHERE — Proper resize handling
// ================================================================
let scene, camera, renderer, mySphere, textSprite, currentTexture;
const TEX_RES = 1024;

function createTextTexture(text) {
    const c = document.createElement('canvas'); c.width = TEX_RES; c.height = TEX_RES;
    const ctx = c.getContext('2d');
    ctx.fillStyle = "rgba(0,0,0,0)"; ctx.fillRect(0,0,TEX_RES,TEX_RES);
    ctx.font = "bold 250px Inter"; ctx.fillStyle = "#000";
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, TEX_RES/2, TEX_RES/2);
    const t = new THREE.CanvasTexture(c); t.needsUpdate = true; return t;
}
function updateTextSprite(text) {
    if (!textSprite) return;
    if (currentTexture) currentTexture.dispose();
    currentTexture = createTextTexture(text);
    textSprite.material.map = currentTexture;
    textSprite.material.needsUpdate = true;
}

function resizeSphere() {
    const container = document.getElementById('sphere-container');
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    const minDim = Math.min(w, h);
    const scale = Math.min(1.15, Math.max(0.32, minDim / 400));
    if (mySphere) mySphere.scale.set(scale, scale, scale);
    if (textSprite) {
        textSprite.scale.set(1.8 * scale, 0.9 * scale, 1);
        textSprite.position.z = scale + 0.2;
    }
}

function initSphere() {
    const container = document.getElementById('sphere-container');
    const canvas = document.getElementById('renderCanvas');
    if (!container || !canvas) return;

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    scene = new THREE.Scene(); scene.background = null;
    camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.z = 3.0;

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dl = new THREE.DirectionalLight(0xffffff, 1.5); dl.position.set(2,2,2).normalize(); scene.add(dl);

    mySphere = new THREE.Mesh(new THREE.SphereGeometry(1,64,64), new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.1,roughness:0.2}));
    scene.add(mySphere);

    currentTexture = createTextTexture('★');
    textSprite = new THREE.Sprite(new THREE.SpriteMaterial({map: currentTexture, transparent: true}));
    scene.add(textSprite);

    resizeSphere();

    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => resizeSphere());
        ro.observe(container);
    }

    function animate() { requestAnimationFrame(animate); if(mySphere) mySphere.rotation.y += 0.005; renderer.render(scene, camera); }
    animate();
}

// ================================================================
// NUMBER CALLING & SPEECH
// ================================================================
function getBingoLetter(num) { if(num<=15)return'B'; if(num<=30)return'I'; if(num<=45)return'N'; if(num<=60)return'G'; return'O'; }

function generateSecureRandomNumber(min, max) {
    if(min>max)[min,max]=[max,min]; const range=max-min+1; const nB=Math.ceil(Math.log2(range)/8); if(nB===0)return min;
    const rb=new Uint8Array(nB); let rn; const mv=Math.pow(256,nB); const th=mv-(mv%range);
    do { window.crypto.getRandomValues(rb); rn=0; for(let i=0;i<nB;i++)rn=rn*256+rb[i]; } while(rn>=th);
    return min+(rn%range);
}

function callNumber() {


    if(remainingNumbers.length === 0) { stopAutoCall(); return; }

    // 🔧 TEST CONDITION: Call 65, 51, 1 in sequence to test outter (corner) pattern locking.
    // Fixed to actually match the comment — this now completes cartelaPositions-style
    // corner pattern [1, 15, 51, 65] once 3 of the 4 have been called.
    const testNums = [65, 66,8];
    const testIndex = parseInt(localStorage.getItem('testLockingIndex')) || 0;
    /*
    // If test is running and we have test numbers left
    if (testIndex < testNums.length) {
        const testNum = testNums[testIndex];
        // Find the test number in remainingNumbers
        const testIdx = remainingNumbers.indexOf(testNum);
        if (testIdx !== -1) {
            // Call the test number
            const num = remainingNumbers[testIdx];
            remainingNumbers.splice(testIdx, 1);
            calledNumbers.push(num);
            selectedNumber = num;
            beforeCalled.push(num);
            console.log(`🧪 TEST: Calling ${num} (test[${testIndex}])`);
            console.log('📊 Remaining:', remainingNumbers.length);
            // Continue normal flow...
            const letter = getBingoLetter(num);
            updateTextSprite(`${letter}${num}`);
            const overlay = document.getElementById('calledOverlay');
            overlay.textContent = `${letter}-${num}`;
            overlay.style.display = 'block';
            overlay.style.animation = 'none'; void overlay.offsetWidth; overlay.style.animation = '';
            highlightNumber(num);
            updateRecentCalls();
            updateTotalCalled();
            playSoundFile(num, letter).then(success => {
                if (!success) speakNumber(num, letter);
            });
            if (mySphere) {
                const colors = {B:0xef4444,I:0x3b82f6,N:0x22c55e,G:0xeab308,O:0xa855f7};
                mySphere.material.color.setHex(colors[letter] || 0xffffff);
            }
            // Locking system - check after each call
            if (active && calledNumbers.length > 0) locking();
            if (calledNumbers.length > 22) disableLocking();
            // Save test index and continue
            localStorage.setItem('testLockingIndex', testIndex + 1);
            return; // Exit after test call
        }
        // If test number not found, increment test index and try next
        console.log(`🧪 TEST: ${testNum} not found, skipping to next test number`);
        localStorage.setItem('testLockingIndex', testIndex + 1);
    }
    */
    // Normal random number calling
    const idx = generateSecureRandomNumber(0, remainingNumbers.length - 1);
    const num = remainingNumbers[idx]; // ✅ FIXED: Get actual number from array
    remainingNumbers.splice(idx, 1); // ✅ FIXED: Remove number from remaining array
    calledNumbers.push(num);
    selectedNumber = num;
    beforeCalled.push(num); // Track for locking
    //console.log('📊 Remaining:', remainingNumbers.length);
    const letter = getBingoLetter(num);
    updateTextSprite(`${letter}${num}`);

    // Overlay (yellow themed for just-called)
    const overlay = document.getElementById('calledOverlay');
    overlay.textContent = `${letter}-${num}`;
    overlay.style.display = 'block';
    overlay.style.animation = 'none'; void overlay.offsetWidth; overlay.style.animation = '';

    highlightNumber(num);
    updateRecentCalls();
    updateTotalCalled();
    
    // Play sound file and only speak if it fails
    playSoundFile(num, letter).then(success => {
        if (!success) {
            speakNumber(num, letter); // Only speak if sound fails
        }
    });

    if (mySphere) {
        const colors = {B:0xef4444,I:0x3b82f6,N:0x22c55e,G:0xeab308,O:0xa855f7};
        mySphere.material.color.setHex(colors[letter] || 0xffffff);
    }

    // Happy Hour — trigger ONCE per time span, not every call
    if (bonusSettings.happy_hour_enabled && bonusSettings.happy_hour_probability > 0) {
        // Check if current time is within happy hour range
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

        const startTime = bonusSettings.happy_hour_start_time;
        const endTime = bonusSettings.happy_hour_end_time;

        // Check if current time is within happy hour range
        const isWithinHourRange = checkTimeInRange(currentTimeStr, startTime, endTime);

        if (isWithinHourRange) {
            // Check if already triggered in this time span (localStorage)
            const happyHourTriggerKey = `happy_hour_triggered_${getCurrentDate().currentDate}`;
            const alreadyTriggered = localStorage.getItem(happyHourTriggerKey);

            if (!alreadyTriggered && Math.random() < bonusSettings.happy_hour_probability) {
                const amt = randRange(bonusSettings.happy_hour_min_amount, bonusSettings.happy_hour_max_amount);
                showHappyHourPopup(amt);
                localStorage.setItem(happyHourTriggerKey, 'true');
            }
        }
    }

    // Locking system - check after each call
    if (active && calledNumbers.length > 0) {
        locking();
    }

    // Disable locking if call count exceeds threshold
    if (calledNumbers.length > 22) {
        disableLocking();
    }
}

// ================================================================
// LOCKING SYSTEM - Prevents fast game endings
// ================================================================

/**
 * Get locking probability based on your existing logic
 * @returns {number} - Probability value (0.0 to 1.0)
 */
function mathprob() {
    return Math.random();
}

/**
 * Check if locking should be active based on game history.
 * Called ONCE per game (at load and on reset) — NOT from inside locking().
 * @returns {boolean} - True if locking should be active
 */
function shouldLockingBeActive() {
    const tossed = mathprob();
    console.log(`🎲 Tossed probability: ${tossed.toFixed(4)}`);

    // Check last 3 games - if any < 20 calls, activate locking
    if (tossed < 0.50) {
        console.log('📊 Tier 1: 50% chance - Checking last 3 games');
        if (playingmatch.length >= 3 && playingmatch[playingmatch.length - 1] < 20) {
            console.log('✅ Active: Last game < 20 calls');
            return true;
        }
        if (playingmatch.length >= 2 && playingmatch[playingmatch.length - 2] < 20) {
            console.log('✅ Active: 2nd last game < 20 calls');
            return true;
        }
        if (playingmatch.length >= 1 && playingmatch[playingmatch.length - 3] < 20) {
            console.log('✅ Active: 3rd last game < 20 calls');
            return true;
        }
        console.log('❌ No game < 20 calls in last 3 games');
        return false;
    }
    // Check last 2 games - if any < 20 calls, activate locking
    else if (tossed < 0.90) {
        console.log('📊 Tier 2: 40% chance - Checking last 2 games');
        if (playingmatch.length >= 1 && playingmatch[playingmatch.length - 1] < 20) {
            console.log('✅ Active: Last game < 20 calls');
            return true;
        }
        if (playingmatch.length >= 2 && playingmatch[playingmatch.length - 2] < 20) {
            console.log('✅ Active: 2nd last game < 20 calls');
            return true;
        }
        console.log('❌ No game < 20 calls in last 2 games');
        return false;
    }
    // Check last 1 game - if < 20 calls, activate locking
    else {
        console.log('📊 Tier 3: 10% chance - Checking last 1 game');
        if (playingmatch.length >= 1 && playingmatch[playingmatch.length - 1] < 20) {
            console.log('✅ Active: Last game < 20 calls');
            return true;
        }
        console.log('❌ No game < 20 calls in last game');
        return false;
    }
}

/**
 * Main locking function — checks all win-pattern conditions and locks the
 * remaining numbers of any pattern that's 3+ complete, for EVERY registered
 * player's real cartela (pulled from `bingoCartela`, the same DB-backed data
 * mainOne() uses to render the check-cartela grid).
 *
 * `active` (set once per game by shouldLockingBeActive()) is the sole gate —
 * this function does NOT re-roll probability, so it behaves deterministically
 * for a given game/test run.
 */
function locking() {
    if (calledNumbers.length === 0 || remainingNumbers.length === 0) return;

    if (bingoCartela.length === 0) {
        // Cartela data not fetched yet — retry shortly (same approach as the
        // original PHP-era source.js used).
        setTimeout(locking, 100);
        return;
    }

    if (allSelected.length === 0) loadAllSelectedForLocking();
    if (allSelected.length === 0) {
        console.log('🔒 Locking skipped: no registered players (allselected) yet');
        return;
    }

    let lockedCount = 0;
    let debugPatternsHit = [];

    for (let j = 0; j < allSelected.length; j++) {
        const carNum = "car" + allSelected[j];
        const cartelaItem = bingoCartela.find(item => item[carNum]);
        if (!cartelaItem) continue;

        const cartelaArray = cartelaItem[carNum]; // [col][row], 0-indexed — same convention mainOne() uses

        // ── base patterns (always on — ported 1:1 from source.js's compareArrays logic) ──
        const outer   = [cartelaArray[0][0], cartelaArray[0][4], cartelaArray[4][0], cartelaArray[4][4]]; // 4 corners
        const inner   = [cartelaArray[1][1], cartelaArray[1][3], cartelaArray[3][1], cartelaArray[3][3]]; // diamond corners
        const midRow  = [cartelaArray[0][2], cartelaArray[1][2], cartelaArray[3][2], cartelaArray[4][2]]; // source.js "center"
        const midCol  = [cartelaArray[2][0], cartelaArray[2][1], cartelaArray[2][3], cartelaArray[2][4]]; // source.js "midum"
        const diago   = [cartelaArray[0][0], cartelaArray[1][1], cartelaArray[3][3], cartelaArray[4][4]]; // main diagonal
        const andiago = [cartelaArray[0][4], cartelaArray[1][3], cartelaArray[3][1], cartelaArray[4][0]]; // anti-diagonal

        // ── new toggle-gated patterns, derived from this same real card ──
        const innerCross = [cartelaArray[2][1], cartelaArray[1][2], cartelaArray[3][2], cartelaArray[2][3]]; // small plus around center
        const outerCross = [ // big plus: row3 + col3 minus center
            cartelaArray[0][2], cartelaArray[1][2], cartelaArray[3][2], cartelaArray[4][2],
            cartelaArray[2][0], cartelaArray[2][1], cartelaArray[2][3], cartelaArray[2][4]
        ];

        const patterns = [
            { name: 'outer',      positions: outer,      enabled: true },
            { name: 'inner',      positions: inner,      enabled: true },
            { name: 'midRow',     positions: midRow,     enabled: true },
            { name: 'midCol',     positions: midCol,     enabled: true },
            { name: 'diago',      positions: diago,      enabled: true },
            { name: 'andiago',    positions: andiago,    enabled: true },
            { name: 'innerCross', positions: innerCross, enabled: !!bonusSettings.inner_cross_enabled },
            { name: 'outerCross', positions: outerCross, enabled: !!bonusSettings.outer_cross_enabled },
            { name: 'innerEdges', positions: inner,      enabled: !!bonusSettings.inner_edges_enabled }, // same 4 cells as `inner`, gated by its own toggle
        ];

        patterns.forEach(p => {
            if (!p.enabled) return;
            const calledCount = p.positions.filter(n => calledNumbers.includes(n)).length;
            if (calledCount >= 3) {
                const remaining = p.positions.filter(n => !calledNumbers.includes(n) && remainingNumbers.includes(n));
                if (remaining.length) {
                    lockedCount += remaining.length;
                    remainingNumbers = remainingNumbers.filter(n => !remaining.includes(n));
                    lockedNumbers.push(...remaining);
                    debugPatternsHit.push(`${p.name}(car${allSelected[j]})`);
                }
            }
        });
    }

    if (lockedCount > 0) {
        //console.log(`🔒 Locking active: Locked ${lockedCount} numbers via`, debugPatternsHit);
    }
}

/**
 * Restore locked numbers to remainingNumbers
 * Called when unlocking (e.g., after game ends or when call count exceeds threshold)
 */
function restoreLockedNumbers() {
    if (lockedNumbers.length === 0) return;

    // Restore all locked numbers
    remainingNumbers.push(...lockedNumbers);
    lockedNumbers = [];
    console.log('🔓 Unlocked all numbers');
}

/**
 * Disable locking when call count exceeds threshold
 */
function disableLocking() {
    active = false;
    console.log('🔓 Locking disabled (call count exceeded)');
}

function speakNumber(num, letter) {
    // Only say the letter and number, no language prefixes
    const u = new SpeechSynthesisUtterance();
    u.text = `${letter} ${num}`;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
}

// ================================================================
// SOUND FILE PLAYBACK
// ================================================================
function playSoundFile(num, letter) {
    let fileKey;
    let filePath;
    
    // Determine sound file based on language
    if (selectedLanguage === 'f' || selectedLanguage === 'fb') {
        fileKey = `static/js/sound/fsound/${num}.mp3`;
        filePath = `static/js/sound/fsound/${num}.mp3`;
    } else if (selectedLanguage === 'mf' || selectedLanguage === 'mfb') {
        fileKey = `static/js/sound/msound/${num}.mp3`;
        filePath = `static/js/sound/msound/${num}.mp3`;
    } else if (selectedLanguage === 'duu' || selectedLanguage === 'db') {
        fileKey = `static/js/sound/duryew/${num}.mp3`;
        filePath = `static/js/sound/duryew/${num}.mp3`;
    } else if (selectedLanguage === 'mnor' || selectedLanguage === 'mnorb') {
        fileKey = `static/js/sound/normal/${num}.mp3`;
        filePath = `static/js/sound/normal/${num}.mp3`;
    }
    
    // Play the sound file if it exists
    if (fileKey && filePath) {
        return new Promise((resolve) => {
            const audio = new Audio(filePath);
            audio.play().then(() => {
                resolve(true); // Sound played successfully
            }).catch(() => {
                resolve(false); // Sound failed
            });
        });
    }
    return Promise.resolve(false); // No sound file to play
}

function startAutoCall() {
    if (autoIntervalId) clearInterval(autoIntervalId);
    autoIntervalId = setInterval(callNumber, callinterval);
    gameState = 'playing';
    updateButtonStates();
}
function stopAutoCall() {
    if (autoIntervalId) { clearInterval(autoIntervalId); autoIntervalId = null; }
    gameState = 'paused';
    updateButtonStates();
}

function updateButtonStates() {
    const startBtn = document.getElementById('startBtn');
    const newLink = document.getElementById('newGameLink');
    if (gameState === 'playing') {
        startBtn.textContent = '⏸ Pause';
        startBtn.className = 'btn-game btn-pause';
        newLink.style.display = 'none';
    } else if (gameState === 'paused') {
        startBtn.textContent = '▶ Resume';
        startBtn.className = 'btn-game btn-start';
        newLink.style.display = 'none';
    } else if (gameState === 'finished') {
        startBtn.style.display = 'none';
        newLink.style.display = 'inline-block';
    } else {
        startBtn.textContent = '▶ Start';
        startBtn.className = 'btn-game btn-start';
        startBtn.style.display = '';
        newLink.style.display = 'none';
    }
}

// ================================================================
// CARTELA CHECK & BINGO CLAIMING
// ================================================================
let bingoCartela = [];
let checkNumValue = 0;
let cartB = [], cartI = [], cartN = [], cartG = [], cartO = [];
let bonus = 0;
let winnings = 0;
let won = false;
let selectedNumber = 0;
const BONUS_AMOUNT = 0;
let haswonbefore;
// row/col -> number map for the cartela currently open in the check modal (used by the bonus engine)
let cartelaGridNumbers = {};

// Load all cartelas from database
function loadCartelasFromDatabase() {
    console.log("Loading cartelas from database...");
    
    fetch('/api/get_cartelas')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load cartelas from database');
            }
            return response.json();
        })
        .then(data => {
            bingoCartela = data;
            console.log('Successfully loaded', bingoCartela.length, 'cartelas from database');
        })
        .catch(error => {
            console.error('Error loading cartelas:', error);
        });
}

// Fetch player's cartela from database by their number
async function fetchPlayerCartela(playerNumber) {
    try {
        const result = await sqlAPI.request('get_cartela', { number: playerNumber });
        if (result.success && result.data) {
            return result.data;
        } else {
            console.error('Failed to fetch cartela:', result.error);
            return null;
        }
    } catch (error) {
        console.error('Error fetching player cartela:', error);
        return null;
    }
}

// Check if a number is in the player's cartela
function isNumberInCartela(playerNumber, cartelaData) {
    if (!cartelaData || !cartelaData.numbers) return false;
    return cartelaData.numbers.includes(playerNumber);
}

// Check which lines are completed for a given cartela
function checkBingoLinesForCartela(cartelaData) {
    const completedLines = {
        rows: [],
        columns: [],
        diagonals: [],
        edges: [],
        innerEdges: []
    };
    
    if (!cartelaData || !cartelaData.numbers) return completedLines;
    
    const numbers = cartelaData.numbers;
    const positions = {};
    
    // Convert numbers to row/col positions
    numbers.forEach(num => {
        const letter = getBingoLetter(num);
        const col = ['B','I','N','G','O'].indexOf(letter);
        const row = Math.floor((num - 1) / 15);
        positions[num] = { row, col };
    });
    
    // Check rows
    for (let r = 0; r < 5; r++) {
        const rowNumbers = [];
        for (let c = 0; c < 5; c++) {
            const num = r * 15 + c * 3 + 1;
            if (positions[num]) rowNumbers.push(num);
        }
        if (rowNumbers.every(n => calledNumbers.includes(n))) {
            completedLines.rows.push(r + 1);
        }
    }
    
    // Check columns
    for (let c = 0; c < 5; c++) {
        const colNumbers = [];
        for (let r = 0; r < 5; r++) {
            const num = r * 15 + c * 3 + 1;
            if (positions[num]) colNumbers.push(num);
        }
        if (colNumbers.every(n => calledNumbers.includes(n))) {
            completedLines.columns.push(c + 1);
        }
    }
    
    // Check main diagonal (top-left to bottom-right)
    const mainDiagonal = [1, 17, 33, 49, 65];
    if (mainDiagonal.every(n => calledNumbers.includes(n))) {
        completedLines.diagonals.push('main');
    }
    
    // Check anti-diagonal (top-right to bottom-left)
    const antiDiagonal = [15, 31, 47, 63, 75];
    if (antiDiagonal.every(n => calledNumbers.includes(n))) {
        completedLines.diagonals.push('anti');
    }
    
    // Check outer edges (corners)
    const outerEdges = [1, 15, 51, 65];
    if (outerEdges.every(n => calledNumbers.includes(n))) {
        completedLines.edges.push('outer');
    }
    
    // Check inner edges (center 2x2)
    const innerEdges = [17, 31, 49, 63];
    if (innerEdges.every(n => calledNumbers.includes(n))) {
        completedLines.innerEdges.push('inner');
    }
    
    return completedLines;
}

// Show cartela popup with data from database
async function showCartelaPopup(playerNumber) {
    const blur = document.getElementById('blur');
    const title = document.getElementById('checkTitle');
    const status = document.getElementById('checkStatus');
    const info = document.getElementById('checkInfo');
    const grid = document.getElementById('cartelaGrid');
    
    // Fetch player's cartela from database
    const cartelaData = await fetchPlayerCartela(playerNumber);
    
    if (!cartelaData) {
        title.textContent = '❌ Error';
        status.innerHTML = renderStatusBadge('out', 'Failed to Load');
        info.textContent = 'Could not fetch player cartela data.';
        grid.innerHTML = '';
        blur.classList.add('active');
        return;
    }
    
    // Check if number is in cartela
    if (!isNumberInCartela(playerNumber, cartelaData)) {
        title.textContent = '❌ Invalid Number';
        status.innerHTML = renderStatusBadge('out', 'Not in Cartela');
        info.textContent = `Number ${playerNumber} is not in this player's cartela.`;
        grid.innerHTML = '';
        blur.classList.add('active');
        return;
    }
    
    // Check which lines are completed
    const completedLines = checkBingoLinesForCartela(cartelaData);
    const isBingo = completedLines.rows.length >= 1 || completedLines.columns.length >= 1 || 
                   completedLines.diagonals.length >= 1 || completedLines.edges.length >= 1;
    
    // Build line descriptions
    let lineDescriptions = [];
    if (completedLines.rows.length > 0) {
        lineDescriptions.push(`Row${completedLines.rows.join(', ')}`);
    }
    if (completedLines.columns.length > 0) {
        lineDescriptions.push(`Col${completedLines.columns.join(', ')}`);
    }
    if (completedLines.diagonals.length > 0) {
        lineDescriptions.push(`Diagonal${completedLines.diagonals.join(', ')}`);
    }
    if (completedLines.edges.length > 0) {
        lineDescriptions.push('Outer Edge');
    }
    if (completedLines.innerEdges.length > 0) {
        lineDescriptions.push('Inner Edge');
    }
    
    // Display cartela grid using the same pattern as source.js
    grid.innerHTML = '';
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            const num = row * 15 + col * 3 + 1;
            const cell = document.createElement('div');
            cell.className = `cartela-cell a${row}${col}`;
            cell.textContent = num;
            
            // Check if this number is in the cartela
            if (cartelaData.numbers.includes(num)) {
                cell.classList.add('selected-cell');
                
                // Check if called
                if (calledNumbers.includes(num)) {
                    cell.classList.add('called-cell');
                }
            }
            
            grid.appendChild(cell);
        }
    }
    
    // Show result
    if (isBingo) {
        title.textContent = '🎉 BINGO!';
        status.innerHTML = renderStatusBadge('bingo', 'WINNER!');
        info.textContent = `Completed: ${lineDescriptions.join(', ')}`;
    } else {
        title.textContent = '❌ No Bingo';
        status.innerHTML = renderStatusBadge('out', 'Try Again');
        info.textContent = `Called: ${calledNumbers.length} numbers`;
    }
    
    blur.classList.add('active');
}

function claimBingo() {
    const input = document.getElementById('check-input');
    const playerNumber = parseInt(input.value);

    if (isNaN(playerNumber)) { alert('Please enter a valid number!'); return; }
    if (calledNumbers.length === 0) { alert('No numbers have been called yet!'); return; }

    const allselectedFiltered = localStorage.getItem('allselected');
    if (!allselectedFiltered) { alert('No cartela numbers registered'); return; }
    const allSelectedLocal = allselectedFiltered.split(',').map(Number);
    if (!allSelectedLocal.includes(playerNumber)) { playResultSound('notregister'); alert('Number is not a player'); return; }

    checkNumValue = playerNumber;
    buildClaimGrid(); // fresh 5x5 grid inside #cartelaGrid
    document.getElementById('blur').classList.add('active'); // shows modal + backdrop blur

    mainOne(playerNumber).then(async (result) => {
        bonus = result.bonus;
        winnings = result.winnings;

        if (winnings) {
            const selectedNum = JSON.parse(localStorage.getItem('selectedNum')) || 0;
            haswonbefore = !(selectedNumber === selectedNum || selectedNum === 0);
            if (!haswonbefore) localStorage.setItem('selectedNum', selectedNumber);
        }

        if (won) {
            const winnerArray = JSON.parse(localStorage.getItem('winner')) || [];
            const selectedNums = JSON.parse(localStorage.getItem('selectedNums')) || 0;
            if (selectedNumber === selectedNums || selectedNums === 0) {
                const uniq = [...new Set([...winnerArray, playerNumber])];
                localStorage.setItem('winner', JSON.stringify(uniq));
                localStorage.setItem('selectedNums', selectedNumber);
            }
            await saveGameData({ status: 'ongoing', calls: calledNumbers.length });
        }

        if (!haswonbefore && bonus !== 0) {
            const checkBonusNum = JSON.parse(localStorage.getItem('myarray')) || [];
            if (!checkBonusNum.includes(playerNumber)) {
                const bonuscarted = JSON.parse(localStorage.getItem('bonuscarted')) || [];
                bonuscarted.push(bonus);
                localStorage.setItem('bonuscarted', JSON.stringify(bonuscarted));
                checkBonusNum.push(playerNumber);
                localStorage.setItem('myarray', JSON.stringify(checkBonusNum));
                await sqlAPI.updateBonus({ fulldate: getCurrentDate().currentDate, bonus: bonusadd() });
            }
        }
    });
}

// ===== 5. ADD new helper — builds the 25 cells the old PHP used to hardcode =====
function buildClaimGrid() {
    const grid = document.getElementById('cartelaGrid');
    grid.innerHTML = '';
    for (let r = 1; r <= 5; r++) {
        for (let c = 1; c <= 5; c++) {
            const cell = document.createElement('div');
            cell.className = `cartela-cell a${r}${c}`;
            grid.appendChild(cell);
        }
    }
}

// ===== 6. mainOne() =====
async function mainOne(playerNumber) {
    if (bingoCartela.length === 0) {
        await new Promise(res => setTimeout(res, 100));
        return mainOne(playerNumber);
    }
    try {
        const cartelaId = "car" + playerNumber;
        const cartelaItem = bingoCartela.find(item => item[cartelaId]);
        if (!cartelaItem) { console.error(`Cartela ${cartelaId} not found`); return { bonus: 0, winnings: 0 }; }
        const cartelaData = cartelaItem[cartelaId]; // [col][row]

        cartelaGridNumbers = {}; // reset map for this check
        let cartelaNumbersFlat = [];

        for (let row = 1; row <= 5; row++) {
            for (let col = 1; col <= 5; col++) {
                const cell = document.querySelector(`.a${row}${col}`);
                if (row === 3 && col === 3) {
                    // Free space: always counts as called, or diagonals/anti-diagonals
                    // (which both pass through the center) can never complete.
                    if (cell) { cell.textContent = '★'; cell.classList.add('star-cell', 'called-cell'); }
                    continue;
                }
                const value = cartelaData[col - 1][row - 1];
                cartelaGridNumbers[`${row}_${col}`] = value;
                cartelaNumbersFlat.push(value);
                if (!cell) continue;
                cell.textContent = value;
                if (calledNumbers.includes(value)) cell.classList.add('called-cell');
            }
        }

        const corners = ['.a11', '.a15', '.a51', '.a55'].map(s => document.querySelector(s));
        const specialBonus = corners.some(c => Number(c.textContent) === selectedNumber);
        bonus = specialBonus ? BONUS_AMOUNT : 0;

        // FREE BINGO — no single cartela number has been called within the configured
        // call threshold (default 15). Checked BEFORE checkBingoWin so its own
        // nobingo/missed sound never fires and gets stacked under the bingo sound.
        const freeBingoThreshold = bonusSettings.free_bingo_call_threshold || 15;
        const matchedSoFar = cartelaNumbersFlat.filter(n => calledNumbers.includes(n));
        const isFreeBingo = bonusSettings.free_bingo_enabled &&
            calledNumbers.length >= freeBingoThreshold && matchedSoFar.length === 0;

        if (isFreeBingo) {
            won = true;
            winnings = 1;
            const title = document.getElementById('checkTitle');
            const status = document.getElementById('checkStatus');
            const info = document.getElementById('checkInfo');
            title.textContent = `${checkNumValue} — 🎁 FREE BINGO`;
            status.innerHTML = renderStatusBadge('free', 'FREE BINGO!');
            info.textContent = `No numbers called in ${calledNumbers.length} calls — automatic win.`;
            playResultSound('bingo');
            awardBonus('free_bingo', bonusSettings.free_bingo_amount, checkNumValue);
        } else {
            checkBingoWin(Number(geCookie('amountline')) || 1);
        }

        return { bonus, winnings };
    } catch (e) {
        console.error('Error in mainOne:', e);
        return { bonus: 0, winnings: 0 };
    }
}

// ===== 7. checkBingoWin() (targets new modal elements) =====
function checkBingoWin(linesRequired = 1) {
    const title = document.getElementById('checkTitle');
    const status = document.getElementById('checkStatus');
    const info = document.getElementById('checkInfo');
    const winningCells = new Set();
    const patterns = {
        rows: [], columns: [], diagonals: [],
        edges: [], innerEdges: [], innerCross: [], outerCross: []
    };
    let completedLines = 0;
    const isCalled = (r, c) =>
        document.querySelector(`.a${r}${c}`)?.classList.contains('called-cell');

    // ── ROWS (always active) ──
    for (let k = 1; k <= 5; k++) {
        if ([1,2,3,4,5].every(l => isCalled(k, l))) {
            completedLines++; patterns.rows.push(k);
            [1,2,3,4,5].forEach(l => winningCells.add(document.querySelector(`.a${k}${l}`)));
        }
    }

    // ── COLUMNS (always active) ──
    for (let l = 1; l <= 5; l++) {
        if ([1,2,3,4,5].every(k => isCalled(k, l))) {
            completedLines++; patterns.columns.push(l);
            [1,2,3,4,5].forEach(k => winningCells.add(document.querySelector(`.a${k}${l}`)));
        }
    }

    // ── MAIN DIAGONAL (always active) ──
    if ([1,2,3,4,5].every(i => isCalled(i, i))) {
        completedLines++; patterns.diagonals.push('main');
        [1,2,3,4,5].forEach(i => winningCells.add(document.querySelector(`.a${i}${i}`)));
    }

    // ── ANTI-DIAGONAL (always active) ──
    if ([1,2,3,4,5].every(i => isCalled(i, 6 - i))) {
        completedLines++; patterns.diagonals.push('anti');
        [1,2,3,4,5].forEach(i => winningCells.add(document.querySelector(`.a${i}${6-i}`)));
    }

    // ── OUTER EDGES / 4 CORNERS (always active) ──
    if (['11','15','51','55'].every(p => isCalled(+p[0], +p[1]))) {
        completedLines++; patterns.edges.push('outer');
        ['11','15','51','55'].forEach(p =>
            winningCells.add(document.querySelector(`.a${p}`))
        );
        winningCells.add(document.querySelector('.a33'));
    }

    // ── INNER EDGES (diamond) — TOGGLEABLE ──
    //   .a22  .a24  .a42  .a44  + center star .a33
    if (bonusSettings.inner_edges_enabled &&
        ['22','24','42','44'].every(p => isCalled(+p[0], +p[1]))) {
        completedLines++; patterns.innerEdges.push('inner');
        ['22','24','42','44'].forEach(p =>
            winningCells.add(document.querySelector(`.a${p}`))
        );
        winningCells.add(document.querySelector('.a33'));
    }

    // ── INNER CROSS (small plus) — TOGGLEABLE ──
    //   .a23  .a32  .a34  .a43  + center star .a33
    if (bonusSettings.inner_cross_enabled &&
        [[2,3],[3,2],[3,4],[4,3]].every(([r,c]) => isCalled(r, c))) {
        completedLines++; patterns.innerCross.push('inner');
        [[2,3],[3,2],[3,4],[4,3]].forEach(([r,c]) =>
            winningCells.add(document.querySelector(`.a${r}${c}`))
        );
        winningCells.add(document.querySelector('.a33'));
    }

    // ── OUTER CROSS (big plus) — TOGGLEABLE ──
    //   Row 3 minus center: .a31 .a32 .a34 .a35
    //   Col 3 minus center: .a13 .a23 .a43 .a53
    //   + center star .a33
    if (bonusSettings.outer_cross_enabled) {
        const row3 = [[3,1],[3,2],[3,4],[3,5]].every(([r,c]) => isCalled(r, c));
        const col3 = [[1,3],[2,3],[4,3],[5,3]].every(([r,c]) => isCalled(r, c));
        if (row3 && col3) {
            completedLines++; patterns.outerCross.push('outer');
            [[3,1],[3,2],[3,4],[3,5],[1,3],[2,3],[4,3],[5,3]].forEach(([r,c]) =>
                winningCells.add(document.querySelector(`.a${r}${c}`))
            );
            winningCells.add(document.querySelector('.a33'));
        }
    }

    // ── Build line description ──
    const lineDesc = [
        patterns.rows.length       && `Row${patterns.rows.join(',')}`,
        patterns.columns.length    && `Col${patterns.columns.join(',')}`,
        patterns.diagonals.length  && `Diagonal${patterns.diagonals.join(',')}`,
        patterns.edges.length      && 'Outer Edge',
        patterns.innerEdges.length && 'Inner Edge',
        patterns.innerCross.length && 'Inner Cross',
        patterns.outerCross.length && 'Outer Cross'
    ].filter(Boolean).join(', ');

    const hasWinningCondition = completedLines >= linesRequired;
    winnings = 0;

    if (hasWinningCondition) {
        const selectedNumberFoundInWinningCells = Array.from(winningCells).some(
            cell => cell && Number(cell.textContent) === selectedNumber
        );

        if (selectedNumberFoundInWinningCells) {
            // ── TRUE BINGO ──
            won = true; winnings = 1;
            title.textContent = `${checkNumValue} — 🏆 BINGO! 😎`;
            status.innerHTML = renderStatusBadge('bingo', 'WINNER!');
            info.textContent = lineDesc || `${linesRequired} line`;
            playResultSound('bingo');

            winningCells.forEach(cell => {
                if (!cell) return;
                cell.classList.add('called-cell');
                if (Number(cell.textContent) === selectedNumber) cell.classList.add('cc-win-blink');
                else cell.classList.add('cc-win');
            });

            // Speed bonuses
            if (bonusSettings.four_call_bonus_enabled && calledNumbers.length <= 4) {
                awardBonus('four_call', bonusSettings.four_call_bonus_amount, checkNumValue);
            } else if (bonusSettings.eight_call_bonus_enabled && calledNumbers.length <= 8) {
                awardBonus('eight_call', bonusSettings.eight_call_bonus_amount, checkNumValue);
            }

            // Intersection bonuses
            let calledPos = null;
            for (const key in cartelaGridNumbers) {
                if (cartelaGridNumbers[key] === selectedNumber) {
                    const [r, c] = key.split('_').map(Number);
                    calledPos = { r, c };
                    break;
                }
            }
            if (calledPos) {
                const isCorner = (calledPos.r === 1 || calledPos.r === 5) &&
                                 (calledPos.c === 1 || calledPos.c === 5);
                if (bonusSettings.edge_diagonal_bonus_enabled && isCorner &&
                    patterns.edges.length > 0 && patterns.diagonals.length > 0) {
                    awardBonus('edge_diagonal', bonusSettings.edge_diagonal_bonus_amount, checkNumValue);
                }
                const rowComplete = patterns.rows.includes(calledPos.r);
                const colComplete = patterns.columns.includes(calledPos.c);
                if (bonusSettings.row_column_bonus_enabled && rowComplete && colComplete) {
                    awardBonus('row_column', bonusSettings.row_column_bonus_amount, checkNumValue);
                }
            }
        } else {
            // ── MISSED BINGO ──
            won = false;
            title.textContent = `${checkNumValue} — 😩 Missed Bingo`;
            status.innerHTML = renderStatusBadge('missed', 'MISSED');
            info.textContent = lineDesc || `${linesRequired} line`;
            playResultSound('missed');
            winningCells.forEach(cell => { if (cell) cell.classList.add('cc-missed'); });
        }
    } else {
        // ── NO BINGO ──
        won = false;
        title.textContent = `${checkNumValue} — 🤔 No Bingo`;
        status.innerHTML = renderStatusBadge('out', 'No Bingo');
        info.textContent = `${linesRequired} line`;
        playResultSound('nobingo');
    }

    // ── GAME ENDED - Save stats and unlock numbers ──
    saveGameStats(calledNumbers.length);
    restoreLockedNumbers();

    return { hasWinningCondition, completedLines, linePatterns: patterns };
}

function checkBingoLines(numbers) {
    const completedLines = {
        rows: [],
        columns: [],
        diagonals: [],
        edges: [],
        innerEdges: []
    };
    
    // Convert numbers to row/col positions
    const positions = {};
    numbers.forEach(num => {
        const letter = getBingoLetter(num);
        const col = ['B','I','N','G','O'].indexOf(letter);
        const row = Math.floor((num - 1) / 15);
        positions[num] = { row, col };
    });
    
    // Check rows
    for (let r = 0; r < 5; r++) {
        const rowNumbers = [];
        for (let c = 0; c < 5; c++) {
            const num = r * 15 + c * 3 + 1;
            if (positions[num]) rowNumbers.push(num);
        }
        if (rowNumbers.every(n => calledNumbers.includes(n))) {
            completedLines.rows.push(r + 1);
        }
    }
    
    // Check columns
    for (let c = 0; c < 5; c++) {
        const colNumbers = [];
        for (let r = 0; r < 5; r++) {
            const num = r * 15 + c * 3 + 1;
            if (positions[num]) colNumbers.push(num);
        }
        if (colNumbers.every(n => calledNumbers.includes(n))) {
            completedLines.columns.push(c + 1);
        }
    }
    
    // Check main diagonal (top-left to bottom-right)
    const mainDiagonal = [1, 17, 33, 49, 65];
    if (mainDiagonal.every(n => calledNumbers.includes(n))) {
        completedLines.diagonals.push('main');
    }
    
    // Check anti-diagonal (top-right to bottom-left)
    const antiDiagonal = [15, 31, 47, 63, 75];
    if (antiDiagonal.every(n => calledNumbers.includes(n))) {
        completedLines.diagonals.push('anti');
    }
    
    // Check outer edges (corners)
    const outerEdges = [1, 15, 51, 65];
    if (outerEdges.every(n => calledNumbers.includes(n))) {
        completedLines.edges.push('outer');
    }
    
    // Check inner edges (center 2x2)
    const innerEdges = [17, 31, 49, 63];
    if (innerEdges.every(n => calledNumbers.includes(n))) {
        completedLines.innerEdges.push('inner');
    }
    
    return completedLines;
}

function showBingoPopup(isBingo, completedLines, matchedNumbers) {
    const blur = document.getElementById('blur');
    const title = document.getElementById('checkTitle');
    const status = document.getElementById('checkStatus');
    const info = document.getElementById('checkInfo');
    const grid = document.getElementById('cartelaGrid');
    
    // Build line descriptions
    let lineDescriptions = [];
    if (completedLines.rows.length > 0) {
        lineDescriptions.push(`Row${completedLines.rows.join(', ')}`);
    }
    if (completedLines.columns.length > 0) {
        lineDescriptions.push(`Col${completedLines.columns.join(', ')}`);
    }
    if (completedLines.diagonals.length > 0) {
        lineDescriptions.push(`Diagonal${completedLines.diagonals.join(', ')}`);
    }
    if (completedLines.edges.length > 0) {
        lineDescriptions.push('Outer Edge');
    }
    if (completedLines.innerEdges.length > 0) {
        lineDescriptions.push('Inner Edge');
    }
    
    if (isBingo) {
        title.textContent = '🎉 BINGO!';
        status.innerHTML = renderStatusBadge('bingo', 'WINNER!');
        info.textContent = `Completed: ${lineDescriptions.join(', ')}`;
        grid.innerHTML = '';
        matchedNumbers.forEach(num => {
            const cell = document.createElement('div');
            cell.className = 'cartela-cell called-cell';
            cell.textContent = num;
            grid.appendChild(cell);
        });
    } else {
        title.textContent = '❌ No Bingo';
        status.innerHTML = renderStatusBadge('out', 'Try Again');
        info.textContent = `Called: ${matchedNumbers.length}/${selectedCartelaNumbers.length}`;
        grid.innerHTML = '';
        selectedCartelaNumbers.forEach(num => {
            const cell = document.createElement('div');
            cell.className = 'cartela-cell miss-cell';
            cell.textContent = num;
            if (calledNumbers.includes(num)) {
                cell.classList.add('called-cell');
            }
            grid.appendChild(cell);
        });
    }
    
    blur.classList.add('active');
}

function checkMyCartela() {
    let selected = [];
    try { const s = localStorage.getItem('allselected'); if (s) selected = String(s).split(',').map(Number).filter(n => !isNaN(n)); } catch(e) {}

    if (selected.length === 0) {
        document.getElementById('checkTitle').textContent = 'No Numbers Selected';
        document.getElementById('checkStatus').innerHTML = renderStatusBadge('out', 'No Selection');
        document.getElementById('checkInfo').textContent = 'You did not select any numbers.';
        document.getElementById('cartelaGrid').innerHTML = '';
        document.getElementById('blur').classList.add('active');
        return;
    }

    const matched = selected.filter(n => calledNumbers.includes(n));
    const isBingo = matched.length === selected.length;

    // FREE BINGO check for the quick "check my cartela" path too
    const freeBingoThreshold = bonusSettings.free_bingo_call_threshold || 15;
    const isFreeBingo = bonusSettings.free_bingo_enabled && calledNumbers.length >= freeBingoThreshold && matched.length === 0;

    document.getElementById('checkTitle').textContent = isFreeBingo ? 'Your Cartela — FREE BINGO' : 'Your Cartela Check';
    let statusHTML = '';
    if (isFreeBingo) { statusHTML = renderStatusBadge('free', 'FREE BINGO!'); awardBonus('free_bingo', bonusSettings.free_bingo_amount);}
    else if (isBingo && calledNumbers.length > 0) statusHTML = renderStatusBadge('bingo', 'BINGO!');
    else if (matched.length > 0) statusHTML = renderStatusBadge('ongoing', `${matched.length}/${selected.length} Called`);
    else statusHTML = renderStatusBadge('out', 'None Called');
    document.getElementById('checkStatus').innerHTML = statusHTML;
    document.getElementById('checkInfo').textContent = `${matched.length} of ${selected.length} numbers called.`;

    const grid = document.getElementById('cartelaGrid');
    grid.innerHTML = '';
    selected.sort((a,b) => a-b).forEach(num => {
        const cell = document.createElement('div');
        cell.className = 'cartela-cell';
        cell.textContent = num;
        if (calledNumbers.includes(num)) cell.classList.add('called-cell');
        else cell.classList.add('miss-cell');
        grid.appendChild(cell);
    });
    document.getElementById('blur').classList.add('active');
}
function hideCartela() { document.getElementById('blur').classList.remove('active'); }

// ================================================================
// SHUFFLE LOGIC
// ================================================================
let shuffleIntervalId = null;
let shuffleAudio = null;
let isShuffling = false;

function shuffleBoard() {
    // 1. Clear previous shuffle highlights
    document.querySelectorAll('.bingo-cell').forEach(cell => {
        cell.classList.remove('bg-black');
        cell.style.backgroundColor = '';
        cell.style.color = '';
        cell.style.boxShadow = '';
        cell.style.transform = '';
        cell.style.zIndex = '';
    });

    // 2. Pick 10 unique random numbers
    const randomNums = [];
    while(randomNums.length < 10){
        const r = Math.floor(Math.random() * 75) + 1;
        if(randomNums.indexOf(r) === -1) randomNums.push(r);
    }
    
    // 3. Add black effect to the new 10 numbers
    randomNums.forEach(num => {
        const cell = document.getElementById(`cell-${num}`);
        if (cell) {
            cell.classList.add('bg-black');
            cell.style.backgroundColor = '#000';
            cell.style.color = '#fff';
            cell.style.boxShadow = '0 0 15px rgba(255, 255, 255, 0.6)';
            cell.style.transform = 'scale(1.1)';
            cell.style.zIndex = '10';
            cell.style.transition = 'all 0.1s ease';
        }
    });
}

// ================================================================
// BUTTON HANDLERS
// ================================================================
// Shuffle Button Handler
const shuffleBtn = document.getElementById('shuffle');
if (shuffleBtn) {
    shuffleBtn.addEventListener('click', () => {
        isShuffling = !isShuffling; // Toggle state

        if (isShuffling) {
            shuffleBtn.textContent = "stop";
            
            // Start UI swap effect immediately and then every 400ms
            shuffleBoard(); 
            shuffleIntervalId = setInterval(shuffleBoard, 400);
            
            // Start Shuffle Sound
            const filePath = `static/js/sound/shuffle.mp3`;
            shuffleAudio = new Audio(filePath);
            shuffleAudio.loop = true; 
            shuffleAudio.play().catch(e => console.error("Audio play error:", e));
        } else {
            shuffleBtn.textContent = "shuffle";
            
            // Stop Sound
            if (shuffleAudio) {
                shuffleAudio.pause();
                shuffleAudio.currentTime = 0;
                shuffleAudio = null;
            }
            
            // Stop Animation
            if (shuffleIntervalId) {
                clearInterval(shuffleIntervalId);
                shuffleIntervalId = null;
            }
            
            // Clear Board UI completely
            document.querySelectorAll('.bingo-cell').forEach(cell => {
                cell.classList.remove('bg-black');
                cell.style.backgroundColor = '';
                cell.style.color = '';
                cell.style.boxShadow = '';
                cell.style.transform = '';
                cell.style.zIndex = '';
            });
        }
    });
}
// Check Button Handler
document.getElementById('check-btn').addEventListener('click', () => {
    const input = document.getElementById('check-input');
    const checkBtn = document.getElementById('check-btn');
    
    if (!input || !checkBtn) return;
    
    const playerNumber = parseInt(input.value, 10);

    // Reset button styles first
    checkBtn.style.background = '';
    checkBtn.style.color = '';

    if (isNaN(playerNumber)) {
        checkBtn.textContent = 'Invalid';
        checkBtn.style.background = 'red';
        checkBtn.style.color = 'white';
        
        // Reset after 3 seconds
        setTimeout(() => {
            input.value = '';
            checkBtn.textContent = 'Check';
            checkBtn.style.background = '';
            checkBtn.style.color = '';
        }, 3000);
        return;
    }

    const allselectedFiltered = localStorage.getItem('allselected');
    if (!allselectedFiltered) { 
        checkBtn.textContent = 'Out of game';
        checkBtn.style.background = 'red';
        checkBtn.style.color = 'white';
        
        // Reset after 3 seconds
        setTimeout(() => {
            input.value = '';
            checkBtn.textContent = 'Check';
            checkBtn.style.background = '';
            checkBtn.style.color = '';
        }, 3000);
        return; 
    }
    
    const allSelectedLocal = allselectedFiltered.split(',').map(Number);
    
    if (!allSelectedLocal.includes(playerNumber)) { 
        if (typeof playResultSound === 'function') {
            playResultSound('notregister'); 
        }
        checkBtn.textContent = 'Out of game';
        checkBtn.style.background = 'red';
        checkBtn.style.color = 'white';
    } else {
        // If it is in allSelected, it's in the game
        checkBtn.textContent = 'In a game';
        checkBtn.style.background = 'green';
        checkBtn.style.color = 'white';
    }

    // Reset after 3 seconds for both Out of game and In a game
    setTimeout(() => {
        input.value = '';
        checkBtn.textContent = 'Check';
        checkBtn.style.background = '';
        checkBtn.style.color = '';
    }, 1000);
});
document.getElementById('startBtn').addEventListener('click', () => {
    if (gameState === 'idle') {
        playStartStopSound('start');
        setTimeout(() => { callNumber(); startAutoCall(); }, 2300);
    } else if (gameState === 'playing') {
        playStartStopSound('stop');
        stopAutoCall();
    } else if (gameState === 'paused') {
        playStartStopSound('start');
        setTimeout(() => { startAutoCall(); }, 1000);
    }
});
document.getElementById('finsh').addEventListener('click', async () => {
    stopAutoCall(); gameState = 'finished'; updateButtonStates();
    await saveGameData({ status: 'finished', calls: calledNumbers.length });
    resetGame(); // Save stats and unlock numbers
});



document.getElementById('claimBingoBtn').addEventListener('click', claimBingo);


document.getElementById('close').addEventListener('click', hideCartela);
document.getElementById('block').addEventListener('click', hideCartela);

// Language & Speed
const callLang = document.getElementById('lang');
const callSpeed = document.getElementById('call-speed');
const callTextEl = document.getElementById('call-text');

selectedLanguage = geCookie('selectedLanguage');
if (Array.isArray(selectedLanguage) && selectedLanguage.length === 0) selectedLanguage = 'mnorb';
callLang.value = selectedLanguage;
callLang.addEventListener('change', function() { deleteCookie("selectedLanguage"); selectedLanguage = callLang.value; seCookie("selectedLanguage", selectedLanguage, 168); });

const inter = geCookie("speed"); callinterval = Number(inter) || 4000;
callTextEl.innerHTML = "Auto " + (callinterval/1000) + "s";
callSpeed.addEventListener('input', function() {
    const inv = 12 - (callSpeed.value - 2); callinterval = inv * 1000;
    callTextEl.textContent = "Auto " + inv + "s";
    deleteCookie("speed"); seCookie("speed", callinterval, 168);
    if (gameState === 'playing') { stopAutoCall(); startAutoCall(); }
});

document.getElementById('fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
});

// ================================================================
// THEME & SIDEBAR
// ================================================================
function setTheme(dark) { if(dark){document.documentElement.classList.add('dark');localStorage.setItem('theme','dark');}else{document.documentElement.classList.remove('dark');localStorage.setItem('theme','light');} }
document.getElementById('themeToggle').addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark') setTheme(true); else if (savedTheme === 'light') setTheme(false); else if (window.matchMedia('(prefers-color-scheme: dark)').matches) setTheme(true);

const sidebar = document.getElementById('sidebar');
document.getElementById('menuBtn').addEventListener('click', () => { sidebar.classList.add('open'); document.getElementById('sidebarOverlay').classList.add('active'); });
document.getElementById('closeSidebar').addEventListener('click', () => { sidebar.classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); });
document.getElementById('sidebarOverlay').addEventListener('click', () => { sidebar.classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('active'); });
document.getElementById('signoutBtn').addEventListener('click', (e) => { e.preventDefault(); localStorage.clear(); deleteCookie("allSelectedFiltered"); deleteCookie("amountline"); deleteCookie("cash"); window.location.href='index.html'; });

// ================================================================
// BACKGROUND PARTICLES
// ================================================================
(function initBg() {
    const c = document.getElementById('bg-canvas-container'); if(!c||!window.THREE) return;
    const isDarkNow = document.documentElement.classList.contains('dark');
    const sc = new THREE.Scene(); sc.background = new THREE.Color(isDarkNow ? 0x0b0f1a : 0xcdd2db);
    const cam = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 1000); cam.position.z=8;
    const r = new THREE.WebGLRenderer({antialias:true}); r.setSize(innerWidth,innerHeight); r.setPixelRatio(Math.min(devicePixelRatio,2)); c.appendChild(r.domElement);
    const g = new THREE.BufferGeometry(); const p = new Float32Array(600);
    for(let i=0;i<600;i++) p[i]=(Math.random()-0.5)*20;
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    const m = new THREE.PointsMaterial({color:isDarkNow?0x7c3aed:0x6d28d9,size:0.04,transparent:true,opacity:0.35,blending:THREE.AdditiveBlending});
    const pts = new THREE.Points(g,m); sc.add(pts);
    (function a(){requestAnimationFrame(a);pts.rotation.y+=0.0003;r.render(sc,cam)})();
    addEventListener('resize',()=>{cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix();r.setSize(innerWidth,innerHeight)});
    new MutationObserver(()=>{const d=document.documentElement.classList.contains('dark');sc.background=new THREE.Color(d?0x0b0f1a:0xcdd2db);m.color.setHex(d?0x7c3aed:0x6d28d9)}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});
})();

// ================================================================
// WINDOW RESIZE
// ================================================================
window.addEventListener('resize', () => {
    resizeSphere();
});

// ================================================================
// INIT
// ================================================================
async function initializeSQL() { await sqlAPI.testPHPAccess(); await checkUserBalance(); await addEarningsOnLoad(); }

document.addEventListener('DOMContentLoaded', async () => {
    createBingoBoard();
    initSphere();
    await initializeSQL();
    await loadBonusSettings();
    checkAndResetHappyHourTrigger(); // Reset happy hour trigger at midnight
    loadCartelasFromDatabase();
    loadAllSelectedForLocking(); // refresh registered players in case they were set after script load

    // Fix any old ongoing games with incorrect capitalization
    await fixOldOngoingGames();

    getCurrentGameNumber();
    const stakeEl = document.getElementById('stake');
    const cashWinEl = document.getElementById('cash-win');
    const playerEl = document.getElementById('player');
    stakeEl.innerHTML = localStorage.getItem('cash') || 0;
    cashWinEl.innerHTML = parseFloat(localStorage.getItem('stakeamount') ?? 0).toFixed(0);
    playerEl.innerHTML = localStorage.getItem('players') ?? 0;
    startAutoSave();
    hideCartela();
    updateButtonStates();

    // Load game stats for locking probability
    loadGameStats();
});

// ================================================================
// INITIALIZATION - Decide `active` ONCE per game load
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Load playingmatch cookie (your existing system)
    playingmatch = geCookie('playingmatch') ?? [];
    console.log('📊 Playingmatch history loaded:', playingmatch);

    // Single probability roll for the whole game — locking() no longer re-rolls.
    active = shouldLockingBeActive();
    console.log('🔒 Locking active this game:', active);
});

// ================================================================
// GAME STATS TRACKING - For locking probability based on last 1-3 games
// ================================================================

/**
 * Load game stats from localStorage
 */
function loadGameStats() {
    try {
        const savedStats = localStorage.getItem('bingo_lastGameStats');
        if (savedStats) {
            lastGameStats = JSON.parse(savedStats);
            // Keep only last 3 games
            if (lastGameStats.length > 3) {
                lastGameStats = lastGameStats.slice(-3);
            }
            console.log('📊 Loaded game stats:', lastGameStats);
        } else {
            // Initialize with some dummy data for first game
            lastGameStats = [35, 40, 45]; // Average 40 calls
            localStorage.setItem('bingo_lastGameStats', JSON.stringify(lastGameStats));
        }
    } catch (e) {
        console.error('Error loading game stats:', e);
        lastGameStats = [35, 40, 45];
    }
}

/**
 * Save game stats to localStorage when game ends
 * @param {number} callCount - Number of calls made in this game
 */
function saveGameStats(callCount) {
    try {
        lastGameStats.push(callCount);
        // Keep only last 3 games
        if (lastGameStats.length > 3) {
            lastGameStats.shift();
        }
        localStorage.setItem('bingo_lastGameStats', JSON.stringify(lastGameStats));
        console.log(`💾 Saved game stats: ${callCount} calls. Last 3 games:`, lastGameStats);
    } catch (e) {
        console.error('Error saving game stats:', e);
    }
}

/**
 * Reset game for new game (save stats first)
 */
function resetGame() {
    // Save current game stats before resetting
    saveGameStats(calledNumbers.length);

    // Save to playingmatch cookie (your existing system)
    if (calledNumbers.length > 0) {
        playingmatch.push(calledNumbers.length);
        seCookie('playingmatch', playingmatch, 7);
    }

    // Reset game state
    calledNumbers = [];
    beforeCalled = [];
    lockedNumbers = [];
    localStorage.removeItem('testLockingIndex'); // Clear test index

    // Single probability roll for the next game — same helper used at load.
    active = shouldLockingBeActive();
    console.log('🔒 Locking active for next game:', active);

    // Refresh registered players for the next game
    loadAllSelectedForLocking();

    // Reset remaining numbers
    remainingNumbers = [...wholeNumbers];

    // Clear any locked numbers
    restoreLockedNumbers();

    console.log('🔄 Game reset complete');
}
console.log(active);