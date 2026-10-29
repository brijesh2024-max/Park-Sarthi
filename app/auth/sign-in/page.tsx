import type { AuthSearch } from "../auth-screen";
import PasswordlessScreen from "../passwordless-screen";
export const metadata = { title: "Sign in · ParkSarthi" };
export default function SignIn({searchParams}:{searchParams:AuthSearch}) { return <PasswordlessScreen searchParams={searchParams}/>; }
