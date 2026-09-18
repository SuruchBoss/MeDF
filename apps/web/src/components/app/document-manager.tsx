'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { Icon, Spinner } from '@/components/icons';
import { useDialog } from '@/components/ui/dialog';
import { ApiError, apiFetch, uploadWithProgress } from '@/lib/client/fetcher';
import type { DocumentRecord } from '@/lib/db';
import { formatBytes, formatRelative } from '@/lib/format';
import { formatCount } from '@/lib/i18n/format';
import { useLocale, useT } from '@/lib/i18n/provider';
import { type PlanId, PLANS } from '@/lib/plans';
import type { UsageSummary } from '@/lib/quota';

interface DocumentManagerProps {
  initialDocuments: DocumentRecord[];
  initialUsage: UsageSummary;
  plan: PlanId;
}

export function DocumentManager({ initialDocuments, initialUsage, plan }: DocumentManagerProps) {
  const t = useT();
  const locale = useLocale();
  const dialog = useDialog();
  const [documents, setDocuments] = useState(initialDocuments);
  const [usage, setUsage] = useState(initialUsage);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const data = await apiFetch<{ documents: DocumentRecord[]; usage: UsageSummary }>(
      '/api/documents',
    );
    setDocuments(data.documents);
    setUsage(data.usage);
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const pdfs = Array.from(files).filter(
        (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'),
      );
      if (pdfs.length === 0) {
        setError(t('docs.onlyPdf'));
        return;
      }

      setError(null);
      setQuotaHit(false);

      for (const file of pdfs) {
        setProgress(0);
        const form = new FormData();
        form.append('file', file);
        try {
          await uploadWithProgress<{ document: DocumentRecord }>({
            url: '/api/documents',
            form,
            onProgress: setProgress,
          });
        } catch (uploadError) {
          const message =
            uploadError instanceof ApiError ? uploadError.message : t('docs.uploadFailed');
          setError(`${file.name}: ${message}`);
          if (uploadError instanceof ApiError && uploadError.code === 'quota_exceeded') {
            setQuotaHit(true);
          }
          break;
        } finally {
          setProgress(null);
        }
      }

      await refresh();
    },
    [refresh, t],
  );

  async function remove(document: DocumentRecord) {
    const confirmed = await dialog.confirm({
      title: t('docs.deleteConfirm', { title: document.title }),
      message: t('docs.deleteWarning'),
      confirmLabel: t('docs.deleteForever'),
      tone: 'danger',
    });
    if (!confirmed) return;
    setBusyId(document.id);
    try {
      await apiFetch(`/api/documents/${document.id}`, { method: 'DELETE' });
      await refresh();
    } catch (deleteError) {
      setError(deleteError instanceof ApiError ? deleteError.message : t('docs.deleteFailed'));
    } finally {
      setBusyId(null);
    }
  }

  async function duplicate(document: DocumentRecord) {
    setBusyId(document.id);
    try {
      await apiFetch(`/api/documents/${document.id}/duplicate`, { method: 'POST' });
      await refresh();
    } catch (duplicateError) {
      setError(
        duplicateError instanceof ApiError ? duplicateError.message : t('docs.duplicateFailed'),
      );
      if (duplicateError instanceof ApiError && duplicateError.code === 'quota_exceeded') {
        setQuotaHit(true);
      }
    } finally {
      setBusyId(null);
    }
  }

  async function rename(document: DocumentRecord) {
    const title = await dialog.prompt({
      title: t('docs.renameTitle'),
      label: t('docs.renameLabel'),
      defaultValue: document.title,
      confirmLabel: t('docs.renameSave'),
    });
    if (!title || title === document.title) return;
    setBusyId(document.id);
    try {
      await apiFetch(`/api/documents/${document.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      await refresh();
    } catch (renameError) {
      setError(renameError instanceof ApiError ? renameError.message : t('docs.renameFailed'));
    } finally {
      setBusyId(null);
    }
  }

  const documentsFull = usage.documents >= usage.maxDocuments;

  return (
    <div className="container-page space-y-6">
      {/* The page's own heading. Visually the cards below say what this is, so
          it is hidden — but a page with no h1 leaves a screen reader with
          nothing to jump to. */}
      <h1 className="sr-only">{t('docs.heading')}</h1>

      {/* Usage summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <UsageCard
          label={t('docs.stored')}
          value={`${usage.documents} / ${formatCount(usage.maxDocuments, locale) ?? t('common.unlimited')}`}
          hint={t('docs.storageUsed', { size: formatBytes(usage.storageBytes) })}
          ratio={usage.documents / usage.maxDocuments}
        />
        <UsageCard
          label={t('docs.exportsThisMonth')}
          value={`${usage.exportsThisMonth} / ${formatCount(usage.exportsPerMonth, locale) ?? t('common.unlimited')}`}
          hint={usage.watermark ? t('docs.watermarked') : t('docs.noWatermark')}
          ratio={
            Number.isFinite(usage.exportsPerMonth)
              ? usage.exportsThisMonth / usage.exportsPerMonth
              : 0
          }
        />
        <div className="card flex items-center gap-4 p-5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Icon name="star" size={20} />
          </span>
          <div className="flex-1">
            <p className="text-xs text-ink-500">{t('docs.currentPlan')}</p>
            <p className="font-bold text-ink-900">{PLANS[plan].name}</p>
          </div>
          <Link href="/app/billing" className="btn-secondary btn-sm">
            {plan === 'free' ? t('docs.upgrade') : t('docs.manage')}
          </Link>
        </div>
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={`card flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-ink-200'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
            event.target.value = '';
          }}
        />

        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Icon name="upload" size={26} />
        </span>
        <h2 className="mt-4 text-lg font-bold text-ink-900">{t('docs.dropHere')}</h2>
        <p className="mt-1 max-w-md text-sm text-ink-500">
          {t('docs.dropHint', {
            size: usage.maxUploadMb,
            pages: formatCount(usage.maxPages, locale) ?? t('common.unlimited'),
          })}
        </p>

        {progress != null ? (
          <div className="mt-5 w-full max-w-sm">
            <div className="h-2 overflow-hidden rounded-full bg-ink-100">
              <div
                className="h-full rounded-full bg-brand-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-ink-500">
              {t('docs.uploading', { percent: progress })}
            </p>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary mt-5"
            onClick={() => inputRef.current?.click()}
            disabled={documentsFull}
          >
            <Icon name="plus" size={17} />
            {t('docs.pickFile')}
          </button>
        )}

        {documentsFull ? (
          <p className="mt-3 text-xs text-amber-700">
            {t('docs.quotaFull')}{' '}
            <Link href="/app/billing" className="font-semibold underline">
              {t('docs.quotaUpgrade')}
            </Link>
          </p>
        ) : null}
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          <Icon name="x" size={17} className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p>{error}</p>
            {quotaHit ? (
              <Link href="/app/billing" className="mt-1 inline-block font-semibold underline">
                {t('docs.seePlans')}
              </Link>
            ) : null}
          </div>
          <button type="button" onClick={() => setError(null)} aria-label={t('common.close')}>
            <Icon name="x" size={16} />
          </button>
        </div>
      ) : null}

      {/* Document list */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink-900">{t('docs.title')}</h2>
          <button type="button" onClick={() => void refresh()} className="btn-ghost btn-sm">
            <Icon name="rotate" size={15} />
            {t('docs.refresh')}
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="card mt-4 p-10 text-center">
            <p className="text-sm text-ink-500">{t('docs.empty')}</p>
          </div>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {documents.map((document) => (
              <li key={document.id} className="card flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-100 text-ink-500">
                    <Icon name="file-text" size={19} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-semibold text-ink-900" title={document.title}>
                      {document.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {t('docs.summary', {
                        pages: document.pageCount,
                        size: formatBytes(document.sizeBytes),
                        elements: document.elementCount,
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {t('docs.editedAgo', { when: formatRelative(document.updatedAt) })}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link href={`/app/editor/${document.id}`} className="btn-primary btn-sm flex-1">
                    <Icon name="pen" size={14} />
                    {t('docs.open')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void rename(document)}
                    className="btn-secondary btn-sm"
                    title={t('common.rename')}
                    disabled={busyId === document.id}
                  >
                    <Icon name="text" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void duplicate(document)}
                    className="btn-secondary btn-sm"
                    title={t('common.duplicate')}
                    disabled={busyId === document.id}
                  >
                    <Icon name="copy" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(document)}
                    className="btn-secondary btn-sm text-rose-600 hover:bg-rose-50"
                    title={t('common.delete')}
                    disabled={busyId === document.id}
                  >
                    {busyId === document.id ? <Spinner size={14} /> : <Icon name="trash" size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {dialog.element}
    </div>
  );
}

function UsageCard({
  label,
  value,
  hint,
  ratio,
}: {
  label: string;
  value: string;
  hint: string;
  ratio: number;
}) {
  const percent = Math.min(100, Math.max(0, Math.round((Number.isFinite(ratio) ? ratio : 0) * 100)));
  const tone = percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-brand-500';

  return (
    <div className="card p-5">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-ink-900">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-100">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-ink-500">{hint}</p>
    </div>
  );
}
