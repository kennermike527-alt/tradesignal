export default function Loading() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-[1600px] space-y-3 p-4">
      <div className="h-20 animate-pulse rounded border border-slate-800 bg-slate-900/70" />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-16 animate-pulse rounded border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <div className="h-[70vh] animate-pulse rounded border border-slate-800 bg-slate-900/60" />
        <div className="h-[70vh] animate-pulse rounded border border-slate-800 bg-slate-900/60" />
        <div className="h-[70vh] animate-pulse rounded border border-slate-800 bg-slate-900/60" />
      </div>
    </main>
  );
}
