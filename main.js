const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Parse command line arguments
// Windows screensavers pass arguments like /S, /P, /C
const args = process.argv.slice(1);
const isScreensaverMode = args.some(arg => arg.toLowerCase().includes('/s'));
const isPreviewMode = args.some(arg => arg.toLowerCase().includes('/p'));
const isConfigMode = args.some(arg => arg.toLowerCase().includes('/c'));

const fs = require('fs');


// IPC Handlers - Register these globally
ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.on('save-settings', async (event, settings) => {
  // We can save to a JSON file in userData
  const configPath = path.join(app.getPath('userData'), 'config.json');
  try {
    await fs.promises.writeFile(configPath, JSON.stringify(settings, null, 2), 'utf8');
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
      return JSON.parse(data);
    }
  } catch (e) { console.error(e); }
  return { theme: 'dark' }; // default
});

function createWindow() {
  if (isConfigMode) {
    // Windows Screensaver Settings Mode (/c)
    // We open a small dialog-like window for settings
    const configWindow = new BrowserWindow({
      width: 850,
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
    fullscreen: isScreensaverMode || true, // Default to fullscreen for effect
    frame: false,
    transparent: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html');

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
