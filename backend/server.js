const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const buildingsRouter = require('./routes/buildings');
const roomsRouter = require('./routes/rooms');
const timetablesRouter = require('./routes/timetables');
const sectionsRouter = require('./routes/sections');
const campusAreasRouter = require('./routes/campusAreas');
const alertsRouter = require('./routes/alerts');
const energyUsageRouter = require('./routes/energyUsage');
const occupancyRouter = require('./routes/occupancy');
const insightsRouter = require('./routes/insights');
const congestionRouter = require('./routes/congestion');
const maintenanceRouter = require('./routes/maintenance');
const solarRouter = require('./routes/solar');
const aiRouter = require('./routes/ai');
const searchRouter = require('./routes/search');
const cameraRouter = require('./routes/camera');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json());

// MongoDB Connection
if (!MONGODB_URI) {
  console.warn('NOTE: MONGODB_URI environment variable is not defined in .env');
  console.warn('AIT Campus Intelligence Backend running in standalone mode (database: disconnected).');
} else {
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log(`Connected to MongoDB Atlas: database "${mongoose.connection.db.databaseName}"`);
    })
    .catch((err) => {
      console.error('MongoDB Atlas connection error:', err.message);
    });
}

// API Routes with standalone support
app.use('/api/buildings', buildingsRouter);
app.use('/api/search', searchRouter);
app.use('/api/camera', cameraRouter);

// Database connectivity guard for database-exclusive /api routes
app.use('/api', (req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      success: false,
      connected: false,
      error: 'Database disconnected. Please configure MONGODB_URI in backend/.env',
    });
  }
  next();
});

// Root Health Endpoint
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  res.json({
    status: 'ok',
    service: 'AIT Campus Intelligence API',
    database: dbStatus,
  });
});
app.use('/api/buildings', buildingsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/timetables', timetablesRouter);
app.use('/api/sections', sectionsRouter);
app.use('/api/campus-areas', campusAreasRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/energy-usage', energyUsageRouter);
app.use('/api/occupancy', occupancyRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/congestion', congestionRouter);
app.use('/api/maintenance', maintenanceRouter);
app.use('/api/maintainence', maintenanceRouter);
app.use('/api/solar-generation', solarRouter);
app.use('/api/solar', solarRouter);
app.use('/api/ai', aiRouter);
app.use('/api/chat', aiRouter);

// 404 Catch-All
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(`API Error [${req.method} ${req.url}]:`, err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// Export app for testability and listen
const server = app.listen(PORT, () => {
  console.log(`AIT Campus Intelligence Backend running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is already in use by another instance, attaching tests to existing server.`);
  } else {
    console.error('Server error:', err.message);
  }
});

module.exports = { app, server };