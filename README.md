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

## หมายเหตุ

การส่งออก CapCut อาศัยโครงสร้าง draft ของ CapCut บน Windows และควรปิด CapCut ก่อนเขียนหรือแทนที่ draft ที่กำลังเปิดอยู่
