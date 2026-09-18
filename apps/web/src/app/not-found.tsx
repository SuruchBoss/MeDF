import Link from 'next/link';
import type { Metadata } from 'next';
import { ErrorScreen } from '@/components/error-screen';

export const metadata: Metadata = { title: 'ไม่พบหน้านี้' };

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="ไม่พบหน้าที่ต้องการ"
      description="ลิงก์อาจเปลี่ยนไปแล้ว หรือเอกสารนี้ถูกลบไปแล้ว ลองกลับไปที่หน้าแรกหรือเปิดรายการเอกสารของคุณ"
    >
      <Link href="/" className="btn-primary btn-sm">
        กลับหน้าแรก
      </Link>
      <Link href="/app" className="btn-secondary btn-sm">
        เอกสารของฉัน
      </Link>
    </ErrorScreen>
  );
}
