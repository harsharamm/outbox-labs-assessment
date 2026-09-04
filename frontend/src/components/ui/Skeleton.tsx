export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-1/4 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-2/5 animate-pulse rounded bg-gray-100" />
          <div className="ml-auto h-3 w-16 animate-pulse rounded bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
