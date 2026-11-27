import type { Metadata } from "next";
import Link from "next/link";
import { getFaqs } from "@/lib/api/public";
import { listMetadata } from "@/lib/seo/list";
import { PageHeader } from "@/components/layout/page-header";
import { StatusEmpty } from "@/components/content/status-empty";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { RichHtml } from "@/components/content/rich-html";
import { JsonLd } from "@/components/seo-jsonld";
import { faqPage } from "@/lib/seo/jsonld";
import { stripTags } from "@/lib/utils/html";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = listMetadata({ title: "Frequently Asked Questions", description: "Answers to common questions about ordering, parts, service and delivery.", path: "/faq" });

export default async function FaqPage() {
  const { data } = await getFaqs();
  const items = data.flatMap((g) => g.items.map((i) => ({ question: i.question, answer: stripTags(i.answerHtml) })));
  return (
    <>
      <PageHeader eyebrow="Help" title="Frequently Asked Questions" crumbs={[{ label: "FAQ" }]} />
      <section className="section-md bg-white">
        <div className="container-site">
          {data.length ? (
            data.map((g) => (
              <div key={g.id} className="mb-12">
                <h2 className="t-h2 border-t-2 border-[#111827] pt-6">{g.title}</h2>
                <Accordion type="multiple" className="mt-4">
                  {g.items.map((it) => (
                    <AccordionItem key={it.id} value={it.id}>
                      <AccordionTrigger className="font-display text-xl font-semibold">{it.question}</AccordionTrigger>
                      <AccordionContent><RichHtml html={it.answerHtml} className="max-w-[68ch] pb-6 text-[#374151]" /></AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))
          ) : (
            <StatusEmpty title="No questions published yet" description="Ask us directly and we will answer by phone or email." action={<Button asChild><Link href="/contact">Contact us</Link></Button>} />
          )}
        </div>
      </section>
      {items.length ? <JsonLd data={faqPage(items)} /> : null}
    </>
  );
}
