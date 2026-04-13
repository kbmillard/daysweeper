import EmptyMapClient from './empty-map-client';

export default async function MapPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <EmptyMapClient />
    </div>
  );
}
