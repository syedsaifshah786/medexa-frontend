"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { getActiveSessionId, setActiveSessionId } from "@/lib/activeSession";
import { medexaApi } from "@/lib/api";
import { formatDateTime, formatNumber, translateCptDisplayName, translateDynamicMessage } from "@/lib/translations";

type CptStatus = "pending" | "approved" | "rejected";

type CptItem = {
  id: string;
  code: string;
  title: string;
  units: string;
  duration: string;
  warning: string;
  note?: string;
  status: CptStatus;
};

type CptForm = {
  code: string;
  title: string;
  units: string;
  duration: string;
};

const emptyCptForm: CptForm = {
  code: "",
  title: "",
  units: "",
  duration: "",
};

const initialCptCodes: CptItem[] = [
  {
    id: "cpt-97110",
    code: "97110",
    title: "Therapeutic Ex.",
    units: "1",
    duration: "08:04",
    warning: "",
    status: "pending",
  },
  {
    id: "cpt-97112",
    code: "97112",
    title: "Neuromusc. Ed.",
    units: "1",
    duration: "15:56",
    warning: "Modifier 59 Required",
    note: "Potential Bundle conflict detected with 97110. Apply modifier?",
    status: "pending",
  },
  {
    id: "cpt-97530",
    code: "97530",
    title: "Therapeutic Act.",
    units: "2",
    duration: "28:22",
    warning: "",
    status: "pending",
  },
];

export default function BillingIntelligencePage() {
  const [headerSearch, setHeaderSearch] = useState("");
  const [cptItems, setCptItems] = useState<CptItem[]>(initialCptCodes);
  const [sessionDuration, setSessionDuration] = useState("52:22");
  const [sessionUnits, setSessionUnits] = useState("4");
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CptForm>(emptyCptForm);
  const { language, t } = useLanguage();
  const displayText = (value: string | null | undefined) => translateDynamicMessage(value ?? "", language);

  useEffect(() => {
    const querySessionId =
      typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("sessionId") ?? "";
    const activeSessionId = querySessionId || getActiveSessionId();
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);

    let isMounted = true;

    const loadBilling = async () => {
      const billing = await medexaApi.billing(activeSessionId);

      if (!isMounted || !billing) {
        return;
      }

      setSessionDuration(billing.sessionTime);
      setSessionUnits(billing.units);
      setCptItems(billing.cptCodes);
    };

    loadBilling();

    return () => {
      isMounted = false;
    };
  }, []);

  const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";

  const filteredCptCodes = useMemo(() => {
    const query = headerSearch.trim().toLowerCase();

    if (!query) {
      return cptItems;
    }

    return cptItems.filter((item) => {
      return [item.code, item.title, item.units, item.duration, item.warning, item.note ?? "", item.status]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [cptItems, headerSearch]);

  const openAddForm = () => {
    setEditingId(null);
    setFormValues(emptyCptForm);
    setIsFormOpen(true);
  };

  const openEditForm = (item: CptItem) => {
    setEditingId(item.id);
    setFormValues({
      code: item.code,
      title: item.title,
      units: item.units,
      duration: item.duration,
    });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setFormValues(emptyCptForm);
    setIsFormOpen(false);
  };

  const saveCptItem = async () => {
    const nextValues = {
      code: formValues.code.trim(),
      title: formValues.title.trim(),
      units: formValues.units.trim(),
      duration: formValues.duration.trim(),
    };

    if (!nextValues.code || !nextValues.title || !nextValues.units || !nextValues.duration) {
      return;
    }

    if (editingId) {
      const savedItem = await medexaApi.editBillingCpt(sessionId, editingId, nextValues);
      setCptItems((items) =>
        items.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...(savedItem ?? nextValues),
              }
            : item,
        ),
      );
    } else {
      const savedItem = await medexaApi.addBillingCpt(sessionId, nextValues);
      setCptItems((items) => [
        ...items,
        savedItem ?? {
            id: `cpt-${Date.now()}`,
            ...nextValues,
            warning: "",
            status: "pending",
          },
      ]);
    }

    closeForm();
  };

  const updateCptStatus = async (id: string, status: CptStatus) => {
    const savedItem =
      status === "approved"
        ? await medexaApi.approveBillingCpt(sessionId, id)
        : await medexaApi.rejectBillingCpt(sessionId, id);

    setCptItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...(savedItem ?? { status }) } : item)),
    );
  };

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="billing-content">
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
              {t("common.duration")}: <strong dir="ltr">{displayText("52:22")}</strong>
            </p>
            <p>
              {t("session.units")}: <strong dir="ltr">{formatNumber(4, language)}</strong>
            </p>
          </div>
        </section>

        <nav className="tabs" aria-label="Session views">
          <Link href={`/soap-notes${sessionQuery}`}>{t("nav.soapNotes")}</Link>
          <Link href={`/billing-intelligence${sessionQuery}`} className="tab-active">
            {t("nav.billingIntelligence")}
          </Link>
          <Link href={`/patient-summary${sessionQuery}`}>{t("nav.patientSummary")}</Link>
          <Link href={`/claim-document${sessionQuery}`} className="claim-link">
            ✓ {t("nav.createClaimDocument")}
          </Link>
        </nav>

        <section className="billing-stack">
          <section>
            <h2 className="section-title">{t("nav.billingIntelligence")}</h2>
            <div className="metric-grid">
              <article className="metric-card">
                <p>{t("billing.sessionTime")}</p>
                <strong dir="ltr">{displayText(sessionDuration)}</strong>
                <span>{t("billing.threshold")}</span>
              </article>
              <article className="metric-card">
                <div className="metric-heading">
                  <p>{t("billing.sessionUnits")}</p>
                  <span>ⓘ</span>
                </div>
                <strong dir="ltr">{formatNumber(sessionUnits, language)} {t("session.units")}</strong>
                <em>{t("billing.eightMinuteRule")}</em>
              </article>
            </div>
          </section>

          <section>
            <div className="section-heading">
              <h2>{t("billing.cptCodesDetected")}</h2>
              <button type="button" onClick={openAddForm}>+ {t("billing.addMoreCpts")}</button>
            </div>

            {isFormOpen && (
              <div className="cpt-form" aria-label={editingId ? t("billing.editCpt") : t("billing.addCpt")}>
                <div className="cpt-form-heading">
                  <h3>{editingId ? t("billing.editCpt") : t("billing.addCpt")}</h3>
                  <button type="button" onClick={closeForm}>×</button>
                </div>
                <div className="cpt-form-grid">
                  <label>
                    {t("billing.cptCode")}
                    <input
                      value={formValues.code}
                      onChange={(event) =>
                        setFormValues((values) => ({ ...values, code: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    {t("billing.description")}
                    <input
                      value={formValues.title}
                      onChange={(event) =>
                        setFormValues((values) => ({ ...values, title: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    {t("session.units")}
                    <input
                      value={formValues.units}
                      onChange={(event) =>
                        setFormValues((values) => ({ ...values, units: event.target.value }))
                      }
                    />
                  </label>
                  <label>
                    {t("common.duration")}
                    <input
                      value={formValues.duration}
                      onChange={(event) =>
                        setFormValues((values) => ({ ...values, duration: event.target.value }))
                      }
                    />
                  </label>
                </div>
                <div className="cpt-form-actions">
                  <button type="button" onClick={closeForm}>{t("common.cancel")}</button>
                  <button type="button" onClick={saveCptItem}>
                    {editingId ? t("billing.saveChanges") : t("billing.saveCpt")}
                  </button>
                </div>
              </div>
            )}

            <div className="cpt-list">
              {filteredCptCodes.map((item) => (
                <article className={`cpt-card status-${item.status}`} key={item.id}>
                  <div className="cpt-topline">
                    <div>
                      <h3>
                        {item.code} - {translateCptDisplayName(item.code, item.title, language)}
                      </h3>
                      <p>
                        {t("billing.unitDuration", { units: formatNumber(item.units, language), duration: displayText(item.duration) })}
                      </p>
                    </div>

                    <div className="cpt-actions">
                      {item.status !== "pending" && (
                        <span className={`status-badge ${item.status}`}>
                          {item.status === "approved" ? t("common.approved") : t("common.rejected")}
                        </span>
                      )}
                      {item.warning && (
                        <span className="modifier-badge">
                          {item.warning === "Modifier 59 Required" ? t("modifier.required") : displayText(item.warning)}
                        </span>
                      )}
                      <button
                        className="edit-button"
                        type="button"
                        aria-label={`${t("common.edit")} ${item.code}`}
                        onClick={() => openEditForm(item)}
                      >
                        ✎
                      </button>
                    </div>
                  </div>

                  {item.note && (
                    <>
                      <p className="conflict-note">{displayText(item.note)}</p>
                      <div className="review-actions">
                        <button type="button" onClick={() => updateCptStatus(item.id, "rejected")}>
                          × {t("common.reject")}
                        </button>
                        <button type="button" onClick={() => updateCptStatus(item.id, "approved")}>
                          ✓ {t("common.approve")}
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}

              {filteredCptCodes.length === 0 && (
                <div className="empty-state">{t("billing.noCpt")}</div>
              )}
            </div>
          </section>

          <section className="snf-section">
            <h2>{t("billing.snfFunctionalLogic")}</h2>
            <p>{t("billing.sectionGg")}</p>
            <strong>{t("billing.partial")}</strong>

            <div className="range-wrap">
              <div className="range-track">
                <span className="range-fill" />
                <span className="range-marker" />
              </div>
              <div className="range-ticks">
                <span>{formatNumber(1, language)}</span>
                <span>{formatNumber(2, language)}</span>
                <span>{formatNumber(3, language)}</span>
                <span>{formatNumber(4, language)}</span>
                <span>{formatNumber(5, language)}</span>
              </div>
            </div>
          </section>
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

        .billing-content {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          max-width: none;
          margin: 0;
          padding: 24px 32px 40px;
          background: #fbfbfc;
        }

        .session-summary {
          border-bottom: 1px solid #edf1f6;
          padding-bottom: 20px;
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
          align-items: center;
          column-gap: 32px;
          row-gap: 14px;
          max-width: none;
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
          gap: 34px;
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

        .billing-stack {
          width: 100%;
          max-width: none;
          display: flex;
          flex-direction: column;
          gap: 28px;
          padding-top: 24px;
        }

        .section-title,
        .section-heading h2,
        .snf-section h2 {
          margin: 0;
          color: #172033;
          font-size: 18px;
          font-weight: 700;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(280px, 1fr));
          gap: 20px;
          margin-top: 16px;
        }

        .metric-card {
          border: 1px solid #bcd0ff;
          border-radius: 8px;
          background: #fff;
          padding: 20px 22px;
        }

        .metric-card p {
          margin: 0;
          color: #667085;
          font-size: 12px;
        }

        .metric-card strong {
          display: block;
          margin-top: 10px;
          color: #172033;
          font-size: 26px;
          line-height: 1.1;
        }

        .metric-card span {
          display: block;
          margin-top: 8px;
          color: #667085;
          font-size: 11px;
        }

        .metric-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .metric-card em {
          display: inline-flex;
          margin-top: 8px;
          border-radius: 6px;
          background: #d8f7e8;
          color: #09875a;
          padding: 5px 8px;
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
        }

        .section-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 16px;
        }

        .section-heading button {
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 12px;
          font-weight: 800;
        }

        .cpt-form {
          border: 1px solid #dbe7ff;
          border-radius: 8px;
          background: #fff;
          padding: 18px;
          margin-bottom: 16px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        }

        .cpt-form-heading {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .cpt-form-heading h3 {
          margin: 0;
          color: #172033;
          font-size: 14px;
          font-weight: 800;
        }

        .cpt-form-heading button {
          border: 0;
          background: transparent;
          color: #667085;
          font-size: 18px;
          line-height: 1;
        }

        .cpt-form-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(160px, 1fr));
          gap: 14px;
        }

        .cpt-form-grid label {
          display: flex;
          flex-direction: column;
          gap: 6px;
          color: #536071;
          font-size: 11px;
          font-weight: 800;
        }

        .cpt-form-grid input {
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

        .cpt-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 14px;
        }

        .cpt-form-actions button {
          border: 0;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 8px 14px;
          font-size: 12px;
          font-weight: 800;
        }

        .cpt-form-actions button:first-child {
          background: #f3f5f8;
          color: #667085;
        }

        .cpt-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
          width: 100%;
          overflow: visible;
        }

        .cpt-card {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #dbe7ff;
          border-radius: 8px;
          background: #fff;
          padding: 20px 22px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
        }

        .cpt-card.status-approved {
          border-color: #bdebd4;
          background: #fbfffd;
        }

        .cpt-card.status-rejected {
          border-color: #f6c7c3;
          background: #fffafa;
          opacity: 0.86;
        }

        .cpt-topline {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
        }

        .cpt-topline > div:first-child {
          min-width: 0;
          flex: 1 1 auto;
        }

        .cpt-card h3 {
          margin: 0;
          color: #172033;
          font-size: 15px;
          font-weight: 800;
        }

        .cpt-card p {
          margin: 10px 0 0;
          color: #536071;
          font-size: 12px;
          line-height: 1.5;
        }

        .edit-button {
          border: 0;
          background: transparent;
          color: #001eff;
          font-size: 20px;
        }

        .cpt-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          flex: 0 0 auto;
          flex-wrap: wrap;
          margin-left: auto;
        }

        .modifier-badge {
          flex: 0 0 auto;
          border-radius: 999px;
          background: #0f172a;
          color: #fff;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
        }

        .status-badge {
          border-radius: 999px;
          padding: 5px 9px;
          font-size: 10px;
          font-weight: 800;
        }

        .status-badge.approved {
          background: #d8f7e8;
          color: #09875a;
        }

        .status-badge.rejected {
          background: #fee4e2;
          color: #b42318;
        }

        .conflict-note {
          color: #667085;
        }

        .review-actions {
          display: flex;
          justify-content: flex-end;
          gap: 28px;
          margin-top: 18px;
        }

        .review-actions button {
          border: 0;
          background: transparent;
          color: #667085;
          font-size: 12px;
          font-weight: 700;
        }

        .review-actions button:last-child {
          color: #001eff;
        }

        .snf-section {
          border: 1px solid #dbe7ff;
          border-radius: 8px;
          background: #fff;
          padding: 22px;
        }

        .snf-section p {
          margin: 18px 0 0;
          color: #344054;
          font-size: 14px;
        }

        .snf-section > strong {
          display: block;
          margin-top: 16px;
          color: #001eff;
          font-size: 16px;
        }

        .range-wrap {
          margin-top: 22px;
          width: 100%;
        }

        .range-track {
          position: relative;
          height: 9px;
          border-radius: 999px;
          background: #dbe7ff;
        }

        .range-fill {
          position: absolute;
          inset: 0 auto 0 0;
          width: 50%;
          border-radius: 999px;
          background: #5e6676;
        }

        .range-marker {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: #596170;
          transform: translate(-50%, -50%);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.18);
        }

        .range-ticks {
          display: flex;
          justify-content: space-between;
          margin-top: 16px;
          color: #344054;
          font-size: 12px;
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

          .billing-content {
            padding: 18px 16px 28px;
          }

          .title-row {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .meta-row,
          .metric-grid,
          .cpt-form-grid {
            grid-template-columns: 1fr;
          }

          .meta-row {
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

          .billing-stack {
            width: 100%;
          }

          .section-heading,
          .cpt-topline,
          .review-actions {
            align-items: flex-start;
            flex-direction: column;
          }

          .review-actions {
            gap: 12px;
          }
        }
      `}</style>
    </main>
  );
}
