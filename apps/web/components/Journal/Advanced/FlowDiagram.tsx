import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import 'reactflow/dist/base.css';

interface FlowDiagramProps {
  flowData: {
    nodes: Array<{
      id: string;
      label: string;
      type: string;
      data: Record<string, unknown>;
    }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      label?: string;
    }>;
  };
}

// Custom node styles
const nodeStyles = {
  emotion: {
    background: '#f0f9ff',
    border: '1px solid #3b82f6',
    borderRadius: '8px',
    padding: '10px',
    width: 150,
  },
  factor: {
    background: '#f0fdf4',
    border: '1px solid #22c55e',
    borderRadius: '8px',
    padding: '10px',
    width: 150,
  },
};

const FlowDiagramInner: React.FC<FlowDiagramProps> = ({ flowData }) => {
  // Safely initialize nodes with error handling
  const initialNodes: Node[] = useMemo(() => {
    if (!flowData?.nodes) return [];
    try {
      return flowData.nodes.map(node => ({
        id: node.id,
        data: { 
          label: node.label,
          ...node.data,
          style: nodeStyles[node.type as keyof typeof nodeStyles] || nodeStyles.emotion
        },
        position: { x: Math.random() * 500, y: Math.random() * 500 },
        type: 'default',
      }));
    } catch (error) {
      console.error('Error initializing nodes:', error);
      return [];
    }
  }, [flowData?.nodes]);

  // Safely initialize edges with error handling
  const initialEdges: Edge[] = useMemo(() => {
    if (!flowData?.edges) return [];
    try {
      return flowData.edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: true,
        style: { stroke: '#2563eb' },
        labelStyle: { fill: '#2563eb', fontWeight: 600 },
      }));
    } catch (error) {
      console.error('Error initializing edges:', error);
      return [];
    }
  }, [flowData?.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Reset nodes and edges when flowData changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onInit = useCallback((reactFlowInstance: ReactFlowInstance) => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView();
    }
  }, []);

  if (!flowData?.nodes?.length || !flowData?.edges?.length) {
    return <div className="flex items-center justify-center h-[500px]">No flow data available</div>;
  }

  return (
    <div style={{ height: 500, width: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        fitView
        attributionPosition="bottom-right"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};

// Wrap the component with ReactFlowProvider
const FlowDiagram: React.FC<FlowDiagramProps> = (props) => {
  return (
    <ReactFlowProvider>
      <FlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
};

export default FlowDiagram;