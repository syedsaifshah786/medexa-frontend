"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { getActiveSessionId } from "@/lib/activeSession";
import { medexaApi } from "@/lib/api";
import { formatNumber, formatUnits, translateCptDisplayName, translateDynamicMessage } from "@/lib/translations";

type CptItem = {
  id: string;
  code: string;
  description: string;
  units: string;
  duration: string;
  modifier: string;
};

type DiagnosisItem = {
  id: string;
  code: string;
  description: string;
  type: "Primary" | "Secondary";
};

type SessionMeta = {
  patient: string;
  mrn: string;
  provider: string;
  session: string;
  payor: string;
};

const initialSessionItems: CptItem[] = [
  {
    id: "cpt-97110",
    code: "97110",
    description: "Therapeutic Ex.",
    units: "1",
    duration: "08:04",
    modifier: "",
  },
  {
    id: "cpt-97112",
    code: "97112",
    description: "Neuromusc. Ed.",
    units: "1",
    duration: "15:56",
    modifier: "MODIFIER 59",
  },
  {
    id: "cpt-97530",
    code: "97530",
    description: "Therapeutic Act.",
    units: "2",
    duration: "28:00",
    modifier: "",
  },
];

const initialDiagnosis: DiagnosisItem[] = [
  {
    id: "dx-e119",
    code: "E11.9",
    description: "Type 2 Diabetes Mellitus without complications",
    type: "Primary",
  },
  {
    id: "dx-m545",
    code: "M54.5",
    description: "Low Back Pain",
    type: "Secondary",
  },
  {
    id: "dx-r5383",
    code: "R53.83",
    description: "Other Fatigue (Chronic)",
    type: "Secondary",
  },
];

const initialMeta: SessionMeta = {
  patient: "Samuel T. (58/M)",
  mrn: "220486",
  provider: "Dr. Sarah Miller",
  session: "June 18, • 52 min",
  payor: "Medicare",
};

const emptyCptForm: CptItem = {
  id: "",
  code: "",
  description: "",
  units: "",
  duration: "",
  modifier: "",
};

const emptyDiagnosisForm: DiagnosisItem = {
  id: "",
  code: "",
  description: "",
  type: "Secondary",
};

export default function ClaimDocumentPage() {
  const [headerSearch, setHeaderSearch] = useState("");
  const [sessionItems, setSessionItems] = useState<CptItem[]>(initialSessionItems);
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>(initialDiagnosis);
  const [meta, setMeta] = useState<SessionMeta>(initialMeta);
  const [metaDraft, setMetaDraft] = useState<SessionMeta>(initialMeta);
  const [cptForm, setCptForm] = useState<CptItem>(emptyCptForm);
  const [diagnosisForm, setDiagnosisForm] = useState<DiagnosisItem>(emptyDiagnosisForm);
  const [showCptForm, setShowCptForm] = useState(false);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const { soapData, hasGeneratedDocumentation } = useSessionDocumentation();
  const { language, t } = useLanguage();
  const displayText = (value: string | null | undefined) => translateDynamicMessage(value ?? "", language);

  const query = headerSearch.trim().toLowerCase();

  useEffect(() => {
    const activeSessionId = getActiveSessionId();
    setSessionId(activeSessionId);

    let isMounted = true;

    const loadClaim = async () => {
      const claim = await medexaApi.claim(activeSessionId);

      if (!isMounted || !claim) {
        return;
      }

      setSessionItems(claim.cptItems);
      setDiagnoses(claim.diagnosisCodes);
      setMeta(claim.patientMeta);
      setMetaDraft(claim.patientMeta);
      setIsSubmitted(claim.claimStatus === "submitted");
    };

    loadClaim();

    return () => {
      isMounted = false;
    };
  }, []);

  const billableUnits = useMemo(() => {
    return sessionItems.reduce((total, item) => total + (Number.parseInt(item.units, 10) || 0), 0);
  }, [sessionItems]);

  useEffect(() => {
    if (!hasGeneratedDocumentation) {
      return;
    }

    setDiagnoses((items) => {
      const nextPrimary: DiagnosisItem = {
        id: "dx-generated-primary",
        code: soapData.assessment.primaryDiagnosisCode,
        description: soapData.assessment.diagnosisSummary,
        type: "Primary",
      };

      return [nextPrimary, ...items.filter((item) => item.id !== nextPrimary.id)];
    });
  }, [hasGeneratedDocumentation, soapData]);

  const filteredSessionItems = useMemo(() => {
    if (!query) {
      return sessionItems;
    }

    return sessionItems.filter((item) =>
      [item.code, item.description, item.units, item.duration, item.modifier]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [query, sessionItems]);

  const filteredDiagnosis = useMemo(() => {
    if (!query) {
      return diagnoses;
    }

    return diagnoses.filter((item) =>
      [item.code, item.description, item.type].join(" ").toLowerCase().includes(query),
    );
  }, [diagnoses, query]);

  const saveCpt = async () => {
    const nextItem = {
      ...cptForm,
      code: cptForm.code.trim(),
      description: cptForm.description.trim(),
      units: cptForm.units.trim(),
      duration: cptForm.duration.trim(),
      modifier: cptForm.modifier.trim(),
    };

    if (!nextItem.code || !nextItem.description || !nextItem.units || !nextItem.duration) {
      setStatusMessage(t("claim.cptValidation"));
      return;
    }

    const savedItem = await medexaApi.addClaimCpt(sessionId, nextItem);
    setSessionItems((items) => [...items, savedItem ?? { ...nextItem, id: `cpt-${Date.now()}` }]);
    setCptForm(emptyCptForm);
    setShowCptForm(false);
    setStatusMessage(t("billing.addCpt"));
  };

  const saveDiagnosis = async () => {
    const nextDiagnosis = {
      ...diagnosisForm,
      code: diagnosisForm.code.trim(),
      description: diagnosisForm.description.trim(),
    };

    if (!nextDiagnosis.code || !nextDiagnosis.description) {
      setStatusMessage(`${t("claim.addDiagnosis")}: ${t("billing.cptCode")}, ${t("billing.description")}.`);
      return;
    }

    const savedDiagnosis = await medexaApi.addClaimDiagnosis(sessionId, nextDiagnosis);
    setDiagnoses((items) => [...items, savedDiagnosis ?? { ...nextDiagnosis, id: `dx-${Date.now()}` }]);
    setDiagnosisForm(emptyDiagnosisForm);
    setShowDiagnosisForm(false);
    setStatusMessage(t("claim.addDiagnosis"));
  };

  const exportClaim = (format: "PDF" | "CSV") => {
    setShowExportMenu(false);
    setStatusMessage(t("claim.exported", { format }));
  };

  const submitClaim = async () => {
    await medexaApi.submitClaim(sessionId);
    setIsSubmitted(true);
    setStatusMessage(t("claim.submitted"));
  };

  const saveDraft = async () => {
    await medexaApi.saveClaimDraft(sessionId);
    setStatusMessage(t("claim.draftSaved"));
  };

  const startMetaEdit = () => {
    setMetaDraft(meta);
    setIsEditingMeta(true);
    setStatusMessage("");
  };

  const saveMeta = async () => {
    const updatedClaim = await medexaApi.updateClaimSessionData(sessionId, metaDraft);
    if (updatedClaim) {
      setMeta(updatedClaim.patientMeta);
      setMetaDraft(updatedClaim.patientMeta);
    } else {
      setMeta(metaDraft);
    }
    setIsEditingMeta(false);
    setStatusMessage(t("claim.sessionDataUpdated"));
  };

  const verifyClaim = async () => {
    const missing: string[] = [];

    if (sessionItems.length === 0) {
      missing.push("at least one CPT item");
    }

    if (diagnoses.length === 0) {
      missing.push("at least one diagnosis");
    }

    if (!meta.patient.trim()) {
      missing.push("patient info");
    }

    if (!meta.provider.trim()) {
      missing.push("ordering provider");
    }

    if (missing.length > 0) {
      setStatusMessage(t("common.missing", { items: missing.join(", ") }));
      return;
    }

    await medexaApi.verifyClaim(sessionId);
    setStatusMessage(t("claim.verified"));
  };

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="claim-content">
        <section className="claim-top">
          <div className="claim-title-row">
            <div className="title-group">
              <Link href="/patient-summary" className="back-link" aria-label="Back to Patient Summary">
                ‹
              </Link>
              <h1>{t("claim.title")}</h1>
            </div>

            <div className="top-actions">
              <div className="export-wrap">
                <button type="button" onClick={() => setShowExportMenu((value) => !value)}>
                  {t("claim.export")}⌄
                </button>
                {showExportMenu && (
                  <div className="export-menu">
                    <button type="button" onClick={() => exportClaim("PDF")}>
                      PDF
                    </button>
                    <button type="button" onClick={() => exportClaim("CSV")}>
                      CSV
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="submit-button"
                disabled={isSubmitted}
                onClick={submitClaim}
              >
                ▷ {isSubmitted ? t("claim.claimSubmitted") : t("claim.submitClaim")}
              </button>
            </div>
          </div>

          <div className="meta-row">
            <div>
              <span>{t("claim.patient")}</span>
              <strong>{meta.patient}</strong>
            </div>
            <div>
              <span>{t("session.mrnNumber")}</span>
              <strong>{meta.mrn}</strong>
            </div>
            <div>
              <span>{t("claim.orderingProvider")}</span>
              <strong>{meta.provider}</strong>
            </div>
            <div>
              <span>{t("claim.sessionMeta")}</span>
              <strong>{displayText(meta.session)}</strong>
            </div>
            <div>
              <span>{t("session.payorSource")}</span>
              <strong className="payor">{meta.payor}</strong>
            </div>
          </div>

          {isEditingMeta && (
            <div className="meta-editor">
              {(["patient", "mrn", "provider", "session", "payor"] as const).map((field) => (
                <label key={field}>
                  {field === "mrn" ? "MRN Number" : field}
                  <input
                    value={metaDraft[field]}
                    onChange={(event) =>
                      setMetaDraft((draft) => ({ ...draft, [field]: event.target.value }))
                    }
                  />
                </label>
              ))}
              <div className="form-actions">
                <button type="button" onClick={() => setIsEditingMeta(false)}>
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={saveMeta}>
                  {t("claim.saveSessionData")}
                </button>
              </div>
            </div>
          )}

          {statusMessage && <div className="status-message">{statusMessage}</div>}
        </section>

        <section className="content-section">
          <div className="section-heading">
            <h2>
              {t("claim.sessionListItems")} <span>{formatNumber(billableUnits, language)} {t("claim.billableUnits")}</span>
            </h2>
            <button type="button" onClick={() => setShowCptForm(true)}>
              + {t("billing.addMoreCpts")}
            </button>
          </div>

          {showCptForm && (
            <div className="inline-form">
              <div className="form-grid">
                <label>
                  {t("billing.cptCode")}
                  <input
                    value={cptForm.code}
                    onChange={(event) => setCptForm((form) => ({ ...form, code: event.target.value }))}
                  />
                </label>
                <label>
                  {t("billing.description")}
                  <input
                    value={cptForm.description}
                    onChange={(event) =>
                      setCptForm((form) => ({ ...form, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("session.units")}
                  <input
                    value={cptForm.units}
                    onChange={(event) => setCptForm((form) => ({ ...form, units: event.target.value }))}
                  />
                </label>
                <label>
                  {t("common.duration")}
                  <input
                    value={cptForm.duration}
                    onChange={(event) =>
                      setCptForm((form) => ({ ...form, duration: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("claim.type")}
                  <input
                    value={cptForm.modifier}
                    placeholder="--"
                    onChange={(event) =>
                      setCptForm((form) => ({ ...form, modifier: event.target.value }))
                    }
                  />
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowCptForm(false)}>
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={saveCpt}>
                  {t("billing.saveCpt")}
                </button>
              </div>
            </div>
          )}

          <div className="session-table">
            <div className="table-head">
              <span>{t("billing.cptCode")}</span>
              <span>{t("billing.description")}</span>
              <span>{t("session.units")}</span>
              <span>{t("common.duration")}</span>
              <span>{t("claim.modifier")}</span>
            </div>
            {filteredSessionItems.map((item) => (
              <div className="table-row" key={item.id}>
                <span>
                  <strong>{item.code}</strong>
                </span>
                <span>{translateCptDisplayName(item.code, item.description, language)}</span>
                <span>{formatUnits(Number.parseInt(item.units, 10) || 0, language)}</span>
                <span>{displayText(item.duration)}</span>
                <span>
                  {item.modifier ? <em>{displayText(item.modifier)}</em> : <small>--</small>}
                </span>
              </div>
            ))}
            {filteredSessionItems.length === 0 && (
              <div className="empty-state">{t("claim.noSessionItems")}</div>
            )}
          </div>
        </section>

        <section className="content-section diagnosis-section">
          <div className="section-heading">
            <h2>{t("claim.icd10DiagnosisCodes")}</h2>
            <button type="button" onClick={() => setShowDiagnosisForm(true)}>
              + {t("claim.addDiagnosis")}
            </button>
          </div>

          {showDiagnosisForm && (
            <div className="inline-form">
              <div className="form-grid diagnosis-form-grid">
                <label>
                  ICD code
                  <input
                    value={diagnosisForm.code}
                    onChange={(event) =>
                      setDiagnosisForm((form) => ({ ...form, code: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("billing.description")}
                  <input
                    value={diagnosisForm.description}
                    onChange={(event) =>
                      setDiagnosisForm((form) => ({ ...form, description: event.target.value }))
                    }
                  />
                </label>
                <label>
                  {t("claim.modifier")}
                  <select
                    value={diagnosisForm.type}
                    onChange={(event) =>
                      setDiagnosisForm((form) => ({
                        ...form,
                        type: event.target.value as DiagnosisItem["type"],
                      }))
                    }
                  >
                    <option value="Primary">{t("common.primary")}</option>
                    <option value="Secondary">{t("common.secondary")}</option>
                  </select>
                </label>
              </div>
              <div className="form-actions">
                <button type="button" onClick={() => setShowDiagnosisForm(false)}>
                  {t("common.cancel")}
                </button>
                <button type="button" onClick={saveDiagnosis}>
                  {t("common.save")}
                </button>
              </div>
            </div>
          )}

          <div className="diagnosis-list">
            {filteredDiagnosis.map((item) => (
              <article className="diagnosis-card" key={item.id}>
                <div>
                  <span>{item.code}</span>
                  <p>{displayText(item.description)}</p>
                </div>
                <em>{item.type === "Primary" ? t("common.primary") : t("common.secondary")}</em>
              </article>
            ))}
            {filteredDiagnosis.length === 0 && (
              <div className="empty-state">{t("claim.noDiagnosis")}</div>
            )}
          </div>
        </section>

      </section>

      <div className="bottom-bar" aria-label="Claim document actions">
          <button type="button" className="bar-action" onClick={saveDraft}>
            <span className="bar-icon save-icon" aria-hidden="true">
              ▣
            </span>
            <span>{t("claim.saveAsDraft")}</span>
          </button>
          <button type="button" className="bar-action" onClick={startMetaEdit}>
            <span className="bar-icon edit-icon" aria-hidden="true">
              ✎
            </span>
            <span>{t("claim.editSessionData")}</span>
          </button>
          <span className="bar-divider" aria-hidden="true" />
          <button type="button" className="verify-button" onClick={verifyClaim}>
            <span className="verify-icon" aria-hidden="true">
              →
            </span>
            <span>{t("claim.verifyClaimDocument")}</span>
            <span className="info-icon" aria-hidden="true">
              i
            </span>
          </button>
      </div>

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
          cursor: pointer;
          font-family: inherit;
        }

        button:disabled {
          cursor: default;
          opacity: 0.58;
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

        .claim-content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          padding: 22px 32px 150px;
          background: #fbfbfc;
        }

        .claim-top {
          border-bottom: 1px solid #edf1f6;
          padding-bottom: 22px;
        }

        .claim-title-row,
        .title-group,
        .top-actions,
        .section-heading {
          display: flex;
          align-items: center;
        }

        .claim-title-row,
        .section-heading {
          justify-content: space-between;
          gap: 18px;
        }

        .title-group {
          gap: 12px;
        }

        .back-link {
          width: 24px;
          color: #172033;
          font-size: 28px;
          line-height: 1;
          text-decoration: none;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        .title-group h1 {
          color: #172033;
          font-size: 25px;
          font-weight: 600;
          line-height: 1.2;
        }

        .top-actions {
          gap: 22px;
          color: #172033;
          font-size: 13px;
          font-weight: 700;
        }

        .top-actions button {
          border: 0;
          background: transparent;
          color: inherit;
          font-size: inherit;
          font-weight: inherit;
        }

        .submit-button {
          color: #001eff !important;
          font-weight: 800 !important;
        }

        .export-wrap {
          position: relative;
        }

        .export-menu {
          position: absolute;
          right: 0;
          top: 28px;
          z-index: 10;
          min-width: 116px;
          border: 1px solid #dbe7ff;
          border-radius: 12px;
          background: #fff;
          box-shadow: 0 12px 26px rgba(15, 23, 42, 0.12);
          padding: 6px;
        }

        .export-menu button {
          width: 100%;
          border-radius: 8px;
          padding: 9px 10px;
          text-align: left;
        }

        .export-menu button:hover {
          background: #f4f7ff;
        }

        .meta-row {
          display: grid;
          grid-template-columns: repeat(5, minmax(120px, 1fr));
          gap: 28px;
          margin-top: 24px;
        }

        .meta-row span,
        .form-grid label {
          color: #7a879b;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .meta-row strong {
          display: block;
          margin-top: 6px;
          color: #172033;
          font-size: 13px;
          font-weight: 800;
        }

        .meta-row .payor {
          color: #001eff;
        }

        .status-message {
          margin-top: 18px;
          max-width: 760px;
          border: 1px solid #bdebd4;
          border-radius: 14px;
          background: #fbfffd;
          color: #09875a;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .content-section {
          margin-top: 24px;
        }

        .section-heading {
          margin-bottom: 14px;
        }

        .section-heading h2 {
          color: #172033;
          font-size: 18px;
          font-weight: 600;
        }

        .section-heading h2 span {
          margin-left: 6px;
          color: #98a2b3;
          font-size: 12px;
          font-weight: 700;
        }

        .section-heading button {
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 13px;
          font-weight: 800;
        }

        .session-table {
          overflow: hidden;
          border: 1px solid #edf1f6;
          border-radius: 16px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        .table-head,
        .table-row {
          display: grid;
          grid-template-columns: 0.9fr 1.8fr 1fr 1fr 1fr;
          align-items: center;
          gap: 16px;
          padding: 16px 26px;
        }

        .table-head {
          color: #7a879b;
          font-size: 12px;
          font-weight: 700;
        }

        .table-row {
          border-top: 1px solid #edf1f6;
          color: #172033;
          font-size: 13px;
          font-weight: 700;
        }

        .table-row strong,
        .diagnosis-card span {
          display: inline-flex;
          border-radius: 6px;
          background: #f2f4f7;
          color: #536071;
          padding: 5px 9px;
          font-size: 11px;
          font-weight: 800;
        }

        .table-row em {
          display: inline-flex;
          border-radius: 999px;
          background: #f2f4f7;
          color: #172033;
          padding: 5px 8px;
          font-size: 10px;
          font-style: normal;
          font-weight: 800;
        }

        .table-row small {
          color: #98a2b3;
          font-size: 13px;
        }

        .diagnosis-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .diagnosis-card {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 18px;
          border: 1px solid #dbe7ff;
          border-radius: 16px;
          background: #fff;
          padding: 16px 18px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .diagnosis-card p {
          margin-top: 12px;
          color: #172033;
          font-size: 13px;
          font-weight: 700;
        }

        .diagnosis-card em {
          border: 1px solid #cfd6e3;
          border-radius: 999px;
          color: #536071;
          padding: 5px 9px;
          font-size: 11px;
          font-style: normal;
          font-weight: 700;
        }

        .inline-form,
        .meta-editor {
          border: 1px solid #dbe7ff;
          border-radius: 16px;
          background: #fff;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
        }

        .meta-editor {
          margin-top: 18px;
        }

        .form-grid,
        .meta-editor {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 12px;
        }

        .diagnosis-form-grid {
          grid-template-columns: 0.8fr 1.8fr 0.8fr;
        }

        .form-grid label,
        .meta-editor label {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-grid input,
        .form-grid select,
        .meta-editor input {
          width: 100%;
          height: 36px;
          box-sizing: border-box;
          border: 1px solid #d9e1ec;
          border-radius: 8px;
          background: #fff;
          color: #172033;
          font: inherit;
          padding: 0 10px;
          outline: 0;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          grid-column: 1 / -1;
          margin-top: 4px;
        }

        .form-actions button {
          border: 0;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .form-actions button:first-child {
          background: #f3f5f8;
          color: #667085;
        }

        .empty-state {
          border-top: 1px solid #edf1f6;
          color: #667085;
          padding: 24px;
          text-align: center;
          font-size: 13px;
        }

        .diagnosis-list .empty-state {
          border: 1px dashed #d8deea;
          border-radius: 14px;
          background: #fff;
        }

        .bottom-bar {
          position: fixed;
          left: 50%;
          bottom: 24px;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 14px;
          transform: translateX(-50%);
          max-width: calc(100vw - 32px);
          box-sizing: border-box;
          border-radius: 999px;
          background: #fff;
          padding: 10px 12px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.2);
        }

        .bottom-bar button {
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .bar-action,
        .verify-button {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 0 10px;
        }

        .bar-icon {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #eef2ff;
          color: #001eff;
          font-size: 12px;
          line-height: 1;
        }

        .bar-divider {
          width: 1px;
          height: 30px;
          background: #e4e9f2;
          margin: 0 2px;
        }

        .bottom-bar .verify-button {
          gap: 9px;
          border-radius: 999px;
          background: transparent;
          color: #fff;
          padding: 0 4px 0 0;
        }

        .verify-icon {
          width: 38px;
          height: 38px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #001eff;
          color: #fff;
          font-size: 15px;
        }

        .verify-button span:nth-child(2) {
          color: #001eff;
        }

        .info-icon {
          width: 16px;
          height: 16px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #9fb4ff;
          border-radius: 50%;
          color: #001eff;
          font-size: 10px;
          font-weight: 800;
        }

        @media (max-width: 900px) {
          .meta-row,
          .form-grid,
          .meta-editor,
          .diagnosis-form-grid {
            grid-template-columns: 1fr 1fr;
          }

          .table-head,
          .table-row {
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .table-head {
            display: none;
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

          .claim-content {
            padding: 18px 16px 170px;
          }

          .claim-title-row,
          .section-heading,
          .diagnosis-card {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-actions {
            width: 100%;
            justify-content: space-between;
          }

          .meta-row,
          .form-grid,
          .meta-editor,
          .diagnosis-form-grid {
            grid-template-columns: 1fr;
          }

          .bottom-bar {
            width: calc(100% - 32px);
            box-sizing: border-box;
            justify-content: center;
            gap: 12px;
            flex-wrap: wrap;
            border-radius: 22px;
            bottom: 16px;
          }

          .table-row,
          .diagnosis-card,
          .bottom-bar button {
            overflow-wrap: anywhere;
          }

          .bar-divider {
            display: none;
          }
        }
      `}</style>
    </main>
  );
}


