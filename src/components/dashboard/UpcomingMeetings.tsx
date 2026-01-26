"use client";

import * as React from "react";
import Link from "next/link";

export default function UpcomingMeetings() {
  const [rows, setRows] = React.useState<any[]>([]);
  React.useEffect(() => {
    fetch("/api/meetings")
      .then((r) => r.json())
      .then(setRows)
      .catch(() => {});
  }, []);
  return (
    <div className="rounded border p-4">
      <div className="font-semibold mb-2">Upcoming Meetings</div>
      {rows.length === 0 ? (
        <div className="text-sm text-muted-foreground">No meetings scheduled</div>
      ) : (
        <ul className="space-y-2">
          {rows
            .filter((r) => new Date(r.startAt) >= new Date())
            .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())
            .slice(0, 6)
            .map((r) => (
              <li key={r.id} className="text-sm">
                <div className="flex justify-between">
                  <div className="font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.startAt).toLocaleString()}</div>
                </div>
                {r.targetId && (
                  <div className="text-xs">
                    <Link className="underline" href={`/dashboard/companies/${r.targetId}`}>
                      View company
                    </Link>
                  </div>
                )}
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
