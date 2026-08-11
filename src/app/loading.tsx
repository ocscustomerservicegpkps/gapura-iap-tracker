/**
 * The page waits on two Google Sheets reads before it can render anything, and a
 * cold read is not instant. This holds the same shapes the dashboard will fill —
 * five KPI cards, a summary block, three panels, a table — so the layout does not
 * jump when the data lands.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-7 pb-16 sm:px-8 sm:pt-9">
      <p className="sr-only" role="status">
        Memuat data tracker dari spreadsheet…
      </p>

      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <Bar className="mb-2 h-[13px] w-[180px]" />
          <Bar className="h-[30px] w-[min(80vw,430px)]" />
        </div>
        <Bar className="h-[35px] w-[150px]" />
      </header>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 lg:gap-[14px]">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="card px-5 py-4">
            <Bar className="h-[12px] w-[70%]" />
            <Bar className="mt-2.5 h-[26px] w-[40%]" />
          </div>
        ))}
      </div>

      <div className="card mb-8 px-4 py-4 sm:px-[22px] sm:py-5">
        <Bar className="mb-4 h-[14px] w-[190px]" />
        {Array.from({ length: 4 }, (_, i) => (
          <Bar key={i} className="mb-2.5 h-[34px] w-full" />
        ))}
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="card px-5 py-4">
            <Bar className="mb-3 h-[13px] w-[140px]" />
            <Bar className="h-[132px] w-full" />
          </div>
        ))}
      </div>

      <div className="card overflow-hidden px-4 py-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Bar key={i} className="mb-2.5 h-[30px] w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * A flat placeholder, not a shimmer: nothing here is worth animating, and a static
 * block is the same information without asking anyone to sit through a loop.
 */
function Bar({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-[5px] bg-track ${className}`} />;
}
