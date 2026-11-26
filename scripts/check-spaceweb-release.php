<?php
declare(strict_types=1);

require __DIR__ . '/spaceweb-release.php';

use function Gss\SpaceWeb\{pack, readJson, requireThat, saveState, transact, verifySite};

const SHA = '0123456789abcdef0123456789abcdef01234567';

function fixture(string $tag): array
{
    $name = str_repeat($tag, 8);
    return [
        "assets/index-$name.js" => "export const revision = '$tag';",
        "assets/index-$name.css" => "body { --revision: '$tag'; }",
        'assets/logo.png' => "logo-$tag",
        'index.html' => "<link rel=\"stylesheet\" href=\"./assets/index-$name.css\"><script src=\"./assets/index-$name.js\"></script>",
    ];
}

function request(string $id, array $files): array
{
    $entries = [];
    foreach ($files as $path => $bytes) {
        $entries[] = ['path' => $path, 'bytes' => strlen($bytes), 'sha256' => hash('sha256', $bytes)];
    }
    return [
        'mode' => 'deploy', 'id' => $id, 'commit' => SHA,
        'manifest' => ['version' => 1, 'workingTreeClean' => true, 'commit' => SHA, 'files' => $entries],
        'payload' => array_map('base64_encode', $files),
    ];
}

function fails(callable $operation, string $reason): void
{
    try {
        $operation();
    } catch (RuntimeException $error) {
        requireThat(str_contains($error->getMessage(), $reason), $error->getMessage());
        return;
    }
    throw new RuntimeException("Expected failure: $reason");
}

function liveMatches(string $public, array $files): void
{
    foreach ($files as $path => $bytes) {
        requireThat(file_get_contents($public . '/' . $path) === $bytes, "Unexpected live bytes: $path");
    }
}

$temp = sys_get_temp_dir() . '/gss-release-' . bin2hex(random_bytes(8));
$public = $temp . '/public_html';
$root = $temp . '/.gss-spaceweb-releases';
requireThat(mkdir($public . '/assets', 0700, true), 'Cannot create release fixture.');
mkdir($public . '/api', 0700);
mkdir($temp . '/gss-private', 0700);
$protected = ['/.htaccess' => 'site rules', '/api/news.php' => 'news handler',
    '/api/request.php' => 'form handler', '/../gss-private/config.php' => 'fixture config'];
$old = fixture('A');
$first = fixture('B');
$second = fixture('C');
$bad = fixture('D');
foreach ($old as $path => $bytes) {
    file_put_contents($public . '/' . $path, $bytes);
}
foreach ($protected as $path => $bytes) {
    file_put_contents($public . $path, $bytes);
}

$get = static fn (string $path) => match ($path) {
    '/', '/sout/' => file_get_contents($public . $path . 'index.html'),
    '/api/news' => '{"updatedAt":"2026-11-26T15:00:00Z","news":[{"title":"Fixture"}]}',
    default => file_get_contents($public . rawurldecode($path)),
};
$check = static fn ($web, $id, $paths) => verifySite($web, $id, $paths, $get);
$brokenCheck = static fn ($web, $id, $paths) => verifySite($web, $id, $paths,
    static fn ($path) => $path === '/api/news' ? '{"news":[]}' : $get($path));

try {
    $deploy = request('1-1', $first);
    transact($deploy, $public, static function ($web, $id, $paths) use ($check, $public): void {
        fails(fn () => transact(['mode' => 'recover', 'id' => $id], $public, $check), 'holds the lock');
        $check($web, $id, $paths);
    });
    liveMatches($public, $first);
    liveMatches($public, ['assets/index-AAAAAAAA.js' => $old['assets/index-AAAAAAAA.js']]);
    $journal = readJson($root . '/1-1/journal.json');
    requireThat(array_key_last($journal['files']) === 'index.html', 'Index must be installed last.');
    requireThat(file_get_contents($root . '/1-1/' . $journal['files']['index.html']['before']['file']) === $old['index.html'],
        'The previous index was not backed up.');
    transact(request('1-2', $first), $public, $check);
    requireThat(readJson($root . '/state.json')['last'] === '1-1', 'A duplicate release consumed the rollback point.');

    $forbidden = request('2-1', $second + ['.htaccess' => 'unexpected']);
    fails(fn () => transact($forbidden, $public, $check), 'Invalid manifest file entry');
    $tampered = request('2-2', $second);
    $tampered['payload']['assets/logo.png'] = base64_encode('badbad');
    fails(fn () => transact($tampered, $public, $check), 'checksum mismatch');
    $collision = request('2-3', array_replace($second, ['assets/index-BBBBBBBB.js' => 'wrong content']));
    fails(fn () => transact($collision, $public, $check), 'Immutable asset collision');
    liveMatches($public, $first);

    fails(fn () => transact(request('3-1', $bad), $public, $brokenCheck), 'Invalid news API response');
    liveMatches($public, $first);
    requireThat(readJson($root . '/state.json') === ['last' => '1-1', 'pending' => null], 'Failed deploy changed release state.');

    transact(request('4-1', $second), $public, $check);
    liveMatches($public, $second);
    fails(fn () => transact(['mode' => 'rollback', 'id' => '5-1'], $public, $brokenCheck), 'Invalid news API response');
    liveMatches($public, $second);
    transact(['mode' => 'rollback', 'id' => '5-2'], $public, $check);
    liveMatches($public, $first);
    liveMatches($public, ['assets/index-CCCCCCCC.js' => $second['assets/index-CCCCCCCC.js']]);

    // Simulate a terminated process after switching files but before the state was committed.
    transact(request('6-1', $second), $public, $check);
    saveState($root, ['last' => '1-1', 'pending' => '6-1']);
    transact(['mode' => 'recover', 'id' => '7-1'], $public, $check);
    liveMatches($public, $second);
    transact(['mode' => 'recover', 'id' => '6-1'], $public, $check);
    liveMatches($public, $first);
    transact(['mode' => 'rollback', 'id' => '7-2'], $public, $check);
    liveMatches($public, $old);
    fails(fn () => transact(['mode' => 'rollback', 'id' => '7-3'], $public, $check), 'No previous deployment');

    $sout = $first + [Gss\SpaceWeb\SOUT_INDEX => '<base href="../">' . $first['index.html']];
    foreach (Gss\SpaceWeb\SOUT_PDFS as $path) {
        $sout[$path] = file_get_contents(__DIR__ . '/../public/' . $path);
    }
    $incomplete = $sout;
    unset($incomplete[Gss\SpaceWeb\SOUT_PDFS[0]]);
    fails(fn () => transact(request('9-1', $incomplete), $public, $check), 'Incomplete СОУТ release');
    $extra = $sout + ['sout/extra.pdf' => 'out of scope'];
    fails(fn () => transact(request('9-2', $extra), $public, $check), 'Invalid manifest file entry');
    fails(fn () => transact(request('9-3', $sout), $public, $brokenCheck), 'Invalid news API response');
    requireThat(!file_exists($public . '/' . Gss\SpaceWeb\SOUT_INDEX), 'Failed first release left the new entry visible.');
    liveMatches($public, $old);
    transact(request('9-4', $sout), $public, $check);
    liveMatches($public, $sout);
    $replacement = $sout;
    $replacement[Gss\SpaceWeb\SOUT_INDEX] .= '<!-- next release -->';
    transact(request('9-5', $replacement), $public, $check);
    transact(['mode' => 'rollback', 'id' => '9-6'], $public, $check);
    liveMatches($public, $sout);
    transact(['mode' => 'rollback', 'id' => '9-7'], $public, $check);
    requireThat(!file_exists($public . '/' . Gss\SpaceWeb\SOUT_INDEX), 'Rollback left the first СОУТ entry visible.');
    liveMatches($public, $old + array_intersect_key($sout, array_flip(Gss\SpaceWeb\SOUT_PDFS)));

    $artifact = $temp . '/artifact';
    mkdir($artifact . '/site/assets', 0700, true);
    file_put_contents($artifact . '/release-manifest.json', json_encode($deploy['manifest'], JSON_THROW_ON_ERROR));
    foreach ($first + ['.env' => 'fixture excluded'] as $path => $bytes) {
        file_put_contents($artifact . '/site/' . $path, $bytes);
    }
    ob_start();
    try {
        pack('deploy', '8-1', SHA, $artifact);
        $packet = ob_get_contents();
        requireThat(str_contains($packet, base64_encode($first['index.html']))
            && !str_contains($packet, base64_encode('fixture excluded')), 'Packet eligibility check failed.');
    } finally {
        ob_end_clean();
    }
    foreach ($protected as $path => $bytes) {
        requireThat(file_get_contents($public . $path) === $bytes, "Protected fixture was modified: $path");
    }
    echo "SpaceWeb checks passed: backup, lock, allowlist, checksums, HTTPS checks, deploy, rollback, interrupted recovery and СОУТ.\n";
} finally {
    $resolved = realpath($temp);
    requireThat($resolved !== false && dirname($resolved) === realpath(sys_get_temp_dir()), 'Unexpected fixture cleanup directory.');
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($resolved, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST) as $file) {
        $file->isDir() && !$file->isLink() ? rmdir($file->getPathname()) : unlink($file->getPathname());
    }
    rmdir($resolved);
}
