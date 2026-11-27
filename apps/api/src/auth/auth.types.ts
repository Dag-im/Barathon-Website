
export interface RequestContext {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
}

export function requestContext(req: { headers: Record<string, unknown>; ip?: string; socket?: { remoteAddress?: string }; id?: unknown }): RequestContext {
  const ip = (req.ip ?? req.socket?.remoteAddress ?? null) as string | null;
  return {
    ip: ip ? ip.replace(/^::ffff:/, '') : null,
    userAgent: (req.headers['user-agent'] as string | undefined) ?? null,
    requestId: req.id !== undefined && req.id !== null ? String(req.id) : null,
  };
}

export const FORGOT_MESSAGE =
  'If the account exists, its password was reset to the default password. Sign in and you will be asked to choose a new one.';

export function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /Chrome\//.test(userAgent)
      ? 'Chrome'
      : /Firefox\//.test(userAgent)
        ? 'Firefox'
        : /Safari\//.test(userAgent)
          ? 'Safari'
          : 'Browser';
  const os = /Windows/.test(userAgent)
    ? 'Windows'
    : /Android/.test(userAgent)
      ? 'Android'
      : /iPhone|iPad/.test(userAgent)
        ? 'iOS'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : 'Unknown OS';
  return `${browser} on ${os}`.slice(0, 120);
}
