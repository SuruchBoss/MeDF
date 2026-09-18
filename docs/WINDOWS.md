# ติดตั้งและสร้างตัวติดตั้งสำหรับ Windows

MeDF เวอร์ชันเดสก์ท็อปคือแอป Electron ที่รันเซิร์ฟเวอร์ MeDF ไว้ในเครื่องของผู้ใช้เอง
ทำงานได้โดยไม่ต้องต่ออินเทอร์เน็ต และไม่ต้องติดตั้ง Node.js

## สำหรับผู้ใช้

1. ดาวน์โหลดไฟล์ `MeDF-Setup-<version>-x64.exe`
2. ดับเบิลคลิกเพื่อติดตั้ง — เป็นการติดตั้งแบบ **per-user** จึงไม่ต้องใช้สิทธิ์ผู้ดูแลระบบ
   และเลือกโฟลเดอร์ติดตั้งเองได้
3. เปิดจากไอคอนบนเดสก์ท็อปหรือเมนูเริ่ม แล้วสมัครสมาชิกในเครื่อง (สมาชิกคนแรกได้สิทธิ์ผู้ดูแลระบบ)

ถ้าไม่ต้องการติดตั้ง ใช้ไฟล์ `MeDF-Portable-<version>-x64.exe` ที่รันได้ทันที

**ความต้องการของระบบ:** Windows 10 หรือ 11 แบบ 64-bit

### ข้อมูลถูกเก็บไว้ที่ไหน

```
%APPDATA%\MeDF\
├── session.key        กุญแจเซ็นเซสชันของเครื่องนี้
└── data\
    ├── db.json        สมาชิก · เมทาดาทาเอกสาร · ใบเสร็จ
    └── storage\       ไฟล์ PDF ต้นฉบับ รูปภาพ และการแก้ไข
```

สำรองข้อมูลด้วยการคัดลอกโฟลเดอร์ `%APPDATA%\MeDF` ทั้งโฟลเดอร์
(เปิดได้เร็ว ๆ จากเมนู **ไฟล์ → เปิดโฟลเดอร์ข้อมูล** ในโปรแกรม)
การถอนการติดตั้งจะไม่ลบโฟลเดอร์นี้

### หมายเหตุเรื่องการชำระเงิน

แอปเดสก์ท็อปทำงานในโหมดทดลองระบบชำระเงิน (`MEDF_BILLING_SANDBOX=1`) เพราะไม่มีเซิร์ฟเวอร์กลาง
ผู้ใช้จึงเปลี่ยนแพ็กเกจในเครื่องได้เอง ถ้าต้องการคิดเงินจริงควรให้ผู้ใช้ใช้งานผ่านเว็บ
หรือแก้ `desktop/src/main.js` ให้ชี้ไปที่เซิร์ฟเวอร์ส่วนกลางแทนการ spawn เซิร์ฟเวอร์ในเครื่อง

---

## สำหรับผู้พัฒนา

### สร้างตัวติดตั้งบน Windows

```powershell
npm install
npm run dist:win            # ได้ NSIS installer ที่ desktop\dist\MeDF-Setup-1.0.0-x64.exe
npm run dist:win:portable   # ได้ไฟล์ portable
```

คำสั่งเหล่านี้จะทำให้ครบทุกขั้นเอง:

1. `make-icon.mjs` สร้างไอคอน (`build/icon.ico` และ `build/icon.png`) จากโค้ด ไม่ต้องมีไฟล์ภาพในรีโป
2. `next build` สร้างเซิร์ฟเวอร์แบบ `standalone`
3. `prepare-standalone.mjs` เติม `public/` และ `.next/static` ให้บันเดิลครบ
   (Next.js ตั้งใจไม่คัดลอกสองส่วนนี้ให้)
4. `bundle-web.mjs` คัดลอกทั้งหมดไปที่ `desktop/resources/app`
5. `electron-builder` แพ็กเป็นตัวติดตั้ง

### สร้างจาก Linux หรือ macOS

electron-builder ต้องใช้ Wine เพื่อประกอบไฟล์ `.exe` วิธีที่สะดวกที่สุดคือใช้ image ของ electron-builder

```bash
docker run --rm -it \
  -v "${PWD}:/project" \
  -v "${PWD##*/}-node-modules:/project/node_modules" \
  electronuserland/builder:wine \
  /bin/bash -c "npm install && npm run dist:win"
```

### สร้างผ่าน GitHub Actions

รีโปนี้มี workflow ชื่อ **Build Windows installer**
(`.github/workflows/build-windows.yml`) ซึ่งรันบน `windows-latest`

- สั่งรันเองได้จากแท็บ Actions (workflow_dispatch)
- หรือ push แท็บ `v*` เพื่อให้สร้างตัวติดตั้งและแนบเข้ากับ GitHub Release อัตโนมัติ

ผลลัพธ์จะถูกอัปโหลดเป็น artifact ชื่อ `medf-windows-installer`

### พัฒนาแอปเดสก์ท็อป

```bash
npm run desktop:dev     # เปิด next dev แล้วเปิดหน้าต่าง Electron ชี้มาที่เซิร์ฟเวอร์ dev
```

ตรวจว่าเชลล์ทำงานได้โดยไม่ต้องมีจอ (ใช้ใน CI):

```bash
npm run desktop:build   # ต้องสร้างบันเดิลก่อน
npm run test:desktop    # เปิดแอปผ่าน xvfb แล้วถ่ายภาพหน้าจอ 4 หน้า
```

### แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุและวิธีแก้ |
| --- | --- |
| `ไม่พบไฟล์เซิร์ฟเวอร์ของแอป` ตอนเปิดโปรแกรม | ยังไม่ได้รัน `npm run desktop:build` ก่อนแพ็ก — บันเดิลใน `desktop/resources/app` ยังไม่มี |
| หน้าต่างว่างเปล่า | เซิร์ฟเวอร์ภายในยังไม่ขึ้น ดู log จากเมนู **มุมมอง → เครื่องมือนักพัฒนา** หรือรัน `npm run test:standalone` เพื่อตรวจบันเดิล |
| ตัวติดตั้งถูก SmartScreen เตือน | ไฟล์ยังไม่ได้เซ็นโค้ด ให้ตั้งค่า `CSC_LINK` และ `CSC_KEY_PASSWORD` ของใบรับรอง Authenticode ก่อนแพ็ก |
| หน้า PDF ไม่แสดงผล | ไฟล์ `public/pdf.worker.min.mjs` หายไปจากบันเดิล — `prepare-standalone.mjs` จะหยุดพร้อมแจ้งเตือนถ้าไฟล์นี้ไม่มี |
