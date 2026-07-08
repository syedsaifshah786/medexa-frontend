"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import {
  defaultSoapData,
  type SectionKey,
  useSessionDocumentation,
} from "@/context/SessionDocumentationContext";
import { getActiveSessionId, setActiveSessionId } from "@/lib/activeSession";
import { medexaApi, type ApiFinalizeSessionResponse, type ApiSoapNoteResponse } from "@/lib/api";
import { formatClockTime, formatDateTime, formatNumber, formatUnits, translateCptDisplayName, translateDynamicMessage } from "@/lib/translations";

const debugLog = (...args: Parameters<typeof console.log>) => {
  if (process.env.NODE_ENV === "development") {
    console.log(...args);
  }
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
  editLabel,
  saveLabel,
  cancelLabel,
  children,
}: {
  title: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  editLabel: string;
  saveLabel: string;
  cancelLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="note-card">
      <div className="note-heading">
        <h2>{title}</h2>
        {!isEditing && (
          <button type="button" className="edit-trigger" onClick={onEdit}>
            {editLabel}
          </button>
        )}
      </div>
      {children}
      {isEditing && (
        <div className="edit-actions">
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onSave}>
            {saveLabel}
          </button>
        </div>
      )}
    </section>
  );
}

export default function SoapNotesPage() {
  return (
    <Suspense fallback={null}>
      <SoapNotesContent />
    </Suspense>
  );
}

const emptySoapData: typeof defaultSoapData = {
  subjective: {
    chiefComplaint: "",
    painScale: "",
    duration: "",
  },
  objective: {
    observationNotes: "",
    rangeOfMotion: "",
    affect: "",
    vitalSigns: "",
  },
  assessment: {
    diagnosisSummary: "",
    primaryDiagnosisCode: "",
    severity: "",
  },
  plan: {
    followUpPlan: "",
  },
};

const normalizeSoapResponse = (data: ApiSoapNoteResponse, fallback = defaultSoapData): typeof defaultSoapData => {
  const source = (data.soap_note ?? data) as ApiSoapNoteResponse;
  const subjective = typeof source.subjective === "object" && source.subjective ? source.subjective : null;
  const objective = typeof source.objective === "object" && source.objective ? source.objective : null;
  const assessment = typeof source.assessment === "object" && source.assessment ? source.assessment : null;
  const plan = typeof source.plan === "object" && source.plan ? source.plan : null;

  return {
    subjective: {
      chiefComplaint:
        subjective?.chiefComplaint ??
        source.chief_complaint ??
        (typeof source.subjective === "string" ? source.subjective : fallback.subjective.chiefComplaint),
      painScale: subjective?.painScale ?? source.pain_scale ?? fallback.subjective.painScale,
      duration: subjective?.duration ?? source.duration ?? fallback.subjective.duration,
    },
    objective: {
      observationNotes:
        objective?.observationNotes ??
        source.observation_notes ??
        (typeof source.objective === "string" ? source.objective : fallback.objective.observationNotes),
      rangeOfMotion: objective?.rangeOfMotion ?? source.range_of_motion ?? fallback.objective.rangeOfMotion,
      affect: objective?.affect ?? source.affect ?? fallback.objective.affect,
      vitalSigns: objective?.vitalSigns ?? source.vital_signs ?? fallback.objective.vitalSigns,
    },
    assessment: {
      diagnosisSummary:
        assessment?.diagnosisSummary ??
        source.diagnosis_summary ??
        (typeof source.assessment === "string" ? source.assessment : fallback.assessment.diagnosisSummary),
      primaryDiagnosisCode: assessment?.primaryDiagnosisCode ?? fallback.assessment.primaryDiagnosisCode,
      severity: assessment?.severity ?? fallback.assessment.severity,
    },
    plan: {
      followUpPlan:
        plan?.followUpPlan ??
        (typeof source.plan === "string" ? source.plan : fallback.plan.followUpPlan),
    },
  };
};

function SoapNotesContent() {
  const searchParams = useSearchParams();
  const [headerSearch, setHeaderSearch] = useState("");
  const { soapData, updateSoapData } = useSessionDocumentation();
  const [draftData, setDraftData] = useState(defaultSoapData);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const [billingSummary, setBillingSummary] = useState<ApiFinalizeSessionResponse["billing_summary"] | null>(null);
  const [missingSessionSoap, setMissingSessionSoap] = useState(false);
  const { language, t } = useLanguage();

  useEffect(() => {
    const querySessionId = searchParams.get("sessionId") ?? searchParams.get("id") ?? "";
    const activeSessionId = querySessionId || getActiveSessionId();
    debugLog("[SOAP Page] sessionId", activeSessionId);
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);
    setMissingSessionSoap(Boolean(querySessionId));
    if (querySessionId) {
      updateSoapData(emptySoapData);
      setBillingSummary(null);
    }

    let isMounted = true;

    const loadSoapNotes = async () => {
      if (!activeSessionId) {
        return;
      }

      const storedSoapNote = window.localStorage.getItem(`medexa_soap_note_${activeSessionId}`);

      if (storedSoapNote) {
        try {
          const parsed = JSON.parse(storedSoapNote) as ApiSoapNoteResponse & {
            billing_summary?: ApiFinalizeSessionResponse["billing_summary"];
          };
          const { billing_summary: nextBillingSummary } = parsed;
          if (isMounted) {
            setBillingSummary(nextBillingSummary ?? null);
            updateSoapData(normalizeSoapResponse(parsed, querySessionId ? emptySoapData : defaultSoapData));
            setMissingSessionSoap(false);
          }
          return;
        } catch {
          window.localStorage.removeItem(`medexa_soap_note_${activeSessionId}`);
        }
      }

      const apiSoapData = await medexaApi.getSoapNote(activeSessionId, language);
      debugLog("[SOAP Page] backend data", apiSoapData);

      if (isMounted && apiSoapData) {
        const { billing_summary: nextBillingSummary } = apiSoapData;
        setBillingSummary(nextBillingSummary ?? null);
        updateSoapData(normalizeSoapResponse(apiSoapData, querySessionId ? emptySoapData : defaultSoapData));
        window.localStorage.setItem(`medexa_soap_note_${activeSessionId}`, JSON.stringify(apiSoapData));
        setMissingSessionSoap(false);
        return;
      }

      if (!isMounted) {
        return;
      }

      if (!storedSoapNote) {
        if (querySessionId) {
          updateSoapData(emptySoapData);
          setMissingSessionSoap(true);
        }
      }
    };

    loadSoapNotes();

    return () => {
      isMounted = false;
    };
  }, [language, searchParams, updateSoapData]);

  useEffect(() => {
    if (!editingSection) {
      setDraftData(soapData);
    }
  }, [editingSection, soapData]);

  const soapSearchText = useMemo(
    () => ({
      subjective: `${t("soap.subjective")} ${t("soap.chiefComplaint")} ${soapData.subjective.chiefComplaint} ${t("soap.painScale")} ${soapData.subjective.painScale} ${t("common.duration")} ${soapData.subjective.duration}`,
      objective: `${t("soap.objective")} ${t("soap.observationNotes")} ${soapData.objective.observationNotes} ${t("soap.rangeOfMotion")} ${soapData.objective.rangeOfMotion} ${t("soap.affect")} ${soapData.objective.affect} ${t("soap.vitalSigns")} ${soapData.objective.vitalSigns}`,
      assessment: `${t("soap.assessment")} ${t("soap.diagnosisSummary")} ${soapData.assessment.diagnosisSummary} ${t("soap.primaryDiagnosisCode")} ${soapData.assessment.primaryDiagnosisCode} ${t("soap.severity")} ${soapData.assessment.severity}`,
      plan: `${t("soap.plan")} ${t("soap.followUpPlan")} ${soapData.plan.followUpPlan}`,
    }),
    [soapData, t],
  );

  const startEdit = (section: SectionKey) => {
    setDraftData(soapData);
    setEditingSection(section);
    setStatusMessage("");
  };

  const saveSection = (section: SectionKey) => {
    updateSoapData(draftData);
    medexaApi.updateSoapNotes(sessionId, draftData, language);
    setEditingSection(null);
    setStatusMessage(`${t(`soap.${section}`)} ${t("summary.updated")}`);
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
        plan: true,
      };
    }

    return {
      subjective: soapSearchText.subjective.toLowerCase().includes(query),
      objective: soapSearchText.objective.toLowerCase().includes(query),
      assessment: soapSearchText.assessment.toLowerCase().includes(query),
      plan: soapSearchText.plan.toLowerCase().includes(query),
    };
  }, [headerSearch, soapSearchText]);
  const hasVisibleSections =
    visibleSections.subjective ||
    visibleSections.objective ||
    visibleSections.assessment ||
    visibleSections.plan;
  const billingRecords = billingSummary?.cpt_records ?? [];
  const billingUnits =
    billingRecords.length > 0
      ? billingRecords.reduce((total, record) => total + record.units, 0)
      : billingSummary?.units ?? 0;
  const displayText = (value: string | null | undefined) => translateDynamicMessage(value ?? "", language);
  const displayDuration = billingSummary ? formatClockTime(billingSummary.total_seconds, language) : translateDynamicMessage("52:22", language);
  const displayBillingUnits = formatNumber(billingUnits || 3, language);
  const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="soap-content">
        <section className="session-summary">
          <div className="title-row">
            <Link href="/ambient-listening" className="back-link" aria-label={t("session.backToAmbient")}>
              ‹
            </Link>
            <h1>{t("session.therapeuticTherapySession")}</h1>
            <span>• {t("session.medexaSummarized")}</span>
          </div>

          <div className="meta-row">
            <p>
              <strong>{formatDateTime("2026-07-05T12:00:00", language)}</strong>
            </p>
            <p>
              {t("session.patientId")}: <strong dir="ltr">#99283</strong>
            </p>
            <p>
              {t("common.duration")}: <strong dir="ltr">{displayDuration}</strong>
            </p>
            <p>
              {t("session.units")}: <strong dir="ltr">{displayBillingUnits}</strong>
            </p>
          </div>
        </section>

        <nav className="tabs" aria-label="Session views">
          <Link href={`/soap-notes${sessionQuery}`} className="tab-active">
            {t("nav.soapNotes")}
          </Link>
          <Link href={`/billing-intelligence${sessionQuery}`}>{t("nav.billingIntelligence")}</Link>
          <Link href={`/patient-summary${sessionQuery}`}>{t("nav.patientSummary")}</Link>
          <Link href={`/claim-document${sessionQuery}`} className="claim-link">
            ✓ {t("nav.createClaimDocument")}
          </Link>
        </nav>

        <section className="notes-stack">
          {statusMessage && <div className="status-message">{statusMessage}</div>}

          {missingSessionSoap && (
            <div className="empty-state">{t("soap.noNote")}</div>
          )}

          {!missingSessionSoap && !hasVisibleSections && (
            <div className="empty-state">{t("soap.noSections")}</div>
          )}

          {!missingSessionSoap && visibleSections.subjective && (
            <NoteCard
              title={t("soap.subjective")}
              isEditing={editingSection === "subjective"}
              onEdit={() => startEdit("subjective")}
              onSave={() => saveSection("subjective")}
              onCancel={cancelEdit}
              editLabel={t("common.edit")}
              saveLabel={t("common.save")}
              cancelLabel={t("common.cancel")}
            >
              <div className="card-fields">
                {editingSection === "subjective" ? (
                  <EditableField
                    label={t("soap.chiefComplaint")}
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
                    label={t("soap.chiefComplaint")}
                    multiline
                    value={displayText(soapData.subjective.chiefComplaint)}
                  />
                )}
                <div className="field-grid two">
                  {editingSection === "subjective" ? (
                    <>
                      <EditableField
                        label={`${t("soap.painScale")} (0-10)`}
                        value={draftData.subjective.painScale}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            subjective: { ...data.subjective, painScale: value },
                          }))
                        }
                      />
                      <EditableField
                        label={t("common.duration")}
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
                      <Field label={`${t("soap.painScale")} (0-10)`} value={displayText(soapData.subjective.painScale)} />
                      <Field label={t("common.duration")} value={displayText(soapData.subjective.duration)} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
          )}

          {!missingSessionSoap && visibleSections.objective && (
            <NoteCard
              title={t("soap.objective")}
              isEditing={editingSection === "objective"}
              onEdit={() => startEdit("objective")}
              onSave={() => saveSection("objective")}
              onCancel={cancelEdit}
              editLabel={t("common.edit")}
              saveLabel={t("common.save")}
              cancelLabel={t("common.cancel")}
            >
              <div className="card-fields">
                {editingSection === "objective" ? (
                  <EditableField
                    label={t("soap.observationNotes")}
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
                    label={t("soap.observationNotes")}
                    multiline
                    value={displayText(soapData.objective.observationNotes)}
                  />
                )}
                <div className="field-grid three">
                  {editingSection === "objective" ? (
                    <>
                      <EditableField
                        label={t("soap.rangeOfMotion")}
                        value={draftData.objective.rangeOfMotion}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            objective: { ...data.objective, rangeOfMotion: value },
                          }))
                        }
                      />
                      <EditableField
                        label={t("soap.affect")}
                        value={draftData.objective.affect}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            objective: { ...data.objective, affect: value },
                          }))
                        }
                      />
                      <EditableField
                        label={t("soap.vitalSigns")}
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
                      <Field label={t("soap.rangeOfMotion")} value={displayText(soapData.objective.rangeOfMotion)} />
                      <Field label={t("soap.affect")} value={displayText(soapData.objective.affect)} />
                      <Field label={t("soap.vitalSigns")} value={displayText(soapData.objective.vitalSigns)} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
          )}

          {!missingSessionSoap && visibleSections.assessment && (
            <NoteCard
              title={t("soap.assessment")}
              isEditing={editingSection === "assessment"}
              onEdit={() => startEdit("assessment")}
              onSave={() => saveSection("assessment")}
              onCancel={cancelEdit}
              editLabel={t("common.edit")}
              saveLabel={t("common.save")}
              cancelLabel={t("common.cancel")}
            >
              <div className="card-fields">
                {editingSection === "assessment" ? (
                  <EditableField
                    label={t("soap.diagnosisSummary")}
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
                    label={t("soap.diagnosisSummary")}
                    multiline
                    value={displayText(soapData.assessment.diagnosisSummary)}
                  />
                )}
                <div className="field-grid two">
                  {editingSection === "assessment" ? (
                    <>
                      <EditableField
                        label={t("soap.primaryDiagnosisCode")}
                        value={draftData.assessment.primaryDiagnosisCode}
                        onChange={(value) =>
                          setDraftData((data) => ({
                            ...data,
                            assessment: { ...data.assessment, primaryDiagnosisCode: value },
                          }))
                        }
                      />
                      <EditableField
                        label={t("soap.severity")}
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
                        label={t("soap.primaryDiagnosisCode")}
                        value={displayText(soapData.assessment.primaryDiagnosisCode)}
                      />
                      <Field label={t("soap.severity")} value={displayText(soapData.assessment.severity)} />
                    </>
                  )}
                </div>
              </div>
            </NoteCard>
          )}

          {!missingSessionSoap && visibleSections.plan && (
            <NoteCard
              title={t("soap.plan")}
              isEditing={editingSection === "plan"}
              onEdit={() => startEdit("plan")}
              onSave={() => saveSection("plan")}
              onCancel={cancelEdit}
              editLabel={t("common.edit")}
              saveLabel={t("common.save")}
              cancelLabel={t("common.cancel")}
            >
              <div className="card-fields">
                {editingSection === "plan" ? (
                  <EditableField
                    label={t("soap.followUpPlan")}
                    multiline
                    value={draftData.plan.followUpPlan}
                    onChange={(value) =>
                      setDraftData((data) => ({
                        ...data,
                        plan: { ...data.plan, followUpPlan: value },
                      }))
                    }
                  />
                ) : (
                  <Field label={t("soap.followUpPlan")} multiline value={displayText(soapData.plan.followUpPlan)} />
                )}
              </div>
            </NoteCard>
          )}

          {!missingSessionSoap && billingSummary && (
            <section className="note-card billing-summary-card">
              <div className="note-heading">
                <h2>{t("soap.billingCptSummary")}</h2>
              </div>
              <div className="billing-summary-list">
                {billingRecords.length > 0 ? (
                  billingRecords.map((record) => (
                    <div className="billing-summary-row" key={record.code}>
                      <strong className="billing-cpt-code" dir="ltr">{record.code}</strong>
                      <span className="billing-cpt-title">{translateCptDisplayName(record.code, record.displayName, language)}</span>
                      <span className="billing-cpt-duration" dir="ltr">{formatClockTime(record.seconds, language)}</span>
                      <span className="billing-cpt-units">{formatUnits(record.units, language)}</span>
                    </div>
                  ))
                ) : (
                  <div className="billing-summary-row">
                    <strong className="billing-cpt-code" dir="ltr">{billingSummary.cpt_code ?? t("billing.noCpt")}</strong>
                    <span className="billing-cpt-title">{t("soap.requiresReview")}</span>
                    <span className="billing-cpt-duration" dir="ltr">{formatClockTime(billingSummary.cpt_seconds ?? 0, language)}</span>
                    <span className="billing-cpt-units">{formatUnits(billingSummary.units ?? 0, language)}</span>
                  </div>
                )}
              </div>
            </section>
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
          min-width: 0;
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

        .billing-summary-list {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .billing-summary-row {
          display: grid;
          grid-template-columns: 90px minmax(180px, 1fr) 90px 90px;
          gap: 12px;
          align-items: center;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid #e7edf5;
          border-radius: 8px;
          padding: 12px 14px;
          color: #344054;
          font-size: 12px;
        }

        .billing-summary-row strong {
          color: #001eff;
        }

        .billing-summary-row > * {
          min-width: 0;
        }

        .billing-cpt-title,
        .billing-cpt-units {
          overflow-wrap: anywhere;
          line-height: 1.35;
        }

        .billing-cpt-duration,
        .billing-cpt-units {
          justify-self: end;
          white-space: nowrap;
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

          .billing-summary-card {
            padding: 16px;
            overflow: hidden;
          }

          .billing-summary-row {
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 8px 12px;
            padding: 12px;
          }

          .billing-cpt-code {
            align-self: center;
          }

          .billing-cpt-title {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .billing-cpt-duration {
            grid-column: 1;
            grid-row: 3;
            justify-self: start;
          }

          .billing-cpt-units {
            grid-column: 2;
            grid-row: 3;
            justify-self: end;
            text-align: right;
          }
        }
      `}</style>
    </main>
  );
}
