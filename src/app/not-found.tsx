import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-2xl font-bold">الصفحة غير موجودة</h1>
      <Link href="/" className="mt-4 inline-block text-forest-600 underline">
        العودة للوحة التحكم
      </Link>
    </div>
  );
}
