const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

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
  console.error('FATAL: MONGODB_URI environment variable is not defined in .env');
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log(`Connected to MongoDB Atlas: database "${mongoose.connection.db.databaseName}"`);
  })
  .catch((err) => {
    console.error('MongoDB Atlas connection error:', err.message);
  });

// Root Health Endpoint
app.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';

  res.json({
    status: 'ok',
    service: 'Unitwin Smart Campus Digital Twin API',
    database: dbStatus,
  });
});

// API Routes
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
  console.log(`Unitwin Backend running on port ${PORT}`);
});

module.exports = { app, server };