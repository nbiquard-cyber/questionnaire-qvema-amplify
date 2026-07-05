// QVEMA Amplify — Contrôle d'accès questionnaires
// Vérifie qu'un email correspond à une inscription (table Clients Airtable).
// Répond UNIQUEMENT { found: true|false } — aucune donnée personnelle n'est exposée.

const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN || "";
const AIRTABLE_BASE = process.env.AIRTABLE_BASE || "appUjhN2jh25MBAAl";
const CLIENTS_TABLE = "tblalRhenwmZZgenq"; // onglet "Clients"

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === "object") return resolve(req.body);
      try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); }
    }
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(JSON.parse(d || "{}")); } catch (_) { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

module.exports = async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "method_not_allowed" }));
  }
  if (!AIRTABLE_TOKEN) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "missing_token" }));
  }

  try {
    const body = await readBody(req);
    const email = (body.email || "").toString().trim();
    // Rejet des emails invalides ou contenant un guillemet (protège la formule Airtable).
    if (!EMAIL_RE.test(email) || email.indexOf('"') >= 0) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "invalid_email" }));
    }

    // Correspondance insensible à la casse et aux espaces.
    const formula = 'LOWER(TRIM({Email}))=LOWER("' + email + '")';
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE}/${CLIENTS_TABLE}`);
    url.searchParams.set("filterByFormula", formula);
    url.searchParams.set("maxRecords", "1");
    url.searchParams.append("fields[]", "Email");

    const r = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
    if (!r.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "airtable_error" }));
    }
    const j = await r.json();
    const found = Array.isArray(j.records) && j.records.length > 0;

    res.statusCode = 200;
    return res.end(JSON.stringify({ found }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "server_error" }));
  }
};
