/**
 * Plan catalogue. Shared by the marketing pages, the billing screens and the
 * server-side quota checks, so pricing only ever lives in one place.
 */

export type PlanId = 'free' | 'pro' | 'team';
export type BillingInterval = 'monthly' | 'yearly';
export type PlanStatus = 'active' | 'trialing' | 'canceled' | 'past_due';

export interface PlanLimits {
  /** Documents a member may keep at once. */
  maxDocuments: number;
  /** Largest PDF upload, in megabytes. */
  maxUploadMb: number;
  /** Largest page count per document. */
  maxPages: number;
  /** Exports allowed per calendar month (`Infinity` for unlimited). */
  exportsPerMonth: number;
  /** Free plan exports carry a small MeDF footer. */
  watermark: boolean;
  /** Export without the original PDF text layer being rasterised. */
  highQualityImages: boolean;
  prioritySupport: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  price: Record<BillingInterval, number>;
  currency: 'THB';
  limits: PlanLimits;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'ทดลองใช้ฟรี ไม่มีกำหนดหมดอายุ',
    price: { monthly: 0, yearly: 0 },
    currency: 'THB',
    limits: {
      maxDocuments: 3,
      maxUploadMb: 10,
      maxPages: 20,
      exportsPerMonth: 10,
      watermark: true,
      highQualityImages: false,
      prioritySupport: false,
    },
    features: [
      'เก็บเอกสารได้ 3 ไฟล์',
      'อัปโหลด PDF ไม่เกิน 10 MB / 20 หน้า',
      'Export 10 ครั้งต่อเดือน (มีลายน้ำ MeDF)',
      'เครื่องมือแก้ไขครบ: ข้อความ รูปภาพ รูปทรง ลายเซ็น',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'สำหรับฟรีแลนซ์และงานเอกสารประจำวัน',
    price: { monthly: 249, yearly: 2490 },
    currency: 'THB',
    limits: {
      maxDocuments: 200,
      maxUploadMb: 50,
      maxPages: 300,
      exportsPerMonth: Number.POSITIVE_INFINITY,
      watermark: false,
      highQualityImages: true,
      prioritySupport: false,
    },
    features: [
      'เก็บเอกสารได้ 200 ไฟล์',
      'อัปโหลด PDF ไม่เกิน 50 MB / 300 หน้า',
      'Export ไม่จำกัด และไม่มีลายน้ำ',
      'รูปภาพคุณภาพสูง + ฝังฟอนต์ไทย',
      'จัดการหน้า: สลับลำดับ หมุน ลบหน้า',
    ],
    highlight: true,
  },
  team: {
    id: 'team',
    name: 'Team',
    tagline: 'สำหรับทีมและองค์กรที่ใช้งานหนัก',
    price: { monthly: 690, yearly: 6900 },
    currency: 'THB',
    limits: {
      maxDocuments: 2000,
      maxUploadMb: 200,
      maxPages: 2000,
      exportsPerMonth: Number.POSITIVE_INFINITY,
      watermark: false,
      highQualityImages: true,
      prioritySupport: true,
    },
    features: [
      'ทุกอย่างในแพ็กเกจ Pro',
      'เก็บเอกสารได้ 2,000 ไฟล์',
      'อัปโหลด PDF ไม่เกิน 200 MB / 2,000 หน้า',
      'พื้นที่เก็บเทมเพลตขององค์กร',
      'ซัพพอร์ตแบบ priority',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'team'];

export const PAID_PLANS: PlanId[] = ['pro', 'team'];

export function getPlan(planId: string | null | undefined): Plan {
  // `Object.hasOwn`, not `in`: `'__proto__' in PLANS` is true and would hand
  // back `Object.prototype`, which has no `limits` and throws at the first read.
  if (planId && Object.hasOwn(PLANS, planId)) return PLANS[planId as PlanId];
  return PLANS.free;
}

export function isPaidPlan(planId: string | null | undefined): boolean {
  return planId === 'pro' || planId === 'team';
}

/** Monthly-equivalent saving when paying yearly, as a percentage. */
export function yearlySavingPercent(plan: Plan): number {
  const monthlyTotal = plan.price.monthly * 12;
  if (monthlyTotal === 0) return 0;
  return Math.round(((monthlyTotal - plan.price.yearly) / monthlyTotal) * 100);
}

export function formatTHB(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatLimit(value: number): string {
  return Number.isFinite(value) ? new Intl.NumberFormat('th-TH').format(value) : 'ไม่จำกัด';
}
