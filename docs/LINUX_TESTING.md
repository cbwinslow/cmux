# Linux Testing Guide for cmux

This guide covers testing cmux on Linux distributions (Ubuntu, Fedora, Debian).

## System Requirements

- **OS**: Ubuntu 20.04+, Fedora 35+, or Debian 11+
- **Architecture**: x86_64 (x64) or aarch64 (arm64)
- **Docker**: Required for local development environments
- **Node.js**: 20.0.0 or higher
- **Bun**: 1.2.21 or higher

## Installation Testing

### 1. AppImage Testing (All Distributions)

AppImage is a universal package format that works on all Linux distributions.

```bash
# Download AppImage
wget https://github.com/cbwinslow/cmux/releases/download/VERSION/cmux-VERSION.AppImage

# Make executable
chmod +x cmux-VERSION.AppImage

# Run
./cmux-VERSION.AppImage
```

**Test Cases**:
- [ ] AppImage runs without errors
- [ ] Application window opens
- [ ] All menu items are accessible
- [ ] Application icon appears in system tray (if supported)
- [ ] Application can be moved to different directories and still run

### 2. Debian/Ubuntu Package Testing (.deb)

```bash
# Install via dpkg
sudo dpkg -i cmux_VERSION_amd64.deb
# or
sudo apt install ./cmux_VERSION_amd64.deb

# Run
cmux

# Verify installation
which cmux
dpkg -l | grep cmux

# Uninstall (for testing)
sudo apt remove cmux
```

**Test Cases**:
- [ ] Package installs without dependency errors
- [ ] Desktop entry is created (`/usr/share/applications/cmux.desktop`)
- [ ] Application appears in application menu
- [ ] Icon is properly displayed
- [ ] Uninstallation removes all files cleanly

### 3. Fedora/RHEL Package Testing (.rpm)

```bash
# Install via rpm
sudo rpm -i cmux-VERSION.x86_64.rpm
# or
sudo dnf install cmux-VERSION.x86_64.rpm

# Run
cmux

# Verify installation
which cmux
rpm -qa | grep cmux

# Uninstall (for testing)
sudo dnf remove cmux
```

**Test Cases**:
- [ ] Package installs without dependency errors
- [ ] Desktop entry is created
- [ ] Application appears in application menu
- [ ] Icon is properly displayed
- [ ] Uninstallation removes all files cleanly

## Feature Testing

### 1. File Manager Integration

Test that the "Open in File Manager" feature works with your system's file manager.

**Supported File Managers**:
- Nautilus (GNOME/Ubuntu)
- Dolphin (KDE/Kubuntu)
- Thunar (XFCE/Xubuntu)
- Nemo (Cinnamon/Linux Mint)
- Caja (MATE)
- PCManFM (LXDE)

**Test Cases**:
- [ ] Click "Open in File Manager" button
- [ ] Correct file manager opens with the workspace directory
- [ ] Directory is properly navigable in the file manager

### 2. Terminal Emulator Integration

Test that the "Open in Terminal" feature works with your system's terminal emulator.

**Supported Terminal Emulators**:
- gnome-terminal (GNOME/Ubuntu)
- konsole (KDE/Kubuntu)
- xfce4-terminal (XFCE/Xubuntu)
- tilix (GNOME alternative)
- terminator (Cross-desktop)
- xterm (Fallback)
- alacritty
- ghostty

**Test Cases**:
- [ ] Click "Open in Terminal" button
- [ ] Correct terminal emulator opens
- [ ] Terminal opens with the workspace directory as working directory
- [ ] Terminal remains functional after opening

### 3. Editor Integration

Test that code editors can be opened from cmux.

**Supported Editors**:
- VS Code (`code`)
- Cursor (`cursor`)
- Windsurf (`windsurf`)

**Test Cases**:
- [ ] VS Code opens with correct workspace
- [ ] Cursor opens with correct workspace
- [ ] Windsurf opens with correct workspace
- [ ] Editor can access all files in the workspace

### 4. Docker Integration

Test that Docker containers can be created and managed.

**Prerequisites**:
```bash
# Ensure Docker is installed and running
docker --version
docker ps
```

**Test Cases**:
- [ ] Create a new workspace
- [ ] Docker container is created successfully
- [ ] Container has correct environment
- [ ] Can access container files
- [ ] Container networking works
- [ ] Container cleanup works on task completion

### 5. Git Integration

Test Git operations within the workspace.

**Test Cases**:
- [ ] Clone repository
- [ ] Create branch
- [ ] View diff
- [ ] Commit changes
- [ ] Push changes
- [ ] Git credentials are properly handled

### 6. UI/UX Testing

**Test Cases**:
- [ ] All buttons are clickable
- [ ] Dropdowns work correctly
- [ ] Modals open and close properly
- [ ] Keyboard shortcuts work
- [ ] Window resizing works
- [ ] Dark mode is properly applied
- [ ] Platform-specific labels (File Manager vs Finder) are correct

## Performance Testing

### 1. Startup Time

```bash
time cmux
```

**Expected**: Application should start in < 5 seconds

### 2. Memory Usage

```bash
# Check memory usage while running
ps aux | grep cmux
```

**Expected**: Reasonable memory usage (< 500MB for base application)

### 3. Docker Build Time

**Expected**: Docker image builds in < 5 minutes on first build

## Distribution-Specific Testing

### Ubuntu 24.04 LTS

- [ ] Package installs correctly
- [ ] All features work
- [ ] GNOME integration works (Nautilus, gnome-terminal)

### Ubuntu 22.04 LTS

- [ ] Package installs correctly
- [ ] All features work
- [ ] GNOME integration works

### Fedora 40+

- [ ] Package installs correctly
- [ ] All features work
- [ ] GNOME integration works (if using GNOME)
- [ ] KDE integration works (if using KDE)

### Debian 12 (Bookworm)

- [ ] Package installs correctly
- [ ] All features work
- [ ] Desktop environment integration works

### Arch Linux (Community)

While not officially supported, many users may try cmux on Arch:

```bash
# Install from AppImage
chmod +x cmux-*.AppImage
./cmux-*.AppImage
```

### Pop!_OS

Built on Ubuntu, should work identically:
- [ ] Same tests as Ubuntu

## Troubleshooting Common Issues

### Issue: AppImage won't run

**Solution**:
```bash
# Install FUSE
sudo apt install fuse libfuse2  # Ubuntu/Debian
sudo dnf install fuse fuse-libs  # Fedora

# Or extract and run directly
./cmux-*.AppImage --appimage-extract
./squashfs-root/cmux
```

### Issue: Docker permission denied

**Solution**:
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Log out and back in
```

### Issue: File manager doesn't open

**Solution**:
```bash
# Install xdg-utils
sudo apt install xdg-utils  # Ubuntu/Debian
sudo dnf install xdg-utils  # Fedora

# Or install your preferred file manager
sudo apt install nautilus    # GNOME
sudo apt install dolphin     # KDE
sudo apt install thunar      # XFCE
```

### Issue: Terminal doesn't open

**Solution**:
```bash
# Install a terminal emulator
sudo apt install gnome-terminal  # GNOME
sudo apt install konsole         # KDE
sudo apt install xfce4-terminal  # XFCE
```

## Reporting Issues

When reporting Linux-specific issues, please include:

1. **Distribution**: Name and version (`lsb_release -a` or `cat /etc/os-release`)
2. **Architecture**: `uname -m`
3. **Desktop Environment**: GNOME, KDE, XFCE, etc.
4. **Installation Method**: AppImage, .deb, .rpm
5. **Error Messages**: Full error output
6. **System Logs**: Relevant logs from `journalctl` if applicable

Example:
```bash
# System info
cat /etc/os-release
uname -m
echo $DESKTOP_SESSION

# Application logs
journalctl --user -u cmux.service --since today
```

## Continuous Integration

Our CI automatically tests:
- Building packages for x64 and arm64
- Package integrity
- Basic smoke tests

See `.github/workflows/build-linux.yml` for details.
