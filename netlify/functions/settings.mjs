import { jsonResponse, fetchWithTiming, getFtCredentials } from './_shared.mjs';

export async function handler(event) {
  const method = event.httpMethod || 'GET';

  if (method === 'POST') {
    let input = {};
    try {
      input = JSON.parse(event.body || '{}');
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

    const clientId = String(input.ft_client_id || '').trim() || (process.env.FT_CLIENT_ID || '').trim();
    const clientSecret = String(input.ft_client_secret || '').trim() || (process.env.FT_CLIENT_SECRET || '').trim();

    if (!clientId || !clientSecret) {
      return jsonResponse({ ok: false, error: 'Client ID et Client Secret sont requis.' }, 400);
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'api_labonneboitev2',
    }).toString();

    const tokenRes = await fetchWithTiming(
      'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body,
      },
      8000
    );

    let tokenJson = {};
    try { tokenJson = JSON.parse(tokenRes.body || '{}'); } catch {}
    const oauthOk = tokenRes.status === 200 && Boolean(tokenJson.access_token);

    return jsonResponse({
      ok: true,
      runtime: 'netlify',
      oauth_verified: oauthOk,
      oauth_status: tokenRes.status,
      oauth_latency_ms: tokenRes.latency_ms,
      oauth_error: oauthOk ? null : (tokenJson.error_description || tokenJson.error || tokenRes.error || `HTTP ${tokenRes.status}`),
      has_ft_credentials: true,
      message: oauthOk
        ? 'Connexion OAuth2 France Travail (scope api_labonneboitev2) validée !'
        : 'Clés mémorisées pour cette session, mais la validation OAuth2 a retourné une erreur (SIRENE Live reste actif).',
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
      const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        scope: 'api_labonneboitev2',
      }).toString();

      const ftRes = await fetchWithTiming(
        'https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=/partenaire',
        { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
        6000
      );
      let ftJson = {};
      try { ftJson = JSON.parse(ftRes.body || '{}'); } catch {}
      lbbStatus = {
        configured: true,
        ok: ftRes.status === 200 && Boolean(ftJson.access_token),
        status: ftRes.status,
        latency_ms: ftRes.latency_ms,
        detail: ftRes.status === 200 ? `Token OAuth2 actif (${creds.source})` : (ftJson.error_description || `Erreur auth HTTP ${ftRes.status}`),
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
