import Link from "next/link";

const insights = [
  {
    tag: "Protocol Ask",
    text: "Does anyone in your family have diabetes or vascular issues?",
    label: "Detected",
  },
  {
    tag: "Billing",
    text: "97530 - Therapeutic Act. detected add CPT for the session?",
    label: "Billing",
  },
  {
    tag: "Protocol Ask",
    text: "How often do you engage in physical activity each week?",
    label: "Billing",
  },
];

const suggestions = [
  ["Current Live CPT", "Therapeutic Act. 97130 is in progress. CPT started at 8:05"],
  ["Unit Recorded", "1 unit recorded for 97110 - Therapeutic Ex. at 8:04"],
  ["Modifier 59 Required", "Potential Bundle conflict detected for 97112 with 97110. Apply modifier?"],
  ["SNF Validation Alert", "Section GG mobility scores differ from nursing log"],
];

export default function AmbientSessionPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-slate-950">
      <div className="mx-auto min-h-screen max-w-[1180px] bg-white">
        <header className="flex h-16 items-center gap-4 border-b border-slate-100 px-8">
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

        <section className="px-8 py-6">
          <div className="flex items-center gap-4">
            <Link href="/ambient-listening" className="text-3xl text-slate-600">‹</Link>
            <div className="h-16 w-16 rounded-full bg-gradient-to-br from-emerald-300 to-teal-700" />
            <div>
              <h1 className="text-2xl font-semibold">Samuel Thompson</h1>
              <div className="mt-3 grid grid-cols-4 gap-14 text-sm text-slate-500">
                <p>Age / Sex<br /><b className="text-slate-950">58 / Male</b></p>
                <p>Weight<br /><b className="text-slate-950">88 kg</b></p>
                <p>MRN Number<br /><b className="text-slate-950">220486</b></p>
                <p>Payor Source<br /><b className="text-blue-700">Medicare</b></p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-6 shadow-[0_15px_45px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-end gap-3">
                  <span className="pb-3 text-xl tracking-[3px] text-blue-700">|||||</span>
                  <h2 className="text-5xl font-bold text-blue-700">12:22</h2>
                  <span className="pb-3 text-sm text-slate-500">/ 1 Unit</span>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Say <b className="text-blue-700">Stop</b> Recording...
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-700">Unit 2 at 23:00</p>
                <p className="mt-1 font-bold text-blue-700">+14:00 left</p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-[1fr_330px] gap-6">
            <div>
              <p className="mb-5 text-sm text-slate-300">
                Medexa is Processing for Insights...
              </p>

              <div className="space-y-5">
                {insights.map((item) => (
                  <div key={item.text} className="relative pl-10">
                    <div className="absolute left-4 top-0 h-full border-l border-dashed border-blue-300" />

                    <div className="rounded-2xl border border-emerald-300 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.10)]">
                      <span className="rounded-md bg-blue-700 px-3 py-1 text-xs font-bold text-white">
                        {item.tag}
                      </span>
                      <p className="mt-4 text-base leading-6 text-slate-800">{item.text}</p>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-500">
                        {item.label}
                      </span>
                      <button className="text-sm text-slate-500">× Ignore</button>
                    </div>

                    <button className="mt-3 rounded-full border border-blue-300 bg-white px-8 py-2 text-sm text-slate-700">
                      › Slide to Approve
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <aside className="h-fit rounded-2xl bg-white p-6 shadow-[0_15px_45px_rgba(15,23,42,0.12)]">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Suggestions</h2>
                <span className="text-sm">3</span>
              </div>

              <div className="space-y-4">
                {suggestions.map(([title, text], index) => (
                  <div
                    key={title}
                    className="rounded-2xl bg-white p-5 shadow-[0_10px_30px_rgba(15,23,42,0.08)]"
                  >
                    <div className="flex gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <h3 className="text-sm font-bold">{title}</h3>
                        <p className="mt-2 text-sm leading-5 text-slate-600">{text}</p>
                      </div>
                    </div>

                    {index >= 2 && (
                      <button className="mt-4 w-full text-right text-sm font-bold text-blue-700">
                        ✓ Apply
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-4 rounded-full bg-white px-6 py-3 shadow-2xl">
            <button className="text-xl text-blue-700">Ⅱ</button>
            <span className="text-sm font-semibold">Pause</span>
            <button className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-700 text-white">
              ◎
            </button>
            <span className="text-sm font-semibold">Stop</span>
          </div>
        </section>
      </div>
    </main>
  );
}