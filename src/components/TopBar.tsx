'use client';

import React from 'react';
import { Agent, AgentStatus } from '../types/agent';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  Bell,
  Sparkles,
  Move,
  Check,
  X,
} from 'lucide-react';

interface TopBarProps {
  agents: Agent[];
  isCalibrating: boolean;
  onToggleCalibration: () => void;
  onSavePositions: () => void;
  onCancelCalibration: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetCamera: () => void;
  onSelectAgent: (agent: Agent) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  agents,
  isCalibrating,
  onToggleCalibration,
  onSavePositions,
  onCancelCalibration,
  onZoomIn,
  onZoomOut,
  onResetCamera,
  onSelectAgent,
}) => {
  const kerjaCount = agents.filter((a) => a.status === 'kerja').length;
  const nungguCount = agents.filter((a) => a.status === 'nunggu').length;
  const santaiCount = agents.filter((a) => a.status === 'santai').length;

  const nextWaitingAgent = agents.find((a) => a.status === 'nunggu');

  return (
    <header
      style={{
        position: 'absolute',
        top: 14,
        left: 16,
        right: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none',
        zIndex: 40,
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Brand & Office Indicator */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 16px',
          borderRadius: 14,
          pointerEvents: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            boxShadow: '0 0 14px rgba(59, 130, 246, 0.4)',
          }}
        >
          <Building2 size={18} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <h1
              style={{
                fontSize: 15,
                fontWeight: 800,
                letterSpacing: '-0.02em',
                color: '#f8fafc',
                lineHeight: 1.2,
              }}
            >
              Kantor AI
            </h1>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(56, 189, 248, 0.15)',
                color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.3)',
              }}
            >
              ISOMETRIK
            </span>
          </div>
          <p
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              marginTop: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Sparkles size={10} color="#f59e0b" />
            <span>Virtual Pixel Art Office</span>
          </p>
        </div>
      </div>

      {/* Main Status Legend (Legenda Status) */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 18,
          padding: '8px 20px',
          borderRadius: 999,
          pointerEvents: 'auto',
        }}
      >
        {/* Lagi Kerja */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#e2e8f0',
          }}
        >
          <span
            className="pulse-green"
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: 'var(--color-kerja)',
            }}
          />
          <span>Lagi kerja</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(16, 185, 129, 0.2)',
              color: '#34d399',
            }}
          >
            {kerjaCount}
          </span>
        </div>

        {/* Nunggu Kamu */}
        <button
          onClick={() => {
            if (nextWaitingAgent) onSelectAgent(nextWaitingAgent);
          }}
          title={nextWaitingAgent ? `Klik untuk fokus ke ${nextWaitingAgent.name}` : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#fef08a',
            background: 'transparent',
            border: 'none',
            cursor: nextWaitingAgent ? 'pointer' : 'default',
            padding: 0,
          }}
        >
          <span
            className="pulse-yellow"
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: 'var(--color-nunggu)',
            }}
          />
          <span>Nunggu kamu</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(245, 158, 11, 0.25)',
              color: '#fbbf24',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            {nungguCount > 0 && <Bell size={9} />}
            {nungguCount}
          </span>
        </button>

        {/* Santai */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12,
            fontWeight: 600,
            color: '#e2e8f0',
          }}
        >
          <span
            className="pulse-blue"
            style={{
              display: 'inline-block',
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: 'var(--color-santai)',
            }}
          />
          <span>Santai</span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: 999,
              background: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
            }}
          >
            {santaiCount}
          </span>
        </div>
      </div>

      {/* Mode Kalibrasi & Camera Controls */}
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          borderRadius: 14,
          pointerEvents: 'auto',
        }}
      >
        {/* Tombol Mode Kalibrasi */}
        {isCalibrating ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={onSavePositions}
              title="Simpan Posisi Karakter ke agents.json"
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                borderRadius: 8,
                color: '#ffffff',
                padding: '6px 12px',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)',
              }}
            >
              <Check size={14} />
              <span>Simpan Posisi</span>
            </button>

            <button
              onClick={onCancelCalibration}
              title="Batal Mode Kalibrasi"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#f87171',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleCalibration}
            title="Aktifkan Mode Kalibrasi untuk geser posisi karakter"
            style={{
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 8,
              color: '#fbbf24',
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
            }}
          >
            <Move size={13} />
            <span>Atur Posisi</span>
          </button>
        )}

        <div style={{ width: 1, height: 20, background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

        {/* Camera Zoom buttons */}
        <button
          onClick={onZoomIn}
          title="Zoom In"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: 8,
            color: '#f8fafc',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ZoomIn size={15} />
        </button>

        <button
          onClick={onZoomOut}
          title="Zoom Out"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: 8,
            color: '#f8fafc',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ZoomOut size={15} />
        </button>

        <button
          onClick={onResetCamera}
          title="Reset Kamera"
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: 8,
            color: '#f8fafc',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} />
        </button>
      </div>
    </header>
  );
};
