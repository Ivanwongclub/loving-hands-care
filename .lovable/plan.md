## Goal
Rebrand the app to **Cereb**: install the attached CEREB logo (recolored to black with transparent background), replace every "Helping Hand" / "伸手助人協會" string with "Cereb", and remove the client-identifying email placeholder.

## What I found

**Logo assets**
- `src/assets/helping-hand-logo.webp` — used in 2 places
- `src/assets/logo.png` — unused leftover

**Logo usages (2)**
- `src/routes/login.tsx:10,64` — import + `<img alt="Helping Hand" />`
- `src/components/shells/AdminDesktopShell.tsx:15` — sidebar logo

**Brand text**
- `src/i18n/locales/en.json` → `brand.name: "Helping Hand"`, `brand.system: "Helping Hand HMS"`
- `src/i18n/locales/zh-HK.json` → `brand.name: "伸手助人協會"`, `brand.system: "Helping Hand HMS"`
- `src/routes/__root.tsx` → `title`, `og:title`, `twitter:title` all `"Helping Hand - HMS"`
- `src/routes/login.tsx:64` → `alt="Helping Hand"`
- `AGENTS.md` lines 1, 9 (heading + project description + "伸手助人協會")
- `STARTUP_REPORT.md` line 3

**Email placeholder**
- `src/routes/login.tsx:73` → `placeholder="name@helpinghand.org.hk"`

## Plan

### 1. Generate the new logo
Process `/mnt/user-uploads/image.png` (white CEREB on transparent bg, 1800×628):
- Invert white pixels to black, preserve alpha → transparent PNG.
- Save to `src/assets/cereb-logo.png`, then externalize via `lovable-assets create` to `src/assets/cereb-logo.png.asset.json` (keeps the repo light, matches asset conventions).
- Delete the old `src/assets/helping-hand-logo.webp` and unused `src/assets/logo.png`.

### 2. Swap the 2 logo usages
- `src/routes/login.tsx`: import the new asset pointer, render `<img src={cerebLogo.url} alt="Cereb" />`.
- `src/components/shells/AdminDesktopShell.tsx`: same swap.

### 3. Rename brand text → "Cereb"
- `src/i18n/locales/en.json` → `brand.name: "Cereb"`, `brand.system: "Cereb HMS"`.
- `src/i18n/locales/zh-HK.json` → `brand.name: "Cereb"`, `brand.system: "Cereb HMS"`.
- `src/routes/__root.tsx` → all three titles to `"Cereb - HMS"`.
- `src/routes/login.tsx` → `alt="Cereb"`.

### 4. Replace the email placeholder
- `src/routes/login.tsx:73` → `placeholder="name@example.com"`.

### 5. Scrub docs
- `AGENTS.md` heading and project description → "HMS Cereb" / "**Cereb HMS** — single-tenant enterprise Elderly Home Management System for a Hong Kong elderly care NGO." (drop the Chinese org name).
- `STARTUP_REPORT.md` line 3 → `Cereb`.

## Out of scope
- The deployed Lovable URL `loving-hands-care.lovable.app` (configured outside the repo).
- DB seed data (no client-identifying strings found there).
- Browser favicon (no custom favicon currently set).

## Verification
- `rg -i "helping hand|helpinghand|伸手"` over the repo returns zero hits.
- `/login` shows the black CEREB logo and `name@example.com` placeholder.
- Admin sidebar shows the black CEREB logo.
- Browser tab title reads "Cereb - HMS".
