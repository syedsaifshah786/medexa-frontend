SUPPORTED_LANGUAGES = {"en", "ar", "he"}


def normalize_language(language: str | None) -> str:
    return language if language in SUPPORTED_LANGUAGES else "en"


def is_arabic(language: str | None) -> bool:
    return normalize_language(language) == "ar"


CPT_DISPLAY_NAMES_AR = {
    "97110": "التمارين العلاجية",
    "97112": "إعادة التأهيل العصبي العضلي",
    "97116": "تدريب المشي",
    "97140": "العلاج اليدوي",
    "97530": "الأنشطة العلاجية",
    "97535": "تدريب العناية الذاتية / إدارة المنزل",
    "97124": "التدليك العلاجي",
    "97150": "الإجراء العلاجي الجماعي",
    "97010": "الكمادات الساخنة / الباردة",
    "97012": "الشد الميكانيكي",
    "97035": "الموجات فوق الصوتية العلاجية",
}


def translate_cpt_display_name(code: str | None, fallback: str | None, language: str | None) -> str:
    if is_arabic(language) and code in CPT_DISPLAY_NAMES_AR:
        return CPT_DISPLAY_NAMES_AR[code]
    return fallback or code or ""


def clinician_review(language: str | None) -> str:
    return "يتطلب مراجعة الطبيب" if is_arabic(language) else "Requires clinician review"


def apply_label(language: str | None) -> str:
    return "تطبيق" if is_arabic(language) else "Apply"


def modifier59_title(language: str | None) -> str:
    return "مطلوب مراجعة المعدل 59" if is_arabic(language) else "Modifier 59 Required"


def modifier59_description(codes: list[str], body_region: str, language: str | None) -> str:
    if is_arabic(language):
        return (
            f"تم اكتشاف عدة خدمات CPT لنفس منطقة الجسم: {body_region}. "
            "راجع ما إذا كان المعدل 59 مطلوبا للخدمات الإجرائية المستقلة."
        )
    return (
        f"Multiple CPT services detected for the same body region: {body_region}. "
        "Review whether Modifier 59 is required for distinct procedural services."
    )


def fallback_soap_text(key: str, language: str | None) -> str:
    if not is_arabic(language):
        return {
            "insufficient": "Insufficient transcript captured for this session",
            "draft": "AI-assisted session draft based on live transcript and clinician actions.",
            "assessment": "Clinical impression / working assessment only; clinician review required.",
            "plan": "Clinician should review transcript-derived SOAP content, CPT/ICD suggestions, documentation support, and billing caveats before signing or billing.",
            "diagnosis": "Working clinical impression only; suggested diagnoses require clinician review.",
            "summary": "AI-assisted SOAP draft generated from the live session. AI-assisted suggestions require clinician review.",
            "none": "None detected",
        }[key]

    return {
        "insufficient": "لم يتم التقاط تفريغ كاف لهذه الجلسة",
        "draft": "مسودة جلسة بمساعدة الذكاء الاصطناعي بناء على التفريغ المباشر وإجراءات الطبيب.",
        "assessment": "انطباع سريري / تقييم أولي فقط؛ يتطلب مراجعة الطبيب.",
        "plan": "يجب على الطبيب مراجعة محتوى SOAP المستخلص من التفريغ، واقتراحات CPT/ICD، ودعم التوثيق، وملاحظات الفوترة قبل التوقيع أو إصدار الفاتورة.",
        "diagnosis": "انطباع سريري أولي فقط؛ التشخيصات المقترحة تتطلب مراجعة الطبيب.",
        "summary": "تم إنشاء مسودة SOAP بمساعدة الذكاء الاصطناعي من الجلسة المباشرة. تتطلب الاقتراحات مراجعة الطبيب.",
        "none": "لم يتم اكتشاف شيء",
    }[key]
