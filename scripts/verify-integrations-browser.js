/**
 * Browser Console Verification Script
 * 
 * Run this in the browser console on the landing page to verify:
 * - All integration icons load correctly
 * - No broken images (404s)
 * - Responsive grid layout
 * - Hover effects
 * 
 * Usage:
 * 1. Navigate to the landing page (localhost:3000)
 * 2. Open DevTools Console (F12)
 * 3. Paste this script and press Enter
 */

(function verifyIntegrations() {
  console.log('%c🔍 Integrations Section Verification', 'font-size: 16px; font-weight: bold; color: #10B981;');
  console.log('%c' + '='.repeat(60), 'color: #6B7280;');
  
  // Find integrations section
  const section = document.querySelector('section[aria-labelledby="integrations-heading"]') || 
                  document.querySelector('[class*="integrations"]') ||
                  Array.from(document.querySelectorAll('section')).find(s => 
                    s.textContent.includes('Works with Your') && s.textContent.includes('Agile Tools')
                  );
  
  if (!section) {
    console.error('%c❌ Integrations section not found', 'color: #EF4444; font-weight: bold;');
    return;
  }
  
  console.log('%c✅ Found integrations section', 'color: #10B981;');
  
  // Check 1: Find all integration images/icons
  console.log('\n%c1️⃣ Checking Integration Icons', 'font-weight: bold; color: #3B82F6;');
  
  const images = section.querySelectorAll('img[alt*="integration"]');
  const svgIcons = section.querySelectorAll('svg');
  
  console.log(`  Found ${images.length} images and ${svgIcons.length} SVG icons`);
  
  // Check for broken images
  let brokenImages = 0;
  images.forEach((img, index) => {
    if (!img.complete || img.naturalHeight === 0) {
      console.error(`  ❌ Broken image #${index + 1}: ${img.alt} - ${img.src}`);
      brokenImages++;
    } else {
      console.log(`  ✅ ${img.alt} - ${img.naturalWidth}x${img.naturalHeight}px`);
    }
  });
  
  if (brokenImages === 0 && images.length > 0) {
    console.log('%c  ✅ All images loaded successfully', 'color: #10B981;');
  }
  
  // Check 2: Verify grid layout
  console.log('\n%c2️⃣ Checking Responsive Grid', 'font-weight: bold; color: #3B82F6;');
  
  const grid = section.querySelector('[class*="grid"]');
  if (grid) {
    const styles = window.getComputedStyle(grid);
    const columns = styles.gridTemplateColumns.split(' ').length;
    
    console.log(`  Current viewport: ${window.innerWidth}px`);
    console.log(`  Grid columns: ${columns}`);
    
    // Check responsive behavior
    const gridClasses = grid.className;
    const hasResponsive = 
      gridClasses.includes('grid-cols-2') &&
      (gridClasses.includes('sm:grid-cols-3') || gridClasses.includes('md:grid-cols-4')) &&
      gridClasses.includes('lg:grid-cols-6');
    
    if (hasResponsive) {
      console.log('%c  ✅ Responsive grid classes configured', 'color: #10B981;');
      console.log('    Mobile: 2 cols | Tablet: 3-4 cols | Desktop: 6 cols');
    } else {
      console.warn('  ⚠️ Missing responsive grid classes');
    }
  }
  
  // Check 3: Verify tool cards
  console.log('\n%c3️⃣ Checking Integration Cards', 'font-weight: bold; color: #3B82F6;');
  
  const cards = section.querySelectorAll('[class*="flex"][class*="col"]') ||
                section.querySelectorAll('div > div > div');
  
  const expectedTools = [
    'Slack', 'Azure DevOps', 'Teams',
    'GitHub', 'GitLab', 'Asana', 'Linear',
    'MCP', 'Bitbucket', 'Discord', 'Figma'
  ];
  
  const removedTools = ['Notion', 'Trello'];
  
  const foundTools = new Set();
  cards.forEach(card => {
    const text = card.textContent.trim();
    expectedTools.forEach(tool => {
      if (text.includes(tool)) {
        foundTools.add(tool);
      }
    });
  });
  
  console.log(`  Found ${foundTools.size} integration tools:`);
  expectedTools.forEach(tool => {
    if (foundTools.has(tool)) {
      console.log(`    ✅ ${tool}`);
    } else {
      console.warn(`    ⚠️ ${tool} - Not found`);
    }
  });
  
  // Check for removed tools
  const sectionText = section.textContent;
  const foundRemoved = removedTools.filter(tool => sectionText.includes(tool));
  
  if (foundRemoved.length > 0) {
    console.error(`%c  ❌ Found removed tools: ${foundRemoved.join(', ')}`, 'color: #EF4444;');
  } else {
    console.log('%c  ✅ No removed tools (Notion, Trello) found', 'color: #10B981;');
  }
  
  // Check 4: Verify hover effects
  console.log('\n%c4️⃣ Checking Hover Effects', 'font-weight: bold; color: #3B82F6;');
  
  const firstCard = cards[0];
  if (firstCard) {
    const hasTransition = window.getComputedStyle(firstCard).transition !== 'all 0s ease 0s';
    const hasHoverClass = firstCard.className.includes('hover:');
    
    if (hasTransition || hasHoverClass) {
      console.log('%c  ✅ Hover effects configured', 'color: #10B981;');
    } else {
      console.warn('  ⚠️ No hover effects detected');
    }
  }
  
  // Check 5: Accessibility
  console.log('\n%c5️⃣ Checking Accessibility', 'font-weight: bold; color: #3B82F6;');
  
  let accessibilityScore = 0;
  
  // Check for alt text
  const imagesWithAlt = Array.from(images).filter(img => img.alt && img.alt.trim() !== '');
  if (imagesWithAlt.length === images.length && images.length > 0) {
    console.log(`  ✅ All ${images.length} images have alt text`);
    accessibilityScore++;
  } else {
    console.warn(`  ⚠️ ${images.length - imagesWithAlt.length} images missing alt text`);
  }
  
  // Check for heading
  const heading = section.querySelector('h2, h3');
  if (heading) {
    console.log(`  ✅ Section heading: "${heading.textContent.trim()}"`);
    accessibilityScore++;
  }
  
  // Check for ARIA labels
  const hasAriaLabel = section.hasAttribute('aria-labelledby') || section.hasAttribute('aria-label');
  if (hasAriaLabel) {
    console.log('  ✅ ARIA labels present');
    accessibilityScore++;
  }
  
  // Summary
  console.log('\n%c' + '='.repeat(60), 'color: #6B7280;');
  console.log('\n%c📊 Summary', 'font-size: 14px; font-weight: bold; color: #10B981;');
  console.log(`\n  ✅ Icons: ${foundTools.size}/11`);
  console.log(`  ${brokenImages === 0 ? '✅' : '❌'} Image Loading: ${brokenImages === 0 ? 'All OK' : brokenImages + ' broken'}`);
  console.log(`  ${foundRemoved.length === 0 ? '✅' : '❌'} Removed Tools: ${foundRemoved.length === 0 ? 'None found' : foundRemoved.join(', ')}`);
  console.log(`  ✅ Accessibility: ${accessibilityScore}/3 checks passed`);
  
  console.log('\n%c✨ Verification complete!', 'font-size: 14px; font-weight: bold; color: #10B981;');
})();
