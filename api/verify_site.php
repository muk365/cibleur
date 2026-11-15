<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Deep-inspects a company website: HTTP status, final URL, SSL, page title,
 * career/recruitment page links, and public contact email if found.
 */
$url = trim((string) ($_GET['url'] ?? ''));
if ($url === '' || !preg_match('#^https?://#i', $url)) {
    sendJson(['ok' => false, 'error' => 'URL invalide'], 400);
}

// Block private/loopback SSRF targets
$host = parse_url($url, PHP_URL_HOST) ?: '';
if ($host === '' || in_array(strtolower($host), ['localhost', '127.0.0.1', '::1'], true)) {
    sendJson(['ok' => false, 'error' => 'Hôte non autorisé'], 400);
}
$ip = @gethostbyname($host);
if ($ip && filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
    sendJson(['ok' => false, 'error' => 'Plage IP privée non autorisée'], 400);
}

$ch = curl_init($url);
$start = microtime(true);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS => 4,
    CURLOPT_TIMEOUT => 7,
    CURLOPT_CONNECTTIMEOUT => 4,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_RANGE => '0-131072',
    CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; CibleurOETH/1.0)',
]);
$html = curl_exec($ch);
$status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$effectiveUrl = (string) curl_getinfo($ch, CURLINFO_EFFECTIVE_URL);
$err = curl_error($ch);
$latency = (int) round((microtime(true) - $start) * 1000);
curl_close($ch);

$isActive = $status >= 200 && $status < 400;
$title = '';
$careersUrl = null;
$emails = [];

if (is_string($html) && $html !== '') {
    if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) {
        $title = html_entity_decode(trim(preg_replace('/\s+/', ' ', strip_tags($m[1]))), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $title = mb_substr($title, 0, 140);
    }

    // Look for career / recruitment / jobs / rse links
    if (preg_match_all('#<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>#is', $html, $matches, PREG_SET_ORDER)) {
        foreach ($matches as $link) {
            $href = trim($link[1]);
            $text = mb_strtolower(trim(strip_tags($link[2])));
            $haystack = mb_strtolower($href) . ' ' . $text;
            if (preg_match('/(carri[eè]re|recrut|nous[- ]rejoindre|rejoignez|jobs|talents|emploi|offres)/u', $haystack)) {
                if (str_starts_with($href, 'http')) {
                    $careersUrl = $href;
                } elseif (str_starts_with($href, '/')) {
                    $parts = parse_url($effectiveUrl ?: $url);
                    $careersUrl = ($parts['scheme'] ?? 'https') . '://' . ($parts['host'] ?? $host) . $href;
                }
                break;
            }
        }
    }

    // Extract non-tracking contact emails (e.g., contact@, rh@, recrutement@)
    if (preg_match_all('/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,8}/', $html, $emailMatches)) {
        foreach (array_unique($emailMatches[0]) as $em) {
            $lower = strtolower($em);
            if (!preg_match('/(sentry|wixpress|example\.com|png|jpg|svg|webp|noreply)/', $lower)) {
                $emails[] = $lower;
            }
            if (count($emails) >= 3) {
                break;
            }
        }
    }
}

sendJson([
    'ok' => $isActive,
    'status' => $status,
    'effective_url' => $effectiveUrl ?: $url,
    'https' => str_starts_with(strtolower($effectiveUrl ?: $url), 'https://'),
    'latency_ms' => $latency,
    'title' => $title,
    'careers_url' => $careersUrl,
    'emails' => $emails,
    'error' => $err ?: null,
]);
