# มาตรฐานการเขียนโค้ดของ MeDF

เอกสารนี้คือข้อตกลงร่วมกันสำหรับโค้ดที่เพิ่มเข้ามาหลังจากนี้

กฎแต่ละข้อมีเหตุผลกำกับ เพราะกฎที่ไม่รู้ว่าทำไมมักถูกข้ามในวันที่รีบ
และกฎที่ **ตรวจได้ด้วยเครื่อง** ถูกใส่ไว้ใน lint หรือ CI แล้ว — ไม่ต้องจำ

> เอกสารที่เกี่ยวข้อง: [ARCHITECTURE.md](ARCHITECTURE.md) อธิบาย *ว่าระบบทำงานอย่างไร*
> เอกสารนี้อธิบาย *ว่าจะเขียนโค้ดเพิ่มอย่างไรให้เข้ากัน*

---

## 0. สรุปสั้นที่สุด

```bash
npm run test:unit    # เร็วที่สุด (< 1 วินาที) — ตรรกะบริสุทธิ์
npm run typecheck    # tsc --noEmit
npm run lint         # eslint (กฎด้านล่างส่วนใหญ่อยู่ในนี้)
npm run build        # next build
npm test             # ทั้งหมด: guard + unit + api + ui + demo
```

ก่อน commit อย่างน้อยต้องผ่าน 3 อย่างแรก

---

## 1. ภาษาและไวยากรณ์ที่ใช้ได้

TypeScript แบบ `strict` ทั้งโปรเจกต์ และ **ห้ามไวยากรณ์ TypeScript ที่ Node ลบทิ้งเองไม่ได้**

| ห้าม | ใช้แทน |
| --- | --- |
| `constructor(private readonly x: T)` | ประกาศฟิลด์แล้ว assign ใน constructor |
| `enum Color { ... }` | `const COLORS = [...] as const` + `type Color = (typeof COLORS)[number]` |
| `namespace Foo { ... }` | ES module |

**ทำไม:** unit test เรียกโมดูลใน `src/` ตรง ๆ ด้วย `node --test` โดยไม่มี bundler
ไม่มี transpiler และไม่มี dependency เพิ่ม — Node 22 ลบ type ให้เอง
ไวยากรณ์สามอย่างข้างบนไม่ใช่แค่ type แต่สร้างโค้ดจริงตอนรัน Node จึงลบไม่ได้
ถ้าเผลอใส่เข้าไป โมดูลนั้นจะ unit test ไม่ได้อีกเลยโดยไม่มีอะไรเตือน

✅ **บังคับด้วย ESLint แล้ว** (`no-restricted-syntax`)

---

## 2. ชั้นของโค้ด (layering)

```
src/app/         route, page, API handler   — ใช้ทุกชั้นล่างได้
   ↓
src/components/  UI                          — ใช้ lib ได้ ห้ามใช้ app
   ↓
src/lib/         ตรรกะ, ข้อมูล, PDF          — ห้ามใช้ทั้ง components และ app
```

ทิศทางการพึ่งพามีทางเดียว ห้ามย้อน

**ทำไม:**
- ถ้า `components/` ดึงของจาก `app/` มันจะผูกกับ route นั้นและใช้ซ้ำไม่ได้ —
  ซึ่งจะพังทันที เพราะ [เว็บเดโมแบบสถิต](PUBLIC_DEMO.md) ใช้ editor ทั้งตัวซ้ำโดยไม่มีเซิร์ฟเวอร์
- ถ้า `lib/` ดึง React เข้ามา มันจะ unit test ไม่ได้อีก (ดูข้อ 1)

ต้องการข้อมูลจาก route ใน component → **ส่งเข้ามาทาง props**

✅ **บังคับด้วย ESLint แล้ว** (`no-restricted-imports` แยกตามโฟลเดอร์)

### ขอบเขตระหว่าง apps/web กับ apps/demo

`apps/demo` คอมไพล์ซอร์สของ `apps/web` ผ่าน tsconfig alias `@/*` ตัว build
จึงไม่มีอะไรห้ามให้มันเอื้อมไปแตะไฟล์ไหนก็ได้ — เปลี่ยนชื่อไฟล์ฝั่ง web แล้ว
เว็บสถิตพังเงียบ ๆ จนกว่าจะถึงตอน deploy

- สิ่งที่เดโมใช้ได้ **ประกาศไว้ที่ `apps/web/src/shared/demo-surface.ts` ที่เดียว**
- ไฟล์ในเดโม import ได้เฉพาะ `@/shared/…` (กับ `@/styles/…`) เท่านั้น
- ต้องการของใหม่ → เพิ่มใน `demo-surface.ts` ก่อน แล้วถือว่าของชิ้นนั้นเป็น public API:
  เปลี่ยน props หรือเปลี่ยนชื่อ = แก้สองแอป ไม่ใช่แอปเดียว

✅ **บังคับด้วย unit test แล้ว** (`tests/demo-boundary.test.ts`) และ `npm run typecheck`
ตรวจทั้งสอง workspace

### โมดูลที่ต้องระบุฝั่ง

- ไฟล์ที่แตะดิสก์หรือความลับ ต้องขึ้นต้นด้วย `import 'server-only';`
- component **นำเข้าโมดูลเหล่านั้นได้เฉพาะเป็น `import type`**

  ```tsx
  import type { DocumentRecord } from '@/lib/db';        // ✅ ถูกลบตอน build
  import { type DocumentRecord, mutate } from '@/lib/db'; // ❌ ดึง server-only เข้า client bundle
  ```

  ทั้งสองบรรทัดหน้าตาเกือบเหมือนกัน แต่บรรทัดล่างทำให้ build พัง
  ✅ **บังคับด้วย ESLint แล้ว** (`@typescript-eslint/no-restricted-imports` + `allowTypeImports`)
  — เพิ่มไฟล์ที่มี `server-only` ใหม่ ต้องไปเพิ่มชื่อใน `SERVER_ONLY_MODULES` ด้วย
- `src/lib/pdf/render.ts` ใช้ได้ **ทั้งสองฝั่ง** จึงห้ามเรียก `node:fs` หรือ `fetch` ตรง ๆ
  ให้รับ `FontLoader` เข้ามาทาง argument แทน — เซิร์ฟเวอร์ส่งตัวที่อ่านไฟล์ เบราว์เซอร์ส่งตัวที่ fetch

---

## 3. Discriminated union: ห้าม cast เพื่อให้ผ่าน compiler

`AnyElement` เป็น union ของ element 8 ชนิด `Partial<AnyElement>` จะเหลือแต่ฟิลด์ที่ทุกชนิดมีร่วมกัน
เมื่อก่อนโค้ดจึงเต็มไปด้วย `as Partial<AnyElement>` — 31 จุด และทุกจุดยอมรับทั้งการพิมพ์ผิด
และฟิลด์ที่ยืมมาจาก element ชนิดอื่นโดยไม่มีใครรู้

```tsx
// ❌ ผ่าน compiler แต่ไม่ทำอะไรเลยตอนรัน
dispatch({ type: 'updateOne', id, patch: { fontSiz: 12 } as Partial<AnyElement> });

// ✅ narrow ชนิดก่อน แล้วสร้าง patcher ที่ผูกกับ element นั้น
const patch = createPatcher(element, dispatch);   // element: TextElement
patch({ fontSize: 12 });                          // fontSiz → TS2561
patch({ arrowEnd: true });                        // → TS2353 (เป็นของ LineElement)
```

- แก้ element ชนิดเดียว → `createPatcher(element, dispatch)`
- แก้หลายชิ้นที่คนละชนิดพร้อมกัน → `BaseElementPatch` (เฉพาะฟิลด์ที่ใช้ร่วมกัน)
- cast ที่ยอมให้มีได้มีจุดเดียว: ใน `patchElements()` ของ reducer ตรงที่ประกอบ union กลับคืน
  และมีคอมเมนต์อธิบายไว้แล้ว

**หลักทั่วไป:** `as` คือการปิดปาก compiler ถ้าต้องใช้ ให้เขียนคอมเมนต์ว่า *ทำไมมันถูก*
ถ้าเขียนเหตุผลไม่ได้ แปลว่าออกแบบ type ผิด

---

## 4. การจัดการ state

| เก็บอะไร | เก็บที่ไหน |
| --- | --- |
| เนื้อหาเอกสาร (element, หน้า, undo) | `editorReducer` เท่านั้น |
| สถานะการแสดงผล (zoom, panel เปิด/ปิด, กำลังบันทึก) | `useState` ในคอมโพเนนต์ |
| ค่าที่ event listener แบบ imperative ต้องอ่าน | `useRef` (pattern `liveRef`) |

กฎย่อย:

1. **ห้ามอ่าน `ref.current` ระหว่าง render** — ตอน render แรกมันเป็น `null` เสมอ
   ถ้าต้องใช้ DOM node ใน render ให้เก็บใน state ผ่าน callback ref
   (เคยเป็นบั๊กจริง: page observer ไม่เคยได้ root)
2. **หนึ่ง gesture = หนึ่งขั้น undo** — ตอน pointerdown `dispatch({ type: 'checkpoint' })` ครั้งเดียว
   จากนั้นระหว่างลากทุกครั้งใช้ `history: false`
3. **reducer ต้องบริสุทธิ์** — ห้าม fetch ห้ามแตะ DOM ห้ามอ่านเวลา
   ทั้งหมดนั้นอยู่ใน effect หรือ event handler เพราะ undo/redo เก็บ snapshot ของ overlay

---

## 5. การทดสอบ

สามชั้น เลือกตามสิ่งที่จะทดสอบ:

| โค้ดแบบไหน | เขียนเทสต์ที่ไหน | สั่งด้วย |
| --- | --- | --- |
| ตรรกะบริสุทธิ์ (คณิตศาสตร์, reducer, การแปลงข้อมูล) | `apps/web/tests/*.test.ts` | `npm run test:unit` |
| HTTP, สิทธิ์, โควตา, ฐานข้อมูล | `apps/web/scripts/smoke-test.mjs` | `npm run test:api` |
| ต้องใช้เบราว์เซอร์จริง (ลาก, วาด, เรนเดอร์) | `apps/web/scripts/ui-test.mjs` | `npm run test:ui` |

**ข้อบังคับ:** โมดูลบริสุทธิ์ที่เพิ่มใหม่ใน `src/lib/` ต้องมาพร้อม unit test ใน commit เดียวกัน

เหตุผล: unit test ชุดแรกที่เขียน (116 ข้อ ใช้เวลา 0.6 วินาที) เจอบั๊กจริงทันที 2 ตัว
ที่ end-to-end test 4 ชุดมองไม่เห็นมาตลอด — ข้อความล้นกรอบตอน export
และมุมหมุนที่คืนค่า 360 องศา

### เขียนเทสต์ให้บอกอาการ ไม่ใช่บอกตัวเลข

```ts
// ❌ ถ้าพังจะไม่รู้ว่าอะไรเสีย
assert.equal(snapAngle(-7, true), 0);

// ✅ ชื่อเทสต์และข้อความบอกว่าอะไรคือความถูกต้อง
it('always returns 0-359, never 360', () => {
  // -7° normalises to 353°, which rounds up to 360 — it must come back as 0.
  assert.equal(snapAngle(-7, true), 0);
});
```

เทสต์ที่ดีที่สุดคือเทสต์ที่ยืนยัน **คุณสมบัติ** ไม่ใช่ค่าเฉพาะ เช่น
"ทุกมุมของกล่องหลังหมุนต้องยังอยู่ในหน้ากระดาษ" หรือ
"อัปเกรดแพ็กเกจแล้วต้องไม่มีฟีเจอร์ไหนหายไป"

### สคริปต์ end-to-end

ทุกตัวใช้ `scripts/test-harness.mjs` ร่วมกัน — **ห้ามเขียน `check()`, หา Chromium,
หรือ boot เซิร์ฟเวอร์ขึ้นมาใหม่เอง** และห้ามใช้พอร์ตตายตัว (ใช้ `freePort()`)
เพราะถ้ามีอย่างอื่นจองพอร์ตนั้นอยู่ เทสต์จะไปคุยกับเซิร์ฟเวอร์ผิดตัวโดยไม่แจ้งเตือน

---

## 6. Open core: โค้ดที่เสียเงินห้ามอยู่ใน repo นี้

นี่คือกฎที่ผิดแล้วย้อนไม่ได้ เพราะ git เก็บประวัติไว้ตลอด

- ฟีเจอร์ทุกตัวประกาศใน `src/lib/features.ts` พร้อม `source`:
  - `'core'` — โค้ดอยู่ใน repo นี้ แพ็กเกจแค่คุม *สิทธิ์เข้าถึง*
  - `'private'` — โค้ด **ไม่ได้อยู่ใน repo นี้** โหลดตอนรันจากโมดูลแยก
- *ชื่อ* ฟีเจอร์ที่เสียเงินเป็นสาธารณะได้ (สมาชิกต้องรู้ว่าจ่ายเงินซื้ออะไร) แต่ *โค้ด* ไม่ต้อง
- การตรวจสิทธิ์ต้อง **fail closed** เสมอ — ไม่รู้จัก = ไม่อนุญาต

✅ **บังคับ 3 ชั้น:** `.gitignore` → pre-commit hook (`npm run setup:hooks`) → CI (`npm run guard:private`)

รายละเอียดใน [OPEN_CORE.md](OPEN_CORE.md)

---

## 7. แหล่งความจริงเดียว (single source of truth)

ถ้าข้อมูลชุดเดียวกันถูกเขียนไว้สองที่ วันหนึ่งมันจะไม่ตรงกัน และไม่มีใครรู้

- **ขีดจำกัดของแพ็กเกจ** อยู่ใน `src/lib/plans.ts` ที่เดียว
- ฟีเจอร์ที่จริง ๆ แล้วคือขีดจำกัด ต้อง **คำนวณจาก** ตารางแพ็กเกจ ไม่ใช่เขียนซ้ำ:

```ts
// ❌ เขียนซ้ำ — แก้ limit แล้วลืมแก้ตรงนี้ = ขายของที่ลูกค้ามีอยู่แล้ว
'export.noWatermark': { plan: 'pro', ... }

// ✅ คำนวณจากตารางแพ็กเกจ
'export.noWatermark': { plan: lowestPlanWhere((limits) => !limits.watermark), ... }
```

มี unit test คุมไว้แล้วว่าทั้งสองฝั่งต้องตรงกันในทุกแพ็กเกจ

---

## 8. การเก็บข้อมูล

- ทุกอย่างผ่าน `readDb()` / `mutate()` ใน `src/lib/db.ts` — ห้ามเขียนไฟล์เอง
- `mutate()` เขียนลงดิสก์ให้เสร็จก่อน return **เป็นค่าตั้งต้น**
- `mutate(fn, { durable: false })` ใช้ได้เฉพาะข้อมูลที่ **สร้างใหม่ได้** จากสิ่งที่เขียนลงดิสก์ไปแล้ว
  ตอนนี้มีที่เดียวคือ `saveOverlay()` — ตัว overlay ถูกเขียนเป็นไฟล์ของมันเองก่อนแล้ว
  ที่เหลือคือตัวนับใน document row ซึ่ง autosave แตะทุกไม่กี่วินาที
- บัญชี การชำระเงิน โควตา — **durable เสมอ**

ไฟล์ใหญ่หรือไฟล์ที่เขียนบ่อย (PDF, รูป, overlay) ไม่เก็บใน `db.json` แต่เป็นไฟล์แยกใน `storage/`

### ชั้นของการเก็บไฟล์ — มีประตูเดียว

```
documents.ts          ตรรกะของเอกสาร — ไม่รู้ว่าไฟล์ชื่ออะไร อยู่ bucket ไหน
   ↓
document-files.ts     กติกาการตั้งชื่อไฟล์ของเอกสาร (pdfKey, overlayKey, assetKey)
   ↓
storage.ts            ระบบไฟล์ดิบ — bucket, ตรวจ key, เขียนแบบ atomic
```

- **ห้าม import `storage.ts` จากที่อื่นนอกจาก `document-files.ts` และ `db.ts`**
  ✅ **บังคับด้วย ESLint แล้ว**
- ย้ายไป object storage = แก้ `storage.ts` + `document-files.ts` เท่านั้น
- ย้ายไป Postgres = แก้ `db.ts` เท่านั้น

### state ที่อยู่ในหน่วยความจำ — ต้องรู้ว่าพังตอนไหน

`globalThis` มี singleton ได้ แต่ทุกตัวต้องตอบ 2 คำถามนี้ในคอมเมนต์เหนือมัน

1. **ถ้ามีโปรเซสที่สองจะเกิดอะไรขึ้น** — cache ที่ต่างกันคนละโปรเซส เฉย ๆ หรือข้อมูลหาย
2. **ถ้าคำตอบคือ "ข้อมูลหาย" รูสำหรับเปลี่ยนอยู่ตรงไหน** — interface + setter ไม่ใช่การ import ตรง ๆ

ตัวอย่างที่ทำแล้ว: `src/lib/rate-limit.ts` แยกตัวนับออกจาก `auth.ts` ไว้หลัง `RateLimiter`
โดย `auth.ts` เป็นคนแปลงคำตอบเป็น `AuthError` — ตัวนับไม่รู้จักคำว่าสมาชิกหรือการล็อกอิน
เปลี่ยนไปใช้ Redis = เขียน implementation ใหม่ + เรียก `setLoginRateLimiter()` ตอนบูต ไม่แตะ `auth.ts`

**อ่าน–แก้–เขียน ที่ข้ามโปรเซสได้ ต้องอยู่ใน `withFileLock()`**
และห้ามตัดสินว่าไฟล์เปลี่ยนหรือยังจาก `mtime` — ใช้ digest ของเนื้อไฟล์
(สองการเขียนใน tick เดียวกันมี `mtime` เท่ากันได้) ดู `docs/ARCHITECTURE.md` หัวข้อ
"ขอบเขต: กี่โปรเซส กี่เครื่อง" ว่าตอนนี้รันได้แค่ไหน

---

---

## 9. ข้อผิดพลาดและความปลอดภัย

### ข้อความถึงผู้ใช้ต้องผ่าน dictionary เสมอ

**ห้ามเขียนประโยคที่ผู้ใช้เห็นลงในโค้ดตรง ๆ** ไม่ว่าภาษาไหน

```tsx
<button>{t('editor.save')}</button>   // ✅ component: useT()
const t = await getT();               // ✅ ฝั่งเซิร์ฟเวอร์: อ่าน locale จาก cookie/header
```

- ต้นฉบับคือ `src/lib/i18n/th.ts` (`as const`) — `en.ts` ประกาศเป็น `Record<MessageKey, string>`
  เพิ่ม key ในไทยแล้วลืมภาษาอังกฤษ = **คอมไพล์ไม่ผ่าน** ไม่ใช่ข้อความหายตอนรัน
- ✅ **บังคับด้วย unit test แล้ว** (`tests/i18n.test.ts`) ทั้งความครบของ key
  และการห้ามมีตัวอักษรไทยหลุดอยู่นอก dictionary
- `{name}` คือ placeholder ตัวเดียวที่มี ส่วนตัวเลข วันที่ และเวลาแบบ "3 นาทีที่แล้ว"
  ใช้ `Intl` ผ่าน `src/lib/i18n/format.ts` ไม่ต้องใส่ในพจนานุกรม
- **ข้อความที่เป็น *เอกสาร* ไม่ใช่ *อินเทอร์เฟซ*** (เช่นสัญญาตัวอย่างใน `pdf/sample-document.ts`)
  อยู่ในโมดูลของตัวเอง เพราะแต่ละบรรทัดมีขนาดตัวอักษรและระยะบรรทัดของมันเอง
  ซึ่ง `t()` ที่คืนสตริงเปล่า ๆ แสดงออกมาไม่ได้

### error

1. error ของแต่ละโดเมนใช้คลาสของตัวเอง (`AuthError`, `DocumentError`, `BillingError`, `QuotaError`)
   **ถือ key ไม่ใช่ประโยค** — โค้ดใน `lib/` ไม่รู้ว่าผู้อ่านใช้ภาษาอะไร
   route handler เป็นคนแปลงเป็นข้อความและ HTTP status ที่ `handleRouteError()`
2. **แยกชนิด error ด้วย `instanceof` ห้ามเทียบ `error.name`**

   ```ts
   if (error instanceof AuthError) ...                         // ✅
   if (error instanceof Error && error.name === 'AuthError')   // ❌ production build เปลี่ยนชื่อคลาส
   ```

   เคยเป็นบั๊กจริง และเป็นชนิดที่แย่ที่สุด: ตอน dev ทำงานถูก ตอน production เงียบ —
   ตัวนับการล็อกอินผิดไม่เคยเพิ่มเลยบนเครื่องจริง ซึ่งเป็นที่เดียวที่มันมีความหมาย
   ✅ **บังคับด้วย ESLint แล้ว** (`no-restricted-syntax`)
3. **การค้นหาด้วยคีย์ที่มาจากภายนอกต้องใช้ `Object.hasOwn`** ห้ามใช้ `in` หรือ `obj[key]` เปล่า ๆ

   ```ts
   // ❌ 'toString' หา Object.prototype.toString เจอ → ผ่านด่านตรวจสิทธิ์
   const feature = FEATURES[key];
   if (!feature) return false;

   // ✅
   if (!Object.hasOwn(FEATURES, key)) return false;
   ```

   เคยเป็นบั๊กจริงทั้งสองแบบ: `getPlan('__proto__')` คืน `Object.prototype`
   และ `planAllows(plan, 'toString')` คืน `true`

---

## 10. UI

- **ห้าม `alert()` / `confirm()` / `prompt()`** ใช้ `useDialog()` จาก `@/components/ui/dialog`
  ตัวเนทีฟจัดสไตล์ไม่ได้ แปลไม่ได้ บล็อก main thread และเทสต์เบราว์เซอร์มองไม่เห็น
  ✅ **บังคับด้วย ESLint แล้ว**
- ปุ่มใช้คลาสที่มีอยู่: `btn-primary` `btn-secondary` `btn-ghost` `btn-danger` (+ `btn-sm`)
  ช่องกรอกใช้ `field` — **ห้ามสร้างสไตล์ปุ่มใหม่รายจุด**
- ปุ่มที่มีแต่ไอคอนต้องมี `title` (เทสต์ใช้หาปุ่ม และ screen reader ใช้อ่าน)
- การกระทำที่ย้อนไม่ได้ต้องใช้ `tone: 'danger'` และบอกให้ชัดว่าย้อนไม่ได้
- โค้ดที่ต้องรอ hydration ใช้ `useHydrated()` — ปุ่ม submit ต้อง `disabled` จนกว่าจะ hydrate
  ไม่งั้นฟอร์มจะ submit แบบ native แล้วดูเหมือนแอปไม่ทำงาน (เคยเป็นบั๊กจริง)

---

## 11. ขนาดไฟล์และการแยกไฟล์

ไม่มีเพดานตายตัว แต่ใช้เป็นสัญญาณ:

- **เกิน ~400 บรรทัด** → ถามตัวเองว่าไฟล์นี้ทำหลายเรื่องอยู่หรือเปล่า
- ถ้าใน component มี `switch` ยาว ๆ ตามชนิดข้อมูล → แยกเป็นคอมโพเนนต์ย่อยต่อชนิด
  (`element-properties.tsx` แยกออกมาจาก `properties-panel.tsx` ด้วยเหตุผลนี้
  และได้ type safety แถมมาด้วย เพราะแต่ละตัว narrow ชนิดไว้แล้ว)
- `switch` บน discriminated union ต้องมี exhaustiveness guard:

```ts
default: {
  const exhaustive: never = element;   // เพิ่มชนิดใหม่แล้วลืมแก้ที่นี่ = compile error
  throw new Error(`...: ${JSON.stringify(exhaustive)}`);
}
```

---

## 12. คอมเมนต์

เขียนคอมเมนต์เมื่อโค้ดตอบ **"ทำไม"** เองไม่ได้ ไม่ใช่เขียนซ้ำว่าโค้ดทำอะไร

```ts
// ❌ อ่านโค้ดก็รู้
// เพิ่ม revision ขึ้น 1
target.revision += 1;

// ✅ อธิบายสิ่งที่มองไม่เห็นจากโค้ด
// `% 360` อีกครั้ง เพราะการปัดขึ้นจาก 353° ขึ้นไปจะได้ 360 ซึ่งอยู่นอกช่วง 0-359
// ที่ผู้เรียกทุกคนคาดไว้ (และเกิน max ของ schema ไปหนึ่งก้าว)
if (coarse) return (Math.round(normalized / 15) * 15) % 360;
```

สิ่งที่ **ต้อง** มีคอมเมนต์เสมอ:
- ทุก `as` ที่ยังเหลืออยู่
- workaround ของ library หรือ browser — บอกเวอร์ชันและอาการด้วย
- ตัวเลขที่ตั้งขึ้นมา (throttle 750 ms, history 80 ขั้น, threshold 6 px)

---

## 13. Cookbook

<details>
<summary><b>เพิ่ม element ชนิดใหม่</b></summary>

1. `src/lib/editor-types.ts` — เพิ่ม schema, ใส่ใน `ELEMENT_TYPES` และ `elementSchema`
2. `src/components/editor/factories.ts` — ฟังก์ชันสร้างค่าเริ่มต้น
3. `src/components/editor/element-view.tsx` — การแสดงผลบนหน้าจอ
4. `src/components/editor/element-properties.tsx` — แผงคุณสมบัติ (compiler จะฟ้องถ้าลืม)
5. `src/lib/pdf/render.ts` — การวาดตอน export
6. `apps/web/tests/` — unit test ของ geometry ที่เพิ่มเข้ามา
7. `scripts/ui-test.mjs` — วางแล้ว export แล้วอ่านกลับมาตรวจ
</details>

<details>
<summary><b>เพิ่มแพ็กเกจหรือแก้ขีดจำกัด</b></summary>

1. แก้ที่ `src/lib/plans.ts` **ที่เดียว** (`PLANS`, `PLAN_ORDER`, `PAID_PLANS`)
2. `npm run test:unit` — เทสต์จะฟ้องถ้าลำดับ ราคา หรือขีดจำกัดไม่สอดคล้องกัน
3. ฟีเจอร์ที่ผูกกับขีดจำกัดจะปรับตามเอง (ข้อ 7) ไม่ต้องแก้ `features.ts`
</details>

<details>
<summary><b>เพิ่มฟีเจอร์แบบเสียเงิน</b></summary>

1. ประกาศ *ชื่อ* ใน `src/lib/features.ts` ด้วย `source: 'private'`
2. เขียน implementation ใน repo ส่วนตัว (`npm run pro:scaffold` สร้างโครงให้)
3. **ห้าม** commit implementation เข้ามาที่นี่ — guard จะบล็อกให้ แต่อย่าพึ่งพา guard อย่างเดียว
4. `scripts/smoke-test.mjs` มีโมดูลปลอมสำหรับทดสอบด่านตรวจสิทธิ์อยู่แล้ว
</details>

---

## 14. Commit

- ข้อความ commit บอก **ทำไม** ไม่ใช่แค่ทำอะไร — diff บอก "ทำอะไร" ได้อยู่แล้ว
- แก้บั๊ก → อธิบายอาการที่ผู้ใช้เจอ ไม่ใช่แค่ชื่อฟังก์ชันที่แก้
- หนึ่ง commit หนึ่งเรื่อง ถ้าเขียนสรุปเป็นประโยคเดียวไม่ได้ ให้แยก commit
