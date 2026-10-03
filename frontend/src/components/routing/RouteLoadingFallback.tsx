export function RouteLoadingFallback() {
  return (
    <div className="w-full py-4 space-y-4 animate-in fade-in duration-100 opacity-40 pointer-events-none select-none">
      <div className="h-8 w-44 rounded-xl bg-surface-sunken" />
      <div className="h-28 w-full rounded-2xl border border-default bg-surface/40" />
      <div className="h-64 w-full rounded-2xl border border-default bg-surface/40" />
    </div>
  );
}

export function StorefrontRouteLoadingFallback() {
  return (
    <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 animate-in fade-in duration-200">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Loading...</p>
    </div>
  );
}
