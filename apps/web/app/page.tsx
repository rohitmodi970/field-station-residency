// Root page - the "/" route is handled by Next.js rewrites (proxied to Framer landing page).
// This page only renders as a fallback (e.g., if rewrites fail).
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/login");
}
