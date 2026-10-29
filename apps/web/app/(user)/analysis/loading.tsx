export default function AnalysisLoading() {
  return (
    <div
      className="rounded-2xl border p-5 text-sm shadow-sm"
      style={{
        borderColor: 'color-mix(in oklab, var(--analysis-primary) 26%, white)',
        background: 'color-mix(in oklab, var(--analysis-primary) 10%, white)',
        color: 'var(--analysis-text)',
      }}
    >
      Loading analysis...
    </div>
  );
}
