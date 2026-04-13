'use client';

import { cn } from '@/lib/utils';

const LINE_COLORS = [
  'text-blue-700 dark:text-blue-300',
  'text-amber-700 dark:text-amber-300',
  'text-emerald-700 dark:text-emerald-300',
  'text-violet-700 dark:text-violet-300',
  'text-rose-700 dark:text-rose-300',
  'text-cyan-700 dark:text-cyan-300'
];

const SPEAKER_LINE = /^Speaker (\d+):\s*(.*)$/;

/**
 * Renders note text; lines like "Speaker 1: …" (from Deepgram diarization) get subtle colors.
 */
export function TranscriptSnippet({ text }: { text: string }) {
  const lines = text.split('\n');
  const hasSpeakerLines = lines.some((l) => SPEAKER_LINE.test(l.trim()));

  if (!hasSpeakerLines) {
    return <p className='text-sm whitespace-pre-wrap'>{text}</p>;
  }

  return (
    <div className='space-y-1 text-sm'>
      {lines.map((line, i) => {
        const m = line.trim().match(SPEAKER_LINE);
        if (!m) {
          return line.length > 0 ? (
            <p key={i} className='text-muted-foreground whitespace-pre-wrap'>
              {line}
            </p>
          ) : (
            <br key={i} />
          );
        }
        const n = parseInt(m[1], 10) || 1;
        const color = LINE_COLORS[(n - 1) % LINE_COLORS.length];
        return (
          <p key={i} className={cn('whitespace-pre-wrap', color)}>
            <span className='font-medium'>Speaker {m[1]}:</span> {m[2]}
          </p>
        );
      })}
    </div>
  );
}
