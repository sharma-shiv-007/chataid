// Frontend/src/components/ProfileCard.jsx
import React from "react";

/**
 * ProfileCard — shows patient's personal info
 * Props: patient object from API
 */
export default function ProfileCard({ patient }) {
  if (!patient) return null;

  const initials = patient.name
    ? patient.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const infoItems = [
    { label: "Age",      value: patient.age    ? `${patient.age} years` : "—" },
    { label: "Gender",   value: patient.gender || "—" },
    { label: "Blood",    value: patient.blood  || "—" },
    { label: "Phone",    value: patient.phone  || "—" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Header strip */}
      <div className="h-20 bg-gradient-to-r from-blue-500 to-cyan-400" />

      <div className="px-6 pb-6 -mt-10">
        {/* Avatar */}
        <div className="w-16 h-16 rounded-2xl bg-white shadow-md border-2 border-white flex items-center justify-center text-2xl font-bold text-blue-600 mb-3">
          {initials}
        </div>

        <h2 className="text-xl font-bold text-slate-800">{patient.name}</h2>
        <p className="text-sm text-slate-400 mb-4">{patient.email}</p>

        <div className="grid grid-cols-2 gap-3">
          {infoItems.map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}