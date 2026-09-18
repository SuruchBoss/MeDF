import 'server-only';
import { type UserRecord, currentPeriod, mutate, newId, nowIso, readDb } from './db';
import { getPlan } from './plans';

/**
 * Plan enforcement. Every limit is checked on the server; the client only ever
 * mirrors these numbers for display.
 */

export class QuotaError extends Error {
  constructor(
    message: string,
    readonly hint = 'อัปเกรดแพ็กเกจเพื่อเพิ่มโควตา',
  ) {
    super(message);
    this.name = 'QuotaError';
  }
}

export interface UsageSummary {
  documents: number;
  maxDocuments: number;
  exportsThisMonth: number;
  exportsPerMonth: number;
  maxUploadMb: number;
  maxPages: number;
  watermark: boolean;
  storageBytes: number;
}

export async function getUsageSummary(user: UserRecord): Promise<UsageSummary> {
  const db = await readDb();
  const plan = getPlan(user.plan);
  const period = currentPeriod();
  const documents = db.documents.filter((doc) => doc.userId === user.id);
  const exportsThisMonth = db.usage.filter(
    (event) => event.userId === user.id && event.kind === 'export' && event.period === period,
  ).length;

  return {
    documents: documents.length,
    maxDocuments: plan.limits.maxDocuments,
    exportsThisMonth,
    exportsPerMonth: plan.limits.exportsPerMonth,
    maxUploadMb: plan.limits.maxUploadMb,
    maxPages: plan.limits.maxPages,
    watermark: plan.limits.watermark,
    storageBytes: documents.reduce((total, doc) => total + doc.sizeBytes, 0),
  };
}

export async function assertCanCreateDocument(user: UserRecord, sizeBytes: number): Promise<void> {
  const plan = getPlan(user.plan);
  const db = await readDb();
  const owned = db.documents.filter((doc) => doc.userId === user.id).length;

  if (owned >= plan.limits.maxDocuments) {
    throw new QuotaError(
      `แพ็กเกจ ${plan.name} เก็บเอกสารได้ ${plan.limits.maxDocuments} ไฟล์ (ใช้แล้ว ${owned} ไฟล์)`,
    );
  }
  const maxBytes = plan.limits.maxUploadMb * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    throw new QuotaError(
      `ไฟล์ใหญ่เกินกำหนด แพ็กเกจ ${plan.name} รับไฟล์ไม่เกิน ${plan.limits.maxUploadMb} MB`,
    );
  }
}

export function assertPageCountAllowed(user: UserRecord, pageCount: number): void {
  const plan = getPlan(user.plan);
  if (pageCount > plan.limits.maxPages) {
    throw new QuotaError(
      `เอกสารมี ${pageCount} หน้า แต่แพ็กเกจ ${plan.name} รองรับไม่เกิน ${plan.limits.maxPages} หน้า`,
    );
  }
}

export async function assertCanExport(user: UserRecord): Promise<void> {
  const plan = getPlan(user.plan);
  if (!Number.isFinite(plan.limits.exportsPerMonth)) return;

  const db = await readDb();
  const period = currentPeriod();
  const used = db.usage.filter(
    (event) => event.userId === user.id && event.kind === 'export' && event.period === period,
  ).length;

  if (used >= plan.limits.exportsPerMonth) {
    throw new QuotaError(
      `เดือนนี้ export ครบ ${plan.limits.exportsPerMonth} ครั้งแล้ว โควตาจะรีเซ็ตเดือนหน้า`,
    );
  }
}

export async function recordUsage(
  userId: string,
  kind: 'upload' | 'export',
  documentId: string | null,
): Promise<void> {
  await mutate((db) => {
    db.usage.push({
      id: newId('use'),
      userId,
      kind,
      documentId,
      createdAt: nowIso(),
      period: currentPeriod(),
    });
    // Keep the log bounded — only the current and previous month are needed
    // for quota maths, so trim anything older than ~13 months.
    const cutoff = new Date();
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
    const cutoffPeriod = currentPeriod(cutoff);
    db.usage = db.usage.filter((event) => event.period >= cutoffPeriod);
  });
}
