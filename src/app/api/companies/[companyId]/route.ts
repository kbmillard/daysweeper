import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COMPANY_STATUSES } from '@/constants/company-status';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, website: true, phone: true }
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json({ company });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch company';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH - Update company (e.g. status)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await req.json();

    const { status, parentCompanyId } = body;

    if (status !== undefined && status !== null) {
      if (typeof status !== 'string' || (status !== '' && !(COMPANY_STATUSES as readonly string[]).includes(status))) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: ' + COMPANY_STATUSES.join(', ') },
          { status: 400 }
        );
      }
    }

    if (parentCompanyId !== undefined) {
      if (parentCompanyId !== null && typeof parentCompanyId !== 'string') {
        return NextResponse.json(
          { error: 'parentCompanyId must be a string or null' },
          { status: 400 }
        );
      }
      if (parentCompanyId) {
        const parent = await prisma.company.findUnique({
          where: { id: parentCompanyId }
        });
        if (!parent) {
          return NextResponse.json(
            { error: 'Parent company not found' },
            { status: 404 }
          );
        }
        if (parent.id === companyId) {
          return NextResponse.json(
            { error: 'Company cannot be its own parent' },
            { status: 400 }
          );
        }
      }
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(status !== undefined && { status: status === '' ? null : status }),
        ...(parentCompanyId !== undefined && {
          parentCompanyDbId: parentCompanyId === '' || parentCompanyId === null ? null : parentCompanyId
        }),
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ company });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to update company' },
      { status: 500 }
    );
  }
}
