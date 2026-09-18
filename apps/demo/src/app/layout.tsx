import type { Metadata, Viewport } from 'next';
import { FontFaces } from '@/components/font-faces';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MeDF — แก้ไข PDF ด้วยการลากวาง',
    template: '%s · MeDF',
  },
  description:
    'ลองแก้ไข PDF ได้ทันทีในเบราว์เซอร์ ไม่ต้องสมัครสมาชิกและไม่มีการอัปโหลดไฟล์ — ลากวางข้อความ รูปภาพ ลายเซ็น แล้ว Export กลับเป็น PDF',
  applicationName: 'MeDF',
};

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <FontFaces />
      </head>
      <body className="min-h-full font-sans antialiased">{children}</body>
    </html>
  );
}
