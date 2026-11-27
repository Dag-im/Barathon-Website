/** Problem-details error from the API (backend plan 6.1.4). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: { field: string; message: string; code?: string }[];
  readonly requestId: string | null;

  constructor(status: number, code: string, message: string, details: ApiError["details"] = [], requestId: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  /** Field errors keyed by field name, for react-hook-form setError. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details) if (d.field && !out[d.field]) out[d.field] = d.message;
    return out;
  }
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: Partial<{ statusCode: number; code: string; message: string; details: ApiError["details"]; requestId: string }> = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body */
  }
  return new ApiError(
    res.status,
    body.code ?? (res.status === 404 ? "NOT_FOUND" : "INTERNAL"),
    body.message ?? res.statusText ?? "Request failed",
    body.details ?? [],
    body.requestId ?? null,
  );
}
