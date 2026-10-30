<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Count attempts under an exclusive lock; store only counters and HMACs, not form data/IPs.
function reserveAttempt(string $directory, string $key, int $window, int $limit): bool
{
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) {
        throw new RuntimeException('Rate storage unavailable');
    }
    $file = fopen($directory . '/' . $key . '.json', 'c+');
    if ($file === false) throw new RuntimeException('Rate storage unavailable');
    try {
        if (!flock($file, LOCK_EX)) throw new RuntimeException('Rate storage unavailable');
        $state = json_decode(stream_get_contents($file) ?: '{}', true) ?: [];
        $now = time();
        if (($state['start'] ?? 0) + $window <= $now) $state = ['start' => $now, 'count' => 0];
        if (($state['count'] ?? 0) >= $limit) return false;
        $state['count'] = ($state['count'] ?? 0) + 1;
        rewind($file);
        if (!ftruncate($file, 0) || fwrite($file, json_encode($state)) === false || !fflush($file)) {
            throw new RuntimeException('Rate storage unavailable');
        }
        return true;
    } finally {
        flock($file, LOCK_UN);
        fclose($file);
    }
}

function field(array $data, string $name, int $limit, bool $required = false, bool $multiline = false): string
{
    if (isset($data[$name]) && !is_string($data[$name])) respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    $value = trim($data[$name] ?? '');
    if (($required && $value === '') || mb_strlen($value, 'UTF-8') > $limit || str_contains($value, "\0") || (!$multiline && preg_match('/[\r\n]/', $value))) {
        respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    }
    return $value;
}

try {
    $method = $_SERVER['REQUEST_METHOD'] ?? '';
    if (!in_array($method, ['GET', 'POST'], true)) {
        header('Allow: GET, POST');
        respond(405, ['ok' => false, 'code' => 'METHOD_NOT_ALLOWED']);
    }

    $configPath = getenv('GSS_FORM_CONFIG') ?: dirname($_SERVER['DOCUMENT_ROOT']) . '/gss-private/config.php';
    if (!is_file($configPath)) respond(503, ['ok' => false, 'code' => 'UNAVAILABLE']);
    $config = require $configPath;
    $smtp = $config['smtp'] ?? [];
    if (($config['enabled'] ?? false) !== true || !extension_loaded('openssl') || !extension_loaded('mbstring')
        || strlen($config['secret'] ?? '') < 32 || !is_file($config['autoload'] ?? '')
        || !preg_match('/^[a-zA-Z0-9.-]+$/D', $smtp['host'] ?? '')
        || !in_array($smtp['encryption'] ?? '', ['tls', 'ssl'], true)
        || !filter_var($smtp['port'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 65535]])
        || empty($smtp['username']) || empty($smtp['password']) || !filter_var($smtp['from_email'] ?? '', FILTER_VALIDATE_EMAIL)) {
        respond(503, ['ok' => false, 'code' => 'UNAVAILABLE']);
    }

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if (($origin !== '' && !in_array($origin, $config['allowed_origins'] ?? [], true))
        || ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site'
        || ($method === 'POST' && $origin === '')) {
        respond(403, ['ok' => false, 'code' => 'FORBIDDEN']);
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('GSS_REQUEST');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $config['secure_cookie'] ?? true, 'httponly' => true, 'samesite' => 'Strict']);
    if (!session_start()) throw new RuntimeException('Session unavailable');
    if (!isset($_SESSION['token']) || ($_SESSION['token_time'] ?? 0) + 3600 < time()) {
        $_SESSION['token'] = bin2hex(random_bytes(32));
        $_SESSION['token_time'] = time();
    }
    if ($method === 'GET') respond(200, ['token' => $_SESSION['token']]);

    if (strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') {
        respond(415, ['ok' => false, 'code' => 'INVALID_INPUT']);
    }
    $raw = file_get_contents('php://input', false, null, 0, 8193);
    if ($raw === false || strlen($raw) > 8192) respond(413, ['ok' => false, 'code' => 'INVALID_INPUT']);
    $data = json_decode($raw, true, 8, JSON_THROW_ON_ERROR);
    if (!is_array($data)) respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    if (!is_string($data['token'] ?? null) || !hash_equals($_SESSION['token'], $data['token'])) {
        respond(403, ['ok' => false, 'code' => 'INVALID_TOKEN']);
    }
    $id = field($data, 'requestId', 80, true);
    if (!preg_match('/^[a-zA-Z0-9-]{16,80}$/D', $id)) respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    $name = field($data, 'name', 80, true);
    $contact = field($data, 'contact', 120, true);
    $message = field($data, 'message', 1200, false, true);
    $topic = field($data, 'topic', 180, true);
    if (field($data, 'website', 200) !== '') respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    $digits = preg_replace('/\D/', '', $contact);
    $email = filter_var($contact, FILTER_VALIDATE_EMAIL);
    if (!$email && !(preg_match('/^\+?[\d\s().-]+$/D', $contact) && strlen($digits) >= 7 && strlen($digits) <= 15)) {
        respond(422, ['ok' => false, 'code' => 'INVALID_INPUT']);
    }

    $fingerprint = hash('sha256', json_encode([$name, $contact, $message, $topic]));
    $sent = $_SESSION['sent'] ?? [];
    if (isset($sent[$id])) {
        if (!hash_equals($sent[$id], $fingerprint)) respond(409, ['ok' => false, 'code' => 'INVALID_INPUT']);
        respond(200, ['ok' => true]);
    }
    $directory = $config['rate_directory'] ?? dirname($configPath) . '/rate-limits';
    // Use the direct peer IP. Do not trust client-supplied forwarding headers.
    $peer = hash_hmac('sha256', $_SERVER['REMOTE_ADDR'] ?? 'unknown', $config['secret']);
    if (!reserveAttempt($directory, $peer, 900, 5) || !reserveAttempt($directory, 'all', 3600, 120)) {
        header('Retry-After: 900');
        respond(429, ['ok' => false, 'code' => 'RATE_LIMITED']);
    }

    require_once $config['autoload'];
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->SMTPAuth = true;
    $mail->Host = $smtp['host'];
    $mail->Port = (int) $smtp['port'];
    $mail->SMTPSecure = $smtp['encryption'];
    $mail->Username = $smtp['username'];
    $mail->Password = $smtp['password'];
    $mail->Timeout = 15;
    $mail->Timelimit = 20;
    $mail->CharSet = 'UTF-8';
    $mail->SMTPDebug = 0;
    if (!empty($smtp['ca_file'])) $mail->SMTPOptions = ['ssl' => ['cafile' => $smtp['ca_file']]];
    $mail->setFrom($smtp['from_email'], $smtp['from_name'] ?? 'Гарант-Сервис Самара');
    $mail->addAddress('info@gss.ru');
    if ($email) $mail->addReplyTo($contact, $name);
    $mail->Subject = 'Заявка с сайта: ' . $topic;
    $mail->isHTML(false);
    $mail->Body = "Тема: {$topic}\nИмя: {$name}\nКонтакт для ответа: {$contact}\n\n{$message}\n\nНомер заявки: {$id}";
    $mail->send();
    $sent[$id] = $fingerprint;
    $_SESSION['sent'] = array_slice($sent, -10, null, true);
    respond(200, ['ok' => true]);
} catch (JsonException $error) {
    respond(400, ['ok' => false, 'code' => 'INVALID_INPUT']);
} catch (Throwable $error) {
    // Never expose credentials, the message body or SMTP diagnostics to visitors/logs.
    error_log('GSS request delivery failed (' . get_class($error) . ').');
    respond(503, ['ok' => false, 'code' => 'UNAVAILABLE']);
}
