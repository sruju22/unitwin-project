const express = require('express');
const router = express.Router();
const aiChatService = require('../services/aiChatService');

/**
 * GET /api/ai/status
 * Check AI service status and configuration
 */
router.get('/status', (req, res) => {
  const hasKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '' && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE');
  res.json({
    success: true,
    service: 'Unitwin AI Operations Assistant',
    geminiConfigured: hasKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
    groundingEngine: 'MongoDB Atlas Live Telemetry Collections',
  });
});

/**
 * POST /api/ai/chat
 * Process user question with MongoDB grounding + Gemini synthesis
 */
router.post('/chat', async (req, res, next) => {
  try {
    const { message, history, pageContext, asOfDate } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message parameter is required and must be a non-empty string.',
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: 'Message exceeds the maximum permitted length of 2000 characters.',
      });
    }

    // Server-side validation and sanitization of reporting reference time
    let sanitizedAsOfDate = undefined;
    if (asOfDate) {
      const parsed = new Date(asOfDate);
      if (!isNaN(parsed.getTime())) {
        sanitizedAsOfDate = parsed.toISOString();
      }
    }

    const sanitizedHistory = Array.isArray(history)
      ? history.slice(-10).map((h) => ({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          text: String(h.text || h.content || '').slice(0, 1500),
        }))
      : [];

    const sanitizedPageContext = typeof pageContext === 'string'
      ? pageContext.slice(0, 50).trim().toLowerCase()
      : 'dashboard';

    const result = await aiChatService.processChatMessage({
      message: message.trim(),
      history: sanitizedHistory,
      pageContext: sanitizedPageContext,
      asOfDate: sanitizedAsOfDate,
    });

    return res.json(result);
  } catch (err) {
    console.error('Error processing AI chat request:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred while processing the campus AI query.',
      details: err.message,
    });
  }
});

// Also support POST / as alias when router is mounted at /api/chat
router.post('/', async (req, res, next) => {
  req.url = '/chat';
  return router.handle(req, res, next);
});

module.exports = router;
