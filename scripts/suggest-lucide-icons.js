/**
 * Lucide-React Icon Suggestions for Navigation Menus
 * 
 * This file provides lucide-react icon alternatives for current menu items,
 * plus suggestions for potential future menu items.
 * 
 * Benefits of using lucide-react icons:
 * - Consistent design system
 * - Smaller bundle size
 * - Built-in accessibility
 * - Easier customization (size, color, stroke)
 * 
 * Run: node scripts/suggest-lucide-icons.js
 */

const currentMenuItems = {
  useCases: {
    title: "Use Cases Menu",
    items: [
      {
        label: "Product Managers",
        currentIcon: "AiBrainSvg (custom)",
        suggestedLucide: [
          { name: "Brain", reason: "Represents thinking/strategy", priority: 1 },
          { name: "Lightbulb", reason: "Ideas and innovation", priority: 2 },
          { name: "Target", reason: "Goal-oriented work", priority: 3 },
          { name: "Compass", reason: "Direction and planning", priority: 4 },
        ]
      },
      {
        label: "Scrum Masters",
        currentIcon: "AgileSvg (custom)",
        suggestedLucide: [
          { name: "Kanban", reason: "Agile methodology visual", priority: 1 },
          { name: "ListChecks", reason: "Task management", priority: 2 },
          { name: "Workflow", reason: "Process management", priority: 3 },
          { name: "Users", reason: "Team leadership", priority: 4 },
        ]
      },
      {
        label: "Engineering Leaders",
        currentIcon: "GearSvg (custom)",
        suggestedLucide: [
          { name: "Settings", reason: "Configuration/engineering", priority: 1 },
          { name: "Code2", reason: "Software development", priority: 2 },
          { name: "Cpu", reason: "Technical leadership", priority: 3 },
          { name: "Wrench", reason: "Building/tools", priority: 4 },
        ]
      },
      {
        label: "Scaling Startups",
        currentIcon: "RocketSvg (custom)",
        suggestedLucide: [
          { name: "Rocket", reason: "Growth and launch", priority: 1 },
          { name: "TrendingUp", reason: "Scaling/growth", priority: 2 },
          { name: "Zap", reason: "Speed and energy", priority: 3 },
          { name: "Sparkles", reason: "Innovation", priority: 4 },
        ]
      },
      {
        label: "Enterprise Teams",
        currentIcon: "DataAnalyticsSvg (custom)",
        suggestedLucide: [
          { name: "Building2", reason: "Corporate/enterprise", priority: 1 },
          { name: "Network", reason: "Large-scale systems", priority: 2 },
          { name: "Shield", reason: "Security/compliance", priority: 3 },
          { name: "BarChart3", reason: "Analytics and data", priority: 4 },
        ]
      },
    ]
  },
  
  company: {
    title: "Company Menu",
    items: [
      {
        label: "About Us",
        currentIcon: "SprintiQSvg (custom)",
        suggestedLucide: [
          { name: "Info", reason: "Information about company", priority: 1 },
          { name: "Users", reason: "Team/people", priority: 2 },
          { name: "Building", reason: "Organization", priority: 3 },
          { name: "Heart", reason: "Company values", priority: 4 },
        ]
      },
      {
        label: "Insights",
        currentIcon: "BlogSvg (custom)",
        suggestedLucide: [
          { name: "Newspaper", reason: "News and articles", priority: 1 },
          { name: "BookOpen", reason: "Learning resources", priority: 2 },
          { name: "FileText", reason: "Written content", priority: 3 },
          { name: "Lightbulb", reason: "Ideas and insights", priority: 4 },
        ]
      },
      {
        label: "Contact",
        currentIcon: "ConsultingSvg (custom)",
        suggestedLucide: [
          { name: "Mail", reason: "Email communication", priority: 1 },
          { name: "MessageSquare", reason: "Direct messaging", priority: 2 },
          { name: "Phone", reason: "Contact methods", priority: 3 },
          { name: "Send", reason: "Reach out/send message", priority: 4 },
        ]
      },
    ]
  },
  
  support: {
    title: "Support Menu",
    items: [
      {
        label: "Terms of Service",
        currentIcon: "TermsSvg (custom)",
        suggestedLucide: [
          { name: "FileText", reason: "Legal document", priority: 1 },
          { name: "ScrollText", reason: "Terms document", priority: 2 },
          { name: "FileCheck", reason: "Agreement", priority: 3 },
          { name: "Scale", reason: "Legal/justice", priority: 4 },
        ]
      },
      {
        label: "Privacy Policy",
        currentIcon: "BadgeSvg (custom)",
        suggestedLucide: [
          { name: "Shield", reason: "Protection/privacy", priority: 1 },
          { name: "ShieldCheck", reason: "Privacy guarantee", priority: 2 },
          { name: "Lock", reason: "Security", priority: 3 },
          { name: "Eye", reason: "Transparency", priority: 4 },
        ]
      },
      {
        label: "FAQ",
        currentIcon: "QuestionSvg (custom)",
        suggestedLucide: [
          { name: "HelpCircle", reason: "Questions and help", priority: 1 },
          { name: "CircleHelp", reason: "Help center", priority: 2 },
          { name: "MessageCircleQuestion", reason: "Q&A", priority: 3 },
          { name: "Info", reason: "Information", priority: 4 },
        ]
      },
    ]
  }
};

// Additional menu items suggestions (for future use)
const suggestedMenuItems = {
  useCases: [
    {
      label: "Product Teams",
      icons: [
        { name: "PackageSearch", reason: "Product discovery" },
        { name: "Boxes", reason: "Product portfolio" },
        { name: "Layers", reason: "Product layers/features" },
      ]
    },
    {
      label: "Agencies",
      icons: [
        { name: "Briefcase", reason: "Professional services" },
        { name: "Handshake", reason: "Client relationships" },
        { name: "Users", reason: "Team collaboration" },
      ]
    },
  ],
  
  company: [
    {
      label: "Careers",
      icons: [
        { name: "Briefcase", reason: "Employment" },
        { name: "UserPlus", reason: "Hiring" },
        { name: "GraduationCap", reason: "Growth/learning" },
      ]
    },
    {
      label: "Press",
      icons: [
        { name: "Megaphone", reason: "Announcements" },
        { name: "Radio", reason: "Broadcasting" },
        { name: "Mic", reason: "Public speaking" },
      ]
    },
  ],
  
  support: [
    {
      label: "Help Center",
      icons: [
        { name: "LifeBuoy", reason: "Support/rescue" },
        { name: "HelpCircle", reason: "Help and guidance" },
        { name: "CircleHelp", reason: "Assistance" },
      ]
    },
    {
      label: "Documentation",
      icons: [
        { name: "BookOpen", reason: "Knowledge base" },
        { name: "FileText", reason: "Documentation" },
        { name: "Files", reason: "Multiple docs" },
      ]
    },
    {
      label: "API Reference",
      icons: [
        { name: "Code", reason: "Programming interface" },
        { name: "Braces", reason: "Code blocks" },
        { name: "Terminal", reason: "Developer tools" },
      ]
    },
    {
      label: "Status",
      icons: [
        { name: "Activity", reason: "System activity" },
        { name: "Signal", reason: "Service status" },
        { name: "CheckCircle", reason: "Operational status" },
      ]
    },
    {
      label: "Community",
      icons: [
        { name: "Users", reason: "User community" },
        { name: "MessageCircle", reason: "Discussions" },
        { name: "Heart", reason: "Community love" },
      ]
    },
  ]
};

// Generate report
console.log('\n🎨 LUCIDE-REACT ICON SUGGESTIONS FOR NAVIGATION MENUS');
console.log('='.repeat(70));

Object.entries(currentMenuItems).forEach(([menuKey, menuData]) => {
  console.log(`\n\n📋 ${menuData.title.toUpperCase()}`);
  console.log('='.repeat(70));
  
  menuData.items.forEach((item, index) => {
    console.log(`\n${index + 1}. ${item.label}`);
    console.log(`   Current: ${item.currentIcon}`);
    console.log(`   Suggested lucide-react alternatives:`);
    
    item.suggestedLucide.forEach((suggestion, i) => {
      const badge = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      console.log(`   ${badge} ${suggestion.name.padEnd(25)} - ${suggestion.reason}`);
    });
  });
});

console.log('\n\n');
console.log('='.repeat(70));
console.log('ADDITIONAL SUGGESTIONS FOR FUTURE MENU ITEMS');
console.log('='.repeat(70));

Object.entries(suggestedMenuItems).forEach(([menuKey, items]) => {
  console.log(`\n${menuKey.toUpperCase()}:`);
  items.forEach((item, index) => {
    console.log(`\n  ${index + 1}. ${item.label}`);
    item.icons.forEach(icon => {
      console.log(`     • ${icon.name.padEnd(25)} - ${icon.reason}`);
    });
  });
});

console.log('\n\n');
console.log('='.repeat(70));
console.log('IMPLEMENTATION EXAMPLE');
console.log('='.repeat(70));

console.log(`
To use lucide-react icons instead of custom SVGs:

1. Import the icons at the top of navbar.tsx:
   import { 
     Brain, Kanban, Settings, Rocket, Building2,
     Info, Newspaper, Mail,
     FileText, Shield, HelpCircle 
   } from 'lucide-react';

2. Update menu definitions:
   const useCases = [
     {
       label: "Product Managers",
       icon: <Brain className="w-5 h-5" color="#7fffbf" />,
       href: "/use-cases/product-managers",
     },
     // ... etc
   ];

3. Benefits:
   ✓ Consistent design system
   ✓ Smaller bundle size (tree-shakeable)
   ✓ Easy customization (className, color, size, strokeWidth)
   ✓ Built-in accessibility
   ✓ Regular updates and new icons

4. Customization options:
   <Brain 
     className="w-5 h-5"           // Size
     color="#7fffbf"               // Color
     strokeWidth={2}               // Line thickness
     fill="currentColor"           // Fill
   />
`);

console.log('\n✅ All suggestions generated!\n');
