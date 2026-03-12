const W = 200;   // card width
const H = 256;   // card height
const SPOUSE_GAP = 40;
const SIBLING_GAP = 80;
const EX_GAP = 96;
const ROW_GAP = 96;
const EXPAND_BTN_W = 72;
const EXPAND_BTN_H = 40;
const EXPAND_BTN_OFFSET = 16; // gap between expand button bottom and card top

/**
 * Build a family graph centered on the selected person.
 * Custom layout: positions computed manually to match Figma design.
 */
export function buildFamilyGraph(familyData, selectedPersonName) {
  const people = familyData.people;
  const selected = people[selectedPersonName];
  if (!selected) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  const addedIds = new Set();

  // --- Collect relatives ---
  const siblings = (selected.siblings || []).filter(n => people[n]);
  const partner = selected.partner && people[selected.partner] ? selected.partner : null;
  const exPartners = (selected.exPartners || []).filter(n => people[n]);
  const parents = (selected.parents || []).filter(n => people[n]);
  const children = (selected.children || []).filter(n => people[n]);

  // Determine which children belong to partner vs ex-partners
  const partnerChildren = [];
  const exChildrenMap = new Map(); // exName -> childNames[]

  if (children.length > 0) {
    exPartners.forEach(exName => {
      const exKids = children.filter(childName => {
        const child = people[childName];
        return child && child.parents && child.parents.includes(exName);
      });
      if (exKids.length > 0) {
        exChildrenMap.set(exName, exKids);
      }
    });

    const exChildrenSet = new Set();
    exChildrenMap.forEach(kids => kids.forEach(k => exChildrenSet.add(k)));
    children.forEach(c => {
      if (!exChildrenSet.has(c)) partnerChildren.push(c);
    });
  }

  // =============================================
  // ROW 0: Selected + siblings + partner + ex-partners
  // =============================================
  const row0Y = 0;

  const selectedPos = { x: 0, y: row0Y };
  addPersonNode(selected, selectedPersonName, selectedPos, true);

  // Siblings to the LEFT of selected
  const siblingPositions = new Map();
  siblings.forEach((sibName, i) => {
    const x = -(i + 1) * (W + SIBLING_GAP);
    const pos = { x, y: row0Y };
    siblingPositions.set(sibName, pos);
    addPersonNode(people[sibName], sibName, pos, false);
  });

  // Partner to the RIGHT of selected
  let partnerPos = null;
  if (partner) {
    partnerPos = { x: W + SPOUSE_GAP, y: row0Y };
    addPersonNode(people[partner], partner, partnerPos, false);
  }

  // Ex-partners further RIGHT
  const exPositions = new Map();
  let exStartX = partner ? W + SPOUSE_GAP + W + EX_GAP : W + SPOUSE_GAP + EX_GAP;
  exPartners.forEach((exName, i) => {
    const x = exStartX + i * (W + EX_GAP);
    const pos = { x, y: row0Y };
    exPositions.set(exName, pos);
    addPersonNode(people[exName], exName, pos, false);
  });

  // =============================================
  // SPOUSE EDGES
  // =============================================
  if (partner) {
    const spouseY = row0Y + H / 2;
    edges.push({
      id: `spouse-selected-partner`,
      source: selected.id,
      target: people[partner].id,
      type: 'family',
      data: {
        edgeType: 'spouse',
        sourceX: selectedPos.x + W,
        sourceY: spouseY,
        targetX: partnerPos.x,
        targetY: spouseY,
      },
    });
  }

  exPartners.forEach(exName => {
    const exPos = exPositions.get(exName);
    const exSpouseY = row0Y + H / 2 + 8;
    edges.push({
      id: `exspouse-${people[exName].id}`,
      source: selected.id,
      target: people[exName].id,
      type: 'family',
      data: {
        edgeType: 'exSpouse',
        sourceX: selectedPos.x + W,
        sourceY: exSpouseY,
        targetX: exPos.x,
        targetY: exSpouseY,
      },
    });
  });

  // =============================================
  // ROW -1: Parents
  // =============================================
  const row1Y = -(H + ROW_GAP);
  let parentMidX = null; // couple midpoint X (used for tree branch)

  if (parents.length > 0) {
    // Center parents above the span from leftmost sibling to selected
    const leftmostX = siblings.length > 0
      ? -(siblings.length) * (W + SIBLING_GAP)
      : 0;
    const spanCenter = (leftmostX + W) / 2;

    if (parents.length === 2) {
      const p1x = spanCenter - W - SPOUSE_GAP / 2;
      const p2x = spanCenter + SPOUSE_GAP / 2;
      const p1Pos = { x: p1x, y: row1Y };
      const p2Pos = { x: p2x, y: row1Y };
      addPersonNode(people[parents[0]], parents[0], p1Pos, false);
      addPersonNode(people[parents[1]], parents[1], p2Pos, false);

      parentMidX = p1Pos.x + W + SPOUSE_GAP / 2;

      // Spouse edge between parents
      edges.push({
        id: `spouse-parents`,
        source: people[parents[0]].id,
        target: people[parents[1]].id,
        type: 'family',
        data: {
          edgeType: 'spouse',
          sourceX: p1Pos.x + W,
          sourceY: row1Y + H / 2,
          targetX: p2Pos.x,
          targetY: row1Y + H / 2,
        },
      });
    } else if (parents.length === 1) {
      const pPos = { x: spanCenter - W / 2, y: row1Y };
      addPersonNode(people[parents[0]], parents[0], pPos, false);
      parentMidX = pPos.x + W / 2;
    }

    // Tree branch: parents → row 0 children (selected + siblings)
    // Trunk starts from spouse connector level (vertical midpoint of parent cards)
    const allRow0Children = [selectedPersonName, ...siblings];
    const childrenXs = allRow0Children
      .map(name => {
        const pos = name === selectedPersonName ? selectedPos : siblingPositions.get(name);
        return pos ? pos.x + W / 2 : null;
      })
      .filter(x => x !== null);

    if (childrenXs.length > 0 && parentMidX !== null) {
      edges.push({
        id: `tree-parents-to-row0`,
        source: people[parents[0]].id,
        target: selected.id,
        type: 'family',
        data: {
          edgeType: 'treeBranch',
          trunkX: parentMidX,
          trunkTopY: row1Y + H / 2,
          railY: row1Y + H + 20, // 20px below parent cards bottom
          childrenXs,
          childrenTopY: row0Y,
        },
      });
    }
  }

  // =============================================
  // ROW -2: Grandparents (with overlap prevention)
  // =============================================
  const row2Y = -(H + ROW_GAP) * 2;
  const GP_MIN_GAP = 80; // minimum gap between two grandparent groups

  // First pass: compute ideal positions for each GP group
  const gpGroups = [];
  parents.forEach(parentName => {
    const parent = people[parentName];
    if (!parent || !parent.parents) return;
    const gps = parent.parents.filter(n => people[n]);
    if (gps.length === 0) return;

    const parentNode = nodes.find(n => n.id === parent.id);
    if (!parentNode) return;
    const parentCenterX = parentNode.position.x + W / 2;

    if (gps.length === 2) {
      const idealLeft = parentCenterX - W - SPOUSE_GAP / 2;
      gpGroups.push({
        parentName, parent, gps, parentCenterX,
        count: 2,
        left: idealLeft,
        right: idealLeft + 2 * W + SPOUSE_GAP,
      });
    } else if (gps.length === 1) {
      const idealLeft = parentCenterX - W / 2;
      gpGroups.push({
        parentName, parent, gps, parentCenterX,
        count: 1,
        left: idealLeft,
        right: idealLeft + W,
      });
    }
  });

  // Second pass: resolve overlaps between GP groups
  if (gpGroups.length === 2) {
    // Sort by ideal left position
    gpGroups.sort((a, b) => a.left - b.left);
    const [leftGroup, rightGroup] = gpGroups;

    const overlap = leftGroup.right + GP_MIN_GAP - rightGroup.left;
    if (overlap > 0) {
      // Push groups apart equally
      const shift = overlap / 2;
      leftGroup.left -= shift;
      leftGroup.right -= shift;
      rightGroup.left += shift;
      rightGroup.right += shift;
    }
  }

  // Third pass: create nodes and edges for each GP group
  gpGroups.forEach(group => {
    const { parent, gps, parentCenterX } = group;

    if (group.count === 2) {
      const gp1x = group.left;
      const gp2x = group.left + W + SPOUSE_GAP;
      addPersonNode(people[gps[0]], gps[0], { x: gp1x, y: row2Y }, false);
      addPersonNode(people[gps[1]], gps[1], { x: gp2x, y: row2Y }, false);

      const gpMidX = gp1x + W + SPOUSE_GAP / 2;

      // Spouse edge between grandparents
      edges.push({
        id: `spouse-gp-${parent.id}`,
        source: people[gps[0]].id,
        target: people[gps[1]].id,
        type: 'family',
        data: {
          edgeType: 'spouse',
          sourceX: gp1x + W,
          sourceY: row2Y + H / 2,
          targetX: gp2x,
          targetY: row2Y + H / 2,
        },
      });

      // L-bend: from grandparent midpoint down to parent center
      edges.push({
        id: `lbend-gp-${parent.id}`,
        source: people[gps[0]].id,
        target: parent.id,
        type: 'family',
        data: {
          edgeType: 'lBend',
          sourceX: gpMidX,
          sourceY: row2Y + H / 2,
          railY: row2Y + H + 20,
          targetX: parentCenterX,
          targetY: row1Y,
        },
      });
    } else if (group.count === 1) {
      const gpX = group.left;
      const gpCenterX = gpX + W / 2;
      addPersonNode(people[gps[0]], gps[0], { x: gpX, y: row2Y }, false);

      edges.push({
        id: `lbend-gp-${parent.id}`,
        source: people[gps[0]].id,
        target: parent.id,
        type: 'family',
        data: {
          edgeType: 'lBend',
          sourceX: gpCenterX,
          sourceY: row2Y + H / 2,
          railY: row2Y + H + 20,
          targetX: parentCenterX,
          targetY: row1Y,
        },
      });
    }
  });

  // =============================================
  // ROW +1: Children (with overlap prevention)
  // =============================================
  const row3Y = H + ROW_GAP;
  const CHILDREN_MIN_GAP = 80; // minimum gap between child groups

  // Build child groups: partner children first, then each ex-partner's children
  const childGroups = [];

  if (partnerChildren.length > 0) {
    const trunkX = partner ? selectedPos.x + W + SPOUSE_GAP / 2 : selectedPos.x + W / 2;
    const totalW = partnerChildren.length * W + (partnerChildren.length - 1) * SIBLING_GAP;
    // When there are ex-children too, align partner children so the right edge
    // is at the trunk — keeps the sub-tree clearly to the left of the ex sub-tree
    const hasExChildren = exChildrenMap.size > 0;
    const idealLeft = hasExChildren ? trunkX - totalW : trunkX - totalW / 2;
    childGroups.push({
      names: partnerChildren,
      edgeType: 'treeBranch',
      edgeId: 'tree-selected-to-children',
      trunkX,
      trunkTopY: row0Y + H / 2,
      left: idealLeft,
      right: idealLeft + totalW,
    });
  }

  exChildrenMap.forEach((exKids, exName) => {
    const exPos = exPositions.get(exName);
    if (!exPos) return;
    const trunkX = exPos.x - EX_GAP / 2;
    const totalW = exKids.length * W + (exKids.length - 1) * SIBLING_GAP;
    // Align ex-children so the left edge is at the trunk
    const idealLeft = trunkX;
    childGroups.push({
      names: exKids,
      edgeType: 'exTreeBranch',
      edgeId: `tree-ex-${people[exName].id}-to-children`,
      trunkX,
      trunkTopY: row0Y + H / 2 + 8,
      left: idealLeft,
      right: idealLeft + totalW,
    });
  });

  // Resolve overlaps between adjacent child groups (left to right)
  if (childGroups.length > 1) {
    childGroups.sort((a, b) => a.left - b.left);
    for (let i = 1; i < childGroups.length; i++) {
      const prev = childGroups[i - 1];
      const curr = childGroups[i];
      const overlap = prev.right + CHILDREN_MIN_GAP - curr.left;
      if (overlap > 0) {
        // Push current group to the right
        curr.left += overlap;
        curr.right += overlap;
      }
    }
  }

  // Create nodes and edges for each child group
  childGroups.forEach(group => {
    const childrenXs = [];
    group.names.forEach((childName, i) => {
      const child = people[childName];
      if (!child) return;
      const cx = group.left + i * (W + SIBLING_GAP);
      addPersonNode(child, childName, { x: cx, y: row3Y }, false);
      childrenXs.push(cx + W / 2);
    });

    if (childrenXs.length > 0) {
      edges.push({
        id: group.edgeId,
        source: selected.id,
        target: people[group.names[0]].id,
        type: 'family',
        data: {
          edgeType: group.edgeType,
          trunkX: group.trunkX,
          trunkTopY: group.trunkTopY,
          railY: row0Y + H + 20,
          childrenXs,
          childrenTopY: row3Y,
        },
      });
    }
  });

  // =============================================
  // EXPAND BUTTONS + TICKS
  // =============================================
  const expandBtnY = row0Y - EXPAND_BTN_H - EXPAND_BTN_OFFSET;

  function addExpandButton(personName, pos) {
    const person = people[personName];
    if (!person) return;
    // Right-align button with card's right edge
    const btnX = pos.x + W - EXPAND_BTN_W;
    const btnCenterX = btnX + EXPAND_BTN_W / 2;

    nodes.push({
      id: `expand-${person.id}`,
      type: 'expandButton',
      position: { x: btnX, y: expandBtnY },
      data: { targetPerson: personName },
    });

    // Small blue tick from expand button bottom to card top
    // 4px gap below button, 8px tick, 4px gap above card
    edges.push({
      id: `tick-${person.id}`,
      source: `expand-${person.id}`,
      target: person.id,
      type: 'family',
      data: {
        edgeType: 'expandTick',
        sourceX: btnCenterX,
        sourceY: expandBtnY + EXPAND_BTN_H + 4,
        targetY: row0Y - 4,
      },
    });
  }

  // Partner: show if they have parents
  if (partner && people[partner].parents && people[partner].parents.length > 0) {
    addExpandButton(partner, partnerPos);
  }

  // Ex-partners: show if they have parents
  exPartners.forEach(exName => {
    const ex = people[exName];
    const exPos = exPositions.get(exName);
    if (ex.parents && ex.parents.length > 0 && exPos) {
      addExpandButton(exName, exPos);
    }
  });

  // Siblings: show if they have children or partner
  siblings.forEach(sibName => {
    const sib = people[sibName];
    const sibPos = siblingPositions.get(sibName);
    const hasMore = (sib.children && sib.children.length > 0) ||
                    (sib.partner && people[sib.partner]) ||
                    (sib.exPartners && sib.exPartners.length > 0);
    if (hasMore && sibPos) {
      addExpandButton(sibName, sibPos);
    }
  });

  return { nodes, edges };

  function addPersonNode(person, personName, pos, isSelected) {
    if (!person || addedIds.has(person.id)) return;
    addedIds.add(person.id);
    nodes.push({
      id: person.id,
      type: 'person',
      position: { x: pos.x, y: pos.y },
      data: { person, isSelected },
    });
  }
}
