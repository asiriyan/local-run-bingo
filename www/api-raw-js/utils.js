// utils.js - shared helpers ported from PHP (date() / htmlspecialchars() equivalents)

function escapeHtml(str) {
    if (str === null || str === undefined) return str;
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Equivalent of PHP date("D", strtotime($ts))
function formatWeekday(ts) {
    const d = new Date(ts);
    return WEEKDAYS[d.getDay()];
}

// Equivalent of PHP date("M d Y", strtotime($ts))
function formatMonthDayYear(ts) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    return `${MONTHS[d.getMonth()]} ${day} ${d.getFullYear()}`;
}

// Equivalent of PHP date("M, d Y", strtotime($ts))
function formatMonthCommaDayYear(ts) {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    return `${MONTHS[d.getMonth()]}, ${day} ${d.getFullYear()}`;
}

// Equivalent of PHP date('Y-m-d')
function todayYMD() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

// Equivalent of PHP date('Y-m-d', strtotime($anyDateString))
// Uses local date components (not toISOString/UTC) to avoid shifting the
// date by a day near midnight in timezones behind/ahead of UTC.
function toYMD(dateInput) {
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

module.exports = { escapeHtml, formatWeekday, formatMonthDayYear, formatMonthCommaDayYear, todayYMD, toYMD };
