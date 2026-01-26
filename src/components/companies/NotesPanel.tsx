'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useNotes, useCreateNote } from '@/lib/notes';
import { useSelectedText } from '@/hooks/use-selected-text';
import { slugify } from '@/lib/slugify';
import { useState } from 'react';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface NotesPanelProps {
  targetId: string;
}

export function NotesPanel({ targetId }: NotesPanelProps) {
  const { data: notes, isLoading } = useNotes(targetId);
  const createNote = useCreateNote(targetId);
  const selectedText = useSelectedText();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);

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
      toast.error('Note content is required');
      return;
    }

    try {
      await createNote.mutateAsync({ content, tags });
      setContent('');
      setTags([]);
      toast.success('Note added successfully');
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  // Get all unique tags from notes
  const allTags = notes?.reduce((acc: string[], note: any) => {
    note.tags?.forEach((tag: string) => {
      if (!acc.includes(tag)) acc.push(tag);
    });
    return acc;
  }, []) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>Add notes and tags for this company</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Textarea
            placeholder='Add a note...'
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
          />
          {selectedText && (
            <div className='flex items-center gap-2'>
              <span className='text-sm text-muted-foreground'>
                Selected: &quot;{selectedText}&quot;
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={handleAddTagFromSelection}
              >
                + Tag from selection
              </Button>
            </div>
          )}
          {tags.length > 0 && (
            <div className='flex flex-wrap gap-2'>
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant='secondary'
                  className='cursor-pointer'
                  onClick={() => handleRemoveTag(tag)}
                >
                  {tag} ×
                </Badge>
              ))}
            </div>
          )}
          <Button
            onClick={handleAddNote}
            disabled={!content.trim() || createNote.isPending}
          >
            Add Note
          </Button>
        </div>

        <div className='space-y-2'>
          <h4 className='text-sm font-medium'>Recent Notes</h4>
          {isLoading ? (
            <div className='text-sm text-muted-foreground'>Loading...</div>
          ) : notes && notes.length > 0 ? (
            <div className='space-y-3'>
              {notes.map((note: any) => (
                <div
                  key={note.id}
                  className='rounded-lg border p-3 space-y-2'
                >
                  <p className='text-sm'>{note.content}</p>
                  {note.tags.length > 0 && (
                    <div className='flex flex-wrap gap-1'>
                      {note.tags.map((tag: string) => (
                        <Badge key={tag} variant='outline' className='text-xs'>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className='text-xs text-muted-foreground'>
                    {dayjs(note.createdAt).format('MMM D, YYYY h:mm A')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-sm text-muted-foreground'>No notes yet</div>
          )}
        </div>

        {allTags.length > 0 && (
          <div className='space-y-2'>
            <h4 className='text-sm font-medium'>All Tags</h4>
            <div className='flex flex-wrap gap-2'>
              {allTags.map((tag: string) => (
                <Badge key={tag} variant='secondary'>
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
