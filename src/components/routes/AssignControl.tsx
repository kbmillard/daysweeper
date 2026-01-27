"use client";
import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type UserItem = { id: string; name: string; email?: string; imageUrl?: string | null };

function UserAvatar({ user, size = "sm" }: { user: UserItem; size?: "sm" | "md" }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <Avatar className={`${size === "sm" ? "h-6 w-6" : "h-8 w-8"}`}>
      <AvatarImage src={user.imageUrl || undefined} alt={user.name} />
      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
    </Avatar>
  );
}

export default function AssignControl({
  routeId,
  currentAssigneeId,
  currentAssigneeName,
  currentAssigneeEmail,
  currentAssigneeImage,
  meId,
  canReassign
}: { 
  routeId: string; 
  currentAssigneeId?: string | null; 
  currentAssigneeName?: string | null;
  currentAssigneeEmail?: string | null;
  currentAssigneeImage?: string | null;
  meId?: string | null; 
  canReassign?: boolean 
}) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<UserItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);

  const search = async (q: string) => {
    setLoading(true);
    const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`).then(r => r.json()).catch(() => ({ items: [] }));
    setItems(r.items || []);
    setLoading(false);
  };

  React.useEffect(() => {
    if (!open || query.length < 1) { setItems([]); return; }
    const t = setTimeout(() => search(query), 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const assign = async (userId: string | null) => {
    setAssigning(true);
    await fetch(`/api/routes/${routeId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ assignedToUserId: userId })
    });
    setAssigning(false);
    setOpen(false);
    window.dispatchEvent(new CustomEvent("route:refresh"));
  };

  const currentUser: UserItem | null = currentAssigneeId ? {
    id: currentAssigneeId,
    name: currentAssigneeName || currentAssigneeEmail || currentAssigneeId,
    email: currentAssigneeEmail || undefined,
    imageUrl: currentAssigneeImage || null
  } : null;

  return (
    <div className="relative inline-flex items-center gap-2">
      <button
        className="border rounded px-3 py-1 text-sm"
        disabled={assigning}
        onClick={() => meId && assign(meId)}
        title="Assign to me"
      >Assign to me</button>

      {canReassign && (
        <div className="relative">
          <button className="border rounded px-3 py-1 text-sm flex items-center gap-2" onClick={() => setOpen(v => !v)}>
            {currentUser ? (
              <>
                <UserAvatar user={currentUser} size="sm" />
                <span>{currentUser.name}</span>
              </>
            ) : (
              "Assign to user…"
            )}
          </button>
          {open && (
            <div className="absolute z-50 mt-2 w-80 rounded border bg-white dark:bg-neutral-900 shadow-xl p-2">
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search name or email…"
                className="w-full border rounded px-2 py-1 mb-2"
              />
              {loading && <div className="text-xs p-2">Searching…</div>}
              {!loading && items.length === 0 && <div className="text-xs p-2 text-gray-500">Type to search users</div>}
              <ul className="max-h-64 overflow-auto">
                {items.map(u => (
                  <li key={u.id}
                    onClick={() => assign(u.id)}
                    className="px-2 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer rounded flex items-center gap-2">
                    <UserAvatar user={u} size="sm" />
                    <div>
                      <div className="text-sm font-medium">{u.name}</div>
                      {u.email && <div className="text-xs text-gray-500">{u.email}</div>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {!canReassign && currentUser && (
        <div className="flex items-center gap-2 text-sm">
          <UserAvatar user={currentUser} size="sm" />
          <span>{currentUser.name}</span>
        </div>
      )}
    </div>
  );
}
