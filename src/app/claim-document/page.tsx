"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { getActiveSessionId, setActiveSessionId } from "@/lib/activeSession";
import { get837PDraft, getClaimDocument, medexaApi, saveClaimDraft, verifyClaimDocument } from "@/lib/api";
import type {
  ApiClaimDocument,
  ApiCptRecord,
  ApiSoapNoteResponse,
  ApiTimerState,
  Claim837PDiagnosis,
  Claim837PDraft,
  Claim837PValidationResult,
} from "@/lib/api";
import { getSessionById } from "@/lib/sessions";
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

type StoredClaimDraft = {
  patientMeta?: SessionMeta;
  cptItems?: CptItem[];
  diagnosisCodes?: DiagnosisItem[];
  claim837P?: Claim837PDraft;
};

type StoredSoapNote = ApiSoapNoteResponse & {
  detected_icd10_suggestions?: Array<{
    code: string;
    phrase?: string;
    reason?: string;
  }>;
};

const diagnosisPointers = ["A", "B", "C", "D"] as const;
const reviewText = "Requires Review";

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
  patient: reviewText,
  mrn: reviewText,
  provider: reviewText,
  session: reviewText,
  payor: reviewText,
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

function safeLocalStorageRead<T>(key: string): T | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    return rawValue ? (JSON.parse(rawValue) as T) : null;
  } catch {
    return null;
  }
}

function durationFromSeconds(seconds: number | undefined) {
  const safeSeconds = Math.max(0, Math.floor(seconds ?? 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function cptRecordToItem(record: ApiCptRecord, index: number): CptItem {
  return {
    id: `cpt-${record.code}-${index}`,
    code: record.code,
    description: record.displayName || record.reason || `CPT ${record.code}`,
    units: String(record.units || 1),
    duration: durationFromSeconds(record.seconds),
    modifier: "",
  };
}

function uniqueCptItems(items: CptItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.code}-${item.duration}-${item.units}-${item.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueDiagnosis(items: DiagnosisItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.code.trim().toUpperCase();
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function claimMetaFromSession(sessionId: string, fallback: SessionMeta): SessionMeta {
  const session = getSessionById(sessionId);

  return {
    patient: `${session.name} (${session.ageSex})`,
    mrn: session.mrn,
    provider: fallback.provider,
    session: `${session.time} • ${session.careType}`,
    payor: session.payor,
  };
}

function claimDocumentToMeta(claimDocument: ApiClaimDocument): SessionMeta {
  return {
    patient: claimDocument.patient.display_name || claimDocument.patient.name || reviewText,
    mrn: claimDocument.patient.mrn || reviewText,
    provider: claimDocument.provider.ordering_provider || reviewText,
    session: claimDocument.session.display_meta || reviewText,
    payor: claimDocument.patient.payer || reviewText,
  };
}

function claimDocumentToCptItems(claimDocument: ApiClaimDocument): CptItem[] {
  return claimDocument.cpt_lines.map((line) => ({
    id: `cpt-${line.line_number}-${line.cpt_code}`,
    code: line.cpt_code,
    description: line.display_name || line.description || line.cpt_code,
    units: String(line.units ?? 0),
    duration: line.duration_display || durationFromSeconds(line.duration_seconds),
    modifier:
      line.modifier ||
      (line.validation_status === "needs_review" && claimDocument.validation.modifier_review_required
        ? "MODIFIER 59 REVIEW"
        : ""),
  }));
}

function claimDocumentToDiagnoses(claimDocument: ApiClaimDocument): DiagnosisItem[] {
  return claimDocument.diagnoses.map((diagnosis) => ({
    id: `dx-${diagnosis.pointer}-${diagnosis.code}`,
    code: diagnosis.code,
    description: diagnosis.review_required ? `${diagnosis.description} (${reviewText})` : diagnosis.description,
    type: diagnosis.priority === "primary" ? "Primary" : "Secondary",
  }));
}

export default function ClaimDocumentPage() {
  return (
    <Suspense fallback={null}>
      <ClaimDocumentContent />
    </Suspense>
  );
}

function ClaimDocumentContent() {
  const searchParams = useSearchParams();
  const [headerSearch, setHeaderSearch] = useState("");
  const [sessionItems, setSessionItems] = useState<CptItem[]>([]);
  const [diagnoses, setDiagnoses] = useState<DiagnosisItem[]>([]);
  const [meta, setMeta] = useState<SessionMeta>(initialMeta);
  const [metaDraft, setMetaDraft] = useState<SessionMeta>(initialMeta);
  const [cptForm, setCptForm] = useState<CptItem>(emptyCptForm);
  const [diagnosisForm, setDiagnosisForm] = useState<DiagnosisItem>(emptyDiagnosisForm);
  const [showCptForm, setShowCptForm] = useState(false);
  const [showDiagnosisForm, setShowDiagnosisForm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isLoadingClaim, setIsLoadingClaim] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [storedSoap, setStoredSoap] = useState<StoredSoapNote | null>(null);
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const { soapData, hasGeneratedDocumentation } = useSessionDocumentation();
  const { language, t } = useLanguage();
  const displayText = (value: string | null | undefined) => translateDynamicMessage(value ?? "", language);

  const routeSessionId = searchParams.get("sessionId") || "samuel-thompson";
  const sessionQuery = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  const query = headerSearch.trim().toLowerCase();

  useEffect(() => {
    const activeSessionId = routeSessionId || getActiveSessionId() || "samuel-thompson";
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);

    let isMounted = true;
    setIsLoadingClaim(true);
    setStatusMessage(t("claim.loading"));

    const loadClaim = async () => {
      let claimDocument: ApiClaimDocument | null = null;
      try {
        claimDocument = await getClaimDocument(activeSessionId, language);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[ClaimDocument] backend fetch failed, using local fallback.", error);
        }
      }

      if (!isMounted) {
        return;
      }

      if (claimDocument) {
        const nextMeta = claimDocumentToMeta(claimDocument);
        setSessionItems(claimDocumentToCptItems(claimDocument));
        setDiagnoses(claimDocumentToDiagnoses(claimDocument));
        setMeta(nextMeta);
        setMetaDraft(nextMeta);
        setStatusMessage(claimDocument.claim_status === "needs_review" ? t("claim.requiresReview") : "");
        setIsLoadingClaim(false);
        return;
      }

      const localDraft = safeLocalStorageRead<StoredClaimDraft>(`medexa_claim_draft_${activeSessionId}`);
      const localSoap = safeLocalStorageRead<StoredSoapNote>(`medexa_soap_note_${activeSessionId}`);
      const localCptRecords =
        safeLocalStorageRead<ApiCptRecord[]>(`medexa_cpt_records_${activeSessionId}`) ??
        Object.values(safeLocalStorageRead<Record<string, ApiCptRecord>>(`medexa_cpt_records_${activeSessionId}`) ?? {});
      const localTimerState = safeLocalStorageRead<ApiTimerState>(`medexa_session_state_${activeSessionId}`);
      const sessionMeta = claimMetaFromSession(activeSessionId, initialMeta);
      const localItems = uniqueCptItems([
        ...(localDraft?.cptItems ?? []),
        ...localCptRecords.map(cptRecordToItem),
        ...(localTimerState?.cpt_records ?? []).map(cptRecordToItem),
      ]);
      const localDiagnoses = uniqueDiagnosis([
        ...(localDraft?.diagnosisCodes ?? []),
        ...(localSoap?.detected_icd10_suggestions ?? []).map((item, index) => ({
          id: `dx-soap-${item.code}-${index}`,
          code: item.code,
          description: item.reason ?? item.phrase ?? item.code,
          type: index === 0 ? "Primary" : "Secondary",
        }) satisfies DiagnosisItem),
      ]);
      const nextMeta = localDraft?.patientMeta ?? (localItems.length || localDiagnoses.length ? sessionMeta : initialMeta);

      setMeta(nextMeta);
      setMetaDraft(nextMeta);
      setSessionItems(localItems);
      setDiagnoses(localDiagnoses);
      setStoredSoap(localSoap);
      setStatusMessage(localItems.length || localDiagnoses.length ? "" : t("claim.requiresReview"));
      setIsLoadingClaim(false);
    };

    loadClaim();

    return () => {
      isMounted = false;
    };
  }, [language, routeSessionId]);

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

  const validateClaimDocument = (): Claim837PValidationResult[] => {
    const checks = [
      { field: "patient", label: "patient info", status: Boolean(meta.patient.trim()) },
      { field: "payer", label: "payer", status: Boolean(meta.payor.trim()) },
      { field: "provider", label: "ordering provider", status: Boolean(meta.provider.trim()) },
      { field: "serviceLines", label: "at least one CPT item", status: sessionItems.length > 0 },
      { field: "diagnoses", label: "at least one diagnosis", status: diagnoses.length > 0 },
      {
        field: "units",
        label: "units",
        status: sessionItems.every((item) => Number.parseInt(item.units, 10) > 0),
      },
      {
        field: "modifierReview",
        label: "modifier review",
        status: sessionItems.every((item) => !/review|required/i.test(item.modifier)),
      },
      {
        field: "soapNote",
        label: "SOAP note",
        status: Boolean(storedSoap || hasGeneratedDocumentation),
      },
    ];

    return checks.map((check) => ({
      field: check.field,
      status: (check.status ? "pass" : check.field === "modifierReview" ? "needs_review" : "missing") as
        | "pass"
        | "needs_review"
        | "missing",
      message: check.status ? `${check.label} present` : check.label,
    }));
  };

  const build837PDraft = (): Claim837PDraft => {
    const mappedDiagnoses: Claim837PDiagnosis[] = diagnoses.slice(0, 4).map((diagnosis, index) => ({
      pointer: diagnosisPointers[index],
      code: diagnosis.code,
      description: diagnosis.description,
      priority: diagnosis.type === "Primary" ? "primary" : "secondary",
      source: diagnosis.id.includes("generated") || diagnosis.id.includes("soap") ? "AI" : "clinician",
    }));

    const activePointers = mappedDiagnoses.map((diagnosis) => diagnosis.pointer);
    const fallbackPointer = activePointers[0] ?? "A";

    return {
      claimType: "837P_DRAFT",
      sessionId,
      patient: {
        name: meta.patient,
        mrn: meta.mrn,
      },
      subscriber: {
        name: meta.patient,
        relationship: "self",
      },
      payer: {
        name: meta.payor,
      },
      provider: {
        orderingProvider: meta.provider,
      },
      diagnoses: mappedDiagnoses,
      serviceLines: sessionItems.map((item, index) => ({
        lineNumber: index + 1,
        dateOfService: meta.session,
        cptCode: item.code,
        description: item.description,
        units: Number.parseInt(item.units, 10) || 0,
        duration: item.duration,
        modifier: item.modifier || null,
        diagnosisPointer: activePointers.length > 0 ? activePointers.join("") : fallbackPointer,
        charge: null,
        validationStatus: Number.parseInt(item.units, 10) > 0 ? "ready" : "missing_units",
      })),
      validationResults: validateClaimDocument(),
      generatedAt: new Date().toISOString(),
    };
  };

  const downloadJson = (fileName: string, data: unknown) => {
    if (typeof window === "undefined") {
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportClaim = async (format: "DRAFT_JSON" | "837P_JSON") => {
    let backend837P: Claim837PDraft | null = null;
    try {
      backend837P = await get837PDraft(sessionId, language);
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ClaimDocument] 837P backend fetch failed, using local fallback.", error);
      }
    }
    const claim837P = backend837P ?? build837PDraft();
    const payload =
      format === "837P_JSON"
        ? claim837P
        : {
            sessionId,
            patientMeta: meta,
            cptItems: sessionItems,
            diagnosisCodes: diagnoses,
            claim837P,
          };

    setShowExportMenu(false);
    downloadJson(
      format === "837P_JSON"
        ? `medexa-837p-draft-${sessionId}.json`
        : `medexa-claim-draft-${sessionId}.json`,
      payload,
    );
    setStatusMessage(t("claim.exported", { format: format === "837P_JSON" ? "837P Draft JSON" : "Claim Draft JSON" }));
  };

  const submitClaim = () => {
    setStatusMessage(t("claim.submissionNotConnected"));
  };

  const saveDraft = async () => {
    const draft: StoredClaimDraft = {
      patientMeta: meta,
      cptItems: sessionItems,
      diagnosisCodes: diagnoses,
      claim837P: build837PDraft(),
    };

    if (typeof window !== "undefined") {
      window.localStorage.setItem(`medexa_claim_draft_${sessionId}`, JSON.stringify(draft));
    }

    const savedDraft = await saveClaimDraft(sessionId, draft as unknown as Record<string, unknown>).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ClaimDocument] draft backend save failed, keeping local draft.", error);
      }
      return null;
    });
    if (savedDraft && "claim_document" in savedDraft) {
      const nextMeta = claimDocumentToMeta(savedDraft.claim_document);
      setSessionItems(claimDocumentToCptItems(savedDraft.claim_document));
      setDiagnoses(claimDocumentToDiagnoses(savedDraft.claim_document));
      setMeta(nextMeta);
      setMetaDraft(nextMeta);
    }
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
    const verifiedClaim = await verifyClaimDocument(sessionId, language).catch((error) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[ClaimDocument] backend verification failed, using local validation.", error);
      }
      return null;
    });

    if (verifiedClaim) {
      const nextMeta = claimDocumentToMeta(verifiedClaim);
      const missing = [...verifiedClaim.validation.missing, ...verifiedClaim.validation.warnings];
      setSessionItems(claimDocumentToCptItems(verifiedClaim));
      setDiagnoses(claimDocumentToDiagnoses(verifiedClaim));
      setMeta(nextMeta);
      setMetaDraft(nextMeta);

      if (missing.length > 0) {
        setStatusMessage(t("common.missing", { items: missing.join(", ") }));
        return;
      }

      setStatusMessage(t("claim.verified"));
      return;
    }

    const missing = validateClaimDocument()
      .filter((result) => result.status !== "pass")
      .map((result) => result.message);

    if (missing.length > 0) {
      setStatusMessage(t("common.missing", { items: missing.join(", ") }));
      return;
    }

    setStatusMessage(t("claim.verified"));
  };

  return (
    <main className="ambient-page" aria-busy={isLoadingClaim}>
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="claim-content">
        <section className="claim-top">
          <div className="claim-title-row">
            <div className="title-group">
              <Link href={`/patient-summary${sessionQuery}`} className="back-link" aria-label="Back to Patient Summary">
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
                    <button type="button" onClick={() => exportClaim("DRAFT_JSON")}>
                      {t("claim.downloadClaimDraftJson")}
                    </button>
                    <button type="button" onClick={() => exportClaim("837P_JSON")}>
                      {t("claim.download837PDraftJson")}
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className="submit-button"
                onClick={submitClaim}
              >
                ▷ {t("claim.submitClaim")}
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


