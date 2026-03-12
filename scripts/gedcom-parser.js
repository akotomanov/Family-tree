import { readFileSync } from 'fs';

/**
 * Simple GEDCOM parser - lenient version
 * Parse GEDCOM file and extract individuals and families
 * @param {string} gedcomPath - Path to the GEDCOM file
 * @returns {{individuals: Map, families: Map}}
 */
export function parseGEDCOM(gedcomPath) {
  console.log('Reading GEDCOM file...');
  const gedcomContent = readFileSync(gedcomPath, 'utf-8');

  console.log('Parsing GEDCOM data...');
  const lines = gedcomContent.split('\n');

  const individuals = new Map();
  const families = new Map();

  let currentRecord = null;
  let currentTag = null;
  let currentSubTag = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse line: "LEVEL TAG VALUE" or "LEVEL @ID@ TAG"
    const match = line.match(/^(\d+)\s+(@[^@]+@\s+)?([A-Z_]+)(\s+(.*))?$/);
    if (!match) continue; // Skip malformed lines

    const level = parseInt(match[1]);
    const id = match[2]?.trim();
    const tag = match[3];
    const value = match[5] || '';

    if (level === 0) {
      // Save previous record
      if (currentRecord && currentRecord.tag === 'INDI') {
        individuals.set(currentRecord.id, parseIndividual(currentRecord));
      } else if (currentRecord && currentRecord.tag === 'FAM') {
        families.set(currentRecord.id, parseFamily(currentRecord));
      }

      // Start new record
      currentRecord = {
        id: id,
        tag: tag,
        data: {}
      };
      currentTag = null;
      currentSubTag = null;
    } else if (level === 1 && currentRecord) {
      currentTag = tag;
      currentSubTag = null;

      if (!currentRecord.data[tag]) {
        currentRecord.data[tag] = [];
      }

      currentRecord.data[tag].push({ value, sub: {} });
    } else if (level === 2 && currentTag && currentRecord) {
      const tagArray = currentRecord.data[currentTag];
      if (tagArray && tagArray.length > 0) {
        const lastItem = tagArray[tagArray.length - 1];
        if (!lastItem.sub[tag]) {
          lastItem.sub[tag] = [];
        }
        lastItem.sub[tag].push(value);
      }
    }
  }

  // Save last record
  if (currentRecord && currentRecord.tag === 'INDI') {
    individuals.set(currentRecord.id, parseIndividual(currentRecord));
  } else if (currentRecord && currentRecord.tag === 'FAM') {
    families.set(currentRecord.id, parseFamily(currentRecord));
  }

  console.log(`Extracted ${individuals.size} individuals and ${families.size} families`);

  return { individuals, families };
}

/**
 * Parse an individual record
 */
function parseIndividual(record) {
  const individual = {
    id: record.id,
    givenName: '',
    surname: '',
    fullName: '',
    sex: null,
    birthDate: null,
    birthPlace: null,
    deathDate: null,
    deathPlace: null,
    photos: [],
    familiesAsSpouse: [],
    familyAsChild: null
  };

  // Name
  if (record.data.NAME) {
    const nameValue = record.data.NAME[0]?.value || '';
    const nameParts = parseName(nameValue);
    individual.givenName = nameParts.given;
    individual.surname = nameParts.surname;
    individual.fullName = nameParts.full;
  }

  // Sex
  if (record.data.SEX) {
    individual.sex = record.data.SEX[0]?.value || null;
  }

  // Birth
  if (record.data.BIRT) {
    const birth = record.data.BIRT[0];
    if (birth.sub.DATE) {
      individual.birthDate = parseDate(birth.sub.DATE[0]);
    }
    if (birth.sub.PLAC) {
      individual.birthPlace = birth.sub.PLAC[0];
    }
  }

  // Death
  if (record.data.DEAT) {
    const death = record.data.DEAT[0];
    if (death.sub.DATE) {
      individual.deathDate = parseDate(death.sub.DATE[0]);
    }
    if (death.sub.PLAC) {
      individual.deathPlace = death.sub.PLAC[0];
    }
  }

  // Photos
  if (record.data.OBJE) {
    record.data.OBJE.forEach(obj => {
      const url = obj.sub.FILE?.[0];
      const title = obj.sub.TITL?.[0];
      if (url) {
        individual.photos.push({ url, title });
      }
    });
  }

  // Families as spouse
  if (record.data.FAMS) {
    record.data.FAMS.forEach(fam => {
      if (fam.value) {
        individual.familiesAsSpouse.push(fam.value);
      }
    });
  }

  // Family as child
  if (record.data.FAMC) {
    individual.familyAsChild = record.data.FAMC[0]?.value || null;
  }

  return individual;
}

/**
 * Parse a family record
 */
function parseFamily(record) {
  const family = {
    id: record.id,
    husbandId: null,
    wifeId: null,
    childrenIds: [],
    marriageDate: null,
    marriagePlace: null,
    divorced: false,
    divorceDate: null
  };

  // Husband
  if (record.data.HUSB) {
    family.husbandId = record.data.HUSB[0]?.value || null;
  }

  // Wife
  if (record.data.WIFE) {
    family.wifeId = record.data.WIFE[0]?.value || null;
  }

  // Children
  if (record.data.CHIL) {
    record.data.CHIL.forEach(child => {
      if (child.value) {
        family.childrenIds.push(child.value);
      }
    });
  }

  // Marriage
  if (record.data.MARR) {
    const marriage = record.data.MARR[0];
    if (marriage.sub.DATE) {
      family.marriageDate = parseDate(marriage.sub.DATE[0]);
    }
    if (marriage.sub.PLAC) {
      family.marriagePlace = marriage.sub.PLAC[0];
    }
  }

  // Divorce
  if (record.data.DIV) {
    family.divorced = true;
    const divorce = record.data.DIV[0];
    if (divorce.sub.DATE) {
      family.divorceDate = parseDate(divorce.sub.DATE[0]);
    }
  }

  return family;
}

/**
 * Parse NAME field: "Given /Surname/"
 */
function parseName(nameStr) {
  if (!nameStr) return { given: '', surname: '', full: '' };

  const surnameMatch = nameStr.match(/\/(.*?)\//);
  const surname = surnameMatch ? surnameMatch[1] : '';
  const given = nameStr.replace(/\/.*?\//, '').trim();
  const full = given + (surname ? ' ' + surname : '');

  return { given, surname, full };
}

/**
 * Parse date field to YYYY-MM-DD format
 */
function parseDate(dateStr) {
  if (!dateStr) return null;

  // GEDCOM dates are often like: "22 MAY 1960" or "1960"
  const months = {
    'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
    'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
    'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
  };

  const parts = dateStr.trim().split(/\s+/);

  if (parts.length === 3) {
    // "22 MAY 1960"
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1].toUpperCase()] || '01';
    const year = parts[2];
    return `${year}-${month}-${day}`;
  } else if (parts.length === 2) {
    // "MAY 1960"
    const month = months[parts[0].toUpperCase()] || '01';
    const year = parts[1];
    return `${year}-${month}-01`;
  } else if (parts.length === 1) {
    // "1960"
    return `${parts[0]}-01-01`;
  }

  return dateStr;
}
