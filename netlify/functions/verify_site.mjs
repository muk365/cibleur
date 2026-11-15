import dns from 'node:dns/promises';
import net from 'node:net';
import { jsonResponse } from './_shared.mjs';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return false;
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80');
}

export async function handler(event) {
  const rawUrl = String(event.queryStringParameters?.url || '').trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return jsonResponse({ ok: false, error: 'URL invalide' }, 400);
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return jsonResponse({ ok: false, error: 'URL invalide' }, 400);
  }

  const host = parsed.hostname.toLowerCase();
  if (!host || ['localhost', '127.0.0.1', '::1'].includes(host)) {
    return jsonResponse({ ok: false, error: 'Hôte non autorisé' }, 400);
  }

  try {
    const resolved = await dns.lookup(host);
    if (isPrivateIp(resolved.address)) {
      return jsonResponse({ ok: false, error: 'Plage IP privée non autorisée' }, 400);
    }
  } catch {
    return jsonResponse({ ok: false, error: 'Résolution DNS impossible' }, 400);
  }

  const start = Date.now();
  try {
    const res = await fetch(rawUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(6500),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CibleurOETH/1.0)' },
    });
    const html = (await res.text()).slice(0, 131072);
    const effectiveUrl = res.url || rawUrl;

    let title = '';
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    if (titleMatch) {
      title = titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 140);
    }

    let careersUrl = null;
    const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      const href = m[1].trim();
      const txt = m[2].replace(/<[^>]+>/g, '').trim().toLowerCase();
      const hay = `${href.toLowerCase()} ${txt}`;
      if (/(carri[eè]re|recrut|nous[- ]rejoindre|rejoignez|jobs|talents|emploi|offres)/i.test(hay)) {
        if (href.startsWith('http')) careersUrl = href;
        else if (href.startsWith('/')) careersUrl = `${new URL(effectiveUrl).origin}${href}`;
        break;
      }
    }

    const emails = [];
    const emailMatches = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,8}/g) || [];
    for (const em of new Set(emailMatches)) {
      const lower = em.toLowerCase();
      if (!/(sentry|wixpress|example\.com|png|jpg|svg|webp|noreply)/.test(lower)) {
        emails.push(lower);
      }
      if (emails.length >= 3) break;
    }

    return jsonResponse({
      ok: res.status >= 200 && res.status < 400,
      status: res.status,
      effective_url: effectiveUrl,
      https: effectiveUrl.toLowerCase().startsWith('https://'),
      latency_ms: Date.now() - start,
      title,
      careers_url: careersUrl,
      emails,
      error: null,
    });
  } catch (err) {
    return jsonResponse({
      ok: false,
      status: 0,
      effective_url: rawUrl,
      https: rawUrl.toLowerCase().startsWith('https://'),
      latency_ms: Date.now() - start,
      title: '',
      careers_url: null,
      emails: [],
      error: err?.message || 'Fetch error',
    });
  }
}
