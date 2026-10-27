import { env } from "cloudflare:workers";
import { getChatGPTUser, type ChatGPTUser } from "@/app/chatgpt-auth";
import { type Booking, type Listing, type PaymentMode } from "@/lib/marketplace";

import { configuredPaymentMode, liveBookingsEnabled } from "../payment-config";

export const bookingsEnabled = () => liveBookingsEnabled(runtime());

export class ApiError extends Error { constructor(public status:number,message:string){super(message);} }
export const runtime = () => env as Cloudflare.Env;
export function database(){const db=runtime().DB;if(!db)throw new ApiError(503,"The database is not available yet. Please try again shortly.");return db;}
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
export async function handler(fn:()=>Promise<Response>){try{return await fn();}catch(error){if(error instanceof ApiError)return json({error:error.message},error.status);console.error("ParkSarthi request failed",error instanceof Error?error.message:"Unknown error");return json({error:"Something went wrong. Please try again shortly."},500);}}
export async function user(){const value=await getChatGPTUser();if(!value)throw new ApiError(401,"Sign in to continue.");return value;}
export function isAdmin(value:ChatGPTUser|null){return Boolean(value&&runtime().ADMIN_USER_IDS?.split(",").map(s=>s.trim()).filter(Boolean).includes(value.userId));}
export async function admin(){const value=await user();if(!isAdmin(value))throw new ApiError(403,"This action is only available to a ParkSarthi administrator.");return value;}
export function sameOrigin(request:Request){const origin=request.headers.get("origin");if(!origin||origin!==new URL(request.url).origin||request.headers.get("sec-fetch-site")==="cross-site")throw new ApiError(403,"This request must come from ParkSarthi.");}
export async function limitedBody(request:Request,maxBytes:number){
 const length=Number(request.headers.get("content-length")||0);if(length>maxBytes)throw new ApiError(413,"The upload or request is too large.");
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new ApiError(413,"The upload or request is too large.");}chunks.push(value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function body(request:Request){if(!request.headers.get("content-type")?.includes("application/json"))throw new ApiError(415,"Send this request as JSON.");try{return JSON.parse(new TextDecoder().decode(await limitedBody(request,16000)));}catch(error){if(error instanceof ApiError)throw error;throw new ApiError(400,"The request is not valid JSON.");}}
export function validate<T>(fn:()=>T):T{try{return fn();}catch(error){throw new ApiError(400,error instanceof Error?error.message:"Check the entered details.");}}
export async function rateLimit(userId:string,action:string,limit:number,windowSeconds=60){
 const now=Math.floor(Date.now()/1000),start=Math.floor(now/windowSeconds)*windowSeconds;
 const row=await database().prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN window_start = excluded.window_start THEN count + 1 ELSE 1 END, window_start = excluded.window_start RETURNING count").bind(`${userId}:${action}`,start).first<{count:number}>();
 if(!row||row.count>limit)throw new ApiError(429,"Too many requests. Please wait a minute and try again.");
}
export function paymentMode():PaymentMode{return configuredPaymentMode(runtime());}
export function requirePayments(){
 const e=runtime(),mode=paymentMode();
 if(mode==="disabled")throw new ApiError(503,"Bookings are not open yet. Payment setup is still in progress.");
 if(!e.RAZORPAY_KEY_ID||!e.RAZORPAY_KEY_SECRET||!e.RAZORPAY_WEBHOOK_SECRET||!e.RAZORPAY_KEY_ID.startsWith(`rzp_${mode}_`))throw new ApiError(503,"Payments are not configured. Please try again after setup is complete.");
 if(mode==="live"&&e.LIVE_PAYMENTS_ENABLED!=="true")throw new ApiError(503,"Live payments are waiting for launch approval.");
 return {keyId:e.RAZORPAY_KEY_ID,keySecret:e.RAZORPAY_KEY_SECRET,webhookSecret:e.RAZORPAY_WEBHOOK_SECRET,mode};
}

// Raw D1 rows use snake_case; conversion is the only place that exposes them to clients.
export type DbRow = Record<string, any>;
export function listingFromRow(r:DbRow,exactAddress=false):Listing{return{id:r.id,hostId:r.host_id,title:r.title,city:r.city,area:r.area,address:exactAddress?r.address:`${r.area}, ${r.city}`,description:r.description,vehicleTypes:JSON.parse(r.vehicle_types),pricePerHour:r.price_per_hour,washPrice:r.wash_price,capacity:r.capacity,amenities:JSON.parse(r.amenities),imageUrl:r.image_url,lat:exactAddress?r.lat:Math.round(r.lat*100)/100,lng:exactAddress?r.lng:Math.round(r.lng*100)/100,status:r.status,openingTime:r.opening_time??"00:00",closingTime:r.closing_time??"00:00",blockedDates:JSON.parse(r.blocked_dates??"[]")};}
export function bookingFromRow(r:DbRow):Booking{
 const s=JSON.parse(r.snapshot),expired=r.status==="pending_payment"&&Date.parse(r.expires_at)<Date.now(),status=expired?"expired":r.status;
 return{id:r.id,listingId:r.listing_id,listingTitle:s.title,city:s.city,area:s.area,imageUrl:s.imageUrl,startAt:r.start_at,endAt:r.end_at,vehicleType:r.vehicle_type,vehicleNumber:r.vehicle_number,addWash:Boolean(r.add_wash),parkingAmount:r.parking_amount,washAmount:r.wash_amount,feeAmount:r.fee_amount,totalAmount:r.total_amount,status,createdAt:r.created_at,paymentMode:r.payment_mode,...(status==="confirmed"?{checkInCode:r.check_in_code,address:s.address}:{})};
}
export async function publicListings(){const rows=await database().prepare("SELECT * FROM listings WHERE status = 'active' ORDER BY created_at DESC LIMIT 200").all<DbRow>();return rows.results.map(r=>listingFromRow(r));}
export async function getListing(id:string){const row=await database().prepare("SELECT * FROM listings WHERE id = ?").bind(id).first<DbRow>();return row?listingFromRow(row,true):null;}
export async function getBooking(id:string){return database().prepare("SELECT * FROM bookings WHERE id = ? AND payment_mode = 'live'").bind(id).first<DbRow>();}
export function validId(id:unknown){if(typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(id))throw new ApiError(400,"Invalid record identifier.");return id;}
