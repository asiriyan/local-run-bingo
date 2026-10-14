// source.js - Updated with MySQL database
let filePath;
let numberElements = document.querySelectorAll('.number');
let calledNumbers = [];
let fullscreen = document.getElementById('fullscreen');
let start = document.getElementById('start');
let startNew = document.getElementById('startnew');
let checkBtn = document.getElementById('check-btn');
let shuffle = document.getElementById('shuffle');
let finish = document.getElementById('finsh');
var lastletter = document.getElementById('last-letter');
var lastnum = document.getElementById('last-num');
let callLang = document.getElementById('lang');
let callinterval = 5000;
var autoIntervalId = null;
var autoPlaying = false;
var callSpeed = document.getElementById('call-speed');
var callText = document.getElementById('call-text');
var selectedLanguage = "Fm";
let close = document.getElementById('close');
let speech = new SpeechSynthesisUtterance();
let voices = []; 
let allselectedFiltered = localStorage.getItem('allselected');
let allSelected;
let gameSavedToDatabase = false;
console.log(allselectedFiltered);
let playingmatch = geCookie('playingmatch') ?? [];
console.log(playingmatch);
const checking  = document.getElementById('checking');
const stakeamount = localStorage.getItem('stakeamount');
const cash = localStorage.getItem('cash');
const players = localStorage.getItem('players');
const earn = localStorage.getItem('earn') ?? 0;
console.log(stakeamount, cash, players, earn);
const toggleSwitch = document.getElementById('switch-bg');
const Bgrid = document.getElementById('b-grid');
const Igrid = document.getElementById('i-grid');
const Ngrid = document.getElementById('n-grid');
const Ggrid = document.getElementById('g-grid');
const Ogrid = document.getElementById('o-grid');
const BgridRow = document.getElementById('b-grid-row');
const IgridRow = document.getElementById('i-grid-row');
const NgridRow = document.getElementById('n-grid-row');
const GgridRow =  document.getElementById('g-grid-row');
const OgridRow = document.getElementById('o-grid-row');

// ============================================
// FIXED: Game state variables - REMOVE THE +1
// ============================================
let gameNo = localStorage.getItem('game');
let currentGame = Number(gameNo) || 1; // NO +1 HERE!
console.log('🎮 Current game loaded:', currentGame);
let currentDate;
let reveseDate;

// ============================================
// TOP OF source.js - Add this right after your existing code
// ============================================

// Check if this is a new game (coming from newgame.php)
const isNewGame = document.referrer.includes('newgame.php') || 
                  localStorage.getItem('isNewGame') === 'true';

let randomNumber = localStorage.getItem('randomNumber');

// If this is a new game, we should have a fresh randomNumber
if (isNewGame) {
    console.log('🆕 New game started with randomNumber:', randomNumber);
    
    // If somehow missing (shouldn't happen), generate emergency one
    if (!randomNumber) {
        randomNumber = Date.now().toString().slice(0, 10);
        localStorage.setItem('randomNumber', randomNumber);
        console.warn('⚠️ Emergency randomNumber generated:', randomNumber);
    }
} else {
    // Not a new game - could be page refresh
    console.log('🔄 Page refresh with randomNumber:', randomNumber);
    
    // If no randomNumber exists (fresh page load without newgame), generate one
    if (!randomNumber) {
        randomNumber = Date.now().toString().slice(0, 10);
        localStorage.setItem('randomNumber', randomNumber);
        console.log('✅ Generated randomNumber for direct access:', randomNumber);
    }
}

// Store in a global variable for easy access
const GAME_RANDOM_ID = randomNumber;
console.log('🎯 Game will use randomNumber:', GAME_RANDOM_ID);
// ============================================
// Cartela cache for database access
// ============================================
let cartelaCache = {};
let allCartelasCache = null;

// SQL API Class
class SQLAPI {
    constructor() {
        this.baseURL = './'; // From /public/js/ to /public/
        console.log('🔗 Base URL set to:', this.baseURL);
        
        // Check if coming from newgame.php
        this.isNewGame = document.referrer.includes('newgame.php') || 
                        localStorage.getItem('isNewGame') === 'true';
        
        if (this.isNewGame) {
            console.log('🆕 Detected new game from newgame.php');
            localStorage.setItem('isNewGame', 'true');
        }
    }

    async request(endpoint, data = {}) {
        try {
            const fullEndpoint = this.baseURL + endpoint;
            console.log('📡 Making request to:', fullEndpoint);
            
            const response = await fetch(fullEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            const text = await response.text();
            console.log('📥 Raw response from', endpoint, ':', text.substring(0, 200));
            
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('❌ Failed to parse JSON from', endpoint, ':', e.message);
                console.error('Raw response was:', text.substring(0, 500));
                return { 
                    success: false, 
                    error: 'Invalid JSON response: ' + e.message,
                    rawResponse: text 
                };
            }
        } catch (error) {
            console.error('❌ API request error for', endpoint, ':', error);
            return { success: false, error: error.message };
        }
    }

    // Get user balance - FIXED: Remove "function" keyword
    async getBalance() {
        try {
            const endpoint = this.baseURL + 'checkbalance.php';
            console.log('💰 Fetching balance from:', endpoint);
            
            // Add timestamp to prevent caching
            const url = endpoint + '?t=' + Date.now();
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            if (!response.ok) {
                console.log(`❌ Server returned ${response.status}: ${response.statusText}`);
                return { 
                    success: false, 
                    balance: "0.00",
                    error: `Server error: ${response.status}`,
                    _networkError: true
                };
            }
            
            const text = await response.text();
            console.log('📥 Raw response length:', text.length, 'chars');
            
            // Check if response looks like HTML/error page
            if (text.includes('<!DOCTYPE') || text.includes('<html') || text.includes('<?php')) {
                console.error('🚫 Received HTML instead of JSON');
                return {
                    success: false,
                    balance: "0.00",
                    error: 'Server returned HTML instead of JSON',
                    _htmlResponse: true
                };
            }
            
            try {
                const data = JSON.parse(text);
                console.log('✅ JSON parsed successfully');
                
                // Ensure balance is always a string for consistency
                if (data.balance && typeof data.balance === 'string') {
                    data.balance = data.balance; // Already string
                } else if (typeof data.balance === 'number') {
                    data.balance = data.balance.toFixed(2); // Convert to string with 2 decimals
                } else if (!data.balance) {
                    data.balance = "0.00";
                }
                
                return data;
                
            } catch (e) {
                console.error('❌ JSON parse error:', e.message);
                console.log('📄 First 500 chars of response:', text.substring(0, 500));
                
                return { 
                    success: false, 
                    balance: "0.00",
                    error: 'Invalid JSON: ' + e.message,
                    rawResponse: text.substring(0, 500)
                };
            }
        } catch (error) {
            console.error('❌ Network error fetching balance:', error);
            return { 
                success: false, 
                balance: "0.00",
                error: error.message,
                _networkError: true
            };
        }
    }

    // Save game data - FIXED: Remove "function" keyword
    async saveGame(data) {
        return await this.request('savegame.php', data);
    }

    // Update daily earnings - FIXED: Remove "function" keyword
    async updateEarnings(data) {
        return await this.request('update.php', data);
    }

    // Update bonus - FIXED: Remove "function" keyword
    async updateBonus(data) {
        return await this.request('updatebonus.php', data);
    }

    // Update balance - FIXED: Remove "function" keyword
    /*
    async updateBalance(data) {
        return await this.request('updatebalance.php', data);
    }
    */
    // Get last row (daily summary) - FIXED: Remove "function" keyword
    async getLastRow() {
        try {
            const endpoint = this.baseURL + 'lastrow.php';
            console.log('📊 Fetching last row from:', endpoint);
            
            const response = await fetch(endpoint);
            const text = await response.text();
            console.log('📥 Last row response:', text.substring(0, 200));
            
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('❌ Last row JSON parse error:', e);
                // Return fallback data
                return { 
                    success: true, 
                    data: { 
                        game: 0,
                        earn: 0,
                        timestat: new Date().toISOString().split('T')[0],
                        stake: 0,
                        net: 0,
                        remain: 0,
                        fillbal: 0
                    },
                    _fallback: true 
                };
            }
        } catch (error) {
            console.error('❌ Error fetching last row:', error);
            // Return fallback data
            return { 
                success: true, 
                data: { game: 0 },
                _fallback: true 
            };
        }
    }

    // Show low balance alert - FIXED: Remove "function" keyword
    showLowBalanceAlert() {
        const alertDiv = document.createElement('div');
        alertDiv.textContent = "Your balance is low please recharge it";
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #ffeb3b;
            color: #333;
            padding: 15px 20px;
            border-radius: 5px;
            border: 1px solid #ffc107;
            z-index: 1000;
            font-weight: bold;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        `;
        
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 3000);
    }
    
    // Show balance modal - FIXED: Remove "function" keyword
    showBalanceModal() {
        const modal = document.createElement('div');
        modal.id = 'balance-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 10px;
            text-align: center;
            max-width: 400px;
            box-shadow: 0 5px 30px rgba(0,0,0,0.3);
        `;
        
        const message = document.createElement('h3');
        message.textContent = "Insufficient Balance";
        message.style.cssText = `
            color: #f13219;
            margin-bottom: 15px;
        `;
        
        const details = document.createElement('p');
        details.textContent = "Your balance is 0 or negative. Please recharge to continue.";
        details.style.cssText = `
            margin-bottom: 20px;
            color: #333;
        `;
        
        const okButton = document.createElement('button');
        okButton.textContent = "Go to Recharge";
        okButton.style.cssText = `
            background: #f13219;
            color: white;
            border: none;
            padding: 10px 30px;
            border-radius: 5px;
            font-size: 16px;
            cursor: pointer;
            font-weight: bold;
        `;
        
        okButton.onclick = () => {
            window.location.href = "index.php";
        };
        
        modalContent.appendChild(message);
        modalContent.appendChild(details);
        modalContent.appendChild(okButton);
        modal.appendChild(modalContent);
        
        document.body.appendChild(modal);
        
        // Auto redirect after 4 seconds
        setTimeout(() => {
            window.location.href = "index.php";
        }, 4000);
    }
    
    // Test method to verify PHP file accessibility - FIXED: Remove "function" keyword
    async testPHPAccess() {
        console.log('🧪 Testing PHP file accessibility...');
        
        const testFiles = [
            'checkbalance.php',
            'lastrow.php',
            'savegame.php',
            'get_cartelas.php'
        ];
        
        for (const file of testFiles) {
            try {
                const endpoint = this.baseURL + file;
                console.log(`🔍 Testing: ${endpoint}`);
                
                const response = await fetch(endpoint);
                console.log(`   ${file}: ${response.status} ${response.statusText}`);
                
                if (response.ok) {
                    console.log(`   ✅ ${file} is accessible`);
                } else {
                    console.log(`   ❌ ${file} not found (${response.status})`);
                }
            } catch (error) {
                console.log(`   ❌ ${file} error: ${error.message}`);
            }
        }
    }
    
    // REMOVE this duplicate anonymous function - it's causing the syntax error
    // async function(gameData) { ... }
}

// Create instance and test immediately
const sqlAPI = new SQLAPI();

// Function to get current date in YYYY:MM:DD format
function getCurrentDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // ISO format for database
    const currentDate = `${year}-${month}-${day}`;   // → 2025-12-20
    
    // Reverse format for display
    const reverseDate = `${day}-${month}-${year}`;   // → 20-12-2025
    
    return { currentDate, reverseDate };
}



// Generate random game ID


// Check user balance
// UPDATED: Robust checkUserBalance function with decimal(10,2) support
async function checkUserBalance() {
    console.log('🔍 Starting balance check...');
    
    // Clear any previous modal
    const existingModal = document.getElementById('balance-modal');
    if (existingModal) {
        existingModal.remove();
    }
    
    try {
        const endpoint = sqlAPI.baseURL + 'checkbalance.php';
        console.log('🔗 Fetching from:', endpoint);
        
        // Add cache busting
        const url = endpoint + '?t=' + Date.now();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log('📥 Response status:', response.status, response.statusText);
        
        // Get raw text first
        const rawText = await response.text();
        console.log('📄 Raw response (first 300 chars):', rawText.substring(0, 300));
        
        let balanceValue = 0;
        let jsonData = null;
        
        // Try to parse JSON
        try {
            jsonData = JSON.parse(rawText);
            console.log('✅ JSON parsed successfully:', jsonData);
            
            // Check for PHP errors in the JSON
            if (jsonData.error) {
                console.error('🚨 PHP/DB Error in response:', jsonData.error);
            }
            
            // Get balance - try multiple possible keys
            if (typeof jsonData.balance !== 'undefined') {
                // balance is decimal(10,2) so it's a string like "1055.20"
                balanceValue = parseFloat(jsonData.balance);
                console.log(`💰 Balance from 'balance' key: ${jsonData.balance} -> ${balanceValue}`);
            } else if (typeof jsonData.balance_numeric !== 'undefined') {
                balanceValue = parseFloat(jsonData.balance_numeric);
                console.log(`💰 Balance from 'balance_numeric' key: ${balanceValue}`);
            } else {
                console.warn('⚠️ No balance key found in response');
                balanceValue = 0;
            }
            
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError.message);
            
            // Check for common PHP errors in the raw text
            const errorIndicators = [
                { text: 'PHP Error', type: 'PHP Error' },
                { text: 'Parse error', type: 'PHP Parse Error' },
                { text: 'Fatal error', type: 'PHP Fatal Error' },
                { text: 'Warning:', type: 'PHP Warning' },
                { text: 'Notice:', type: 'PHP Notice' },
                { text: 'mysqli_connect', type: 'MySQL Connection Error' },
                { text: 'Access denied', type: 'MySQL Access Denied' },
                { text: 'Unknown database', type: 'Database Not Found' }
            ];
            
            let foundError = false;
            for (const indicator of errorIndicators) {
                if (rawText.includes(indicator.text)) {
                    console.error(`🚫 ${indicator.type} detected`);
                    foundError = true;
                    break;
                }
            }
            
            if (foundError) {
                balanceValue = 0;
            } else {
                // Try to extract any number from the text
                const numberMatch = rawText.match(/\d+\.?\d*/);
                if (numberMatch) {
                    balanceValue = parseFloat(numberMatch[0]);
                    console.log(`🔍 Extracted balance from text: ${balanceValue}`);
                } else {
                    balanceValue = 0;
                }
            }
        }
        
        // Final validation of balanceValue
        if (typeof balanceValue !== 'number' || isNaN(balanceValue)) {
            console.warn('⚠️ Invalid balance value, defaulting to 0');
            balanceValue = 0;
        }
        
        console.log(`💰 Final validated balance: ${balanceValue.toFixed(2)}`);
        
        // ============================================
        // BALANCE CHECK LOGIC
        // ============================================
        
        // 1. Balance is 0 or negative - SHOW MODAL, BLOCK PLAYING
        if (balanceValue <= 0) {
            console.log('❌ Balance is 0 or negative, showing modal');
            sqlAPI.showBalanceModal();
            return false; // Block playing
        }
        
        // 2. Balance is between 0.01 and 25 - SHOW WARNING, ALLOW PLAYING
        if (balanceValue > 0 && balanceValue <= 25) {
            console.log('⚠️ Low balance warning (0.01-25)');
            sqlAPI.showLowBalanceAlert();
            return true; // Allow playing with warning
        }
        
        // 3. Balance is sufficient (> 25) - ALLOW PLAYING
        console.log('✅ Balance is sufficient (> 25)');
        return true; // Allow playing
        
    } catch (error) {
        console.error('❌ Network/Request error:', error);
        
        // Handle specific error types
        if (error.name === 'AbortError') {
            console.error('⏰ Request timeout');
            sqlAPI.showLowBalanceAlert('Connection timeout. Please check your internet.');
        } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
            console.error('🌐 Network error - server may be down');
            sqlAPI.showLowBalanceAlert('Cannot connect to server. Please try again.');
        } else {
            console.error('🚨 Unexpected error:', error);
        }
        
        // On network errors, be conservative - show modal
        sqlAPI.showBalanceModal();
        return false; // Block playing on network errors
    }
}
// Add this function to debug balance issues
async function debugBalanceCheck() {
    console.log('🔧 DEBUG: Starting comprehensive balance check...');
    
    console.log('\n=== STEP 1: Direct fetch test ===');
    try {
        const testUrl = './checkbalance.php?debug=' + Date.now();
        console.log('Fetching:', testUrl);
        
        const response = await fetch(testUrl);
        console.log('Status:', response.status, response.statusText);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        const text = await response.text();
        console.log('Response length:', text.length, 'chars');
        console.log('First 500 chars:\n', text.substring(0, 500));
        
        // Try to parse
        try {
            const json = JSON.parse(text);
            console.log('✅ JSON parsed:', json);
        } catch (e) {
            console.log('❌ Not valid JSON');
            console.log('Parse error:', e.message);
        }
    } catch (error) {
        console.log('❌ Fetch error:', error);
    }
    
    console.log('\n=== STEP 2: Check database connection ===');
    // Try a simple query to verify database
    const testQuery = async () => {
        try {
            const formData = new FormData();
            formData.append('test', '1');
            
            const response = await fetch('./test_db.php', { method: 'POST', body: formData });
            const text = await response.text();
            console.log('DB test:', text.substring(0, 200));
        } catch (e) {
            console.log('DB test failed:', e.message);
        }
    };
    
    // Create a simple test_db.php file for debugging:
    // <?php
    // $con = new mysqli('localhost', 'root', '', 'pipmyadmin');
    // if ($con->connect_error) {
    //     die('Connection failed: ' . $con->connect_error);
    // } else {
    //     echo 'Connected successfully. Tables: ';
    //     $result = $con->query("SHOW TABLES");
    //     while($row = $result->fetch_array()) {
    //         echo $row[0] . ', ';
    //     }
    // }
    // ?>
    
    console.log('\n=== STEP 3: Test balance logic ===');
    const result = await checkUserBalance();
    console.log('Balance check result:', result ? 'ALLOW' : 'BLOCK');
    
    console.log('\n=== DEBUG COMPLETE ===');
}



// Save game data to database
async function saveGameData(gameData) {
    // ============================================
    // USE THE SAME randomNumber throughout the game
    // NEVER generate a new one here
    // ============================================
    const randomNumber = localStorage.getItem('randomNumber');
    
    // If no randomNumber, this is a serious error - don't proceed
    if (!randomNumber) {
        console.error('❌ CRITICAL: No randomNumber found for save!');
        return;
    }
    
    const { currentDate } = getCurrentDate();
    
    // Get winners from localStorage
    let winners = JSON.parse(localStorage.getItem('winner')) || [];
    let winwin = winners.length === 0 ? '-' : `[${winners.join(',')}]`;
    
    const data = {
        game: gameData.Game || currentGame,
        cash: gameData.Stake || localStorage.getItem('cash'),
        winwin: winwin,
        free: gameData.free || '-',
        calls: gameData.calls || calledNumbers.length,
        sumBonus: gameData.bonus || bonusadd(),
        status: gameData.status ? gameData.status.toLowerCase() : 'ongoing',
        players: gameData.Player || localStorage.getItem('players'),
        dateobj: currentDate,
        realtime: new Date().toISOString(),
        // ============================================
        // THIS IS THE KEY - ALWAYS USE THE STORED randomNumber
        // ============================================
        randomNumber: randomNumber
    };

    console.log('📤 Saving with randomNumber:', randomNumber);
    
    const result = await sqlAPI.saveGame(data);
    if (result.success) {
        console.log('✅ Game saved successfully:', result);
    } else {
        console.error('❌ Failed to save game:', result.error);
    }
}
// Update daily summary
/*
async function updateDailySummary() {
    // Check if we already updated for this game
    const dailyUpdated = localStorage.getItem('dailyUpdated');
    if (dailyUpdated === 'true') {
        console.log('📌 Daily summary already updated for this game');
        return;
    }
    
    const { currentDate } = getCurrentDate();
    
    const earn = localStorage.getItem('earn') || 0;
    const prevEarn = JSON.parse(localStorage.getItem("prevEarn")) || 0;
    const bonusTotal = bonusadd();
    const currentEarn = ((Number(prevEarn) + Number(earn))) - Number(bonusTotal);
    
    const data = {
        earn: currentEarn,
        fulldate: currentDate,
        cash: localStorage.getItem('cash'),
        balance: Number(currentEarn) * 0.15
    };

    //const result = await sqlAPI.updateEarnings(data);
    if (result && result.success) {
        console.log('✅ Daily summary updated. Game #' + result.game_number);
        
        // Store the returned game number
        localStorage.setItem('lastGameNumber', result.game_number);
        localStorage.setItem('prevEarn', currentEarn);
        localStorage.setItem('earn', 0);
        localStorage.setItem('dailyUpdated', 'true');
        
        // Update balance
        
    }
}
*/

// Update bonus in database
async function updateBonusSQL(bonusAmount) {
    const { currentDate } = getCurrentDate();
    
    const result = await sqlAPI.updateBonus({
        fulldate: currentDate,
        bonus: bonusAmount
    });
    
    if (result.success) {
        console.log('Bonus updated successfully');
    }
}

// ============================================
// FIXED: Get current game number from localStorage ONLY
// ============================================
async function getCurrentGameNumber() {
    // DON'T read from database, just use localStorage
    currentGame = Number(localStorage.getItem('game')) || 1;
    console.log(`🎮 Game number from localStorage: ${currentGame}`);
    
    // Update UI
    document.getElementById('games').innerHTML = currentGame;
    
    return currentGame;
}

// Save table stat entry
// Update saveTableStatEntry to prevent duplicates
async function saveTableStatEntry(statData) {
    // Check if we already saved this stat
    const statKey = `stat_${currentGame}_${calledNumbers.length}`;
    const statSaved = localStorage.getItem(statKey);
    
    if (statSaved === 'true') {
        console.log('📌 Stat entry already saved');
        return;
    }
    
    
    const { currentDate } = getCurrentDate();
    
    await saveGameData({
        ...statData,
        Game: currentGame  // Save current game number AS IS
    });
    
    if (statData.bonus && statData.bonus > 0) {
        await updateBonusSQL(statData.bonus);
    }
    
    // Mark as saved
    localStorage.setItem(statKey, 'true');
    
    // NO INCREMENT HERE - Game number is managed elsewhere
    console.log(`💾 Saved stat for game ${currentGame}`);
}

// ============================================
// NEW: Cartela database functions
// ============================================

// Function to fetch a single cartela from database
/*
async function fetchCartelaFromDatabase(cartelaId) {
    // Check cache first
    if (cartelaCache[cartelaId]) {
        console.log(`📦 Using cached cartela ${cartelaId}`);
        return cartelaCache[cartelaId];
    }
    
    try {
        console.log(`🔍 Fetching cartela ${cartelaId} from database...`);
        const result = await sqlAPI.getCartela(cartelaId);
        
        if (result.success && result.data) {
            cartelaCache[cartelaId] = result.data;
            console.log(`✅ Cartela ${cartelaId} loaded from database`);
            return result.data;
        } else {
            console.error(`❌ Cartela ${cartelaId} not found:`, result.error);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error fetching cartela ${cartelaId}:`, error);
        return null;
    }
}

// Function to fetch all cartelas for locking
async function fetchAllCartelasForLocking() {
    if (allCartelasCache) {
        console.log('📦 Using cached all cartelas for locking');
        return allCartelasCache;
    }
    
    try {
        console.log('🔍 Fetching all cartelas from database for locking...');
        const result = await sqlAPI.getAllCartelas();
        
        if (result.success && result.data) {
            allCartelasCache = result.data;
            console.log(`✅ Loaded ${Object.keys(result.data).length} cartelas for locking`);
            return result.data;
        } else {
            console.error('❌ Failed to load cartelas for locking:', result.error);
            return {};
        }
    } catch (error) {
        console.error('❌ Error fetching cartelas for locking:', error);
        return {};
    }
}
*/

// ============================================
// UPDATED: initializeBingoCartela function
// ============================================
async function initializeBingoCartela(cartelaId = null) {
    if (!cartelaId) {
        // For locking function, we need all cartelas
        return await fetchAllCartelasForLocking();
    }
    
    return await fetchCartelaFromDatabase(cartelaId);
}

// Initialize database functions
async function initializeSQL() {
    console.log('🔧 Initializing database connection...');
    
    // Test PHP access
    await sqlAPI.testPHPAccess();
    
    // Check user balance
    await checkUserBalance();
    
    // Generate game ID if not exists
    
    
    // Get current game number from database
    //await getCurrentGameNumber();
    
    // Get current date
    getCurrentDate();
    
    // Update UI
    
    
    // ============================================
    // ADD EARNINGS TO DATABASE ON PAGE LOAD (ONLY ONCE)
    // ============================================
    await addEarningsOnLoad();
    
    console.log('✅ Database initialization complete');
}

async function addEarningsOnLoad() {
    // Check if we already saved earnings for this game
    const earningsSaved = localStorage.getItem('earningsSaved');
    const gameId = localStorage.getItem('randomNumber');
    
    // Only save if:
    // 1. Coming from newgame.php (isNewGame flag)
    // 2. Haven't saved earnings yet for this game
    // 3. We have valid game data
    if (sqlAPI.isNewGame && !earningsSaved && gameId) {
        try {
            console.log('💰 Adding initial earnings to database...');
            
            const earn = localStorage.getItem('earn') || 0;
            const cash = localStorage.getItem('cash') || 0;
            const { currentDate } = getCurrentDate();
            
            // Calculate balance (15% of earnings)
            const balance = Number(earn) * 0.1;
            console.log(balance);
            const earningsData = {
                game: currentGame,
                earn: earn,
                fulldate: currentDate,
                cash: cash,
                balance: balance
            };
            
            console.log('📊 Earnings data:', earningsData);
            
            // Save to database
            const result = await sqlAPI.updateEarnings(earningsData);
            
            if (result.success) {
                console.log('✅ Earnings added to database');
                
                // Update balance separately
                //await sqlAPI.updateBalance({ balance: balance });
                
                // Mark as saved to prevent duplicate saves
                localStorage.setItem('earningsSaved', 'true');
                localStorage.removeItem('isNewGame'); // Clear the flag
            } else {
                console.error('❌ Failed to save earnings:', result.error);
            }
        } catch (error) {
            console.error('❌ Error saving earnings:', error);
        }
    } else {
        if (earningsSaved) {
            console.log('📌 Earnings already saved for this game');
        }
        if (!sqlAPI.isNewGame) {
            console.log('📌 Not a new game - skipping earnings save');
        }
    }
}

async function saveGamePeriodically() {
    // Don't save if no numbers called
    if (calledNumbers.length === 0) {
        return;
    }
    
    // ============================================
    // CRITICAL: Get the SAME randomNumber from localStorage
    // ============================================
    const randomNumber = localStorage.getItem('randomNumber');
    
    // If no randomNumber, don't save (prevents creating wrong records)
    if (!randomNumber) {
        console.log('⏸️ Auto-save skipped - no randomNumber');
        return;
    }
    
    try {
        const { currentDate } = getCurrentDate();
        
        let winners = JSON.parse(localStorage.getItem('winner')) || [];
        let winwin = winners.length === 0 ? '-' : `[${winners.join(',')}]`;
        let sumBonus = bonusadd ? bonusadd() : 0;
        
        const gameData = {
            randomNumber: randomNumber,  // USE EXISTING
            game: parseInt(currentGame) || 1,
            cash: parseFloat(localStorage.getItem('cash')) || 0,
            players: parseInt(localStorage.getItem('players')) || 0,
            dateobj: currentDate,
            realtime: new Date().toISOString().slice(0, 19).replace('T', ' '),
            winwin: winwin,
            free: '-',
            calls: calledNumbers.length || 0,
            sumBonus: parseFloat(sumBonus) || 0,
            status: calledNumbers.length >= 75 ? 'finished' : 'ongoing'
        };
        
        console.log('📦 Auto-save with randomNumber:', gameData.randomNumber);
        
        const result = await sqlAPI.saveGame(gameData);
        
        if (result.success) {
            console.log(`✅ Auto-saved with randomNumber: ${randomNumber}`);
            gameSavedToDatabase = true;
        }
    } catch (error) {
        console.error('❌ Auto-save error:', error);
    }
}

function startAutoSave() {
    // Save every 5 seconds (5000ms)
    setInterval(saveGamePeriodically, 5000);
    
    // Also save immediately
    setTimeout(saveGamePeriodically, 1000);
    
    console.log('🔄 Auto-save started (every 5 seconds)');
}

// Bonus calculation function
function bonusadd(){
    let bonusarrayed = JSON.parse(localStorage.getItem('bonuscarted')) || [];
    const sum = bonusarrayed.reduce((total, current) => total + current, 0);
    return sum;
}

/**
 * Initializes the game by setting up UI and event listeners.
 */
hideStatus();
// Update the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 DOM loaded, initializing...');
    
    // Initialize database
    await initializeSQL();
    
    // Create the bingo grids
    createLeftGrid();
    
    // Start auto-save
    startAutoSave();
    
    console.log('✅ All initializations complete');
});

function hideMain(){
    const mainContent  =  document.getElementById('main-content');
    const blured = document.getElementById('blur');
    mainContent.classList.add('hidden');
    blured.classList.remove('hidden');
}

function hideStatus(){
    const mainContent  =  document.getElementById('main-content');
    const blured = document.getElementById('blur');
    mainContent.classList.remove('hidden');
    blured.classList.add('hidden');
    console.log("hi");
}

document.addEventListener('DOMContentLoaded', () => {
    const blured = document.getElementById('blur');
    blured.classList.add('hidden');
    getCurrentGameNumber();
    document.getElementById('stake').innerHTML = `${localStorage.getItem('cash')}` || 0;
    document.getElementById('cash-win').innerHTML = parseFloat(`${localStorage.getItem('stakeamount')}` ?? 0).toFixed(0);
    document.getElementById('player').innerHTML = `${localStorage.getItem('players')}` ?? 0;
});

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

fullscreen.addEventListener("click", toggleFullScreen);

screensize();

function showMessage(text) {
    const messageModal = document.getElementById('message-modal');
    const messageText = document.getElementById('message-text');
    messageText.textContent = text ?? "-";
    messageModal.classList.remove('hidden');
    setTimeout(() => {
        messageModal.classList.add('hidden');
    }, 3000);
}

function screensize(){
    const isLargeScreen = window.innerWidth < 768;
    const SmallScreen = window.innerWidth > 768;
    const ScreenLarge = document.getElementById('left-bingo-grid-large');
    if(isLargeScreen){
        ScreenLarge.style.display = 'none';
    } else {
        ScreenLarge.style.display = 'block';
    }
}

function sphere(){
    for (let i = 1; i <= 75; i++) {
        const contentToRepeat = `
        <div class="number lg h-10 w-10 rounded-full flex items-center justify-center relative ball animate-spin-slow text-black/70 text-lg" data-number=${i}>
            <span class="z-10">${i}</span>
        </div>
        `;

        if(i <= 15){
            BgridRow.innerHTML += contentToRepeat;
        } else if(i <= 30){
            IgridRow.innerHTML += contentToRepeat;
        } else if(i <= 45){
            NgridRow.innerHTML += contentToRepeat;
        } else if(i <= 60){
            GgridRow.innerHTML += contentToRepeat;
        } else if(i <=75){
            OgridRow.innerHTML += contentToRepeat;
        }
    }
}

sphere();

function createLeftGrid() {
    const isLargeScreen = window.innerWidth >= 768;
    Bgrid.innerHTML = '';
    Igrid.innerHTML = '';
    Ngrid.innerHTML = '';
    Ggrid.innerHTML = '';
    Ogrid.innerHTML = '';
    
    for (let i = 1; i <= 75; i++) {
        const numberDiv = document.createElement('div');
        numberDiv.id = `left-number-${i}`;
        numberDiv.dataset.number = i;
        numberDiv.classList.add('sm','number','flex', 'items-center', 'justify-center', 'bingo-number', 'bg-[#31404c]', 'rounded-lg', 'text-white/60', 'font-semibold', 'text-xs', 'md:p-2', 'md:text-sm', 'lg:p-3', 'lg:text-base');
        numberDiv.textContent = i;
        
        const numberDivClone = numberDiv.cloneNode(true);

        if (isLargeScreen) {
            // Already handled by sphere() function
        } else {
            if (i < 16) {
                Bgrid.appendChild(numberDiv);
            } else if (i < 31) {
                Igrid.appendChild(numberDiv);
            } else if (i < 46) {
                Ngrid.appendChild(numberDiv);
            } else if (i < 61) {
                Ggrid.appendChild(numberDiv);
            } else if (i < 76) {
                Ogrid.appendChild(numberDiv);
            }
        }
    }
}

window.onresize = function() {
    screensize();
}

// Three.js Sphere Code (Keep this as is)
let scene, camera, renderer, mySphere, textSprite;
let currentTexture;
const TEXTURE_RESOLUTION = 1024;
const BASE_SPRITE_SCALE = { x: 1.8, y: 0.9 };
const TEXT_DISTANCE_FROM_SPHERE = 0.2;

const updateTextSprite = (newText) => {
    if (!textSprite) return;

    if (currentTexture) {
        currentTexture.dispose();
    }
    
    const newTexture = createTextTextureForSprite(newText);
    textSprite.material.map = newTexture;
    textSprite.material.needsUpdate = true;
    currentTexture = newTexture;
}

const createTextTextureForSprite = (text) => {
    const canvas = document.createElement('canvas');
    canvas.width = TEXTURE_RESOLUTION;
    canvas.height = TEXTURE_RESOLUTION;
    const context = canvas.getContext('2d');
    
    context.fillStyle = "rgba(0, 0, 0, 0)"; 
    context.fillRect(0, 0, TEXTURE_RESOLUTION, TEXTURE_RESOLUTION);

    const font = "bold 250px Inter"; 
    context.font = font;
    context.fillStyle = "#000000";
    
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    const x = TEXTURE_RESOLUTION / 2;
    const y = TEXTURE_RESOLUTION / 2;

    context.fillText(text, x, y);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

const init = () => {
    const container = document.getElementById('sphere-container');
    const canvas = document.getElementById("renderCanvas");
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);

    scene = new THREE.Scene();
    scene.background = null;
    
    camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.z = 3.0;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(2, 2, 2).normalize();
    scene.add(directionalLight);
    
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const material = new THREE.MeshStandardMaterial({ 
        color: 0xffffff,
        metalness: 0.1, 
        roughness: 0.2, 
    });
    mySphere = new THREE.Mesh(geometry, material);
    scene.add(mySphere);

    const initialText = "★"; 
    const spriteTexture = createTextTextureForSprite(initialText);
    currentTexture = spriteTexture;
    
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: spriteTexture, 
        transparent: true,
    });
    textSprite = new THREE.Sprite(spriteMaterial);
    scene.add(textSprite);

    window.addEventListener('resize', onWindowResize, false);
    updateSizing(window.innerWidth);
    
    animate();
}

const animate = () => {
    requestAnimationFrame(animate);
    mySphere.rotation.y += 0.005;
    renderer.render(scene, camera);
}

const updateSizing = (width) => {
    const SMALL_SCREEN_BREAKPOINT = 668;
    let scale;

    if (width < SMALL_SCREEN_BREAKPOINT) {
        scale = 0.6;
    } else {
        scale = 1.2;
    }
    
    mySphere.scale.set(scale, scale, scale);

    if (textSprite) {
        textSprite.scale.set(
            BASE_SPRITE_SCALE.x * scale, 
            BASE_SPRITE_SCALE.y * scale, 
            1
        );
        
        textSprite.position.z = scale + TEXT_DISTANCE_FROM_SPHERE;
    }
}

const onWindowResize = () => {
    const container = document.getElementById('sphere-container');
    const newWidth = container.clientWidth;
    const newHeight = container.clientHeight;

    camera.aspect = newWidth / newHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(newWidth, newHeight);
    
    updateSizing(window.innerWidth);
}

window.onload = init;

// Theme toggle
toggleSwitch.addEventListener('change', function() {
    const body = document.getElementById('body');
    const topMenu = document.getElementById('top-menu');
    if (this.checked) {
        body.classList.remove('bg-blue-300');
        body.classList.add('bg-[#1a202c]');
    } else{
        body.classList.remove('bg-[#1a202c]');
        body.classList.add('bg-blue-300');
    }
});

// Cookie functions
function seCookie(name, value, hours) {
    let date = new Date();
    date.setTime(date.getTime() + (hours * 60 * 60 * 1000)); 
    document.cookie = `${name}=${JSON.stringify(value)}; expires=${date.toUTCString()}; path=/`;
}

function geCookie(name) {
    let cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
        let [key, value] = cookie.split("=");
        if (key === name) return JSON.parse(value || "[]");
    }
    return [];
}

function gotCookie(name) {
    let cookies = document.cookie.split("; ");
    for (let cookie of cookies) {
        let [key, value] = cookie.split("=");
        if (key === name) return value;
    }
    return null;
}

function deleteCookie(cookieName) {
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// Language functions
function getLanguage(){
    selectedLanguage = callLang.value;
    return selectedLanguage;
}

selectedLanguage = geCookie('selectedLanguage');
if (Array.isArray(selectedLanguage) && selectedLanguage.length === 0) {
    selectedLanguage = 'mnorb';
}
console.log(selectedLanguage);
callLang.value = selectedLanguage;

callLang.addEventListener('change', function() {
    deleteCookie("selectedLanguage");
    selectedLanguage = callLang.value;
    seCookie("selectedLanguage", selectedLanguage, 7);
});

const inter = geCookie("speed");
callinterval = Number(inter) || Number(4000);
callText.innerHTML = "Auto call " + Number(callinterval/1000) +" sec";

callSpeed.addEventListener('input', function() {
    let newSpeed = callSpeed.value;
    const invertedValue = 12 - (newSpeed - 2);
    callinterval = invertedValue *1000;
    callText.textContent = "Auto call " + invertedValue +" sec";
    deleteCookie("speed");
    seCookie("speed", callinterval, 7);
});

function updateTotalCalled() {
    let totalCalledClock = document.getElementById('total-called');
    totalCalledClock.textContent = calledNumbers.length;
    localStorage.setItem('called', calledNumbers.length);
}

let cartB  = [];
let cartI = [];
let cartN = [0];
let cartG = [];
let cartO = [];
var selectedNumber;
let wholeNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
let beforeCalled = [];
let reversed = [];

function compareArrays(arr1, arr2) {
    let commonElements = arr1.filter(element => arr2.includes(element));
    let missingElements = arr2.filter(element => !arr1.includes(element));

    if (commonElements.length >= 3) {
        remainingNumbers = remainingNumbers.filter(element => !arr2.includes(element));
        reversed.push(Number(missingElements));
        reversed = [... new Set(reversed)];
    }
}

let remainingNumbers = wholeNumbers;
let active;

function mathprob(){
    return Math.random();
}

let tossed = mathprob();
console.log(tossed);
if(tossed < 0.50){
    if (playingmatch[playingmatch.length - 1] < 20 || playingmatch[playingmatch.length - 2] < 20 || playingmatch[playingmatch.length - 3] < 20){
        active = true
    }
} else if(tossed < 0.90){
    if (playingmatch[playingmatch.length - 1] < 20 || playingmatch[playingmatch.length - 2] < 20){
        active = true;
    }
} else {
    if(playingmatch[playingmatch.length - 1] < 20){
        active = true;
    }
}

function generateSecureRandomNumber(min, max) {
    if (min > max) {
        [min, max] = [max, min];
    }
    const range = max - min + 1;
    const numBytes = Math.ceil(Math.log2(range) / 8);
    if (numBytes === 0) return min;

    const randomBytes = new Uint8Array(numBytes);
    let randomNumber;
    let maxValidValue = Math.pow(256, numBytes);
    let threshold = maxValidValue - (maxValidValue % range);

    do {
        window.crypto.getRandomValues(randomBytes);
        randomNumber = 0;
        for (let i = 0; i < numBytes; i++) {
            randomNumber = (randomNumber << 8) | randomBytes[i];
        }
    } while (randomNumber >= threshold);

    return min + (randomNumber % range);
}

function callNumber() {
    selectedNumber = null;
    console.log(wholeNumbers.length);

    if (remainingNumbers.length === 0) {
        alert("All numbers have been called!");
        return;
    }

    const randomIndex = generateSecureRandomNumber(0, remainingNumbers.length - 1);
    selectedNumber = remainingNumbers[randomIndex];

    if(calledNumbers.length > 20 || remainingNumbers < 20){
        active = false;
    }
    
    console.log(active);
    remainingNumbers = remainingNumbers.filter(num => num !== selectedNumber);
    beforeCalled.push(selectedNumber);
    console.log(calledNumbers.length);

    calledNumbers.push(selectedNumber);
    let letterNUm;
    
    if (selectedNumber > 0 && selectedNumber <= 15){
        cartB.push(selectedNumber);
        letterNUm = `B-${selectedNumber}`;
    } else if(selectedNumber <= 30 && selectedNumber > 15) {
        cartI.push(selectedNumber);
        letterNUm = `I-${selectedNumber}`;
    } else if(selectedNumber <= 45 && selectedNumber >30) {
        cartN.push(selectedNumber);
        letterNUm = `N-${selectedNumber}`;
    } else if(selectedNumber <= 60 && selectedNumber >45) {
        cartG.push(selectedNumber);
        letterNUm = `G-${selectedNumber}`;
    } else if(selectedNumber <= 75 && selectedNumber > 60) {
        cartO.push(selectedNumber); 
        letterNUm = `O-${selectedNumber}`;
    }
    
    console.log(selectedNumber);
    console.log(cartB, cartI, cartN, cartG, cartO);
    
    updateTotalCalled();
    lastCalls();
    
    if(active){
        locking();
    }
    
    var numberElement = document.querySelector('.number[data-number="' + selectedNumber + '"]');
    if (numberElement) {
        changeBlink(selectedNumber);
    }
    
    selectedLanguage = getLanguage();
    
    if (selectedLanguage=='f' || selectedLanguage === 'fb'){
    
        console.log(selectedNumber);
        filePath = `static/js/sound/fsound/${selectedNumber}.mp3` ;
        var audio = new Audio(filePath);
        audio.play();
    }else if (selectedLanguage=='mf' || selectedLanguage === 'mfb'){
        filePath = `static/js/sound/msound/${selectedNumber}.mp3`;
        var audio = new Audio(filePath);
        audio.play();
    }else if (selectedLanguage=='db' || selectedLanguage === 'duu'){
        filePath = `static/js/sound/duryew/${selectedNumber}.mp3`;
        var audio = new Audio(filePath);
        audio.play();
    }
    else if (selectedLanguage=='mnorb'|| selectedLanguage === 'mnor'){
        filePath = `static/js/sound/normal/${selectedNumber}.mp3`;
        var audio = new Audio(filePath);
        audio.play();
    }else{
        speech.voice = voices[0];
        speech.text = displayedNumber;
        window.speechSynthesis.speak(speech);
    }
    if(calledNumbers.length > 0){
        // To DISABLE the shuffle button
        shuffle.setAttribute('disabled', 'disabled');
        shuffle.style.opacity = 0.7;
        shuffle.style.cursor = 'not-allowed';
    }
    
    
    updateTextSprite(letterNUm);
}
/*
function playBingo(selectedNumber) {
    let lan = getLanguage();
    let fileKey;

    if (lan === 'f' || lan === 'fb') {
        fileKey = `sound/fsound/${selectedNumber}.mp3`;
    } else if (lan === 'mf' || lan === 'mfb') {
        fileKey = `sound/msound/${selectedNumber}.mp3`;
    } else if (lan === 'duu' || lan === 'db') {
        fileKey = `sound/duryew/${selectedNumber}.mp3`;
    } else if(lan === 'mnor' || lan === 'mnorb'){
        fileKey = `sound/normal/${selectedNumber}.mp3`;
    }

    if (!fileKey) {
        speech.voice = voices[0];
        speech.text = selectedNumber;
        window.speechSynthesis.speak(speech);
        return;
    }

    const dbRequest = indexedDB.open('AudioCache', 1);

    dbRequest.onsuccess = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('audios')) {
            console.error('Object store "audios" not found');
            return;
        }

        const tx = db.transaction('audios', 'readonly');
        const store = tx.objectStore('audios');
        const getRequest = store.get(fileKey);

        getRequest.onsuccess = () => {
            const blob = getRequest.result;
            if (blob) {
                const audio = new Audio(URL.createObjectURL(blob));
                audio.play();
            } else {
                console.warn('Audio not found in cache:', fileKey);
            }
        };

        getRequest.onerror = () => {
            console.error('Failed to retrieve audio from IndexedDB');
        };
    };

    dbRequest.onerror = () => {
        console.error('Failed to open IndexedDB');
    };
}
*/
function changeBlink(number) {
    try {
        if (calledNumbers.length > 1) {
            const previousBlinkingDiv = document.querySelector('.blink');
            if (previousBlinkingDiv) {
                previousBlinkingDiv.classList.remove('blink');
                previousBlinkingDiv.classList.remove('ball');
                previousBlinkingDiv.classList.add('balled');
                previousBlinkingDiv.classList.remove('animate-spin-slow');
            }
        }
        
        const divToBlink = document.querySelector('.number[data-number="' + number + '"]');
        if (divToBlink) {
            divToBlink.classList.remove('ball');
            divToBlink.classList.add('balled');
            divToBlink.classList.add('blink');
            divToBlink.classList.remove('animate-spin-slow');
            divToBlink.classList.remove('text-black/70');
            divToBlink.classList.add('text-black');
            divToBlink.classList.add('font-bold');
            divToBlink.classList.remove('text-lg');
            divToBlink.classList.add('text-xl');
        } else {
            console.warn(`No div found with ID: ${number}`);
        }
    } catch(error) {
        console.error("An error occurred in changeBlink:", error);
    }
}

function previousCalled(){
    let curWidth =  window.innerWidth;
    try {
        calledNumbers.forEach((number) => {
            if(curWidth < 768){
                const previousBlinkingDiv = document.querySelector('.number[data-number="' + number + '"]');
                if (previousBlinkingDiv) {
                    previousBlinkingDiv.classList.remove('ball');
                    previousBlinkingDiv.classList.add('balled');
                    previousBlinkingDiv.classList.add('text-black');
                    previousBlinkingDiv.classList.add('font-bold');
                    previousBlinkingDiv.classList.remove('text-lg');
                    previousBlinkingDiv.classList.remove('text-white/60');
                }
            }
        });
    } catch(error) {
        console.error("there is a problem", error);
    }
}

let previousWidth = window.innerWidth;
console.log(previousWidth);

function handleSize() {
    let currentWidth = window.innerWidth;
    const la5 = document.querySelector('.la5');
    const la4 = document.querySelector('.la4');
    const tohide = document.getElementById('tohide');
    
    if(currentWidth < 768){
        tohide.classList.add('hidden');
        if (la5) la5.classList.add('hidden');
        if (la4) la4.classList.add('hidden');
    } else if(currentWidth > 768){
        tohide.classList.remove('hidden');
        if (la5) la5.classList.remove('hidden');
        if (la4) la4.classList.remove('hidden');
    }
    
    if (previousWidth <= 768 && currentWidth > 768) {
        window.location.reload();
    } else if (previousWidth > 768 && currentWidth <= 768) {
        window.location.reload();
        createLeftGrid();
    }
    previousWidth = currentWidth;
}

handleSize();
window.addEventListener('resize', handleSize);

function lastCalls() {
    const lasts = ['.la1', '.la2', '.la3', '.la4', '.la5'];
    const bingoRanges = [
        { letter: 'B', max: 15 },
        { letter: 'I', max: 30 },
        { letter: 'N', max: 45 },
        { letter: 'G', max: 60 },
        { letter: 'O', max: 75 }
    ];

    lasts.forEach((last, index) => {
        const numElement = document.querySelector(last);
        const negativeIndex = -(index + 1);
        const currentNumber = calledNumbers.at(negativeIndex);

        if (numElement && currentNumber !== undefined) {
            let prefix = '';
            for (const range of bingoRanges) {
                if (currentNumber <= range.max) {
                    prefix = range.letter;
                    break;
                }
            }
            numElement.innerHTML = `${prefix}-${currentNumber}`;
        } else if (numElement) {
            numElement.innerHTML = '';
        }
    });
}

function toggleButtons() {
    start.classList.toggle('opacity-0');
    start.classList.toggle('pointer-events-none');
    startNew.classList.toggle('opacity-0');
    startNew.classList.toggle('pointer-events-none');
    const disable = document.getElementById('disable');
    disable.style.display = 'none';
}

finish.addEventListener('click', async () => {
    toggleButtons();
    playingmatch.push(calledNumbers.length);
    seCookie('playingmatch', playingmatch, 7);
    
    // ============================================
    // Get the SAME randomNumber used for this game
    // ============================================
    const randomNumber = localStorage.getItem('randomNumber');
    
    if (!randomNumber) {
        console.error('❌ Cannot finish - no randomNumber found');
        alert('Error: Game ID not found. Please start a new game.');
        return;
    }
    
    console.log(`🏁 Finishing game ${currentGame} with randomNumber: ${randomNumber}`);
    
    const { currentDate } = getCurrentDate();
    
    let winners = JSON.parse(localStorage.getItem('winner')) || [];
    let winwin = winners.length === 0 ? '-' : `[${winners.join(',')}]`;
    const finalBonus = bonusadd();
    
    const finalGameData = {
        game: currentGame,
        cash: localStorage.getItem('cash'),
        winwin: winwin,
        free: '-',
        calls: calledNumbers.length,
        sumBonus: finalBonus,
        status: 'finished',
        players: localStorage.getItem('players'),
        dateobj: currentDate,
        realtime: new Date().toISOString(),
        randomNumber: randomNumber  // USE SAME randomNumber
    };
    
    const result = await sqlAPI.saveGame(finalGameData);
    
    if (result.success) {
        console.log(`✅ Game finished with randomNumber: ${randomNumber}`);
        resetForNextGame();
    }
});

function resetForNextGame() {
    // Clear game data but KEEP the randomNumber
    calledNumbers = [];
    remainingNumbers = Array.from({ length: 75 }, (_, i) => i + 1);
    beforeCalled = [];
    reversed = [];
    
    cartB = [];
    cartI = [];
    cartN = [0];
    cartG = [];
    cartO = [];
    
    updateTotalCalled();
    lastCalls();
    
    // Clear game-specific data
    localStorage.removeItem('winner');
    localStorage.removeItem('selectedNum');
    localStorage.removeItem('selectedNumd');
    localStorage.removeItem('selectedNums');
    localStorage.removeItem('myarray');
    localStorage.removeItem('bonuscarted');
    localStorage.removeItem('prevEarn');
    localStorage.removeItem('earningsSaved');
    localStorage.removeItem('dailyUpdated');
    
    // ============================================
    // IMPORTANT: DO NOT clear randomNumber here
    // It will be replaced when next game starts
    // ============================================
    // localStorage.removeItem('randomNumber');  ← DON'T DO THIS
    
    console.log('🔄 Reset complete - randomNumber preserved');
}
document.addEventListener('DOMContentLoaded', () => {
    let interval = setInterval(() => {
        // callNumber(); // Uncomment if you want auto-calling on load
    }, 500);
});

start.onclick = function () {
    if (start.innerHTML === 'start') {
        start.innerHTML = 'stop';
        checkBtn.classList.add('opacity-50', 'pointer-events-none');
        finish.classList.add('opacity-50', 'pointer-events-none');
        shuffle.classList.add('opacity-50', 'pointer-events-none');
        console.log("ak-47");
    } else {
        start.innerHTML = 'start';
        checkBtn.classList.remove('opacity-50', 'pointer-events-none');
        finish.classList.remove('opacity-50', 'pointer-events-none');
        shuffle.classList.remove('opacity-50', 'pointer-events-none');
    }

    selectedLanguage = getLanguage();
    let fileKey;

    if (autoPlaying) {
        start.textContent = "start";

        selectedLanguage = getLanguage();
        
            
            if (selectedLanguage ==='f' || selectedLanguage === 'fb'){
                
            filePath = `static/js/sound/fsound/stop.mp3`;
            var audio = new Audio(filePath);
            audio.play();
        
                var audio = new Audio(filePath);
                audio.play();
            }else if (selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb' || selectedLanguage === 'mnor' || selectedLanguage === 'mf' || selectedLanguage === 'duu'){
                filePath = `static/js/sound/msound/stop.mp3`;
                var audio = new Audio(filePath);
                audio.play();
            }else{
                speech.voice = voices[0];
                speech.text="game paused";
                window.speechSynthesis.speak(speech);
            }
            stopAuto();

        
    } else {
        start.textContent = "stop";
        if (selectedLanguage ==='f' || selectedLanguage === 'fb'){
                
            filePath = `static/js/sound/fsound/start.mp3`;
            var audio = new Audio(filePath);
            audio.play();
        
                var audio = new Audio(filePath);
                audio.play();
            }else if (selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb' || selectedLanguage === 'mnor' || selectedLanguage === 'mf' || selectedLanguage === 'duu'){
                filePath = `static/js/sound/msound/start.mp3`;
                var audio = new Audio(filePath);
                audio.play();
            }else{
                speech.voice = voices[0];
                speech.text="game paused";
                window.speechSynthesis.speak(speech);
            }
       

        startAuto();
    }
};

let pushed  = true;

function About(){
    if(!active){
        if(pushed){
            remainingNumbers.push(...reversed);
            remainingNumbers = [... new Set(remainingNumbers)].sort((a, b) => a - b);
            pushed = false;
        }
    }
}

function startAuto() {
    console.log(active);
    if (autoIntervalId) {
        clearInterval(autoIntervalId);
        autoIntervalId = null;
        alert("Stopped");
        return;
    }

    autoIntervalId = setInterval(function () {
        callNumber();
        if(active){
            locking();
        } else {
            if(pushed){
                remainingNumbers.push(...reversed);
                remainingNumbers = [... new Set(remainingNumbers)].sort((a, b) => a - b);
                pushed = false;
            }
        }
        if (remainingNumbers.length === 0) {
            clearInterval(autoIntervalId);
            autoIntervalId = null;
        }
    }, callinterval);
    autoPlaying = true;
}

function stopAuto() {
    clearInterval(autoIntervalId);
    autoIntervalId = null;
    autoPlaying = false;
}

// ============================================
// UPDATED: locking function using database
// ============================================
let bingoCartela = [];


// ========== 1. LOAD CARTELAS FROM DATABASE ==========
function loadCartelasFromDatabase() {
    console.log("Loading cartelas from database...");
    
    fetch('./get_cartelas.php')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to load cartelas from database');
            }
            return response.json();
        })
        .then(data => {
            bingoCartela = data;
            console.log('Successfully loaded', bingoCartela.length, 'cartelas from database');
            
            // If checkNumValue exists, display the cartela
            if (typeof checkNumValue !== 'undefined' && checkNumValue > 0) {
                mainOne();
            }
        })
        .catch(error => {
            console.error('Error loading cartelas:', error);
            // Fallback to local array if needed
            loadCartelasFromLocal();
        });
}
document.addEventListener('DOMContentLoaded', function() {
    loadCartelasFromDatabase();
    console.log(bingoCartela);
});
function locking() {
    if (calledNumbers.length === 0 || remainingNumbers.length === 0) return;
    // ❌ removed: if (!shouldLockingBeActive()) return;
    // `active` was already decided once at game start/reset — don't re-roll per call.

    let cartelaPositions = cachedCartelaPositions; // see preload note below

    if (!cartelaPositions || cartelaPositions.midum === undefined) {
        cartelaPositions = {
            midum: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
            outter: [1, 15, 51, 65],
            inner: [17, 31, 49, 63],
            center: [17, 32, 47, 62],
            diago: [1, 17, 33, 49, 65],
            andiago: [15, 31, 47, 63, 75],
            innerCross: [17, 32, 47, 62, 37],
            outerCross: [1, 26, 51, 76],
            innerEdges: [17, 31, 49, 63]
        };
    }

    const patterns = [
        { name: 'midum', positions: cartelaPositions.midum, enabled: true },
        { name: 'outter', positions: cartelaPositions.outter, enabled: true },
        { name: 'inner', positions: cartelaPositions.inner, enabled: true },
        { name: 'center', positions: cartelaPositions.center, enabled: true },
        { name: 'diago', positions: cartelaPositions.diago, enabled: true },
        { name: 'andiago', positions: cartelaPositions.andiago, enabled: true },
        { name: 'innerCross', positions: cartelaPositions.innerCross, enabled: !!bonusSettings.inner_cross_enabled },
        { name: 'outerCross', positions: cartelaPositions.outerCross, enabled: !!bonusSettings.outer_cross_enabled },
        { name: 'innerEdges', positions: cartelaPositions.innerEdges, enabled: !!bonusSettings.inner_edges_enabled },
    ];

    let lockedCount = 0;
    patterns.forEach(pattern => {
        if (!pattern.enabled || !Array.isArray(pattern.positions)) return;
        const calledCount = pattern.positions.filter(num => calledNumbers.includes(num)).length;
        if (calledCount >= 3) {
            const remaining = pattern.positions.filter(num => !calledNumbers.includes(num) && remainingNumbers.includes(num));
            if (remaining.length) {
                lockedCount += remaining.length;
                remainingNumbers = remainingNumbers.filter(num => !remaining.includes(num));
                lockedNumbers.push(...remaining);
            }
        }
    });

    if (lockedCount > 0) console.log(`🔒 Locking active: Locked ${lockedCount} numbers`, patterns.filter(p=>p.enabled).map(p=>p.name));
}
if(allselectedFiltered){
    const splitNum = allselectedFiltered.split(',');
    allSelected = splitNum.map(Number);
} else {
    console.log("no selected num");
}

let checkNumValue;
let specialBonus;
let bonus = 0;
let winnings;
let won;
let lineNumber;
lineNumber = gotCookie('amountline') || "1";

function checkBingoWin(linesRequired = Number(lineNumber)) {
    const statBingo = document.querySelector('.stat-bingo');
    const info = document.getElementById("info");
    const winningCells = new Set();
    let completedLines = 0;
    let selectedNumberFoundInWinningCells = false;

    const completedLinePatterns = {
        rows: [],
        columns: [],
        diagonals: [],
        edges: [],
        innerEdges: []
    };

    const findCellAndAdd = (row, col) => {
        const cell = document.querySelector(`.a${row}${col}`);
        if (cell && cell.classList.contains('call')) {
            winningCells.add(cell);
            return true;
        }
        return false;
    };

    // Check all rows
    for (let k = 1; k <= 5; k++) {
        let isRowComplete = true;
        for (let l = 1; l <= 5; l++) {
            const cell = document.querySelector(`.a${k}${l}`);
            if (!cell.classList.contains('call')) {
                isRowComplete = false;
                break;
            }
        }
        if (isRowComplete) {
            completedLines++;
            completedLinePatterns.rows.push(k);
            for (let l = 1; l <= 5; l++) {
                winningCells.add(document.querySelector(`.a${k}${l}`));
            }
        }
    }

    // Check all columns
    for (let l = 1; l <= 5; l++) {
        let isColumnComplete = true;
        for (let k = 1; k <= 5; k++) {
            const cell = document.querySelector(`.a${k}${l}`);
            if (!cell.classList.contains('call')) {
                isColumnComplete = false;
                break;
            }
        }
        if (isColumnComplete) {
            completedLines++;
            completedLinePatterns.columns.push(l);
            for (let k = 1; k <= 5; k++) {
                winningCells.add(document.querySelector(`.a${k}${l}`));
            }
        }
    }

    // Check main diagonal
    let isMainDiagonalComplete = true;
    for (let i = 1; i <= 5; i++) {
        const cell = document.querySelector(`.a${i}${i}`);
        if (!cell.classList.contains('call')) {
            isMainDiagonalComplete = false;
            break;
        }
    }
    if (isMainDiagonalComplete) {
        completedLines++;
        completedLinePatterns.diagonals.push('main');
        for (let i = 1; i <= 5; i++) {
            winningCells.add(document.querySelector(`.a${i}${i}`));
        }
    }

    // Check anti-diagonal
    let isAntiDiagonalComplete = true;
    for (let i = 1; i <= 5; i++) {
        const cell = document.querySelector(`.a${i}${6 - i}`);
        if (!cell.classList.contains('call')) {
            isAntiDiagonalComplete = false;
            break;
        }
    }
    if (isAntiDiagonalComplete) {
        completedLines++;
        completedLinePatterns.diagonals.push('anti');
        for (let i = 1; i <= 5; i++) {
            winningCells.add(document.querySelector(`.a${i}${6 - i}`));
        }
    }

    // Check inner edges
    /*
    const innerEdges = ['.a22', '.a24', '.a42', '.a44'];
    let allInnerEdgesCalled = true;
    for (const innerEdge of innerEdges) {
        const cell = document.querySelector(innerEdge);
        if (!cell.classList.contains('call')) {
            allInnerEdgesCalled = false;
            break;
        }
    }
    if (allInnerEdgesCalled) {
        completedLines++;
        completedLinePatterns.innerEdges.push('inner');
        for (const inner of innerEdges) {
            winningCells.add(document.querySelector(inner));
        }
    }
    */
    // Check outer edges
    const edges = ['.a11', '.a15', '.a51', '.a55'];
    let areAllEdgesCalled = true;
    for (const edge of edges) {
        const cell = document.querySelector(edge);
        if (!cell.classList.contains('call')) {
            areAllEdgesCalled = false;
            break;
        }
    }
    if (areAllEdgesCalled) {
        completedLines++;
        completedLinePatterns.edges.push('outer');
        for (const edge of edges) {
            winningCells.add(document.querySelector(edge));
        }
    }

    const hasWinningCondition = completedLines >= linesRequired;

    if (hasWinningCondition) {
        selectedNumberFoundInWinningCells = Array.from(winningCells).some(cell =>
            parseInt(cell.textContent) === selectedNumber
        );
    }

    if (hasWinningCondition) {
        const classesToRemove = ['bg-[#db98e9]', 'text-black/90', 'md:text-lg', 'lg:text-2xl', 'bg-yellow-500', 'bg-green-500', 'animate-spin-slow', 'text-black', 'md:text-xl', 'lg:text-3xl', 'md:text-3xl'];
        
        let classesToAdd;
        if (selectedNumberFoundInWinningCells) {
            statBingo.textContent = `${checkNumValue} - Bingo `;
            const span = document.createElement('span');
            info.innerHTML = `${linesRequired} line`;
            span.classList.add('text-5xl');
            span.innerHTML = ' 🏆😎';
            statBingo.appendChild(span);
            statBingo.classList.remove('text-red-500', 'text-yellow-700');
            statBingo.classList.add('text-green-500');
            classesToAdd = ['bg-green-500', 'animate-spin-slower', 'text-black', 'md:text-xl', 'lg:text-3xl'];
            
            winnings = !haswonbefore ? true : false;
            
            let showbeer = false;
            let selectedNumd = JSON.parse(localStorage.getItem('selectedNumd')) || 0;
            console.log(selectedNumber, selectedNumd);
            if(selectedNumber === selectedNumd || selectedNumd === 0){
                showbeer = true;
                localStorage.setItem("selectedNumd", selectedNumber);
            }
            
            let winnerArray = JSON.parse(localStorage.getItem("winner")) || [];
            let selectedNums = JSON.parse(localStorage.getItem('selectedNums')) || 0;
            if(selectedNumber === selectedNums || selectedNums === 0){
                winnerArray.push(checkNumValue);
                winnerArray = [... new Set(winnerArray)];
                localStorage.setItem("winner", JSON.stringify(winnerArray));
                localStorage.setItem('selectedNums', selectedNumber);
            }
            
            won = true;
            selectedLanguage = getLanguage();
            if(selectedLanguage === 'fb' || selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb'){
                    filePath = `static/js/sound/bingo.mp3`;
                    var audio = new Audio(filePath);
                    audio.play();
                
            }
        } else {
            info.innerHTML = "";
            statBingo.textContent = `${checkNumValue} - Missed Bingo`;
            const span = document.createElement('span');
            span.classList.add('text-5xl');
            info.innerHTML = `${linesRequired} line`;
            span.innerHTML = '😩';
            statBingo.appendChild(span);
            statBingo.classList.remove('text-red-500', 'text-green-500');
            statBingo.classList.add('text-yellow-700');
            classesToAdd = ['bg-yellow-500', 'md:text-lg', 'lg:text-3xl', 'text-black'];
            if(selectedLanguage === 'fb' || selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb'){
                    filePath = `static/js/sound/missed.mp3`;
                    var audio = new Audio(filePath);
                    audio.play();
                
            }
        }

        winningCells.forEach(cell => {
            if (parseInt(cell.innerHTML) === selectedNumber) {
                cell.classList.remove(...classesToRemove); 
                cell.classList.add('blink'); 
                cell.classList.add('bg-green-500', 'text-black', 'md:text-xl', 'lg:text-3xl'); 
            }
        });
        
        winningCells.forEach(cell => {
            if (parseInt(cell.innerHTML) !== selectedNumber) {
                try {
                    cell.classList.remove(...classesToRemove);
                    cell.style.backgroundColor = ''; 
                    cell.classList.add(...classesToAdd);
                } catch (error) {
                    console.error('Error applying classes to non-selected winning cell:', error);
                }
            }
        });
    } else {
        info.innerHTML = "";
        statBingo.textContent = `${checkNumValue} - No Bingo`;
        const span = document.createElement('span');
        span.classList.add('text-5xl');
        span.innerHTML = '🤔';
        info.innerHTML = `${linesRequired} line`;
        statBingo.appendChild(span);
        statBingo.classList.remove('text-yellow-700', 'text-green-500');
        statBingo.classList.add('text-red-500');
        if(selectedLanguage === 'fb' || selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb'){
                    filePath = `static/js/sound/nobingo.mp3`;
                    var audio = new Audio(filePath);
                    audio.play();
                
        }
    }
    
    return {
        hasWinningCondition,
        completedLines,
        totalLinesFound: completedLines,
        requiredLines: linesRequired,
        linePatterns: completedLinePatterns
    };
}

let check = document.getElementById('check-num');
let check_num;

check.addEventListener('input', () => {
    check_num = check.value.trim();
    check_num = parseInt(check_num);
    checkNumValue = check_num;
    console.log(check_num, checkNumValue);
});

let haswonbefore;

checkBtn.onclick = async function() {
    for (let k = 1; k <= 5; k++) {
        for (let l = 1; l <= 5; l++) {
            const element = document.querySelector(`.a${k}${l}`);
            if (element) {
                const classesToKeep = `a${k}${l}`;
                const addArray = [
                    'flex', 'items-center', 'justify-center', 'w-10', 'h-10', 'lg:w-14',
                    'lg:h-14', 'rounded-full', 'bg-gray-300', 'text-black/70', 'font-bold',
                    'text-base', 'md:text-lg', 'lg:text-xl'
                ];
                const currentClasses = Array.from(element.classList);
                const classesToRemove = currentClasses.filter(className => !classesToKeep.includes(className));
                if (classesToRemove.length > 0) {
                    element.classList.remove(...classesToRemove);
                }
                addArray.forEach((single) => {
                    element.classList.add(single);
                });
            }
        }
    }

    if (check_num === "") {
        alert("Input field cannot be empty");
        return false;
    } else if (!allSelected.includes(Number(check_num))) {
        selectedLanguage = getLanguage();
        if(selectedLanguage === 'fb' || selectedLanguage === 'mfb' || selectedLanguage === 'db' || selectedLanguage === 'mnorb'){
                filePath = `static/js/sound/notregister.mp3`;
                var audio = new Audio(filePath);
                audio.play();
            
        }
        
        alert("Number is not a player");
    } else if (allSelected.includes(Number(check_num))) {
        const result = await mainOne();
        bonus = result.bonus;
        winnings = result.winnings;
                
        hideMain();
        
        console.log("Winnings:", winnings);
        console.log("Bonus:", bonus);
        
        let checkBonusNum = JSON.parse(localStorage.getItem('myarray')) || [];
        let bonuscarted = JSON.parse(localStorage.getItem('bonuscarted')) || [];
        console.log(checkBonusNum);
        
        if (winnings) {
            let selectedNum = JSON.parse(localStorage.getItem('selectedNum')) || 0;
            if (selectedNumber === selectedNum || selectedNum === 0) {
                haswonbefore = false;
                localStorage.setItem('selectedNum', selectedNumber);
            } else {
                haswonbefore = true;
            }
        }
        
        if(won){
            const statData = {
                status: "finished"
            };
            await saveTableStatEntry(statData);
        }
        
        if (!haswonbefore) {
            if (bonus !== 0) {
                if (checkBonusNum.includes(check_num)) {
                    console.log("already bonus is added to earning");
                } else if (!checkBonusNum.includes(check_num)) {
                    bonuscarted.push(bonus);
                    localStorage.setItem('bonuscarted', JSON.stringify(bonuscarted));
                    console.log(localStorage.getItem('bonuscarted'));
                    const addBonus = bonusadd();
                    console.log(addBonus);
                    
                    // Update bonus in database
                    await updateBonusSQL(addBonus);
                    
                    // Update daily earnings
                    //await updateDailySummary();
                }
                checkBonusNum.push(check_num);
                localStorage.setItem('myarray', JSON.stringify(checkBonusNum));
            }
        }
    }
    check_num = '';
};

function blockCartela(){
    check_num = check.value.trim();
    check_num = parseInt(check_num);
    checkNumValue = check_num;
    if(allSelected.includes(checkNumValue)){
        console.log(allSelected);
        allSelected = allSelected.filter(item => item !== checkNumValue);
    }
}

const block = document.getElementById('block');
block.addEventListener('click', () => {
    blockCartela();
    for (let k = 1; k <= 5; k++) {
        for (let l = 1; l <= 5; l++) {
            const element = document.querySelector(`.a${k}${l}`);
            if (element) {
                const classesToKeep = `a${k}${l}`;
                const addArray = [
                    'flex',
                    'items-center',
                    'justify-center',
                    'w-10',
                    'h-10',
                    'lg:w-14',
                    'lg:h-14',
                    'rounded-full',
                    'bg-gray-300',
                    'text-black/70',
                    'font-bold',
                    'text-base',
                    'md:text-lg',
                    'lg:text-xl'
                ];
                
                const currentClasses = Array.from(element.classList);
                const classesToRemove = currentClasses.filter(className => !classesToKeep.includes(className));
                if (classesToRemove.length > 0) {
                    element.classList.remove(...classesToRemove);
                }
                addArray.forEach((single) => {
                    element.classList.add(single);
                });
            }
        }
    }
    hideStatus();
});

function generateRandomNumbers() {
    return Array.from({ length: 10 }, () => Math.floor(Math.random() * 75) + 1);
}

function shuffleBoard(){
    const array1 = generateRandomNumbers();
    const size = window.innerWidth;
    if(size >= 768){
        const prevChosen = document.querySelectorAll('.bg-black');
        prevChosen.forEach((prevs) => {
            prevs.classList.remove('bg-black');
            prevs.classList.add('ball');
        });
    }
    
    const allNumberCells = document.querySelectorAll('.lg.number, .sm.number');
    allNumberCells.forEach(cell => {
        cell.classList.remove('bg-black');
        cell.classList.remove('highlighted');
    });
    
    console.log(array1);
    
    array1.forEach(cell => {
        const selector = size >= 768 ? 
            `.lg.number[data-number="${cell}"]` : 
            `.sm.number[data-number="${cell}"]`;
        
        const chosen = document.querySelector(selector);
        if (chosen) {
            chosen.classList.add('bg-black');
            chosen.classList.remove(size >= 768 ? 'ball' : 'bg-[#31404c]');
        }
    });
}

function shuffleOff(){
    const shuffleNumber = document.querySelectorAll('.bg-black');
    shuffleNumber.forEach((cell) => {
        cell.classList.remove('bg-black');
        cell.classList.add('ball');
    });
}

let shuffleIntervalId;
let shuffleAudio = null;

shuffle.addEventListener('click', () => {
    let fileKey = 'sound/shuffle.mp3';
    if (shuffle.innerHTML === 'shuffle') {
        shuffle.innerHTML = "stop";
        shuffleIntervalId = setInterval(shuffleBoard, 500);
        filePath = `static/js/sound/shuffle.mp3`;
        shuffleAudio = new Audio(filePath);
        shuffleAudio.play();
    } else {
        shuffle.innerHTML = "shuffle";
        
        if (shuffleAudio) {
            shuffleAudio.pause();
            shuffleAudio.currentTime = 0;
            shuffleAudio = null;
        }
        
        if (shuffleIntervalId) {
            clearInterval(shuffleIntervalId);
            shuffleIntervalId = null;
        }
        
        if (typeof shuffleOff === 'function') {
            shuffleOff();
        }
    }
});

close.addEventListener('click', () => {
    for (let k = 1; k <= 5; k++) {
        for (let l = 1; l <= 5; l++) {
            const element = document.querySelector(`.a${k}${l}`);
            if (element) {
                const classesToKeep = `a${k}${l}`;
                const addArray = [
                    'flex',
                    'items-center',
                    'justify-center',
                    'w-10',
                    'h-10',
                    'lg:w-14',
                    'lg:h-14',
                    'rounded-full',
                    'bg-gray-300',
                    'text-black/70',
                    'font-bold',
                    'text-base',
                    'md:text-lg',
                    'lg:text-xl'
                ];
                
                const currentClasses = Array.from(element.classList);
                const classesToRemove = currentClasses.filter(className => !classesToKeep.includes(className));
                if (classesToRemove.length > 0) {
                    element.classList.remove(...classesToRemove);
                }
                addArray.forEach((single) => {
                    element.classList.add(single);
                });
            }
        }
    }
    hideStatus();
});

checking.addEventListener('input', function() {
    const value = this.value.trim();
    
    if (this.timeoutId) {
        clearTimeout(this.timeoutId);
    }
    if (this.clearTimeoutId) {
        clearTimeout(this.clearTimeoutId);
    }
    
    if (value === '') {
        return;
    }
    
    const numberValue = parseInt(value);
    
    this.timeoutId = setTimeout(() => {
        let result = '';
        let color = '';
        
        if (isNaN(numberValue)) {
            result = 'Invalid input';
            color = 'red';
        } else if (numberValue > 200 || numberValue < 0) {
            result = 'Out of cartela';
            color = 'orange';
        } else if (allSelected && allSelected.includes(numberValue)) {
            result = 'In a game';
            color = 'green';
        } else {
            result = 'Out a game';
            color = 'red';
        }
        
        this.value = result;
        this.style.color = color;
        
        this.clearTimeoutId = setTimeout(() => {
            this.value = '';
            this.style.color = 'white';
        }, 1500);
        
    }, 2000);
});

checking.addEventListener('focus', function() {
    this.value = '';
    this.style.color = 'white';
});

// ============================================
// UPDATED: mainOne function using database
// ============================================
async function mainOne() {
    if (bingoCartela.length === 0) {
        console.log("Cartelas not loaded yet. Loading...");
        setTimeout(mainOne, 100); // Try again after 100ms
        return;
    }
    try {
        // Get cartela number from checkNumValue
        const cartelaId = "car" + checkNumValue;
        
        // Find cartela data in array (array of objects)
        let cartelaItem = bingoCartela.find(item => item[cartelaId]);
        
        if (!cartelaItem) {
            console.error(`Cartela ${cartelaId} not found in database`);
            return { bonus: 0, winnings: 0 };
        }
        
        // Get the cartela data array - it's [column][row]
        const cartelaData = cartelaItem[cartelaId];

        // Helper function to update cells
        function updateCell(row, col, value, checkArray) {
            const cell = document.querySelector(`.a${row}${col}`);
            if (cell) {
                cell.innerHTML = value;
                if (checkArray.includes(value)) {
                    cell.classList.remove('text-black/70', 'bg-gray-300', 'lg:text-xl');
                    cell.classList.add('bg-[#db98e9]', 'text-black/90', 'md:text-lg', 'lg:text-3xl', 'call');
                }
            }
        }

        // All column arrays for checking called numbers
        const columnArrays = [cartB, cartI, cartN, cartG, cartO];

        // Populate the bingo grid
        for (let row = 1; row <= 5; row++) {
            for (let col = 1; col <= 5; col++) {
                if (row === 3 && col === 3) {
                    // Center cell (free space)
                    const cell = document.querySelector(`.a33`);
                    if (cell) {
                        cell.classList.add('bg-[#db98e9]', 'call');
                        cell.classList.remove('bg-gray-300');
                    }
                    continue;
                }
                
                // Convert to 0-index
                const rowIndex = row - 1;
                const colIndex = col - 1;
                
                // Data is [column][row] - column first, row second
                const value = cartelaData[colIndex][rowIndex];  // colIndex first!
                
                // Get check array for this column
                const checkArray = columnArrays[colIndex];
                
                updateCell(row, col, value, checkArray);
            }
        }

        // Check for special bonus (corners)
        const vavas = [
            document.querySelector('.a11'),
            document.querySelector('.a15'),
            document.querySelector('.a51'),
            document.querySelector('.a55')
        ];

        specialBonus = vavas.some(vava => {
            const cellValue = Number(vava.innerHTML);
            return cellValue === selectedNumber;
        });
        
        console.log(`Special bonus check: ${specialBonus} for selected number ${selectedNumber}`);
        
        // Check bingo win
        checkBingoWin();

        return {
            bonus: bonus,
            winnings: winnings
        };
    } catch (e) {
        console.error('Error in mainOne:', e);
        return { bonus: 0, winnings: 0 };
    }
}
///
// Function to save all cartela data to database
