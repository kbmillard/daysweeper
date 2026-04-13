'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { useEffect, useState } from 'react';

type CompanyOption = { id: string; name: string };

/**
 * Company name input with debounced search to surface existing records (avoid duplicates).
 */
export function CompanyNameSearchField({
  id = 'company-name',
  label = 'Company name',
  value,
  onChange,
  placeholder = 'Company name',
  required,
  basePath,
  className
}: {
  id?: string;
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  basePath: 'dashboard' | 'map';
  className?: string;
}) {
  const root = basePath === 'map' ? '/map' : '/dashboard';
  const [matches, setMatches] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!q) {
      setMatches([]);
      setLoading(false);
      return;
    }
    const ac = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetch(`/api/companies?search=${encodeURIComponent(q)}&limit=30`, {
        signal: ac.signal
      })
        .then((r) => r.json())
        .then((data) => {
          if (data?.error) {
            setMatches([]);
            return;
          }
          setMatches((data.companies ?? []) as CompanyOption[]);
        })
        .catch((e: unknown) => {
          if ((e as { name?: string })?.name === 'AbortError') return;
          setMatches([]);
        })
        .finally(() => {
          if (!ac.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [value]);

  const showMatches = value.trim().length > 0 && (loading || matches.length > 0);

  return (
    <div className={className}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className='mt-1'
        autoComplete='off'
      />
      {showMatches && (
        <div className='mt-2 rounded-md border bg-popover p-2 text-sm shadow-sm'>
          {loading ? (
            <p className='text-muted-foreground text-xs'>Searching existing companies…</p>
          ) : matches.length > 0 ? (
            <>
              <p className='text-muted-foreground mb-1.5 text-xs font-medium'>
                Existing companies — open one to avoid creating a duplicate
              </p>
              <ul className='max-h-40 space-y-1 overflow-auto'>
                {matches.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`${root}/companies/${c.id}`}
                      className='text-primary hover:underline'
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className='text-muted-foreground text-xs'>No close name matches in the database.</p>
          )}
        </div>
      )}
    </div>
  );
}
