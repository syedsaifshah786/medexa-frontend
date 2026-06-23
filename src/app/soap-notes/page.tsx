"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- Prototype uses remote avatar URLs without touching next.config.ts. */

type SectionKey = "subjective" | "objective" | "assessment";

type SoapData = {
  subjective: {
    chiefComplaint: string;
    painScale: string;
    duration: string;
  };
  objective: {
    observationNotes: string;
    rangeOfMotion: string;
    affect: string;
    vitalSigns: string;
  };
  assessment: {
    diagnosisSummary: string;
    primaryDiagnosisCode: string;
    severity: string;
  };
};

const initialSoapData: SoapData = {
  subjective: {
    chiefComplaint:
      "Patient reports persistent discomfort in the lower back over the last 14 days, particularly after prolonged sitting. Mentions difficulty with mobility and occasional sharp pains. States: I feel like my back is always tight and stiff.",
    painScale: "6",
    duration: "14 days",
  },
  objective: {
    observationNotes:
      "Observed limited range of motion in lumbar flexion (40 deg) and slight guarding behavior on palpation of L4-L5 region. Patient ambulates with mild antalgic gait. Vital signs within normal limits: BP 118/76, HR 72 bpm. Affect is mildly anxious. Arrived on time.",
    rangeOfMotion: "Lumbar Flexion 40 deg",
    affect: "Mildly Anxious",
    vitalSigns: "BP 118/76, HR 72",
  },
  assessment: {
    diagnosisSummary:
      "Chronic Lower Back Pain (M54.5) secondary to postural dysfunction and muscle deconditioning. Patient demonstrates functional limitations consistent with moderate severity. Focus on stretching and strengthening exercises for lumbar support. Follow-up scheduled.",
    primaryDiagnosisCode: "M54.5",
    severity: "Moderate",
  },
};

function Field({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="field">
      <label>* {label}</label>
      <div className={multiline ? "field-box field-box-large" : "field-box"}>
        {value}
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="field">
      <label>* {label}</label>
      {multiline ? (
        <textarea
          className="field-input field-textarea"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          className="field-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}

function NoteCard({
  title,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  children,
}: {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="note-card">
      <div className="note-heading">
        <h2>{title}</h2>
        {!isEditing && (
          <button type="button" className="edit-trigger" onClick={onEdit}>
            ✎ Edit
          </button>
        )}
        <button type="button">✎ Edit</button>
      </div>
      {children}
      {isEditing && (
        <div className="edit-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onSave}>
            Save
          </button>
        </div>
      )}
    </section>
  );
}

export default function SoapNotesPage() {
  const [headerSearch, setHeaderSearch] = useState("");
  const [soapData, setSoapData] = useState<SoapData>(initialSoapData);
  const [draftData, setDraftData] = useState<SoapData>(initialSoapData);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const soapSearchText = useMemo(
    () => ({
      subjective: `Subjective Chief Complaint ${soapData.subjective.chiefComplaint} Pain Scale ${soapData.subjective.painScale} Duration ${soapData.subjective.duration}`,
      objective: `Objective Observation Notes ${soapData.objective.observationNotes} Range of Motion ${soapData.objective.rangeOfMotion} Affect ${soapData.objective.affect} Vital Signs ${soapData.objective.vitalSigns}`,
      assessment: `Assessment Diagnosis Summary ${soapData.assessment.diagnosisSummary} Primary Diagnosis Code ${soapData.assessment.primaryDiagnosisCode} Severity ${soapData.assessment.severity}`,
    }),
    [soapData],
  );

  const startEdit = (section: SectionKey) => {
    setDraftData(soapData);
    setEditingSection(section);
    setStatusMessage("");
  };

  const saveSection = (section: SectionKey) => {
    setSoapData(draftData);
    setEditingSection(null);
    setStatusMessage(`${section.charAt(0).toUpperCase()}${section.slice(1)} updated.`);
  };

  const cancelEdit = () => {
    setDraftData(soapData);
    setEditingSection(null);
  };

  const visibleSections = useMemo(() => {
    const query = headerSearch.trim().toLowerCase();

    if (!query) {
      return {
        subjective: true,
        objective: true,
        assessment: true,
      };
    }

    return {
      subjective: soapSearchText.subjective.toLowerCase().includes(query),
      objective: soapSearchText.objective.toLowerCase().includes(query),
      assessment: soapSearchText.assessment.toLowerCase().includes(query),
    };
  }, [headerSearch, soapSearchText]);
  const hasVisibleSections =
    visibleSections.subjective ||
    visibleSections.objective ||
    visibleSections.assessment;

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

      <section className="soap-content">
        <section className="session-summary">
          <div className="title-row">
            <Link href="/ambient-listening" className="back-link" aria-label="Back to Ambient Listening">
              ‹
            </Link>
            <h1>Therapeutic Therapy Session</h1>
            <span>• Medexa Summarized</span>
          </div>

          <div className="meta-row">
            <p>
              <strong>July 05, 12:00 PM</strong>
            </p>
            <p>
              Patient ID: <strong>#99283</strong>
            </p>
            <p>
              Duration: <strong>52:22</strong>
            </p>
            <p>
              Unit(s): <strong>3</strong>
            </p>
          </div>
        </section>

        <nav className="tabs" aria-label="Session views">
          <Link href="/soap-notes" className="tab-active">
            SOAP Notes
          </Link>
          <Link href="/billing-intelligence">Billing Intelligence</Link>
          <Link href="/patient-summary">Patient Summary</Link>
          <Link href="/claim-document" className="claim-link">
            ✓ Create Claim-Document
          </Link>
        </nav>

        <section className="notes-stack">
          {statusMessage && <div className="status-message">{statusMessage}</div>}

          {!hasVisibleSections && (
            <div className="empty-state">No SOAP sections match your search.</div>
          )}

          {visibleSections.subjective && (
            <NoteCard
              title="Subjective"
              isEditing={editingSection === "subjective"}
              onEdit={() => startEdit("subjective")}
              onSave={() => saveSection("subjective")}
              onCancel={cancelEdit}
            >
              <div className="card-fields">
                {editingSection === "subjective" ? (
                  <EditableField
                    label="Chief Complaint"
                    multiline
                    value={draftData.subjective.chiefComplaint}
                    onChange={(value) =>
                      setDraftData((data) => ({
                        ...data,
                        subjective: { ...data.subjective, chiefComplaint: value },
                      }))
                    }
                  />
                ) : (
                  <Field
                    label="Chief Complaint"
                    multiline
                    value={soapData.subjective.chiefComplaint}
                  />
                )}
                <div className="field-grid two">
                  {editingSection === "subjective" ? (
                    <>
                      <EditableField
                        label="Pain Scale (0-10)"
                        value={draftData.subjective.painScale}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            subjective: { ...data.subjective, painScale: value },
                          }))
                        }
                      />
                      <EditableField
                        label="Duration"
                        value={draftData.subjective.duration}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            subjective: { ...data.subjective, duration: value },
                          }))
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Field label="Pain Scale (0-10)" value={soapData.subjective.painScale} />
                      <Field label="Duration" value={soapData.subjective.duration} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
          )}

          {visibleSections.objective && (
            <NoteCard
              title="Objective"
              isEditing={editingSection === "objective"}
              onEdit={() => startEdit("objective")}
              onSave={() => saveSection("objective")}
              onCancel={cancelEdit}
            >
              <div className="card-fields">
                {editingSection === "objective" ? (
                  <EditableField
                    label="Observation Notes"
                    multiline
                    value={draftData.objective.observationNotes}
                    onChange={(value) =>
                      setDraftData((data) => ({
                        ...data,
                        objective: { ...data.objective, observationNotes: value },
                      }))
                    }
                  />
                ) : (
                  <Field
                    label="Observation Notes"
                    multiline
                    value={soapData.objective.observationNotes}
                  />
                )}
                <div className="field-grid three">
                  {editingSection === "objective" ? (
                    <>
                      <EditableField
                        label="Range of Motion"
                        value={draftData.objective.rangeOfMotion}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            objective: { ...data.objective, rangeOfMotion: value },
                          }))
                        }
                      />
                      <EditableField
                        label="Affect"
                        value={draftData.objective.affect}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            objective: { ...data.objective, affect: value },
                          }))
                        }
                      />
                      <EditableField
                        label="Vital Signs"
                        value={draftData.objective.vitalSigns}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            objective: { ...data.objective, vitalSigns: value },
                          }))
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Field label="Range of Motion" value={soapData.objective.rangeOfMotion} />
                      <Field label="Affect" value={soapData.objective.affect} />
                      <Field label="Vital Signs" value={soapData.objective.vitalSigns} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
          )}

          {visibleSections.assessment && (
            <NoteCard
              title="Assessment"
              isEditing={editingSection === "assessment"}
              onEdit={() => startEdit("assessment")}
              onSave={() => saveSection("assessment")}
              onCancel={cancelEdit}
            >
              <div className="card-fields">
                {editingSection === "assessment" ? (
                  <EditableField
                    label="Diagnosis Summary"
                    multiline
                    value={draftData.assessment.diagnosisSummary}
                    onChange={(value) =>
                      setDraftData((data) => ({
                        ...data,
                        assessment: { ...data.assessment, diagnosisSummary: value },
                      }))
                    }
                  />
                ) : (
                  <Field
                    label="Diagnosis Summary"
                    multiline
                    value={soapData.assessment.diagnosisSummary}
                  />
                )}
                <div className="field-grid two">
                  {editingSection === "assessment" ? (
                    <>
                      <EditableField
                        label="Primary Diagnosis Code"
                        value={draftData.assessment.primaryDiagnosisCode}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            assessment: { ...data.assessment, primaryDiagnosisCode: value },
                          }))
                        }
                      />
                      <EditableField
                        label="Severity"
                        value={draftData.assessment.severity}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            assessment: { ...data.assessment, severity: value },
                          }))
                        }
                      />
                    </>
                  ) : (
                    <>
                      <Field
                        label="Primary Diagnosis Code"
                        value={soapData.assessment.primaryDiagnosisCode}
                      />
                      <Field label="Severity" value={soapData.assessment.severity} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
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

        .soap-content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          margin: 0 auto;
          padding: 20px 32px 36px;
          background: #fbfbfc;
        }

        .session-summary {
          border-bottom: 1px solid #edf1f6;
          padding-bottom: 18px;
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .back-link {
          width: 24px;
          color: #172033;
          font-size: 28px;
          line-height: 1;
          text-decoration: none;
        }

        .title-row h1 {
          margin: 0;
          color: #172033;
          font-size: 25px;
          font-weight: 600;
          line-height: 1.2;
        }

        .title-row span {
          color: #001eff;
          font-size: 12px;
          font-weight: 800;
        }

        .meta-row {
          display: grid;
          grid-template-columns: repeat(4, minmax(140px, 1fr));
          gap: 44px;
          max-width: 780px;
          margin: 20px 0 0 46px;
        }

        .meta-row p {
          margin: 0;
          color: #667085;
          font-size: 12px;
          line-height: 1.3;
        }

        .meta-row strong {
          color: #172033;
          font-weight: 800;
        }

        .tabs {
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 42px;
          border-bottom: 1px solid #edf1f6;
        }

        .tabs a {
          color: #172033;
          font-size: 13px;
          text-decoration: none;
        }

        .tabs .tab-active {
          border: 1px solid #b9c8ff;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 10px 18px;
        }

        .tabs .claim-link {
          margin-left: auto;
          color: #001eff;
          font-size: 15px;
          font-weight: 800;
        }

        .notes-stack {
          display: flex;
          flex-direction: column;
          gap: 22px;
          padding-top: 20px;
        }

        .note-card {
          border: 1px solid #dde5f0;
          border-radius: 14px;
          background: #fff;
          padding: 20px 20px 22px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        }

        .note-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .note-heading h2 {
          margin: 0;
          color: #4b5565;
          font-size: 15px;
          font-weight: 500;
        }

        .note-heading button {
          border: 0;
          background: transparent;
          color: #172033;
          font-size: 13px;
        }

        .note-heading button:not(.edit-trigger) {
          display: none;
        }

        .card-fields {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .field label {
          display: block;
          margin-bottom: 10px;
          color: #172033;
          font-size: 12px;
          font-weight: 800;
        }

        .field-box {
          min-height: 44px;
          box-sizing: border-box;
          display: flex;
          align-items: center;
          border: 1px solid #d9e1ec;
          border-radius: 7px;
          background: #fff;
          padding: 12px 16px;
          color: #344054;
          font-size: 12px;
          line-height: 1.45;
        }

        .field-box-large {
          min-height: 76px;
          align-items: flex-start;
        }

        .field-input {
          width: 100%;
          min-height: 44px;
          box-sizing: border-box;
          border: 1px solid #d9e1ec;
          border-radius: 7px;
          background: #fff;
          color: #344054;
          font: inherit;
          font-size: 12px;
          line-height: 1.45;
          padding: 12px 16px;
          outline: 0;
        }

        .field-input:focus {
          border-color: #8da2ff;
          box-shadow: 0 0 0 3px rgba(0, 30, 255, 0.08);
        }

        .field-textarea {
          min-height: 96px;
          resize: vertical;
        }

        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 18px;
        }

        .edit-actions button {
          border: 0;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .edit-actions button:first-child {
          background: #f3f5f8;
          color: #667085;
        }

        .status-message {
          border: 1px solid #bdebd4;
          border-radius: 14px;
          background: #fbfffd;
          color: #09875a;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .field-grid {
          display: grid;
          gap: 18px;
        }

        .field-grid.two {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .field-grid.three {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .empty-state {
          border: 1px dashed #d8deea;
          border-radius: 14px;
          background: #fff;
          color: #667085;
          padding: 24px;
          text-align: center;
          font-size: 13px;
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

          .soap-content {
            padding: 18px 16px 28px;
          }

          .title-row {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .meta-row {
            grid-template-columns: 1fr;
            gap: 10px;
            margin-left: 36px;
          }

          .tabs {
            align-items: flex-start;
            flex-direction: column;
            gap: 14px;
            padding: 16px 0;
          }

          .tabs .claim-link {
            margin-left: 0;
          }

          .field-grid.two,
          .field-grid.three {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
