// Frontend/src/components/MedicalInfoCard.jsx
import React from "react";

/**
 * MedicalInfoCard — shows symptoms, conditions, allergies, medications
 */
export default function MedicalInfoCard({ patient }) {
  if (!patient) return null;

  const Tag = ({ label, color = "blue" }) => {
    const colors = {
      blue:   "bg-blue-50   text-blue-700   border-blue-100",
      orange: "bg-orange-50 text-orange-700 border-orange-100",
      rose:   "bg-rose-50   text-rose-700   border-rose-100",
      violet: "bg-violet-50 text-violet-700 border-violet-100",
    };
    return (
      <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border ${colors[color]}`}>
        {label}
      </span>
    );
  };

  const Section = ({ title, icon, items, color, emptyMsg }) => (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <span>{icon}</span>{title}
      </p>
      {items && items.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <Tag key={i} label={item} color={color} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 italic">{emptyMsg}</p>
      )}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
        <span className="text-lg">🏥</span>
        <h3 className="font-bold text-slate-800">Medical Information</h3>
      </div>

      <div className="space-y-4">
        {/* Symptoms + duration */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>🤒</span>Symptoms
            {patient.symptomsSince && (
              <span className="normal-case font-normal text-slate-400">
                · since {patient.symptomsSince}
              </span>
            )}
          </p>
          {patient.symptoms && patient.symptoms.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {patient.symptoms.map((s, i) => <Tag key={i} label={s} color="blue" />)}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No symptoms recorded</p>
          )}
        </div>

        <Section
          title="Conditions"
          icon="📋"
          items={patient.conditions}
          color="orange"
          emptyMsg="No conditions recorded"
        />
        <Section
          title="Allergies"
          icon="⚠️"
          items={patient.allergies}
          color="rose"
          emptyMsg="No allergies recorded"
        />
        <Section
          title="Medications"
          icon="💊"
          items={patient.medications}
          color="violet"
          emptyMsg="No medications recorded"
        />
      </div>
    </div>
  );
}