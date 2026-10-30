# Werkinstructies, Release Protocol & SemVer Beleid: Helix Stadium Matrix Mixer Desktop

## 1. SemVer 2.0 Beleid (Semantic Versioning: `MAJOR.MINOR.PATCH`)
We hanteren strikt de officiële SemVer 2.0 richtlijnen:

* **MAJOR (`X.0.0`)**: 
  - Fundamentele architectuurwijzigingen, protocol-breuken (bijv. incompatibele MIDI routing/schema wijzigingen of cross-platform framework migraties).
* **MINOR (`1.X.0`)**:
  - Nieuwe functionele modules, extra kanaalbanken, MIDI features, netwerk/Wi-Fi hub uitbreidingen of significante UI-upgrades die backwards-compatible zijn.
* **PATCH (`1.8.X`)**:
  - Oplossen van bugs, fader/gain correcties, CSS/styling fixes, macOS/Windows package finetuning, beveiligings- en performance-verbeteringen en refactorings.

---

## 2. Release & Build Werkafspraak (Verplicht & Expliciet Vragen)
Na iedere substantiële wijziging of afronding van een feature:

1. **Build & Package**:
   - Voer `npm run build` uit (compileert Express server, Electron main process en React renderer).
   - Bouw indien van toepassing het macOS distributiepakket via `npm run dist:mac` (`release/Helix Matrix Mixer-X.Y.Z-arm64.dmg`).
2. **Expliciete Vraag aan Gebruiker**:
   - Vraag direct na het bouwen van een nieuwe releaseversie expliciet aan de gebruiker:
     > *"De build voor vX.Y.Z is geslaagd. Zal ik deze wijzigingen committen, taggen en als GitHub Release publiceren op `tooh/matrix-mixer-desktop`?"*
3. **Bij Goedkeuring / Bevestiging**:
   - Voer automatisch het onderstaande Release Protocol uit.

---

## 3. Release Protocol (Bij Iedere Formele Release)
Bij het uitbrengen van een release **MOETEN** altijd de volgende stappen synchroon worden uitgevoerd:

1. **Versienummering synchroon bijwerken**:
   - `package.json` (`"version": "X.Y.Z"`)
   - `build.js` (`const VERSION = 'X.Y.Z';`)
   - `src/renderer/components/App.tsx` (`const APP_VERSION = 'X.Y.Z';`)
   - `src/renderer/sw.js` (`const CACHE_NAME = 'matrix-mixer-vX.Y.Z';`)
   - `src/main/main.ts` (versieheader in server console logging)
   - `README.md` (downloadlink naar de nieuwste `.dmg` in `release/`)

2. **Build Verificatie**:
   - `npm run build`
   - Pakket gereed in `release/Helix Matrix Mixer-X.Y.Z-arm64.dmg`

3. **Git & GitHub Release**:
   - Commit alle gewijzigde bronbestanden met een duidelijke conventional commit (`feat(release): vX.Y.Z - beschrijving`).
   - Tag de release: `git tag vX.Y.Z`.
   - Push commit en tags naar GitHub: `git push origin main --tags`.
   - Publiceer de GitHub Release inclusief de `.dmg` binary als asset:
     ```bash
     gh release create vX.Y.Z "release/Helix Matrix Mixer-X.Y.Z-arm64.dmg" --title "vX.Y.Z - Korte Titel" --notes "Release notes..."
     ```
   - Bevestig aan de gebruiker met de directe link naar de GitHub release.
