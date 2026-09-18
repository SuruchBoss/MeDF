import type { Metadata } from 'next';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { Icon } from '@/components/icons';
import { PricingTable } from '@/components/marketing/pricing-table';
import { SiteFooter } from '@/components/marketing/site-footer';
import { SiteHeader } from '@/components/marketing/site-header';
import { type Plan, PLANS, PLAN_ORDER, formatLimit } from '@/lib/plans';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'แพ็กเกจและราคา',
  description: 'เปรียบเทียบแพ็กเกจ Free, Pro และ Team ของ MeDF พร้อมโควตาการใช้งานแต่ละแบบ',
};

const COMPARISON: { label: string; value: (plan: Plan) => string }[] = [
  { label: 'จำนวนเอกสารที่เก็บได้', value: (plan) => `${formatLimit(plan.limits.maxDocuments)} ไฟล์` },
  { label: 'ขนาดไฟล์ต่อการอัปโหลด', value: (plan) => `${plan.limits.maxUploadMb} MB` },
  { label: 'จำนวนหน้าต่อเอกสาร', value: (plan) => `${formatLimit(plan.limits.maxPages)} หน้า` },
  { label: 'Export ต่อเดือน', value: (plan) => `${formatLimit(plan.limits.exportsPerMonth)} ครั้ง` },
  { label: 'ลายน้ำบนไฟล์ที่ export', value: (plan) => (plan.limits.watermark ? 'มี' : 'ไม่มี') },
  { label: 'รูปภาพคุณภาพสูง', value: (plan) => (plan.limits.highQualityImages ? 'รองรับ' : 'บีบอัด') },
  { label: 'ซัพพอร์ตแบบ priority', value: (plan) => (plan.limits.prioritySupport ? 'มี' : '—') },
];

export default async function PricingPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader signedIn={Boolean(user)} />

      <main className="flex-1">
        <section className="border-b border-ink-200 bg-gradient-to-b from-brand-50/60 to-ink-50 py-16">
          <div className="container-page text-center">
            <h1 className="text-4xl font-extrabold tracking-tight text-ink-900">แพ็กเกจและราคา</h1>
            <p className="mx-auto mt-4 max-w-2xl text-ink-600">
              ทุกแพ็กเกจใช้เครื่องมือแก้ไขได้ครบทุกชนิด ต่างกันที่โควตาการใช้งานและลายน้ำเท่านั้น
            </p>
          </div>
        </section>

        <section className="py-14">
          <div className="container-page">
            <PricingTable signedIn={Boolean(user)} currentPlan={user?.plan} />
          </div>
        </section>

        <section className="border-t border-ink-200 bg-white py-14">
          <div className="container-page">
            <h2 className="text-2xl font-bold text-ink-900">ตารางเปรียบเทียบ</h2>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left">
                    <th className="py-3 pr-4 font-semibold text-ink-500">คุณสมบัติ</th>
                    {PLAN_ORDER.map((planId) => (
                      <th key={planId} className="py-3 pr-4 font-bold text-ink-900">
                        {PLANS[planId].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.label} className="border-b border-ink-100">
                      <td className="py-3 pr-4 text-ink-600">{row.label}</td>
                      {PLAN_ORDER.map((planId) => (
                        <td key={planId} className="py-3 pr-4 font-medium text-ink-900">
                          {row.value(PLANS[planId])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl bg-ink-50 p-6">
              <Icon name="shield" size={22} className="text-brand-600" />
              <p className="flex-1 text-sm text-ink-600">
                ยังไม่แน่ใจ? เริ่มจากแพ็กเกจ Free ได้เลย ไม่ต้องกรอกบัตรเครดิต และอัปเกรดภายหลังได้ทุกเมื่อ
              </p>
              <Link href={user ? '/app' : '/register'} className="btn-primary">
                {user ? 'เข้าหน้าทำงาน' : 'เริ่มใช้ฟรี'}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
