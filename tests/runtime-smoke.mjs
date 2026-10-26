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
assert.equal(bootstrap.data.paymentMode, 'demo');
assert.ok(bootstrap.data.listings.length >= 8);
assert.ok(bootstrap.data.listings.filter(v=>v.demo).every(v=>v.address.includes('sample') || !v.address || v.address.includes(v.area)));
const startAt = new Date(Date.now() + 86400000).toISOString();
const endAt = new Date(Date.parse(startAt) + 2 * 3600000).toISOString();
const input = {listingId:'demo-delhi-1',startAt,endAt,vehicleType:'car',vehicleNumber:'DL01AB1234',addWash:true};
const forged = await request('/api/bookings', input, {Origin:'https://untrusted.example'});
assert.equal(forged.status, 403, 'Cross-origin writes are rejected');
const invalid = await request('/api/bookings', {...input, startAt:'invalid'});
assert.equal(invalid.status, 400, 'Malformed dates are rejected');
const made = await request('/api/bookings', {...input,totalAmount:1});
assert.ok([200,201].includes(made.status), JSON.stringify(made));
assert.equal(made.data.booking.status, 'demo');
assert.equal(made.data.booking.totalAmount, 38390, 'Server ignores client total and computes 2h + wash + 10%');
assert.equal(made.data.checkout, undefined, 'Demo never opens a real checkout');
const account = await request('/api/account');
assert.ok(account.data.bookings.some(b=>b.id===made.data.booking.id), 'Booking persists in D1');
const cancelled = await request(`/api/bookings/${made.data.booking.id}/cancel`, {});
assert.ok([200,201].includes(cancelled.status), JSON.stringify(cancelled));
const after = await request('/api/account');
assert.equal(after.data.bookings.find(b=>b.id===made.data.booking.id).status,'cancelled');
const admin = await request('/api/admin');
assert.equal(admin.status,403,'Normal accounts cannot access admin data');
const fakePayment = await request('/api/payments/verify', {bookingId:made.data.booking.id,razorpay_order_id:'fake',razorpay_payment_id:'fake',razorpay_signature:'0'.repeat(64)});
assert.ok(fakePayment.status>=400,'Forged payment cannot confirm a reservation');
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
console.log('PASS: authentication, 8-city catalogue, cross-origin protection, validation, authoritative pricing, durable demo booking, cancellation, admin authorization, forged payment rejection, unsafe upload rejection, R2 upload/read, photo privacy, listing review gate, host persistence and pause.');
