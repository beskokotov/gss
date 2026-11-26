<?php
declare(strict_types=1);

namespace Gss\News;

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require_once __DIR__ . '/cache.php';

const FEED_URL = 'https://rss.garant.ru/news/';

function downloadRss(): string
{
    $body = '';
    $curl = curl_init(FEED_URL);
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_USERAGENT => 'gss.ru RSS reader',
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > MAX_BYTES) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);
    if (curl_exec($curl) === false) {
        throw new \RuntimeException('RSS download failed: ' . curl_error($curl));
    }
    $status = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    if ($status !== 200) {
        throw new \RuntimeException('RSS returned HTTP ' . $status);
    }
    return $body;
}

function rssText(\SimpleXMLElement $element): string
{
    $text = html_entity_decode((string) $element, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    return trim(preg_replace('/\s+/u', ' ', strip_tags($text)) ?? '');
}

function parseRss(string $body): array
{
    if (trim($body) === '' || stripos($body, '<!DOCTYPE') !== false) {
        throw new \RuntimeException('RSS response is empty or contains a DTD.');
    }
    // Pass the original bytes to libxml so it honors the Windows-1251 declaration.
    $previous = libxml_use_internal_errors(true);
    try {
        $rss = simplexml_load_string($body, \SimpleXMLElement::class, LIBXML_NONET | LIBXML_NOCDATA);
        if ($rss === false || $rss->getName() !== 'rss' || !isset($rss->channel)) {
            $detail = libxml_get_last_error();
            throw new \RuntimeException('Invalid RSS XML' . ($detail ? ' at line ' . $detail->line : ''));
        }
    } finally {
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
    }

    $news = [];
    foreach ($rss->channel->item as $item) {
        $date = parseDate(trim((string) $item->pubDate), DATE_RSS);
        $href = trim((string) $item->link);
        $title = rssText($item->title);
        $description = rssText($item->description);
        if ($date === null || !allowedUrl($href, '/news/') || $title === '' || $description === '') {
            continue;
        }
        $image = trim((string) $item->enclosure['url']);
        $news[$href] = [
            'title' => $title,
            'description' => $description,
            'date' => $date->setTimezone(new \DateTimeZone('UTC'))->format(DATE_ATOM),
            'category' => rssText($item->category) ?: 'ГАРАНТ.РУ',
            'image' => allowedUrl($image, '/files/') ? $image : '',
            'href' => $href,
        ];
    }
    if ($news === []) {
        throw new \RuntimeException('RSS contains no usable news items.');
    }
    usort($news, static fn (array $a, array $b): int => strcmp($b['date'], $a['date']));
    return array_slice($news, 0, MAX_ITEMS);
}

function refreshCache(string $directory, callable $download): bool
{
    $lock = @fopen($directory . '/news-update.lock', 'c');
    if ($lock === false) {
        throw new \RuntimeException('Cannot open news update lock.');
    }
    try {
        if (!flock($lock, LOCK_EX | LOCK_NB, $wouldBlock)) {
            if ($wouldBlock) {
                return false;
            }
            throw new \RuntimeException('Cannot acquire news update lock.');
        }

        $news = parseRss($download());
        $json = json_encode(['updatedAt' => gmdate(DATE_ATOM), 'news' => $news],
            JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n";
        if (strlen($json) > MAX_BYTES) {
            throw new \RuntimeException('Generated news cache is too large.');
        }
        $temp = @tempnam($directory, '.news-');
        if ($temp === false) {
            throw new \RuntimeException('Cannot create temporary news cache.');
        }
        try {
            if (realpath(dirname($temp)) !== realpath($directory)
                || @file_put_contents($temp, $json) !== strlen($json)
                || !@rename($temp, $directory . '/' . CACHE_FILE)) {
                throw new \RuntimeException('Cannot replace news cache atomically.');
            }
        } finally {
            if (is_file($temp)) {
                @unlink($temp);
            }
        }
        return true;
    } finally {
        fclose($lock);
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    try {
        if (!refreshCache(__DIR__, __NAMESPACE__ . '\\downloadRss')) {
            fwrite(STDERR, '[' . gmdate(DATE_ATOM) . "] RSS update skipped: another run holds the lock.\n");
        }
    } catch (\Throwable $error) {
        fwrite(STDERR, '[' . gmdate(DATE_ATOM) . '] RSS update failed: ' . $error->getMessage() . "\n");
        exit(1);
    }
}
