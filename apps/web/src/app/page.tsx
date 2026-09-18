import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Icon, type IconName } from '@/components/icons';
import { EditorPreview } from '@/components/marketing/editor-preview';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';

export const dynamic = 'force-dynamic';

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'cursor',
    title: 'ลากวางได้อิสระทุกองค์ประกอบ',
    body: 'จับแล้วลากไปวางตรงไหนก็ได้ในหน้า พร้อมเส้นไกด์ช่วยจัดแนวและ snap เข้าขอบหรือกลางหน้าอัตโนมัติ',
  },
  {
    icon: 'grid',
    title: 'ปรับขนาด หมุน จัดเรียงลำดับ',
    body: 'มีจุดจับ 8 ทิศสำหรับย่อ-ขยาย กดหมุนได้อิสระ ล็อกสัดส่วนด้วย Shift และสลับลำดับชั้นหน้า-หลังได้ทันที',
  },
  {
    icon: 'text',
    title: 'กล่องข้อความรองรับภาษาไทย',
    body: 'ฝังฟอนต์ Sarabun ลงไฟล์ PDF จริง ข้อความไทยจึงคมชัดและคัดลอกได้ ไม่กลายเป็นกล่องสี่เหลี่ยม',
  },
  {
    icon: 'pen',
    title: 'เซ็นเอกสารด้วยลายเซ็นจริง',
    body: 'วาดลายเซ็นด้วยเมาส์ ปากกา หรือนิ้วบนจอสัมผัส แล้ววางลงเอกสารเป็นเส้นเวกเตอร์ที่คมทุกระดับซูม',
  },
  {
    icon: 'layers',
    title: 'จัดการหน้าเอกสาร',
    body: 'สลับลำดับหน้า หมุนหน้า หรือซ่อนหน้าที่ไม่ต้องการ ก่อนสั่ง Export เป็นไฟล์ใหม่',
  },
  {
    icon: 'download',
    title: 'Export คืนคุณภาพเดิม',
    body: 'เนื้อหาต้นฉบับถูกคัดลอกแบบเวกเตอร์ ไม่แปลงเป็นรูปภาพ ตัวอักษรเดิมจึงยังคมและค้นหาได้เหมือนเดิม',
  },
];

const STEPS = [
  {
    title: 'อัปโหลดไฟล์ PDF',
    body: 'ลากไฟล์มาวางหรือกดเลือกไฟล์ MeDF จะอ่านขนาดและจำนวนหน้าให้ทันที',
  },
  {
    title: 'ลากวางและตกแต่ง',
    body: 'เพิ่มข้อความ รูปภาพ รูปทรง ไฮไลต์ หรือลายเซ็น ปรับตำแหน่งและขนาดได้ละเอียดระดับจุด (pt)',
  },
  {
    title: 'Export กลับเป็น PDF',
    body: 'กดปุ่มเดียว ได้ไฟล์ PDF ใหม่ที่รวมทุกอย่างเข้าด้วยกัน พร้อมส่งต่อหรือพิมพ์',
  },
];

const FAQ = [
  {
    q: 'MeDF แก้ไขข้อความเดิมในไฟล์ PDF ได้ไหม?',
    a: 'MeDF ทำงานแบบวางองค์ประกอบทับลงบนหน้าเดิม (overlay) ซึ่งเป็นวิธีที่ปลอดภัยที่สุดสำหรับเอกสารสำคัญ เพราะเนื้อหาต้นฉบับไม่ถูกแตะต้อง หากต้องการลบข้อความเดิมออก ให้วางกล่องสี่เหลี่ยมสีขาวทับแล้วพิมพ์ข้อความใหม่ลงไป ซึ่งทำได้ในไม่กี่คลิก',
  },
  {
    q: 'ไฟล์ที่อัปโหลดถูกเก็บไว้ที่ไหน?',
    a: 'ไฟล์ทั้งหมดถูกเก็บไว้ในเซิร์ฟเวอร์ของคุณเอง (หรือในเครื่องของคุณเมื่อใช้เวอร์ชัน Windows) ผูกกับบัญชีสมาชิกและเข้าถึงได้เฉพาะเจ้าของบัญชี ลบเอกสารได้ตลอดเวลาและไฟล์จะถูกลบออกจากพื้นที่จัดเก็บจริง',
  },
  {
    q: 'ภาษาไทยใน PDF ที่ export ออกมาจะเพี้ยนไหม?',
    a: 'ไม่เพี้ยน เพราะ MeDF ฝังฟอนต์ Sarabun (แบบ subset) ลงในไฟล์ PDF จริง และใช้ฟอนต์ไฟล์เดียวกันทั้งในหน้าแก้ไขและตอน export ทำให้การตัดบรรทัดบนจอกับในไฟล์ตรงกัน',
  },
  {
    q: 'ใช้งานแบบออฟไลน์ได้ไหม?',
    a: 'ได้ เวอร์ชันติดตั้งบน Windows จะรันเซิร์ฟเวอร์ไว้ในเครื่องของคุณเอง ทำงานได้โดยไม่ต้องต่ออินเทอร์เน็ต ข้อมูลสมาชิกและเอกสารเก็บอยู่ในโฟลเดอร์ผู้ใช้ของเครื่องนั้น',
  },
  {
    q: 'ยกเลิกแพ็กเกจแล้วเอกสารหายไหม?',
    a: 'ไม่หาย เมื่อยกเลิก คุณยังใช้งานได้จนถึงสิ้นรอบบิลที่ชำระไว้ หลังจากนั้นบัญชีจะกลับไปใช้แพ็กเกจ Free และเอกสารทั้งหมดยังอยู่ครบ เพียงถูกจำกัดโควตาการสร้างและ export ใหม่',
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  const signedIn = Boolean(user);

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={signedIn} />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-ink-200 bg-gradient-to-b from-white via-brand-50/50 to-ink-50">
          <div
            className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-brand-300/25 blur-3xl"
            aria-hidden="true"
          />
          <div className="container-page relative grid gap-12 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
            <div>
              <span className="badge border border-brand-200 bg-white text-brand-700">
                <Icon name="sparkles" size={13} />
                แก้ไข PDF ได้เหมือนโปรแกรมออกแบบ
              </span>
              <h1 className="mt-5 text-4xl leading-[1.15] font-extrabold tracking-tight text-ink-900 sm:text-5xl">
                อัปโหลด PDF แล้ว
                <span className="text-brand-600"> ลากวางได้ทุกอย่าง</span>
                <br />
                จัดเสร็จแล้ว Export กลับทันที
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
                เติมข้อความ แทรกรูปภาพ เซ็นเอกสาร วางตราประทับ หรือไฮไลต์ข้อความในไฟล์ PDF
                ได้โดยตรงบนเบราว์เซอร์ ปรับตำแหน่งและขนาดได้อิสระ แล้วดาวน์โหลดเป็น PDF
                ที่คงคุณภาพต้นฉบับไว้ทั้งหมด
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href={signedIn ? '/app' : '/register'} className="btn-primary px-5 py-3 text-base">
                  {signedIn ? 'เข้าหน้าทำงาน' : 'เริ่มใช้ฟรี ไม่ต้องใส่บัตร'}
                  <Icon name="arrow-right" size={18} />
                </Link>
                <Link href="#desktop" className="btn-secondary px-5 py-3 text-base">
                  <Icon name="monitor" size={18} />
                  ดาวน์โหลดสำหรับ Windows
                </Link>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-5">
                {[
                  { label: 'องค์ประกอบที่วางได้', value: '8 ชนิด' },
                  { label: 'ความละเอียดตำแหน่ง', value: '0.1 pt' },
                  { label: 'คุณภาพหลัง Export', value: 'เวกเตอร์' },
                ].map((item) => (
                  <div key={item.label}>
                    <dt className="text-xs text-ink-500">{item.label}</dt>
                    <dd className="text-lg font-bold text-ink-900">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="lg:pl-4">
              <EditorPreview />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                เครื่องมือครบสำหรับงานเอกสารจริง
              </h2>
              <p className="mt-4 text-ink-600">
                ทุกฟีเจอร์ออกแบบมาเพื่อให้จบงานในหน้าเดียว ไม่ต้องสลับไปมาระหว่างหลายโปรแกรม
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="card p-6 transition hover:shadow-md">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name={feature.icon} size={21} />
                  </span>
                  <h3 className="mt-4 font-bold text-ink-900">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 border-y border-ink-200 bg-white py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                ใช้งานจบใน 3 ขั้นตอน
              </h2>
              <p className="mt-4 text-ink-600">ไม่ต้องติดตั้งปลั๊กอิน ไม่ต้องเรียนรู้ใหม่</p>
            </div>

            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative rounded-2xl bg-ink-50 p-6">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 font-bold text-ink-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Windows desktop */}
        <section id="desktop" className="scroll-mt-20 py-20">
          <div className="container-page grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="badge border border-ink-200 bg-white text-ink-700">
                <Icon name="monitor" size={13} />
                Windows 10 / 11 · 64-bit
              </span>
              <h2 className="mt-5 text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                ติดตั้งลงเครื่องแล้วทำงานแบบออฟไลน์
              </h2>
              <p className="mt-4 leading-relaxed text-ink-600">
                MeDF มีตัวติดตั้งสำหรับ Windows (ไฟล์ <code className="rounded bg-ink-100 px-1.5 py-0.5 text-sm">.exe</code>{' '}
                แบบ NSIS และแบบ portable ที่ไม่ต้องติดตั้ง) ตัวโปรแกรมจะรันเซิร์ฟเวอร์ MeDF
                ไว้ในเครื่องของคุณเอง เอกสารทุกไฟล์อยู่ในโฟลเดอร์ผู้ใช้ ไม่ถูกส่งออกไปที่ใด
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  'ติดตั้งได้โดยไม่ต้องมีสิทธิ์ผู้ดูแลระบบ',
                  'สร้างไอคอนบนเดสก์ท็อปและเมนูเริ่ม พร้อมตัวถอนการติดตั้ง',
                  'เปิดไฟล์ PDF จากเมนูคลิกขวา “เปิดด้วย MeDF”',
                  'ข้อมูลเก็บที่ %APPDATA%\\MeDF สำรองและย้ายเครื่องได้ง่าย',
                ].map((item) => (
                  <li key={item} className="flex gap-2.5 text-sm text-ink-700">
                    <Icon name="check" size={17} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/register" className="btn-primary">
                  สมัครสมาชิกเพื่อรับลิงก์ดาวน์โหลด
                </Link>
                <a
                  href="https://github.com/SuruchBoss/MeDF/releases"
                  className="btn-secondary"
                  target="_blank"
                  rel="noreferrer"
                >
                  ดูรุ่นที่เผยแพร่ทั้งหมด
                </a>
              </div>
              <p className="mt-3 text-xs text-ink-400">
                ผู้ที่ดูแลเซิร์ฟเวอร์เองสามารถสร้างตัวติดตั้งเองได้ด้วยคำสั่ง{' '}
                <code className="rounded bg-ink-100 px-1.5 py-0.5">npm run dist:win</code>
              </p>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-900 px-4 py-2.5 text-ink-100">
                <Icon name="monitor" size={15} />
                <span className="text-xs font-medium">MeDF Setup 1.0.0</span>
              </div>
              <div className="space-y-4 p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <Icon name="download" size={22} />
                  </span>
                  <div>
                    <p className="font-semibold text-ink-900">MeDF-Setup-1.0.0-x64.exe</p>
                    <p className="text-xs text-ink-500">ตัวติดตั้งสำหรับ Windows 64-bit</p>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full w-2/3 rounded-full bg-brand-500" />
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    ['ประเภท', 'NSIS installer'],
                    ['สถาปัตยกรรม', 'x64'],
                    ['ต้องต่อเน็ต', 'ไม่จำเป็น'],
                    ['ที่เก็บข้อมูล', '%APPDATA%\\MeDF'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg bg-ink-50 px-3 py-2">
                      <p className="text-ink-400">{label}</p>
                      <p className="font-semibold text-ink-800">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="scroll-mt-20 border-y border-ink-200 bg-white py-20">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
                เลือกแพ็กเกจที่พอดีกับงานของคุณ
              </h2>
              <p className="mt-4 text-ink-600">
                เริ่มต้นฟรีได้ทันที อัปเกรดเมื่อพร้อม และยกเลิกได้ทุกเมื่อ
              </p>
            </div>
            <div className="mt-10">
              <PricingTable signedIn={signedIn} />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 py-20">
          <div className="container-page max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-ink-900 sm:text-4xl">
              คำถามที่พบบ่อย
            </h2>
            <div className="mt-10 space-y-3">
              {FAQ.map((item) => (
                <details key={item.q} className="card group p-5">
                  <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold text-ink-900">
                    {item.q}
                    <Icon
                      name="chevron-down"
                      size={18}
                      className="shrink-0 text-ink-400 transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="pb-20">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-8 py-14 text-center">
              <div
                className="pointer-events-none absolute -bottom-24 left-1/2 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/30 blur-3xl"
                aria-hidden="true"
              />
              <h2 className="relative text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                พร้อมแก้ไข PDF ไฟล์แรกแล้วหรือยัง?
              </h2>
              <p className="relative mx-auto mt-4 max-w-xl text-ink-300">
                สมัครสมาชิกฟรี ใช้เครื่องมือแก้ไขได้ครบทุกชนิด และ export ได้ทันที
              </p>
              <div className="relative mt-8 flex justify-center gap-3">
                <Link href={signedIn ? '/app' : '/register'} className="btn-primary px-5 py-3 text-base">
                  {signedIn ? 'ไปที่เอกสารของฉัน' : 'สมัครสมาชิกฟรี'}
                </Link>
                <Link
                  href="/pricing"
                  className="btn px-5 py-3 text-base text-white ring-1 ring-white/25 hover:bg-white/10"
                >
                  ดูแพ็กเกจทั้งหมด
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
