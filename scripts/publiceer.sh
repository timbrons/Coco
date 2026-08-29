#!/usr/bin/env bash
# Zet Coco op coco.driessengroep.nl. Wordt door GitHub Actions gedraaid, maar werkt
# ook vanaf een laptop met SSH-toegang tot de VM.
#
# Alleen wat de browser nodig heeft gaat mee; server.js, public/ en node_modules zijn
# een oudere opzet die niet meer gebruikt wordt. index.html gaat als laatste, zodat de
# browser nooit een pagina krijgt die naar nog-niet-aanwezige bestanden verwijst.
set -euo pipefail
cd "$(dirname "$0")/.."

DOEL="buddy-admin@40.115.59.118:/data/caddy/apps/coco/"

rsync -az --delete \
  --include='index.html' --include='manifest.json' --include='service-worker.js' \
  --include='icon.svg' --include='*.png' --exclude='*' \
  --exclude='index.html' \
  ./ "$DOEL"
rsync -az index.html "$DOEL"
echo "Gepubliceerd naar https://coco.driessengroep.nl"
