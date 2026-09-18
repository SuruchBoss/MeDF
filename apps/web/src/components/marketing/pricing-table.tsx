'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import {
  type BillingInterval,
  type PlanId,
  PLAN_ORDER,
  PLANS,
  formatTHB,
  yearlySavingPercent,
} from '@/lib/plans';

interface PricingTableProps {
  signedIn?: boolean;
  /** Highlights the member's current plan and switches the copy to "billing" mode. */
  currentPlan?: PlanId;
  /** Present on the billing screen; absent on marketing pages. */
  onChoose?: (plan: PlanId, interval: BillingInterval) => void;
  busyPlan?: PlanId | null;
}

export function PricingTable({
  signedIn = false,
  currentPlan,
  onChoose,
  busyPlan = null,
}: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const saving = yearlySavingPercent(PLANS.pro);

  return (
    <div>
      <div className="flex justify-center">
        <div
          className="inline-flex rounded-xl border border-ink-200 bg-white p-1"
          role="group"
          aria-label="รอบการชำระเงิน"
        >
          {(['monthly', 'yearly'] as BillingInterval[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setInterval(option)}
              aria-pressed={interval === option}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                interval === option
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-ink-600 hover:text-ink-900'
              }`}
            >
              {option === 'monthly' ? 'รายเดือน' : `รายปี · ประหยัด ${saving}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const price = plan.price[interval];
          const isCurrent = currentPlan === planId;
          const busy = busyPlan === planId;

          return (
            <div
              key={plan.id}
              className={`card relative flex flex-col p-6 ${
                plan.highlight ? 'ring-2 ring-brand-500' : ''
              }`}
            >
              {plan.highlight ? (
                <span className="badge absolute -top-3 left-6 bg-brand-600 text-white">
                  <Icon name="star" size={12} />
                  แนะนำ
                </span>
              ) : null}
              {isCurrent ? (
                <span className="badge absolute -top-3 right-6 bg-emerald-600 text-white">
                  แพ็กเกจปัจจุบัน
                </span>
              ) : null}

              <h3 className="text-lg font-bold text-ink-900">{plan.name}</h3>
              <p className="mt-1 text-sm text-ink-500">{plan.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight text-ink-900">
                  {price === 0 ? 'ฟรี' : formatTHB(price)}
                </span>
                {price > 0 ? (
                  <span className="text-sm text-ink-400">
                    / {interval === 'monthly' ? 'เดือน' : 'ปี'}
                  </span>
                ) : null}
              </div>
              {price > 0 && interval === 'yearly' ? (
                <p className="mt-1 text-xs text-emerald-600">
                  เท่ากับ {formatTHB(Math.round(price / 12))} ต่อเดือน
                </p>
              ) : null}

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-ink-600">
                    <Icon name="check" size={16} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                {onChoose ? (
                  isCurrent ? (
                    <button type="button" className="btn-secondary w-full" disabled>
                      กำลังใช้แพ็กเกจนี้
                    </button>
                  ) : planId === 'free' ? (
                    <p className="text-center text-xs text-ink-400">
                      ยกเลิกแพ็กเกจแบบชำระเงินเพื่อกลับมาใช้ Free
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary w-full"
                      onClick={() => onChoose(planId, interval)}
                      disabled={busy}
                    >
                      {busy ? <Spinner size={16} /> : null}
                      {currentPlan && currentPlan !== 'free' ? 'เปลี่ยนเป็นแพ็กเกจนี้' : 'สมัครแพ็กเกจนี้'}
                    </button>
                  )
                ) : (
                  <Link
                    href={
                      planId === 'free'
                        ? signedIn
                          ? '/app'
                          : '/register'
                        : signedIn
                          ? `/app/billing?plan=${planId}&interval=${interval}`
                          : `/register?plan=${planId}&interval=${interval}`
                    }
                    className={plan.highlight ? 'btn-primary w-full' : 'btn-secondary w-full'}
                  >
                    {planId === 'free' ? 'เริ่มใช้ฟรี' : `เลือก ${plan.name}`}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink-400">
        ราคารวมภาษีมูลค่าเพิ่มแล้ว · ยกเลิกได้ทุกเมื่อ และใช้งานได้ถึงสิ้นรอบบิลที่จ่ายไว้
      </p>
    </div>
  );
}
