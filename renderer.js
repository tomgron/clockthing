window.onerror = function(msg, url, line, col, error) {
   console.log("Renderer Error: " + msg + " at " + line + ":" + col);
};
window.addEventListener('unhandledrejection', function(event) {
   console.log("Unhandled Promise Rejection: " + event.reason);
});

const ALLOWED_THEMES = new Set(['light', 'dark']);
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;
const DEFAULT_SETTINGS = {
    theme: 'dark',
    color: '#cc2222',
    dialColor: '#e0f2fe'
};

function normalizeTheme(theme) {
    return ALLOWED_THEMES.has(theme) ? theme : 'dark';
}

function normalizeColor(color, fallback) {
    return HEX_COLOR_REGEX.test(color) ? color : fallback;
}

function normalizeSettings(settings) {
    const safe = settings && typeof settings === 'object' ? settings : {};

    return {
        theme: normalizeTheme(safe.theme),
        color: normalizeColor(safe.color, '#cc2222'),
        dialColor: normalizeColor(safe.dialColor, '#e0f2fe')
    };
}

function getEffectiveSettings(rawSettings) {
    return normalizeSettings(rawSettings || DEFAULT_SETTINGS);
}

let electronApi;
if (window.api) {
    electronApi = window.api;
} else {
    console.error('Electron preload bridge is unavailable; settings persistence and IPC are disabled.');
    // Browser mock for UI testing
    electronApi = {
        getSettings: () => Promise.resolve(DEFAULT_SETTINGS),
        saveSettings: () => Promise.resolve(DEFAULT_SETTINGS),
        quitApp: () => { }
    };
}

function updateClock() {
    const now = new Date();
    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();
    const milliseconds = now.getMilliseconds();

    // Smooth movement
    const secondDeg = ((seconds + milliseconds / 1000) / 60) * 360;
    const minuteDeg = ((minutes + seconds / 60) / 60) * 360;
    const hourDeg = (((hours % 12) + minutes / 60) / 12) * 360;

    const secondHand = document.getElementById('second-hand');
    const minuteHand = document.getElementById('minute-hand');
    const hourHand = document.getElementById('hour-hand');

    if (secondHand) secondHand.style.transform = `rotate(${secondDeg}deg)`;
    if (minuteHand) minuteHand.style.transform = `rotate(${minuteDeg}deg)`;
    if (hourHand) hourHand.style.transform = `rotate(${hourDeg}deg)`;

    requestAnimationFrame(updateClock);
}

function initFace() {
    const ticksContainer = document.getElementById('ticks-container');
    const hourNumsContainer = document.getElementById('hour-numbers-container');
    const minNumsContainer = document.getElementById('minute-numbers-container');

    // Use vmin for radii relative to the container which is 90vmin
    // If container is 90vmin, "radius" is 45vmin.
    // Let's set items relative to that 45vmin.

    // R_minuteNum: The outermost ring. 
    // In CSS we said numbers are centered. 
    // Let's push them out to ~42vmin
    // R_minuteNum: The outermost ring. 
    // User wants "second numbers" (these minute markers) moved INWARDS (closer to ticks).
    // Previous was 42vmin. Ticks end around 38.25vmin.
    const r_minuteNum = '40vmin';

    // Ticks center at 36vmin. Major ticks are 4.5vmin long (extending roughly 33.75 to 38.25).
    const r_tick_start = '36vmin';

    // Hour numbers are inside the ticks.
    // User wants these moved OUTWARDS (closer to ticks).
    // Previous was 26vmin. Ticks start around 33.75vmin. 
    // Moving to 30vmin will bring them much closer.
    const r_hourNum = '30vmin';

    // Generate Ticks
    for (let i = 0; i < 60; i++) {
        const isMajor = i % 5 === 0;
        const tick = document.createElement('div');
        tick.classList.add('marker');
        tick.classList.add(isMajor ? 'tick-major' : 'tick-minor');

        const deg = i * 6;
        // Position ticks
        // We push them out to r_tick_start
        // rotate(deg) translate(0, -r)
        tick.style.transform = `translate(-50%, -50%) rotate(${deg}deg) translateY(-${r_tick_start})`;
        ticksContainer.appendChild(tick);
    }

    // Generate Hour Numbers (12, 1, 2...)
    for (let i = 1; i <= 12; i++) {
        const num = document.createElement('div');
        num.classList.add('number', 'hour-number');
        num.innerText = i;

        const deg = i * 30; // 360 / 12 = 30

        // Use counter-rotation to keep numbers upright (readable horizontally)
        num.style.transform = `translate(-50%, -50%) rotate(${deg}deg) translateY(-${r_hourNum}) rotate(-${deg}deg)`;

        hourNumsContainer.appendChild(num);
    }

    // Generate Minute Numbers (05, 10, ... 60)
    for (let i = 1; i <= 12; i++) {
        const val = i * 5;
        const displayVal = val < 10 ? `0${val}` : val; // Padding

        const num = document.createElement('div');
        num.classList.add('number', 'minute-number');
        num.innerText = displayVal; // display "60" instead of "00"? Logic check below.

        // Wait, normally top is 60 or 00. Image says "60".
        // i=12 -> 60.

        const deg = i * 30;

        num.style.transform = `translate(-50%, -50%) rotate(${deg}deg) translateY(-${r_minuteNum})`;
        minNumsContainer.appendChild(num);
    }
}

// Interaction Handler
let initialMouse = null;
const MOUSE_THRESHOLD = 10;
const launchTime = Date.now();
// Mouse move listener moved to init logic below



// Settings Page Logic
let currentSettingsTheme = 'dark';
let currentSettingsColor = DEFAULT_SETTINGS.color;
let currentSettingsDialColor = '#e0f2fe'; // Default glacier

const urlParams = new URLSearchParams(window.location.search);
const isSettingsMode = urlParams.get('mode') === 'settings';
const isWindowedMode = urlParams.get('mode') === 'windowed';

if (isSettingsMode) {
    document.body.classList.add('settings-mode');
    electronApi.getSettings().then(rawSettings => {
        const settings = getEffectiveSettings(rawSettings);
        setTheme(settings.theme, false);
        setAccentColor(settings.color, false);
        setDialColor(settings.dialColor, false);
        selectSettingsTheme(settings.theme);
        selectSettingsColor(settings.color);
        selectDialColor(settings.dialColor);
    });
} else {
    // Normal Mode
    electronApi.getSettings().then(rawSettings => {
        const settings = getEffectiveSettings(rawSettings);

        setTheme(settings.theme);
        setAccentColor(settings.color);
        setDialColor(settings.dialColor);
    });
}

function selectSettingsTheme(theme) {
    currentSettingsTheme = normalizeTheme(theme);
    // Update UI
    document.querySelectorAll('.appearance-card').forEach(el => el.classList.remove('selected'));
    const card = document.getElementById(`card-${currentSettingsTheme}`);
    if (card) card.classList.add('selected');

    // Show/hide dial color section based on theme
    // Dial color only matters for light mode
    const dialSection = document.getElementById('dial-color-section');
    if (dialSection) {
        dialSection.style.display = (currentSettingsTheme === 'dark') ? 'none' : 'block';
    }

    // Show/hide lume color section based on theme
    // Lume color only matters for dark mode
    const lumeSection = document.getElementById('lume-color-section');
    if (lumeSection) {
        lumeSection.style.display = (currentSettingsTheme === 'dark') ? 'block' : 'none';
    }
}

function selectSettingsColor(color) {
    currentSettingsColor = normalizeColor(color, '#cc2222');
    // Update UI
    document.querySelectorAll('.lume-option').forEach(el => el.classList.remove('selected'));
    
    const option = document.getElementById(`color-${currentSettingsColor}`);
    if (option) {
        option.classList.add('selected');
    }
    setAccentColor(currentSettingsColor, false);
}

function selectDialColor(color) {
    currentSettingsDialColor = normalizeColor(color, '#e0f2fe');
    // Update UI
    document.querySelectorAll('.dial-option[data-dial-color]').forEach(el => el.classList.remove('selected'));
    const option = document.getElementById(`dial-${currentSettingsDialColor}`);
    if (option) {
        option.classList.add('selected');
    }
    setDialColor(currentSettingsDialColor, false);
}

function setTheme(theme, persist = true) {
    const normalizedTheme = normalizeTheme(theme);
    document.body.setAttribute('data-theme', normalizedTheme);
}

function setAccentColor(color, persist = true) {
    const safeColor = normalizeColor(color, '#cc2222');
    const rgb = hexToRgb(safeColor);
    // Set global accent variables
    document.documentElement.style.setProperty('--accent-color', safeColor);
    document.documentElement.style.setProperty('--accent-rgb', rgb);
}

function setDialColor(color, persist = true) {
    const safeColor = normalizeColor(color, '#e0f2fe');
    const rgb = hexToRgb(safeColor);
    // Set dial color variables (used in light mode)
    document.documentElement.style.setProperty('--dial-color', safeColor);
    document.documentElement.style.setProperty('--dial-rgb', rgb);
}

// Helper to convert hex to rgb for rgba usage
function hexToRgb(hex) {
    // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
    var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (m, r, g, b) {
        return r + r + g + g + b + b;
    });

    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ?
        `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
        : '239, 68, 68'; // default red fallback
}

async function saveSettings() {
    const savedSettings = await electronApi.saveSettings({
        theme: currentSettingsTheme,
        color: currentSettingsColor,
        dialColor: currentSettingsDialColor
    });

    const settings = getEffectiveSettings(savedSettings);
    setTheme(settings.theme, true);
    setAccentColor(settings.color, true);
    setDialColor(settings.dialColor, true);

    window.close();
}

function initSettingsInteractions() {
    document.querySelectorAll('.appearance-card[data-theme]').forEach((card) => {
        card.addEventListener('click', () => {
            selectSettingsTheme(card.dataset.theme);
        });
    });

    document.querySelectorAll('.dial-option[data-dial-color]').forEach((option) => {
        option.addEventListener('click', () => {
            selectDialColor(option.dataset.dialColor);
        });
    });

    document.querySelectorAll('.lume-option[data-lume-color]').forEach((option) => {
        option.addEventListener('click', () => {
            selectSettingsColor(option.dataset.lumeColor);
        });
    });

    const cancelButton = document.getElementById('settings-cancel');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => window.close());
    }

    const okButton = document.getElementById('settings-ok');
    if (okButton) {
        okButton.addEventListener('click', saveSettings);
    }
}

function bindThemeToggleShortcut() {
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() !== 't') return;

        const current = document.body.getAttribute('data-theme');
        setTheme(current === 'light' ? 'dark' : 'light');
        e.preventDefault();
    });
}

function startClockRendering() {
    initFace();
    requestAnimationFrame(updateClock);
}

if (isSettingsMode) {
    initSettingsInteractions();
}

if (!isSettingsMode && !isWindowedMode) {
    startClockRendering();
}

if (isWindowedMode) {
    bindThemeToggleShortcut();
    startClockRendering();
}
