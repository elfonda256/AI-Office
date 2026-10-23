'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Agent, AgentStatus } from '../types/agent';
import { TopBar } from '../components/TopBar';
import { AgentDetailDrawer } from '../components/AgentDetailDrawer';
import { OfficeSceneHandle } from '../components/OfficeScene';
import initialAgentsData from '../data/agents.json';
import { CheckCircle, AlertTriangle } from 'lucide-react';

// Dynamic import with SSR disabled
const OfficeScene = dynamic(
  () => import('../components/OfficeScene').then((mod) => mod.OfficeScene),
  { ssr: false }
);

export default function KantorAiPage() {
  const [agents, setAgents] = useState<Agent[]>(initialAgentsData as Agent[]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [hoveredAgent, setHoveredAgent] = useState<Agent | null>(null);
  const [isCalibrating, setIsCalibrating] = useState<boolean>(false);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);

  const sceneRef = useRef<OfficeSceneHandle | null>(null);

  // Sync with /api/agents on mount
  useEffect(() => {
    fetch('/api/agents')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          setAgents(data);
        }
      })
      .catch((err) => console.log('Using initial agents data', err));
  }, []);

  // Update selected agent if list changes
  useEffect(() => {
    if (selectedAgent) {
      const updated = agents.find((a) => a.id === selectedAgent.id);
      if (updated) setSelectedAgent(updated);
    }
  }, [agents, selectedAgent]);

  // Handle status update
  const handleUpdateStatus = async (agentId: string, newStatus: AgentStatus, newTask?: string) => {
    // 1. Optimistic UI update
    setAgents((prev) =>
      prev.map((a) => {
        if (a.id === agentId) {
          return {
            ...a,
            status: newStatus,
            task: newTask || a.task,
            recentActivity: [
              `Status diubah ke ${newStatus.toUpperCase()}: ${newTask || a.task}`,
              ...a.recentActivity.slice(0, 4),
            ],
          };
        }
        return a;
      })
    );

    // 2. Notify Phaser
    if (sceneRef.current) {
      sceneRef.current.updateAgentStatus(agentId, newStatus, newTask);
    }

    // 3. Persist to API / SQLite
    try {
      await fetch('/api/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, status: newStatus, task: newTask }),
      });
    } catch (e) {
      console.error('Failed to persist status change', e);
    }
  };

  const handleAssignAiTask = async (agentId: string, task: string) => {
    // 1. Optimistic set to 'kerja'
    handleUpdateStatus(agentId, 'kerja', task);

    // 2. Call backend Gemini AI endpoint
    try {
      const res = await fetch('/api/agents/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: agentId, task }),
      });

      const data = await res.json();
      if (res.ok && data.agent) {
        setAgents((prev) => prev.map((a) => (a.id === agentId ? data.agent : a)));
        setSelectedAgent(data.agent);
        if (sceneRef.current) {
          sceneRef.current.updateAgentStatus(agentId, data.agent.status, data.agent.task);
        }
      } else {
        alert(data.error || 'Gagal memproses tugas AI');
      }
    } catch (err: any) {
      console.error('Failed to trigger AI task', err);
      alert('Gagal menghubungi server AI: ' + err.message);
    }
  };

  const handleFocusAgent = (agentId: string) => {
    const target = agents.find((a) => a.id === agentId);
    if (target) {
      setSelectedAgent(target);
      if (sceneRef.current) {
        sceneRef.current.focusAgent(agentId);
      }
    }
  };

  // Calibration: Save positions
  const handleSavePositions = async () => {
    if (!sceneRef.current) return;
    const positions = sceneRef.current.getPositions();

    try {
      const res = await fetch('/api/agents/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.agents) setAgents(data.agents);
        setIsCalibrating(false);
        setSaveNotification('✅ Posisi karakter berhasil disimpan ke src/data/agents.json!');
        setTimeout(() => setSaveNotification(null), 4000);
      }
    } catch (err) {
      console.error('Error saving positions', err);
    }
  };

  return (
    <main
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0b1530',
        overflow: 'hidden',
      }}
    >
      {/* Top Header & Legend */}
      <TopBar
        agents={agents}
        isCalibrating={isCalibrating}
        onToggleCalibration={() => setIsCalibrating(true)}
        onSavePositions={handleSavePositions}
        onCancelCalibration={() => setIsCalibrating(false)}
        onZoomIn={() => sceneRef.current?.zoomIn()}
        onZoomOut={() => sceneRef.current?.zoomOut()}
        onResetCamera={() => sceneRef.current?.resetCamera()}
        onSelectAgent={(agent) => handleFocusAgent(agent.id)}
      />

      {/* Mode Kalibrasi Banner */}
      {isCalibrating && (
        <div
          style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            background: 'rgba(245, 158, 11, 0.95)',
            color: '#0f172a',
            padding: '8px 18px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 12,
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
            maxWidth: '92vw',
            textAlign: 'center',
          }}
        >
          <AlertTriangle size={16} />
          <span>
            Mode Atur Posisi Aktif: Drag karakter ke posisi meja yang pas di gambar. Klik tombol hijau &ldquo;Simpan Posisi&rdquo; jika sudah selesai.
          </span>
        </div>
      )}

      {/* Notification Toast */}
      {saveNotification && (
        <div
          style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 45,
            background: 'rgba(16, 185, 129, 0.95)',
            color: '#ffffff',
            padding: '8px 20px',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 700,
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
          }}
        >
          <CheckCircle size={16} />
          <span>{saveNotification}</span>
        </div>
      )}

      {/* Phaser Canvas (Kantor AI Scene) */}
      <OfficeScene
        ref={sceneRef}
        agents={agents}
        isCalibrating={isCalibrating}
        onSelectAgent={(agent) => {
          setSelectedAgent(agent);
          sceneRef.current?.focusAgent(agent.id);
        }}
        onHoverAgent={(agent) => setHoveredAgent(agent)}
        onPositionChange={(id, x, y) => {
          setAgents((prev) =>
            prev.map((a) => (a.id === id ? { ...a, x, y } : a))
          );
        }}
      />

      {/* Bottom Floating Bar: Quick Agent Roster */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          pointerEvents: 'none',
          zIndex: 35,
          maxWidth: '94vw',
        }}
      >
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 14px',
            borderRadius: 999,
            pointerEvents: 'auto',
            overflowX: 'auto',
            maxWidth: '100%',
          }}
        >
          {agents.map((ag) => {
            const isSelected = selectedAgent?.id === ag.id;
            const dotColor =
              ag.status === 'kerja'
                ? 'var(--color-kerja)'
                : ag.status === 'nunggu'
                ? 'var(--color-nunggu)'
                : 'var(--color-santai)';

            return (
              <button
                key={ag.id}
                onClick={() => handleFocusAgent(ag.id)}
                title={`${ag.name} (${ag.role}) - Status: ${ag.status}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: isSelected
                    ? 'rgba(59, 130, 246, 0.28)'
                    : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected
                    ? '1.5px solid #3b82f6'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  color: isSelected ? '#ffffff' : '#cbd5e1',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    display: 'inline-block',
                    flexShrink: 0,
                  }}
                />
                <span>{ag.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>

        {/* User Interaction hint */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            background: 'rgba(11, 21, 48, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '4px 14px',
            borderRadius: 999,
            border: '1px solid rgba(255, 255, 255, 0.06)',
          }}
        >
          💡 <strong>Drag</strong> untuk geser &bull; <strong>Scroll / Pinch</strong> untuk zoom &bull;{' '}
          <strong>Klik karakter</strong> untuk buka detail &bull; <strong>Atur Posisi</strong> untuk kalibrasi meja
        </div>
      </div>

      {/* Slide-in Agent Detail Drawer */}
      <AgentDetailDrawer
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
        onUpdateStatus={handleUpdateStatus}
        onFocusAgent={handleFocusAgent}
        onAssignAiTask={handleAssignAiTask}
      />
    </main>
  );
}
