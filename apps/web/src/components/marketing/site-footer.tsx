import Link from 'next/link';
import { Logo } from '@/components/icons';

export function SiteFooter({
  variant = 'product',
  repoUrl = 'https://github.com/SuruchBoss/MeDF',
  tryHref = '/try',
}: {
  variant?: 'product' | 'demo';
  repoUrl?: string;
  tryHref?: string;
}) {
  const isDemo = variant === 'demo';

  return (
    <footer className="border-t border-ink-200 bg-white">
      <div className="container-page grid gap-10 py-12 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-500">
            MeDF คือเครื่องมือแก้ไข PDF ที่ทำงานเหมือนโปรแกรมออกแบบ — ลากวาง ปรับขนาด
            จัดเรียงองค์ประกอบได้อิสระ แล้ว Export กลับเป็น PDF โดยคงคุณภาพต้นฉบับไว้ทั้งหมด
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-900">ผลิตภัณฑ์</h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            <li>
              <Link href="/#features" className="hover:text-ink-900">
                ฟีเจอร์ทั้งหมด
              </Link>
            </li>
            <li>
              <Link href={isDemo ? '/#pricing' : '/pricing'} className="hover:text-ink-900">
                แพ็กเกจและราคา
              </Link>
            </li>
            <li>
              <Link href="/#desktop" className="hover:text-ink-900">
                เวอร์ชัน Windows
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-900">
            {isDemo ? 'โอเพนซอร์ส' : 'บัญชี'}
          </h3>
          <ul className="mt-3 space-y-2 text-sm text-ink-500">
            {isDemo ? (
              <>
                <li>
                  <Link href={tryHref} className="hover:text-ink-900">
                    ลองใช้ทันที (ไม่ต้องสมัคร)
                  </Link>
                </li>
                <li>
                  <a href={repoUrl} className="hover:text-ink-900" target="_blank" rel="noreferrer">
                    ซอร์สโค้ดบน GitHub
                  </a>
                </li>
                <li>
                  <a
                    href={`${repoUrl}/blob/main/docs/OPEN_CORE.md`}
                    className="hover:text-ink-900"
                    target="_blank"
                    rel="noreferrer"
                  >
                    โมเดล open core
                  </a>
                </li>
              </>
            ) : (
              <>
                <li>
                  <Link href="/register" className="hover:text-ink-900">
                    สมัครสมาชิก
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-ink-900">
                    เข้าสู่ระบบ
                  </Link>
                </li>
                <li>
                  <Link href="/app/billing" className="hover:text-ink-900">
                    จัดการการสมัครสมาชิก
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-100">
        <div className="container-page flex flex-col items-center justify-between gap-2 py-5 text-xs text-ink-400 sm:flex-row">
          <p>© {new Date().getFullYear()} MeDF. สงวนลิขสิทธิ์ทั้งหมด</p>
          <p>ฟอนต์ Sarabun ภายใต้สัญญาอนุญาต SIL Open Font License 1.1</p>
        </div>
      </div>
    </footer>
  );
}
