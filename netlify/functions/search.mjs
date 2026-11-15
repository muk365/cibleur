import {
  OETH_BRACKETS,
  ROME_CATALOG,
  jsonResponse,
  computeOethMetrics,
  getFtCredentials,
  fetchWithTiming,
  normalizeSireneCompany,
  verifyWebsitesBatch,
  finalizeCompanyScore,
} from './_shared.mjs';

function buildDemoResults(romeInfo, city, smicHourly) {
  const samples = [
    {
      siren: '479144438', siret: '47914443800161', name: 'INCOMM SOLUTIONS DIGITALES',
      category: 'PME', naf: romeInfo.nafs[0] || '62.01Z',
      address: '2 RUE DE LA BLANCHERIE 33370 ARTIGUES-PRES-BORDEAUX', postal_code: '33370',
      city: city || 'BORDEAUX', departement: '33', lat: 44.8533, lon: -0.5030,
      bracket: '12', open_sites: 15, leader: "Aimé N'GUETTA (Président de SAS)",
      ca: 12400000, net: 640000, rse: ['Index Egapro publié', 'Convention Syntec'],
      website: 'https://www.incomm.fr', hiring: 4.45,
    },
    {
      siren: '389836966', siret: '38983696600122', name: 'ALTEN SA (DIVISION INGENIERIE & SI)',
      category: 'GE', naf: romeInfo.nafs[1] || '62.02A',
      address: '40 AVENUE ANDRE MORIZET 92100 BOULOGNE-BILLANCOURT', postal_code: '92100',
      city: city || 'PARIS', departement: '92', lat: 48.8355, lon: 2.2412,
      bracket: '52', open_sites: 42, leader: 'Simon AZOULAY (PDG)',
      ca: 1850000000, net: 112000000, rse: ['Index Egapro publié', 'Label Achats Responsables', 'Bilan GES publié'],
      website: 'https://www.alten.fr', hiring: 4.82,
    },
    {
      siren: '424761419', siret: '42476141900045', name: 'OVH GROUPE (CLOUD & INFRASTRUCTURE)',
      category: 'GE', naf: '63.11Z',
      address: '2 RUE KELLERMANN 59100 ROUBAIX', postal_code: '59100',
      city: city || 'LILLE', departement: '59', lat: 50.6915, lon: 3.2016,
      bracket: '42', open_sites: 12, leader: 'Benjamin REVCOLEVSCHI (Directeur Général)',
      ca: 993000000, net: 28500000, rse: ['Index Egapro publié', 'Bilan GES publié'],
      website: 'https://www.ovhcloud.com', hiring: 4.65,
    },
    {
      siren: '493680490', siret: '49368049000039', name: 'DOCTOLIB TECH & PRODUIT',
      category: 'ETI', naf: '62.01Z',
      address: '54 QUAI CHARLES PASQUA 92300 LEVALLOIS-PERRET', postal_code: '92300',
      city: city || 'PARIS', departement: '92', lat: 48.8988, lon: 2.2831,
      bracket: '41', open_sites: 8, leader: 'Stanislas NIOX-CHATEAU (Président)',
      ca: 280000000, net: 14500000, rse: ['Société à mission', 'Index Egapro publié'],
      website: 'https://www.doctolib.fr', hiring: 4.70,
    },
    {
      siren: '453035081', siret: '45303508100028', name: 'OCTO TECHNOLOGY (ACCENTURE)',
      category: 'ETI', naf: '62.02A',
      address: '34 AVENUE DE L OPERA 75002 PARIS', postal_code: '75002',
      city: city || 'PARIS', departement: '75', lat: 48.8691, lon: 2.3335,
      bracket: '32', open_sites: 4, leader: 'Ludovic CINQUIN (Directeur Général)',
      ca: 96000000, net: 7200000, rse: ['Index Egapro publié', 'Label Achats Responsables'],
      website: 'https://www.octo.com', hiring: 4.35,
    },
    {
      siren: '521983320', siret: '52198332000019', name: 'ATELIER INCLUSIF & CODE SCOP',
      category: 'PME', naf: romeInfo.nafs[0] || '62.01Z',
      address: '18 RUE LA FAYETTE 44000 NANTES', postal_code: '44000',
      city: city || 'NANTES', departement: '44', lat: 47.2165, lon: -1.5568,
      bracket: '21', open_sites: 2, leader: 'Camille MOREAU (Gérante SCOP)',
      ca: 6800000, net: 490000, rse: ['ESS (Économie Sociale & Solidaire)', 'Société à mission'],
      website: 'https://www.scop-numerique.fr', hiring: 4.25,
    },
  ];

  return samples
    .map((s) =>
      finalizeCompanyScore({
        siren: s.siren,
        siret: s.siret,
        name: s.name,
        sigle: null,
        category: s.category,
        naf: s.naf,
        address: s.address,
        postal_code: s.postal_code,
        city: s.city,
        departement: s.departement,
        lat: s.lat,
        lon: s.lon,
        date_creation: '2012-03-14',
        open_sites: s.open_sites,
        leader: s.leader,
        finances: { year: '2024', ca: s.ca, resultat_net: s.net },
        rse_signals: s.rse,
        idcc: ['1486'],
        oeth: computeOethMetrics(s.bracket, smicHourly),
        hiring: { score_5: s.hiring, potential: 'high', source: 'Démo LBB × SIRENE' },
        website: s.website,
        website_verified: true,
        website_status: 200,
        website_latency_ms: 118,
      })
    )
    .sort((a, b) => b.composite_score - a.composite_score);
}

export async function handler(event) {
  const startTime = Date.now();
  const q = event.queryStringParameters || {};

  const rome = String(q.rome || 'M1805').trim().toUpperCase();
  const city = String(q.city || 'Paris').trim();
  const lat = Number(q.lat || 48.8566);
  const lon = Number(q.lon || 2.3522);
  let departement = String(q.departement || '').trim();
  const radius = Math.max(5, Math.min(100, Number(q.radius || 25)));
  const minSize = String(q.min_size || '20');
  const onlyActiveSite = (q.only_active_site ?? '1') === '1';
  const onlyRse = (q.only_rse ?? '0') === '1';
  const mode = String(q.mode || 'auto');
  const limit = Math.max(6, Math.min(30, Number(q.limit || 18)));
  const smicHourly = Math.max(10.0, Math.min(20.0, Number(q.smic || 11.88)));

  let allowedBrackets = Object.keys(OETH_BRACKETS);
  if (minSize === '50') allowedBrackets = ['21', '22', '31', '32', '41', '42', '51', '52', '53'];
  else if (minSize === '250') allowedBrackets = ['32', '41', '42', '51', '52', '53'];

  const romeInfo = ROME_CATALOG[rome] || {
    label: `Métier ROME ${rome}`,
    sector: 'Ciblage personnalisé',
    nafs: ['62.01Z', '62.02A', '70.22Z', '71.12B'],
  };

  if (!departement && city) {
    const cityDeptMap = {
      paris: '75', lyon: '69', marseille: '13', toulouse: '31',
      bordeaux: '33', nantes: '44', lille: '59', rennes: '35',
      strasbourg: '67', montpellier: '34', grenoble: '38', nice: '06',
    };
    departement = cityDeptMap[city.toLowerCase()] || '';
  }

  const meta = {
    rome,
    rome_label: romeInfo.label,
    rome_sector: romeInfo.sector,
    city,
    radius_km: radius,
    min_size: minSize,
    only_active_site: onlyActiveSite,
    pipeline: [],
    fallback_reason: null,
  };

  if (mode === 'demo') {
    const companies = buildDemoResults(romeInfo, city, smicHourly);
    return jsonResponse({
      ok: true,
      meta: {
        ...meta,
        engine: 'demo',
        pipeline: ['Jeu de démonstration LBB × SIRENE', 'Calculateur OETH 20+', 'Scoring Composite'],
        elapsed_ms: Date.now() - startTime,
        total_candidates: companies.length,
        total_returned: companies.length,
      },
      companies,
    });
  }

  const creds = getFtCredentials(event);
  const hasFtCreds = Boolean(creds.clientId && creds.clientSecret);
  const lbbMatches = new Map();
  let usedLbb = false;

  if ((mode === 'auto' || mode === 'lbb') && hasFtCreds) {
    const tokenRes = await fetchWithTiming(
      'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: creds.clientId,
          client_secret: creds.clientSecret,
          scope: 'api_labonneboitev2',
        }).toString(),
      },
      7000
    );

    let tokenJson = {};
    try { tokenJson = JSON.parse(tokenRes.body || '{}'); } catch {}

    if (tokenRes.status === 200 && tokenJson.access_token) {
      const lbbUrl = `https://api.francetravail.io/partenaire/labonneboite/v2/recherche?${new URLSearchParams({
        rome,
        latitude: String(lat),
        longitude: String(lon),
        distance: String(radius),
        page_size: '35',
      }).toString()}`;

      const lbbRes = await fetchWithTiming(
        lbbUrl,
        { headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: 'application/json' } },
        8000
      );

      let lbbJson = {};
      try { lbbJson = JSON.parse(lbbRes.body || '{}'); } catch {}

      if (lbbRes.status === 200 && Array.isArray(lbbJson.companies) && lbbJson.companies.length) {
        usedLbb = true;
        meta.pipeline.push('API La Bonne Boîte v2 (France Travail)');
        for (const c of lbbJson.companies) {
          const siret = String(c.siret || '');
          const siren = siret.slice(0, 9);
          if (siren.length === 9) {
            lbbMatches.set(siren, {
              siret,
              hiring_score: Number(c.hiring_score || 4.0),
              website: c.contact_methods?.website || null,
              email: c.contact_methods?.email || null,
              phone: c.contact_methods?.phone || null,
            });
          }
        }
      } else {
        meta.fallback_reason = `API La Bonne Boîte v2 HTTP ${lbbRes.status} — bascule automatique sur SIRENE Live.`;
      }
    } else {
      const errMsg = tokenJson.error_description || tokenJson.error || `HTTP ${tokenRes.status}`;
      meta.fallback_reason = `OAuth2 France Travail (${errMsg}) — bascule automatique sur SIRENE Live.`;
    }
  }

  let sireneRawList = [];
  if (usedLbb && lbbMatches.size > 0) {
    const results = await Promise.all(
      [...lbbMatches.keys()].map((siren) =>
        fetchWithTiming(`https://recherche-entreprises.api.gouv.fr/search?q=${encodeURIComponent(siren)}&per_page=1`, {}, 6000)
      )
    );
    for (const r of results) {
      if (r.status === 200) {
        try {
          const j = JSON.parse(r.body);
          if (j.results?.[0]) sireneRawList.push(j.results[0]);
        } catch {}
      }
    }
    meta.pipeline.push("API Recherche d'entreprises (SIRENE 20+)");
    meta.engine = 'lbb_sirene_live';
  } else {
    meta.engine = 'sirene_live';
    meta.pipeline.push("API Recherche d'entreprises (SIRENE 20+ Live)");

    const nafsCsv = romeInfo.nafs.join(',');
    const bracketsCsv = allowedBrackets.join(',');

    const q1Params = new URLSearchParams({
      activite_principale: nafsCsv,
      tranche_effectif_salarie: bracketsCsv,
      etat_administratif: 'A',
      per_page: '25',
      page: '1',
    });
    if (departement) q1Params.set('departement', departement);

    const q2Params = new URLSearchParams(q1Params);
    q2Params.set('page', '2');

    const urls = [
      `https://recherche-entreprises.api.gouv.fr/search?${q1Params.toString()}`,
      `https://recherche-entreprises.api.gouv.fr/search?${q2Params.toString()}`,
    ];

    if (lat !== 0 && lon !== 0) {
      const npParams = new URLSearchParams({
        lat: String(lat),
        long: String(lon),
        radius: String(Math.min(50, radius)),
        activite_principale: nafsCsv,
        per_page: '25',
      });
      urls.push(`https://recherche-entreprises.api.gouv.fr/near_point?${npParams.toString()}`);
    }

    const responses = await Promise.all(
      urls.map((u) => fetchWithTiming(u, { headers: { Accept: 'application/json' } }, 8000))
    );
    const seen = new Set();
    for (const r of responses) {
      if (r.status === 200) {
        try {
          const j = JSON.parse(r.body);
          for (const item of j.results || []) {
            if (item.siren && !seen.has(item.siren)) {
              seen.add(item.siren);
              sireneRawList.push(item);
            }
          }
        } catch {}
      }
    }
  }

  const filtered = [];
  for (const raw of sireneRawList) {
    if (raw.etat_administratif !== 'A') continue;
    const bracket = String(raw.tranche_effectif_salarie || raw.siege?.tranche_effectif_salarie || '');
    if (!allowedBrackets.includes(bracket)) continue;
    const comp = normalizeSireneCompany(raw, romeInfo, smicHourly, lbbMatches.get(raw.siren) || null);
    if (onlyRse && !comp.rse_signals.length) continue;
    filtered.push(comp);
  }

  meta.pipeline.push('Vérification HTTP/SSL sites web actifs');
  const candidatesToProbe = filtered.slice(0, 26);
  const verifiedBatch = await verifyWebsitesBatch(candidatesToProbe);

  let finalCompanies = verifiedBatch
    .filter((c) => !onlyActiveSite || c.website_verified)
    .map(finalizeCompanyScore)
    .sort((a, b) => b.composite_score - a.composite_score)
    .slice(0, limit);

  meta.pipeline.push('Calculateur OETH & Scoring Composite');
  meta.elapsed_ms = Date.now() - startTime;
  meta.total_candidates = filtered.length;
  meta.total_returned = finalCompanies.length;
  meta.ft_configured = hasFtCreds;

  return jsonResponse({ ok: true, meta, companies: finalCompanies });
}
