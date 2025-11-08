<h1 align="center">cmux</h1>
<p align="center">Open source Claude Code manager that supports Codex/Gemini/Cursor/OpenCode/Amp CLI</p>

<p align="center">
  <a href="https://www.cmux.dev/direct-download-macos">
    <img src="./docs/assets/macos-badge.png" alt="Download cmux for macOS" width="180" />
  </a>
</p>

<p align="center">
  Join the <a href="https://discord.gg/SDbQmzQhRK">Discord</a> to talk more about cmux!
</p>

cmux lets you spawn Claude Code, Codex CLI, Cursor CLI, Gemini CLI, Amp, Opencode, and other coding agent CLIs in parallel across multiple tasks.

Every run spins up an isolated VS Code workspace either in the cloud or in a local Docker container with the git diff view, terminal, and dev server preview ready so parallel agent work stays verifiable, fast, and ready to ship.

![cmux screenshot](./docs/assets/cmux0.png)
![0github screenshot](./apps/www/assets/heatmap-demo-1.png)
![cmux screenshot](./docs/assets/cmux1.png)
![cmux screenshot](./docs/assets/cmux2.png)
![cmux screenshot](./docs/assets/cmux3.png)
![cmux screenshot](./docs/assets/cmux4.png)

## Install

cmux supports macOS and Linux (Ubuntu, Fedora, Debian). Windows support coming soon.

### macOS

<a href="https://www.cmux.dev/direct-download-macos">
  <img src="./docs/assets/macos-badge.png" alt="Download cmux for macOS" width="180" />
</a>

### Linux

cmux supports major Linux distributions including Ubuntu, Fedora, and Debian.

**Download Pre-built Packages:**
- **AppImage** (Universal): Works on all Linux distributions
- **Debian/Ubuntu** (.deb): For Debian-based distributions
- **Fedora/RHEL** (.rpm): For Red Hat-based distributions

Download the appropriate package from the [releases page](https://github.com/cbwinslow/cmux/releases).

**Installing:**

```bash
# AppImage (all distributions)
chmod +x cmux-*.AppImage
./cmux-*.AppImage

# Debian/Ubuntu
sudo dpkg -i cmux-*.deb
# or
sudo apt install ./cmux-*.deb

# Fedora/RHEL
sudo rpm -i cmux-*.rpm
# or
sudo dnf install cmux-*.rpm
```

**System Requirements:**
- Docker (required for local development environments)
- VS Code, Cursor, or Windsurf (optional, for opening projects)
- A supported terminal emulator (gnome-terminal, konsole, xfce4-terminal, etc.)


<!-- ```bash
# with bun
bunx cmux@latest

# with npm
npx cmux@latest

# or to install globally
bun add -g cmux@latest
npm install -g cmux@latest
``` -->

<!-- ```bash
# with uv
uvx cmux@latest
``` -->

<!-- ## Upgrade

```bash
cmux upgrade
``` -->

<!-- ## Uninstall

```bash
cmux uninstall
``` -->
