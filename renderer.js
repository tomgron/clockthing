let ipcRenderer;
try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
} catch (e) {
    // Browser mock for UI testing
    ipcRenderer = {
        invoke: () => Promise.resolve({}),
        send: () => { },
        on: () => { }
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
// Mouse move listener moved to init logic below



// Theme Logic
function setTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    // In normal mode we optimistically save to localstorage too
    localStorage.setItem('clock-theme', theme);
}

// Settings Page Logic
let currentSettingsTheme = 'dark';
let currentSettingsColor = '#22d3ee'; // Default teal
let currentSettingsDialColor = '#e0f2fe'; // Default glacier

const urlParams = new URLSearchParams(window.location.search);
const isSettingsMode = urlParams.get('mode') === 'settings';

if (isSettingsMode) {
    document.body.classList.add('settings-mode');
    ipcRenderer.invoke('get-settings').then(settings => {
        if (settings) {
            if (settings.theme) selectSettingsTheme(settings.theme);
            if (settings.color) selectSettingsColor(settings.color);
            if (settings.dialColor) selectDialColor(settings.dialColor);
        } else {
            // Defaults
            selectSettingsTheme('dark');
            selectSettingsColor(currentSettingsColor);
            selectDialColor(currentSettingsDialColor);
        }
    });
} else {
    // Normal Mode
    ipcRenderer.invoke('get-settings').then(settings => {
        let theme = 'dark';
        let color = '#cc2222';
        let dialColor = '#e0f2fe';

        if (settings) {
            if (settings.theme) theme = settings.theme;
            if (settings.color) color = settings.color;
            if (settings.dialColor) dialColor = settings.dialColor;
        } else {
            // Fallback to local storage or defaults
            theme = localStorage.getItem('clock-theme') || 'dark';
        }

        setTheme(theme);
        setAccentColor(color);
        setDialColor(dialColor);
    });
}

function selectSettingsTheme(theme) {
    currentSettingsTheme = theme;
    // Update UI
    document.querySelectorAll('.appearance-card').forEach(el => el.classList.remove('selected'));
    const card = document.getElementById(`card-${theme}`);
    if (card) card.classList.add('selected');

    // Show/hide dial color section based on theme
    // Dial color only matters for light mode
    const dialSection = document.getElementById('dial-color-section');
    if (dialSection) {
        dialSection.style.display = (theme === 'dark') ? 'none' : 'block';
    }

    // Show/hide lume color section based on theme
    // Lume color only matters for dark mode
    const lumeSection = document.getElementById('lume-color-section');
    if (lumeSection) {
        lumeSection.style.display = (theme === 'dark') ? 'block' : 'none';
    }
}

function selectSettingsColor(color) {
    currentSettingsColor = color;
    // Update UI
    document.querySelectorAll('.lume-swatch').forEach(el => {
        el.classList.remove('selected');
        el.style.boxShadow = 'none';
    });
    const swatch = document.getElementById(`color-${color}`);
    if (swatch) {
        swatch.classList.add('selected');
        swatch.style.boxShadow = `0 0 10px ${color}`;
    }
    setAccentColor(color);
}

function selectDialColor(color) {
    currentSettingsDialColor = color;
    // Update UI
    document.querySelectorAll('.dial-option').forEach(el => el.classList.remove('selected'));
    const option = document.getElementById(`dial-${color}`);
    if (option) {
        option.classList.add('selected');
    }
    setDialColor(color);
}

function resolveSystemTheme() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

function setTheme(theme) {
    let appliedTheme = theme;
    if (theme === 'system') {
        appliedTheme = resolveSystemTheme();
    }
    document.body.setAttribute('data-theme', appliedTheme);
    localStorage.setItem('clock-theme', theme);
}

function setAccentColor(color) {
    const rgb = hexToRgb(color);
    // Set global accent variables
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-rgb', rgb);

    // Also save to local storage for quick resume
    localStorage.setItem('clock-color', color);
}

function setDialColor(color) {
    const rgb = hexToRgb(color);
    // Set dial color variables (used in light mode)
    document.documentElement.style.setProperty('--dial-color', color);
    document.documentElement.style.setProperty('--dial-rgb', rgb);
    localStorage.setItem('clock-dial-color', color);
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

function saveSettings() {
    ipcRenderer.send('save-settings', {
        theme: currentSettingsTheme,
        color: currentSettingsColor,
        dialColor: currentSettingsDialColor
    });
}

// Expose to window for HTML access
window.setTheme = setTheme;
window.selectSettingsTheme = selectSettingsTheme;
window.saveSettings = saveSettings;
window.selectSettingsColor = selectSettingsColor;
window.selectDialColor = selectDialColor;

if (!isSettingsMode) {
    document.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 't') {
            const current = document.body.getAttribute('data-theme');
            setTheme(current === 'light' ? 'dark' : 'light');
            e.preventDefault();
            return;
        }
        ipcRenderer.send('quit-app');
    });

    document.addEventListener('mousedown', (e) => {
        if (e.target.closest('.theme-bar')) return;
        ipcRenderer.send('quit-app');
    });

    document.addEventListener('mousemove', (e) => {
        if (!initialMouse) {
            initialMouse = { x: e.screenX, y: e.screenY };
            return;
        }
        const dx = Math.abs(e.screenX - initialMouse.x);
        const dy = Math.abs(e.screenY - initialMouse.y);

        if (dx > MOUSE_THRESHOLD || dy > MOUSE_THRESHOLD) {
            ipcRenderer.send('quit-app');
        }
    });

    initFace();
    requestAnimationFrame(updateClock);
}
