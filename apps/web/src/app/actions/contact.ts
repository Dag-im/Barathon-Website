"use server";

import { ApiError } from "@/lib/api/errors";
import { submitContact } from "@/lib/api/public";
import { contactSchema, type ContactInput } from "@/lib/forms/contact";

export type ContactActionResult =
  | { ok: true; reference: string | null; message: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

/**
 * Server Action for the contact form. Validates the same rules as the client,
 * forwards to POST /public/contact and maps API errors back to fields.
 * Works without JavaScript through the form action.
 */
export async function submitContactAction(input: ContactInput): Promise<ContactActionResult> {
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: "Please correct the highlighted fields.", fieldErrors };
  }
  const d = parsed.data;
  if (d.website) return { ok: true, reference: null, message: "Thank you. Your message has been sent." };
  try {
    const res = await submitContact({
      name: d.name,
      email: d.email,
      phone: d.phone || undefined,
      message: [d.company ? `Company: ${d.company}` : null, d.message].filter(Boolean).join("\n"),
      subject: d.subject || undefined,
      productSlug: d.productSlug || undefined,
      sourcePath: "/contact",
      consent: d.consent,
      formStartedAt: d.formStartedAt,
    });
    return { ok: true, reference: res.reference, message: res.message };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 422) return { ok: false, message: "Please correct the highlighted fields.", fieldErrors: e.fieldErrors() };
      if (e.status === 429) return { ok: false, message: "Too many attempts. Please try again later." };
    }
    return { ok: false, message: "We could not send your message. Your details are kept; please try again or call us." };
  }
}
