const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let psController = null;

function startHardwareController() {
  if (process.platform !== 'win32') return;

  psController = spawn('powershell.exe', [
    '-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-Command', '-'
  ], { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true });

  const initCSharp = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class NexusInput {
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);

    public const uint LEFTDOWN = 0x0002;
    public const uint LEFTUP = 0x0004;
    public const uint RIGHTDOWN = 0x0008;
    public const uint RIGHTUP = 0x0010;

    public static void Move(int x, int y) {
        SetCursorPos(x, y);
    }
    public static void LeftClick(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(LEFTDOWN, 0, 0, 0, 0);
        mouse_event(LEFTUP, 0, 0, 0, 0);
    }
    public static void RightClick(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(RIGHTDOWN, 0, 0, 0, 0);
        mouse_event(RIGHTUP, 0, 0, 0, 0);
    }
}
"@
`;
  psController.stdin.write(initCSharp + '\n');
}

function sendHardwareCommand(cmd) {
  if (psController && psController.stdin.writable) {
    psController.stdin.write(cmd + '\n');
  }
}

function mapKeyToSendKeys(key) {
  const specialMap = {
    'Enter': '{ENTER}', 'Backspace': '{BS}', 'Tab': '{TAB}', 'Escape': '{ESC}',
    'Delete': '{DEL}', 'ArrowUp': '{UP}', 'ArrowDown': '{DOWN}', 'ArrowLeft': '{LEFT}',
    'ArrowRight': '{RIGHT}', 'Home': '{HOME}', 'End': '{END}', 'PageUp': '{PGUP}',
    'PageDown': '{PGDN}', ' ': ' '
  };

  if (specialMap[key]) return specialMap[key];
  if (key.length === 1) {
    if (['+', '^', '%', '~', '(', ')', '{', '}', '[', ']'].includes(key)) {
      return `{${key}}`;
    }
    return key;
  }
  return null;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1150, height: 740, minWidth: 900, minHeight: 600,
    backgroundColor: '#1e1e1e', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.loadFile('index.html');
}

ipcMain.handle('get-primary-screen', async () => {
  const sources = await desktopCapturer.getSources({ types: ['screen'] });
  return sources[0] ? sources[0].id : null;
});

ipcMain.on('execute-native-input', (event, data) => {
  if (process.platform !== 'win32') return;

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  
  // RIPRISTINATO: Serve per non sfalsare la mira se l'ospite usa lo zoom di Windows (125%, 150%)
  const scaleFactor = primaryDisplay.scaleFactor || 1;
  const targetX = Math.round(data.x * width * scaleFactor);
  const targetY = Math.round(data.y * height * scaleFactor);

  if (data.action === 'move') {
    sendHardwareCommand(`[NexusInput]::Move(${targetX}, ${targetY})`);
  } else if (data.action === 'click') {
    sendHardwareCommand(`[NexusInput]::LeftClick(${targetX}, ${targetY})`);
  } else if (data.action === 'dblclick') {
    sendHardwareCommand(`[NexusInput]::LeftClick(${targetX}, ${targetY}); Start-Sleep -Milliseconds 60; [NexusInput]::LeftClick(${targetX}, ${targetY})`);
  } else if (data.action === 'rightclick') {
    sendHardwareCommand(`[NexusInput]::RightClick(${targetX}, ${targetY})`);
  } else if (data.action === 'keydown' && data.key) {
    const mapped = mapKeyToSendKeys(data.key);
    if (mapped) {
      const safeKey = mapped.replace(/'/g, "''");
      sendHardwareCommand(`[System.Windows.Forms.SendKeys]::SendWait('${safeKey}')`);
    }
  }
});

app.whenReady().then(() => { startHardwareController(); createWindow(); });
app.on('window-all-closed', () => {
  if (psController) { try { psController.kill(); } catch (e) {} }
  if (process.platform !== 'darwin') app.quit();
});
