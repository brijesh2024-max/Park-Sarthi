// Isolated integration checks: all auth requests go to a local fake provider.
// No email is sent, and no deployed accounts or database records are changed.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';

const calls=[];
let autoConfirm=false;
let user={id:'713ab783-5829-4f39-b4c1-4ddc23406921',aud:'authenticated',role:'authenticated',email:'registration@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{},app_metadata:{provider:'email'},identities:[],created_at:new Date().toISOString()};
const jwt=()=>[ {alg:'HS256',typ:'JWT'}, {sub:user.id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),role:'authenticated'} ].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.local-test-signature';
const session=()=>({access_token:jwt(),refresh_token:'local-test-refresh',expires_in:3600,token_type:'bearer',user});
const provider=http.createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=raw?JSON.parse(raw):{};
 const path=new URL(req.url,'http://localhost').pathname;
 calls.push({path,body});
 res.setHeader('content-type','application/json');
 if(path==='/auth/v1/signup'){
  user={...user,user_metadata:body.data};
  return res.end(JSON.stringify(autoConfirm?session():{...user,email_confirmed_at:null}));
 }
 if(path==='/auth/v1/verify'){
  if(body.token!=='654321'||body.email!==user.email){res.statusCode=403;return res.end(JSON.stringify({msg:'Invalid code',code:'otp_expired'}));}
  return res.end(JSON.stringify(session()));
 }
 if(path==='/auth/v1/token')return res.end(JSON.stringify(session()));
 if(path==='/auth/v1/user'){
  if(req.method==='PUT')user={...user,user_metadata:{...user.user_metadata,...body.data}};
  return res.end(JSON.stringify(user));
 }
 if(['/auth/v1/otp','/auth/v1/resend','/auth/v1/logout'].includes(path))return res.end('{}');
 res.statusCode=404;res.end('{}');
});
provider.listen(0,'127.0.0.1');await once(provider,'listening');
const reservation=http.createServer();reservation.listen(0,'127.0.0.1');await once(reservation,'listening');
const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
const origin=`http://127.0.0.1:${port}`;
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--webpack','--hostname','127.0.0.1','--port',String(port)],{
 windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'development',NEXT_TELEMETRY_DISABLED:'1',APP_URL:origin,SUPABASE_URL:`http://127.0.0.1:${provider.address().port}`,SUPABASE_PUBLISHABLE_KEY:'local-test-public-key',SUPABASE_SERVICE_ROLE_KEY:'local-test-service-key',DATABASE_URL:'postgresql://local:local@127.0.0.1:1/local',PAYMENT_MODE:'disabled',LIVE_PAYMENTS_ENABLED:'false'}
});
let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{output=(output+chunk).slice(-16000);});
const post=(path,fields,cookie='',requestOrigin=origin)=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{origin:requestOrigin,'content-type':'application/x-www-form-urlencoded',cookie},body:new URLSearchParams(fields),signal:AbortSignal.timeout(60000)});
const cookies=response=>response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const noSession=response=>assert.equal(response.headers.getSetCookie().some(v=>/^sb-.*auth-token=/.test(v)&&!v.includes('Max-Age=0')),false);
const location=response=>new URL(response.headers.get('location'),origin);
try{
 let ready=false;
 for(let attempt=0;attempt<120;attempt++){
  if(child.exitCode!==null)throw new Error('Local app stopped before starting');
  try{const res=await fetch(origin+'/auth/sign-in',{signal:AbortSignal.timeout(1000)});if(res.ok){ready=true;break;}}catch{}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 assert.ok(ready,'Local app starts');
 const signin=await (await fetch(origin+'/auth/sign-in')).text();
 for(const text of ['Sign in with password','Continue with Google','Send sign-in OTP'])assert.ok(signin.includes(text),text);
 const signup=await (await fetch(origin+'/auth/sign-up')).text();
 for(const field of ['full_name','email','password','phone'])assert.ok(new RegExp(`<input(?=[^>]*name="${field}")(?=[^>]*required)[^>]*>`).test(signup),`${field} must be required`);
 assert.ok(!signup.includes('name="city"'));
 console.log('PASS: three login methods and required registration fields render');
 const fields={full_name:'Registration User',email:user.email,password:'only-a-local-test-password',password_confirmation:'only-a-local-test-password',phone:'+91 98765 43210',return_to:'/?view=bookings'};
 let response=await post('/auth/actions/sign-up',{...fields,phone:''});
 assert.equal(location(response).searchParams.get('error'),'profile');assert.equal(calls.length,0);
 response=await post('/auth/actions/sign-up',fields,'','https://other.example');
 assert.equal(response.status,403);assert.equal(calls.length,0);
 response=await post('/auth/actions/sign-up',fields);
 assert.equal(response.status,303);assert.equal(location(response).pathname,'/auth/verify-code');noSession(response);
 const pending=cookies(response);
 assert.equal(calls.at(-1).body.data.contact_phone,'+919876543210');
 response=await post('/auth/passwordless/verify',{code:'123456'},pending);
 assert.equal(location(response).searchParams.get('error'),'code');noSession(response);
 response=await post('/auth/passwordless/resend',{},pending);
 assert.equal(calls.at(-1).path,'/auth/v1/resend');assert.equal(calls.at(-1).body.type,'signup');noSession(response);
 response=await post('/auth/passwordless/verify',{code:'654321',return_to:fields.return_to},pending);
 assert.equal(location(response).pathname,'/auth/complete-profile');
 assert.equal(calls.at(-1).body.type,'signup');
 assert.ok(response.headers.getSetCookie().some(v=>v.startsWith('sb-')&&v.includes('HttpOnly')));
 const verifiedCookie=cookies(response);
 response=await fetch(origin+'/auth/complete-profile?return_to='+encodeURIComponent(fields.return_to),{redirect:'manual',headers:{cookie:verifiedCookie}});
 assert.equal(location(response).search,'?view=bookings');
 console.log('PASS: registration stays signed out until a valid OTP; resend and profile redirect work');
 autoConfirm=true;
 response=await post('/auth/actions/sign-up',fields);
 assert.equal(location(response).searchParams.get('error'),'confirmation_setup');noSession(response);
 autoConfirm=false;
 response=await post('/auth/actions/sign-in',{email:user.email,password:fields.password});
 assert.equal(location(response).pathname,'/auth/complete-profile');
 assert.ok(response.headers.getSetCookie().some(v=>v.startsWith('sb-')));
 response=await post('/auth/passwordless/send',{email:user.email});
 assert.equal(calls.at(-1).path,'/auth/v1/otp');assert.equal(calls.at(-1).body.create_user,false);
 response=await post('/auth/passwordless/verify',{code:'654321'},cookies(response));
 assert.equal(calls.at(-1).body.type,'email');assert.equal(location(response).pathname,'/auth/complete-profile');
 console.log('PASS: automatic signup sessions are rejected; existing password and email OTP login remain available');
 user={...user,user_metadata:{full_name:'Google User'}};
 response=await fetch(origin+'/auth/complete-profile',{headers:{cookie:verifiedCookie}});
 assert.ok((await response.text()).includes('Complete your profile.'));
 response=await post('/auth/complete-profile/save',{full_name:'Google User',phone:''},verifiedCookie);
 assert.equal(location(response).searchParams.get('error'),'profile');
 response=await post('/auth/complete-profile/save',{full_name:'Google User',phone:'9876543210',return_to:'/?view=host'},verifiedCookie);
 assert.equal(location(response).search,'?view=host');assert.equal(user.user_metadata.contact_phone,'9876543210');
 response=await post('/auth/passwordless/google',{return_to:'/'});
 assert.equal(location(response).searchParams.get('provider'),'google');
 console.log('PASS: verified Google users complete their required mobile details without another email OTP');
}catch(error){
 console.error(output);throw error;
}finally{
 child.kill();provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve));
}
