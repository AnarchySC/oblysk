const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const { spawn, exec, execSync } = require('child_process');
const os = require('os');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let clipboardMonitorInterval = null;
let lastClipboardText = '';

// ─── Platform Detection ─────────────────────────────────────────────────────
const PLATFORM = process.platform; // 'win32', 'linux', 'darwin'
const PLATFORM_NAME = PLATFORM === 'win32' ? 'Windows' : PLATFORM === 'darwin' ? 'macOS' : 'Linux';
const IS_WINDOWS = PLATFORM === 'win32';
const IS_LINUX = PLATFORM === 'linux';
const IS_MAC = PLATFORM === 'darwin';

// Detect Linux display server (X11 or Wayland)
let linuxDisplayServer = 'x11'; // default
if (IS_LINUX) {
    const sessionType = process.env.XDG_SESSION_TYPE || '';
    const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
    if (sessionType === 'wayland' || waylandDisplay) {
        linuxDisplayServer = 'wayland';
    }
}

// Check if a command-line tool is available
function hasCommand(cmd) {
    try {
        execSync(`which ${cmd}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// ─── Logging ────────────────────────────────────────────────────────────────
class MainProcessLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 200;
    }

    log(level, category, message, data = null) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            category,
            message,
            data,
            pid: process.pid
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.maxLogs) {
            this.logs.pop();
        }

        const prefix = `[${level.toUpperCase()}] [${category}]`;
        if (level === 'error') {
            console.error(prefix, message, data || '');
        } else if (level === 'warn') {
            console.warn(prefix, message, data || '');
        } else {
            console.log(prefix, message, data || '');
        }

        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('main-process-log', entry);
        }
    }

    getLogs() {
        return this.logs;
    }
}

const logger = new MainProcessLogger();

// ─── Platform Tool Checks ───────────────────────────────────────────────────
function checkPlatformTools() {
    if (IS_LINUX) {
        if (linuxDisplayServer === 'wayland') {
            const hasWtype = hasCommand('wtype');
            const hasWlCopy = hasCommand('wl-copy');
            const hasXdotool = hasCommand('xdotool');
            logger.log('info', 'platform', `Wayland detected. wtype: ${hasWtype}, wl-copy: ${hasWlCopy}, xdotool (XWayland): ${hasXdotool}`);
            if (!hasWtype && !hasXdotool) {
                logger.log('warn', 'platform', 'No typing tool found. Install wtype (Wayland) or xdotool (XWayland): sudo apt install wtype xdotool');
            }
        } else {
            const hasXdotool = hasCommand('xdotool');
            const hasXclip = hasCommand('xclip');
            const hasXsel = hasCommand('xsel');
            logger.log('info', 'platform', `X11 detected. xdotool: ${hasXdotool}, xclip: ${hasXclip}, xsel: ${hasXsel}`);
            if (!hasXdotool) {
                logger.log('warn', 'platform', 'xdotool not found. Install it: sudo apt install xdotool');
            }
        }
    } else if (IS_MAC) {
        logger.log('info', 'platform', 'macOS detected. Using osascript for keystroke simulation.');
    } else {
        logger.log('info', 'platform', 'Windows detected. Using PowerShell + SendKeys.');
    }
}

// ─── System Tray ────────────────────────────────────────────────────────────
function createTray() {
    logger.log('info', 'tray', `Creating ${PLATFORM_NAME} system tray icon`);

    try {
        let icon;
        try {
            const iconPath = path.join(__dirname, 'tray-icon.png');
            icon = nativeImage.createFromPath(iconPath);
            if (icon.isEmpty()) {
                throw new Error('Tray icon file not found or empty');
            }
        } catch (e) {
            logger.log('warn', 'tray', 'Using fallback tray icon', { error: e.message });
            const size = 16;
            const canvas = Buffer.alloc(size * size * 4);
            for (let i = 0; i < size * size; i++) {
                canvas[i * 4] = 91;      // R (brand purple)
                canvas[i * 4 + 1] = 95;  // G
                canvas[i * 4 + 2] = 199; // B
                canvas[i * 4 + 3] = 255; // A
            }
            icon = nativeImage.createFromBuffer(canvas, { width: size, height: size });
        }

        icon = icon.resize({ width: 16, height: 16 });
        tray = new Tray(icon);

        const modKey = IS_MAC ? 'Cmd' : 'Ctrl';
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Oblysk',
                click: () => showMainWindow()
            },
            { type: 'separator' },
            {
                label: 'Quick Paste',
                submenu: [
                    { label: `Cell 1 (${modKey}+Alt+1)`, click: () => triggerPaste(1) },
                    { label: `Cell 2 (${modKey}+Alt+2)`, click: () => triggerPaste(2) },
                    { label: `Cell 3 (${modKey}+Alt+3)`, click: () => triggerPaste(3) },
                    { type: 'separator' },
                    { label: `On-deck (${modKey}+Alt+V)`, click: () => triggerOnDeckPaste() }
                ]
            },
            {
                label: 'Capture Clipboard',
                click: () => {
                    if (mainWindow) {
                        mainWindow.webContents.send('copy-to-notepad');
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Debug Info',
                click: () => showDebugInfo()
            },
            {
                label: 'Export Logs',
                click: () => exportMainProcessLogs()
            },
            { type: 'separator' },
            {
                label: 'Quit Oblysk',
                click: () => {
                    logger.log('info', 'app', 'Quitting via tray menu');
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setContextMenu(contextMenu);
        tray.setToolTip('Oblysk - Console Paste Tool (Click to show)');
        tray.on('click', showMainWindow);

        logger.log('success', 'tray', `${PLATFORM_NAME} system tray created successfully`);

    } catch (error) {
        logger.log('error', 'tray', 'Failed to create system tray', { error: error.message });
    }
}

function showMainWindow() {
    if (mainWindow) {
        if (mainWindow.isMinimized()) {
            mainWindow.restore();
        }
        mainWindow.show();
        mainWindow.focus();
        logger.log('info', 'window', 'Main window shown via tray');
    }
}

function triggerPaste(cellNumber) {
    if (mainWindow) {
        mainWindow.webContents.send('paste-cell', cellNumber);
        logger.log('info', 'paste', `Triggered paste for cell ${cellNumber} via tray`);
    }
}

function triggerOnDeckPaste() {
    if (mainWindow) {
        mainWindow.webContents.send('paste-on-deck');
        logger.log('info', 'paste', 'Triggered on-deck paste via tray');
    }
}

function showDebugInfo() {
    const logs = logger.getLogs().slice(0, 20);
    console.log('=== DEBUG INFO ===');
    logs.forEach(log => console.log(`${log.timestamp} [${log.level}] [${log.category}] ${log.message}`));

    if (mainWindow) {
        mainWindow.webContents.send('show-debug-logs', logs);
    }
}

function exportMainProcessLogs() {
    const fs = require('fs');

    const logData = {
        timestamp: new Date().toISOString(),
        platform: PLATFORM_NAME,
        displayServer: IS_LINUX ? linuxDisplayServer : undefined,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        logs: logger.getLogs()
    };

    const filename = `oblysk-${PLATFORM_NAME.toLowerCase()}-logs-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(os.homedir(), 'Desktop', filename);

    try {
        fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
        logger.log('success', 'debug', `Logs exported to ${filepath}`);
    } catch (error) {
        logger.log('error', 'debug', 'Failed to export logs', { error: error.message });
    }
}

// ─── Main Window ────────────────────────────────────────────────────────────
function createWindow() {
    logger.log('info', 'startup', `Creating main window on ${PLATFORM_NAME}`);

    // Use .ico on Windows, .png elsewhere
    const iconFile = IS_WINDOWS ? 'icon.ico' : 'tray-icon.png';

    mainWindow = new BrowserWindow({
        width: 400,
        height: 650,
        minWidth: 350,
        minHeight: 500,
        frame: false,
        transparent: false,
        backgroundColor: '#1a1a1a',
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        icon: path.join(__dirname, iconFile)
    });

    mainWindow.loadFile('index.html');
    logger.log('info', 'startup', `${PLATFORM_NAME} ${os.release()}, Node ${process.version}`);

    mainWindow.on('closed', () => {
        logger.log('info', 'window', 'Main window closed');
        mainWindow = null;
        stopClipboardMonitoring();
    });

    mainWindow.on('minimize', (event) => {
        if (tray) {
            event.preventDefault();
            mainWindow.hide();
            logger.log('info', 'window', 'Window hidden to system tray');
        }
    });

    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            logger.log('info', 'window', 'Window hidden instead of closed');
        }
    });

    mainWindow.webContents.once('dom-ready', () => {
        logger.log('info', 'startup', 'DOM ready, showing window');

        setTimeout(() => {
            mainWindow.show();
            setupHotkeys();
            startClipboardMonitoring();
            logger.log('success', 'startup', `${PLATFORM_NAME} application startup complete`);
        }, 100);
    });

    return mainWindow;
}

// ─── Hotkey Setup ───────────────────────────────────────────────────────────
function setupHotkeys() {
    logger.log('info', 'hotkeys', `Setting up global hotkeys on ${PLATFORM_NAME}`);

    globalShortcut.unregisterAll();

    let registeredCount = 0;
    let failedHotkeys = [];

    // Register paste hotkeys (1-9) - regular and numpad
    for (let i = 1; i <= 9; i++) {
        const regularKey = `CommandOrControl+Alt+${i}`;
        const numpadKey = `CommandOrControl+Alt+num${i}`;

        try {
            const regularSuccess = globalShortcut.register(regularKey, () => {
                logger.log('info', 'hotkey', `Paste cell ${i} triggered via ${regularKey}`);
                if (mainWindow) {
                    mainWindow.webContents.send('paste-cell', i);
                }
            });

            if (regularSuccess) {
                registeredCount++;
            } else {
                failedHotkeys.push(regularKey);
            }
        } catch (error) {
            logger.log('error', 'hotkeys', `Failed to register ${regularKey}`, { error: error.message });
            failedHotkeys.push(regularKey);
        }

        try {
            const numpadSuccess = globalShortcut.register(numpadKey, () => {
                logger.log('info', 'hotkey', `Paste cell ${i} triggered via ${numpadKey}`);
                if (mainWindow) {
                    mainWindow.webContents.send('paste-cell', i);
                }
            });

            if (numpadSuccess) {
                registeredCount++;
            } else {
                failedHotkeys.push(numpadKey);
            }
        } catch (error) {
            logger.log('error', 'hotkeys', `Failed to register ${numpadKey}`, { error: error.message });
            failedHotkeys.push(numpadKey);
        }
    }

    const additionalHotkeys = [
        {
            key: 'CommandOrControl+Alt+O',
            name: 'Toggle Window',
            handler: () => {
                logger.log('info', 'hotkey', 'Toggle window visibility');
                if (mainWindow) {
                    if (mainWindow.isVisible()) {
                        mainWindow.hide();
                    } else {
                        showMainWindow();
                    }
                }
            }
        },
        {
            key: 'CommandOrControl+Alt+C',
            name: 'Copy to Notepad',
            handler: () => {
                logger.log('info', 'hotkey', 'Copy to notepad triggered');
                if (mainWindow) {
                    mainWindow.webContents.send('copy-to-notepad');
                }
            }
        },
        {
            key: 'CommandOrControl+Alt+V',
            name: 'Paste On-Deck',
            handler: () => {
                logger.log('info', 'hotkey', 'On-deck paste triggered');
                if (mainWindow) {
                    mainWindow.webContents.send('paste-on-deck');
                }
            }
        },
        {
            key: 'CommandOrControl+Alt+R',
            name: 'Reverse Copy',
            handler: () => {
                logger.log('info', 'hotkey', 'Reverse copy triggered');
                if (mainWindow) {
                    mainWindow.webContents.send('reverse-copy');
                }
            }
        }
    ];

    additionalHotkeys.forEach(({ key, name, handler }) => {
        try {
            const success = globalShortcut.register(key, handler);
            if (success) {
                registeredCount++;
                logger.log('info', 'hotkeys', `Registered ${name} (${key})`);
            } else {
                failedHotkeys.push(key);
                logger.log('warn', 'hotkeys', `Failed to register ${name} (${key})`);
            }
        } catch (error) {
            logger.log('error', 'hotkeys', `Error registering ${name} (${key})`, { error: error.message });
            failedHotkeys.push(key);
        }
    });

    logger.log('info', 'hotkeys', `Registered ${registeredCount} hotkeys successfully on ${PLATFORM_NAME}`);

    if (failedHotkeys.length > 0) {
        logger.log('warn', 'hotkeys', `Failed to register ${failedHotkeys.length} hotkeys`, { failed: failedHotkeys });
    }

    setTimeout(() => {
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('hotkey-registration-complete', {
                success: registeredCount > 0,
                registered: registeredCount,
                total: 22,
                failed: failedHotkeys
            });
        }
    }, 500);
}

// ─── Clipboard Monitoring (cross-platform via Electron) ─────────────────────
function startClipboardMonitoring() {
    logger.log('info', 'clipboard', `Starting clipboard monitoring on ${PLATFORM_NAME}`);

    stopClipboardMonitoring();

    try {
        lastClipboardText = clipboard.readText();
        logger.log('info', 'clipboard', `Initial clipboard content: ${lastClipboardText.length} chars`);
    } catch (error) {
        logger.log('warn', 'clipboard', 'Could not read initial clipboard', { error: error.message });
        lastClipboardText = '';
    }

    clipboardMonitorInterval = setInterval(() => {
        try {
            const currentText = clipboard.readText();

            if (currentText !== lastClipboardText && currentText.length > 0) {
                const previousLength = lastClipboardText.length;
                lastClipboardText = currentText;

                logger.log('info', 'clipboard', `Clipboard changed: ${previousLength} -> ${currentText.length} chars`);

                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('clipboard-changed', currentText);
                }
            }
        } catch (error) {
            logger.log('debug', 'clipboard', 'Clipboard read error (normal)', { error: error.message });
        }
    }, 750);
}

function stopClipboardMonitoring() {
    if (clipboardMonitorInterval) {
        clearInterval(clipboardMonitorInterval);
        clipboardMonitorInterval = null;
        logger.log('info', 'clipboard', 'Clipboard monitoring stopped');
    }
}

// ─── Helper: Command Execution ──────────────────────────────────────────────
function executeCommand(command, args, timeoutMs = 5000, requestId = 'unknown') {
    return new Promise((resolve) => {
        logger.log('info', 'command', `[${requestId}] Executing: ${command} ${args.join(' ').substring(0, 100)}`);

        const proc = spawn(command, args, { shell: true });

        let output = '';
        let error = '';
        let completed = false;

        const timeout = setTimeout(() => {
            if (!completed) {
                completed = true;
                proc.kill();
                logger.log('error', 'command', `[${requestId}] Command timed out after ${timeoutMs}ms`);
                resolve({ success: false, error: 'Command timed out', timeout: timeoutMs });
            }
        }, timeoutMs);

        proc.stdout.on('data', (data) => {
            output += data.toString();
        });

        proc.stderr.on('data', (data) => {
            error += data.toString();
        });

        proc.on('close', (code) => {
            if (!completed) {
                completed = true;
                clearTimeout(timeout);

                logger.log(code === 0 ? 'success' : 'error', 'command',
                    `[${requestId}] Command finished with code ${code}`);

                if (code === 0) {
                    resolve({ success: true, message: 'Command executed successfully', output, code });
                } else {
                    resolve({ success: false, error: error || `Command failed with code ${code}`, output, code });
                }
            }
        });

        proc.on('error', (err) => {
            if (!completed) {
                completed = true;
                clearTimeout(timeout);
                logger.log('error', 'command', `[${requestId}] Command error`, { error: err.message });
                resolve({ success: false, error: err.message });
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PLATFORM-SPECIFIC PASTE IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Windows: PowerShell + SendKeys ─────────────────────────────────────────
function escapeSendKeys(char) {
    switch (char) {
        case '{': return '{{';
        case '}': return '}}';
        case '+': return '{+}';
        case '^': return '{^}';
        case '%': return '{%}';
        case '~': return '{~}';
        case '(': return '{(}';
        case ')': return '{)}';
        case '[': return '{[}';
        case ']': return '{]}';
        default: return char;
    }
}

async function simulateKeystrokesWindows(text, delay, requestId) {
    logger.log('info', 'paste', `[${requestId}] Using Windows SendKeys simulation`);

    return new Promise((resolve) => {
        const batchSize = Math.max(1, Math.min(20, Math.floor(200 / delay)));
        let index = 0;
        let errors = [];

        function processNextBatch() {
            if (index >= text.length) {
                const success = errors.length === 0;
                resolve({
                    success,
                    message: success ? 'Keystrokes completed' : `Completed with ${errors.length} errors`,
                    errors: errors.length > 0 ? errors : undefined
                });
                return;
            }

            const batch = text.slice(index, index + batchSize);
            let escapedBatch = '';
            for (const char of batch) {
                escapedBatch += escapeSendKeys(char);
            }

            const safeEscapedBatch = escapedBatch.replace(/'/g, "''");
            const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${safeEscapedBatch}')"`;

            exec(cmd, { timeout: 5000 }, (error) => {
                if (error) {
                    logger.log('warn', 'paste', `[${requestId}] Batch error at position ${index}`, { error: error.message });
                    errors.push(`Position ${index}: ${error.message}`);
                }

                index += batchSize;
                setTimeout(processNextBatch, delay * Math.min(batchSize, 5));
            });
        }

        setTimeout(processNextBatch, 200);
    });
}

async function pasteViaClipboardWindows(text, requestId) {
    clipboard.writeText(text);
    await new Promise(resolve => setTimeout(resolve, 100));
    const result = await executeCommand('powershell', ['-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")'], 3000, requestId);
    return { ...result, method: 'clipboard' };
}

async function pasteViaShellWindows(text, requestId) {
    let escapedText = '';
    for (const char of text) {
        if (char === '\n') { escapedText += '{ENTER}'; }
        else if (char === '\r') { /* skip */ }
        else { escapedText += escapeSendKeys(char); }
    }
    escapedText = escapedText.replace(/'/g, "''");
    const command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedText}')`;
    const result = await executeCommand('powershell', ['-Command', command], 10000, requestId);
    return { ...result, method: 'powershell' };
}

// ─── Linux: xdotool (X11) / wtype (Wayland) ────────────────────────────────
async function simulateKeystrokesLinux(text, delay, requestId) {
    logger.log('info', 'paste', `[${requestId}] Using Linux keystroke simulation (${linuxDisplayServer})`);

    if (linuxDisplayServer === 'wayland' && hasCommand('wtype')) {
        // wtype handles the full string at once
        const result = await executeCommand('wtype', ['-d', String(delay), '--', text], 30000, requestId);
        return { ...result, method: 'wtype' };
    }

    if (hasCommand('xdotool')) {
        // xdotool type with configurable delay
        const result = await executeCommand('xdotool', ['type', '--delay', String(delay), '--clearmodifiers', '--', text], 30000, requestId);
        return { ...result, method: 'xdotool' };
    }

    // Fallback: try ydotool (works on both X11 and Wayland, needs root/ydotoold)
    if (hasCommand('ydotool')) {
        const result = await executeCommand('ydotool', ['type', '--key-delay', String(delay), '--', text], 30000, requestId);
        return { ...result, method: 'ydotool' };
    }

    return { success: false, error: 'No typing tool found. Install xdotool (X11) or wtype (Wayland): sudo apt install xdotool wtype' };
}

async function pasteViaClipboardLinux(text, requestId) {
    clipboard.writeText(text);
    await new Promise(resolve => setTimeout(resolve, 100));

    if (linuxDisplayServer === 'wayland' && hasCommand('wtype')) {
        const result = await executeCommand('wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl'], 3000, requestId);
        return { ...result, method: 'clipboard' };
    }

    if (hasCommand('xdotool')) {
        const result = await executeCommand('xdotool', ['key', '--clearmodifiers', 'ctrl+v'], 3000, requestId);
        return { ...result, method: 'clipboard' };
    }

    return { success: false, error: 'No key simulation tool found. Install xdotool or wtype.' };
}

async function pasteViaShellLinux(text, requestId) {
    // On Linux the "shell paste" method is the same as keystroke simulation
    return simulateKeystrokesLinux(text, 12, requestId);
}

// ─── macOS: osascript ───────────────────────────────────────────────────────
async function simulateKeystrokesMac(text, delay, requestId) {
    logger.log('info', 'paste', `[${requestId}] Using macOS osascript simulation`);

    // For long text, use clipboard paste instead (osascript keystroke is slow)
    if (text.length > 200) {
        logger.log('info', 'paste', `[${requestId}] Text too long for keystroke, using clipboard paste`);
        return pasteViaClipboardMac(text, requestId);
    }

    // Escape for AppleScript string (backslash and double-quote)
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `tell application "System Events" to keystroke "${escaped}"`;
    const result = await executeCommand('osascript', ['-e', script], 10000, requestId);
    return { ...result, method: 'osascript-keystroke' };
}

async function pasteViaClipboardMac(text, requestId) {
    clipboard.writeText(text);
    await new Promise(resolve => setTimeout(resolve, 100));
    const script = 'tell application "System Events" to keystroke "v" using command down';
    const result = await executeCommand('osascript', ['-e', script], 3000, requestId);
    return { ...result, method: 'clipboard' };
}

async function pasteViaShellMac(text, requestId) {
    // On macOS the "shell paste" uses clipboard + Cmd+V for reliability
    return pasteViaClipboardMac(text, requestId);
}

// ─── Platform Dispatchers ───────────────────────────────────────────────────
async function simulateKeystrokes(text, delay, requestId) {
    if (IS_WINDOWS) return simulateKeystrokesWindows(text, delay, requestId);
    if (IS_MAC) return simulateKeystrokesMac(text, delay, requestId);
    return simulateKeystrokesLinux(text, delay, requestId);
}

async function pasteViaClipboard(text, requestId) {
    if (IS_WINDOWS) return pasteViaClipboardWindows(text, requestId);
    if (IS_MAC) return pasteViaClipboardMac(text, requestId);
    return pasteViaClipboardLinux(text, requestId);
}

async function pasteViaShell(text, requestId) {
    if (IS_WINDOWS) return pasteViaShellWindows(text, requestId);
    if (IS_MAC) return pasteViaShellMac(text, requestId);
    return pasteViaShellLinux(text, requestId);
}

// ─── IPC Handlers ───────────────────────────────────────────────────────────
ipcMain.handle('test-hotkeys', async () => {
    logger.log('info', 'ipc', 'Hotkey test requested');

    let count = 0;
    const registered = [];
    const failed = [];

    for (let i = 1; i <= 9; i++) {
        const regularKey = `CommandOrControl+Alt+${i}`;
        const numpadKey = `CommandOrControl+Alt+num${i}`;

        if (globalShortcut.isRegistered(regularKey)) {
            count++;
            registered.push(regularKey);
        } else {
            failed.push(regularKey);
        }

        if (globalShortcut.isRegistered(numpadKey)) {
            count++;
            registered.push(numpadKey);
        } else {
            failed.push(numpadKey);
        }
    }

    const result = {
        success: count > 0,
        registered: count,
        total: 22,
        registeredKeys: registered,
        failedKeys: failed,
        platform: PLATFORM_NAME
    };

    logger.log('info', 'ipc', 'Hotkey test complete', result);
    return result;
});

ipcMain.handle('simulate-keystrokes', async (event, { text, delay }) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.log('info', 'paste', `[${requestId}] Keystroke simulation: ${text.length} chars, ${delay}ms delay`);

    try {
        const startTime = Date.now();
        const result = await simulateKeystrokes(text, delay, requestId);
        const duration = Date.now() - startTime;

        logger.log('success', 'paste', `[${requestId}] Keystroke simulation completed in ${duration}ms`);
        return { ...result, duration, requestId, platform: PLATFORM_NAME };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] Keystroke simulation failed`, { error: error.message });
        return { success: false, error: error.message, requestId, platform: PLATFORM_NAME };
    }
});

ipcMain.handle('paste-via-clipboard', async (event, text) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.log('info', 'paste', `[${requestId}] Clipboard paste: ${text.length} chars`);

    try {
        clipboard.writeText(text);
        logger.log('info', 'paste', `[${requestId}] Clipboard content set`);

        const result = await pasteViaClipboard(text, requestId);

        logger.log('success', 'paste', `[${requestId}] Clipboard paste completed`);
        return { ...result, requestId, platform: PLATFORM_NAME };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] Clipboard paste failed`, { error: error.message });
        return { success: false, error: error.message, method: 'clipboard', requestId, platform: PLATFORM_NAME };
    }
});

ipcMain.handle('paste-powershell', async (event, text) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    const methodName = IS_WINDOWS ? 'PowerShell' : IS_MAC ? 'osascript' : 'shell';
    logger.log('info', 'paste', `[${requestId}] ${methodName} paste: ${text.length} chars`);

    try {
        const result = await pasteViaShell(text, requestId);

        logger.log('success', 'paste', `[${requestId}] ${methodName} paste completed`);
        return { ...result, requestId, platform: PLATFORM_NAME };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] ${methodName} paste failed`, { error: error.message });
        return { success: false, error: error.message, method: methodName.toLowerCase(), requestId, platform: PLATFORM_NAME };
    }
});

// ─── Reverse Copy / Clipboard IPC ───────────────────────────────────────────
ipcMain.on('set-local-clipboard', (event, text) => {
    try {
        clipboard.writeText(text);
        logger.log('success', 'reverse-copy', `Set clipboard: ${text.length} chars`);
    } catch (error) {
        logger.log('error', 'reverse-copy', 'Failed to set clipboard', { error: error.message });
    }
});

ipcMain.handle('get-clipboard-content', async () => {
    try {
        const content = clipboard.readText();
        logger.log('info', 'reverse-copy', `Retrieved clipboard: ${content.length} chars`);
        return { success: true, content };
    } catch (error) {
        logger.log('error', 'reverse-copy', 'Failed to get clipboard', { error: error.message });
        return { success: false, error: error.message };
    }
});

// ─── Window Control IPC ─────────────────────────────────────────────────────
ipcMain.on('minimize-window', () => {
    logger.log('info', 'window', 'Minimize requested via IPC');
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.on('close-app', () => {
    logger.log('info', 'app', 'Close requested via IPC');
    isQuitting = true;
    app.quit();
});

ipcMain.handle('get-main-process-logs', () => {
    return logger.getLogs();
});

ipcMain.on('renderer-log', (event, logData) => {
    logger.log(logData.level, 'renderer', logData.message, logData.data);
});

// ─── App Lifecycle ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
    logger.log('info', 'startup', `Electron app ready on ${PLATFORM_NAME}, initializing`);

    checkPlatformTools();
    createWindow();
    createTray();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        } else if (mainWindow) {
            showMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (tray && !isQuitting) {
        logger.log('info', 'app', 'All windows closed, staying in system tray');
    } else {
        logger.log('info', 'app', 'All windows closed, quitting');
        isQuitting = true;
        app.quit();
    }
});

app.on('before-quit', () => {
    logger.log('info', 'app', 'App quitting, cleaning up');
    isQuitting = true;
    globalShortcut.unregisterAll();
    stopClipboardMonitoring();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        logger.log('warn', 'security', 'Prevented new window creation', { url: navigationUrl });
    });
});

logger.log('success', 'startup', `Main process initialized on ${PLATFORM_NAME} (${IS_LINUX ? linuxDisplayServer : 'native'})`);
