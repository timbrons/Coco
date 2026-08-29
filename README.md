# Coco 🪶 — het schrijfmaatje van Jeroen Driessen

Coco is een vriendelijke AI-assistent die columns schrijft in de stijl van **Jeroen Driessen** (CEO Driessen Groep). Jeroen geeft een onderwerp en zijn eigen gedachten; Coco maakt een conceptcolumn die klinkt alsof Jeroen hem zelf schreef — persoonlijk, professioneel, luchtig en vaak rond één metafoor (zoals zijn eerdere columns *Kameleon*, *Tunnel*, *Goudkoorts* en *Flex!*).

## Wat Coco doet

- ✍️ **Schrijft een conceptcolumn** (max. 500 woorden) op basis van onderwerp + gedachten + aandachtspunten.
- 🗂️ **Bewaart alle verzoeken** in een doorzoekbare historie — makkelijk terug te vinden waar Jeroen een column over vroeg.
- 📌 **Legt de definitieve tekst vast** op een vaste plek: de map `columns/` als Markdown-bestand (kan een MS Teams-/SharePoint-map zijn).
- 📋 **Levert een kant-en-klare LinkedIn-post** (met hook en hashtags) om direct te publiceren op LinkedIn of Trends in HR.
- 📱 **Werkt als app op de iPhone**: een webadres dat Jeroen via "Zet op beginscherm" als app-snelkoppeling toevoegt (PWA).

## Snel starten

```bash
npm install
cp .env.example .env      # vul je ANTHROPIC_API_KEY in
npm start                 # draait op http://localhost:3000
```

Coco gebruikt het Claude-model `claude-opus-4-8` via de officiële Anthropic SDK.

## Als app op de iPhone zetten

1. Host Coco op een webadres met HTTPS (zie hieronder) en open dat in Safari op de iPhone.
2. Tik op het deel-icoon → **Zet op beginscherm**.
3. Coco verschijnt nu als app met eigen icoon. Klaar.

## Output op een vaste plek (MS Teams)

Definitieve columns worden opgeslagen in `columns/` als `JJJJ-MM-DD-titel.md`.
Wil je ze automatisch in een **MS Teams-kanaal**? Zet in `.env`:

```
COCO_COLUMNS_DIR=/pad/naar/gesynchroniseerde/Teams-map/Columns
```

Wijs dit naar een lokale map die via OneDrive/SharePoint met een Teams-kanaal synchroniseert. Elke vastgelegde column verschijnt dan automatisch in Teams.

## Waar Coco draait

https://coco.driessengroep.nl — alleen voor wie een Driessen-account heeft. Inloggen gaat via
Microsoft; op een werklaptop of een telefoon die al ingelogd is merk je daar niets van.

Er is geen server. `index.html` doet alles in de browser: schrijven via `api.anthropic.com` met
de sleutel die je zelf invult, opslag via Buddy Data (https://buddy.driessengroep.nl, pagina
`coco`, database `coco`, tabel `columns`). Er staat geen sleutel in de code.

`server.js` en `public/` zijn een oudere opzet die niet meer gebruikt wordt.

### Publiceren

Een push naar de hoofdbranch publiceert vanzelf (`.github/workflows/deploy-vm.yml`). Met de hand
kan ook, met SSH-toegang tot de VM:

```bash
./scripts/publiceer.sh
```

Faalt de workflow met "Permission denied", dan klopt het secret `VM_SSH_KEY` niet. Dat is een
privésleutel, base64-gecodeerd: `base64 -i ~/coco-deploy | pbcopy`.

### Zien wie wat gedaan heeft

https://buddy.driessengroep.nl/pages → Coco → **Wat er gebeurd is**.

## Hoe Coco klinkt

De schrijfstijl van Jeroen is vastgelegd in `coco-persona.js` (het systeemprompt). Daar pas je de toon, voorwaarden of het outputformaat aan.

## Projectstructuur

```
server.js          Express-server + Claude-integratie + opslag
coco-persona.js    De stem & schrijfstijl van Jeroen
public/            De web-app (PWA): UI, manifest, service worker, icoon
data/history.json  Historie van alle columnverzoeken
columns/           Definitieve columns (Markdown) — de vaste plek
```
