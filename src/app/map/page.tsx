import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import EmptyMapClient from './empty-map-client';

export default async function MapPage() {
  const { userId } = await auth();

  if (!userId) {
    return redirect('/auth/sign-in');
  }

  return <EmptyMapClient />;
}
