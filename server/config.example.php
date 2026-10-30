<?php
declare(strict_types=1);

// Copy to gss-private/config.php OUTSIDE the public website directory.
return [
    'enabled' => false,
    'allowed_origins' => ['https://gss.ru', 'https://www.gss.ru'],
    'secret' => '', // Generate once: php -r "echo bin2hex(random_bytes(32));"
    'autoload' => __DIR__ . '/vendor/autoload.php',
    'rate_directory' => __DIR__ . '/rate-limits',
    'secure_cookie' => true,
    'smtp' => [
        'host' => '',
        'port' => 587,
        'encryption' => 'tls', // STARTTLS: tls/587; implicit TLS: ssl/465.
        'username' => '',
        'password' => '',
        'from_email' => '', // An address authorized by your SMTP provider.
        'from_name' => 'Гарант-Сервис Самара',
        'ca_file' => null // Usually unnecessary: use the server's trusted certificates.
    ]
];
