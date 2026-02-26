export default function MapLoading() {
  return (
    <div className="flex h-full w-full flex-1 items-center justify-center bg-[#1a1a2e]">
      <div className="flex flex-col items-center gap-3 text-white/60 text-sm">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
        Loading map…
      </div>
    </div>
  );
}
