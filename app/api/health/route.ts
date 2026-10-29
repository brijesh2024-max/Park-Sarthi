import { getDatabase } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ready = Boolean(process.env.DATABASE_URL && process.env.SUPABASE_URL
    && process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.APP_URL);
  if (!ready) return Response.json({status:"setup_required"}, {status:503});
  try {
    await getDatabase().prepare("SELECT id FROM listings LIMIT 1").first();
    return Response.json({status:"ok"});
  } catch {
    return Response.json({status:"unavailable"}, {status:503});
  }
}
