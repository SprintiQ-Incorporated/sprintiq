import type { Config } from "tailwindcss";
import {
  colors as designColors,
  spacing as designSpacing,
  borderRadius as designBorderRadius,
  shadows as designShadows,
  gradients as designGradients,
} from "./styles/design-tokens";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      minHeight: {
        'touch': '44px', // WCAG 2.5.5 minimum touch target size
      },
      minWidth: {
        'touch': '44px', // WCAG 2.5.5 minimum touch target size
      },
      colors: {
        // CSS variable-based colors (shadcn/ui compatibility)
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",

        // Dark theme design system colors
        "dark-bg": designColors.background.primary,
        "dark-surface": designColors.background.secondary,
        "dark-card": designColors.background.tertiary,
        "dark-elevated": designColors.background.elevated,

        // Primary accent (emerald)
        primary: {
          ...designColors.primary,
          foreground: "#ffffff",
        },

        // Text colors
        "text-primary": designColors.text.primary,
        "text-secondary": designColors.text.secondary,
        "text-tertiary": designColors.text.tertiary,

        // Card colors
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
          dark: designColors.card.DEFAULT,
          "dark-hover": designColors.card.hover,
          "dark-active": designColors.card.active,
          "dark-border": designColors.card.border,
        },

        // Semantic colors
        success: designColors.success,
        warning: designColors.warning,
        error: designColors.error,
        info: designColors.info,

        // Border colors
        "border-dark": designColors.border.DEFAULT,
        "border-dark-light": designColors.border.light,
        "border-dark-focus": designColors.border.focus,

        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      spacing: designSpacing,
      borderRadius: {
        ...designBorderRadius,
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: designShadows,
      backgroundImage: designGradients,
      fontSize: {
        // Fluid typography using clamp() for smooth scaling
        'fluid-hero': ['clamp(2rem, 5vw + 1rem, 4.5rem)', { lineHeight: '1.1', fontWeight: '700' }],
        'fluid-display': ['clamp(1.75rem, 4vw + 0.75rem, 3.75rem)', { lineHeight: '1.15', fontWeight: '700' }],
        'fluid-section': ['clamp(1.5rem, 3vw + 0.5rem, 3rem)', { lineHeight: '1.2', fontWeight: '600' }],
        'fluid-subsection': ['clamp(1.25rem, 2vw + 0.5rem, 2rem)', { lineHeight: '1.3', fontWeight: '600' }],
        'fluid-body-lg': ['clamp(1rem, 1vw + 0.5rem, 1.25rem)', { lineHeight: '1.6' }],
        'fluid-body': ['clamp(0.875rem, 0.5vw + 0.75rem, 1rem)', { lineHeight: '1.6' }],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUpDelayed: {
          "0%": { opacity: "0", transform: "translateY(50px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInLeft: {
          "0%": { opacity: "0", transform: "translateX(-20px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        bounceIn: {
          "0%": { opacity: "0", transform: "scale(0.3)" },
          "50%": { opacity: "1", transform: "scale(1.05)" },
          "70%": { transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        bounceGentle: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-5px)" },
        },
        pulseGlow: {
          "0%, 100%": { boxShadow: "0 0 20px rgba(16, 185, 129, 0.3)" },
          "50%": { boxShadow: "0 0 40px rgba(16, 185, 129, 0.6)" },
        },
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition: "200% center" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        checkBounce: {
          "0%": { transform: "scale(0)" },
          "50%": { transform: "scale(1.2)" },
          "100%": { transform: "scale(1)" },
        },
        // Dashboard-specific animations
        "dashboard-float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        "dashboard-glow-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "0.7", transform: "scale(1.01)" },
        },
        "dashboard-border-pulse": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fadeIn 0.6s ease-out",
        "fade-in-up": "fadeInUp 0.8s ease-out",
        "slide-up-delayed": "slideUpDelayed 0.8s ease-out 0.2s both",
        "slide-up-delayed-2": "slideUpDelayed 0.8s ease-out 0.4s both",
        "slide-in-left": "slideInLeft 0.6s ease-out both",
        "slide-down": "slideDown 0.3s ease-out",
        "bounce-in": "bounceIn 0.6s ease-out",
        "bounce-gentle": "bounceGentle 2s ease-in-out infinite",
        "pulse-glow": "pulseGlow 3s ease-in-out infinite",
        "gradient-shift": "gradientShift 3s ease-in-out infinite",
        shimmer: "shimmer 2s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        float: "float 3s ease-in-out infinite",
        "check-bounce": "checkBounce 0.6s ease-out 0.3s both",
        // Dashboard-specific animation utilities
        "dashboard-float": "dashboard-float 6s ease-in-out infinite",
        "dashboard-glow": "dashboard-glow-pulse 4s ease-in-out infinite",
        "dashboard-border": "dashboard-border-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
    require("@tailwindcss/container-queries"),
  ],
} satisfies Config;

export default config;
