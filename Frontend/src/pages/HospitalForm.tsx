import { useParams } from "react-router-dom";
import { useState } from "react";

const hospitalForms: any = {
  "aiims-vijaypur": {
    name: "AIIMS Vijaypur",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "uhid", label: "Previous AIIMS UHID (if any)" },
      { name: "referral", label: "Referred By (Doctor / Hospital)" },
      { name: "department", label: "Preferred Department" },
    ],
  },

  "aiims-jammu": {
    name: "AIIMS Jammu",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "uhid", label: "Previous AIIMS UHID" },
      { name: "emergencyContact", label: "Emergency Contact" },
      { name: "bloodGroup", label: "Blood Group" },
    ],
  },

  "narayana-jammu": {
    name: "Narayana Hospital",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "insuranceProvider", label: "Insurance Provider" },
      { name: "tpa", label: "TPA Name" },
      { name: "existingPatient", label: "Existing Patient ID" },
    ],
  },

  "fortis-jammu": {
    name: "Fortis Escorts Hospital",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "insuranceProvider", label: "Insurance Provider" },
      { name: "policyNumber", label: "Policy Number" },
      { name: "corporateTieUp", label: "Corporate Tie-up" },
    ],
  },

  "gmc-jammu": {
    name: "Government Medical College",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "rationCard", label: "Ration Card Number" },
      { name: "bplStatus", label: "BPL Status (Yes/No)" },
      { name: "wardPreference", label: "Ward Preference" },
    ],
  },

  "smgs-jammu": {
    name: "SMGS Hospital",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "guardianName", label: "Guardian Name (if minor)" },
      { name: "previousAdmission", label: "Previous Admission Details" },
      { name: "localAddress", label: "Temporary Local Address" },
    ],
  },

  "kathua-district": {
    name: "District Hospital Kathua",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "village", label: "Village Name" },
      { name: "phc", label: "Nearest PHC" },
      { name: "incomeCertificate", label: "Income Certificate Available?" },
    ],
  },

  "kishtwar-district": {
    name: "District Hospital Kishtwar",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "remoteArea", label: "From Remote Area?" },
      { name: "ambulanceRequired", label: "Ambulance Required?" },
      { name: "bloodGroup", label: "Blood Group" },
    ],
  },

  "katra-community": {
    name: "Community Health Centre Katra",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "pilgrim", label: "Are you a Pilgrim?" },
      { name: "stayLocation", label: "Place of Stay in Katra" },
      { name: "travelHistory", label: "Recent Travel History" },
    ],
  },

  "reasi-district": {
    name: "District Hospital Reasi",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "chronicDisease", label: "Chronic Disease Details" },
      { name: "familyDoctor", label: "Family Doctor Name" },
      { name: "incomeCertificate", label: "Income Certificate" },
    ],
  },

  "udhampur-district": {
    name: "District Hospital Udhampur",
    extraFields: [
      { name: "symptoms", label: "Symptoms" },
      { name: "symptomDays", label: "Since how many days?" },
      { name: "armedForces", label: "Armed Forces Personnel?" },
      { name: "dependentCard", label: "Dependent Card Number" },
      { name: "medicalBoard", label: "Medical Board Case?" },
    ],
  },
};

const HospitalForm = () => {
  const { hospitalId } = useParams();
  const hospitalData = hospitalForms[hospitalId as string];

  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleChange = (e: any) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const response = await fetch(
        "http://localhost:5678/webhook/patient-intake",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "book", 
            hospital: hospitalData.name,
            ...formData,
          }),
        }
      );

      if (!response.ok) throw new Error();

      setSuccessMessage("Form submitted successfully. Please check your email.");
    } catch {
      setErrorMessage("Submission failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!hospitalData) return <div className="text-white">Hospital not found</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto flex flex-col gap-4">

        {[
          { name: "fullName", label: "Full Name" },
          { name: "age", label: "Age", type: "number" },
          { name: "aadhaar", label: "Aadhaar Number" },
          { name: "contact", label: "Contact Number" },
          { name: "email", label: "Email Address", type: "email" },
        ].map((field) => (
          <input
            key={field.name}
            name={field.name}
            type={field.type || "text"}
            placeholder={field.label}
            onChange={handleChange}
            className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
          />
        ))}

        {hospitalData.extraFields.map((field: any, index: number) => (
          <input
            key={index}
            name={field.name}
            placeholder={field.label}
            onChange={handleChange}
            className="w-full p-3 rounded-xl bg-white/10 border border-white/20"
          />
        ))}

        <button
          onClick={handleSubmit}
          className="w-full bg-cyan-500 hover:bg-cyan-600 py-3 rounded-xl font-semibold mt-4"
        >
          {loading ? "Submitting..." : "Submit Registration"}
        </button>

        {successMessage && <p className="text-green-400 text-center">{successMessage}</p>}
        {errorMessage && <p className="text-red-400 text-center">{errorMessage}</p>}

      </div>
    </div>
  );
};

export default HospitalForm;