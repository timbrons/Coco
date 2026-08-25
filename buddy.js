/**
 * De verbinding met Buddy Data — de plek waar Coco zijn columns bewaart.
 *
 * Bewust een klein bestand zonder afhankelijkheden en geen npm-pakket: Coco is een eigen repo en
 * heeft geen toegang tot de agent-swarm-repo waar het echte client-pakket staat. Het spiegelt
 * `@driessen/buddy-client`; komt dat ooit in een register te staan, dan kan dit bestand eruit
 * zonder dat server.js verandert.
 *
 * De sleutel hier hoort bij de server, niet bij een persoon: Coco schrijft namens de organisatie.
 */

const config = {
  buddyUrl: (process.env.BUDDY_URL ?? 'http://localhost:5000').replace(/\/+$/, ''),
  dataUrl: (process.env.BUDDY_DATA_URL ?? 'http://localhost:5010').replace(/\/+$/, ''),
  project: process.env.BUDDY_PROJECT ?? 'coco',
  clientId: process.env.BUDDY_CLIENT_ID ?? '',
  clientSecret: process.env.BUDDY_CLIENT_SECRET ?? '',
};

/** Of Coco met Buddy Data praat. Zo niet, dan valt server.js terug op bestanden. */
export const buddyIsIngesteld = Boolean(config.clientId && config.clientSecret);

export class BuddyFout extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'BuddyFout';
    this.status = status;
  }
}

let token = null;
let tokenVerlooptOp = 0;

async function haalToken() {
  // Een minuut marge, zodat een token dat bij het versturen nog gold niet onderweg verloopt.
  if (token !== null && Date.now() < tokenVerlooptOp) return token;

  const antwoord = await fetch(`${config.buddyUrl}/api/buddy-data/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });

  if (!antwoord.ok) {
    throw new BuddyFout(
      'Inloggen bij Buddy Data mislukte. Controleer BUDDY_CLIENT_ID en BUDDY_CLIENT_SECRET.',
      antwoord.status,
    );
  }

  const body = await antwoord.json();
  token = body.access_token;
  tokenVerlooptOp = Date.now() + (body.expires_in - 60) * 1000;

  return token;
}

async function verzoek(pad, opties = {}) {
  const schrijft = opties.methode !== undefined && opties.methode !== 'GET';

  const antwoord = await fetch(`${config.dataUrl}${pad}`, {
    method: opties.methode ?? 'GET',
    headers: {
      Authorization: `Bearer ${await haalToken()}`,
      // De data-API bedient alle applicaties op één adres; deze header kiest de juiste.
      [schrijft ? 'Content-Profile' : 'Accept-Profile']: `app_${config.project}`,
      ...(opties.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      // Zonder dit komt er bij schrijven een lege body terug en heb je het toegekende id niet.
      ...(schrijft ? { Prefer: 'return=representation' } : {}),
    },
    body: opties.body === undefined ? undefined : JSON.stringify(opties.body),
  });

  const tekst = await antwoord.text();

  if (!antwoord.ok) {
    let melding = `Buddy Data gaf een fout (HTTP ${antwoord.status}).`;
    try {
      const body = JSON.parse(tekst);
      if (body.message) melding = [body.message, body.hint].filter(Boolean).join(' — ');
    } catch {
      // Geen JSON; dan is de statuscode het beste dat we hebben.
    }
    throw new BuddyFout(melding, antwoord.status);
  }

  return tekst === '' ? undefined : JSON.parse(tekst);
}

/** Eén rij uit de tabel terug naar de vorm die de rest van Coco gebruikt. */
function naarItem(rij) {
  return {
    id: rij.id,
    aangemaakt: rij.created_at,
    onderwerp: rij.onderwerp,
    gedachten: rij.gedachten ?? '',
    aandachtspunten: rij.aandachtspunten ?? '',
    concept: rij.concept,
    definitief: rij.definitief,
  };
}

export const buddy = {
  /** Alle columnverzoeken, nieuwste eerst. */
  async lijst() {
    const rijen = await verzoek('/columns?order=created_at.desc&limit=500');
    return rijen.map(naarItem);
  },

  async zoek(id) {
    const rijen = await verzoek(`/columns?id=eq.${encodeURIComponent(id)}`);
    return rijen.length > 0 ? naarItem(rijen[0]) : null;
  },

  async voegToe({ onderwerp, gedachten, aandachtspunten, concept }) {
    const [rij] = await verzoek('/columns', {
      methode: 'POST',
      body: { onderwerp, gedachten, aandachtspunten, concept, definitief: null },
    });

    return naarItem(rij);
  },

  /** Legt de definitieve versie vast bij een bestaand verzoek. */
  async legVast(id, definitief) {
    const rijen = await verzoek(`/columns?id=eq.${encodeURIComponent(id)}`, {
      methode: 'PATCH',
      body: { definitief },
    });

    // Een lege uitkomst betekent hier "geen rij met dit id"; de API geeft daar geen 404 voor.
    return rijen.length > 0 ? naarItem(rijen[0]) : null;
  },
};
