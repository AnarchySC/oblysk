const { contextBridge, ipcRenderer, shell } = require('electron');

// Whitelist of allowed IPC channels
const INVOKE_CHANNELS = [
    'simulate-keystrokes',
    'paste-via-clipboard',
    'paste-powershell',
    'test-hotkeys',
    'get-clipboard-content',
    'get-main-process-logs'
];

const SEND_CHANNELS = [
    'minimize-window',
    'close-app',
    'set-local-clipboard',
    'renderer-log'
];

const RECEIVE_CHANNELS = [
    'paste-cell',
    'copy-to-notepad',
    'clipboard-changed',
    'paste-on-deck',
    'reverse-copy',
    'hotkey-registration-complete',
    'main-process-log',
    'show-debug-logs'
];

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => {
            if (INVOKE_CHANNELS.includes(channel)) {
                return ipcRenderer.invoke(channel, ...args);
            }
            throw new Error(`IPC invoke not allowed for channel: ${channel}`);
        },
        send: (channel, ...args) => {
            if (SEND_CHANNELS.includes(channel)) {
                ipcRenderer.send(channel, ...args);
            } else {
                throw new Error(`IPC send not allowed for channel: ${channel}`);
            }
        },
        on: (channel, func) => {
            if (RECEIVE_CHANNELS.includes(channel)) {
                ipcRenderer.on(channel, (event, ...args) => func(...args));
            } else {
                throw new Error(`IPC on not allowed for channel: ${channel}`);
            }
        }
    },
    shell: {
        openExternal: (url) => {
            // Only allow http(s) and mailto URLs
            if (/^(https?:|mailto:)/i.test(url)) {
                return shell.openExternal(url);
            }
            throw new Error(`URL scheme not allowed: ${url}`);
        }
    }
});
