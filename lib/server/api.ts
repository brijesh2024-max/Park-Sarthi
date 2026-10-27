import { getChatGPTUser } from "@/app/chatgpt-auth";
import { CITIES, detectImage, quoteBooking, validateBooking, validateListing } from "@/lib/marketplace";
import { admin, ApiError, body, bookingsEnabled, bookingFromRow, database, getBooking, getListing, isAdmin, json, limitedBody, listingFromRow, publicListings, rateLimit, requirePayments, runtime, sameOrigin, user, validate, validId, type DbRow } from "./core";
import { razorpay, requestRefund, settlePayment } from "./payments";
import { verifyHmac } from "./signatures";
import { CREATE_BOOKING_SQL, RECONCILE_FULL_REFUND_SQL } from "./booking-sql";

export async function bootstrap(){const who=await getChatGPTUser();return json({user:who?{id:who.userId,name:who.displayName,email:who.email}:null,isAdmin:isAdmin(who),bookingsEnabled:bookingsEnabled(),cities:CITIES,listings:await publicListings()});}
export async function listingsGet(){return json({listings:await publicListings()});}
export async function accountGet(){
 const who=await user(),db=database();
 const [booked,owned,hosted]=await Promise.all([
  db.prepare("SELECT * FROM bookings WHERE user_id = ? AND payment_mode = 'live' ORDER BY created_at DESC LIMIT 100").bind(who.userId).all<DbRow>(),
  db.prepare("SELECT * FROM listings WHERE host_id = ? ORDER BY created_at DESC LIMIT 100").bind(who.userId).all<DbRow>(),
  db.prepare("SELECT * FROM bookings WHERE host_id = ? AND payment_mode = 'live' AND status IN ('confirmed','refund_pending','refunded') ORDER BY created_at DESC LIMIT 100").bind(who.userId).all<DbRow>(),
 ]);
 return json({bookings:booked.results.map(bookingFromRow),listings:owned.results.map(r=>listingFromRow(r,true)),hostBookings:hosted.results.map(bookingFromRow)});
}

export async function listingsPost(request:Request){
 sameOrigin(request);const who=await user();await rateLimit(who.userId,"listings",5);const input=await body(request);const listing=validate(()=>validateListing(input));
 const key=listing.imageUrl.split("/").pop()!;
 const photo=await database().prepare("SELECT key FROM photos WHERE key = ? AND owner_id = ?").bind(key,who.userId).first();
 if(!photo)throw new ApiError(400,"Upload your own parking-space photo before submitting.");
 const id=crypto.randomUUID(),now=new Date().toISOString();
 await database().prepare(`INSERT INTO listings (id,host_id,title,city,area,address,description,vehicle_types,price_per_hour,wash_price,capacity,amenities,image_url,lat,lng,status,rights_confirmed_at,created_at,updated_at,opening_time,closing_time,blocked_dates) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending',?,?,?,?,?,?)`).bind(id,who.userId,listing.title,listing.city,listing.area,listing.address,listing.description,JSON.stringify(listing.vehicleTypes),listing.pricePerHour,listing.washPrice,listing.capacity,JSON.stringify(listing.amenities),listing.imageUrl,listing.lat,listing.lng,now,now,now,listing.openingTime,listing.closingTime,JSON.stringify(listing.blockedDates)).run();
 return json({listing:{...listing,id,hostId:who.userId,status:"pending"}},201);
}
export async function listingPatch(request:Request,id:string){
 sameOrigin(request);validId(id);const who=await user();await rateLimit(who.userId,"listings",10);const input=await body(request);
 if(input&&["openingTime","closingTime","blockedDates"].some(key=>key in input))throw new ApiError(400,"Hours and blocked dates are set when a space is created. Pause this listing and contact support before changing its schedule, so existing bookings are protected.");
 if(!["draft","pending"].includes(input?.status))throw new ApiError(400,"Choose pause or submit for review.");
 const row=await database().prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ? AND host_id = ? RETURNING *").bind(input.status,new Date().toISOString(),id,who.userId).first<DbRow>();
 if(!row)throw new ApiError(404,"Space not found.");return json({listing:listingFromRow(row,true)});
}

export async function bookingsPost(request:Request){
 sameOrigin(request);const who=await user();await rateLimit(who.userId,"bookings",10);const input=await body(request);const listing=await getListing(validId(input?.listingId));
 if(!listing||listing.status!=="active")throw new ApiError(404,"This parking space is not available.");
 if(listing.hostId===who.userId)throw new ApiError(400,"You cannot book your own parking space.");
 const booking=validate(()=>validateBooking(input,listing));const amounts=quoteBooking(listing,booking.startAt,booking.endAt,booking.addWash);
 if(!bookingsEnabled())throw new ApiError(503,"Bookings are not open yet. Payment setup is still in progress.");
 const {mode}=requirePayments();
 const db=database(),now=new Date().toISOString(),id=crypto.randomUUID(),expiresAt=new Date(Date.now()+10*60000).toISOString();
 const previous=await db.prepare("SELECT * FROM bookings WHERE user_id = ? AND listing_id = ? AND start_at = ? AND end_at = ? AND vehicle_number = ? AND payment_mode = 'live' AND (status = 'confirmed' OR (status = 'pending_payment' AND expires_at > ?)) LIMIT 1").bind(who.userId,listing.id,booking.startAt,booking.endAt,booking.vehicleNumber,now).first<DbRow>();
 if(previous){
  if(previous.vehicle_type!==booking.vehicleType||Boolean(previous.add_wash)!==booking.addWash)throw new ApiError(409,"You already have a booking for this vehicle and time with different options. Cancel it in My bookings before changing the vehicle type or car wash.");
  return checkoutResponse(previous);
 }
 const status="pending_payment";
 const values=[id,who.userId,listing.hostId,listing.id,JSON.stringify({title:listing.title,city:listing.city,area:listing.area,imageUrl:listing.imageUrl,address:listing.address}),booking.startAt,booking.endAt,booking.vehicleType,booking.vehicleNumber,booking.addWash?1:0,amounts.parkingAmount,amounts.washAmount,amounts.feeAmount,amounts.totalAmount,status,mode,now,expiresAt,String(crypto.getRandomValues(new Uint32Array(1))[0]%900000+100000)];
 const result=await db.prepare(CREATE_BOOKING_SQL).bind(listing.id,booking.startAt,booking.endAt,now,listing.capacity,who.userId,booking.vehicleNumber,...values).first();
 if(!result)throw new ApiError(409,"This space is no longer available for that time, or you already have this booking. Check My bookings or choose another time.");
 try{
  const order=await razorpay("/orders",{method:"POST",body:{amount:amounts.totalAmount,currency:"INR",receipt:id,notes:{booking_id:id}}});
  if(typeof order.id!=="string"||order.amount!==amounts.totalAmount||order.currency!=="INR")throw new ApiError(502,"The payment provider returned an unexpected order. No booking was confirmed.");
  await db.prepare("UPDATE bookings SET order_id = ? WHERE id = ? AND status = 'pending_payment'").bind(order.id,id).run();
 }catch(error){await db.prepare("UPDATE bookings SET status = 'expired' WHERE id = ? AND status = 'pending_payment'").bind(id).run();throw error;}
 return checkoutResponse((await getBooking(id))!,201);
}
function checkoutResponse(row:DbRow,status=200){
 if(row.status!=="pending_payment")return json({booking:bookingFromRow(row)},status);
 if(!row.order_id)throw new ApiError(409,"Your payment order is being prepared. Please try again shortly.");
 const config=requirePayments();if(config.mode!==row.payment_mode)throw new ApiError(409,"Payment settings changed. Please cancel this booking and start again.");
 return json({booking:bookingFromRow(row),checkout:{keyId:config.keyId,orderId:row.order_id,amount:row.total_amount,currency:"INR"}},status);
}
export async function bookingCancel(request:Request,id:string){
 sameOrigin(request);validId(id);const who=await user();await rateLimit(who.userId,"cancel",15);const row=await getBooking(id);
 if(!row||row.user_id!==who.userId)throw new ApiError(404,"Booking not found.");
 if(["cancelled","refunded","refund_pending","expired"].includes(row.status))return json({booking:bookingFromRow(row)});
 if(row.status==="confirmed"&&Date.parse(row.start_at)<=Date.now())throw new ApiError(409,"This parking session has started. Contact ParkSarthi support for help.");
 const next=row.status==="confirmed"?"refund_pending":"cancelled";
 if(next==="refund_pending"&&requirePayments().mode!==row.payment_mode)throw new ApiError(409,"Payment settings changed. This refund needs administrator review.");
 const changed=await database().prepare("UPDATE bookings SET status = ? WHERE id = ? AND user_id = ? AND status = ? RETURNING id").bind(next,id,who.userId,row.status).first();
 if(!changed)throw new ApiError(409,"Your booking status just changed. Refresh My bookings and try cancelling again.");
 const updated=(await getBooking(id))!;if(updated.status==="refund_pending")await requestRefund(updated);
 return json({booking:bookingFromRow((await getBooking(id))!)});
}

export async function paymentsVerify(request:Request){
 sameOrigin(request);const who=await user();await rateLimit(who.userId,"verify",20);const input=await body(request);const id=validId(input?.bookingId),row=await getBooking(id);
 if(!row||row.user_id!==who.userId)throw new ApiError(404,"Booking not found.");
 const config=requirePayments();if(row.payment_mode!==config.mode)throw new ApiError(409,"Payment settings changed; this payment needs administrator review.");
 if(typeof input.razorpay_payment_id!=="string"||!/^pay_[A-Za-z0-9]+$/.test(input.razorpay_payment_id)||typeof input.razorpay_signature!=="string"||input.razorpay_order_id!==row.order_id||!row.order_id)throw new ApiError(400,"Payment details do not match the booking.");
 if(!await verifyHmac(config.keySecret,`${row.order_id}|${input.razorpay_payment_id}`,input.razorpay_signature))throw new ApiError(400,"Payment verification failed. No reservation was confirmed.");
 const settled=await settlePayment(id,input.razorpay_payment_id);return json({booking:bookingFromRow(settled)});
}

export async function uploadsPost(request:Request){
 sameOrigin(request);const who=await user();await rateLimit(who.userId,"uploads",10);const bucket=runtime().BUCKET;if(!bucket)throw new ApiError(503,"Photo storage is not available yet.");
 if(!request.headers.get("content-type")?.startsWith("multipart/form-data"))throw new ApiError(415,"Upload a JPEG, PNG or WebP photo.");
 const bytes=await limitedBody(request,5*1024*1024+65536);
 let form:FormData;try{form=await new Request(request.url,{method:"POST",headers:{"content-type":request.headers.get("content-type")!},body:bytes}).formData();}catch{throw new ApiError(400,"The photo upload could not be read.");}
 const file=form.get("file");if(!(file instanceof File)||file.size>5*1024*1024||file.size<16)throw new ApiError(400,"Choose a photo smaller than 5 MB.");
 const photoBytes=new Uint8Array(await file.arrayBuffer()),kind=detectImage(photoBytes);
 if(!kind||file.type&&file.type!==kind.mime)throw new ApiError(400,"Only genuine JPEG, PNG and WebP photos are accepted.");
 const key=`${crypto.randomUUID()}.${kind.extension}`;
 await bucket.put(key,photoBytes,{httpMetadata:{contentType:kind.mime},customMetadata:{ownerId:who.userId}});
 try{await database().prepare("INSERT INTO photos (key,owner_id,mime,size,created_at) VALUES (?,?,?,?,?)").bind(key,who.userId,kind.mime,file.size,new Date().toISOString()).run();}catch(error){await bucket.delete(key);throw error;}
 return json({url:`/api/photos/${key}`},201);
}
export async function photosGet(key:string){
 if(!/^[a-f0-9-]+\.(jpg|png|webp)$/.test(key))throw new ApiError(404,"Photo not found.");
 const photo=await database().prepare("SELECT * FROM photos WHERE key = ?").bind(key).first<DbRow>();if(!photo)throw new ApiError(404,"Photo not found.");
 const who=await getChatGPTUser();
 const active=await database().prepare("SELECT id FROM listings WHERE image_url = ? AND status = 'active' LIMIT 1").bind(`/api/photos/${key}`).first();
 let permitted=Boolean(active||who?.userId===photo.owner_id||isAdmin(who));
 if(!permitted&&who){permitted=Boolean(await database().prepare("SELECT b.id FROM bookings b JOIN listings l ON l.id = b.listing_id WHERE b.user_id = ? AND b.payment_mode = 'live' AND b.status = 'confirmed' AND l.image_url = ? LIMIT 1").bind(who.userId,`/api/photos/${key}`).first());}
 if(!permitted)throw new ApiError(404,"Photo not found.");
 const stored=await runtime().BUCKET?.get(key);if(!stored)throw new ApiError(404,"Photo not found.");
 return new Response(stored.body,{headers:{"Content-Type":photo.mime,"X-Content-Type-Options":"nosniff","Content-Disposition":"inline","Cache-Control":"private, max-age=300","Content-Security-Policy":"default-src 'none'; sandbox"}});
}

export async function adminGet(){
 await admin();const [spaces,booked]=await Promise.all([database().prepare("SELECT * FROM listings ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, created_at DESC LIMIT 200").all<DbRow>(),database().prepare("SELECT * FROM bookings WHERE payment_mode = 'live' ORDER BY created_at DESC LIMIT 200").all<DbRow>()]);
 return json({listings:spaces.results.map(r=>listingFromRow(r,true)),bookings:booked.results.map(bookingFromRow)});
}
export async function adminListingPatch(request:Request,id:string){
 sameOrigin(request);validId(id);const who=await admin();await rateLimit(who.userId,"admin",30);const input=await body(request);
 if(!["active","rejected"].includes(input?.status))throw new ApiError(400,"Choose approve or reject.");
 const row=await database().prepare("UPDATE listings SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending' RETURNING *").bind(input.status,new Date().toISOString(),id).first<DbRow>();
 if(!row)throw new ApiError(409,"This listing is no longer pending review.");
 await database().prepare("INSERT INTO audit_log (id,actor_id,action,target_id,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),who.userId,`listing.${input.status}`,id,new Date().toISOString()).run();
 return json({listing:listingFromRow(row,true)});
}

export async function paymentsWebhook(request:Request){
 const config=requirePayments(),raw=new TextDecoder().decode(await limitedBody(request,128*1024));
 if(!await verifyHmac(config.webhookSecret,raw,request.headers.get("x-razorpay-signature")||""))throw new ApiError(400,"Invalid webhook signature.");
 const eventId=request.headers.get("x-razorpay-event-id");if(!eventId||eventId.length>200)throw new ApiError(400,"Missing event identifier.");
 if(await database().prepare("SELECT id FROM payment_events WHERE id = ?").bind(eventId).first())return json({received:true});
 let event:DbRow;try{event=JSON.parse(raw);}catch{throw new ApiError(400,"Invalid event body.");}
 if(["payment.captured","order.paid"].includes(event.event)){
  const payment=event.payload?.payment?.entity;
  if(!payment||typeof payment.id!=="string"||!/^pay_[A-Za-z0-9]+$/.test(payment.id)||typeof payment.order_id!=="string")throw new ApiError(400,"Invalid payment event.");
  const booking=await database().prepare("SELECT * FROM bookings WHERE order_id = ?").bind(payment.order_id).first<DbRow>();
  if(booking&&booking.payment_mode===config.mode)await settlePayment(booking.id,payment.id);
 }else if(["refund.processed","refund.failed"].includes(event.event)){
  const refund=event.payload?.refund?.entity;
  if(!refund||typeof refund.id!=="string"||!/^rfnd_[A-Za-z0-9]+$/.test(refund.id)||typeof refund.payment_id!=="string"||!/^pay_[A-Za-z0-9]+$/.test(refund.payment_id))throw new ApiError(400,"Invalid refund event.");
  const booking=await database().prepare("SELECT * FROM bookings WHERE payment_id = ? AND payment_mode = 'live'").bind(refund.payment_id).first<DbRow>();
  if(booking&&booking.payment_mode===config.mode){
   const verified=await razorpay(`/payments/${encodeURIComponent(refund.payment_id)}/refunds/${encodeURIComponent(refund.id)}`);
   if(verified.payment_id===booking.payment_id&&verified.amount===booking.total_amount){
    if(verified.status==="processed")await database().prepare(RECONCILE_FULL_REFUND_SQL).bind(refund.id,booking.id).run();
    else if(verified.status==="failed")await database().prepare("UPDATE bookings SET refund_state = 'failed', refund_id = ? WHERE id = ? AND status = 'refund_pending'").bind(refund.id,booking.id).run();
   }
  }
 }
 await database().prepare("INSERT OR IGNORE INTO payment_events (id,event_type,processed_at) VALUES (?,?,?)").bind(eventId,String(event.event||"unknown").slice(0,80),new Date().toISOString()).run();
 return json({received:true});
}
