import { listingPatch } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){return handler(async()=>listingPatch(request,(await params).id));}

