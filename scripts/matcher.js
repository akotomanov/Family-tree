import { writeFileSync } from 'fs';
import { normalizeName } from './obsidian-reader.js';

/**
 * Match GEDCOM individuals with Obsidian files and detect conflicts
 * @param {Map} gedcomIndividuals - Map of GEDCOM individuals
 * @param {Map} gedcomFamilies - Map of GEDCOM families
 * @param {Map} obsidianPeople - Map of Obsidian person files
 * @returns {{matches: Map, newPeople: Map, conflicts: Array}}
 */
export function matchAndDetectConflicts(gedcomIndividuals, gedcomFamilies, obsidianPeople) {
  console.log('Matching GEDCOM individuals with Obsidian files...');

  const matches = new Map(); // Map<gedcomId, obsidianData>
  const newPeople = new Map(); // Map<gedcomId, gedcomData>
  const conflicts = [];

  // Try to match each GEDCOM individual with Obsidian files
  gedcomIndividuals.forEach((gedcomPerson, gedcomId) => {
    const normalizedGedcomName = normalizeName(gedcomPerson.fullName);

    // Try to find a match in Obsidian vault
    let matched = false;

    for (const [obsidianNormalizedName, obsidianData] of obsidianPeople.entries()) {
      if (isMatch(normalizedGedcomName, obsidianNormalizedName, gedcomPerson, obsidianData)) {
        matches.set(gedcomId, obsidianData);
        matched = true;

        // Check for conflicts
        const personConflicts = detectPersonConflicts(gedcomPerson, obsidianData, gedcomId);
        if (personConflicts.length > 0) {
          conflicts.push({
            gedcomId,
            gedcomPerson,
            obsidianData,
            conflicts: personConflicts
          });
        }

        break;
      }
    }

    if (!matched) {
      newPeople.set(gedcomId, gedcomPerson);
    }
  });

  console.log(`Matched: ${matches.size}, New: ${newPeople.size}, Conflicts: ${conflicts.length}`);

  return { matches, newPeople, conflicts };
}

/**
 * Check if GEDCOM person matches Obsidian person
 */
function isMatch(gedcomNormalizedName, obsidianNormalizedName, gedcomPerson, obsidianData) {
  // Exact name match
  if (gedcomNormalizedName === obsidianNormalizedName) {
    return true;
  }

  // Partial name match (e.g., "александр котоманов" vs "alexander kotomanov")
  const gedcomParts = gedcomNormalizedName.split(' ');
  const obsidianParts = obsidianNormalizedName.split(' ');

  // Check if surnames match (last word)
  if (gedcomParts.length > 1 && obsidianParts.length > 1) {
    const gedcomSurname = gedcomParts[gedcomParts.length - 1];
    const obsidianSurname = obsidianParts[obsidianParts.length - 1];

    if (gedcomSurname === obsidianSurname || areSimilar(gedcomSurname, obsidianSurname)) {
      // Surnames match, check if birth dates also match
      if (gedcomPerson.birthDate && obsidianData.frontmatter.dateOfBirth) {
        return datesEqual(gedcomPerson.birthDate, obsidianData.frontmatter.dateOfBirth);
      }

      // If no birth dates, assume it's a match based on surname
      return true;
    }
  }

  return false;
}

/**
 * Check if two strings are similar (for transliteration, e.g., "котоманов" vs "kotomanov")
 */
function areSimilar(str1, str2) {
  // Simple Levenshtein distance check
  if (Math.abs(str1.length - str2.length) > 3) return false;

  const distance = levenshteinDistance(str1, str2);
  return distance <= 3;
}

/**
 * Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Check if two dates are equal
 */
function datesEqual(date1, date2) {
  if (!date1 || !date2) return false;

  // Normalize dates to YYYY-MM-DD
  const norm1 = normalizeDate(date1);
  const norm2 = normalizeDate(date2);

  return norm1 === norm2;
}

/**
 * Normalize date to YYYY-MM-DD
 */
function normalizeDate(dateStr) {
  if (!dateStr) return null;

  // Already in YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }

  // Handle other formats if needed
  return dateStr;
}

/**
 * Detect conflicts between GEDCOM and Obsidian data for a person
 */
function detectPersonConflicts(gedcomPerson, obsidianData, gedcomId) {
  const conflicts = [];

  // Check birth date
  if (gedcomPerson.birthDate && obsidianData.frontmatter.dateOfBirth) {
    if (!datesEqual(gedcomPerson.birthDate, obsidianData.frontmatter.dateOfBirth)) {
      conflicts.push({
        field: 'Date of birth',
        gedcom: gedcomPerson.birthDate,
        obsidian: obsidianData.frontmatter.dateOfBirth,
        type: 'conflict'
      });
    }
  }

  // Check birth place
  if (gedcomPerson.birthPlace && obsidianData.frontmatter.placeOfBirth) {
    if (gedcomPerson.birthPlace !== obsidianData.frontmatter.placeOfBirth) {
      const similar = gedcomPerson.birthPlace.toLowerCase().includes(obsidianData.frontmatter.placeOfBirth.toLowerCase()) ||
                      obsidianData.frontmatter.placeOfBirth.toLowerCase().includes(gedcomPerson.birthPlace.toLowerCase());

      conflicts.push({
        field: 'Place of birth',
        gedcom: gedcomPerson.birthPlace,
        obsidian: obsidianData.frontmatter.placeOfBirth,
        type: similar ? 'similar' : 'conflict'
      });
    }
  }

  // Check name format
  if (gedcomPerson.fullName !== obsidianData.name) {
    const normalizedGedcom = normalizeName(gedcomPerson.fullName);
    const normalizedObsidian = normalizeName(obsidianData.name);

    if (normalizedGedcom !== normalizedObsidian) {
      conflicts.push({
        field: 'Full name',
        gedcom: gedcomPerson.fullName,
        obsidian: obsidianData.name,
        type: 'format'
      });
    }
  }

  return conflicts;
}

/**
 * Generate conflicts report in markdown
 */
export function generateConflictsReport(conflictsList, reportPath) {
  console.log('Generating conflicts report...');

  let report = '# Data Conflicts Report\n\n';
  report += `Generated: ${new Date().toLocaleString()}\n\n`;
  report += `## Conflicts Found: ${conflictsList.length}\n\n`;

  if (conflictsList.length === 0) {
    report += 'No conflicts found! All matched people have consistent data.\n';
  } else {
    conflictsList.forEach((conflict, index) => {
      report += `### ${index + 1}. ${conflict.obsidianData.name}\n\n`;
      report += `**GEDCOM ID:** ${conflict.gedcomId}\n\n`;
      report += '| Field | GEDCOM | Obsidian | Status |\n';
      report += '|-------|--------|----------|--------|\n';

      conflict.conflicts.forEach(c => {
        let status = '';
        if (c.type === 'conflict') status = '⚠️ CONFLICT';
        else if (c.type === 'similar') status = '⚙️ Similar';
        else if (c.type === 'format') status = 'ℹ️ Format difference';

        report += `| ${c.field} | ${c.gedcom || 'N/A'} | ${c.obsidian || 'N/A'} | ${status} |\n`;
      });

      report += '\n';
    });
  }

  report += '\n---\n\n';
  report += '## Summary\n';
  report += `- Total conflicts: ${conflictsList.length}\n`;
  report += `- Review each conflict and update either GEDCOM data or Obsidian files manually\n`;
  report += `- Re-run the conflict checker after resolving conflicts\n`;

  writeFileSync(reportPath, report, 'utf-8');
  console.log(`Conflicts report saved to: ${reportPath}`);
}
