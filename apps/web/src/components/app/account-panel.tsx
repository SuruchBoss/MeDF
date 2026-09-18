'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { ApiError, apiFetch } from '@/lib/client/fetcher';
import type { PublicUser } from '@/lib/auth';
import { formatBytes, formatDate } from '@/lib/format';
import { PLANS, formatLimit } from '@/lib/plans';
import type { UsageSummary } from '@/lib/quota';

export function AccountPanel({ user, usage }: { user: PublicUser; usage: UsageSummary }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; message: string } | null>(null);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      await apiFetch('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setNotice({
        tone: 'info',
        message: 'เปลี่ยนรหัสผ่านเรียบร้อย ระบบจะออกจากระบบทุกอุปกรณ์เพื่อความปลอดภัย',
      });
      // The session cookie was invalidated by the password change.
      window.setTimeout(() => {
        router.replace('/login');
        router.refresh();
      }, 1800);
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : 'เปลี่ยนรหัสผ่านไม่สำเร็จ',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="card p-6">
          <h1 className="text-lg font-bold text-ink-900">บัญชีของฉัน</h1>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ['ชื่อที่ใช้แสดง', user.name],
              ['อีเมล', user.email],
              ['สิทธิ์การใช้งาน', user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'สมาชิก'],
              ['สมัครเมื่อ', formatDate(user.createdAt)],
              ['แพ็กเกจ', PLANS[user.plan].name],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-ink-100 pb-2.5">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-ink-900">การใช้งานเดือนนี้</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ['เอกสารที่เก็บไว้', `${usage.documents} / ${formatLimit(usage.maxDocuments)}`],
              [
                'Export แล้ว',
                `${usage.exportsThisMonth} / ${formatLimit(usage.exportsPerMonth)} ครั้ง`,
              ],
              ['พื้นที่ที่ใช้', formatBytes(usage.storageBytes)],
              ['ลายน้ำบนไฟล์', usage.watermark ? 'มี' : 'ไม่มี'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-ink-100 pb-2.5">
                <dt className="text-ink-500">{label}</dt>
                <dd className="text-right font-medium text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="card h-fit p-6">
        <h2 className="text-lg font-bold text-ink-900">เปลี่ยนรหัสผ่าน</h2>
        <p className="mt-1 text-sm text-ink-500">
          เมื่อเปลี่ยนรหัสผ่าน ทุกอุปกรณ์ที่เข้าสู่ระบบอยู่จะถูกออกจากระบบทันที
        </p>

        <form onSubmit={changePassword} className="mt-5 space-y-4">
          <div>
            <label className="label" htmlFor="currentPassword">
              รหัสผ่านปัจจุบัน
            </label>
            <input
              id="currentPassword"
              type="password"
              className="field"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="newPassword">
              รหัสผ่านใหม่
            </label>
            <input
              id="newPassword"
              type="password"
              className="field"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          {notice ? (
            <p
              role="status"
              className={`rounded-xl px-3.5 py-2.5 text-sm ${
                notice.tone === 'error'
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              }`}
            >
              {notice.message}
            </p>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner size={16} /> : <Icon name="shield" size={16} />}
            บันทึกรหัสผ่านใหม่
          </button>
        </form>
      </div>
    </div>
  );
}
