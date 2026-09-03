export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <div className="text-6xl">🔍</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        صفحه مورد نظر یافت نشد
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md">
        صفحه‌ای که به دنبال آن هستید وجود ندارد یا به آدرس دیگری منتقل شده است.
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        بازگشت به داشبورد
      </a>
    </div>
  )
}
