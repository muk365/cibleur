<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Predictive Targeting Engine:
 * Cross-references France Travail La Bonne Boîte v2 + Recherche d'entreprises (SIRENE)
 * + Live Active Website Verification + OETH (20+ salariés) Financial Scoring.
 */

$rome = strtoupper(trim((string) ($_GET['rome'] ?? 'M1805')));
$city = trim((string) ($_GET['city'] ?? 'Paris'));
$lat = (float) ($_GET['lat'] ?? 48.8566);
$lon = (float) ($_GET['lon'] ?? 2.3522);
$departement = trim((string) ($_GET['departement'] ?? ''));
$radius = max(5, min(100, (int) ($_GET['radius'] ?? 25)));
$minSize = (string) ($_GET['min_size'] ?? '20'); // '20', '50', '250'
$onlyActiveSite = ($_GET['only_active_site'] ?? '1') === '1';
$onlyRse = ($_GET['only_rse'] ?? '0') === '1';
$mode = (string) ($_GET['mode'] ?? 'auto'); // auto | lbb | sirene | demo
$limit = max(6, min(30, (int) ($_GET['limit'] ?? 18)));
$smicHourly = max(10.0, min(20.0, (float) ($_GET['smic'] ?? 11.88)));

$allBrackets = getOethHeadcountBrackets();
$allowedBrackets = array_map('strval', array_keys($allBrackets));
if ($minSize === '50') {
    $allowedBrackets = ['21', '22', '31', '32', '41', '42', '51', '52', '53'];
} elseif ($minSize === '250') {
    $allowedBrackets = ['32', '41', '42', '51', '52', '53'];
}

$romeCatalog = getRomeCatalog();
$romeInfo = $romeCatalog[$rome] ?? [
    'label' => 'Métier ROME ' . $rome,
    'sector' => 'Ciblage personnalisé',
    'nafs' => ['62.01Z', '62.02A', '70.22Z', '71.12B'],
    'keywords' => ['conseil', 'services'],
];

if ($departement === '' && $city !== '') {
    $cityLower = mb_strtolower($city);
    $cityDeptMap = [
        'paris' => '75', 'lyon' => '69', 'marseille' => '13', 'toulouse' => '31',
        'bordeaux' => '33', 'nantes' => '44', 'lille' => '59', 'rennes' => '35',
        'strasbourg' => '67', 'montpellier' => '34', 'grenoble' => '38', 'nice' => '06',
    ];
    if (isset($cityDeptMap[$cityLower])) {
        $departement = $cityDeptMap[$cityLower];
    }
}

/**
 * Clean company legal name into domain slug candidates.
 */
function buildDomainCandidates(string $name, ?string $sigle = null): array
{
    $candidates = [];
    $clean = mb_strtolower($name);
    $clean = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $clean) ?: $clean;
    $clean = preg_replace('/[^a-z0-9\s\-]/', ' ', $clean);

    $stopWords = [
        'sas', 'sasu', 'sarl', 'eurl', 'sa', 'snc', 'scop', 'scic', 'gie', 'selarl', 'selafa',
        'societe', 'entreprise', 'etablissements', 'groupe', 'group', 'holding', 'france',
        'europe', 'international', 'services', 'service', 'solutions', 'technologies',
        'technologie', 'consulting', 'conseil', 'associes', 'et', 'de', 'du', 'des', 'la', 'le', 'les', 'l', 'd',
    ];

    $words = array_values(array_filter(preg_split('/\s+/', trim($clean)), static function ($w) use ($stopWords): bool {
        return $w !== '' && !in_array($w, $stopWords, true) && strlen($w) >= 2;
    }));

    $allWords = array_values(array_filter(preg_split('/\s+/', trim($clean)), static fn($w) => $w !== ''));

    $slugs = [];
    if (!empty($sigle)) {
        $s = preg_replace('/[^a-z0-9]/', '', strtolower(iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $sigle) ?: $sigle));
        if (strlen($s) >= 2) {
            $slugs[] = $s;
        }
    }
    if (!empty($words)) {
        if (count($words) >= 2) {
            $slugs[] = $words[0] . $words[1];
            $slugs[] = $words[0] . '-' . $words[1];
        }
        $slugs[] = $words[0];
        if (count($words) >= 3) {
            $slugs[] = implode('', array_slice($words, 0, 3));
        }
    } elseif (!empty($allWords)) {
        $slugs[] = $allWords[0];
    }

    $slugs = array_values(array_unique(array_filter($slugs, static fn($s) => strlen($s) >= 3 && strlen($s) <= 28)));
    $slugs = array_slice($slugs, 0, 3);

    foreach ($slugs as $slug) {
        $candidates[] = "https://www.{$slug}.fr";
        $candidates[] = "https://www.{$slug}.com";
    }
    foreach ($slugs as $slug) {
        $candidates[] = "https://{$slug}.fr";
        $candidates[] = "https://{$slug}.io";
    }

    return array_values(array_unique(array_slice($candidates, 0, 6)));
}

/**
 * Concurrently verify candidate URLs across multiple companies using curl_multi,
 * with local 24h file cache to keep repeat queries ultra-fast.
 */
function verifyCompanyWebsitesBatch(array $companies): array
{
    $cacheFile = CACHE_DIR . '/websites_cache.json';
    $cache = [];
    if (file_exists($cacheFile)) {
        $decoded = json_decode((string) @file_get_contents($cacheFile), true);
        if (is_array($decoded)) {
            $now = time();
            foreach ($decoded as $siren => $entry) {
                if (($entry['ts'] ?? 0) > $now - 86400) {
                    $cache[$siren] = $entry;
                }
            }
        }
    }

    $toProbe = []; // siren => [url1, url2, ...]
    foreach ($companies as $idx => $comp) {
        $siren = $comp['siren'];
        if (!empty($comp['lbb_website'])) {
            $toProbe[$siren] = [$comp['lbb_website']];
            continue;
        }
        if (isset($cache[$siren])) {
            continue;
        }
        $toProbe[$siren] = buildDomainCandidates($comp['name'], $comp['sigle'] ?? null);
    }

    if (!empty($toProbe)) {
        // Probe in waves of up to 48 URLs concurrently
        $mh = curl_multi_init();
        $handles = [];
        $metaMap = [];

        foreach ($toProbe as $siren => $urls) {
            foreach ($urls as $priority => $url) {
                $ch = curl_init($url);
                curl_setopt_array($ch, [
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_NOBODY => true,
                    CURLOPT_FOLLOWLOCATION => true,
                    CURLOPT_MAXREDIRS => 3,
                    CURLOPT_TIMEOUT => 3,
                    CURLOPT_CONNECTTIMEOUT => 2,
                    CURLOPT_SSL_VERIFYPEER => false,
                    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; CibleurOETH/1.0)',
                ]);
                $id = (int) $ch;
                $handles[$id] = $ch;
                $metaMap[$id] = ['siren' => $siren, 'url' => $url, 'priority' => $priority, 'start' => microtime(true)];
                curl_multi_add_handle($mh, $ch);
            }
        }

        $running = null;
        do {
            $mrc = curl_multi_exec($mh, $running);
            if ($running > 0) {
                curl_multi_select($mh, 0.15);
            }
        } while ($running > 0 && $mrc === CURLM_OK);

        $resultsBySiren = [];
        foreach ($handles as $id => $ch) {
            $info = $metaMap[$id];
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $effectiveUrl = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
            $latency = (int) round((microtime(true) - $info['start']) * 1000);

            if ($status >= 200 && $status < 400) {
                $siren = $info['siren'];
                if (!isset($resultsBySiren[$siren]) || $info['priority'] < $resultsBySiren[$siren]['priority']) {
                    $resultsBySiren[$siren] = [
                        'website' => $effectiveUrl ?: $info['url'],
                        'status' => $status,
                        'verified' => true,
                        'latency_ms' => $latency,
                        'priority' => $info['priority'],
                    ];
                }
            }
            curl_multi_remove_handle($mh, $ch);
            curl_close($ch);
        }
        curl_multi_close($mh);

        $now = time();
        foreach ($toProbe as $siren => $_) {
            if (isset($resultsBySiren[$siren])) {
                $r = $resultsBySiren[$siren];
                $cache[$siren] = [
                    'website' => $r['website'],
                    'status' => $r['status'],
                    'verified' => true,
                    'latency_ms' => $r['latency_ms'],
                    'ts' => $now,
                ];
            } else {
                $cache[$siren] = [
                    'website' => null,
                    'status' => 0,
                    'verified' => false,
                    'latency_ms' => 0,
                    'ts' => $now,
                ];
            }
        }

        @file_put_contents($cacheFile, json_encode($cache));
    }

    foreach ($companies as &$comp) {
        $siren = $comp['siren'];
        if (isset($cache[$siren]) && $cache[$siren]['verified']) {
            $comp['website'] = $cache[$siren]['website'];
            $comp['website_verified'] = true;
            $comp['website_status'] = $cache[$siren]['status'];
            $comp['website_latency_ms'] = $cache[$siren]['latency_ms'];
        } else {
            $comp['website'] = null;
            $comp['website_verified'] = false;
            $comp['website_status'] = 0;
            $comp['website_latency_ms'] = 0;
        }
        unset($comp['lbb_website']);
    }

    return $companies;
}

/**
 * Normalize a SIRENE API company item into our unified domain structure.
 */
function normalizeSireneCompany(array $raw, array $romeInfo, float $smicHourly, ?array $lbbData = null): array
{
    $siege = $raw['siege'] ?? [];
    $matching = $raw['matching_etablissements'][0] ?? $siege;
    $bracket = (string) ($raw['tranche_effectif_salarie'] ?: ($siege['tranche_effectif_salarie'] ?? '12'));
    $oeth = computeOethMetrics($bracket, $smicHourly);

    $naf = (string) ($raw['activite_principale'] ?? ($siege['activite_principale'] ?? ''));
    $complements = $raw['complements'] ?? [];

    // Extract primary executive (Président, DG, Gérant)
    $leader = null;
    foreach (($raw['dirigeants'] ?? []) as $dir) {
        if (($dir['type_dirigeant'] ?? '') === 'personne physique') {
            $qualite = (string) ($dir['qualite'] ?? '');
            if (!str_contains(mb_strtolower($qualite), 'commissaire aux comptes')) {
                $leader = trim(($dir['prenoms'] ?? '') . ' ' . ($dir['nom'] ?? '')) . ($qualite ? " ({$qualite})" : '');
                break;
            }
        }
    }

    // Latest financial year
    $latestCa = null;
    $latestNet = null;
    $financeYear = null;
    if (!empty($raw['finances']) && is_array($raw['finances'])) {
        krsort($raw['finances']);
        foreach ($raw['finances'] as $yr => $fin) {
            $financeYear = (string) $yr;
            $latestCa = $fin['ca'] ?? null;
            $latestNet = $fin['resultat_net'] ?? null;
            break;
        }
    }

    $rseSignals = [];
    if (!empty($complements['est_societe_mission'])) {
        $rseSignals[] = 'Société à mission';
    }
    if (!empty($complements['est_ess'])) {
        $rseSignals[] = 'ESS (Économie Sociale & Solidaire)';
    }
    if (!empty($complements['est_achats_responsables'])) {
        $rseSignals[] = 'Label Achats Responsables';
    }
    if (!empty($complements['egapro_renseigne'])) {
        $rseSignals[] = 'Index Egapro publié';
    }
    if (!empty($complements['est_siae'])) {
        $rseSignals[] = 'Structure SIAE';
    }
    if (!empty($complements['bilan_ges_renseigne'])) {
        $rseSignals[] = 'Bilan GES publié';
    }

    // Hiring score (from LBB v2 if available, otherwise predictive SIRENE score 2.6..4.9)
    $lbbScore = null;
    $hiringSource = 'SIRENE Prédictif';
    if ($lbbData && isset($lbbData['hiring_score'])) {
        $lbbScore = (float) $lbbData['hiring_score'];
        $hiringSource = 'La Bonne Boîte v2';
    } else {
        $base = 2.8;
        if (in_array($naf, $romeInfo['nafs'], true)) {
            $base += 0.7;
        }
        $openSites = (int) ($raw['nombre_etablissements_ouverts'] ?? 1);
        if ($openSites >= 3) {
            $base += 0.45;
        }
        if ($latestNet !== null && $latestNet > 0) {
            $base += 0.35;
        }
        if (!empty($siege['a_opco'])) {
            $base += 0.25;
        }
        if (count($rseSignals) > 0) {
            $base += 0.25;
        }
        $lbbScore = round(min(4.95, $base), 2);
    }

    $lat = (float) ($matching['latitude'] ?? $siege['latitude'] ?? 48.8566);
    $lon = (float) ($matching['longitude'] ?? $siege['longitude'] ?? 2.3522);

    return [
        'siren' => (string) ($raw['siren'] ?? ''),
        'siret' => (string) ($matching['siret'] ?? $siege['siret'] ?? ''),
        'name' => (string) ($raw['nom_complet'] ?? $raw['nom_raison_sociale'] ?? 'Entreprise'),
        'sigle' => $raw['sigle'] ?? null,
        'category' => (string) ($raw['categorie_entreprise'] ?? 'PME'),
        'naf' => $naf,
        'address' => (string) ($matching['adresse'] ?? $siege['adresse'] ?? ''),
        'postal_code' => (string) ($matching['code_postal'] ?? $siege['code_postal'] ?? ''),
        'city' => (string) ($matching['libelle_commune'] ?? $siege['libelle_commune'] ?? ''),
        'departement' => (string) ($matching['departement'] ?? $siege['departement'] ?? ''),
        'lat' => $lat,
        'lon' => $lon,
        'date_creation' => $raw['date_creation'] ?? null,
        'open_sites' => (int) ($raw['nombre_etablissements_ouverts'] ?? 1),
        'leader' => $leader,
        'finances' => [
            'year' => $financeYear,
            'ca' => $latestCa,
            'resultat_net' => $latestNet,
        ],
        'rse_signals' => $rseSignals,
        'idcc' => $complements['liste_idcc'] ?? ($siege['liste_idcc'] ?? []),
        'oeth' => $oeth,
        'hiring' => [
            'score_5' => $lbbScore,
            'potential' => $lbbScore >= 4.0 ? 'high' : ($lbbScore >= 3.2 ? 'medium' : 'moderate'),
            'source' => $hiringSource,
        ],
        'lbb_website' => $lbbData['website'] ?? null,
        'lbb_email' => $lbbData['email'] ?? null,
        'lbb_phone' => $lbbData['phone'] ?? null,
    ];
}

/**
 * Compute composite 0..100 score combining Hiring Potential (40%),
 * OETH Financial Leverage (25%), RSE/Financial Maturity (20%), Digital Presence (15%).
 */
function finalizeCompanyScore(array $comp): array
{
    $hiringPts = min(40, round(($comp['hiring']['score_5'] / 5.0) * 40));

    $headcount = $comp['oeth']['estimated_headcount'];
    $oethPts = 14;
    if ($headcount >= 250) {
        $oethPts = 25;
    } elseif ($headcount >= 100) {
        $oethPts = 22;
    } elseif ($headcount >= 50) {
        $oethPts = 19;
    }

    $rseCount = count($comp['rse_signals']);
    $rsePts = min(14, $rseCount * 5);
    $finPts = (($comp['finances']['resultat_net'] ?? 0) > 0) ? 6 : 2;
    $maturityPts = min(20, $rsePts + $finPts);

    $digitalPts = $comp['website_verified'] ? 15 : 0;

    $total = min(99, $hiringPts + $oethPts + $maturityPts + $digitalPts);

    $comp['composite_score'] = $total;
    $comp['score_breakdown'] = [
        'hiring' => $hiringPts,
        'oeth' => $oethPts,
        'maturity' => $maturityPts,
        'digital' => $digitalPts,
    ];

    return $comp;
}

/**
 * Curated realistic demo dataset for instant preview / offline benchmark.
 */
function buildDemoResults(string $rome, array $romeInfo, string $city, float $smicHourly): array
{
    $samples = [
        [
            'siren' => '479144438', 'siret' => '47914443800161', 'name' => 'INCOMM SOLUTIONS DIGITALES',
            'category' => 'PME', 'naf' => $romeInfo['nafs'][0] ?? '62.01Z',
            'address' => '2 RUE DE LA BLANCHERIE 33370 ARTIGUES-PRES-BORDEAUX', 'postal_code' => '33370',
            'city' => $city ?: 'BORDEAUX', 'departement' => '33', 'lat' => 44.8533, 'lon' => -0.5030,
            'bracket' => '12', 'open_sites' => 15, 'leader' => 'Aimé N\'GUETTA (Président de SAS)',
            'ca' => 12400000, 'net' => 640000, 'rse' => ['Index Egapro publié', 'Convention Syntec'],
            'website' => 'https://www.incomm.fr', 'hiring' => 4.45,
        ],
        [
            'siren' => '389836966', 'siret' => '38983696600122', 'name' => 'ALTEN SA (DIVISION INGENIERIE & SI)',
            'category' => 'GE', 'naf' => $romeInfo['nafs'][1] ?? '62.02A',
            'address' => '40 AVENUE ANDRE MORIZET 92100 BOULOGNE-BILLANCOURT', 'postal_code' => '92100',
            'city' => $city ?: 'PARIS', 'departement' => '92', 'lat' => 48.8355, 'lon' => 2.2412,
            'bracket' => '52', 'open_sites' => 42, 'leader' => 'Simon AZOULAY (PDG)',
            'ca' => 1850000000, 'net' => 112000000, 'rse' => ['Index Egapro publié', 'Label Achats Responsables', 'Bilan GES publié'],
            'website' => 'https://www.alten.fr', 'hiring' => 4.82,
        ],
        [
            'siren' => '424761419', 'siret' => '42476141900045', 'name' => 'OVH GROUPE (CLOUD & INFRASTRUCTURE)',
            'category' => 'GE', 'naf' => '63.11Z',
            'address' => '2 RUE KELLERMANN 59100 ROUBAIX', 'postal_code' => '59100',
            'city' => $city ?: 'LILLE', 'departement' => '59', 'lat' => 50.6915, 'lon' => 3.2016,
            'bracket' => '42', 'open_sites' => 12, 'leader' => 'Benjamin REVCOLEVSCHI (Directeur Général)',
            'ca' => 993000000, 'net' => 28500000, 'rse' => ['Index Egapro publié', 'Bilan GES publié'],
            'website' => 'https://www.ovhcloud.com', 'hiring' => 4.65,
        ],
        [
            'siren' => '493680490', 'siret' => '49368049000039', 'name' => 'DOCTOLIB TECH & PRODUIT',
            'category' => 'ETI', 'naf' => '62.01Z',
            'address' => '54 QUAI CHARLES PASQUA 92300 LEVALLOIS-PERRET', 'postal_code' => '92300',
            'city' => $city ?: 'PARIS', 'departement' => '92', 'lat' => 48.8988, 'lon' => 2.2831,
            'bracket' => '41', 'open_sites' => 8, 'leader' => 'Stanislas NIOX-CHATEAU (Président)',
            'ca' => 280000000, 'net' => 14500000, 'rse' => ['Société à mission', 'Index Egapro publié'],
            'website' => 'https://www.doctolib.fr', 'hiring' => 4.70,
        ],
        [
            'siren' => '453035081', 'siret' => '45303508100028', 'name' => 'OCTO TECHNOLOGY (ACCENTURE)',
            'category' => 'ETI', 'naf' => '62.02A',
            'address' => '34 AVENUE DE L OPERA 75002 PARIS', 'postal_code' => '75002',
            'city' => $city ?: 'PARIS', 'departement' => '75', 'lat' => 48.8691, 'lon' => 2.3335,
            'bracket' => '32', 'open_sites' => 4, 'leader' => 'Ludovic CINQUIN (Directeur Général)',
            'ca' => 96000000, 'net' => 7200000, 'rse' => ['Index Egapro publié', 'Label Achats Responsables'],
            'website' => 'https://www.octo.com', 'hiring' => 4.35,
        ],
        [
            'siren' => '514685445', 'siret' => '51468544500051', 'name' => 'MANO MANO / COLIBRI DIGITAL',
            'category' => 'ETI', 'naf' => '62.01Z',
            'address' => '52 RUE BAYEN 75017 PARIS', 'postal_code' => '75017',
            'city' => $city ?: 'PARIS', 'departement' => '75', 'lat' => 48.8822, 'lon' => 2.2932,
            'bracket' => '31', 'open_sites' => 3, 'leader' => 'Philippe DE CHANVILLE (DG)',
            'ca' => 142000000, 'net' => 4100000, 'rse' => ['Index Egapro publié'],
            'website' => 'https://www.manomano.fr', 'hiring' => 4.10,
        ],
        [
            'siren' => '521983320', 'siret' => '52198332000019', 'name' => 'ATELIER INCLUSIF & CODE SCOP',
            'category' => 'PME', 'naf' => $romeInfo['nafs'][0] ?? '62.01Z',
            'address' => '18 RUE LA FAYETTE 44000 NANTES', 'postal_code' => '44000',
            'city' => $city ?: 'NANTES', 'departement' => '44', 'lat' => 47.2165, 'lon' => -1.5568,
            'bracket' => '21', 'open_sites' => 2, 'leader' => 'Camille MOREAU (Gérante SCOP)',
            'ca' => 6800000, 'net' => 490000, 'rse' => ['ESS (Économie Sociale & Solidaire)', 'Société à mission'],
            'website' => 'https://www.scop-numerique.fr', 'hiring' => 4.25,
        ],
        [
            'siren' => '348651209', 'siret' => '34865120900067', 'name' => 'LUMINESS / SERVICES NUMERIQUES',
            'category' => 'ETI', 'naf' => '63.11Z',
            'address' => '22 RUE DES JEUNEURS 75002 PARIS', 'postal_code' => '75002',
            'city' => $city ?: 'PARIS', 'departement' => '75', 'lat' => 48.8698, 'lon' => 2.3446,
            'bracket' => '32', 'open_sites' => 9, 'leader' => 'Thibault LANXADE (PDG)',
            'ca' => 84000000, 'net' => 3900000, 'rse' => ['Index Egapro publié', 'Label Achats Responsables'],
            'website' => 'https://www.luminess.eu', 'hiring' => 4.55,
        ],
    ];

    $out = [];
    foreach ($samples as $s) {
        $oeth = computeOethMetrics($s['bracket'], $smicHourly);
        $comp = [
            'siren' => $s['siren'],
            'siret' => $s['siret'],
            'name' => $s['name'],
            'sigle' => null,
            'category' => $s['category'],
            'naf' => $s['naf'],
            'address' => $s['address'],
            'postal_code' => $s['postal_code'],
            'city' => $s['city'],
            'departement' => $s['departement'],
            'lat' => $s['lat'],
            'lon' => $s['lon'],
            'date_creation' => '2012-03-14',
            'open_sites' => $s['open_sites'],
            'leader' => $s['leader'],
            'finances' => ['year' => '2024', 'ca' => $s['ca'], 'resultat_net' => $s['net']],
            'rse_signals' => $s['rse'],
            'idcc' => ['1486'],
            'oeth' => $oeth,
            'hiring' => ['score_5' => $s['hiring'], 'potential' => 'high', 'source' => 'Démo LBB × SIRENE'],
            'website' => $s['website'],
            'website_verified' => true,
            'website_status' => 200,
            'website_latency_ms' => 118,
            'lbb_email' => null,
            'lbb_phone' => null,
        ];
        $out[] = finalizeCompanyScore($comp);
    }

    usort($out, static fn($a, $b) => $b['composite_score'] <=> $a['composite_score']);
    return $out;
}

// ----------------- EXECUTION FLOW -----------------

$startTime = microtime(true);
$meta = [
    'rome' => $rome,
    'rome_label' => $romeInfo['label'],
    'rome_sector' => $romeInfo['sector'],
    'city' => $city,
    'radius_km' => $radius,
    'min_size' => $minSize,
    'only_active_site' => $onlyActiveSite,
    'pipeline' => [],
    'fallback_reason' => null,
];

if ($mode === 'demo') {
    $companies = buildDemoResults($rome, $romeInfo, $city, $smicHourly);
    $meta['engine'] = 'demo';
    $meta['pipeline'] = ['Jeu de démonstration LBB × SIRENE', 'Calculateur OETH 20+', 'Scoring Composite'];
    sendJson([
        'ok' => true,
        'meta' => array_merge($meta, [
            'elapsed_ms' => (int) round((microtime(true) - $startTime) * 1000),
            'total_candidates' => count($companies),
            'total_returned' => count($companies),
        ]),
        'companies' => $companies,
    ]);
}

$creds = loadCredentials();
$hasFtCreds = $creds['ft_client_id'] !== '' && $creds['ft_client_secret'] !== '';
$lbbMatches = [];
$usedLbb = false;

// Step 1: Try France Travail La Bonne Boîte v2 if credentials are configured and mode allows
if (($mode === 'auto' || $mode === 'lbb') && $hasFtCreds) {
    $tokenRes = httpFetch(
        'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
        ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        'POST',
        http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => $creds['ft_client_id'],
            'client_secret' => $creds['ft_client_secret'],
            'scope' => 'api_labonneboitev2',
        ]),
        7
    );
    $tokenJson = json_decode($tokenRes['body'], true);

    if ($tokenRes['status'] === 200 && !empty($tokenJson['access_token'])) {
        $accessToken = $tokenJson['access_token'];
        $lbbUrl = 'https://api.francetravail.io/partenaire/labonneboite/v2/recherche?' . http_build_query([
            'rome' => $rome,
            'latitude' => $lat,
            'longitude' => $lon,
            'distance' => $radius,
            'page_size' => 35,
        ]);
        $lbbRes = httpFetch($lbbUrl, [
            'Authorization: Bearer ' . $accessToken,
            'Accept: application/json',
        ], 'GET', null, 8);

        $lbbJson = json_decode($lbbRes['body'], true);
        if ($lbbRes['status'] === 200 && !empty($lbbJson['companies'])) {
            $usedLbb = true;
            $meta['pipeline'][] = 'API La Bonne Boîte v2 (France Travail)';
            foreach ($lbbJson['companies'] as $c) {
                $siret = (string) ($c['siret'] ?? '');
                $siren = substr($siret, 0, 9);
                if (strlen($siren) === 9) {
                    $lbbMatches[$siren] = [
                        'siret' => $siret,
                        'hiring_score' => (float) ($c['hiring_score'] ?? 4.0),
                        'website' => $c['contact_methods']['website'] ?? null,
                        'email' => $c['contact_methods']['email'] ?? null,
                        'phone' => $c['contact_methods']['phone'] ?? null,
                    ];
                }
            }
        } else {
            $meta['fallback_reason'] = 'API La Bonne Boîte v2 HTTP ' . $lbbRes['status'] . ' — bascule automatique sur SIRENE Live.';
        }
    } else {
        $errMsg = $tokenJson['error_description'] ?? $tokenJson['error'] ?? ('HTTP ' . $tokenRes['status']);
        $meta['fallback_reason'] = "OAuth2 France Travail ({$errMsg}) — bascule automatique sur SIRENE Live.";
    }
}

// Step 2: Query API Recherche d'entreprises (SIRENE)
$sireneRawList = [];
$bracketsCsv = implode(',', $allowedBrackets);

if ($usedLbb && !empty($lbbMatches)) {
    // Enrich LBB SIRENs via SIRENE API in parallel using curl_multi
    $mh = curl_multi_init();
    $chs = [];
    foreach (array_keys($lbbMatches) as $siren) {
        $url = 'https://recherche-entreprises.api.gouv.fr/search?q=' . urlencode($siren) . '&per_page=1';
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_SSL_VERIFYPEER => true]);
        $chs[$siren] = $ch;
        curl_multi_add_handle($mh, $ch);
    }
    $running = null;
    do {
        curl_multi_exec($mh, $running);
        if ($running > 0) {
            curl_multi_select($mh, 0.1);
        }
    } while ($running > 0);
    foreach ($chs as $siren => $ch) {
        $body = curl_multi_getcontent($ch);
        $json = json_decode((string) $body, true);
        if (!empty($json['results'][0])) {
            $sireneRawList[] = $json['results'][0];
        }
        curl_multi_remove_handle($mh, $ch);
        curl_close($ch);
    }
    curl_multi_close($mh);
    $meta['pipeline'][] = 'API Recherche d\'entreprises (SIRENE 20+)';
    $meta['engine'] = 'lbb_sirene_live';
} else {
    // Live SIRENE Predictive Mode: combine /near_point (geo radius) & /search (NAF + dept + 20+ brackets)
    $meta['engine'] = 'sirene_live';
    $meta['pipeline'][] = 'API Recherche d\'entreprises (SIRENE 20+ Live)';

    $nafsCsv = implode(',', $romeInfo['nafs']);
    $queries = [
        'https://recherche-entreprises.api.gouv.fr/search?' . http_build_query([
            'activite_principale' => $nafsCsv,
            'tranche_effectif_salarie' => $bracketsCsv,
            'etat_administratif' => 'A',
            'departement' => $departement !== '' ? $departement : null,
            'per_page' => 25,
            'page' => 1,
        ]),
        'https://recherche-entreprises.api.gouv.fr/search?' . http_build_query([
            'activite_principale' => $nafsCsv,
            'tranche_effectif_salarie' => $bracketsCsv,
            'etat_administratif' => 'A',
            'departement' => $departement !== '' ? $departement : null,
            'per_page' => 25,
            'page' => 2,
        ]),
    ];

    if ($lat !== 0.0 && $lon !== 0.0) {
        $queries[] = 'https://recherche-entreprises.api.gouv.fr/near_point?' . http_build_query([
            'lat' => $lat,
            'long' => $lon,
            'radius' => min(50, $radius),
            'activite_principale' => $nafsCsv,
            'per_page' => 25,
        ]);
    }

    $seenSirens = [];
    foreach ($queries as $qUrl) {
        $res = httpFetch($qUrl, ['Accept: application/json'], 'GET', null, 8);
        if ($res['status'] === 200) {
            $json = json_decode($res['body'], true);
            foreach (($json['results'] ?? []) as $item) {
                $siren = (string) ($item['siren'] ?? '');
                if ($siren !== '' && !isset($seenSirens[$siren])) {
                    $seenSirens[$siren] = true;
                    $sireneRawList[] = $item;
                }
            }
        }
    }
}

// Step 3: Strict OETH (20+ salariés) & Active status filtering
$filteredCompanies = [];
foreach ($sireneRawList as $raw) {
    if (($raw['etat_administratif'] ?? '') !== 'A') {
        continue;
    }
    $bracket = (string) ($raw['tranche_effectif_salarie'] ?: ($raw['siege']['tranche_effectif_salarie'] ?? ''));
    if (!in_array($bracket, $allowedBrackets, true)) {
        continue;
    }
    $siren = (string) ($raw['siren'] ?? '');
    $comp = normalizeSireneCompany($raw, $romeInfo, $smicHourly, $lbbMatches[$siren] ?? null);
    if ($onlyRse && empty($comp['rse_signals'])) {
        continue;
    }
    $filteredCompanies[] = $comp;
}

$totalCandidates = count($filteredCompanies);

// Step 4: Concurrent Active Website Verification
$meta['pipeline'][] = 'Vérification HTTP/SSL sites web actifs';
$candidatesToProbe = array_slice($filteredCompanies, 0, 32);
$verifiedBatch = verifyCompanyWebsitesBatch($candidatesToProbe);

$finalCompanies = [];
foreach ($verifiedBatch as $comp) {
    if ($onlyActiveSite && !$comp['website_verified']) {
        continue;
    }
    $finalCompanies[] = finalizeCompanyScore($comp);
}

usort($finalCompanies, static fn($a, $b) => $b['composite_score'] <=> $a['composite_score']);
$finalCompanies = array_slice($finalCompanies, 0, $limit);

$meta['pipeline'][] = 'Calculateur OETH & Scoring Composite';
$meta['elapsed_ms'] = (int) round((microtime(true) - $startTime) * 1000);
$meta['total_candidates'] = $totalCandidates;
$meta['total_returned'] = count($finalCompanies);
$meta['ft_configured'] = $hasFtCreds;

sendJson([
    'ok' => true,
    'meta' => $meta,
    'companies' => $finalCompanies,
]);
