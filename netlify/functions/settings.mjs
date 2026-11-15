import { jsonResponse, fetchWithTiming, getFtCredentials, parseEventJsonBody, requestFtToken } from './_shared.mjs';

export async function handler(event) {
  const method = event.httpMethod || 'GET';

  if (method === 'POST') {
    let input = {};
    try {
      input = parseEventJsonBody(event);
    } catch {
      return jsonResponse({ ok: false, error: 'Corps JSON invalide' }, 400);
    }

    if (input.action === 'clear') {
      return jsonResponse({
        ok: true,
        runtime: 'netlify',
        has_ft_credentials: Boolean(process.env.FT_CLIENT_ID && process.env.FT_CLIENT_SECRET),
        message: 'Clés locales navigateur effacées.',
      });
    }

    const existingCreds = getFtCredentials(event);
    const clientId = String(input.ft_client_id || '').trim() || existingCreds.clientId;
    const clientSecret = String(input.ft_client_secret || '').trim() || existingCreds.clientSecret;

    if (!clientId || !clientSecret) {
      return jsonResponse({
        ok: false,
        runtime: 'netlify',
        has_ft_credentials: false,
        error: 'Client ID et Client Secret sont requis.',
      }, 200);
    }

    const token = await requestFtToken(clientId, clientSecret);

    return jsonResponse({
      ok: true,
      runtime: 'netlify',
      oauth_verified: token.ok,
      oauth_status: token.status,
      oauth_latency_ms: token.latency_ms,
      oauth_scope: token.scope,
      oauth_error: token.error,
      has_ft_credentials: true,
      message: token.ok
        ? `Connexion OAuth2 France Travail (${token.scope}) validée !`
        : `Clés mémorisées, mais OAuth2 France Travail a refusé le jeton (${token.error}). SIRENE Live reste actif.`,
    });
  }

  const creds = getFtCredentials(event);
  const hasCreds = Boolean(creds.clientId && creds.clientSecret);
  const maskedId = hasCreds ? `${creds.clientId.slice(0, 6)}••••${creds.clientId.slice(-4)}` : '';

  let health = null;
  if (event.queryStringParameters?.check === '1') {
    const [sireneCheck, geoCheck] = await Promise.all([
      fetchWithTiming('https://recherche-entreprises.api.gouv.fr/search?q=INCOMM&per_page=1', { headers: { Accept: 'application/json' } }, 5000),
      fetchWithTiming('https://geo.api.gouv.fr/communes?nom=Paris&limit=1', { headers: { Accept: 'application/json' } }, 5000),
    ]);

    let lbbStatus = {
      configured: hasCreds,
      ok: false,
      status: 0,
      latency_ms: 0,
      detail: 'Clés non configurées (mode SIRENE Live actif)',
    };

    if (hasCreds) {
      const token = await requestFtToken(creds.clientId, creds.clientSecret);
      lbbStatus = {
        configured: true,
        ok: token.ok,
        status: token.status,
        latency_ms: token.latency_ms,
        detail: token.ok ? `Token OAuth2 actif (${creds.source}, scope ${token.scope})` : (token.error || `Erreur auth HTTP ${token.status}`),
      };
    }

    health = {
      recherche_entreprises: { ok: sireneCheck.status === 200, status: sireneCheck.status, latency_ms: sireneCheck.latency_ms },
      geo_api: { ok: geoCheck.status === 200, status: geoCheck.status, latency_ms: geoCheck.latency_ms },
      france_travail_lbb: lbbStatus,
    };
  }

  return jsonResponse({
    runtime: 'netlify',
    has_ft_credentials: hasCreds,
    credentials_source: creds.source,
    masked_client_id: maskedId,
    health,
  });
}
