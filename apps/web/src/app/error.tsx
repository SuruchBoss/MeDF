'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { ErrorScreen } from '@/components/error-screen';

/**
 * Catches a render or data error anywhere under the root layout.
 *
 * `error.message` is deliberately not shown: in a production build Next
 * replaces it with a generic string anyway, and in development the overlay
 * already shows the real one. The digest is shown because it is the id that
 * matches this failure to the server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[medf] unhandled error', error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title="เกิดข้อผิดพลาดที่ไม่คาดคิด"
      description="ระบบขัดข้องชั่วคราว งานที่บันทึกไว้แล้วยังอยู่ครบ ลองใหม่อีกครั้งได้เลย"
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
