import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import axios from 'axios';
import { normalizeName } from './obsidian-reader.js';

/**
 * Download all photos from GEDCOM individuals
 * @param {Map} gedcomIndividuals - Map of GEDCOM individuals
 * @param {string} photosBasePath - Base path for photos folder
 * @returns {Map<gedcomId, localPhotoPaths[]>} Map of person ID to local photo paths
 */
export async function downloadAllPhotos(gedcomIndividuals, photosBasePath) {
  console.log('Downloading photos from MyHeritage...');

  const photoMap = new Map();
  let totalPhotos = 0;
  let downloadedPhotos = 0;
  let failedPhotos = 0;

  // Create Photos directory if it doesn't exist
  if (!existsSync(photosBasePath)) {
    mkdirSync(photosBasePath, { recursive: true });
  }

  for (const [gedcomId, individual] of gedcomIndividuals.entries()) {
    if (!individual.photos || individual.photos.length === 0) continue;

    totalPhotos += individual.photos.length;

    const personFolderName = normalizeName(individual.fullName).replace(/\s+/g, '_');
    const personPhotoDir = join(photosBasePath, personFolderName);

    // Create person's photo directory
    if (!existsSync(personPhotoDir)) {
      mkdirSync(personPhotoDir, { recursive: true });
    }

    const localPhotoPaths = [];

    for (let i = 0; i < individual.photos.length; i++) {
      const photo = individual.photos[i];

      try {
        const localPath = await downloadPhoto(photo.url, personPhotoDir, i, photo.title);
        if (localPath) {
          localPhotoPaths.push(localPath);
          downloadedPhotos++;
          console.log(`✓ Downloaded photo for ${individual.fullName} (${i + 1}/${individual.photos.length})`);
        } else {
          failedPhotos++;
        }
      } catch (error) {
        console.error(`✗ Failed to download photo for ${individual.fullName}:`, error.message);
        failedPhotos++;
      }
    }

    if (localPhotoPaths.length > 0) {
      photoMap.set(gedcomId, localPhotoPaths);
    }
  }

  console.log(`\nPhoto download summary:`);
  console.log(`  Total: ${totalPhotos}`);
  console.log(`  Downloaded: ${downloadedPhotos}`);
  console.log(`  Failed: ${failedPhotos}`);

  return photoMap;
}

/**
 * Download a single photo
 * @param {string} url - Photo URL
 * @param {string} outputDir - Output directory
 * @param {number} index - Photo index
 * @param {string|null} title - Photo title
 * @returns {Promise<string|null>} Local file path or null if failed
 */
async function downloadPhoto(url, outputDir, index, title) {
  if (!url) return null;

  try {
    // Extract file extension from URL
    const urlParts = url.split('.');
    const ext = urlParts[urlParts.length - 1].split('?')[0] || 'jpg';

    // Generate filename
    const fileName = title
      ? sanitizeFileName(title) + '.' + ext
      : `photo_${index + 1}.${ext}`;

    const outputPath = join(outputDir, fileName);

    // Skip if already exists
    if (existsSync(outputPath)) {
      return outputPath;
    }

    // Download photo
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    });

    // Save to file
    const writer = createWriteStream(outputPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(outputPath));
      writer.on('error', reject);
    });

  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.warn(`  Photo not found (404): ${url}`);
    } else {
      console.warn(`  Error downloading photo:`, error.message);
    }
    return null;
  }
}

/**
 * Sanitize filename
 */
function sanitizeFileName(fileName) {
  return fileName
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

/**
 * Get relative path from Obsidian vault root
 */
export function getRelativePhotoPath(absolutePath, vaultPath) {
  if (!absolutePath) return null;

  // Convert absolute path to relative path from vault root
  if (absolutePath.startsWith(vaultPath)) {
    return absolutePath.substring(vaultPath.length + 1);
  }

  return absolutePath;
}
