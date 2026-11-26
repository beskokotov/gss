<?php
declare(strict_types=1);

require __DIR__ . '/../server/news/update.php';

use function Gss\News\{readCache, refreshCache};

function check(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function fails(callable $action, string $reason): void
{
    try {
        $action();
    } catch (RuntimeException | JsonException $error) {
        check(str_contains($error->getMessage(), $reason), $error->getMessage());
        return;
    }
    throw new RuntimeException('Expected failure: ' . $reason);
}

$directory = sys_get_temp_dir() . '/gss-news-' . bin2hex(random_bytes(8));
check(mkdir($directory, 0700), 'Cannot create test directory.');
$cache = $directory . '/news-cache.json';
try {
    fails(fn () => readCache($directory), 'missing');

    $items = '';
    foreach (range(1, 12) as $day) {
        $date = gmdate(DATE_RSS, gmmktime(12, 0, 0, 11, $day, 2026));
        $items .= "<item><title>Новость $day</title><description><![CDATA[<b>Описание</b>]]></description>"
            . "<pubDate>$date</pubDate><link>https://www.garant.ru/news/$day/</link>"
            . '<enclosure url="https://www.garant.ru/files/news.png"/></item>';
    }
    $xml = iconv('UTF-8', 'Windows-1251', '<?xml version="1.0" encoding="windows-1251"?>'
        . '<rss version="2.0"><channel>' . $items . '<item><title>Incomplete</title></item></channel></rss>');
    check(refreshCache($directory, fn () => $xml), 'The first refresh must succeed.');
    $data = readCache($directory);
    check(count($data['news']) === 10 && $data['news'][0]['title'] === 'Новость 12'
        && $data['news'][9]['title'] === 'Новость 3', 'Unexpected order, encoding or limit.');
    $first = $data['news'][0];
    check($first['description'] === 'Описание' && $first['category'] === 'ГАРАНТ.РУ'
        && $first['date'] === '2026-11-12T12:00:00+00:00'
        && $first['image'] === 'https://www.garant.ru/files/news.png'
        && $first['href'] === 'https://www.garant.ru/news/12/'
        && abs(time() - strtotime($data['updatedAt'])) < 10, 'Unexpected item fields or update time.');
    $previous = file_get_contents($cache);

    foreach ([
        ['<rss><channel>', 'Invalid RSS XML'],
        ['', 'empty'],
        ['<rss><channel/></rss>', 'no usable news items'],
        ['<!DOCTYPE rss><rss><channel/></rss>', 'DTD'],
    ] as [$body, $reason]) {
        fails(fn () => refreshCache($directory, fn () => $body), $reason);
        check(file_get_contents($cache) === $previous, 'A bad feed changed the cache.');
    }
    $failedDownload = static fn () => throw new RuntimeException('Simulated network timeout');
    fails(fn () => refreshCache($directory, $failedDownload), 'network timeout');
    check(file_get_contents($cache) === $previous, 'A network failure changed the cache.');

    $lock = fopen($directory . '/news-update.lock', 'c');
    check(flock($lock, LOCK_EX | LOCK_NB), 'Cannot hold the test lock.');
    try {
        check(refreshCache($directory, $failedDownload) === false, 'Concurrent refresh did not skip.');
        check(file_get_contents($cache) === $previous, 'Concurrent refresh changed the cache.');
    } finally {
        fclose($lock);
    }

    file_put_contents($cache, '{');
    fails(fn () => readCache($directory), 'Syntax error');
    file_put_contents($cache, '{"news":[]}');
    fails(fn () => readCache($directory), 'Invalid news cache structure');
    check(refreshCache($directory, fn () => $xml), 'Valid RSS did not replace corrupt JSON.');
    check(readCache($directory)['news'] === $data['news'], 'Unexpected recovered data.');
    echo "RSS checks passed: Windows-1251, newest 10, malformed and empty RSS, network failure, lock, missing and corrupt cache.\n";
} finally {
    foreach ([$cache, $directory . '/news-update.lock'] as $file) {
        if (is_file($file)) {
            unlink($file);
        }
    }
    rmdir($directory);
}
