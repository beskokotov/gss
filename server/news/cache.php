<?php
declare(strict_types=1);

namespace Gss\News;

const CACHE_FILE = 'news-cache.json';
const MAX_BYTES = 1048576;
const MAX_ITEMS = 10;

function allowedUrl(string $value, string $pathPrefix): bool
{
    $parts = parse_url($value);
    return filter_var($value, FILTER_VALIDATE_URL) !== false
        && ($parts['scheme'] ?? '') === 'https'
        && in_array(strtolower($parts['host'] ?? ''), ['garant.ru', 'www.garant.ru'], true)
        && !isset($parts['user'])
        && !isset($parts['pass'])
        && ($parts['port'] ?? 443) === 443
        && str_starts_with($parts['path'] ?? '', $pathPrefix);
}

function parseDate(string $value, string $format): ?\DateTimeImmutable
{
    $date = \DateTimeImmutable::createFromFormat($format, $value);
    return $date !== false && \DateTimeImmutable::getLastErrors() === false ? $date : null;
}

function readCache(string $directory): array
{
    $json = @file_get_contents($directory . '/' . CACHE_FILE, false, null, 0, MAX_BYTES + 1);
    if ($json === false || strlen($json) > MAX_BYTES) {
        throw new \RuntimeException('News cache is missing, unreadable or too large.');
    }
    $data = json_decode($json, true, 32, JSON_THROW_ON_ERROR);
    if (!is_string($data['updatedAt'] ?? null) || !parseDate($data['updatedAt'], DATE_ATOM)
        || !is_array($data['news'] ?? null) || !array_is_list($data['news'])
        || count($data['news']) < 1 || count($data['news']) > MAX_ITEMS) {
        throw new \RuntimeException('Invalid news cache structure.');
    }
    $news = [];
    foreach ($data['news'] as $item) {
        foreach (['title', 'description', 'date', 'category', 'image', 'href'] as $field) {
            if (!is_string($item[$field] ?? null) || ($field !== 'image' && trim($item[$field]) === '')) {
                throw new \RuntimeException('Invalid field in cached news item.');
            }
        }
        if (!parseDate($item['date'], DATE_ATOM) || !allowedUrl($item['href'], '/news/')
            || ($item['image'] !== '' && !allowedUrl($item['image'], '/files/'))) {
            throw new \RuntimeException('Invalid date or URL in cached news item.');
        }
        $news[] = array_intersect_key($item, array_flip(['title', 'description', 'date', 'category', 'image', 'href']));
    }
    return ['updatedAt' => $data['updatedAt'], 'news' => $news];
}
