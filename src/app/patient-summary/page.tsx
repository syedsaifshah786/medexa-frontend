import Link from "next/link";

function Header() {
  return (
    <header className="flex h-16 items-center gap-4 border-b border-slate-100 bg-white px-8">
      <button className="rounded-lg bg-slate-100 px-3 py-2 text-slate-500">☰</button>
      <Link href="/" className="text-xl font-bold text-blue-700">Medexa</Link>
      <div className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-400">
        Search patients or sessions...
      </div>
      <span className="text-blue-700">🔔</span>
      <button className="rounded-md border px-3 py-1 text-sm">Eng</button>
      <div className="flex items-center gap-2">
        <div className="h-9 w-9 rounded-full bg-slate-300" />
        <div>
          <p className="text-sm font-bold">Dr. Sarah Miller</p>
          <p className="text-xs text-slate-500">Clinician</p>
        </div>
      </div>
    </header>
  );
}

export default function PatientSummaryPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-slate-950">
      <div className="mx-auto min-h-screen max-w-[1180px] bg-white">
        <Header />

        <section className="border-b border-slate-100 px-8 py-5">
          <div className="flex items-center gap-3">
            <Link href="/ambient-listening" className="text-2xl text-slate-600">
              ‹
            </Link>
            <h1 className="text-2xl font-semibold">Therapeutic Therapy Session</h1>
            <span className="text-sm font-semibold text-blue-700">
              • Medexa Summarized
            </span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-8 text-sm text-slate-600">
            <p>
              <b className="text-slate-950">July 05, 12:00 PM</b>
            </p>
            <p>
              Patient ID: <b className="text-slate-950">#99283</b>
            </p>
            <p>
              Duration: <b className="text-slate-950">52:22</b>
            </p>
            <p>
              Unit(s): <b className="text-slate-950">3</b>
            </p>
          </div>
        </section>

        <nav
          className="border-b border-slate-100 px-8 py-4 text-sm"
          style={{
            display: "flex",
            alignItems: "center",
            width: "100%",
          }}
        >
          <Link href="/soap-notes" className="text-slate-700">
            SOAP Notes
          </Link>

          <Link
            href="/billing-intelligence"
            className="text-slate-700"
            style={{ marginLeft: "42px" }}
          >
            Billing Intelligence
          </Link>

          <button
            className="rounded-full border border-blue-200 bg-blue-50 px-5 py-2 font-medium text-blue-700"
            style={{ marginLeft: "42px" }}
          >
            Patient Summary
          </button>

          <Link href="/claim-document" className="font-bold text-blue-700" style={{ marginLeft: "auto" }}>
  ✓ Create Claim-Document
</Link>
        </nav>

        <section className="px-8 py-6">
          <div className="min-h-[620px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Session Summary Note</h2>

              <div className="flex items-center gap-6 text-sm">
                <button className="text-slate-700">✎ Edit</button>
                <button className="font-semibold text-blue-700">
                  ✈ Send to Patient
                </button>
              </div>
            </div>

            <p className="max-w-[850px] text-lg leading-8 text-slate-700">
              On June 18, 2026, Samuel completed session 4 of 12 with Dr. Sarah
              Miller, focusing on gait training and therapeutic exercises to
              support lower back pain, reduce fatigue, and improve strength and
              balance. He performed well and needed some movement assistance,
              which is normal at this stage of care. His knee flexibility
              improved by 15° compared with the baseline session. Next steps
              include a lipid panel follow-up with the primary care physician due
              in December 2026, continuing therapy sessions on Monday, Wednesday,
              and Friday, tracking pain daily in the pain diary, and completing
              home exercises including seated marches and heel raises.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}