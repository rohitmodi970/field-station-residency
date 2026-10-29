import type { ReactNode } from "react";
import { getUserActiveSessions } from "@/actions/auth";
import { redirect } from "next/navigation";
import { WaterNavBar } from '@/components/Navigation';

// Server layout for auth-related pages. Keep the water nav visible on auth
// pages (login/confirm) so users still see the main navigation even when
// unauthenticated.
export default async function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { sessions } = await getUserActiveSessions();
  // If there are active sessions, redirect to the dashboard
  if (sessions.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="force-soft-vibrance min-h-screen">
      {children}
    </div>
  );
}
