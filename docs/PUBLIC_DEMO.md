# เว็บเดโมสาธารณะบน GitHub Pages

หน้า Landing และหน้าแก้ไขแบบ “ลองใช้ทันที” ถูกเผยแพร่เป็นไฟล์สถิตบน GitHub Pages
ที่ https://suruchboss.github.io/MeDF/ โดยไม่ต้องมีเซิร์ฟเวอร์

## ทำไมเล่นได้ทั้งที่เป็นไฟล์สถิต

หน้าแก้ไขของ MeDF ทำงานในเบราว์เซอร์อยู่แล้ว (pdf.js เรนเดอร์หน้า, การลากวางเป็น DOM)
ส่วนที่ต้องมีเซิร์ฟเวอร์คือการเก็บไฟล์ ระบบสมาชิก และการ export

เดโมแทนส่วนเหล่านั้นด้วย `DemoBackend` ซึ่ง

- อ่านไฟล์ PDF จากเครื่องผู้ใช้โดยตรง (`URL.createObjectURL`) — **ไม่มีการอัปโหลด**
- เก็บงานไว้ใน state ของหน้าเท่านั้น (รีเฟรชแล้วเริ่มใหม่)
- **export ด้วยโค้ดชุดเดียวกับเซิร์ฟเวอร์** (`lib/pdf/render.ts`) โดยโหลดฟอนต์ผ่าน `fetch`
- บังคับข้อจำกัดของแพ็กเกจ Free (ไม่เกิน 10 MB / 20 หน้า และมีลายน้ำ) เพื่อให้เป็นตัวอย่างที่ตรงจริง

รายละเอียดเชิงสถาปัตยกรรมอยู่ใน [`ARCHITECTURE.md`](ARCHITECTURE.md)

## เปิดใช้ครั้งแรก

workflow ตั้ง `actions/configure-pages` ไว้ด้วย `enablement: true` จึง **เปิด Pages ให้เองได้**
ไม่ต้องเข้าไปตั้งใน Settings ก่อน สิ่งที่ต้องทำคือให้ workflow ได้รันหนึ่งครั้ง

- **วิธีที่ง่ายที่สุด:** merge เข้า `main` — workflow จะรันและ deploy ทันที
- หรือกดรันเองที่ **Actions → Deploy demo to GitHub Pages → Run workflow**
  (ปุ่มนี้จะปรากฏหลังไฟล์ workflow อยู่บน branch หลักแล้ว ซึ่งเป็นข้อกำหนดของ GitHub)

ถ้า organization ปิด Pages ไว้ หรือ token ไม่มีสิทธิ์ `pages: write`
ให้เปิดด้วยมือที่ **Settings → Pages → Build and deployment → Source = GitHub Actions**
แล้วรัน workflow อีกครั้ง

workflow อยู่ที่ [`.github/workflows/pages.yml`](../.github/workflows/pages.yml) และจะ

- ติดตั้ง dependency, อ่านค่า `base_path` จาก `actions/configure-pages`
- build `apps/demo` เป็นไฟล์สถิต
- **ทดสอบไฟล์ที่ได้ด้วยเบราว์เซอร์จริง** (`npm run test:static`) ก่อน deploy
  จึงไม่มีทาง deploy เว็บที่กดแล้วไม่ทำงาน
- อัปโหลดและ deploy ไปที่ Pages

## รันเว็บเดโมในเครื่อง

```bash
npm run demo:dev      # http://localhost:4183 (ไม่มี basePath)
```

สร้างและทดสอบแบบเดียวกับที่ Pages เสิร์ฟ:

```bash
npm run demo:build    # ได้ไฟล์ที่ apps/demo/out
npm run test:static   # วางไว้ใต้ /MeDF/ แล้วขับด้วยเบราว์เซอร์จริง
```

## โฮสต์ที่โดเมนของตัวเอง

ตั้ง `NEXT_PUBLIC_BASE_PATH=""` แล้ว build ใหม่ (workflow อ่านค่านี้จาก Pages ให้อัตโนมัติแล้ว
เมื่อใช้ custom domain)

```bash
NEXT_PUBLIC_BASE_PATH="" npm run demo:build
```

## ข้อจำกัดของเดโม

| | เดโม (สถิต) | ตัวเต็ม |
| --- | --- | --- |
| สมัครสมาชิก / เข้าสู่ระบบ | ไม่มี | มี |
| เก็บเอกสารไว้ใช้ต่อ | ไม่ได้ (รีเฟรชแล้วหาย) | ได้ |
| แพ็กเกจ / ชำระเงิน | ดูราคาได้ แต่สมัครไม่ได้ | Stripe หรือโหมดทดลอง |
| ลายน้ำตอน export | มี (เท่าแพ็กเกจ Free) | ไม่มีเมื่อใช้แพ็กเกจที่ชำระเงิน |
| เครื่องมือแก้ไข | ครบทุกชนิด | ครบทุกชนิด |
