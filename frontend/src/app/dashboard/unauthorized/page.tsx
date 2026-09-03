export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-red-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-red-600">دسترسی غیرمجاز</h1>
        <p className="mt-4 text-gray-700">شما اجازه دسترسی به این صفحه را ندارید.</p>
      </div>
    </div>
  );
}
