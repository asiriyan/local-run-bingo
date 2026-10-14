// bingo.js - Complete Bingo game with database and sound integration
// This file contains all the game logic, database functions, and sound effects

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

const isNewGame = document.referrer.includes('newgame.php') || localStorage.getItem('isNewGame') === 'true';
let randomNumber = localStorage.getItem('randomNumber');
if (!randomNumber) { randomNumber = Date.now().toString().slice(0, 10); localStorage.setItem('randomNumber', randomNumber); }

let wholeNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let remainingNumbers = [...wholeNumbers];
let autoIntervalId = null;
let callinterval = 4000;
let selectedLanguage = 'mnorb';

// ================================================================
// BONUS ENGINE — settings pulled from agent_bonus_settings (dashboard.php)
// ================================================================
let bonusSettings = {
    four_call_bonus_enabled: false, four_call_bonus_amount: 0,
    eight_call_bonus_enabled: false, eight_call_bonus_amount: 0,
    edge_diagonal_bonus_enabled: false, edge_diagonal_bonus_amount: 0,
    row_column_bonus_enabled: false, row_column_bonus_amount: 0,
    free_bingo_enabled: false, free_bingo_amount: 0, free_bingo_call_threshold: 15,
    happy_hour_enabled: false, happy_hour_min_amount: 0, happy_hour_max_amount: 0, happy_hour_probability: 0
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
        await sqlAPI.request('api/log_bonus', {
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

// ================================================================
// SQL API — Database Functions
// ================================================================
class SQLAPI {
    constructor() { this.baseURL = './'; this.isNewGame = isNewGame; if (this.isNewGame) localStorage.setItem('isNewGame', 'true'); }
    async request(endpoint, data = {}) {
        try { const r = await fetch(this.baseURL + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); const t = await r.text(); try { return JSON.parse(t); } catch(e) { return { success: false, error: 'Invalid JSON' }; } }
        catch(e) { return { success: false, error: e.message }; }
    }
    async getBalance() {
        try { const r = await fetch('/api/checkbalance', { method: 'GET', headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' } }); if (!r.ok) return { success: false, balance: "0.00" }; const t = await r.text(); try { const d = JSON.parse(t); if (typeof d.balance === 'number') d.balance = d.balance.toFixed(2); else if (!d.balance) d.balance = "0.00"; return d; } catch(e) { return { success: false, balance: "0.00" }; } }
        catch(e) { return { success: false, balance: "0.00" }; }
    }
    async saveGame(data) { return await this.request('api/savegame', data); }
    async updateEarnings(data) { return await this.request('api/update', data); }
    async updateBonus(data) { return await this.request('api/updatebonus', data); }
    async getLastRow() { try { const r = await fetch(this.baseURL + 'api/lastrow'); const t = await r.text(); try { return JSON.parse(t); } catch(e) { return { success: true, data: { game: 0 }, _fallback: true }; } } catch(e) { return { success: true, data: { game: 0 }, _fallback: true }; } }
    showLowBalanceAlert(msg) { const d = document.createElement('div'); d.textContent = msg || "Low balance"; d.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#ffeb3b;color:#333;padding:12px 20px;border-radius:8px;z-index:1000;font-weight:bold;'; document.body.appendChild(d); setTimeout(() => d.remove(), 3000); }
    showBalanceModal() { const m = document.createElement('div'); m.id = 'balance-modal'; m.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;'; m.innerHTML = '<div style="background:white;padding:30px;border-radius:10px;text-align:center;max-width:400px;"><h3 style="color:#f13219;">Insufficient Balance</h3><p style="margin:15px 0;color:#333;">Please recharge.</p><button onclick="window.location.href=\'index.php\'" style="background:#f13219;color:white;border:none;padding:10px 30px;border-radius:5px;cursor:pointer;">OK</button></div>'; document.body.appendChild(m); }
    async testPHPAccess() {}
}
const sqlAPI = new SQLAPI();

function getCurrentDate() { const n = new Date(); return { currentDate: `${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}-${String(n.getDate()).padStart(2,'0')}` }; }
function seCookie(name, value, hours) { const d = new Date(); d.setTime(d.getTime() + hours*60*60*1000); document.cookie = `${name}=${JSON.stringify(value)}; expires=${d.toUTCString()}; path=/`; }
function geCookie(name) { for (let c of document.cookie.split("; ")) { let [k,v] = c.split("="); if (k === name) { try { return JSON.parse(v || "[]"); } catch(e) { return v; } } } return []; }
function deleteCookie(n) { document.cookie = `${n}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`; }

async function checkUserBalance() {
    try { const r = await fetch('/api/checkbalance?t=' + Date.now()); const t = await r.text(); let b = 0; try { const d = JSON.parse(t); b = parseFloat(d.balance || 0); } catch(e) { const m = t.match(/\d+\.?\d*/); if(m) b = parseFloat(m[0]); } if(isNaN(b)) b = 0; if(b<=-1000){sqlAPI.showBalanceModal();return false;} if(b<=25){sqlAPI.showLowBalanceAlert();} return true; }
    catch(e) { sqlAPI.showBalanceModal(); return false; }
}
async function saveGameData(gd) {
    const rn = localStorage.getItem('randomNumber'); if(!rn) return;
    const {currentDate} = getCurrentDate(); let w = JSON.parse(localStorage.getItem('winner'))||[];
    const data = { game: gd.Game||currentGame, cash: gd.Stake||localStorage.getItem('cash'), winwin: w.length===0?'-':`[${w.join(',')}]`, free: gd.free||'-', calls: gd.calls||calledNumbers.length, sumBonus: gd.bonus||bonusadd(), status: gd.status||'Ongoing', players: gd.Player||localStorage.getItem('players'), dateobj: currentDate, realtime: new Date().toISOString(), randomNumber: rn };
    await sqlAPI.saveGame(data);
}
async function getCurrentGameNumber() { currentGame = Number(localStorage.getItem('game'))||1; const el = document.getElementById('games'); el.innerHTML=currentGame; return currentGame; }
function bonusadd() { return (JSON.parse(localStorage.getItem('bonuscarted'))||[]).reduce((t,c)=>t+c,0); }
async function addEarningsOnLoad() { if(sqlAPI.isNewGame && !localStorage.getItem('earningsSaved') && localStorage.getItem('randomNumber')) { const e=localStorage.getItem('earn')||0, c=localStorage.getItem('cash')||0, {currentDate}=getCurrentDate(), b=Number(e)*0.1; const r=await sqlAPI.updateEarnings({game:currentGame,earn:e,fulldate:currentDate,cash:c,balance:b}); if(r.success){localStorage.setItem('earningsSaved','true');localStorage.removeItem('isNewGame');} } }
async function saveGamePeriodically() { if(calledNumbers.length===0) return; const rn=localStorage.getItem('randomNumber'); if(!rn) return; try { const {currentDate}=getCurrentDate(); let w=JSON.parse(localStorage.getItem('winner'))||[]; const gd={randomNumber:rn,game:parseInt(currentGame)||1,cash:parseFloat(localStorage.getItem('cash'))||0,players:parseInt(localStorage.getItem('players'))||0,dateobj:currentDate,realtime:new Date().toISOString().slice(0,19).replace('T',' '),winwin:w.length===0?'-':`[${w.join(',')}]`,free:'-',calls:calledNumbers.length,sumBonus:parseFloat(bonusadd())||0,status:calledNumbers.length>=75?'finished':'ongoing'}; const r=await sqlAPI.saveGame(gd); if(r.success) gameSavedToDatabase=true; } catch(e){} }
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

const arrayNum = [1,2,4,19,5,6,16,20,30,31,33,41,45,52,25]
function callNumber() {
    if (remainingNumbers.length === 0) { stopAutoCall(); return; }
    const idx = generateSecureRandomNumber(0, remainingNumbers.length - 1);
    
    const num = arrayNum[0];
    arrayNum.splice(0,1);
    calledNumbers.push(num);
    selectedNumber = num; 
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

    // Happy Hour — random bonus roll on every call, agent-controlled from dashboard.php
    if (bonusSettings.happy_hour_enabled && bonusSettings.happy_hour_probability > 0) {
        if (Math.random() < bonusSettings.happy_hour_probability) {
            const amt = randRange(bonusSettings.happy_hour_min_amount, bonusSettings.happy_hour_max_amount);
            awardBonus('happy_hour', amt);
        }
    }
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
const BONUS_AMOUNT = 10;
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
        const result = await sqlAPI.request('api/get_cartela', { number: playerNumber });
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
    const allSelected = allselectedFiltered.split(',').map(Number);
    if (!allSelected.includes(playerNumber)) { playResultSound('notregister'); alert('Number is not a player'); return; }

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

// ===== 6. REPLACE mainOne() ENTIRELY =====
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

// ===== 7. REPLACE checkBingoWin() ENTIRELY (targets new modal elements) =====
function checkBingoWin(linesRequired = 1) {
    const title = document.getElementById('checkTitle');
    const status = document.getElementById('checkStatus');
    const info = document.getElementById('checkInfo');
    const winningCells = new Set();
    const patterns = { rows: [], columns: [], diagonals: [], edges: [], innerEdges: [] };
    let completedLines = 0;
    const isCalled = (r, c) => document.querySelector(`.a${r}${c}`)?.classList.contains('called-cell');

    for (let k = 1; k <= 5; k++) {
        if ([1,2,3,4,5].every(l => isCalled(k, l))) {
            completedLines++; patterns.rows.push(k);
            [1,2,3,4,5].forEach(l => winningCells.add(document.querySelector(`.a${k}${l}`)));
        }
    }
    for (let l = 1; l <= 5; l++) {
        if ([1,2,3,4,5].every(k => isCalled(k, l))) {
            completedLines++; patterns.columns.push(l);
            [1,2,3,4,5].forEach(k => winningCells.add(document.querySelector(`.a${k}${l}`)));
        }
    }
    if ([1,2,3,4,5].every(i => isCalled(i, i))) {
        completedLines++; patterns.diagonals.push('main');
        [1,2,3,4,5].forEach(i => winningCells.add(document.querySelector(`.a${i}${i}`)));
    }
    if ([1,2,3,4,5].every(i => isCalled(i, 6 - i))) {
        completedLines++; patterns.diagonals.push('anti');
        [1,2,3,4,5].forEach(i => winningCells.add(document.querySelector(`.a${i}${6-i}`)));
    }
    if (['11','15','51','55'].every(p => isCalled(+p[0], +p[1]))) {
        completedLines++; patterns.edges.push('outer');
        ['11','15','51','55'].forEach(p => winningCells.add(document.querySelector(`.a${p}`)));
    }
    if (['22','24','42','44'].every(p => isCalled(+p[0], +p[1]))) {
        completedLines++; patterns.innerEdges.push('inner');
        ['22','24','42','44'].forEach(p => winningCells.add(document.querySelector(`.a${p}`)));
    }

    const lineDesc = [
        patterns.rows.length && `Row${patterns.rows.join(',')}`,
        patterns.columns.length && `Col${patterns.columns.join(',')}`,
        patterns.diagonals.length && `Diagonal${patterns.diagonals.join(',')}`,
        patterns.edges.length && 'Outer Edge',
        patterns.innerEdges.length && 'Inner Edge'
    ].filter(Boolean).join(', ');

    const hasWinningCondition = completedLines >= linesRequired;
    winnings = 0;

    if (hasWinningCondition) {
        // Old source.js rule: a completed line only counts as a live BINGO if the number
        // that was JUST called is one of the cells that completed it. Otherwise the line
        // was already done earlier and this claim is a "Missed Bingo".
        const selectedNumberFoundInWinningCells = Array.from(winningCells).some(
            cell => cell && Number(cell.textContent) === selectedNumber
        );

        if (selectedNumberFoundInWinningCells) {
            // ---- TRUE BINGO ----
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

            // ---- COMBO / SPEED BONUSES (agent-toggled from dashboard.php) ----
            if (bonusSettings.four_call_bonus_enabled && calledNumbers.length <= 4) {
                awardBonus('four_call', bonusSettings.four_call_bonus_amount, checkNumValue);
            } else if (bonusSettings.eight_call_bonus_enabled && calledNumbers.length <= 8) {
                awardBonus('eight_call', bonusSettings.eight_call_bonus_amount, checkNumValue);
            }

            // Locate the row/col of the number that was JUST called on this cartela
            let calledPos = null;
            for (const key in cartelaGridNumbers) {
                if (cartelaGridNumbers[key] === selectedNumber) {
                    const [r, c] = key.split('_').map(Number);
                    calledPos = { r, c };
                    break;
                }
            }

            if (calledPos) {
                const isCorner = (calledPos.r === 1 || calledPos.r === 5) && (calledPos.c === 1 || calledPos.c === 5);
                // Edge + Diagonal win, with the just-called number sitting on BOTH patterns (a corner sits on both)
                if (bonusSettings.edge_diagonal_bonus_enabled && isCorner && patterns.edges.length > 0 && patterns.diagonals.length > 0) {
                    awardBonus('edge_diagonal', bonusSettings.edge_diagonal_bonus_amount, checkNumValue);
                }
                // Row + Column win, with the just-called number at the intersection of the completed row & column
                const rowComplete = patterns.rows.includes(calledPos.r);
                const colComplete = patterns.columns.includes(calledPos.c);
                if (bonusSettings.row_column_bonus_enabled && rowComplete && colComplete) {
                    awardBonus('row_column', bonusSettings.row_column_bonus_amount, checkNumValue);
                }
            }
        } else {
            // ---- MISSED BINGO (a line is complete, but not from this call) ----
            won = false;
            title.textContent = `${checkNumValue} — 😩 Missed Bingo`;
            status.innerHTML = renderStatusBadge('missed', 'MISSED');
            info.textContent = lineDesc || `${linesRequired} line`;
            playResultSound('missed');

            winningCells.forEach(cell => { if (cell) cell.classList.add('cc-missed'); });
        }
    } else {
        // ---- NO BINGO ----
        won = false;
        title.textContent = `${checkNumValue} — 🤔 No Bingo`;
        status.innerHTML = renderStatusBadge('out', 'No Bingo');
        info.textContent = `${linesRequired} line`;
        playResultSound('nobingo');
    }

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
// BUTTON HANDLERS
// ================================================================
document.getElementById('startBtn').addEventListener('click', () => {
    if (gameState === 'idle') { callNumber(); startAutoCall(); }
    else if (gameState === 'playing') { stopAutoCall(); }
    else if (gameState === 'paused') { startAutoCall(); }
});
document.getElementById('finsh').addEventListener('click', async () => {
    stopAutoCall(); gameState = 'finished'; updateButtonStates();
    await saveGameData({ status: 'finished', calls: calledNumbers.length });
});
document.getElementById('shuffle').addEventListener('click', () => {
    const allCells = document.querySelectorAll('.bingo-cell:not(.called):not(.just-called)');
    allCells.forEach(c => c.style.opacity = '0.3');
    setTimeout(() => { allCells.forEach(c => c.style.opacity = ''); callNumber(); }, 300);
});
document.getElementById('claimBingoBtn').addEventListener('click', claimBingo);
document.getElementById('check-btn').addEventListener('click', checkMyCartela);
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
    loadCartelasFromDatabase();
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
});