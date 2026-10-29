import AuthScreen, { type AuthSearch } from "../auth-screen";
export const metadata = { title: "Reset password · ParkSarthi" };
export default function ForgotPassword({searchParams}:{searchParams:AuthSearch}) { return <AuthScreen mode="forgot-password" searchParams={searchParams}/>; }
