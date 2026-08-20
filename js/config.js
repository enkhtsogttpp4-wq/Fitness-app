/* ═══════════════════════════════════════════════════════════════
   ТОХИРГОО — Supabase холболт

   ✅ Энэ хэсэг АЛЬ ХЭДИЙН тохируулагдсан.
      Төсөл:      huch (enkhtsogttpp4-wq's Project-2)
      Байгууллага: Fitness app
      Бүс:        ap-southeast-2 (Сидней)
      Хүснэгт:    profiles · measurements · workout_sets · food_entries · photos
      Storage:    progress (хаалттай)
      RLS:        асаалттай — хүн бүр зөвхөн өөрийн өгөгдлийг харна

   Эдгээр хоёр утга НУУЦ БИШ. Хөтөч дээр ил харагдана — энэ нь хэвийн.
   Өгөгдлийг Row Level Security хамгаална.
   ⚠️ service_role түлхүүрийг ХЭЗЭЭ Ч энд бүү тавь.

   Дахин авах бол: supabase.com → төсөл → Settings → API
   ═══════════════════════════════════════════════════════════════ */

window.HUCH_CONFIG = {
  SUPABASE_URL:      "https://zparrhkvgdzchhxqzezu.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwYXJyaGt2Z2R6Y2hoeHF6ZXp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMjU4NDAsImV4cCI6MjEwMjcwMTg0MH0.wFaYTJax0n8J--RkJ4vyPHJhJXaXO6hnQaN1NUtq3Yg",

  // Шинэ хэрэглэгч бүртгүүлэхийг зөвшөөрөх эсэх.
  // Хаалттай бүлэг болгох бол Supabase дээрээ:
  // Authentication → Sign In / Providers → Email → "Allow new users to sign up" унтраа.
  ALLOW_SIGNUP: true,

  APP_NAME: "Фитнесс зөвлөгөө, тэмдэглэл",
};

/* ───────────────────────────────────────────────────────────────
   Сонголт: дээрх "anon" түлхүүрийн оронд шинэ загварын
   publishable түлхүүр ашиглаж болно (тусад нь солих боломжтой):

     SUPABASE_ANON_KEY: "sb_publishable_O17RxtWs-zkomlYhK0ye4A_idjHfwMA",

   Хоёулаа адилхан ажиллана. Аль нэгийг нь л ашиглана.
   ─────────────────────────────────────────────────────────────── */
