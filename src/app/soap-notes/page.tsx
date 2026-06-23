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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">* {label}</p>
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-700">
        {value}
      </div>
    </div>
  );
}

function NoteCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-700">{title}</h2>
        <button className="text-sm text-slate-600">✎ Edit</button>
      </div>
      {children}
    </section>
  );
}

export default function SoapNotesPage() {
  return (
    <main className="min-h-screen bg-[#eef1f6] text-slate-950">
      <div className="mx-auto min-h-screen max-w-[1180px] bg-white">
        <Header />

        <section className="border-b border-slate-100 px-8 py-5">
          <div className="flex items-center gap-3">
            <Link href="/ambient-listening" className="text-2xl text-slate-600">‹</Link>
            <h1 className="text-2xl font-semibold">Therapeutic Therapy Session</h1>
            <span className="text-sm font-semibold text-blue-700">• Medexa Summarized</span>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-8 text-sm text-slate-600">
            <p><b className="text-slate-950">July 05, 12:00 PM</b></p>
            <p>Patient ID: <b className="text-slate-950">#99283</b></p>
            <p>Duration: <b className="text-slate-950">52:22</b></p>
            <p>Unit(s): <b className="text-slate-950">3</b></p>
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
  <button className="rounded-full border border-blue-200 bg-blue-50 px-5 py-2 font-medium text-blue-700">
    SOAP Notes
  </button>

  <Link
    href="/billing-intelligence"
    className="text-slate-700"
    style={{ marginLeft: "34px" }}
  >
    Billing Intelligence
  </Link>

  <Link href="/patient-summary" className="text-slate-700" style={{ marginLeft: "42px" }}>
  Patient Summary
</Link>

<Link href="/claim-document" className="font-bold text-blue-700" style={{ marginLeft: "auto" }}>
  ✓ Create Claim-Document
</Link>
</nav>

        <section className="space-y-5 px-8 py-5">
          <NoteCard title="Subjective">
            <div className="space-y-6">
              <Field
                label="Chief Complaint"
                value="Patient reports persistent discomfort in the lower back over the last 14 days, particularly after prolonged sitting. Mentions difficulty with mobility and occasional sharp pains. States: I feel like my back is always tight and stiff."
              />

              <div className="grid grid-cols-2 gap-5">
                <Field label="Pain Scale (0-10)" value="6" />
                <Field label="Duration" value="14 days" />
              </div>
            </div>
          </NoteCard>

          <NoteCard title="Objective">
            <div className="space-y-6">
              <Field
                label="Observation Notes"
                value="Observed limited range of motion in lumbar flexion (40°) and slight guarding behavior on palpation of L4-L5 region. Patient ambulates with mild antalgic gait. Vital signs within normal limits: BP 118/76, HR 72 bpm. Affect is mildly anxious. Arrived on time."
              />

              <div className="grid grid-cols-3 gap-5">
                <Field label="Range of Motion" value="Lumbar Flexion 40°" />
                <Field label="Affect" value="Mildly Anxious" />
                <Field label="Vital Signs" value="BP 118/76, HR 72" />
              </div>
            </div>
          </NoteCard>

          <NoteCard title="Assessment">
            <div className="space-y-6">
              <Field
                label="Diagnosis Summary"
                value="Chronic Lower Back Pain (M54.5) secondary to postural dysfunction and muscle deconditioning. Patient demonstrates functional limitations consistent with moderate severity. Focus on stretching and strengthening exercises for lumbar support. Follow-up scheduled."
              />

              <div className="grid grid-cols-2 gap-5">
                <Field label="Primary Diagnosis Code" value="M54.5" />
                <Field label="Severity" value="Moderate" />
              </div>
            </div>
          </NoteCard>
        </section>
      </div>
    </main>
  );
}