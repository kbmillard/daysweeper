"use client";

import * as React from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    // log for Sentry/console; replace with your logger if you have one
    // eslint-disable-next-line no-console
    console.error("Route error:", error);
  }, [error]);

  return (
    <html>
      <body className="min-h-dvh bg-background text-foreground p-6">
        <div className="mx-auto max-w-xl space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-muted-foreground">
            The page crashed on the client. We've logged the error.
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
      </body>
    </html>
  );
}
