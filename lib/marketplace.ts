export const CITIES = ["Delhi", "Mumbai", "Bengaluru", "Hyderabad", "Pune", "Chennai", "Gurugram", "Noida"] as const;
export const AMENITIES = ["Covered", "CCTV", "Gated", "24/7 access", "EV charging", "Security guard"] as const;
export type VehicleType = "car" | "bike" | "suv";
export type PaymentMode = "demo" | "test" | "live";
export type Listing = { id:string; hostId:string; title:string; city:string; area:string; address:string; description:string; vehicleTypes:VehicleType[]; pricePerHour:number; washPrice:number|null; capacity:number; amenities:string[]; imageUrl:string; lat:number; lng:number; status:"draft"|"pending"|"active"|"rejected"; demo:boolean; openingTime:string; closingTime:string; blockedDates:string[] };
export type Booking = { id:string; listingId:string; listingTitle:string; city:string; area:string; imageUrl:string; startAt:string; endAt:string; vehicleType:VehicleType; vehicleNumber:string; addWash:boolean; parkingAmount:number; washAmount:number; feeAmount:number; totalAmount:number; status:"demo"|"pending_payment"|"confirmed"|"cancelled"|"refund_pending"|"refunded"|"expired"; createdAt:string; checkInCode?:string; address?:string; paymentMode?:PaymentMode };
export type BookingInput = { listingId:string; startAt:string; endAt:string; vehicleType:VehicleType; vehicleNumber:string; addWash:boolean };
const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=85`;
const demo=(id:string,title:string,city:string,area:string,price:number,lat:number,lng:number,options:Partial<Listing>={}):Listing=>({id,hostId:"demo-host",title,city,area,address:`${area}, ${city} (sample location)`,description:"An example neighbourhood parking space to explore the ParkSaathi experience. This is a sample listing, not a real property or a live reservation.",vehicleTypes:["car","bike","suv"],pricePerHour:price,washPrice:null,capacity:4,amenities:["Covered","Gated","CCTV"],imageUrl:photo("photo-1506521781263-d8422e82f27a"),lat,lng,status:"active",demo:true,openingTime:"00:00",closingTime:"00:00",blockedDates:[],...options});
export const DEMO_LISTINGS:Listing[]=[
 demo("demo-delhi-1","A quiet spot in the heart of Delhi","Delhi","Connaught Place",5000,28.6315,77.2167,{washPrice:24900,amenities:["Covered","CCTV","Security guard"]}),
 demo("demo-delhi-2","Your neighbourhood driveway","Delhi","Greater Kailash",3500,28.5494,77.2347,{amenities:["Gated","24/7 access"],imageUrl:photo("photo-1590674899484-d5640e854abe"),capacity:2}),
 demo("demo-mumbai-1","Covered parking, Bandra West","Mumbai","Bandra West",7000,19.0596,72.8295,{washPrice:29900,amenities:["Covered","CCTV","EV charging"]}),
 demo("demo-bengaluru-1","An easy stop in Indiranagar","Bengaluru","Indiranagar",4000,12.9784,77.6408,{washPrice:19900,amenities:["Gated","CCTV","24/7 access"],imageUrl:photo("photo-1590674899484-d5640e854abe")}),
 demo("demo-hyderabad-1","Room for your ride in Gachibowli","Hyderabad","Gachibowli",3000,17.4401,78.3489,{amenities:["Covered","Security guard"]}),
 demo("demo-pune-1","A convenient Koregaon Park stop","Pune","Koregaon Park",3500,18.5362,73.894,{washPrice:19900,amenities:["Gated","CCTV"]}),
 demo("demo-chennai-1","Park a little closer, T. Nagar","Chennai","T. Nagar",3000,13.0418,80.2341,{vehicleTypes:["car","bike"],amenities:["Covered","Gated"]}),
 demo("demo-gurugram-1","A covered space near Cyber City","Gurugram","DLF Phase 2",4500,28.4927,77.0896,{washPrice:24900,amenities:["Covered","CCTV","EV charging"]}),
 demo("demo-noida-1","Sector 18 parking & a fresh wash","Noida","Sector 18",4000,28.5708,77.326,{washPrice:19900,amenities:["Covered","CCTV","Security guard"]}),
];
export function quoteBooking(listing:Pick<Listing,"pricePerHour"|"washPrice">,startAt:string,endAt:string,addWash:boolean){
 const milliseconds=Date.parse(endAt)-Date.parse(startAt);
 if(!Number.isFinite(milliseconds)||milliseconds<15*60000||milliseconds>7*24*3600000)throw new Error("Choose a parking duration between 15 minutes and 7 days.");
 if(addWash&&listing.washPrice===null)throw new Error("Car washing is not offered at this space.");
 const hours=Math.ceil(milliseconds/3600000),parkingAmount=hours*listing.pricePerHour,washAmount=addWash?listing.washPrice!:0,feeAmount=Math.round((parkingAmount+washAmount)*0.1);
 return{hours,parkingAmount,washAmount,feeAmount,totalAmount:parkingAmount+washAmount+feeAmount};
}
export function validateBooking(input:unknown,listing:Listing,now=Date.now()):BookingInput{
 if(!input||typeof input!=="object")throw new Error("Enter the booking details.");
 const v=input as Record<string,unknown>,start=typeof v.startAt==="string"?Date.parse(v.startAt):NaN,end=typeof v.endAt==="string"?Date.parse(v.endAt):NaN;
 if(!Number.isFinite(start)||!Number.isFinite(end))throw new Error("Choose a valid arrival and departure time.");
 if(start<now)throw new Error("Arrival must be in the future.");
 if(start>now+90*86400000)throw new Error("You can book up to 90 days ahead.");
 if(end-start<15*60000||end-start>7*86400000)throw new Error("Choose a parking duration between 15 minutes and 7 days.");
 if(!listing.vehicleTypes.includes(v.vehicleType as VehicleType))throw new Error("This space does not accept the selected vehicle type.");
 const vehicleNumber=typeof v.vehicleNumber==="string"?v.vehicleNumber.toUpperCase().replace(/[\s-]/g,""):"";
 if(!/^[A-Z0-9]{6,12}$/.test(vehicleNumber))throw new Error("Enter a valid vehicle registration number (6–12 letters and digits).");
 if(typeof v.addWash!=="boolean")throw new Error("Choose whether to add car washing.");
 if(v.addWash&&v.vehicleType==="bike")throw new Error("The car-wash add-on is for cars and SUVs.");
 if(v.addWash&&listing.washPrice===null)throw new Error("Car washing is not offered at this space.");
 validateBookingAvailability(listing,start,end);
 return{listingId:listing.id,startAt:new Date(start).toISOString(),endAt:new Date(end).toISOString(),vehicleType:v.vehicleType as VehicleType,vehicleNumber,addWash:v.addWash};
}
export function validateListing(input:unknown):Omit<Listing,"id"|"hostId"|"status"|"demo">{
 if(!input||typeof input!=="object")throw new Error("Enter the space details.");const v=input as Record<string,unknown>;
 const str=(key:string,min:number,max:number)=>{const t=typeof v[key]==="string"?v[key].trim():"";if(t.length<min||t.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t))throw new Error(`Enter a valid ${key} (${min}–${max} characters).`);return t;};
 const city=str("city",2,40);if(!(CITIES as readonly string[]).includes(city))throw new Error("Choose one of the supported cities.");
 if(v.rightsConfirmed!==true)throw new Error("Confirm that you have permission to offer this parking space.");
 if(!Array.isArray(v.vehicleTypes)||v.vehicleTypes.length===0||v.vehicleTypes.length>3||v.vehicleTypes.some(t=>!["car","bike","suv"].includes(t)))throw new Error("Select the vehicle types this space accepts.");
 if(!Array.isArray(v.amenities)||v.amenities.length>AMENITIES.length||v.amenities.some(a=>!(AMENITIES as readonly unknown[]).includes(a)))throw new Error("Choose valid amenities.");
 const pricePerHour=v.pricePerHour;if(!Number.isInteger(pricePerHour)||(pricePerHour as number)<1000||(pricePerHour as number)>200000)throw new Error("Hourly price must be between ₹10 and ₹2,000.");
 const washPrice=v.washPrice==null?null:v.washPrice;if(washPrice!==null&&(!Number.isInteger(washPrice)||(washPrice as number)<1000||(washPrice as number)>500000))throw new Error("Wash price must be between ₹10 and ₹5,000.");
 if(!Number.isInteger(v.capacity)||(v.capacity as number)<1||(v.capacity as number)>100)throw new Error("Capacity must be between 1 and 100 vehicles.");
 if(typeof v.lat!=="number"||!Number.isFinite(v.lat)||v.lat<6||v.lat>38||typeof v.lng!=="number"||!Number.isFinite(v.lng)||v.lng<68||v.lng>98)throw new Error("Choose valid coordinates in India.");
 const imageUrl=str("imageUrl",1,300);if(!/^\/api\/photos\/[a-f0-9-]+\.(jpg|png|webp)$/.test(imageUrl))throw new Error("Upload a photo of your parking space first.");
 return{title:str("title",5,100),city,area:str("area",2,80),address:str("address",10,300),description:str("description",20,1500),vehicleTypes:[...new Set(v.vehicleTypes)] as VehicleType[],pricePerHour:pricePerHour as number,washPrice:washPrice as number|null,capacity:v.capacity as number,amenities:[...new Set(v.amenities)] as string[],imageUrl,lat:v.lat,lng:v.lng,...validateAvailability(v)};
}
export function validateAvailability(input:Record<string,unknown>){
 const openingTime=input.openingTime??"00:00",closingTime=input.closingTime??"00:00",blockedDates=input.blockedDates??[];
 if(typeof openingTime!=="string"||typeof closingTime!=="string"||!/^([01]\d|2[0-3]):[0-5]\d$/.test(openingTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(closingTime))throw new Error("Enter valid opening and closing times.");
 if(!(openingTime==="00:00"&&closingTime==="00:00")&&closingTime<=openingTime)throw new Error("Closing time must be after opening time on the same day. Set both to 00:00 for 24-hour access.");
 if(!Array.isArray(blockedDates)||blockedDates.length>60||blockedDates.some(date=>typeof date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))throw new Error("Choose up to 60 valid blocked dates.");
 return{openingTime,closingTime,blockedDates:[...new Set(blockedDates)] as string[]};
}
export function validateBookingAvailability(listing:Pick<Listing,"openingTime"|"closingTime"|"blockedDates">,start:number,end:number){
 const offset=330*60000,day=86400000,localStart=start+offset,localEnd=end+offset;
 const startDay=Math.floor(localStart/day),lastDay=Math.floor((localEnd-1)/day);
 for(let date=startDay;date<=lastDay;date++)if((listing.blockedDates??[]).includes(new Date(date*day).toISOString().slice(0,10)))throw new Error("The host has blocked one of the dates in this booking. Choose another date.");
 const open=listing.openingTime??"00:00",close=listing.closingTime??"00:00";
 if(open==="00:00"&&close==="00:00")return;
 const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3));
 if(startDay!==lastDay||localStart%day/60000<minutes(open)||(localEnd-startDay*day)/60000>minutes(close))throw new Error(`This space is open ${open}–${close} IST. Choose a time within those hours.`);
}
export function detectImage(bytes:Uint8Array):{mime:string;extension:string}|null{
 if(bytes.length<16)return null;
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return{mime:"image/jpeg",extension:"jpg"};
 if([137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n))return{mime:"image/png",extension:"png"};
 if(String.fromCharCode(...bytes.slice(0,4))==="RIFF"&&String.fromCharCode(...bytes.slice(8,12))==="WEBP")return{mime:"image/webp",extension:"webp"};return null;
}
