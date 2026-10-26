import { listingsGet, listingsPost } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function GET(){return handler(()=>listingsGet());}
export async function POST(request:Request){return handler(()=>listingsPost(request));}

