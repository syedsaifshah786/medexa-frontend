"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

const sessions = [
  {
    name: "Samuel Thompson",
    status: "active",
    img: "https://i.pravatar.cc/80?img=12",
  },
  {
    name: "Amina Hassan",
    status: "Awaiting",
    img: "https://i.pravatar.cc/80?img=32",
  },
  {
    name: "Robert Chen",
    status: "Awaiting",
    img: "https://i.pravatar.cc/80?img=56",
  },
  {
    name: "Elena Morris",
    status: "Awaiting",
    img: "https://i.pravatar.cc/80?img=49",
  },
];

const transcripts = [
  ["Jameson Locke", "OCT 23, 11:45 AM", "SUMMARIZED", "https://i.pravatar.cc/80?img=14"],
  ["Sarah Palmer", "OCT 23, 09:20 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=24"],
  ["Michael Chen", "OCT 23, 09:45 AM", "SUMMARIZED", "https://i.pravatar.cc/80?img=8"],
  ["Aisha Khan", "OCT 23, 10:05 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=45"],
  ["David Lopez", "OCT 23, 10:30 AM", "SUMMARY PENDING", "https://i.pravatar.cc/80?img=18"],
];

export default function AmbientListeningPage() {
  const [headerSearch, setHeaderSearch] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");

  const normalizedHeaderSearch = headerSearch.trim().toLowerCase();

  const filteredSessions = useMemo(() => {
    if (!normalizedHeaderSearch) {
      return sessions;
    }

    return sessions.filter((session) => {
      return (
        session.name.toLowerCase().includes(normalizedHeaderSearch) ||
        session.status.toLowerCase().includes(normalizedHeaderSearch)
      );
    });
  }, [normalizedHeaderSearch]);

  const filteredTranscripts = useMemo(() => {
    const query = transcriptSearch.trim().toLowerCase();

    if (!query && !normalizedHeaderSearch) {
      return transcripts;
    }

    return transcripts.filter(([name, , status]) => {
      const headerMatch =
        !normalizedHeaderSearch ||
        name.toLowerCase().includes(normalizedHeaderSearch) ||
        status.toLowerCase().includes(normalizedHeaderSearch);
      const transcriptMatch =
        !query ||
        name.toLowerCase().includes(query) ||
        status.toLowerCase().includes(query);

      return headerMatch && transcriptMatch;
    });
  }, [normalizedHeaderSearch, transcriptSearch]);

  return (
    <main className="ambient-page">
      <header className="topbar">
        <button className="menu-button" aria-label="Open menu">
          <span />
          <span />
          <span />
        </button>

        <Link href="/" className="brand">
          Medexa
        </Link>

        <label className="global-search">
          <span className="search-dot">⌕</span>
          <input
            aria-label="Search patients or sessions"
            placeholder="Search patients or sessions..."
            type="search"
            value={headerSearch}
            onChange={(event) => setHeaderSearch(event.target.value)}
          />
        </label>

        <button className="icon-button bell" aria-label="Notifications" />

        <button className="translate-button" aria-label="Translate">
          <span>✣</span>
        </button>

        <button className="language-button">Eng</button>

        <div className="profile">
          <img src="https://i.pravatar.cc/80?img=47" alt="" />
          <div>
            <strong>Dr. Sarah Miller</strong>
            <span>Clinician</span>
          </div>
          <span className="chevron">⌄</span>
        </div>
      </header>

      <section className="content">
        <p className="date">Tuesday, Jul 13, 2026</p>

        <section className="hero">
          <h1>
            Good Evening,
            <br />
            Dr. Sarah
          </h1>

          <Link href="/start-session" className="start-session">
            <span className="mic-icon">◉</span>
            <span>
              <strong>Start a new session?</strong>
              <em>&quot;Hey Medexa, start a new session with David Peter&quot;</em>
            </span>
          </Link>
        </section>

        <section className="sessions-section">
          <div className="section-heading">
            <div>
              <h2>Upcoming Sessions</h2>
              <p>8 sessions remaining ahead</p>
            </div>
            <div className="heading-actions">
              <button>View All Upcoming Sessions</button>
              <button aria-label="Open upcoming sessions">↗</button>
            </div>
          </div>

          <div className="sessions-row">
            {filteredSessions.map((session) => (
              <Link
                key={session.name}
                href="/ambient-listening/session"
                className="session-card"
              >
                <img src={session.img} alt="" />
                {session.status === "active" ? (
                  <span className="session-action">↗</span>
                ) : (
                  <span className="session-status">Awaiting</span>
                )}
                <h3>{session.name}</h3>
                <p className="care-type">
                  <span /> Chronic Care MGT
                </p>
                <p className="codes">CPT: 99490&nbsp;&nbsp;ICD: E11.9</p>
                <p className="session-time">July 05, 12:00 PM</p>
              </Link>
            ))}
            {filteredSessions.length === 0 && (
              <div className="sessions-empty">
                No upcoming sessions match your search.
              </div>
            )}
          </div>
        </section>

        <section className="transcripts-section">
          <div className="section-heading transcripts-heading">
            <div>
              <h2>Recent Transcriptions</h2>
              <p>Showing transcriptions from recent sessions</p>
            </div>

            <label className="transcript-search">
              <span>⌕</span>
              <input
                aria-label="Search transcriptions"
                placeholder="Search transcriptions..."
                type="search"
                value={transcriptSearch}
                onChange={(event) => setTranscriptSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="transcripts-card">
            {filteredTranscripts.map(([name, time, status, img]) => (
              <div key={name} className="transcript-row">
                <div className="patient">
                  <img src={img} alt="" />
                  <strong>{name}</strong>
                </div>
                <time>{time}</time>
                <span
                  className={
                    status === "SUMMARIZED"
                      ? "badge badge-summarized"
                      : "badge badge-pending"
                  }
                >
                  {status}
                </span>
                <span className="row-arrow">›</span>
              </div>
            ))}
            {filteredTranscripts.length === 0 && (
              <div className="transcripts-empty">
                <strong>No transcriptions found</strong>
                <span>Try searching by patient name or summary status.</span>
              </div>
            )}
          </div>

          {filteredTranscripts.length > 0 && (
          <nav className="pagination" aria-label="Transcription pages">
            <span>‹ Previous</span>
            <span>1</span>
            <span className="current-page">2</span>
            <span>3</span>
            <span>...</span>
            <span>Next ›</span>
          </nav>
          )}
        </section>
      </section>

      <style>{`
        .ambient-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #eef1f6;
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
        }

        .topbar {
          width: 100%;
          box-sizing: border-box;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          background: #ffffff;
          border-bottom: 1px solid #eef1f6;
          box-shadow: 0 1px 8px rgba(15, 23, 42, 0.03);
        }

        button {
          font-family: inherit;
        }

        .menu-button,
        .icon-button,
        .translate-button {
          border: 0;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .menu-button {
          width: 34px;
          height: 34px;
          flex-direction: column;
          gap: 4px;
          border-radius: 8px;
          background: #eef2ff;
        }

        .menu-button span {
          width: 12px;
          height: 2px;
          border-radius: 99px;
          background: #626b80;
        }

        .brand {
          margin-right: 12px;
          color: #001eff;
          font-size: 20px;
          font-weight: 800;
          text-decoration: none;
        }

        .global-search {
          flex: 1 1 auto;
          max-width: 520px;
          height: 34px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #e4e9f2;
          border-radius: 999px;
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
        }

        .global-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172033;
          font: inherit;
        }

        .global-search input::placeholder {
          color: #9aa6ba;
        }

        .search-dot {
          color: #001eff;
          font-size: 12px;
        }

        .bell {
          position: relative;
          width: 30px;
          height: 30px;
          margin-left: auto;
          background: transparent;
        }

        .bell::before {
          content: "";
          width: 11px;
          height: 14px;
          border: 2px solid #001eff;
          border-bottom: 0;
          border-radius: 8px 8px 2px 2px;
        }

        .bell::after {
          content: "";
          position: absolute;
          bottom: 7px;
          width: 16px;
          height: 2px;
          border-radius: 999px;
          background: #001eff;
        }

        .translate-button {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          background: #eef2f7;
          color: #4c5668;
          font-size: 13px;
        }

        .language-button {
          height: 30px;
          padding: 0 12px;
          border: 1px solid #d9e0eb;
          border-radius: 6px;
          background: #fff;
          color: #111827;
          font-size: 12px;
        }

        .profile {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .profile img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .profile strong,
        .profile span {
          display: block;
          line-height: 1.1;
        }

        .profile strong {
          max-width: 150px;
          overflow: hidden;
          color: #172033;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .profile span {
          color: #7a879b;
          font-size: 10px;
        }

        .profile .chevron {
          color: #172033;
          font-size: 11px;
        }

        .content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          margin: 0 auto;
          padding: 20px 32px 36px;
          background: #fbfbfc;
        }

        .date {
          margin: 0 0 10px;
          color: #687386;
          font-size: 12px;
        }

        .hero {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 440px);
          align-items: center;
          gap: 40px;
          padding: 0 0 24px;
          border-bottom: 1px solid #e8edf5;
        }

        h1,
        h2,
        h3,
        p {
          margin-top: 0;
        }

        .hero h1 {
          margin: 0;
          color: #16181e;
          font-size: 38px;
          font-weight: 300;
          line-height: 1.12;
          letter-spacing: -0.8px;
        }

        .start-session {
          box-sizing: border-box;
          min-height: 70px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 22px;
          border-radius: 14px;
          background: #ffffff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 28px rgba(25, 32, 56, 0.13);
        }

        .mic-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #b8c2ff;
          border-radius: 50%;
          background: #f0f2ff;
          color: #001eff;
          font-size: 16px;
        }

        .start-session strong {
          display: block;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1;
        }

        .start-session em {
          display: block;
          overflow: hidden;
          color: #637085;
          font-size: 11px;
          font-style: normal;
          line-height: 1;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .sessions-section {
          margin-top: 26px;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .section-heading h2 {
          margin: 0;
          color: #20242d;
          font-size: 18px;
          font-weight: 500;
          line-height: 1.2;
        }

        .section-heading p {
          margin: 6px 0 0;
          color: #9aa5b6;
          font-size: 12px;
        }

        .heading-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .heading-actions button {
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: #ffffff;
          color: #06105f;
          font-size: 12px;
          font-weight: 700;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .heading-actions button:first-child {
          padding: 0 22px;
        }

        .heading-actions button:last-child {
          width: 38px;
          padding: 0;
          color: #001eff;
        }

        .sessions-row {
          width: 100%;
          display: flex;
          gap: 16px;
          margin-top: 18px;
          padding: 2px 2px 12px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: thin;
        }

        .session-card {
          position: relative;
          width: clamp(190px, 22vw, 270px);
          height: 166px;
          flex: 0 0 clamp(190px, 22vw, 270px);
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 18px 16px;
          border-radius: 12px;
          background: #ffffff;
          color: inherit;
          text-decoration: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.1);
        }

        .session-card img {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          object-fit: cover;
        }

        .session-action {
          position: absolute;
          top: 20px;
          right: 16px;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #080665;
          color: #ffffff;
          font-size: 12px;
        }

        .session-status {
          position: absolute;
          top: 24px;
          right: 16px;
          color: #a1abbc;
          font-size: 10px;
        }

        .session-card h3 {
          margin: 14px 0 0;
          color: #111827;
          font-size: 13px;
          font-weight: 800;
          line-height: 1.1;
          max-width: calc(100% - 40px);
        }

        .care-type {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 12px 0 0;
          color: #222733;
          font-size: 10px;
          font-weight: 600;
          line-height: 1;
          white-space: nowrap;
        }

        .care-type span {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #001eff;
        }

        .codes {
          margin: 6px 0 0;
          color: #56647a;
          font-size: 9px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .session-time {
          margin: auto 0 0;
          color: #172033;
          font-size: 11px;
          line-height: 1.2;
          white-space: nowrap;
        }

        .sessions-empty {
          min-height: 120px;
          flex: 1 0 240px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #d8deea;
          border-radius: 12px;
          background: #fff;
          color: #667085;
          font-size: 12px;
        }

        .transcripts-section {
          margin-top: 30px;
          width: min(100%, 1288px);
        }

        .transcripts-heading {
          margin-bottom: 16px;
        }

        .transcript-search {
          width: min(100%, 300px);
          height: 36px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 18px;
          border: 1px solid #e2e7ef;
          border-radius: 999px;
          background: #ffffff;
          color: #9aa6ba;
          font-size: 12px;
          white-space: nowrap;
        }

        .transcript-search span {
          color: #001eff;
          font-size: 12px;
        }

        .transcript-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #172033;
          font: inherit;
        }

        .transcript-search input::placeholder {
          color: #9aa6ba;
        }

        .transcripts-card {
          overflow: hidden;
          border-radius: 12px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.07);
        }

        .transcript-row {
          min-height: 64px;
          display: grid;
          grid-template-columns: minmax(220px, 1fr) minmax(132px, 160px) minmax(145px, 170px) 22px;
          align-items: center;
          box-sizing: border-box;
          column-gap: 18px;
          padding: 12px 24px;
          border-bottom: 1px solid #edf1f6;
        }

        .transcript-row:last-child {
          border-bottom: 0;
        }

        .patient {
          display: flex;
          align-items: center;
          gap: 14px;
          min-width: 0;
        }

        .patient img {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          object-fit: cover;
        }

        .patient strong {
          overflow: hidden;
          color: #172033;
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .transcript-row time {
          color: #7f8ba0;
          font-size: 11px;
          white-space: nowrap;
        }

        .badge {
          width: fit-content;
          border-radius: 999px;
          padding: 6px 12px;
          font-size: 10px;
          font-weight: 800;
          line-height: 1;
          white-space: nowrap;
        }

        .badge-summarized {
          background: #c9faec;
          color: #00956c;
        }

        .badge-pending {
          background: #f1f3f6;
          color: #161b25;
        }

        .row-arrow {
          color: #111827;
          font-size: 20px;
          line-height: 1;
          text-align: right;
        }

        .transcripts-empty {
          min-height: 132px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 24px;
          color: #667085;
          text-align: center;
        }

        .transcripts-empty strong {
          color: #172033;
          font-size: 14px;
        }

        .transcripts-empty span {
          font-size: 12px;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin-top: 16px;
          color: #4c596d;
          font-size: 11px;
        }

        .current-page {
          padding: 5px 9px;
          border: 1px solid #dce3ed;
          border-radius: 4px;
          background: #f8fafc;
          color: #172033;
        }

        @media (max-width: 760px) {
          .topbar {
            gap: 10px;
            padding: 0 16px;
          }

          .global-search,
          .profile div,
          .profile .chevron {
            display: none;
          }

          .hero {
            grid-template-columns: 1fr;
            gap: 16px;
          }

          .section-heading,
          .transcripts-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .content {
            padding: 18px 16px 28px;
          }

          .transcripts-card {
            overflow-x: auto;
          }

          .transcript-row {
            min-width: 620px;
          }
        }
      `}</style>
    </main>
  );
}
