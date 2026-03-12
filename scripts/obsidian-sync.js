import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { getRelativePhotoPath } from './photo-downloader.js';

/**
 * Sync GEDCOM data to Obsidian vault
 * @param {Map} gedcomIndividuals - GEDCOM individuals
 * @param {Map} gedcomFamilies - GEDCOM families
 * @param {Map} matches - Matched GEDCOM IDs to Obsidian data
 * @param {Map} newPeople - New people to create
 * @param {Map} photoMap - Map of gedcomId to local photo paths
 * @param {string} vaultPath - Obsidian vault path
 * @param {string} templatePath - Path to template file
 * @returns {Object} Sync statistics
 */
export function syncToObsidian(
  gedcomIndividuals,
  gedcomFamilies,
  matches,
  newPeople,
  photoMap,
  vaultPath,
  templatePath
) {
  console.log('Syncing data to Obsidian vault...');

  const stats = {
    updated: 0,
    created: 0,
    skipped: 0,
    errors: 0
  };

  // Read template
  const template = readFileSync(templatePath, 'utf-8');

  // Update existing matched files
  console.log('\nUpdating existing files...');
  matches.forEach((obsidianData, gedcomId) => {
    try {
      const gedcomPerson = gedcomIndividuals.get(gedcomId);
      updateExistingFile(obsidianData, gedcomPerson, gedcomFamilies, gedcomIndividuals, photoMap, vaultPath);
      stats.updated++;
      console.log(`  ✓ Updated: ${obsidianData.name}`);
    } catch (error) {
      console.error(`  ✗ Error updating ${obsidianData.name}:`, error.message);
      stats.errors++;
    }
  });

  // Create new files
  console.log('\nCreating new files...');
  newPeople.forEach((gedcomPerson, gedcomId) => {
    try {
      createNewFile(gedcomPerson, gedcomId, gedcomFamilies, gedcomIndividuals, photoMap, vaultPath, template);
      stats.created++;
      console.log(`  ✓ Created: ${gedcomPerson.fullName}`);
    } catch (error) {
      console.error(`  ✗ Error creating ${gedcomPerson.fullName}:`, error.message);
      stats.errors++;
    }
  });

  console.log('\nSync complete!');
  console.log(`  Updated: ${stats.updated}`);
  console.log(`  Created: ${stats.created}`);
  console.log(`  Errors: ${stats.errors}`);

  return stats;
}

/**
 * Update an existing Obsidian file
 * Only fill in empty fields, preserve all manual content
 */
function updateExistingFile(obsidianData, gedcomPerson, gedcomFamilies, gedcomIndividuals, photoMap, vaultPath) {
  const fileContent = readFileSync(obsidianData.filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(fileContent);

  // Build relationships from GEDCOM
  const relationships = buildRelationships(gedcomPerson, gedcomFamilies, gedcomIndividuals);

  // Only update empty fields
  if (!frontmatter['Date of birth'] && gedcomPerson.birthDate) {
    frontmatter['Date of birth'] = gedcomPerson.birthDate;
  }

  if (!frontmatter['Place of birth'] && gedcomPerson.birthPlace) {
    frontmatter['Place of birth'] = gedcomPerson.birthPlace;
  }

  // Update relationships (merge with existing)
  if (relationships.parents.length > 0) {
    frontmatter['Parents'] = mergeArrays(frontmatter['Parents'], relationships.parents);
  }

  if (relationships.siblings.length > 0) {
    frontmatter['Siblings'] = mergeArrays(frontmatter['Siblings'], relationships.siblings);
  }

  if (relationships.partner && !frontmatter['Partner']) {
    frontmatter['Partner'] = relationships.partner;
  }

  if (relationships.exPartners.length > 0) {
    frontmatter['Ex-partners'] = mergeArrays(frontmatter['Ex-partners'], relationships.exPartners);
  }

  if (relationships.children.length > 0) {
    frontmatter['Children'] = mergeArrays(frontmatter['Children'], relationships.children);
  }

  // Add photos
  const photos = photoMap.get(gedcomPerson.id);
  if (photos && photos.length > 0) {
    const relativePaths = photos.map(p => getRelativePhotoPath(p, vaultPath));
    markdown += addPhotosToMarkdown(relativePaths, markdown);
  }

  // Write updated file
  const updatedContent = matter.stringify(markdown, frontmatter);
  writeFileSync(obsidianData.filePath, updatedContent, 'utf-8');
}

/**
 * Create a new Obsidian file for a person
 */
function createNewFile(gedcomPerson, gedcomId, gedcomFamilies, gedcomIndividuals, photoMap, vaultPath, template) {
  // Parse template
  const { data: templateFrontmatter, content: templateContent } = matter(template);

  // Build frontmatter
  const frontmatter = { ...templateFrontmatter };

  if (gedcomPerson.birthDate) {
    frontmatter['Date of birth'] = gedcomPerson.birthDate;
  }

  if (gedcomPerson.birthPlace) {
    frontmatter['Place of birth'] = gedcomPerson.birthPlace;
  }

  // Build relationships
  const relationships = buildRelationships(gedcomPerson, gedcomFamilies, gedcomIndividuals);

  if (relationships.parents.length > 0) {
    frontmatter['Parents'] = relationships.parents;
  }

  if (relationships.siblings.length > 0) {
    frontmatter['Siblings'] = relationships.siblings;
  }

  if (relationships.partner) {
    frontmatter['Partner'] = relationships.partner;
  }

  if (relationships.exPartners.length > 0) {
    frontmatter['Ex-partners'] = relationships.exPartners;
  }

  if (relationships.children.length > 0) {
    frontmatter['Children'] = relationships.children;
  }

  // Build content
  let content = templateContent.replace('Add some information here', '');

  // Add heading with person name
  content = `# ${gedcomPerson.fullName}\n\n` + content;

  // Add photos
  const photos = photoMap.get(gedcomId);
  if (photos && photos.length > 0) {
    const relativePaths = photos.map(p => getRelativePhotoPath(p, vaultPath));
    content += addPhotosToMarkdown(relativePaths, '');
  }

  // Generate filename
  const fileName = generateFileName(gedcomPerson);
  const filePath = join(vaultPath, fileName);

  // Write file
  const fileContent = matter.stringify(content, frontmatter);
  writeFileSync(filePath, fileContent, 'utf-8');
}

/**
 * Build relationships from GEDCOM data
 */
function buildRelationships(gedcomPerson, gedcomFamilies, gedcomIndividuals) {
  const relationships = {
    parents: [],
    siblings: [],
    partner: null,
    exPartners: [],
    children: []
  };

  // Get family as child (parents and siblings)
  if (gedcomPerson.familyAsChild) {
    const family = gedcomFamilies.get(gedcomPerson.familyAsChild);
    if (family) {
      // Parents
      if (family.husbandId) {
        const father = gedcomIndividuals.get(family.husbandId);
        if (father) relationships.parents.push(`[[${father.fullName}]]`);
      }
      if (family.wifeId) {
        const mother = gedcomIndividuals.get(family.wifeId);
        if (mother) relationships.parents.push(`[[${mother.fullName}]]`);
      }

      // Siblings
      if (family.childrenIds) {
        family.childrenIds.forEach(siblingId => {
          if (siblingId !== gedcomPerson.id) {
            const sibling = gedcomIndividuals.get(siblingId);
            if (sibling) relationships.siblings.push(`[[${sibling.fullName}]]`);
          }
        });
      }
    }
  }

  // Get families as spouse (partner, ex-partners, children)
  if (gedcomPerson.familiesAsSpouse && gedcomPerson.familiesAsSpouse.length > 0) {
    gedcomPerson.familiesAsSpouse.forEach((familyId, index) => {
      const family = gedcomFamilies.get(familyId);
      if (!family) return;

      // Determine spouse
      const spouseId = family.husbandId === gedcomPerson.id ? family.wifeId : family.husbandId;
      const spouse = spouseId ? gedcomIndividuals.get(spouseId) : null;

      if (spouse) {
        const spouseLink = `[[${spouse.fullName}]]`;

        if (family.divorced) {
          relationships.exPartners.push(spouseLink);
        } else if (index === gedcomPerson.familiesAsSpouse.length - 1) {
          // Most recent family is current partner
          relationships.partner = spouseLink;
        } else {
          relationships.exPartners.push(spouseLink);
        }
      }

      // Children
      if (family.childrenIds) {
        family.childrenIds.forEach(childId => {
          const child = gedcomIndividuals.get(childId);
          if (child) relationships.children.push(`[[${child.fullName}]]`);
        });
      }
    });
  }

  return relationships;
}

/**
 * Merge two arrays, avoiding duplicates
 */
function mergeArrays(existing, newItems) {
  if (!existing || existing.length === 0) return newItems;
  if (!newItems || newItems.length === 0) return existing;

  const combined = [...existing];

  newItems.forEach(item => {
    const normalized = item.replace(/\[\[|\]\]/g, '').toLowerCase();
    const exists = combined.some(existingItem => {
      const existingNormalized = existingItem.replace(/\[\[|\]\]/g, '').toLowerCase();
      return existingNormalized === normalized;
    });

    if (!exists) {
      combined.push(item);
    }
  });

  return combined;
}

/**
 * Add photos to markdown content
 */
function addPhotosToMarkdown(photoPaths, existingContent) {
  if (!photoPaths || photoPaths.length === 0) return '';

  // Check if Photos section already exists
  if (existingContent.includes('## Photos')) {
    return ''; // Don't duplicate
  }

  let photoSection = '\n';
  photoPaths.forEach(path => {
    photoSection += `![[${path}]]\n`;
  });

  return photoSection;
}

/**
 * Generate filename for a person
 */
function generateFileName(gedcomPerson) {
  return `${gedcomPerson.fullName}.md`;
}

/**
 * Generate sync report
 */
export function generateSyncReport(stats, reportPath) {
  const report = `# Obsidian Sync Report

Generated: ${new Date().toLocaleString()}

## Summary

- **Files updated:** ${stats.updated}
- **Files created:** ${stats.created}
- **Errors:** ${stats.errors}

## Next Steps

1. Review updated files in your Obsidian vault
2. Check that relationships are correct
3. Verify photos are displaying properly
4. Add any additional manual content to new files
`;

  writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nSync report saved to: ${reportPath}`);
}
