'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Agent, AgentStatus } from '../types/agent';
import { OfficeScene } from '../game/OfficeScene';

export interface OfficeCanvasHandle {
  updateAgentStatus: (agentId: string, newStatus: AgentStatus, newTask?: string) => void;
  focusAgent: (agentId: string) => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface OfficeCanvasProps {
  agents: Agent[];
  onSelectAgent: (agent: Agent) => void;
  onHoverAgent: (agent: Agent | null) => void;
}

export const OfficeCanvas = forwardRef<OfficeCanvasHandle, OfficeCanvasProps>(
  ({ agents, onSelectAgent, onHoverAgent }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<OfficeScene | null>(null);

    useImperativeHandle(ref, () => ({
      updateAgentStatus: (agentId: string, newStatus: AgentStatus, newTask?: string) => {
        if (sceneRef.current) {
          sceneRef.current.updateAgentStatus(agentId, newStatus, newTask);
        }
      },
      focusAgent: (agentId: string) => {
        if (sceneRef.current) {
          sceneRef.current.focusAgent(agentId);
        }
      },
      resetCamera: () => {
        if (sceneRef.current) {
          sceneRef.current.resetCamera();
        }
      },
      zoomIn: () => {
        if (sceneRef.current) {
          sceneRef.current.zoomIn();
        }
      },
      zoomOut: () => {
        if (sceneRef.current) {
          sceneRef.current.zoomOut();
        }
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initPhaser = async () => {
        if (!containerRef.current || gameRef.current) return;

        const Phaser = await import('phaser');

        const width = containerRef.current.clientWidth || window.innerWidth;
        const height = containerRef.current.clientHeight || window.innerHeight;

        const scene = new OfficeScene();
        sceneRef.current = scene;

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: containerRef.current,
          width,
          height,
          backgroundColor: '#0b1530',
          pixelArt: true,
          roundPixels: true,
          render: {
            antialias: false,
            antialiasGL: false,
            powerPreference: 'high-performance',
          },
          scale: {
            mode: Phaser.Scale.RESIZE,
            autoCenter: Phaser.Scale.CENTER_BOTH,
          },
          scene: [scene],
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        // Boot scene with initial agents and callbacks
        game.events.once('ready', () => {
          if (!isMounted) return;
          scene.scene.start('OfficeScene', {
            agents,
            callbacks: {
              onSelectAgent,
              onHoverAgent,
            },
          });
        });
      };

      initPhaser();

      return () => {
        isMounted = false;
        if (gameRef.current) {
          gameRef.current.destroy(true);
          gameRef.current = null;
          sceneRef.current = null;
        }
      };
    }, []);

    return (
      <div
        ref={containerRef}
        id="phaser-canvas-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: 'grab',
          overflow: 'hidden',
        }}
      />
    );
  }
);

OfficeCanvas.displayName = 'OfficeCanvas';
