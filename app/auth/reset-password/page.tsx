import AuthScreen, { type AuthSearch } from "../auth-screen";
export const metadata = { title: "New password · ParkSarthi" };
export default function ResetPassword({searchParams}:{searchParams:AuthSearch}) { return <AuthScreen mode="reset-password" searchParams={searchParams}/>; }
