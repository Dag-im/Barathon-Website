import { Logo } from "@/components/layout/logo";

/** Centred auth card, no sidebar (design 8.13). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-admin className="grid min-h-dvh place-items-center bg-[#F8F9FA] p-4 text-[14px]">
      <div className="w-full max-w-[400px] border border-[#E5E7EB] bg-white p-8 shadow-md">
        <div className="mb-6 flex justify-center"><Logo variant="mark" href={null} className="h-10" /></div>
        {children}
      </div>
    </div>
  );
}
