const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { getConfigPath, readSettings, writeSettings } = require('./settingsStore');

// Parse command line arguments
// Windows screensavers pass arguments like /S, /P, /C
const args = process.argv.slice(1).map(arg => String(arg).trim().toLowerCase());
const isScreensaverMode = args.some(arg => arg.startsWith('/s'));
const isPreviewMode = args.some(arg => arg.startsWith('/p'));
const isConfigMode = args.some(arg => arg.startsWith('/c'));
const isWindowedMode = args.some(arg => arg === '--windowed' || arg.startsWith('/w'));
const isFullscreenMode = !isConfigMode && !isPreviewMode && !isWindowedMode;
const WM_MOUSEMOVE = 0x0200;
const WM_NCMOUSEMOVE = 0x00A0;
const WM_LBUTTONDOWN = 0x0201;
const WM_RBUTTONDOWN = 0x0204;
const WM_MBUTTONDOWN = 0x0207;
const WM_KEYDOWN = 0x0100;
const WM_SYSKEYDOWN = 0x0104;
const CURSOR_EXIT_THRESHOLD = 8;
const CURSOR_POLL_INTERVAL_MS = 100;
const INPUT_GRACE_PERIOD_MS = 500;

// IPC Handlers - Register these globally
ipcMain.on('quit-app', () => {
  app.quit();
});

ipcMain.handle('save-settings', async (event, settings) => {
  return writeSettings(app, settings);
});

ipcMain.handle('get-settings', async () => {
  return readSettings(app);
});

function setupScreensaverExit(mainWindow) {
  let initialCursorPoint = null;
  let cursorPollTimer = null;
  let inputArmed = false;

  const quitIfWindowAlive = () => {
    if (!mainWindow.isDestroyed()) {
      app.quit();
    }
  };

  const handleMouseMove = () => {
    const currentPoint = screen.getCursorScreenPoint();

    if (!initialCursorPoint) {
      initialCursorPoint = currentPoint;
      return;
    }

    const deltaX = Math.abs(currentPoint.x - initialCursorPoint.x);
    const deltaY = Math.abs(currentPoint.y - initialCursorPoint.y);

    if (inputArmed && (deltaX > CURSOR_EXIT_THRESHOLD || deltaY > CURSOR_EXIT_THRESHOLD)) {
      quitIfWindowAlive();
    }
  };

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (!inputArmed) {
      return;
    }

    if (input.type === 'keyDown' || input.type === 'mouseDown' || input.type === 'mouseWheel') {
      event.preventDefault();
      quitIfWindowAlive();
    }
  });

  mainWindow.once('ready-to-show', () => {
    initialCursorPoint = screen.getCursorScreenPoint();
    setTimeout(() => {
      inputArmed = true;
    }, INPUT_GRACE_PERIOD_MS);

    cursorPollTimer = setInterval(handleMouseMove, CURSOR_POLL_INTERVAL_MS);
  });

  mainWindow.on('closed', () => {
    if (cursorPollTimer) {
      clearInterval(cursorPollTimer);
      cursorPollTimer = null;
    }
  });

  if (process.platform === 'win32' && typeof mainWindow.hookWindowMessage === 'function') {
    mainWindow.hookWindowMessage(WM_MOUSEMOVE, handleMouseMove);
    mainWindow.hookWindowMessage(WM_NCMOUSEMOVE, handleMouseMove);
    mainWindow.hookWindowMessage(WM_LBUTTONDOWN, quitIfWindowAlive);
    mainWindow.hookWindowMessage(WM_RBUTTONDOWN, quitIfWindowAlive);
    mainWindow.hookWindowMessage(WM_MBUTTONDOWN, quitIfWindowAlive);
    mainWindow.hookWindowMessage(WM_KEYDOWN, quitIfWindowAlive);
    mainWindow.hookWindowMessage(WM_SYSKEYDOWN, quitIfWindowAlive);
  }
}

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
    width: isWindowedMode ? 1200 : 800,
    height: isWindowedMode ? 900 : 600,
    minWidth: isWindowedMode ? 900 : undefined,
    minHeight: isWindowedMode ? 650 : undefined,
    show: false,
    fullscreen: isFullscreenMode,
    frame: isWindowedMode,
    transparent: !isWindowedMode,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('index.html', {
    query: isWindowedMode ? { mode: 'windowed' } : {}
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (Line: ${line})`);
  });

  // If in screensaver mode, ensure it's always on top
  if (isScreensaverMode) {
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  }

  if (isFullscreenMode) {
    setupScreensaverExit(mainWindow);
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
