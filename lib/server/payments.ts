import { ApiError, database, getBooking, requirePayments, type DbRow } from "./core";
import { CONFIRM_BOOKING_SQL } from "./booking-sql";

export async function razorpay(path:string,options:{method?:string;body?:unknown}={}){
 const config=requirePayments();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(`https://api.razorpay.com/v1${path}`,{method:options.method||"GET",headers:{Authorization:`Basic ${btoa(`${config.keyId}:${config.keySecret}`)}`,"Content-Type":"application/json"},...(options.body?{body:JSON.stringify(options.body)}:{}),signal:controller.signal});
  const result=await response.json() as DbRow;
  if(!response.ok)throw new ApiError(502,"The payment provider could not complete this request. Please try again shortly.");
  return result;
 }catch(error){if(error instanceof ApiError)throw error;throw new ApiError(502,"The payment provider did not respond. Your payment status will be reconciled before any reservation is confirmed.");}finally{clearTimeout(timeout);}
}

export async function requestRefund(booking:DbRow){
 if(!booking.payment_id)return;
 // Claim once before an external request. A timeout is deliberately not auto-retried:
 // operators reconcile the provider dashboard to avoid a duplicate refund.
 const claim=await database().prepare("UPDATE bookings SET refund_state = 'requesting' WHERE id = ? AND status = 'refund_pending' AND refund_state IS NULL RETURNING id").bind(booking.id).first();
 if(!claim)return;
 try{
  const refund=await razorpay(`/payments/${encodeURIComponent(booking.payment_id)}/refund`,{method:"POST",body:{amount:booking.total_amount,notes:{booking_id:booking.id},receipt:booking.id}});
  if(typeof refund.id!=="string")throw new Error("Missing refund identifier");
  const processed=refund.status==="processed"&&refund.amount===booking.total_amount;
  await database().prepare("UPDATE bookings SET refund_id = ?, refund_state = ?, status = ? WHERE id = ? AND status = 'refund_pending'").bind(refund.id,processed?"processed":"pending",processed?"refunded":"refund_pending",booking.id).run();
 }catch{await database().prepare("UPDATE bookings SET refund_state = 'needs_review' WHERE id = ? AND status = 'refund_pending' AND refund_state = 'requesting'").bind(booking.id).run();}
}

export async function settlePayment(bookingId:string,paymentId:string){
 let booking=await getBooking(bookingId);if(!booking)throw new ApiError(404,"Booking not found.");
 const payment=await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
 if(payment.order_id!==booking.order_id||payment.amount!==booking.total_amount||payment.currency!=="INR")throw new ApiError(400,"The payment does not match this booking.");
 if(payment.status!=="captured")throw new ApiError(409,"The payment has not been captured yet. Please check My bookings again shortly.");
 if(booking.payment_id&&booking.payment_id!==paymentId)throw new ApiError(409,"A different payment is already linked to this booking.");
 if(["confirmed","refunded","refund_pending"].includes(booking.status)){
  if(booking.status==="refund_pending")await requestRefund(booking);
  return (await getBooking(bookingId))!;
 }
 const now=new Date().toISOString();
 // Re-check availability in the same UPDATE that confirms the booking, including
 // payments arriving after a hold expired. Never revive a cancelled booking.
 const confirmed=await database().withListingLock(booking.listing_id,tx=>tx.prepare(CONFIRM_BOOKING_SQL).bind(booking!.id,now,paymentId,now).first());
 if(!confirmed){
  await database().prepare("UPDATE bookings SET payment_id = ?, status = 'refund_pending' WHERE id = ? AND status IN ('pending_payment','expired','cancelled')").bind(paymentId,booking.id).run();
  booking=await getBooking(booking.id);if(booking?.status==="refund_pending")await requestRefund(booking);
 }
 return (await getBooking(bookingId))!;
}
