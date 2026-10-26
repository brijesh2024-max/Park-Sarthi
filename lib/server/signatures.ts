export async function verifyHmac(secret:string,message:string,signature:string){
 if(!/^[a-fA-F0-9]{64}$/.test(signature))return false;
 const bytes=new Uint8Array(signature.match(/.{2}/g)!.map(value=>parseInt(value,16)));
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
 return crypto.subtle.verify("HMAC",key,bytes,new TextEncoder().encode(message));
}
