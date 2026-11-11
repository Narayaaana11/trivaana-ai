import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Workflow } from 'lucide-react';
import { platformService } from '@/services/platformService';
import { AgentWorkflowCanvas } from './AgentWorkflowCanvas';

export const WorkflowsPanel: React.FC = () => {
  const qc = useQueryClient();
  const [name, setName] = useState('Inbound Lead Qualification Flow');
  const [triggerType, setTriggerType] = useState('call_completed');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['workflows'],
    queryFn: () => platformService.listWorkflows(),
  });

  const workflows = data?.workflows || [];
  const activeWf = workflows.find((w: any) => w.id === selectedId) || workflows[0];

  const saveMut = useMutation({
    mutationFn: async (graph: any) => {
      if (activeWf) {
        return platformService.updateWorkflow(activeWf.id, {
          name: activeWf.name,
          trigger_type: activeWf.trigger_type,
          graph,
        });
      }
      return platformService.createWorkflow({ name, trigger_type: triggerType, graph });
    },
    onSuccess: (res: any) => {
      setFeedback(`Workflow saved (${res.workflow_id || activeWf?.id}).`);
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  const execMut = useMutation({
    mutationFn: (id: string) =>
      platformService.executeWorkflow(id, { trigger_event: 'manual_test', context: { source: 'studio' } }),
    onSuccess: (res: any) => {
      setFeedback(`Execution ${res.execution_id} (${res.mode}): ${res.status}, ${res.steps_executed} steps.`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 mb-1">
            <Workflow className="w-4 h-4" />
            <span>Visual Workflow Builder (React Flow + Temporal Durable Execution)</span>
          </div>
          <h1 className="font-display text-2xl font-extrabold text-slate-900">Automation Workflows</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200"
            placeholder="Workflow Name"
          />
          <select
            value={triggerType}
            onChange={(e) => setTriggerType(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white"
          >
            <option value="call_completed">On Call Completed</option>
            <option value="lead_created">On Lead Created</option>
            <option value="appointment_booked">On Appointment Booked</option>
          </select>
          {activeWf && (
            <button
              type="button"
              onClick={() => execMut.mutate(activeWf.id)}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" /> Run Workflow
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-medium">{feedback}</div>
      )}

      {workflows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {workflows.map((wf: any) => (
            <button
              key={wf.id}
              type="button"
              onClick={() => setSelectedId(wf.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border cursor-pointer ${
                activeWf?.id === wf.id
                  ? 'bg-orange-600 text-white border-orange-600'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              {wf.name} ({wf.trigger_type})
            </button>
          ))}
        </div>
      )}

      <AgentWorkflowCanvas
        agentName={activeWf?.name || name}
        initialGraph={activeWf?.graph}
        onSaveGraph={async (graph) => {
          await saveMut.mutateAsync(graph);
        }}
      />
    </div>
  );
};

