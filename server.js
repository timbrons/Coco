import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { SYSTEM_PROMPT, buildUserPrompt } from "./coco-persona.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const MODEL = process.env.COCO_MODEL || "claude-opus-4-8";

// Vaste plekken voor historie en definitieve columns.
// COLUMNS_DIR kan naar een gesynchroniseerde map wijzen (bv. een OneDrive/SharePoint-map
// die als kanaal in MS Teams is gekoppeld), zodat de output automatisch in Teams verschijnt.
const DATA_DIR = process.env.COCO_DATA_DIR || path.join(__dirname, "data");
const COLUMNS_DIR = process.env.COCO_COLUMNS_DIR || path.join(__dirname, "columns");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

for (const dir of [DATA_DIR, COLUMNS_DIR]) {
  fs.mkdirSync(dir, { recursive: true });
}
if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, "[]");
}

const anthropic = new Anthropic(); // leest ANTHROPIC_API_KEY uit de omgeving

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---------- Historie-helpers ----------
async function readHistory() {
  try {
    return JSON.parse(await fsp.readFile(HISTORY_FILE, "utf8"));
  } catch {
    return [];
  }
}
async function writeHistory(items) {
  await fsp.writeFile(HISTORY_FILE, JSON.stringify(items, null, 2));
}

function slugify(text) {
  return (text || "column")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "column";
}

// ---------- Endpoints ----------

// Lijst met alle eerdere columnverzoeken (makkelijk terug te vinden).
app.get("/api/history", async (_req, res) => {
  const items = await readHistory();
  items.sort((a, b) => new Date(b.aangemaakt) - new Date(a.aangemaakt));
  res.json(items);
});

app.get("/api/history/:id", async (req, res) => {
  const items = await readHistory();
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Niet gevonden" });
  res.json(item);
});

// Genereer een conceptcolumn op basis van Jeroens verzoek.
app.post("/api/columns", async (req, res) => {
  const { onderwerp, gedachten, aandachtspunten } = req.body || {};
  if (!onderwerp || !onderwerp.trim()) {
    return res.status(400).json({ error: "Geef een onderwerp op." });
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt({ onderwerp, gedachten, aandachtspunten }) }],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              titel: { type: "string" },
              column: { type: "string" },
              woorden: { type: "integer" },
              metafoor: { type: "string" },
              linkedin: { type: "string" },
              toelichting: { type: "string" },
            },
            required: ["titel", "column", "woorden", "metafoor", "linkedin", "toelichting"],
            additionalProperties: false,
          },
        },
      },
    });

    const text = response.content.find((b) => b.type === "text")?.text || "{}";
    const draft = JSON.parse(text);

    const item = {
      id: randomUUID(),
      aangemaakt: new Date().toISOString(),
      onderwerp: onderwerp.trim(),
      gedachten: (gedachten || "").trim(),
      aandachtspunten: (aandachtspunten || "").trim(),
      concept: draft,
      definitief: null, // wordt gevuld zodra Jeroen een versie vastlegt
    };

    const items = await readHistory();
    items.push(item);
    await writeHistory(items);

    res.json(item);
  } catch (err) {
    console.error("Generatiefout:", err);
    res.status(500).json({ error: "Coco kon even geen column maken. Probeer het opnieuw." });
  }
});

// Leg de definitieve columntekst vast op een vaste plek (map) + bewaar in historie.
app.post("/api/history/:id/publiceer", async (req, res) => {
  const { titel, column } = req.body || {};
  if (!column || !column.trim()) {
    return res.status(400).json({ error: "Geen columntekst om vast te leggen." });
  }

  const items = await readHistory();
  const item = items.find((i) => i.id === req.params.id);
  if (!item) return res.status(404).json({ error: "Niet gevonden" });

  const finaleTitel = (titel && titel.trim()) || item.concept?.titel || "Column";
  const datum = new Date().toISOString().slice(0, 10);
  const bestandsnaam = `${datum}-${slugify(finaleTitel)}.md`;
  const bestandspad = path.join(COLUMNS_DIR, bestandsnaam);

  const woorden = column.trim().split(/\s+/).filter(Boolean).length;
  const markdown =
    `# ${finaleTitel}\n\n` +
    `> Column door Jeroen Driessen, CEO Driessen Groep\n` +
    `> Vastgelegd op ${datum} · ${woorden} woorden · gemaakt met Coco\n\n` +
    `${column.trim()}\n`;

  await fsp.writeFile(bestandspad, markdown, "utf8");

  item.definitief = {
    titel: finaleTitel,
    column: column.trim(),
    woorden,
    bestand: bestandsnaam,
    vastgelegd: new Date().toISOString(),
  };
  await writeHistory(items);

  res.json({ ok: true, bestand: bestandsnaam, item });
});

// Download de definitieve markdown.
app.get("/api/history/:id/download", async (req, res) => {
  const items = await readHistory();
  const item = items.find((i) => i.id === req.params.id);
  if (!item?.definitief?.bestand) return res.status(404).json({ error: "Nog geen definitieve versie." });
  res.download(path.join(COLUMNS_DIR, item.definitief.bestand));
});

app.get("/healthz", (_req, res) => res.json({ ok: true, model: MODEL }));

app.listen(PORT, () => {
  console.log(`Coco draait op http://localhost:${PORT}`);
  console.log(`Definitieve columns worden bewaard in: ${COLUMNS_DIR}`);
});
