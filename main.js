const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { readSettings, writeSettings } = require('./settingsStore');

// Parse command line arguments
// Windows screensavers pass arguments like /S, /P, /C
const args = process.argv.slice(1).map(arg => String(arg).trim().toLowerCase());
const isScreensaverMode = args.some(arg => arg.startsWith('/s'));
const isPreviewMode = args.some(arg => arg.startsWith('/p'));
const isConfigMode = args.some(arg => arg.startsWith('/c'));
const isWindowedMode = args.some(arg => arg === '--windowed' || arg.startsWith('/w'));
const isFullscreenMode = !isConfigMode && !isPreviewMode && !isWindowedMode;

// Prevent multiple screensaver instances (Windows can launch duplicates)
if (isScreensaverMode && !app.requestSingleInstanceLock()) {
  app.quit();
}

// Win32 message constants for screensaver exit detection
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

    // Only use polling as a fallback when native Win32 hooks aren't available.
    // When hooks are active they handle mouse movement detection directly.
    if (!(process.platform === 'win32' && typeof mainWindow.hookWindowMessage === 'function')) {
      cursorPollTimer = setInterval(handleMouseMove, CURSOR_POLL_INTERVAL_MS);
    }
  });

  mainWindow.on('closed', () => {
    if (cursorPollTimer) {
      clearInterval(cursorPollTimer);
      cursorPollTimer = null;
    }
  });

  // Layered exit detection: Win32 hooks are the primary mechanism (most reliable
  // for screensavers). The Electron before-input-event listener above acts as a
  // fallback for non-Windows platforms or when hookWindowMessage is unavailable.
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
      show: false,
      resizable: false,
      title: 'Clock Settings',
      backgroundColor: '#1a1a2e',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      },
      autoHideMenuBar: true
    });

    // Pass a query param to tell renderer to show settings UI
    configWindow.loadFile('index.html', { query: { 'mode': 'settings' } });
    configWindow.once('ready-to-show', () => configWindow.show());
    return;
  }

  if (isPreviewMode) {
    // Preview mode (/p:<hwnd>) — Windows passes a parent window handle for
    // rendering a mini-preview in the Screen Saver Settings dialog.
    // Reparenting an Electron BrowserWindow into an external HWND requires
    // native Win32 interop (SetParent) which Electron doesn't expose, so we
    // gracefully exit. This is the standard approach for Electron screensavers.
    app.quit();
    return;
  }

  const webPreferences = {
    nodeIntegration: false,
    contextIsolation: true,
    preload: path.join(__dirname, 'preload.js')
  };

  // Multi-monitor support: in screensaver/fullscreen mode, create a window
  // per display so secondary screens don't show the desktop.
  if (isFullscreenMode) {
    const displays = screen.getAllDisplays();

    displays.forEach((display, index) => {
      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
        show: false,
        fullscreen: true,
        frame: false,
        transparent: true,
        autoHideMenuBar: true,
        webPreferences
      });

      win.loadFile('index.html');
      win.once('ready-to-show', () => {
        win.show();
        win.focus();
      });

      forwardConsoleMessages(win);

      if (isScreensaverMode) {
        win.setAlwaysOnTop(true, 'screen-saver');
      }

      // Set up exit detection on every window so any input quits all
      setupScreensaverExit(win);
    });

    return;
  }

  // Windowed mode — single window
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    show: false,
    frame: true,
    autoHideMenuBar: true,
    webPreferences
  });

  mainWindow.loadFile('index.html', { query: { mode: 'windowed' } });
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  forwardConsoleMessages(mainWindow);
}

function forwardConsoleMessages(win) {
  const levels = ['debug', 'info', 'warn', 'error'];
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const method = levels[level] || 'log';
    console[method](`[Renderer] ${message} (${sourceId}:${line})`);
  });
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
