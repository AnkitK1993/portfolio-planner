export const STORE_KEY = "mfPlanner_v3";

export const FIREBASE_CONFIG = {
            apiKey:            "AIzaSyDDul9W_6IHyrXrZ-8yUccCEl_Ry51CCBE",
            authDomain:        "portfolio-planner-1db7f.firebaseapp.com",
            projectId:         "portfolio-planner-1db7f",
            storageBucket:     "portfolio-planner-1db7f.firebasestorage.app",
            messagingSenderId: "416220077104",
            appId:             "1:416220077104:web:5b3f57af70f0c3461261f5",
            measurementId:     "G-GNXQJMH7W8",
          };

export const BASE_LIQ_DEFAULTS = {
            liq1: "Liquid Fund 1",
            liq2: "Liquid Fund 2",
          };

export const BASE_EQ_DEFAULTS = {
            eq1: "Nifty 50 Index Fund",
            eq2: "Flexi Cap Fund",
            eq3: "Mid Cap Fund",
          };

export const LIQ_CATEGORIES = ["Liquid", "Ultra Short", "Short Duration", "Debt", "Money Market", "Other"];

export const EQ_CATEGORIES  = ["Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "ELSS", "Index", "International", "Other"];

export const MONTHS = [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
          ];

export const NW_FIELDS = [
            { id: "mfProfit", label: "Unrealized Gain", color: "#86efac" },
            { id: "bank", label: "Bank & Savings", color: "var(--liq)" },
            { id: "fd", label: "Fixed Deposit", color: "#5bc4f5" },
            { id: "cash", label: "Cash", color: "var(--amber)" },
            { id: "ppf", label: "PPF / EPF / NPS", color: "#8be8ff" },
            { id: "bonds", label: "Bonds", color: "#c084fc" },
          ];

export const OTHER_FIELDS = NW_FIELDS.filter(f => f.id !== "mfProfit");
