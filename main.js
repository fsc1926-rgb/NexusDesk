const { app, BrowserWindow, ipcMain, desktopCapturer, screen, clipboard, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let inputHelper = null;

function getInputHelperPath() {
  const candidatePaths = [
    path.join(__dirname, 'NexusInput.exe'),
    path.join(process.resourcesPath || '', 'NexusInput.exe'),
    path.join(__dirname, '..', 'NexusInput.exe')
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function startHardwareController() {
  if (process.platform !== 'win32') return;
  if (inputHelper && !inputHelper.killed) return;

  const helperPath = getInputHelperPath();
  if (!helperPath) {
    console.warn('NexusInput.exe non trovato in:', helperPath);
    return;
  }

  try {
    inputHelper = spawn(helperPath, [], {
      stdio: ['pipe', 'ignore', 'ignore'],
      windowsHide: true
    });

    inputHelper.on('error', (err) => {
      console.error('Errore input helper:', err);
      inputHelper = null;
    });

    inputHelper.on('exit', () => {
      inputHelper = null;
    });
  } catch (err) {
    console.error('Impossibile avviare NexusInput.exe:', err);
    inputHelper = null;
  }
}

function sendHardwareCommand(cmd) {
  if (!inputHelper) startHardwareController();
  if (inputHelper && inputHelper.stdin && inputHelper.stdin.writable) {
    try {
      inputHelper.stdin.write(cmd + '\n');
    } catch (e) {
      inputHelper = null;
    }
  }
}

function mapKeyToSendKeys(data) {
  const { key, ctrlKey, altKey, shiftKey } = data;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(key)) return null;

  const specialMap = {
    'Enter': '{ENTER}', 'Backspace': '{BS}', 'Tab': '{TAB}', 'Escape': '{ESC}',
    'Delete': '{DEL}', 'Insert': '{INS}', 'ArrowUp': '{UP}', 'ArrowDown': '{DOWN}',
    'ArrowLeft': '{LEFT}', 'ArrowRight': '{RIGHT}', 'Home': '{HOME}', 'End': '{END}',
    'PageUp': '{PGUP}', 'PageDown': '{PGDN}', ' ': ' ',
    'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}', 'F5': '{F5}', 'F6': '{F6}',
    'F7': '{F7}', 'F8': '{F8}', 'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}'
  };

  let baseKey = specialMap[key] || null;

  if (!baseKey && key && key.length === 1) {
    if (['+', '^', '%', '~', '(', ')', '{', '}', '[', ']'].includes(key)) {
      baseKey = `{${key}}`;
    } else {
      baseKey = (ctrlKey || altKey) ? key.toLowerCase() : key;
    }
  }

  if (!baseKey) return null;

  let prefix = '';
  if (ctrlKey) prefix += '^';
  if (altKey) prefix += '%';
  if (shiftKey && (ctrlKey || altKey || specialMap[key])) prefix += '+';

  return prefix + baseKey;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150, height: 740, minWidth: 900, minHeight: 600,
    backgroundColor: '#1e1e1e', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
}

// Configura la gestione di getDisplayMedia per la condivisione dello schermo
function setupDisplayMediaHandler() {
  if (session && session.defaultSession && session.defaultSession.setDisplayMediaRequestHandler) {
    session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        if (sources && sources.length > 0) {
          callback({ video: sources[0] });
        } else {
          callback({});
        }
      } catch (err) {
        console.error('Errore getDisplayMedia:', err);
        callback({});
      }
    });
  }
}

ipcMain.handle('get-primary-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    return sources[0] ? sources[0].id : null;
  } catch (err) {
    console.error('Errore get-primary-screen:', err);
    return null;
  }
});

ipcMain.on('write-clipboard', (event, text) => { clipboard.writeText(text || ''); });
ipcMain.handle('read-clipboard', () => { return clipboard.readText(); });

ipcMain.on('execute-native-input', (event, data) => {
  if (process.platform !== 'win32') return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor || 1;

  const realWidth = Math.round(width * scaleFactor);
  const realHeight = Math.round(height * scaleFactor);

  if (typeof data.x === 'number' && typeof data.y === 'number') {
    const targetX = Math.max(0, Math.min(realWidth - 1, Math.round(data.x * realWidth)));
    const targetY = Math.max(0, Math.min(realHeight - 1, Math.round(data.y * realHeight)));

    if (data.action === 'move') {
      sendHardwareCommand(`M ${targetX} ${targetY}`);
    } else if (data.action === 'mousedown') {
      sendHardwareCommand(`MD ${targetX} ${targetY} ${data.button || 0}`);
    } else if (data.action === 'mouseup') {
      sendHardwareCommand(`MU ${targetX} ${targetY} ${data.button || 0}`);
    }
  }

  if (data.action === 'wheel' && typeof data.deltaY === 'number') {
    const wheelDelta = data.deltaY < 0 ? 120 : -120;
    sendHardwareCommand(`W ${wheelDelta}`);
  } else if (data.action === 'keydown' && data.key) {
    const mapped = mapKeyToSendKeys(data);
    if (mapped) {
      sendHardwareCommand(`K ${mapped}`);
    }
  }
});

app.whenReady().then(() => {
  setupDisplayMediaHandler();
  createWindow();
});

app.on('window-all-closed', () => {
  if (inputHelper) {
    try {
      inputHelper.stdin.write('EXIT\n');
      inputHelper.kill();
    } catch (e) {}
    inputHelper = null;
  }
  if (process.platform !== 'darwin') app.quit();
});
