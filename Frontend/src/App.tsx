import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";

import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";        // ← NEW
import SelectHospital from "./pages/SelectHospital";
import Login from "./pages/Login";
import EmergencyBooking from "./pages/EmergencyBooking";
import ReschedulePage from "./pages/ReschedulePage";
import EmergencyVoiceBooking from "./pages/EmergencyVoiceBooking";
import SignupWizard from "./pages/SignupWizard";
import BookAppointment from "./pages/BookAppointment";
import PaymentPage from "./pages/PaymentPage";
import LabOrder from "./pages/LabOrder";
import LabDashboard from "./pages/LabDashboard";
import LabReports from "./pages/LabReports";
import LabAdmin from "./pages/LabAdmin";
import DoctorLabReports from "./pages/DoctorLabReports";

import PatientDashboard from "./pages/PatientDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import NurseDashboard from "./pages/NurseDashboard";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AuthProvider } from "./auth/AuthContext";

const queryClient = new QueryClient();

function GlobalEmergencyButton() {
  const navigate = useNavigate();
  const location = useLocation();

  const hiddenPaths = ["/dashboard", "/admin-dashboard", "/doctor-dashboard", "/nurse-dashboard"];
  if (hiddenPaths.includes(location.pathname)) return null;

  const emergencyButtonPlacement =
    location.pathname === "/" ? "landing" : location.pathname === "/login" ? "login" : "default";
  const emergencyButtonPosition =
    emergencyButtonPlacement === "landing"
      ? { top: 20, right: 18 }
      : emergencyButtonPlacement === "login"
        ? { top: 18, right: 18 }
        : { top: 72, right: 18 };

  return (
    <>
      <motion.button
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(239,68,68,0.55)",
            "0 0 0 10px rgba(239,68,68,0)",
            "0 0 0 0 rgba(239,68,68,0)",
          ],
        }}
        transition={{ repeat: Infinity, duration: 1.7 }}
        onClick={() => navigate("/emergency")}
        aria-label="Open emergency booking"
        data-emergency-placement={emergencyButtonPlacement}
        style={{
          position: "fixed",
          ...emergencyButtonPosition,
          zIndex: 300,
          height: 38,
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: "#dc2626",
          border: "1px solid rgba(248,113,113,0.75)",
          color: "#fff",
          borderRadius: 8,
          padding: "0 14px",
          fontSize: 13,
          fontWeight: 800,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        <AlertTriangle size={15} />
        Emergency
      </motion.button>
      <style>{`
        @media (max-width: 1100px) {
          [data-emergency-placement="landing"] {
            top: 86px !important;
            right: 18px !important;
          }
        }
        /* On mobile: move into the navbar row (top-right, navbar height is ~60px) */
        @media (max-width: 640px) {
          [aria-label="Open emergency booking"] {
            top: 11px !important;
            right: 60px !important;
            bottom: auto !important;
            height: 36px !important;
            font-size: 12px !important;
            padding: 0 10px !important;
          }
        }
      `}</style>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <GlobalEmergencyButton />
          <Routes>

            {/* 🏠 Public Routes */}
            <Route path="/" element={<LandingPage />} />                  {/* ← was SelectHospital */}
            <Route path="/select-hospital" element={<SelectHospital />} /> {/* ← moved here */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<SignupWizard />} />
            <Route path="/reschedule" element={<ReschedulePage />} />
            <Route path="/book-appointment" element={
              <ProtectedRoute allowedRoles={["patient"]}>
                <BookAppointment />
              </ProtectedRoute>
            } />
            <Route path="/payment" element={
              <ProtectedRoute allowedRoles={["patient"]}>
                <PaymentPage />
              </ProtectedRoute>
            } />
            <Route path="/voice" element={
              <ProtectedRoute allowedRoles={["patient"]}>
                <EmergencyVoiceBooking />
              </ProtectedRoute>
            } />

            <Route path="/lab/order" element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <LabOrder />
              </ProtectedRoute>
            } />

            <Route path="/lab/dashboard" element={
              <ProtectedRoute allowedRoles={["admin", "nurse"]}>
                <LabDashboard />
              </ProtectedRoute>
            } />

            <Route path="/lab/reports" element={
              <ProtectedRoute allowedRoles={["patient"]}>
                <LabReports />
              </ProtectedRoute>
            } />

            <Route path="/lab/doctor-reports" element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <DoctorLabReports />
              </ProtectedRoute>
            } />

            <Route path="/lab/admin" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <LabAdmin />
              </ProtectedRoute>
            } />

            {/* 👤 Patient Dashboard */}
            <Route path="/dashboard" element={<PatientDashboard />} />

            <Route path="/emergency" element={<EmergencyBooking />} />

            {/* 🩺 Doctor Dashboard */}
            <Route path="/doctor-dashboard" element={
              <ProtectedRoute allowedRoles={["doctor"]}>
                <DoctorDashboard />
              </ProtectedRoute>
            } />

            <Route path="/nurse-dashboard" element={
              <ProtectedRoute allowedRoles={["nurse"]}>
                <NurseDashboard />
              </ProtectedRoute>
            } />

            {/* 🏥 Admin Dashboard */}
            <Route path="/admin-dashboard" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            } />

            {/* 🔀 Redirects for common mistyped paths */}
            <Route path="/reports" element={<Navigate to="/lab/reports" replace />} />

            {/* ❌ Not Found */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
