"use client";

import * as React from "react";

export default function CompaniesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Companies page error:", error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-background text-foreground p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          The companies page crashed. We've logged the error.
        </p>
        <div className="flex gap-2">
          <button
            className="rounded-md border px-3 py-2"
            onClick={() => reset()}
          >
            Try again
          </button>
          <a className="rounded-md border px-3 py-2" href="/">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
