/**
 * Feature registry — the boundary between the open-source core and the paid
 * add-ons.
 *
 * Every capability in MeDF is declared here exactly once, with two orthogonal
 * properties:
 *
 *   `plan`   — the lowest plan entitled to it.
 *   `source` — where its code lives:
 *                'core'    the implementation is in this repository (open
 *                          source); the plan only gates *access*.
 *                'private' the implementation is NOT in this repository. It
 *                          ships as a separate private module that is loaded
 *                          at runtime; without that module the feature simply
 *                          does not exist.
 *
 * Declaring a feature here is deliberate: the *name* of a paid feature is
 * public (members need to know what they are buying), its *code* need not be.
 */

import { type PlanId, PLAN_ORDER } from './plans';

export type FeatureSource = 'core' | 'private';

export interface FeatureDefinition {
  key: string;
  label: string;
  description: string;
  plan: PlanId;
  source: FeatureSource;
}

export const FEATURES: Record<string, FeatureDefinition> = {
  // --- Core: open source, available to everyone ---------------------------
  'editor.elements': {
    key: 'editor.elements',
    label: 'เครื่องมือแก้ไขทั้งหมด',
    description: 'ข้อความ รูปภาพ รูปทรง เส้น ลายเซ็น ไฮไลต์ และเครื่องหมาย',
    plan: 'free',
    source: 'core',
  },
  'editor.pages': {
    key: 'editor.pages',
    label: 'จัดการหน้าเอกสาร',
    description: 'สลับลำดับ หมุน และซ่อนหน้าก่อน export',
    plan: 'free',
    source: 'core',
  },
  'export.pdf': {
    key: 'export.pdf',
    label: 'Export กลับเป็น PDF',
    description: 'รวม overlay กับหน้าต้นฉบับโดยคงคุณภาพเวกเตอร์',
    plan: 'free',
    source: 'core',
  },

  // --- Core: open source, but gated by plan ------------------------------
  'export.noWatermark': {
    key: 'export.noWatermark',
    label: 'Export โดยไม่มีลายน้ำ',
    description: 'ไฟล์ที่ได้ไม่มีข้อความประชาสัมพันธ์ MeDF',
    plan: 'pro',
    source: 'core',
  },
  'export.unlimited': {
    key: 'export.unlimited',
    label: 'Export ไม่จำกัดจำนวนครั้ง',
    description: 'ไม่มีโควตารายเดือน',
    plan: 'pro',
    source: 'core',
  },

  // --- Paid add-ons: implementation lives outside this repository ---------
  // The keys below are the contract the private module implements. When the
  // module is not installed these features are reported as unavailable, and
  // nothing in this repository reveals how they work.
  'pro.ocr': {
    key: 'pro.ocr',
    label: 'ทำให้ PDF ค้นหาข้อความได้ (OCR)',
    description: 'อ่านข้อความจากเอกสารสแกนแล้วฝังชั้นข้อความที่ค้นหาได้',
    plan: 'pro',
    source: 'private',
  },
  'pro.redact': {
    key: 'pro.redact',
    label: 'ลบข้อมูลถาวร (redaction)',
    description: 'ลบข้อความและรูปภาพออกจากไฟล์จริง ไม่ใช่เพียงวางทับ',
    plan: 'pro',
    source: 'private',
  },
  'pro.templates': {
    key: 'pro.templates',
    label: 'เทมเพลตขององค์กร',
    description: 'บันทึกชุดองค์ประกอบไว้ใช้ซ้ำทั้งทีม',
    plan: 'team',
    source: 'private',
  },
  'pro.batch': {
    key: 'pro.batch',
    label: 'ประมวลผลหลายไฟล์พร้อมกัน',
    description: 'ใช้ชุดการแก้ไขเดียวกันกับเอกสารหลายไฟล์ในครั้งเดียว',
    plan: 'team',
    source: 'private',
  },
};

export type FeatureKey = keyof typeof FEATURES | string;

function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** True when `plan` is at least as high as the feature requires. */
export function planAllows(plan: PlanId, key: FeatureKey): boolean {
  const feature = FEATURES[key];
  if (!feature) return false;
  return planRank(plan) >= planRank(feature.plan);
}

/** Shape returned to the browser so the UI can show or hide entry points. */
export interface FeatureAvailability {
  key: string;
  label: string;
  description: string;
  plan: PlanId;
  source: FeatureSource;
  /** Entitled by plan *and* actually installed on this server. */
  available: boolean;
  /** Present for paid add-ons that this installation does not have. */
  reason?: 'plan' | 'not_installed';
}
