#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { normalizeName, extractLinksFromText } from './obsidian-reader.js';
import { CONFIG } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FAMILY_TREE_APP_DIR = join(__dirname, '../family-tree-app');
const PUBLIC_DIR = join(FAMILY_TREE_APP_DIR, 'public');
const DATA_JSON_PATH = join(PUBLIC_DIR, 'data.json');
const PHOTOS_DEST = join(PUBLIC_DIR, 'photos');

/**
 * Generate JSON data from Obsidian vault for React app
 */
async function generateJSON() {
  console.log('='.repeat(60));
  console.log('Generating JSON for React Family Tree App');
  console.log('='.repeat(60));
  console.log('');

  // Create public directory if it doesn't exist
  if (!existsSync(PUBLIC_DIR)) {
    mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  console.log('Step 1: Reading Obsidian vault...\n');
  const people = readAllPeopleFromVault(CONFIG.obsidianVaultPath, CONFIG.excludeDirs);

  console.log(`\nStep 2: Building family data structure...\n`);
  const familyData = buildFamilyData(people, CONFIG.rootPerson);

  console.log(`Step 3: Copying photos...\n`);
  copyPhotos(CONFIG.photosPath, PHOTOS_DEST);

  console.log(`Step 4: Writing data.json...\n`);
  writeFileSync(DATA_JSON_PATH, JSON.stringify(familyData, null, 2), 'utf-8');

  console.log('\n' + '='.repeat(60));
  console.log('JSON Generation Complete!');
  console.log('='.repeat(60));
  console.log(`Total people: ${Object.keys(familyData.people).length}`);
  console.log(`Root person: ${familyData.rootPerson}`);
  console.log(`Output: ${DATA_JSON_PATH}`);
  console.log('');
  console.log('✓ Ready for React app!');
  console.log('  Next steps:');
  console.log('  1. cd family-tree-app');
  console.log('  2. npm install');
  console.log('  3. npm run dev');
}

/**
 * Read all people from Obsidian vault
 */
function readAllPeopleFromVault(vaultPath, excludeDirs) {
  const people = [];
  const files = getAllMarkdownFiles(vaultPath, excludeDirs);

  console.log(`Found ${files.length} markdown files`);

  files.forEach(filePath => {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const { data: frontmatter, content: markdown } = matter(content);

      // Use filename as the person name (matches Obsidian [[links]])
      // Normalize to NFC to fix macOS NFD decomposed Unicode filenames
      const fileName = filePath.split('/').pop().replace('.md', '').normalize('NFC');
      const personName = fileName;

      // Skip empty or invalid names
      if (!personName) return;

      const person = {
        name: personName,
        dateOfBirth: frontmatter['Date of birth'] || null,
        placeOfBirth: frontmatter['Place of birth'] || null,
        parents: parseArrayField(frontmatter['Parents']),
        siblings: parseArrayField(frontmatter['Siblings']),
        partner: parseStringField(frontmatter['Partner']),
        exPartners: parseArrayField(frontmatter['Ex-partners']),
        children: parseArrayField(frontmatter['Children']),
        bio: extractBioSection(markdown),
        photos: extractPhotos(markdown)
      };

      people.push(person);
    } catch (error) {
      console.warn(`Error reading ${filePath}:`, error.message);
    }
  });

  console.log(`Parsed ${people.length} person files`);

  return people;
}

/**
 * Build family data structure for React app
 */
function buildFamilyData(people, rootPersonName) {
  const familyData = {
    rootPerson: rootPersonName,
    people: {}
  };

  people.forEach(person => {
    const id = generateId(person.name);

    // Normalize date format
    let dateOfBirth = person.dateOfBirth;
    if (dateOfBirth && typeof dateOfBirth === 'object') {
      // Convert Date object to YYYY-MM-DD
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) {
        dateOfBirth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }

    // Determine if person is living (no death date in bio)
    const living = !person.bio?.toLowerCase().includes('умер') &&
                   !person.bio?.toLowerCase().includes('died') &&
                   !person.bio?.toLowerCase().includes('скончался');

    // Determine sex from name patterns (this is a heuristic, may need refinement)
    const sex = guessSex(person.name);

    familyData.people[person.name] = {
      id,
      name: person.name,
      dateOfBirth: dateOfBirth,
      placeOfBirth: person.placeOfBirth,
      sex,
      parents: person.parents,
      siblings: person.siblings,
      partner: person.partner,
      exPartners: person.exPartners,
      children: person.children,
      photos: person.photos,
      bio: person.bio,
      living
    };
  });

  return familyData;
}

/**
 * Guess sex from name (simple heuristic for Russian/English names)
 */
function guessSex(name) {
  if (!name) return null;

  const lowerName = name.toLowerCase();

  // Russian female endings
  if (lowerName.endsWith('ва') || lowerName.endsWith('на') || lowerName.endsWith('ая')) {
    return 'F';
  }

  // Russian male endings
  if (lowerName.endsWith('ов') || lowerName.endsWith('ев') || lowerName.endsWith('ий')) {
    return 'M';
  }

  // English names (very basic)
  if (lowerName.includes('kimberley') || lowerName.includes('jane')) {
    return 'F';
  }

  if (lowerName.includes('haroun') || lowerName.includes('kieran')) {
    return 'M';
  }

  return null;
}

/**
 * Extract bio section from markdown
 */
function extractBioSection(markdown) {
  const bioMatch = markdown.match(/##\s+Bio\s*\n([\s\S]*?)(?=\n##|$)/);
  return bioMatch ? bioMatch[1].trim() : '';
}

/**
 * Extract photos from markdown
 */
function extractPhotos(markdown) {
  const photoRegex = /!\[\[([^\]]+)\]\]/g;
  const photos = [];
  let match;

  while ((match = photoRegex.exec(markdown)) !== null) {
    photos.push(match[1]);
  }

  return photos;
}

/**
 * Copy photos from Obsidian vault to React public folder
 */
function copyPhotos(sourcePath, destPath) {
  if (!existsSync(sourcePath)) {
    console.warn(`Photos folder not found: ${sourcePath}`);
    return;
  }

  if (!existsSync(destPath)) {
    mkdirSync(destPath, { recursive: true });
  }

  try {
    cpSync(sourcePath, destPath, { recursive: true });
    console.log(`✓ Photos copied to ${destPath}`);
  } catch (error) {
    console.warn(`Error copying photos:`, error.message);
  }
}

/**
 * Generate ID from name
 */
function generateId(name) {
  return normalizeName(name).replace(/\s+/g, '-');
}

/**
 * Parse array field
 */
function parseArrayField(field) {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(extractNameFromLink);
  }
  return [extractNameFromLink(field)];
}

/**
 * Parse string field
 */
function parseStringField(field) {
  if (!field) return null;
  return extractNameFromLink(field);
}

/**
 * Extract name from [[Name]] format
 */
function extractNameFromLink(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;

  const linkMatch = value.match(/\[\[(.+?)\]\]/);
  return linkMatch ? linkMatch[1] : value;
}

/**
 * Get all markdown files recursively
 */
function getAllMarkdownFiles(dir, excludeDirs = []) {
  const files = [];

  function scan(currentDir) {
    try {
      const items = readdirSync(currentDir);

      items.forEach(item => {
        const fullPath = join(currentDir, item);

        try {
          const stat = lstatSync(fullPath);

          if (stat.isDirectory()) {
            if (!excludeDirs.includes(item) && !item.startsWith('.')) {
              scan(fullPath);
            }
          } else if (stat.isFile() && item.endsWith('.md')) {
            files.push(fullPath);
          }
        } catch (err) {
          // Skip files/dirs we can't access
        }
      });
    } catch (err) {
      console.warn(`Cannot read directory ${currentDir}:`, err.message);
    }
  }

  scan(dir);
  return files;
}

import { lstatSync } from 'fs';

// Run the script
generateJSON().catch(error => {
  console.error('\n❌ Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
