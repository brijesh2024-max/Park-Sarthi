import { photosGet } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function GET(_request:Request,{params}:{params:Promise<{key:string[]}>}){return handler(async()=>photosGet((await params).key.join("/")));}

