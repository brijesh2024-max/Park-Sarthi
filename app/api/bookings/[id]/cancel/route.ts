import { bookingCancel } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){return handler(async()=>bookingCancel(request,(await params).id));}

