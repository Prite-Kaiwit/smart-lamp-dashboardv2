const mongoose = require('mongoose');

const sensorLogSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    default: 'ESP32-LUMITRACK-01',
    index: true
  },
  temperature: {
    type: Number,
    required: true,
    description: 'Temperature in Celsius (°C)'
  },
  humidity: {
    type: Number,
    required: true,
    description: 'Relative humidity in percent (%)'
  },
  peopleDetected: {
    type: Boolean,
    required: true,
    description: 'Human presence detection status'
  },
  distance: {
    type: Number,
    required: false,
    description: 'Proximity distance (optional / legacy)'
  },
  lightRaw: {
    type: Number,
    required: true,
    description: 'Raw ADC reading from photoresistor/LDR (0-4095)'
  },
  lightLevel: {
    type: Number,
    required: true,
    description: 'Calculated light intensity percentage (0-100%)'
  },
  lightStatus: {
    type: String,
    default: 'DARK (มืด)'
  },
  lampStatus: {
    type: String,
    enum: ['ON', 'OFF'],
    default: 'ON'
  },
  mode: {
    type: String,
    enum: ['FORCE ON', 'AUTO', 'FORCE OFF'],
    default: 'FORCE ON'
  },
  brightness: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SensorLog', sensorLogSchema);
