// Dependency-free health check so the app deploys anywhere
// (including Vercel) without a DATABASE_URL.
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    app: "mehfil-e-qawwali",
    time: new Date().toISOString(),
  });
}
