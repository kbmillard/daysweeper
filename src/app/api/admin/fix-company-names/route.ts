import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Fix company names that start with 'x' followed by a UUID pattern
export async function POST(req: Request) {
  try {
    // Find all companies with names starting with 'x' followed by what looks like a UUID
    const companies = await prisma.company.findMany({
      where: {
        name: {
          startsWith: 'x'
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    // UUID pattern: x followed by 8-4-4-4-12 hex characters
    const uuidPattern = /^x[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}$/;
    
    const updates = [];
    let fixed = 0;

    for (const company of companies) {
      if (uuidPattern.test(company.name)) {
        // Remove the 'x' prefix
        const newName = company.name.substring(1);
        updates.push(
          prisma.company.update({
            where: { id: company.id },
            data: { name: newName }
          })
        );
        fixed++;
      }
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({
      ok: true,
      found: companies.length,
      fixed,
      message: `Fixed ${fixed} company name(s)`
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? 'Failed to fix company names' },
      { status: 500 }
    );
  }
}
