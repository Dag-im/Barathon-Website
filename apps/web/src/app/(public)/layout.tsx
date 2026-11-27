import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { JsonLd } from "@/components/seo-jsonld";
import { getSite } from "@/lib/api/public";
import { siteGraph } from "@/lib/seo/jsonld";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const site = await getSite();
  return (
    <>
      <SkipLink />
      <SiteHeader site={site} />
      <main id="main" tabIndex={-1} className="min-h-[60dvh] outline-none">
        {children}
      </main>
      <SiteFooter site={site} />
      <JsonLd data={siteGraph(site)} />
    </>
  );
}
