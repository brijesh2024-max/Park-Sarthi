import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Pilot information · ParkSaathi' };

export default function PilotInformation() {
  return <main style={{maxWidth:780,margin:'0 auto',padding:'56px 24px 80px',fontFamily:'Arial, sans-serif',color:'#193b30',lineHeight:1.7}}>
    <a href="/" style={{color:'inherit',fontWeight:700}}>← Back to ParkSaathi</a>
    <p style={{marginTop:48,fontSize:12,letterSpacing:2,fontWeight:700}}>PILOT INFORMATION</p>
    <h1 style={{fontSize:42,lineHeight:1.15,letterSpacing:-1}}>Before you park.</h1>
    <p style={{fontSize:19}}>ParkSaathi is a private pilot for finding and sharing parking space. Here is what you can expect from this version.</p>
    <section style={{marginTop:36}}><h2>Sample spaces and demo bookings</h2><p>Listings marked “Sample space” are examples. A demo booking does not reserve a real space, take payment, or give permission to park at the pictured location. Use fictional vehicle details when trying the demo.</p></section>
    <section style={{marginTop:32}}><h2>Know the space</h2><p>Amenities such as CCTV, gates, and covered parking are supplied by the host. A reviewed listing does not guarantee security, insurance, legal permission, or protection against fines. Hosts must have permission to offer their property. Drivers must follow the host’s instructions and local parking rules.</p></section>
    <section style={{marginTop:32}}><h2>Prices and cancellation</h2><p>The booking quote shows parking, an optional car wash, and a 10% service fee. Parking is charged for each started hour. Demo bookings can be cancelled in My bookings. When payments are enabled, cancellation before the parking session starts requests a full refund; a refund is shown as complete only after the payment provider confirms it. Provider processing times vary.</p><p>The pilot does not offer a staffed support service. Do not use it for real parking until the operator has published support contact details and customer terms. Sessions that have started require operator review.</p></section>
    <section style={{marginTop:32}}><h2>Your information</h2><p>Sign-in provides an account identifier and profile details. The service stores booking times, vehicle details, listings, addresses, and uploaded photos to provide its features. Your own records are accessible from your account; hosts can see bookings at their spaces, and authorized administrators can review listings and transactions.</p><p>Exact property addresses are hidden from public listing results and shared with the host, administrators, and confirmed bookers. Approved listing photographs are visible to visitors. Avoid uploading identity documents, faces, registration plates, or other private information in photos. Payment card details are handled by the payment provider, not a ParkSaathi form.</p><p>This page explains the pilot’s behavior. It is not the final privacy policy or customer agreement for a public service. Those documents, retention rules, and a privacy contact must be established before public launch.</p></section>
    <a href="/" style={{display:'inline-block',marginTop:32,color:'inherit',fontWeight:700}}>Explore sample spaces →</a>
  </main>;
}
