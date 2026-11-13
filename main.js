const { app, BrowserWindow, ipcMain, desktopCapturer, screen, clipboard } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let psController = null;

function startHardwareController() {
  if (process.platform !== 'win32') return;
  if (psController) return;

  // Rimossa la flag "-ExecutionPolicy Bypass" che faceva scattare gli antivirus
  psController = spawn('powershell.exe', [
    '-NoProfile', '-NoLogo', '-NonInteractive', '-Command', '-'
  ], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });

  psController.on('exit', () => {
    psController = null;
  });

  psController.on('error', () => {
    psController = null;
  });

  const initCSharp = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NexusInput {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

    public const uint LEFTDOWN = 0x0002;
    public const uint LEFTUP = 0x0004;
    public const uint RIGHTDOWN = 0x0008;
    public const uint RIGHTUP = 0x0010;
    public const uint MIDDLEDOWN = 0x0020;
    public const uint MIDDLEUP = 0x0040;
    public const uint WHEEL = 0x0800;

    public static void Init() {
        SetProcessDPIAware();
    }
    public static void Move(int x, int y) {
        SetCursorPos(x, y);
    }
    public static void MouseDown(int x, int y, int button) {
        SetCursorPos(x, y);
        if (button == 0) mouse_event(LEFTDOWN, 0, 0, 0, 0);
        else if (button == 1) mouse_event(MIDDLEDOWN, 0, 0, 0, 0);
        else if (button == 2) mouse_event(RIGHTDOWN, 0, 0, 0, 0);
    }
    public static void MouseUp(int x, int y, int button) {
        SetCursorPos(x, y);
        if (button == 0) mouse_event(LEFTUP, 0, 0, 0, 0);
        else if (button == 1) mouse_event(MIDDLEUP, 0, 0, 0, 0);
        else if (button == 2) mouse_event(RIGHTUP, 0, 0, 0, 0);
    }
    public static void Scroll(int delta) {
        mouse_event(WHEEL, 0, 0, delta, 0);
    }
}
"@
[NexusInput]::Init()
`;
  psController.stdin.write(initCSharp + '\n');
}

function sendHardwareCommand(cmd) {
  if (!psController) startHardwareController();
  if (psController && psController.stdin && psController.stdin.writable) {
    try {
      psController.stdin.write(cmd + '\n');
    } catch (e) {
      psController = null;
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

ipcMain.handle('get-primary-screen', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources[0] ? sources[0].id : null;
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
      sendHardwareCommand(`[NexusInput]::Move(${targetX}, ${targetY})`);
    } else if (data.action === 'mousedown') {
      sendHardwareCommand(`[NexusInput]::MouseDown(${targetX}, ${targetY}, ${data.button || 0})`);
    } else if (data.action === 'mouseup') {
      sendHardwareCommand(`[NexusInput]::MouseUp(${targetX}, ${targetY}, ${data.button || 0})`);
    }
  }

  if (data.action === 'wheel' && typeof data.deltaY === 'number') {
    const wheelDelta = data.deltaY < 0 ? 120 : -120;
    sendHardwareCommand(`[NexusInput]::Scroll(${wheelDelta})`);
  } else if (data.action === 'keydown' && data.key) {
    const mapped = mapKeyToSendKeys(data);
    if (mapped) {
      const safeKey = mapped.replace(/'/g, "''");
      sendHardwareCommand(`[System.Windows.Forms.SendKeys]::SendWait('${safeKey}')`);
    }
  }
});

// Avvia solo la finestra all'apertura (PowerShell partirà in automatico solo quando inizia il controllo remoto)
app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (psController) {
    try { psController.kill(); } catch (e) {}
  }
  if (process.platform !== 'darwin') app.quit();
});
