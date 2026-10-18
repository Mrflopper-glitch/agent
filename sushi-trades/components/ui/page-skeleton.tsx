/** A shimmering placeholder shown while a page loads. */
export function PageSkeleton() {
  return (
    <div className="space-y-4 pt-1">
      <div className="skeleton h-5 w-24" />
      <div className="skeleton h-[140px]" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="skeleton h-[84px]" />
        ))}
      </div>
      <div className="skeleton h-[300px]" />
    </div>
  );
}
