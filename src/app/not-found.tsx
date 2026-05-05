import Link from "next/link";
import { Building2, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-25 dark:bg-stone-950">
      <div className="bg-grid absolute inset-0 opacity-20" />
      <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-coral-500/5 blur-3xl" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-indigo-500/5 blur-3xl" />

      <div className="relative flex flex-col items-center px-6 text-center">
        {/* Logo */}
        <div className="mb-8 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-coral-400 to-coral-600 shadow-lg shadow-coral-500/25">
          <Building2 className="h-7 w-7 text-white" />
        </div>

        {/* 404 number */}
        <p className="brand-gradient text-8xl font-black tracking-tighter">
          404
        </p>

        {/* Message */}
        <h1 className="mt-4 text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Page not found
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-stone-400 dark:text-stone-500">
          The page you are looking for does not exist or has been moved.
          Let&apos;s get you back on track.
        </p>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-coral-500 to-coral-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-coral-500/20 transition-all duration-200 hover:from-coral-600 hover:to-coral-700 hover:shadow-md hover:shadow-coral-500/25"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        {/* Decorative search icon */}
        <div className="mt-16 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
          <Search className="h-7 w-7 text-stone-300 dark:text-stone-600" />
        </div>
      </div>
    </div>
  );
}
