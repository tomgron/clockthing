const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
// Windows screensavers pass arguments like /S, /P, /C
const args = process.argv.slice(1).map(arg => String(arg).trim().toLowerCase());
const isScreensaverMode = args.some(arg => arg.startsWith('/s'));
const isPreviewMode = args.some(arg => arg.startsWith('/p'));
const isConfigMode = args.some(arg => arg.startsWith('/c'));

const ALLOWED_THEMES = new Set(['light', 'dark', 'system']);
const HEX_COLOR_REGEX = /^#[0-9a-f]{6}$/i;

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return { theme: 'dark', color: '#cc2222', dialColor: '#e0f2fe' };
  }

  const theme = ALLOWED_THEMES.has(settings.theme) ? settings.theme : 'dark';
  const color = HEX_COLOR_REGEX.test(settings.color) ? settings.color : '#cc2222';
  const dialColor = HEX_COLOR_REGEX.test(settings.dialColor) ? settings.dialColor : '#e0f2fe';

  return { theme, color, dialColor };
}


// IPC Handlers - Register these globally
ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.on('save-settings', async (event, settings) => {
  // We can save to a JSON file in userData
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    const normalized = sanitizeSettings(settings);
    await fs.promises.writeFile(configPath, JSON.stringify(normalized, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
  // Close window if it was the settings window
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

ipcMain.handle('get-settings', async () => {
  try {
    const configPath = path.join(app.getPath('userData'), 'config.json');
    if (fs.existsSync(configPath)) {
      const data = await fs.promises.readFile(configPath, 'utf8');
      const parsed = JSON.parse(data);
      return sanitizeSettings(parsed);
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return sanitizeSettings();
});

function createWindow() {
  if (isConfigMode) {
    // Windows Screensaver Settings Mode (/c)
    // We open a small dialog-like window for settings
    const configWindow = new BrowserWindow({
      width: 1160,
      height: 700,
      resizable: false,
      title: 'Clock Settings',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      autoHideMenuBar: true
    });

    // Pass a query param to tell renderer to show settings UI
    configWindow.loadFile('index.html', { query: { 'mode': 'settings' } });
    return;
  }

  if (isPreviewMode) {
    // Preview mode - for now we just quit as reparenting is complex
    app.quit();
    return;
  }

  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    fullscreen: true,
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (Line: ${line})`);
  });

  // If in screensaver mode, ensure it's always on top
  if (isScreensaverMode) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
