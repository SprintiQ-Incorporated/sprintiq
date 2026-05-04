/**
 * Menu Icon Audit Script
 * Run with: node scripts/audit-menu-icons.js
 */

const auditMenuIcons = (menuItems, menuName) => {
  const missing = [];
  const present = [];

  menuItems.forEach((item) => {
    if (!item.icon) {
      missing.push(item.label);
    } else {
      present.push(item.label);
    }
  });

  console.log(`\n${"=".repeat(50)}`);
  console.log(`${menuName} Menu Icon Audit`);
  console.log("=".repeat(50));
  console.log(`\n✅ Items with icons (${present.length}):`);
  if (present.length > 0) {
    present.forEach((label) => console.log(`   - ${label}`));
  } else {
    console.log("   None");
  }

  console.log(`\n❌ Items missing icons (${missing.length}):`);
  if (missing.length > 0) {
    missing.forEach((label) => console.log(`   - ${label}`));
  } else {
    console.log("   None");
  }

  const coverage = (present.length / menuItems.length) * 100;
  console.log(
    `\n📊 Coverage: ${coverage.toFixed(1)}% (${present.length}/${menuItems.length})`
  );

  return { missing, present, coverage };
};

// Menu definitions from navbar.tsx
const useCases = [
  {
    label: "Product Managers",
    icon: "AiBrainSvg",
    href: "/use-cases/product-managers",
  },
  {
    label: "Scrum Masters",
    icon: "AgileSvg",
    href: "/use-cases/scrum-masters",
  },
  {
    label: "Engineering Leaders",
    icon: "GearSvg",
    href: "/use-cases/engineering-leaders",
  },
  {
    label: "Scaling Startups",
    icon: "RocketSvg",
    href: "/use-cases/scaling-startups",
  },
  {
    label: "Enterprise Teams",
    icon: "DataAnalyticsSvg",
    href: "/use-cases/enterprise-teams",
  },
];

const company = [
  { label: "About Us", icon: "SprintiQSvg", href: "/about" },
  { label: "Insights", icon: "BlogSvg", href: "/insights" },
  {
    label: "Contact",
    icon: "ConsultingSvg",
    href: "/contact",
  },
];

const support = [
  {
    label: "Terms of Service",
    icon: "TermsSvg",
    href: "/terms",
  },
  {
    label: "Privacy Policy",
    icon: "BadgeSvg",
    href: "/privacy",
  },
  { label: "FAQ", icon: "QuestionSvg", href: "/faq" },
];

// Run audits
console.log("\n");
console.log("🔍 NAVIGATION MENU ICON AUDIT");
console.log("=".repeat(50));

const useCasesResult = auditMenuIcons(useCases, "Use Cases");
const companyResult = auditMenuIcons(company, "Company");
const supportResult = auditMenuIcons(support, "Support");

// Summary
console.log("\n");
console.log("=".repeat(50));
console.log("SUMMARY");
console.log("=".repeat(50));

const totalItems = useCases.length + company.length + support.length;
const totalWithIcons =
  useCasesResult.present.length +
  companyResult.present.length +
  supportResult.present.length;
const totalMissing =
  useCasesResult.missing.length +
  companyResult.missing.length +
  supportResult.missing.length;
const overallCoverage = (totalWithIcons / totalItems) * 100;

console.log(`\nTotal menu items: ${totalItems}`);
console.log(`✅ Items with icons: ${totalWithIcons}`);
console.log(`❌ Items missing icons: ${totalMissing}`);
console.log(`📊 Overall coverage: ${overallCoverage.toFixed(1)}%\n`);

if (totalMissing === 0) {
  console.log("🎉 All menu items have icons!\n");
} else {
  console.log("⚠️  Some menu items are missing icons.\n");
  process.exit(1);
}
