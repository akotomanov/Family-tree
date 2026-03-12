import { memo } from 'react';

/**
 * Custom edge component that draws orthogonal SVG paths.
 *
 * Edge types:
 * - spouse:        horizontal line between partners (blue, solid)
 * - exSpouse:      horizontal line to ex-partner (grey, dashed)
 * - treeBranch:    trunk down from couple midpoint, horizontal rail, vertical drops to children (blue)
 * - exTreeBranch:  same shape but grey, for ex-partner children
 * - lBend:         L-shaped connector from grandparent midpoint to parent (blue)
 * - expandTick:    small vertical tick connecting expand button to card below
 */
const FamilyEdge = memo(({
  id,
  sourceX: _sx,
  sourceY: _sy,
  targetX: _tx,
  targetY: _ty,
  data = {},
}) => {
  const edgeType = data.edgeType || 'treeBranch';
  const isEx = edgeType === 'exSpouse' || edgeType === 'exTreeBranch';

  const stroke = isEx ? '#DCDCDC' : '#7398FF';
  const strokeDasharray = edgeType === 'exSpouse' ? '4 8' : undefined;
  const strokeWidth = 2;

  let pathD;

  switch (edgeType) {
    case 'spouse':
    case 'exSpouse': {
      // Simple horizontal line
      const sx = data.sourceX ?? _sx;
      const sy = data.sourceY ?? _sy;
      const tx = data.targetX ?? _tx;
      const ty = data.targetY ?? _ty;
      pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
      break;
    }

    case 'treeBranch':
    case 'exTreeBranch': {
      // Tree-shaped connector: trunk down → horizontal rail → vertical drops to each child
      // data.trunkX, data.trunkTopY: start of trunk (couple midpoint, at spouse connector level)
      // data.childrenXs: array of child center X coordinates
      // data.childrenTopY: Y of children card tops
      const { trunkX, trunkTopY, childrenXs, childrenTopY, railY: explicitRailY } = data;
      if (!childrenXs || childrenXs.length === 0) break;

      // Use explicit railY (20px below parent cards) or fall back to midpoint
      const railY = explicitRailY ?? (trunkTopY + (childrenTopY - trunkTopY) / 2);
      const sorted = [...childrenXs].sort((a, b) => a - b);
      const minX = sorted[0];
      const maxX = sorted[sorted.length - 1];

      // Trunk: down from couple midpoint to rail
      let d = `M ${trunkX} ${trunkTopY} V ${railY}`;

      // Rail: continuous line from trunk, left to minX, then right to maxX
      // This ensures the trunk endpoint connects to the rail
      d += ` H ${minX}`;
      d += ` M ${trunkX} ${railY} H ${maxX}`;

      // Drops: vertical line from rail down to each child's top center
      sorted.forEach(cx => {
        d += ` M ${cx} ${railY} V ${childrenTopY}`;
      });

      pathD = d;
      break;
    }

    case 'lBend': {
      // L-shaped: from grandparent couple midpoint down, horizontal to parent center, down to parent top
      // data.sourceX, sourceY: grandparent midpoint (at spouse connector level)
      // data.targetX, targetY: parent card top center
      // data.railY: explicit Y for the horizontal segment (20px below source cards)
      const sx = data.sourceX ?? _sx;
      const sy = data.sourceY ?? _sy;
      const tx = data.targetX ?? _tx;
      const ty = data.targetY ?? _ty;
      const midY = data.railY ?? (sy + (ty - sy) / 2);
      pathD = `M ${sx} ${sy} V ${midY} H ${tx} V ${ty}`;
      break;
    }

    case 'expandTick': {
      // Small vertical line connecting expand button to card
      const sx = data.sourceX ?? _sx;
      const sy = data.sourceY ?? _sy;
      const ty = data.targetY ?? _ty;
      pathD = `M ${sx} ${sy} V ${ty}`;
      break;
    }

    default:
      return null;
  }

  if (!pathD) return null;

  return (
    <g>
      <path
        id={id}
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
      />
    </g>
  );
});

FamilyEdge.displayName = 'FamilyEdge';

export default FamilyEdge;
