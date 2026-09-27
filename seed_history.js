const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const SensorLog = require('./models/SensorLog');

const uri = process.env.MONGODB_URI;

async function seedData() {
  try {
    console.log('🔄 กำลังเชื่อมต่อ MongoDB Atlas เพื่อสร้างชุดข้อมูลตัวอย่างสำหรับ MongoDB Charts...');
    await mongoose.connect(uri);
    console.log('✅ เชื่อมต่อสำเร็จ!');

    // สร้างข้อมูลย้อนหลัง 30 จุด ทุกๆ 2-5 นาที
    const records = [];
    const now = Date.now();

    for (let i = 25; i >= 0; i--) {
      const timeOffset = new Date(now - i * 3 * 60 * 1000); // ย้อนหลังทีละ 3 นาที
      const tempJitter = +(24.0 + Math.sin(i / 3) * 1.5 + (Math.random() * 0.4 - 0.2)).toFixed(1);
      const humJitter = +(70.0 + Math.cos(i / 3) * 3.0 + (Math.random() * 0.8 - 0.4)).toFixed(1);
      
      // สลับสภาพแสงและสถานะหลอดไฟตามช่วงเวลา
      const isDark = i % 4 !== 0;
      const lightLvl = isDark ? Math.floor(18 + Math.random() * 10) : Math.floor(65 + Math.random() * 20);
      const lightRaw = Math.floor(4095 - (lightLvl / 100) * 4095);
      const hasPerson = i % 3 === 0 || isDark;
      const lampOn = isDark && hasPerson;
      records.push({
        deviceId: 'ESP32-LUMITRACK-01',
        temperature: tempJitter,
        humidity: humJitter,
        peopleDetected: hasPerson,
        lightRaw: lightRaw,
        lightLevel: lightLvl,
        lightStatus: lightLvl < 30 ? 'DARK (มืด)' : (lightLvl < 70 ? 'NORMAL (ปกติ)' : 'BRIGHT (สว่าง)'),
        lampStatus: lampOn ? 'ON' : 'OFF',
        mode: 'FORCE ON',
        brightness: 100,
        createdAt: timeOffset
      });
    }

    console.log(`📝 กำลังเพิ่มข้อมูล ${records.length} รายการลงใน smart_lamp.sensorlogs...`);
    await SensorLog.insertMany(records);
    console.log('🎉 เพิ่มข้อมูลประวัติเรียบร้อย! ตอนนี้ใน MongoDB Charts จะมีข้อมูลให้วาดกราฟเส้นสวยงามทันที!');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
    process.exit(1);
  }
}

seedData();
