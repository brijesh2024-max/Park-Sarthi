import AuthScreen, { type AuthSearch } from "../auth-screen";
export const metadata = { title: "Create an account · ParkSarthi" };
export default function SignUp({searchParams}:{searchParams:AuthSearch}) { return <AuthScreen mode="sign-up" searchParams={searchParams}/>; }
