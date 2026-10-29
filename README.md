# Helix Stadium 1.4 - Matrix Mixer Desktop 🎛️⚡

Portable, cross-platform Desktop Controller & Stage Wi-Fi Hub for the **Line 6 Helix Stadium 1.4 Matrix Mixer**.

Runs directly on **macOS** and **Windows** without requiring an external MySQL server, cloud service, or command-line dependencies.

---

## 📦 Ready-to-Use Portable Builds

Both builds are generated in `release/`:

* 🍏 **macOS:** [`Helix Matrix Mixer-1.5.0-arm64.dmg`](release/Helix Matrix Mixer-1.5.0-arm64.dmg)  
  *Open and drag to Applications, or run directly.*
* 🪟 **Windows Portable:** [`Helix-Matrix-Mixer-1.5.0-Windows-Portable.zip`](release/Helix-Matrix-Mixer-1.5.0-Windows-Portable.zip)  
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

## 🛠️ Build Commands

```bash
# Build frontend, server and Electron entry
npm run build

# Package macOS DMG
npm run dist:mac

# Package Windows Portable
npm run dist:win
```
