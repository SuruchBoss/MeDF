'use client';

import { Icon } from '@/components/icons';
import { useDialog } from '@/components/ui/dialog';
import type { StoredDocument } from '@/lib/client/local-store';
import { formatBytes, formatRelative } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n/provider';

/**
 * The work already in this browser.
 *
 * Shown above the drop zone rather than on a page of its own: the question
 * this screen answers is "what am I working on", and the answer is either
 * something from last time or a new file.
 */
export function RecentDocuments({
  documents,
  usage,
  onOpen,
  onDelete,
}: {
  documents: StoredDocument[];
  usage: { usedBytes: number; quotaBytes: number } | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { confirm, element } = useDialog();

  if (documents.length === 0) return null;

  async function remove(document: StoredDocument) {
    const ok = await confirm({
      title: t('store.deleteTitle', { title: document.title }),
      message: t('store.deleteBody'),
      confirmLabel: t('common.delete'),
      tone: 'danger',
    });
    if (ok) onDelete(document.id);
  }

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-bold text-ink-900">{t('store.recentTitle')}</h2>
        {usage ? (
          <span className="text-xs text-ink-500">
            {t('store.usage', { used: formatBytes(usage.usedBytes) })}
          </span>
        ) : null}
      </div>

      <ul className="space-y-2">
        {documents.map((document) => (
          <li key={document.id} className="card flex items-center gap-3 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Icon name="file-text" size={18} />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900">{document.title}</p>
              <p className="mt-0.5 text-xs text-ink-500">
                {t('store.meta', {
                  pages: document.pageCount,
                  size: formatBytes(document.sizeBytes),
                  when: formatRelative(new Date(document.updatedAt).toISOString(), locale),
                })}
              </p>
            </div>

            <button type="button" className="btn-primary btn-sm" onClick={() => onOpen(document.id)}>
              <Icon name="pen" size={15} />
              <span className="hidden sm:inline">{t('store.open')}</span>
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm text-rose-600"
              onClick={() => void remove(document)}
              title={t('common.delete')}
              aria-label={t('common.delete')}
            >
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>

      {/* The one thing a member cannot discover on their own: this is browser
          storage, and "clear browsing data" takes it with everything else. */}
      <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
        <Icon name="shield" size={15} className="mt-0.5 shrink-0" />
        <span>{t('store.clearWarning')}</span>
      </p>

      {element}
    </section>
  );
}
