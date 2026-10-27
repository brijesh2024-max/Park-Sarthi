import assert from 'node:assert/strict';

// This script writes disposable test records only to the loopback development DB.
const origin = process.env.SMOKE_ORIGIN || 'http://127.0.0.1:5173';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Smoke writes are restricted to a local preview.');
let cookie = '';
async function request(path, body, extra = {}) {
  const response = await fetch(origin + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(cookie ? { cookie } : {}), ...(body !== undefined ? {'Content-Type': 'application/json', Origin: origin} : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = {error:raw}; }
  return {status: response.status, data};
}
const unauth = await request('/api/account');
assert.equal(unauth.status, 401, 'Accounts require sign-in');
const signin = await fetch(origin + '/signin-with-chatgpt?return_to=/', {redirect:'manual'});
cookie = signin.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
assert.ok(cookie, 'Local sign-in sets a session cookie');
const bootstrap = await request('/api/bootstrap');
assert.equal(bootstrap.status, 200);
assert.ok(bootstrap.data.user?.id);
assert.equal(bootstrap.data.bookingsEnabled, false, 'Customer bookings are disabled without live payment setup');
assert.ok(bootstrap.data.listings.every(v=>!v.id.startsWith('demo-')&&!v.demo), 'No sample catalogue is appended');
const startAt = new Date(Date.now() + 86400000).toISOString();
const endAt = new Date(Date.parse(startAt) + 2 * 3600000).toISOString();
const input = {listingId:'demo-delhi-1',startAt,endAt,vehicleType:'car',vehicleNumber:'DL01AB1234',addWash:true};
const forged = await request('/api/bookings', input, {Origin:'https://untrusted.example'});
assert.equal(forged.status,403,'Cross-origin writes are rejected');
const before = await request('/api/account');
assert.ok(before.data.bookings.every(b=>b.paymentMode==='live'&&b.status!=='demo'), 'Historical simulations are hidden');
const sampleAttempt = await request('/api/bookings',input);
assert.equal(sampleAttempt.status,404,'Old sample URLs cannot create a reservation');
const invalid = await request('/api/bookings',{...input,listingId:'invalid/id'});
assert.equal(invalid.status,400,'Malformed listing identifiers are rejected');
const after = await request('/api/account');
assert.deepEqual(after.data.bookings,before.data.bookings,'Rejected requests create no bookings');
const admin = await request('/api/admin');
assert.equal(admin.status,403,'Normal accounts cannot access admin data');
const fakePayment = await request('/api/payments/verify',{bookingId:'nonexistent',razorpay_order_id:'fake',razorpay_payment_id:'fake',razorpay_signature:'0'.repeat(64)});
assert.equal(fakePayment.status,404,'A forged callback cannot create a booking');
const badPhoto = new FormData();
badPhoto.set('file',new Blob(['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],{type:'image/svg+xml'}),'bad.svg');
const rejectedPhoto = await fetch(origin+'/api/uploads',{method:'POST',headers:{cookie,Origin:origin},body:badPhoto});
assert.ok(rejectedPhoto.status>=400,'Active SVG uploads are rejected');
const image = new FormData();
image.set('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aNqkAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'test-space.png');
const upload = await fetch(origin+'/api/uploads',{method:'POST',headers:{cookie,Origin:origin},body:image});
assert.equal(upload.status,201,'Raster image is stored in R2');
const {url:imageUrl}=await upload.json();
assert.equal((await fetch(origin+imageUrl,{headers:{cookie}})).status,200,'Owner can read an uploaded photo');
assert.equal((await fetch(origin+imageUrl)).status,404,'Unpublished photo is hidden from anonymous users');
const listing = await request('/api/listings',{
  title:'Smoke test private parking',city:'Delhi',area:'Test neighbourhood',address:'Test-only address, do not use for parking',
  description:'Disposable local test listing for the automated smoke suite.',vehicleTypes:['car','bike'],
  pricePerHour:2500,washPrice:null,capacity:1,amenities:['Covered'],imageUrl,lat:28.63,lng:77.21,rightsConfirmed:true,
});
assert.equal(listing.status,201,JSON.stringify(listing));
assert.equal(listing.data.listing.status,'pending','New host listings require review');
const published = await request('/api/listings');
assert.ok(!published.data.listings.some(v=>v.id===listing.data.listing.id),'Pending listings are not public');
const paused = await fetch(origin+'/api/listings/'+listing.data.listing.id,{method:'PATCH',headers:{cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({status:'draft'})});
assert.equal(paused.status,200,'Owner can pause their listing');
const ownerAccount = await request('/api/account');
assert.ok(ownerAccount.data.listings.some(v=>v.id===listing.data.listing.id&&v.status==='draft'),'Host listing persists');
console.log('PASS: authentication, real-only catalogue, booking readiness, hidden simulation history, rejected sample bookings, cross-origin protection, validation, admin authorization, forged callback rejection, upload validation, R2 photo privacy, listing review gate, host persistence and pause.');
