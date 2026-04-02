const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_THEMES = new Set(['light', 'dark', 'system']);
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

function sanitizeSettings(settings) {
    const safe = settings && typeof settings === 'object' ? settings : {};

    return {
        theme: ALLOWED_THEMES.has(safe.theme) ? safe.theme : 'dark',
        color: HEX_COLOR_REGEX.test(safe.color) ? safe.color : '#cc2222',
        dialColor: HEX_COLOR_REGEX.test(safe.dialColor) ? safe.dialColor : '#e0f2fe'
    };
}

contextBridge.exposeInMainWorld('api', {
    quitApp: () => ipcRenderer.send('quit-app'),
    saveSettings: (settings) => ipcRenderer.send('save-settings', sanitizeSettings(settings)),
    getSettings: () => ipcRenderer.invoke('get-settings')
});
