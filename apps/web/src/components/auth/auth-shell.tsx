import Link from 'next/link';
import { Icon, Logo } from '@/components/icons';

const POINTS = [
  'ลากวางข้อความ รูปภาพ และลายเซ็นลงใน PDF ได้อิสระ',
  'Export กลับเป็น PDF โดยคงคุณภาพต้นฉบับ',
  'ใช้งานฟรี ไม่ต้องกรอกบัตรเครดิต',
];

/** Split layout shared by the sign-in and sign-up screens. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="inline-flex text-ink-900">
            <Logo />
          </Link>
          <h1 className="mt-8 text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>
          <p className="mt-2 text-sm text-ink-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:flex-col lg:justify-center">
        <div
          className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative px-14">
          <p className="text-sm font-semibold tracking-wide text-brand-300 uppercase">MeDF</p>
          <h2 className="mt-4 text-3xl leading-tight font-extrabold text-white">
            แก้ไข PDF ด้วยการลากวาง
            <br />
            แล้ว Export กลับได้ทันที
          </h2>
          <ul className="mt-8 space-y-4">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-ink-200">
                <Icon name="check-circle" size={20} className="mt-0.5 shrink-0 text-brand-300" />
                <span className="text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
