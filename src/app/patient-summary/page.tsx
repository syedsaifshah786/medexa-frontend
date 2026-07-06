"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { getActiveSessionId, setActiveSessionId } from "@/lib/activeSession";
import { medexaApi } from "@/lib/api";
import { formatDateTime, formatNumber, translateDynamicMessage } from "@/lib/translations";

const cleanSummaryTextAr =
  "في ١٨ يونيو ٢٠٢٦، أكمل Samuel الجلسة ٤ من ١٢ مع Dr. Sarah Miller، مع التركيز على تدريب المشي والتمارين العلاجية لدعم ألم أسفل الظهر وتقليل التعب وتحسين القوة والتوازن. أظهر أداء جيدا واحتاج إلى بعض المساعدة في الحركة، وهذا متوقع في هذه المرحلة من الرعاية. تحسنت مرونة الركبة بمقدار ١٥ درجة مقارنة بجلسة خط الأساس. تشمل الخطوات التالية متابعة تحليل الدهون مع طبيب الرعاية الأولية في ديسمبر ٢٠٢٦، والاستمرار في جلسات العلاج أيام الاثنين والأربعاء والجمعة، وتتبع الألم يوميا في دفتر الألم، وإكمال تمارين المنزل مثل رفع الركبتين أثناء الجلوس ورفع الكعبين.";

const summaryText =
  "On June 18, 2026, Samuel completed session 4 of 12 with Dr. Sarah Miller, focusing on gait training and therapeutic exercises to support lower back pain, reduce fatigue, and improve strength and balance. He performed well and needed some movement assistance, which is normal at this stage of care. His knee flexibility improved by 15° compared with the baseline session. Next steps include a lipid panel follow-up with the primary care physician due in December 2026, continuing therapy sessions on Monday, Wednesday, and Friday, tracking pain daily in the pain diary, and completing home exercises including seated marches and heel raises.";
const summaryTextAr =
  "في 18 يونيو 2026، أكمل Samuel الجلسة 4 من 12 مع Dr. Sarah Miller، مع التركيز على تدريب المشي والتمارين العلاجية لدعم ألم أسفل الظهر وتقليل التعب وتحسين القوة والتوازن. أظهر أداء جيدا واحتاج إلى بعض المساعدة في الحركة، وهذا متوقع في هذه المرحلة من الرعاية. تحسنت مرونة الركبة بمقدار 15 درجة مقارنة بجلسة خط الأساس. تشمل الخطوات التالية متابعة تحليل الدهون مع طبيب الرعاية الأولية في ديسمبر 2026، والاستمرار في جلسات العلاج أيام الاثنين والأربعاء والجمعة، وتتبع الألم يوميا في دفتر الألم، وإكمال تمارين المنزل مثل رفع الركبتين أثناء الجلوس ورفع الكعبين.";

void summaryTextAr;

export default function PatientSummaryPage() {
  const [headerSearch, setHeaderSearch] = useState("");
  const [summaryNote, setSummaryNote] = useState(summaryText);
  const [draftNote, setDraftNote] = useState(summaryText);
  const [isEditing, setIsEditing] = useState(false);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const { soapData, hasGeneratedDocumentation } = useSessionDocumentation();
  const { language, t } = useLanguage();
  const displaySummary = translateDynamicMessage(summaryNote, language);

  useEffect(() => {
    if (hasGeneratedDocumentation || isEditing) {
      return;
    }

    const localizedSummary = language === "ar" ? cleanSummaryTextAr : summaryText;
    setSummaryNote(localizedSummary);
    setDraftNote(localizedSummary);
  }, [hasGeneratedDocumentation, isEditing, language]);

  useEffect(() => {
    const querySessionId =
      typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("sessionId") ?? "";
    const activeSessionId = querySessionId || getActiveSessionId();
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);

    let isMounted = true;

    const loadSummary = async () => {
      const apiSummary = await medexaApi.patientSummary(activeSessionId);

      if (isMounted && apiSummary && !hasGeneratedDocumentation) {
        setSummaryNote(apiSummary.summary);
        setDraftNote(apiSummary.summary);
      }
    };

    loadSummary();

    return () => {
      isMounted = false;
    };
  }, [hasGeneratedDocumentation]);

  const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";

  useEffect(() => {
    if (!hasGeneratedDocumentation || isEditing) {
      return;
    }

    setSummaryNote(
      `${soapData.subjective.chiefComplaint} ${soapData.objective.observationNotes} ${soapData.assessment.diagnosisSummary} ${soapData.plan.followUpPlan}`,
    );
  }, [hasGeneratedDocumentation, isEditing, soapData]);

  const startEditing = () => {
    setDraftNote(summaryNote);
    setIsEditing(true);
    setShowSendConfirm(false);
    setActionStatus("");
  };

  const saveSummary = async () => {
    const nextSummary = draftNote.trim() || summaryNote;
    const apiSummary = await medexaApi.updatePatientSummary(sessionId, nextSummary);
    setSummaryNote(apiSummary?.summary ?? nextSummary);
    setIsEditing(false);
    setActionStatus(t("summary.updated"));
  };

  const cancelEditing = () => {
    setDraftNote(summaryNote);
    setIsEditing(false);
  };

  const requestSend = () => {
    setShowSendConfirm(true);
    setIsEditing(false);
    setActionStatus("");
  };

  const confirmSend = async () => {
    await medexaApi.sendPatientSummary(sessionId);
    setShowSendConfirm(false);
    setActionStatus(t("summary.sent"));
  };

  const summaryMatches = useMemo(() => {
    const query = headerSearch.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [
      summaryNote,
      "Therapeutic Therapy Session",
      t("session.medexaSummarized"),
      "July 05, 12:00 PM",
      "Patient ID #99283",
      "Duration 52:22",
      "Units 3",
      "Samuel Thompson",
      "Dr. Sarah Miller",
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  }, [headerSearch, summaryNote, t]);

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="summary-content">
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
              {t("common.duration")}: <strong dir="ltr">{translateDynamicMessage("52:22", language)}</strong>
            </p>
            <p>
              {t("session.units")}: <strong dir="ltr">{formatNumber(3, language)}</strong>
            </p>
          </div>
        </section>

        <nav className="tabs" aria-label="Session views">
          <Link href={`/soap-notes${sessionQuery}`}>{t("nav.soapNotes")}</Link>
          <Link href={`/billing-intelligence${sessionQuery}`}>{t("nav.billingIntelligence")}</Link>
          <Link href={`/patient-summary${sessionQuery}`} className="tab-active">
            {t("nav.patientSummary")}
          </Link>
          <Link href={`/claim-document${sessionQuery}`} className="claim-link">
            ✓ {t("nav.createClaimDocument")}
          </Link>
        </nav>

        <section className="summary-card">
          <div className="summary-card-header">
            <h2>{t("summary.sessionSummaryNote")}</h2>
            <div className="summary-actions">
              {!isEditing && (
                <button type="button" onClick={startEditing}>
                  ✎ {t("common.edit")}
                </button>
              )}
              <button type="button" onClick={requestSend}>
                ✈ {t("summary.sendToPatient")}
              </button>
            </div>
          </div>

          {actionStatus && <div className="action-status">{actionStatus}</div>}

          {showSendConfirm && (
            <div className="send-confirm">
              <span>{t("summary.sendQuestion")}</span>
              <div>
                <button type="button" onClick={confirmSend}>
                  {t("summary.confirmSend")}
                </button>
                <button type="button" onClick={() => setShowSendConfirm(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {summaryMatches ? (
            isEditing ? (
              <div className="summary-editor">
                <textarea
                  aria-label="Edit session summary note"
                  value={draftNote}
                  onChange={(event) => setDraftNote(event.target.value)}
                />
                <div className="editor-actions">
                  <button type="button" onClick={cancelEditing}>
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={saveSummary}>
                    {t("common.save")}
                  </button>
                </div>
              </div>
            ) : (
              <p>{displaySummary}</p>
            )
          ) : (
            <div className="empty-state">{t("summary.noMatch")}</div>
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

        .summary-content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
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

        .summary-card {
          min-height: 600px;
          margin-top: 20px;
          border: 1px solid #dbe7ff;
          border-radius: 16px;
          background: #fff;
          padding: 24px 26px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        .summary-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 28px;
        }

        .summary-card h2 {
          margin: 0;
          color: #172033;
          font-size: 18px;
          font-weight: 600;
        }

        .summary-actions {
          display: flex;
          align-items: center;
          gap: 24px;
          flex: 0 0 auto;
        }

        .summary-actions button {
          border: 0;
          background: transparent;
          color: #344054;
          font-size: 13px;
          font-weight: 700;
        }

        .summary-actions button:last-child {
          color: #001eff;
          font-weight: 800;
        }

        .summary-card p {
          max-width: 1040px;
          margin: 0;
          color: #172033;
          font-size: 18px;
          line-height: 1.55;
        }

        .summary-editor {
          max-width: 1040px;
        }

        .summary-editor textarea {
          width: 100%;
          min-height: 260px;
          box-sizing: border-box;
          resize: vertical;
          border: 1px solid #dbe7ff;
          border-radius: 14px;
          background: #fff;
          color: #172033;
          font: inherit;
          font-size: 16px;
          line-height: 1.55;
          padding: 16px;
          outline: 0;
        }

        .summary-editor textarea:focus {
          border-color: #8da2ff;
          box-shadow: 0 0 0 3px rgba(0, 30, 255, 0.08);
        }

        .editor-actions,
        .send-confirm div {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }

        .editor-actions button,
        .send-confirm button {
          border: 0;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .editor-actions button:first-child,
        .send-confirm button:last-child {
          background: #f3f5f8;
          color: #667085;
        }

        .send-confirm,
        .action-status {
          max-width: 1040px;
          box-sizing: border-box;
          border-radius: 14px;
          margin-bottom: 18px;
          padding: 14px 16px;
          font-size: 13px;
        }

        .send-confirm {
          border: 1px solid #dbe7ff;
          background: #f8faff;
          color: #172033;
        }

        .send-confirm span {
          font-weight: 700;
        }

        .action-status {
          border: 1px solid #bdebd4;
          background: #fbfffd;
          color: #09875a;
          font-weight: 800;
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

          .summary-content {
            padding: 18px 16px 28px;
          }

          .title-row,
          .summary-card-header {
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

          .summary-card {
            min-height: 460px;
            padding: 20px;
          }

          .summary-card p {
            font-size: 15px;
          }

          .summary-actions,
          .editor-actions,
          .send-confirm div {
            flex-wrap: wrap;
            justify-content: flex-start;
          }
        }
      `}</style>
    </main>
  );
}
