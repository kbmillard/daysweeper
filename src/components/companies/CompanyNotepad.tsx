"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useNotes, useCreateNote } from "@/lib/notes";
import { useSelectedText } from "@/hooks/use-selected-text";
import { slugify } from "@/lib/slugify";
import { useTargets } from "@/lib/targets";
import { toast } from "sonner";
import dayjs from "dayjs";
import Link from "next/link";

interface CompanyNotepadProps {
  targetId: string;
}

const MENTION_RE = /([A-Za-z0-9][A-Za-z0-9\s\-\&]{2,50})/g;

function linkifyCompanies(text: string, companies: { id: string; name: string; slug: string }[]) {
  const sorted = [...companies].sort((a, b) => b.name.length - a.name.length);
  let html = text;
  for (const c of sorted) {
    const esc = c.name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const reg = new RegExp(`\\b${esc}\\b`, "gi");
    html = html.replace(reg, `<a class="underline text-blue-600 hover:text-blue-800" href="/dashboard/companies/${c.id}">${c.name}</a>`);
  }
  return html;
}

export function CompanyNotepad({ targetId }: CompanyNotepadProps) {
  const { data: notes, isLoading, refetch } = useNotes(targetId);
  const createNote = useCreateNote(targetId);
  const { data: allTargets = [] } = useTargets({});
  const selectedText = useSelectedText();
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);

  // Build company index for autolinking
  const companyIndex = React.useMemo(
    () =>
      (allTargets as any[]).map((t) => ({
        id: t.id,
        name: t.company,
        slug: slugify(t.company)
      })),
    [allTargets]
  );

  const handleAddTagFromSelection = () => {
    if (selectedText) {
      const slug = slugify(selectedText);
      if (slug && !tags.includes(slug)) {
        setTags([...tags, slug]);
      }
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleAddNote = async () => {
    if (!content.trim()) {
      toast.error("Note content is required");
      return;
    }

    try {
      // Compute mentions from content
      const mentions = Array.from(
        new Set(
          (content.match(MENTION_RE) || [])
            .map((s) => slugify(s))
            .filter((x) => companyIndex.some((c) => c.slug === x))
        )
      );

      await createNote.mutateAsync({ 
        content, 
        tags,
        mentions 
      });
      setContent("");
      setTags([]);
      toast.success("Note added successfully");
      refetch();
    } catch (error) {
      toast.error("Failed to add note");
    }
  };

  const allTags = notes?.reduce((acc: string[], note: any) => {
    note.tags?.forEach((tag: string) => {
      if (!acc.includes(tag)) acc.push(tag);
    });
    return acc;
  }, []) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Company Notepad</CardTitle>
        <CardDescription>Write notes with #tags and @mentions</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            placeholder="Type your note... Company names will auto-link (e.g., Honda, Toyota)"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="font-mono text-sm"
          />
          {selectedText && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Selected: &quot;{selectedText}&quot;
              </span>
              <Button size="sm" variant="outline" onClick={handleAddTagFromSelection}>
                + Tag from selection
              </Button>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={() => handleRemoveTag(tag)}
                >
                  #{tag} ×
                </Badge>
              ))}
            </div>
          )}
          <Button onClick={handleAddNote} disabled={!content.trim() || createNote.isPending}>
            Add Note
          </Button>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent Notes</h4>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : notes && notes.length > 0 ? (
            <div className="space-y-3 max-h-[400px] overflow-auto">
              {notes.map((note: any) => {
                const html = linkifyCompanies(note.content, companyIndex);
                return (
                  <div key={note.id} className="rounded-lg border p-3 space-y-2">
                    <div
                      className="text-sm [&_a]:underline [&_a]:text-blue-600 [&_a]:hover:text-blue-800"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                    {note.tags && note.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {note.tags.map((tag: string) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            #{tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {note.mentions && note.mentions.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs text-muted-foreground">Mentions:</span>
                        {note.mentions.map((m: string) => {
                          const company = companyIndex.find((c) => c.slug === m);
                          return company ? (
                            <Link key={m} href={`/dashboard/companies/${company.id}`} className="text-xs underline text-blue-600">
                              {company.name}
                            </Link>
                          ) : (
                            <span key={m} className="text-xs">{m}</span>
                          );
                        })}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {dayjs(note.createdAt).format("MMM D, YYYY h:mm A")}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No notes yet</div>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">All Tags</h4>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag: string) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
