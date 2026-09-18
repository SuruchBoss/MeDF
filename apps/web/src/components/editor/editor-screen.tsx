'use client';

import { useMemo } from 'react';
import type { OverlayDoc } from '@/lib/editor-types';
import type { PlanId } from '@/lib/plans';
import { createServerBackend } from './backend';
import { EditorShell } from './editor-shell';

/**
 * Client wrapper that binds the editor to the MeDF API. Exists so the server
 * component route can stay a server component while the backend adapter (a
 * closure over `fetch`) is created in the browser.
 */
export function EditorScreen({
  documentId,
  title,
  revision,
  overlay,
  plan,
  watermark,
}: {
  documentId: string;
  title: string;
  revision: number;
  overlay: OverlayDoc;
  plan: PlanId;
  watermark: boolean;
}) {
  const backend = useMemo(() => createServerBackend(documentId), [documentId]);

  return (
    <EditorShell
      backend={backend}
      title={title}
      revision={revision}
      overlay={overlay}
      plan={plan}
      watermark={watermark}
    />
  );
}
