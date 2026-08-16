<?php
/**
 * BlindBase API
 * Zero-knowledge encryption framework server endpoint
 *
 * Endpoints:
 *   GET  ?action=health              - Health check
 *   GET  ?action=get_salt&user=xxx   - Get/create user salt
 *   POST ?action=save                - Save encrypted data (revision checked)
 *   GET  ?action=load&user=xxx       - Load encrypted data
 *   GET  ?action=rev&user=xxx        - Current revision only (cheap poll)
 *
 * Concurrency:
 *   Every vault carries a monotonic `rev`. A save must declare the revision it
 *   was based on (`base_rev`); if the stored revision has moved on, the write
 *   is rejected with 409 instead of overwriting another screen's work. The
 *   server cannot merge - it never sees plaintext - so the 409 hands the
 *   current revision and blob back to the client, which merges and retries.
 */

/**
 * Load environment variables from .env into process env (if not already set)
 */
function loadEnvFile(string $envFile): void {
    if (!file_exists($envFile)) {
        return;
    }

    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) {
            continue;
        }

        [$name, $value] = explode('=', $line, 2);
        $name = trim($name);
        $value = trim($value, " \t\n\r\0\x0B\"'");

        if ($name !== '' && getenv($name) === false) {
            putenv("$name=$value");
            $_ENV[$name] = $value;
        }
    }
}

/**
 * Send JSON error before helper functions are defined later in the file
 */
function respondEarlyError(string $code, string $message, int $httpStatus): void {
    http_response_code($httpStatus);
    echo json_encode([
        'error' => [
            'code' => $code,
            'message' => $message
        ]
    ]);
    exit;
}

// Load .env before reading any BLINDBASE_* configuration.
loadEnvFile(__DIR__ . '/.env');

// =========================================================================
// TASK 6: SECURITY HEADERS
// =========================================================================
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
header('Referrer-Policy: no-referrer');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');

// =========================================================================
// TASK 4: CORS CONFIGURATION
// =========================================================================
$allowedOriginsRaw = getenv('BLINDBASE_ALLOWED_ORIGINS') ?: '';
$allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $allowedOriginsRaw))));
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin !== '') {
    if (!in_array($requestOrigin, $allowedOrigins, true)) {
        respondEarlyError('CORS_DENIED', 'Origin not allowed', 403);
    }

    header("Access-Control-Allow-Origin: $requestOrigin");
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Auth-Token');
    header('Access-Control-Max-Age: 86400');
}

// Handle preflight OPTIONS requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($requestOrigin === '' || !in_array($requestOrigin, $allowedOrigins, true)) {
        respondEarlyError('CORS_DENIED', 'Origin not allowed', 403);
    }

    http_response_code(204);
    exit;
}

// =========================================================================
// TASK 3: STANDARDIZED ERROR RESPONSE HELPERS
// =========================================================================

/**
 * Send an error response and exit
 *
 * @param array $extra Additional top-level fields to include. Used by the
 *                     revision-conflict response to hand the caller the
 *                     current revision and blob so it can merge without a
 *                     second round trip.
 */
function respondError(string $code, string $message, int $httpStatus = 400, array $extra = []): void {
    http_response_code($httpStatus);
    echo json_encode($extra + [
        'error' => [
            'code' => $code,
            'message' => $message
        ]
    ]);
    exit;
}

/**
 * Send a success response and exit
 */
function respondSuccess(array $data): void {
    echo json_encode($data);
    exit;
}

// =========================================================================
// TASK 2: INPUT VALIDATION FUNCTIONS
// =========================================================================

/**
 * Validate username format
 */
function validateUsername(?string $user): array {
    if (!$user || trim($user) === '') {
        return ['valid' => false, 'code' => 'INVALID_USER', 'message' => 'Username is required'];
    }

    $user = trim($user);

    if (strlen($user) < 3 || strlen($user) > 32) {
        return ['valid' => false, 'code' => 'INVALID_USER', 'message' => 'Username must be 3-32 characters'];
    }

    if (!preg_match('/^[a-z0-9_]+$/', $user)) {
        return ['valid' => false, 'code' => 'INVALID_USER', 'message' => 'Username can only contain lowercase letters, numbers, and underscores'];
    }

    return ['valid' => true, 'username' => $user];
}

/**
 * Validate encrypted payload format and size
 */
function validatePayload(?string $payload, int $maxSizeMB): array {
    if (!$payload || trim($payload) === '') {
        return ['valid' => false, 'code' => 'INVALID_PAYLOAD', 'message' => 'Payload is required'];
    }

    $maxSize = $maxSizeMB * 1024 * 1024;
    if (strlen($payload) > $maxSize) {
        return ['valid' => false, 'code' => 'PAYLOAD_TOO_LARGE', 'message' => "Payload exceeds maximum size of {$maxSizeMB}MB"];
    }

    // Verify it's valid JSON with expected structure
    $decoded = json_decode($payload, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        return ['valid' => false, 'code' => 'INVALID_PAYLOAD', 'message' => 'Payload must be valid JSON'];
    }

    if (!isset($decoded['iv']) || !isset($decoded['data'])) {
        return ['valid' => false, 'code' => 'INVALID_PAYLOAD', 'message' => 'Payload missing required fields (iv, data)'];
    }

    if (!is_array($decoded['iv']) || !is_array($decoded['data'])) {
        return ['valid' => false, 'code' => 'INVALID_PAYLOAD', 'message' => 'Payload iv and data must be arrays'];
    }

    return ['valid' => true];
}

/**
 * Validate the auth token format (64 hex chars = 32 bytes, derived client-side)
 */
function validateAuthToken(?string $auth): array {
    if (!$auth || trim($auth) === '') {
        return ['valid' => false, 'code' => 'AUTH_REQUIRED', 'message' => 'Authentication token is required'];
    }

    $auth = trim($auth);

    if (!preg_match('/^[a-f0-9]{64}$/', $auth)) {
        return ['valid' => false, 'code' => 'AUTH_FAILED', 'message' => 'Invalid username or password'];
    }

    return ['valid' => true, 'auth' => $auth];
}

/**
 * Derive a per-user salt deterministically from the username and server secret.
 *
 * The salt is never stored: it is recomputed on demand, so a storage-only leak
 * does not reveal it (the server secret is required), and the salt endpoint
 * cannot be used to enumerate accounts or exhaust storage.
 */
function deriveSalt(string $user, string $secretKeyBin): string {
    return substr(hash_hmac('sha256', 'salt:' . $user, $secretKeyBin), 0, 32);
}

/**
 * Compute the stored verifier for a client auth token.
 *
 * The token is high-entropy (PBKDF2 output), so a fast hash is sufficient:
 * recovering the token from the verifier is as hard as cracking the password
 * through the client's PBKDF2 work factor.
 */
function authVerifier(string $authToken): string {
    return hash('sha256', $authToken);
}

/**
 * Validate the base revision a save claims to be built on.
 *
 * Required: a client that does not send one (an old cached tab) must not be
 * allowed to blind-overwrite a vault that other screens are writing to.
 */
function validateBaseRev($baseRev): array {
    if ($baseRev === null || $baseRev === '') {
        return ['valid' => false, 'code' => 'BASE_REV_REQUIRED',
                'message' => 'base_rev is required. Reload the page to get the current revision.'];
    }

    if (!is_string($baseRev) && !is_int($baseRev)) {
        return ['valid' => false, 'code' => 'BASE_REV_REQUIRED', 'message' => 'base_rev must be an integer'];
    }

    if (!preg_match('/^\d+$/', (string)$baseRev)) {
        return ['valid' => false, 'code' => 'BASE_REV_REQUIRED', 'message' => 'base_rev must be a non-negative integer'];
    }

    return ['valid' => true, 'base_rev' => (int)$baseRev];
}

/**
 * Path of the revision sidecar for a user.
 *
 * The revision lives in its own tiny file so the polling endpoint does not have
 * to read (and the web server does not have to buffer) a multi-megabyte vault
 * just to answer "has anything changed?".
 */
function revSidecarPath(string $storageDir, string $user): string {
    return rtrim($storageDir, '/') . '/' . $user . '.rev';
}

/**
 * Write the revision sidecar. Best effort: the main record remains the source
 * of truth, and a missing sidecar is rebuilt on the next read.
 *
 * The verifier is copied in so a poll can be authenticated without touching the
 * vault. It is the same value already stored in the main record, so this adds
 * no exposure beyond what the storage directory (web-denied) already holds.
 */
function writeRevSidecar(string $storageDir, string $user, int $rev, ?string $updatedAt, string $verifier): void {
    @file_put_contents(
        revSidecarPath($storageDir, $user),
        json_encode(['rev' => $rev, 'updated_at' => $updatedAt, 'verifier' => $verifier]),
        LOCK_EX
    );
}

// =========================================================================
// TASK 5: RATE LIMITING
// =========================================================================

class RateLimiter {
    private string $storageDir;

    public function __construct(string $storageDir) {
        $this->storageDir = rtrim($storageDir, '/') . '/rate_limits/';
        if (!file_exists($this->storageDir)) {
            @mkdir($this->storageDir, 0700, true);
        }
    }

    /**
     * Check if request is within rate limit
     * @return bool True if allowed, false if rate limited
     */
    public function check(string $identifier, int $limit, int $windowSeconds): bool {
        // Skip rate limiting if directory isn't writable
        if (!is_writable($this->storageDir)) {
            return true;
        }

        $file = $this->storageDir . md5($identifier) . '.json';
        $now = time();

        // Open (creating if needed) and hold an exclusive lock across the whole
        // read-modify-write so concurrent requests can't race past the limit.
        $fh = @fopen($file, 'c+');
        if ($fh === false) {
            return true; // can't enforce; fail open rather than deny service
        }
        if (!flock($fh, LOCK_EX)) {
            fclose($fh);
            return true;
        }

        $content = stream_get_contents($fh);
        $data = ['requests' => [], 'window_start' => $now];
        if ($content) {
            $data = json_decode($content, true) ?: $data;
        }

        // Reset window if expired
        if ($now - ($data['window_start'] ?? 0) > $windowSeconds) {
            $data = ['requests' => [], 'window_start' => $now];
        }

        // Filter requests within current window
        $data['requests'] = array_values(array_filter(
            $data['requests'] ?? [],
            fn($t) => $now - $t < $windowSeconds
        ));

        // Check limit
        if (count($data['requests']) >= $limit) {
            flock($fh, LOCK_UN);
            fclose($fh);
            return false;
        }

        // Record this request
        $data['requests'][] = $now;
        rewind($fh);
        ftruncate($fh, 0);
        fwrite($fh, json_encode($data));
        fflush($fh);
        flock($fh, LOCK_UN);
        fclose($fh);

        return true;
    }

    /**
     * Clean up old rate limit files (call periodically)
     */
    public function cleanup(int $maxAgeSeconds = 3600): void {
        $files = glob($this->storageDir . '*.json');
        $now = time();

        foreach ($files as $file) {
            if ($now - filemtime($file) > $maxAgeSeconds) {
                @unlink($file);
            }
        }
    }
}

// =========================================================================
// TASK 1: CONFIGURATION (Environment Variables)
// =========================================================================
// .env is loaded at the top of this file before any getenv() usage.

// Get configuration from environment
$serverSecretHex = getenv('BLINDBASE_SECRET');
if (!$serverSecretHex) {
    respondError('CONFIG_ERROR', 'Server not configured: BLINDBASE_SECRET environment variable is required', 500);
}

// Validate secret key format (must be 64 hex chars = 32 bytes)
if (!preg_match('/^[a-fA-F0-9]{64}$/', $serverSecretHex)) {
    respondError('CONFIG_ERROR', 'Server configuration error: Invalid secret key format', 500);
}

$SERVER_SECRET_KEY = hex2bin($serverSecretHex);
$STORAGE_DIR = getenv('BLINDBASE_STORAGE_PATH') ?: __DIR__ . '/storage/';
$MAX_PAYLOAD_MB = (int)(getenv('BLINDBASE_MAX_PAYLOAD_MB') ?: 10);

// Ensure storage directory exists
if (!file_exists($STORAGE_DIR)) {
    if (!@mkdir($STORAGE_DIR, 0700, true)) {
        respondError('CONFIG_ERROR', 'Unable to create storage directory', 500);
    }
}

// Initialize rate limiter
$rateLimiter = new RateLimiter($STORAGE_DIR);
$clientIP = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

// Rate limits per endpoint: [requests, window_seconds]
$rateLimits = [
    'get_salt' => [10, 60],   // 10 requests per minute (prevents user enumeration)
    'save'     => [30, 60],   // 30 requests per minute
    'load'     => [60, 60],   // 60 requests per minute
    'rev'      => [120, 60],  // 120 per minute: tiny polling endpoint, own bucket
                              // so sync polling can never starve load/save
    'health'   => [30, 60],   // 30 requests per minute
];

// Get action
$action = $_GET['action'] ?? '';

// Apply rate limiting
if (isset($rateLimits[$action])) {
    [$limit, $window] = $rateLimits[$action];
    if (!$rateLimiter->check("{$action}_{$clientIP}", $limit, $window)) {
        respondError('RATE_LIMITED', 'Too many requests. Please wait and try again.', 429);
    }
}

// =========================================================================
// TASK 7: HEALTH CHECK ENDPOINT
// =========================================================================
if ($action === 'health') {
    $checks = [
        'storage_writable' => is_writable($STORAGE_DIR),
        'secret_configured' => !empty($serverSecretHex),
        'sodium_available' => function_exists('sodium_crypto_secretbox'),
    ];

    $healthy = !in_array(false, $checks, true);

    http_response_code($healthy ? 200 : 503);
    respondSuccess([
        'status' => $healthy ? 'healthy' : 'unhealthy',
        'checks' => $checks,
        'timestamp' => date('c'),
        'version' => '1.0.0'
    ]);
}

// =========================================================================
// ENDPOINT 1: GET SALT (Registration / Login Lookup)
// =========================================================================
if ($action === 'get_salt') {
    // Validate username
    $validation = validateUsername($_GET['user'] ?? null);
    if (!$validation['valid']) {
        respondError($validation['code'], $validation['message']);
    }
    $user = $validation['username'];

    // Salt is deterministic: no storage I/O, no account creation, and the
    // response is identical whether or not the account exists.
    respondSuccess(['salt' => deriveSalt($user, $SERVER_SECRET_KEY)]);
}

// =========================================================================
// ENDPOINT 2: SAVE (Server Encryption - Layer 2)
// =========================================================================
if ($action === 'save') {
    // Verify HTTP method
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respondError('METHOD_NOT_ALLOWED', 'POST method required', 405);
    }

    // Validate username
    $validation = validateUsername($_POST['user'] ?? null);
    if (!$validation['valid']) {
        respondError($validation['code'], $validation['message']);
    }
    $user = $validation['username'];

    // Validate auth token
    $authValidation = validateAuthToken($_POST['auth'] ?? null);
    if (!$authValidation['valid']) {
        respondError($authValidation['code'], $authValidation['message'],
            $authValidation['code'] === 'AUTH_REQUIRED' ? 401 : 403);
    }
    $auth = $authValidation['auth'];

    // Validate payload
    $payloadValidation = validatePayload($_POST['payload'] ?? null, $MAX_PAYLOAD_MB);
    if (!$payloadValidation['valid']) {
        respondError($payloadValidation['code'], $payloadValidation['message'],
            $payloadValidation['code'] === 'PAYLOAD_TOO_LARGE' ? 413 : 400);
    }
    $clientPayload = $_POST['payload'];

    // Validate the revision this write is based on
    $revValidation = validateBaseRev($_POST['base_rev'] ?? null);
    if (!$revValidation['valid']) {
        respondError($revValidation['code'], $revValidation['message'], 400);
    }
    $baseRev = $revValidation['base_rev'];

    $file = $STORAGE_DIR . $user . '.json';

    // Read-modify-write under one exclusive lock. Holding the lock across the
    // whole sequence is what makes the revision check a true compare-and-swap;
    // it also closes the gap between verifying the caller and writing the file.
    $fh = @fopen($file, 'c+');
    if ($fh === false) {
        respondError('STORAGE_ERROR', 'Unable to open vault for writing', 500);
    }
    if (!flock($fh, LOCK_EX)) {
        fclose($fh);
        respondError('STORAGE_ERROR', 'Unable to lock vault for writing', 500);
    }

    /**
     * Release the lock before leaving through an error path
     */
    $releaseAndFail = function (string $code, string $message, int $status, array $extra = []) use ($fh) {
        flock($fh, LOCK_UN);
        fclose($fh);
        respondError($code, $message, $status, $extra);
    };

    $existing = stream_get_contents($fh);

    if ($existing !== '' && $existing !== false) {
        // Existing account: caller must prove knowledge of the password.
        $data = json_decode($existing, true);
        if (!$data || !isset($data['verifier'])) {
            $releaseAndFail('DATA_CORRUPTED', 'User data is corrupted', 500);
        }
        if (!hash_equals($data['verifier'], authVerifier($auth))) {
            $releaseAndFail('AUTH_FAILED', 'Invalid username or password', 403);
        }

        $currentRev = (int)($data['rev'] ?? 0);

        if ($baseRev !== $currentRev) {
            // Another screen wrote first. Hand back the current revision and
            // blob so the caller can merge and retry in a single round trip.
            $conflict = ['rev' => $currentRev, 'updated_at' => $data['updated_at'] ?? null, 'data' => null];

            if (!empty($data['encrypted_blob'])) {
                $decoded = base64_decode($data['encrypted_blob']);
                if ($decoded !== false && strlen($decoded) >= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
                    $conflictNonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
                    $conflictCipher = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
                    $opened = sodium_crypto_secretbox_open($conflictCipher, $conflictNonce, $SERVER_SECRET_KEY);
                    if ($opened !== false) {
                        $conflict['data'] = $opened;
                    }
                }
            }

            $releaseAndFail(
                'REV_CONFLICT',
                'This vault was modified by another session. Merge and retry.',
                409,
                $conflict
            );
        }
    } else {
        // First write registers the account and binds the verifier.
        $data = [
            'verifier' => authVerifier($auth),
            'encrypted_blob' => null,
            'rev' => 0,
            'created_at' => date('c'),
            'updated_at' => null
        ];

        if ($baseRev !== 0) {
            $releaseAndFail(
                'REV_CONFLICT',
                'This vault was modified by another session. Merge and retry.',
                409,
                ['rev' => 0, 'updated_at' => null, 'data' => null]
            );
        }
    }

    // Layer 2 Encryption (Server Side)
    $nonce = random_bytes(SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $layer2_ciphertext = sodium_crypto_secretbox($clientPayload, $nonce, $SERVER_SECRET_KEY);

    // Encode for storage (Nonce + Ciphertext)
    $storedBlob = base64_encode($nonce . $layer2_ciphertext);

    $data['encrypted_blob'] = $storedBlob;
    $data['rev'] = $baseRev + 1;
    $data['updated_at'] = date('c');

    rewind($fh);
    if (ftruncate($fh, 0) === false || fwrite($fh, json_encode($data)) === false) {
        $releaseAndFail('STORAGE_ERROR', 'Unable to save data', 500);
    }
    fflush($fh);

    // Sidecar is written under the same lock so pollers never see a revision
    // the main record has not committed yet.
    writeRevSidecar($STORAGE_DIR, $user, $data['rev'], $data['updated_at'], $data['verifier']);

    flock($fh, LOCK_UN);
    fclose($fh);

    respondSuccess([
        'status' => 'saved',
        'rev' => $data['rev'],
        'updated_at' => $data['updated_at']
    ]);
}

// =========================================================================
// ENDPOINT 4: REV (Cheap change poll)
// =========================================================================
if ($action === 'rev') {
    // Validate username
    $validation = validateUsername($_GET['user'] ?? null);
    if (!$validation['valid']) {
        respondError($validation['code'], $validation['message']);
    }
    $user = $validation['username'];

    // Same authentication as load: the revision is only disclosed to someone
    // who can already read the vault.
    $authValidation = validateAuthToken($_SERVER['HTTP_X_AUTH_TOKEN'] ?? null);
    if (!$authValidation['valid']) {
        respondError($authValidation['code'], $authValidation['message'],
            $authValidation['code'] === 'AUTH_REQUIRED' ? 401 : 403);
    }
    $auth = $authValidation['auth'];

    $file = $STORAGE_DIR . $user . '.json';

    if (!file_exists($file)) {
        // Not registered yet - indistinguishable from an empty vault
        respondSuccess(['rev' => 0, 'updated_at' => null]);
    }

    // Fast path: answer from the sidecar so a poll every few seconds never
    // reads a multi-megabyte vault off disk.
    $sidecarPath = revSidecarPath($STORAGE_DIR, $user);
    $sidecar = null;
    if (file_exists($sidecarPath)) {
        $sidecar = json_decode((string)@file_get_contents($sidecarPath), true);
    }

    if (is_array($sidecar) && isset($sidecar['verifier'], $sidecar['rev'])) {
        if (!hash_equals($sidecar['verifier'], authVerifier($auth))) {
            respondError('AUTH_FAILED', 'Invalid username or password', 403);
        }

        respondSuccess([
            'rev' => (int)$sidecar['rev'],
            'updated_at' => $sidecar['updated_at'] ?? null
        ]);
    }

    // Slow path: vault predates the sidecar (or it was removed). Read the main
    // record once, then write the sidecar so later polls take the fast path.
    $data = json_decode((string)file_get_contents($file), true);
    if (!$data || !isset($data['verifier'])) {
        respondError('DATA_CORRUPTED', 'User data is corrupted', 500);
    }

    if (!hash_equals($data['verifier'], authVerifier($auth))) {
        respondError('AUTH_FAILED', 'Invalid username or password', 403);
    }

    $rev = (int)($data['rev'] ?? 0);
    $updatedAt = $data['updated_at'] ?? null;

    writeRevSidecar($STORAGE_DIR, $user, $rev, $updatedAt, $data['verifier']);

    respondSuccess(['rev' => $rev, 'updated_at' => $updatedAt]);
}

// =========================================================================
// ENDPOINT 3: LOAD (Server Decryption - Layer 2)
// =========================================================================
if ($action === 'load') {
    // Validate username
    $validation = validateUsername($_GET['user'] ?? null);
    if (!$validation['valid']) {
        respondError($validation['code'], $validation['message']);
    }
    $user = $validation['username'];

    // Validate auth token. It is read from the X-Auth-Token header rather than
    // a query parameter so this read-and-overwrite credential never lands in
    // web server / proxy access logs, browser history, or Referer headers.
    $authValidation = validateAuthToken($_SERVER['HTTP_X_AUTH_TOKEN'] ?? null);
    if (!$authValidation['valid']) {
        respondError($authValidation['code'], $authValidation['message'],
            $authValidation['code'] === 'AUTH_REQUIRED' ? 401 : 403);
    }
    $auth = $authValidation['auth'];

    $file = $STORAGE_DIR . $user . '.json';

    if (!file_exists($file)) {
        // Not registered yet - return null data (first save will register)
        respondSuccess(['data' => null, 'rev' => 0]);
    }

    $data = json_decode(file_get_contents($file), true);
    if (!$data || !isset($data['verifier'])) {
        respondError('DATA_CORRUPTED', 'User data is corrupted', 500);
    }

    // Caller must prove knowledge of the password before any blob is returned.
    if (!hash_equals($data['verifier'], authVerifier($auth))) {
        respondError('AUTH_FAILED', 'Invalid username or password', 403);
    }

    // The revision this snapshot represents. The client sends it back as
    // base_rev on the next save so a stale overwrite can be detected.
    $rev = (int)($data['rev'] ?? 0);

    if (empty($data['encrypted_blob'])) {
        // User exists but has no data yet
        respondSuccess(['data' => null, 'rev' => $rev]);
    }

    // Decode stored blob
    $decoded = base64_decode($data['encrypted_blob']);
    if ($decoded === false || strlen($decoded) < SODIUM_CRYPTO_SECRETBOX_NONCEBYTES) {
        respondError('DATA_CORRUPTED', 'Stored data is corrupted', 500);
    }

    $nonce = substr($decoded, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);
    $ciphertext = substr($decoded, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES);

    // Layer 2 Decrypt
    $layer1_ciphertext = sodium_crypto_secretbox_open($ciphertext, $nonce, $SERVER_SECRET_KEY);

    if ($layer1_ciphertext === false) {
        respondError('DECRYPT_FAILED', 'Server-side decryption failed. This may indicate key rotation or data corruption.', 500);
    }

    // Return the Layer 1 ciphertext (still encrypted by client password)
    respondSuccess([
        'data' => $layer1_ciphertext,
        'rev' => $rev,
        'updated_at' => $data['updated_at'] ?? null
    ]);
}

// =========================================================================
// UNKNOWN ACTION
// =========================================================================
respondError('INVALID_ACTION', 'Unknown action. Valid actions: health, get_salt, save, load, rev', 400);
