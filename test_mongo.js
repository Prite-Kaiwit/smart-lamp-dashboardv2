const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();
const mongoose = require('mongoose');
const SensorLog = require('./models/SensorLog');

const uri = process.env.MONGODB_URI;

console.log('----------------------------------------------------');
console.log('🔄 กำลังทดสอบเชื่อมต่อไปยัง MongoDB Atlas...');
console.log('📍 URI:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'ไม่ได้ระบุ');
console.log('----------------------------------------------------');

if (!uri || uri.includes('<username>') || uri.includes('<password>')) {
  console.log('⚠️ ข้อผิดพลาด: คุณยังไม่ได้ใส่ Username และ Password จริงในไฟล์ .env');
  console.log('💡 วิธีแก้: เปิดไฟล์ .env แล้วแทนที่ <username> และ <password> ด้วยรหัสจริงของคุณ');
  process.exit(1);
}

mongoose.connect(uri)
  .then(async () => {
    console.log('✅ เชื่อมต่อ MongoDB Atlas สำเร็จ 100%!');
    
    // ลองบันทึกข้อมูล 1 ก้อนตามค่าในรูปภาพของคุณ
    console.log('📝 กำลังทดสอบบันทึกข้อมูลตัวอย่าง...');
    const sample = new SensorLog({
      temperature: 24.2,
      humidity: 70.2,
      peopleDetected: true,
      lightRaw: 3149,
      lightLevel: 21,
      lightStatus: 'DARK (มืด)',
      lampStatus: 'ON',
      mode: 'FORCE ON',
      brightness: 100
    });

    const saved = await sample.save();
    console.log('🎉 บันทึกข้อมูลสำเร็จ! ID เอกสาร:', saved._id.toString());
    console.log('📊 ตอนนี้คุณสามารถไปที่หน้าเว็บ MongoDB Atlas -> "นักสำรวจข้อมูล (Browse Collections)" เพื่อดูข้อมูลจริงได้ทันที!');
    
    await mongoose.disconnect();
    console.log('🔌 ปิดการเชื่อมต่อเรียบร้อย');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ ไม่สามารถเชื่อมต่อได้:');
    console.error(err.message);
    console.log('\n💡 คำแนะนำตรวจสอบ:');
    console.log('1. ตรวจสอบว่าได้กด "อนุญาตทุก IP (0.0.0.0/0)" ในแถบ "การเข้าถึงฐานข้อมูลและเครือข่าย" หรือยัง');
    console.log('2. ตรวจสอบว่าชื่อผู้ใช้ (Username) และรหัสผ่าน (Password) ถูกต้องหรือไม่');
    process.exit(1);
  });
