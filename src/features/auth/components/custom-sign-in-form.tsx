'use client';

import { useSignIn } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function CustomSignInForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!isLoaded) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signIn.create({
        identifier: email,
        password
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL ?? '/dashboard/overview');
      } else {
        setError('Additional verification needed. Please try again.');
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors: unknown[] }).errors)
        ? (err as { errors: { message?: string }[] }).errors[0]?.message
        : 'Sign in failed';
      setError(message ?? 'Sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='w-full space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='email'>Email or phone</Label>
        <Input
          id='email'
          type='text'
          inputMode='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com or +1 555 000 0000'
          required
          autoComplete='username'
          disabled={isLoading}
        />
      </div>
      <div className='space-y-2'>
        <Label htmlFor='password'>Password</Label>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='••••••••'
          required
          autoComplete='current-password'
          disabled={isLoading}
        />
      </div>
      {error && (
        <p className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      )}
      <Button type='submit' className='w-full' disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
      <p className='text-muted-foreground text-center text-sm'>
        Don&apos;t have an account?{' '}
        <Link href='/auth/sign-up' className='text-primary hover:underline'>
          Sign up
        </Link>
      </p>
    </form>
  );
}
