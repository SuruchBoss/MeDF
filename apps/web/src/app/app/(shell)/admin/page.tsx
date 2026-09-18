import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { readDb } from '@/lib/db';
import { billingMode } from '@/lib/billing';
import { formatBytes, formatDate } from '@/lib/format';
import { PLANS, formatTHB } from '@/lib/plans';
import { getTranslator } from '@/lib/i18n/server';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslator())('meta.admin') };
}

/** Read-only overview of the members on this installation. */
export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== 'admin') notFound();

  const db = await readDb();
  const revenue = db.invoices
    .filter((invoice) => invoice.status === 'paid')
    .reduce((total, invoice) => total + invoice.amount, 0);
  const storage = db.documents.reduce((total, doc) => total + doc.sizeBytes, 0);

  const members = [...db.users].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="container-page space-y-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">ผู้ดูแลระบบ</h1>
        <p className="mt-1 text-sm text-ink-500">
          ภาพรวมสมาชิกและการใช้งานของเซิร์ฟเวอร์นี้ · ระบบชำระเงิน:{' '}
          {billingMode() === 'stripe' ? 'Stripe' : billingMode() === 'sandbox' ? 'โหมดทดลอง' : 'ปิดใช้งาน'}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ['สมาชิกทั้งหมด', String(members.length)],
          ['สมาชิกแบบชำระเงิน', String(members.filter((member) => member.plan !== 'free').length)],
          ['เอกสารในระบบ', String(db.documents.length)],
          ['รายรับรวม', formatTHB(revenue)],
        ].map(([label, value]) => (
          <div key={label} className="card p-5">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="mt-1 text-xl font-bold text-ink-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
              <th className="px-4 py-3 font-semibold">สมาชิก</th>
              <th className="px-4 py-3 font-semibold">แพ็กเกจ</th>
              <th className="px-4 py-3 font-semibold">สถานะ</th>
              <th className="px-4 py-3 font-semibold">เอกสาร</th>
              <th className="px-4 py-3 font-semibold">สมัครเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const owned = db.documents.filter((doc) => doc.userId === member.id);
              return (
                <tr key={member.id} className="border-b border-ink-100 last:border-b-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink-900">{member.name}</p>
                    <p className="text-xs text-ink-500">{member.email}</p>
                  </td>
                  <td className="px-4 py-3 text-ink-700">{PLANS[member.plan].name}</td>
                  <td className="px-4 py-3 text-ink-600">
                    {member.planStatus}
                    {member.cancelAtPeriodEnd ? ' (จะยกเลิก)' : ''}
                  </td>
                  <td className="px-4 py-3 text-ink-600">
                    {owned.length} ไฟล์ ·{' '}
                    {formatBytes(owned.reduce((total, doc) => total + doc.sizeBytes, 0))}
                  </td>
                  <td className="px-4 py-3 text-ink-500">{formatDate(member.createdAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-400">
        พื้นที่จัดเก็บที่ใช้ทั้งหมด {formatBytes(storage)} · ข้อมูลทั้งหมดอยู่ในโฟลเดอร์ข้อมูลของเซิร์ฟเวอร์นี้
      </p>
    </div>
  );
}
