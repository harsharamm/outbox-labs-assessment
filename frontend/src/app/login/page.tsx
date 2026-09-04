import { API_URL } from "@/lib/api";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
          RI
        </div>
        <h1 className="text-lg font-semibold text-gray-900">ReachInbox Scheduler</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to schedule and track your outreach.</p>

        <a
          href={`${API_URL}/auth/google`}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#FFC107"
              d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5S44.5 36.3 44.5 25c0-1.5-.2-2.9-.4-4.5z"
            />
            <path
              fill="#FF3D00"
              d="M6.3 14.7l6.6 4.8C14.6 16 18.9 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5c-7.9 0-14.7 4.5-18 11.1z"
            />
            <path
              fill="#4CAF50"
              d="M24 45.5c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.5 36.6 26.9 37.5 24 37.5c-5.3 0-9.7-3.1-11.3-8l-6.6 5C9.2 41 16 45.5 24 45.5z"
            />
            <path
              fill="#1976D2"
              d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.6 5.4C41.4 36.3 44.5 31.5 44.5 25c0-1.5-.2-2.9-.4-4.5z"
            />
          </svg>
          Continue with Google
        </a>
      </div>
    </div>
  );
}
