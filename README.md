# LumiTrack IoT - Smart Lamp & Ambience Dashboard 💡🌡️

เว็บแดชบอร์ดแสดงผลและควบคุมระบบไฟอัจฉริยะ พร้อมตรวจวัดสภาพแวดล้อม ออกแบบตามข้อมูล Serial Monitor จากฮาร์ดแวร์จริงของคุณ โดยใช้โทนสีอุ่น (Warm Amber & Wood Cozy Tone) ดูสบายตา ทันสมัย และทำงานได้จริงทันที

---

## 📸 ข้อมูลที่ถอดแบบมาจาก Serial Monitor ในรูปภาพของคุณ:
```text
Temperature : 24.2 C
Humidity    : 70.2 %
People      : YES (Distance: 5 cm)
Light Raw   : 3149
Light Level : 21 / 100
Light Status: DARK (มืด)
Lamp Status : ON
Mode        : FORCE ON
```

---

## ✨ ฟีเจอร์เด่นที่เพิ่มเข้ามาเพื่อการใช้งานจริง:

1. **💡 หลอดไฟจำลองเสมือนจริง (Realistic Warm Lamp Visualizer)**:
   - แสดงเอฟเฟกต์แสงไฟเรืองแสงสีวอร์มไวท์ (Warm Amber Glow 2700K) นุ่มนวล
   - คลิกที่หลอดไฟเพื่อสลับ เปิด (ON) / ปิด (OFF) ได้ทันที
   - แถบปรับหรี่ความสว่าง (Dimmer Slider 10% - 100%)
   - สลับโหมดการทำงาน: `FORCE ON` (เปิดตลอด), `AUTO` (อัตโนมัติ), `FORCE OFF` (ปิดตลอด)

2. **📟 Serial Monitor Console ถอดแบบจาก Arduino IDE**:
   - แสดงผลข้อความทีละบรรทัดเหมือนในภาพที่คุณส่งมา 100%
   - มีปุ่มเลื่อนจออัตโนมัติ (Autoscroll), คัดลอกลงคลิปบอร์ด (Copy), ล้างหน้าจอ (Clear), และดาวน์โหลดเป็นไฟล์ `.txt`

3. **📊 กราฟเรียลไทม์ (Chart.js Telemetry Analytics)**:
   - บันทึกและพล็อตกราฟแนวโน้ม อุณหภูมิ, ความชื้น, ระดับแสง, และระยะห่างของคน
   - อัปเดตข้อมูลต่อเนื่องทุก 2 วินาทีอย่างนุ่มนวล

4. **🎛️ แท่นทดสอบและจำลองเซ็นเซอร์สด (Live Sensor Control Bench)**:
   - แถบเลื่อนปรับค่า Temperature, Humidity, Light Raw (ADC), และ Proximity Distance
   - ปรับค่าแล้วเห็นผลลัพธ์บนหน้าจอทันที หรือกดปุ่ม **"คืนค่าตามรูปภาพเป๊ะ"** ได้ตลอดเวลา

5. **🍃 ระบบอัตโนมัติ (AUTO Mode Logic)**:
   - หากสภาพแสงมืด (< 30%) และตรวจพบคนในระยะ (< 150 cm) หลอดไฟจะเปิดทำงานเองอัตโนมัติ

6. **🍃 โทนสีและธีม (Warm Palette)**:
   - โทนอุ่น Dark Warm Stone / Amber Gold สบายตา
   - ปุ่มสลับธีมระหว่าง Warm Dark (ยามค่ำคืน) และ Warm Light Linen (ยามกลางวัน)

7. **🍃 โครงสร้างฐานข้อมูล MongoDB (MongoDB Ready)**:
   - หน้าแสดงข้อมูล Document BSON Schema พร้อมใช้งาน
   - แสดงตารางข้อมูลเรียลไทม์ที่จำลองเหมือนข้อมูลในคอลเลกชัน MongoDB

---

## 🚀 วิธีเปิดใช้งานหน้าเว็บแดชบอร์ดทันที:

คุณสามารถเปิดไฟล์หน้าเว็บได้ทันทีโดยไม่ต้องรันเซิร์ฟเวอร์:
1. เปิดโฟลเดอร์ `C:\Users\kaiwi\smart-lamp-dashboard\public`
2. ดับเบิลคลิกไฟล์ **`index.html`** เพื่อเปิดบน Google Chrome / Microsoft Edge / Brave ได้ทันที!

หรือเปิดผ่านเบราว์เซอร์จากคำสั่ง:
```powershell
Start-Process "C:\Users\kaiwi\smart-lamp-dashboard\public\index.html"
```

---

## 🍃 วิธีเชื่อมต่อ MongoDB & Backend (เมื่อต้องการใช้งานจริง):

ระบบเตรียมไฟล์ Backend มาตรฐาน Node.js + Express + Mongoose ไว้ให้พร้อมแล้ว:

### 1. ติดตั้ง Dependencies:
เปิด Terminal ในโฟลเดอร์ `smart-lamp-dashboard` แล้วพิมพ์:
```bash
npm install
```

### 2. เปิดเซิร์ฟเวอร์ Backend:
```bash
node server.js
```
- เซิร์ฟเวอร์จะรันที่พอร์ต 5000 ในเครื่อง หรือใช้ URL สาธารณะเมื่อ deploy
- เชื่อมต่อกับ MongoDB ผ่านค่า `MONGODB_URI`
- Frontend อ่าน URL ของ Backend จาก `public/config.js`

### 3. โครงสร้างไฟล์ในโปรเจกต์:
- **`public/index.html`** : หน้าเว็บแดชบอร์ดหลัก
- **`public/styles.css`** : การตกแต่งสีโทนอุ่นและเอฟเฟกต์ไฟเรืองแสง
- **`public/app.js`** : ระบบ Logic ทำงานจริง กราฟ คอนโซล และการคำนวณเซ็นเซอร์
- **`public/config.js`** : URL ของ Backend สำหรับหน้าเว็บ
- **`server.js`** : API Backend Express + MongoDB
- **`models/SensorLog.js`** : โมเดลตารางข้อมูล Mongoose Schema
- **`arduino_sample.ino`** : ตัวอย่างโค้ด ESP32 ส่งข้อมูลเซ็นเซอร์เข้า MongoDB

## Production Deployment Checklist

### Render (Backend)

- สร้าง Web Service จาก repository นี้
- ตั้ง Build Command เป็น `npm install`
- ตั้ง Start Command เป็น `npm start`
- เพิ่ม Environment Variable `MONGODB_URI` เป็น MongoDB Atlas connection string
- เพิ่ม `PUBLIC_URL` เป็น URL ของ Render เช่น `https://your-backend.onrender.com`
- ตั้ง MongoDB Atlas Network Access ให้ Render เชื่อมต่อได้
- ทดสอบ `GET https://your-backend.onrender.com/api/sensors/latest`
- ตั้งค่า ESP32 ให้ POST ไปที่ `https://your-backend.onrender.com/api/sensors/data`

### Vercel (Frontend)

- Deploy ไฟล์ static ในโฟลเดอร์ `public/`
- แก้ `BACKEND_URL` ใน `public/config.js` เป็น URL จริงของ Render
- ตรวจว่า `config.js` ถูกโหลดก่อน `app.js`
- เปิดหน้า Vercel แล้วตรวจ Browser Console ว่ามีข้อมูลจาก `/api/sensors/latest`
- ตรวจ CORS และทดสอบว่าค่า `temperature`, `humidity`, `peopleDetected`, `lightRaw`, `lightLevel`, `lampStatus` และ `mode` แสดงจาก API
- ห้าม commit ไฟล์ `.env` หรือค่า credential ลง repository
