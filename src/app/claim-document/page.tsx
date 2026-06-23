import Link from "next/link";

const sessionItems = [
  ["97110", "Therapeutic Ex.", "1 UNIT", "08 : 04", "--"],
  ["97112", "Neuromusc. Ed.", "1 UNIT", "15:56", "MODIFIER 59"],
  ["97530", "Therapeutic Act.", "2 UNITS", "28:00", "--"],
];

const diagnosis = [
  ["E11.9", "Type 2 Diabetes Mellitus without complications", "Primary"],
  ["M54.5", "Low Back Pain", "Secondary"],
  ["R53.83", "Other Fatigue (Chronic)", "Secondary"],
];

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

export default function ClaimDocumentPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-slate-950">
      <div className="mx-auto min-h-screen max-w-[1180px] bg-white">
        <Header />

        <section className="px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/patient-summary" className="text-2xl text-slate-600">
                ‹
              </Link>
              <h1 className="text-2xl font-semibold">Claim Document</h1>
            </div>

            <div className="flex items-center gap-6 text-sm">
              <button className="text-slate-700">Export⌄</button>
              <button className="font-bold text-blue-700">▷ Submit Claim</button>
            </div>
          </div>

          <div className="mt-6 flex items-start justify-between gap-6 text-sm text-slate-500">
  <div className="min-w-[150px]">
    <p>Patient</p>
    <p className="mt-1 font-bold text-slate-950">Samuel T. (58/M)</p>
  </div>

  <div className="min-w-[150px]">
    <p>MRN Number</p>
    <p className="mt-1 font-bold text-slate-950">220486</p>
  </div>

  <div className="min-w-[170px]">
    <p>Ordering Provider</p>
    <p className="mt-1 font-bold text-slate-950">Dr. Sarah Miller</p>
  </div>

  <div className="min-w-[170px]">
    <p>Session Meta</p>
    <p className="mt-1 font-bold text-slate-950">June 18, • 52 min</p>
  </div>

  <div className="min-w-[150px]">
    <p>Payor Source</p>
    <p className="mt-1 font-bold text-blue-700">Medicare</p>
  </div>
</div>
        </section>

        <section className="px-8 py-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Session List Items{" "}
                <span className="text-sm font-normal text-slate-400">
                  4 Billable Units
                </span>
              </h2>
            </div>

            <button className="font-bold text-blue-700">＋ Add more CPTs</button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-medium">CPT Code</th>
                  <th className="px-6 py-4 font-medium">Description</th>
                  <th className="px-6 py-4 font-medium">Units</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Modifier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionItems.map(([code, desc, units, duration, modifier]) => (
                  <tr key={code}>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold">
                        {code}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold">{desc}</td>
                    <td className="px-6 py-4 font-semibold">{units}</td>
                    <td className="px-6 py-4">{duration}</td>
                    <td className="px-6 py-4">
                      {modifier === "--" ? (
                        <span className="text-slate-400">--</span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-700">
                          {modifier}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="px-8 py-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">ICD-10 Diagnosis Codes</h2>
            <button className="font-bold text-blue-700">＋ Add Diagnosis</button>
          </div>

          <div className="space-y-4">
            {diagnosis.map(([code, text, type]) => (
              <div
                key={code}
                className="flex items-start justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div>
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-sm text-slate-700">
                    {code}
                  </span>
                  <p className="mt-3 font-medium">{text}</p>
                </div>

                <span className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-500">
                  {type}
                </span>
              </div>
            ))}
          </div>
        </section>

        <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-6 rounded-full bg-white px-6 py-4 shadow-2xl">
          <button className="font-bold text-blue-700">▣ Save as Draft</button>
          <button className="font-bold text-blue-700">✎ Edit Session Data</button>
          <button className="rounded-full bg-blue-700 px-4 py-3 font-bold text-white">
            → Verify Claim Document
          </button>
        </div>
      </div>
    </main>
  );
}