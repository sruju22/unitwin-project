const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

class CameraStreamingService {
  constructor() {
    this.idleTimeoutSec = parseInt(process.env.CAMERA_C110_IDLE_TIMEOUT_SEC || '25', 10);
    this.streamDir = path.join(__dirname, '../temp_streams/c110');

    this.ffmpegProcess = null;
    this.state = 'idle'; // 'idle' | 'starting' | 'live' | 'error'
    this.lastError = null;
    this.startTime = null;
    this.lastHeartbeat = null;
    this.activeViewers = new Set();
    this.reaperInterval = null;

    // Resolve FFmpeg binary
    this.ffmpegPath = this.resolveFFmpegPath();

    // Ensure temp streams directory exists
    if (!fs.existsSync(this.streamDir)) {
      fs.mkdirSync(this.streamDir, { recursive: true });
    }

    // Start background idle monitoring
    this.startReaperTimer();
  }

  /**
   * Resolves effective RTSP URL, safely injecting backend environment credentials if configured
   */
  getEffectiveRtspUrl() {
    const rawUrl =
      process.env.CAMERA_C110_RTSP_URL || 'rtsp://192.168.1.14:5543/live/channel0';
    const username = process.env.CAMERA_C110_RTSP_USERNAME;
    const password = process.env.CAMERA_C110_RTSP_PASSWORD;

    // If username and password provided in environment and not already embedded in URL, inject safely
    if (username && password && !rawUrl.includes('@')) {
      const protoIndex = rawUrl.indexOf('://');
      if (protoIndex !== -1) {
        const proto = rawUrl.substring(0, protoIndex + 3);
        const rest = rawUrl.substring(protoIndex + 3);
        return `${proto}${encodeURIComponent(username)}:${encodeURIComponent(password)}@${rest}`;
      }
    }
    return rawUrl;
  }

  /**
   * Sanitizes RTSP URL by redacting credentials for safe logging and status reporting
   */
  getSanitizedRtspUrl(url = this.getEffectiveRtspUrl()) {
    return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
  }

  /**
   * Redacts any credentials from error messages or logs
   */
  sanitizeError(errText) {
    if (!errText) return null;
    return String(errText).replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:***@');
  }

  resolveFFmpegPath() {
    if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
      return process.env.FFMPEG_PATH;
    }
    try {
      const staticFfmpeg = require('ffmpeg-static');
      if (staticFfmpeg && fs.existsSync(staticFfmpeg)) {
        return staticFfmpeg;
      }
    } catch {
      // Fallback to system PATH
    }
    return 'ffmpeg';
  }

  getOptimalEncoder() {
    // macOS hardware acceleration via VideoToolbox
    if (process.platform === 'darwin') {
      return 'h264_videotoolbox';
    }
    return 'libx264';
  }

  /**
   * Fast TCP connectivity probe to camera host and port before spawning FFmpeg
   * Includes retry logic for Wi-Fi power-save / ARP wake delays
   */
  async probeCameraConnectivity(timeoutMs = 3500, maxRetries = 2) {
    const effectiveUrl = this.getEffectiveRtspUrl();
    const match = effectiveUrl.match(/rtsp:\/\/(?:[^@]+@)?([^:/]+)(?::(\d+))?/);
    if (!match) {
      throw new Error('Invalid camera RTSP URL configuration');
    }
    const host = match[1];
    const port = match[2] ? parseInt(match[2], 10) : 554;

    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        await new Promise((resolve, reject) => {
          const socket = new net.Socket();
          let hasResponded = false;

          socket.setTimeout(timeoutMs);

          socket.connect(port, host, () => {
            hasResponded = true;
            socket.destroy();
            resolve(true);
          });

          socket.on('timeout', () => {
            if (!hasResponded) {
              hasResponded = true;
              socket.destroy();
              reject(
                new Error(
                  `Camera RTSP connection timed out (${host}:${port}). Please verify camera power and local network connection.`
                )
              );
            }
          });

          socket.on('error', (err) => {
            if (!hasResponded) {
              hasResponded = true;
              socket.destroy();
              reject(
                new Error(
                  `Unable to connect to camera at ${host}:${port} (${err.code || err.message}). Please verify camera power and IP settings.`
                )
              );
            }
          });
        });
        return true; // Successfully connected
      } catch (err) {
        lastErr = err;
        if (attempt <= maxRetries) {
          console.warn(`[CameraStreamingService] Probe attempt ${attempt} failed (${err.message}), retrying...`);
          await new Promise((r) => setTimeout(r, 600));
        }
      }
    }
    throw lastErr;
  }

  cleanStreamDirectory() {
    try {
      if (fs.existsSync(this.streamDir)) {
        const files = fs.readdirSync(this.streamDir);
        for (const file of files) {
          if (file.endsWith('.ts') || file.endsWith('.m3u8') || file.endsWith('.tmp')) {
            try {
              fs.unlinkSync(path.join(this.streamDir, file));
            } catch {
              // Ignore file busy during cleanup
            }
          }
        }
      }
    } catch (err) {
      console.warn('[CameraStreamingService] Cleanup warning:', err.message);
    }
  }

  async startStream(clientId = 'anonymous') {
    this.activeViewers.add(clientId);
    this.lastHeartbeat = Date.now();

    // If already live or starting, return current status immediately
    if (this.state === 'live') {
      return this.getStatus();
    }
    if (this.state === 'starting' && this.ffmpegProcess) {
      return this.getStatus();
    }

    // Terminate any previous orphaned process
    if (this.ffmpegProcess) {
      this.killFFmpegProcess();
    }

    this.cleanStreamDirectory();
    this.state = 'starting';
    this.lastError = null;
    this.startTime = Date.now();

    // Step 1: Pre-flight TCP probe
    try {
      await this.probeCameraConnectivity(3000);
    } catch (probeErr) {
      console.error('[CameraStreamingService] Pre-flight probe failed:', probeErr.message);
      this.state = 'error';
      this.lastError = probeErr.message;
      return this.getStatus();
    }

    // Step 2: Spawn FFmpeg transmuxer/transcoder
    const encoder = this.getOptimalEncoder();
    const manifestPath = path.join(this.streamDir, 'stream.m3u8');

    const effectiveUrl = this.getEffectiveRtspUrl();
    const sanitizedUrl = this.getSanitizedRtspUrl(effectiveUrl);

    const ffmpegArgs = [
      '-rtsp_transport',
      'tcp',
      '-timeout',
      '5000000', // 5 seconds socket timeout
      '-i',
      effectiveUrl,
      '-c:v',
      encoder,
      ...(encoder === 'h264_videotoolbox'
        ? ['-b:v', '2000k', '-realtime', '1']
        : ['-preset', 'ultrafast', '-tune', 'zerolatency', '-b:v', '2000k']),
      '-an', // Video-only surveillance testbed (prevents audio clock drift)
      '-f',
      'hls',
      '-hls_time',
      '1', // 1-second segment target for low latency
      '-hls_list_size',
      '4', // Keep last 4 segments in playlist
      '-hls_flags',
      'delete_segments+temp_file', // Auto-prune old segments and atomic write
      '-hls_segment_type',
      'mpegts',
      manifestPath,
    ];

    console.log(
      `[CameraStreamingService] Launching FFmpeg (${this.ffmpegPath}) for C-110 CP PLUS RTSP stream (${sanitizedUrl})...`
    );

    try {
      this.ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderrBuffer = '';

      this.ffmpegProcess.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderrBuffer += text;
        if (stderrBuffer.length > 2000) {
          stderrBuffer = stderrBuffer.slice(-2000);
        }
      });

      this.ffmpegProcess.on('error', (err) => {
        console.error('[CameraStreamingService] Process spawn error:', this.sanitizeError(err.message));
        this.state = 'error';
        this.lastError = this.sanitizeError(`FFmpeg spawn failed: ${err.message}`);
      });

      this.ffmpegProcess.on('close', (code, signal) => {
        console.log(
          `[CameraStreamingService] FFmpeg exited with code ${code}, signal ${signal}`
        );
        if (this.state !== 'idle') {
          if (code !== 0 && code !== null) {
            this.state = 'error';
            this.lastError = this.sanitizeError(`Camera stream ended unexpectedly (code ${code}). ${
              stderrBuffer.includes('No route to host')
                ? 'Camera unreachable on local network (192.168.1.14:5543).'
                : stderrBuffer.includes('Connection refused')
                ? 'Connection refused by camera RTSP server.'
                : 'Check camera power and network status.'
            }`);
          } else {
            this.state = 'idle';
          }
        }
        this.ffmpegProcess = null;
      });

      // Poll for manifest creation and first segment
      await this.waitForManifest(manifestPath, 15000);
      this.state = 'live';
      console.log('[CameraStreamingService] C-110 HLS Stream is verified LIVE and ready!');
      return this.getStatus();
    } catch (err) {
      console.error('[CameraStreamingService] Stream initialization error:', err.message);
      this.state = 'error';
      this.lastError = err.message;
      this.killFFmpegProcess();
      return this.getStatus();
    }
  }

  async waitForManifest(manifestPath, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.state === 'error') {
        throw new Error(this.lastError || 'FFmpeg failed during stream initialization');
      }
      if (fs.existsSync(manifestPath)) {
        try {
          const content = fs.readFileSync(manifestPath, 'utf8');
          // Wait until at least one .ts segment is listed in the manifest
          if (content.includes('.ts') && content.includes('#EXTINF:')) {
            return true;
          }
        } catch {
          // File may be temporarily locked while writing
        }
      }
      await new Promise((res) => setTimeout(res, 300));
    }
    throw new Error('Timed out waiting for camera HLS stream manifest generation (15s).');
  }

  heartbeat(clientId = 'anonymous') {
    this.activeViewers.add(clientId);
    this.lastHeartbeat = Date.now();
    return this.getStatus();
  }

  removeViewer(clientId) {
    if (clientId) {
      this.activeViewers.delete(clientId);
    }
    if (this.activeViewers.size === 0) {
      // If no viewers remain, stop after a short debounce to release resources
      setTimeout(() => {
        if (this.activeViewers.size === 0 && this.state !== 'idle') {
          console.log(
            '[CameraStreamingService] All viewers disconnected. Releasing camera stream resources.'
          );
          this.stopStream('no_viewers');
        }
      }, 5000);
    }
    return this.getStatus();
  }

  stopStream(reason = 'user_request') {
    console.log(`[CameraStreamingService] Stopping stream: reason = ${reason}`);
    this.state = 'idle';
    this.activeViewers.clear();
    this.killFFmpegProcess();
    this.cleanStreamDirectory();
    return this.getStatus();
  }

  killFFmpegProcess() {
    if (this.ffmpegProcess) {
      try {
        this.ffmpegProcess.kill('SIGTERM');
        const proc = this.ffmpegProcess;
        setTimeout(() => {
          try {
            if (proc && !proc.killed) {
              proc.kill('SIGKILL');
            }
          } catch {
            // Already dead
          }
        }, 1500);
      } catch (err) {
        console.warn('[CameraStreamingService] Error killing FFmpeg:', err.message);
      }
      this.ffmpegProcess = null;
    }
  }

  startReaperTimer() {
    if (this.reaperInterval) clearInterval(this.reaperInterval);
    this.reaperInterval = setInterval(() => {
      if (this.state === 'live' || this.state === 'starting') {
        const idleDuration = (Date.now() - (this.lastHeartbeat || Date.now())) / 1000;
        if (idleDuration > this.idleTimeoutSec) {
          console.log(
            `[CameraStreamingService] Stream idle for ${Math.round(
              idleDuration
            )}s (exceeded limit ${this.idleTimeoutSec}s). Stopping process to save resources.`
          );
          this.stopStream('idle_timeout');
        }
      }
    }, 5000);
    if (this.reaperInterval && typeof this.reaperInterval.unref === 'function') {
      this.reaperInterval.unref();
    }
  }

  getStatus() {
    const isLive = this.state === 'live';
    const uptime = isLive && this.startTime ? Math.round((Date.now() - this.startTime) / 1000) : 0;
    const manifestExists = fs.existsSync(path.join(this.streamDir, 'stream.m3u8'));
    const effectiveUrl = this.getEffectiveRtspUrl();
    const hasAuth = Boolean(
      (process.env.CAMERA_C110_RTSP_USERNAME && process.env.CAMERA_C110_RTSP_PASSWORD) ||
      (effectiveUrl && effectiveUrl.includes('@'))
    );

    return {
      success: true,
      roomId: 'C-110',
      state: this.state, // 'idle' | 'starting' | 'live' | 'error'
      isLive: isLive && manifestExists,
      activeViewers: this.activeViewers.size,
      uptimeSec: uptime,
      authMode: hasAuth ? 'authenticated' : 'unauthenticated',
      streamUrl: isLive && manifestExists ? '/api/camera/c110/stream.m3u8' : null,
      error: this.sanitizeError(this.lastError),
    };
  }

  getStreamDirectory() {
    return this.streamDir;
  }
}

// Singleton instance for the application
const cameraStreamingService = new CameraStreamingService();
module.exports = cameraStreamingService;
