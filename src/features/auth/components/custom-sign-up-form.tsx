'use client';

import { useSignUp } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

export function CustomSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!isLoaded) return null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signUp.create({
        emailAddress: email,
        password
      });

      await signUp.prepareEmailAddressVerification({
        strategy: 'email_code'
      });

      setPendingVerification(true);
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors: unknown[] }).errors)
        ? (err as { errors: { message?: string }[] }).errors[0]?.message
        : 'Sign up failed';
      setError(message ?? 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await signUp.attemptEmailAddressVerification({ code });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        router.push(process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL ?? '/dashboard/overview');
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'errors' in err && Array.isArray((err as { errors: unknown[] }).errors)
        ? (err as { errors: { message?: string }[] }).errors[0]?.message
        : 'Verification failed';
      setError(message ?? 'Verification failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <form onSubmit={handleVerify} className='w-full space-y-4'>
        <div className='space-y-2'>
          <Label htmlFor='code'>Verification code</Label>
          <Input
            id='code'
            type='text'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder='Enter code from email'
            required
            disabled={isLoading}
          />
        </div>
        {error && (
          <p className='text-sm text-destructive' role='alert'>
            {error}
          </p>
        )}
        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Verifying...' : 'Verify email'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUp} className='w-full space-y-4'>
      <div className='space-y-2'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com'
          required
          autoComplete='email'
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
          autoComplete='new-password'
          disabled={isLoading}
        />
      </div>
      {error && (
        <p className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      )}
      <Button type='submit' className='w-full' disabled={isLoading}>
        {isLoading ? 'Creating account...' : 'Sign up'}
      </Button>
      <p className='text-muted-foreground text-center text-sm'>
        Already have an account?{' '}
        <Link href='/auth/sign-in' className='text-primary hover:underline'>
          Sign in
        </Link>
      </p>
    </form>
  );
}
