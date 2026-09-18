import { z } from 'zod';
import { requireUser, updatePassword } from '@/lib/auth';
import { handleRouteError, jsonOk, parseJson } from '@/lib/api';

const schema = z.object({
  currentPassword: z.string().min(1, 'กรุณากรอกรหัสผ่านปัจจุบัน'),
  newPassword: z.string().min(8, 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร').max(200),
});

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const input = await parseJson(request, schema);
    await updatePassword(user.id, input.currentPassword, input.newPassword);
    return jsonOk({ ok: true, message: 'เปลี่ยนรหัสผ่านเรียบร้อย กรุณาเข้าสู่ระบบใหม่' });
  } catch (error) {
    return handleRouteError(error, request);
  }
}
