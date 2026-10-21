"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/icons";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo className="h-12 w-12" />
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-md text-sm text-slate-600">{error.message || "An unexpected error happened."}</p>
      <div className="flex gap-3">
        <button onClick={reset} className="rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm">Try again</button>
        <Link href="/home" className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm">Home</Link>
      </div>
    </main>
  );
}
