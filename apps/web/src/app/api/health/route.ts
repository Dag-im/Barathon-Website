export const dynamic = "force-dynamic";

/** Liveness for the Docker healthcheck. Does not call the API. */
export function GET() {
  return Response.json({ status: "ok" });
}
