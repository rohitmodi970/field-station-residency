"use client";
export default function AnalysisError({ error }: { error: Error }) {
  return (
    <div
      className="rounded-2xl border p-5 text-sm shadow-sm"
      style={{
        borderColor: 'color-mix(in oklab, var(--analysis-primary) 32%, white)',
        background: 'color-mix(in oklab, var(--analysis-primary) 12%, white)',
        color: 'var(--analysis-muted)',
      }}
    >
      Analysis error: {error.message}
    </div>
  );
}
