import test from 'node:test';
import assert from 'node:assert/strict';
import { quoteBooking, validateBooking, validateListing, validateAvailability, validateBookingAvailability, detectImage } from '../lib/marketplace.ts';
import { TEST_LISTING } from './fixtures.mjs';
import { configuredPaymentMode, liveBookingsEnabled } from '../lib/payment-config.ts';
import { verifyHmac } from '../lib/server/signatures.ts';

const NOW='2030-01-01T00:00:00.000Z';
const at=hour=>`2030-01-02T${String(hour).padStart(2,'0')}:00:00.000Z`;

 test('customer bookings stay disabled without a complete explicitly enabled live configuration',()=>{
  const live={PAYMENT_MODE:'live',LIVE_PAYMENTS_ENABLED:'true',RAZORPAY_KEY_ID:'rzp_live_fixture',RAZORPAY_KEY_SECRET:'fixture-secret',RAZORPAY_WEBHOOK_SECRET:'fixture-webhook'};
  assert.equal(liveBookingsEnabled(live),true);
  assert.equal(configuredPaymentMode({}), 'disabled');
  for(const mode of [undefined,'demo','disabled','test','unknown'])assert.equal(liveBookingsEnabled({...live,PAYMENT_MODE:mode}),false);
  for(const name of Object.keys(live))assert.equal(liveBookingsEnabled({...live,[name]:''}),false,`Missing ${name}`);
  assert.equal(liveBookingsEnabled({...live,LIVE_PAYMENTS_ENABLED:'false'}),false);
  assert.equal(liveBookingsEnabled({...live,RAZORPAY_KEY_ID:'rzp_test_fixture'}),false);
  assert.equal(liveBookingsEnabled({...live,RAZORPAY_KEY_SECRET:'  '}),false);
 });
 test('prices use integer paise, rounded started hours, optional wash and transparent fee',()=>{
  assert.deepEqual(quoteBooking({pricePerHour:5000,washPrice:19900},at(9),at(11),true),{hours:2,parkingAmount:10000,washAmount:19900,feeAmount:2990,totalAmount:32890});
  assert.equal(quoteBooking({pricePerHour:5000,washPrice:null},at(9),'2030-01-02T10:01:00.000Z',false).parkingAmount,10000);
  assert.throws(()=>quoteBooking({pricePerHour:5000,washPrice:null},at(9),at(10),true),/not offered/);
 });
 test('booking validation rejects past/too long/unsupported/tampered options',()=>{
  const listing=TEST_LISTING,valid={listingId:listing.id,startAt:at(9),endAt:at(11),vehicleType:'car',vehicleNumber:'dl 01 ab 1234',addWash:true};
  assert.equal(validateBooking(valid,listing,Date.parse(NOW)).vehicleNumber,'DL01AB1234');
  assert.throws(()=>validateBooking({...valid,startAt:'2020-01-01'},listing,Date.parse(NOW)),/future/);
  assert.throws(()=>validateBooking({...valid,endAt:'2030-02-01'},listing,Date.parse(NOW)),/7 days/);
  assert.throws(()=>validateBooking({...valid,vehicleType:'truck'},listing,Date.parse(NOW)),/vehicle type/);
  assert.throws(()=>validateBooking({...valid,vehicleType:'bike'},listing,Date.parse(NOW)),/cars and SUVs/);
  assert.throws(()=>validateBooking({...valid,addWash:'true'},listing,Date.parse(NOW)),/whether/);
 });
 test('host validation requires permissions, bounded prices and a local uploaded photo',()=>{
  const input={...TEST_LISTING,rightsConfirmed:true,imageUrl:'/api/photos/abcd-1234.jpg'};
  assert.equal(validateListing(input).city,'Delhi');
  assert.throws(()=>validateListing({...input,rightsConfirmed:false}),/permission/);
  assert.throws(()=>validateListing({...input,pricePerHour:-1}),/Hourly/);
  assert.throws(()=>validateListing({...input,imageUrl:'https://attacker.example/photo.svg'}),/Upload/);
 });
 test('uploads reject disguised HTML and SVG; only raster signatures are accepted',()=>{
  assert.equal(detectImage(new TextEncoder().encode('<svg><script>alert(1)</script></svg>')),null);
  assert.equal(detectImage(new TextEncoder().encode('<html>not a photo</html>')),null);
  const jpg=new Uint8Array(20);jpg.set([255,216,255]);assert.deepEqual(detectImage(jpg),{mime:'image/jpeg',extension:'jpg'});
 });
 test('availability validates hours, real calendar dates and blocked-date limits',()=>{
  assert.deepEqual(validateAvailability({}),{openingTime:'00:00',closingTime:'00:00',blockedDates:[]});
  assert.throws(()=>validateAvailability({openingTime:'20:00',closingTime:'08:00'}),/after opening/);
  assert.throws(()=>validateAvailability({openingTime:'24:00'}),/valid opening/);
  assert.throws(()=>validateAvailability({blockedDates:['2030-02-30']}),/valid blocked/);
  assert.throws(()=>validateAvailability({blockedDates:Array(61).fill('2030-01-02')}),/60/);
 });
 test('booking hours use India time and permit exact opening and closing boundaries',()=>{
  const hours={openingTime:'14:30',closingTime:'16:30',blockedDates:[]};
  assert.doesNotThrow(()=>validateBookingAvailability(hours,Date.parse(at(9)),Date.parse(at(11))));
  assert.throws(()=>validateBookingAvailability(hours,Date.parse('2030-01-02T08:59:00Z'),Date.parse(at(11))),/IST/);
  assert.throws(()=>validateBookingAvailability(hours,Date.parse(at(9)),Date.parse('2030-01-02T11:01:00Z')),/IST/);
  assert.throws(()=>validateBookingAvailability(hours,Date.parse(at(9)),Date.parse('2030-01-03T10:00:00Z')),/IST/);
 });
 test('blocked dates cover every occupied India calendar date, excluding departure at midnight',()=>{
  const schedule={openingTime:'00:00',closingTime:'00:00',blockedDates:['2030-01-03']};
  assert.doesNotThrow(()=>validateBookingAvailability(schedule,Date.parse('2030-01-02T17:30:00Z'),Date.parse('2030-01-02T18:30:00Z')));
  assert.throws(()=>validateBookingAvailability(schedule,Date.parse('2030-01-02T17:30:00Z'),Date.parse('2030-01-02T18:31:00Z')),/blocked/);
  assert.throws(()=>validateBookingAvailability(schedule,Date.parse('2030-01-02T12:30:00Z'),Date.parse('2030-01-04T12:30:00Z')),/blocked/);
 });
 test('payment signatures reject wrong key, message and malformed signature',async()=>{
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const bytes=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('order_1|pay_1'));
  const signature=Buffer.from(bytes).toString('hex');
  assert.equal(await verifyHmac('test-secret','order_1|pay_1',signature),true);
  assert.equal(await verifyHmac('test-secret','order_2|pay_1',signature),false);
  assert.equal(await verifyHmac('wrong','order_1|pay_1',signature),false);
  assert.equal(await verifyHmac('test-secret','order_1|pay_1','nope'),false);
 });
