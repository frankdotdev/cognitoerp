/**
 * Loading skeleton — fixes the systemic gap where every screen either
 * showed real data or showed literally nothing while loading. A skeleton
 * that matches the shape of what's coming (rows for a table, cards for a
 * grid) reads as "this is loading" rather than "this is broken" or "there's
 * nothing here" during the gap before data arrives.
 */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-[10px] border border-border bg-surface-1 overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border-soft last:border-0">
          <div className="h-3.5 bg-surface-0 rounded animate-pulse w-1/4" />
          <div className="h-3.5 bg-surface-0 rounded animate-pulse w-1/6" />
          <div className="h-3.5 bg-surface-0 rounded animate-pulse w-1/5" />
          <div className="h-3.5 bg-surface-0 rounded animate-pulse w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-surface-1 border border-border rounded-[10px] p-4">
          <div className="h-2.5 bg-surface-0 rounded animate-pulse w-2/3 mb-3" />
          <div className="h-5 bg-surface-0 rounded animate-pulse w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-4 max-w-lg">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <div className="h-2.5 bg-surface-0 rounded animate-pulse w-1/4 mb-2" />
          <div className="h-10 bg-surface-0 rounded-md animate-pulse" />
        </div>
      ))}
    </div>
  );
}
