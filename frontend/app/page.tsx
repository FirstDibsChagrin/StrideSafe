export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">StrideSafe</h1>
      <p className="mt-4 text-lg text-gray-600">
        High school cross-country injury prediction platform
      </p>
      <div className="mt-8 flex gap-4">
        <a
          href="/login"
          className="rounded-md bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
        >
          Sign In
        </a>
        <a
          href="/dashboard"
          className="rounded-md border border-gray-300 px-6 py-3 hover:bg-gray-50"
        >
          Runner Dashboard
        </a>
        <a
          href="/coach"
          className="rounded-md border border-gray-300 px-6 py-3 hover:bg-gray-50"
        >
          Coach Dashboard
        </a>
      </div>
    </main>
  );
}
