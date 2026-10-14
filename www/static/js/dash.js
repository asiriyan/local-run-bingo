/* ===================== SIDEBAR TOGGLE ===================== */
const showMenu = document.getElementById('menu-btn');
const menu = document.getElementById('menu');
const iface = document.getElementById('interface');
const backdrop = document.getElementById('backdrop');

showMenu.addEventListener('click', () => {
    if (menu.classList.contains('active')) {
        menu.classList.remove('active');
        iface.classList.add('activate');
        iface.classList.remove('button-event');
        backdrop.classList.remove('show');
    } else {
        menu.classList.add('active');
        iface.classList.add('button-event');
        iface.classList.remove('activate');
        backdrop.classList.add('show');
    }
});

backdrop.addEventListener('click', () => {
    menu.classList.remove('active');
    iface.classList.add('activate');
    iface.classList.remove('button-event');
    backdrop.classList.remove('show');
});

/* ===================== THEME TOGGLE ===================== */
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // Sun icon = "switch to light" is already active in dark mode; show the icon for what clicking will do next.
    themeIcon.className = theme === 'light' ? 'bx bxs-moon' : 'bx bxs-sun';
    try {
        localStorage.setItem('theme', theme);
    } catch (e) {}
}

(function initTheme() {
    let saved = null;
    try {
        saved = localStorage.getItem('theme');
    } catch (e) {}
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(saved || (systemPrefersLight ? 'light' : 'dark'));
})();

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
});

/* ===================== NOTIFICATION BANNER ===================== */
const noticeEl = document.getElementById('filter-notice');
const noticeText = document.getElementById('filter-notice-text');
const noticeClose = document.getElementById('filter-notice-close');

function showNotice(html) {
    noticeText.innerHTML = html;
    noticeEl.classList.remove('hidden');
}
function hideNotice() {
    noticeEl.classList.add('hidden');
}
noticeClose.addEventListener('click', hideNotice);

function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

/* ===================== STATUS BADGES (client-side render) ===================== */
function statusBadge(status) {
    const raw = (status ?? '').toString().trim();
    const needle = raw.toLowerCase();
    let tone = 'neutral';
    if (/(win|complete|done|paid)/.test(needle)) tone = 'good';
    else if (/(pend|progress|wait)/.test(needle)) tone = 'warn';
    else if (/(cancel|void|fail|wrong)/.test(needle)) tone = 'bad';
    return `<span class="badge badge--${tone}">${raw || '—'}</span>`;
}

/* ===================== STAT WIDGETS ===================== */
const showingEarning = document.getElementById('earned');
const games = document.getElementById('games');
const showdate = document.getElementById('game-day');
const net = document.getElementById('not');
const balan = document.getElementById('balance');

    async function displaylast() {
        try {
            const response = await fetch('/api/lastrow');
            const result = await response.json();
            if (result.success && result.data) {
                const row = result.data;
                games.innerHTML = row.game ?? 0;
                if (row.earn === '') row.earn = 0;
                showingEarning.innerHTML = row.earn;
                net.innerHTML = row.net;
            } else {
                showingEarning.innerHTML = 0;
                net.innerHTML = 0;
            }
        } catch (error) {
            console.error('fetch error', error);
        }
    }
displaylast();

const balance = document.getElementById('balance');
async function displayBalance() {
    try {
        const response = await fetch('/api/balance');
        const result = await response.json();
        if (result.success && result.data) {
            balance.innerHTML = result.data.balance.toFixed(2);
        }
    } catch (error) {
        console.error('balance fetch error', error);
    }
}
displayBalance();

/* ===================== DATE FILTER ===================== */
document.getElementById('filter-form').addEventListener('submit', function (event) {
    event.preventDefault();

    const selectedDate = document.getElementById('date').value;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/fetch_data', true);
    xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
    xhr.onload = function () {
        if (xhr.status === 200) {
            const data = JSON.parse(xhr.responseText);

            const tableHead = document.getElementById('data-head');
            tableHead.innerHTML = '';
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
              <th>Game</th>
              <th>Stake</th>
              <th>Players</th>
              <th>Calls</th>
              <th>Winner</th>
              <th>Bonus</th>
              <th>Free</th>
              <th>Status</th>
            `;
            tableHead.appendChild(headerRow);

            const tableBody = document.getElementById('data-table');
            tableBody.innerHTML = '';
            document.getElementById('toget').style.display = 'none';

            let hasRows = false;
            data.table.forEach(row => {
                if (row.calls === 'No Data is found') {
                    tableBody.innerHTML = `<td class="nodata">No data found for this date</td>`;
                    tableBody.classList.add('nodata');
                } else {
                    hasRows = true;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td data-cell="game">${row.game}</td>
                        <td data-cell='stake'>${row.stake}</td>
                        <td data-cell='player'>${row.player}</td>
                        <td data-cell='calls'>${row.calls}</td>
                        <td data-cell='winner'>${row.winner}</td>
                        <td data-cell='bonus'>${row.bonus}</td>
                        <td data-cell='free'>${row.free}</td>
                        <td data-cell='status'>${statusBadge(row.status)}</td>
                    `;
                    tableBody.appendChild(tr);
                }
            });

            const gamestatus = data.gamestatus;
            balan.innerHTML = gamestatus.remain ?? 0;
            games.innerHTML = gamestatus.game ?? 0;
            net.innerHTML = gamestatus.net ?? 0;
            showingEarning.innerHTML = gamestatus.earn ?? 0;
            showdate.innerHTML = gamestatus.time ?? 'DATE not on record';

            const dateLabel = formatDateLabel(selectedDate);
            if (hasRows) {
                showNotice(`Showing results for <b>${dateLabel}</b>`);
            } else {
                showNotice(`No games recorded for <b>${dateLabel}</b>`);
            }
        }
    };
    xhr.send('date=' + selectedDate);
});

/* ===================== CLOUD SYNC FUNCTION ===================== */
const syncBtn = document.getElementById('sync-cloud-btn');

if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
        // Change button state to loading
        syncBtn.disabled = true;
        const originalText = syncBtn.innerHTML;
        syncBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> Syncing...";
        
        try {
            // Call our local backend API to initiate the upload
            const response = await fetch('/api/sync-cloud', { method: 'POST' });
            const result = await response.json();

            if (response.ok && result.success) {
                alert(`✅ SUCCESS!\n\nDatabase synced to cloud successfully!\nAgent ID: ${result.agent_id}`);
            } else {
                alert(`❌ SYNC FAILED\n\n${result.message || 'Unknown server error.'}`);
            }
        } catch (error) {
            // This catches network errors (internet disconnected, local server down, cache errors)
            console.error('Sync network error:', error);
            alert("❌ NETWORK ERROR\n\nCannot reach the local server. Please check your internet connection or ensure the local application is running, then try again.");
        } finally {
            // Restore button state
            syncBtn.disabled = false;
            syncBtn.innerHTML = originalText;
        }
    });
}


// Load username and Cloud ID from session
// Load username and Cloud ID from session
async function loadUsername() {
    try {
        const response = await fetch('/api/session-check');
        
        if (!response.ok) {
            console.error('Session check failed:', response.status);
            return;
        }
        
        const result = await response.json();
        
        // Log what the browser actually received
        console.log("Frontend received cloud_id:", result.cloud_id);
        
        const cloudIdEl = document.getElementById('cloud-id-display');
        if (cloudIdEl) {
            if (result.cloud_id) {
                cloudIdEl.textContent = result.cloud_id;
            } else {
                cloudIdEl.textContent = 'N/A';
            }
        } else {
            console.error("Could not find the 'cloud-id-display' element in the HTML!");
        }

    } catch (error) {
        console.error('Failed to load session data:', error);
    }
}

// MAKE SURE THIS LINE IS AT THE VERY BOTTOM!


/* ===================== MONTHLY / DAILY TOGGLE ===================== */
const filterBtn = document.getElementById('month');
const dailyBtn = document.getElementById('daily-data');

function setActiveToggle(activeBtn) {
    [filterBtn, dailyBtn].forEach(btn => btn.classList.remove('is-on'));
    activeBtn.classList.add('is-on');
}

dailyBtn.addEventListener('click', () => {
    setActiveToggle(dailyBtn);
    previoustable();
});
filterBtn.addEventListener('click', () => {
    setActiveToggle(filterBtn);
    altertable();
});

async function altertable() {
    try {
        const response = await fetch('/api/fetch_content');
        const result = await response.json();

        if (result.success && result.data) {
            const data = result.data;

            document.getElementById('toget').style.display = 'none';

            const tableBody = document.getElementById('data-table');
            tableBody.innerHTML = '';
            tableBody.classList.remove('nodata');

            const tableHead = document.getElementById('data-head');
            tableHead.innerHTML = '';

            const title = document.getElementById('game-day');
            title.innerHTML = 'Monthly Status';

            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
                <th>No</th>
                <th>Games</th>
                <th>Earn</th>
                <th>Net</th>
                <th>Topup-balance</th>
                <th>Remain-bal</th>
                <th>Time</th>
            `;
            tableHead.appendChild(headerRow);

            data.forEach(row => {
                const rowed = row.balance === '0.00' ? '0.00' : `+ ${row.balance}`;
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td data-cell='No'>${row.No}</td>
                    <td data-cell='games'>${row.game}</td>
                    <td data-cell='earns'>${row.earn}</td>
                    <td data-cell='net'>${row.net}</td>
                    <td data-cell='topup-balance'>${rowed}</td>
                    <td data-cell='time'>${row.remain}</td>
                    <td data-cell='time'>${row.time}</td>
                `;
                tableBody.appendChild(newRow);
            });

            showNotice(`Showing <b>monthly summary</b> · ${data.length} record${data.length === 1 ? '' : 's'}`);
        } else {
            console.log('No data received');
        }
    } catch (error) {
        console.error('Error fetching or updating table:', error);
    }
}

async function previoustable() {
    try {
        const response = await fetch('/api/fetch_back');
        if (!response.ok) {
            console.error('Fetch failed with status:', response.status);
            return;
        }

        const result = await response.json();
        const tableBody = document.getElementById('data-table');

        if (result.success && result.data) {
            const data = result.data;

            document.getElementById('toget').style.display = 'none';
            tableBody.innerHTML = '';
            tableBody.classList.remove('nodata');

            const tableHead = document.getElementById('data-head');
            tableHead.innerHTML = '';

            const title = document.getElementById('game-day');
            title.innerHTML = "TODAY'S GAMES";

            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
              <th>Game</th>
              <th>Stake</th>
              <th>Players</th>
              <th>Calls</th>
              <th>Winner</th>
              <th>Bonus</th>
              <th>Free</th>
              <th>Status</th>
            `;
            tableHead.appendChild(headerRow);

            data.forEach(row => {
                const newRow = document.createElement('tr');
                newRow.innerHTML = `
                    <td data-cell="game">${row.game}</td>
                    <td data-cell="stake">${row.stake}</td>
                    <td data-cell="player">${row.player}</td>
                    <td data-cell="calls">${row.calls}</td>
                    <td data-cell="winner">${row.winner}</td>
                    <td data-cell="bonus">${row.bonus}</td>
                    <td data-cell="free">${row.free}</td>
                    <td data-cell="status">${statusBadge(row.status)}</td>
                `;
                tableBody.appendChild(newRow);
            });

            hideNotice();
        } else {
            console.log('No data is received or success is false.');
            tableBody.innerHTML = `<td class="nodata">No result found</td>`;
            tableBody.classList.add('nodata');
        }
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}
previoustable();

/* ===================== LAST N DAYS FILTER ===================== */
function customadd() {
    const inputvalue = document.getElementById('inputvalue').value;
    const finalvalue = document.getElementById('finalvalue').value;
    const warn = document.getElementById('warn');

    if (finalvalue < inputvalue) {
        warn.innerHTML = 'Invalid input: the final day must be greater than the initial day.';
        setTimeout(function () {
            warn.innerHTML = '';
        }, 3000);
        return;
    }

    if (!inputvalue || !finalvalue) {
        warn.innerHTML = 'Please fill in both day fields.';
        setTimeout(function () {
            warn.innerHTML = '';
        }, 3000);
        return;
    }

    fetch('/api/basedinput', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputvalue, finalvalue }),
    })
        .then(response => response.json())
        .then(data => {
            last(data);
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

async function last(result) {
    if (result) {
        document.getElementById('toget').style.display = 'flex';

        const totalEarn = document.getElementById('birr');
        const totalGame = document.getElementById('fun');
        const net = document.getElementById('nett');
        const bal = document.getElementById('bal');

        totalEarn.innerHTML = result.data.total.resultearn;
        net.innerHTML = result.data.total.resultnet;
        bal.innerHTML = result.data.total.resultbal;
        totalGame.innerHTML = result.data.total.resultgames;

        const data = result.data.table;
        const tableBody = document.getElementById('data-table');
        tableBody.innerHTML = '';
        tableBody.classList.remove('nodata');

        const tableHead = document.getElementById('data-head');
        tableHead.innerHTML = '';

        const title = document.getElementById('game-day');
        title.innerHTML = `${result.data.total.number} days earnings`;

        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th>No</th>
            <th>Games</th>
            <th>Earn</th>
            <th>Net</th>
            <th>Topup-balance</th>
            <th>Time</th>
        `;
        tableHead.appendChild(headerRow);

        data.forEach(row => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
                <td data-cell='No'>${row.No}</td>
                <td data-cell='games'>${row.game}</td>
                <td data-cell='earns'>${row.earn}</td>
                <td data-cell='net'>${row.net}</td>
                <td data-cell='topup-balance'>${row.balance}</td>
                <td data-cell='time'>${row.time}</td>
            `;
            tableBody.appendChild(newRow);
        });

        showNotice(`Showing earnings from day <b>${result.data.total.number}</b> range · ${data.length} record${data.length === 1 ? '' : 's'}`);
    } else {
        console.log('No data received');
    }
}

const lastOne = document.getElementById('filterlast');
lastOne.addEventListener('click', () => {
    customadd();
});

/* ===================== BALANCE UPDATE FORM ===================== */
$('#verify-form').submit(function (e) {
    e.preventDefault();

    const formData = $(this).serialize();
    const inputed = $('input[name="inputed"]').val();
    const id = $('input[name="id"]').val();

    if (inputed === '' || id === '') {
        $('#error-message').show();
        $('#success-message').hide();
        return false;
    }

    $.ajax({
        type: 'POST',
        url: '/api/verify',
        data: formData,
        success: function (response) {
            if (response === 'success') {
                $('#success-message').show();
                $('#error-message').hide();
            } else {
                $('#error-message').show();
                $('#success-message').hide();
            }
            setTimeout(function () {
                location.reload();
            }, 2000);
        },
        error: function () {
            $('#error-message').show();
            $('#success-message').hide();
            setTimeout(function () {
                location.reload();
            }, 2000);
        },
    });
});

/* ===================== BONUS ENGINE PANEL ===================== */
// Declarative field list — drives both rendering and the save payload, so adding a
// new bonus later only means adding one entry here (schema stays in bonus_schema.sql).
const BONUS_FIELDS = [
    {
        key: 'four_call', label: '4-Call Bonus', icon: 'bx-bolt',
        desc: 'Pays out when a bingo is claimed within the first 4 calls.',
        enabled: 'four_call_bonus_enabled',
        inputs: [{ field: 'four_call_bonus_amount', label: 'Amount (birr)', placeholder: '0' }]
    },
    {
        key: 'eight_call', label: '8-Call Bonus', icon: 'bx-bolt-circle',
        desc: 'Pays out when a bingo is claimed within the first 8 calls.',
        enabled: 'eight_call_bonus_enabled',
        inputs: [{ field: 'eight_call_bonus_amount', label: 'Amount (birr)', placeholder: '0' }]
    },
    {
        key: 'edge_diagonal', label: 'Edge + Diagonal Bonus', icon: 'bx-shape-triangle',
        desc: 'A corner call that completes an edge pattern and a diagonal at the same time.',
        enabled: 'edge_diagonal_bonus_enabled',
        inputs: [{ field: 'edge_diagonal_bonus_amount', label: 'Amount (birr)', placeholder: '0' }]
    },
    {
        key: 'row_column', label: 'Row + Column Bonus', icon: 'bx-grid-alt',
        desc: 'The just-called number completes a row and a column at the same intersection.',
        enabled: 'row_column_bonus_enabled',
        inputs: [{ field: 'row_column_bonus_amount', label: 'Amount (birr)', placeholder: '0' }]
    },
    {
        key: 'free_bingo', label: 'Free Bingo', icon: 'bx-gift',
        desc: 'Auto-win if zero of the cartela\u2019s numbers are called within the call threshold.',
        enabled: 'free_bingo_enabled',
        inputs: [
            { field: 'free_bingo_amount', label: 'Amount (birr)', placeholder: '0' },
            { field: 'free_bingo_call_threshold', label: 'Call threshold', placeholder: '15' }
        ]
    },
    {
        key: 'happy_hour', label: 'Happy Hour', icon: 'bx-party',
        desc: 'Random bonus rolled on every ball call while active.',
        enabled: 'happy_hour_enabled',
        inputs: [
            { field: 'happy_hour_min_amount', label: 'Min (birr)', placeholder: '0' },
            { field: 'happy_hour_max_amount', label: 'Max (birr)', placeholder: '0' },
            { field: 'happy_hour_probability', label: 'Chance % / call', placeholder: '5', percent: true },
            { field: 'happy_hour_start_time', label: 'Start time', type: 'time' },
            { field: 'happy_hour_end_time', label: 'End time', type: 'time' }
        ]
    },

    // ── Pattern toggles (ON/OFF only, no bonus amount) ──
    {
        key: 'inner_edges',
        label: 'Inner Edges (Diamond)',
        icon: 'bx-diamond',
        desc: 'The 4 cells surrounding the center star count as a winning pattern.',
        enabled: 'inner_edges_enabled',
        inputs: []
    },
    {
        key: 'inner_cross',
        label: 'Inner Cross (Small Plus)',
        icon: 'bx-plus-medical',
        desc: 'The 4 cells directly adjacent to the center star (up/down/left/right) count as a winning pattern.',
        enabled: 'inner_cross_enabled',
        inputs: []
    },
    {
        key: 'outer_cross',
        label: 'Outer Cross (Big Plus)',
        icon: 'bx-cross',
        desc: 'The full middle row + middle column (8 cells around center star) count as a winning pattern.',
        enabled: 'outer_cross_enabled',
        inputs: []
    }
];
let bonusSettingsData = {};

function renderBonusList() {
    const host = document.getElementById('bonus-settings-list');
    if (!host) return;
    host.innerHTML = '';

    BONUS_FIELDS.forEach(cfg => {
        const isOn = !!Number(bonusSettingsData[cfg.enabled] ?? 0);
        const hasFields = cfg.inputs.length > 0;

        const row = document.createElement('div');
        row.className = 'bonus-row' + (hasFields ? '' : ' no-fields');
        row.dataset.bonusKey = cfg.key;

        const head = document.createElement('div');
        head.className = 'bonus-row-head';
        head.innerHTML = `
            <button type="button" class="alter bonus-toggle${isOn ? ' is-on' : ''}" data-field="${cfg.enabled}">${isOn ? 'ON' : 'OFF'}</button>
            <div class="bonus-row-title"><b><i class='bx ${cfg.icon}'></i> ${cfg.label}</b><small>${cfg.desc}</small></div>
            ${hasFields ? `<i class='bx bx-chevron-down'></i>` : ''}
        `;
        row.appendChild(head);

        const fields = document.createElement('div');
        fields.className = 'bonus-fields';
        cfg.inputs.forEach(inp => {
            const wrap = document.createElement('div');
            wrap.className = 'bonus-field';
            let value = bonusSettingsData[inp.field];
            if (inp.percent) value = value !== undefined && value !== null ? (Number(value) * 100) : '';
            const type = inp.type || 'number';
            wrap.innerHTML = `
                <label>${inp.label}</label>
                <input type="${type}" class="InputContainer" data-field="${inp.field}" ${inp.percent ? 'data-percent="true"' : ''}
                    placeholder="${inp.placeholder || ''}" value="${value !== undefined && value !== null ? value : ''}"
                    ${type === 'number' ? 'step="0.01" min="0"' : ''}>
            `;
            fields.appendChild(wrap);
        });
        row.appendChild(fields);
        host.appendChild(row);

        // On mobile, tapping the row head expands/collapses its fields + description.
        // Above the 640px breakpoint the CSS shows everything inline regardless of this class.
        if (hasFields) {
            head.addEventListener('click', (e) => {
                if (e.target.closest('.bonus-toggle')) return; // don't expand when just flipping the toggle
                row.classList.toggle('is-expanded');
            });
        }
    });

    // Toggle click handlers
    host.querySelectorAll('.bonus-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const nowOn = !btn.classList.contains('is-on');
            btn.classList.toggle('is-on', nowOn);
            btn.textContent = nowOn ? 'ON' : 'OFF';
        });
    });
}

async function loadBonusSettings() {
    try {
        const response = await fetch('/api/get-bonus-settings', { headers: { 'Accept': 'application/json' } });
        const result = await response.json();
        if (result.success && result.settings) {
            bonusSettingsData = result.settings;
        }
    } catch (error) {
        console.error('bonus settings fetch error', error);
    }
    const commissionSelect = document.getElementById('commission-rate');
    if (commissionSelect && bonusSettingsData.commission_rate !== undefined) {
        commissionSelect.value = Number(bonusSettingsData.commission_rate).toFixed(2);
    }
    renderBonusList();
}
loadBonusSettings();

function collectBonusPayload() {
    const host = document.getElementById('bonus-settings-list');
    const payload = {};

    const commissionSelect = document.getElementById('commission-rate');
    if (commissionSelect) payload.commission_rate = Number(commissionSelect.value);

    host.querySelectorAll('.bonus-toggle').forEach(btn => {
        payload[btn.dataset.field] = btn.classList.contains('is-on') ? 1 : 0;
    });
    host.querySelectorAll('input[data-field]').forEach(input => {
        let val = input.value === '' ? 0 : Number(input.value);
        if (input.dataset.percent === 'true') val = val / 100; // store as 0..1
        payload[input.dataset.field] = input.type === 'time' ? input.value : val;
    });
    return payload;
}

const saveBonusBtn = document.getElementById('save-bonus-settings');
const bonusSaveStatus = document.getElementById('bonus-save-status');

saveBonusBtn.addEventListener('click', async () => {
    const payload = collectBonusPayload();
    saveBonusBtn.disabled = true;
    saveBonusBtn.textContent = 'Saving…';
    try {
        const response = await fetch('/api/get-bonus-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        bonusSaveStatus.classList.remove('err');
        bonusSaveStatus.textContent = result.success ? 'Saved ✓' : (result.error || 'Save failed');
        if (!result.success) bonusSaveStatus.classList.add('err');
    } catch (error) {
        bonusSaveStatus.classList.add('err');
        bonusSaveStatus.textContent = 'Save failed';
        console.error('bonus save error', error);
    }
    bonusSaveStatus.classList.add('show');
    setTimeout(() => bonusSaveStatus.classList.remove('show'), 2500);
    saveBonusBtn.disabled = false;
    saveBonusBtn.textContent = 'Save Bonus Settings';
});

loadUsername();