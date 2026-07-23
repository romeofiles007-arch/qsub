# qsub

โปรแกรมตัดต่อวิดีโอแบบ local-first สำหรับตรวจและตัดช่วงเสียงเงียบ จัดการซับภาษาไทยบน timeline และส่งงานไปทำต่อใน CapCut บน Windows

## ความสามารถหลัก

- วางและเรียงหลายคลิปบน timeline
- วิเคราะห์ waveform และเลือกตัดช่วงเสียงเงียบเฉพาะคลิปหรือหลายคลิป
- ตัดภาพและเสียงพร้อมกัน พร้อม Ripple ให้คลิปชิดกัน
- สร้างและปรับแต่งซับภาษาไทย
- Preview และควบคุม playhead ตาม timeline ที่ตัดแล้ว
- ส่งออกโปรเจกต์ไปทำต่อใน CapCut

## เริ่มใช้งาน

ต้องมี Node.js รุ่นปัจจุบันบน Windows จากนั้นรัน:

```powershell
npm install
npm run dev
```

เปิด `http://127.0.0.1:5173/` ในเบราว์เซอร์

สร้าง production build ด้วย:

```powershell
npm run build
```

## โมเดลและ runtime เสริม

Repository มี Whisper CPU runtime ที่จำเป็นสำหรับตัวแอป แต่ไม่รวมไฟล์โมเดล, CUDA runtime และ Python virtual environment เนื่องจากมีขนาดใหญ่มาก

- วางโมเดล Whisper ใน `%USERPROFILE%\.cache\hyperframes\whisper\models\`
- CUDA runtime เป็นตัวเลือกเสริมที่ `tools\whisper-cuda\Release\`
- Forced alignment เป็นตัวเลือกเสริม ติดตั้งจาก `tools\align\install.sh`

แอปยังรองรับ ElevenLabs โดยผู้ใช้ใส่ API key ในหน้าจอเอง ไม่มี key ถูกเก็บไว้ใน Repository นี้

## พื้นที่ชั่วคราว

ไฟล์ที่อัปโหลดเข้ามาวิเคราะห์ถูกเก็บไว้ที่ `%TEMP%\silence-studio-local` และถือเป็นของชั่วคราวทั้งหมด ระบบจะลบให้เองโดยไม่ต้องสั่ง

- ล้างทั้งโฟลเดอร์ทุกครั้งที่เปิดเซิร์ฟเวอร์ เพราะตาราง job อยู่ใน memory ไฟล์เก่าจึงไม่มีใครอ้างถึงแล้ว
- กวาดซ้ำทุก 5 นาทีระหว่างใช้งาน และอีกครั้งตอนปิดเซิร์ฟเวอร์
- job ที่ไม่ถูกแตะนานเกิน 6 ชั่วโมงถือว่าเลิกใช้แล้ว ไฟล์ต้นฉบับจะถูกลบไปด้วย
- ไฟล์วิดีโอที่ export แล้วจะถูกลบทันทีที่เบราว์เซอร์ดาวน์โหลดเสร็จ
- ถ้าโฟลเดอร์โตเกิน 60 GB หรือดิสก์เหลือน้อยกว่า 25 GB ระบบจะไล่ลบ job เก่าสุดก่อน

ข้อยกเว้นเดียวคือไฟล์ที่ CapCut draft อ้างถึงอยู่ เพราะ draft เก็บ path เต็มไปยังไฟล์ต้นฉบับ ระบบจะ pin ไฟล์เหล่านั้นไว้ 14 วันนับจากวัน export และตอนเปิดเซิร์ฟเวอร์จะสแกน draft ที่มีอยู่เพื่อ pin เพิ่มให้อัตโนมัติ โปรเจกต์ที่ทำไว้ก่อนหน้าจึงไม่กลายเป็น media offline

ปรับค่าได้ผ่าน environment variable: `SILENCE_SCRATCH_DIR` (ย้ายโฟลเดอร์ไปไดรฟ์อื่น), `SILENCE_JOB_TTL_HOURS`, `SILENCE_PIN_TTL_DAYS`, `SILENCE_SWEEP_MINUTES`, `SILENCE_GRACE_MINUTES`, `SILENCE_MAX_GB`, `SILENCE_MIN_FREE_GB`

สั่งกวาดเองได้ที่ `POST /api/storage/sweep` และดูสถานะพื้นที่ได้จาก `GET /api/health`

## หมายเหตุ

การส่งออก CapCut อาศัยโครงสร้าง draft ของ CapCut บน Windows และควรปิด CapCut ก่อนเขียนหรือแทนที่ draft ที่กำลังเปิดอยู่
