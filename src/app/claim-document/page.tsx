"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import MedexaHeader from "@/components/MedexaHeader";
import { useLanguage } from "@/context/LanguageContext";
import { type SoapData, useSessionDocumentation } from "@/context/SessionDocumentationContext";
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

type ClaimStatus = "draft" | "needsReview" | "ready837p";
type ReviewStatus = "passed" | "warning" | "missing" | "needsReview";
type ModifierStatus = "applied" | "ignored" | "needsReview";

type PatientDraft = {
  name: string;
  id: string;
  mrn: string;
  genderAge: string;
  dob: string;
  payer: string;
  memberId: string;
  subscriberRelationship: string;
  dateOfService: string;
  careType: string;
};

type ProviderDraft = {
  rendering: string;
  ordering: string;
  billing: string;
  npi: string;
  taxId: string;
  placeOfService: string;
};

type DiagnosisDraft = {
  id: string;
  pointer: string;
  code: string;
  description: string;
  role: "primary" | "secondary";
  source: "AI Suggested" | "Clinician Confirmed" | "Needs Review";
  status: ReviewStatus;
};

type ServiceLineDraft = {
  id: string;
  lineNumber: number;
  dos: string;
  cptCode: string;
  description: string;
  modifiers: string[];
  modifierSuggested: boolean;
  diagnosisPointer: string;
  diagnosisPointerStatus: ReviewStatus;
  units: number;
  durationSeconds: number;
  durationText: string;
  charge: number | null;
  validation: ReviewStatus;
  source: string;
  bodyRegion: string;
};

type ModifierReview = {
  id: string;
  cptPair: string;
  reason: string;
  status: ModifierStatus;
};

type ValidationRow = {
  id: string;
  rule: string;
  status: ReviewStatus;
  explanation: string;
  action: string;
};

type DocumentationSupport = {
  soapAvailable: boolean;
  subjective: boolean;
  objective: boolean;
  assessment: boolean;
  plan: boolean;
  cptSupport: boolean;
  icdSupport: boolean;
};

type ClaimDraft = {
  sessionId: string;
  patient: PatientDraft;
  provider: ProviderDraft;
  diagnoses: DiagnosisDraft[];
  serviceLines: ServiceLineDraft[];
  modifiers: ModifierReview[];
  documentation: DocumentationSupport;
  status: ClaimStatus;
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

const copyByLanguage = {
  en: {
    title: "Claim Document",
    back: "Back",
    statusDraft: "Draft",
    statusNeedsReview: "Needs Review",
    statusReady837p: "Ready for 837P Review",
    export: "Export",
    submitClaim: "Submit Claim",
    submitUnavailable: "Claim submission is not connected yet. Export or save draft for now.",
    printClaim: "Print Claim Document",
    downloadClaimJson: "Download Claim Draft JSON",
    download837pJson: "Download 837P Draft JSON",
    summaryPatient: "Patient",
    mrnPatientId: "MRN / Patient ID",
    dateOfService: "Date of Service",
    renderingProvider: "Rendering Provider",
    payer: "Payer",
    claimType: "Claim Type",
    professionalClaim: "Professional Claim",
    format: "Format",
    draft837p: "837P Draft",
    totalUnits: "Total Units",
    totalLines: "Total CPT Lines",
    readiness: "837P Readiness",
    patientInformation: "Patient information",
    subscriberPayer: "Subscriber / payer information",
    providerInformation: "Provider information",
    diagnosisCodes: "Diagnosis codes",
    cptServiceLines: "CPT service lines",
    unitsCalculated: "Units calculated",
    modifiersReviewed: "Modifiers reviewed",
    diagnosisPointersAssigned: "Diagnosis pointers assigned",
    soapDocumentationAvailable: "SOAP documentation available",
    clinicianReviewRequired: "Clinician review required",
    passed: "Passed",
    warning: "Warning",
    missing: "Missing",
    needsReview: "Needs Review",
    patientSubscriber: "Patient & Subscriber",
    patientName: "Patient Name",
    patientIdMrn: "Patient ID / MRN",
    genderAge: "Gender / Age",
    dateOfBirth: "Date of Birth",
    payerSource: "Payer Source",
    memberId: "Member ID",
    subscriber: "Subscriber",
    relationship: "Relationship to Subscriber",
    rendering: "Rendering Provider",
    ordering: "Ordering / Referring Provider",
    billingProvider: "Billing Provider",
    npi: "NPI",
    taxId: "Tax ID",
    placeOfService: "Place of Service",
    requiredFinal: "Required for final claim submission",
    diagnosisSection: "Diagnosis Codes",
    pointer: "Diagnosis Pointer",
    icdCode: "ICD-10",
    description: "Description",
    primary: "Primary",
    secondary: "Secondary",
    source: "Source",
    aiSuggested: "AI Suggested",
    clinicianConfirmed: "Clinician Confirmed",
    needsClinicianReview: "Needs Clinician Review",
    serviceLines: "Service Lines",
    line: "Line #",
    dos: "DOS",
    cptHcpcs: "CPT / HCPCS",
    modifiers: "Modifiers",
    units: "Units",
    duration: "Duration",
    charge: "Charge",
    validation: "Validation",
    noCpt: "No CPT service lines found for this session. Review Billing Intelligence before export.",
    noDiagnosis: "No ICD-10 diagnosis attached. Needs clinician review.",
    claimValidation: "Claim Validation",
    rule: "Rule",
    explanation: "Explanation",
    actionNeeded: "Action needed",
    eightMinuteRule: "8-Minute Rule",
    cptIcdPairing: "CPT/ICD pairing",
    modifier59Review: "Modifier 59 review",
    mueUnitLimit: "MUE unit limit",
    ptpNcciConflict: "PTP/NCCI conflict",
    addonParentCode: "Add-on CPT parent code",
    documentationSupport: "Documentation Support",
    missingRequiredFields: "Missing required claim fields",
    cptIcdReview: "CPT/ICD pairing requires review",
    documentation: "Documentation Support",
    soapAvailable: "SOAP Note Available",
    subjectivePresent: "Subjective present",
    objectivePresent: "Objective present",
    assessmentPresent: "Assessment present",
    planPresent: "Plan present",
    cptSupportPresent: "CPT support present",
    icdSupportPresent: "ICD support present",
    saveDraft: "Save Draft",
    editSessionData: "Edit Session Data",
    verifyClaim: "Verify Claim",
    export837pDraft: "Export 837P Draft",
    saved: "Claim draft saved locally.",
    verified: "Claim validation updated.",
    exported: "837P draft JSON downloaded.",
    printPrepared: "Print view is being prepared.",
    unknown: "Needs Review",
    notAvailable: "Needs Review",
    readyNote: "All required 837P draft review items passed.",
    reviewNote: "Review the flagged claim fields before clearinghouse export.",
    finalSubmissionGuardrail: "AI-assisted claim draft. Clinician and billing team review are required before final submission.",
  },
  ar: {
    title: "مستند المطالبة",
    back: "رجوع",
    statusDraft: "مسودة",
    statusNeedsReview: "يحتاج إلى مراجعة",
    statusReady837p: "جاهز لمراجعة 837P",
    export: "تصدير",
    submitClaim: "إرسال المطالبة",
    submitUnavailable: "إرسال المطالبة غير متصل بعد. قم بالتصدير أو حفظ المسودة حاليا.",
    printClaim: "طباعة مستند المطالبة",
    downloadClaimJson: "تنزيل مسودة المطالبة JSON",
    download837pJson: "تنزيل مسودة 837P JSON",
    summaryPatient: "المريض",
    mrnPatientId: "MRN / معرف المريض",
    dateOfService: "تاريخ الخدمة",
    renderingProvider: "مقدم الخدمة المنفذ",
    payer: "جهة الدفع",
    claimType: "نوع المطالبة",
    professionalClaim: "مطالبة مهنية",
    format: "التنسيق",
    draft837p: "مسودة 837P",
    totalUnits: "إجمالي الوحدات",
    totalLines: "إجمالي بنود CPT",
    readiness: "جاهزية 837P",
    patientInformation: "معلومات المريض",
    subscriberPayer: "معلومات المشترك / جهة الدفع",
    providerInformation: "معلومات مقدم الخدمة",
    diagnosisCodes: "رموز التشخيص",
    cptServiceLines: "بنود خدمة CPT",
    unitsCalculated: "تم حساب الوحدات",
    modifiersReviewed: "تمت مراجعة المعدلات",
    diagnosisPointersAssigned: "تم تعيين مؤشرات التشخيص",
    soapDocumentationAvailable: "توثيق SOAP متاح",
    clinicianReviewRequired: "مراجعة الطبيب مطلوبة",
    passed: "تم الاجتياز",
    warning: "تحذير",
    missing: "مفقود",
    needsReview: "يحتاج إلى مراجعة",
    patientSubscriber: "المريض والمشترك",
    patientName: "اسم المريض",
    patientIdMrn: "معرف المريض / MRN",
    genderAge: "الجنس / العمر",
    dateOfBirth: "تاريخ الميلاد",
    payerSource: "مصدر الدفع",
    memberId: "رقم العضوية",
    subscriber: "المشترك",
    relationship: "العلاقة بالمشترك",
    rendering: "مقدم الخدمة المنفذ",
    ordering: "مقدم الطلب / الإحالة",
    billingProvider: "مقدم خدمة الفوترة",
    npi: "NPI",
    taxId: "الرقم الضريبي",
    placeOfService: "مكان الخدمة",
    requiredFinal: "مطلوب للإرسال النهائي للمطالبة",
    diagnosisSection: "رموز التشخيص",
    pointer: "مؤشر التشخيص",
    icdCode: "ICD-10",
    description: "الوصف",
    primary: "أساسي",
    secondary: "ثانوي",
    source: "المصدر",
    aiSuggested: "مقترح بالذكاء الاصطناعي",
    clinicianConfirmed: "مؤكد من الطبيب",
    needsClinicianReview: "يحتاج إلى مراجعة الطبيب",
    serviceLines: "بنود الخدمة",
    line: "رقم البند",
    dos: "تاريخ الخدمة",
    cptHcpcs: "CPT / HCPCS",
    modifiers: "المعدلات",
    units: "الوحدات",
    duration: "المدة",
    charge: "الرسوم",
    validation: "التحقق",
    noCpt: "لا توجد بنود خدمة CPT لهذه الجلسة. راجع ذكاء الفوترة قبل التصدير.",
    noDiagnosis: "لا يوجد تشخيص ICD-10 مرفق. يحتاج إلى مراجعة الطبيب.",
    claimValidation: "التحقق من المطالبة",
    rule: "القاعدة",
    explanation: "التفسير",
    actionNeeded: "الإجراء المطلوب",
    eightMinuteRule: "قاعدة الثماني دقائق",
    cptIcdPairing: "ربط CPT/ICD",
    modifier59Review: "مراجعة المعدل 59",
    mueUnitLimit: "حد وحدات MUE",
    ptpNcciConflict: "تعارض PTP/NCCI",
    addonParentCode: "الرمز الأب للإضافات",
    documentationSupport: "دعم التوثيق",
    missingRequiredFields: "حقول المطالبة المطلوبة المفقودة",
    cptIcdReview: "ربط CPT/ICD يحتاج إلى مراجعة",
    documentation: "دعم التوثيق",
    soapAvailable: "ملاحظة SOAP متاحة",
    subjectivePresent: "القسم الذاتي موجود",
    objectivePresent: "القسم الموضوعي موجود",
    assessmentPresent: "قسم التقييم موجود",
    planPresent: "قسم الخطة موجود",
    cptSupportPresent: "دعم CPT موجود",
    icdSupportPresent: "دعم ICD موجود",
    saveDraft: "حفظ كمسودة",
    editSessionData: "تعديل بيانات الجلسة",
    verifyClaim: "التحقق من المطالبة",
    export837pDraft: "تصدير مسودة 837P",
    saved: "تم حفظ مسودة المطالبة محليا.",
    verified: "تم تحديث تحقق المطالبة.",
    exported: "تم تنزيل مسودة 837P بصيغة JSON.",
    printPrepared: "جار تحضير عرض الطباعة.",
    unknown: "يحتاج إلى مراجعة",
    notAvailable: "يحتاج إلى مراجعة",
    readyNote: "تم اجتياز كل عناصر مراجعة مسودة 837P المطلوبة.",
    reviewNote: "راجع حقول المطالبة المحددة قبل تصديرها لغرفة المقاصة.",
    finalSubmissionGuardrail: "مسودة مطالبة بمساعدة الذكاء الاصطناعي. مراجعة الطبيب وفريق الفوترة مطلوبة قبل الإرسال النهائي.",
  },
} as const;

type ClaimCopy = Record<keyof typeof copyByLanguage.en, string>;

const cptChargeSchedule: Record<string, number> = {
  "97110": 42,
  "97112": 48,
  "97116": 44,
  "97140": 46,
  "97530": 52,
  "97535": 47,
};

const pointerLetters = ["A", "B", "C", "D"];

function safeParse<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function parseDurationToSeconds(value: string | null | undefined) {
  if (!value) return 0;
  const clockMatch = value.match(/^(\d{1,3}):(\d{2})(?::(\d{2}))?$/);
  if (clockMatch) {
    const first = Number(clockMatch[1]);
    const second = Number(clockMatch[2]);
    const third = clockMatch[3] ? Number(clockMatch[3]) : null;
    return third === null ? first * 60 + second : first * 3600 + second * 60 + third;
  }
  const minuteMatch = value.match(/(\d+(?:\.\d+)?)\s*(min|minute|minutes)/i);
  return minuteMatch ? Math.round(Number(minuteMatch[1]) * 60) : 0;
}

function cptUnitsFromSeconds(totalSeconds: number) {
  if (totalSeconds < 8 * 60) return 0;
  if (totalSeconds < 23 * 60) return 1;
  if (totalSeconds < 38 * 60) return 2;
  if (totalSeconds < 53 * 60) return 3;
  if (totalSeconds < 68 * 60) return 4;
  return 5 + Math.floor((totalSeconds - 68 * 60) / (15 * 60));
}

function normalizeClaimStatus(status: ReviewStatus, copy: ClaimCopy) {
  if (status === "passed") return copy.passed;
  if (status === "warning") return copy.warning;
  if (status === "missing") return copy.missing;
  return copy.needsReview;
}

function statusLabel(status: ClaimStatus, copy: ClaimCopy) {
  if (status === "ready837p") return copy.statusReady837p;
  if (status === "needsReview") return copy.statusNeedsReview;
  return copy.statusDraft;
}

function secondsText(seconds: number, fallback: string, language: "en" | "ar" | "he") {
  return seconds > 0 ? formatClockTime(seconds, language) : translateDynamicMessage(fallback, language);
}

function displayOrReview(value: string | null | undefined, copy: ClaimCopy, language: "en" | "ar" | "he") {
  return value && value.trim() ? translateDynamicMessage(value, language) : copy.notAvailable;
}

function emptyClaim(sessionId: string): ClaimDraft {
  const session = getSessionById(sessionId);
  return {
    sessionId,
    patient: {
      name: session.name,
      id: session.id,
      mrn: session.mrn,
      genderAge: session.ageSex,
      dob: "",
      payer: session.payor,
      memberId: "",
      subscriberRelationship: "",
      dateOfService: session.time,
      careType: session.careType,
    },
    provider: {
      rendering: "Dr. Sarah Miller",
      ordering: "",
      billing: "",
      npi: "",
      taxId: "",
      placeOfService: "",
    },
    diagnoses: session.icd
      ? [
          {
            id: `session-${session.icd}`,
            pointer: "A",
            code: session.icd,
            description: session.careType,
            role: "primary",
            source: "Needs Review",
            status: "needsReview",
          },
        ]
      : [],
    serviceLines: [],
    modifiers: [],
    documentation: {
      soapAvailable: false,
      subjective: false,
      objective: false,
      assessment: false,
      plan: false,
      cptSupport: false,
      icdSupport: Boolean(session.icd),
    },
    status: "draft",
  };
}

function uniqueDiagnoses(items: DiagnosisDraft[]) {
  const seen = new Set<string>();
  return items
    .filter((item) => item.code || item.description)
    .filter((item) => {
      const key = item.code || item.description;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map((item, index) => ({ ...item, pointer: pointerLetters[index] ?? String.fromCharCode(65 + index) }));
}

function uniqueServiceLines(items: ServiceLineDraft[]) {
  const byCode = new Map<string, ServiceLineDraft>();
  items.forEach((item) => {
    const current = byCode.get(item.cptCode);
    if (!current || item.durationSeconds > current.durationSeconds || item.units > current.units) {
      byCode.set(item.cptCode, item);
    }
  });
  return Array.from(byCode.values()).map((item, index) => ({ ...item, lineNumber: index + 1 }));
}

function serviceLineFromCptRecord(record: ApiCptRecord, index: number, dos: string): ServiceLineDraft {
  const units = record.units || cptUnitsFromSeconds(record.seconds || 0);
  return {
    id: `record-${record.code}-${index}`,
    lineNumber: index + 1,
    dos,
    cptCode: record.code,
    description: record.displayName || record.code,
    modifiers: [],
    modifierSuggested: false,
    diagnosisPointer: "",
    diagnosisPointerStatus: "needsReview",
    units,
    durationSeconds: record.seconds || 0,
    durationText: "",
    charge: cptChargeSchedule[record.code] ? cptChargeSchedule[record.code] * Math.max(units, 1) : null,
    validation: units > 0 ? "passed" : "warning",
    source: "CPT record",
    bodyRegion: record.bodyRegion ?? "",
  };
}

function serviceLineFromBilling(item: ApiBilling["cptCodes"][number], index: number, dos: string): ServiceLineDraft {
  const seconds = parseDurationToSeconds(item.duration);
  const units = Number.parseInt(item.units, 10) || cptUnitsFromSeconds(seconds);
  const needsModifierReview = item.warning?.toLowerCase().includes("modifier") || item.note?.toLowerCase().includes("modifier");
  return {
    id: item.id || `billing-${item.code}-${index}`,
    lineNumber: index + 1,
    dos,
    cptCode: item.code,
    description: item.title,
    modifiers: item.status === "approved" && needsModifierReview ? ["59"] : [],
    modifierSuggested: Boolean(needsModifierReview && item.status !== "approved"),
    diagnosisPointer: "",
    diagnosisPointerStatus: "needsReview",
    units,
    durationSeconds: seconds,
    durationText: item.duration,
    charge: cptChargeSchedule[item.code] ? cptChargeSchedule[item.code] * Math.max(units, 1) : null,
    validation: needsModifierReview && item.status !== "approved" ? "needsReview" : units > 0 ? "passed" : "warning",
    source: "Billing Intelligence",
    bodyRegion: "",
  };
}

function serviceLineFromClaim(item: ApiClaim["cptItems"][number], index: number, dos: string): ServiceLineDraft {
  const seconds = parseDurationToSeconds(item.duration);
  const units = Number.parseInt(item.units, 10) || cptUnitsFromSeconds(seconds);
  const modifier = item.modifier.replace(/modifier\s*/i, "").trim();
  return {
    id: item.id || `claim-${item.code}-${index}`,
    lineNumber: index + 1,
    dos,
    cptCode: item.code,
    description: item.description,
    modifiers: modifier ? [modifier] : [],
    modifierSuggested: false,
    diagnosisPointer: "",
    diagnosisPointerStatus: "needsReview",
    units,
    durationSeconds: seconds,
    durationText: item.duration,
    charge: cptChargeSchedule[item.code] ? cptChargeSchedule[item.code] * Math.max(units, 1) : null,
    validation: units > 0 ? "passed" : "warning",
    source: "Claim draft",
    bodyRegion: "",
  };
}

function applyDiagnosisPointers(claim: ClaimDraft): ClaimDraft {
  const fallbackPointer = claim.diagnoses[1]?.pointer ?? claim.diagnoses[0]?.pointer ?? "";
  return {
    ...claim,
    serviceLines: claim.serviceLines.map((line) => ({
      ...line,
      diagnosisPointer: line.diagnosisPointer || fallbackPointer,
      diagnosisPointerStatus: line.diagnosisPointer ? "passed" : fallbackPointer ? "needsReview" : "missing",
    })),
  };
}

function applySoap(claim: ClaimDraft, data: StoredSoap | null, source: DiagnosisDraft["source"]): ClaimDraft {
  if (!data) return claim;
  const soap = data.soap_note ?? data;
  const subjective = typeof soap.subjective === "object" && soap.subjective ? soap.subjective : null;
  const objective = typeof soap.objective === "object" && soap.objective ? soap.objective : null;
  const assessment = typeof soap.assessment === "object" && soap.assessment ? soap.assessment : null;
  const plan = typeof soap.plan === "object" && soap.plan ? soap.plan : null;
  const diagnosisSummary =
    assessment?.diagnosisSummary ??
    data.diagnosis_summary ??
    (typeof soap.assessment === "string" ? soap.assessment : "");
  const primaryCode = assessment?.primaryDiagnosisCode ?? "";
  const detectedDiagnoses =
    data.detected_icd10_suggestions?.map((suggestion, index) => ({
      id: `detected-${suggestion.code ?? index}`,
      pointer: pointerLetters[index] ?? "A",
      code: suggestion.code ?? "",
      description: suggestion.reason ?? suggestion.phrase ?? diagnosisSummary,
      role: index === 0 ? ("primary" as const) : ("secondary" as const),
      source,
      status: "needsReview" as const,
    })) ?? [];
  const soapDiagnosis = primaryCode
    ? [
        {
          id: `soap-${primaryCode}`,
          pointer: "A",
          code: primaryCode,
          description: diagnosisSummary || primaryCode,
          role: "primary" as const,
          source,
          status: source === "Clinician Confirmed" ? ("passed" as const) : ("needsReview" as const),
        },
      ]
    : [];
  const serviceLines = data.billing_summary?.cpt_records?.map((record, index) =>
    serviceLineFromCptRecord(record, index, claim.patient.dateOfService),
  ) ?? [];
  return {
    ...claim,
    diagnoses: uniqueDiagnoses([...claim.diagnoses, ...soapDiagnosis, ...detectedDiagnoses]),
    serviceLines: uniqueServiceLines([...claim.serviceLines, ...serviceLines]),
    documentation: {
      soapAvailable: Boolean(data.soap_note || data.summary || subjective || objective || assessment || plan),
      subjective: Boolean(subjective?.chiefComplaint || typeof soap.subjective === "string"),
      objective: Boolean(objective?.observationNotes || typeof soap.objective === "string"),
      assessment: Boolean(assessment?.diagnosisSummary || typeof soap.assessment === "string"),
      plan: Boolean(plan?.followUpPlan || typeof soap.plan === "string"),
      cptSupport: claim.serviceLines.length > 0 || serviceLines.length > 0,
      icdSupport: claim.diagnoses.length > 0 || soapDiagnosis.length > 0 || detectedDiagnoses.length > 0,
    },
    modifiers: [
      ...claim.modifiers,
      ...(data.modifier59_suggestions ?? []).map((suggestion, index) => ({
        id: suggestion.id || `modifier-${index}`,
        cptPair: suggestion.codes.join(" / "),
        reason: suggestion.description,
        status:
          suggestion.status === "applied"
            ? ("applied" as const)
            : suggestion.status === "ignored"
              ? ("ignored" as const)
              : ("needsReview" as const),
      })),
    ],
  };
}

function applyBilling(claim: ClaimDraft, billing: ApiBilling | null): ClaimDraft {
  if (!billing) return claim;
  return {
    ...claim,
    serviceLines: uniqueServiceLines([
      ...claim.serviceLines,
      ...billing.cptCodes.map((item, index) => serviceLineFromBilling(item, index, claim.patient.dateOfService)),
    ]),
  };
}

function applyTimerState(claim: ClaimDraft, timer: ApiTimerState | null): ClaimDraft {
  if (!timer) return claim;
  return {
    ...claim,
    serviceLines: uniqueServiceLines([
      ...claim.serviceLines,
      ...(timer.cpt_records ?? []).map((record, index) => serviceLineFromCptRecord(record, index, claim.patient.dateOfService)),
    ]),
  };
}

function applyClaimApi(claim: ClaimDraft, apiClaim: ApiClaim | null): ClaimDraft {
  if (!apiClaim) return claim;
  return {
    ...claim,
    patient: {
      ...claim.patient,
      name: apiClaim.patientMeta.patient || claim.patient.name,
      mrn: apiClaim.patientMeta.mrn || claim.patient.mrn,
      payer: apiClaim.patientMeta.payor || claim.patient.payer,
    },
    provider: {
      ...claim.provider,
      rendering: apiClaim.patientMeta.provider || claim.provider.rendering,
      ordering: apiClaim.patientMeta.provider || claim.provider.ordering,
    },
    diagnoses: uniqueDiagnoses([
      ...claim.diagnoses,
      ...apiClaim.diagnosisCodes.map((diagnosis, index) => ({
        id: diagnosis.id,
        pointer: pointerLetters[index] ?? "A",
        code: diagnosis.code,
        description: diagnosis.description,
        role: diagnosis.type === "Primary" ? ("primary" as const) : ("secondary" as const),
        source: "Needs Review" as const,
        status: "needsReview" as const,
      })),
    ]),
    serviceLines: uniqueServiceLines([
      ...claim.serviceLines,
      ...apiClaim.cptItems.map((item, index) => serviceLineFromClaim(item, index, claim.patient.dateOfService)),
    ]),
    status: apiClaim.claimStatus === "verified" ? "ready837p" : "draft",
  };
}

function applySessionApi(claim: ClaimDraft, session: UpcomingSession): ClaimDraft {
  return {
    ...claim,
    patient: {
      ...claim.patient,
      name: session.name || claim.patient.name,
      id: session.id || claim.patient.id,
      mrn: session.mrn || claim.patient.mrn,
      genderAge: session.ageSex || claim.patient.genderAge,
      payer: session.payor || claim.patient.payer,
      careType: session.careType || claim.patient.careType,
      dateOfService: session.time || claim.patient.dateOfService,
    },
    diagnoses:
      claim.diagnoses.length > 0 || !session.icd
        ? claim.diagnoses
        : uniqueDiagnoses([
            {
              id: `session-${session.icd}`,
              pointer: "A",
              code: session.icd,
              description: session.careType,
              role: "primary",
              source: "Needs Review",
              status: "needsReview",
            },
          ]),
  };
}

function buildReadiness(claim: ClaimDraft, copy: ClaimCopy) {
  const hasModifierReview = !claim.serviceLines.some((line) => line.modifierSuggested) &&
    !claim.modifiers.some((modifier) => modifier.status === "needsReview");
  const hasPointers = claim.serviceLines.length > 0 && claim.serviceLines.every((line) => line.diagnosisPointer);
  return [
    { id: "patient", label: copy.patientInformation, status: claim.patient.name && claim.patient.mrn ? "passed" : "missing" },
    { id: "subscriber", label: copy.subscriberPayer, status: claim.patient.payer ? "passed" : "missing" },
    { id: "provider", label: copy.providerInformation, status: claim.provider.rendering ? "passed" : "missing" },
    { id: "diagnosis", label: copy.diagnosisCodes, status: claim.diagnoses.length > 0 ? "needsReview" : "missing" },
    { id: "service-lines", label: copy.cptServiceLines, status: claim.serviceLines.length > 0 ? "passed" : "missing" },
    {
      id: "units",
      label: copy.unitsCalculated,
      status:
        claim.serviceLines.length > 0 && claim.serviceLines.every((line) => line.units > 0)
          ? "passed"
          : claim.serviceLines.length > 0
            ? "warning"
            : "missing",
    },
    { id: "modifiers", label: copy.modifiersReviewed, status: hasModifierReview ? "passed" : "needsReview" },
    { id: "pointers", label: copy.diagnosisPointersAssigned, status: hasPointers ? "needsReview" : "missing" },
    { id: "soap", label: copy.soapDocumentationAvailable, status: claim.documentation.soapAvailable ? "passed" : "missing" },
    { id: "clinician", label: copy.clinicianReviewRequired, status: "needsReview" },
  ] satisfies Array<{ id: string; label: string; status: ReviewStatus }>;
}

function buildValidation(claim: ClaimDraft, copy: ClaimCopy, language: "en" | "ar" | "he"): ValidationRow[] {
  const hasCpt = claim.serviceLines.length > 0;
  const hasDiagnosis = claim.diagnoses.length > 0;
  const belowThreshold = claim.serviceLines.some((line) => line.units <= 0 || (line.durationSeconds > 0 && line.durationSeconds < 8 * 60));
  const modifierNeedsReview =
    claim.serviceLines.some((line) => line.modifierSuggested) ||
    claim.modifiers.some((modifier) => modifier.status === "needsReview");
  const missingFields = [
    claim.patient.name ? "" : copy.patientName,
    claim.patient.mrn ? "" : "MRN",
    claim.patient.payer ? "" : copy.payer,
    claim.provider.rendering ? "" : copy.renderingProvider,
    claim.provider.npi ? copy.npi : "",
    claim.provider.taxId ? copy.taxId : "",
  ].filter(Boolean);

  return [
    {
      id: "eight-minute",
      rule: copy.eightMinuteRule,
      status: !hasCpt ? "missing" : belowThreshold ? "warning" : "passed",
      explanation: hasCpt ? `${copy.duration}: ${formatClockTime(claim.serviceLines.reduce((sum, line) => sum + line.durationSeconds, 0), language)}` : copy.noCpt,
      action: belowThreshold ? copy.reviewNote : copy.readyNote,
    },
    {
      id: "cpt-icd",
      rule: copy.cptIcdPairing,
      status: hasCpt && hasDiagnosis ? "needsReview" : "missing",
      explanation: copy.cptIcdReview,
      action: copy.needsClinicianReview,
    },
    {
      id: "modifier-59",
      rule: copy.modifier59Review,
      status: modifierNeedsReview ? "needsReview" : "passed",
      explanation: modifierNeedsReview ? copy.reviewNote : copy.readyNote,
      action: modifierNeedsReview ? copy.needsClinicianReview : copy.passed,
    },
    {
      id: "mue",
      rule: copy.mueUnitLimit,
      status: belowThreshold ? "warning" : hasCpt ? "passed" : "missing",
      explanation: belowThreshold ? copy.reviewNote : copy.readyNote,
      action: belowThreshold ? copy.needsReview : copy.passed,
    },
    {
      id: "ptp-ncci",
      rule: copy.ptpNcciConflict,
      status: modifierNeedsReview ? "warning" : "passed",
      explanation: modifierNeedsReview ? copy.reviewNote : copy.readyNote,
      action: modifierNeedsReview ? copy.needsReview : copy.passed,
    },
    {
      id: "addon",
      rule: copy.addonParentCode,
      status: hasCpt ? "passed" : "missing",
      explanation: hasCpt ? copy.readyNote : copy.noCpt,
      action: hasCpt ? copy.passed : copy.needsReview,
    },
    {
      id: "documentation",
      rule: copy.documentationSupport,
      status: claim.documentation.soapAvailable ? "needsReview" : "missing",
      explanation: claim.documentation.soapAvailable ? copy.needsClinicianReview : copy.noDiagnosis,
      action: copy.needsClinicianReview,
    },
    {
      id: "missing-fields",
      rule: copy.missingRequiredFields,
      status: missingFields.length > 0 ? "missing" : "passed",
      explanation: missingFields.length > 0 ? missingFields.join(", ") : copy.readyNote,
      action: missingFields.length > 0 ? copy.needsReview : copy.passed,
    },
  ];
}

function buildExportPayload(
  claim: ClaimDraft,
  validationResults: ValidationRow[],
  documentationRows: Array<{ id: string; label: string; status: ReviewStatus }>,
) {
  return {
    claimType: "837P_DRAFT",
    sessionId: claim.sessionId,
    patient: claim.patient,
    subscriber: {
      memberId: claim.patient.memberId,
      relationship: claim.patient.subscriberRelationship,
    },
    payer: {
      source: claim.patient.payer,
    },
    providers: claim.provider,
    diagnoses: claim.diagnoses,
    serviceLines: claim.serviceLines,
    modifiers: claim.modifiers,
    validationResults,
    documentationSupport: documentationRows,
    generatedAt: new Date().toISOString(),
  };
}

function ClaimDocumentPageContent() {
  const searchParams = useSearchParams();
  const [headerSearch, setHeaderSearch] = useState("");
  const [sessionId, setSessionId] = useState("samuel-thompson");
  const [claim, setClaim] = useState<ClaimDraft>(() => emptyClaim("samuel-thompson"));
  const [statusMessage, setStatusMessage] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const { soapData, hasGeneratedDocumentation } = useSessionDocumentation();
  const { language, t } = useLanguage();
  const copy: ClaimCopy = language === "ar" ? copyByLanguage.ar : copyByLanguage.en;
  const routeSessionId = searchParams.get("sessionId") ?? searchParams.get("id") ?? "";
  const sessionQuery = `?sessionId=${encodeURIComponent(sessionId)}`;

  useEffect(() => {
    const activeSessionId = routeSessionId || getActiveSessionId();
    setSessionId(activeSessionId);
    setActiveSessionId(activeSessionId);

    let isMounted = true;

    const loadClaim = async () => {
      let nextClaim = emptyClaim(activeSessionId);
      const storedSoap = safeParse<StoredSoap>(window.localStorage.getItem(`medexa_soap_note_${activeSessionId}`));
      const storedCpt = safeParse<ApiCptRecord[] | Record<string, ApiCptRecord>>(
        window.localStorage.getItem(`medexa_cpt_records_${activeSessionId}`),
      );
      const storedState = safeParse<ApiTimerState>(window.localStorage.getItem(`medexa_session_state_${activeSessionId}`));
      const storedClaim = safeParse<ClaimDraft>(window.localStorage.getItem(`medexa_claim_draft_${activeSessionId}`));

      nextClaim = applySoap(nextClaim, storedSoap, "AI Suggested");
      if (Array.isArray(storedCpt)) {
        nextClaim = {
          ...nextClaim,
          serviceLines: uniqueServiceLines([
            ...nextClaim.serviceLines,
            ...storedCpt.map((record, index) => serviceLineFromCptRecord(record, index, nextClaim.patient.dateOfService)),
          ]),
        };
      } else if (storedCpt) {
        nextClaim = {
          ...nextClaim,
          serviceLines: uniqueServiceLines([
            ...nextClaim.serviceLines,
            ...Object.values(storedCpt).map((record, index) => serviceLineFromCptRecord(record, index, nextClaim.patient.dateOfService)),
          ]),
        };
      }
      nextClaim = applyTimerState(nextClaim, storedState);
      if (storedClaim?.sessionId === activeSessionId) {
        nextClaim = {
          ...nextClaim,
          ...storedClaim,
          patient: { ...nextClaim.patient, ...storedClaim.patient },
          provider: { ...nextClaim.provider, ...storedClaim.provider },
          diagnoses: uniqueDiagnoses([...nextClaim.diagnoses, ...storedClaim.diagnoses]),
          serviceLines: uniqueServiceLines([...nextClaim.serviceLines, ...storedClaim.serviceLines]),
          modifiers: [...nextClaim.modifiers, ...storedClaim.modifiers],
          documentation: { ...nextClaim.documentation, ...storedClaim.documentation },
        };
      }

      const [apiSession, apiSoap, apiBilling, apiTimer, apiClaim] = await Promise.all([
        medexaApi.session(activeSessionId),
        medexaApi.getSoapNote(activeSessionId, language),
        medexaApi.billing(activeSessionId),
        medexaApi.getTimerState(activeSessionId),
        medexaApi.claim(activeSessionId),
      ]);

      if (!isMounted) return;

      if (apiSession) {
        nextClaim = applySessionApi(nextClaim, {
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
      nextClaim = applySoap(nextClaim, apiSoap as StoredSoap | null, "AI Suggested");
      nextClaim = applyBilling(nextClaim, apiBilling);
      nextClaim = applyTimerState(nextClaim, apiTimer);
      nextClaim = applyClaimApi(nextClaim, apiClaim);
      nextClaim = applyDiagnosisPointers(nextClaim);

      setClaim(nextClaim);
    };

    loadClaim();

    return () => {
      isMounted = false;
    };
  }, [language, routeSessionId]);

  useEffect(() => {
    if (!hasGeneratedDocumentation) return;
    setClaim((current) =>
      applyDiagnosisPointers(
        applySoap(
          current,
          {
            soap_note: soapData,
            billing_summary: { total_seconds: current.serviceLines.reduce((sum, line) => sum + line.durationSeconds, 0), cpt_records: [] },
          },
          "AI Suggested",
        ),
      ),
    );
  }, [hasGeneratedDocumentation, soapData]);

  const totalUnits = useMemo(() => claim.serviceLines.reduce((total, line) => total + line.units, 0), [claim.serviceLines]);
  const readinessRows = useMemo(() => buildReadiness(claim, copy), [claim, copy]);
  const validationRows = useMemo(() => buildValidation(claim, copy, language), [claim, copy, language]);
  const documentationRows = useMemo(
    () => [
      { id: "soap", label: copy.soapAvailable, status: claim.documentation.soapAvailable ? "passed" : "needsReview" },
      { id: "subjective", label: copy.subjectivePresent, status: claim.documentation.subjective ? "passed" : "needsReview" },
      { id: "objective", label: copy.objectivePresent, status: claim.documentation.objective ? "passed" : "needsReview" },
      { id: "assessment", label: copy.assessmentPresent, status: claim.documentation.assessment ? "passed" : "needsReview" },
      { id: "plan", label: copy.planPresent, status: claim.documentation.plan ? "passed" : "needsReview" },
      { id: "cpt", label: copy.cptSupportPresent, status: claim.documentation.cptSupport || claim.serviceLines.length > 0 ? "passed" : "needsReview" },
      { id: "icd", label: copy.icdSupportPresent, status: claim.documentation.icdSupport || claim.diagnoses.length > 0 ? "passed" : "needsReview" },
    ] satisfies Array<{ id: string; label: string; status: ReviewStatus }>,
    [claim, copy],
  );
  const pageStatus: ClaimStatus = useMemo(() => {
    if (readinessRows.every((row) => row.status === "passed") && validationRows.every((row) => row.status === "passed")) {
      return "ready837p";
    }
    if (readinessRows.some((row) => row.status === "missing") || validationRows.some((row) => row.status === "missing" || row.status === "needsReview")) {
      return "needsReview";
    }
    return "draft";
  }, [readinessRows, validationRows]);

  const downloadJson = (payload: unknown, fileName: string, message: string) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    setStatusMessage(message);
  };

  const export837pDraft = () => {
    downloadJson(
      buildExportPayload(claim, validationRows, documentationRows),
      `medexa-837p-draft-${sessionId}.json`,
      copy.exported,
    );
  };

  const exportClaimDraft = () => {
    downloadJson({ ...claim, validationResults: validationRows, documentationSupport: documentationRows }, `medexa-claim-draft-${sessionId}.json`, copy.exported);
  };

  const printClaim = () => {
    setShowExportMenu(false);
    setStatusMessage(copy.printPrepared);
    window.print();
  };

  const saveDraft = () => {
    window.localStorage.setItem(`medexa_claim_draft_${sessionId}`, JSON.stringify({ ...claim, status: pageStatus }));
    medexaApi.saveClaimDraft(sessionId);
    setStatusMessage(copy.saved);
  };

  const verifyClaim = () => {
    const nextClaim = { ...claim, status: pageStatus };
    setClaim(nextClaim);
    window.localStorage.setItem(`medexa_claim_draft_${sessionId}`, JSON.stringify(nextClaim));
    setStatusMessage(copy.verified);
  };

  const submitClaim = async () => {
    const submitted = await medexaApi.submitClaim(sessionId);
    setStatusMessage(submitted ? copy.readyNote : copy.submitUnavailable);
  };

  return (
    <main className="ambient-page">
      <MedexaHeader searchValue={headerSearch} onSearchChange={setHeaderSearch} />

      <section className="claim-content">
        <section className="claim-top">
          <div className="claim-title-row">
            <div className="title-group">
              <Link href={`/billing-intelligence${sessionQuery}`} className="back-link" aria-label={copy.back}>
                ‹
              </Link>
              <div>
                <h1>{copy.title}</h1>
                <p>{copy.finalSubmissionGuardrail}</p>
              </div>
              <span className={`status-chip ${pageStatus}`}>{statusLabel(pageStatus, copy)}</span>
            </div>

            <div className="top-actions">
              <div className="export-wrap">
                <button type="button" onClick={() => setShowExportMenu((value) => !value)}>
                  {copy.export}
                </button>
                {showExportMenu && (
                  <div className="export-menu">
                    <button type="button" onClick={printClaim}>{copy.printClaim}</button>
                    <button type="button" onClick={exportClaimDraft}>{copy.downloadClaimJson}</button>
                    <button type="button" onClick={export837pDraft}>{copy.download837pJson}</button>
                  </div>
                )}
              </div>
              <button type="button" className="submit-button" onClick={submitClaim}>
                {copy.submitClaim}
              </button>
            </div>
          </div>

          <div className="summary-strip">
            {[
              [copy.summaryPatient, claim.patient.name],
              [copy.mrnPatientId, claim.patient.mrn || claim.patient.id],
              [copy.dateOfService, claim.patient.dateOfService],
              [copy.renderingProvider, claim.provider.rendering],
              [copy.payer, claim.patient.payer],
              [copy.claimType, copy.professionalClaim],
              [copy.format, copy.draft837p],
              [copy.totalUnits, formatNumber(totalUnits, language)],
              [copy.totalLines, formatNumber(claim.serviceLines.length, language)],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{displayOrReview(value, copy, language)}</strong>
              </div>
            ))}
          </div>

          {statusMessage && <div className="status-message">{statusMessage}</div>}
        </section>

        <nav className="tabs" aria-label="Session views">
          <Link href={`/soap-notes${sessionQuery}`}>{t("nav.soapNotes")}</Link>
          <Link href={`/billing-intelligence${sessionQuery}`}>{t("nav.billingIntelligence")}</Link>
          <Link href={`/patient-summary${sessionQuery}`}>{t("nav.patientSummary")}</Link>
          <Link href={`/claim-document${sessionQuery}`} className="tab-active">{t("nav.claimDocument")}</Link>
        </nav>

        <section className="claim-card wide">
          <div className="section-heading">
            <h2>{copy.readiness}</h2>
            <span className={`status-chip ${pageStatus}`}>{statusLabel(pageStatus, copy)}</span>
          </div>
          <div className="readiness-grid">
            {readinessRows.map((row) => (
              <div className="readiness-item" key={row.id}>
                <strong>{row.label}</strong>
                <span className={`mini-status ${row.status}`}>{normalizeClaimStatus(row.status, copy)}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="claim-grid two">
          <article className="claim-card">
            <div className="section-heading">
              <h2>{copy.patientSubscriber}</h2>
            </div>
            <div className="info-grid">
              {[
                [copy.patientName, claim.patient.name],
                [copy.patientIdMrn, claim.patient.mrn || claim.patient.id],
                [copy.genderAge, claim.patient.genderAge],
                [copy.dateOfBirth, claim.patient.dob],
                [copy.payerSource, claim.patient.payer],
                [copy.memberId, claim.patient.memberId],
                [copy.relationship, claim.patient.subscriberRelationship],
              ].map(([label, value]) => (
                <div className="info-item" key={label}>
                  <span>{label}</span>
                  <strong>{displayOrReview(value, copy, language)}</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="claim-card">
            <div className="section-heading">
              <h2>{copy.providerInformation}</h2>
            </div>
            <div className="info-grid">
              {[
                [copy.rendering, claim.provider.rendering],
                [copy.ordering, claim.provider.ordering],
                [copy.billingProvider, claim.provider.billing],
                [copy.npi, claim.provider.npi || copy.requiredFinal],
                [copy.taxId, claim.provider.taxId || copy.requiredFinal],
                [copy.placeOfService, claim.provider.placeOfService || copy.requiredFinal],
              ].map(([label, value]) => (
                <div className="info-item" key={label}>
                  <span>{label}</span>
                  <strong>{displayOrReview(value, copy, language)}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="claim-card wide">
          <div className="section-heading">
            <h2>{copy.diagnosisSection}</h2>
          </div>
          {claim.diagnoses.length > 0 ? (
            <div className="diagnosis-list">
              {claim.diagnoses.map((diagnosis) => (
                <article className="diagnosis-card" key={diagnosis.id}>
                  <span className="pointer-badge" dir="ltr">{diagnosis.pointer}</span>
                  <div>
                    <strong dir="ltr">{diagnosis.code || "ICD-10"}</strong>
                    <p>{displayOrReview(diagnosis.description, copy, language)}</p>
                  </div>
                  <em>{diagnosis.role === "primary" ? copy.primary : copy.secondary}</em>
                  <span className={`mini-status ${diagnosis.status}`}>
                    {diagnosis.source === "AI Suggested" ? copy.needsClinicianReview : normalizeClaimStatus(diagnosis.status, copy)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">{copy.noDiagnosis}</div>
          )}
        </section>

        <section className="claim-card wide">
          <div className="section-heading">
            <h2>{copy.serviceLines}</h2>
            <span>{formatUnits(totalUnits, language)}</span>
          </div>
          {claim.serviceLines.length > 0 ? (
            <div className="service-table">
              <div className="service-head">
                <span>{copy.line}</span>
                <span>{copy.dos}</span>
                <span>{copy.cptHcpcs}</span>
                <span>{copy.description}</span>
                <span>{copy.modifiers}</span>
                <span>{copy.pointer}</span>
                <span>{copy.units}</span>
                <span>{copy.duration}</span>
                <span>{copy.charge}</span>
                <span>{copy.validation}</span>
              </div>
              {claim.serviceLines.map((line) => (
                <div className="service-row" key={line.id}>
                  <span data-label={copy.line}>{formatNumber(line.lineNumber, language)}</span>
                  <span data-label={copy.dos}>{displayOrReview(line.dos, copy, language)}</span>
                  <span data-label={copy.cptHcpcs} className="code-chip" dir="ltr">{line.cptCode}</span>
                  <span data-label={copy.description}>{translateCptDisplayName(line.cptCode, line.description, language)}</span>
                  <span data-label={copy.modifiers} dir="ltr">
                    {line.modifiers.length > 0 ? line.modifiers.join(", ") : line.modifierSuggested ? "59" : "--"}
                  </span>
                  <span data-label={copy.pointer} dir="ltr">{line.diagnosisPointer || "--"}</span>
                  <span data-label={copy.units}>{formatNumber(line.units, language)}</span>
                  <span data-label={copy.duration} dir="ltr">{secondsText(line.durationSeconds, line.durationText, language) || "--"}</span>
                  <span data-label={copy.charge}>{line.charge ? formatCurrency(line.charge, language) : "--"}</span>
                  <span data-label={copy.validation} className={`mini-status ${line.modifierSuggested ? "needsReview" : line.validation}`}>
                    {line.modifierSuggested ? copy.needsReview : normalizeClaimStatus(line.validation, copy)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">{copy.noCpt}</div>
          )}
        </section>

        <section className="claim-grid two">
          <article className="claim-card">
            <div className="section-heading">
              <h2>{copy.claimValidation}</h2>
            </div>
            <div className="validation-list">
              {validationRows.map((row) => (
                <div className="validation-row" key={row.id}>
                  <div>
                    <strong>{row.rule}</strong>
                    <p>{row.explanation}</p>
                    <em>{copy.actionNeeded}: {row.action}</em>
                  </div>
                  <span className={`mini-status ${row.status}`}>{normalizeClaimStatus(row.status, copy)}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="claim-card">
            <div className="section-heading">
              <h2>{copy.documentation}</h2>
            </div>
            <div className="documentation-grid">
              {documentationRows.map((row) => (
                <div className="doc-item" key={row.id}>
                  <strong>{row.label}</strong>
                  <span className={`mini-status ${row.status}`}>{normalizeClaimStatus(row.status, copy)}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>

      <div className="bottom-bar" aria-label="Claim document actions">
        <button type="button" onClick={saveDraft}>{copy.saveDraft}</button>
        <Link href={`/billing-intelligence${sessionQuery}`}>{copy.editSessionData}</Link>
        <button type="button" className="primary-action" onClick={verifyClaim}>{copy.verifyClaim}</button>
        <button type="button" onClick={export837pDraft}>{copy.export837pDraft}</button>
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

        button {
          cursor: pointer;
        }

        .claim-content {
          box-sizing: border-box;
          min-height: calc(100vh - 64px);
          padding: 22px 32px 138px;
          background: #fbfbfc;
        }

        .claim-top,
        .claim-card {
          border: 1px solid #e1e8f2;
          border-radius: 8px;
          background: #fff;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05);
        }

        .claim-top {
          padding: 20px;
        }

        .claim-title-row,
        .title-group,
        .top-actions,
        .summary-strip,
        .tabs,
        .section-heading,
        .diagnosis-card,
        .bottom-bar {
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
          min-width: 0;
        }

        .title-group div {
          min-width: 0;
        }

        .back-link {
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

        h1 {
          color: #172033;
          font-size: 25px;
          font-weight: 700;
          line-height: 1.2;
        }

        .title-group p {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
          line-height: 1.4;
        }

        .top-actions {
          gap: 12px;
          flex: 0 0 auto;
        }

        .top-actions button,
        .bottom-bar button,
        .bottom-bar a {
          border: 1px solid #d9e4f2;
          border-radius: 999px;
          background: #fff;
          color: #001eff;
          padding: 9px 14px;
          font-size: 12px;
          font-weight: 800;
          text-decoration: none;
        }

        .submit-button,
        .bottom-bar .primary-action {
          border-color: #001eff !important;
          background: #001eff !important;
          color: #fff !important;
        }

        .export-wrap {
          position: relative;
        }

        .export-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          z-index: 20;
          width: 230px;
          border: 1px solid #d9e4f2;
          border-radius: 8px;
          background: #fff;
          padding: 6px;
          box-shadow: 0 18px 38px rgba(15, 23, 42, 0.14);
        }

        :global(html[dir="rtl"]) .export-menu {
          right: auto;
          left: 0;
        }

        .export-menu button {
          width: 100%;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: #172033;
          text-align: left;
        }

        :global(html[dir="rtl"]) .export-menu button {
          text-align: right;
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
        .mini-status.warning {
          background: #fff7e6;
          color: #9a6100;
        }

        .status-chip.needsReview,
        .mini-status.missing {
          background: #fee4e2;
          color: #b42318;
        }

        .mini-status.needsReview {
          background: #eef3ff;
          color: #001eff;
        }

        .status-chip.ready837p,
        .mini-status.passed {
          background: #e7f8ee;
          color: #087c4a;
        }

        .summary-strip {
          display: grid;
          grid-template-columns: repeat(9, minmax(0, 1fr));
          gap: 12px;
          margin-top: 20px;
        }

        .summary-strip div,
        .info-item,
        .readiness-item,
        .doc-item {
          min-width: 0;
          border: 1px solid #edf1f6;
          border-radius: 8px;
          background: #fbfcff;
          padding: 12px;
        }

        .summary-strip span,
        .info-item span {
          display: block;
          color: #667085;
          font-size: 10px;
          font-weight: 800;
        }

        .summary-strip strong,
        .info-item strong {
          display: block;
          margin-top: 6px;
          color: #172033;
          font-size: 12px;
          line-height: 1.35;
          overflow-wrap: anywhere;
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

        .tabs {
          gap: 28px;
          min-height: 58px;
          overflow-x: auto;
          border-bottom: 1px solid #edf1f6;
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

        .claim-card {
          margin-top: 18px;
          padding: 20px;
        }

        .claim-grid.two {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .section-heading {
          margin-bottom: 16px;
        }

        .section-heading h2 {
          color: #172033;
          font-size: 17px;
          font-weight: 800;
        }

        .readiness-grid,
        .info-grid,
        .documentation-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .readiness-item,
        .doc-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .readiness-item strong,
        .doc-item strong {
          min-width: 0;
          color: #172033;
          font-size: 12px;
          line-height: 1.35;
        }

        .diagnosis-list,
        .validation-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .diagnosis-card,
        .validation-row {
          gap: 14px;
          border: 1px solid #e6edf6;
          border-radius: 8px;
          background: #fbfcff;
          padding: 14px;
        }

        .diagnosis-card > div {
          min-width: 0;
          flex: 1 1 auto;
        }

        .diagnosis-card strong,
        .validation-row strong {
          display: block;
          color: #172033;
          font-size: 13px;
        }

        .diagnosis-card p,
        .validation-row p {
          margin-top: 6px;
          color: #667085;
          font-size: 12px;
          line-height: 1.45;
        }

        .diagnosis-card em,
        .validation-row em {
          color: #667085;
          font-size: 11px;
          font-style: normal;
          font-weight: 800;
        }

        .pointer-badge,
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

        .service-table {
          overflow: hidden;
          border: 1px solid #e4ebf5;
          border-radius: 8px;
        }

        .service-head,
        .service-row {
          display: grid;
          grid-template-columns: 0.5fr 0.9fr 0.8fr 1.5fr 0.8fr 0.8fr 0.65fr 0.8fr 0.8fr 0.9fr;
          gap: 10px;
          align-items: center;
          padding: 13px 14px;
        }

        .service-head {
          background: #f7f9fc;
          color: #667085;
          font-size: 11px;
          font-weight: 800;
        }

        .service-row {
          border-top: 1px solid #edf1f6;
          color: #344054;
          font-size: 12px;
          line-height: 1.35;
        }

        .service-row > span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .validation-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .validation-row div {
          min-width: 0;
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

        .bottom-bar {
          position: fixed;
          left: 50%;
          bottom: 20px;
          z-index: 1000;
          gap: 10px;
          max-width: calc(100vw - 32px);
          transform: translateX(-50%);
          border: 1px solid #e2e8f0;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.96);
          padding: 10px;
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
        }

        @media (max-width: 1200px) {
          .summary-strip,
          .readiness-grid,
          .info-grid,
          .documentation-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .claim-grid.two {
            grid-template-columns: 1fr;
          }

          .service-head {
            display: none;
          }

          .service-row {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .service-row span::before {
            content: attr(data-label);
            display: block;
            margin-bottom: 4px;
            color: #667085;
            font-size: 10px;
            font-weight: 800;
          }

          .service-row .mini-status::before,
          .service-row .code-chip::before {
            content: "";
            display: none;
          }
        }

        @media (max-width: 760px) {
          .claim-content {
            padding: 18px 16px 190px;
          }

          .claim-top,
          .claim-card {
            padding: 16px;
          }

          .claim-title-row,
          .title-group,
          .top-actions,
          .section-heading,
          .diagnosis-card,
          .validation-row {
            align-items: flex-start;
            flex-direction: column;
          }

          .top-actions,
          .top-actions button,
          .export-wrap {
            width: 100%;
          }

          .export-menu {
            left: 0;
            right: auto;
            width: 100%;
          }

          .summary-strip,
          .readiness-grid,
          .info-grid,
          .documentation-grid,
          .service-row {
            grid-template-columns: 1fr;
          }

          .tabs {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
            padding: 16px 0;
            overflow-x: visible;
          }

          .bottom-bar {
            width: calc(100% - 32px);
            flex-wrap: wrap;
            justify-content: center;
            border-radius: 18px;
            bottom: 14px;
          }

          .bottom-bar button,
          .bottom-bar a {
            flex: 1 1 150px;
            text-align: center;
          }
        }

        @media print {
          .topbar,
          .tabs,
          .bottom-bar,
          .top-actions {
            display: none !important;
          }

          .claim-content {
            padding: 0;
          }

          .claim-top,
          .claim-card {
            box-shadow: none;
            break-inside: avoid;
          }
        }
      `}</style>
    </main>
  );
}

export default function ClaimDocumentPage() {
  return (
    <Suspense fallback={null}>
      <ClaimDocumentPageContent />
    </Suspense>
  );
}
