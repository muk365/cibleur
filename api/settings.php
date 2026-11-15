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

    $existing = loadCredentials();
    $clientId = trim((string) ($input['ft_client_id'] ?? '')) ?: $existing['ft_client_id'];
    $clientSecret = trim((string) ($input['ft_client_secret'] ?? '')) ?: $existing['ft_client_secret'];

    if ($clientId === '' || $clientSecret === '') {
        sendJson([
            'ok' => false,
            'has_ft_credentials' => false,
            'error' => 'Client ID et Client Secret sont requis.',
        ]);
    }

    $token = requestFtToken($clientId, $clientSecret);

    if ($action === 'save' || $token['ok']) {
        saveCredentials($clientId, $clientSecret);
    }

    sendJson([
        'ok' => true,
        'oauth_verified' => $token['ok'],
        'oauth_status' => $token['status'],
        'oauth_latency_ms' => $token['latency_ms'],
        'oauth_scope' => $token['scope'],
        'oauth_error' => $token['error'],
        'has_ft_credentials' => true,
        'message' => $token['ok']
            ? "Connexion OAuth2 France Travail ({$token['scope']}) validée et enregistrée !"
            : "Identifiants enregistrés, mais OAuth2 France Travail a refusé le jeton ({$token['error']}). Le mode SIRENE Live reste actif.",
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
        $token = requestFtToken($creds['ft_client_id'], $creds['ft_client_secret']);
        $lbbStatus = [
            'configured' => true,
            'ok' => $token['ok'],
            'status' => $token['status'],
            'latency_ms' => $token['latency_ms'],
            'detail' => $token['ok'] ? "Token OAuth2 actif (scope {$token['scope']})" : ($token['error'] ?? 'Erreur auth HTTP ' . $token['status']),
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
    'runtime' => 'php',
    'has_ft_credentials' => $hasCreds,
    'masked_client_id' => $maskedId,
    'updated_at' => $creds['updated_at'],
    'health' => $health,
]);
