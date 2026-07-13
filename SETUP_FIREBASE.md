# إعداد Firebase لتطبيق تعاونية الحليب

التطبيق مربوط بمشروع Firebase الخاص بك عبر المفاتيح التي أدخلتها (Secrets). قبل أن يعمل التطبيق فعليًا تحتاج إلى تفعيل بعض الخدمات من [Firebase Console](https://console.firebase.google.com):

## 1. تفعيل المصادقة (Authentication)
- من القائمة الجانبية: **Build → Authentication → Get started**.
- في تبويب **Sign-in method**، فعّل مزود **Email/Password**.

## 2. إنشاء أول حساب مدير (Admin)
- لا يوجد تسجيل عام (Sign up) داخل التطبيق عن قصد — الحسابات تُنشأ فقط من طرف المدير.
- لذلك يجب إنشاء أول حساب يدويًا من Firebase Console:
  - **Authentication → Users → Add user**.
  - استخدم البريد: `okas34744@gmail.com` وكلمة مرور من اختيارك.
- عند أول تسجيل دخول بهذا البريد داخل التطبيق، سيُمنح تلقائيًا صلاحية **admin**. من هناك يمكنك إنشاء بقية الحسابات (محصّل/محاسب) من صفحة الإعدادات.

## 3. إنشاء قاعدة بيانات Firestore
- **Build → Firestore Database → Create database**.
- اختر وضع **Production mode** (القواعد الأمنية جاهزة في ملف `firestore.rules`).
- اختر أقرب موقع خادم لك.

## 4. نشر قواعد الأمان (Firestore Rules)
انسخ محتوى الملف `firestore.rules` الموجود في هذا المجلد إلى:
**Firestore Database → Rules**، ثم اضغط **Publish**.

(أو باستخدام Firebase CLI: `firebase deploy --only firestore:rules`).

## 5. تفعيل التخزين (Storage) لرفع شعار التعاونية
- **Build → Storage → Get started**، واختر نفس الموقع الذي اخترته لـ Firestore.

## 6. رفع الكود إلى GitHub
هذا المشروع منظم كمشروع React + Vite عادي (ES Modules)، وهو جزء من مجلد `artifacts/milk-coop` داخل المستودع. يمكنك رفعه كما هو إلى GitHub، أو نسخ مجلد `artifacts/milk-coop` فقط إلى مستودع منفصل إذا أردت مشروعًا مستقلاً.

بعد إتمام الخطوات 1-5، التطبيق سيعمل بكامل وظائفه: تسجيل الدخول، الأعضاء، الناقلون، استلام/تسليم الحليب، الميزانية، والتقارير.
