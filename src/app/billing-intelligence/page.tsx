import Link from "next/link";

const cptCodes = [
  {
    code: "97110",
    title: "Therapeutic Ex.",
    units: "1",
    duration: "08:04",
    warning: "",
  },
  {
    code: "97112",
    title: "Neuromusc. Ed.",
    units: "1",
    duration: "15:04",
    warning: "Modifier 59 Required",
    note: "Potential Bundle conflict detected with 97110. Apply modifier?",
  },
  {
    code: "97530",
    title: "Therapeutic Act.",
    units: "2",
    duration: "23:18",
    warning: "",
  },
];

export default function BillingIntelligencePage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-slate-950">
  <div className="mx-auto min-h-screen max-w-[1180px] bg-white">
  <header className="flex h-16 items-center gap-4 border-b border-slate-100 bg-white px-8">
  <button className="rounded-lg bg-slate-100 px-3 py-2 text-slate-500">☰</button>
  <Link href="/" className="text-xl font-bold text-blue-700">Medexa</Link>
  <div className="flex-1 rounded-full border border-slate-200 px-8 py-2 text-sm text-slate-400">
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

<section className="border-b border-slate-100 px-8 py-5">
  <div className="flex items-center gap-3">
    <Link href="/ambient-listening" className="text-2xl text-slate-600">
      ‹
    </Link>

    <h1 className="text-2xl font-semibold">
      Therapeutic Therapy Session
    </h1>

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
  style={{ display: "flex", alignItems: "center", width: "100%" }}
>
  <Link href="/soap-notes" className="text-slate-700">
    SOAP Notes
  </Link>

  <button
    className="rounded-full border border-blue-200 bg-blue-50 px-5 py-2 font-medium text-blue-700"
    style={{ marginLeft: "42px" }}
  >
    Billing Intelligence
  </button>

  <Link
    href="/patient-summary"
    className="text-slate-700"
    style={{ marginLeft: "42px" }}
  >
    Patient Summary
  </Link>

  <Link href="/claim-document" className="font-bold text-blue-700" style={{ marginLeft: "auto" }}>
  ✓ Create Claim-Document
</Link>
</nav>  

        <section className="space-y-5 px-8 py-6">
          <div>
            <h2 className="mb-3 text-base font-semibold">Billing Intelligence</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-blue-200 p-4">
                <p className="text-xs text-slate-500">Session Time</p>
                <p className="mt-2 text-xl font-semibold">52:22</p>
                <p className="mt-1 text-[10px] text-slate-500">
                  + 1 Threshold&nbsp;&nbsp; $11,091/$2,330
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">Session Units</p>
                  <span className="text-xs text-slate-400">ⓘ</span>
                </div>
                <p className="mt-2 text-xl font-semibold">4 Units</p>
                <span className="mt-1 inline-block rounded bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                  8 Minute Rule
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">CPT Codes Detected</h2>
              <button className="text-xs font-semibold text-blue-700">
                + Add more CPTs
              </button>
            </div>

            <div className="space-y-3">
              {cptCodes.map((item) => (
                <div
                  key={item.code}
                  className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">
                        {item.code} - {item.title}
                      </p>
                      <p className="mt-2 text-xs text-slate-600">
                        Unit(s): {item.units}&nbsp;&nbsp;&nbsp; Duration:{" "}
                        {item.duration}
                      </p>
                    </div>

                    {item.warning ? (
                      <span className="rounded-full bg-black px-2 py-1 text-[10px] font-semibold text-white">
                        {item.warning}
                      </span>
                    ) : (
                      <button className="text-lg text-blue-700">✎</button>
                    )}
                  </div>

                  {item.note && (
                    <>
                      <p className="mt-4 text-xs text-slate-500">{item.note}</p>
                      <div className="mt-5 flex justify-end gap-5 text-xs">
                        <button className="text-slate-500">× Reject</button>
                        <button className="font-semibold text-blue-700">
                          ✓ Approve
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold">SNF & Functional Logic</h2>
            <p className="mt-3 text-sm text-slate-700">
              Section GG — Patient Assist Level (MDS 3.0)
            </p>

            <p className="mt-3 text-sm font-bold text-blue-700">3 - Partial</p>

            <div className="mt-4">
              <div className="relative h-2 rounded-full bg-blue-100">
                <div className="absolute left-0 top-0 h-2 w-[50%] rounded-full bg-slate-500" />
                <div className="absolute left-[50%] top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-600" />
              </div>

              <div className="mt-3 flex justify-between text-xs text-slate-700">
                <span>1</span>
                <span>2</span>
                <span>3</span>
                <span>4</span>
                <span>5</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}