'use client';

import React, { useState } from 'react';
import { Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

interface LoginModalProps {
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
      } else {
        setErrorMessage(data.error || 'Password salah. Periksa kembali APP_PASSWORD.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi gangguan jaringan: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #0f1d44 0%, #060b1c 100%)',
        padding: '20px',
      }}
    >
      {/* Background ambient glow */}
      <div
        style={{
          position: 'absolute',
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'rgba(56, 189, 248, 0.12)',
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="glass-panel"
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(11, 21, 48, 0.85)',
          border: '1.5px solid rgba(56, 189, 248, 0.25)',
          borderRadius: 20,
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.7)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          backdropFilter: 'blur(16px)',
        }}
      >
        {/* Animated Badge Icon */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(37, 99, 235, 0.25) 100%)',
            border: '1.5px solid rgba(56, 189, 248, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#38bdf8',
            marginBottom: 16,
            boxShadow: '0 4px 20px rgba(56, 189, 248, 0.25)',
          }}
        >
          <Lock size={26} />
        </div>

        {/* Title & Description */}
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            color: '#ffffff',
            letterSpacing: '-0.02em',
            marginBottom: 6,
            textAlign: 'center',
          }}
        >
          KANTOR AI TERKUNCI
        </h1>
        <p
          style={{
            fontSize: 13,
            color: '#94a3b8',
            textAlign: 'center',
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          Masukkan password kantor untuk membuka dashboard agen AI dan mengamankan kuota Gemini.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password kantor..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 42px 12px 14px',
                borderRadius: 10,
                background: 'rgba(5, 10, 25, 0.7)',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.4)',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#38bdf8')}
              onBlur={(e) => (e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)')}
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {errorMessage && (
            <div
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                color: '#fca5a5',
                fontSize: 12,
                textAlign: 'center',
                lineHeight: 1.4,
              }}
            >
              ⚠️ {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={!password.trim() || isLoading}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 10,
              background: password.trim() && !isLoading
                ? 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
                : 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              color: password.trim() && !isLoading ? '#ffffff' : '#64748b',
              fontSize: 14,
              fontWeight: 700,
              cursor: password.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: password.trim() && !isLoading ? '0 4px 16px rgba(37, 99, 235, 0.4)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Memeriksa Password...</span>
              </>
            ) : (
              <>
                <span>Buka Kantor AI</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Security badge footer */}
        <div
          style={{
            marginTop: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            color: '#64748b',
          }}
        >
          <ShieldCheck size={13} color="#10b981" />
          <span>Variabel APP_PASSWORD terpasang di server environment</span>
        </div>
      </div>
    </div>
  );
};
