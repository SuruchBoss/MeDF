'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { PricingTable } from '@/components/marketing/pricing-table';
import { useDialog } from '@/components/ui/dialog';
import { ApiError, apiFetch } from '@/lib/client/fetcher';
import type { PublicUser } from '@/lib/auth';
import type { InvoiceRecord } from '@/lib/db';
import type { FeatureAvailability } from '@/lib/features';
import { formatDate, formatDateTime } from '@/lib/format';
import { type BillingInterval, type PlanId, PLANS, formatTHB } from '@/lib/plans';

/**
 * Subscription management. Works against whichever provider the server has
 * configured: real Stripe Checkout, or the built-in sandbox used locally and in
 * the desktop build.
 */

const STATUS_LABEL: Record<string, string> = {
  active: 'ใช้งานอยู่',
  trialing: 'ช่วงทดลองใช้',
  canceled: 'ยกเลิกแล้ว (ใช้ได้ถึงสิ้นรอบบิล)',
  past_due: 'ค้างชำระ',
};

export function BillingPanel({
  user,
  invoices,
  mode,
  preselect,
  features,
}: {
  user: PublicUser;
  invoices: InvoiceRecord[];
  mode: 'stripe' | 'sandbox' | 'disabled';
  preselect: { plan: PlanId; interval: BillingInterval } | null;
  features: FeatureAvailability[];
}) {
  const router = useRouter();
  const dialog = useDialog();
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);
  const [busyAction, setBusyAction] = useState<'cancel' | 'resume' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'info'; message: string } | null>(null);

  const plan = PLANS[user.plan];
  const paid = user.plan !== 'free';

  async function choose(planId: PlanId, interval: BillingInterval) {
    setBusyPlan(planId);
    setNotice(null);
    try {
      const result = await apiFetch<{ provider: 'stripe' | 'sandbox'; url: string }>(
        '/api/billing/checkout',
        { method: 'POST', body: JSON.stringify({ plan: planId, interval }) },
      );

      if (result.provider === 'stripe') {
        window.location.href = result.url;
        return;
      }
      setNotice({
        tone: 'info',
        message: `เปิดใช้แพ็กเกจ ${PLANS[planId].name} เรียบร้อย (โหมดทดลองระบบชำระเงิน)`,
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : 'เริ่มการสมัครไม่สำเร็จ',
      });
    } finally {
      setBusyPlan(null);
    }
  }

  async function runAction(action: 'cancel' | 'resume') {
    if (action === 'cancel') {
      const confirmed = await dialog.confirm({
        title: 'ยกเลิกการสมัครสมาชิกหรือไม่?',
        message:
          'คุณจะยังใช้งานแพ็กเกจปัจจุบันได้จนถึงสิ้นรอบบิลที่ชำระไว้ หลังจากนั้นบัญชีจะกลับไปเป็นแพ็กเกจ Free',
        confirmLabel: 'ยกเลิกการสมัคร',
        cancelLabel: 'ใช้ต่อ',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
    setBusyAction(action);
    setNotice(null);
    try {
      await apiFetch(`/api/billing/${action}`, { method: 'POST' });
      setNotice({
        tone: 'info',
        message:
          action === 'cancel'
            ? 'ยกเลิกเรียบร้อย — ใช้งานได้จนถึงสิ้นรอบบิลปัจจุบัน'
            : 'กลับมาต่ออายุอัตโนมัติเรียบร้อย',
      });
      router.refresh();
    } catch (error) {
      setNotice({
        tone: 'error',
        message: error instanceof ApiError ? error.message : 'ดำเนินการไม่สำเร็จ',
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="container-page space-y-8">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">การสมัครสมาชิก</h1>
        <p className="mt-1 text-sm text-ink-500">
          จัดการแพ็กเกจ ดูประวัติการชำระเงิน และเปลี่ยนแผนได้ทุกเมื่อ
        </p>
      </header>

      {notice ? (
        <div
          role="status"
          className={`flex items-start gap-3 rounded-xl px-4 py-3 text-sm ${
            notice.tone === 'error'
              ? 'border border-rose-200 bg-rose-50 text-rose-700'
              : 'border border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          <Icon name={notice.tone === 'error' ? 'x' : 'check-circle'} size={17} className="mt-0.5" />
          <p className="flex-1">{notice.message}</p>
        </div>
      ) : null}

      {mode === 'sandbox' ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Icon name="shield" size={17} className="mt-0.5 shrink-0" />
          <p>
            ระบบนี้กำลังใช้ <strong>โหมดทดลองระบบชำระเงิน</strong> — เปลี่ยนแพ็กเกจได้ทันทีโดยไม่มีการเรียกเก็บเงินจริง
            ผู้ดูแลระบบเปิดการชำระเงินจริงได้โดยตั้งค่า <code className="rounded bg-amber-100 px-1">STRIPE_SECRET_KEY</code>
          </p>
        </div>
      ) : null}

      {mode === 'disabled' ? (
        <div className="rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
          ระบบชำระเงินยังไม่ได้เปิดใช้งานบนเซิร์ฟเวอร์นี้ กรุณาติดต่อผู้ดูแลระบบเพื่ออัปเกรดแพ็กเกจ
        </div>
      ) : null}

      {/* Current plan */}
      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-ink-500">แพ็กเกจปัจจุบัน</p>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink-900">{plan.name}</h2>
              <span
                className={`badge ${
                  user.planStatus === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : user.planStatus === 'past_due'
                      ? 'bg-rose-50 text-rose-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {STATUS_LABEL[user.planStatus] ?? user.planStatus}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-600">
              {paid
                ? `${formatTHB(plan.price[user.planInterval ?? 'monthly'])} / ${
                    user.planInterval === 'yearly' ? 'ปี' : 'เดือน'
                  }`
                : 'ใช้งานฟรี ไม่มีค่าใช้จ่าย'}
            </p>
            {user.currentPeriodEnd ? (
              <p className="mt-1 text-xs text-ink-500">
                {user.cancelAtPeriodEnd ? 'สิ้นสุดการใช้งาน' : 'ต่ออายุอัตโนมัติ'}{' '}
                {formatDate(user.currentPeriodEnd)}
              </p>
            ) : null}
          </div>

          {paid ? (
            <div className="flex gap-2">
              {user.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void runAction('resume')}
                  disabled={busyAction != null}
                >
                  {busyAction === 'resume' ? <Spinner size={16} /> : <Icon name="rotate" size={16} />}
                  ต่ออายุอีกครั้ง
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => void runAction('cancel')}
                  disabled={busyAction != null}
                >
                  {busyAction === 'cancel' ? <Spinner size={16} /> : null}
                  ยกเลิกการสมัคร
                </button>
              )}
            </div>
          ) : null}
        </div>

        <ul className="mt-5 grid gap-2 border-t border-ink-100 pt-4 sm:grid-cols-2">
          {plan.features.map((feature) => (
            <li key={feature} className="flex gap-2 text-sm text-ink-600">
              <Icon name="check" size={15} className="mt-0.5 shrink-0 text-brand-600" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {preselect && preselect.plan !== user.plan ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">
          <Icon name="star" size={17} />
          <p className="flex-1">
            คุณเลือกแพ็กเกจ <strong>{PLANS[preselect.plan].name}</strong> แบบ
            {preselect.interval === 'yearly' ? 'รายปี' : 'รายเดือน'} —{' '}
            {formatTHB(PLANS[preselect.plan].price[preselect.interval])}
          </p>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={() => void choose(preselect.plan, preselect.interval)}
            disabled={busyPlan != null || mode === 'disabled'}
          >
            {busyPlan === preselect.plan ? <Spinner size={15} /> : null}
            ยืนยันการสมัคร
          </button>
        </div>
      ) : null}

      {/* Plan chooser */}
      <section>
        <h2 className="text-lg font-bold text-ink-900">เปลี่ยนแพ็กเกจ</h2>
        <div className="mt-5">
          <PricingTable
            signedIn
            currentPlan={user.plan}
            onChoose={mode === 'disabled' ? undefined : choose}
            busyPlan={busyPlan}
          />
        </div>
      </section>

      {/* Feature availability */}
      <section>
        <h2 className="text-lg font-bold text-ink-900">ฟีเจอร์ที่ใช้ได้</h2>
        <p className="mt-1 text-sm text-ink-500">
          ฟีเจอร์หลักของ MeDF เป็นโอเพนซอร์สและใช้ได้ทุกแพ็กเกจ · ฟีเจอร์เสริมจะเปิดให้ใช้เมื่อแพ็กเกจถึงและเซิร์ฟเวอร์ติดตั้งโมดูลเสริมไว้
        </p>
        <ul className="card mt-4 divide-y divide-ink-100">
          {features.map((feature) => (
            <li key={feature.key} className="flex items-start gap-3 px-5 py-3.5">
              <Icon
                name={feature.available ? 'check-circle' : 'lock'}
                size={17}
                className={`mt-0.5 shrink-0 ${
                  feature.available ? 'text-emerald-600' : 'text-ink-300'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-900">
                  {feature.label}
                  {feature.source === 'private' ? (
                    <span className="badge bg-brand-50 text-brand-700">ฟีเจอร์เสริม</span>
                  ) : null}
                  {feature.plan !== 'free' ? (
                    <span className="badge bg-ink-100 text-ink-600">{PLANS[feature.plan].name}</span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-ink-500">{feature.description}</p>
              </div>
              <span className="shrink-0 text-xs text-ink-400">
                {feature.available
                  ? 'ใช้ได้'
                  : feature.reason === 'not_installed'
                    ? 'ยังไม่ได้ติดตั้งบนเซิร์ฟเวอร์นี้'
                    : `ต้องใช้แพ็กเกจ ${PLANS[feature.plan].name}`}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Invoices */}
      <section>
        <h2 className="text-lg font-bold text-ink-900">ประวัติการชำระเงิน</h2>
        {invoices.length === 0 ? (
          <div className="card mt-4 p-6 text-sm text-ink-500">ยังไม่มีรายการชำระเงิน</div>
        ) : (
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                  <th className="px-4 py-3 font-semibold">วันที่</th>
                  <th className="px-4 py-3 font-semibold">แพ็กเกจ</th>
                  <th className="px-4 py-3 font-semibold">รอบบิล</th>
                  <th className="px-4 py-3 font-semibold">จำนวน</th>
                  <th className="px-4 py-3 font-semibold">ช่องทาง</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b border-ink-100 last:border-b-0">
                    <td className="px-4 py-3 text-ink-600">{formatDateTime(invoice.createdAt)}</td>
                    <td className="px-4 py-3 font-medium text-ink-900">
                      {PLANS[invoice.plan].name}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {invoice.interval === 'yearly' ? 'รายปี' : 'รายเดือน'}
                    </td>
                    <td className="px-4 py-3 text-ink-900">{formatTHB(invoice.amount)}</td>
                    <td className="px-4 py-3 text-ink-500">
                      {invoice.provider === 'stripe' ? 'Stripe' : 'ทดลองระบบ'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog.element}
    </div>
  );
}
