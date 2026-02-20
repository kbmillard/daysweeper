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
      select: { id: true, name: true, website: true, phone: true, email: true }
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

// DELETE - Delete a company
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ companyId: string }> }
) {
  try {
    const { companyId } = await params;
    await prisma.company.delete({ where: { id: companyId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: error?.message ?? 'Failed to delete company' },
      { status: 500 }
    );
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

    const { status, parentCompanyId, name, website, phone, email } = body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'name must be a non-empty string' },
          { status: 400 }
        );
      }
    }
    if (website !== undefined && website !== null && typeof website !== 'string') {
      return NextResponse.json({ error: 'website must be a string or null' }, { status: 400 });
    }
    if (phone !== undefined && phone !== null && typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone must be a string or null' }, { status: 400 });
    }
    if (email !== undefined && email !== null && typeof email !== 'string') {
      return NextResponse.json({ error: 'email must be a string or null' }, { status: 400 });
    }

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
        ...(name !== undefined && { name: name.trim() }),
        ...(website !== undefined && { website: website === '' ? null : website?.trim() ?? null }),
        ...(phone !== undefined && { phone: phone === '' ? null : phone?.trim() ?? null }),
        ...(email !== undefined && { email: email === '' ? null : email?.trim() ?? null }),
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
