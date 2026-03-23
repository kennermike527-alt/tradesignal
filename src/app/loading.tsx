export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-6 md:p-10">
      <div className="space-y-3">
        <div className="h-8 w-52 animate-pulse rounded bg-slate-800" />
        <div className="h-4 w-96 animate-pulse rounded bg-slate-800" />
      </div>
      <div className="mt-8 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
    </main>
  );
}
