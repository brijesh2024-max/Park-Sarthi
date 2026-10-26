import { accountGet } from "@/lib/server/api";
import { handler } from "@/lib/server/core";
export const dynamic = "force-dynamic";
export async function GET(){return handler(()=>accountGet());}

