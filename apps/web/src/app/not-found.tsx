import Link from "next/link";
import { Logo } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
      <Logo className="h-12 w-12" />
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Error 404</p>
      <h1 className="text-4xl font-semibold tracking-tight">This page drifted out of orbit</h1>
      <p className="max-w-md text-slate-600">The page you are looking for does not exist or has moved.</p>
      <Link href="/home" className="rounded-lg bg-gradient-to-b from-brand-500 to-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm">Back to home</Link>
    </main>
  );
}
