'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cleanMarkdownForClipboard } from '../lib/formatDraft';
import { Agent, AgentStatus } from '../types/agent';
import {
  X,
  Briefcase,
  Clock,
  CheckCircle2,
  AlertCircle,
  Coffee,
  Sparkles,
  Send,
  UserCheck,
  FileText,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';

interface AgentDetailDrawerProps {
  agent: Agent | null;
  onClose: () => void;
  onUpdateStatus: (agentId: string, newStatus: AgentStatus, newTask?: string, newDraft?: string) => void;
  onFocusAgent: (agentId: string) => void;
  onAssignAiTask?: (agentId: string, task: string) => Promise<void>;
}

export const AgentDetailDrawer: React.FC<AgentDetailDrawerProps> = ({
  agent,
  onClose,
  onUpdateStatus,
  onFocusAgent,
  onAssignAiTask,
}) => {
  const [taskInput, setTaskInput] = useState('');
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!agent) return null;

  const handleStatusChange = (newStatus: AgentStatus) => {
    onUpdateStatus(agent.id, newStatus);
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskInput.trim()) {
      onUpdateStatus(agent.id, agent.status, taskInput.trim());
      setTaskInput('');
      setIsEditingTask(false);
    }
  };

  const handleAiTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || isLoadingAi) return;

    const taskText = aiPromptInput.trim();
    setAiPromptInput('');
    setIsLoadingAi(true);

    try {
      if (onAssignAiTask) {
        await onAssignAiTask(agent.id, taskText);
      } else {
        await fetch('/api/agents/task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: agent.id, task: taskText }),
        });
      }
    } catch (err) {
      console.error('Failed to trigger AI task', err);
    } finally {
      setIsLoadingAi(false);
    }
  };

  const handleApproveDecision = () => {
    // Decision approved: switch agent from 'nunggu' to 'kerja', keeping clean task instruction and clearing draft
    onUpdateStatus(
      agent.id,
      'kerja',
      agent.task,
      undefined
    );
  };

  const handleCopyDraft = () => {
    if (agent.draft) {
      // Clean markdown and convert tables into TSV for direct paste into Excel / Sheets
      const cleanText = cleanMarkdownForClipboard(agent.draft);
      navigator.clipboard.writeText(cleanText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* Background click overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 10, 25, 0.45)',
          backdropFilter: 'blur(3px)',
          zIndex: 48,
          opacity: agent ? 1 : 0,
          pointerEvents: agent ? 'auto' : 'none',
          transition: 'opacity 0.25s ease-out',
        }}
      />

      {/* Slide-In Drawer from Right */}
      <aside
        className="glass-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: '95vw',
          zIndex: 50,
          background: 'linear-gradient(180deg, #0e1a3b 0%, #091228 100%)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.65)',
          display: 'flex',
          flexDirection: 'column',
          transform: agent ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'sticky',
            top: 0,
            background: 'inherit',
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar Pill */}
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                backgroundColor: agent.avatarColor || '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 800,
                color: '#ffffff',
                boxShadow: `0 4px 16px ${agent.avatarColor}40`,
              }}
            >
              {agent.name.charAt(0)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h2
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#f8fafc',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {agent.name}
                </h2>
                {agent.isUser && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: 'rgba(56, 189, 248, 0.2)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                    }}
                  >
                    KAMU
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {agent.role} &bull; {agent.department}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#94a3b8',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Quick Focus Button */}
          <button
            onClick={() => onFocusAgent(agent.id)}
            style={{
              padding: '9px 14px',
              borderRadius: 10,
              background: 'rgba(59, 130, 246, 0.12)',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              color: '#60a5fa',
              fontSize: 12.5,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Sparkles size={14} />
            <span>Fokus Kamera ke Posisi Agen</span>
          </button>

          {/* DRAF HASIL KERJA AGENT (GEMINI AI OUTPUT) */}
          {agent.draft && (
            <div
              style={{
                borderRadius: 14,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
                border: '1.5px solid rgba(16, 185, 129, 0.35)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.35)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(16, 185, 129, 0.18)',
                  borderBottom: '1px solid rgba(16, 185, 129, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <FileText size={15} color="#34d399" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', letterSpacing: '0.02em' }}>
                    DRAF HASIL KERJA (GEMINI AI)
                  </span>
                </div>
                <button
                  onClick={handleCopyDraft}
                  title="Salin teks bersih / tempel ke Excel"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 12px',
                    borderRadius: 6,
                    background: copied ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: copied ? '#34d399' : '#cbd5e1',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copied ? 'Tersalin untuk Excel' : 'Salin'}</span>
                </button>
              </div>

              <div style={{ padding: '16px' }}>
                {/* Formatted Markdown Container */}
                <div
                  style={{
                    fontSize: '12.5px',
                    color: '#f1f5f9',
                    lineHeight: 1.6,
                    background: 'rgba(11, 21, 48, 0.65)',
                    padding: '14px',
                    borderRadius: 10,
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    maxHeight: 320,
                    overflowY: 'auto',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div style={{ overflowX: 'auto', margin: '10px 0' }}>
                          <table
                            style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '12px',
                              border: '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: 6,
                              background: 'rgba(15, 23, 42, 0.75)',
                            }}
                            {...props}
                          />
                        </div>
                      ),
                      thead: ({ node, ...props }) => (
                        <thead
                          style={{
                            background: 'rgba(56, 189, 248, 0.15)',
                            borderBottom: '1.5px solid rgba(56, 189, 248, 0.35)',
                          }}
                          {...props}
                        />
                      ),
                      th: ({ node, ...props }) => (
                        <th
                          style={{
                            padding: '8px 12px',
                            color: '#38bdf8',
                            fontWeight: 700,
                            textAlign: 'left',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            whiteSpace: 'nowrap',
                          }}
                          {...props}
                        />
                      ),
                      td: ({ node, ...props }) => (
                        <td
                          style={{
                            padding: '8px 12px',
                            color: '#f1f5f9',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                          }}
                          {...props}
                        />
                      ),
                      tr: ({ node, ...props }) => (
                        <tr
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                          }}
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul style={{ paddingLeft: 18, margin: '6px 0', color: '#e2e8f0', lineHeight: 1.55 }} {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol style={{ paddingLeft: 18, margin: '6px 0', color: '#e2e8f0', lineHeight: 1.55 }} {...props} />
                      ),
                      li: ({ node, ...props }) => (
                        <li style={{ margin: '3px 0' }} {...props} />
                      ),
                      p: ({ node, ...props }) => (
                        <p style={{ margin: '6px 0', lineHeight: 1.55 }} {...props} />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong style={{ color: '#ffffff', fontWeight: 700 }} {...props} />
                      ),
                      h1: ({ node, ...props }) => (
                        <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#38bdf8', margin: '10px 0 6px 0' }} {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#38bdf8', margin: '8px 0 4px 0' }} {...props} />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa', margin: '6px 0 4px 0' }} {...props} />
                      ),
                    }}
                  >
                    {agent.draft}
                  </ReactMarkdown>
                </div>

                <button
                  onClick={handleApproveDecision}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 2px 12px rgba(16, 185, 129, 0.3)',
                  }}
                >
                  <UserCheck size={15} />
                  <span>Setujui Draf &amp; Selesaikan Tugas</span>
                </button>
              </div>
            </div>
          )}

          {/* BERI TUGAS AI BARU (Powered by Gemini) */}
          <div
            style={{
              padding: '16px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.09)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Sparkles size={14} color="#38bdf8" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Beri Tugas AI Baru ke {agent.name.split(' ')[0]}
              </span>
            </div>

            <form onSubmit={handleAiTaskSubmit}>
              <textarea
                value={aiPromptInput}
                onChange={(e) => setAiPromptInput(e.target.value)}
                placeholder={`Contoh: Rapikan nota ini jadi tabel: beli kertas 50rb...`}
                rows={3}
                disabled={isLoadingAi}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(0, 0, 0, 0.35)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#f8fafc',
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                  resize: 'none',
                  lineHeight: 1.45,
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button
                  type="submit"
                  disabled={!aiPromptInput.trim() || isLoadingAi}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    background: aiPromptInput.trim() && !isLoadingAi
                      ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                      : 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    color: aiPromptInput.trim() && !isLoadingAi ? '#ffffff' : '#64748b',
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: aiPromptInput.trim() && !isLoadingAi ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: aiPromptInput.trim() && !isLoadingAi ? '0 2px 10px rgba(37, 99, 235, 0.35)' : 'none',
                  }}
                >
                  {isLoadingAi ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Sedang Memproses AI...</span>
                    </>
                  ) : (
                    <>
                      <Send size={13} />
                      <span>Tugaskan ke Agen</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Current Task Card - Shows Pure Original User Instruction */}
          <div
            style={{
              padding: '16px',
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Briefcase size={13} color="#94a3b8" />
                Tugas Saat Ini
              </span>
              <button
                onClick={() => {
                  setIsEditingTask(!isEditingTask);
                  setTaskInput(agent.task);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#38bdf8',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {isEditingTask ? 'Batal' : 'Ubah Tugas'}
              </button>
            </div>

            {isEditingTask ? (
              <form onSubmit={handleTaskSubmit} style={{ marginTop: 8 }}>
                <input
                  type="text"
                  value={taskInput}
                  onChange={(e) => setTaskInput(e.target.value)}
                  placeholder="Ketik tugas baru..."
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    color: '#f8fafc',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    type="submit"
                    style={{
                      padding: '6px 14px',
                      borderRadius: 6,
                      background: '#2563eb',
                      border: 'none',
                      color: '#ffffff',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Send size={12} />
                    <span>Simpan</span>
                  </button>
                </div>
              </form>
            ) : (
              <p
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: '#f8fafc',
                  lineHeight: 1.5,
                }}
              >
                &ldquo;{agent.task}&rdquo;
              </p>
            )}

            {/* Quick Action when waiting without draft */}
            {agent.status === 'nunggu' && !agent.draft && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px',
                  borderRadius: 10,
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <p style={{ fontSize: 12, color: '#fef08a', marginBottom: 10, lineHeight: 1.4 }}>
                  ⚠️ Agen ini membutuhkan konfirmasi atau keputusan darimu untuk melanjutkan.
                </p>
                <button
                  onClick={handleApproveDecision}
                  style={{
                    width: '100%',
                    padding: '9px 14px',
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    border: 'none',
                    color: '#0f172a',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  <UserCheck size={15} />
                  <span>Setujui Keputusan &amp; Lanjutkan</span>
                </button>
              </div>
            )}
          </div>

          {/* Interactive Status Switcher */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 10,
                display: 'block',
              }}
            >
              Ubah Status Agen (Live Feedback)
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}
            >
              {/* Button: Kerja */}
              <button
                onClick={() => handleStatusChange('kerja')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  borderRadius: 12,
                  border:
                    agent.status === 'kerja'
                      ? '1.5px solid #10b981'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  background:
                    agent.status === 'kerja'
                      ? 'rgba(16, 185, 129, 0.18)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: agent.status === 'kerja' ? '#34d399' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <CheckCircle2 size={18} color={agent.status === 'kerja' ? '#10b981' : '#64748b'} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Lagi Kerja</span>
              </button>

              {/* Button: Nunggu */}
              <button
                onClick={() => handleStatusChange('nunggu')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  borderRadius: 12,
                  border:
                    agent.status === 'nunggu'
                      ? '1.5px solid #f59e0b'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  background:
                    agent.status === 'nunggu'
                      ? 'rgba(245, 158, 11, 0.18)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: agent.status === 'nunggu' ? '#fbbf24' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <AlertCircle size={18} color={agent.status === 'nunggu' ? '#f59e0b' : '#64748b'} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Nunggu Kamu</span>
              </button>

              {/* Button: Santai */}
              <button
                onClick={() => handleStatusChange('santai')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '12px 8px',
                  borderRadius: 12,
                  border:
                    agent.status === 'santai'
                      ? '1.5px solid #38bdf8'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                  background:
                    agent.status === 'santai'
                      ? 'rgba(56, 189, 248, 0.18)'
                      : 'rgba(255, 255, 255, 0.03)',
                  color: agent.status === 'santai' ? '#38bdf8' : '#94a3b8',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Coffee size={18} color={agent.status === 'santai' ? '#38bdf8' : '#64748b'} />
                <span style={{ fontSize: 12, fontWeight: 700 }}>Santai</span>
              </button>
            </div>
          </div>

          {/* Activity History */}
          <div>
            <label
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Clock size={13} color="#94a3b8" />
              Aktivitas Terbaru
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agent.recentActivity.map((act, index) => (
                <div
                  key={index}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      backgroundColor: '#60a5fa',
                      marginTop: 6,
                      flexShrink: 0,
                    }}
                  />
                  <p style={{ fontSize: 12.5, color: '#cbd5e1', lineHeight: 1.45 }}>{act}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
