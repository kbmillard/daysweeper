'use client';

import { useParams } from 'next/navigation';
import { useTarget, useUpdateTarget } from '@/lib/targets';
import { NotesPanel } from '@/components/companies/NotesPanel';
import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  automotiveSupplyChain,
  listGroups,
  listSubtypes,
  normalizeTierLabel,
  type SupplyTier
} from '@/taxonomy/automotive';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function CompanyDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: target, isLoading } = useTarget(id);
  const updateTarget = useUpdateTarget(id);

  const [accountState, setAccountState] = useState<string>('');
  const [supplyTier, setSupplyTier] = useState<string>('');
  const [supplyGroup, setSupplyGroup] = useState<string>('');
  const [supplySubtype, setSupplySubtype] = useState<string>('');

  useEffect(() => {
    if (target) {
      setAccountState(target.accountState || '');
      setSupplyTier(target.supplyTier || '');
      setSupplyGroup(target.supplyGroup || '');
      setSupplySubtype(target.supplySubtype || '');
    }
  }, [target]);

  const handleSaveAccountState = async () => {
    try {
      await updateTarget.mutateAsync({ accountState });
      toast.success('Account state updated');
    } catch (error) {
      toast.error('Failed to update account state');
    }
  };

  const handleSaveTaxonomy = async () => {
    try {
      await updateTarget.mutateAsync({
        supplyTier: supplyTier || null,
        supplyGroup: supplyGroup || null,
        supplySubtype: supplySubtype || null
      });
      toast.success('Taxonomy updated');
    } catch (error) {
      toast.error('Failed to update taxonomy');
    }
  };

  const handleTierChange = (newTier: string) => {
    setSupplyTier(newTier === 'NONE' ? '' : newTier);
    setSupplyGroup('');
    setSupplySubtype('');
  };

  const handleGroupChange = (newGroup: string) => {
    setSupplyGroup(newGroup === 'NONE_GROUP' ? '' : newGroup);
    setSupplySubtype('');
  };

  const getTierDescription = (tier: string): string => {
    const tierKey = tier as keyof typeof automotiveSupplyChain.automotive_supply_chain;
    const tierData = automotiveSupplyChain.automotive_supply_chain[tierKey];
    return tierData?.description || '';
  };

  const availableGroups = supplyTier ? listGroups(supplyTier as SupplyTier) : [];
  const availableSubtypes =
    supplyTier && supplyGroup
      ? listSubtypes(supplyTier as SupplyTier, supplyGroup)
      : [];

  if (isLoading) {
    return (
      <PageContainer>
        <div className='flex items-center justify-center h-64'>
          <div className='text-muted-foreground'>Loading...</div>
        </div>
      </PageContainer>
    );
  }

  if (!target) {
    return (
      <PageContainer>
        <div className='flex items-center justify-center h-64'>
          <div className='text-muted-foreground'>Company not found</div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>{target.company}</h2>
        </div>

        <div className='grid grid-cols-1 lg:grid-cols-2 gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
              <CardDescription>Company information</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <label className='text-sm font-medium'>Company</label>
                <p className='text-sm text-muted-foreground'>{target.company}</p>
              </div>
              {target.website && (
                <div>
                  <label className='text-sm font-medium'>Website</label>
                  <p className='text-sm text-muted-foreground'>
                    <a
                      href={target.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary hover:underline'
                    >
                      {target.website}
                    </a>
                  </p>
                </div>
              )}
              {target.phone && (
                <div>
                  <label className='text-sm font-medium'>Phone</label>
                  <p className='text-sm text-muted-foreground'>{target.phone}</p>
                </div>
              )}
              {target.email && (
                <div>
                  <label className='text-sm font-medium'>Email</label>
                  <p className='text-sm text-muted-foreground'>{target.email}</p>
                </div>
              )}
              <div>
                <label className='text-sm font-medium'>Address</label>
                <p className='text-sm text-muted-foreground'>{target.addressRaw}</p>
              </div>
              <div className='flex items-center gap-2'>
                <label className='text-sm font-medium'>Account State</label>
                <Select value={accountState} onValueChange={setAccountState}>
                  <SelectTrigger className='w-[200px]'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='ACCOUNT'>Account</SelectItem>
                    <SelectItem value='NEW_UNCONTACTED'>New - Uncontacted</SelectItem>
                    <SelectItem value='NEW_CONTACTED_NO_ANSWER'>
                      New - No Answer
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size='sm'
                  onClick={handleSaveAccountState}
                  disabled={updateTarget.isPending}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Taxonomy</CardTitle>
              <CardDescription>Automotive supply chain classification</CardDescription>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div>
                <label className='text-sm font-medium mb-2 block'>Supply Tier</label>
                <Select value={supplyTier || undefined} onValueChange={handleTierChange}>
                  <SelectTrigger>
                    <SelectValue placeholder='Select tier' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='NONE'>None</SelectItem>
                    <SelectItem value='OEM'>OEM</SelectItem>
                    <SelectItem value='TIER_1'>Tier 1</SelectItem>
                    <SelectItem value='TIER_2'>Tier 2</SelectItem>
                    <SelectItem value='TIER_3'>Tier 3</SelectItem>
                    <SelectItem value='LOGISTICS_3PL'>Logistics & 3PL</SelectItem>
                    <SelectItem value='TOOLING_CAPITAL_EQUIPMENT'>
                      Tooling & Capital Equipment
                    </SelectItem>
                    <SelectItem value='AFTERMARKET_SERVICES'>
                      Aftermarket & Services
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {supplyTier && availableGroups.length > 0 && (
                <div>
                  <label className='text-sm font-medium mb-2 block'>Group</label>
                  <Select value={supplyGroup || undefined} onValueChange={handleGroupChange}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select group' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='NONE_GROUP'>None</SelectItem>
                      {availableGroups.map((g) => (
                        <SelectItem key={g} value={g}>
                          {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {supplyTier && supplyGroup && availableSubtypes.length > 0 && (
                <div>
                  <label className='text-sm font-medium mb-2 block'>Subtype</label>
                  <Select value={supplySubtype} onValueChange={setSupplySubtype}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select subtype' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='NONE_SUBTYPE'>None</SelectItem>
                      {availableSubtypes.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {supplyTier && !availableGroups.length && (
                <div>
                  <label className='text-sm font-medium mb-2 block'>Subtype</label>
                  <Select value={supplySubtype || undefined} onValueChange={(v) => setSupplySubtype(v === 'NONE_SUBTYPE' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder='Select subtype' />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value='NONE_SUBTYPE'>None</SelectItem>
                      {listSubtypes(supplyTier as SupplyTier).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {supplyTier && (
                <div className='rounded-lg bg-muted p-3'>
                  <p className='text-sm text-muted-foreground'>
                    {getTierDescription(supplyTier)}
                  </p>
                </div>
              )}

              <Button
                onClick={handleSaveTaxonomy}
                disabled={updateTarget.isPending}
              >
                Save Taxonomy
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Map</CardTitle>
              <CardDescription>Location visualization</CardDescription>
            </CardHeader>
            <CardContent>
              <div className='h-64 rounded-lg border bg-muted flex items-center justify-center'>
                <p className='text-sm text-muted-foreground'>Map placeholder</p>
              </div>
            </CardContent>
          </Card>

          <NotesPanel targetId={id} />
        </div>
      </div>
    </PageContainer>
  );
}
