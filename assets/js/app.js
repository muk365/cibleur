import { Icons } from './icons.js';
import {
  ROME_CATALOG,
  POPULAR_CITIES,
  formatEuro,
  formatCompactEuro,
  escapeHtml,
  calculateCustomOeth,
} from './rome-data.js';

const STORAGE_PIPELINE = 'cibleur_oeth_pipeline_v1';
const STORAGE_THEME = 'cibleur_oeth_theme_v1';
const STORAGE_FT_SESSION = 'cibleur_ft_session_creds';

function getSavedFtCreds() {
  try {
    const raw = localStorage.getItem(STORAGE_FT_SESSION) || sessionStorage.getItem(STORAGE_FT_SESSION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.secret) return parsed;
  } catch {}
  return null;
}

function getFtAuthHeaders() {
  const creds = getSavedFtCreds();
  if (creds) {
    return { 'X-FT-Client-Id': creds.id, 'X-FT-Client-Secret': creds.secret };
  }
  return {};
}

const state = {
  companies: [],
  filtered: [],
  meta: null,
  view: 'cards', // cards | table | map
  selectedCity: { ...POPULAR_CITIES[0] },
  pipeline: loadPipeline(),
  leafletMap: null,
  leafletMarkers: [],
  hasFtCredentials: false,
};

function loadPipeline() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_PIPELINE) || '{}');
  } catch {
    return {};
  }
}

function savePipeline() {
  localStorage.setItem(STORAGE_PIPELINE, JSON.stringify(state.pipeline));
  updatePipelineBadge();
}

function updatePipelineBadge() {
  const el = document.getElementById('pipeline-count');
  if (el) el.textContent = String(Object.keys(state.pipeline).length);
}

function showToast(message, isError = false) {
  const stack = document.getElementById('toast-stack');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.borderColor = isError ? 'rgba(251, 113, 133, 0.65)' : 'rgba(34, 211, 238, 0.45)';
  toast.innerHTML = `${isError ? Icons.close('icon') : Icons.check('icon')}<span>${escapeHtml(message)}</span>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 3200);
}

function injectStaticIcons() {
  const map = {
    'brand-icon': Icons.radar('icon icon-lg'),
    'icon-kanban': Icons.kanban('icon'),
    'icon-euro-nav': Icons.euroShield('icon'),
    'icon-sliders': Icons.sliders('icon'),
    'icon-sparkle-hero': Icons.sparkleTarget('icon'),
    'icon-briefcase': Icons.briefcase('icon'),
    'icon-pin': Icons.mapPin('icon'),
    'icon-radar-btn': Icons.radar('icon'),
    'kpi-icon-1': Icons.buildingOeth('icon icon-lg'),
    'kpi-icon-2': Icons.flameSignal('icon icon-lg'),
    'kpi-icon-3': Icons.euroShield('icon icon-lg'),
    'kpi-icon-4': Icons.globeCheck('icon icon-lg'),
    'icon-tab-cards': Icons.grid('icon'),
    'icon-tab-table': Icons.table('icon'),
    'icon-tab-map': Icons.map('icon'),
    'icon-download-csv': Icons.download('icon'),
    'icon-close-drawer': Icons.close('icon'),
    'icon-close-modal': Icons.close('icon'),
  };
  for (const [id, svg] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  }
  updateThemeIcon();
}

function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon();
}

function updateThemeIcon() {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const el = document.getElementById('icon-theme');
  if (el) el.innerHTML = theme === 'dark' ? Icons.sun('icon') : Icons.moon('icon');
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem(STORAGE_THEME, next);
  updateThemeIcon();
}

function renderRomePresets() {
  const wrap = document.getElementById('rome-presets');
  const current = document.getElementById('input-rome').value.trim().toUpperCase();
  wrap.innerHTML = ROME_CATALOG.slice(0, 7)
    .map(
      (r) => `
      <button type="button" class="preset-chip ${r.code === current ? 'active' : ''}" data-rome="${r.code}">
        <code>${r.code}</code>
        <span>${escapeHtml(r.sector)}</span>
      </button>`
    )
    .join('');

  wrap.querySelectorAll('.preset-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('input-rome').value = btn.dataset.rome;
      updateRomeHint();
      renderRomePresets();
      runSearch();
    });
  });
}

function updateRomeHint() {
  const code = document.getElementById('input-rome').value.trim().toUpperCase();
  const match = ROME_CATALOG.find((r) => r.code === code);
  document.getElementById('rome-sector-pill').textContent = match ? match.sector.split('&')[0].trim() : 'Custom';
  document.getElementById('rome-label-hint').textContent = match ? match.label : `Code ROME personnalisé (${code || '—'})`;
}

let citySearchTimer = null;
function initCityAutocomplete() {
  const input = document.getElementById('input-city');
  const dropdown = document.getElementById('city-dropdown');
  const hint = document.getElementById('city-coords-hint');

  const selectCity = (c) => {
    state.selectedCity = c;
    input.value = c.name;
    hint.textContent = `Dép. ${c.departement || '—'} • ${Number(c.lat).toFixed(4)}, ${Number(c.lon).toFixed(4)}`;
    dropdown.hidden = true;
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    clearTimeout(citySearchTimer);
    if (q.length < 2) {
      dropdown.hidden = true;
      return;
    }
    citySearchTimer = setTimeout(async () => {
      try {
        const res = await fetch(`api/communes.php?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        const items = data.communes || [];
        if (!items.length) {
          dropdown.hidden = true;
          return;
        }
        dropdown.innerHTML = items
          .map(
            (c, idx) => `
            <div class="ac-item" data-idx="${idx}">
              <span><strong>${escapeHtml(c.name)}</strong> (${escapeHtml(c.postal || '')})</span>
              <span class="ac-meta">Dép. ${escapeHtml(c.departement)}</span>
            </div>`
          )
          .join('');
        dropdown.hidden = false;
        dropdown.querySelectorAll('.ac-item').forEach((row) => {
          row.addEventListener('click', () => selectCity(items[Number(row.dataset.idx)]));
        });
      } catch {
        dropdown.hidden = true;
      }
    }, 220);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.field-city')) dropdown.hidden = true;
  });
}

async function fetchSettingsStatus() {
  try {
    const res = await fetch('api/settings.php', { headers: getFtAuthHeaders() });
    const data = await res.json();
    state.hasFtCredentials = Boolean(data.has_ft_credentials);
    updateEnginePill(state.hasFtCredentials ? 'LBB + SIRENE prêts' : 'Mode SIRENE Live');
  } catch {
    // ignore
  }
}

function updateEnginePill(label, isLbb = false) {
  const lbl = document.getElementById('engine-label');
  const dot = document.getElementById('engine-dot');
  if (lbl) lbl.textContent = label;
  if (dot) dot.classList.toggle('lbb', isLbb);
}

function renderSkeletons() {
  const grid = document.getElementById('view-cards');
  grid.innerHTML = Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join('');
}

async function runSearch() {
  const btn = document.getElementById('btn-run-search');
  btn.disabled = true;
  btn.querySelector('span:last-child').textContent = 'Analyse en cours...';
  renderSkeletons();

  const rome = document.getElementById('input-rome').value.trim().toUpperCase() || 'M1805';
  const cityInput = document.getElementById('input-city').value.trim();
  const radius = document.getElementById('select-radius').value;
  const minSize = document.getElementById('select-min-size').value;
  const mode = document.getElementById('select-mode').value;
  const onlyActiveSite = document.getElementById('chk-active-site').checked ? '1' : '0';
  const onlyRse = document.getElementById('chk-only-rse').checked ? '1' : '0';

  const useCityObj = state.selectedCity && state.selectedCity.name.toLowerCase() === cityInput.toLowerCase();
  const params = new URLSearchParams({
    rome,
    city: cityInput || 'Paris',
    lat: String(useCityObj ? state.selectedCity.lat : 48.8566),
    lon: String(useCityObj ? state.selectedCity.lon : 2.3522),
    departement: useCityObj ? state.selectedCity.departement || '' : '',
    radius,
    min_size: minSize,
    only_active_site: onlyActiveSite,
    only_rse: onlyRse,
    mode,
    limit: '18',
  });

  try {
    const res = await fetch(`api/search.php?${params.toString()}`, {
      headers: getFtAuthHeaders(),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || 'Erreur serveur');
    }
    state.companies = data.companies || [];
    state.meta = data.meta || {};
    updatePipelineBanner(state.meta);
    applyLocalFiltersAndRender();
  } catch (err) {
    showToast(`Erreur lors du ciblage : ${err.message}`, true);
    document.getElementById('view-cards').innerHTML = `
      <div class="empty-state">
        <h3>Impossible de joindre le moteur PHP</h3>
        <p>${escapeHtml(err.message)}. Vérifiez qu'Apache/PHP est démarré sur XAMPP ou lancez <code>php -S localhost:8080</code>.</p>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span:last-child').textContent = 'Lancer le ciblage';
  }
}

function updatePipelineBanner(meta) {
  const banner = document.getElementById('pipeline-banner');
  if (!meta) {
    banner.hidden = true;
    return;
  }

  const isLbb = meta.engine === 'lbb_sirene_live';
  const engineName = isLbb
    ? 'La Bonne Boîte v2 × SIRENE Live'
    : meta.engine === 'demo'
    ? 'Démo LBB × SIRENE'
    : 'SIRENE 20+ Live + Scoring Prédictif';
  updateEnginePill(engineName, isLbb);

  const stepsHtml = (meta.pipeline || [])
    .map((s) => `<span class="step-tag">${escapeHtml(s)}</span>`)
    .join('');

  const fallbackHtml = meta.fallback_reason
    ? `<span style="color:var(--accent-amber);font-weight:600;">${escapeHtml(meta.fallback_reason)}</span>`
    : `<span style="color:var(--text-secondary);">ROME <strong>${escapeHtml(meta.rome)}</strong> • ${escapeHtml(meta.city)} (${meta.radius_km} km)</span>`;

  banner.innerHTML = `<div class="pipeline-steps">${stepsHtml}</div><div>${fallbackHtml}</div>`;
  banner.hidden = false;
}

function applyLocalFiltersAndRender() {
  const query = document.getElementById('input-local-filter').value.trim().toLowerCase();
  const sortBy = document.getElementById('select-sort').value;

  let list = [...state.companies];
  if (query) {
    list = list.filter((c) => {
      const blob = [c.name, c.siren, c.siret, c.city, c.leader, c.naf, ...(c.rse_signals || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(query);
    });
  }

  list.sort((a, b) => {
    if (sortBy === 'saving') return b.oeth.saving_per_rqth_hire - a.oeth.saving_per_rqth_hire;
    if (sortBy === 'hiring') return b.hiring.score_5 - a.hiring.score_5;
    if (sortBy === 'headcount') return b.oeth.estimated_headcount - a.oeth.estimated_headcount;
    return b.composite_score - a.composite_score;
  });

  state.filtered = list;
  updateKpis(list);
  renderCurrentView();
}

function updateKpis(list) {
  const count = list.length;
  const totalCandidates = state.meta?.total_candidates ?? count;
  const avgScore = count ? Math.round(list.reduce((s, c) => s + c.composite_score, 0) / count) : 0;
  const avgSaving = count ? Math.round(list.reduce((s, c) => s + c.oeth.saving_per_rqth_hire, 0) / count) : 0;
  const verifiedCount = list.filter((c) => c.website_verified).length;

  document.getElementById('kpi-count').textContent = String(count);
  document.getElementById('kpi-candidates').textContent = `${totalCandidates} structures 20+ analysées`;
  document.getElementById('kpi-avg-score').textContent = count ? `${avgScore} / 100` : '—';
  document.getElementById('kpi-avg-saving').textContent = count ? `${formatEuro(avgSaving)}/an` : '—';
  document.getElementById('kpi-verified-sites').textContent = count ? `${verifiedCount} / ${count}` : '—';
  document.getElementById('kpi-elapsed').textContent = state.meta?.elapsed_ms
    ? `Pipeline exécuté en ${(state.meta.elapsed_ms / 1000).toFixed(2)}s`
    : 'En attente';
}

function renderScoreRing(score) {
  const r = 23;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.max(0, Math.min(100, score)) / 100) * circ;
  const grad = score >= 82 ? 'url(#grad-cyan)' : score >= 68 ? 'url(#grad-aurora)' : 'url(#grad-amber)';
  return `
    <div class="score-ring" title="Score Composite Marché Caché × OETH : ${score}/100">
      <svg viewBox="0 0 58 58">
        <circle cx="29" cy="29" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="5" fill="none"/>
        <circle cx="29" cy="29" r="${r}" stroke="${grad}" stroke-width="5" fill="none"
          stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="score-ring-val">${score}<span>/100</span></div>
    </div>`;
}

function renderCurrentView() {
  const cardsEl = document.getElementById('view-cards');
  const tableEl = document.getElementById('view-table');
  const mapEl = document.getElementById('view-map');

  cardsEl.hidden = state.view !== 'cards';
  tableEl.hidden = state.view !== 'table';
  mapEl.hidden = state.view !== 'map';

  if (state.view === 'cards') renderCards();
  else if (state.view === 'table') renderTable();
  else if (state.view === 'map') renderMap();
}

function renderCards() {
  const grid = document.getElementById('view-cards');
  if (!state.filtered.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Aucune structure ne correspond à ces critères</h3>
        <p>Essayez d'élargir le rayon géographique, de passer au seuil <strong>20+ salariés</strong> ou de décocher le filtre site actif / RSE.</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.filtered
    .map((c, idx) => {
      const isSaved = Boolean(state.pipeline[c.siren]);
      const rseTags = (c.rse_signals || [])
        .slice(0, 2)
        .map((r) => `<span class="tag-pill tag-rse">${Icons.leafRse('icon')} ${escapeHtml(r)}</span>`)
        .join('');

      const domainText = c.website ? c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '') : 'Site non détecté';

      return `
      <article class="company-card" style="animation-delay:${Math.min(idx * 35, 350)}ms">
        <div class="card-top">
          <div class="card-title-block">
            <h3>${escapeHtml(c.name)}</h3>
            <div class="card-meta-line">
              <span class="cat-pill">${escapeHtml(c.category || 'PME')}</span>
              <span>SIREN ${escapeHtml(c.siren)}</span>
              <span>NAF ${escapeHtml(c.naf)}</span>
            </div>
          </div>
          ${renderScoreRing(c.composite_score)}
        </div>

        <div class="card-metrics">
          <div class="metric-box">
            <div class="metric-box-label">Effectif OETH (≥ 20)</div>
            <div class="metric-box-val">${escapeHtml(c.oeth.bracket_label)}</div>
          </div>
          <div class="metric-box">
            <div class="metric-box-label">Économie OETH / embauche</div>
            <div class="metric-box-val emerald">+${formatEuro(c.oeth.saving_per_rqth_hire)}/an</div>
          </div>
        </div>

        <div class="card-details">
          <div class="detail-row">
            ${Icons.mapPin('icon')}
            <span>${escapeHtml(c.postal_code)} ${escapeHtml(c.city)} • ${c.open_sites} étab.</span>
          </div>
          <div class="detail-row">
            ${Icons.leaderUser('icon')}
            <span>${escapeHtml(c.leader || 'Dirigeant non renseigné')}</span>
          </div>
          <div class="detail-row">
            ${Icons.globeCheck('icon')}
            ${
              c.website
                ? `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(domainText)} (HTTP ${c.website_status})</a>`
                : `<span style="color:var(--text-muted)">Aucun domaine actif détecté</span>`
            }
          </div>
        </div>

        <div class="badges-row">
          <span class="tag-pill tag-hiring">${Icons.flameSignal('icon')} Embauche ${c.hiring.score_5.toFixed(1)}/5</span>
          ${c.website_verified ? `<span class="tag-pill tag-web">Site actif ${c.website_latency_ms}ms</span>` : ''}
          ${rseTags}
        </div>

        <div class="card-actions">
          <button type="button" class="btn-card-primary" data-open-siren="${escapeHtml(c.siren)}">
            ${Icons.mailSpark('icon')}
            <span>Détails, ROI & Pitch RQTH</span>
          </button>
          <button type="button" class="btn-bookmark ${isSaved ? 'saved' : ''}" data-save-siren="${escapeHtml(c.siren)}" title="Ajouter / Retirer de Mes Cibles">
            ${Icons.bookmark('icon', isSaved)}
          </button>
        </div>
      </article>`;
    })
    .join('');

  grid.querySelectorAll('[data-open-siren]').forEach((btn) => {
    btn.addEventListener('click', () => openCompanyDrawer(btn.dataset.openSiren));
  });
  grid.querySelectorAll('[data-save-siren]').forEach((btn) => {
    btn.addEventListener('click', () => toggleSaveCompany(btn.dataset.saveSiren));
  });
}

function renderTable() {
  const tbody = document.getElementById('table-body');
  if (!state.filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;">Aucun résultat</td></tr>';
    return;
  }

  tbody.innerHTML = state.filtered
    .map(
      (c) => `
      <tr>
        <td>
          <strong>${escapeHtml(c.name)}</strong><br/>
          <span style="font-family:var(--font-mono);font-size:0.74rem;color:var(--text-secondary)">${escapeHtml(c.siren)} • ${escapeHtml(c.city)}</span>
        </td>
        <td>${escapeHtml(c.oeth.bracket_label)}<br/><small style="color:var(--text-muted)">Quota 6% ≈ ${c.oeth.quota_6_pct} BOE</small></td>
        <td style="color:var(--accent-emerald);font-weight:700;">${formatEuro(c.oeth.saving_per_rqth_hire)}/an</td>
        <td><span class="tag-pill tag-hiring">${c.hiring.score_5.toFixed(1)} / 5</span></td>
        <td><strong style="font-family:var(--font-mono)">${c.composite_score}/100</strong></td>
        <td>${c.website ? `<a href="${escapeHtml(c.website)}" target="_blank" rel="noopener">${escapeHtml(c.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, ''))}</a>` : '—'}</td>
        <td>
          <button type="button" class="btn-ghost" data-open-siren="${escapeHtml(c.siren)}">Analyser</button>
        </td>
      </tr>`
    )
    .join('');

  tbody.querySelectorAll('[data-open-siren]').forEach((btn) => {
    btn.addEventListener('click', () => openCompanyDrawer(btn.dataset.openSiren));
  });
}

function renderMap() {
  const container = document.getElementById('leaflet-map');
  if (!window.L) {
    container.innerHTML = '<div class="empty-state">Carte Leaflet en cours de chargement ou indisponible hors-ligne.</div>';
    return;
  }

  if (!state.leafletMap) {
    const center = state.filtered[0] ? [state.filtered[0].lat, state.filtered[0].lon] : [48.8566, 2.3522];
    state.leafletMap = L.map(container).setView(center, 11);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    }).addTo(state.leafletMap);
  }

  setTimeout(() => state.leafletMap.invalidateSize(), 120);

  state.leafletMarkers.forEach((m) => m.remove());
  state.leafletMarkers = [];

  const bounds = [];
  state.filtered.forEach((c) => {
    if (!c.lat || !c.lon) return;
    const color = c.composite_score >= 82 ? '#10B981' : c.composite_score >= 68 ? '#22D3EE' : '#F59E0B';
    const marker = L.circleMarker([c.lat, c.lon], {
      radius: 9,
      fillColor: color,
      color: '#0F172A',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9,
    }).addTo(state.leafletMap);

    marker.bindPopup(`
      <div style="font-family:Plus Jakarta Sans,sans-serif;min-width:200px">
        <strong>${escapeHtml(c.name)}</strong><br/>
        <span style="font-size:12px;color:#475569">${escapeHtml(c.oeth.bracket_label)}</span><br/>
        <strong style="color:#059669">Économie OETH : ${formatEuro(c.oeth.saving_per_rqth_hire)}/an</strong><br/>
        <span>Score : ${c.composite_score}/100</span>
      </div>
    `);
    state.leafletMarkers.push(marker);
    bounds.push([c.lat, c.lon]);
  });

  if (bounds.length) {
    state.leafletMap.fitBounds(bounds, { padding: [36, 36], maxZoom: 13 });
  }
}

function toggleSaveCompany(siren) {
  const comp = state.companies.find((c) => c.siren === siren);
  if (!comp) return;
  if (state.pipeline[siren]) {
    delete state.pipeline[siren];
    showToast(`${comp.name} retirée de Mes Cibles`);
  } else {
    state.pipeline[siren] = {
      company: comp,
      stage: 'À cibler',
      note: '',
      savedAt: new Date().toISOString(),
    };
    showToast(`${comp.name} ajoutée à Mes Cibles`);
  }
  savePipeline();
  renderCurrentView();
}

function buildOutreachPitch(comp, tone = 'oeth_direct') {
  const romeCode = state.meta?.rome || document.getElementById('input-rome').value.trim().toUpperCase();
  const romeLabel = state.meta?.rome_label || 'poste clé';
  const leaderName = comp.leader ? comp.leader.split('(')[0].trim() : 'Madame, Monsieur';
  const greeting = comp.leader ? `Bonjour ${leaderName},` : 'Madame, Monsieur,';
  const saving = formatEuro(comp.oeth.saving_per_rqth_hire);

  if (tone === 'linkedin') {
    return `${greeting}\n\nJe suis de près la dynamique de ${comp.name} (${comp.city}). Spécialisé(e) en ${romeLabel} (ROME ${romeCode}), je vous propose un échange de 10 min sur vos prochains besoins.\n\nPar ailleurs, mon statut RQTH permet à une structure de votre taille (${comp.oeth.bracket_label}) de réduire directement sa contribution OETH/AGEFIPH (~${saving}/an) tout en bénéficiant des aides à l'intégration.\n\nAu plaisir d'échanger !`;
  }

  if (tone === 'discrete') {
    return `Objet : Candidature spontanée — ${romeLabel} (${romeCode}) chez ${comp.name}\n\n${greeting}\n\nVotre positionnement dans le secteur (${comp.naf}) et votre implantation à ${comp.city} ont retenu toute mon attention. Fort(e) d'une solide expérience sur le métier ${romeLabel}, je souhaite vous proposer mes compétences pour accompagner vos prochains projets.\n\nDisponible pour un entretien exploratoire, je serais ravi(e) de vous présenter mes réalisations concrètes.\n\nBien cordialement,`;
  }

  return `Objet : Renfort ${romeLabel} (${romeCode}) × Double levier compétences & OETH pour ${comp.name}\n\n${greeting}\n\nEn analysant la croissance de ${comp.name} (${comp.oeth.bracket_label} sur ${comp.city}), je me permets une approche directe pour anticiper vos prochains recrutements sur les profils ${romeLabel}.\n\nAu-delà de mon expertise opérationnelle, je bénéficie de la Reconnaissance de la Qualité de Travailleur Handicapé (RQTH) — sans incidence sur ma pleine capacité professionnelle, et offrant à ${comp.name} un double avantage immédiat :\n• Économie directe estimée à ${saving}/an sur votre contribution OETH/AGEFIPH (quota légal 6%, soit ~${comp.oeth.quota_6_pct} unités bénéficiaires) ;\n• Mobilisation possible des aides AGEFIPH à l'embauche et à l'équipement du poste.\n\nSeriez-vous disponible cette semaine pour un premier échange de 15 minutes ?\n\nBien cordialement,`;
}

async function openCompanyDrawer(siren) {
  const comp = state.companies.find((c) => c.siren === siren) || state.pipeline[siren]?.company;
  if (!comp) return;

  const backdrop = document.getElementById('drawer-backdrop');
  document.getElementById('drawer-eyebrow').textContent = `SIREN ${comp.siren} • SIRET ${comp.siret}`;
  document.getElementById('drawer-title').textContent = comp.name;

  const bd = comp.score_breakdown || { hiring: 30, oeth: 18, maturity: 12, digital: 15 };
  const body = document.getElementById('drawer-body');
  const isSaved = Boolean(state.pipeline[comp.siren]);

  body.innerHTML = `
    <div class="drawer-section">
      <h3>${Icons.sparkleTarget('icon')} Décomposition du Score (${comp.composite_score}/100)</h3>
      <div class="breakdown-bars">
        <div class="bar-row"><span>Embauche (${comp.hiring.source})</span><div class="bar-track"><div class="bar-fill" style="width:${(bd.hiring / 40) * 100}%"></div></div><strong>${bd.hiring}/40</strong></div>
        <div class="bar-row"><span>Effet de levier OETH</span><div class="bar-track"><div class="bar-fill" style="width:${(bd.oeth / 25) * 100}%"></div></div><strong>${bd.oeth}/25</strong></div>
        <div class="bar-row"><span>Maturité RSE & Finances</span><div class="bar-track"><div class="bar-fill" style="width:${(bd.maturity / 20) * 100}%"></div></div><strong>${bd.maturity}/20</strong></div>
        <div class="bar-row"><span>Site web actif</span><div class="bar-track"><div class="bar-fill" style="width:${(bd.digital / 15) * 100}%"></div></div><strong>${bd.digital}/15</strong></div>
      </div>
    </div>

    <div class="drawer-section">
      <h3>${Icons.euroShield('icon')} Enjeu Financier OETH & Santé SIRENE</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.86rem;">
        <div><strong>Tranche :</strong> ${escapeHtml(comp.oeth.bracket_label)}</div>
        <div><strong>Obligation 6% :</strong> ~${comp.oeth.quota_6_pct} salarié(s) BOE</div>
        <div><strong>Économie / embauche RQTH :</strong> <span style="color:var(--accent-emerald);font-weight:700">${formatEuro(comp.oeth.saving_per_rqth_hire)} / an</span></div>
        <div><strong>Exposition si 0 BOE :</strong> <span style="color:var(--accent-amber);font-weight:700">${formatEuro(comp.oeth.annual_exposure_zero_boe)} / an</span></div>
        <div><strong>CA (${escapeHtml(comp.finances?.year || '—')}) :</strong> ${formatCompactEuro(comp.finances?.ca)}</div>
        <div><strong>Résultat net :</strong> ${formatCompactEuro(comp.finances?.resultat_net)}</div>
      </div>
      <div style="font-size:0.82rem;color:var(--text-secondary);">
        <strong>Dirigeant identifié :</strong> ${escapeHtml(comp.leader || 'Non renseigné')}<br/>
        <strong>Adresse :</strong> ${escapeHtml(comp.address)}
      </div>
    </div>

    <div class="drawer-section">
      <h3>${Icons.globeCheck('icon')} Analyse Live du Site Web</h3>
      <div id="site-scan-box" style="font-size:0.85rem;color:var(--text-secondary);">
        ${
          comp.website
            ? `URL vérifiée : <a href="${escapeHtml(comp.website)}" target="_blank" rel="noopener" style="color:var(--accent-cyan)">${escapeHtml(comp.website)}</a> (HTTP ${comp.website_status})
               <div style="margin-top:8px;"><button type="button" class="btn-ghost" id="btn-deep-scan">Scanner page Carrières & Emails</button></div>`
            : 'Aucun site web actif détecté automatiquement.'
        }
      </div>
    </div>

    <div class="drawer-section">
      <h3>${Icons.mailSpark('icon')} Générateur d'Approche Spontanée</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button type="button" class="preset-chip active" data-tone="oeth_direct">Approche OETH & RQTH</button>
        <button type="button" class="preset-chip" data-tone="discrete">Approche métier discrète</button>
        <button type="button" class="preset-chip" data-tone="linkedin">Message LinkedIn court</button>
      </div>
      <textarea class="pitch-textarea" id="pitch-output">${escapeHtml(buildOutreachPitch(comp, 'oeth_direct'))}</textarea>
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        <button type="button" class="btn-primary" id="btn-copy-pitch" style="height:38px;padding:0 16px;">
          ${Icons.copy('icon')} <span>Copier le message</span>
        </button>
        <button type="button" class="btn-ghost" id="btn-drawer-save">
          ${Icons.bookmark('icon', isSaved)} <span>${isSaved ? 'Dans Mes Cibles' : 'Sauvegarder en cible'}</span>
        </button>
      </div>
    </div>
  `;

  backdrop.hidden = false;

  body.querySelectorAll('[data-tone]').forEach((btn) => {
    btn.addEventListener('click', () => {
      body.querySelectorAll('[data-tone]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('pitch-output').value = buildOutreachPitch(comp, btn.dataset.tone);
    });
  });

  document.getElementById('btn-copy-pitch').addEventListener('click', async () => {
    await navigator.clipboard.writeText(document.getElementById('pitch-output').value);
    showToast('Message copié dans le presse-papiers !');
  });

  document.getElementById('btn-drawer-save').addEventListener('click', () => {
    toggleSaveCompany(comp.siren);
    const nowSaved = Boolean(state.pipeline[comp.siren]);
    document.getElementById('btn-drawer-save').innerHTML = `${Icons.bookmark('icon', nowSaved)} <span>${nowSaved ? 'Dans Mes Cibles' : 'Sauvegarder en cible'}</span>`;
  });

  const deepBtn = document.getElementById('btn-deep-scan');
  if (deepBtn && comp.website) {
    deepBtn.addEventListener('click', async () => {
      deepBtn.disabled = true;
      deepBtn.textContent = 'Scan en cours...';
      try {
        const res = await fetch(`api/verify_site.php?url=${encodeURIComponent(comp.website)}`);
        const info = await res.json();
        document.getElementById('site-scan-box').innerHTML = `
          <div><strong>Titre :</strong> ${escapeHtml(info.title || 'Sans titre')}</div>
          <div><strong>HTTPS :</strong> ${info.https ? 'Oui (sécurisé)' : 'Non'} • <strong>Latence :</strong> ${info.latency_ms} ms</div>
          <div><strong>Page Carrières détectée :</strong> ${info.careers_url ? `<a href="${escapeHtml(info.careers_url)}" target="_blank" rel="noopener" style="color:var(--accent-emerald)">${escapeHtml(info.careers_url)}</a>` : 'Non trouvée sur la home'}</div>
          <div><strong>Emails publics :</strong> ${info.emails?.length ? escapeHtml(info.emails.join(', ')) : 'Aucun sur la page d\'accueil'}</div>
        `;
      } catch {
        deepBtn.textContent = 'Erreur de scan';
      }
    });
  }
}

function openModal(title, html) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-backdrop').hidden = false;
}

function closeModal() {
  document.getElementById('modal-backdrop').hidden = true;
}

function openSimulatorModal() {
  openModal(
    'Simulateur Financier OETH (20+ salariés)',
    `
    <p style="margin:0;color:var(--text-secondary);font-size:0.9rem;">
      Calculez l'intérêt financier direct d'une entreprise assujettie à l'Obligation d'Emploi des Travailleurs Handicapés (quota légal de <strong>6%</strong> dès 20 salariés).
    </p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="field-group"><label>Effectif total (EMA)</label><input type="number" id="sim-headcount" value="120" min="20" max="50000"/></div>
      <div class="field-group"><label>Salariés RQTH/BOE actuels</label><input type="number" id="sim-boe" value="2" min="0" max="5000"/></div>
      <div class="field-group"><label>SMIC horaire brut (€)</label><input type="number" id="sim-smic" value="11.88" step="0.01"/></div>
      <div class="field-group" style="justify-content:end;">
        <label class="switch-chip"><input type="checkbox" id="sim-zero"/><span>0 effort depuis + de 3 ans (1500×SMIC)</span></label>
      </div>
    </div>
    <div id="sim-output" class="drawer-section"></div>
    `
  );

  const recalc = () => {
    const res = calculateCustomOeth(
      document.getElementById('sim-headcount').value,
      document.getElementById('sim-boe').value,
      Number(document.getElementById('sim-smic').value),
      document.getElementById('sim-zero').checked
    );
    document.getElementById('sim-output').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
        <div><small style="color:var(--text-muted)">Obligation légale (6%)</small><div style="font-size:1.35rem;font-weight:700">${res.quota} unités BOE</div></div>
        <div><small style="color:var(--text-muted)">Unités manquantes</small><div style="font-size:1.35rem;font-weight:700;color:var(--accent-coral)">${res.missing} unité(s)</div></div>
        <div><small style="color:var(--text-muted)">Contribution AGEFIPH annuelle</small><div style="font-size:1.35rem;font-weight:700;color:var(--accent-amber)">${formatEuro(res.totalContribution)}/an</div></div>
        <div><small style="color:var(--text-muted)">Économie pour 1 embauche RQTH</small><div style="font-size:1.35rem;font-weight:700;color:var(--accent-emerald)">+${formatEuro(res.savingOneHire)}/an</div></div>
      </div>
      <div style="font-size:0.82rem;color:var(--text-secondary);">Barème appliqué : <strong>${res.coeff} × SMIC horaire brut</strong> par unité manquante.</div>
    `;
  };
  ['sim-headcount', 'sim-boe', 'sim-smic', 'sim-zero'].forEach((id) => {
    document.getElementById(id).addEventListener('input', recalc);
  });
  recalc();
}

function openPipelineModal() {
  const entries = Object.values(state.pipeline);
  const stages = ['À cibler', 'Contacté', 'Entretien', 'Écarté'];
  const listHtml = entries.length
    ? entries
        .map(
          (item) => `
          <div class="pipeline-item">
            <div>
              <strong>${escapeHtml(item.company.name)}</strong>
              <div style="font-size:0.78rem;color:var(--text-secondary)">
                ${escapeHtml(item.company.oeth.bracket_label)} • Économie ${formatEuro(item.company.oeth.saving_per_rqth_hire)}/an
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <select data-stage-siren="${escapeHtml(item.company.siren)}" style="height:34px;width:auto;">
                ${stages.map((st) => `<option value="${st}" ${item.stage === st ? 'selected' : ''}>${st}</option>`).join('')}
              </select>
              <button type="button" class="btn-ghost" data-inspect-siren="${escapeHtml(item.company.siren)}" style="height:34px;">Fiche</button>
              <button type="button" class="btn-ghost" data-del-siren="${escapeHtml(item.company.siren)}" style="height:34px;">Retirer</button>
            </div>
          </div>`
        )
        .join('')
    : '<p style="color:var(--text-secondary)">Aucune cible enregistrée pour le moment. Cliquez sur le marque-page d\'une entreprise pour l\'ajouter ici.</p>';

  openModal(`Mes Cibles OETH (${entries.length})`, `<div style="display:flex;flex-direction:column;gap:10px;">${listHtml}</div>`);

  document.querySelectorAll('[data-stage-siren]').forEach((sel) => {
    sel.addEventListener('change', () => {
      state.pipeline[sel.dataset.stageSiren].stage = sel.value;
      savePipeline();
      showToast(`Statut mis à jour : ${sel.value}`);
    });
  });
  document.querySelectorAll('[data-inspect-siren]').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeModal();
      openCompanyDrawer(btn.dataset.inspectSiren);
    });
  });
  document.querySelectorAll('[data-del-siren]').forEach((btn) => {
    btn.addEventListener('click', () => {
      delete state.pipeline[btn.dataset.delSiren];
      savePipeline();
      openPipelineModal();
      renderCurrentView();
    });
  });
}

async function openSettingsModal(feedback = null) {
  openModal('Configuration APIs & Diagnostics Live', '<p>Vérification de la connectivité aux APIs publiques françaises...</p>');
  try {
    const res = await fetch('api/settings.php?check=1', { headers: getFtAuthHeaders() });
    const data = await res.json();
    const h = data.health || {};
    const isNetlify = data.runtime === 'netlify';
    const statusLine = (ok, ms, extra = '') =>
      `<span style="color:${ok ? 'var(--accent-emerald)' : 'var(--accent-amber)'};font-weight:700">${ok ? 'Connecté' : 'Non actif'}</span> (${ms || 0} ms) ${extra}`;

    const storageHint = isNetlify
      ? 'Sur Netlify, configurez <code>FT_CLIENT_ID</code> et <code>FT_CLIENT_SECRET</code> dans <em>Site configuration → Environment variables</em>, ou enregistrez vos clés ici (mémorisées dans votre navigateur).'
      : 'Les identifiants sont stockés côté serveur uniquement dans <code>data/credentials.json</code>. Sans clés France Travail, l\'application exploite l\'API SIRENE en direct avec scoring prédictif.';

    const feedbackHtml =
      feedback && typeof feedback.text === 'string'
        ? `<div style="padding:10px 12px;border-radius:10px;font-size:0.84rem;border:1px solid ${feedback.ok ? 'rgba(16,185,129,0.45)' : 'rgba(251,113,133,0.55)'};background:${feedback.ok ? 'rgba(16,185,129,0.12)' : 'rgba(251,113,133,0.12)'};color:${feedback.ok ? 'var(--accent-emerald)' : 'var(--accent-coral)'};">
             <strong>${escapeHtml(feedback.text)}</strong>
             ${!feedback.ok ? '<div style="margin-top:6px;font-size:0.78rem;color:var(--text-secondary);">Vérifiez sur francetravail.io : 1) Identifiant client (commence par <code>PAR_...</code>) & Clé secrète sans espace, 2) Souscription active à l\'API <strong>La Bonne Boîte v2</strong>, 3) Contexte Production (non Sandbox).</div>' : ''}
           </div>`
        : '';

    const savedLocal = getSavedFtCreds();
    document.getElementById('modal-body').innerHTML = `
      ${feedbackHtml}
      <div class="drawer-section">
        <h3>État des APIs publiques</h3>
        <div style="font-size:0.86rem;display:flex;flex-direction:column;gap:6px;">
          <div>• <strong>Recherche d'entreprises (SIRENE) :</strong> ${statusLine(h.recherche_entreprises?.ok, h.recherche_entreprises?.latency_ms)}</div>
          <div>• <strong>API Géo Communes :</strong> ${statusLine(h.geo_api?.ok, h.geo_api?.latency_ms)}</div>
          <div>• <strong>France Travail La Bonne Boîte v2 :</strong> ${statusLine(h.france_travail_lbb?.ok, h.france_travail_lbb?.latency_ms, escapeHtml(h.france_travail_lbb?.detail || ''))}</div>
        </div>
      </div>
      <form class="drawer-section" id="ft-settings-form" autocomplete="off">
        <h3>Identifiants France Travail (scope <code>api_labonneboitev2</code>)</h3>
        <p style="margin:0;font-size:0.82rem;color:var(--text-secondary);">
          ${storageHint}
        </p>
        <div class="field-group"><label for="ft-client-id">Identifiant client (Client ID) ${data.masked_client_id ? `(actuel: ${escapeHtml(data.masked_client_id)})` : ''}</label><input type="text" id="ft-client-id" autocomplete="username" value="${escapeHtml(savedLocal?.id || '')}" placeholder="PAR_..."/></div>
        <div class="field-group"><label for="ft-client-secret">Clé secrète (Client Secret)</label><input type="password" id="ft-client-secret" autocomplete="current-password" value="${escapeHtml(savedLocal?.secret || '')}" placeholder="••••••••••••"/></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button type="submit" class="btn-primary" id="btn-save-ft" style="height:40px;">Tester & Enregistrer</button>
          ${data.has_ft_credentials ? '<button type="button" class="btn-ghost" id="btn-clear-ft">Effacer les clés</button>' : ''}
        </div>
      </form>
    `;

    document.getElementById('ft-settings-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cid = document.getElementById('ft-client-id').value.replace(/[\r\n\s]+/g, '');
      const sec = document.getElementById('ft-client-secret').value.replace(/[\r\n\s]+/g, '');
      if ((!cid || !sec) && !data.has_ft_credentials) {
        showToast('Veuillez renseigner l\'Identifiant client et la Clé secrète.', true);
        return;
      }
      if (isNetlify && cid && sec) {
        localStorage.setItem(STORAGE_FT_SESSION, JSON.stringify({ id: cid, secret: sec }));
      }
      const saveRes = await fetch('api/settings.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getFtAuthHeaders() },
        body: JSON.stringify({ action: 'save', ft_client_id: cid, ft_client_secret: sec }),
      });
      const out = await saveRes.json();
      const isOk = Boolean(out.ok && out.oauth_verified);
      const msg = out.message || out.error || 'Réponse inconnue';
      showToast(msg, !isOk);
      fetchSettingsStatus();
      openSettingsModal({ ok: isOk, text: msg });
    });

    const clearBtn = document.getElementById('btn-clear-ft');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        localStorage.removeItem(STORAGE_FT_SESSION);
        sessionStorage.removeItem(STORAGE_FT_SESSION);
        await fetch('api/settings.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' }),
        });
        showToast('Identifiants France Travail supprimés');
        fetchSettingsStatus();
        openSettingsModal({ ok: true, text: 'Identifiants supprimés.' });
      });
    }
  } catch (err) {
    document.getElementById('modal-body').innerHTML = `<p>Erreur diagnostics : ${escapeHtml(err.message)}</p>`;
  }
}

function exportCsv() {
  if (!state.filtered.length) return showToast('Aucun résultat à exporter', true);
  const headers = ['SIREN', 'SIRET', 'Entreprise', 'Effectif', 'Economie_OETH_EUR', 'Score_Composite', 'Score_Embauche', 'Dirigeant', 'Site_Web', 'Ville', 'Code_Postal', 'NAF'];
  const rows = state.filtered.map((c) => [
    c.siren,
    c.siret,
    c.name,
    c.oeth.bracket_label,
    c.oeth.saving_per_rqth_hire,
    c.composite_score,
    c.hiring.score_5,
    c.leader || '',
    c.website || '',
    c.city,
    c.postal_code,
    c.naf,
  ]);
  const csv = [headers, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cibles-oeth-${state.meta?.rome || 'export'}.csv`;
  a.click();
  showToast('Export CSV téléchargé !');
}

function exportJson() {
  if (!state.filtered.length) return showToast('Aucun résultat à exporter', true);
  const blob = new Blob([JSON.stringify({ meta: state.meta, companies: state.filtered }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cibles-oeth-${state.meta?.rome || 'export'}.json`;
  a.click();
  showToast('Export JSON téléchargé !');
}

function bindEvents() {
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('input-rome').addEventListener('input', () => {
    updateRomeHint();
    renderRomePresets();
  });
  document.getElementById('search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    runSearch();
  });

  document.getElementById('input-local-filter').addEventListener('input', applyLocalFiltersAndRender);
  document.getElementById('select-sort').addEventListener('change', applyLocalFiltersAndRender);
  document.getElementById('chk-active-site').addEventListener('change', runSearch);
  document.getElementById('chk-only-rse').addEventListener('change', runSearch);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.view = btn.dataset.view;
      renderCurrentView();
    });
  });

  document.getElementById('btn-close-drawer').addEventListener('click', () => {
    document.getElementById('drawer-backdrop').hidden = true;
  });
  document.getElementById('drawer-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'drawer-backdrop') document.getElementById('drawer-backdrop').hidden = true;
  });

  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  document.getElementById('btn-open-simulator').addEventListener('click', openSimulatorModal);
  document.getElementById('btn-open-pipeline').addEventListener('click', openPipelineModal);
  document.getElementById('btn-open-settings').addEventListener('click', () => openSettingsModal());
  document.getElementById('btn-engine-status').addEventListener('click', () => openSettingsModal());

  document.getElementById('btn-export-csv').addEventListener('click', exportCsv);
  document.getElementById('btn-export-json').addEventListener('click', exportJson);
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  injectStaticIcons();
  updateRomeHint();
  renderRomePresets();
  initCityAutocomplete();
  updatePipelineBadge();
  bindEvents();
  fetchSettingsStatus();
  runSearch();
});
