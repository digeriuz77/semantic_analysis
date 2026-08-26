"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg bg-slate-900/50 border border-slate-800 rounded-xl p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">
          Something went wrong
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          The analysis view hit an unexpected error. Your uploaded files and any
          saved annotations are unaffected — try rendering the panel again.
        </p>
        {error.digest && (
          <p className="text-slate-600 text-xs font-mono mb-4">
            digest: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
