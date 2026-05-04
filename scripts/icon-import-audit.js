/**
 * Comprehensive Icon Import Audit
 * 
 * This script:
 * 1. Verifies all icons used in menus are imported
 * 2. Identifies unused imports
 * 3. Searches for usage of "unused" icons elsewhere in the file
 * 4. Provides recommendations for cleanup
 * 
 * Run with: node scripts/icon-import-audit.js
 */

const fs = require('fs');
const path = require('path');

const navbarPath = path.join(__dirname, '../components/landing/layout/navbar.tsx');
const navbarContent = fs.readFileSync(navbarPath, 'utf8');

console.log('\n🔍 COMPREHENSIVE ICON IMPORT AUDIT');
console.log('='.repeat(70));
console.log(`\nFile: components/landing/layout/navbar.tsx`);
console.log(`Size: ${navbarContent.length} characters\n`);

// Extract lucide-react imports
const lucideMatch = navbarContent.match(/import\s+{([^}]+)}\s+from\s+['"]lucide-react['"]/);
const lucideIcons = lucideMatch 
  ? lucideMatch[1].split(',').map(icon => icon.trim()).filter(Boolean)
  : [];

// Extract custom SVG imports
const customSvgRegex = /import\s+(?:{?\s*(\w+)\s*}?)\s+from\s+['"]@\/components\/svg\/(\w+)['"]/g;
const customSvgIcons = [];
let match;
while ((match = customSvgRegex.exec(navbarContent)) !== null) {
  customSvgIcons.push({ name: match[1], source: match[2] });
}

// Extract menu icon usages
const extractMenuIcons = (menuName) => {
  const menuMatch = navbarContent.match(new RegExp(`const ${menuName} = \\[([\\s\\S]*?)\\];`));
  if (!menuMatch) return [];
  const iconMatches = menuMatch[1].matchAll(/icon:\s*<(\w+)/g);
  return Array.from(iconMatches, m => m[1]);
};

const useCasesIcons = extractMenuIcons('useCases');
const companyIcons = extractMenuIcons('company');
const supportIcons = extractMenuIcons('support');
const allMenuIcons = [...new Set([...useCasesIcons, ...companyIcons, ...supportIcons])];

// Check for actual usage of each imported icon
const checkIconUsage = (iconName) => {
  // Count occurrences (excluding the import statement)
  const importLine = navbarContent.match(new RegExp(`import.*${iconName}.*from`))?.[0] || '';
  const contentWithoutImport = navbarContent.replace(importLine, '');
  const regex = new RegExp(`<${iconName}[\\s/>]`, 'g');
  const matches = contentWithoutImport.match(regex);
  return matches ? matches.length : 0;
};

// Analyze imports
console.log('📊 IMPORT ANALYSIS');
console.log('='.repeat(70));

console.log('\n1️⃣  Lucide-react imports (UI utility icons):');
const lucideUtility = ['Menu', 'X', 'ChevronRight', 'AlignRight', 'ChevronDown'];
lucideIcons.forEach(icon => {
  const usage = checkIconUsage(icon);
  const isUtility = lucideUtility.includes(icon);
  console.log(`  ${isUtility ? '🔧' : '  '} ${icon.padEnd(20)} - Used ${usage}x`);
});

console.log('\n2️⃣  Custom SVG imports:');
customSvgIcons.forEach(icon => {
  const usage = checkIconUsage(icon.name);
  const inMenu = allMenuIcons.includes(icon.name);
  const status = inMenu ? '📋' : usage > 0 ? '📄' : '⚠️ ';
  console.log(`  ${status} ${icon.name.padEnd(20)} - Used ${usage}x ${inMenu ? '(in menu)' : ''}`);
});

// Menu-specific analysis
console.log('\n\n📋 MENU ICON ANALYSIS');
console.log('='.repeat(70));

const analyzeMenu = (menuName, icons) => {
  console.log(`\n${menuName}:`);
  icons.forEach((icon, index) => {
    const imported = [...lucideIcons, ...customSvgIcons.map(i => i.name)].includes(icon);
    console.log(`  ${index + 1}. ${icon.padEnd(25)} ${imported ? '✅ Imported' : '❌ NOT IMPORTED'}`);
  });
};

analyzeMenu('Use Cases Menu', useCasesIcons);
analyzeMenu('Company Menu', companyIcons);
analyzeMenu('Support Menu', supportIcons);

// Verification
console.log('\n\n✅ VERIFICATION');
console.log('='.repeat(70));

const allImportedIcons = [...lucideIcons, ...customSvgIcons.map(i => i.name)];
const properlyImported = allMenuIcons.filter(icon => allImportedIcons.includes(icon));
const missingImports = allMenuIcons.filter(icon => !allImportedIcons.includes(icon));

const unusedCustomIcons = customSvgIcons
  .map(icon => icon.name)
  .filter(icon => !allMenuIcons.includes(icon))
  .map(icon => ({
    name: icon,
    usage: checkIconUsage(icon)
  }));

console.log(`\n✅ All menu icons imported: ${missingImports.length === 0 ? 'YES' : 'NO'}`);
console.log(`✅ Menu icons properly imported: ${properlyImported.length}/${allMenuIcons.length}`);

if (missingImports.length > 0) {
  console.log(`\n❌ MISSING IMPORTS (${missingImports.length}):`);
  missingImports.forEach(icon => {
    console.log(`  - ${icon}`);
  });
}

console.log(`\n\n🧹 CLEANUP RECOMMENDATIONS`);
console.log('='.repeat(70));

const canRemove = unusedCustomIcons.filter(icon => icon.usage === 0);
const usedElsewhere = unusedCustomIcons.filter(icon => icon.usage > 0);

if (canRemove.length > 0) {
  console.log(`\n⚠️  Icons imported but never used (${canRemove.length}):`);
  canRemove.forEach(icon => {
    const source = customSvgIcons.find(i => i.name === icon.name)?.source;
    console.log(`  - ${icon.name} (from @/components/svg/${source})`);
    console.log(`    → Can be safely removed`);
  });
}

if (usedElsewhere.length > 0) {
  console.log(`\n✅ Icons not in menus but used elsewhere (${usedElsewhere.length}):`);
  usedElsewhere.forEach(icon => {
    const source = customSvgIcons.find(i => i.name === icon.name)?.source;
    console.log(`  - ${icon.name} (from @/components/svg/${source})`);
    console.log(`    → Used ${icon.usage}x in other parts of navbar`);
  });
}

// Summary
console.log('\n\n📈 SUMMARY');
console.log('='.repeat(70));

console.log(`\nTotal imports: ${allImportedIcons.length}`);
console.log(`  - Lucide-react: ${lucideIcons.length}`);
console.log(`  - Custom SVG: ${customSvgIcons.length}`);
console.log(`\nMenu icons: ${allMenuIcons.length}`);
console.log(`  - Use Cases: ${useCasesIcons.length}`);
console.log(`  - Company: ${companyIcons.length}`);
console.log(`  - Support: ${supportIcons.length}`);
console.log(`\nStatus:`);
console.log(`  ✅ Properly imported: ${properlyImported.length}`);
console.log(`  ❌ Missing imports: ${missingImports.length}`);
console.log(`  🧹 Can be removed: ${canRemove.length}`);
console.log(`  📄 Used elsewhere: ${usedElsewhere.length}`);

if (missingImports.length === 0 && canRemove.length === 0) {
  console.log(`\n🎉 All icons are properly imported and used!\n`);
  process.exit(0);
} else if (missingImports.length > 0) {
  console.log(`\n❌ Action required: Import missing icons\n`);
  process.exit(1);
} else {
  console.log(`\n⚠️  Consider removing unused imports for cleaner code\n`);
  process.exit(0);
}
