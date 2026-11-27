import { z } from 'zod';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(256),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(256).optional(),
    newPassword: z.string().min(1).max(256),
    confirmPassword: z.string().max(256).optional(),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
  })
  .strict();

export const revokeSessionParams = z.object({ id: z.string().uuid() });

export type LoginDto = z.infer<typeof loginSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
