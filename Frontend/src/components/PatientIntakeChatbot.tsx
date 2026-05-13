import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, CheckCircle2, AlertCircle } from "lucide-react";

/* ─── Types ─── */

interface PatientData {
  fullName: string;
  age: string;
  gender: string;
  phone: string;
  address: string;
  mail: string;
  mainSymptom: string;
  symptomDuration: string;
  allergies: string;
  currentMedications: string;
}

interface ChatMessage {
  id: number;
  text: string;
  sender: "bot" | "user";
  type?: "text" | "select" | "success" | "error";
  options?: string[];
}

interface Question {
  key: keyof PatientData;
  prompt: string;
  type: "text" | "select";
  options?: string[];
  validate?: (val: string) => string | null;
}

/* ─── Questions ─── */

const QUESTIONS: Question[] = [
  {
    key: "fullName",
    prompt:
      "Hello! 👋 Welcome to the AI-Assisted Patient Intake System.\n\nWhat is your full name?",
    type: "text",
  },
  {
    key: "age",
    prompt: "How old are you?",
    type: "text",
    validate: (v) => {
      const n = Number(v);
      if (isNaN(n) || n <= 0 || n > 150 || !Number.isInteger(n))
        return "Please enter a valid age (1–150).";
      return null;
    },
  },
  {
    key: "gender",
    prompt: "What is your gender?",
    type: "select",
    options: ["Male", "Female", "Other", "Prefer not to say"],
  },
  {
    key: "phone",
    prompt: "Please provide your phone number (10 digits).",
    type: "text",
    validate: (v) => {
      const clean = v.replace(/\D/g, "");
      if (!/^\d{10}$/.test(clean))
        return "Phone number must be exactly 10 digits.";
      return null;
    },
  },
  {
    key: "address",
    prompt: "What is your address?",
    type: "text",
  },
  {
    key: "mail",
    prompt: "What is your email address?",
    type: "text",
    validate: (v) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(v))
        return "Please enter a valid email address.";
      return null;
    },
  },
  {
    key: "mainSymptom",
    prompt: "What is your main symptom or reason for visiting?",
    type: "text",
  },
  {
    key: "symptomDuration",
    prompt: "How long have you been experiencing this symptom?",
    type: "text",
  },
  {
    key: "allergies",
    prompt: "Do you have any allergies? (Type 'None' if not)",
    type: "text",
  },
  {
    key: "currentMedications",
    prompt: "Are you currently taking any medications? (Type 'None' if not)",
    type: "text",
  },
];

/* ─── Component ─── */

const PatientIntakeChatbot = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [inputValue, setInputValue] = useState("");
  const [patientData, setPatientData] = useState<PatientData>({
    fullName: "",
    age: "",
    gender: "",
    phone: "",
    address: "",
    mail: "",
    mainSymptom: "",
    symptomDuration: "",
    allergies: "",
    currentMedications: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);
  const getId = () => ++nextId.current;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    const first = QUESTIONS[0];
    addBotMessage(first.prompt, first.type, first.options);
  }, []);

  const addBotMessage = (
    text: string,
    type: ChatMessage["type"] = "text",
    options?: string[]
  ) => {
    setMessages((prev) => [
      ...prev,
      { id: getId(), text, sender: "bot", type, options },
    ]);
  };

  const addUserMessage = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: getId(), text, sender: "user" },
    ]);
  };

  const processAnswer = useCallback(
    (answer: string) => {
      if (isComplete || isSubmitting) return;

      const question = QUESTIONS[currentStep];
      if (!question) return;

      if (question.validate) {
        const error = question.validate(answer);
        if (error) {
          addBotMessage(error, "error");
          return;
        }
      }

      const cleanAnswer =
        question.key === "phone"
          ? answer.replace(/\D/g, "")
          : answer.trim();

      addUserMessage(cleanAnswer);

      const updated = {
        ...patientData,
        [question.key]: cleanAnswer,
      };

      setPatientData(updated);

      const nextStep = currentStep + 1;

      if (nextStep < QUESTIONS.length) {
        setCurrentStep(nextStep);
        const next = QUESTIONS[nextStep];
        setTimeout(() => {
          addBotMessage(next.prompt, next.type, next.options);
          inputRef.current?.focus();
        }, 400);
      } else {
        submitData(updated);
      }
    },
    [currentStep, patientData, isComplete, isSubmitting]
  );

  const submitData = async (data: PatientData) => {
    setIsSubmitting(true);
    addBotMessage("Submitting your intake form...");

    try {
      await fetch("http://localhost:5678/webhook/patient-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        action: "book",
        ...data
      }),
      });

      addBotMessage(
        "✅ Your hospital intake form has been successfully submitted.",
        "success"
      );
      setIsComplete(true);
    } catch {
      addBotMessage(
        "❌ There was an issue submitting your form.",
        "error"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSend = () => {
    if (!inputValue.trim()) return;
    processAnswer(inputValue);
    setInputValue("");
  };

  const handleOptionSelect = (option: string) => {
    processAnswer(option);
  };

  const currentQuestion =
    currentStep < QUESTIONS.length
      ? QUESTIONS[currentStep]
      : null;

  const showTextInput =
    currentQuestion?.type === "text" &&
    !isComplete &&
    !isSubmitting;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto h-[700px]
    rounded-3xl overflow-hidden bg-white shadow-2xl border border-blue-100">

      {/* Header */}
      <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-500 text-white flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">
            AI Medical Assistant
          </h2>
          <p className="text-xs opacity-90">
            Secure • Confidential • Smart Intake
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Online
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-5 bg-gradient-to-b from-blue-50/40 to-white"
      >
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${
                msg.sender === "user"
                  ? "justify-end"
                  : "justify-start"
              }`}
            >
              <div className="flex items-start gap-3 max-w-[80%]">

                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md
                  ${
                    msg.sender === "bot"
                      ? "bg-gradient-to-br from-blue-500 to-cyan-400 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {msg.sender === "bot" ? (
                    <Bot size={18} />
                  ) : (
                    <User size={18} />
                  )}
                </div>

                <div
                  className={`px-5 py-3 text-sm leading-relaxed whitespace-pre-line shadow-sm
                  ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white rounded-2xl rounded-tr-sm"
                      : msg.type === "success"
                      ? "bg-green-50 text-green-700 border border-green-200 rounded-2xl"
                      : msg.type === "error"
                      ? "bg-red-50 text-red-600 border border-red-200 rounded-2xl"
                      : "bg-white text-gray-800 border border-gray-200 rounded-2xl"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {currentQuestion?.type === "select" &&
          !isComplete &&
          !isSubmitting && (
            <div className="flex flex-wrap gap-3">
              {currentQuestion.options?.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleOptionSelect(opt)}
                  className="px-5 py-2 rounded-full text-sm font-medium
                  bg-white border border-blue-300 shadow-sm
                  hover:bg-gradient-to-r hover:from-blue-600 hover:to-cyan-500
                  hover:text-white transition-all duration-200"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
      </div>

      {showTextInput && (
        <div className="border-t border-blue-100 bg-white p-4 flex gap-3">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your answer..."
            className="flex-1 border border-blue-200 rounded-2xl px-5 py-3 text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            onClick={handleSend}
            className="bg-gradient-to-r from-blue-600 to-cyan-500
            hover:scale-105 active:scale-95
            text-white px-5 rounded-2xl shadow-md transition-all duration-200"
          >
            <Send size={18} />
          </button>
        </div>
      )}

      {isComplete && (
        <div className="border-t p-4 text-center text-sm text-gray-500">
          Intake form completed. Thank you!
        </div>
      )}
    </div>
  );
};

export default PatientIntakeChatbot;