'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/error-screen';

/**
 * Signed-in area. Split from the root boundary so a failure here keeps the
 * member inside the app — the way out is their document list, not the
 * marketing site.
 */
export default function AppAreaError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[medf] error in the app area', error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title="เปิดหน้านี้ไม่สำเร็จ"
      description="เอกสารและงานที่บันทึกไว้ยังปลอดภัย ลองโหลดหน้านี้ใหม่ หรือกลับไปที่รายการเอกสาร"
      detail={error.digest ? `รหัสอ้างอิง: ${error.digest}` : undefined}
    >
      <button type="button" onClick={reset} className="btn-primary btn-sm">
        ลองใหม่อีกครั้ง
      </button>
      <Link href="/app" className="btn-secondary btn-sm">
        เอกสารของฉัน
      </Link>
    </ErrorScreen>
  );
}
