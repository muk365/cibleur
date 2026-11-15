<?php
declare(strict_types=1);

/**
 * Configuration & Domain Constants for Cibleur Prédictif (Marché Caché × OETH 20+).
 */

define('DATA_DIR', __DIR__ . '/../data');
define('CREDENTIALS_FILE', DATA_DIR . '/credentials.json');
define('CACHE_DIR', DATA_DIR . '/cache');

if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0755, true);
}
if (!is_dir(CACHE_DIR)) {
    @mkdir(CACHE_DIR, 0755, true);
}

/**
 * INSEE headcount bracket codes corresponding to 20+ employees (OETH threshold).
 */
function getOethHeadcountBrackets(): array
{
    return [
        '12' => ['label' => '20 à 49 salariés', 'min' => 20, 'max' => 49, 'mid' => 32, 'tier' => '20-249'],
        '21' => ['label' => '50 à 99 salariés', 'min' => 50, 'max' => 99, 'mid' => 72, 'tier' => '20-249'],
        '22' => ['label' => '100 à 199 salariés', 'min' => 100, 'max' => 199, 'mid' => 145, 'tier' => '20-249'],
        '31' => ['label' => '200 à 249 salariés', 'min' => 200, 'max' => 249, 'mid' => 225, 'tier' => '20-249'],
        '32' => ['label' => '250 à 499 salariés', 'min' => 250, 'max' => 499, 'mid' => 360, 'tier' => '250-749'],
        '41' => ['label' => '500 à 999 salariés', 'min' => 500, 'max' => 999, 'mid' => 720, 'tier' => '250-749'],
        '42' => ['label' => '1 000 à 1 999 salariés', 'min' => 1000, 'max' => 1999, 'mid' => 1400, 'tier' => '750+'],
        '51' => ['label' => '2 000 à 4 999 salariés', 'min' => 2000, 'max' => 4999, 'mid' => 3200, 'tier' => '750+'],
        '52' => ['label' => '5 000 à 9 999 salariés', 'min' => 5000, 'max' => 9999, 'mid' => 7000, 'tier' => '750+'],
        '53' => ['label' => '10 000 salariés et plus', 'min' => 10000, 'max' => 25000, 'mid' => 14000, 'tier' => '750+'],
    ];
}

/**
 * ROME code catalog mapped to NAF/APE activity codes for cross-API targeting.
 */
function getRomeCatalog(): array
{
    return [
        'M1805' => [
            'label' => 'Études et développement informatique',
            'sector' => 'Tech & Numérique',
            'nafs' => ['62.01Z', '62.02A', '62.02B', '58.29C', '63.11Z'],
            'keywords' => ['logiciel', 'developpement', 'informatique', 'digital', 'saas'],
        ],
        'M1806' => [
            'label' => 'Conseil et maîtrise d\'ouvrage en systèmes d\'information',
            'sector' => 'Tech & Conseil SI',
            'nafs' => ['62.02A', '62.01Z', '70.22Z', '62.02B'],
            'keywords' => ['conseil', 'systemes', 'si', 'transformation'],
        ],
        'M1802' => [
            'label' => 'Expertise et support en systèmes d\'information',
            'sector' => 'Infra, Cloud & Cybersécurité',
            'nafs' => ['62.02A', '62.03Z', '63.11Z', '61.10Z'],
            'keywords' => ['cloud', 'reseau', 'cyber', 'infogerance'],
        ],
        'E1104' => [
            'label' => 'Conception de contenus multimédias (UX/UI & Design)',
            'sector' => 'Design & Communication',
            'nafs' => ['73.11Z', '74.10Z', '62.01Z', '58.29C'],
            'keywords' => ['design', 'agence', 'web', 'studio'],
        ],
        'M1705' => [
            'label' => 'Marketing',
            'sector' => 'Marketing & Acquisition',
            'nafs' => ['73.11Z', '70.21Z', '73.12Z', '70.22Z'],
            'keywords' => ['marketing', 'communication', 'agence', 'media'],
        ],
        'M1707' => [
            'label' => 'Stratégie commerciale',
            'sector' => 'Commerce & Business Dev',
            'nafs' => ['70.22Z', '46.19B', '62.01Z', '62.02A'],
            'keywords' => ['commercial', 'business', 'distribution', 'services'],
        ],
        'M1203' => [
            'label' => 'Comptabilité',
            'sector' => 'Finance & Audit',
            'nafs' => ['69.20Z', '64.20Z', '70.22Z'],
            'keywords' => ['expertise', 'comptable', 'audit', 'finance'],
        ],
        'M1503' => [
            'label' => 'Management des ressources humaines',
            'sector' => 'RH & Recrutement',
            'nafs' => ['78.10Z', '78.20Z', '70.22Z', '85.59A'],
            'keywords' => ['rh', 'recrutement', 'formation', 'talents'],
        ],
        'H1206' => [
            'label' => 'Management et ingénierie études, recherche et développement industriel',
            'sector' => 'Ingénierie & R&D',
            'nafs' => ['71.12B', '72.19Z', '28.99B', '30.30Z'],
            'keywords' => ['ingenierie', 'etudes', 'industrie', 'innovation'],
        ],
        'K2111' => [
            'label' => 'Formation professionnelle',
            'sector' => 'EdTech & Formation',
            'nafs' => ['85.59A', '85.59B', '85.42Z'],
            'keywords' => ['formation', 'academie', 'institut', 'ecole'],
        ],
        'M1403' => [
            'label' => 'Études et prospectives socio-économiques (Data / BI)',
            'sector' => 'Data & Analytics',
            'nafs' => ['62.02A', '73.20Z', '63.11Z', '70.22Z'],
            'keywords' => ['data', 'analytics', 'etudes', 'conseil'],
        ],
        'I1304' => [
            'label' => 'Installation et maintenance d\'équipements industriels',
            'sector' => 'Industrie & Maintenance',
            'nafs' => ['33.12Z', '33.20A', '43.21A', '28.29B'],
            'keywords' => ['maintenance', 'equipement', 'energie', 'industrie'],
        ],
    ];
}

/**
 * Compute estimated OETH financial parameters for a given headcount bracket.
 * Uses French legal coefficients: 6% quota, 400/500/600 x SMIC horaire brut.
 */
function computeOethMetrics(string $bracketCode, float $smicHourly = 11.88): array
{
    $brackets = getOethHeadcountBrackets();
    $info = $brackets[$bracketCode] ?? $brackets['12'];
    $mid = $info['mid'];
    $quota6 = max(1, (int) floor($mid * 0.06));

    $coeff = 400;
    if ($info['tier'] === '250-749') {
        $coeff = 500;
    } elseif ($info['tier'] === '750+') {
        $coeff = 600;
    }

    $unitAvoidance = round($coeff * $smicHourly);
    $totalRiskZeroBoe = round($quota6 * $unitAvoidance);
    $surContributionUnit = round(1500 * $smicHourly);

    return [
        'bracket_code' => $bracketCode,
        'bracket_label' => $info['label'],
        'estimated_headcount' => $mid,
        'min_headcount' => $info['min'],
        'max_headcount' => $info['max'],
        'quota_6_pct' => $quota6,
        'agefiph_coeff' => $coeff,
        'smic_hourly' => $smicHourly,
        'saving_per_rqth_hire' => $unitAvoidance,
        'annual_exposure_zero_boe' => $totalRiskZeroBoe,
        'surcontribution_per_unit' => $surContributionUnit,
    ];
}

/**
 * Load saved France Travail credentials (never leaked to frontend).
 */
function loadCredentials(): array
{
    $defaults = [
        'ft_client_id' => getenv('FT_CLIENT_ID') ?: '',
        'ft_client_secret' => getenv('FT_CLIENT_SECRET') ?: '',
        'updated_at' => null,
    ];
    if (!file_exists(CREDENTIALS_FILE)) {
        return $defaults;
    }
    $raw = @file_get_contents(CREDENTIALS_FILE);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) {
        return $defaults;
    }
    return array_merge($defaults, $data);
}

/**
 * Save France Travail credentials cleanly.
 */
function saveCredentials(string $clientId, string $clientSecret): bool
{
    $payload = [
        'ft_client_id' => trim($clientId),
        'ft_client_secret' => trim($clientSecret),
        'updated_at' => gmdate('c'),
    ];
    return file_put_contents(CREDENTIALS_FILE, json_encode($payload, JSON_PRETTY_PRINT)) !== false;
}

/**
 * Standard JSON HTTP response helper.
 */
function sendJson(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Execute an HTTP request with cURL and return [status, body, error, latency_ms].
 */
function httpFetch(string $url, array $headers = [], string $method = 'GET', ?string $postBody = null, int $timeout = 10): array
{
    $ch = curl_init($url);
    $start = microtime(true);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 4,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'CibleurOETH-Bot/1.0 (+https://localhost/cibleur)',
        CURLOPT_HTTPHEADER => $headers,
    ]);

    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
        if ($postBody !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $postBody);
        }
    }

    $body = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $latency = (int) round((microtime(true) - $start) * 1000);
    curl_close($ch);

    return [
        'status' => $status,
        'body' => is_string($body) ? $body : '',
        'error' => $err,
        'latency_ms' => $latency,
    ];
}
