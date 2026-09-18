import type { Metadata } from 'next';
import { DemoEditor } from '@/components/demo/demo-editor';

export const metadata: Metadata = {
  title: 'ลองใช้ทันที',
  description: 'แก้ไข PDF ในเบราว์เซอร์ ไม่ต้องสมัครสมาชิก ไฟล์ไม่ถูกอัปโหลดไปที่ใด',
};

export default function DemoTryPage() {
  return <DemoEditor homeHref="/" />;
}
