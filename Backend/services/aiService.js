// backend/services/aiService.js
// Rule-based triage — no API key needed
function classifyLocally(chiefComplaint) {
  const text = chiefComplaint.toLowerCase();

  const rules = [
    {
      priority: "CRITICAL", score: 9, severity: "chest_pain",
      specialty: "Emergency Medicine",
      note: "Immediate intervention required — prioritise resuscitation bay.",
      keywords: [
        "chest pain","heart attack","cardiac arrest","not breathing",
        "unconscious","no pulse","stopped breathing","stroke",
        "radiating","left arm","crushing pain","seizure",
        "severe bleeding","heavy bleeding","unresponsive"
      ],
    },
    {
      priority: "HIGH", score: 7, severity: "breathing",
      specialty: "General Surgery",
      note: "Urgent assessment needed within 15 minutes.",
      keywords: [
        "difficulty breathing","shortness of breath","breathless",
        "high fever","fever 104","fever 105","vomiting blood",
        "head injury","broken bone","fracture","allergic reaction",
        "overdose","poisoning","deep cut","severe headache",
        "blurred vision","confusion","weakness one side"
      ],
    },
    {
      priority: "MEDIUM", score: 5, severity: "pain",
      specialty: "General Medicine",
      note: "Assess within 30 minutes and monitor vitals.",
      keywords: [
        "fever","vomiting","diarrhea","abdominal pain","stomach pain",
        "back pain","kidney pain","urinary","infection","sprain",
        "moderate pain","persistent cough","high bp","blood pressure"
      ],
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some(k => text.includes(k))) {
      return {
        severity:           rule.severity,
        priority:           rule.priority,
        aiSeverityScore:    rule.score,
        triageNote:         rule.note,
        suggestedSpecialty: rule.specialty,
      };
    }
  }

  return {
    severity:           "other",
    priority:           "MEDIUM",
    aiSeverityScore:    4,
    triageNote:         "Standard triage — await physician assessment.",
    suggestedSpecialty: "General Medicine",
  };
}

module.exports = { classifyLocally };