# Helix Stadium 1.4 - Matrix Mixer Desktop 🎛️⚡

Portable, cross-platform Desktop Controller & Stage Wi-Fi Hub for the **Line 6 Helix Stadium 1.4 Matrix Mixer**.

Runs directly on **macOS** and **Windows** without requiring an external MySQL server, cloud service, or command-line dependencies.

---

## 📦 Ready-to-Use Portable Builds

Both builds are generated in `release/`:

* 🍏 **macOS:** [`Helix Matrix Mixer-1.9.0-arm64.dmg`](release/Helix Matrix Mixer-1.9.0-arm64.dmg)  
  *Open and drag to Applications, or run directly.*
* 🪟 **Windows Portable:** [`Helix Matrix Mixer-1.9.0-win.zip`](release/Helix%20Matrix%20Mixer-1.9.0-win.zip)  
  *Extract to any folder or USB stick and run `Helix Matrix Mixer.exe`. No installation required.*

---

## 🌟 Stage Architecture

```
[ AIRSTEP Footswitch ] ──(CME WIDI Wireless)──► [ Line 6 Helix Stadium ]
                                                        │
                                                 (USB MIDI Cable)
                                                        ▼
                              ┌─────────────────────────────────────────┐
                              │  Stage Laptop (MacBook or Windows PC)   │
                              │  ↳ Helix Matrix Mixer Desktop           │
                              │    • Direct USB MIDI to Helix Stadium   │
                              │    • Embedded Zero-Config Stage Server  │
                              │    • Local JSON storage (No MySQL)      │
                              └────────────────────┬────────────────────┘
                                                   │
                                     Local Stage Wi-Fi Router
                                                   │
                                ┌──────────────────┴──────────────────┐
                                ▼                                     ▼
                       [ FOH Sound Engineer ]                   [ Band Members ]
                    (iPad, Mac, Windows at FOH)             (iPhones / Smartphones)
                     ↳ Full 3-Layer Console Strip            ↳ Personal IEM (Phones)
```

---

## 🔐 Role-Based Access Control (RBAC)

The application enforces 3 roles across both client UI and server API endpoints:

### 1. ⚡ Administrator (`ADMIN`) — 19-Fader Engineering Overview
Full system overview showing all 19 matrix channels (Home Master, DSP Paths 1A-1D, Song, Tracks 1-8, Click, Count-In, and External Inputs) across all 3 layers.

![System Administrator Fader View](docs/screenshots/role-1-admin.png?raw=true&v=1.9.0-faders)

### 2. 🎛️ FOH Sound Engineer (`OPERATOR`) — 9-Fader Live Band Stems View
FOH console focused on the 9 band stems (Song Master, Drums, Bass, Piano, Guitar, Other, Vocals, Click, Cue) mapped to Matrix XLR Out for live audience mixing.

![FOH Sound Engineer Fader View](docs/screenshots/role-2-operator.png?raw=true&v=1.9.0-faders)

### 3. 🎧 Band Member (`BAND_MEMBER`) — 4-Fader In-Ear Monitor (IEM) View
Stage safety mode: automatically restricted to personal In-Ear monitor channels (Vocals, Song, Click, Cue) on Matrix Phones Out. The 1/4" Line and XLR Out tabs are locked to protect front-of-house sound.

![Band Member IEM Fader View](docs/screenshots/role-3-band-member.png?raw=true&v=1.9.0-faders)

---

## 🛠️ Build Commands

```bash
# Build frontend, server and Electron entry
npm run build

# Package macOS DMG
npm run dist:mac

# Package Windows Portable
npm run dist:win
```
