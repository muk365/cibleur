/**
 * Shared domain constants, OETH calculations, SIRENE normalizer, and website verifier
 * for Netlify Serverless Functions (Node 20+ ESM, zero external dependencies).
 */

export const OETH_BRACKETS = {
  '12': { label: '20 à 49 salariés', min: 20, max: 49, mid: 32, tier: '20-249' },
  '21': { label: '50 à 99 salariés', min: 50, max: 99, mid: 72, tier: '20-249' },
  '22': { label: '100 à 199 salariés', min: 100, max: 199, mid: 145, tier: '20-249' },
  '31': { label: '200 à 249 salariés', min: 200, max: 249, mid: 225, tier: '20-249' },
  '32': { label: '250 à 499 salariés', min: 250, max: 499, mid: 360, tier: '250-749' },
  '41': { label: '500 à 999 salariés', min: 500, max: 999, mid: 720, tier: '250-749' },
  '42': { label: '1 000 à 1 999 salariés', min: 1000, max: 1999, mid: 1400, tier: '750+' },
  '51': { label: '2 000 à 4 999 salariés', min: 2000, max: 4999, mid: 3200, tier: '750+' },
  '52': { label: '5 000 à 9 999 salariés', min: 5000, max: 9999, mid: 7000, tier: '750+' },
  '53': { label: '10 000 salariés et plus', min: 10000, max: 25000, mid: 14000, tier: '750+' },
};

export const ROME_CATALOG = {
  M1805: { label: 'Études et développement informatique', sector: 'Tech & Numérique', nafs: ['62.01Z', '62.02A', '62.02B', '58.29C', '63.11Z'] },
  M1806: { label: "Conseil et maîtrise d'ouvrage en systèmes d'information", sector: 'Tech & Conseil SI', nafs: ['62.02A', '62.01Z', '70.22Z', '62.02B'] },
  M1802: { label: "Expertise et support en systèmes d'information", sector: 'Infra, Cloud & Cybersécurité', nafs: ['62.02A', '62.03Z', '63.11Z', '61.10Z'] },
  E1104: { label: 'Conception de contenus multimédias (UX/UI & Design)', sector: 'Design & Communication', nafs: ['73.11Z', '74.10Z', '62.01Z', '58.29C'] },
  M1705: { label: 'Marketing', sector: 'Marketing & Acquisition', nafs: ['73.11Z', '70.21Z', '73.12Z', '70.22Z'] },
  M1707: { label: 'Stratégie commerciale', sector: 'Commerce & Business Dev', nafs: ['70.22Z', '46.19B', '62.01Z', '62.02A'] },
  M1203: { label: 'Comptabilité', sector: 'Finance & Audit', nafs: ['69.20Z', '64.20Z', '70.22Z'] },
  M1503: { label: 'Management des ressources humaines', sector: 'RH & Recrutement', nafs: ['78.10Z', '78.20Z', '70.22Z', '85.59A'] },
  H1206: { label: 'Management et ingénierie études, recherche et développement industriel', sector: 'Ingénierie & R&D', nafs: ['71.12B', '72.19Z', '28.99B', '30.30Z'] },
  K2111: { label: 'Formation professionnelle', sector: 'EdTech & Formation', nafs: ['85.59A', '85.59B', '85.42Z'] },
  M1403: { label: 'Études et prospectives socio-économiques (Data / BI)', sector: 'Data & Analytics', nafs: ['62.02A', '73.20Z', '63.11Z', '70.22Z'] },
  I1304: { label: "Installation et maintenance d'équipements industriels", sector: 'Industrie & Maintenance', nafs: ['33.12Z', '33.20A', '43.21A', '28.29B'] },
};

export function jsonResponse(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

export function computeOethMetrics(bracketCode, smicHourly = 11.88) {
  const info = OETH_BRACKETS[bracketCode] || OETH_BRACKETS['12'];
  const quota6 = Math.max(1, Math.floor(info.mid * 0.06));
  const coeff = info.tier === '750+' ? 600 : info.tier === '250-749' ? 500 : 400;
  const unitAvoidance = Math.round(coeff * smicHourly);

  return {
    bracket_code: bracketCode,
    bracket_label: info.label,
    estimated_headcount: info.mid,
    min_headcount: info.min,
    max_headcount: info.max,
    quota_6_pct: quota6,
    agefiph_coeff: coeff,
    smic_hourly: smicHourly,
    saving_per_rqth_hire: unitAvoidance,
    annual_exposure_zero_boe: Math.round(quota6 * unitAvoidance),
    surcontribution_per_unit: Math.round(1500 * smicHourly),
  };
}

export function getFtCredentials(event) {
  const envId = (process.env.FT_CLIENT_ID || '').trim();
  const envSecret = (process.env.FT_CLIENT_SECRET || '').trim();
  const hdrs = event?.headers || {};
  const hdrId = (hdrs['x-ft-client-id'] || hdrs['X-FT-Client-Id'] || '').trim();
  const hdrSecret = (hdrs['x-ft-client-secret'] || hdrs['X-FT-Client-Secret'] || '').trim();

  if (hdrId && hdrSecret) {
    return { clientId: hdrId, clientSecret: hdrSecret, source: 'header' };
  }
  if (envId && envSecret) {
    return { clientId: envId, clientSecret: envSecret, source: 'env' };
  }
  return { clientId: '', clientSecret: '', source: 'none' };
}

export function parseEventJsonBody(event) {
  if (!event?.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : String(event.body);
  return JSON.parse(raw || '{}');
}

export async function requestFtToken(clientId, clientSecret) {
  const url = 'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire';
  const scopesToTry = [`api_labonneboitev2`, `application_${clientId} api_labonneboitev2`];
  let lastRes = null;
  let lastJson = {};

  for (const scope of scopesToTry) {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }).toString();

    const res = await fetchWithTiming(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      },
      8000
    );

    let json = {};
    try { json = JSON.parse(res.body || '{}'); } catch {}
    lastRes = res;
    lastJson = json;

    if (res.status === 200 && json.access_token) {
      return { ok: true, access_token: json.access_token, scope, status: res.status, latency_ms: res.latency_ms, error: null };
    }
    if (json.error !== 'invalid_scope') {
      break;
    }
  }

  return {
    ok: false,
    access_token: null,
    scope: scopesToTry[0],
    status: lastRes?.status || 0,
    latency_ms: lastRes?.latency_ms || 0,
    error: lastJson.error_description || lastJson.error || lastRes?.error || `HTTP ${lastRes?.status || 0}`,
  };
}

export async function fetchWithTiming(url, options = {}, timeoutMs = 7000) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'User-Agent': 'CibleurOETH-Netlify/1.0',
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    return { status: res.status, body: text, error: null, latency_ms: Date.now() - start, url: res.url || url };
  } catch (err) {
    return { status: 0, body: '', error: err?.message || 'Network error', latency_ms: Date.now() - start, url };
  }
}

export function buildDomainCandidates(name, sigle = null) {
  const clean = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ');

  const stopWords = new Set([
    'sas', 'sasu', 'sarl', 'eurl', 'sa', 'snc', 'scop', 'scic', 'gie', 'selarl', 'selafa',
    'societe', 'entreprise', 'etablissements', 'groupe', 'group', 'holding', 'france',
    'europe', 'international', 'services', 'service', 'solutions', 'technologies',
    'technologie', 'consulting', 'conseil', 'associes', 'et', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd',
  ]);

  const words = clean.trim().split(/\s+/).filter((w) => w && !stopWords.has(w) && w.length >= 2);
  const allWords = clean.trim().split(/\s+/).filter(Boolean);

  const slugs = [];
  if (sigle) {
    const s = String(sigle).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
    if (s.length >= 2) slugs.push(s);
  }
  if (words.length >= 2) {
    slugs.push(words[0] + words[1]);
    slugs.push(`${words[0]}-${words[1]}`);
  }
  if (words.length >= 1) {
    slugs.push(words[0]);
  }
  if (words.length >= 3) {
    slugs.push(words.slice(0, 3).join(''));
  } else if (!words.length && allWords.length) {
    slugs.push(allWords[0]);
  }

  const uniqueSlugs = [...new Set(slugs.filter((s) => s.length >= 3 && s.length <= 28))].slice(0, 3);
  const candidates = [];
  for (const s of uniqueSlugs) {
    candidates.push(`https://www.${s}.fr`, `https://www.${s}.com`);
  }
  for (const s of uniqueSlugs) {
    candidates.push(`https://${s}.fr`, `https://${s}.io`);
  }
  return [...new Set(candidates)].slice(0, 6);
}

async function probeSingleUrl(url) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(2600),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CibleurOETH/1.0)' },
    });
    if (res.status >= 200 && res.status < 400) {
      return { ok: true, status: res.status, website: res.url || url, latency_ms: Date.now() - start };
    }
    if (res.status === 405 || res.status === 403) {
      const getRes = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(2600),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CibleurOETH/1.0)' },
      });
      if (getRes.status >= 200 && getRes.status < 400) {
        return { ok: true, status: getRes.status, website: getRes.url || url, latency_ms: Date.now() - start };
      }
    }
  } catch {
    // ignore unreachable candidate
  }
  return { ok: false, status: 0, website: null, latency_ms: 0 };
}

export async function verifyWebsitesBatch(companies) {
  await Promise.all(
    companies.map(async (comp) => {
      const candidates = comp.lbb_website
        ? [comp.lbb_website]
        : buildDomainCandidates(comp.name, comp.sigle);

      const results = await Promise.all(candidates.map((u) => probeSingleUrl(u)));
      const hit = results.find((r) => r.ok);
      if (hit) {
        comp.website = hit.website;
        comp.website_verified = true;
        comp.website_status = hit.status;
        comp.website_latency_ms = hit.latency_ms;
      } else {
        comp.website = null;
        comp.website_verified = false;
        comp.website_status = 0;
        comp.website_latency_ms = 0;
      }
      delete comp.lbb_website;
    })
  );
  return companies;
}

export function normalizeSireneCompany(raw, romeInfo, smicHourly, lbbData = null) {
  const siege = raw.siege || {};
  const matching = (raw.matching_etablissements && raw.matching_etablissements[0]) || siege;
  const bracket = String(raw.tranche_effectif_salarie || siege.tranche_effectif_salarie || '12');
  const oeth = computeOethMetrics(bracket, smicHourly);
  const naf = String(raw.activite_principale || siege.activite_principale || '');
  const complements = raw.complements || {};

  let leader = null;
  for (const dir of raw.dirigeants || []) {
    if (dir.type_dirigeant === 'personne physique') {
      const qualite = String(dir.qualite || '');
      if (!qualite.toLowerCase().includes('commissaire aux comptes')) {
        leader = `${dir.prenoms || ''} ${dir.nom || ''}`.trim() + (qualite ? ` (${qualite})` : '');
        break;
      }
    }
  }

  let latestCa = null;
  let latestNet = null;
  let financeYear = null;
  if (raw.finances && typeof raw.finances === 'object') {
    const years = Object.keys(raw.finances).sort().reverse();
    if (years.length) {
      financeYear = years[0];
      latestCa = raw.finances[financeYear]?.ca ?? null;
      latestNet = raw.finances[financeYear]?.resultat_net ?? null;
    }
  }

  const rseSignals = [];
  if (complements.est_societe_mission) rseSignals.push('Société à mission');
  if (complements.est_ess) rseSignals.push('ESS (Économie Sociale & Solidaire)');
  if (complements.est_achats_responsables) rseSignals.push('Label Achats Responsables');
  if (complements.egapro_renseigne) rseSignals.push('Index Egapro publié');
  if (complements.est_siae) rseSignals.push('Structure SIAE');
  if (complements.bilan_ges_renseigne) rseSignals.push('Bilan GES publié');

  let lbbScore = 2.8;
  let hiringSource = 'SIRENE Prédictif';
  if (lbbData && lbbData.hiring_score != null) {
    lbbScore = Number(lbbData.hiring_score);
    hiringSource = 'La Bonne Boîte v2';
  } else {
    if ((romeInfo.nafs || []).includes(naf)) lbbScore += 0.7;
    if ((raw.nombre_etablissements_ouverts || 1) >= 3) lbbScore += 0.45;
    if (latestNet !== null && latestNet > 0) lbbScore += 0.35;
    if (siege.a_opco) lbbScore += 0.25;
    if (rseSignals.length > 0) lbbScore += 0.25;
    lbbScore = Number(Math.min(4.95, lbbScore).toFixed(2));
  }

  return {
    siren: String(raw.siren || ''),
    siret: String(matching.siret || siege.siret || ''),
    name: String(raw.nom_complet || raw.nom_raison_sociale || 'Entreprise'),
    sigle: raw.sigle || null,
    category: String(raw.categorie_entreprise || 'PME'),
    naf,
    address: String(matching.adresse || siege.adresse || ''),
    postal_code: String(matching.code_postal || siege.code_postal || ''),
    city: String(matching.libelle_commune || siege.libelle_commune || ''),
    departement: String(matching.departement || siege.departement || ''),
    lat: Number(matching.latitude || siege.latitude || 48.8566),
    lon: Number(matching.longitude || siege.longitude || 2.3522),
    date_creation: raw.date_creation || null,
    open_sites: Number(raw.nombre_etablissements_ouverts || 1),
    leader,
    finances: { year: financeYear, ca: latestCa, resultat_net: latestNet },
    rse_signals: rseSignals,
    idcc: complements.liste_idcc || siege.liste_idcc || [],
    oeth,
    hiring: {
      score_5: lbbScore,
      potential: lbbScore >= 4.0 ? 'high' : lbbScore >= 3.2 ? 'medium' : 'moderate',
      source: hiringSource,
    },
    lbb_website: lbbData?.website || null,
    lbb_email: lbbData?.email || null,
    lbb_phone: lbbData?.phone || null,
  };
}

export function finalizeCompanyScore(comp) {
  const hiringPts = Math.min(40, Math.round((comp.hiring.score_5 / 5.0) * 40));
  const headcount = comp.oeth.estimated_headcount;
  const oethPts = headcount >= 250 ? 25 : headcount >= 100 ? 22 : headcount >= 50 ? 19 : 14;
  const rsePts = Math.min(14, (comp.rse_signals?.length || 0) * 5);
  const finPts = (comp.finances?.resultat_net || 0) > 0 ? 6 : 2;
  const maturityPts = Math.min(20, rsePts + finPts);
  const digitalPts = comp.website_verified ? 15 : 0;

  comp.composite_score = Math.min(99, hiringPts + oethPts + maturityPts + digitalPts);
  comp.score_breakdown = { hiring: hiringPts, oeth: oethPts, maturity: maturityPts, digital: digitalPts };
  return comp;
}
