import { Activity, Heart } from "lucide-react";
import PatientIntakeChatbot from "@/components/PatientIntakeChatbot";

/* ─── Main Index Page ─── */

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="header-gradient text-primary-foreground py-6 px-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-foreground/15 flex items-center justify-center backdrop-blur-sm">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              AI-Assisted Patient Intake System
            </h1>
            <p className="text-sm md:text-base opacity-90">
              Automating Hospital Patient Registration using Conversational Interface
            </p>
          </div>
        </div>
      </header>

      {/* ── Chat Section ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <PatientIntakeChatbot />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-card py-4 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Heart className="w-4 h-4 text-primary" />
            <span>Developed by Final Year CS Project Team</span>
          </div>
          <span className="opacity-60">© {new Date().getFullYear()} AI Patient Intake System</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
