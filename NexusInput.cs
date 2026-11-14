using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;

public class NexusInputApp {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);

    private const uint LEFTDOWN = 0x0002;
    private const uint LEFTUP = 0x0004;
    private const uint RIGHTDOWN = 0x0008;
    private const uint RIGHTUP = 0x0010;
    private const uint MIDDLEDOWN = 0x0020;
    private const uint MIDDLEUP = 0x0040;
    private const uint WHEEL = 0x0800;

    public static void Main(string[] args) {
        try {
            SetProcessDPIAware();
        } catch {}

        string line;
        while ((line = Console.ReadLine()) != null) {
            line = line.Trim();
            if (string.IsNullOrEmpty(line)) continue;
            if (line == "EXIT" || line == "QUIT") break;

            try {
                string[] parts = line.Split(' ');
                string cmd = parts[0].ToUpperInvariant();

                if (cmd == "M" && parts.Length >= 3) {
                    int x = int.Parse(parts[1]);
                    int y = int.Parse(parts[2]);
                    SetCursorPos(x, y);
                } else if (cmd == "MD" && parts.Length >= 4) {
                    int x = int.Parse(parts[1]);
                    int y = int.Parse(parts[2]);
                    int btn = int.Parse(parts[3]);
                    SetCursorPos(x, y);
                    if (btn == 0) mouse_event(LEFTDOWN, 0, 0, 0, 0);
                    else if (btn == 1) mouse_event(MIDDLEDOWN, 0, 0, 0, 0);
                    else if (btn == 2) mouse_event(RIGHTDOWN, 0, 0, 0, 0);
                } else if (cmd == "MU" && parts.Length >= 4) {
                    int x = int.Parse(parts[1]);
                    int y = int.Parse(parts[2]);
                    int btn = int.Parse(parts[3]);
                    SetCursorPos(x, y);
                    if (btn == 0) mouse_event(LEFTUP, 0, 0, 0, 0);
                    else if (btn == 1) mouse_event(MIDDLEUP, 0, 0, 0, 0);
                    else if (btn == 2) mouse_event(RIGHTUP, 0, 0, 0, 0);
                } else if (cmd == "W" && parts.Length >= 2) {
                    int delta = int.Parse(parts[1]);
                    mouse_event(WHEEL, 0, 0, delta, 0);
                } else if (cmd == "K" && line.Length >= 2) {
                    string key = line.Substring(2).Trim();
                    if (!string.IsNullOrEmpty(key)) {
                        SendKeys.SendWait(key);
                    }
                }
            } catch {
                // Ignore single input errors to ensure process stability
            }
        }
    }
}
