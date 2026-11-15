/**
 * French ROME Codes Catalog, OETH Financial Formulas & Formatting Utilities.
 */
export const ROME_CATALOG = [
  { code: 'M1805', label: 'Études et développement informatique', sector: 'Tech & Numérique', color: '#22D3EE' },
  { code: 'M1806', label: 'Conseil et maîtrise d\'ouvrage SI', sector: 'Tech & Conseil SI', color: '#818CF8' },
  { code: 'M1802', label: 'Expertise & support systèmes / Cloud', sector: 'Infra & Cyber', color: '#38BDF8' },
  { code: 'E1104', label: 'Conception contenus multimédias (UX/UI)', sector: 'Design & Produit', color: '#F472B6' },
  { code: 'M1403', label: 'Études socio-économiques / Data & BI', sector: 'Data & Analytics', color: '#A78BFA' },
  { code: 'M1705', label: 'Marketing & Acquisition digitale', sector: 'Marketing', color: '#FB7185' },
  { code: 'M1707', label: 'Stratégie commerciale / Business Dev', sector: 'Commerce B2B', color: '#FBBF24' },
  { code: 'M1503', label: 'Management des ressources humaines', sector: 'RH & Inclusion', color: '#34D399' },
  { code: 'M1203', label: 'Comptabilité & Contrôle financier', sector: 'Finance & Audit', color: '#2DD4BF' },
  { code: 'H1206', label: 'Ingénierie études & R&D industrielle', sector: 'Ingénierie & R&D', color: '#60A5FA' },
  { code: 'K2111', label: 'Formation professionnelle', sector: 'EdTech & Formation', color: '#F59E0B' },
  { code: 'I1304', label: 'Maintenance équipements industriels', sector: 'Industrie', color: '#FB923C' },
];

export const POPULAR_CITIES = [
  { name: 'Paris', insee: '75056', postal: '75001', departement: '75', lat: 48.8566, lon: 2.3522 },
  { name: 'Lyon', insee: '69123', postal: '69001', departement: '69', lat: 45.7640, lon: 4.8357 },
  { name: 'Bordeaux', insee: '33063', postal: '33000', departement: '33', lat: 44.8378, lon: -0.5792 },
  { name: 'Nantes', insee: '44109', postal: '44000', departement: '44', lat: 47.2184, lon: -1.5536 },
  { name: 'Toulouse', insee: '31555', postal: '31000', departement: '31', lat: 43.6047, lon: 1.4442 },
  { name: 'Lille', insee: '59350', postal: '59000', departement: '59', lat: 50.6292, lon: 3.0573 },
];

export function formatEuro(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactEuro(amount) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 'N/C';
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)} Md€`;
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)} M€`;
  if (Math.abs(amount) >= 1_000) return `${Math.round(amount / 1_000)} k€`;
  return formatEuro(amount);
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function calculateCustomOeth(headcount, currentBoeCount, smicHourly = 11.88, isThreeYearsZero = false) {
  const n = Math.max(20, Number(headcount) || 20);
  const quota = Math.max(1, Math.floor(n * 0.06));
  const missing = Math.max(0, quota - Math.max(0, Number(currentBoeCount) || 0));

  let coeff = 400;
  if (n >= 750) coeff = 600;
  else if (n >= 250) coeff = 500;
  if (isThreeYearsZero && Number(currentBoeCount) === 0) {
    coeff = 1500;
  }

  const unitCost = Math.round(coeff * smicHourly);
  const totalContribution = missing * unitCost;
  const savingOneHire = missing > 0 ? unitCost : 0;

  return {
    headcount: n,
    quota,
    missing,
    coeff,
    unitCost,
    totalContribution,
    savingOneHire,
  };
}
