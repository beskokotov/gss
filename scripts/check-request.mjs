// Integration check: PHP + real PHPMailer + a local TLS SMTP sink. No external mail.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer as createTcpServer } from 'node:net';
import { createServer as createTlsServer } from 'node:tls';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const privateRoot = join(root, 'server', '.test');
await mkdir(privateRoot, { recursive: true });
const directory = await mkdtemp(join(privateRoot, 'request-'));
const certificate = join(directory, 'certificate.pem');
const key = join(directory, 'key.pem');
execFileSync(process.env.GSS_OPENSSL_BIN || 'openssl', [
  'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-keyout', key, '-out', certificate, '-subj', '/CN=localhost',
  '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'
], { stdio: 'ignore', env: { ...process.env, MSYS_NO_PATHCONV: '1', MSYS2_ARG_CONV_EXCL: '*' } });

let rejectDelivery = false;
const delivered = [];
const recipients = [];
const sockets = new Set();
const smtp = createTlsServer({ key: await readFile(key), cert: await readFile(certificate) }, socket => {
  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
  socket.on('error', () => {});
  socket.setEncoding('utf8');
  socket.write('220 localhost test SMTP\r\n');
  let buffer = '', mode = '', body = [];
  socket.on('data', chunk => {
    buffer += chunk;
    let end;
    while ((end = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (mode === 'data') {
        if (line === '.') {
          if (rejectDelivery) socket.write('451 Temporary test failure\r\n');
          else { delivered.push(body.join('\n')); socket.write('250 Queued by local test sink\r\n'); }
          mode = ''; body = [];
        } else body.push(line);
      } else if (mode === 'user') { mode = 'password'; socket.write('334 UGFzc3dvcmQ6\r\n'); }
      else if (mode === 'password') { mode = ''; socket.write('235 Authenticated\r\n'); }
      else if (/^EHLO/.test(line)) socket.write('250-localhost\r\n250-AUTH LOGIN\r\n250 SIZE 8192\r\n');
      else if (/^AUTH LOGIN/.test(line)) { mode = 'user'; socket.write('334 VXNlcm5hbWU6\r\n'); }
      else if (/^MAIL FROM:/.test(line)) socket.write('250 Sender accepted\r\n');
      else if (/^RCPT TO:/.test(line)) { recipients.push(line); socket.write('250 Recipient accepted\r\n'); }
      else if (line === 'DATA') { mode = 'data'; socket.write('354 End with dot\r\n'); }
      else if (line === 'QUIT') socket.end('221 Goodbye\r\n');
      else socket.write('250 OK\r\n');
    }
  });
});
await new Promise(resolve => smtp.listen(0, '127.0.0.1', resolve));
const probe = createTcpServer();
await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const origin = `http://127.0.0.1:${port}`;
const endpoint = `${origin}/request.php`;
const configuration = {
  enabled: true, allowed_origins: [origin], secret: randomBytes(32).toString('hex'),
  autoload: join(root, 'server/vendor/autoload.php'), rate_directory: join(directory, 'rates'), secure_cookie: false,
  smtp: { host: '127.0.0.1', port: smtp.address().port, encryption: 'ssl', username: 'test', password: 'local-test-only', from_email: 'website@gss.ru', from_name: 'GSS', ca_file: certificate }
};
await writeFile(join(directory, 'config.json'), JSON.stringify(configuration));
await writeFile(join(directory, 'config.php'), "<?php return json_decode(file_get_contents(__DIR__ . '/config.json'), true);\n");
const phpOptions = process.env.GSS_PHP_EXTENSION_DIR ? ['-d', `extension_dir=${process.env.GSS_PHP_EXTENSION_DIR}`, '-d', 'extension=openssl', '-d', 'extension=mbstring'] : [];
const php = spawn(process.env.GSS_PHP_BIN || 'php', [...phpOptions, '-S', `127.0.0.1:${port}`, '-t', join(root, 'server/public')], {
  windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, GSS_FORM_CONFIG: join(directory, 'config.php') }
});
let diagnostics = '';
php.stderr.on('data', chunk => { diagnostics = (diagnostics + chunk).slice(-20000); });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  let handshake;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { handshake = await fetch(endpoint); break; } catch { await pause(100); }
  }
  assert.ok(handshake, diagnostics);
  assert.equal(handshake.status, 200, diagnostics);
  const { token } = await handshake.json();
  const cookie = handshake.headers.get('set-cookie').split(';')[0];
  const payload = { name: 'Тест', contact: 'anna@example.com', message: 'Проверка без отправки во внешнюю сеть', topic: 'Консультация', website: '', token, requestId: randomUUID(), recipient: 'attacker@example.com' };
  const post = (body, requestOrigin = origin) => fetch(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: requestOrigin, Cookie: cookie }, body: JSON.stringify(body)
  });
  assert.equal((await post(payload, 'https://other.example')).status, 403);
  assert.equal((await post({ ...payload, token: 'wrong' })).status, 403);
  assert.equal((await post({ ...payload, website: 'https://spam.example' })).status, 422);
  assert.equal((await post({ ...payload, contact: 'not a contact' })).status, 422);
  assert.equal((await post({ ...payload, topic: 'Injected\r\nBcc: somebody@example.com' })).status, 422);
  assert.equal((await post({ ...payload, message: 'x'.repeat(9000) })).status, 413);
  assert.equal(delivered.length, 0);

  let response = await post(payload);
  assert.equal(response.status, 200, diagnostics);
  assert.equal((await response.json()).ok, true);
  assert.equal(delivered.length, 1);
  assert.ok(delivered[0].includes('anna@example.com'));
  assert.ok(recipients.every(line => line.includes('<info@gss.ru>')));
  assert.equal((await post(payload)).status, 200);
  assert.equal(delivered.length, 1, 'Retry must not send a duplicate');
  assert.equal((await post({ ...payload, message: 'different content' })).status, 409);

  rejectDelivery = true;
  response = await post({ ...payload, requestId: randomUUID() });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).ok, false);
  assert.equal(delivered.length, 1);
  rejectDelivery = false;
  for (let index = 0; index < 3; index++) assert.equal((await post({ ...payload, requestId: randomUUID() })).status, 200);
  assert.equal((await post({ ...payload, requestId: randomUUID() })).status, 429);
  console.log('PHP/SMTP integration passed: TLS, fixed recipient, validation, CSRF, spam trap, duplicate prevention, SMTP failure and rate limits. No external mail sent.');
} finally {
  php.kill();
  for (const socket of sockets) socket.destroy();
  await new Promise(resolve => smtp.close(resolve));
}
