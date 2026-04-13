'use client';

import { useCallback, useRef, useState } from 'react';

export type TranscriptSegment = { speaker: number; text: string };

type Status = 'idle' | 'connecting' | 'listening' | 'error';

type DgWord = { word?: string; punctuated_word?: string; speaker?: number };

function segmentsFromWords(words: DgWord[]): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  for (const w of words) {
    const piece = (w.punctuated_word ?? w.word ?? '').trim();
    if (!piece) continue;
    const speaker = typeof w.speaker === 'number' ? w.speaker : 0;
    const last = segments[segments.length - 1];
    if (last && last.speaker === speaker) {
      last.text = `${last.text} ${piece}`.trim();
    } else {
      segments.push({ speaker, text: piece });
    }
  }
  return segments;
}

function userMediaErrorMessage(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
      return 'Microphone access was blocked by the browser or OS. Allow the microphone for this site (lock icon → Site settings), then retry.';
    }
    if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Plug in or enable a mic and retry.';
    }
    if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
      return 'The microphone is in use by another app or could not be started. Close other apps using the mic and retry.';
    }
    return e.message || 'Could not access the microphone.';
  }
  if (e instanceof Error) return e.message;
  return 'Could not access the microphone.';
}

function formatAlternative(alt: {
  transcript?: string;
  words?: DgWord[];
}): string {
  if (alt.words?.length) {
    return segmentsFromWords(alt.words)
      .map((s) => `Speaker ${s.speaker + 1}: ${s.text}`)
      .join('\n');
  }
  return (alt.transcript ?? '').trim();
}

/**
 * Live microphone → Deepgram WebSocket (token subprotocol). Updates interim + finalized note text.
 */
export function useDeepgramLiveTranscription(options: {
  onFinalText: (chunk: string) => void;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  const cleanupAudio = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    gainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    gainRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'CloseStream' }));
      } catch {
        /* ignore */
      }
      ws.close();
    }
    cleanupAudio();
    setStatus('idle');
    setInterim('');
  }, [cleanupAudio]);

  const onFinalTextRef = useRef(options.onFinalText);
  onFinalTextRef.current = options.onFinalText;

  const start = useCallback(async () => {
    setError(null);
    setInterim('');
    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1
        }
      });
      streamRef.current = stream;

      const tokenRes = await fetch('/api/deepgram-token', { method: 'POST' });
      const tokenBody = await tokenRes.json().catch(() => ({}));
      if (!tokenRes.ok) {
        const b = tokenBody as {
          error?: string;
          hint?: string;
          err_msg?: string;
        };
        const parts = [
          typeof b.error === 'string' ? b.error : undefined,
          typeof b.hint === 'string' ? b.hint : undefined
        ].filter(Boolean);
        const base =
          parts.length > 0 ? parts.join(' ') : 'Could not get Deepgram token';
        const deepgramNote =
          /insufficient permissions/i.test(base) ||
          /insufficient permissions/i.test(String(b.err_msg ?? ''))
            ? ' (This refers to your Deepgram API key / Vercel env — not your Deepgram “Owner” role or app login email.)'
            : '';
        throw new Error(`${base}${deepgramNote}`);
      }
      const { access_token: accessToken, wssHost } = tokenBody as {
        access_token: string;
        wssHost?: string;
      };
      if (!accessToken) throw new Error('No access token from server');
      const jwt = accessToken.trim();
      const host = wssHost || 'api.deepgram.com';

      const audioContext = new AudioContext();
      audioCtxRef.current = audioContext;
      const sampleRate = audioContext.sampleRate;

      const params = new URLSearchParams({
        model: 'nova-2',
        language: 'en-US',
        smart_format: 'true',
        punctuate: 'true',
        diarize: 'true',
        interim_results: 'true',
        encoding: 'linear16',
        sample_rate: String(Math.round(sampleRate)),
        channels: '1'
      });

      const url = `wss://${host}/v1/listen?${params.toString()}`;
      const ws = new WebSocket(url, ['bearer', jwt]);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const t = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error('WebSocket connect timeout (15s).'));
        }, 15000);
        const finish = () => {
          window.clearTimeout(t);
        };
        ws.onopen = () => {
          if (settled) return;
          settled = true;
          finish();
          resolve();
        };
        ws.onerror = () => {
          if (settled) return;
          settled = true;
          finish();
          reject(
            new Error(
              'WebSocket connection error. If this persists, check firewall/VPN and that DEEPGRAM_API_URL matches your Deepgram project region.'
            )
          );
        };
        ws.onclose = (ev) => {
          if (settled) return;
          settled = true;
          finish();
          const detail =
            ev.code !== 1000 && (ev.reason || ev.code)
              ? ` (code ${ev.code}${ev.reason ? `: ${ev.reason}` : ''})`
              : '';
          reject(new Error(`Could not open Deepgram WebSocket${detail}.`));
        };
      });

      const source = audioContext.createMediaStreamSource(stream);
      sourceRef.current = source;
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      const gain = audioContext.createGain();
      gain.gain.value = 0;
      gainRef.current = gain;

      processor.onaudioprocess = (ev) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const input = ev.inputBuffer.getChannelData(0);
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          const s = Math.max(-1, Math.min(1, input[i]));
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }
        ws.send(pcm.buffer);
      };

      source.connect(processor);
      processor.connect(gain);
      gain.connect(audioContext.destination);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            channel?: {
              alternatives?: Array<{ transcript?: string; words?: DgWord[] }>;
            };
            is_final?: boolean;
          };
          if (data.type !== 'Results') return;
          const alt = data.channel?.alternatives?.[0];
          if (!alt) return;
          if (data.is_final) {
            const text = formatAlternative(alt);
            if (text) onFinalTextRef.current(text);
            setInterim('');
          } else {
            setInterim((alt.transcript ?? '').trim());
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onclose = () => {
        cleanupAudio();
        setStatus((s) => (s === 'listening' ? 'idle' : s));
        setInterim('');
        wsRef.current = null;
      };

      setStatus('listening');
    } catch (e) {
      cleanupAudio();
      const msg =
        e instanceof DOMException
          ? userMediaErrorMessage(e)
          : e instanceof Error
            ? e.message
            : 'Failed to start';
      setError(msg);
      setStatus('error');
      wsRef.current = null;
    }
  }, [cleanupAudio]);

  return {
    status,
    interim,
    error,
    start,
    stop,
    isListening: status === 'listening'
  };
}
