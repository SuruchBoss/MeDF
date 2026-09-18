import type { Metadata } from 'next';
import { DemoEditor } from '@/components/demo/demo-editor';

export const metadata: Metadata = {
  title: 'ลองใช้ทันที',
  description:
    'ลองแก้ไข PDF ด้วย MeDF ได้ทันทีในเบราว์เซอร์ ไม่ต้องสมัครสมาชิกและไม่มีการอัปโหลดไฟล์',
};

/** The no-signup editor, available on the product site as well as the demo. */
export default function TryPage() {
  return <DemoEditor />;
}
