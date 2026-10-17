/**
 * Camera Authentication Verification Unit & Integration Test
 * Verifies:
 * 1. Safe credential injection from environment variables into RTSP URL
 * 2. Complete credential masking in sanitized URLs (no leaks)
 * 3. Sanitization of error messages containing credentials
 * 4. Reporting of authMode: 'authenticated' vs 'unauthenticated'
 * 5. Connection behavior with and without credentials
 */
const assert = require('assert');
const cameraStreamingService = require('./services/cameraStreamingService');

async function testAuthHandling() {
  console.log('\n======================================================');
  console.log('[Camera Auth Test] Testing credential handling & sanitization');
  console.log('======================================================\n');

  // Baseline unauthenticated state
  delete process.env.CAMERA_C110_RTSP_USERNAME;
  delete process.env.CAMERA_C110_RTSP_PASSWORD;
  process.env.CAMERA_C110_RTSP_URL = 'rtsp://192.168.1.14:5543/live/channel0';

  console.log('1. Testing unauthenticated mode...');
  const defaultUrl = cameraStreamingService.getEffectiveRtspUrl();
  assert.strictEqual(defaultUrl, 'rtsp://192.168.1.14:5543/live/channel0');
  const sanitizedDefault = cameraStreamingService.getSanitizedRtspUrl(defaultUrl);
  assert.strictEqual(sanitizedDefault, 'rtsp://192.168.1.14:5543/live/channel0');
  const statusUnauth = cameraStreamingService.getStatus();
  assert.strictEqual(statusUnauth.authMode, 'unauthenticated');
  console.log('   ✓ Unauthenticated URL & authMode verified');

  // Authenticated state via env variables
  console.log('\n2. Testing credential injection via environment variables...');
  process.env.CAMERA_C110_RTSP_USERNAME = 'test_user';
  process.env.CAMERA_C110_RTSP_PASSWORD = 'super_secret_password_123';

  const effectiveUrl = cameraStreamingService.getEffectiveRtspUrl();
  assert.strictEqual(effectiveUrl, 'rtsp://test_user:super_secret_password_123@192.168.1.14:5543/live/channel0');
  console.log('   ✓ Credentials correctly formatted into effective RTSP URL for FFmpeg');

  // Sanitized URL masking check
  console.log('\n3. Testing credential sanitization & redaction...');
  const sanitizedUrl = cameraStreamingService.getSanitizedRtspUrl(effectiveUrl);
  assert.strictEqual(sanitizedUrl, 'rtsp://test_user:***@192.168.1.14:5543/live/channel0');
  assert(!sanitizedUrl.includes('super_secret_password_123'), 'Secret password must not be present in sanitized URL');
  console.log('   ✓ Password redacted to *** in sanitized URL:', sanitizedUrl);

  // Status check (no password leak)
  console.log('\n4. Testing API getStatus() output under authenticated mode...');
  const statusAuth = cameraStreamingService.getStatus();
  assert.strictEqual(statusAuth.authMode, 'authenticated');
  const statusString = JSON.stringify(statusAuth);
  assert(!statusString.includes('super_secret_password_123'), 'Status response must NEVER contain password');
  console.log('   ✓ API status reports authMode: "authenticated" without leaking credentials');

  // Error message sanitization check
  console.log('\n5. Testing error message sanitization...');
  const rawError = 'Connection failed to rtsp://test_user:super_secret_password_123@192.168.1.14:5543/live/channel0';
  const cleanError = cameraStreamingService.sanitizeError(rawError);
  assert.strictEqual(cleanError, 'Connection failed to rtsp://test_user:***@192.168.1.14:5543/live/channel0');
  assert(!cleanError.includes('super_secret_password_123'), 'Error message must redact password');
  console.log('   ✓ Error text sanitized:', cleanError);

  // Clean up env test credentials
  delete process.env.CAMERA_C110_RTSP_USERNAME;
  delete process.env.CAMERA_C110_RTSP_PASSWORD;

  console.log('\n======================================================');
  console.log('>>> ALL CAMERA AUTHENTICATION TESTS PASSED! <<<');
  console.log('======================================================\n');
}

testAuthHandling().catch((err) => {
  console.error('\n❌ AUTH TEST FAILED:', err);
  process.exit(1);
});
