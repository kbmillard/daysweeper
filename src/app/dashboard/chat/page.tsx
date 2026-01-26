"use client";

import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user"|"assistant"; content: string };

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [text, setText] = React.useState("");
  const [targetId, setTargetId] = React.useState("");
  const [routeId, setRouteId] = React.useState("");

  const send = async () => {
    if (!text.trim()) return;
    const next: Msg[] = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setText("");
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: next, targetId: targetId || undefined, routeId: routeId || undefined }),
    });
    const j = await r.json();
    setMessages((m) => [...m, { role: "assistant", content: j.reply ?? "(no reply)" }]);
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-lg font-semibold tracking-tight">AI Chat</h1>
      <div className="flex flex-wrap gap-2">
        <Input className="w-64" placeholder="Company ID (optional)" value={targetId} onChange={(e)=>setTargetId(e.target.value)} />
        <Input className="w-64" placeholder="Route ID (optional)" value={routeId} onChange={(e)=>setRouteId(e.target.value)} />
      </div>
      <div className="rounded border p-3 min-h-[240px] space-y-2 bg-card">
        {messages.map((m,i)=>(
          <div key={i} className={m.role==="user"?"text-right":""}>
            <div className={`inline-block rounded px-3 py-2 text-sm ${m.role==="user"?"bg-primary text-primary-foreground":"bg-muted"}`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <Textarea value={text} onChange={(e)=>setText(e.target.value)} placeholder="Ask about a company, a route, or notes…" />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
