const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, nativeImage, Tray, Menu } = require('electron');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

let mainWindow = null;
let tray = null;
let isQuitting = false;
let clipboardMonitorInterval = null;
let lastClipboardText = '';

// Enhanced logging system for Windows
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
        
        // Console output
        const prefix = `[${level.toUpperCase()}] [${category}]`;
        if (level === 'error') {
            console.error(prefix, message, data || '');
        } else if (level === 'warn') {
            console.warn(prefix, message, data || '');
        } else {
            console.log(prefix, message, data || '');
        }
        
        // Send to renderer if available
        if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('main-process-log', entry);
        }
    }
    
    getLogs() {
        return this.logs;
    }
}

const logger = new MainProcessLogger();

// Create Windows-optimized system tray
function createTray() {
    logger.log('info', 'tray', 'Creating Windows system tray icon');
    
    try {
        // Load tray icon (Windows specific)
        let icon;
        try {
            const iconPath = path.join(__dirname, 'tray-icon.png');
            icon = nativeImage.createFromPath(iconPath);
            if (icon.isEmpty()) {
                throw new Error('Tray icon file not found or empty');
            }
        } catch (e) {
            logger.log('warn', 'tray', 'Using fallback tray icon', { error: e.message });
            // Fallback: create a simple 16x16 icon
            icon = nativeImage.createEmpty();
        }
        
        // Resize for Windows system tray (16x16)
        icon = icon.resize({ width: 16, height: 16 });
        tray = new Tray(icon);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: 'Show Oblysk',
                click: () => showMainWindow()
            },
            { type: 'separator' },
            {
                label: 'Quick Paste',
                submenu: [
                    { label: 'Cell 1 (Ctrl+Alt+1)', click: () => triggerPaste(1) },
                    { label: 'Cell 2 (Ctrl+Alt+2)', click: () => triggerPaste(2) },
                    { label: 'Cell 3 (Ctrl+Alt+3)', click: () => triggerPaste(3) },
                    { type: 'separator' },
                    { label: 'On-deck (Ctrl+Alt+V)', click: () => triggerOnDeckPaste() }
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
        
        // Windows: single click to show
        tray.on('click', showMainWindow);
        
        logger.log('success', 'tray', 'Windows system tray created successfully');
        
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
    const os = require('os');
    
    const logData = {
        timestamp: new Date().toISOString(),
        platform: 'Windows',
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        logs: logger.getLogs()
    };
    
    const filename = `oblysk-windows-logs-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = path.join(os.homedir(), 'Desktop', filename);
    
    try {
        fs.writeFileSync(filepath, JSON.stringify(logData, null, 2));
        logger.log('success', 'debug', `Logs exported to ${filepath}`);
    } catch (error) {
        logger.log('error', 'debug', 'Failed to export logs', { error: error.message });
    }
}

// Create the main application window (Windows-optimized)
function createWindow() {
    logger.log('info', 'startup', 'Creating main window for Windows');
    
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
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
            webSecurity: false
        },
        show: false,
        icon: path.join(__dirname, 'icon.ico')
    });

    mainWindow.loadFile('index.html');
    logger.log('info', 'startup', `Windows ${os.release()}, Node ${process.version}`);

    // Window event handlers
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

    // Show window after content is ready
    mainWindow.webContents.once('dom-ready', () => {
        logger.log('info', 'startup', 'DOM ready, showing window');
        
        setTimeout(() => {
            mainWindow.show();
            setupHotkeys();
            startClipboardMonitoring();
            logger.log('success', 'startup', 'Windows application startup complete');
        }, 100);
    });

    return mainWindow;
}

// Windows-optimized hotkey setup
function setupHotkeys() {
    logger.log('info', 'hotkeys', 'Setting up Windows global hotkeys');
    
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

    // Additional Windows hotkeys
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

    logger.log('info', 'hotkeys', `Registered ${registeredCount} Windows hotkeys successfully`);
    
    if (failedHotkeys.length > 0) {
        logger.log('warn', 'hotkeys', `Failed to register ${failedHotkeys.length} hotkeys`, { failed: failedHotkeys });
    }
    
    // Send results to renderer
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

// Windows clipboard monitoring
function startClipboardMonitoring() {
    logger.log('info', 'clipboard', 'Starting Windows clipboard monitoring');
    
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
                
                logger.log('info', 'clipboard', `Windows clipboard changed: ${previousLength} → ${currentText.length} chars`);
                
                if (mainWindow && mainWindow.webContents) {
                    mainWindow.webContents.send('clipboard-changed', currentText);
                }
            }
        } catch (error) {
            // Clipboard errors are common - only log occasionally
            logger.log('debug', 'clipboard', 'Clipboard read error (normal)', { error: error.message });
        }
    }, 750);
}

function stopClipboardMonitoring() {
    if (clipboardMonitorInterval) {
        clearInterval(clipboardMonitorInterval);
        clipboardMonitorInterval = null;
        logger.log('info', 'clipboard', 'Windows clipboard monitoring stopped');
    }
}

// IPC Handlers for Windows
ipcMain.handle('test-hotkeys', async () => {
    logger.log('info', 'ipc', 'Windows hotkey test requested');
    
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
        platform: 'Windows'
    };
    
    logger.log('info', 'ipc', 'Windows hotkey test complete', result);
    return result;
});

// Windows-optimized keystroke simulation
ipcMain.handle('simulate-keystrokes', async (event, { text, delay }) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.log('info', 'paste', `[${requestId}] Windows keystroke simulation: ${text.length} chars, ${delay}ms delay`);
    
    try {
        const startTime = Date.now();
        const result = await simulateKeystrokesWindows(text, delay, requestId);
        const duration = Date.now() - startTime;
        
        logger.log('success', 'paste', `[${requestId}] Windows keystroke simulation completed in ${duration}ms`);
        return { ...result, duration, requestId, platform: 'Windows' };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] Windows keystroke simulation failed`, { error: error.message });
        return { success: false, error: error.message, requestId, platform: 'Windows' };
    }
});

// Enhanced Windows keystroke simulation
async function simulateKeystrokesWindows(text, delay, requestId) {
    logger.log('info', 'paste', `[${requestId}] Using optimized Windows keystroke simulation`);
    
    return new Promise((resolve) => {
        const batchSize = Math.max(1, Math.min(20, Math.floor(200 / delay)));
        let index = 0;
        let errors = [];
        
        function processNextBatch() {
            if (index >= text.length) {
                const success = errors.length === 0;
                logger.log(success ? 'success' : 'warn', 'paste', 
                    `[${requestId}] Windows simulation complete with ${errors.length} errors`);
                resolve({ 
                    success, 
                    message: success ? 'Keystrokes completed' : `Completed with ${errors.length} errors`,
                    errors: errors.length > 0 ? errors : undefined
                });
                return;
            }
            
            const batch = text.slice(index, index + batchSize);
            let escapedBatch = '';
            
            // Enhanced Windows SendKeys escaping
            for (const char of batch) {
                let escapedChar = char;
                switch (char) {
                    case '{': escapedChar = '{{'; break;
                    case '}': escapedChar = '}}'; break;
                    case '+': escapedChar = '{+}'; break;
                    case '^': escapedChar = '{^}'; break;
                    case '%': escapedChar = '{%}'; break;
                    case '~': escapedChar = '{~}'; break;
                    case '(': escapedChar = '{(}'; break;
                    case ')': escapedChar = '{)}'; break;
                    case '[': escapedChar = '{[}'; break;
                    case ']': escapedChar = '{]}'; break;
                    default: escapedChar = char; break;
                }
                escapedBatch += escapedChar;
            }
            
            const cmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escapedBatch}')"`;
            
            exec(cmd, { timeout: 5000 }, (error) => {
                if (error) {
                    logger.log('warn', 'paste', `[${requestId}] Windows batch error at position ${index}`, { error: error.message });
                    errors.push(`Position ${index}: ${error.message}`);
                }
                
                index += batchSize;
                setTimeout(processNextBatch, delay * Math.min(batchSize, 5));
            });
        }
        
        setTimeout(processNextBatch, 200);
    });
}

// Windows clipboard paste
ipcMain.handle('paste-via-clipboard', async (event, text) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.log('info', 'paste', `[${requestId}] Windows clipboard paste: ${text.length} chars`);
    
    try {
        clipboard.writeText(text);
        logger.log('info', 'paste', `[${requestId}] Windows clipboard content set`);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const result = await executeCommand('powershell', ['-Command', 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^v")'], 3000, requestId);
        
        logger.log('success', 'paste', `[${requestId}] Windows clipboard paste completed`);
        return { ...result, method: 'clipboard', requestId, platform: 'Windows' };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] Windows clipboard paste failed`, { error: error.message });
        return { success: false, error: error.message, method: 'clipboard', requestId, platform: 'Windows' };
    }
});

// Windows PowerShell paste
ipcMain.handle('paste-powershell', async (event, text) => {
    const requestId = Math.random().toString(36).substr(2, 9);
    logger.log('info', 'paste', `[${requestId}] Windows PowerShell paste: ${text.length} chars`);
    
    try {
        // Enhanced Windows character escaping for PowerShell
        const escapedText = text
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '""')
            .replace(/`/g, '``')
            .replace(/\$/g, '`$')
            .replace(/\[/g, '`[')
            .replace(/\]/g, '`]')
            .replace(/\r?\n/g, '{ENTER}');
        
        const command = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${escapedText}")`;
        const result = await executeCommand('powershell', ['-Command', command], 10000, requestId);
        
        logger.log('success', 'paste', `[${requestId}] Windows PowerShell paste completed`);
        return { ...result, method: 'powershell', requestId, platform: 'Windows' };
    } catch (error) {
        logger.log('error', 'paste', `[${requestId}] Windows PowerShell paste failed`, { error: error.message });
        return { success: false, error: error.message, method: 'powershell', requestId, platform: 'Windows' };
    }
});

// Helper function for command execution
function executeCommand(command, args, timeoutMs = 5000, requestId = 'unknown') {
    return new Promise((resolve) => {
        logger.log('info', 'command', `[${requestId}] Executing Windows command: ${command} ${args.join(' ')}`);
        
        const process = spawn(command, args, { shell: true });
        
        let output = '';
        let error = '';
        let completed = false;
        
        const timeout = setTimeout(() => {
            if (!completed) {
                completed = true;
                process.kill();
                logger.log('error', 'command', `[${requestId}] Windows command timed out after ${timeoutMs}ms`);
                resolve({ success: false, error: 'Command timed out', timeout: timeoutMs });
            }
        }, timeoutMs);
        
        process.stdout.on('data', (data) => {
            output += data.toString();
        });
        
        process.stderr.on('data', (data) => {
            error += data.toString();
        });
        
        process.on('close', (code) => {
            if (!completed) {
                completed = true;
                clearTimeout(timeout);
                
                logger.log(code === 0 ? 'success' : 'error', 'command', 
                    `[${requestId}] Windows command finished with code ${code}`);
                
                if (code === 0) {
                    resolve({ success: true, message: 'Command executed successfully', output, code });
                } else {
                    resolve({ success: false, error: error || `Command failed with code ${code}`, output, code });
                }
            }
        });
        
        process.on('error', (err) => {
            if (!completed) {
                completed = true;
                clearTimeout(timeout);
                logger.log('error', 'command', `[${requestId}] Windows command error`, { error: err.message });
                resolve({ success: false, error: err.message });
            }
        });
    });
}

// Reverse copy handlers
ipcMain.on('set-local-clipboard', (event, text) => {
    try {
        clipboard.writeText(text);
        logger.log('success', 'reverse-copy', `Set Windows clipboard: ${text.length} chars`);
    } catch (error) {
        logger.log('error', 'reverse-copy', 'Failed to set Windows clipboard', { error: error.message });
    }
});

ipcMain.handle('get-clipboard-content', async () => {
    try {
        const content = clipboard.readText();
        logger.log('info', 'reverse-copy', `Retrieved Windows clipboard: ${content.length} chars`);
        return { success: true, content };
    } catch (error) {
        logger.log('error', 'reverse-copy', 'Failed to get Windows clipboard', { error: error.message });
        return { success: false, error: error.message };
    }
});

// Window control IPC handlers
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

// Debug and logging IPC handlers
ipcMain.handle('get-main-process-logs', () => {
    return logger.getLogs();
});

ipcMain.on('renderer-log', (event, logData) => {
    logger.log(logData.level, 'renderer', logData.message, logData.data);
});

// Windows app event handlers
app.whenReady().then(() => {
    logger.log('info', 'startup', 'Windows Electron app ready, initializing');
    
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
    logger.log('info', 'app', 'All windows closed, quitting Windows app');
    isQuitting = true;
    app.quit();
});

app.on('before-quit', () => {
    logger.log('info', 'app', 'Windows app quitting, cleaning up');
    isQuitting = true;
    globalShortcut.unregisterAll();
    stopClipboardMonitoring();
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        logger.log('warn', 'security', 'Prevented new window creation on Windows', { url: navigationUrl });
    });
});

logger.log('success', 'startup', 'Windows main process initialized - Optimized for Windows virtual consoles');