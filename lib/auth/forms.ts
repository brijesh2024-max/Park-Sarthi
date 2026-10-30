export async function readAuthForm(request:Request):Promise<URLSearchParams> {
  if(request.headers.get("content-type")?.split(";")[0].trim()!=="application/x-www-form-urlencoded") throw new Error("Invalid form");
  const reader=request.body?.getReader();
  if(!reader) throw new Error("Missing form");
  let length=0;
  const chunks:Uint8Array[]=[];
  while(true){
    const part=await reader.read(); if(part.done)break;
    length+=part.value.length;
    if(length>8192){await reader.cancel();throw new Error("Oversized form");}
    chunks.push(part.value);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}
