import AuthScreen, { type AuthSearch } from "../auth-screen";
export const metadata = { title: "Sign out · ParkSarthi" };
export default function SignOut({searchParams}:{searchParams:AuthSearch}) { return <AuthScreen mode="sign-out" searchParams={searchParams}/>; }
