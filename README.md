# تعاونية كوب بوعلا (Coop Bouala)

نظام إدارة تعاونية حليب — الأعضاء، الناقلون، استلام/تسليم الحليب، الميزانية، والتقارير. تطبيق ويب مستقل (React + Vite)، قابل للتثبيت على الهاتف كـ PWA، ويعمل بالكامل عبر Firebase (Auth + Firestore + Storage) — **بدون أي خادم خلفي وبدون أي ارتباط بمنصة Replit**.

## التشغيل محلياً

```bash
npm install
npm run dev
```

## البناء للإنتاج

```bash
npm run build
```

الناتج في مجلد `dist/` — ملفات ثابتة (Static) يمكن استضافتها في أي مكان.

## إعداد Firebase (مرة واحدة فقط)

راجع [`SETUP_FIREBASE.md`](./SETUP_FIREBASE.md) لتفعيل Authentication و Firestore و Storage ونشر قواعد الأمان `firestore.rules` في مشروع Firebase الخاص بك، وإنشاء أول حساب مدير.

إعدادات الاتصال بـ Firebase (`VITE_FIREBASE_*`) موجودة مسبقاً في `.env.production` — وهي قيم غير سرية (Firebase يعتمد على قواعد الأمان وليس على إخفائها). إذا أردت ربط مشروع Firebase مختلف، عدّل هذه القيم أو `.env` محلياً.

## النشر (بدون أي علاقة بـ Replit)

### الخيار 1: Firebase Hosting (نفس مشروع Firebase الحالي)

```bash
npm install -g firebase-tools
firebase login
npm run build
firebase deploy
```

### الخيار 2: نشر تلقائي عبر GitHub Actions

يوجد ملف جاهز في `.github/workflows/deploy.yml` ينشر تلقائياً على Firebase Hosting عند كل `push` إلى `main`. لتفعيله:

1. Firebase Console → Project settings → Service accounts → Generate new private key (يُنزَّل ملف JSON).
2. في مستودع GitHub: Settings → Secrets and variables → Actions → New repository secret باسم `FIREBASE_SERVICE_ACCOUNT`، والصق محتوى ملف الـ JSON كاملاً.
3. أي `push` بعد ذلك إلى `main` سيُنشر النسخة الجديدة تلقائياً.

### الخيار 3: أي استضافة ثابتة أخرى (Vercel, Netlify, Cloudflare Pages...)

أمر البناء: `npm run build`، ومجلد الإخراج: `dist`. أضف متغيرات البيئة `VITE_FIREBASE_*` (الموجودة في `.env.production`) في إعدادات المشروع على تلك المنصة.

## تثبيت التطبيق على الهاتف (PWA)

بعد نشر الموقع وفتح رابطه من متصفح الهاتف، استخدم خيار "إضافة إلى الشاشة الرئيسية" (Add to Home Screen) — سيعمل التطبيق كأيقونة عادية على الهاتف، بما في ذلك دعم جزئي للعمل بدون اتصال إنترنت.

## البنية

- `src/lib/firebase.ts` — تهيئة Firebase (Auth/Firestore/Storage)
- `src/hooks/useAuth.tsx` — تسجيل الدخول وصلاحيات المستخدم (أول دخول بالبريد المحدد في `BOOTSTRAP_ADMIN_EMAIL` يصبح مديراً تلقائياً)
- `src/pages/*` — صفحات التطبيق (لوحة التحكم، الأعضاء، الناقلون، الحليب، الميزانية، التقارير، الإعدادات، الدعوات، تسجيل الدخول)
- `firestore.rules` — قواعد أمان قاعدة البيانات
