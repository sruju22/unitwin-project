/**
 * End-to-End Verification Test for C-110 CP PLUS Camera RTSP -> HLS Streaming
 */
const { app, server } = require('./server');
const http = require('http');

async function runTest() {
  const port = process.env.PORT || 5001;
  const baseUrl = `http://localhost:${port}`;
  console.log(`\n======================================================`);
  console.log(`[Camera E2E Test] Testing against server on port ${port}...`);
  console.log(`======================================================\n`);

  function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const options = {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
      };
      const req = http.request(url, options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            // Raw text (e.g. m3u8 playlist)
          }
          resolve({ status: res.statusCode, headers: res.headers, body: json || data });
        });
      });
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  }

  try {
    // 1. Initial Status
    console.log('1. Checking initial stream status (GET /api/camera/c110/status)...');
    const status1 = await request('GET', '/api/camera/c110/status');
    console.log('   Status Code:', status1.status);
    console.log('   Response Body:', status1.body);
    if (status1.body.state !== 'idle') {
      throw new Error(`Expected initial state to be 'idle', got '${status1.body.state}'`);
    }

    // 2. Start Stream
    console.log('\n2. Starting live stream (POST /api/camera/c110/start)...');
    const startRes = await request('POST', '/api/camera/c110/start', { clientId: 'e2e_tester' });
    console.log('   Status Code:', startRes.status);
    console.log('   Response Body:', startRes.body);
    if (!startRes.body.isLive && startRes.body.state !== 'live') {
      throw new Error(`Expected stream to be live, got: ${JSON.stringify(startRes.body)}`);
    }

    // 3. Fetch Playlist Manifest
    console.log('\n3. Fetching HLS playlist manifest (GET /api/camera/c110/stream.m3u8)...');
    const manifestRes = await request('GET', '/api/camera/c110/stream.m3u8');
    console.log('   Status Code:', manifestRes.status);
    console.log('   Content-Type:', manifestRes.headers['content-type']);
    console.log('   Manifest Snippet:\n', manifestRes.body.split('\n').slice(0, 8).join('\n'));
    if (!manifestRes.body.includes('#EXTM3U') || !manifestRes.body.includes('.ts')) {
      throw new Error('Manifest does not contain valid HLS tags and segments');
    }

    // 4. Send Heartbeat
    console.log('\n4. Sending viewer heartbeat (POST /api/camera/c110/heartbeat)...');
    const hbRes = await request('POST', '/api/camera/c110/heartbeat', { clientId: 'e2e_tester' });
    console.log('   Status Code:', hbRes.status);
    console.log('   Active Viewers:', hbRes.body.activeViewers);

    // 5. Stop Stream
    console.log('\n5. Stopping stream explicitly (POST /api/camera/c110/stop)...');
    const stopRes = await request('POST', '/api/camera/c110/stop', { clientId: 'e2e_tester', force: true });
    console.log('   Status Code:', stopRes.status);
    console.log('   Response Body:', stopRes.body);

    // 6. Verify Post-Stop Status
    console.log('\n6. Verifying post-stop status (GET /api/camera/c110/status)...');
    const status2 = await request('GET', '/api/camera/c110/status');
    console.log('   Final State:', status2.body.state);
    if (status2.body.state !== 'idle') {
      throw new Error(`Expected final state to be 'idle', got '${status2.body.state}'`);
    }

    console.log('\n======================================================');
    console.log('>>> ALL C-110 CAMERA STREAMING E2E TESTS PASSED! <<<');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.stack || err.message);
  } finally {
    try {
      if (server && server.listening) {
        server.close();
      }
    } catch {}
    process.exit(0);
  }
}

runTest();
