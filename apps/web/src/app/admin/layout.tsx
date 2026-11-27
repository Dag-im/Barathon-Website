import type { Metadata } from "next";
import { AdminProviders } from "./providers";
import { noindexMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = noindexMetadata;

/** Admin root: never indexed, query provider only. Session checks live in the route groups. */
export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
