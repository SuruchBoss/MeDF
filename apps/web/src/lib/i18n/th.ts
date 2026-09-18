/**
 * The source dictionary.
 *
 * Thai is the origin language: a new message is added here first, and `en.ts`
 * is typed against these keys so the compiler will not let it drift.
 *
 * Keys read `area.thing`. Keep an area's messages together and alphabetical
 * within it, so two people adding messages to the same screen collide in the
 * diff rather than in the product.
 *
 * `{name}` is interpolated. Anything needing plural rules, currency or dates
 * goes through `Intl` at the call site, where the locale is already in hand.
 */
export const th = {
  // --- Shared ---------------------------------------------------------------
  'common.cancel': 'ยกเลิก',
  'common.close': 'ปิด',
  'common.confirm': 'ตกลง',
  'common.delete': 'ลบ',
  'common.duplicate': 'ทำสำเนา',
  'common.language': 'ภาษา',
  'common.loading': 'กำลังโหลด…',
  'common.rename': 'เปลี่ยนชื่อ',
  'common.retry': 'ลองใหม่อีกครั้ง',
  'common.save': 'บันทึก',
  'common.unlimited': 'ไม่จำกัด',

  // --- Site header ----------------------------------------------------------
  'nav.account': 'บัญชี',
  'nav.faq': 'คำถามที่พบบ่อย',
  'nav.features': 'ฟีเจอร์',
  'nav.howItWorks': 'วิธีใช้งาน',
  'nav.login': 'เข้าสู่ระบบ',
  'nav.openMenu': 'เปิดเมนู',
  'nav.plans': 'แพ็กเกจ',
  'nav.signUpFree': 'เริ่มใช้ฟรี',
  'nav.toWorkspace': 'เข้าหน้าทำงาน',
  'nav.tryNow': 'ลองใช้ทันที',
  'nav.windows': 'ติดตั้งบน Windows',

  // --- Site footer ----------------------------------------------------------
  'footer.account': 'บัญชี',
  'footer.allFeatures': 'ฟีเจอร์ทั้งหมด',
  'footer.fontLicence': 'ฟอนต์ Sarabun ภายใต้สัญญาอนุญาต SIL Open Font License 1.1',
  'footer.login': 'เข้าสู่ระบบ',
  'footer.manageSubscription': 'จัดการการสมัครสมาชิก',
  'footer.openCoreModel': 'โมเดล open core',
  'footer.openSource': 'โอเพนซอร์ส',
  'footer.plansAndPricing': 'แพ็กเกจและราคา',
  'footer.product': 'ผลิตภัณฑ์',
  'footer.register': 'สมัครสมาชิก',
  'footer.rights': '© {year} MeDF. สงวนลิขสิทธิ์ทั้งหมด',
  'footer.sourceOnGitHub': 'ซอร์สโค้ดบน GitHub',
  'footer.tagline':
    'MeDF คือเครื่องมือแก้ไข PDF ที่ทำงานเหมือนโปรแกรมออกแบบ — ลากวาง ปรับขนาด จัดเรียงองค์ประกอบได้อิสระ แล้ว Export กลับเป็น PDF โดยคงคุณภาพต้นฉบับไว้ทั้งหมด',
  'footer.tryNoSignup': 'ลองใช้ทันที (ไม่ต้องสมัคร)',
  'footer.windowsVersion': 'เวอร์ชัน Windows',

  // --- Sign in and sign up --------------------------------------------------
  'auth.displayName': 'ชื่อที่ใช้แสดง',
  'auth.email': 'อีเมล',
  'auth.hasAccount': 'มีบัญชีอยู่แล้ว?',
  'auth.hidePassword': 'ซ่อนรหัสผ่าน',
  'auth.login': 'เข้าสู่ระบบ',
  'auth.namePlaceholder': 'สมชาย ใจดี',
  'auth.needsAccount': 'ยังไม่มีบัญชี?',
  'auth.networkError': 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่',
  'auth.password': 'รหัสผ่าน',
  'auth.passwordHint': 'แนะนำให้ใช้ตัวอักษรผสมตัวเลข เพื่อความปลอดภัยของเอกสารของคุณ',
  'auth.passwordMinPlaceholder': 'อย่างน้อย 8 ตัวอักษร',
  'auth.register': 'สมัครสมาชิกฟรี',
  'auth.registerShort': 'สมัครฟรี',
  'auth.showPassword': 'แสดงรหัสผ่าน',
  'auth.unknownError': 'ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง',

  // --- Page titles and site metadata ---------------------------------------
  'meta.account': 'บัญชีของฉัน',
  'meta.admin': 'ผู้ดูแลระบบ',
  'meta.billing': 'การสมัครสมาชิก',
  'meta.description':
    'อัปโหลด PDF แล้วลากวางข้อความ รูปภาพ ลายเซ็น และรูปทรงลงในหน้าเอกสารได้ทันที ปรับขนาด จัดเรียง แล้ว Export กลับเป็น PDF คุณภาพเดิม',
  'meta.documents': 'เอกสารของฉัน',
  'meta.editor': 'แก้ไขเอกสาร',
  'meta.login': 'เข้าสู่ระบบ',
  'meta.notFound': 'ไม่พบหน้านี้',
  'meta.register': 'สมัครสมาชิก',
  'meta.title': 'MeDF — แก้ไข PDF ด้วยการลากวาง',

  // --- Error screens --------------------------------------------------------
  'error.appTitle': 'เปิดหน้านี้ไม่สำเร็จ',
  'error.appBody': 'เอกสารและงานที่บันทึกไว้ยังปลอดภัย ลองโหลดหน้านี้ใหม่ หรือกลับไปที่รายการเอกสาร',
  'error.fatalBody':
    'ไม่สามารถโหลดหน้าเว็บได้ กรุณาลองใหม่อีกครั้ง หากยังไม่ได้ให้รีเฟรชเบราว์เซอร์',
  'error.fatalTitle': 'ระบบขัดข้อง',
  'error.myDocuments': 'เอกสารของฉัน',
  'error.notFoundBody':
    'ลิงก์อาจเปลี่ยนไปแล้ว หรือเอกสารนี้ถูกลบไปแล้ว ลองกลับไปที่หน้าแรกหรือเปิดรายการเอกสารของคุณ',
  'error.notFoundTitle': 'ไม่พบหน้าที่ต้องการ',
  'error.reference': 'รหัสอ้างอิง: {digest}',
  'error.toHome': 'กลับหน้าแรก',
  'error.unexpectedBody': 'ระบบขัดข้องชั่วคราว งานที่บันทึกไว้แล้วยังอยู่ครบ ลองใหม่อีกครั้งได้เลย',
  'error.unexpectedTitle': 'เกิดข้อผิดพลาดที่ไม่คาดคิด',
} as const;
