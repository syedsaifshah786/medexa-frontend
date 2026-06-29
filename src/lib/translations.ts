export type Language = "en" | "ar" | "he";

export type TranslationKey =
  | "brand.medexa"
  | "language.english"
  | "language.arabic"
  | "language.hebrew"
  | "header.search"
  | "header.openMenu"
  | "header.navigation"
  | "header.navigate"
  | "header.close"
  | "header.notifications"
  | "header.chooseLanguage"
  | "header.chooseProvider"
  | "header.profile"
  | "header.settings"
  | "header.logout"
  | "nav.ambientListing"
  | "nav.liveSession"
  | "nav.soapNotes"
  | "nav.billingIntelligence"
  | "nav.patientSummary"
  | "nav.claimDocument"
  | "nav.createClaimDocument"
  | "nav.home"
  | "notification.summaryGenerated"
  | "notification.billingSuggestion"
  | "notification.claimReady"
  | "common.goodMorning"
  | "common.edit"
  | "common.save"
  | "common.cancel"
  | "common.close"
  | "common.apply"
  | "common.applied"
  | "common.approve"
  | "common.approved"
  | "common.reject"
  | "common.rejected"
  | "common.ignore"
  | "common.detected"
  | "common.billing"
  | "common.duration"
  | "common.start"
  | "common.pause"
  | "common.resume"
  | "common.stop"
  | "common.stopped"
  | "ambient.startNewSession"
  | "ambient.startPrompt"
  | "ambient.upcomingSessions"
  | "ambient.sessionsRemaining"
  | "ambient.viewAllUpcoming"
  | "ambient.allUpcoming"
  | "ambient.sessionsScheduled"
  | "ambient.noUpcoming"
  | "ambient.recentTranscriptions"
  | "ambient.showingTranscriptions"
  | "ambient.searchTranscriptions"
  | "ambient.summaryPending"
  | "ambient.summarized"
  | "ambient.noTranscriptions"
  | "ambient.noTranscriptionsHint"
  | "ambient.statusFilterCleared"
  | "ambient.statusFilterApplied"
  | "ambient.summaryGenerated"
  | "ambient.openingSession"
  | "ambient.startingNewSession"
  | "ambient.activeSessionStatus"
  | "ambient.awaitingSessionStatus"
  | "ambient.openTranscript"
  | "ambient.generateSummary"
  | "session.therapeuticTherapySession"
  | "session.medexaSummarized"
  | "session.patientId"
  | "session.units"
  | "session.ageSex"
  | "session.weight"
  | "session.mrnNumber"
  | "session.payorSource"
  | "session.careType"
  | "session.cptIcd"
  | "session.sessionTime"
  | "session.recordingActive"
  | "session.recordingPaused"
  | "session.recordingStopped"
  | "session.readyToRecord"
  | "session.recordingSaved"
  | "session.pressPlay"
  | "session.sayStopRecording"
  | "session.slideToApprove"
  | "session.suggestions"
  | "session.processingInsights"
  | "session.noLiveInsights"
  | "session.noSuggestions"
  | "session.insightApproved"
  | "session.insightIgnored"
  | "session.billingSelected"
  | "session.detectedSelected"
  | "session.soapSaved"
  | "session.stopRecordingQuestion"
  | "session.confirmStop"
  | "session.unitAt"
  | "session.left"
  | "session.liveTranscript"
  | "session.currentChunk"
  | "session.aiSummarySegments"
  | "session.possibleClinicalImpressions"
  | "session.symptomsDetected"
  | "session.soapSuggestions"
  | "session.billingHints"
  | "session.confidence"
  | "session.generated"
  | "session.listening"
  | "session.paused"
  | "session.unsupported"
  | "session.webSpeechUnsupported"
  | "session.microphoneRequired"
  | "session.aiDisclaimer"
  | "session.speechStatus"
  | "session.generateTestSummary"
  | "session.transcriptPlaceholder"
  | "session.noSummarySegments"
  | "session.transcriptExcerpt"
  | "soap.subjective"
  | "soap.objective"
  | "soap.assessment"
  | "soap.plan"
  | "soap.chiefComplaint"
  | "soap.painScale"
  | "soap.observationNotes"
  | "soap.rangeOfMotion"
  | "soap.affect"
  | "soap.vitalSigns"
  | "soap.diagnosisSummary"
  | "soap.primaryDiagnosisCode"
  | "soap.severity"
  | "soap.followUpPlan"
  | "soap.noSections"
  | "billing.title"
  | "billing.sessionTime"
  | "billing.sessionUnits"
  | "billing.cptCodesDetected"
  | "billing.addMoreCpts"
  | "billing.editCpt"
  | "billing.addCpt"
  | "billing.saveChanges"
  | "billing.saveCpt"
  | "billing.cptCode"
  | "billing.description"
  | "billing.snfFunctionalLogic"
  | "billing.noCpt"
  | "summary.sessionSummaryNote"
  | "summary.sendToPatient"
  | "summary.confirmSend"
  | "summary.sendQuestion"
  | "summary.updated"
  | "summary.sent"
  | "summary.noMatch"
  | "claim.title"
  | "claim.submitClaim"
  | "claim.claimSubmitted"
  | "claim.export"
  | "claim.patient"
  | "claim.orderingProvider"
  | "claim.sessionMeta"
  | "claim.sessionListItems"
  | "claim.billableUnits"
  | "claim.icd10DiagnosisCodes"
  | "claim.addDiagnosis"
  | "claim.saveAsDraft"
  | "claim.editSessionData"
  | "claim.verifyClaimDocument"
  | "claim.saveSessionData"
  | "claim.modifier"
  | "claim.draftSaved"
  | "claim.sessionDataUpdated"
  | "claim.verified"
  | "claim.submitted"
  | "claim.noSessionItems"
  | "claim.noDiagnosis";

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    "brand.medexa": "Medexa",
    "language.english": "English",
    "language.arabic": "Arabic",
    "language.hebrew": "Hebrew",
    "header.search": "Search patients or sessions...",
    "header.openMenu": "Open menu",
    "header.navigation": "Main navigation",
    "header.navigate": "Navigate",
    "header.close": "Close",
    "header.notifications": "Notifications",
    "header.chooseLanguage": "Choose language",
    "header.chooseProvider": "Choose provider",
    "header.profile": "Profile",
    "header.settings": "Settings",
    "header.logout": "Logout",
    "nav.ambientListing": "Ambient Listing",
    "nav.liveSession": "Live Session",
    "nav.soapNotes": "SOAP Notes",
    "nav.billingIntelligence": "Billing Intelligence",
    "nav.patientSummary": "Patient Summary",
    "nav.claimDocument": "Claim Document",
    "nav.createClaimDocument": "Create Claim-Document",
    "nav.home": "Home",
    "notification.summaryGenerated": "New session summary generated",
    "notification.billingSuggestion": "Billing suggestion available",
    "notification.claimReady": "Claim document ready for review",
    "common.goodMorning": "Good Morning",
    "common.edit": "Edit",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "common.apply": "Apply",
    "common.applied": "Applied",
    "common.approve": "Approve",
    "common.approved": "Approved",
    "common.reject": "Reject",
    "common.rejected": "Rejected",
    "common.ignore": "Ignore",
    "common.detected": "Detected",
    "common.billing": "Billing",
    "common.duration": "Duration",
    "common.start": "Start",
    "common.pause": "Pause",
    "common.resume": "Resume",
    "common.stop": "Stop",
    "common.stopped": "Stopped",
    "ambient.startNewSession": "Start a new session?",
    "ambient.startPrompt": "\"Start a new session with David Peter\"",
    "ambient.upcomingSessions": "Upcoming Sessions",
    "ambient.sessionsRemaining": "sessions remaining ahead",
    "ambient.viewAllUpcoming": "View All Upcoming Sessions",
    "ambient.allUpcoming": "All Upcoming Sessions",
    "ambient.sessionsScheduled": "sessions scheduled ahead",
    "ambient.noUpcoming": "No upcoming sessions match your search.",
    "ambient.recentTranscriptions": "Recent Transcriptions",
    "ambient.showingTranscriptions": "Showing transcriptions from recent sessions",
    "ambient.searchTranscriptions": "Search transcriptions...",
    "ambient.summaryPending": "SUMMARY PENDING",
    "ambient.summarized": "SUMMARIZED",
    "ambient.noTranscriptions": "No transcriptions found.",
    "ambient.noTranscriptionsHint": "Try searching by patient name or clearing the status filter.",
    "ambient.statusFilterCleared": "Status filter cleared",
    "ambient.statusFilterApplied": "filter applied",
    "ambient.summaryGenerated": "Summary generated",
    "ambient.openingSession": "Opening session...",
    "ambient.startingNewSession": "Starting a new session...",
    "ambient.activeSessionStatus": "currently active",
    "ambient.awaitingSessionStatus": "awaiting check-in",
    "ambient.openTranscript": "Open transcript",
    "ambient.generateSummary": "Generate Summary",
    "session.therapeuticTherapySession": "Therapeutic Therapy Session",
    "session.medexaSummarized": "Medexa Summarized",
    "session.patientId": "Patient ID",
    "session.units": "Unit(s)",
    "session.ageSex": "Age / Sex",
    "session.weight": "Weight",
    "session.mrnNumber": "MRN Number",
    "session.payorSource": "Payor Source",
    "session.careType": "Care Type",
    "session.cptIcd": "CPT / ICD",
    "session.sessionTime": "Session Time",
    "session.recordingActive": "Recording Active",
    "session.recordingPaused": "Recording Paused",
    "session.recordingStopped": "Recording Stopped",
    "session.readyToRecord": "Ready to Record",
    "session.recordingSaved": "Recording saved. Start a new recording when ready.",
    "session.pressPlay": "Press play to start recording.",
    "session.sayStopRecording": "Say Stop Recording...",
    "session.slideToApprove": "Slide to Approve",
    "session.suggestions": "Suggestions",
    "session.processingInsights": "Medexa is Processing for Insights...",
    "session.noLiveInsights": "No live insights match your search.",
    "session.noSuggestions": "No suggestions match your search.",
    "session.insightApproved": "Insight approved",
    "session.insightIgnored": "Insight ignored",
    "session.billingSelected": "Billing item selected",
    "session.detectedSelected": "Detected item selected",
    "session.soapSaved": "SOAP notes saved",
    "session.stopRecordingQuestion": "Stop this recording?",
    "session.confirmStop": "Confirm Stop",
    "session.unitAt": "Unit",
    "session.left": "left",
    "session.liveTranscript": "Live Transcript",
    "session.currentChunk": "Current 30-sec chunk",
    "session.aiSummarySegments": "30-Second AI Summary Segments",
    "session.possibleClinicalImpressions": "Possible Clinical Impressions",
    "session.symptomsDetected": "Symptoms Detected",
    "session.soapSuggestions": "SOAP Suggestions",
    "session.billingHints": "Billing Hints",
    "session.confidence": "Confidence",
    "session.generated": "Generated",
    "session.listening": "Listening",
    "session.paused": "Paused",
    "session.unsupported": "Unsupported",
    "session.webSpeechUnsupported": "Web Speech is not supported in this browser. Please use Chrome or Edge.",
    "session.microphoneRequired": "Microphone permission is required for live transcription.",
    "session.aiDisclaimer": "AI-generated suggestions require clinician review before use.",
    "session.speechStatus": "Speech Status",
    "session.generateTestSummary": "Generate Test Summary",
    "session.transcriptPlaceholder": "Speech will appear here while recording is active.",
    "session.noSummarySegments": "No AI summary segments generated yet.",
    "session.transcriptExcerpt": "Transcript excerpt",
    "soap.subjective": "Subjective",
    "soap.objective": "Objective",
    "soap.assessment": "Assessment",
    "soap.plan": "Plan",
    "soap.chiefComplaint": "Chief Complaint",
    "soap.painScale": "Pain Scale",
    "soap.observationNotes": "Observation Notes",
    "soap.rangeOfMotion": "Range of Motion",
    "soap.affect": "Affect",
    "soap.vitalSigns": "Vital Signs",
    "soap.diagnosisSummary": "Diagnosis Summary",
    "soap.primaryDiagnosisCode": "Primary Diagnosis Code",
    "soap.severity": "Severity",
    "soap.followUpPlan": "Follow-up Plan",
    "soap.noSections": "No SOAP sections match your search.",
    "billing.title": "Billing Intelligence",
    "billing.sessionTime": "Session Time",
    "billing.sessionUnits": "Session Units",
    "billing.cptCodesDetected": "CPT Codes Detected",
    "billing.addMoreCpts": "Add more CPTs",
    "billing.editCpt": "Edit CPT",
    "billing.addCpt": "Add CPT",
    "billing.saveChanges": "Save Changes",
    "billing.saveCpt": "Save CPT",
    "billing.cptCode": "CPT code",
    "billing.description": "Description",
    "billing.snfFunctionalLogic": "SNF & Functional Logic",
    "billing.noCpt": "No CPT codes match your search.",
    "summary.sessionSummaryNote": "Session Summary Note",
    "summary.sendToPatient": "Send to Patient",
    "summary.confirmSend": "Confirm Send",
    "summary.sendQuestion": "Send this summary to the patient?",
    "summary.updated": "Summary note updated.",
    "summary.sent": "Summary sent to patient successfully.",
    "summary.noMatch": "No matching summary content found.",
    "claim.title": "Claim Document",
    "claim.submitClaim": "Submit Claim",
    "claim.claimSubmitted": "Claim Submitted",
    "claim.export": "Export",
    "claim.patient": "Patient",
    "claim.orderingProvider": "Ordering Provider",
    "claim.sessionMeta": "Session Meta",
    "claim.sessionListItems": "Session List Items",
    "claim.billableUnits": "Billable Units",
    "claim.icd10DiagnosisCodes": "ICD-10 Diagnosis Codes",
    "claim.addDiagnosis": "Add Diagnosis",
    "claim.saveAsDraft": "Save as Draft",
    "claim.editSessionData": "Edit Session Data",
    "claim.verifyClaimDocument": "Verify Claim Document",
    "claim.saveSessionData": "Save Session Data",
    "claim.modifier": "Modifier",
    "claim.draftSaved": "Draft saved.",
    "claim.sessionDataUpdated": "Session data updated.",
    "claim.verified": "Claim document verified successfully.",
    "claim.submitted": "Claim submitted successfully.",
    "claim.noSessionItems": "No session list items match your search.",
    "claim.noDiagnosis": "No diagnosis codes match your search.",
  },
  ar: {
    "brand.medexa": "ميديكسـا",
    "language.english": "الإنجليزية",
    "language.arabic": "العربية",
    "language.hebrew": "العبرية",
    "header.search": "ابحث عن المرضى أو الجلسات...",
    "header.openMenu": "فتح القائمة",
    "header.navigation": "التنقل الرئيسي",
    "header.navigate": "تنقل",
    "header.close": "إغلاق",
    "header.notifications": "الإشعارات",
    "header.chooseLanguage": "اختر اللغة",
    "header.chooseProvider": "اختر مقدم الرعاية",
    "header.profile": "الملف الشخصي",
    "header.settings": "الإعدادات",
    "header.logout": "تسجيل الخروج",
    "nav.ambientListing": "قائمة الجلسات",
    "nav.liveSession": "الجلسة المباشرة",
    "nav.soapNotes": "ملاحظات SOAP",
    "nav.billingIntelligence": "ذكاء الفوترة",
    "nav.patientSummary": "ملخص المريض",
    "nav.claimDocument": "مستند المطالبة",
    "nav.createClaimDocument": "إنشاء مستند مطالبة",
    "nav.home": "الرئيسية",
    "notification.summaryGenerated": "تم إنشاء ملخص جلسة جديد",
    "notification.billingSuggestion": "اقتراح فوترة متاح",
    "notification.claimReady": "مستند المطالبة جاهز للمراجعة",
    "common.goodMorning": "صباح الخير",
    "common.edit": "تعديل",
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.close": "إغلاق",
    "common.apply": "تطبيق",
    "common.applied": "تم التطبيق",
    "common.approve": "اعتماد",
    "common.approved": "معتمد",
    "common.reject": "رفض",
    "common.rejected": "مرفوض",
    "common.ignore": "تجاهل",
    "common.detected": "مكتشف",
    "common.billing": "الفوترة",
    "common.duration": "المدة",
    "common.start": "بدء",
    "common.pause": "إيقاف مؤقت",
    "common.resume": "استئناف",
    "common.stop": "إيقاف",
    "common.stopped": "متوقف",
    "ambient.startNewSession": "بدء جلسة جديدة؟",
    "ambient.startPrompt": "\"ابدأ جلسة جديدة مع David Peter\"",
    "ambient.upcomingSessions": "الجلسات القادمة",
    "ambient.sessionsRemaining": "جلسات متبقية",
    "ambient.viewAllUpcoming": "عرض كل الجلسات القادمة",
    "ambient.allUpcoming": "كل الجلسات القادمة",
    "ambient.sessionsScheduled": "جلسات مجدولة",
    "ambient.noUpcoming": "لا توجد جلسات قادمة تطابق البحث.",
    "ambient.recentTranscriptions": "التفريغات الحديثة",
    "ambient.showingTranscriptions": "عرض تفريغات من الجلسات الحديثة",
    "ambient.searchTranscriptions": "ابحث في التفريغات...",
    "ambient.summaryPending": "الملخص معلق",
    "ambient.summarized": "تم التلخيص",
    "ambient.noTranscriptions": "لم يتم العثور على تفريغات.",
    "ambient.noTranscriptionsHint": "جرّب البحث باسم المريض أو إزالة فلتر الحالة.",
    "ambient.statusFilterCleared": "تم مسح فلتر الحالة",
    "ambient.statusFilterApplied": "تم تطبيق الفلتر",
    "ambient.summaryGenerated": "تم إنشاء الملخص",
    "ambient.openingSession": "جار فتح الجلسة...",
    "ambient.startingNewSession": "جار بدء جلسة جديدة...",
    "ambient.activeSessionStatus": "نشطة حاليًا",
    "ambient.awaitingSessionStatus": "بانتظار تسجيل الوصول",
    "ambient.openTranscript": "فتح التفريغ",
    "ambient.generateSummary": "إنشاء ملخص",
    "session.therapeuticTherapySession": "جلسة علاجية",
    "session.medexaSummarized": "ملخص بواسطة ميديكسـا",
    "session.patientId": "معرّف المريض",
    "session.units": "الوحدات",
    "session.ageSex": "العمر / الجنس",
    "session.weight": "الوزن",
    "session.mrnNumber": "رقم MRN",
    "session.payorSource": "مصدر الدفع",
    "session.careType": "نوع الرعاية",
    "session.cptIcd": "CPT / ICD",
    "session.sessionTime": "وقت الجلسة",
    "session.recordingActive": "التسجيل نشط",
    "session.recordingPaused": "التسجيل متوقف مؤقتًا",
    "session.recordingStopped": "تم إيقاف التسجيل",
    "session.readyToRecord": "جاهز للتسجيل",
    "session.recordingSaved": "تم حفظ التسجيل. ابدأ تسجيلًا جديدًا عند الجاهزية.",
    "session.pressPlay": "اضغط تشغيل لبدء التسجيل.",
    "session.sayStopRecording": "قل إيقاف التسجيل...",
    "session.slideToApprove": "اسحب للاعتماد",
    "session.suggestions": "الاقتراحات",
    "session.processingInsights": "ميديكسـا يعالج الرؤى...",
    "session.noLiveInsights": "لا توجد رؤى مباشرة تطابق البحث.",
    "session.noSuggestions": "لا توجد اقتراحات تطابق البحث.",
    "session.insightApproved": "تم اعتماد الرؤية",
    "session.insightIgnored": "تم تجاهل الرؤية",
    "session.billingSelected": "تم تحديد عنصر الفوترة",
    "session.detectedSelected": "تم تحديد العنصر المكتشف",
    "session.soapSaved": "تم حفظ ملاحظات SOAP",
    "session.stopRecordingQuestion": "إيقاف هذا التسجيل؟",
    "session.confirmStop": "تأكيد الإيقاف",
    "session.unitAt": "الوحدة",
    "session.left": "متبقي",
    "session.liveTranscript": "التفريغ المباشر",
    "session.currentChunk": "مقطع 30 ثانية الحالي",
    "session.aiSummarySegments": "ملخصات الذكاء الاصطناعي كل 30 ثانية",
    "session.possibleClinicalImpressions": "انطباعات سريرية محتملة",
    "session.symptomsDetected": "الأعراض المكتشفة",
    "session.soapSuggestions": "اقتراحات SOAP",
    "session.billingHints": "تلميحات الفوترة",
    "session.confidence": "الثقة",
    "session.generated": "تم الإنشاء",
    "session.listening": "يستمع",
    "session.paused": "متوقف مؤقتًا",
    "session.unsupported": "غير مدعوم",
    "session.webSpeechUnsupported": "Web Speech غير مدعوم في هذا المتصفح. يرجى استخدام Chrome أو Edge.",
    "session.microphoneRequired": "يلزم السماح بالميكروفون للتفريغ المباشر.",
    "session.aiDisclaimer": "تتطلب الاقتراحات المنشأة بالذكاء الاصطناعي مراجعة الطبيب قبل الاستخدام.",
    "session.speechStatus": "حالة الكلام",
    "session.generateTestSummary": "إنشاء ملخص تجريبي",
    "session.transcriptPlaceholder": "سيظهر الكلام هنا أثناء التسجيل النشط.",
    "session.noSummarySegments": "لم يتم إنشاء أي ملخصات بالذكاء الاصطناعي بعد.",
    "session.transcriptExcerpt": "مقتطف التفريغ",
    "soap.subjective": "ذاتي",
    "soap.objective": "موضوعي",
    "soap.assessment": "التقييم",
    "soap.plan": "الخطة",
    "soap.chiefComplaint": "الشكوى الرئيسية",
    "soap.painScale": "مقياس الألم",
    "soap.observationNotes": "ملاحظات المراقبة",
    "soap.rangeOfMotion": "مدى الحركة",
    "soap.affect": "الحالة الوجدانية",
    "soap.vitalSigns": "العلامات الحيوية",
    "soap.diagnosisSummary": "ملخص التشخيص",
    "soap.primaryDiagnosisCode": "رمز التشخيص الأساسي",
    "soap.severity": "الشدة",
    "soap.followUpPlan": "خطة المتابعة",
    "soap.noSections": "لا توجد أقسام SOAP تطابق البحث.",
    "billing.title": "ذكاء الفوترة",
    "billing.sessionTime": "وقت الجلسة",
    "billing.sessionUnits": "وحدات الجلسة",
    "billing.cptCodesDetected": "رموز CPT المكتشفة",
    "billing.addMoreCpts": "إضافة رموز CPT",
    "billing.editCpt": "تعديل CPT",
    "billing.addCpt": "إضافة CPT",
    "billing.saveChanges": "حفظ التغييرات",
    "billing.saveCpt": "حفظ CPT",
    "billing.cptCode": "رمز CPT",
    "billing.description": "الوصف",
    "billing.snfFunctionalLogic": "منطق SNF والوظائف",
    "billing.noCpt": "لا توجد رموز CPT تطابق البحث.",
    "summary.sessionSummaryNote": "ملاحظة ملخص الجلسة",
    "summary.sendToPatient": "إرسال إلى المريض",
    "summary.confirmSend": "تأكيد الإرسال",
    "summary.sendQuestion": "إرسال هذا الملخص إلى المريض؟",
    "summary.updated": "تم تحديث ملاحظة الملخص.",
    "summary.sent": "تم إرسال الملخص إلى المريض بنجاح.",
    "summary.noMatch": "لا يوجد محتوى ملخص مطابق.",
    "claim.title": "مستند المطالبة",
    "claim.submitClaim": "إرسال المطالبة",
    "claim.claimSubmitted": "تم إرسال المطالبة",
    "claim.export": "تصدير",
    "claim.patient": "المريض",
    "claim.orderingProvider": "مقدم الطلب",
    "claim.sessionMeta": "بيانات الجلسة",
    "claim.sessionListItems": "عناصر قائمة الجلسة",
    "claim.billableUnits": "وحدات قابلة للفوترة",
    "claim.icd10DiagnosisCodes": "رموز تشخيص ICD-10",
    "claim.addDiagnosis": "إضافة تشخيص",
    "claim.saveAsDraft": "حفظ كمسودة",
    "claim.editSessionData": "تعديل بيانات الجلسة",
    "claim.verifyClaimDocument": "التحقق من مستند المطالبة",
    "claim.saveSessionData": "حفظ بيانات الجلسة",
    "claim.modifier": "المعدّل",
    "claim.draftSaved": "تم حفظ المسودة.",
    "claim.sessionDataUpdated": "تم تحديث بيانات الجلسة.",
    "claim.verified": "تم التحقق من مستند المطالبة بنجاح.",
    "claim.submitted": "تم إرسال المطالبة بنجاح.",
    "claim.noSessionItems": "لا توجد عناصر جلسة تطابق البحث.",
    "claim.noDiagnosis": "لا توجد رموز تشخيص تطابق البحث.",
  },
  he: {
    "brand.medexa": "מדקסה",
    "language.english": "אנגלית",
    "language.arabic": "ערבית",
    "language.hebrew": "עברית",
    "header.search": "חיפוש מטופלים או מפגשים...",
    "header.openMenu": "פתח תפריט",
    "header.navigation": "ניווט ראשי",
    "header.navigate": "ניווט",
    "header.close": "סגור",
    "header.notifications": "התראות",
    "header.chooseLanguage": "בחר שפה",
    "header.chooseProvider": "בחר מטפל",
    "header.profile": "פרופיל",
    "header.settings": "הגדרות",
    "header.logout": "התנתקות",
    "nav.ambientListing": "רשימת מפגשים",
    "nav.liveSession": "מפגש חי",
    "nav.soapNotes": "הערות SOAP",
    "nav.billingIntelligence": "מודיעין חיוב",
    "nav.patientSummary": "סיכום מטופל",
    "nav.claimDocument": "מסמך תביעה",
    "nav.createClaimDocument": "צור מסמך תביעה",
    "nav.home": "בית",
    "notification.summaryGenerated": "נוצר סיכום מפגש חדש",
    "notification.billingSuggestion": "הצעת חיוב זמינה",
    "notification.claimReady": "מסמך התביעה מוכן לבדיקה",
    "common.goodMorning": "בוקר טוב",
    "common.edit": "עריכה",
    "common.save": "שמירה",
    "common.cancel": "ביטול",
    "common.close": "סגור",
    "common.apply": "החל",
    "common.applied": "הוחל",
    "common.approve": "אשר",
    "common.approved": "מאושר",
    "common.reject": "דחה",
    "common.rejected": "נדחה",
    "common.ignore": "התעלם",
    "common.detected": "זוהה",
    "common.billing": "חיוב",
    "common.duration": "משך",
    "common.start": "התחל",
    "common.pause": "השהה",
    "common.resume": "המשך",
    "common.stop": "עצור",
    "common.stopped": "נעצר",
    "ambient.startNewSession": "להתחיל מפגש חדש?",
    "ambient.startPrompt": "\"התחל מפגש חדש עם David Peter\"",
    "ambient.upcomingSessions": "מפגשים קרובים",
    "ambient.sessionsRemaining": "מפגשים שנותרו",
    "ambient.viewAllUpcoming": "הצג את כל המפגשים הקרובים",
    "ambient.allUpcoming": "כל המפגשים הקרובים",
    "ambient.sessionsScheduled": "מפגשים מתוזמנים",
    "ambient.noUpcoming": "אין מפגשים קרובים התואמים לחיפוש.",
    "ambient.recentTranscriptions": "תמלולים אחרונים",
    "ambient.showingTranscriptions": "מציג תמלולים ממפגשים אחרונים",
    "ambient.searchTranscriptions": "חיפוש תמלולים...",
    "ambient.summaryPending": "סיכום בהמתנה",
    "ambient.summarized": "סוכם",
    "ambient.noTranscriptions": "לא נמצאו תמלולים.",
    "ambient.noTranscriptionsHint": "נסה לחפש לפי שם מטופל או לנקות את מסנן הסטטוס.",
    "ambient.statusFilterCleared": "מסנן הסטטוס נוקה",
    "ambient.statusFilterApplied": "המסנן הוחל",
    "ambient.summaryGenerated": "הסיכום נוצר",
    "ambient.openingSession": "פותח מפגש...",
    "ambient.startingNewSession": "מתחיל מפגש חדש...",
    "ambient.activeSessionStatus": "פעיל כעת",
    "ambient.awaitingSessionStatus": "ממתין לצ'ק-אין",
    "ambient.openTranscript": "פתח תמלול",
    "ambient.generateSummary": "צור סיכום",
    "session.therapeuticTherapySession": "מפגש טיפול טיפולי",
    "session.medexaSummarized": "סוכם על ידי מדקסה",
    "session.patientId": "מזהה מטופל",
    "session.units": "יחידות",
    "session.ageSex": "גיל / מין",
    "session.weight": "משקל",
    "session.mrnNumber": "מספר MRN",
    "session.payorSource": "מקור משלם",
    "session.careType": "סוג טיפול",
    "session.cptIcd": "CPT / ICD",
    "session.sessionTime": "זמן מפגש",
    "session.recordingActive": "ההקלטה פעילה",
    "session.recordingPaused": "ההקלטה מושהית",
    "session.recordingStopped": "ההקלטה נעצרה",
    "session.readyToRecord": "מוכן להקלטה",
    "session.recordingSaved": "ההקלטה נשמרה. התחל הקלטה חדשה כשתהיה מוכן.",
    "session.pressPlay": "לחץ הפעלה כדי להתחיל הקלטה.",
    "session.sayStopRecording": "אמור עצור הקלטה...",
    "session.slideToApprove": "החלק לאישור",
    "session.suggestions": "הצעות",
    "session.processingInsights": "מדקסה מעבדת תובנות...",
    "session.noLiveInsights": "אין תובנות חיות התואמות לחיפוש.",
    "session.noSuggestions": "אין הצעות התואמות לחיפוש.",
    "session.insightApproved": "התובנה אושרה",
    "session.insightIgnored": "התובנה סומנה להתעלמות",
    "session.billingSelected": "פריט חיוב נבחר",
    "session.detectedSelected": "פריט מזוהה נבחר",
    "session.soapSaved": "הערות SOAP נשמרו",
    "session.stopRecordingQuestion": "לעצור את ההקלטה הזו?",
    "session.confirmStop": "אשר עצירה",
    "session.unitAt": "יחידה",
    "session.left": "נותר",
    "session.liveTranscript": "תמלול חי",
    "session.currentChunk": "מקטע 30 שניות נוכחי",
    "session.aiSummarySegments": "מקטעי סיכום AI בני 30 שניות",
    "session.possibleClinicalImpressions": "רשמים קליניים אפשריים",
    "session.symptomsDetected": "תסמינים שזוהו",
    "session.soapSuggestions": "הצעות SOAP",
    "session.billingHints": "רמזי חיוב",
    "session.confidence": "רמת ביטחון",
    "session.generated": "נוצר",
    "session.listening": "מאזין",
    "session.paused": "מושהה",
    "session.unsupported": "לא נתמך",
    "session.webSpeechUnsupported": "Web Speech אינו נתמך בדפדפן זה. השתמש ב-Chrome או Edge.",
    "session.microphoneRequired": "נדרשת הרשאת מיקרופון לתמלול חי.",
    "session.aiDisclaimer": "הצעות שנוצרו על ידי AI דורשות בדיקת קלינאי לפני שימוש.",
    "session.speechStatus": "מצב דיבור",
    "session.generateTestSummary": "צור סיכום בדיקה",
    "session.transcriptPlaceholder": "הדיבור יופיע כאן בזמן שההקלטה פעילה.",
    "session.noSummarySegments": "עדיין לא נוצרו מקטעי סיכום AI.",
    "session.transcriptExcerpt": "קטע תמלול",
    "soap.subjective": "סובייקטיבי",
    "soap.objective": "אובייקטיבי",
    "soap.assessment": "הערכה",
    "soap.plan": "תוכנית",
    "soap.chiefComplaint": "תלונה עיקרית",
    "soap.painScale": "סולם כאב",
    "soap.observationNotes": "הערות תצפית",
    "soap.rangeOfMotion": "טווח תנועה",
    "soap.affect": "מצב רגשי",
    "soap.vitalSigns": "סימנים חיוניים",
    "soap.diagnosisSummary": "סיכום אבחנה",
    "soap.primaryDiagnosisCode": "קוד אבחנה ראשי",
    "soap.severity": "חומרה",
    "soap.followUpPlan": "תוכנית מעקב",
    "soap.noSections": "אין מקטעי SOAP התואמים לחיפוש.",
    "billing.title": "מודיעין חיוב",
    "billing.sessionTime": "זמן מפגש",
    "billing.sessionUnits": "יחידות מפגש",
    "billing.cptCodesDetected": "קודי CPT שזוהו",
    "billing.addMoreCpts": "הוסף קודי CPT",
    "billing.editCpt": "ערוך CPT",
    "billing.addCpt": "הוסף CPT",
    "billing.saveChanges": "שמור שינויים",
    "billing.saveCpt": "שמור CPT",
    "billing.cptCode": "קוד CPT",
    "billing.description": "תיאור",
    "billing.snfFunctionalLogic": "לוגיקת SNF ותפקוד",
    "billing.noCpt": "אין קודי CPT התואמים לחיפוש.",
    "summary.sessionSummaryNote": "הערת סיכום מפגש",
    "summary.sendToPatient": "שלח למטופל",
    "summary.confirmSend": "אשר שליחה",
    "summary.sendQuestion": "לשלוח את הסיכום הזה למטופל?",
    "summary.updated": "הערת הסיכום עודכנה.",
    "summary.sent": "הסיכום נשלח למטופל בהצלחה.",
    "summary.noMatch": "לא נמצא תוכן סיכום תואם.",
    "claim.title": "מסמך תביעה",
    "claim.submitClaim": "שלח תביעה",
    "claim.claimSubmitted": "התביעה נשלחה",
    "claim.export": "ייצוא",
    "claim.patient": "מטופל",
    "claim.orderingProvider": "ספק מפנה",
    "claim.sessionMeta": "נתוני מפגש",
    "claim.sessionListItems": "פריטי רשימת מפגש",
    "claim.billableUnits": "יחידות לחיוב",
    "claim.icd10DiagnosisCodes": "קודי אבחנה ICD-10",
    "claim.addDiagnosis": "הוסף אבחנה",
    "claim.saveAsDraft": "שמור כטיוטה",
    "claim.editSessionData": "ערוך נתוני מפגש",
    "claim.verifyClaimDocument": "אמת מסמך תביעה",
    "claim.saveSessionData": "שמור נתוני מפגש",
    "claim.modifier": "מתאם",
    "claim.draftSaved": "הטיוטה נשמרה.",
    "claim.sessionDataUpdated": "נתוני המפגש עודכנו.",
    "claim.verified": "מסמך התביעה אומת בהצלחה.",
    "claim.submitted": "התביעה נשלחה בהצלחה.",
    "claim.noSessionItems": "אין פריטי מפגש התואמים לחיפוש.",
    "claim.noDiagnosis": "אין קודי אבחנה התואמים לחיפוש.",
  },
};
