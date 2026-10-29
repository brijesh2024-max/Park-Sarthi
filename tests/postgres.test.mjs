import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { Database, postgresPlaceholders } from '../db/adapter.ts';
import { databaseConnectionConfig } from '../db/config.ts';
import { CREATE_BOOKING_SQL, CONFIRM_BOOKING_SQL, RECONCILE_FULL_REFUND_SQL } from '../lib/server/booking-sql.ts';

const migration = readFileSync(new URL('../postgres/0001_marketplace.sql',import.meta.url),'utf8');
const supabaseMigration = readFileSync(new URL('../postgres/0002_supabase.sql',import.meta.url),'utf8');
const NOW='2030-01-01T00:00:00.000Z', EXPIRY='2030-01-01T00:10:00.000Z';
const at=hour=>`2030-01-02T${String(hour).padStart(2,'0')}:00:00.000Z`;
let memory, db;
before(async()=>{
 memory=new PGlite();
 await memory.exec(migration);
 await memory.exec('SET search_path TO parksarthi, public');
 const query=async(sql,values)=>{const result=await memory.query(sql,values);return {rows:result.rows,rowCount:result.affectedRows};};
 const client={query,release(){}};
 db=new Database(client,async()=>client);
});
after(async()=>{await memory?.close();});

async function setup(capacity=1) {
 await memory.exec('TRUNCATE parksarthi.bookings,parksarthi.listings CASCADE');
 await db.prepare(`INSERT INTO listings(id,host_id,title,city,area,address,description,vehicle_types,price_per_hour,wash_price,capacity,amenities,image_url,lat,lng,status,rights_confirmed_at,created_at,updated_at) VALUES ('space-1','host-1','Parking space','Delhi','Central','Private address','Test-only listing','["car"]',5000,NULL,?,'[]','/image.jpg',28.6,77.2,'active',?,?,?)`).bind(capacity,NOW,NOW,NOW).run();
}
function insert(database,{id=crypto.randomUUID(),user=id,start=9,end=11,capacity=1,status='pending_payment',expires=EXPIRY}={}) {
 return database.prepare(CREATE_BOOKING_SQL).bind('space-1',at(start),at(end),NOW,capacity,user,'DL01AB1234',
  id,user,'host-1','space-1',JSON.stringify({title:'Test parking',city:'Delhi',area:'Central',imageUrl:'',address:'Private address'}),at(start),at(end),'car','DL01AB1234',0,10000,0,1000,11000,status,'live',NOW,expires,'123456').first();
}
const reserve=options=>db.withListingLock('space-1',locked=>insert(locked,options));
const confirm=id=>db.withListingLock('space-1',locked=>locked.prepare(CONFIRM_BOOKING_SQL).bind(id,NOW,`pay_${id}`,NOW).first());

test('PostgreSQL placeholders preserve quoted values, identifiers, dollar blocks and nested comments',()=>{
 const result=postgresPlaceholders(`SELECT ?, '?', "?", E'it\\'s ?', 'it''s ?', $$?$$, $body$?$body$, ? -- ?\n/* ? /* ? */ ? */ WHERE value=?`);
 assert.equal(result.count,3);
 assert.equal(result.text,`SELECT $1, '?', "?", E'it\\'s ?', 'it''s ?', $$?$$, $body$?$body$, $2 -- ?\n/* ? /* ? */ ? */ WHERE value=$3`);
});
test('PostgreSQL TLS remains verified even with require or conflicting URL parameters',()=>{
 for(const suffix of ['', '?sslmode=require','?sslmode=verify-full','?ssl=false&uselibpqcompat=true']) {
  const config=databaseConnectionConfig({DATABASE_URL:'postgresql://user:pass@db.example/app'+suffix});
  assert.equal(config.ssl.rejectUnauthorized,true);
  assert.ok(!new URL(config.connectionString).searchParams.has('sslmode'));
  assert.ok(!new URL(config.connectionString).searchParams.has('ssl'));
 }
 assert.throws(()=>databaseConnectionConfig({DATABASE_URL:'postgresql://user:pass@db.example/app?sslmode=disable'}),/verified TLS/);
 assert.equal(databaseConnectionConfig({DATABASE_URL:'postgresql://user:pass@localhost/app?sslmode=disable'}).ssl,false);
 assert.throws(()=>databaseConnectionConfig({DATABASE_URL:'postgresql://user:pass@localhost/app?sslmode=disable',NODE_ENV:'production'}),/verified TLS/);
 assert.equal(databaseConnectionConfig({DATABASE_URL:'postgresql://user:pass@db.example/app',DATABASE_SSL_CA:'line1\\nline2'}).ssl.ca,'line1\nline2');
});
test('marketplace migration is repeatable and data tables have row-level security',async()=>{
 await memory.exec(migration);
 const result=await memory.query("SELECT relname,relrowsecurity FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace WHERE n.nspname='parksarthi' AND relkind='r'");
 assert.equal(result.rows.length,6);
 assert.ok(result.rows.every(row=>row.relrowsecurity));
});
test('PostgreSQL allows consecutive occupancy but rejects peak capacity overflow',async()=>{
 await setup(2);
 assert.ok(await reserve({id:'a',start:9,end:10,capacity:2,status:'confirmed'}));
 assert.ok(await reserve({id:'b',start:10,end:11,capacity:2,status:'confirmed'}));
 assert.ok(await reserve({id:'c',start:9,end:11,capacity:2}));
 assert.equal(await reserve({id:'d',start:9,end:11,capacity:2}),null);
 assert.ok(await confirm('c'));
});
test('capacity comes from the locked listing, and unapproved spaces cannot be reserved',async()=>{
 await setup(1);
 assert.ok(await reserve({id:'a',capacity:100}));
 assert.equal(await reserve({id:'b',capacity:100}),null);
 for(const status of ['pending','draft','rejected']) {
  await db.prepare('UPDATE listings SET status=?').bind(status).run();
  assert.equal(await reserve({start:12,end:13}),null);
 }
});
test('expired holds and test payments do not block real capacity, and legacy tests cannot confirm',async()=>{
 await setup();
 assert.ok(await reserve({id:'legacy'}));
 await db.prepare("UPDATE bookings SET payment_mode='test' WHERE id='legacy'").run();
 assert.ok(await reserve({id:'old',expires:'2029-12-31T23:59:00.000Z'}));
 assert.ok(await reserve({id:'new'}));
 assert.equal(await confirm('old'),null);
 assert.equal(await confirm('legacy'),null);
 assert.ok(await confirm('new'));
});
test('late capture respects cancellation and paused listings and can use free capacity',async()=>{
 await setup();
 assert.ok(await reserve({id:'late',expires:'2029-12-31T23:59:00.000Z'}));
 assert.ok(await confirm('late'));
 await db.prepare("UPDATE bookings SET status='cancelled' WHERE id='late'").run();
 assert.equal(await confirm('late'),null);
 assert.ok(await reserve({id:'paused'}));
 await db.prepare("UPDATE listings SET status='draft'").run();
 assert.equal(await confirm('paused'),null);
});
test('duplicate requests and full-refund events are idempotent on PostgreSQL',async()=>{
 await setup(5);
 assert.ok(await reserve({id:'paid',user:'same',status:'confirmed'}));
 assert.equal(await reserve({id:'duplicate',user:'same'}),null);
 assert.equal((await db.prepare(RECONCILE_FULL_REFUND_SQL).bind('rfnd_1','paid').run()).changes,1);
 assert.equal((await db.prepare(RECONCILE_FULL_REFUND_SQL).bind('rfnd_1','paid').run()).changes,0);
 assert.ok(await reserve({id:'replacement',user:'same'}));
});
test('listing transaction rolls back on failure and rejects mismatched parameters',async()=>{
 await setup();
 await assert.rejects(db.withListingLock('space-1',async locked=>{await insert(locked,{id:'rollback'});throw new Error('forced failure');}),/forced failure/);
 assert.equal(await db.prepare('SELECT id FROM bookings WHERE id=?').bind('rollback').first(),null);
 await assert.rejects(db.prepare('SELECT ?').first(),/parameter count/);
});
test('row-lock protocol acquires, executes and commits on one connection and releases it',async()=>{
 const events=[];
 const client={query:async(sql,params)=>{events.push({sql,params});return {rows:[]};},release:()=>events.push({sql:'RELEASE'})};
 const fake=new Database({query:async()=>{throw new Error('Pool query must not execute transaction work');}},async()=>client);
 await fake.withListingLock('listing-123',locked=>locked.prepare('SELECT ?').bind('value').all());
 assert.deepEqual(events.map(e=>e.sql),['BEGIN ISOLATION LEVEL READ COMMITTED','SET LOCAL search_path TO parksarthi, public','SELECT id FROM parksarthi.listings WHERE id = $1 FOR UPDATE','SELECT $1','COMMIT','RELEASE']);
 assert.deepEqual(events[2].params,['listing-123']);
});
test('Supabase migration stores real signup profiles and keeps photos private',async()=>{
 await memory.exec(`CREATE SCHEMA IF NOT EXISTS auth; CREATE SCHEMA IF NOT EXISTS storage;
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE TABLE auth.users(id uuid PRIMARY KEY,raw_user_meta_data jsonb);
  CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await memory.exec(supabaseMigration);
 await memory.exec(supabaseMigration);
 const id='c0e294ef-a544-44d3-a26e-6be594ca29de';
 await memory.query("INSERT INTO auth.users VALUES ($1,$2::jsonb)",[id,JSON.stringify({full_name:'Example test user',role:'admin'})]);
 const profile=(await memory.query('SELECT * FROM public.profiles WHERE user_id=$1',[id])).rows[0];
 assert.equal(profile.full_name,'Example test user');
 assert.equal(profile.role,undefined);
 const bucket=(await memory.query("SELECT * FROM storage.buckets WHERE id='parking-photos'")).rows[0];
 assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);
 assert.deepEqual(bucket.allowed_mime_types,['image/jpeg','image/png','image/webp']);
 const permissions=(await memory.query("SELECT has_table_privilege('authenticated','public.profiles','SELECT') AS profile,has_schema_privilege('anon','parksarthi','USAGE') AS marketplace")).rows[0];
 assert.equal(permissions.profile,false);assert.equal(permissions.marketplace,false);
});

// PGlite executes the real PostgreSQL statements but has a single database session.
// Cross-connection isolation is verified only with an explicitly supplied disposable DB.
test('independent PostgreSQL connections cannot oversell one shared listing', {skip:!process.env.TEST_DATABASE_URL}, async()=>{
 const config=databaseConnectionConfig({DATABASE_URL:process.env.TEST_DATABASE_URL,DATABASE_SSL_CA:process.env.TEST_DATABASE_SSL_CA,DATABASE_POOL_MAX:'10',NODE_ENV:'test'});
 const pool=new Pool(config);
 const id='concurrency-'+crypto.randomUUID();
 const query=async(sql,values)=>{const client=await pool.connect();try{await client.query('SET search_path TO parksarthi, public');return await client.query(sql,values);}finally{client.release();}};
 const live=new Database({query},()=>pool.connect());
 try {
  const exists=await query("SELECT to_regclass('parksarthi.listings') AS table_name");
  assert.ok(exists.rows[0].table_name,'Apply postgres/0001_marketplace.sql to the disposable TEST_DATABASE_URL database first');
  await query(`INSERT INTO listings(id,host_id,title,city,area,address,description,vehicle_types,price_per_hour,capacity,amenities,image_url,lat,lng,status,rights_confirmed_at,created_at,updated_at) VALUES ($1,'test-host','Concurrency test','Delhi','Test','Test-only address','Disposable concurrency fixture','["car"]',5000,2,'[]','/test.png',28.6,77.2,'active',$2,$2,$2)`,[id,NOW]);
  const bookings=await Promise.all(Array.from({length:8},(_,n)=>live.withListingLock(id,locked=>{
   const bid=`${id}-${n}`;
   return locked.prepare(CREATE_BOOKING_SQL).bind(id,at(9),at(11),NOW,2,bid,'DL01TEST99',bid,bid,'test-host',id,'{}',at(9),at(11),'car','DL01TEST99',0,10000,0,1000,11000,'pending_payment','live',NOW,EXPIRY,'123456').first();
  })));
  assert.equal(bookings.filter(Boolean).length,2);
 } finally {
  await query('DELETE FROM bookings WHERE listing_id=$1',[id]);
  await query('DELETE FROM listings WHERE id=$1',[id]);
  await pool.end();
 }
});
