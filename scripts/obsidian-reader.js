import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

/**
 * Read all markdown files from Obsidian vault
 * @param {string} vaultPath - Path to Obsidian vault
 * @param {string[]} excludeDirs - Directories to exclude
 * @returns {Map<string, Object>} Map of normalized name to file data
 */
export function readObsidianVault(vaultPath, excludeDirs = []) {
  console.log('Reading Obsidian vault...');
  const files = getAllMarkdownFiles(vaultPath, excludeDirs);
  const peopleMap = new Map();

  console.log(`Found ${files.length} markdown files`);

  files.forEach(filePath => {
    try {
      const fileData = parseMarkdownFile(filePath, vaultPath);
      if (fileData) {
        const normalizedName = normalizeName(fileData.name);
        peopleMap.set(normalizedName, fileData);
      }
    } catch (error) {
      console.warn(`Error parsing ${filePath}:`, error.message);
    }
  });

  console.log(`Parsed ${peopleMap.size} person files`);

  return peopleMap;
}

/**
 * Get all markdown files recursively
 */
function getAllMarkdownFiles(dir, excludeDirs = []) {
  const files = [];

  function scan(currentDir) {
    const items = readdirSync(currentDir);

    items.forEach(item => {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip excluded directories
        if (!excludeDirs.includes(item) && !item.startsWith('.')) {
          scan(fullPath);
        }
      } else if (stat.isFile() && item.endsWith('.md')) {
        files.push(fullPath);
      }
    });
  }

  scan(dir);
  return files;
}

/**
 * Parse a single markdown file
 */
function parseMarkdownFile(filePath, vaultPath) {
  const content = readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: markdown } = matter(content);

  // Extract file name without extension
  const fileName = filePath.split('/').pop().replace('.md', '');

  // Extract person name from filename or H1 heading
  const h1Match = markdown.match(/^#\s+(.+)$/m);
  const personName = h1Match ? h1Match[1] : fileName;

  // Parse frontmatter
  const dateOfBirth = frontmatter['Date of birth'] || null;
  const placeOfBirth = frontmatter['Place of birth'] || null;
  const parents = parseArrayField(frontmatter['Parents']);
  const siblings = parseArrayField(frontmatter['Siblings']);
  const partner = parseStringField(frontmatter['Partner']);
  const exPartners = parseArrayField(frontmatter['Ex-partners']);
  const children = parseArrayField(frontmatter['Children']);

  return {
    filePath,
    fileName,
    name: personName,
    frontmatter: {
      dateOfBirth,
      placeOfBirth,
      parents,
      siblings,
      partner,
      exPartners,
      children
    },
    content: markdown,
    originalFrontmatter: frontmatter
  };
}

/**
 * Parse array field from frontmatter (can be array or single value)
 */
function parseArrayField(field) {
  if (!field) return [];
  if (Array.isArray(field)) {
    return field.map(extractNameFromLink);
  }
  return [extractNameFromLink(field)];
}

/**
 * Parse string field from frontmatter
 */
function parseStringField(field) {
  if (!field) return null;
  return extractNameFromLink(field);
}

/**
 * Extract name from Obsidian link format: "[[Name]]" → "Name"
 */
function extractNameFromLink(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;

  const linkMatch = value.match(/\[\[(.+?)\]\]/);
  return linkMatch ? linkMatch[1] : value;
}

/**
 * Normalize name for matching
 * Remove special characters, convert to lowercase
 */
export function normalizeName(name) {
  if (!name) return '';

  return name
    .toLowerCase()
    .replace(/[«»""'']/g, '')  // Remove special quotes
    .replace(/[()]/g, '')       // Remove parentheses
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();
}

/**
 * Extract names from [[Link]] format
 */
export function extractLinksFromText(text) {
  if (!text) return [];

  const linkRegex = /\[\[([^\]]+)\]\]/g;
  const links = [];
  let match;

  while ((match = linkRegex.exec(text)) !== null) {
    links.push(match[1]);
  }

  return links;
}
