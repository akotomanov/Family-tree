import { useCallback, useEffect, useMemo, useRef } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import PersonNode from './PersonNode';
import ExpandButton from './ExpandButton';
import FamilyEdge from './FamilyEdge';
import { buildFamilyGraph } from '../utils/graphBuilder';

function FamilyTreeInner({ familyData, selectedPerson, onPersonClick, controlsRef }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const isFirstRender = useRef(true);
  const prevNodesRef = useRef([]);

  const nodeTypes = useMemo(() => ({
    person: PersonNode,
    expandButton: ExpandButton,
  }), []);

  const edgeTypes = useMemo(() => ({
    family: FamilyEdge,
  }), []);

  // Expose zoom controls to parent
  useEffect(() => {
    if (controlsRef) {
      controlsRef.current = {
        zoomIn,
        zoomOut,
        fitView,
        goHome: () => { isFirstRender.current = true; },
      };
    }
  }, [controlsRef, zoomIn, zoomOut, fitView]);

  // Rebuild graph when selected person changes
  useEffect(() => {
    if (!familyData || !selectedPerson) return;

    const selectedPersonData = familyData.people[selectedPerson];
    if (!selectedPersonData) return;

    // Build new graph (selected person at origin 0,0)
    const { nodes: newNodes, edges: newEdges } = buildFamilyGraph(
      familyData,
      selectedPerson
    );

    // On transitions (not first render), keep the selected person's card in place
    let offsetX = 0;
    let offsetY = 0;

    if (!isFirstRender.current && prevNodesRef.current.length > 0) {
      // Find where the newly selected person currently sits on canvas
      const existingNode = prevNodesRef.current.find(
        n => n.type === 'person' && n.data?.person?.id === selectedPersonData.id
      );
      if (existingNode) {
        // The new graph places selected at (0, 0)
        // Offset everything so selected stays at its old position
        offsetX = existingNode.position.x;
        offsetY = existingNode.position.y;
      }
    }

    // Apply offset to all nodes
    const offsetNodes = newNodes.map(node => ({
      ...node,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
    }));

    // Recompute edge coordinates with the same offset
    const offsetEdges = newEdges.map(edge => {
      if (!edge.data) return edge;
      const d = { ...edge.data };

      // Offset all X/Y coordinates stored in edge data
      if (d.sourceX != null) d.sourceX += offsetX;
      if (d.sourceY != null) d.sourceY += offsetY;
      if (d.targetX != null) d.targetX += offsetX;
      if (d.targetY != null) d.targetY += offsetY;
      if (d.trunkX != null) d.trunkX += offsetX;
      if (d.trunkTopY != null) d.trunkTopY += offsetY;
      if (d.railY != null) d.railY += offsetY;
      if (d.childrenTopY != null) d.childrenTopY += offsetY;
      if (d.childrenXs) d.childrenXs = d.childrenXs.map(x => x + offsetX);

      return { ...edge, data: d };
    });

    // Inject onClick handlers for expand buttons
    const nodesWithHandlers = offsetNodes.map(node => {
      if (node.type === 'expandButton' && node.data.targetPerson) {
        return {
          ...node,
          data: {
            ...node.data,
            onClick: (e) => {
              e.stopPropagation();
              onPersonClick(node.data.targetPerson);
            },
          },
        };
      }
      return node;
    });

    setNodes(nodesWithHandlers);
    setEdges(offsetEdges);

    // Store current nodes for next transition
    prevNodesRef.current = nodesWithHandlers;

    // Only fitView on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setTimeout(() => fitView({ padding: 0.15, duration: 300 }), 50);
    }
  }, [familyData, selectedPerson, setNodes, setEdges, fitView, onPersonClick]);

  const handleNodeClick = useCallback((_event, node) => {
    if (node.type === 'expandButton') return;
    const personName = node.data?.person?.name;
    if (personName) {
      onPersonClick(personName);
    }
  }, [onPersonClick]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      style={{ background: '#FAFAFA' }}
    />
  );
}

export default function FamilyTree({ familyData, selectedPerson, onPersonClick, controlsRef }) {
  return (
    <ReactFlowProvider>
      <FamilyTreeInner
        familyData={familyData}
        selectedPerson={selectedPerson}
        onPersonClick={onPersonClick}
        controlsRef={controlsRef}
      />
    </ReactFlowProvider>
  );
}
