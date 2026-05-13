// Frontend/src/components/UpdateVitalsModal.jsx
import React, { useState } from "react";
import { api } from "../api/client";

/**
 * UpdateVitalsModal — doctor updates a patient's vitals
 * Props:
 *   patient  — { _id, name, vitals }
 *   onClose  — function to close modal
 *   onUpdate — function called with updated patient after save
 */
export default function UpdateVitalsModal({ patient, onClose, onUpdate }) {
  const [form, setForm] = useState({
    bloodPressure: patient?.vitals?.bloodPressure || "",
    heartRate:     patient?.vitals?.heartRate     || "",
    temperature:   patient?.vitals?.temperature   || "",
    status:        patient?.vitals?.status        || "Normal",
  });
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      const data = await api.updateVitals(patient._id, {
        bloodPressure: form.bloodPressure,
        heartRate:     form.heartRate     ? Number(form.heartRate)    : null,
        temperature:   form.temperature   ? Number(form.temperature)  : null,
        status:        form.status,
      });
      onUpdate(data.patient);
      onClose();
    } catch (err) {
      setError(err.message || "Failed to update vitals.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800">Update Vitals</h3>
            <p className="text-xs text-slate-400 mt-0.5">Patient: {patient?.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Blood Pressure (mmHg)</label>
            <input
              name="bloodPressure"
              value={form.bloodPressure}
              onChange={handleChange}
              placeholder="e.g. 120/80"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Heart Rate (bpm)</label>
            <input
              name="heartRate"
              type="number"
              value={form.heartRate}
              onChange={handleChange}
              placeholder="e.g. 72"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Temperature (°F)</label>
            <input
              name="temperature"
              type="number"
              step="0.1"
              value={form.temperature}
              onChange={handleChange}
              placeholder="e.g. 98.6"
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="Normal">Normal</option>
              <option value="Stable">Stable</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="text-sm font-medium text-slate-500 hover:text-slate-700 px-4 py-2 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Vitals"}
          </button>
        </div>
      </div>
    </div>
  );
}