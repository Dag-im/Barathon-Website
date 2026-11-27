import { z } from "zod";

/** Contact form rules (plan 6.8). Shared by the client form and the server action. */
export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name (at least 2 characters).").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine((v) => v === "" || /^[+0-9()\-.\s]{6,40}$/.test(v), "Enter a valid phone number, for example +251 911 123456.")
    .optional()
    .or(z.literal("")),
  company: z.string().trim().max(120).optional().or(z.literal("")),
  subject: z.string().trim().max(160).optional().or(z.literal("")),
  productSlug: z.string().trim().max(160).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(5000, "Message must be 5000 characters or fewer."),
  consent: z.boolean().refine((v) => v, "Please confirm you agree to the processing of your data."),
  website: z.string().max(0).optional().or(z.literal("")),
  formStartedAt: z.number().optional(),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const SUBJECTS = [
  { value: "General", label: "General enquiry" },
  { value: "Product quote", label: "Product quote" },
  { value: "Service request", label: "Service request" },
  { value: "Parts", label: "Parts" },
  { value: "Partnership", label: "Partnership" },
] as const;
