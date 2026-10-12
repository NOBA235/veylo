import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center text-slate-900">
      <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xl mb-4 shadow-sm">
        V
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-2">Page Not Found</h1>
      <p className="text-sm text-slate-600 mb-6 max-w-sm">
        The page or resource you requested could not be located in Veylo.
      </p>
      <Link
        href="/"
        className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-slate-800 transition"
      >
        Return to Veylo Home
      </Link>
    </div>
  );
}

