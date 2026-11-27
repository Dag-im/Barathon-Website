import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminApi } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/errors";
import { AdminShell } from "@/components/admin/admin-shell";
import { USE_MOCKS } from "@/lib/env";

/**
 * Session gate for every dashboard route. The API validates the cookie; a 401
 * sends the user to login. A forced password change redirects to its own page.
 * The current path comes from the x-pathname header set by middleware.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const cookie = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  let me;
  try {
    me = await adminApi.me(cookie);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect("/admin/login");
    throw e;
  }
  if (me.mustChangePassword && !USE_MOCKS) redirect("/admin/change-password-required");
  return <AdminShell userName={me.name}>{children}</AdminShell>;
}
