export default function Loading() {
  return (
    <div className="container-site py-16" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="h-10 w-1/3 animate-pulse bg-[#E5E7EB]" />
      <div className="mt-6 h-6 w-2/3 animate-pulse bg-[#E5E7EB]" />
      <div className="mt-12 grid gap-8 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className="aspect-[4/5] animate-pulse bg-[#E5E7EB]" />)}
      </div>
    </div>
  );
}
