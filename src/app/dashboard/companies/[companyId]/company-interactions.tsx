'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { IconPhone, IconMail, IconMessage, IconCalendar, IconNote, IconPlus } from '@tabler/icons-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type Interaction = {
  id: string;
  type: string;
  subject: string | null;
  content: string;
  duration: number | null;
  createdAt: Date;
  userId: string | null;
};

type Props = {
  companyId: string;
};

const INTERACTION_TYPES = [
  { value: 'comment', label: 'Comment', icon: IconMessage },
  { value: 'phone_call', label: 'Phone Call', icon: IconPhone },
  { value: 'email', label: 'Email', icon: IconMail },
  { value: 'meeting', label: 'Meeting', icon: IconCalendar },
  { value: 'note', label: 'Note', icon: IconNote }
];

export default function CompanyInteractions({ companyId }: Props) {
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [migrationsRequired, setMigrationsRequired] = useState(false);
  const [formData, setFormData] = useState({
    type: 'comment',
    subject: '',
    content: '',
    duration: ''
  });

  useEffect(() => {
    fetchInteractions();
  }, [companyId]);

  const fetchInteractions = async () => {
    try {
      const res = await fetch(`/api/companies/${companyId}/interactions`);
      const data = await res.json();
      setInteractions(data.interactions ?? []);
      setMigrationsRequired(Boolean(data.migrationsRequired));
    } catch (error) {
      console.error('Failed to fetch interactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.content.trim()) {
      toast.error('Content is required');
      return;
    }

    try {
      const res = await fetch(`/api/companies/${companyId}/interactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          subject: formData.subject || null,
          content: formData.content,
          duration: formData.duration ? parseInt(formData.duration) : null
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        if (errorData.migrationsRequired || errorData.error === 'migrations_required') {
          setMigrationsRequired(true);
          toast.error('Run database migrations to enable interactions: prisma migrate deploy');
          return;
        }
        throw new Error(errorData.error || 'Failed to create interaction');
      }

      const data = await res.json();
      setInteractions([data.interaction, ...interactions]);
      setFormData({ type: 'comment', subject: '', content: '', duration: '' });
      setShowForm(false);
      toast.success('Interaction added successfully');
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to add interaction';
      toast.error(errorMessage);
      console.error('Interaction error:', error);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = INTERACTION_TYPES.find(t => t.value === type);
    return typeConfig?.icon || IconNote;
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      comment: 'default',
      phone_call: 'secondary',
      email: 'outline',
      meeting: 'default',
      note: 'secondary'
    };
    return colors[type] || 'default';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Interactions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground'>Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle>Interactions ({interactions.length})</CardTitle>
          {!migrationsRequired && (
            <Button
              onClick={() => setShowForm(!showForm)}
              size='sm'
              variant={showForm ? 'outline' : 'default'}
            >
              <IconPlus className='mr-2 h-4 w-4' />
              {showForm ? 'Cancel' : 'Add Interaction'}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {migrationsRequired && (
          <div className='rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 text-sm text-amber-800 dark:text-amber-200'>
            <p className='font-medium'>Interactions require a database migration.</p>
            <p className='mt-1 text-muted-foreground'>
              Run <code className='rounded bg-muted px-1'>prisma migrate deploy</code> (or redeploy so migrations run) to enable adding comments and calls.
            </p>
          </div>
        )}
        {!migrationsRequired && showForm && (
          <form onSubmit={handleSubmit} className='space-y-4 p-4 border rounded-lg'>
            <div className='space-y-2'>
              <Label>Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERACTION_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <div className='flex items-center gap-2'>
                          <Icon className='h-4 w-4' />
                          {type.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'phone_call' && (
              <div className='space-y-2'>
                <Label>Duration (seconds)</Label>
                <Input
                  type='number'
                  placeholder='120'
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
              </div>
            )}

            {(formData.type === 'email' || formData.type === 'meeting') && (
              <div className='space-y-2'>
                <Label>Subject</Label>
                <Input
                  placeholder='Enter subject...'
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>
            )}

            <div className='space-y-2'>
              <Label>Content *</Label>
              <Textarea
                placeholder='Enter details...'
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={4}
                required
              />
            </div>

            <Button type='submit' className='w-full'>
              Add Interaction
            </Button>
          </form>
        )}

        <div className='space-y-3'>
          {interactions.length === 0 && !migrationsRequired ? (
            <p className='text-center text-muted-foreground py-8'>
              No interactions yet. Add one to get started!
            </p>
          ) : interactions.length === 0 && migrationsRequired ? null : (
            interactions.map((interaction) => {
              const Icon = getTypeIcon(interaction.type);
              return (
                <div
                  key={interaction.id}
                  className='flex gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors'
                >
                  <div className='flex-shrink-0 mt-1'>
                    <div className='flex h-8 w-8 items-center justify-center rounded-full bg-primary/10'>
                      <Icon className='h-4 w-4 text-primary' />
                    </div>
                  </div>
                  <div className='flex-1 min-w-0 space-y-1'>
                    <div className='flex items-center gap-2'>
                      <Badge variant={getTypeColor(interaction.type) as any}>
                        {INTERACTION_TYPES.find(t => t.value === interaction.type)?.label || interaction.type}
                      </Badge>
                      {interaction.duration && (
                        <span className='text-xs text-muted-foreground'>
                          {Math.floor(interaction.duration / 60)}m {interaction.duration % 60}s
                        </span>
                      )}
                      <span className='text-xs text-muted-foreground ml-auto'>
                        {formatDistanceToNow(new Date(interaction.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {interaction.subject && (
                      <p className='font-medium text-sm'>{interaction.subject}</p>
                    )}
                    <p className='text-sm whitespace-pre-wrap'>{interaction.content}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
