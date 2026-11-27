import { apiRequest, type Query } from "./client";
import type { AdminWarning, AuditLogDto, DashboardDto, MeDto, MediaDto, MessageDto, Paginated, SessionDto, UUID } from "./types";

/**
 * Admin API calls (cookie session + CSRF, backend plan 6.3). Used by client
 * components through TanStack Query, and by server layouts with a forwarded cookie.
 */

export type AdminRow = { id: UUID; status?: string; sortOrder?: number; version: number; updatedAt: string; warnings?: AdminWarning[]; [k: string]: unknown };

export const adminApi = {
  login: (body: { email: string; password: string }) => apiRequest<{ status: "OK"; user: MeDto; mustChangePassword: boolean; csrfToken: string }>("/auth/login", { method: "POST", body, noRefresh: true }),
  logout: () => apiRequest<void>("/auth/logout", { method: "POST", noRefresh: true }),
  forgotPassword: (identifier: string) => apiRequest<{ message: string }>("/auth/forgot-password", { method: "POST", body: { identifier }, noRefresh: true }),
  changePassword: (body: { currentPassword?: string; newPassword: string }) => apiRequest<void>("/auth/change-password", { method: "POST", body }),
  me: (cookie?: string) => apiRequest<MeDto>("/auth/me", { cookie, noRefresh: true, cache: "no-store" }),
  sessions: () => apiRequest<{ data: SessionDto[] }>("/auth/sessions"),
  revokeSession: (id: string) => apiRequest<void>(`/auth/sessions/${id}`, { method: "DELETE" }),
  dashboard: (cookie?: string) => apiRequest<DashboardDto>("/admin/dashboard", { cookie, cache: "no-store" }),
  list: (res: string, query?: Query) => apiRequest<Paginated<AdminRow>>(`/admin/${res}`, { query }),
  get: (res: string, id: string) => apiRequest<AdminRow>(`/admin/${res}/${id}`),
  create: (res: string, body: Record<string, unknown>) => apiRequest<AdminRow>(`/admin/${res}`, { method: "POST", body }),
  update: (res: string, id: string, body: Record<string, unknown>) => apiRequest<AdminRow>(`/admin/${res}/${id}`, { method: "PATCH", body }),
  remove: (res: string, id: string) => apiRequest<void>(`/admin/${res}/${id}`, { method: "DELETE" }),
  transition: (res: string, id: string, action: "publish" | "unpublish" | "archive") => apiRequest<AdminRow>(`/admin/${res}/${id}/${action}`, { method: "POST", body: {} }),
  byKey: (key: "home" | "about") => apiRequest<{ id: string; blocks: { id: string; type: string; visible?: boolean; title?: string; subtitle?: string; [k: string]: unknown }[] } & Record<string, unknown>>(`/admin/pages/by-key/${key}`),
  saveBlocks: (pageId: string, blocks: unknown[]) => apiRequest<void>(`/admin/pages/${pageId}/blocks`, { method: "PUT", body: { blocks } }),
  settings: () => apiRequest<Record<string, unknown>>("/admin/settings"),
  menus: (location: string) => apiRequest<{ location: string; items: { id: string; label: string; href: string; children: unknown[] }[] }>(`/admin/menus/${location}`),
  media: (query?: Query) => apiRequest<Paginated<MediaDto>>("/admin/media", { query }),
  messages: (query?: Query) => apiRequest<Paginated<MessageDto>>("/admin/messages", { query }),
  audit: (query?: Query) => apiRequest<Paginated<AuditLogDto>>("/admin/audit-log", { query }),
};
