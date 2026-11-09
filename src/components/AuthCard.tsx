export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md">
        <h1 className="h1 mb-5">{title}</h1>
        {children}
      </div>
    </main>
  );
}
