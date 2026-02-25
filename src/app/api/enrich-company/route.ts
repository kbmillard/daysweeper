export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;

type SnapshotData = {
  legalName: string;
  industry: string;
  employees: number;
  siteFunction: string;
  summary: string;
  contactPhone: string | null;
};

/** Extract the text response from a Gemini candidate — skips thought/reasoning parts. */
function extractText(candidate: { content?: { parts?: Array<{ text?: string }> } }): string {
  const parts = candidate?.content?.parts ?? [];
  for (let i = parts.length - 1; i >= 0; i--) {
    const t = parts[i]?.text;
    if (typeof t === 'string' && t.trim()) return t;
  }
  return '';
}

function isSnapshotData(v: unknown): v is SnapshotData {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.legalName === 'string' && typeof o.summary === 'string';
}

/**
 * POST /api/enrich-company
 * Body: { name: string, address?: string, targetId?: string }
 * Returns: { ok, provider, cached, data: SnapshotData }
 *
 * If targetId is provided:
 *   - Checks TargetEnrichment.enrichedJson for a cached snapshot first
 *   - Saves the Gemini result back to enrichedJson after a fresh call
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, address, targetId } = body as {
      name?: string;
      address?: string;
      targetId?: string;
    };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
    }

    // --- Cache read ---
    if (targetId && typeof targetId === 'string') {
      try {
        const existing = await prisma.targetEnrichment.findUnique({
          where: { targetId },
          select: { enrichedJson: true }
        });
        if (existing?.enrichedJson) {
          const cached = (existing.enrichedJson as Record<string, unknown>).snapshot;
          if (isSnapshotData(cached)) {
            return NextResponse.json({ ok: true, provider: 'cache', cached: true, data: cached });
          }
        }
      } catch {
        // DB miss — fall through to Gemini
      }
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ ok: false, error: 'Gemini API key not configured' }, { status: 503 });
    }

    // --- Gemini call ---
    const locationContext = address ? ` located at ${address}` : '';
    const prompt = `You are a B2B sales intelligence assistant. Fill in this JSON for the company below. Return ONLY the raw JSON object, no markdown, no code fences, no explanation.

{"legalName":"...","industry":"...","employees":0,"siteFunction":"...","summary":"...","contactPhone":null}

Fields:
- legalName: proper legal/trade name
- industry: primary industry, 5 words max
- employees: integer headcount estimate (0 if unknown)
- siteFunction: what this site does, e.g. "Manufacturing Plant" (6 words max)
- summary: 1-2 sentences for a sales rep visiting this site
- contactPhone: phone number string if known, otherwise null

Company: ${name.trim()}${locationContext}`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', errText);
      return NextResponse.json({ ok: false, error: 'Gemini request failed' }, { status: 502 });
    }

    const geminiData = await geminiRes.json();
    const raw = extractText(geminiData?.candidates?.[0] ?? {});
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

    if (!cleaned) {
      console.error('Empty Gemini response:', JSON.stringify(geminiData).slice(0, 500));
      return NextResponse.json({ ok: false, error: 'enrichment_failed' }, { status: 422 });
    }

    let parsed: Partial<SnapshotData>;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse Gemini JSON:', cleaned);
      return NextResponse.json({ ok: false, error: 'enrichment_failed' }, { status: 422 });
    }

    // Parse employees — handle integer, float, or string ranges like "10-50" or "50+"
    const rawEmployees = parsed.employees as number | string | undefined;
    let employees = 0;
    if (typeof rawEmployees === 'number') {
      employees = Math.max(0, Math.round(rawEmployees));
    } else if (typeof rawEmployees === 'string') {
      const match = rawEmployees.match(/\d+/);
      if (match) employees = parseInt(match[0], 10);
    }

    const data: SnapshotData = {
      legalName: typeof parsed.legalName === 'string' ? parsed.legalName : name.trim(),
      industry: typeof parsed.industry === 'string' ? parsed.industry : 'Unknown',
      employees,
      siteFunction: typeof parsed.siteFunction === 'string' ? parsed.siteFunction : 'Facility',
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      contactPhone:
        typeof parsed.contactPhone === 'string' && parsed.contactPhone ? parsed.contactPhone : null
    };

    // --- Cache write ---
    if (targetId && typeof targetId === 'string') {
      try {
        // Check if target actually exists before upserting
        const targetExists = await prisma.target.findUnique({
          where: { id: targetId },
          select: { id: true }
        });
        if (targetExists) {
          await prisma.targetEnrichment.upsert({
            where: { targetId },
            create: {
              id: `enr_${targetId}`,
              targetId,
              enrichedJson: { snapshot: data },
              model: 'gemini-2.5-flash-lite',
              updatedAt: new Date()
            },
            update: {
              enrichedJson: { snapshot: data },
              model: 'gemini-2.5-flash-lite',
              updatedAt: new Date()
            }
          });
        }
      } catch (e) {
        // Non-fatal — still return the data even if cache write fails
        console.error('Failed to cache enrichment:', e);
      }
    }

    return NextResponse.json({ ok: true, provider: 'gemini', cached: false, data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Enrichment failed';
    console.error('enrich-company error:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
