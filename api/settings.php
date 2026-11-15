<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Settings & API Diagnostics endpoint.
 * GET: returns masked credential status + optional live health check (?check=1)
 * POST: saves France Travail client_id/client_secret or tests OAuth2 token acquisition
 */
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw ?: '{}', true);
    if (!is_array($input)) {
        sendJson(['ok' => false, 'error' => 'Corps JSON invalide'], 400);
    }

    $action = (string) ($input['action'] ?? 'save');
    if ($action === 'clear') {
        saveCredentials('', '');
        sendJson(['ok' => true, 'has_ft_credentials' => false, 'message' => 'Identifiants France Travail supprimés.']);
    }

    $clientId = trim((string) ($input['ft_client_id'] ?? ''));
    $clientSecret = trim((string) ($input['ft_client_secret'] ?? ''));

    // Keep existing secret if masked/empty when updating only ID
    $existing = loadCredentials();
    if ($clientSecret === '' && $existing['ft_client_secret'] !== '' && $clientId === $existing['ft_client_id']) {
        $clientSecret = $existing['ft_client_secret'];
    }

    if ($clientId === '' || $clientSecret === '') {
        sendJson(['ok' => false, 'error' => 'Client ID et Client Secret sont requis.'], 400);
    }

    // Test OAuth2 token exchange with France Travail before/while saving
    $tokenRes = httpFetch(
        'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
        ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        'POST',
        http_build_query([
            'grant_type' => 'client_credentials',
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'scope' => 'api_labonneboitev2',
        ]),
        8
    );

    $tokenData = json_decode($tokenRes['body'], true);
    $oauthOk = $tokenRes['status'] === 200 && !empty($tokenData['access_token']);

    if ($action === 'save' || $oauthOk) {
        saveCredentials($clientId, $clientSecret);
    }

    sendJson([
        'ok' => true,
        'oauth_verified' => $oauthOk,
        'oauth_status' => $tokenRes['status'],
        'oauth_latency_ms' => $tokenRes['latency_ms'],
        'oauth_error' => $oauthOk ? null : ($tokenData['error_description'] ?? $tokenData['error'] ?? $tokenRes['error'] ?: 'HTTP ' . $tokenRes['status']),
        'has_ft_credentials' => true,
        'message' => $oauthOk
            ? 'Connexion OAuth2 France Travail (scope api_labonneboitev2) validée et enregistrée !'
            : 'Identifiants enregistrés, mais la validation OAuth2 a retourné une erreur (le mode SIRENE Live reste actif en secours).',
    ]);
}

// GET
$creds = loadCredentials();
$hasCreds = $creds['ft_client_id'] !== '' && $creds['ft_client_secret'] !== '';
$maskedId = $hasCreds ? (substr($creds['ft_client_id'], 0, 6) . '••••' . substr($creds['ft_client_id'], -4)) : '';

$health = null;
if (isset($_GET['check']) && $_GET['check'] === '1') {
    $sireneCheck = httpFetch(
        'https://recherche-entreprises.api.gouv.fr/search?q=INCOMM&per_page=1',
        ['Accept: application/json'],
        'GET',
        null,
        5
    );
    $geoCheck = httpFetch(
        'https://geo.api.gouv.fr/communes?nom=Paris&limit=1',
        ['Accept: application/json'],
        'GET',
        null,
        5
    );

    $lbbStatus = ['configured' => $hasCreds, 'ok' => false, 'status' => 0, 'latency_ms' => 0, 'detail' => 'Clés non configurées (mode SIRENE Live actif)'];
    if ($hasCreds) {
        $ftRes = httpFetch(
            'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
            ['Content-Type: application/x-www-form-urlencoded'],
            'POST',
            http_build_query([
                'grant_type' => 'client_credentials',
                'client_id' => $creds['ft_client_id'],
                'client_secret' => $creds['ft_client_secret'],
                'scope' => 'api_labonneboitev2',
            ]),
            6
        );
        $ftJson = json_decode($ftRes['body'], true);
        $lbbStatus = [
            'configured' => true,
            'ok' => $ftRes['status'] === 200 && !empty($ftJson['access_token']),
            'status' => $ftRes['status'],
            'latency_ms' => $ftRes['latency_ms'],
            'detail' => ($ftRes['status'] === 200) ? 'Token OAuth2 actif' : ($ftJson['error_description'] ?? 'Erreur auth HTTP ' . $ftRes['status']),
        ];
    }

    $health = [
        'recherche_entreprises' => [
            'ok' => $sireneCheck['status'] === 200,
            'status' => $sireneCheck['status'],
            'latency_ms' => $sireneCheck['latency_ms'],
        ],
        'geo_api' => [
            'ok' => $geoCheck['status'] === 200,
            'status' => $geoCheck['status'],
            'latency_ms' => $geoCheck['latency_ms'],
        ],
        'france_travail_lbb' => $lbbStatus,
    ];
}

sendJson([
    'has_ft_credentials' => $hasCreds,
    'masked_client_id' => $maskedId,
    'updated_at' => $creds['updated_at'],
    'health' => $health,
]);
