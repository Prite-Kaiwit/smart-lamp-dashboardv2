const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const SensorLog = require('./models/SensorLog');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;
const PUBLIC_URL = process.env.PUBLIC_URL;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// MongoDB Connection
if (MONGODB_URI) {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ Connected to MongoDB Atlas successfully!'))
    .catch((err) => console.warn('⚠️ MongoDB connection warning:', err.message));

  mongoose.connection.on('connected', () => console.log('🟢 MongoDB Atlas connection active.'));
  mongoose.connection.on('disconnected', () => console.log('🔴 MongoDB Atlas disconnected.'));
} else {
  console.warn('⚠️ MONGODB_URI not found in .env');
}

// Current live state synced with ESP32 (No distance in proximity)
let latestState = {
  temperature: null,
  humidity: null,
  peopleDetected: null,
  lightRaw: null,
  lightLevel: null,
  lightStatus: null,
  lampStatus: null,
  mode: null,
  brightness: null,
  source: null,
  updatedAt: new Date()
};

// API: System status and MongoDB connection health check
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    server: 'running',
    mongoConnected: mongoose.connection.readyState === 1,
    mongoDatabase: mongoose.connection.name || 'smart_lamp',
    uptime: process.uptime(),
    latestUpdate: latestState.updatedAt
  });
});

// API: Get latest real sensor state
app.get('/api/sensors/latest', (req, res) => {
  res.json({
    success: true,
    data: latestState
  });
});

// API: Receive Sensor Telemetry (from ESP32 or Web Dashboard) and save to MongoDB Atlas
app.post('/api/sensors/data', async (req, res) => {
  try {
    console.log('DATA FROM ESP32:', req.body);
    const {
      temperature,
      humidity,
      peopleDetected,
      lightRaw,
      lightLevel,
      lightStatus,
      lampStatus,
      mode,
      brightness,
      deviceId
    } = req.body;

    if (temperature !== undefined) latestState.temperature = parseFloat(temperature);
    if (humidity !== undefined) latestState.humidity = parseFloat(humidity);
    if (peopleDetected !== undefined) latestState.peopleDetected = Boolean(peopleDetected);
    if (lightRaw !== undefined) latestState.lightRaw = parseInt(lightRaw, 10);
    if (lightLevel !== undefined) latestState.lightLevel = parseInt(lightLevel, 10);
    if (lightStatus !== undefined) latestState.lightStatus = lightStatus;
    if (lampStatus !== undefined) latestState.lampStatus = lampStatus;
    if (mode !== undefined) latestState.mode = mode;
    if (brightness !== undefined) latestState.brightness = parseInt(brightness, 10);

    latestState.updatedAt = new Date();
    latestState.source = req.body.source || 'Sensor Telemetry';

    // Auto Mode lamp control logic if in AUTO mode
    if (latestState.mode === 'AUTO') {
      const isDark = latestState.lightLevel < 30;
      latestState.lampStatus = (isDark && latestState.peopleDetected) ? 'ON' : 'OFF';
    }

    // Save to MongoDB Atlas if connected
    let savedLog = null;
    if (mongoose.connection.readyState === 1) {
      const log = new SensorLog({
        deviceId: deviceId || 'ESP32-SmartClassRoom',
        temperature: latestState.temperature,
        humidity: latestState.humidity,
        peopleDetected: latestState.peopleDetected,
        lightRaw: latestState.lightRaw,
        lightLevel: latestState.lightLevel,
        lightStatus: latestState.lightStatus,
        lampStatus: latestState.lampStatus,
        mode: latestState.mode,
        brightness: latestState.brightness
      });
      savedLog = await log.save();
    }

    res.json({
      success: true,
      mongoSaved: Boolean(savedLog),
      mongoConnected: mongoose.connection.readyState === 1,
      data: latestState
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API: Update the current mode
app.post('/api/control/mode', async (req, res) => {
  try {
    const { mode } = req.body;

    latestState.mode = mode;
    if (mode === 'FORCE ON') latestState.lampStatus = 'ON';
    if (mode === 'FORCE OFF') latestState.lampStatus = 'OFF';
    latestState.updatedAt = new Date();

    res.json({ success: true, mode: latestState.mode, lampStatus: latestState.lampStatus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Control Lamp Directly
app.post('/api/control/lamp', async (req, res) => {
  try {
    const { status } = req.body;
    latestState.lampStatus = status;
    latestState.mode = status === 'ON' ? 'FORCE ON' : 'FORCE OFF';
    latestState.updatedAt = new Date();

    res.json({ success: true, lampStatus: latestState.lampStatus, mode: latestState.mode });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Historical data from MongoDB Atlas
app.get('/api/sensors/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    if (mongoose.connection.readyState === 1) {
      const logs = await SensorLog.find().sort({ createdAt: -1 }).limit(limit);
      return res.json({
        success: true,
        mongoConnected: true,
        data: logs
      });
    }
    res.json({
      success: true,
      mongoConnected: false,
      data: [latestState]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 LumiTrack IoT Server running${PUBLIC_URL ? ` at ${PUBLIC_URL}` : ` on port ${PORT}`}`);
  console.log('📊 REST API ready at /api/sensors/data');
});
