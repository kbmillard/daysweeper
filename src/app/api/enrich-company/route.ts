export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
    const prompt = `You are a B2B sales intelligence assistant. Given the company name and location, return a JSON object with these exact fields:
- legalName: the company's proper legal/trade name (string)
- industry: the primary industry or product category, concise (string, ≤5 words)
- employees: estimated headcount at this facility as an integer (use 0 if unknown)
- siteFunction: what this specific site does, e.g. "Manufacturing Plant", "Distribution Center", "HQ & R&D" (string)
- summary: 1-2 sentence plain-English summary of what this company/facility does, written for a sales rep visiting the site (string)
- contactPhone: main phone number if you know it with confidence, otherwise null

Company: ${name.trim()}${locationContext}

Respond ONLY with valid JSON, no markdown, no explanation.`;

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 }
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

    const data: SnapshotData = {
      legalName: typeof parsed.legalName === 'string' ? parsed.legalName : name.trim(),
      industry: typeof parsed.industry === 'string' ? parsed.industry : 'Unknown',
      employees: typeof parsed.employees === 'number' ? Math.max(0, Math.round(parsed.employees)) : 0,
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
              model: 'gemini-2.5-flash',
              updatedAt: new Date()
            },
            update: {
              enrichedJson: { snapshot: data },
              model: 'gemini-2.5-flash',
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
