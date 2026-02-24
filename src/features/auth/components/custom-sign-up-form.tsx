'use client';

import { useSignUp } from '@clerk/nextjs';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';

type SignUpMethod = 'email' | 'phone';

export function CustomSignUpForm() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const [method, setMethod] = useState<SignUpMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState<SignUpMethod>('email');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!isLoaded) return null;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (method === 'phone') {
        const phoneE164 = phone.startsWith('+') ? phone : `+1${phone.replace(/\D/g, '')}`;
        await signUp.create({
          phoneNumber: phoneE164,
          password
        });
        await signUp.preparePhoneNumberVerification({ strategy: 'phone_code' });
        setVerificationMethod('phone');
        setPendingVerification(true);
      } else {
        await signUp.create({
          emailAddress: email,
          password
        });
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setVerificationMethod('email');
        setPendingVerification(true);
      }
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
      const result =
        verificationMethod === 'phone'
          ? await signUp.attemptPhoneNumberVerification({ code })
          : await signUp.attemptEmailAddressVerification({ code });

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
          <Label htmlFor='code'>
            {verificationMethod === 'phone' ? 'SMS code' : 'Email code'}
          </Label>
          <Input
            id='code'
            type='text'
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={
              verificationMethod === 'phone'
                ? 'Enter code from SMS'
                : 'Enter code from email'
            }
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
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSignUp} className='w-full space-y-4'>
      <div className='flex gap-2 p-1 rounded-lg bg-muted'>
        <button
          type='button'
          onClick={() => setMethod('email')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === 'email' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Email
        </button>
        <button
          type='button'
          onClick={() => setMethod('phone')}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            method === 'phone' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Phone
        </button>
      </div>
      {method === 'email' ? (
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
      ) : (
        <div className='space-y-2'>
          <Label htmlFor='phone'>Phone number</Label>
          <Input
            id='phone'
            type='tel'
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder='+1 555 000 0000'
            required
            autoComplete='tel'
            disabled={isLoading}
          />
          <p className='text-muted-foreground text-xs'>
            Enter with country code (e.g. +1 for US). You&apos;ll receive an SMS code.
          </p>
        </div>
      )}
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
