window.onerror = function(msg, url, line, col, error) {
   console.log("Renderer Error: " + msg + " at " + line + ":" + col);
};
window.addEventListener('unhandledrejection', function(event) {
   console.log("Unhandled Promise Rejection: " + event.reason);
});

// Default settings — single source of truth for fallback values.
// Full validation is handled by the main process (settingsStore.js / settingsValidation.js).
// IPC responses arrive already sanitized; these defaults are only for the browser mock.
const DEFAULT_SETTINGS = {
    theme: 'dark',
    color: '#cc2222',
    dialColor: '#e0f2fe'
};

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

// Cache DOM references outside the animation loop to avoid per-frame lookups
let cachedSecondHand = null;
let cachedMinuteHand = null;
let cachedHourHand = null;

function cacheHandElements() {
    cachedSecondHand = document.getElementById('second-hand');
    cachedMinuteHand = document.getElementById('minute-hand');
    cachedHourHand = document.getElementById('hour-hand');
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

    if (cachedSecondHand) cachedSecondHand.style.transform = `rotate(${secondDeg}deg)`;
    if (cachedMinuteHand) cachedMinuteHand.style.transform = `rotate(${minuteDeg}deg)`;
    if (cachedHourHand) cachedHourHand.style.transform = `rotate(${hourDeg}deg)`;

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

        num.style.transform = `translate(-50%, -50%) rotate(${deg}deg) translateY(-${r_minuteNum}) rotate(-${deg}deg)`;
        minNumsContainer.appendChild(num);
    }
}

// Settings Page Logic
let currentSettingsTheme = 'dark';
let currentSettingsColor = DEFAULT_SETTINGS.color;
let currentSettingsDialColor = DEFAULT_SETTINGS.dialColor;

const urlParams = new URLSearchParams(window.location.search);
const isSettingsMode = urlParams.get('mode') === 'settings';
const isWindowedMode = urlParams.get('mode') === 'windowed';

function applyDefaults() {
    setTheme(DEFAULT_SETTINGS.theme);
    setAccentColor(DEFAULT_SETTINGS.color);
    setDialColor(DEFAULT_SETTINGS.dialColor);
}

if (isSettingsMode) {
    document.body.classList.add('settings-mode');
    electronApi.getSettings().then(settings => {
        setTheme(settings.theme);
        setAccentColor(settings.color);
        setDialColor(settings.dialColor);
        selectSettingsTheme(settings.theme);
        selectSettingsColor(settings.color);
        selectDialColor(settings.dialColor);
    }).catch(err => {
        console.error('Failed to load settings:', err);
        applyDefaults();
    });
} else {
    // Normal / Windowed Mode
    electronApi.getSettings().then(settings => {
        setTheme(settings.theme);
        setAccentColor(settings.color);
        setDialColor(settings.dialColor);
    }).catch(err => {
        console.error('Failed to load settings:', err);
        applyDefaults();
    });
}

function selectSettingsTheme(theme) {
    currentSettingsTheme = theme || 'dark';
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
    currentSettingsColor = color || DEFAULT_SETTINGS.color;
    // Update UI
    document.querySelectorAll('.lume-option').forEach(el => el.classList.remove('selected'));
    
    const option = document.getElementById(`color-${currentSettingsColor}`);
    if (option) {
        option.classList.add('selected');
    }
    setAccentColor(currentSettingsColor);
}

function selectDialColor(color) {
    currentSettingsDialColor = color || DEFAULT_SETTINGS.dialColor;
    // Update UI
    document.querySelectorAll('.dial-option[data-dial-color]').forEach(el => el.classList.remove('selected'));
    const option = document.getElementById(`dial-${currentSettingsDialColor}`);
    if (option) {
        option.classList.add('selected');
    }
    setDialColor(currentSettingsDialColor);
}

function setTheme(theme) {
    document.body.setAttribute('data-theme', theme || 'dark');
}

function setAccentColor(color) {
    const safeColor = color || DEFAULT_SETTINGS.color;
    const rgb = hexToRgb(safeColor);
    document.documentElement.style.setProperty('--accent-color', safeColor);
    document.documentElement.style.setProperty('--accent-rgb', rgb);
}

function setDialColor(color) {
    const safeColor = color || DEFAULT_SETTINGS.dialColor;
    const rgb = hexToRgb(safeColor);
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
    try {
        const savedSettings = await electronApi.saveSettings({
            theme: currentSettingsTheme,
            color: currentSettingsColor,
            dialColor: currentSettingsDialColor
        });

        setTheme(savedSettings.theme);
        setAccentColor(savedSettings.color);
        setDialColor(savedSettings.dialColor);
        window.close();
    } catch (err) {
        console.error('Failed to save settings:', err);
    }
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
    cacheHandElements();
    initFace();
    requestAnimationFrame(updateClock);
}

// Wrap initialization in DOMContentLoaded for robustness
document.addEventListener('DOMContentLoaded', () => {
    if (isSettingsMode) {
        initSettingsInteractions();
    }

    if (!isSettingsMode) {
        startClockRendering();
    }

    if (isWindowedMode) {
        bindThemeToggleShortcut();
    }
});
