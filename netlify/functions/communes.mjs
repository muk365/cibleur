import { jsonResponse, fetchWithTiming } from './_shared.mjs';

const FALLBACK_CITIES = [
  { name: 'Paris', insee: '75056', postal: '75001', departement: '75', population: 2145906, lat: 48.8566, lon: 2.3522 },
  { name: 'Lyon', insee: '69123', postal: '69001', departement: '69', population: 522250, lat: 45.7640, lon: 4.8357 },
  { name: 'Marseille', insee: '13055', postal: '13001', departement: '13', population: 873076, lat: 43.2965, lon: 5.3698 },
  { name: 'Toulouse', insee: '31555', postal: '31000', departement: '31', population: 504078, lat: 43.6047, lon: 1.4442 },
  { name: 'Bordeaux', insee: '33063', postal: '33000', departement: '33', population: 261804, lat: 44.8378, lon: -0.5792 },
  { name: 'Nantes', insee: '44109', postal: '44000', departement: '44', population: 323204, lat: 47.2184, lon: -1.5536 },
  { name: 'Lille', insee: '59350', postal: '59000', departement: '59', population: 236710, lat: 50.6292, lon: 3.0573 },
  { name: 'Rennes', insee: '35238', postal: '35000', departement: '35', population: 225081, lat: 48.1173, lon: -1.6778 },
  { name: 'Strasbourg', insee: '67482', postal: '67000', departement: '67', population: 291313, lat: 48.5734, lon: 7.7521 },
  { name: 'Montpellier', insee: '34172', postal: '34000', departement: '34', population: 302454, lat: 43.6108, lon: 3.8767 },
];

export async function handler(event) {
  const q = String(event.queryStringParameters?.q || '').trim();
  if (q.length < 2) return jsonResponse({ communes: [] });

  const isPostal = /^\d{2,5}$/.test(q);
  const param = isPostal ? `codePostal=${encodeURIComponent(q)}` : `nom=${encodeURIComponent(q)}`;
  const url = `https://geo.api.gouv.fr/communes?${param}&fields=nom,code,codesPostaux,centre,population,departement&boost=population&limit=8`;

  const res = await fetchWithTiming(url, { headers: { Accept: 'application/json' } }, 5000);
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        const communes = data.map((c) => {
          const coords = c.centre?.coordinates || [2.3522, 48.8566];
          return {
            name: c.nom || '',
            insee: c.code || '',
            postal: c.codesPostaux?.[0] || '',
            departement: c.departement?.code || String(c.code || '').slice(0, 2),
            population: c.population || 0,
            lon: Number(coords[0] ?? 2.3522),
            lat: Number(coords[1] ?? 48.8566),
          };
        });
        return jsonResponse({ communes, source: 'geo.api.gouv.fr' });
      }
    } catch {
      // fall through to fallback
    }
  }

  const needle = q.toLowerCase();
  const filtered = FALLBACK_CITIES.filter(
    (c) => c.name.toLowerCase().includes(needle) || c.postal.startsWith(needle)
  );
  return jsonResponse({ communes: filtered, source: 'fallback' });
}
