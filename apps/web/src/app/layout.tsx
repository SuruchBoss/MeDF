import type { Metadata, Viewport } from 'next';
import { FontFaces } from '@/components/font-faces';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: {
    default: 'MeDF — แก้ไข PDF ด้วยการลากวาง',
    template: '%s · MeDF',
  },
  description:
    'อัปโหลด PDF แล้วลากวางข้อความ รูปภาพ ลายเซ็น และรูปทรงลงในหน้าเอกสารได้ทันที ปรับขนาด จัดเรียง แล้ว Export กลับเป็น PDF คุณภาพเดิม',
  keywords: ['PDF', 'แก้ไข PDF', 'เซ็นเอกสาร', 'ลากวาง', 'MeDF', 'PDF editor ไทย'],
  applicationName: 'MeDF',
  authors: [{ name: 'MeDF' }],
  openGraph: {
    title: 'MeDF — แก้ไข PDF ด้วยการลากวาง',
    description:
      'อัปโหลด PDF ลากวางข้อความ รูปภาพ ลายเซ็น ปรับขนาดอิสระ แล้ว Export กลับเป็น PDF',
    type: 'website',
  },
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
