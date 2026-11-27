import type { Metadata } from "next";
import { ChangePasswordForm } from "@/components/admin/change-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ChangeRequiredPage() {
  return <ChangePasswordForm forced />;
}
