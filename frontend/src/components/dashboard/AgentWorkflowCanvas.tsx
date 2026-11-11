import React, { useCallback, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge,
  Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Plus, Save } from 'lucide-react';

interface AgentWorkflowCanvasProps {
  agentName: string;
  initialGraph?: { nodes?: Node[]; edges?: Edge[] };
  onSaveGraph: (graph: { nodes: Node[]; edges: Edge[] }) => Promise<void>;
}

const DEFAULT_NODES: Node[] = [
  { id: '1', position: { x: 40, y: 80 }, data: { label: '1. Greeting & Recording Disclosure' }, type: 'input' },
  { id: '2', position: { x: 300, y: 80 }, data: { label: '2. Discovery Questions' } },
  { id: '3', position: { x: 560, y: 30 }, data: { label: '3a. Knowledge Base RAG Lookup' } },
  { id: '4', position: { x: 560, y: 140 }, data: { label: '3b. Execute Action (Calendar / WhatsApp)' } },
  { id: '5', position: { x: 840, y: 80 }, data: { label: '4. Qualification & Polite Closing' }, type: 'output' },
];

const DEFAULT_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', animated: true },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-5', source: '3', target: '5' },
  { id: 'e4-5', source: '4', target: '5' },
];

export const AgentWorkflowCanvas: React.FC<AgentWorkflowCanvasProps> = ({
  agentName,
  initialGraph,
  onSaveGraph,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialGraph?.nodes && initialGraph.nodes.length > 0 ? initialGraph.nodes : DEFAULT_NODES
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialGraph?.edges && initialGraph.edges.length > 0 ? initialGraph.edges : DEFAULT_EDGES
  );
  const [newNodeLabel, setNewNodeLabel] = useState('');
  const [saving, setSaving] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const handleAddNode = () => {
    if (!newNodeLabel.trim()) return;
    const id = `node_${Date.now()}`;
    setNodes((nds) => [
      ...nds,
      {
        id,
        position: { x: 160 + (nds.length % 4) * 140, y: 230 },
        data: { label: newNodeLabel.trim() },
      },
    ]);
    setNewNodeLabel('');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveGraph({ nodes, edges });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-bold text-slate-800">
          Visual Call Flow for {agentName}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={newNodeLabel}
            onChange={(e) => setNewNodeLabel(e.target.value)}
            placeholder="New step (e.g., Check DNC)"
            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs"
          />
          <button
            type="button"
            onClick={handleAddNode}
            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Step
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 rounded-xl bg-orange-600 text-white font-bold flex items-center gap-1 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> {saving ? 'Saving...' : 'Save Flow'}
          </button>
        </div>
      </div>

      <div className="h-80 w-full rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
};

