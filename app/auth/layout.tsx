import type { ReactNode } from "react";
import "./auth.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export default function AuthLayout({ children }: { children: ReactNode }) { return children; }
