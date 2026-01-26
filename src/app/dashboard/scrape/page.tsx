"use client";

import * as React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useQueryClient } from "@tanstack/react-query";
import PageContainer from "@/components/layout/page-container";
import { toast } from "sonner";

type ScrapeResp = {
  profileDraft: {
    company?: string;
    website?: string;
    domain?: string;
    email?: string;
    phone?: string;
    addressRaw?: string;
    logoUrl?: string;
  };
  candidates: {
    id: string;
    company: string;
    website: string | null;
    phone: string | null;
    email: string | null;
    addressRaw: string | null;
    createdAt: string;
  }[];
};

export default function ScrapePage() {
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<ScrapeResp["profileDraft"] | null>(null);
  const [cands, setCands] = useState<ScrapeResp["candidates"]>([]);
  const [creating, setCreating] = useState(false);
  const [scraping, setScraping] = useState(false);
  const router = useRouter();
  const qc = useQueryClient();

  const scrape = async () => {
    if (!url.trim()) return;
    setScraping(true);
    try {
      const res = await fetch("/api/scrape/company", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Scrape failed");
      }
      const data: ScrapeResp = await res.json();
      setDraft(data.profileDraft);
      setCands(data.candidates);
      toast.success("Scrape completed successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to scrape URL");
    } finally {
      setScraping(false);
    }
  };

  const createCompany = async () => {
    if (!draft?.company) return;
    setCreating(true);
    try {
      const payload = {
        company: draft.company,
        website: draft.website,
        email: draft.email,
        phone: draft.phone,
        addressRaw: draft.addressRaw ?? "",
      };
      const res = await fetch("/api/targets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Create failed");
      }
      const created = await res.json();
      // invalidate list, then go to profile
      qc.invalidateQueries({ queryKey: ["targets"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      toast.success("Company created successfully");
      router.push(`/dashboard/companies/${created.id}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to create company");
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageContainer>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Scrape Company</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Scrape a company from URL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim() && !scraping) {
                    scrape();
                  }
                }}
              />
              <Button onClick={scrape} disabled={!url.trim() || scraping}>
                {scraping ? "Scraping..." : "Scrape"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Paste a site and we'll draft a company and suggest possible matches.
            </p>
          </CardContent>
        </Card>

        {draft && (
          <Card>
            <CardHeader>
              <CardTitle>Draft Company</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Company</label>
                <Input value={draft.company ?? ""} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium">Website</label>
                <Input value={draft.website ?? ""} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={draft.email ?? ""} readOnly />
              </div>
              <div>
                <label className="text-sm font-medium">Phone</label>
                <Input value={draft.phone ?? ""} readOnly />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium">Address</label>
                <Textarea value={draft.addressRaw ?? ""} readOnly rows={2} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={createCompany} disabled={!draft.company || creating}>
                  {creating ? "Creating…" : "Create Company"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {cands.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Suggested Matches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cands.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="space-y-1">
                    <div className="font-medium">{c.company}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.website || ""} {c.phone ? `• ${c.phone}` : ""}{" "}
                      {c.email ? `• ${c.email}` : ""}
                    </div>
                    {c.addressRaw && (
                      <div className="text-xs text-muted-foreground">
                        {c.addressRaw}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => router.push(`/dashboard/companies/${c.id}`)}>
                      Open
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
