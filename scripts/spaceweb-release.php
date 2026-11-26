<?php
declare(strict_types=1);

namespace Gss\SpaceWeb;

const PUBLIC_ROOT = '/home/b/bdvgssru/public_html';
const SITE_URL = 'https://gss.ru';
const FILE_LIMIT = 16 * 1024 * 1024;
const RELEASE_LIMIT = 32 * 1024 * 1024;
const SOUT_INDEX = 'sout/index.html';
const SOUT_PDFS = ['sout/Раздел IV — Сводная ведомость.pdf', 'sout/Раздел V — Перечень мероприятий.pdf'];

function requireThat(bool $condition, string $message): void
{
    if (!$condition) {
        throw new \RuntimeException($message);
    }
}

function allowed(string $path): bool
{
    return $path === 'index.html' || $path === SOUT_INDEX || in_array($path, SOUT_PDFS, true)
        || preg_match('~\Aassets/[A-Za-z0-9][A-Za-z0-9_-]*\.(css|js|png|webp|woff2)\z~', $path) === 1;
}

function releaseId(string $id): string
{
    requireThat(preg_match('/\A[0-9]{1,20}-[0-9]{1,10}\z/', $id) === 1, 'Invalid release ID.');
    return $id;
}

function directory(string $path): void
{
    clearstatcache(true, $path);
    requireThat(!is_link($path) && is_dir($path), "Expected a real directory: $path");
}

function filePresent(string $path): bool
{
    clearstatcache(true, $path);
    requireThat(!is_link($path), "Refusing symbolic link: $path");
    if (!file_exists($path)) {
        return false;
    }
    requireThat(is_file($path), "Expected a regular file: $path");
    return true;
}

function readFileBytes(string $path): string
{
    requireThat(filePresent($path), "Missing file: $path");
    $data = file_get_contents($path, false, null, 0, FILE_LIMIT + 1);
    requireThat($data !== false && strlen($data) <= FILE_LIMIT, "Cannot read file or file too large: $path");
    return $data;
}

function readJson(string $path): array
{
    return json_decode(readFileBytes($path), true, 32, JSON_THROW_ON_ERROR);
}

function writeFileBytes(string $path, string $data): void
{
    requireThat(file_put_contents($path, $data) === strlen($data), "Cannot write file: $path");
}

/** Write a complete file on the target filesystem before replacing its name. */
function replaceFile(string $target, string $data, int $mode, string $work): void
{
    $temp = tempnam($work, '.file-');
    requireThat($temp !== false, 'Cannot allocate a temporary file.');
    try {
        requireThat(dirname($temp) === realpath($work), 'Temporary file escaped the release directory.');
        writeFileBytes($temp, $data);
        requireThat(chmod($temp, $mode), 'Cannot set the staged file mode.');
        filePresent($target);
        requireThat(rename($temp, $target), "Cannot replace file: $target");
    } finally {
        if (is_file($temp)) {
            unlink($temp);
        }
    }
}

function manifestFiles(array $manifest, string $sha): array
{
    requireThat(preg_match('/\A[0-9a-f]{40}\z/', $sha) === 1
        && ($manifest['version'] ?? null) === 1 && ($manifest['workingTreeClean'] ?? null) === true
        && ($manifest['commit'] ?? null) === $sha && is_array($manifest['files'] ?? null)
        && array_is_list($manifest['files']), 'Invalid release manifest or commit.');
    $files = [];
    $total = 0;
    foreach ($manifest['files'] as $entry) {
        $path = $entry['path'] ?? null;
        $size = $entry['bytes'] ?? null;
        $hash = $entry['sha256'] ?? null;
        requireThat(is_string($path) && allowed($path) && !isset($files[$path])
            && is_int($size) && $size > 0 && $size <= FILE_LIMIT
            && is_string($hash) && preg_match('/\A[0-9a-f]{64}\z/', $hash) === 1, 'Invalid manifest file entry.');
        $total += $size;
        requireThat($total <= RELEASE_LIMIT, 'Release exceeds its size limit.');
        $files[$path] = $entry;
    }
    requireThat(isset($files['index.html']) && count($files) > 1, 'Release needs index.html and assets.');
    if (array_intersect(array_keys($files), [SOUT_INDEX, ...SOUT_PDFS])) {
        requireThat(isset($files[SOUT_INDEX], $files[SOUT_PDFS[0]], $files[SOUT_PDFS[1]]), 'Incomplete СОУТ release.');
    }
    return indexLast($files);
}

function indexLast(array $files): array
{
    $index = $files['index.html'];
    unset($files['index.html']);
    if (array_key_exists(SOUT_INDEX, $files)) {
        $sout = $files[SOUT_INDEX];
        unset($files[SOUT_INDEX]);
        $files[SOUT_INDEX] = $sout;
    }
    $files['index.html'] = $index;
    return $files;
}

function verifyBytes(string $data, array $entry): void
{
    requireThat(strlen($data) === $entry['bytes'] && hash('sha256', $data) === $entry['sha256'],
        'Release checksum mismatch: ' . $entry['path']);
}

/** Build a PHP stdin stream of trusted code and quoted file data, without extracting an archive on the host. */
function pack(string $mode, string $id, string $sha, string $artifact): void
{
    requireThat(in_array($mode, ['deploy', 'rollback', 'recover'], true), 'Invalid release operation.');
    releaseId($id);
    $request = ['mode' => $mode, 'id' => $id, 'commit' => $sha];
    if ($mode === 'deploy') {
        directory($artifact);
        directory($artifact . '/site');
        directory($artifact . '/site/assets');
        $manifest = readJson($artifact . '/release-manifest.json');
        $payload = [];
        foreach (manifestFiles($manifest, $sha) as $path => $entry) {
            if (str_starts_with($path, 'sout/')) {
                directory($artifact . '/site/sout');
            }
            $data = readFileBytes($artifact . '/site/' . $path);
            verifyBytes($data, $entry);
            $payload[$path] = base64_encode($data);
        }
        $request['manifest'] = $manifest;
        $request['payload'] = $payload;
    }
    echo readFileBytes(__FILE__), "\nrun(", var_export($request, true), ");\n";
}

function deployFiles(array $request): array
{
    $manifest = manifestFiles($request['manifest'], $request['commit']);
    $payload = $request['payload'];
    requireThat(is_array($payload) && count($manifest) === count($payload) && array_diff_key($manifest, $payload) === [],
        'Payload does not match the manifest.');
    $files = [];
    foreach ($manifest as $path => $entry) {
        requireThat(is_string($payload[$path]) && strlen($payload[$path]) === 4 * (int) ceil($entry['bytes'] / 3),
            "Invalid encoded file size: $path");
        $data = base64_decode($payload[$path], true);
        requireThat($data !== false, "Invalid encoded file: $path");
        verifyBytes($data, $entry);
        $files[$path] = $data;
    }
    return $files;
}

function journal(string $stateRoot, string $id): array
{
    $work = $stateRoot . '/' . releaseId($id);
    directory($work);
    $record = readJson($work . '/journal.json');
    requireThat(is_array($record['files'] ?? null) && is_array($record['files']['index.html']['before'] ?? null)
        && array_key_exists('parent', $record), 'Invalid backup journal.');
    if ($record['parent'] !== null) {
        releaseId($record['parent']);
    }
    foreach ($record['files'] as $path => $entry) {
        requireThat(allowed($path), 'Path outside backup allowlist.');
    }
    return $record;
}

function backupBytes(string $work, array $before): string
{
    $name = $before['file'];
    requireThat(preg_match('/\Abefore-[0-9]+\z/', $name) === 1, 'Invalid backup file name.');
    $data = readFileBytes($work . '/' . $name);
    requireThat(hash('sha256', $data) === $before['sha256'], 'Backup checksum mismatch.');
    return $data;
}

function restore(string $public, string $stateRoot, string $id): void
{
    $work = $stateRoot . '/' . $id;
    $files = [];
    $entries = indexLast(journal($stateRoot, $id)['files']);
    foreach ($entries as $path => $entry) {
        if ($entry['before'] !== null) {
            $files[$path] = [backupBytes($work, $entry['before']), $entry['before']['mode']];
        } elseif ($path === SOUT_INDEX) {
            $files[$path] = [null, null];
        }
    }
    foreach ($files as $path => [$data, $mode]) {
        if ($data === null) {
            removeSoutIndex($public, $entries[$path]['after']);
        } else {
            replaceFile($public . '/' . $path, $data, $mode, $work);
        }
    }
}

function removeSoutIndex(string $public, ?string $expected): void
{
    $target = $public . '/' . SOUT_INDEX;
    if (filePresent($target)) {
        requireThat(hash('sha256', readFileBytes($target)) === $expected, 'СОУТ page changed since deployment.');
        requireThat(unlink($target), 'Cannot restore the previous absence of the СОУТ page.');
    }
}

function saveState(string $root, array $state): void
{
    replaceFile($root . '/state.json', json_encode($state, JSON_THROW_ON_ERROR), 0600, $root);
}

function transact(array $request, string $public, callable $check): void
{
    $id = releaseId($request['id']);
    $mode = $request['mode'];
    requireThat(in_array($mode, ['deploy', 'rollback', 'recover'], true), 'Invalid release operation.');
    directory($public);
    directory($public . '/assets');
    $stateRoot = dirname($public) . '/.gss-spaceweb-releases';
    if (!file_exists($stateRoot) && !is_link($stateRoot)) {
        requireThat(@mkdir($stateRoot, 0700) || is_dir($stateRoot), 'Cannot create private release directory.');
    }
    directory($stateRoot);
    $privateMode = fileperms($stateRoot);
    requireThat($privateMode !== false && (PHP_OS_FAMILY === 'Windows' || ($privateMode & 0077) === 0),
        'Release directory must be private (0700).');
    requireThat(stat($stateRoot)['dev'] === stat($public)['dev'] && stat($stateRoot)['dev'] === stat($public . '/assets')['dev'],
        'Release directory and public files must share a filesystem.');

    $lockPath = $stateRoot . '/release.lock';
    filePresent($lockPath);
    $lock = fopen($lockPath, 'c');
    requireThat($lock !== false, 'Cannot open release lock.');
    try {
        requireThat(flock($lock, LOCK_EX | LOCK_NB), 'Another SpaceWeb release holds the lock.');
        $sout = $public . '/sout';
        if (file_exists($sout) || is_link($sout)) {
            directory($sout);
            requireThat(stat($sout)['dev'] === stat($stateRoot)['dev'], 'СОУТ and release directories must share a filesystem.');
        }
        $state = filePresent($stateRoot . '/state.json')
            ? readJson($stateRoot . '/state.json') : ['last' => null, 'pending' => null];
        foreach (['last', 'pending'] as $key) {
            requireThat(array_key_exists($key, $state) && ($state[$key] === null || is_string($state[$key])), 'Invalid release state.');
            if ($state[$key] !== null) {
                releaseId($state[$key]);
            }
        }
        if ($state['pending'] !== null && ($mode !== 'recover' || $state['pending'] === $id)) {
            restore($public, $stateRoot, $state['pending']);
            $state['pending'] = null;
            saveState($stateRoot, $state);
            echo "Restored an interrupted SpaceWeb release.\n";
        }
        if ($mode === 'recover') {
            return;
        }
        $next = $id;
        $rollback = [];
        if ($mode === 'deploy') {
            $files = deployFiles($request);
        } else {
            requireThat(is_string($state['last']), 'No previous deployment is available for rollback.');
            $previous = journal($stateRoot, $state['last']);
            $files = [];
            foreach (indexLast($previous['files']) as $path => $entry) {
                if ($entry['before'] !== null) {
                    $files[$path] = backupBytes($stateRoot . '/' . $state['last'], $entry['before']);
                    $rollback[$path] = $entry;
                } elseif ($path === SOUT_INDEX) {
                    $files[$path] = null;
                    $rollback[$path] = $entry;
                }
            }
            $next = $previous['parent'];
        }
        foreach (htmlAssets($files['index.html']) as $path) {
            requireThat($mode === 'deploy' ? isset($files[$path]) : filePresent($public . '/' . $path),
                "HTML asset is missing: $path");
        }
        if (isset($files[SOUT_INDEX])) {
            foreach (htmlAssets($files[SOUT_INDEX]) as $path) {
                requireThat(isset($files[$path]) || ($mode === 'rollback' && filePresent($public . '/' . $path)),
                    "СОУТ HTML asset is missing: $path");
            }
            if (!is_dir($sout)) {
                requireThat(mkdir($sout, 0755) && chmod($sout, 0755), 'Cannot create public СОУТ directory.');
                requireThat(stat($sout)['dev'] === stat($stateRoot)['dev'], 'СОУТ and release directories must share a filesystem.');
            }
        }

        $work = $stateRoot . '/' . $id;
        requireThat(mkdir($work, 0700), 'Release ID already exists or release directory cannot be created.');
        $changes = [];
        requireThat(filePresent($public . '/index.html'), 'An existing index.html is required for rollback.');
        foreach ($files as $path => $data) {
            $target = $public . '/' . $path;
            $old = filePresent($target) ? readFileBytes($target) : null;
            $after = $data === null ? null : hash('sha256', $data);
            $oldHash = $old === null ? null : hash('sha256', $old);
            requireThat(!isset($rollback[$path]) || $oldHash === $rollback[$path]['after'], "Live file changed since deployment: $path");
            if ($path !== 'index.html' && $oldHash === $after) {
                continue;
            }
            requireThat($old === null || $oldHash === $after || preg_match('~-[A-Za-z0-9_-]{8}\.(js|css)\z~', $path) !== 1,
                "Immutable asset collision: $path");
            $before = null;
            if ($old !== null) {
                $permissions = fileperms($target);
                requireThat($permissions !== false, "Cannot read mode: $path");
                $before = ['file' => 'before-' . count($changes), 'sha256' => $oldHash, 'mode' => $permissions & 0777];
                writeFileBytes($work . '/' . $before['file'], $old);
            }
            $changes[$path] = ['before' => $before, 'after' => $after];
        }
        if ($mode === 'deploy' && count($changes) === 1
            && $changes['index.html']['before']['sha256'] === $changes['index.html']['after']) {
            $check($public, $id, array_keys($files));
            echo "SpaceWeb already serves this release ($id).\n";
            return;
        }
        writeFileBytes($work . '/journal.json', json_encode(['parent' => $state['last'], 'files' => $changes], JSON_THROW_ON_ERROR));
        saveState($stateRoot, ['last' => $state['last'], 'pending' => $id]);
        try {
            foreach ($changes as $path => $change) {
                if ($path === SOUT_INDEX && $files[$path] === null) {
                    removeSoutIndex($public, $change['before']['sha256']);
                    continue;
                }
                $targetMode = $rollback[$path]['before']['mode'] ?? $change['before']['mode'] ?? 0644;
                replaceFile($public . '/' . $path, $files[$path], $targetMode, $work);
            }
            $check($public, $id, array_keys($files));
            saveState($stateRoot, ['last' => $next, 'pending' => null]);
        } catch (\Throwable $failure) {
            restore($public, $stateRoot, $id);
            saveState($stateRoot, $state);
            file_put_contents('php://stderr', "Previous SpaceWeb files restored.\n");
            throw $failure;
        }
        echo "SpaceWeb $mode completed ($id).\n";
    } finally {
        fclose($lock);
    }
}

function htmlAssets(string $html): array
{
    preg_match_all('~<(?:script|link)\b[^>]*\b(?:src|href)=(["\'])(?:\./|/)?(assets/[^"\']+\.(?:js|css))\1~i', $html, $matches);
    $paths = array_values(array_unique($matches[2]));
    requireThat(in_array('js', array_map(static fn ($path) => pathinfo($path, PATHINFO_EXTENSION), $paths), true)
        && in_array('css', array_map(static fn ($path) => pathinfo($path, PATHINFO_EXTENSION), $paths), true),
        'Expected JS and CSS references in index.html.');
    foreach ($paths as $path) {
        requireThat(allowed($path), 'Unexpected JS or CSS path in index.html.');
    }
    return $paths;
}

function httpGet(string $path, string $id): string
{
    $body = '';
    $curl = curl_init(SITE_URL . $path . '?gss_release=' . $id);
    curl_setopt_array($curl, [
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_ENCODING => '',
        CURLOPT_HTTPHEADER => ['Cache-Control: no-cache'],
        CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body): int {
            if (strlen($body) + strlen($chunk) > FILE_LIMIT) {
                return 0;
            }
            $body .= $chunk;
            return strlen($chunk);
        },
    ]);
    requireThat(curl_exec($curl) !== false && curl_getinfo($curl, CURLINFO_RESPONSE_CODE) === 200, "HTTPS check failed: $path");
    return $body;
}

function verifySite(string $public, string $id, array $paths, ?callable $get = null): void
{
    $get ??= __NAMESPACE__ . '\\httpGet';
    $html = readFileBytes($public . '/index.html');
    requireThat($get('/', $id) === $html, 'The homepage does not serve the installed index.html.');
    $references = htmlAssets($html);
    if (filePresent($public . '/' . SOUT_INDEX)) {
        $sout = readFileBytes($public . '/' . SOUT_INDEX);
        requireThat($get('/sout/', $id) === $sout, 'The public СОУТ page differs.');
        $references = [...$references, ...htmlAssets($sout)];
        foreach (SOUT_PDFS as $path) {
            requireThat($get('/sout/' . rawurlencode(substr($path, 5)), $id) === readFileBytes($public . '/' . $path),
                "The public PDF differs: $path");
        }
    }
    $bundles = array_filter($paths, static fn ($path) => preg_match('/\.(js|css)\z/', $path) === 1);
    foreach (array_unique([...$references, ...$bundles]) as $path) {
        requireThat($get('/' . $path, $id) === readFileBytes($public . '/' . $path), "The public asset differs: $path");
    }
    $news = json_decode($get('/api/news', $id), true, 32, JSON_THROW_ON_ERROR);
    requireThat(is_array($news['news'] ?? null) && array_is_list($news['news']) && count($news['news']) > 0
        && is_string($news['updatedAt'] ?? null) && strtotime($news['updatedAt']) !== false, 'Invalid news API response.');
}

function run(array $request): void
{
    umask(0077);
    try {
        requireThat(PHP_OS_FAMILY === 'Linux', 'SpaceWeb release execution requires Linux.');
        transact($request, PUBLIC_ROOT, __NAMESPACE__ . '\\verifySite');
    } catch (\Throwable $error) {
        file_put_contents('php://stderr', 'SpaceWeb release failed: ' . $error->getMessage() . "\n");
        exit(1);
    }
}
