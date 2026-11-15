<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Autocomplete endpoint for French communes via geo.api.gouv.fr,
 * with curated fallback for major cities if offline.
 */
$q = trim((string) ($_GET['q'] ?? ''));
if (mb_strlen($q) < 2) {
    sendJson(['communes' => []]);
}

$isPostal = preg_match('/^\d{2,5}$/', $q) === 1;
$queryParam = $isPostal ? 'codePostal=' . urlencode($q) : 'nom=' . urlencode($q);
$url = "https://geo.api.gouv.fr/communes?{$queryParam}&fields=nom,code,codesPostaux,centre,population,departement&boost=population&limit=8";

$res = httpFetch($url, ['Accept: application/json'], 'GET', null, 5);

if ($res['status'] === 200) {
    $data = json_decode($res['body'], true);
    if (is_array($data)) {
        $communes = array_map(static function (array $c): array {
            $coords = $c['centre']['coordinates'] ?? [2.3522, 48.8566];
            return [
                'name' => $c['nom'] ?? '',
                'insee' => $c['code'] ?? '',
                'postal' => $c['codesPostaux'][0] ?? '',
                'departement' => $c['departement']['code'] ?? substr((string) ($c['code'] ?? ''), 0, 2),
                'population' => $c['population'] ?? 0,
                'lon' => (float) ($coords[0] ?? 2.3522),
                'lat' => (float) ($coords[1] ?? 48.8566),
            ];
        }, $data);
        sendJson(['communes' => $communes, 'source' => 'geo.api.gouv.fr']);
    }
}

// Offline/network fallback for major French cities
$fallback = [
    ['name' => 'Paris', 'insee' => '75056', 'postal' => '75001', 'departement' => '75', 'population' => 2145906, 'lat' => 48.8566, 'lon' => 2.3522],
    ['name' => 'Lyon', 'insee' => '69123', 'postal' => '69001', 'departement' => '69', 'population' => 522250, 'lat' => 45.7640, 'lon' => 4.8357],
    ['name' => 'Marseille', 'insee' => '13055', 'postal' => '13001', 'departement' => '13', 'population' => 873076, 'lat' => 43.2965, 'lon' => 5.3698],
    ['name' => 'Toulouse', 'insee' => '31555', 'postal' => '31000', 'departement' => '31', 'population' => 504078, 'lat' => 43.6047, 'lon' => 1.4442],
    ['name' => 'Bordeaux', 'insee' => '33063', 'postal' => '33000', 'departement' => '33', 'population' => 261804, 'lat' => 44.8378, 'lon' => -0.5792],
    ['name' => 'Nantes', 'insee' => '44109', 'postal' => '44000', 'departement' => '44', 'population' => 323204, 'lat' => 47.2184, 'lon' => -1.5536],
    ['name' => 'Lille', 'insee' => '59350', 'postal' => '59000', 'departement' => '59', 'population' => 236710, 'lat' => 50.6292, 'lon' => 3.0573],
    ['name' => 'Rennes', 'insee' => '35238', 'postal' => '35000', 'departement' => '35', 'population' => 225081, 'lat' => 48.1173, 'lon' => -1.6778],
    ['name' => 'Strasbourg', 'insee' => '67482', 'postal' => '67000', 'departement' => '67', 'population' => 291313, 'lat' => 48.5734, 'lon' => 7.7521],
    ['name' => 'Montpellier', 'insee' => '34172', 'postal' => '34000', 'departement' => '34', 'population' => 302454, 'lat' => 43.6108, 'lon' => 3.8767],
    ['name' => 'Grenoble', 'insee' => '38185', 'postal' => '38000', 'departement' => '38', 'population' => 157477, 'lat' => 45.1885, 'lon' => 5.7245],
    ['name' => 'Nice', 'insee' => '06088', 'postal' => '06000', 'departement' => '06', 'population' => 348085, 'lat' => 43.7102, 'lon' => 7.2620],
];

$needle = mb_strtolower($q);
$filtered = array_values(array_filter($fallback, static function (array $c) use ($needle): bool {
    return str_contains(mb_strtolower($c['name']), $needle) || str_starts_with($c['postal'], $needle);
}));

sendJson(['communes' => $filtered, 'source' => 'fallback']);
