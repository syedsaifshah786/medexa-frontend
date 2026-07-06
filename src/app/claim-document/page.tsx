"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { useSessionDocumentation } from "@/context/SessionDocumentationContext";
import { getActiveSessionId, setActiveSessionId } from "@/lib/activeSession";
import {
  medexaApi,
  type ApiBilling,
  type ApiClaim,
  type ApiCptRecord,
  type ApiFinalizeSessionResponse,
  type ApiModifier59Suggestion,
  type ApiSoapNoteResponse,
  type ApiTimerState,
} from "@/lib/api";
import { getSessionById, type UpcomingSession } from "@/lib/sessions";
import {
  formatClockTime,
  formatCurrency,
  formatDateTime,
  formatNumber,
  formatUnits,
  translateCptDisplayName,
  translateDynamicMessage,
} from "@/lib/translations";

type ClaimStatus = "draft" | "requiresReview" | "ready";
type ValidationStatus = "passed" | "warning" | "requiresReview" | "missing";
type ModifierStatus = "applied" | "ignored" | "requiresReview";

type PatientInfo = {
  name: string;
  patientId: string;
  mrn: string;
  dateOfService: string;
  provider: string;
  clinician: string;
  careType: string;
  payer: string;
  memberId: string;
  sessionDurationSeconds: number;
  sessionDurationText: string;
  placeOfService: string;
  diagnosisSummary: string;
  medexaSummarized: boolean;
};

type DiagnosisLine = {
  id: string;
  code: string;
  description: string;
  role: "primary" | "secondary";
  confidence: string;
  source: string;
};

type ProcedureLine = {
  id: string;
  code: string;
  displayName: string;
  modifier: string;
  units: number;
  seconds: number;
  durationText: string;
  bodyRegion: string;
  chargeEstimate: number | null;
  documentationStatus: ValidationStatus;
  validationStatus: ValidationStatus;
  source: string;
};

type ModifierLine = {
  id: string;
  cptPair: string;
  bodyRegion: string;
  reason: string;
  status: ModifierStatus;
};

type ValidationLine = {
  id: string;
  label: string;
  status: ValidationStatus;
  detail: string;
};

type ClaimDraft = {
  sessionId: string;
  patient: PatientInfo;
  diagnoses: DiagnosisLine[];
  procedures: ProcedureLine[];
  modifiers: ModifierLine[];
  status: ClaimStatus;
  claimStatusSource: string;
};

type StoredSoap = ApiSoapNoteResponse & {
  billing_summary?: ApiFinalizeSessionResponse["billing_summary"];
  detected_icd10_suggestions?: Array<{
    code?: string | null;
    phrase?: string | null;
    reason?: string | null;
    confidence?: string | null;
  }>;
  modifier59_suggestions?: ApiModifier59Suggestion[];
  ncci_conflicts?: Array<{
    cpt_a?: string | null;
    cpt_b?: string | null;
    explanation?: string | null;
    severity?: string | null;
  }>;
};

const claimCopy = {
  en: {
    title: "Claim Document",
    back: "Back",
    medexaSummarized: "Medexa summarized",
    claimStatus: "Claim Status",
    draft: "Draft",
    requiresReview: "Requires Review",
    ready: "Ready for Review",
    patientEncounter: "Patient & Encounter Information",
    diagnosis: "Diagnosis / ICD-10",
    procedureLines: "Procedure Lines",
    modifierReview: "Modifier Review",
    billingValidation: "Billing Validation",
    claimSummary: "Claim Summary",
    checklist: "Documentation Checklist",
    saveDraft: "Save Draft",
    export: "Export Claim Document",
    markReady: "Mark Ready for Review",
    backToBilling: "Back to Billing Intelligence",
    saved: "Saved locally",
    exportPrepared: "Claim draft JSON downloaded",
    readySaved: "Marked ready for review locally",
    printPreparing: "Export is being prepared",
    patientName: "Patient Name",
    patientId: "Patient ID / MRN",
    dateOfService: "Date of Service",
    provider: "Provider / Clinician",
    careType: "Care Type",
    payer: "Payer",
    memberId: "Member ID",
    sessionDuration: "Session Duration",
    placeOfService: "Place of Service",
    diagnosisSummary: "Diagnosis Summary",
    primaryDiagnosis: "Primary Diagnosis Code",
    secondaryDiagnosis: "Secondary Diagnosis Codes",
    description: "Diagnosis description",
    confidence: "Confidence / source",
    clinicianReview: "Clinician review required",
    noDiagnosis: "Requires clinician review",
    cptCode: "CPT code",
    cptDisplay: "CPT display name",
    modifier: "Modifier",
    units: "Units",
    duration: "Duration",
    bodyRegion: "Body region",
    charge: "Charge estimate",
    documentation: "Documentation status",
    validation: "Validation status",
    noProcedures: "No CPT records were found for this session. Add or review codes in Billing Intelligence.",
    cptPair: "CPT pair",
    regionLogic: "Body-region logic",
    reason: "Reason",
    status: "Status",
    sameRegion: "Same body region",
    differentRegion: "Different body region",
    applied: "Applied",
    ignored: "Ignored",
    apply: "Apply",
    ignore: "Ignore",
    noModifiers: "No Modifier 59 suggestions detected.",
    passed: "Passed",
    warning: "Warning",
    missing: "Missing",
    totalLines: "Total CPT lines",
    totalUnits: "Total units",
    totalTime: "Total session time",
    billableUnits: "Billable units",
    estimatedCharge: "Estimated charge",
    readiness: "Claim readiness",
    score: "score",
    soapReviewed: "SOAP note reviewed",
    cptReviewed: "CPT codes reviewed",
    icdReviewed: "ICD-10 diagnosis reviewed",
    unitsVerified: "Units verified",
    modifiersReviewed: "Modifiers reviewed",
    signatureRequired: "Clinician signature required",
    caveatsReviewed: "Billing caveats reviewed",
    completed: "Complete",
    review: "Review",
    unknown: "Unknown",
    notAvailable: "Not available",
    localStorage: "Local session data",
    backend: "Backend",
    billing: "Billing Intelligence",
    soap: "SOAP Notes",
    claim: "Claim draft",
    readyDetail: "All required review areas have enough supporting data.",
    draftDetail: "Draft can be saved while documentation is still being assembled.",
    reviewDetail: "Clinician review is required before this claim is marked ready.",
  },
  ar: {
    title: "مستند المطالبة",
    back: "رجوع",
    medexaSummarized: "ملخص بواسطة ميديكسا",
    claimStatus: "حالة المطالبة",
    draft: "مسودة",
    requiresReview: "يتطلب مراجعة",
    ready: "جاهز للمراجعة",
    patientEncounter: "معلومات المريض والزيارة",
    diagnosis: "التشخيص / ICD-10",
    procedureLines: "بنود الإجراءات",
    modifierReview: "مراجعة المعدل",
    billingValidation: "التحقق من الفوترة",
    claimSummary: "ملخص المطالبة",
    checklist: "قائمة مراجعة التوثيق",
    saveDraft: "حفظ كمسودة",
    export: "تصدير مستند المطالبة",
    markReady: "تحديد كجاهز للمراجعة",
    backToBilling: "الرجوع إلى ذكاء الفوترة",
    saved: "تم الحفظ محليا",
    exportPrepared: "تم تنزيل مسودة المطالبة بصيغة JSON",
    readySaved: "تم تحديدها كجاهزة للمراجعة محليا",
    printPreparing: "جار تحضير التصدير",
    patientName: "اسم المريض",
    patientId: "معرف المريض / MRN",
    dateOfService: "تاريخ الخدمة",
    provider: "مقدم الرعاية / الطبيب",
    careType: "نوع الرعاية",
    payer: "جهة الدفع",
    memberId: "رقم العضوية",
    sessionDuration: "مدة الجلسة",
    placeOfService: "مكان الخدمة",
    diagnosisSummary: "ملخص التشخيص",
    primaryDiagnosis: "رمز التشخيص الأساسي",
    secondaryDiagnosis: "رموز التشخيص الثانوية",
    description: "وصف التشخيص",
    confidence: "الثقة / المصدر",
    clinicianReview: "يتطلب مراجعة الطبيب",
    noDiagnosis: "يتطلب مراجعة الطبيب",
    cptCode: "رمز CPT",
    cptDisplay: "اسم CPT",
    modifier: "المعدل",
    units: "الوحدات",
    duration: "المدة",
    bodyRegion: "منطقة الجسم",
    charge: "تقدير الرسوم",
    documentation: "حالة التوثيق",
    validation: "حالة التحقق",
    noProcedures: "لم يتم العثور على سجلات CPT لهذه الجلسة. راجع الرموز في ذكاء الفوترة.",
    cptPair: "زوج CPT",
    regionLogic: "منطق منطقة الجسم",
    reason: "السبب",
    status: "الحالة",
    sameRegion: "نفس منطقة الجسم",
    differentRegion: "منطقة جسم مختلفة",
    applied: "تم التطبيق",
    ignored: "تم التجاهل",
    apply: "تطبيق",
    ignore: "تجاهل",
    noModifiers: "لم يتم اكتشاف اقتراحات للمعدل 59.",
    passed: "تم الاجتياز",
    warning: "تحذير",
    missing: "مفقود",
    totalLines: "إجمالي بنود CPT",
    totalUnits: "إجمالي الوحدات",
    totalTime: "إجمالي وقت الجلسة",
    billableUnits: "الوحدات القابلة للفوترة",
    estimatedCharge: "تقدير الرسوم",
    readiness: "جاهزية المطالبة",
    score: "النتيجة",
    soapReviewed: "تمت مراجعة ملاحظة SOAP",
    cptReviewed: "تمت مراجعة رموز CPT",
    icdReviewed: "تمت مراجعة تشخيص ICD-10",
    unitsVerified: "تم التحقق من الوحدات",
    modifiersReviewed: "تمت مراجعة المعدلات",
    signatureRequired: "توقيع الطبيب مطلوب",
    caveatsReviewed: "تمت مراجعة تنبيهات الفوترة",
    completed: "مكتمل",
    review: "مراجعة",
    unknown: "غير معروف",
    notAvailable: "غير متوفر",
    localStorage: "بيانات الجلسة المحلية",
    backend: "الخادم",
    billing: "ذكاء الفوترة",
    soap: "ملاحظات SOAP",
    claim: "مسودة المطالبة",
    readyDetail: "كل مناطق المراجعة المطلوبة لديها بيانات داعمة كافية.",
    draftDetail: "يمكن حفظ المسودة أثناء استكمال التوثيق.",
    reviewDetail: "مراجعة الطبيب مطلوبة قبل جعل المطالبة جاهزة.",
  },
} as const;

type ClaimCopy = Record<keyof typeof claimCopy.en, string>;

const cptChargeSchedule: Record<string, number> = {
  "97110": 42,
  "97112": 48,
  "97116": 44,
  "97140": 46,
  "97530": 52,
  "97535": 47,
};

const emptyPatient = (sessionId: string, session: UpcomingSession): PatientInfo => ({
  name: session.name,
  patientId: session.id,
  mrn: session.mrn,
  dateOfService: session.time,
  provider: "Dr. Sarah Miller",
  clinician: "Dr. Sarah Miller",
  careType: session.careType,
  payer: session.payor,
  memberId: "",
  sessionDurationSeconds: 0,
  sessionDurationText: session.time,
  placeOfService: "",
  diagnosisSummary: "",
  medexaSummarized: false,
});

const emptyDraft = (sessionId: string): ClaimDraft => {
  const session = getSessionById(sessionId);
  return {
    sessionId,
    patient: emptyPatient(sessionId, session),
    diagnoses: [],
    procedures: [],
    modifiers: [],
    status: "draft",
    claimStatusSource: "draft",
  };
};

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseDurationToSeconds(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const clockMatch = value.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const first = Number(clockMatch[1]);
    const second = Number(clockMatch[2]);
    const third = clockMatch[3] ? Number(clockMatch[3]) : null;
    return third === null ? first * 60 + second : first * 3600 + second * 60 + third;
  }

  const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*(min|minute|minutes)/i);
  if (minuteMatch) {
    return Math.round(Number(minuteMatch[1]) * 60);
  }

  return 0;
}

function secondsToDisplay(seconds: number, fallback: string, language: "en" | "ar" | "he") {
  if (seconds > 0) {
    return formatClockTime(seconds, language);
  }

  return fallback ? translateDynamicMessage(fallback, language) : "";
}

function statusLabel(status: ValidationStatus | ClaimStatus | ModifierStatus, copy: ClaimCopy) {
  if (status === "passed") return copy.passed;
  if (status === "warning") return copy.warning;
  if (status === "missing") return copy.missing;
  if (status === "requiresReview") return copy.requiresReview;
  if (status === "ready") return copy.ready;
  if (status === "draft") return copy.draft;
  if (status === "applied") return copy.applied;
  if (status === "ignored") return copy.ignored;
  return copy.requiresReview;
}

function uniqueByCode(items: DiagnosisLine[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.code || `${item.role}-${item.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function uniqueProcedures(items: ProcedureLine[]) {
  const byCode = new Map<string, ProcedureLine>();
  items.forEach((item) => {
    const existing = byCode.get(item.code);
    if (!existing || item.seconds > existing.seconds || item.units > existing.units) {
      byCode.set(item.code, item);
    }
  });
  return Array.from(byCode.values());
}

function cptRecordToProcedure(record: ApiCptRecord, index: number): ProcedureLine {
  const units = Number.isFinite(record.units) ? record.units : 0;
  return {
    id: `cpt-record-${record.code}-${index}`,
    code: record.code,
    displayName: record.displayName || record.code,
    modifier: "",
    units,
    seconds: record.seconds || 0,
    durationText: record.seconds ? "" : "",
    bodyRegion: record.bodyRegion ?? "",
    chargeEstimate: cptChargeSchedule[record.code] ? cptChargeSchedule[record.code] * Math.max(units, 1) : null,
    documentationStatus: record.reason ? "passed" : "requiresReview",
    validationStatus: units > 0 ? "passed" : "requiresReview",
    source: "CPT record",
  };
}

function billingItemToProcedure(item: ApiBilling["cptCodes"][number], index: number): ProcedureLine {
  const units = Number.parseInt(item.units, 10) || 0;
  const seconds = parseDurationToSeconds(item.duration);
  return {
    id: item.id || `billing-${item.code}-${index}`,
    code: item.code,
    displayName: item.title,
    modifier: item.warning?.includes("59") ? "59" : "",
    units,
    seconds,
    durationText: item.duration,
    bodyRegion: "",
    chargeEstimate: cptChargeSchedule[item.code] ? cptChargeSchedule[item.code] * Math.max(units, 1) : null,
    documentationStatus: item.status === "approved" ? "passed" : "requiresReview",
    validationStatus: item.warning ? "warning" : "passed",
    source: "Billing Intelligence",
  };
}

function claimItemToProcedure(item: ApiClaim["cptItems"][number], index: number): ProcedureLine {
  const units = Number.parseInt(item.units, 10) || 0;
  const seconds = parseDurationToSeconds(item.duration);
  return {
    id: item.id || `claim-cpt-${item.code}-${index}`,
    code: item.code,
    displayName: item.description,
    modifier: item.modifier.replace(/modifier\s*/i, "").trim(),
    units,
    seconds,
    durationText: item.duration,
    bodyRegion: "",
    chargeEstimate: cptChargeSchedule[item.code] ? cptChargeSchedule[item.code] * Math.max(units, 1) : null,
    documentationStatus: "requiresReview",
    validationStatus: item.modifier ? "warning" : "passed",
    source: "Claim draft",
  };
}

function modifierSuggestionToLine(suggestion: ApiModifier59Suggestion, index: number): ModifierLine {
  return {
    id: suggestion.id || `modifier-${index}`,
    cptPair: suggestion.codes.join(" / "),
    bodyRegion: suggestion.body_region,
    reason: suggestion.description,
    status:
      suggestion.status === "applied"
        ? "applied"
        : suggestion.status === "ignored"
          ? "ignored"
          : "requiresReview",
  };
}

function applySoapData(draft: ClaimDraft, data: StoredSoap | null, source: string): ClaimDraft {
  if (!data) {
    return draft;
  }

  const soap = data.soap_note ?? data;
  const assessment = typeof soap.assessment === "object" && soap.assessment ? soap.assessment : null;
  const diagnosisSummary =
    assessment?.diagnosisSummary ??
    data.diagnosis_summary ??
    (typeof soap.assessment === "string" ? soap.assessment : "");
  const primaryCode = assessment?.primaryDiagnosisCode ?? "";
  const detectedDiagnoses =
    data.detected_icd10_suggestions?.map((suggestion, index) => ({
      id: `detected-icd-${suggestion.code ?? index}`,
      code: suggestion.code ?? "",
      description: suggestion.reason ?? suggestion.phrase ?? diagnosisSummary,
      role: index === 0 ? ("primary" as const) : ("secondary" as const),
      confidence: suggestion.confidence ?? "AI-assisted",
      source,
    })) ?? [];
  const diagnoses = [
    ...draft.diagnoses,
    ...(primaryCode
      ? [
          {
            id: `soap-primary-${primaryCode}`,
            code: primaryCode,
            description: diagnosisSummary || primaryCode,
            role: "primary" as const,
            confidence: "SOAP assessment",
            source,
          },
        ]
      : []),
    ...detectedDiagnoses.filter((item) => item.code),
  ];
  const billingRecords = data.billing_summary?.cpt_records ?? [];
  const procedures = [...draft.procedures, ...billingRecords.map(cptRecordToProcedure)];
  const totalSeconds = data.billing_summary?.total_seconds ?? draft.patient.sessionDurationSeconds;

  return {
    ...draft,
    patient: {
      ...draft.patient,
      diagnosisSummary: diagnosisSummary || draft.patient.diagnosisSummary,
      sessionDurationSeconds: totalSeconds || draft.patient.sessionDurationSeconds,
      medexaSummarized: Boolean(data.soap_note || diagnosisSummary || data.summary || draft.patient.medexaSummarized),
    },
    diagnoses: uniqueByCode(diagnoses),
    procedures: uniqueProcedures(procedures),
    modifiers: [
      ...draft.modifiers,
      ...(data.modifier59_suggestions ?? []).map(modifierSuggestionToLine),
    ],
  };
}

function applyClaim(draft: ClaimDraft, claim: ApiClaim | null): ClaimDraft {
  if (!claim) {
    return draft;
  }

  const diagnoses = [
    ...draft.diagnoses,
    ...claim.diagnosisCodes.map((item) => ({
      id: item.id,
      code: item.code,
      description: item.description,
      role: item.type === "Primary" ? ("primary" as const) : ("secondary" as const),
      confidence: "Claim draft",
      source: "Claim draft",
    })),
  ];

  return {
    ...draft,
    patient: {
      ...draft.patient,
      name: claim.patientMeta.patient || draft.patient.name,
      mrn: claim.patientMeta.mrn || draft.patient.mrn,
      provider: claim.patientMeta.provider || draft.patient.provider,
      clinician: claim.patientMeta.provider || draft.patient.clinician,
      payer: claim.patientMeta.payor || draft.patient.payer,
      sessionDurationText: claim.patientMeta.session || draft.patient.sessionDurationText,
    },
    diagnoses: uniqueByCode(diagnoses),
    procedures: uniqueProcedures([...draft.procedures, ...claim.cptItems.map(claimItemToProcedure)]),
    status:
      claim.claimStatus === "verified" || claim.claimStatus === "submitted"
        ? "ready"
        : claim.claimStatus === "draft"
          ? "draft"
          : "requiresReview",
    claimStatusSource: "Claim draft",
  };
}

function applyBilling(draft: ClaimDraft, billing: ApiBilling | null): ClaimDraft {
  if (!billing) {
    return draft;
  }

  return {
    ...draft,
    patient: {
      ...draft.patient,
      sessionDurationText: billing.sessionTime || draft.patient.sessionDurationText,
      sessionDurationSeconds: parseDurationToSeconds(billing.sessionTime) || draft.patient.sessionDurationSeconds,
    },
    procedures: uniqueProcedures([...draft.procedures, ...billing.cptCodes.map(billingItemToProcedure)]),
  };
}

function applyTimerState(draft: ClaimDraft, timer: ApiTimerState | null): ClaimDraft {
  if (!timer) {
    return draft;
  }

  return {
    ...draft,
    patient: {
      ...draft.patient,
      sessionDurationSeconds: timer.total_seconds || draft.patient.sessionDurationSeconds,
    },
    procedures: uniqueProcedures([
      ...draft.procedures,
      ...(timer.cpt_records ?? []).map(cptRecordToProcedure),
    ]),
  };
}

function applySession(draft: ClaimDraft, session: UpcomingSession | null): ClaimDraft {
  if (!session) {
    return draft;
  }

  return {
    ...draft,
    patient: {
      ...draft.patient,
      name: session.name || draft.patient.name,
      patientId: session.id || draft.patient.patientId,
      mrn: session.mrn || draft.patient.mrn,
      dateOfService: session.time || draft.patient.dateOfService,
      careType: session.careType || draft.patient.careType,
      payer: session.payor || draft.patient.payer,
    },
    diagnoses:
      draft.diagnoses.length > 0 || !session.icd
        ? draft.diagnoses
        : [
            {
              id: `session-icd-${session.icd}`,
              code: session.icd,
              description: session.careType,
              role: "primary",
              confidence: "Session profile",
              source: "Session",
            },
          ],
  };
}

function buildModifierLines(procedures: ProcedureLine[], existing: ModifierLine[]): ModifierLine[] {
  if (existing.length > 0) {
    return existing;
  }

  const sameRegion = procedures.reduce<Record<string, ProcedureLine[]>>((groups, item) => {
    const region = item.bodyRegion.trim().toLowerCase();
    if (!region) {
      return groups;
    }
    groups[region] = [...(groups[region] ?? []), item];
    return groups;
  }, {});

  return Object.entries(sameRegion)
    .filter(([, items]) => new Set(items.map((item) => item.code)).size > 1)
    .map(([bodyRegion, items]) => ({
      id: `modifier-${bodyRegion}`,
      cptPair: Array.from(new Set(items.map((item) => item.code))).join(" / "),
      bodyRegion,
      reason: "Multiple CPT services detected for the same body region. Clinician must decide whether modifier 59 is appropriate.",
      status: "requiresReview" as const,
    }));
}

function buildValidationChecks(draft: ClaimDraft, copy: ClaimCopy, language: "en" | "ar" | "he"): ValidationLine[] {
  const totalTimedSeconds = draft.procedures.reduce((total, item) => total + item.seconds, 0);
  const hasCpt = draft.procedures.length > 0;
  const hasDiagnosis = draft.diagnoses.length > 0;
  const pendingModifiers = draft.modifiers.some((item) => item.status === "requiresReview");
  const missingFields = [
    draft.patient.name ? "" : copy.patientName,
    draft.patient.mrn ? "" : "MRN",
    draft.patient.provider ? "" : copy.provider,
    draft.patient.payer ? "" : copy.payer,
  ].filter(Boolean);

  return [
    {
      id: "eight-minute",
      label: copy.billing === claimCopy.en.billing ? "8 Minute Rule" : "قاعدة الثماني دقائق",
      status: !hasCpt ? "missing" : totalTimedSeconds >= 8 * 60 ? "passed" : "warning",
      detail: hasCpt
        ? `${copy.totalTime}: ${formatClockTime(totalTimedSeconds, language)}`
        : copy.noProcedures,
    },
    {
      id: "mue",
      label: "MUE check",
      status: hasCpt ? "passed" : "missing",
      detail: hasCpt ? copy.readyDetail : copy.noProcedures,
    },
    {
      id: "ptp",
      label: "PTP/NCCI conflict check",
      status: pendingModifiers ? "requiresReview" : "passed",
      detail: pendingModifiers ? copy.reviewDetail : copy.readyDetail,
    },
    {
      id: "addon",
      label: "Add-on CPT parent validation",
      status: hasCpt ? "passed" : "missing",
      detail: hasCpt ? copy.readyDetail : copy.noProcedures,
    },
    {
      id: "compatibility",
      label: "CPT/ICD compatibility",
      status: hasCpt && hasDiagnosis ? "passed" : "requiresReview",
      detail: hasDiagnosis ? copy.readyDetail : copy.noDiagnosis,
    },
    {
      id: "missing",
      label: "Missing required fields",
      status: missingFields.length > 0 ? "missing" : "passed",
      detail: missingFields.length > 0 ? missingFields.join(", ") : copy.readyDetail,
    },
    {
      id: "documentation",
      label: "Documentation review required",
      status: draft.patient.medexaSummarized ? "requiresReview" : "missing",
      detail: draft.patient.medexaSummarized ? copy.clinicianReview : copy.notAvailable,
    },
  ];
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
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const [draft, setDraft] = useState<ClaimDraft>(() => emptyDraft("samuel-thompson"));
  const [statusMessage, setStatusMessage] = useState("");
  const { soapData, hasGeneratedDocumentation } = useSessionDocumentation();
  const { language, t } = useLanguage();
  const copy: ClaimCopy = language === "ar" ? claimCopy.ar : claimCopy.en;
  const routeSessionId = searchParams.get("sessionId") ?? searchParams.get("id") ?? "";
  const tabSuffix = `?sessionId=${encodeURIComponent(sessionId)}`;
  const displayText = (value: string | null | undefined) =>
    value ? translateDynamicMessage(value, language) : copy.notAvailable;

  useEffect(() => {
    const activeSessionId = routeSessionId || getActiveSessionId();
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);

    let isMounted = true;

    const loadClaimDraft = async () => {
      const localSession = getSessionById(activeSessionId);
      let nextDraft = applySession(emptyDraft(activeSessionId), localSession);

      const storedSoap = safeParse<StoredSoap>(window.localStorage.getItem(`medexa_soap_note_${activeSessionId}`));
      const storedCptRecords = safeParse<ApiCptRecord[] | Record<string, ApiCptRecord>>(
        window.localStorage.getItem(`medexa_cpt_records_${activeSessionId}`),
      );
      const storedTimer = safeParse<ApiTimerState>(window.localStorage.getItem(`medexa_session_state_${activeSessionId}`));
      const storedDraft = safeParse<ClaimDraft>(window.localStorage.getItem(`medexa_claim_draft_${activeSessionId}`));

      nextDraft = applySoapData(nextDraft, storedSoap, copy.localStorage);
      if (Array.isArray(storedCptRecords)) {
        nextDraft = {
          ...nextDraft,
          procedures: uniqueProcedures([...nextDraft.procedures, ...storedCptRecords.map(cptRecordToProcedure)]),
        };
      } else if (storedCptRecords) {
        nextDraft = {
          ...nextDraft,
          procedures: uniqueProcedures([
            ...nextDraft.procedures,
            ...Object.values(storedCptRecords).map(cptRecordToProcedure),
          ]),
        };
      }
      nextDraft = applyTimerState(nextDraft, storedTimer);
      if (storedDraft?.sessionId === activeSessionId) {
        nextDraft = {
          ...nextDraft,
          ...storedDraft,
          patient: { ...nextDraft.patient, ...storedDraft.patient },
          diagnoses: uniqueByCode([...nextDraft.diagnoses, ...storedDraft.diagnoses]),
          procedures: uniqueProcedures([...nextDraft.procedures, ...storedDraft.procedures]),
          modifiers: [...nextDraft.modifiers, ...storedDraft.modifiers],
        };
      }

      const [apiSession, apiSoap, apiBilling, apiTimer, apiClaim] = await Promise.all([
        medexaApi.session(activeSessionId),
        medexaApi.getSoapNote(activeSessionId, language),
        medexaApi.billing(activeSessionId),
        medexaApi.getTimerState(activeSessionId),
        medexaApi.claim(activeSessionId),
      ]);

      if (!isMounted) {
        return;
      }

      if (apiSession) {
        nextDraft = applySession(nextDraft, {
          id: apiSession.id,
          name: apiSession.patientName,
          status: apiSession.status,
          careType: apiSession.careType,
          cpt: apiSession.cpt,
          icd: apiSession.icd,
          time: apiSession.dateTime,
          img: apiSession.avatar,
          ageSex: apiSession.ageSex,
          weight: apiSession.weight,
          mrn: apiSession.mrnNumber,
          payor: apiSession.payorSource,
        });
      }
      nextDraft = applySoapData(nextDraft, apiSoap as StoredSoap | null, copy.backend);
      nextDraft = applyBilling(nextDraft, apiBilling);
      nextDraft = applyTimerState(nextDraft, apiTimer);
      nextDraft = applyClaim(nextDraft, apiClaim);
      nextDraft = {
        ...nextDraft,
        modifiers: buildModifierLines(nextDraft.procedures, nextDraft.modifiers),
      };

      setDraft(nextDraft);
    };

    loadClaimDraft();

    return () => {
      isMounted = false;
    };
  }, [copy.backend, copy.localStorage, language, routeSessionId]);

  useEffect(() => {
    if (!hasGeneratedDocumentation) {
      return;
    }

    setDraft((current) =>
      applySoapData(
        current,
        {
          soap_note: soapData,
          billing_summary: {
            total_seconds: current.patient.sessionDurationSeconds,
            cpt_records: [],
          },
        },
        copy.soap,
      ),
    );
  }, [copy.soap, hasGeneratedDocumentation, soapData]);

  const validationChecks = useMemo(() => buildValidationChecks(draft, copy, language), [copy, draft, language]);
  const totalUnits = useMemo(
    () => draft.procedures.reduce((total, item) => total + item.units, 0),
    [draft.procedures],
  );
  const totalProcedureSeconds = useMemo(
    () => draft.procedures.reduce((total, item) => total + item.seconds, 0),
    [draft.procedures],
  );
  const estimatedCharge = useMemo(
    () => draft.procedures.reduce((total, item) => total + (item.chargeEstimate ?? 0), 0),
    [draft.procedures],
  );
  const readinessScore = useMemo(() => {
    const passed = validationChecks.filter((item) => item.status === "passed").length;
    return Math.round((passed / validationChecks.length) * 100);
  }, [validationChecks]);
  const calculatedStatus: ClaimStatus = useMemo(() => {
    if (draft.status === "ready") {
      return "ready";
    }
    if (validationChecks.some((item) => item.status === "missing" || item.status === "requiresReview")) {
      return "requiresReview";
    }
    return "draft";
  }, [draft.status, validationChecks]);
  const checklist = [
    { label: copy.soapReviewed, done: draft.patient.medexaSummarized },
    { label: copy.cptReviewed, done: draft.procedures.length > 0 },
    { label: copy.icdReviewed, done: draft.diagnoses.length > 0 },
    { label: copy.unitsVerified, done: draft.procedures.every((item) => item.units > 0) && draft.procedures.length > 0 },
    { label: copy.modifiersReviewed, done: draft.modifiers.every((item) => item.status !== "requiresReview") },
    { label: copy.signatureRequired, done: false },
    { label: copy.caveatsReviewed, done: validationChecks.every((item) => item.status !== "warning") },
  ];
  const query = headerSearch.trim().toLowerCase();
  const visibleProcedures = query
    ? draft.procedures.filter((item) =>
        [item.code, item.displayName, item.modifier, item.bodyRegion, item.source].join(" ").toLowerCase().includes(query),
      )
    : draft.procedures;
  const visibleDiagnoses = query
    ? draft.diagnoses.filter((item) =>
        [item.code, item.description, item.source, item.confidence].join(" ").toLowerCase().includes(query),
      )
    : draft.diagnoses;

  const updateModifierStatus = (id: string, status: ModifierStatus) => {
    setDraft((current) => ({
      ...current,
      modifiers: current.modifiers.map((item) => (item.id === id ? { ...item, status } : item)),
    }));
  };

  const saveDraft = () => {
    window.localStorage.setItem(`medexa_claim_draft_${sessionId}`, JSON.stringify({ ...draft, status: "draft" }));
    setDraft((current) => ({ ...current, status: "draft" }));
    medexaApi.saveClaimDraft(sessionId);
    setStatusMessage(copy.saved);
  };

  const exportClaim = () => {
    const payload = JSON.stringify(
      {
        ...draft,
        validationChecks,
        readinessScore,
      },
      null,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `medexa-claim-${sessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage(copy.exportPrepared);
  };

  const markReady = () => {
    const nextDraft = { ...draft, status: "ready" as const };
    setDraft(nextDraft);
    window.localStorage.setItem(`medexa_claim_draft_${sessionId}`, JSON.stringify(nextDraft));
    medexaApi.verifyClaim(sessionId);
    setStatusMessage(copy.readySaved);
  };

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="claim-shell">
        <section className="claim-hero">
          <div className="hero-main">
            <Link href={`/billing-intelligence${tabSuffix}`} className="back-link" aria-label={copy.back}>
              <span aria-hidden="true">‹</span>
              {copy.back}
            </Link>
            <div>
              <h1>{copy.title}</h1>
              <div className="hero-badges">
                {draft.patient.medexaSummarized && <span>{copy.medexaSummarized}</span>}
                <span className={`status-chip ${calculatedStatus}`}>{statusLabel(calculatedStatus, copy)}</span>
              </div>
            </div>
          </div>

          <div className="hero-meta">
            <div>
              <span>{copy.patientName}</span>
              <strong>{displayText(draft.patient.name)}</strong>
            </div>
            <div>
              <span>{copy.dateOfService}</span>
              <strong>{displayText(draft.patient.dateOfService)}</strong>
            </div>
            <div>
              <span>{copy.patientId}</span>
              <strong dir="ltr">{draft.patient.mrn || draft.patient.patientId || copy.notAvailable}</strong>
            </div>
            <div>
              <span>{copy.provider}</span>
              <strong>{displayText(draft.patient.provider || draft.patient.clinician)}</strong>
            </div>
            <div>
              <span>{copy.claimStatus}</span>
              <strong>{statusLabel(calculatedStatus, copy)}</strong>
            </div>
          </div>

          <nav className="tabs" aria-label="Session views">
            <Link href={`/soap-notes${tabSuffix}`}>{t("nav.soapNotes")}</Link>
            <Link href={`/billing-intelligence${tabSuffix}`}>{t("nav.billingIntelligence")}</Link>
            <Link href={`/patient-summary${tabSuffix}`}>{t("nav.patientSummary")}</Link>
            <Link href={`/claim-document${tabSuffix}`} className="tab-active">
              {t("nav.claimDocument")}
            </Link>
          </nav>

          {statusMessage && <div className="status-message">{statusMessage}</div>}
        </section>

        <section className="claim-grid">
          <article className="claim-card wide">
            <div className="card-heading">
              <h2>{copy.patientEncounter}</h2>
            </div>
            <div className="info-grid">
              {[
                [copy.patientName, draft.patient.name],
                [copy.patientId, draft.patient.patientId || draft.patient.mrn],
                [copy.dateOfService, draft.patient.dateOfService],
                [copy.provider, draft.patient.provider || draft.patient.clinician],
                [copy.careType, draft.patient.careType],
                [copy.payer, draft.patient.payer],
                [copy.memberId, draft.patient.memberId],
                [
                  copy.sessionDuration,
                  secondsToDisplay(
                    draft.patient.sessionDurationSeconds,
                    draft.patient.sessionDurationText,
                    language,
                  ),
                ],
                [copy.placeOfService, draft.patient.placeOfService],
                [copy.diagnosisSummary, draft.patient.diagnosisSummary],
              ].map(([label, value]) => (
                <div className="info-item" key={label}>
                  <span>{label}</span>
                  <strong>{displayText(value)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="claim-card">
            <div className="card-heading">
              <h2>{copy.diagnosis}</h2>
              <span className="review-pill">{visibleDiagnoses.length > 0 ? copy.clinicianReview : copy.noDiagnosis}</span>
            </div>
            {visibleDiagnoses.length > 0 ? (
              <div className="diagnosis-stack">
                {visibleDiagnoses.map((item) => (
                  <div className="diagnosis-row" key={item.id}>
                    <div>
                      <span className="code-chip" dir="ltr">{item.code || "ICD-10"}</span>
                      <strong>{displayText(item.description)}</strong>
                    </div>
                    <p>
                      {item.role === "primary" ? copy.primaryDiagnosis : copy.secondaryDiagnosis} ·{" "}
                      {displayText(item.confidence || item.source)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">{copy.noDiagnosis}</div>
            )}
          </article>

          <article className="claim-card summary-card">
            <div className="card-heading">
              <h2>{copy.claimSummary}</h2>
              <span className={`status-chip ${calculatedStatus}`}>{statusLabel(calculatedStatus, copy)}</span>
            </div>
            <div className="summary-metrics">
              <div>
                <span>{copy.totalLines}</span>
                <strong>{formatNumber(draft.procedures.length, language)}</strong>
              </div>
              <div>
                <span>{copy.totalUnits}</span>
                <strong>{formatUnits(totalUnits, language)}</strong>
              </div>
              <div>
                <span>{copy.totalTime}</span>
                <strong>{formatClockTime(totalProcedureSeconds || draft.patient.sessionDurationSeconds, language)}</strong>
              </div>
              <div>
                <span>{copy.billableUnits}</span>
                <strong>{formatUnits(totalUnits, language)}</strong>
              </div>
              <div>
                <span>{copy.estimatedCharge}</span>
                <strong>{estimatedCharge > 0 ? formatCurrency(estimatedCharge, language) : copy.notAvailable}</strong>
              </div>
              <div>
                <span>{copy.readiness}</span>
                <strong>{formatNumber(readinessScore, language)}%</strong>
              </div>
            </div>
          </article>

          <article className="claim-card wide">
            <div className="card-heading">
              <h2>{copy.procedureLines}</h2>
              <span>{formatUnits(totalUnits, language)}</span>
            </div>
            {visibleProcedures.length > 0 ? (
              <div className="procedure-table">
                <div className="procedure-head">
                  <span>{copy.cptCode}</span>
                  <span>{copy.cptDisplay}</span>
                  <span>{copy.modifier}</span>
                  <span>{copy.units}</span>
                  <span>{copy.duration}</span>
                  <span>{copy.bodyRegion}</span>
                  <span>{copy.charge}</span>
                  <span>{copy.documentation}</span>
                  <span>{copy.validation}</span>
                </div>
                {visibleProcedures.map((item) => (
                  <div className="procedure-row" key={item.id}>
                    <span className="code-chip" dir="ltr">{item.code}</span>
                    <span>{translateCptDisplayName(item.code, item.displayName, language)}</span>
                    <span dir="ltr">{item.modifier || "--"}</span>
                    <span>{formatNumber(item.units, language)}</span>
                    <span dir="ltr">{secondsToDisplay(item.seconds, item.durationText, language) || "--"}</span>
                    <span>{displayText(item.bodyRegion)}</span>
                    <span>{item.chargeEstimate ? formatCurrency(item.chargeEstimate, language) : "--"}</span>
                    <span className={`mini-status ${item.documentationStatus}`}>
                      {statusLabel(item.documentationStatus, copy)}
                    </span>
                    <span className={`mini-status ${item.validationStatus}`}>
                      {statusLabel(item.validationStatus, copy)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">{copy.noProcedures}</div>
            )}
          </article>

          <article className="claim-card">
            <div className="card-heading">
              <h2>{copy.modifierReview}</h2>
            </div>
            {draft.modifiers.length > 0 ? (
              <div className="modifier-stack">
                {draft.modifiers.map((item) => (
                  <div className="modifier-card" key={item.id}>
                    <div>
                      <span>{copy.cptPair}</span>
                      <strong dir="ltr">{item.cptPair}</strong>
                    </div>
                    <p>
                      <b>{item.bodyRegion ? copy.sameRegion : copy.differentRegion}:</b>{" "}
                      {displayText(item.bodyRegion || copy.notAvailable)}
                    </p>
                    <p>{displayText(item.reason)}</p>
                    <div className="modifier-actions">
                      <span className={`mini-status ${item.status}`}>{statusLabel(item.status, copy)}</span>
                      {item.status === "requiresReview" && (
                        <>
                          <button type="button" onClick={() => updateModifierStatus(item.id, "ignored")}>
                            {copy.ignore}
                          </button>
                          <button type="button" onClick={() => updateModifierStatus(item.id, "applied")}>
                            {copy.apply}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">{copy.noModifiers}</div>
            )}
          </article>

          <article className="claim-card">
            <div className="card-heading">
              <h2>{copy.billingValidation}</h2>
            </div>
            <div className="validation-stack">
              {validationChecks.map((item) => (
                <div className="validation-row" key={item.id}>
                  <div>
                    <strong>{displayText(item.label)}</strong>
                    <p>{displayText(item.detail)}</p>
                  </div>
                  <span className={`mini-status ${item.status}`}>{statusLabel(item.status, copy)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="claim-card wide">
            <div className="card-heading">
              <h2>{copy.checklist}</h2>
            </div>
            <div className="checklist-grid">
              {checklist.map((item) => (
                <div className={item.done ? "check-item done" : "check-item"} key={item.label}>
                  <span aria-hidden="true">{item.done ? "✓" : "!"}</span>
                  <strong>{item.label}</strong>
                  <em>{item.done ? copy.completed : copy.review}</em>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>

      <div className="bottom-actions" aria-label={copy.title}>
        <button type="button" onClick={saveDraft}>{copy.saveDraft}</button>
        <button type="button" onClick={exportClaim}>{copy.export}</button>
        <button type="button" className="primary-action" onClick={markReady}>{copy.markReady}</button>
        <Link href={`/billing-intelligence${tabSuffix}`}>{copy.backToBilling}</Link>
      </div>

      <style>{`
        .ambient-page {
          min-height: 100vh;
          overflow-x: hidden;
          background: #eef1f6;
          color: #151820;
          font-family: Arial, Helvetica, sans-serif;
        }

        button,
        a {
          font-family: inherit;
        }

        .claim-shell {
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 64px);
          padding: 24px 32px 128px;
          background: #f7f9fc;
        }

        .claim-hero {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          background: #fff;
          padding: 22px;
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.06);
        }

        .hero-main,
        .hero-badges,
        .tabs,
        .card-heading,
        .modifier-actions,
        .bottom-actions {
          display: flex;
          align-items: center;
        }

        .hero-main {
          justify-content: space-between;
          gap: 18px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #172033;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }

        .back-link span {
          color: #001eff;
          font-size: 28px;
          line-height: 1;
        }

        h1,
        h2,
        p {
          margin: 0;
        }

        h1 {
          color: #172033;
          font-size: 26px;
          font-weight: 800;
          line-height: 1.2;
          text-align: right;
        }

        :global(html[dir="rtl"]) h1 {
          text-align: left;
        }

        .hero-badges {
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }

        :global(html[dir="rtl"]) .hero-badges {
          justify-content: flex-start;
        }

        .hero-badges > span,
        .review-pill {
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
        }

        .status-chip,
        .mini-status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          padding: 6px 10px;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
        }

        .status-chip.draft,
        .mini-status.warning,
        .mini-status.requiresReview {
          background: #fff7e6;
          color: #9a6100;
        }

        .status-chip.requiresReview,
        .mini-status.missing {
          background: #fee4e2;
          color: #b42318;
        }

        .status-chip.ready,
        .mini-status.passed,
        .mini-status.applied {
          background: #e7f8ee;
          color: #087c4a;
        }

        .mini-status.ignored {
          background: #f1f3f6;
          color: #667085;
        }

        .hero-meta {
          display: grid;
          grid-template-columns: repeat(5, minmax(150px, 1fr));
          gap: 16px;
          margin-top: 22px;
        }

        .hero-meta div,
        .info-item {
          min-width: 0;
        }

        .hero-meta span,
        .info-item span,
        .modifier-card span,
        .summary-metrics span {
          display: block;
          color: #667085;
          font-size: 11px;
          font-weight: 800;
        }

        .hero-meta strong,
        .info-item strong {
          display: block;
          overflow-wrap: anywhere;
          margin-top: 6px;
          color: #172033;
          font-size: 13px;
          line-height: 1.35;
        }

        .tabs {
          gap: 28px;
          margin-top: 22px;
          padding-top: 18px;
          border-top: 1px solid #edf1f6;
          overflow-x: auto;
        }

        .tabs a {
          flex: 0 0 auto;
          color: #172033;
          font-size: 13px;
          text-decoration: none;
        }

        .tabs .tab-active {
          border: 1px solid #b9c8ff;
          border-radius: 999px;
          background: #eef3ff;
          color: #001eff;
          padding: 9px 16px;
          font-weight: 800;
        }

        .status-message {
          margin-top: 16px;
          border: 1px solid #bdebd4;
          border-radius: 8px;
          background: #fbfffd;
          color: #087c4a;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 800;
        }

        .claim-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
          gap: 18px;
          margin-top: 18px;
        }

        .claim-card {
          min-width: 0;
          border: 1px solid #e1e8f2;
          border-radius: 8px;
          background: #fff;
          padding: 20px;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        .claim-card.wide {
          grid-column: 1 / -1;
        }

        .card-heading {
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 16px;
        }

        .card-heading h2 {
          color: #172033;
          font-size: 17px;
          font-weight: 800;
        }

        .card-heading > span:not(.status-chip):not(.review-pill) {
          color: #667085;
          font-size: 12px;
          font-weight: 800;
        }

        .info-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 16px;
        }

        .info-item {
          border: 1px solid #edf1f6;
          border-radius: 8px;
          background: #fbfcff;
          padding: 13px;
        }

        .diagnosis-stack,
        .modifier-stack,
        .validation-stack {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .diagnosis-row,
        .modifier-card,
        .validation-row {
          border: 1px solid #e6edf6;
          border-radius: 8px;
          background: #fbfcff;
          padding: 14px;
        }

        .diagnosis-row > div,
        .validation-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 14px;
        }

        .diagnosis-row strong,
        .modifier-card strong,
        .validation-row strong {
          display: block;
          color: #172033;
          font-size: 13px;
          line-height: 1.35;
        }

        .diagnosis-row p,
        .modifier-card p,
        .validation-row p {
          margin-top: 9px;
          color: #667085;
          font-size: 12px;
          line-height: 1.45;
        }

        .code-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          background: #eef3ff;
          color: #001eff;
          padding: 5px 8px;
          font-size: 11px;
          font-weight: 800;
        }

        .summary-metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .summary-metrics div {
          border: 1px solid #edf1f6;
          border-radius: 8px;
          padding: 14px;
        }

        .summary-metrics strong {
          display: block;
          margin-top: 8px;
          color: #172033;
          font-size: 18px;
          font-weight: 800;
        }

        .procedure-table {
          overflow: hidden;
          border: 1px solid #e4ebf5;
          border-radius: 8px;
        }

        .procedure-head,
        .procedure-row {
          display: grid;
          grid-template-columns: 0.7fr 1.4fr 0.7fr 0.55fr 0.8fr 1fr 0.8fr 0.9fr 0.9fr;
          gap: 10px;
          align-items: center;
          padding: 13px 14px;
        }

        .procedure-head {
          background: #f7f9fc;
          color: #667085;
          font-size: 11px;
          font-weight: 800;
        }

        .procedure-row {
          border-top: 1px solid #edf1f6;
          color: #344054;
          font-size: 12px;
          line-height: 1.35;
        }

        .procedure-row > span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .modifier-actions {
          justify-content: flex-end;
          gap: 10px;
          margin-top: 12px;
        }

        .modifier-actions button,
        .bottom-actions button,
        .bottom-actions a {
          border: 1px solid #d9e4f2;
          border-radius: 999px;
          background: #fff;
          color: #001eff;
          padding: 9px 13px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
          cursor: pointer;
        }

        .modifier-actions button:last-child,
        .bottom-actions .primary-action {
          border-color: #001eff;
          background: #001eff;
          color: #fff;
        }

        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .check-item {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          border: 1px solid #e6edf6;
          border-radius: 8px;
          background: #fbfcff;
          padding: 12px;
        }

        .check-item span {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff7e6;
          color: #9a6100;
          font-size: 12px;
          font-weight: 800;
        }

        .check-item.done span {
          background: #e7f8ee;
          color: #087c4a;
        }

        .check-item strong {
          min-width: 0;
          color: #172033;
          font-size: 12px;
          line-height: 1.35;
        }

        .check-item em {
          color: #667085;
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
        }

        .empty-state {
          border: 1px dashed #d8deea;
          border-radius: 8px;
          background: #fbfcff;
          color: #667085;
          padding: 22px;
          text-align: center;
          font-size: 13px;
          line-height: 1.45;
        }

        .bottom-actions {
          position: fixed;
          left: 50%;
          bottom: 20px;
          z-index: 20;
          gap: 10px;
          max-width: calc(100vw - 32px);
          transform: translateX(-50%);
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          padding: 10px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
        }

        @media (max-width: 1100px) {
          .hero-meta,
          .info-grid,
          .checklist-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .claim-grid {
            grid-template-columns: 1fr;
          }

          .procedure-head {
            display: none;
          }

          .procedure-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .claim-shell {
            padding: 18px 16px 178px;
          }

          .claim-hero,
          .claim-card {
            padding: 16px;
          }

          .hero-main,
          .card-heading,
          .validation-row,
          .diagnosis-row > div {
            align-items: flex-start;
            flex-direction: column;
          }

          h1 {
            text-align: left;
          }

          :global(html[dir="rtl"]) h1 {
            text-align: right;
          }

          .hero-badges {
            justify-content: flex-start;
            flex-wrap: wrap;
          }

          :global(html[dir="rtl"]) .hero-badges {
            justify-content: flex-end;
          }

          .hero-meta,
          .info-grid,
          .summary-metrics,
          .checklist-grid,
          .procedure-row {
            grid-template-columns: 1fr;
          }

          .tabs {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            overflow-x: visible;
          }

          .bottom-actions {
            width: calc(100% - 32px);
            flex-wrap: wrap;
            justify-content: center;
            border-radius: 18px;
            bottom: 14px;
          }

          .bottom-actions button,
          .bottom-actions a {
            flex: 1 1 170px;
            text-align: center;
          }
        }

        @media print {
          .topbar,
          .bottom-actions,
          .tabs {
            display: none !important;
          }

          .claim-shell {
            padding: 0;
            background: #fff;
          }

          .claim-card,
          .claim-hero {
            box-shadow: none;
            break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}
