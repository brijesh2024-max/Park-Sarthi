import AuthScreen, { type AuthSearch } from "../auth-screen";
export const metadata = { title: "Sign in · ParkSarthi" };
export default function SignIn({searchParams}:{searchParams:AuthSearch}) { return <AuthScreen mode="sign-in" searchParams={searchParams}/>; }
