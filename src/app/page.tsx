import Link from "next/link";

const screens = [
  {
    title: "Ambient Listening",
    description:
      "Live session recording, transcript, AI suggestions, and clinical note generation.",
    href: "/ambient-listening",
  },
  {
    title: "Billing Intelligence",
    description:
      "AI-assisted billing review, CPT/ICD suggestions, confidence score, and claim actions.",
    href: "/billing-intelligence",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10">
          <p className="text-sm font-semibold text-blue-600">Medexa Prototype</p>
          <h1 className="mt-2 text-4xl font-bold text-slate-950">
            Frontend UI Screens
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Working local prototype for Ambient Listening and Billing Intelligence
            screens using mock data only.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {screens.map((screen) => (
            <Link
              key={screen.href}
              href={screen.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold text-slate-950">
                {screen.title}
              </h2>
              <p className="mt-3 text-slate-600">{screen.description}</p>
              <div className="mt-6 text-sm font-semibold text-blue-600">
                Open screen →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}