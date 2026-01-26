'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTargets, useCreateTarget, type TargetFilters } from '@/lib/targets';
import { useDebounce } from '@/hooks/use-debounce';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { normalizeTierLabel, listGroups, listSubtypes, type SupplyTier } from '@/taxonomy/automotive';
import dayjs from 'dayjs';
import PageContainer from '@/components/layout/page-container';
import { toast } from 'sonner';

export default function CompaniesTable() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [state, setState] = useState<string>('');
  const [tier, setTier] = useState<string>('');
  const [group, setGroup] = useState<string>('');
  const [subtype, setSubtype] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const debouncedSearch = useDebounce(search, 300);

  const filters: TargetFilters = {
    q: debouncedSearch || undefined,
    state: state && state !== 'ALL' ? state : undefined,
    tier: tier || undefined,
    group: group || undefined,
    subtype: subtype || undefined,
    tags: tags.length > 0 ? tags : undefined
  };

  const { data = [], isLoading, isFetching } = useTargets(filters);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTierChange = (newTier: string) => {
    setTier(newTier === 'ALL_TIERS' ? '' : newTier);
    setGroup('');
    setSubtype('');
  };

  const handleGroupChange = (newGroup: string) => {
    setGroup(newGroup === 'ALL_GROUPS' ? '' : newGroup);
    setSubtype('');
  };

  // Extract city from addressRaw (best effort)
  const extractCity = (address: string | null | undefined): string => {
    if (!address) return 'N/A';
    try {
      // Simple extraction - look for common patterns
      const parts = address.split(',').map((p) => p.trim());
      if (parts.length >= 2) {
        return parts[parts.length - 2]; // Usually city is second to last
      }
      return address.split(' ')[0] || 'N/A';
    } catch {
      return 'N/A';
    }
  };

  // Get tags from notes (union of all tags from recent notes)
  const getTagsFromNotes = (target: any): string[] => {
    try {
      if (!target?.TargetNote || !Array.isArray(target.TargetNote) || target.TargetNote.length === 0) return [];
      const allTags = new Set<string>();
      target.TargetNote.forEach((note: any) => {
        if (note?.tags && Array.isArray(note.tags)) {
          note.tags.forEach((tag: string) => allTags.add(tag));
        }
      });
      return Array.from(allTags);
    } catch {
      return [];
    }
  };

  const availableGroups = tier ? listGroups(tier as SupplyTier) : [];
  const availableSubtypes = tier && group ? listSubtypes(tier as SupplyTier, group) : [];

  const createTarget = useCreateTarget();
  const [quickAddCompany, setQuickAddCompany] = useState('');
  const [quickAddAddress, setQuickAddAddress] = useState('');

  const handleQuickAdd = async () => {
    if (!quickAddCompany.trim()) {
      toast.error('Company name is required');
      return;
    }
    try {
      await createTarget.mutateAsync({
        company: quickAddCompany.trim(),
        addressRaw: quickAddAddress.trim() || '',
      });
      toast.success('Company created successfully');
      setQuickAddCompany('');
      setQuickAddAddress('');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create company');
    }
  };

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-2xl font-bold tracking-tight'>Companies</h2>
        </div>
        
        {/* QuickAddCompany inline form */}
        <div className='flex gap-2 items-end rounded-lg border p-3 bg-muted/30'>
          <div className='flex-1'>
            <label className='text-xs text-muted-foreground mb-1 block'>Company Name</label>
            <Input
              placeholder='Company name'
              value={quickAddCompany}
              onChange={(e) => setQuickAddCompany(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickAddCompany.trim()) {
                  handleQuickAdd();
                }
              }}
            />
          </div>
          <div className='flex-1'>
            <label className='text-xs text-muted-foreground mb-1 block'>Address (optional)</label>
            <Input
              placeholder='Address'
              value={quickAddAddress}
              onChange={(e) => setQuickAddAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && quickAddCompany.trim()) {
                  handleQuickAdd();
                }
              }}
            />
          </div>
          <Button
            onClick={handleQuickAdd}
            disabled={!quickAddCompany.trim() || createTarget.isPending}
          >
            {createTarget.isPending ? 'Creating...' : 'Add Company'}
          </Button>
        </div>

        <div className='space-y-4'>
      <div className='flex flex-wrap gap-4'>
        <Input
          placeholder='Search companies...'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className='max-w-sm'
        />
        <Select value={state || undefined} onValueChange={(v) => setState(v || '')}>
          <SelectTrigger className='w-[200px]'>
            <SelectValue placeholder='Account State' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL'>All States</SelectItem>
            <SelectItem value='ACCOUNT'>Account</SelectItem>
            <SelectItem value='NEW_UNCONTACTED'>New - Uncontacted</SelectItem>
            <SelectItem value='NEW_CONTACTED_NO_ANSWER'>New - No Answer</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tier || undefined} onValueChange={handleTierChange}>
          <SelectTrigger className='w-[200px]'>
            <SelectValue placeholder='Supply Tier' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='ALL_TIERS'>All Tiers</SelectItem>
            <SelectItem value='OEM'>OEM</SelectItem>
            <SelectItem value='TIER_1'>Tier 1</SelectItem>
            <SelectItem value='TIER_2'>Tier 2</SelectItem>
            <SelectItem value='TIER_3'>Tier 3</SelectItem>
            <SelectItem value='LOGISTICS_3PL'>Logistics & 3PL</SelectItem>
            <SelectItem value='TOOLING_CAPITAL_EQUIPMENT'>Tooling & Capital Equipment</SelectItem>
            <SelectItem value='AFTERMARKET_SERVICES'>Aftermarket & Services</SelectItem>
          </SelectContent>
        </Select>
        {tier && availableGroups.length > 0 && (
          <Select value={group} onValueChange={handleGroupChange}>
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Group' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL_GROUPS'>All Groups</SelectItem>
              {availableGroups.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tier && group && availableSubtypes.length > 0 && (
          <Select value={subtype || undefined} onValueChange={(v) => setSubtype(v === 'ALL_SUBTYPES' ? '' : v)}>
            <SelectTrigger className='w-[200px]'>
              <SelectValue placeholder='Subtype' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='ALL_SUBTYPES'>All Subtypes</SelectItem>
              {availableSubtypes.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className='flex gap-2 items-center'>
          <Input
            placeholder='Add tag filter...'
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddTag();
              }
            }}
            className='w-[150px]'
          />
          <Button size='sm' onClick={handleAddTag}>
            Add
          </Button>
        </div>
      </div>

      {tags.length > 0 && (
        <div className='flex flex-wrap gap-2'>
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant='secondary'
              className='cursor-pointer'
              onClick={() => handleRemoveTag(tag)}
            >
              {tag} ×
            </Badge>
          ))}
        </div>
      )}

      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Subtype</TableHead>
              <TableHead>Account State</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className='text-center'>
                  Loading...
                </TableCell>
              </TableRow>
            ) : Array.isArray(data) && data.length > 0 ? (
              data
                .filter((target: any) => target && target.id)
                .map((target: any) => {
                const targetTags = getTagsFromNotes(target);
                return (
                  <TableRow
                    key={target.id}
                    className='cursor-pointer'
                    onClick={() => router.push(`/dashboard/companies/${target.id}`)}
                  >
                    <TableCell className='font-medium'>{target?.company || '-'}</TableCell>
                    <TableCell>
                      {target?.supplyTier ? (
                        <Badge variant='outline'>
                          {normalizeTierLabel(target.supplyTier)}
                        </Badge>
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {target?.supplySubtype || (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {target?.accountState ? (
                        <Badge
                          variant={
                            target.accountState === 'ACCOUNT'
                              ? 'default'
                              : target.accountState === 'NEW_UNCONTACTED'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {String(target.accountState).replace('_', ' ')}
                        </Badge>
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>{extractCity(target?.addressRaw)}</TableCell>
                    <TableCell>
                      {targetTags.length > 0 ? (
                        <div className='flex flex-wrap gap-1'>
                          {targetTags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant='outline' className='text-xs'>
                              {tag}
                            </Badge>
                          ))}
                          {targetTags.length > 3 && (
                            <Badge variant='outline' className='text-xs'>
                              +{targetTags.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className='text-muted-foreground'>-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {target?.createdAt ? dayjs(target.createdAt).format('MMM D, YYYY') : '-'}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={7} className='text-center text-muted-foreground'>
                  No companies found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {isFetching && data.length > 0 && (
        <div className="text-xs text-muted-foreground">Refreshing…</div>
      )}
        </div>
      </div>
    </PageContainer>
  );
}
