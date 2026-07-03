import en from "./en.json";
import ar from "./ar.json";
import he from "./he.json";

export type Language = "en" | "ar" | "he";
export type TranslationKey = string;
export type TranslationParams = Record<string, string | number | null | undefined>;

const cleanArabicTranslations: Record<string, string> = {
  "brand.medexa": "ميديكسا",
  "language.english": "الإنجليزية",
  "language.arabic": "العربية",
  "language.hebrew": "العبرية",
  "header.search": "ابحث عن المرضى أو الجلسات...",
  "header.openMenu": "فتح القائمة",
  "header.navigation": "التنقل الرئيسي",
  "header.navigate": "التنقل",
  "header.close": "إغلاق",
  "header.notifications": "الإشعارات",
  "header.chooseLanguage": "اختر اللغة",
  "header.chooseProvider": "اختر مقدم الرعاية",
  "header.profile": "الملف الشخصي",
  "header.settings": "الإعدادات",
  "header.logout": "تسجيل الخروج",
  "nav.ambientListing": "الاستماع المحيط",
  "nav.liveSession": "الجلسة المباشرة",
  "nav.soapNotes": "ملاحظات SOAP",
  "nav.billingIntelligence": "ذكاء الفوترة",
  "nav.patientSummary": "ملخص المريض",
  "nav.claimDocument": "مستند المطالبة",
  "nav.createClaimDocument": "إنشاء مستند المطالبة",
  "nav.home": "الرئيسية",
  "notification.summaryGenerated": "تم إنشاء ملخص جلسة جديد",
  "notification.billingSuggestion": "اقتراح فوترة متاح",
  "notification.claimReady": "مستند المطالبة جاهز للمراجعة",
  "common.goodMorning": "صباح الخير",
  "common.goodAfternoon": "مساء الخير",
  "common.goodEvening": "مساء الخير",
  "common.goodNight": "مساء الخير",
  "common.edit": "تعديل",
  "common.save": "حفظ",
  "common.cancel": "إلغاء",
  "common.close": "إغلاق",
  "common.apply": "تطبيق",
  "common.applied": "تم التطبيق",
  "common.approve": "موافقة",
  "common.approved": "تمت الموافقة",
  "common.reject": "رفض",
  "common.rejected": "مرفوض",
  "common.ignore": "تجاهل",
  "common.detected": "تم الاكتشاف",
  "common.billing": "الفوترة",
  "common.duration": "المدة",
  "common.start": "بدء",
  "common.pause": "إيقاف مؤقت",
  "common.resume": "استئناف",
  "common.stop": "إيقاف",
  "common.stopped": "متوقف",
  "common.none": "لا يوجد",
  "common.unspecified": "غير محدد",
  "common.missing": "الحقول الناقصة: {items}.",
  "common.primary": "أساسي",
  "common.secondary": "ثانوي",
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
  "ambient.summaryPending": "الملخص قيد الانتظار",
  "ambient.summarized": "تم التلخيص",
  "ambient.noTranscriptions": "لم يتم العثور على تفريغات.",
  "ambient.noTranscriptionsHint": "جرب البحث باسم المريض أو إزالة فلتر الحالة.",
  "ambient.statusFilterCleared": "تم مسح فلتر الحالة",
  "ambient.statusFilterApplied": "تم تطبيق الفلتر",
  "ambient.summaryGenerated": "تم إنشاء الملخص",
  "ambient.openingSession": "جار فتح الجلسة...",
  "ambient.startingNewSession": "جار بدء جلسة جديدة...",
  "ambient.activeSessionStatus": "نشطة حاليا",
  "ambient.awaitingSessionStatus": "قيد الانتظار",
  "ambient.openTranscript": "فتح التفريغ",
  "ambient.generateSummary": "إنشاء ملخص",
  "ambient.transcript": "التفريغ",
  "ambient.generatedSummary": "تم إنشاء ملخص جلسة {patientName} من التفريغ وهو جاهز للمراجعة.",
  "ambient.sessionAria": "فتح جلسة {patientName}",
  "startSession.manualCommand": "ابدأ جلسة جديدة مع {patientName}",
  "startSession.voiceCommand": "يا ميديكسا، ابدأي جلسة جديدة مع {patientName}",
  "startSession.starting": "جار بدء الجلسة...",
  "startSession.syncing": "جار مزامنة سياق المريض...",
  "startSession.microphoneRequired": "إذن الميكروفون مطلوب لمتابعة التسجيل.",
  "session.therapeuticTherapySession": "جلسة علاجية",
  "session.medexaSummarized": "ملخص بواسطة ميديكسا",
  "session.patientId": "معرف المريض",
  "session.backToAmbient": "العودة إلى الاستماع المحيط",
  "session.units": "الوحدات",
  "session.unit": "وحدة",
  "session.ageSex": "العمر / الجنس",
  "session.weight": "الوزن",
  "session.mrnNumber": "رقم السجل الطبي",
  "session.payorSource": "جهة الدفع",
  "session.careType": "نوع الرعاية",
  "session.cptIcd": "CPT / ICD",
  "session.sessionTime": "وقت الجلسة",
  "session.recordingActive": "التسجيل نشط",
  "session.recordingPaused": "التسجيل متوقف مؤقتا",
  "session.recordingStopped": "تم إيقاف التسجيل",
  "session.readyToRecord": "ميديكسا جاهزة",
  "session.recordingSaved": "تم حفظ التسجيل. ابدأ تسجيلا جديدا عندما تكون جاهزا.",
  "session.pressPlay": "اضغط تشغيل لبدء التسجيل.",
  "session.sayStopRecording": "قل: أوقف التسجيل",
  "session.slideToApprove": "اسحب للموافقة",
  "session.suggestions": "الاقتراحات",
  "session.processingInsights": "ميديكسا تعالج البيانات لاستخراج الرؤى...",
  "session.noLiveInsights": "لا توجد رؤى مباشرة تطابق البحث.",
  "session.noSuggestions": "لا توجد اقتراحات تطابق البحث.",
  "session.listeningForSuggestions": "جار الاستماع للاقتراحات السريرية واقتراحات الفوترة...",
  "session.protocolAsk": "سؤال البروتوكول",
  "session.protocolWeeklyActivity": "اسأل المريض عن مستوى النشاط الأسبوعي قبل إغلاق الاستقبال.",
  "session.manualTechniques": "تم اكتشاف تقنيات علاج يدوي. هل تريد إضافة رمز CPT 97140 لهذه الجلسة؟",
  "session.manualTherapyDetected": "تم اكتشاف تقنيات علاج يدوي أثناء الجلسة.",
  "session.unitRecorded": "تم تسجيل وحدة",
  "session.unitRecordedText": "تم تسجيل وحدة واحدة لرمز CPT الذي تمت مراجعته عند ٨:٠٤",
  "session.snfValidationAlert": "تنبيه تحقق SNF",
  "session.snfValidationText": "درجات حركة Section GG تختلف عن سجل التمريض",
  "session.insightApproved": "تمت الموافقة على الرؤية",
  "session.insightIgnored": "تم تجاهل الرؤية",
  "session.billingSelected": "تم اختيار عنصر فوترة",
  "session.detectedSelected": "تم اختيار عنصر مكتشف",
  "session.soapSaved": "تم حفظ ملاحظات SOAP",
  "session.stopRecordingQuestion": "هل تريد إيقاف هذا التسجيل؟",
  "session.confirmStop": "تأكيد الإيقاف",
  "session.unitAt": "الوحدة",
  "session.left": "متبق",
  "session.liveTranscript": "التفريغ المباشر",
  "session.currentChunk": "المقطع الحالي لمدة ٣٠ ثانية",
  "session.aiSummarySegments": "مقاطع ملخص الذكاء الاصطناعي كل ٣٠ ثانية",
  "session.possibleClinicalImpressions": "انطباعات سريرية محتملة",
  "session.symptomsDetected": "الأعراض المكتشفة",
  "session.soapSuggestions": "اقتراحات SOAP",
  "session.billingHints": "تلميحات الفوترة",
  "session.confidence": "الثقة",
  "session.generated": "تم الإنشاء",
  "session.listening": "ميديكسا تستمع الآن",
  "session.paused": "متوقف مؤقتا",
  "session.unsupported": "غير مدعوم",
  "session.webSpeechUnsupported": "Web Speech غير مدعوم في هذا المتصفح. يرجى استخدام Chrome أو Edge.",
  "session.microphoneRequired": "إذن الميكروفون مطلوب للتفريغ المباشر.",
  "session.voiceMicrophoneRequired": "إذن الميكروفون مطلوب لتفعيل أوامر ميديكسا الصوتية.",
  "session.aiDisclaimer": "الاقتراحات المدعومة بالذكاء الاصطناعي تتطلب مراجعة الطبيب.",
  "session.speechStatus": "حالة الكلام",
  "session.generateTestSummary": "إنشاء ملخص اختباري",
  "session.transcriptPlaceholder": "سيظهر الكلام هنا أثناء نشاط التسجيل.",
  "session.noSummarySegments": "لم يتم إنشاء أي مقاطع ملخص بعد.",
  "session.transcriptExcerpt": "مقتطف التفريغ",
  "session.totalDuration": "المدة الإجمالية",
  "session.redirectComplete": "اكتمل العد التنازلي للتحويل",
  "session.latestChunkCptMatches": "مطابقات CPT في آخر مقطع",
  "session.fullTranscriptCptMatches": "مطابقات CPT في التفريغ الكامل",
  "session.finalCptMatchesUsed": "مطابقات CPT النهائية المستخدمة",
  "session.cptRecords": "سجلات CPT",
  "session.audioTranscriptGenerated": "تم إنشاء تفريغ الصوت",
  "session.uploadedAudioTranscript": "تفريغ الصوت المرفوع",
  "session.aiClinicalImpressions": "انطباعات سريرية محتملة بمساعدة الذكاء الاصطناعي",
  "session.icd10Suggestions": "اقتراحات ICD-10",
  "session.noIcd10Suggestions": "لم يتم اكتشاف اقتراحات ICD-10.",
  "session.cptBillingSuggestions": "اقتراحات CPT/الفوترة",
  "session.noCptBillingSuggestions": "لم يتم اكتشاف اقتراحات CPT/الفوترة.",
  "session.bodyRegionDetected": "منطقة الجسم المكتشفة",
  "session.noBodyRegionDetected": "لم يتم اكتشاف منطقة جسم.",
  "session.ncciWarnings": "تحذيرات تعارض NCCI",
  "session.noNcciWarnings": "لم يتم اكتشاف تحذيرات تعارض NCCI.",
  "session.cptInProgress": "CPT {code} {status}",
  "session.cptPaused": "متوقف مؤقتا",
  "session.cptInProgressStatus": "قيد التنفيذ",
  "session.unitProgress": "{duration} / {units} {unitLabel}",
  "session.nextUnit": "الوحدة {unit} عند {duration} - يتبقى {left}",
  "session.detectedCode": "تم اكتشاف {code}",
  "session.cptTimerStarted": "تم بدء مؤقت CPT {code}.",
  "session.startCptTimer": "بدء مؤقت CPT",
  "session.stopCptTimer": "إيقاف مؤقت CPT",
  "session.sessionUnitsCount": "وحدات الجلسة: {units}",
  "session.voiceTriggerPermissionRequired": "المشغل الصوتي: الإذن مطلوب",
  "session.voiceTriggerDetected": "المشغل الصوتي: تم الاكتشاف",
  "session.voiceTriggerListening": "المشغل الصوتي: يستمع",
  "session.voiceTriggerArmed": "المشغل الصوتي: جاهز",
  "session.uploadAudioForTest": "رفع صوت للاختبار",
  "session.transcribingAudio": "جار تفريغ الصوت...",
  "session.audioTranscriptionFailed": "فشل تفريغ الصوت. يرجى التحقق من الخادم.",
  "session.codes": "الرموز",
  "session.region": "المنطقة",
  "session.matched": "المطابق",
  "session.documentation": "التوثيق",
  "session.billingCaveats": "تنبيهات الفوترة",
  "session.localSoapSubjective": "يفيد {patientName} باستمرار التعب مع ألم أسفل الظهر خلال لقاء {careType} الحالي.",
  "session.localSoapObjective": "توثيق الجلسة المباشرة لـ {patientName}: تمت مراجعة النشاط العلاجي والتنبيهات السريرية خلال {duration}.",
  "session.localSoapAssessment": "لقاء {careType} مرتبط بالرمز {icd}.",
  "session.appliedRecommendations": "التوصيات المطبقة: {notes}",
  "cpt.procedureDetected": "تم اكتشاف إجراء",
  "cpt.startingProcedure": "هل تريد بدء إجراء علاجي؟",
  "cpt.procedureDescription": "تم اكتشاف إجراء للرمز {code}{name}. هل تريد بدء سجل CPT لهذه الجلسة؟",
  "cpt.suggestedReview": "CPT مقترح. يتطلب مراجعة الطبيب.",
  "cpt.suggestedTitle": "CPT مقترح {code}",
  "cpt.detectedFromSpeech": "تم اكتشاف {name} من الكلام المباشر. {reason} يتطلب مراجعة الطبيب.",
  "cpt.applyToStart": "CPT مقترح {code} - {name}. طبقه لبدء مؤقت CPT.",
  "modifier.review": "مراجعة المعدل",
  "modifier.required": "مطلوب مراجعة المعدل 59",
  "modifier.sameRegion": "تم اكتشاف عدة خدمات CPT لنفس منطقة الجسم: {bodyRegion}. راجع ما إذا كان المعدل 59 مطلوبا للخدمات الإجرائية المستقلة.",
  "modifier.aiReview": "اقتراح معدل بمساعدة الذكاء الاصطناعي. يتطلب مراجعة الطبيب.",
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
  "soap.noNote": "لم يتم إنشاء ملاحظة SOAP لهذه الجلسة.",
  "soap.billingCptSummary": "ملخص الفوترة / CPT",
  "soap.requiresReview": "يتطلب مراجعة الطبيب",
  "billing.title": "ذكاء الفوترة",
  "billing.sessionTime": "وقت الجلسة",
  "billing.sessionUnits": "وحدات الجلسة",
  "billing.cptCodesDetected": "رموز CPT المكتشفة",
  "billing.addMoreCpts": "إضافة المزيد من رموز CPT",
  "billing.editCpt": "تعديل CPT",
  "billing.addCpt": "إضافة CPT",
  "billing.saveChanges": "حفظ التغييرات",
  "billing.saveCpt": "حفظ CPT",
  "billing.cptCode": "رمز CPT",
  "billing.description": "الوصف",
  "billing.snfFunctionalLogic": "منطق SNF والوظائف",
  "billing.noCpt": "لا توجد رموز CPT تطابق البحث.",
  "billing.threshold": "+ ١ حد $11,091/$2,330",
  "billing.eightMinuteRule": "قاعدة الثماني دقائق",
  "billing.sectionGg": "القسم GG - مستوى مساعدة المريض (MDS 3.0)",
  "billing.partial": "٣ - جزئي",
  "billing.unitDuration": "الوحدات: {units}   المدة: {duration}",
  "billing.potentialBundleConflict": "تم اكتشاف تعارض تجميع محتمل مع {code}. هل تريد تطبيق المعدل؟",
  "summary.sessionSummaryNote": "ملاحظة ملخص الجلسة",
  "summary.sendToPatient": "إرسال إلى المريض",
  "summary.confirmSend": "تأكيد الإرسال",
  "summary.sendQuestion": "هل تريد إرسال هذا الملخص إلى المريض؟",
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
  "pagination.previous": "السابق",
  "pagination.next": "التالي",
  "status.awaiting": "قيد الانتظار",
  "status.active": "نشط",
  "gender.male": "ذكر",
  "gender.female": "أنثى",
  "unit.one": "وحدة",
  "unit.other": "وحدات",
  "time.minute.one": "دقيقة",
  "time.minute.other": "دقائق",
  "time.second.one": "ثانية",
  "time.second.other": "ثوان",
};

export const translations: Record<Language, Record<string, string>> = {
  en,
  ar: { ...en, ...ar, ...cleanArabicTranslations },
  he: { ...en, ...he },
};

const rtlLanguages = new Set<Language>(["ar", "he"]);

const arabicDigitFormatter = new Intl.NumberFormat("ar", { useGrouping: false });

const cptDisplayNames: Record<string, Record<Language, string>> = {
  "97110": { en: "Therapeutic Exercise", ar: "التمارين العلاجية", he: "Therapeutic Exercise" },
  "97112": { en: "Neuromuscular Reeducation", ar: "إعادة التأهيل العصبي العضلي", he: "Neuromuscular Reeducation" },
  "97116": { en: "Gait Training", ar: "تدريب المشي", he: "Gait Training" },
  "97140": { en: "Manual Therapy", ar: "العلاج اليدوي", he: "Manual Therapy" },
  "97530": { en: "Therapeutic Activity", ar: "الأنشطة العلاجية", he: "Therapeutic Activity" },
  "97535": { en: "Self-Care / ADL", ar: "تدريب العناية الذاتية / إدارة المنزل", he: "Self-Care / ADL" },
  "97124": { en: "Massage Therapy", ar: "التدليك العلاجي", he: "Massage Therapy" },
  "97150": { en: "Group Therapeutic Procedure", ar: "الإجراء العلاجي الجماعي", he: "Group Therapeutic Procedure" },
  "97010": { en: "Hot / Cold Packs", ar: "الكمادات الساخنة / الباردة", he: "Hot / Cold Packs" },
  "97012": { en: "Mechanical Traction", ar: "الشد الميكانيكي", he: "Mechanical Traction" },
  "97035": { en: "Therapeutic Ultrasound", ar: "الموجات فوق الصوتية العلاجية", he: "Therapeutic Ultrasound" },
};

const dynamicArabicPatterns: Array<[RegExp, string]> = [
  [/^Requires clinician review\.?$/i, "يتطلب مراجعة الطبيب"],
  [/^Current session\.?$/i, "الجلسة الحالية"],
  [/^Insufficient transcript captured for this session\.?$/i, "لم يتم التقاط تفريغ كاف لهذه الجلسة"],
  [/^Patient reports persistent fatigue and lower back pain for 3 weeks\.?$/i, "يذكر المريض استمرار الإرهاق وألم أسفل الظهر لمدة ٣ أسابيع."],
  [/^Does anyone in your family have diabetes or vascular issues\?$/i, "هل يوجد لدى أي فرد من عائلتك مرض السكري أو مشكلات في الأوعية الدموية؟"],
  [/^97530 - Therapeutic Act\. detected add CPT for the session\?$/i, "تم اكتشاف نشاط علاجي. هل تريد إضافة رمز CPT 97530 لهذه الجلسة؟"],
  [/^Therapeutic activity timing crossed a billable threshold\.?$/i, "تجاوز وقت النشاط العلاجي الحد القابل للفوترة."],
  [/^How often do you engage in physical activity each week\?$/i, "كم مرة تمارس النشاط البدني كل أسبوع؟"],
  [/^Prompt patient for weekly activity level before closing intake\.?$/i, "اسأل المريض عن مستوى النشاط الأسبوعي قبل إغلاق الاستقبال."],
  [/^Manual techniques detected, add CPT 97140 for the session\?$/i, "تم اكتشاف تقنيات علاج يدوي. هل تريد إضافة رمز CPT 97140 لهذه الجلسة؟"],
  [/^Manual therapy techniques were detected during the session\.?$/i, "تم اكتشاف تقنيات علاج يدوي أثناء الجلسة."],
  [/^Unit Recorded$/i, "تم تسجيل وحدة"],
  [/^1 unit recorded for the reviewed CPT at 8:04$/i, "تم تسجيل وحدة واحدة لرمز CPT الذي تمت مراجعته عند ٨:٠٤"],
  [/^Modifier 59 Required$/i, "مطلوب مراجعة المعدل 59"],
  [/^Potential bundle conflict detected for same-region CPT services\. Apply modifier\?$/i, "تم اكتشاف تعارض تجميع محتمل لخدمات CPT في نفس المنطقة. هل تريد تطبيق المعدل؟"],
  [/^SNF Validation Alert$/i, "تنبيه تحقق SNF"],
  [/^Section GG mobility scores differ from nursing log$/i, "درجات حركة Section GG تختلف عن سجل التمريض"],
  [/^Therapy activities observed or documented from transcript: therapy activities require clinician review\.?$/i, "تمت ملاحظة أو توثيق أنشطة علاجية من التفريغ: تتطلب الأنشطة العلاجية مراجعة الطبيب."],
  [/^Clinician should review transcript-derived SOAP content, CPT\/ICD suggestions, documentation support, and billing caveats before signing or billing\.?$/i, "يجب على الطبيب مراجعة محتوى SOAP المستخلص من التفريغ، واقتراحات CPT/ICD، ودعم التوثيق، وملاحظات الفوترة قبل التوقيع أو إصدار الفاتورة."],
];

function localizeDigits(value: string) {
  return value.replace(/\d/g, (digit) => arabicDigitFormatter.format(Number(digit)));
}

export function getDirection(language: Language) {
  return rtlLanguages.has(language) ? "rtl" : "ltr";
}

export function isRTL(language: Language) {
  return getDirection(language) === "rtl";
}

export function getCurrentLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }

  const stored = window.localStorage.getItem("medexa-language");
  return stored === "ar" || stored === "he" || stored === "en" ? stored : "en";
}

export function translate(language: Language, key: string, params: TranslationParams = {}) {
  const template = translations[language][key] ?? translations.en[key] ?? key;

  if (process.env.NODE_ENV === "development" && template === key && !translations.en[key]) {
    console.warn(`Missing translation key: ${key}`);
  }

  return template.replace(/\{(\w+)\}/g, (_, paramKey: string) => {
    const value = params[paramKey];
    return value === null || value === undefined ? "" : String(value);
  });
}

export function translateCptDisplayName(code: string | null | undefined, fallbackName: string | null | undefined, language: Language) {
  if (!code) {
    return fallbackName ?? "";
  }

  return cptDisplayNames[code]?.[language] ?? fallbackName ?? code;
}

export const translateCptLabel = translateCptDisplayName;

export function formatNumber(value: number | string, language: Language) {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return language === "ar" ? localizeDigits(String(value)) : String(value);
  }

  return new Intl.NumberFormat(language === "ar" ? "ar" : language).format(parsed);
}

export function formatClockTime(totalSeconds: number, language: Language) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const value = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  return language === "ar" ? localizeDigits(value) : value;
}

export function formatDuration(totalSeconds: number, language: Language) {
  return formatClockTime(totalSeconds, language);
}

export function formatUnits(count: number, language: Language) {
  const unitLabel = translate(language, count === 1 ? "unit.one" : "unit.other");
  return `${formatNumber(count, language)} ${unitLabel}`;
}

export function formatDurationLabel(seconds: number, language: Language) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const minuteLabel = translate(language, minutes === 1 ? "time.minute.one" : "time.minute.other");
  const secondLabel = translate(language, remainingSeconds === 1 ? "time.second.one" : "time.second.other");

  if (minutes <= 0) {
    return `${formatNumber(remainingSeconds, language)} ${secondLabel}`;
  }

  if (remainingSeconds <= 0) {
    return `${formatNumber(minutes, language)} ${minuteLabel}`;
  }

  return `${formatNumber(minutes, language)} ${minuteLabel} ${formatNumber(remainingSeconds, language)} ${secondLabel}`;
}

export function formatDateTime(value: string | Date, language: Language) {
  const date = typeof value === "string" ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return language === "ar" ? localizeDigits(String(value)) : String(value);
  }

  return new Intl.DateTimeFormat(language === "ar" ? "ar" : language, {
    month: "long",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatCurrency(value: number, language: Language) {
  return new Intl.NumberFormat(language === "ar" ? "ar" : language, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function translateStatus(status: string | null | undefined, language: Language) {
  if (!status) {
    return "";
  }

  const normalized = status.toLowerCase();
  if (language === "ar") {
    if (normalized.includes("awaiting")) return translate(language, "status.awaiting");
    if (normalized.includes("active")) return translate(language, "status.active");
    if (normalized.includes("summarized")) return translate(language, "ambient.summarized");
    if (normalized.includes("summary pending")) return translate(language, "ambient.summaryPending");
    if (normalized.includes("approved")) return translate(language, "common.approved");
    if (normalized.includes("rejected")) return translate(language, "common.rejected");
    if (normalized.includes("pending")) return translate(language, "status.awaiting");
  }

  return status;
}

export function translateDynamicMessage(message: string | null | undefined, language: Language) {
  if (!message) {
    return "";
  }

  if (language !== "ar") {
    return message;
  }

  let translated = message;
  for (const [pattern, replacement] of dynamicArabicPatterns) {
    translated = translated.replace(pattern, replacement);
  }

  translated = translated
    .replace(/\bTherapeutic Exercise\b/g, cptDisplayNames["97110"].ar)
    .replace(/\bNeuromuscular Reeducation\b/g, cptDisplayNames["97112"].ar)
    .replace(/\bGait Training\b/g, cptDisplayNames["97116"].ar)
    .replace(/\bManual Therapy\b/g, cptDisplayNames["97140"].ar)
    .replace(/\bTherapeutic Act\.?\b/g, cptDisplayNames["97530"].ar)
    .replace(/\bTherapeutic Activity\b/g, cptDisplayNames["97530"].ar)
    .replace(/\bSelf-Care \/ Home Management Training\b/g, cptDisplayNames["97535"].ar)
    .replace(/\bDetected\b/g, translate("ar", "common.detected"))
    .replace(/\bBilling\b/g, translate("ar", "common.billing"))
    .replace(/\bProtocol Ask\b/g, translate("ar", "session.protocolAsk"))
    .replace(/\bRequires clinician review\.?/g, translate("ar", "soap.requiresReview"))
    .replace(/\bCurrent session\b/g, "الجلسة الحالية")
    .replace(/\bUnit\(s\)\b/g, "الوحدات")
    .replace(/\bunit\(s\)\b/gi, "وحدة")
    .replace(/\bunits\b/gi, "وحدات")
    .replace(/\bunit\b/gi, "وحدة")
    .replace(/\bDuration\b/g, "المدة");

  return localizeDigits(translated);
}
