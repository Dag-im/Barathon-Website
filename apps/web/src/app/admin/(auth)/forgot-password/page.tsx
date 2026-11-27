import type { Metadata } from "next";
import { ForgotForm } from "@/components/admin/forgot-form";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPage() {
  return <ForgotForm />;
}
