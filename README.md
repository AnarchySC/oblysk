# 🎯 Oblysk - Smart Clipboard Manager

**Enterprise-grade clipboard management tool designed for virtual consoles, remote sessions, and power users.**

[![Release](https://img.shields.io/github/v/release/AnarchySC/oblysk)](https://github.com/AnarchySC/oblysk/releases)
[![License](https://img.shields.io/github/license/AnarchySC/oblysk)](LICENSE)
[![Downloads](https://img.shields.io/github/downloads/AnarchySC/oblysk/total)](https://github.com/AnarchySC/oblysk/releases)

---

## 🚀 Why Oblysk?

Traditional clipboard managers fail in virtual consoles, remote desktop sessions, and web-based terminals. Oblysk solves this by providing a **grid-based clipboard system** with **global hotkeys** that work anywhere - even in environments where standard copy/paste breaks down.

### 🎯 Perfect For:
- 🖥️ **VMware vSphere/ESXi** web consoles
- ☁️ **AWS CloudShell** and cloud terminals  
- 🔧 **iDRAC/iLO/IPMI** management interfaces
- 🏢 **Corporate VDI** environments
- 🐧 **SSH terminals** and command prompts
- 🔒 **Secure environments** where clipboard access is restricted

---

## ✨ Key Features

### 🎮 Smart Grid Interface
- **9-cell grid** for organized clipboard management
- **Double-click to edit** any cell with your content
- **Visual indicators** show which cells contain data
- **Persistent storage** - your data survives app restarts

### ⚡ 22+ Global Hotkeys
- **`Ctrl+Alt+1-9`** - Paste from grid cells 1-9
- **`Ctrl+Alt+O`** - Toggle main window visibility
- **`Ctrl+Alt+C`** - Copy to notepad function
- **`Ctrl+Alt+V`** - Paste on-deck content
- **`Ctrl+Alt+R`** - Reverse copy functionality
- **Works system-wide** - even in virtual consoles!

### 🔐 Security & Privacy
- **Master password protection** with encryption
- **Activity-based auto-lock** (configurable timeout)
- **Manual lock/unlock** capabilities
- **Local data storage** - nothing sent to cloud
- **Secure session management**

### 🖥️ System Integration
- **System tray operation** - runs quietly in background
- **Windows startup integration** (optional)
- **Multi-monitor support**
- **Minimalist design** - stays out of your way

---

## 📦 Installation

### Quick Start (Recommended)
1. **Download** the latest `Oblysk-Portable-Windows.exe` from [Releases](https://github.com/AnarchySC/oblysk/releases)
2. **Run** the executable (no installation required)
3. **Setup** your master password when prompted
4. **Start using** - hotkeys work immediately!

### Alternative Installation Methods

#### MSI Installer
```bash
# Download and run the installer
Oblysk-v1.x.x-Windows-x64.exe
```

#### Build from Source
```bash
# Clone the repository
git clone https://github.com/AnarchySC/oblysk.git
cd oblysk

# Install dependencies
npm install

# Run in development mode
npm start

# Build executables
npm run build-win
```

---

## 🎮 How to Use

### Initial Setup
1. **Launch Oblysk** - you'll see the 3x3 grid interface
2. **Set master password** - secure your data (minimum 4 characters)
3. **Configure hotkeys** - all 22 hotkeys are registered automatically

### Basic Workflow
1. **Store content**: Double-click any grid cell and enter your text
2. **Paste anywhere**: Use `Ctrl+Alt+1` through `Ctrl+Alt+9`
3. **Quick access**: Press `Ctrl+Alt+O` to show/hide the main window
4. **Lock when away**: Use the security system for privacy

### Pro Tips
- **Right-click cells** for additional options
- **Use descriptive names** for frequently-used commands
- **Organize by priority** - put most-used items in cells 1-3
- **Lock automatically** - set activity timeout for security

---

## 🔧 Advanced Features

### Reverse Copy (`Ctrl+Alt+R`)
Captures text from difficult environments where standard copy operations fail.

### On-Deck System (`Ctrl+Alt+V`)
Temporary clipboard staging area for quick paste operations.

### Debug Mode (`Ctrl+Shift+D`)
Export detailed logs for troubleshooting and support.

### Activity Detection
Automatic locking based on user inactivity (configurable timeout).

---

## 🛡️ Security Features

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

## 🔧 Configuration

### Lock Timer Settings
```javascript
// Default: 480 minutes (8 hours)
// Configurable through the UI
```

### Hotkey Customization
Currently uses fixed hotkey combinations. Custom hotkeys planned for future release.

### Storage Location
- **Settings**: `%APPDATA%/oblysk/`
- **Data**: Encrypted and stored locally

---

## 🐛 Troubleshooting

### Common Issues

#### Hotkeys Not Working
- **Check if other apps** are using the same key combinations
- **Run as administrator** if in a restricted environment
- **Restart Oblysk** to re-register hotkeys

#### Windows Defender Warning
- This is normal for new executables
- **Click "More info" → "Run anyway"**
- **Verify checksum** matches the provided `checksums.txt`

#### App Won't Start
- **Check Windows version** - requires Windows 10/11
- **Install Visual C++ Redistributable** if missing
- **Check antivirus software** - whitelist if necessary

### Getting Help
- 📋 **Report bugs**: [Create an issue](https://github.com/AnarchySC/oblysk/issues/new/choose)
- 💬 **Get support**: [GitHub Discussions](https://github.com/AnarchySC/oblysk/discussions)
- 🔧 **Export logs**: Press `Ctrl+Shift+D` in the app

---

## 🛠️ Development

### Tech Stack
- **Electron** - Cross-platform desktop framework
- **Node.js** - Runtime environment
- **HTML/CSS/JavaScript** - Frontend technologies
- **Native APIs** - Global hotkey registration

### Build Requirements
- **Node.js 18+**
- **npm** package manager
- **Windows** (for Windows builds)

### Available Scripts
```bash
npm start          # Run in development mode
npm run build-win  # Build Windows executables
npm run build-all  # Build for all platforms (CI only)
npm test           # Run test suite
```

### Contributing
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

---

## 📊 System Requirements

### Minimum Requirements
- **OS**: Windows 10 (64-bit) or Windows 11
- **RAM**: 4GB
- **Storage**: 100MB free space
- **Network**: None required (fully offline)

### Recommended
- **OS**: Windows 11 (latest version)
- **RAM**: 8GB+ 
- **Storage**: 500MB free space
- **Multiple monitors** supported

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Electron Community** - Framework and tooling
- **Node.js Team** - Runtime environment
- **Contributors** - Everyone who helps improve Oblysk

---

## 📈 Roadmap

### Upcoming Features
- [ ] **Custom hotkey configuration**
- [ ] **Cloud sync** options (optional)
- [ ] **Text formatting** preservation
- [ ] **Command history** tracking
- [ ] **Plugin system** for extensions

### Platform Support
- [x] **Windows** (primary focus)
- [ ] **macOS** (planned)
- [ ] **Linux** (planned)

---

<div align="center">

**⭐ If Oblysk helps your workflow, please consider starring the repository! ⭐**

[![Star History Chart](https://api.star-history.com/svg?repos=AnarchySC/oblysk&type=Timeline)](https://star-history.com/#AnarchySC/oblysk&Timeline)

</div>

---

*Built with ❤️ for system administrators, developers, and power users who need reliable clipboard management in challenging environments.*
