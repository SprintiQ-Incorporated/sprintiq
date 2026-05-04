/**
 * Icon Import Verification Script
 * 
 * Verifies that all icons used in navigation menus are properly imported.
 * 
 * Step 1: Find all icon references in menu definitions
 * Step 2: Verify each icon is imported
 * Step 3: Flag any icons that are referenced but not imported
 * 
 * Run with: node scripts/verify-icon-imports.js
 */

const fs = require('fs');
const path = require('path');

// Read the navbar file
const navbarPath = path.join(__dirname, '../components/landing/layout/navbar.tsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf8');

console.log('\n🔍 ICON IMPORT VERIFICATION');
console.log('='.repeat(70));

// Step 1: Extract all imports
console.log('\n📦 Step 1: Extracting all icon imports...\n');

// Find lucide-react imports
const lucideMatch = navbarContent.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
const lucideIcons = lucideMatch 
  ? lucideMatch[1]
    .split(',')
    .map(icon => icon.trim())
    .filter(Boolean)
  : [];

console.log('Lucide-react imports:');
lucideIcons.forEach(icon => console.log(`  - ${icon}`));

// Find custom SVG imports
const customSvgRegex = /import\s+(?:{?\s*(\w+)\s*}?)\s+from\s+['"]@\/components\/svg\/(\w+)['"]/g;
const customSvgIcons = [];
let match;
while ((match = customSvgRegex.exec(navbarContent)) !== null) {
  customSvgIcons.push({
    name: match[1],
    source: match[2]
  });
}

console.log('\nCustom SVG imports:');
customSvgIcons.forEach(icon => console.log(`  - ${icon.name} (from ${icon.source})`));

// Step 2: Extract all icon usages in menu definitions
console.log('\n📋 Step 2: Extracting icon usages in menu definitions...\n');

// Extract useCases menu
const useCasesMatch = navbarContent.match(/const useCases = \[([\s\S]*?)\];/);
const useCasesIcons = [];
if (useCasesMatch) {
  const iconMatches = useCasesMatch[1].matchAll(/icon:\s*<(\w+)/g);
  for (const m of iconMatches) {
    useCasesIcons.push(m[1]);
  }
}

// Extract company menu
const companyMatch = navbarContent.match(/const company = \[([\s\S]*?)\];/);
const companyIcons = [];
if (companyMatch) {
  const iconMatches = companyMatch[1].matchAll(/icon:\s*<(\w+)/g);
  for (const m of iconMatches) {
    companyIcons.push(m[1]);
  }
}

// Extract support menu
const supportMatch = navbarContent.match(/const support = \[([\s\S]*?)\];/);
const supportIcons = [];
if (supportMatch) {
  const iconMatches = supportMatch[1].matchAll(/icon:\s*<(\w+)/g);
  for (const m of iconMatches) {
    supportIcons.push(m[1]);
  }
}

console.log('Use Cases menu icons:');
useCasesIcons.forEach(icon => console.log(`  - ${icon}`));

console.log('\nCompany menu icons:');
companyIcons.forEach(icon => console.log(`  - ${icon}`));

console.log('\nSupport menu icons:');
supportIcons.forEach(icon => console.log(`  - ${icon}`));

// Step 3: Verify all icons are imported
console.log('\n✅ Step 3: Verifying all icons are properly imported...\n');

const allUsedIcons = [...new Set([...useCasesIcons, ...companyIcons, ...supportIcons])];
const allImportedIcons = [
  ...lucideIcons,
  ...customSvgIcons.map(icon => icon.name)
];

const missingImports = [];
const properImports = [];

allUsedIcons.forEach(usedIcon => {
  if (allImportedIcons.includes(usedIcon)) {
    properImports.push(usedIcon);
  } else {
    missingImports.push(usedIcon);
  }
});

// Step 4: Check for unused imports
const unusedImports = allImportedIcons.filter(importedIcon => {
  // Skip utility icons like Menu, X, ChevronRight, etc.
  const utilityIcons = ['Menu', 'X', 'ChevronRight', 'AlignRight', 'ChevronDown'];
  if (utilityIcons.includes(importedIcon)) {
    return false;
  }
  return !allUsedIcons.includes(importedIcon);
});

// Results
console.log('='.repeat(70));
console.log('VERIFICATION RESULTS');
console.log('='.repeat(70));

console.log(`\n✅ Properly imported and used (${properImports.length}):`);
properImports.forEach(icon => {
  const source = customSvgIcons.find(i => i.name === icon)?.source || 'lucide-react';
  console.log(`  - ${icon} (from ${source})`);
});

if (missingImports.length > 0) {
  console.log(`\n❌ MISSING IMPORTS (${missingImports.length}):`);
  missingImports.forEach(icon => {
    console.log(`  - ${icon} ⚠️  NOT IMPORTED!`);
  });
}

if (unusedImports.length > 0) {
  console.log(`\n⚠️  Imported but not used in menus (${unusedImports.length}):`);
  unusedImports.forEach(icon => {
    console.log(`  - ${icon} (may be used elsewhere)`);
  });
}

// Summary
console.log('\n');
console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));

console.log(`\nTotal icons used in menus: ${allUsedIcons.length}`);
console.log(`Total icons imported: ${allImportedIcons.length}`);
console.log(`Properly imported: ${properImports.length}`);
console.log(`Missing imports: ${missingImports.length}`);
console.log(`Unused imports: ${unusedImports.length}`);

if (missingImports.length === 0) {
  console.log('\n🎉 All menu icons are properly imported!\n');
  process.exit(0);
} else {
  console.log('\n❌ Some icons are referenced but not imported.\n');
  console.log('Action required:');
  missingImports.forEach(icon => {
    console.log(`  - Add: import { ${icon} } from 'lucide-react'; OR`);
    console.log(`  - Add: import { ${icon} } from '@/components/svg/${icon}';`);
  });
  console.log('');
  process.exit(1);
}
