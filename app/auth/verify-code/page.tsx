import PasswordlessScreen from "../passwordless-screen";
import type { AuthSearch } from "../auth-screen";
export const metadata = {title:"Verify email · ParkSarthi"};
export default function VerifyCode({searchParams}:{searchParams:AuthSearch}) { return <PasswordlessScreen searchParams={searchParams} verify/>; }
