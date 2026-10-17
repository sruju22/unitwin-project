const express = require('express');
const path = require('path');
const fs = require('fs');
const cameraStreamingService = require('../services/cameraStreamingService');

const router = express.Router();

/**
 * Get current camera stream status for C-110
 */
router.get('/c110/status', (req, res) => {
  const status = cameraStreamingService.getStatus();
  res.json(status);
});

/**
 * Start C-110 camera stream on-demand
 */
router.post('/c110/start', async (req, res) => {
  const clientId = req.body?.clientId || req.ip || 'viewer';
  try {
    const status = await cameraStreamingService.startStream(clientId);
    res.json(status);
  } catch (err) {
    res.status(500).json({
      success: false,
      state: 'error',
      isLive: false,
      error: err.message || 'Failed to start camera stream',
    });
  }
});

/**
 * Heartbeat to keep stream active while viewer is watching
 */
router.post('/c110/heartbeat', (req, res) => {
  const clientId = req.body?.clientId || req.ip || 'viewer';
  const status = cameraStreamingService.heartbeat(clientId);
  res.json(status);
});

/**
 * Stop C-110 camera stream or unregister viewer
 */
router.post('/c110/stop', (req, res) => {
  const clientId = req.body?.clientId || req.ip;
  const force = req.body?.force === true;

  if (force) {
    const status = cameraStreamingService.stopStream('explicit_force_stop');
    return res.json(status);
  }

  const status = cameraStreamingService.removeViewer(clientId);
  res.json(status);
});

/**
 * Serve HLS Playlist Manifest (.m3u8)
 */
router.get('/c110/stream.m3u8', (req, res) => {
  const manifestPath = path.join(cameraStreamingService.getStreamDirectory(), 'stream.m3u8');

  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({
      success: false,
      error: 'Live stream manifest not ready. Stream may be initializing or stopped.',
    });
  }

  res.set({
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
    'Access-Control-Allow-Origin': '*',
  });

  const stream = fs.createReadStream(manifestPath);
  stream.pipe(res);
});

/**
 * Serve HLS Video Segments (.ts)
 */
router.get('/c110/:segment', (req, res) => {
  const segment = req.params.segment;

  // Sanitize segment filename (only allow alphanumeric + underscores + dashes + .ts)
  if (!/^stream\d+\.ts$/.test(segment)) {
    return res.status(400).json({ success: false, error: 'Invalid segment filename.' });
  }

  const segmentPath = path.join(cameraStreamingService.getStreamDirectory(), segment);

  if (!fs.existsSync(segmentPath)) {
    return res.status(404).json({ success: false, error: 'Segment not found or pruned.' });
  }

  res.set({
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'public, max-age=10',
    'Access-Control-Allow-Origin': '*',
  });

  const stream = fs.createReadStream(segmentPath);
  stream.pipe(res);
});

module.exports = router;
