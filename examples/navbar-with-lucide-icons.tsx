/**
 * Example: Navbar with Lucide-React Icons
 * 
 * This file demonstrates how to implement lucide-react icons
 * in place of custom SVG icons for the navigation menus.
 * 
 * Copy the relevant sections to components/landing/layout/navbar.tsx
 */

// ============================================================================
// STEP 1: Update imports at the top of navbar.tsx
// ============================================================================

// Add these lucide-react icon imports:
import { 
  // UI Utilities (already imported)
  Menu, 
  X, 
  ChevronRight, 
  AlignRight, 
  ChevronDown,
  
  // Use Cases Menu Icons
  Brain,           // Product Managers - thinking/strategy
  Kanban,          // Scrum Masters - agile methodology
  Settings,        // Engineering Leaders - configuration
  Rocket,          // Scaling Startups - growth
  Building2,       // Enterprise Teams - corporate
  
  // Company Menu Icons
  Info,            // About Us - information
  Newspaper,       // Insights - news/articles
  Mail,            // Contact - communication
  
  // Support Menu Icons
  FileText,        // Terms of Service - legal docs
  Shield,          // Privacy Policy - protection
  HelpCircle,      // FAQ - help/questions
} from 'lucide-react';

// ============================================================================
// STEP 2: Update menu definitions
// ============================================================================

const useCases = [
  {
    label: "Product Managers",
    icon: <Brain className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/product-managers",
  },
  {
    label: "Scrum Masters",
    icon: <Kanban className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/scrum-masters",
  },
  {
    label: "Engineering Leaders",
    icon: <Settings className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/engineering-leaders",
  },
  {
    label: "Scaling Startups",
    icon: <Rocket className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/scaling-startups",
  },
  {
    label: "Enterprise Teams",
    icon: <Building2 className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/enterprise-teams",
  },
];

const company = [
  { 
    label: "About Us", 
    icon: <Info className="w-5 h-5" color="#7fffbf" strokeWidth={2} />, 
    href: "/about" 
  },
  { 
    label: "Insights", 
    icon: <Newspaper className="w-5 h-5" color="#7fffbf" strokeWidth={2} />, 
    href: "/insights" 
  },
  {
    label: "Contact",
    icon: <Mail className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/contact",
  },
];

const support = [
  {
    label: "Terms of Service",
    icon: <FileText className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/terms",
  },
  {
    label: "Privacy Policy",
    icon: <Shield className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/privacy",
  },
  { 
    label: "FAQ", 
    icon: <HelpCircle className="w-5 h-5" color="#7fffbf" strokeWidth={2} />, 
    href: "/faq" 
  },
];

// ============================================================================
// STEP 3: Remove unused custom SVG imports
// ============================================================================

// These can be removed after switching to lucide-react:
// import { RocketSvg } from "@/components/svg/RocketSvg";         // ❌ Remove
// import { AiBrainSvg } from "@/components/svg/AiBrainSvg";       // ❌ Remove
// import { WebSvg } from "@/components/svg/WebSvg";               // ❌ Remove
// import { AgileSvg } from "@/components/svg/AgileSvg";           // ❌ Remove
// import { DataAnalyticsSvg } from "@/components/svg/DataAnalyticsSvg"; // ❌ Remove
// import { InventiveSvg } from "@/components/svg/InventiveSvg";   // ❌ Remove
// import TeamsSvg from "@/components/svg/TeamsSvg";               // ❌ Remove
// import { GearSvg } from "@/components/svg/GearSvg";             // ❌ Remove
// import SprintiQSvg from "@/components/svg/SprintiQSvg";         // ❌ Remove
// import { BlogSvg } from "@/components/svg/BlogSvg";             // ❌ Remove
// import { ConsultingSvg } from "@/components/svg/ConsultingSvg"; // ❌ Remove
// import { BadgeSvg } from "@/components/svg/BadgeSvg";           // ❌ Remove
// import { QuestionSvg } from "@/components/svg/QuestionSvg";     // ❌ Remove
// import { TermsSvg } from "@/components/svg/TermsSvg";           // ❌ Remove
// import { TeamSvg } from "@/components/svg/TeamSvg";             // ❌ Remove
// import { BarChartDollarSvg } from "@/components/svg/BarChartDollarSvg"; // ❌ Remove
// import { IndividualSvg } from "@/components/svg/IndividualSvg"; // ❌ Remove

// ============================================================================
// ALTERNATIVE ICON CHOICES (pick what works best for your brand)
// ============================================================================

// Use Cases - Alternative options:
const useCasesAlternative = [
  {
    label: "Product Managers",
    // Option 1: Brain (thinking/strategy)
    icon: <Brain className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 2: Lightbulb (ideas/innovation)
    // icon: <Lightbulb className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 3: Target (goal-oriented)
    // icon: <Target className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/product-managers",
  },
  {
    label: "Scrum Masters",
    // Option 1: Kanban (agile visual)
    icon: <Kanban className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 2: ListChecks (task management)
    // icon: <ListChecks className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 3: Workflow (process)
    // icon: <Workflow className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/scrum-masters",
  },
  {
    label: "Engineering Leaders",
    // Option 1: Settings (configuration)
    icon: <Settings className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 2: Code2 (development)
    // icon: <Code2 className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 3: Cpu (technical)
    // icon: <Cpu className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/engineering-leaders",
  },
  {
    label: "Scaling Startups",
    // Option 1: Rocket (growth)
    icon: <Rocket className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 2: TrendingUp (scaling)
    // icon: <TrendingUp className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 3: Zap (speed)
    // icon: <Zap className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/scaling-startups",
  },
  {
    label: "Enterprise Teams",
    // Option 1: Building2 (corporate)
    icon: <Building2 className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 2: Network (large-scale)
    // icon: <Network className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    // Option 3: Shield (security)
    // icon: <Shield className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
    href: "/use-cases/enterprise-teams",
  },
];

// ============================================================================
// BENEFITS OF SWITCHING TO LUCIDE-REACT
// ============================================================================

/*
1. Bundle Size Reduction:
   - Lucide icons are tree-shakeable (only import what you use)
   - Custom SVGs may include unnecessary code
   - Estimated savings: 20-30% smaller bundle for icon imports

2. Consistent Design System:
   - All icons follow the same design language
   - Consistent stroke width and styling
   - Easier to maintain visual consistency

3. Easy Customization:
   - Change size: className="w-6 h-6"
   - Change color: color="#7fffbf" or className="text-emerald-400"
   - Change stroke: strokeWidth={1.5}
   - Add animations: className="hover:rotate-12 transition"

4. Accessibility:
   - Built-in ARIA attributes
   - Proper SVG roles
   - Screen reader friendly

5. Future-Proof:
   - Regular updates with new icons
   - Active community support
   - 1000+ icons available

6. Developer Experience:
   - Auto-completion in IDE
   - TypeScript support
   - Easy to search and preview
*/

// ============================================================================
// CUSTOMIZATION EXAMPLES
// ============================================================================

// Different sizes:
const sizeExamples = {
  small: <Brain className="w-4 h-4" color="#7fffbf" />,
  medium: <Brain className="w-5 h-5" color="#7fffbf" />,
  large: <Brain className="w-6 h-6" color="#7fffbf" />,
  xlarge: <Brain className="w-8 h-8" color="#7fffbf" />,
};

// Different colors:
const colorExamples = {
  emerald: <Brain className="w-5 h-5 text-emerald-400" />,
  custom: <Brain className="w-5 h-5" color="#7fffbf" />,
  white: <Brain className="w-5 h-5 text-white" />,
  gradient: <Brain className="w-5 h-5 text-emerald-400 hover:text-emerald-300" />,
};

// With animations:
const animatedExamples = {
  rotate: <Brain className="w-5 h-5 hover:rotate-12 transition" color="#7fffbf" />,
  scale: <Brain className="w-5 h-5 hover:scale-110 transition" color="#7fffbf" />,
  pulse: <Brain className="w-5 h-5 animate-pulse" color="#7fffbf" />,
  bounce: <Brain className="w-5 h-5 hover:animate-bounce" color="#7fffbf" />,
};

// Different stroke widths:
const strokeExamples = {
  thin: <Brain className="w-5 h-5" color="#7fffbf" strokeWidth={1} />,
  normal: <Brain className="w-5 h-5" color="#7fffbf" strokeWidth={2} />,
  bold: <Brain className="w-5 h-5" color="#7fffbf" strokeWidth={3} />,
};

export { useCases, company, support };
