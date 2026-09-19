# นำ MeDF ขึ้นเว็บ

MeDF ไม่มีเซิร์ฟเวอร์แล้ว — เป็นเว็บสถิตล้วน โฮสต์ที่ไหนก็ได้ที่เสิร์ฟไฟล์ได้
ไม่ต้องมี Node.js บนเครื่องปลายทาง ไม่ต้องมีดิสก์ที่เขียนได้ ไม่ต้องสำรองข้อมูล

> เอกสารเดิมอธิบายการรัน `next start` พร้อมโฟลเดอร์ข้อมูลที่เขียนได้ —
> ชั้นนั้นถูกย้ายไป branch [`archive/server`](https://github.com/SuruchBoss/MeDF/tree/archive/server)
> แล้วตาม [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md) §6

## ปลายทางที่ใช้อยู่

GitHub Pages — deploy อัตโนมัติจาก workflow ใน `.github/workflows/`
เสิร์ฟใต้เส้นทาง `/MeDF` จึงต้องตั้ง `NEXT_PUBLIC_BASE_PATH` ให้ตรง

## สิ่งเดียวที่ต้องระวัง

**ไฟล์ของผู้ใช้ต้องไม่ออกจากเบราว์เซอร์** ปลายทางที่เลือกต้องไม่มี edge function
หรือ analytics ที่อ่านเนื้อหาเอกสาร ถ้าวันหนึ่งย้ายไปโฮสต์อื่น เกณฑ์ข้อนี้มาก่อนราคา

## ยังไม่เสร็จ

การยุบ `apps/demo` เข้า `apps/web` และตั้ง static export อยู่ใน
[#8](https://github.com/SuruchBoss/MeDF/issues/8) — จนกว่าจะเสร็จ เว็บที่ deploy ขึ้น Pages
ยังมาจาก `apps/demo`
