# 🚀 Kickstart & Architectuur Prompt: Enterprise Full-Stack Web/PWA Project

## 📋 Projectconfiguratie (Vul uitsluitend deze 4 parameters in)
* **Projectnaam (`PROJECT_NAAM`):** [PROJECT_NAAM] (bijv. `UrenRegistratie`)
* **Korte Omschrijving (`KORTE_OMSCHRIJVING`):** [KORTE_OMSCHRIJVING] (bijv. `Enterprise uren- en verlofregistratie PWA`)
* **Applicatie Poort (`PORT`):** [PORT] (bijv. `3002`)
* **Authenticatietype (`AUTH_TYPE`):** [AUTH_TYPE] (Kies: `PASSWORD` of `PIN` — standaard: `PASSWORD`)

### ⚙️ Automatisch afgeleide waarden (Tenzij expliciet anders gespecificeerd):
* **Database Naam (`DB_NAME`):** `[PROJECT_NAAM]` in snake_case (bijv. `uren_registratie`)
* **GitHub Repository (`GITHUB_REPO`):** `tooh/[PROJECT_NAAM]` (bijv. `tooh/UrenRegistratie`)
* **GitHub Zichtbaarheid:** `private`
* **macOS LaunchAgent (`DAEMON_SERVICE`):** `com.user.[PROJECT_NAAM]` in lowercase (bijv. `com.user.urenregistratie`)
* **macOS LaunchAgent Plist:** `~/Library/LaunchAgents/${DAEMON_SERVICE}.plist`
* **Daemon Logs:** `logs/stdout.log` en `logs/stderr.log` in de projectmap

---

## Opdracht aan de Assistent
Leid de ontbrekende variabelen af op basis van bovenstaande conventies en start dit project vanaf scratch op conform het **Enterprise Project Framework**. Richt de volledige structuur, beveiliging, documentatie, back-upstrategie en release-protocollen in zoals hieronder gedefinieerd:

---

### 1. Technologie-Stack & Architectuur

1. **Backend (Node.js / Express / TypeScript)**:
   - TypeScript gecompileerd via **esbuild** naar `dist/server.js`.
   - Luistert standaard op poort `[PORT]` (configureerbaar via `.env` en `process.env.PORT`).
   - SQLite of MySQL/MariaDB (`mysql2/promise` met connection pool & `utf8mb4_unicode_ci`, database: `[DB_NAME]`).
   - **Database Security Hardening (Conform OWASP & CIS Database Benchmark)**:
     - **Principle of Least Privilege (PoLP) (CIS 3.x / OWASP)**: Gebruik NOOIT het MySQL `root`-account voor de runtime applicatieverbinding. Hanteer strikt PoLP: richt een applicatiespecifieke service-account in (bijv. `[project]_app`) met uitsluitend minimaal benodigde DML (`SELECT, INSERT, UPDATE, DELETE`) en opstartmigratie DDL (`CREATE, ALTER, INDEX, REFERENCES`) rechten op het applicatieschema `[DB_NAME]`. Strikt géén administrative privileges (`SUPER`, `PROCESS`, `FILE`, `SHUTDOWN`, `GRANT OPTION`), en géén toegang tot andere databases of `mysql.*`.
     - **Host-Restrictie & Authenticatie (CIS 3.2)**: Accounts worden strikt gekoppeld aan `127.0.0.1` of `localhost` (geen wildcard `%` hosts). Geen anonieme gebruikersaccounts (`anonymous users = 0`).
     - **Strikte Schema-Isolatie & Verbod op Cross-Database Fallbacks**: De applicatie verbindt te allen tijde uitsluitend en direct met zijn eigen geconfigureerde schema (`[DB_NAME]`). Fallbacks naar schema's van andere applicaties zijn ten strengste verboden. Indien `[DB_NAME]` onbereikbaar is, weigert de applicatie de serverstart met een duidelijke foutmelding (`500 Server Configuration Error`).
     - **Systeem- & Bestandveiligheid (CIS 2.x)**: `local_infile = OFF` afgedwongen ter preventie van arbitraire bestandsuitlezing. Geen testdatabases (`test`, `test_%`).
     - **SQL Injection Preventie & Prepared Statements (OWASP SQLi)**: 100% van de dynamische queries moet gebruikmaken van parameterized queries (`?` placeholders) of prepared statements. String-concatenatie of template-literals in query-structuren zijn verboden.
     - **Netwerkinsluiting & Localhost Binding (CIS 5.x)**: De database luistert uitsluitend op `127.0.0.1` (localhost) of via beveiligde UNIX domain sockets (`/tmp/mysql.sock`). Geen publieke externe netwerkexpositie zonder TLS-encryptie en firewall-whitelisting.
     - **Secrets & Credentials Management**: Wachtwoorden worden cryptografisch veilig opgeslagen in `.env` (strikt uitgesloten via `.gitignore`). In `.env.example` staan uitsluitend dummy-placeholders. Geen hardcoded database credentials in de broncode.
     - **Audit Logging & Preventie van Information Disclosure (CIS 4.x / OWASP)**: Databasefouten worden gelogd zonder gevoelige connectiestrings, wachtwoorden of queryparameters te lekken.
     - **Back-up Beveiliging & Rechten (CIS 6.x)**: Back-upbestanden in `backups/` worden beveiligd met strikte bestandssysteemrechten (map `0700`, bestanden `0600`).
   - **Zero-Downtime Startup Migraties**: Bij start voert de server `runMigrations()` uit met `CREATE TABLE IF NOT EXISTS` en dynamische kolomcontroles via `SHOW COLUMNS LIKE '...'` / `ALTER TABLE ADD COLUMN`.
   - **Non-blocking Process Execution**: Externe tools zoals de GitHub CLI `gh` worden uitsluitend aangeroepen via `execFileAsync` (geen shell-interpolatie), met 15s timeouts en non-interactive flags (`GH_PROMPT_DISABLED=1`, `GH_NO_UPDATE_NOTIFIER=1`, `NO_COLOR=1`).
   - **Executive Rapportage Generatie**: Ondersteuning voor server-side generatie van 16:9 presentaties (`.pptx`) via `pptxgenjs` voor periodieke management- en voortgangsrapportages.
   - **Strategisch PMO & Portfolio Management**: Ondersteuning voor projectprioritering (P1 t/m P4), weging op Business Value (0-100), RAG-stoplichten en gestructureerde management-overzichten.
   - **Gespecialiseerde Facturatieregimes & Vrijstellingen**: Ondersteuning voor dedicated factuurtypes (bijv. `DOCENTENFACTUUR` met wettelijke onderwijsvrijstelling *art. 11 lid 1 sub o Wet OB 1968*), flexibele eenheden (dagdelen, km) en meervoudige BTW-regimes.
   - **Creditnota & Vereffeningscyclus**: Volledige cyclus voor 100% en deelse creditering met automatische vereffening en status-transities (`GECREDITEERD`, `VERREKEND`) conform accountingrichtlijnen.
   - **REST API & OpenAPI 3.0 / Swagger Documentatie**: Volledige specificatie van alle endpoints via `docs/openapi.yaml` en `docs/openapi.json`. Express serveert een interactieve Swagger UI op `GET /api-docs` en machine-leesbare endpoints op `GET /api/openapi.json` en `GET /api/openapi.yaml`.

2. **Frontend (React 19 / TypeScript / PWA)**:
   - Single Page Application gebundeld door **esbuild** naar `dist/renderer/index.js`.
   - **Volledige PWA functionaliteit & Applicatie-icoon**:
     - **Hoogwaardig Domein-specifiek Icoon (`src/renderer/icon.png`)**: Elk project wordt standaard direct voorzien van een professioneel 1024×1024 applicatie-icoon (PNG), specifiek afgestemd op het thema en doel van de applicatie.
     - **Web App Manifest (`src/renderer/manifest.json`)**: Geconfigureerd met `short_name`, `name`, `icons` (192×192, 512×512, 1024×1024), `start_url`, `theme_color`, `background_color` en `display: standalone`.
     - **HTML & iOS Head Tags (`src/renderer/index.html`)**: Gekoppeld met `<link rel="icon" type="image/png" href="icon.png">`, `<link rel="apple-touch-icon" href="icon.png">`, `<link rel="manifest" href="manifest.json">`, en Apple iOS meta tags (`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`).
     - **In-App Branding**: De zijbalk/header van de applicatie toont standaard het officiële `icon.png` beeldmerk.
     - **Service Worker (`sw.js`)**: Met automatische cache-versie invalidatie (`CACHE_NAME = '[PROJECT_NAAM]-cache-v' + VERSION`).
   - **Unified API Client (`src/renderer/api.ts`)**: Wrapper rondom `fetch()` met een `AbortController` (30s timeout) om te voorkomen dat de UI bij netwerkproblemen blijft hangen.
   - **Design System & UI**:
     - Moderne donkere of instelbare interface met CSS variabelen.
     - **Compacte Enterprise Tabel-densiteit**: Standaard rijhoogte van ~38px voor efficiënt databeheer zonder overmatig scrollen.
     - Responsive mobile-first actiebalken (floating docks) voor kritieke acties.

3. **Build & Release Pipeline (`build.js`)**:
   - Centraal script met `--watch` en `--push` opties.
   - Injecteert automatisch `VERSION` in `dist/renderer/version.txt`, `sw.js` en de HTML-bundles.
   - Kopieert via `copyAssets()` synchroon `index.html`, `styles.css`, `manifest.json` én `icon.png` naar `dist/renderer/`.
   - Biedt een endpoint `GET /version.txt` dat zonder caching de actuele versie retourneert.

---

### 2. Authenticatie, Beveiliging & RBAC (Role-Based Access Control)

1. **Authenticatie-implementatie op basis van `[AUTH_TYPE]`**:
   - **Indien `AUTH_TYPE = PASSWORD` (Veilige Credentials-Flow)**:
     - **Geen User Enumeration**: Toon NOOIT een openbare dropdown met gebruikers op het inlogscherm. De frontend laadt vóór authenticatie geen gebruikerslijsten.
     - **Inlogvelden**: Eén gecombineerd invoerveld voor **Gebruikersnaam of E-mailadres** (`<input type="text" autocomplete="username">`) en een **Wachtwoordveld** (`<input type="password">` met toon/verberg toggle).
     - **Backend Validatie**: De backend zoekt veilig op `LOWER(email) = ? OR LOWER(gebruikersnaam) = ? OR LOWER(naam) = ?` en verifieert de hash.
     - **Generieke Foutmelding**: Bij onjuiste invoer altijd melden: *"Ongeldige gebruikersnaam/e-mail of wachtwoord"*, om account-probing tegen te gaan.
     - **Wachtwoord-opslag**: Wachtwoorden worden cryptografisch gehasht opgeslagen (SHA-256 of PBKDF2).
     - **Opt-in "Onthoud mij"**: Mogelijkheid om op het lokale apparaat uitsluitend de laatst ingevoerde gebruikersnaam/e-mail te onthouden via `localStorage`.
   - **Indien `AUTH_TYPE = PIN`**:
     - Snelle numerieke PIN-ontgrendeling (4 of 6 cijfers) met visueel toetsenpaneel/PIN-dots.
     - Gehasht via `crypto.pbkdf2Sync` met salt en `timingSafeEqual`.

2. **Rollen- en Rechtenmatrix (RBAC)**:
   - Databasetabellen via startup-migraties: `security_roles`, `permissions`, en `role_permissions`.
   - Standaard rollen geïnitieerd:
     - `ADMIN`: Volledige toegang tot alle modules, instellingen, gebruikersbeheer en audit-logs.
     - `BACK_OFFICE` / `BEHEERDER`: Toegang tot operationele data, mutaties en rapportages, geen systeemconfiguratie.
     - `USER` / `MEDEWERKER`: Uitsluitend toegang tot eigen gegevens.

3. **API Security Headers & Session Context**:
   - Client (`src/renderer/api.ts`) stuurt bij ieder verzoek authenticatie-headers mee (`X-User-Id`, `X-User-Role`).
   - Backend valideert de rol per route. Gevoelige endpoints vereisen minimaal de `ADMIN`-rol.

4. **UI-niveau Autorisatie (Guards)**:
   - Tabbladen, menu-items en beheeracties worden conditioneel gerenderd op basis van de ingelogde gebruikersrol.

5. **Secrets, Omgevingsvariabelen & `.env.example` Beveiligingsbeleid**:
   - **Geen hardcoded secrets in broncode**: Hardcoded fallback-wachtwoorden (zoals `process.env.ADMIN_PASSWORD || 'default123'`) zijn ten strengste verboden. Indien een vereiste omgevingsvariabele voor authenticatie ontbreekt in `process.env`, moet de backend een duidelijke configuratiefout (`500 Server Configuration Error`) teruggeven of de serverstart weigeren.
   - **Gesaniteerde `.env.example`**: In `.env.example` mogen NOOIT echte, operationele of als wachtwoord herkenbare default-strings staan. Gebruik uitsluitend duidelijke dummy placeholders zoals `ADMIN_PASSWORD=change_this_to_a_secure_password` en `DB_PASSWORD=your_secure_db_password`.
   - **Geheimen uitsluiten van Git**: Het actieve `.env` bestand moet direct bij initialisatie in `.gitignore` worden opgenomen en mag onder geen beding naar GitHub worden gecommit of gepusht.

---

### 3. Geautomatiseerd Back-up & Retentie Framework

1. **Database Back-up Engine (`database/backup.js`)**:
   - Automatische exports naar de map `backups/` met timestamp: `backup_[DB_NAME]_YYYYMMDD_HHMMSS.sql`.
   - Zowel handmatig (`npm run db:backup`) als automatisch aan te roepen.
   - Ondersteunt `--daily` vlag: slaat de back-up over als er vandaag al een dagelijkse back-up is geslaagd.
   - **Retentiebeleid**: Behoudt automatisch de laatste 14 dagelijkse back-ups en ruimt oudere bestanden op.
2. **Geïntegreerde Scheduler (`src/main/backupScheduler.ts`)**:
   - Start bij het opstarten van de Express server.
   - Voert direct een controle uit en pollt daarna elk uur op de achtergrond.
3. **Restore Script (`database/restore.js`)**:
   - Herstelcommando (`npm run db:restore`) dat interactief of met bestandsargument een SQL-dump terugleest.

---

### 4. In-App Documentatie & Handboeken Viewer

De applicatie bevat een ingebouwde documentatiemodule (`DocumentatieModal.tsx`) die via de navigatiebalk te openen is en documenten realtime inleest via `POST /api/docs/read`:

1. **Functioneel Applicatiebeheer Handboek (`docs/Functioneel_Applicatiebeheer_FAM.md`)**:
   - Rollen- en autorisatiematrix (FAM sectie 2).
   - Veilige inlogprocedure en privacyrichtlijnen.
   - Functionele procesflows per module (inclusief Mermaid sequence & flowchart diagrammen).
   - Periodieke taken (dag-, maand- en jaarafsluiting).
2. **Technisch Applicatiebeheer Handboek (`docs/Technisch_Applicatiebeheer_TAM.md`)**:
   - Volledige systeemarchitectuur en poortconfiguratie (`[PORT]`).
   - Hosting- en deploymentscenario's (Linux VPS met Nginx systemd reverse proxy, Cloudflare Tunnel, of macOS LaunchAgent `[DAEMON_SERVICE]`).
   - Datamodel, RBAC-tabellen, indexering en migratiestrategie.
   - Externe integraties, beveiligingshardening (least-privilege db-user, UFW) en logging.
3. **Changelog & Release Notes (`CHANGELOG.md` & `docs/CHANGELOG.md`)**:
   - Vaste Keep a Changelog indeling (`Toegevoegd`, `Gewijzigd`, `Opgeschoond`, `Opgelost`).
   - Synchroon gehouden tussen root en `/docs`.
4. **Mermaid Diagram Renderer**:
   - Ingebouwde parser in de DocumentatieModal die codeblokken met `mermaid` grafisch rendert in dark-theme stijl.
   - Ingebouwde `🖨️ Print / Exporteer naar PDF` knop.
5. **REST API & OpenAPI 3.0 / Swagger UI Specificatie**:
   - Volledige machinespecificatie in `docs/openapi.yaml` en `docs/openapi.json`.
   - Interactieve Swagger UI console bereikbaar via `GET /api-docs` en dedicated tabblad `🔌 REST API (OpenAPI)` in de `DocumentatieModal`.
6. **OWASP & CIS Database Security Hardening Controle Rapport (`docs/Database_Security_Hardening_Report.md`)**:
   - Formeel compliancerapport getoetst aan het [OWASP Database Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Database_Security_Cheat_Sheet.html) én de [CIS Database Benchmark](https://www.cisecurity.org/benchmark/mysql).
   - Bevat een gestructureerde checklist over de beveiligingspijlers (Least Privilege / PoLP, Query Parameterization, Host-restricties, `local_infile=OFF`, Schema-isolatie, Netwerkbinding, Wachtwoord- & Secretbeleid, Information Disclosure, Logging & Auditing, Back-upintegriteit).
   - **Verplichte oplevering en toetsing bij de initiële release (v1.0.0) en bij iedere opvolgende minor release (`X.Y.0`)**.
7. **ISO/IEC 27001 Compliance Rapport (`docs/ISO27001_Compliance_Report.md`)**:
   - Formeel ISMS-compliancerapport getoetst aan de **ISO/IEC 27001:2022** normering (inclusief Annex A: Organisational Controls A.5, People Controls A.6, Physical Controls A.7 en Technological Controls A.8).
   - Behandelt cryptografie, toegangsbeveiliging (RBAC & PoLP), netwerk- en applicatie-isolatie, datalekpreventie (DLP), backupintegriteit, supply-chain security (Dependabot) en de Secure Software Development Life Cycle (SSDLC).
   - **Verplichte oplevering en toetsing bij de initiële release (v1.0.0) en bij iedere opvolgende minor release (`X.Y.0`)**.

---

### 5. In-App GitHub Scrum Issue Logger

In de navigatiebalk is een knop `🐞 Scrum Melding` aanwezig:
- Modal venster met keuze uit: `🐛 Bug`, `📖 User Story`, `✨ Feature Request` of `⚡ Taak`.
- Prioriteit (`P1 - Kritiek` t/m `P4 - Laag`) en module-keuze.
- Automatisch gegenereerde Markdown template (met eigenschappentabel, actuele app-versie, context, reproductiestappen of acceptatiecriteria).
- Roept `POST /api/github/create-issue` aan, die via `execFileAsync` de GitHub CLI aanroept om direct een issue aan te maken in de repository `[GITHUB_REPO]`.
- Geeft de gebruiker direct de hyperlink en het issue-nummer (#X) terug.

---

### 6. Regelbestand voor AI Agents (`GEMINI.md`)

Genereer in de projectroot direct het `GEMINI.md` regelbestand met het bindende releaseprotocol:

```markdown
# Werkinstructies, Release Protocol & SemVer Beleid: [PROJECT_NAAM]

## 1. SemVer 2.0 Beleid (Semantic Versioning: `MAJOR.MINOR.PATCH`)
* **MAJOR (`X.0.0`)**: Breaking changes of incompatibele datamodel/architectuurwijzigingen.
* **MINOR (`1.X.0`)**: Nieuwe features, modules of uitbreidingen (backwards-compatible).
* **PATCH (`1.0.X`)**: Bugfixes, CSS correcties, kleine aanpassingen en performance-patches.

## 2. Sprint & Milestone Cyclus (Gebundelde Releases)
1. **GitHub Milestones als Release Container**:
   - We hanteren vaste **2-wekelijkse sprints** volgens de conventie **`Sprint JJ/WW`** (waarin `JJ` het 2-cijferig jaartal is en `WW` het weeknummer van aanvang).
   - Maak vóór aanvang van een sprint een GitHub Milestone aan met het formaat: `Sprint JJ/WW - vX.Y.Z: Korte Beschrijving` (bijv. `Sprint 26/41 - v1.1.0: Basisfunctionaliteit`).
   - Koppel gerelateerde issues aan deze milestone.
2. **Issue Labeling**:
   - `type: feature` (Blauw) $\rightarrow$ Triggert MINOR verhoging (`1.1.0`).
   - `type: bug` (Rood) $\rightarrow$ Triggert PATCH verhoging (`1.0.1`).
   - `type: enhancement`, `type: documentation`, `type: breaking`.
   - `module:[naam]`, `prio: P1-kritiek` t/m `prio: P4-laag`.
3. **Sprint Oplevering = Formele Release**:
   - Issues worden tijdens de sprint ontwikkeld, lokaal getest en gesloten.
   - Pas bij het afronden van de complete Milestone (of tussentijdse hotfix) wordt het release- en documentatieprotocol uitgevoerd.

## 3. Release & Documentatie Protocol (Bij Iedere Gebundelde Release)
Bij het afronden van een Milestone of het uitbrengen van een release MOETEN altijd de volgende stappen synchroon worden uitgevoerd:

1. **Versienummering**:
   - Bepaal het nieuwe versienummer op basis van de gesloten issues (bevat feature $\rightarrow$ Minor; uitsluitend fixes $\rightarrow$ Patch).
   - Werk de versie synchroon bij in:
     - `build.js` (`const VERSION = '...'`)
     - `package.json` (`"version": "..."`)
     - `src/main/ipc.ts` (bij Scrum issue template `Gemeld via`)
     - `src/renderer/components/App.tsx` (versielabel in UI)
     - `docs/Functioneel_Applicatiebeheer_FAM.md` (header `* **Versie:**`)
     - `docs/Technisch_Applicatiebeheer_TAM.md` (header `* **Versie:**`)

2. **Changelog**:
   - Voeg een gebundelde versiesectie bovenaan toe in `CHANGELOG.md` onder `## [X.Y.Z] - YYYY-MM-DD`.
   - Zorg dat `docs/CHANGELOG.md` exact synchroon blijft met root `CHANGELOG.md`.

3. **Handboeken, OpenAPI, Database Security & ISO 27001 actualiseren**:
   - **FAM**: Werk procesbeschrijvingen en eventuele rechten/rollen bij. Werk datum bij.
   - **TAM**: Werk tabellen, API-endpoints, architectuur of integraties bij. Werk datum bij.
   - **OpenAPI**: Bij iedere **minor release** (of toevoeging/wijziging van endpoints) moet de OpenAPI specificatie (`docs/openapi.yaml` en `docs/openapi.json`), Swagger UI (`/api-docs`) en de API-sectie in het TAM synchroon worden bijgewerkt.
   - **OWASP & CIS Database Security Hardening Rapport**: Bij iedere **minor release** (of architectuurwijziging in de datalaag) MOET het controle rapport (`docs/Database_Security_Hardening_Report.md`) conform het OWASP Database Security Cheat Sheet én de CIS Database Benchmark worden geactualiseerd, getoetst en formeel worden opgeleverd.
   - **ISO/IEC 27001 Compliance Rapport**: Bij iedere **minor release** MOET het rapport (`docs/ISO27001_Compliance_Report.md`) getoetst en geactualiseerd worden tegen het ISO/IEC 27001:2022 Annex A controlekader.

4. **Build & Verificatie**:
   - Voer `npm run build` uit.
   - Herstart de achtergronddaemon met `BypassSandbox: true`: `launchctl kickstart -k gui/$(id -u)/[DAEMON_SERVICE]`.
   - Vaste conventiepaden: Plist `~/Library/LaunchAgents/[DAEMON_SERVICE].plist`, logs `logs/stdout.log` en `logs/stderr.log`.
   - Valideer met `BypassSandbox: true`: `curl -s http://localhost:[PORT]/version.txt` (controleer op HTTP 200 en juiste versie).

5. **Git & GitHub Release**:
   - Commit alle gewijzigde bestanden, tag `vX.Y.Z`, push naar `origin main`.
   - Maak een GitHub release aan (`gh release create vX.Y.Z ...`) en sluit de bijbehorende Milestone.
```

---

### 7. Startopdracht & GitHub Initialisatie
Voer direct de initiële setup uit:
1. Initialiseer `git init` lokaal en maak direct `.gitignore` (inclusief `.env`, `node_modules`, `dist`, `logs/`, `backups/`). Maak `package.json`, `tsconfig.json`, `.env` (met lokale parameters) en een strikt geschoonde `.env.example` (met uitsluitend dummy placeholders zoals `ADMIN_PASSWORD=change_this_to_a_secure_password`).
2. Richt de mappenstructuur in (`src/main/`, `src/renderer/`, `docs/`, `database/`, `backups/`, `templates/`). Genereer direct een representatief 1024×1024 `src/renderer/icon.png` applicatie-icoon en koppel deze met `manifest.json`, `index.html` en het sidebar/brand component.
3. Richt het RBAC datamodel in (`security_roles`, `permissions`, `role_permissions`) en seed de standaard rollen (`ADMIN`, `BACK_OFFICE`, `USER`). Zorg dat de backend authenticatie geen hardcoded fallback-wachtwoorden bevat.
4. Maak `GEMINI.md`, `CHANGELOG.md`, `docs/Functioneel_Applicatiebeheer_FAM.md`, `docs/Technisch_Applicatiebeheer_TAM.md`, `docs/Database_Security_Hardening_Report.md` en `docs/ISO27001_Compliance_Report.md` aan met startversie `1.0.0`.
5. Richt `build.js` en de Express-server in, en valideer de build met `npm run build`.
6. **GitHub Dependabot & Supply Chain Security**:
   - Maak `.github/dependabot.yml` aan met wekelijkse gebundelde (`groups`) updates voor `minor` en `patch` npm-dependencies op maandagochtend 08:00 (`Europe/Amsterdam`), voorzien van de standaard projectlabels (`module: beheer`, `type: enhancement`, `prio: P3-normaal`) en commit-prefix `chore(deps)`.
7. **Automatische GitHub Private Repository Setup & Push**:
   - Controleer via de GitHub CLI of repository `[GITHUB_REPO]` al bestaat (`gh repo view [GITHUB_REPO]`).
   - Zo niet, maak hem direct aan als private repository en koppel/push de initiële branch via:
     `gh repo create [GITHUB_REPO] --private --source=. --remote=origin --push`
   - Schakel direct Dependabot Vulnerability Alerts en Automated Security Fixes in via:
     `gh api -X PUT repos/[GITHUB_REPO]/vulnerability-alerts`
     `gh api -X PUT repos/[GITHUB_REPO]/automated-security-fixes`
   - Commit alle initiële bestanden als `"feat: initial commit v1.0.0 framework"`, tag de release met `git tag v1.0.0`, push naar `origin main --tags` en publiceer de GitHub Release via `gh release create v1.0.0`.
