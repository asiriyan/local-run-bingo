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
function toYMD(dateInput) {
    // If it's already a bare "YYYY-MM-DD" string, return it as-is. Re-parsing
    // it through `new Date()` is NOT safe here: JS's Date constructor treats
    // a date-only ISO string as UTC midnight, while PHP's strtotime() treats
    // the same string as local midnight. Round-tripping it through
    // new Date() + local getters can silently shift the date back a day
    // depending on the server's timezone (e.g. any UTC-negative zone).
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        return dateInput;
    }
    // Anything else (a datetime string, a Date object, etc.) is safe to
    // parse normally — datetime strings without a timezone are parsed as
    // local time by JS, matching PHP's behavior.
    const d = new Date(dateInput);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

module.exports = { escapeHtml, formatWeekday, formatMonthDayYear, formatMonthCommaDayYear, todayYMD, toYMD };
