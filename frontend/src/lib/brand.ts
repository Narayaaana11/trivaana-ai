/**
 * TRIVAANA AI: Centralized Brand Registry
 * Official Design Tokens, Supported Languages, TRAI Compliance & Commercial Pricing
 */

export interface LanguageConfig {
  code: string;
  name: string;
  nativeName: string;
  region: string;
  defaultSpeaker: string;
}

export const BRAND = {
  name: "Trivaana AI",
  shortName: "Trivaana",
  codeName: "trivaana",
  tagline: "India's Most Natural-Sounding AI Telecalling Software",
  description: "Autonomous voice agents that call every lead in under 30 seconds, work through your lists in 7 Indian languages, and log every outcome.",
  version: "2.1.0-enterprise",

  colors: {
    primary: "#FF5500",
    primaryHover: "#EA580C",
    primaryDark: "#C2410C",
    primaryLight: "#FFF7ED",
    primaryBorder: "#FED7AA",
    bgLight: "#FFFFFF",
    bgCanvas: "#F8FAFC",
    bgCard: "#FFFFFF",
    border: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
  },

  languages: [
    {
      code: "te-IN",
      name: "Telugu",
      nativeName: "తెలుగు",
      region: "Andhra Pradesh & Telangana",
      defaultSpeaker: "Ananya (అనన్య)",
    },
    {
      code: "hi-IN",
      name: "Hindi",
      nativeName: "हिन्दी",
      region: "North & Central India",
      defaultSpeaker: "Priya (प्रिया)",
    },
    {
      code: "ta-IN",
      name: "Tamil",
      nativeName: "தமிழ்",
      region: "Tamil Nadu",
      defaultSpeaker: "Karthik (கார்த்திக்)",
    },
    {
      code: "kn-IN",
      name: "Kannada",
      nativeName: "ಕನ್ನಡ",
      region: "Karnataka",
      defaultSpeaker: "Rohan (ರೋಹನ್)",
    },
    {
      code: "ml-IN",
      name: "Malayalam",
      nativeName: "മലയാളം",
      region: "Kerala",
      defaultSpeaker: "Sneha (സ്നേഹ)",
    },
    {
      code: "mr-IN",
      name: "Marathi",
      nativeName: "मराठी",
      region: "Maharashtra",
      defaultSpeaker: "Pooja (पूजा)",
    },
    {
      code: "en-IN",
      name: "Indian English",
      nativeName: "Indian English",
      region: "Pan-India Corporate",
      defaultSpeaker: "Vikram",
    },
  ] as LanguageConfig[],

  compliance: {
    callingWindow: "10:00 AM - 6:00 PM IST",
    dndProtection: "National Do Not Call (NDNC) Scrubbed",
    aiDisclosureRequired: true,
  },
} as const;

export default BRAND;
