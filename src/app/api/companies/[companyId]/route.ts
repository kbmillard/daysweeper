import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { COMPANY_STATUSES } from '@/constants/company-status';

// PATCH - Update company (e.g. status)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    const body = await req.json();

    const { status } = body;

    if (status !== undefined && status !== null) {
      if (typeof status !== 'string' || (status !== '' && !(COMPANY_STATUSES as readonly string[]).includes(status))) {
        return NextResponse.json(
          { error: 'Invalid status. Must be one of: ' + COMPANY_STATUSES.join(', ') },
          { status: 400 }
        );
      }
    }

    const company = await prisma.company.update({
      where: { id: companyId },
      data: {
        ...(status !== undefined && { status: status === '' ? null : status }),
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
