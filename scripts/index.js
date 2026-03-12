#!/usr/bin/env node

import { parseGEDCOM } from './gedcom-parser.js';
import { readObsidianVault } from './obsidian-reader.js';
import { matchAndDetectConflicts, generateConflictsReport } from './matcher.js';
import { downloadAllPhotos } from './photo-downloader.js';
import { syncToObsidian, generateSyncReport } from './obsidian-sync.js';
import { CONFIG } from './config.js';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args.find(arg => arg.startsWith('--'))?.replace('--', '') || 'help';

// Main orchestrator
async function main() {
  console.log('='.repeat(60));
  console.log('Family Tree GEDCOM to Obsidian Sync');
  console.log('='.repeat(60));
  console.log('');

  switch (command) {
    case 'parse':
      await runParse();
      break;

    case 'check-conflicts':
      await runConflictCheck();
      break;

    case 'download-photos':
      await runPhotoDownload();
      break;

    case 'sync':
      await runFullSync();
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

/**
 * Parse GEDCOM and show statistics
 */
async function runParse() {
  console.log('Step 1: Parsing GEDCOM file...\n');

  const { individuals, families } = parseGEDCOM(CONFIG.gedcomPath);

  console.log('\n' + '-'.repeat(60));
  console.log('GEDCOM Parsing Complete!');
  console.log('-'.repeat(60));
  console.log(`Total individuals: ${individuals.size}`);
  console.log(`Total families: ${families.size}`);

  // Show sample data
  console.log('\nSample individuals:');
  let count = 0;
  for (const [id, person] of individuals.entries()) {
    if (count >= 5) break;
    console.log(`  - ${person.fullName} (${person.birthDate || 'unknown'})`);
    count++;
  }

  console.log('\n✓ GEDCOM parsing successful!');
}

/**
 * Check for conflicts between GEDCOM and Obsidian
 */
async function runConflictCheck() {
  console.log('Step 1: Parsing GEDCOM file...\n');
  const { individuals, families } = parseGEDCOM(CONFIG.gedcomPath);

  console.log('\nStep 2: Reading Obsidian vault...\n');
  const obsidianPeople = readObsidianVault(CONFIG.obsidianVaultPath, CONFIG.excludeDirs);

  console.log('\nStep 3: Matching and detecting conflicts...\n');
  const { matches, newPeople, conflicts } = matchAndDetectConflicts(
    individuals,
    families,
    obsidianPeople
  );

  console.log('\nStep 4: Generating conflicts report...\n');
  generateConflictsReport(conflicts, CONFIG.conflictsReportPath);

  console.log('\n' + '-'.repeat(60));
  console.log('Conflict Check Complete!');
  console.log('-'.repeat(60));
  console.log(`Matched people: ${matches.size}`);
  console.log(`New people to add: ${newPeople.size}`);
  console.log(`Conflicts found: ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log('\n⚠️  Conflicts detected! Please review conflicts.md');
    console.log('   Resolve conflicts before running sync.');
  } else {
    console.log('\n✓ No conflicts found! Safe to proceed with sync.');
  }
}

/**
 * Download photos from MyHeritage
 */
async function runPhotoDownload() {
  console.log('Step 1: Parsing GEDCOM file...\n');
  const { individuals, families } = parseGEDCOM(CONFIG.gedcomPath);

  console.log('\nStep 2: Downloading photos...\n');
  const photoMap = await downloadAllPhotos(individuals, CONFIG.photosPath);

  console.log('\n' + '-'.repeat(60));
  console.log('Photo Download Complete!');
  console.log('-'.repeat(60));
  console.log(`People with photos: ${photoMap.size}`);

  console.log('\n✓ Photos downloaded successfully!');
}

/**
 * Run full sync: parse, match, download photos, and update Obsidian
 */
async function runFullSync() {
  console.log('Running full sync...\n');

  console.log('Step 1: Parsing GEDCOM file...\n');
  const { individuals, families } = parseGEDCOM(CONFIG.gedcomPath);

  console.log('\nStep 2: Reading Obsidian vault...\n');
  const obsidianPeople = readObsidianVault(CONFIG.obsidianVaultPath, CONFIG.excludeDirs);

  console.log('\nStep 3: Matching individuals...\n');
  const { matches, newPeople, conflicts } = matchAndDetectConflicts(
    individuals,
    families,
    obsidianPeople
  );

  if (conflicts.length > 0) {
    console.log('\n⚠️  Warning: Conflicts detected!');
    console.log('   Some data differences found between GEDCOM and Obsidian.');
    console.log('   Proceeding with sync (existing Obsidian data will be preserved).');
    console.log('   Review conflicts.md after sync.\n');
    generateConflictsReport(conflicts, CONFIG.conflictsReportPath);
  }

  console.log('\nStep 4: Downloading photos...\n');
  const photoMap = await downloadAllPhotos(individuals, CONFIG.photosPath);

  console.log('\nStep 5: Syncing to Obsidian...\n');
  const stats = syncToObsidian(
    individuals,
    families,
    matches,
    newPeople,
    photoMap,
    CONFIG.obsidianVaultPath,
    CONFIG.obsidianTemplatePath
  );

  console.log('\nStep 6: Generating sync report...\n');
  generateSyncReport(stats, CONFIG.syncReportPath);

  console.log('\n' + '='.repeat(60));
  console.log('FULL SYNC COMPLETE!');
  console.log('='.repeat(60));
  console.log(`Files updated: ${stats.updated}`);
  console.log(`Files created: ${stats.created}`);
  console.log(`Photos downloaded: ${photoMap.size} people`);
  console.log(`Conflicts: ${conflicts.length}`);

  console.log('\n✓ Your Obsidian vault has been updated!');
  console.log('  Check sync-report.md for details.');
  if (conflicts.length > 0) {
    console.log('  Review conflicts.md for data differences.');
  }
}

/**
 * Show help message
 */
function showHelp() {
  console.log('Usage: node index.js [command]');
  console.log('');
  console.log('Commands:');
  console.log('  --parse              Parse GEDCOM file and show statistics');
  console.log('  --check-conflicts    Check for conflicts between GEDCOM and Obsidian');
  console.log('  --download-photos    Download photos from MyHeritage to local storage');
  console.log('  --sync               Run full sync (parse, match, download, update)');
  console.log('  --help               Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  npm run parse');
  console.log('  npm run conflicts');
  console.log('  npm run photos');
  console.log('  npm run sync');
  console.log('');
}

// Run main function
main().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
