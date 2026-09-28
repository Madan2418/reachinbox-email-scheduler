export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="table-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="table-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} style={{ width: `${60 + ((i * 3 + j * 7) % 30)}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
