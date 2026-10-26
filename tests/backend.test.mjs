import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { CITIES, DEMO_LISTINGS, quoteBooking, validateBooking, validateListing, validateAvailability, validateBookingAvailability, detectImage } from '../lib/marketplace.ts';
import { CREATE_BOOKING_SQL, CONFIRM_BOOKING_SQL, RECONCILE_FULL_REFUND_SQL } from '../lib/server/booking-sql.ts';
import { verifyHmac } from '../lib/server/signatures.ts';

const NOW='2030-01-01T00:00:00.000Z';
const at=hour=>`2030-01-02T${String(hour).padStart(2,'0')}:00:00.000Z`;
const expiry='2030-01-01T00:10:00.000Z';
function insert(db,{id=crypto.randomUUID(),user=id,start=9,end=11,capacity=1,status='pending_payment',expires=expiry,demo=false}={}){
 const startAt=at(start),endAt=at(end),plate='DL01AB1234';
 return db.prepare(CREATE_BOOKING_SQL).get('space-1',startAt,endAt,NOW,capacity,demo?1:0,user,plate,
  id,user,'host-1','space-1',JSON.stringify({title:'Parking',city:'Delhi',area:'Central',imageUrl:'',address:'Private address'}),startAt,endAt,'car',plate,0,10000,0,1000,11000,status,demo?'demo':'test',NOW,expires,'123456');
}
function setup(path=':memory:',capacity=1){
 const db=new DatabaseSync(path);db.exec('PRAGMA busy_timeout=10000;');
 for(const name of readdirSync(new URL('../drizzle/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort())db.exec(readFileSync(new URL(`../drizzle/${name}`,import.meta.url),'utf8'));
 db.prepare(`INSERT INTO listings(id,host_id,title,city,area,address,description,vehicle_types,price_per_hour,wash_price,capacity,amenities,image_url,lat,lng,status,rights_confirmed_at,created_at,updated_at) VALUES ('space-1','host-1','Parking space','Delhi','Central','Private address','Example listing','["car"]',5000,NULL,?,'[]','/image.jpg',28.6,77.2,'active',?,?,?)`).run(capacity,NOW,NOW,NOW);
 return db;
}

if(!isMainThread){
 const db=new DatabaseSync(workerData.path);db.exec('PRAGMA busy_timeout=10000;');
 try{parentPort.postMessage(Boolean(insert(db,{id:workerData.id,capacity:2})));}finally{db.close();}
}else{
 test('prices use integer paise, rounded started hours, optional wash and transparent fee',()=>{
  assert.deepEqual(quoteBooking({pricePerHour:5000,washPrice:19900},at(9),at(11),true),{hours:2,parkingAmount:10000,washAmount:19900,feeAmount:2990,totalAmount:32890});
  assert.equal(quoteBooking({pricePerHour:5000,washPrice:null},at(9),'2030-01-02T10:01:00.000Z',false).parkingAmount,10000);
  assert.throws(()=>quoteBooking({pricePerHour:5000,washPrice:null},at(9),at(10),true),/not offered/);
 });
 test('booking validation rejects past/too long/unsupported/tampered options',()=>{
  const listing=DEMO_LISTINGS[0],valid={listingId:listing.id,startAt:at(9),endAt:at(11),vehicleType:'car',vehicleNumber:'dl 01 ab 1234',addWash:true};
  assert.equal(validateBooking(valid,listing,Date.parse(NOW)).vehicleNumber,'DL01AB1234');
  assert.throws(()=>validateBooking({...valid,startAt:'2020-01-01'},listing,Date.parse(NOW)),/future/);
  assert.throws(()=>validateBooking({...valid,endAt:'2030-02-01'},listing,Date.parse(NOW)),/7 days/);
  assert.throws(()=>validateBooking({...valid,vehicleType:'truck'},listing,Date.parse(NOW)),/vehicle type/);
  assert.throws(()=>validateBooking({...valid,vehicleType:'bike'},listing,Date.parse(NOW)),/cars and SUVs/);
  assert.throws(()=>validateBooking({...valid,addWash:'true'},listing,Date.parse(NOW)),/whether/);
 });
 test('host validation requires permissions, bounded prices and a local uploaded photo',()=>{
  const input={...DEMO_LISTINGS[0],rightsConfirmed:true,imageUrl:'/api/photos/abcd-1234.jpg'};
  assert.equal(validateListing(input).city,'Delhi');
  assert.throws(()=>validateListing({...input,rightsConfirmed:false}),/permission/);
  assert.throws(()=>validateListing({...input,pricePerHour:-1}),/Hourly/);
  assert.throws(()=>validateListing({...input,imageUrl:'https://attacker.example/photo.svg'}),/Upload/);
  assert.equal(new Set(DEMO_LISTINGS.map(l=>l.city)).size,CITIES.length);
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
 test('atomic SQL allows consecutive occupancy at capacity two',()=>{
  const db=setup(':memory:',2);try{
   assert.ok(insert(db,{id:'a',start:9,end:10,capacity:2,status:'confirmed'}));
   assert.ok(insert(db,{id:'b',start:10,end:11,capacity:2,status:'confirmed'}));
   assert.ok(insert(db,{id:'c',start:9,end:11,capacity:2}));
   assert.equal(insert(db,{id:'d',start:9,end:11,capacity:2}),undefined);
   assert.ok(db.prepare(CONFIRM_BOOKING_SQL).get('c',NOW,'pay_c',NOW));
  }finally{db.close();}
 });
 test('capacity one blocks overlapping intervals but allows adjacent intervals',()=>{
  const db=setup();try{
   assert.ok(insert(db,{id:'a',start:9,end:10}));
   assert.ok(insert(db,{id:'b',start:10,end:11}));
   assert.equal(insert(db,{id:'c',start:9,end:11}),undefined);
  }finally{db.close();}
 });
 test('expired holds release capacity and late capture cannot displace new booking',()=>{
  const db=setup();try{
   assert.ok(insert(db,{id:'old',expires:'2029-12-31T23:59:00.000Z'}));
   assert.ok(insert(db,{id:'new'}));
   assert.equal(db.prepare(CONFIRM_BOOKING_SQL).get('old',NOW,'pay_old',NOW),undefined);
   assert.ok(db.prepare(CONFIRM_BOOKING_SQL).get('new',NOW,'pay_new',NOW));
  }finally{db.close();}
 });
 test('late capture succeeds when capacity remains, but cancellation and paused listings cannot revive',()=>{
  const db=setup();try{
   assert.ok(insert(db,{id:'late',expires:'2029-12-31T23:59:00.000Z'}));
   assert.ok(db.prepare(CONFIRM_BOOKING_SQL).get('late',NOW,'pay_late',NOW));
   db.prepare("UPDATE bookings SET status='cancelled' WHERE id='late'").run();
   assert.equal(db.prepare(CONFIRM_BOOKING_SQL).get('late',NOW,'pay_late',NOW),undefined);
   assert.ok(insert(db,{id:'paused'}));db.prepare("UPDATE listings SET status='draft'").run();
   assert.equal(db.prepare(CONFIRM_BOOKING_SQL).get('paused',NOW,'pay_paused',NOW),undefined);
  }finally{db.close();}
 });
 test('identical booking submissions are idempotently blocked at the database',()=>{
  const db=setup(':memory:',5);try{
   assert.ok(insert(db,{id:'a',user:'same',capacity:5}));
   assert.equal(insert(db,{id:'b',user:'same',capacity:5}),undefined);
  }finally{db.close();}
 });
 test('dashboard full refund releases a confirmed booking and is idempotent',()=>{
  const db=setup();try{
   assert.ok(insert(db,{id:'paid',status:'confirmed'}));
   assert.equal(db.prepare(RECONCILE_FULL_REFUND_SQL).run('rfnd_1','paid').changes,1);
   assert.equal(db.prepare('SELECT status FROM bookings WHERE id=?').get('paid').status,'refunded');
   assert.equal(db.prepare(RECONCILE_FULL_REFUND_SQL).run('rfnd_1','paid').changes,0);
   assert.ok(insert(db,{id:'replacement'}));
  }finally{db.close();}
 });
 test('concurrent SQLite writers cannot overbook the shared capacity',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'parksaathi-sql-')),path=join(dir,'bookings.sqlite');
  const db=setup(path,2);db.exec('PRAGMA journal_mode=WAL');db.close();
  try{
   const outcomes=await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{path,id:`concurrent-${i}`}});
    let outcome;worker.once('message',value=>{outcome=value;});worker.once('error',reject);worker.once('exit',code=>{if(code!==0)reject(new Error(`Worker exit ${code}`));else resolve(outcome);});
   })));
   assert.equal(outcomes.filter(Boolean).length,2);
   const check=new DatabaseSync(path);assert.equal(check.prepare('SELECT count(*) AS n FROM bookings').get().n,2);check.close();
  }finally{
   const target=resolve(dir),root=resolve(tmpdir())+sep;
   assert.ok(target.startsWith(root)&&target.split(sep).at(-1).startsWith('parksaathi-sql-'));
   rmSync(target,{recursive:true,force:true});
  }
 });
}
