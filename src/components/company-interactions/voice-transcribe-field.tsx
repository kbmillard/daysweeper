'use client';

import { useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { IconMicrophone, IconPlayerStop } from '@tabler/icons-react';
import { useDeepgramLiveTranscription } from '@/hooks/use-deepgram-live-transcription';
import { cn } from '@/lib/utils';

const SPEAKER_RING = [
  'border-blue-500/40 bg-blue-500/10',
  'border-amber-500/40 bg-amber-500/10',
  'border-emerald-500/40 bg-emerald-500/10',
  'border-violet-500/40 bg-violet-500/10',
  'border-rose-500/40 bg-rose-500/10',
  'border-cyan-500/40 bg-cyan-500/10'
];

type Props = {
  /** Append a finalized transcript chunk to the note (use functional state in parent). */
  appendToContent: (chunk: string) => void;
  disabled?: boolean;
};

/**
 * Deepgram live captioning: appends finalized lines to the interaction content field.
 */
export function VoiceTranscribeField({ appendToContent, disabled }: Props) {
  const appendRef = useRef(appendToContent);
  appendRef.current = appendToContent;

  const onFinalText = useCallback((chunk: string) => {
    appendRef.current(chunk);
  }, []);

  const { status, interim, error, start, stop, isListening } =
    useDeepgramLiveTranscription({ onFinalText });

  return (
    <div className='space-y-2 rounded-lg border border-dashed p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-sm font-medium'>Voice to text</span>
        {!isListening ? (
          <Button
            type='button'
            size='sm'
            variant='secondary'
            disabled={disabled || status === 'connecting'}
            onClick={() => void start()}
          >
            <IconMicrophone className='mr-1.5 h-4 w-4' />
            {status === 'connecting' ? 'Connecting…' : 'Start microphone'}
          </Button>
        ) : (
          <Button type='button' size='sm' variant='destructive' onClick={stop}>
            <IconPlayerStop className='mr-1.5 h-4 w-4' />
            Stop
          </Button>
        )}
        {status === 'error' && (
          <Button
            type='button'
            size='sm'
            variant='outline'
            onClick={() => void start()}
          >
            Retry
          </Button>
        )}
      </div>
      <p className='text-muted-foreground text-xs'>
        Uses Deepgram (speaker labels when diarization detects multiple voices).
        Text is appended to the note below. If you see “Insufficient
        permissions,” that almost always means the Deepgram API key on the server
        (Vercel <code className='text-foreground'>DEEPGRAM_API_KEY</code>) — not
        your Deepgram account email or browser mic owner settings.
      </p>
      {error && <p className='text-destructive text-xs'>{error}</p>}
      {(isListening || interim) && (
        <div
          className={cn(
            'min-h-[2.5rem] rounded-md border px-2 py-1.5 text-sm',
            isListening ? SPEAKER_RING[0] : 'border-muted bg-muted/30'
          )}
        >
          {interim ? (
            <span className='text-muted-foreground italic'>{interim}</span>
          ) : (
            <span className='text-muted-foreground'>Listening…</span>
          )}
        </div>
      )}
    </div>
  );
}
