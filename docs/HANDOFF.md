# Handoff — สถานะงานเพื่อส่งต่อ session ถัดไป

ปรับล่าสุด **2 ตุลาคม 2026** · commit อ้างอิง `f90e484`

เอกสารนี้ตอบคำถามเดียว: **เปิด session ใหม่แล้วทำอะไรต่อ** แผนเต็มอยู่ที่
[PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md) · กฎการเขียนโค้ดอยู่ที่
[CODE_STANDARDS.md](CODE_STANDARDS.md) · โครงสร้างอยู่ที่ [ARCHITECTURE.md](ARCHITECTURE.md)

## 1. สถานะ ณ ตอนนี้

| | |
| --- | --- |
| `main` | `8b61fb4` — ตรงกับ remote ยังไม่มีงาน #24 |
| branch ที่ใช้พัฒนา | `claude/new-session-976uie` — นำ `main` อยู่สอง commit ของ #24 รอ fast-forward |
| ของที่ไม่ได้ commit | ไม่มี |
| เทสต์ | unit 154 · UI 51 · UX 36 combinations · demo 14 — เขียวทั้งหมด พร้อม typecheck / lint / build ทั้ง build ที่ root และใต้ `/MeDF` |
| branch สำรอง | `archive/desktop` และ `archive/server` อยู่บน remote ของที่ลบไปแล้วอยู่ในนั้น |

**ปิดไปแล้วในเฟสนี้** — #5 (ลบ `desktop/`) · #6 (ตัดชั้นเซิร์ฟเวอร์) · #7 (รื้อ open-core
machinery และยุบแพ็กเกจเหลือสอง) · #8 (ยุบ `apps/demo` เป็น static export) · #9
(`LocalBackend` บน IndexedDB) และเขียน README ใหม่ทั้งฉบับ

**ยังไม่มีอะไรขึ้นเว็บจริง** — workflow *Deploy to GitHub Pages* ล้มตั้งแต่ run #8 (`c580bf9`)
ถึง run #9 (`8b61fb4`) ที่ขั้น *Verify the exported site really works* สาเหตุยืนยันแล้ว (#24):
harness เสิร์ฟ build `/MeDF` ไว้ที่ root ทำให้ JS ทั้งก้อนใต้ `/MeDF/_next/` 404 หน้าไม่ hydrate
แก้แล้วบน branch พัฒนา (`16acf76`, `f90e484`) — **ยังต้อง fast-forward `main` แล้วดู Pages เขียว
และตรวจเว็บจริงตามข้อ "เสร็จเมื่อ" ของ #24 ก่อนปิดใบ**

## 2. ทำอะไรต่อ — ตามลำดับ

```
#24 → #25 → #10 → #11 → #12 → #13 → #15
```

| ใบ | เรื่อง | หมายเหตุที่สำคัญ |
| --- | --- | --- |
| [#24](https://github.com/SuruchBoss/MeDF/issues/24) | 🔴 Pages deploy ล้ม | แก้แล้วบน branch พัฒนา เหลือ fast-forward `main` → รอ Pages เขียว → เปิดเว็บจริง กดเอกสารตัวอย่าง อัปโหลด PDF ไทย แก้ แล้ว export ดูว่าฟอนต์ไทยไม่หาย |
| [#25](https://github.com/SuruchBoss/MeDF/issues/25) | 🔴 เว็บโฆษณาของที่ไม่มีแล้ว และขัดแย้งกันเอง | ปุ่ม `/login` `/register` `/app` พาไป 404 · FAQ บรรยายเซิร์ฟเวอร์กับเวอร์ชัน Windows ที่ไม่มี · `/pricing` ขายการแก้ข้อความเดิม 1,490 บาท ขณะที่ FAQ บอกว่าทำไม่ได้ · `LICENSE` มีหมายเหตุต่อท้ายทำให้ GitHub อ่านเป็น `NOASSERTION` |
| [#10](https://github.com/SuruchBoss/MeDF/issues/10) | PWA + service worker + ออฟไลน์ | ขึ้นกับ #8 #9 (เสร็จแล้วทั้งคู่) จุดตาย: Sarabun ใช้ทั้งบนจอและฝังใน PDF ที่ export — precache ไม่ครบแล้ว export ออฟไลน์จะได้ไฟล์ฟอนต์หายแบบจับได้ยาก **ticket สั่งให้มีเทสต์ที่ export ตอนออฟไลน์แล้วตรวจว่าฟอนต์ถูกฝังจริง** |
| [#11](https://github.com/SuruchBoss/MeDF/issues/11) | ⭐ ตัวจำแนกชั้นไฟล์ A/B/C/D | PO สั่งไว้ว่า **ห้ามข้าม** — เป็นงานที่สำคัญที่สุดในเฟส 0 และ #12 #13 #14 ขึ้นกับมัน |
| [#12](https://github.com/SuruchBoss/MeDF/issues/12) | หน้าบอกผลการตรวจไฟล์ ก่อนเข้าหน้าแก้ไข | ขึ้นกับ #11 |
| [#13](https://github.com/SuruchBoss/MeDF/issues/13) | สถิติชั้นไฟล์แบบขออนุญาต | ห้ามส่งเนื้อหาเอกสารออกไปแม้ชิ้นเดียว |
| [#15](https://github.com/SuruchBoss/MeDF/issues/15) | ⭐ spike ลบข้อความเดิมออกจาก content stream | PO สั่งไว้ว่า **ห้ามข้าม** — #17–#22 ทั้งแถวขึ้นกับผลของ spike นี้ |

**[#14](https://github.com/SuruchBoss/MeDF/issues/14) และ
[#16](https://github.com/SuruchBoss/MeDF/issues/16) เป็นประตูตัดสินใจ ไม่ใช่งานโค้ด**
อย่าเริ่มเขียนอะไรให้สองใบนี้ — มันคือการไปหาผู้ใช้จริงสิบคนแล้วตัดสินจากตัวเลข

## 3. กับดักที่ต้องรู้ก่อนแตะโค้ด

- **ห้ามคืน guard machinery** — `.gitignore` หลายบรรทัด, pre-commit hook และ
  `npm run guard:private` ถูก **ถอดออกโดยเจตนา** ใน #7 โมดูลที่เก็บเงินคือ dependency
  ที่ไม่ได้เผยแพร่ ไม่ต้องมีพิธีกรรม (ดู [OPEN_CORE.md](OPEN_CORE.md))
- **`EditorBackend` interface และ `DemoBackend` ต้องอยู่** — adapter ตัวที่สาม
  (`LocalBackend`) ต่อบนนั้น และโมดูลแก้ข้อความจะต่อเป็นตัวที่สี่
- **`lib/plans.ts` ใช้ `Object.hasOwn` ไม่ใช่ `in`** ใน `getPlan()` เพราะ
  `'__proto__' in PLANS` เป็น true แล้วจะคืน `Object.prototype` ซึ่งไม่มี `limits`
  มี unit test คุมอยู่ อย่าทำหลุดตอน refactor
- **ห้ามมีข้อความไทยนอก `i18n/th.ts`** — มีเทสต์บังคับ และ `en.ts` เป็น
  `Record<MessageKey, string>` ดังนั้นคีย์ใหม่ที่ไม่มีคำแปลอังกฤษจะ typecheck ไม่ผ่าน
- **`test:ui` กับ `test:ux` ยิงใส่ผลลัพธ์ที่ build แล้ว** — แก้โค้ดแล้วต้อง
  `npm run build` ก่อน ไม่งั้นกำลังเทสต์ของเก่า
- **static export ไม่มี dynamic route** — เอกสารถูกอ้างด้วย `?doc=<id>` ไม่ใช่
  `/editor/[id]` และห้ามอ่าน cookie หรือ header ตอน render
- **base path** — ทุก asset ต้องผ่าน `withBasePath()` ส่วนเทสต์ e2e อ่าน base path จาก
  `out/index.html` เอง (`readBasePath()`) แล้วเสิร์ฟใต้ path นั้น ไม่ต้องตั้ง env ตอนรันเทสต์
  ถ้าเทสต์รอ selector ไม่สำเร็จ ให้ใช้ `watchPage(page).waitFor()` จะได้ log ที่บอก error บนจอ
  และ request ที่ล้ม แทน timeout เปล่าๆ (บทเรียนจาก #24)
- **`error.name === '...'` ถูก ESLint ห้าม** — production build เปลี่ยนชื่อ class
  ให้ใช้ `instanceof`

## 4. วิธีตรวจว่ายังเขียว

```bash
npm ci
npm run test:unit     # 154 tests / 44 suites
npm run typecheck
npm run lint
npm run build         # ต้องรันก่อนสองคำสั่งถัดไป
npm run test:ui       # 51 checks
npm run test:demo     # 14 checks
npm run test:ux       # 36 combinations (--quick) · ฉบับเต็มคือ npm run audit:ux
```

CI รันลำดับเดียวกันนี้ และเก็บ `apps/web/.ux-audit/` ไว้เป็น artifact เมื่อล้ม

## 5. หนี้ที่รู้อยู่ แต่ยังไม่มี ticket

1. **`LocalBackend.hydrate()` แข่งกับ export** — asset ที่เก็บไว้ถูกอ่าน bytes
   แบบ async หลัง constructor และ `exportPdf` ข้าม asset ที่ `bytes.byteLength === 0`
   ดังนั้นถ้ากด export ในเสี้ยววินาทีแรกหลังเปิดเอกสารเก่า รูปอาจหายไปจากไฟล์
   โดยไม่มีคำเตือน ทางแก้คือรอ hydrate ให้จบ หรือรายงานเป็น `skippedAssets`
2. **`estimateUsage()` คืน `quotaBytes` มาแต่ UI โชว์แค่ `usedBytes`** —
   `RecentDocuments` จึงเตือนคนที่ใกล้เต็มโควตาไม่ได้
3. **ยังไม่มีเทสต์ที่กันลิงก์ภายในชี้ไป route ที่ไม่มีอยู่** — #25 สั่งให้เพิ่ม

## 6. ข้อตกลงเรื่อง git

- พัฒนาบน branch ของ session (ล่าสุด `claude/new-session-976uie`) แล้ว fast-forward `main` ตามทีหลัง
- หนึ่ง ticket หนึ่ง commit ที่เขียวด้วยตัวเอง และย้ายของออกไป `archive/*` ก่อนลบทุกครั้ง
- ไม่เปิด pull request เว้นแต่ถูกสั่ง
