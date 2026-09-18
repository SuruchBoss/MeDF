# นำ MeDF ขึ้นเซิร์ฟเวอร์

## สิ่งที่ต้องมี

- Node.js 20.9 ขึ้นไป
- โฟลเดอร์ที่เขียนได้สำหรับเก็บข้อมูล (ต้องเป็น persistent volume ไม่ใช่ ephemeral filesystem)

MeDF เก็บข้อมูลเป็นไฟล์และรันเป็นโปรเซสเดียว จึงเหมาะกับ VPS, Docker หรือเครื่องในองค์กร
แต่ **ไม่เหมาะกับการรันหลาย instance พร้อมกัน** (serverless แบบ scale out) เพราะ mutex ของชั้นข้อมูล
ทำงานภายในโปรเซสเดียว หากต้องการ scale ออกหลายเครื่อง ให้เปลี่ยน `src/lib/db.ts` ไปใช้ฐานข้อมูลจริง

## ขั้นตอน

```bash
git clone https://github.com/SuruchBoss/MeDF.git
cd MeDF
npm ci
npm run build
```

ตั้งค่าตัวแปรสภาพแวดล้อม แล้วรัน:

```bash
export MEDF_SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))")"
export MEDF_DATA_DIR=/var/lib/medf
export MEDF_APP_URL=https://medf.example.com
export NODE_ENV=production

node apps/web/.next/standalone/apps/web/server.js   # ฟังที่ PORT (ค่าเริ่มต้น 3000)
```

> ต้องรัน `node apps/web/scripts/prepare-standalone.mjs` หลัง build ถ้าจะรันจากบันเดิล standalone
> (คำสั่ง `npm run build` ของ workspace `desktop` ทำให้แล้ว) หรือใช้ `npm run start`
> ซึ่งรันผ่าน `next start` โดยไม่ต้องเตรียมบันเดิล

### ตัวอย่าง systemd

```ini
[Unit]
Description=MeDF
After=network.target

[Service]
Type=simple
User=medf
WorkingDirectory=/opt/medf
Environment=NODE_ENV=production
Environment=PORT=4173
Environment=MEDF_DATA_DIR=/var/lib/medf
Environment=MEDF_APP_URL=https://medf.example.com
EnvironmentFile=/etc/medf.env
ExecStart=/usr/bin/node /opt/medf/apps/web/.next/standalone/apps/web/server.js
Restart=always

[Install]
WantedBy=multi-user.target
```

ให้ reverse proxy (nginx / Caddy) จัดการ TLS และตั้ง `client_max_body_size`
ให้ไม่น้อยกว่าขนาดไฟล์ที่แพ็กเกจสูงสุดอนุญาต (แพ็กเกจ Team = 200 MB)

```nginx
location / {
  proxy_pass http://127.0.0.1:4173;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
  client_max_body_size 220M;
  proxy_read_timeout 300s;   # การ export เอกสารใหญ่ใช้เวลาได้หลายสิบวินาที
}
```

## เปิดการชำระเงินจริงด้วย Stripe

1. สร้าง **product** และ **recurring price** ใน Stripe อย่างละ 4 อัน
   (Pro รายเดือน/รายปี และ Team รายเดือน/รายปี) ให้ตรงกับราคาใน `apps/web/src/lib/plans.ts`
2. ตั้งค่าตัวแปร:

   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_PRO_YEARLY=price_...
   STRIPE_PRICE_TEAM_MONTHLY=price_...
   STRIPE_PRICE_TEAM_YEARLY=price_...
   MEDF_BILLING_SANDBOX=0
   ```

3. เพิ่ม webhook endpoint ไปที่ `https://<your-domain>/api/billing/webhook` และเปิด event เหล่านี้:

   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

เมื่อตั้งค่า `STRIPE_SECRET_KEY` แล้ว โหมดทดลองจะปิดอัตโนมัติและปุ่มสมัครจะพาไปที่ Stripe Checkout จริง
ทดสอบในเครื่องได้ด้วย `stripe listen --forward-to localhost:4173/api/billing/webhook`

## สำรองข้อมูล

ทุกอย่างอยู่ใน `MEDF_DATA_DIR` สำรองด้วยการคัดลอกโฟลเดอร์ทั้งก้อน

```bash
systemctl stop medf        # หรือใช้ snapshot ของ filesystem เพื่อไม่ต้องหยุดบริการ
tar czf medf-$(date +%F).tar.gz -C /var/lib medf
systemctl start medf
```

`db.json` ถูกเขียนแบบ atomic (temp + rename) การคัดลอกระหว่างที่ระบบทำงานจึงได้ไฟล์ที่สมบูรณ์เสมอ
แต่ไฟล์ overlay ที่กำลังถูกบันทึกอยู่พอดีอาจเป็นเวอร์ชันก่อนหน้า

## ตรวจสุขภาพระบบ

`GET /api/health` คืนสถานะเซิร์ฟเวอร์ จำนวนสมาชิก จำนวนเอกสาร และโหมดการชำระเงิน
เหมาะใช้เป็น liveness probe

```json
{ "ok": true, "schemaVersion": 1, "members": 12, "documents": 87, "billing": "stripe" }
```
