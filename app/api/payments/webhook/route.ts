import { paymentsWebhook } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function POST(request:Request){return handler(()=>paymentsWebhook(request));}

