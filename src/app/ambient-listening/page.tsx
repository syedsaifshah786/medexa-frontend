import Link from "next/link";

const sessions = [
  { name: "Samuel Thompson", status: "active", img: "https://i.pravatar.cc/80?img=12" },
  { name: "Amina Hassan", status: "Awaiting", img: "https://i.pravatar.cc/80?img=32" },
  { name: "Robert Chen", status: "Awaiting", img: "https://i.pravatar.cc/80?img=56" },
];

const transcripts = [
  ["Jameson Locke", "OCT 23, 11:45 AM", "SUMMARIZED", "https://i.pravatar.cc/80?img=14"],
  ["Sarah Palmer", "OCT 23, 09:20 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=24"],
  ["Michael Chen", "OCT 23, 09:45 AM", "SUMMARIZED", "https://i.pravatar.cc/80?img=8"],
  ["Aisha Khan", "OCT 23, 10:05 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=45"],
  ["David Lopez", "OCT 23, 10:30 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=18"],
];

export default function AmbientListeningPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#fbfbfd", fontFamily: "Arial, sans-serif" }}>
      <div
  style={{
    width: "100%",
    minHeight: "100vh",
    background: "#fbfbfd",
  }}
>
        <header style={{ height: 58, display: "flex", alignItems: "center", gap: 14, padding: "0 24px", background: "#fff", borderBottom: "1px solid #edf0f5" }}>
          <button style={{ width: 32, height: 32, border: 0, borderRadius: 6, background: "#eef3f8" }}>☰</button>
          <Link href="/" style={{ fontSize: 18, fontWeight: 700, color: "#003cff", textDecoration: "none" }}>Medexa</Link>
          <div style={{ flex: 1, height: 30, border: "1px solid #dfe5ee", borderRadius: 999, padding: "0 16px", display: "flex", alignItems: "center", color: "#94a3b8", fontSize: 11 }}>
            Search patients or sessions...
          </div>
          <span style={{ color: "#003cff" }}>⌂</span>
          <button style={{ border: "1px solid #ccd6e2", background: "#fff", borderRadius: 6, padding: "5px 12px" }}>Eng</button>
          <img src="https://i.pravatar.cc/80?img=47" style={{ width: 32, height: 32, borderRadius: "50%" }} alt="" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>Dr. Sarah Miller</div>
            <div style={{ fontSize: 10, color: "#64748b" }}>Clinician</div>
          </div>
        </header>

        <section style={{ padding: "14px 28px 32px" }}>
          <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Tuesday, Jul 13, 2026</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 36, alignItems: "center", paddingBottom: 20, borderBottom: "1px solid #e5eaf1" }}>
            <h1 style={{ margin: "8px 0 0", fontSize: 36, lineHeight: 1.08, fontWeight: 300, letterSpacing: "-1px" }}>
              Good Evening,<br />Dr. Sarah
            </h1>

            <Link href="/start-session" style={{ display: "block", textDecoration: "none", color: "inherit", background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 18px 40px rgba(15,23,42,.12)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#eef2ff", display: "flex", alignItems: "center", justifyContent: "center", color: "#003cff" }}>◉</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Start a new session?</div>
                  <div style={{ marginTop: 5, fontSize: 11, color: "#475569" }}>“Hey Medexa, start a new session with David Peter”</div>
                </div>
              </div>
            </Link>
          </div>

          <section style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Upcoming Sessions</h2>
                <p style={{ margin: "5px 0 0", fontSize: 12, color: "#8a9ab0" }}>8 sessions remaining ahead</p>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button style={{ border: 0, background: "#fff", borderRadius: 999, padding: "10px 22px", fontWeight: 700, boxShadow: "0 12px 28px rgba(15,23,42,.1)" }}>
                  View All Upcoming Sessions
                </button>
                <button style={{ width: 38, height: 38, border: 0, borderRadius: "50%", background: "#fff", color: "#003cff", boxShadow: "0 12px 28px rgba(15,23,42,.1)" }}>↗</button>
              </div>
            </div>

            <div
  style={{
    display: "flex",
    gap: 12,
    marginTop: 16,
    maxWidth: 620,
  }}
>
  {sessions.map((s) => (
    <Link
      key={s.name}
      href="/ambient-listening/session"
      style={{
        position: "relative",
        width: 170,
        height: 132,
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: 10,
        padding: 12,
        textDecoration: "none",
        color: "inherit",
        boxShadow: "0 12px 28px rgba(15,23,42,.10)",
        overflow: "hidden",
      }}
    >
      <img
        src={s.img}
        alt=""
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />

      {s.status === "active" ? (
        <span
          style={{
            position: "absolute",
            top: 17,
            right: 14,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: "#07115f",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            lineHeight: 1,
          }}
        >
          ↗
        </span>
      ) : (
        <span
          style={{
            position: "absolute",
            top: 19,
            right: 14,
            fontSize: 9,
            color: "#8a9ab0",
          }}
        >
          Awaiting
        </span>
      )}

      <h3
        style={{
          margin: "10px 0 0",
          fontSize: 11,
          lineHeight: 1.2,
          fontWeight: 700,
        }}
      >
        {s.name}
      </h3>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 9,
          lineHeight: 1.2,
        }}
      >
        <span style={{ color: "#003cff" }}>●</span> Chronic Care MGT
      </p>

      <p
        style={{
          margin: "4px 0 0",
          fontSize: 8.5,
          lineHeight: 1.2,
          color: "#64748b",
        }}
      >
        CPT: 99490 ICD: E11.9
      </p>

      <p
        style={{
          position: "absolute",
          left: 12,
          bottom: 10,
          margin: 0,
          fontSize: 9,
          lineHeight: 1,
        }}
      >
        July 05, 12:00 PM
      </p>
    </Link>
  ))}
</div>
          </section>

          <section style={{ marginTop: 28 }}>
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 14,
    }}
  >
    <div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
        Recent Transcriptions
      </h2>
      <p style={{ margin: "5px 0 0", fontSize: 12, color: "#8a9ab0" }}>
        Showing transcriptions from recent sessions
      </p>
    </div>

    <div
      style={{
        width: 190,
        height: 38,
        border: "1px solid #dfe5ee",
        borderRadius: 999,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        padding: "0 18px",
        fontSize: 12,
        color: "#94a3b8",
      }}
    >
      Search transcriptions...
    </div>
  </div>

  <div
    style={{
      background: "#fff",
      borderRadius: 14,
      overflow: "hidden",
      boxShadow: "0 18px 42px rgba(15,23,42,.08)",
    }}
  >
    {transcripts.map(([name, time, status, img]) => (
      <div
        key={name}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 180px 160px 24px",
          alignItems: "center",
          minHeight: 55,
          padding: "10px 18px",
          borderBottom: "1px solid #eef2f7",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src={img}
            alt=""
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <strong style={{ fontSize: 13 }}>{name}</strong>
        </div>

        <span style={{ fontSize: 11, color: "#7b8da8" }}>{time}</span>

        <span
          style={{
            width: "fit-content",
            borderRadius: 999,
            padding: "6px 12px",
            fontSize: 10,
            fontWeight: 700,
            background: status === "SUMMARIZED" ? "#bff5e6" : "#f1f5f9",
            color: status === "SUMMARIZED" ? "#00966b" : "#0f172a",
          }}
        >
          {status}
        </span>

        <span style={{ fontSize: 18, color: "#0f172a" }}>›</span>
      </div>
    ))}
  </div>

  <div
    style={{
      marginTop: 14,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      gap: 12,
      fontSize: 11,
      color: "#64748b",
    }}
  >
    <span>‹ Previous</span>
    <span>1</span>
    <span
      style={{
        background: "#eef3f8",
        borderRadius: 5,
        padding: "3px 8px",
      }}
    >
      2
    </span>
    <span>3</span>
    <span>...</span>
    <span>Next ›</span>
  </div>
</section>
        </section>
      </div>
    </main>
  );
}