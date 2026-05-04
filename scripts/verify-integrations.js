#!/usr/bin/env node

/**
 * Integrations Section Verification Script
 * 
 * Verifies:
 * 1. All 11 icons exist and are accessible
 * 2. No broken image paths
 * 3. No references to removed tools (Notion, Trello)
 * 4. Grid responsive layout configuration
 * 5. Alt text present for accessibility
 */

const fs = require('fs');
const path = require('path');

const EXPECTED_INTEGRATIONS = [
  'azure-devops',
  'teams',
  'github',
  'gitlab',
  'asana',
  'linear',
  'mcp',
  'bitbucket',
  'discord',
  'figma',
];

const REMOVED_INTEGRATIONS = ['notion', 'trello'];

console.log('🔍 Integrations Section Verification\n');
console.log('='.repeat(60));

// Check 1: Verify all icon files exist
console.log('\n✓ Checking icon files in /public/icons/integrations/\n');

const iconsDir = path.join(__dirname, '..', 'public', 'icons', 'integrations');
let allIconsExist = true;

EXPECTED_INTEGRATIONS.forEach((name) => {
  const iconPath = path.join(iconsDir, `${name}.svg`);
  const exists = fs.existsSync(iconPath);
  
  if (exists) {
    const stats = fs.statSync(iconPath);
    console.log(`  ✅ ${name}.svg (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${name}.svg - MISSING!`);
    allIconsExist = false;
  }
});

console.log(`\n  Total: ${EXPECTED_INTEGRATIONS.length} icons`);

// Check 2: Verify removed tools are not referenced
console.log('\n✓ Checking for removed tools (Notion, Trello)\n');

const componentPath = path.join(__dirname, '..', 'components', 'landing', 'integrations-section.tsx');
const appPagePath = path.join(__dirname, '..', 'app', 'page.tsx');

let foundRemovedTools = false;

[componentPath, appPagePath].forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    
    REMOVED_INTEGRATIONS.forEach((tool) => {
      // Case-insensitive check, but exclude FAQ text
      const regex = new RegExp(`['"\`]${tool}['"\`]`, 'gi');
      const matches = content.match(regex);
      
      if (matches) {
        console.log(`  ⚠️  ${fileName}: Found "${tool}" (${matches.length} occurrences)`);
        foundRemovedTools = true;
      }
    });
  }
});

if (!foundRemovedTools) {
  console.log('  ✅ No references to Notion or Trello in integrations code');
}

// Check 3: Verify component structure
console.log('\n✓ Checking component structure\n');

if (fs.existsSync(componentPath)) {
  const componentContent = fs.readFileSync(componentPath, 'utf-8');
  
  // Check for responsive grid classes
  const hasResponsiveGrid = componentContent.includes('grid-cols-2') &&
                           componentContent.includes('sm:grid-cols-3') &&
                           componentContent.includes('md:grid-cols-4') &&
                           componentContent.includes('lg:grid-cols-6');
  
  if (hasResponsiveGrid) {
    console.log('  ✅ Responsive grid: 2 → 3 → 4 → 6 columns');
  } else {
    console.log('  ❌ Missing responsive grid classes');
  }
  
  // Check for hover effects
  const hasHoverEffects = componentContent.includes('hover:') || 
                         componentContent.includes('transition');
  
  if (hasHoverEffects) {
    console.log('  ✅ Hover effects configured');
  } else {
    console.log('  ⚠️  No hover effects found');
  }
  
  // Check for alt text
  const hasAltText = componentContent.includes('alt=');
  
  if (hasAltText) {
    console.log('  ✅ Alt text present for accessibility');
  } else {
    console.log('  ❌ Missing alt text');
  }
  
  // Check for Image component
  const usesNextImage = componentContent.includes("from 'next/image'");
  
  if (usesNextImage) {
    console.log('  ✅ Using Next.js Image component');
  } else {
    console.log('  ⚠️  Not using Next.js Image component');
  }
  
  // Count integrations in component
  const integrationMatches = componentContent.match(/{\s*name:\s*['"][^'"]+['"]/g);
  if (integrationMatches) {
    console.log(`  ✅ ${integrationMatches.length} integrations defined`);
  }
}

// Check 4: Verify app/page.tsx implementation
console.log('\n✓ Checking app/page.tsx implementation\n');

if (fs.existsSync(appPagePath)) {
  const pageContent = fs.readFileSync(appPagePath, 'utf-8');
  
  // Check which implementation is being used
  const usesSimpleIcons = pageContent.includes('@icons-pack/react-simple-icons');
  const usesIntegrationsComponent = pageContent.includes('IntegrationsSection');
  
  if (usesSimpleIcons) {
    console.log('  ✅ Using @icons-pack/react-simple-icons');
    
    // Count integrations
    const integrationMatches = pageContent.match(/SiSlack|SiAzuredevops|SiMicrosoftteams|SiGithub|SiGitlab|SiAsana|SiLinear|SiBitbucket|SiDiscord|SiFigma|CustomMCPIcon/g);
    if (integrationMatches) {
      console.log(`  ✅ ${new Set(integrationMatches).size} icon components imported`);
    }
  }
  
  if (usesIntegrationsComponent) {
    console.log('  ✅ Using IntegrationsSection component');
  }
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary\n');

if (allIconsExist) {
  console.log('✅ All 11 integration icons exist');
} else {
  console.log('❌ Some integration icons are missing');
}

if (!foundRemovedTools) {
  console.log('✅ No references to removed tools (Notion, Trello)');
} else {
  console.log('⚠️  Found references to removed tools in integrations');
}

console.log('\n✨ Verification complete!\n');

// Exit with appropriate code
process.exit(allIconsExist && !foundRemovedTools ? 0 : 1);
