# Oblysk - Smart Clipboard Manager

**Cross-platform clipboard management tool designed for virtual consoles, remote sessions, and power users.**

[![Release](https://img.shields.io/github/v/release/AnarchySC/oblysk)](https://github.com/AnarchySC/oblysk/releases)
[![License](https://img.shields.io/github/license/AnarchySC/oblysk)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/AnarchySC/oblysk/total)](https://github.com/AnarchySC/oblysk/releases)

---

## Why Oblysk?

Traditional clipboard managers fail in virtual consoles, remote desktop sessions, and web-based terminals. Oblysk solves this by providing a **grid-based clipboard system** with **global hotkeys** that work anywhere - even in environments where standard copy/paste breaks down.

### Perfect For:
- **VMware vSphere/ESXi** web consoles
- **AWS CloudShell** and cloud terminals
- **iDRAC/iLO/IPMI** management interfaces
- **Corporate VDI** environments
- **SSH terminals** and command prompts
- **Secure environments** where clipboard access is restricted

---

## Key Features

### Smart Grid Interface
- **9-cell grid** for organized clipboard management
- **Double-click to edit** any cell with your content
- **Visual indicators** show which cells contain data
- **Persistent storage** - your data survives app restarts

### 22+ Global Hotkeys
- **`Ctrl+Alt+1-9`** (or `Cmd+Alt` on macOS) - Paste from grid cells 1-9
- **`Ctrl+Alt+O`** - Toggle main window visibility
- **`Ctrl+Alt+C`** - Copy to notepad function
- **`Ctrl+Alt+V`** - Paste on-deck content
- **`Ctrl+Alt+R`** - Reverse copy functionality
- **Works system-wide** - even in virtual consoles!

### Security & Privacy
- **Master password protection** with encryption
- **Activity-based auto-lock** (configurable timeout)
- **Manual lock/unlock** capabilities
- **Local data storage** - nothing sent to cloud
- **Secure session management**

### System Integration
- **System tray operation** - runs quietly in background
- **Multi-monitor support**
- **Minimalist design** - stays out of your way

---

## Installation

### Windows
1. **Download** the latest `Oblysk-Portable-Windows.exe` from [Releases](https://github.com/AnarchySC/oblysk/releases)
2. **Run** the executable (no installation required)

Or use the NSIS installer (`Oblysk-x.x.x-Windows-x64.exe`) for a full install with Start Menu shortcuts.

### Linux
1. **Download** the `.AppImage` or `.deb` from [Releases](https://github.com/AnarchySC/oblysk/releases)
2. **Install required tools** for paste functionality:
   - **X11**: `sudo apt install xdotool xclip`
   - **Wayland**: `sudo apt install wtype wl-clipboard`
3. **Run** the AppImage (`chmod +x Oblysk-*.AppImage && ./Oblysk-*.AppImage`) or install the .deb

### macOS
1. **Download** the `.dmg` from [Releases](https://github.com/AnarchySC/oblysk/releases)
2. **Open** the DMG and drag Oblysk to Applications
3. **Grant accessibility permissions** when prompted (needed for keystroke simulation)

### Build from Source
```bash
git clone https://github.com/AnarchySC/oblysk.git
cd oblysk
npm install

# Run in development mode
npm start

# Build for your platform
npm run build-win     # Windows (nsis + portable)
npm run build-linux   # Linux (AppImage + deb)
npm run build-mac     # macOS (dmg)
npm run build-all     # All platforms
```

---

## How to Use

### Initial Setup
1. **Launch Oblysk** - you'll see the 3x3 grid interface
2. **Set master password** - secure your data (minimum 4 characters)
3. **Configure hotkeys** - all 22 hotkeys are registered automatically

### Basic Workflow
1. **Store content**: Double-click any grid cell and enter your text
2. **Paste anywhere**: Use `Ctrl+Alt+1` through `Ctrl+Alt+9`
3. **Quick access**: Press `Ctrl+Alt+O` to show/hide the main window
4. **Lock when away**: Use the security system for privacy

### Paste Methods
| Method | Windows | Linux (X11) | Linux (Wayland) | macOS |
|--------|---------|-------------|-----------------|-------|
| **Keystrokes** | PowerShell SendKeys | xdotool type | wtype | osascript |
| **Clipboard** | SendKeys Ctrl+V | xdotool key ctrl+v | wtype ctrl+v | osascript Cmd+V |
| **Shell Paste** | PowerShell SendKeys | xdotool type | wtype | osascript |

### Pro Tips
- **Right-click cells** for additional options
- **Use descriptive names** for frequently-used commands
- **Organize by priority** - put most-used items in cells 1-3
- **Lock automatically** - set activity timeout for security

---

## Advanced Features

### Reverse Copy (`Ctrl+Alt+R`)
Captures text from difficult environments where standard copy operations fail.

### On-Deck System (`Ctrl+Alt+V`)
Temporary clipboard staging area for quick paste operations.

### Debug Mode (`Ctrl+Shift+D`)
Export detailed logs for troubleshooting and support.

### Activity Detection
Automatic locking based on user inactivity (configurable timeout).

---

## Security Features

### Data Encryption
- All stored data is encrypted using your master password
- Encryption occurs locally - no data transmitted externally

### Session Security
- **Auto-lock** after configurable inactivity period
- **Manual lock/unlock** for immediate security
- **Password verification** required for access

### Privacy Protection
- **No telemetry** or data collection
- **Local storage only** - your data never leaves your machine
- **Open source** - full transparency of code and functionality

---

## Troubleshooting

### Hotkeys Not Working
- **Check if other apps** are using the same key combinations
- **Restart Oblysk** to re-register hotkeys
- **Linux**: Make sure you're not running a Wayland compositor that blocks global shortcuts

### Linux: Paste Not Working
- **X11**: Install xdotool (`sudo apt install xdotool`)
- **Wayland**: Install wtype (`sudo apt install wtype`)
- **Check display server**: Run `echo $XDG_SESSION_TYPE` to see if you're on X11 or Wayland
- Oblysk auto-detects your display server and uses the right tool

### macOS: Accessibility Permission
- Go to **System Settings > Privacy & Security > Accessibility**
- Add Oblysk to the allowed apps list
- This is required for keystroke simulation to work

### Windows Defender Warning
- This is normal for new executables
- **Click "More info" > "Run anyway"**

### Getting Help
- **Report bugs**: [Create an issue](https://github.com/AnarchySC/oblysk/issues/new/choose)
- **Get support**: [GitHub Discussions](https://github.com/AnarchySC/oblysk/discussions)
- **Export logs**: Press `Ctrl+Shift+D` in the app

---

## System Requirements

### Minimum
- **OS**: Windows 10+, Ubuntu 20.04+ / Fedora 36+, macOS 11+
- **RAM**: 4GB
- **Storage**: 100MB free space
- **Network**: None required (fully offline)

### Linux Dependencies
- **X11**: `xdotool` (keystroke simulation), `xclip` or `xsel` (clipboard, optional)
- **Wayland**: `wtype` (keystroke simulation), `wl-clipboard` (clipboard, optional)
- **Fallback**: `ydotool` (works on both X11 and Wayland, requires ydotoold service)

---

## Development

### Tech Stack
- **Electron** - Cross-platform desktop framework
- **Node.js** - Runtime environment
- **HTML/CSS/JavaScript** - Frontend
- **Platform APIs** - xdotool, wtype, osascript, PowerShell

### Build Requirements
- **Node.js 18+**
- **npm** package manager

### Available Scripts
```bash
npm start            # Run in development mode
npm run build-win    # Build Windows executables
npm run build-linux  # Build Linux packages
npm run build-mac    # Build macOS DMG
npm run build-all    # Build for all platforms
```

### Contributing
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## Platform Support

- [x] **Windows** (PowerShell + SendKeys)
- [x] **Linux X11** (xdotool + xclip)
- [x] **Linux Wayland** (wtype + wl-copy)
- [x] **macOS** (osascript)

---

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

*Built with love for system administrators, developers, and power users who need reliable clipboard management in challenging environments.*
