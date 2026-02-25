export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/chat
 * Body: { messages: Array<{ role: "user" | "assistant", content: string }> }
 * Returns: { ok, text }
 *
 * Used by the LastLeg iOS app "Chat with Intel" panel in the lead detail sheet.
 * The first message is typically the assistant greeting about the company —
 * we use that as context for Gemini.
 */
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ ok: false, error: 'messages array is required' }, { status: 400 });
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: 'Gemini API key not configured' }, { status: 503 });
    }

    // Map messages to Gemini's content format.
    // Gemini uses "user" and "model" roles (not "assistant").
    // The conversation must start with a "user" turn, so we prepend a system prompt as the first user message.
    const systemPrompt =
      'You are a concise B2B sales intelligence assistant helping a field sales rep visiting industrial facilities. ' +
      'Answer questions about the company, its products, packaging needs, and how to start a conversation. ' +
      'Keep answers short and practical — the rep is on the road. ' +
      'If asked something you don\'t know for certain, say so briefly rather than guessing.';

    // Build Gemini contents array
    type GeminiContent = { role: 'user' | 'model'; parts: { text: string }[] };
    const contents: GeminiContent[] = [];

    // Inject system prompt as first user message with a model acknowledgement
    contents.push({ role: 'user', parts: [{ text: systemPrompt }] });
    contents.push({ role: 'model', parts: [{ text: 'Understood. Ready to help.' }] });

    for (const msg of messages) {
      if (typeof msg.content !== 'string' || !msg.content.trim()) continue;
      const geminiRole: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';
      contents.push({ role: geminiRole, parts: [{ text: msg.content }] });
    }

    // Gemini requires the last message to be from the user
    if (contents[contents.length - 1].role !== 'user') {
      return NextResponse.json({ ok: false, error: 'Last message must be from user' }, { status: 400 });
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini chat error:', errText);
      return NextResponse.json({ ok: false, error: 'Gemini request failed' }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    // Find last part with text — gemini-2.5-flash may emit a thought part first
    const parts: Array<{ text?: string }> = geminiData?.candidates?.[0]?.content?.parts ?? [];
    const text = [...parts].reverse().find((p) => typeof p.text === 'string' && p.text.trim())?.text ?? '';

    if (!text) {
      return NextResponse.json({ ok: false, error: 'No response from Gemini' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, text: text.trim() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Chat failed';
    console.error('chat error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
