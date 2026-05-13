// Frontend/src/components/VitalsCard.jsx
import React from "react";

/**
 * VitalsCard — shows doctor-updated vitals
 * Props: vitals object { bloodPressure, heartRate, temperature, status, updatedAt }
 */
export default function VitalsCard({ vitals }) {
  const hasVitals = vitals && (vitals.bloodPressure || vitals.heartRate || vitals.temperature);

  const isCritical = vitals?.status === "Critical";

  const statusColors = {
    Normal:     "bg-emerald-50 text-emerald-700 border-emerald-200",
    Stable:     "bg-blue-50   text-blue-700   border-blue-200",
    Monitoring: "bg-amber-50  text-amber-700  border-amber-200",
    Critical:   "bg-red-50    text-red-700    border-red-200",
  };

  const statusDot = {
    Normal:     "bg-emerald-500",
    Stable:     "bg-blue-500",
    Monitoring: "bg-amber-500",
    Critical:   "bg-red-500",
  };

  const metrics = [
    {
      icon: "🩸",
      label: "Blood Pressure",
      value: vitals?.bloodPressure || "—",
      unit: vitals?.bloodPressure ? "mmHg" : "",
      critical: isCritical,
    },
    {
      icon: "💓",
      label: "Heart Rate",
      value: vitals?.heartRate != null ? vitals.heartRate : "—",
      unit: vitals?.heartRate != null ? "bpm" : "",
      critical: isCritical && vitals?.heartRate > 100,
    },
    {
      icon: "🌡️",
      label: "Temperature",
      value: vitals?.temperature != null ? vitals.temperature : "—",
      unit: vitals?.temperature != null ? "°F" : "",
      critical: isCritical && vitals?.temperature > 99.5,
    },
  ];

  return (
    <div className={`bg-white rounded-2xl shadow-sm border overflow-hidden ${isCritical ? "border-red-200" : "border-slate-100"}`}>
      {/* Card header */}
      <div className={`px-5 py-4 flex items-center justify-between border-b ${isCritical ? "border-red-100 bg-red-50" : "border-slate-50"}`}>
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-bold text-slate-800">Vitals</h3>
          <span className="text-xs text-slate-400 font-medium">/ Doctor Updated</span>
        </div>

        {vitals?.status && (
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[vitals.status] || statusColors.Normal}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot[vitals.status] || "bg-slate-400"}`} />
            {vitals.status}
          </span>
        )}
      </div>

      <div className="p-5">
        {!hasVitals ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center text-2xl mb-3">
              🩺
            </div>
            <p className="text-sm font-semibold text-slate-500">No vitals added yet</p>
            <p className="text-xs text-slate-400 mt-1">Your doctor will update this after your visit</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {metrics.map(({ icon, label, value, unit, critical }) => (
              <div
                key={label}
                className={`rounded-xl p-3 text-center transition-all ${
                  critical ? "bg-red-50 border border-red-100" : "bg-slate-50"
                }`}
              >
                <span className="text-xl block mb-1">{icon}</span>
                <p className={`text-lg font-bold ${critical ? "text-red-600" : "text-slate-800"}`}>
                  {value}
                  {unit && <span className="text-xs font-normal ml-0.5 text-slate-400">{unit}</span>}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}

        {vitals?.updatedAt && (
          <p className="text-xs text-slate-400 mt-4 text-right">
            Last updated: {new Date(vitals.updatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}