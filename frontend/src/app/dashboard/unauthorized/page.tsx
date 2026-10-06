export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-accent">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-destructive">دسترسی غیرمجاز</h1>
        <p className="mt-4 text-foreground">شما اجازه دسترسی به این صفحه را ندارید.</p>
      </div>
    </div>
  );
}
