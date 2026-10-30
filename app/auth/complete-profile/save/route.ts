import { appOrigin } from "@/lib/auth/config";
import { createAuthClient } from "@/lib/auth/server";
import { allowedAuthOrigin,profileDetails,safeReturnTo } from "@/lib/auth/policy";
import { readAuthForm } from "@/lib/auth/forms";
import { authError,authRedirect } from "@/lib/auth/responses";

export async function POST(request:Request){
  const origin=appOrigin(new URL(request.url).origin);
  if(!origin || !allowedAuthOrigin(request.headers.get("origin"),origin,request.headers.get("sec-fetch-site"))) return new Response("Invalid request origin.",{status:403});
  let form:URLSearchParams;
  try{form=await readAuthForm(request);}catch{return new Response("Invalid form.",{status:400});}
  const next=safeReturnTo(form.get("return_to"));
  try{
    const client=await createAuthClient();
    if(!client)return authError(request,"sign-in","unavailable",next);
    const {data,error}=await client.auth.getUser();
    if(error||!data.user?.email_confirmed_at)return authError(request,"sign-in","credentials",next);
    const profile=profileDetails(form.get("full_name"),form.get("phone"));
    if(!profile)return authError(request,"complete-profile","profile",next);
    const saved=await client.auth.updateUser({data:{...profile,parksarthi_profile_complete:true}});
    if(saved.error)return authError(request,"complete-profile",saved.error.status===429?"rate":"provider",next);
    return authRedirect(request,next);
  }catch{return authError(request,"complete-profile","provider",next);}
}
