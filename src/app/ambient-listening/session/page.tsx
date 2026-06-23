"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

const insights = [
  {
    tag: "Protocol Ask",
    text: "Does anyone in your family have diabetes or vascular issues?",
    label: "Detected",
    tone: "protocol",
    note: "Patient reports persistent fatigue and lower back pain for 3 weeks.",
  },
  {
    tag: "Billing",
    text: "97530 - Therapeutic Act. detected add CPT for the session?",
    label: "Billing",
    tone: "billing",
    note: "Therapeutic activity timing crossed a billable threshold.",
  },
  {
    tag: "Protocol Ask",
    text: "How often do you engage in physical activity each week?",
    label: "Billing",
    tone: "protocol",
    note: "Prompt patient for weekly activity level before closing intake.",
  },
];

const suggestions = [
  ["Current Live CPT", "Therapeutic Act. 97130 is in progress. CPT started at 8:05"],
  ["Unit Recorded", "1 unit recorded for 97110 - Therapeutic Ex. at 8:04"],
  ["Modifier 59 Required", "Potential Bundle conflict detected for 97112 with 97110. Apply modifier?"],
  ["SNF Validation Alert", "Section GG mobility scores differ from nursing log"],
];

export default function AmbientSessionPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const query = searchQuery.trim().toLowerCase();
  const filteredInsights = useMemo(() => {
    if (!query) {
      return insights;
    }

    return insights.filter((item) =>
      [item.tag, item.text, item.label, item.note]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [query]);
  const filteredSuggestions = useMemo(() => {
    if (!query) {
      return suggestions;
    }

    return suggestions.filter((item) => item.join(" ").toLowerCase().includes(query));
  }, [query]);

  return (
    <main className="session-page">
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
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
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

      <section className="session-content">
        <section className="patient-strip">
          <Link href="/ambient-listening" className="back-link" aria-label="Back to Ambient Listening">
            ‹
          </Link>
          <img className="patient-avatar" src="https://i.pravatar.cc/120?img=12" alt="" />
          <div className="patient-info">
            <h1>Samuel Thompson</h1>
            <div className="patient-meta">
              <p>
                Age / Sex
                <strong>58 / Male</strong>
              </p>
              <p>
                Weight
                <strong>88 kg</strong>
              </p>
              <p>
                MRN Number
                <strong>220486</strong>
              </p>
              <p>
                Payor Source
                <strong className="blue-dot">Medicare</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="recording-card">
          <div className="recording-left">
            <span className="wave-bars" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <div className="timer-line">
                <strong>12:22</strong>
                <span>/ 1 Unit</span>
              </div>
              <p>
                Say <b>Stop</b> Recording...
              </p>
            </div>
          </div>
          <div className="recording-right">
            <p>Unit 2 at <b>23:00</b></p>
            <strong>+14:00 left</strong>
          </div>
        </section>

        <p className="processing-text">Medexa is Processing for Insights...</p>

        <section className="live-grid">
          <div className="insights-column">
            {filteredInsights.map((item) => (
              <article className="insight-item" key={item.text}>
                <div className="connector" />
                <div className={`insight-card ${item.tone === "protocol" ? "is-protocol" : ""}`}>
                  <span className="insight-tag">{item.tag}</span>
                  <p>{item.text}</p>
                </div>
                <div className="insight-actions">
                  <span>{item.label}</span>
                  <button type="button">× Ignore</button>
                </div>
                <p className="insight-note">{item.note}</p>
                <button className="approve-slider" type="button">
                  <span>›</span>
                  Slide to Approve
                </button>
              </article>
            ))}

            {filteredInsights.length === 0 && (
              <div className="empty-state">No live insights match your search.</div>
            )}
          </div>

          <aside className="suggestions-panel">
            <div className="suggestions-heading">
              <h2>Suggestions</h2>
              <span>3</span>
            </div>

            <div className="suggestions-list">
              {filteredSuggestions.map(([title, text]) => (
                <article className="suggestion-card" key={title}>
                  <div>
                    <span className="suggestion-dot" />
                    <h3>{title}</h3>
                  </div>
                  <p>{text}</p>
                  <button type="button">✓ Apply</button>
                </article>
              ))}

              {filteredSuggestions.length === 0 && (
                <div className="empty-state compact">No suggestions match your search.</div>
              )}
            </div>
          </aside>
        </section>
      </section>

      <div className="recording-controls" aria-label="Recording controls">
        <button type="button" className="pause-icon" aria-label="Pause">
          ||
        </button>
        <span>Pause</span>
        <button type="button" className="stop-icon" aria-label="Stop">
          <span />
        </button>
        <span>Stop</span>
      </div>

      <style>{`
        .session-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #fbfbfc;
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
          padding-bottom: 88px;
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

        .session-content {
          box-sizing: border-box;
          width: min(100%, 820px);
          margin: 0 auto;
          padding: 18px 20px 34px;
        }

        .patient-strip {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-link {
          width: 20px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #172033;
          font-size: 24px;
          line-height: 1;
          text-decoration: none;
        }

        .patient-avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
        }

        .patient-info {
          min-width: 0;
          flex: 1;
        }

        .patient-info h1 {
          margin: 0;
          font-size: 20px;
          font-weight: 500;
          line-height: 1.1;
          color: #172033;
        }

        .patient-meta {
          display: grid;
          grid-template-columns: repeat(4, minmax(120px, 1fr));
          gap: 22px;
          max-width: 620px;
          margin-top: 9px;
        }

        .patient-meta p {
          margin: 0;
          color: #6b768a;
          font-size: 9px;
          line-height: 1.3;
        }

        .patient-meta strong {
          display: block;
          margin-top: 4px;
          color: #172033;
          font-size: 11px;
          font-weight: 800;
        }

        .patient-meta .blue-dot {
          color: #001eff;
        }

        .patient-meta .blue-dot::before {
          content: "";
          width: 6px;
          height: 6px;
          display: inline-block;
          margin-right: 6px;
          border-radius: 50%;
          background: #001eff;
          vertical-align: 1px;
        }

        .recording-card {
          min-height: 78px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-top: 16px;
          padding: 14px 20px;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.13);
        }

        .recording-left {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .wave-bars {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }

        .wave-bars i {
          width: 3px;
          height: 10px;
          border-radius: 999px;
          background: #001eff;
        }

        .wave-bars i:nth-child(2),
        .wave-bars i:nth-child(4) {
          height: 17px;
        }

        .wave-bars i:nth-child(3) {
          height: 18px;
        }

        .timer-line {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .timer-line strong {
          color: #001eff;
          font-size: 32px;
          line-height: 1;
          letter-spacing: -1px;
        }

        .timer-line span {
          color: #172033;
          font-size: 11px;
        }

        .recording-left p,
        .recording-right p {
          margin: 5px 0 0;
          color: #536071;
          font-size: 10px;
        }

        .recording-left b,
        .recording-right b {
          color: #172033;
        }

        .recording-right {
          text-align: right;
        }

        .recording-right strong {
          display: block;
          margin-top: 6px;
          color: #001eff;
          font-size: 12px;
        }

        .processing-text {
          margin: 18px 0 14px;
          color: #b5bfcc;
          font-size: 10px;
        }

        .live-grid {
          display: grid;
          grid-template-columns: minmax(0, 390px) 320px;
          gap: 18px;
          align-items: start;
        }

        .insights-column {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .insight-item {
          position: relative;
          min-height: 104px;
          padding-left: 38px;
        }

        .connector {
          position: absolute;
          left: 10px;
          top: 0;
          bottom: -10px;
          width: 22px;
          border-left: 1px dashed #69a7ff;
          border-bottom: 1px dashed #69a7ff;
          border-radius: 0 0 0 10px;
        }

        .insight-card {
          width: min(100%, 330px);
          box-sizing: border-box;
          padding: 13px 15px;
          border-radius: 10px;
          background: #fff;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.08);
        }

        .insight-card.is-protocol {
          border: 1px solid #10c978;
          box-shadow: 0 10px 22px rgba(16, 201, 120, 0.14);
        }

        .insight-tag {
          display: inline-flex;
          align-items: center;
          border-radius: 999px;
          background: #0800b8;
          color: #fff;
          padding: 4px 8px;
          font-size: 9px;
          font-weight: 800;
        }

        .insight-card p {
          margin: 10px 0 0;
          color: #172033;
          font-size: 11px;
          line-height: 1.45;
        }

        .insight-actions {
          width: min(100%, 330px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 8px;
        }

        .insight-actions span {
          display: inline-flex;
          align-items: center;
          border: 1px solid #d8deea;
          border-radius: 999px;
          padding: 2px 8px;
          color: #7a879b;
          font-size: 9px;
        }

        .insight-actions button {
          border: 0;
          background: transparent;
          color: #172033;
          font-size: 11px;
        }

        .insight-note {
          width: min(100%, 330px);
          margin: 8px 0 0;
          color: #172033;
          font-size: 10px;
          line-height: 1.45;
        }

        .approve-slider {
          width: min(100%, 260px);
          height: 34px;
          display: flex;
          align-items: center;
          gap: 18px;
          margin-top: 8px;
          padding: 0 14px 0 6px;
          border: 1px solid #9fb4ff;
          border-radius: 999px;
          background: #fff;
          color: #172033;
          font-size: 11px;
        }

        .approve-slider span {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #f0f2ff;
          color: #001eff;
          font-size: 17px;
        }

        .suggestions-panel {
          box-sizing: border-box;
          width: 320px;
          border-radius: 14px;
          background: #fff;
          padding: 14px;
          box-shadow: 0 14px 30px rgba(15, 23, 42, 0.09);
        }

        .suggestions-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .suggestions-heading h2 {
          margin: 0;
          color: #172033;
          font-size: 11px;
          font-weight: 500;
        }

        .suggestions-heading span {
          color: #172033;
          font-size: 10px;
        }

        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .suggestion-card {
          padding: 12px 13px;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
        }

        .suggestion-card div {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .suggestion-dot {
          width: 6px;
          height: 6px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #11c778;
        }

        .suggestion-card h3 {
          margin: 0;
          color: #172033;
          font-size: 11px;
          font-weight: 500;
        }

        .suggestion-card p {
          margin: 9px 0 0;
          color: #172033;
          font-size: 10px;
          line-height: 1.45;
        }

        .suggestion-card button {
          display: block;
          margin: 10px 0 0 auto;
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 11px;
          font-weight: 800;
        }

        .empty-state {
          width: min(100%, 330px);
          border: 1px dashed #d8deea;
          border-radius: 14px;
          background: #fff;
          color: #667085;
          padding: 18px;
          text-align: center;
          font-size: 11px;
        }

        .empty-state.compact {
          width: auto;
          padding: 18px;
        }

        .recording-controls {
          position: fixed;
          left: 50%;
          bottom: 24px;
          z-index: 5;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 12px;
          border-radius: 999px;
          background: #fff;
          box-shadow: 0 16px 40px rgba(15, 23, 42, 0.24);
        }

        .recording-controls button {
          border: 0;
        }

        .recording-controls span {
          color: #172033;
          font-size: 10px;
          font-weight: 700;
        }

        .pause-icon,
        .stop-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }

        .pause-icon {
          background: #eef2ff;
          color: #001eff;
          font-size: 13px;
          font-weight: 800;
          letter-spacing: -2px;
        }

        .stop-icon {
          background: #0800d8;
        }

        .stop-icon span {
          width: 10px;
          height: 10px;
          border: 2px solid #fff;
          border-radius: 50%;
        }

        @media (max-width: 900px) {
          .live-grid {
            grid-template-columns: 1fr;
          }

          .suggestions-panel {
            max-width: 520px;
          }

          .patient-meta {
            grid-template-columns: repeat(2, minmax(120px, 1fr));
          }
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

          .session-content {
            padding: 18px 16px 32px;
          }

          .patient-strip {
            align-items: flex-start;
          }

          .patient-meta {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .recording-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .recording-right {
            text-align: left;
          }
        }
      `}</style>
    </main>
  );
}
