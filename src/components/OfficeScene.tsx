'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as Phaser from 'phaser';
import { Agent, AgentStatus } from '../types/agent';

export interface OfficeSceneHandle {
  updateAgentStatus: (agentId: string, newStatus: AgentStatus, newTask?: string) => void;
  syncAgents?: (agents: Agent[]) => void;
  focusAgent: (agentId: string) => void;
  selectAgent: (agentId: string | null) => void;
  setCalibrationMode: (active: boolean) => void;
  resetCamera: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  getPositions: () => { id: string; x: number; y: number }[];
}

interface OfficeSceneProps {
  agents: Agent[];
  isCalibrating: boolean;
  onSelectAgent: (agent: Agent) => void;
  onHoverAgent: (agent: Agent | null) => void;
  onPositionChange?: (id: string, x: number, y: number) => void;
}

interface AgentContainerObj {
  agent: Agent;
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  halo: Phaser.GameObjects.Image;
  labelContainer: Phaser.GameObjects.Container;
  labelBg: Phaser.GameObjects.Graphics;
  statusDot: Phaser.GameObjects.Arc;
  statusDotPulse: Phaser.GameObjects.Arc;
  labelText: Phaser.GameObjects.Text;
  bubbleContainer: Phaser.GameObjects.Container;
  bubbleBg: Phaser.GameObjects.Graphics;
  bubbleText: Phaser.GameObjects.Text;
  bubbleTail: Phaser.GameObjects.Triangle;
  exclamationIcon: Phaser.GameObjects.Image;
  coordBadge: Phaser.GameObjects.Text;
  isMoving: boolean;
  baseBubbleY: number;
  currentBubbleY: number;
  currentBubbleX: number;
  bubbleWidth: number;
  bubbleHeight: number;
  breathTween?: Phaser.Tweens.Tween;
  actionTween?: Phaser.Tweens.Tween;
  dotPulseTween?: Phaser.Tweens.Tween;
  exclamationTween?: Phaser.Tweens.Tween;
  bubbleDismissTimer?: Phaser.Time.TimerEvent;
  isBubbleTemporarilyVisible?: boolean;
}

class PhaserOfficeScene extends Phaser.Scene {
  private bgImage!: Phaser.GameObjects.Image;
  private agentsData: Agent[] = [];
  private agentMap: Map<string, AgentContainerObj> = new Map();
  private callbacks: any = {};
  public isCalibrating: boolean = false;
  private hoveredAgentId: string | null = null;
  private selectedAgentId: string | null = null;

  // Camera Drag
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private camStartX: number = 0;
  private camStartY: number = 0;

  constructor() {
    super({ key: 'PhaserOfficeScene' });
  }

  public init(data: { agents: Agent[]; callbacks: any; isCalibrating: boolean }) {
    this.agentsData = data.agents || [];
    this.callbacks = data.callbacks || {};
    this.isCalibrating = data.isCalibrating || false;
  }

  public preload() {
    // 1. Office background
    this.load.image('kantor_bg', '/assets/kantor.png');

    // 2. Character spritesheets (Standardized 64x64 Habbo-style isometric sprites, 256x448 px)
    const charIds = ['elfano', 'pompom', 'zekky', 'bobby', 'kunyuk', 'amoy', 'jojo', 'oyen'];
    charIds.forEach((id) => {
      this.load.spritesheet(`char_${id}`, `/assets/characters/${id}.png`, {
        frameWidth: 64,
        frameHeight: 64,
      });
    });

    // 3. Ambient & UI Effects
    this.load.image('dust_particle', '/assets/effects/dust_particle.png');
    this.load.image('exclamation', '/assets/effects/exclamation.png');
    this.load.image('selection_halo', '/assets/effects/selection_halo.png');
  }

  public create() {
    this.cameras.main.setBackgroundColor('#0b1530');

    // Register animations for each character
    this.registerCharacterAnimations();

    // 1. Add background office image (pixel art, unblurred)
    this.bgImage = this.add.image(0, 0, 'kantor_bg').setOrigin(0, 0);
    this.bgImage.setDepth(0);

    const bgWidth = this.bgImage.width || 1024;
    const bgHeight = this.bgImage.height || 682;

    // Set camera bounds
    this.cameras.main.setBounds(-150, -100, bgWidth + 300, bgHeight + 200);

    // Initial center camera
    this.centerCamera();

    // 2. Ambient light dust motes
    this.add.particles(0, 0, 'dust_particle', {
      x: { min: 40, max: bgWidth - 40 },
      y: { min: 40, max: bgHeight - 40 },
      speedX: { min: -4, max: 4 },
      speedY: { min: -7, max: -2 },
      scale: { start: 0.35, end: 0.85 },
      alpha: { start: 0, end: 0.6, ease: 'Sine.easeInOut' },
      lifespan: 6500,
      frequency: 320,
      blendMode: 'ADD',
    }).setDepth(9999);

    // 3. Spawn character agents
    this.spawnAgents();

    // 4. Resolve bubble positions to prevent collisions
    this.resolveBubbleCollisions();

    // 5. Setup camera controls (drag pan, scroll zoom, mobile touch)
    this.setupCameraControls();

    // 6. Setup drag-and-drop for calibration mode
    this.setupCalibrationDrag();
  }

  private registerCharacterAnimations() {
    const charIds = ['elfano', 'pompom', 'zekky', 'bobby', 'kunyuk', 'amoy', 'jojo', 'oyen'];

    charIds.forEach((id) => {
      const texKey = `char_${id}`;

      // Idle animations (1 frame per direction)
      const idleDirs = [
        { name: 'down_left', frame: 0 },
        { name: 'down_right', frame: 1 },
        { name: 'up_right', frame: 2 },
        { name: 'up_left', frame: 3 },
      ];
      idleDirs.forEach((d) => {
        const animKey = `${id}_idle_${d.name}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: [{ key: texKey, frame: d.frame }],
            frameRate: 1,
            repeat: -1,
          });
        }
      });

      // Typing animations (frame 4..7)
      const typeDirs = [
        { name: 'down_left', frame: 4 },
        { name: 'down_right', frame: 5 },
        { name: 'up_right', frame: 6 },
        { name: 'up_left', frame: 7 },
      ];
      typeDirs.forEach((d) => {
        const animKey = `${id}_typing_${d.name}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: [{ key: texKey, frame: d.frame }],
            frameRate: 1,
            repeat: -1,
          });
        }
      });

      // Walk 4-frame cycles (Rows 2..5)
      const walkDirs = [
        { name: 'down_left', frames: [8, 12, 16, 20] },
        { name: 'down_right', frames: [9, 13, 17, 21] },
        { name: 'up_right', frames: [10, 14, 18, 22] },
        { name: 'up_left', frames: [11, 15, 19, 23] },
      ];
      walkDirs.forEach((w) => {
        const animKey = `${id}_walk_${w.name}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: w.frames.map((f) => ({ key: texKey, frame: f })),
            frameRate: 8,
            repeat: -1,
          });
        }
      });

      // Sitting in armchair (frame 24..27)
      const sitDirs = [
        { name: 'down_left', frame: 24 },
        { name: 'down_right', frame: 25 },
        { name: 'up_right', frame: 26 },
        { name: 'up_left', frame: 27 },
      ];
      sitDirs.forEach((s) => {
        const animKey = `${id}_sit_${s.name}`;
        if (!this.anims.exists(animKey)) {
          this.anims.create({
            key: animKey,
            frames: [{ key: texKey, frame: s.frame }],
            frameRate: 1,
            repeat: -1,
          });
        }
      });
    });
  }

  private centerCamera() {
    const bgWidth = this.bgImage ? this.bgImage.width : 1024;
    const bgHeight = this.bgImage ? this.bgImage.height : 682;

    const screenW = this.cameras.main.width;
    const screenH = this.cameras.main.height;

    const zoomX = screenW / bgWidth;
    const zoomY = screenH / bgHeight;
    const bestZoom = Math.min(zoomX, zoomY) * 1.05;
    const clampedZoom = Phaser.Math.Clamp(bestZoom, 0.6, 2.0);

    this.cameras.main.centerOn(bgWidth / 2, bgHeight / 2);
    this.cameras.main.setZoom(clampedZoom);
  }

  private spawnAgents() {
    this.agentsData.forEach((agent) => {
      const isRelaxed = agent.status === 'santai';
      const posX = isRelaxed && agent.chillSpot ? agent.chillSpot.x : agent.x;
      const posY = isRelaxed && agent.chillSpot ? agent.chillSpot.y : agent.y;

      const container = this.add.container(posX, posY);
      // Precise Isometric Z-Ordering based on floor Y position
      container.setDepth(Math.round(posY));

      // Shadow under feet precisely on floor
      const shadow = this.add.ellipse(0, 1, 26, 9, 0x000000, 0.45);
      container.add(shadow);

      // Selection Halo
      const halo = this.add.image(0, 1, 'selection_halo');
      halo.setOrigin(0.5, 0.5);
      halo.setScale(1.1);
      halo.setVisible(false);
      halo.setAlpha(0.85);
      container.add(halo);

      // Character Sprite (64x64 px standard, feet aligned at baseline y=60)
      // Setting origin to (0.5, 0.9375) aligns feet exactly at container (0, 0) on the floor
      const sprite = this.add.sprite(0, 0, `char_${agent.id}`, 0);
      sprite.setOrigin(0.5, 0.9375);
      container.add(sprite);

      // Rounded Pill Name Label (neatly above head at y = -54)
      const labelContainer = this.add.container(0, -54);
      const labelBg = this.add.graphics();
      const labelText = this.add.text(7, 0, agent.name, {
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#f8fafc',
      }).setOrigin(0, 0.5);

      const statusCol = this.getStatusColor(agent.status);
      const statusDotPulse = this.add.circle(0, 0, 4.5, statusCol, 0.4);
      const statusDot = this.add.circle(0, 0, 3, statusCol, 1);

      labelContainer.add([labelBg, statusDotPulse, statusDot, labelText]);
      container.add(labelContainer);

      // Speech Bubble (base position at y = -78, clear 14px gap above label)
      const baseBubbleY = -78;
      const bubbleContainer = this.add.container(0, baseBubbleY);
      const bubbleBg = this.add.graphics();
      const bubbleTail = this.add.triangle(0, 13, -3.5, 0, 3.5, 0, 0, 6, 0x0b1329);
      const bubbleText = this.add.text(0, 0, '', {
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        fontSize: '9.5px',
        color: '#f1f5f9',
        align: 'center',
      }).setOrigin(0.5, 0.5);

      bubbleContainer.add([bubbleBg, bubbleTail, bubbleText]);
      container.add(bubbleContainer);

      // Exclamation badge for yellow status (bouncing above head)
      const exclamationIcon = this.add.image(14, -58, 'exclamation');
      exclamationIcon.setOrigin(0.5, 0.5);
      exclamationIcon.setVisible(agent.status === 'nunggu');
      container.add(exclamationIcon);

      // Coordinates badge for calibration mode (hidden by default)
      const coordBadge = this.add.text(0, 10, `(${Math.round(posX)}, ${Math.round(posY)})`, {
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#38bdf8',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5, 0);
      coordBadge.setVisible(this.isCalibrating);
      container.add(coordBadge);

      // Interactive hit area
      container.setSize(44, 64);
      container.setInteractive({ useHandCursor: true });
      (container as any).agentId = agent.id;

      const agentObj: AgentContainerObj = {
        agent,
        container,
        sprite,
        shadow,
        halo,
        labelContainer,
        labelBg,
        statusDot,
        statusDotPulse,
        labelText,
        bubbleContainer,
        bubbleBg,
        bubbleText,
        bubbleTail,
        exclamationIcon,
        coordBadge,
        isMoving: false,
        baseBubbleY,
        currentBubbleY: baseBubbleY,
        currentBubbleX: 0,
        bubbleWidth: 90,
        bubbleHeight: 24,
        isBubbleTemporarilyVisible: false,
      };

      this.agentMap.set(agent.id, agentObj);
      this.updateAgentVisuals(agentObj);

      // Hover
      container.on('pointerover', () => {
        this.hoveredAgentId = agent.id;
        if (!this.isCalibrating) {
          halo.setVisible(true);
          // Bring hovered agent and bubble to absolute top depth
          container.setDepth(20000 + Math.round(container.y));
          this.tweens.add({
            targets: [container],
            scale: 1.06,
            duration: 150,
            ease: 'Back.easeOut',
          });
        }
        this.updateAgentVisuals(agentObj);
        this.resolveBubbleCollisions();
        if (this.callbacks.onHoverAgent) this.callbacks.onHoverAgent(agent);
      });

      container.on('pointerout', () => {
        this.hoveredAgentId = null;
        halo.setVisible(false);
        // Restore correct isometric depth
        container.setDepth(Math.round(container.y));
        this.tweens.add({
          targets: [container],
          scale: 1.0,
          duration: 150,
          ease: 'Quad.easeOut',
        });
        this.updateAgentVisuals(agentObj);
        this.resolveBubbleCollisions();
        if (this.callbacks.onHoverAgent) this.callbacks.onHoverAgent(null);
      });

      // Click to select
      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.isCalibrating) return;
        if (pointer.getDistance() > 6) return;
        this.selectedAgentId = agent.id;
        this.updateAgentVisuals(agentObj);
        this.resolveBubbleCollisions();
        if (this.callbacks.onSelectAgent) {
          this.callbacks.onSelectAgent(agent);
        }
      });
    });
  }

  private updateAgentVisuals(obj: AgentContainerObj) {
    const { agent, labelBg, labelText, statusDot, statusDotPulse, bubbleContainer, bubbleBg, bubbleText, exclamationIcon } = obj;

    const isHovered = (this.hoveredAgentId === agent.id);
    const isSelected = (this.selectedAgentId === agent.id);

    const statusCol = this.getStatusColor(agent.status);
    statusDot.setFillStyle(statusCol, 1);
    statusDotPulse.setFillStyle(statusCol, 0.4);

    if (obj.dotPulseTween) obj.dotPulseTween.stop();
    if (obj.exclamationTween) obj.exclamationTween.stop();

    if (agent.status === 'nunggu') {
      obj.dotPulseTween = this.tweens.add({
        targets: statusDotPulse,
        scale: { from: 1, to: 2.2 },
        alpha: { from: 0.6, to: 0 },
        duration: 1000,
        repeat: -1,
      });
      exclamationIcon.setVisible(true);
      obj.exclamationTween = this.tweens.add({
        targets: exclamationIcon,
        y: { from: -58, to: -66 },
        duration: 450,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      exclamationIcon.setVisible(false);
      statusDotPulse.setScale(1).setAlpha(0);
    }

    // Draw pill name background with clean padding
    const textBounds = labelText.getBounds();
    const pillW = textBounds.width + 24;
    const pillH = 18;
    labelBg.clear();
    labelBg.fillStyle(0x0f172a, 0.94);
    labelBg.lineStyle(1.2, isHovered ? 0x38bdf8 : 0x334155, 0.95);
    labelBg.fillRoundedRect(-12, -pillH / 2, pillW, pillH, 9);
    labelBg.strokeRoundedRect(-12, -pillH / 2, pillW, pillH, 9);

    const isMobile = (typeof window !== 'undefined' && window.innerWidth <= 768) || this.scale.width <= 768;

    // Mobile anti-clutter: don't keep persistent popups staying on screen!
    // On mobile screens, show bubble ONLY when hovered, selected, or during a temporary notification burst
    const shouldShowBubble = (agent.status !== 'santai') && (
      !isMobile || isHovered || isSelected || Boolean(obj.isBubbleTemporarilyVisible)
    );

    // Speech bubble logic with auto-shortening and full expansion on hover
    if (!shouldShowBubble) {
      if (bubbleContainer.visible && bubbleContainer.alpha > 0) {
        this.tweens.add({
          targets: bubbleContainer,
          scale: 0,
          alpha: 0,
          duration: 180,
          ease: 'Sine.easeIn',
          onComplete: () => {
            bubbleContainer.setVisible(false);
          },
        });
      } else {
        bubbleContainer.setVisible(false);
        bubbleContainer.setAlpha(0);
        bubbleContainer.setScale(0);
      }
      obj.bubbleWidth = 0;
      obj.bubbleHeight = 0;
    } else {
      let fullMessage = '';
      let shortMessage = '';

      if (agent.status === 'kerja') {
        fullMessage = `Aku lagi mengerjakan: ${agent.task}`;
        const shortTask = agent.task.length > 18 ? agent.task.slice(0, 16) + '...' : agent.task;
        shortMessage = `Kerja: ${shortTask}`;
      } else if (agent.status === 'nunggu') {
        fullMessage = `Nunggu keputusanmu: ${agent.task}`;
        const shortTask = agent.task.length > 16 ? agent.task.slice(0, 14) + '...' : agent.task;
        shortMessage = `Nunggu: ${shortTask}`;
      }

      // Display full message on hover/selected, shortened on idle
      const displayText = (isHovered || isSelected) ? fullMessage : shortMessage;
      bubbleText.setText(displayText);
      bubbleText.setFontSize((isHovered || isSelected) ? '10.5px' : '9.5px');
      bubbleText.setWordWrapWidth((isHovered || isSelected) ? 175 : 120);

      const bBounds = bubbleText.getBounds();
      const padX = (isHovered || isSelected) ? 12 : 9;
      const padY = (isHovered || isSelected) ? 7 : 5;
      const bw = Math.max(bBounds.width + padX * 2, 60);
      const bh = Math.max(bBounds.height + padY * 2, 22);

      obj.bubbleWidth = bw;
      obj.bubbleHeight = bh;

      bubbleBg.clear();
      bubbleBg.fillStyle(0x0b1329, (isHovered || isSelected) ? 0.97 : 0.92);
      bubbleBg.lineStyle(1.2, (isHovered || isSelected) ? 0x38bdf8 : 0x1e293b, 0.9);
      bubbleBg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      bubbleBg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);

      // Tail positioning
      obj.bubbleTail.y = bh / 2;

      bubbleContainer.setVisible(true);
      bubbleContainer.setAlpha(1.0);
      bubbleContainer.setScale((isHovered || isSelected) ? 1.05 : 1.0);
    }

    this.applyCharacterAnimation(obj);
  }

  // Anti-collision solver for speech bubbles
  private resolveBubbleCollisions() {
    const activeObjects: AgentContainerObj[] = [];
    this.agentMap.forEach((obj) => {
      if (obj.agent.status !== 'santai' && obj.bubbleWidth > 0 && obj.bubbleContainer.visible && obj.bubbleContainer.alpha > 0.05) {
        activeObjects.push(obj);
      }
    });

    // Reset to base positions
    activeObjects.forEach((obj) => {
      obj.currentBubbleX = 0;
      obj.currentBubbleY = obj.baseBubbleY;
    });

    // Pairwise overlap check and displacement
    for (let i = 0; i < activeObjects.length; i++) {
      for (let j = i + 1; j < activeObjects.length; j++) {
        const objA = activeObjects[i];
        const objB = activeObjects[j];

        const worldAX = objA.container.x + objA.currentBubbleX;
        const worldAY = objA.container.y + objA.currentBubbleY;
        const worldBX = objB.container.x + objB.currentBubbleX;
        const worldBY = objB.container.y + objB.currentBubbleY;

        const dx = Math.abs(worldAX - worldBX);
        const dy = Math.abs(worldAY - worldBY);

        const minSafeX = (objA.bubbleWidth + objB.bubbleWidth) / 2 + 8;
        const minSafeY = (objA.bubbleHeight + objB.bubbleHeight) / 2 + 6;

        if (dx < minSafeX && dy < minSafeY) {
          // Collision detected! Determine priority
          const isAHovered = (this.hoveredAgentId === objA.agent.id);
          const isBHovered = (this.hoveredAgentId === objB.agent.id);

          let displaceTarget = objB;
          let anchor = objA;

          if (isBHovered && !isAHovered) {
            displaceTarget = objA;
            anchor = objB;
          } else if (!isAHovered && !isBHovered) {
            // Lower Y on screen stays base, higher or closer one shifts upward
            if (objA.container.y < objB.container.y) {
              displaceTarget = objA;
              anchor = objB;
            } else {
              displaceTarget = objB;
              anchor = objA;
            }
          }

          // Displace vertically above the anchor bubble
          const requiredShiftY = (anchor.bubbleHeight + displaceTarget.bubbleHeight) / 2 + 10;
          displaceTarget.currentBubbleY = anchor.currentBubbleY - requiredShiftY;

          // If horizontally very close, slight horizontal nudge
          if (dx < 40) {
            const nudgeX = (displaceTarget.container.x >= anchor.container.x) ? 14 : -14;
            displaceTarget.currentBubbleX += nudgeX;
          }
        }
      }
    }

    // Apply smooth tween to updated bubble positions
    activeObjects.forEach((obj) => {
      this.tweens.add({
        targets: obj.bubbleContainer,
        x: obj.currentBubbleX,
        y: obj.currentBubbleY,
        duration: 200,
        ease: 'Sine.easeOut',
      });
    });
  }

  private applyCharacterAnimation(obj: AgentContainerObj) {
    const { agent, sprite } = obj;

    if (obj.breathTween) obj.breathTween.stop();
    if (obj.actionTween) obj.actionTween.stop();

    if (agent.status === 'kerja') {
      // Hijau: Typing at laptop (Frame 4: typing_down_left)
      sprite.stop();
      sprite.setFrame(4);

      // Micro keypress / typing rhythm oscillation
      obj.actionTween = this.tweens.add({
        targets: sprite,
        y: { from: 0, to: -1 },
        duration: 180,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });
    } else if (agent.status === 'nunggu') {
      // Kuning: Idle facing front (Frame 0: idle_down_left) with subtle alert tilt
      sprite.stop();
      sprite.setFrame(0);

      obj.actionTween = this.tweens.add({
        targets: sprite,
        angle: { from: -1.2, to: 1.2 },
        y: { from: 0, to: -1.5 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // Biru: Sitting comfortably in armchair (Frame 24: sit_down_left)
      sprite.stop();
      sprite.setFrame(24);

      // Gentle relaxation breathing
      obj.breathTween = this.tweens.add({
        targets: sprite,
        y: { from: 0, to: -1 },
        duration: 1800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  public moveAgent(agentId: string, toX: number, toY: number, onArrival?: () => void) {
    const obj = this.agentMap.get(agentId);
    if (!obj || obj.isMoving) return;

    obj.isMoving = true;
    if (obj.breathTween) obj.breathTween.stop();
    if (obj.actionTween) obj.actionTween.stop();

    const dx = toX - obj.container.x;
    const dy = toY - obj.container.y;

    // Determine isometric direction for walking animation
    let walkDir = 'down_left';
    if (dx >= 0 && dy >= 0) {
      walkDir = 'down_right';
    } else if (dx < 0 && dy >= 0) {
      walkDir = 'down_left';
    } else if (dx >= 0 && dy < 0) {
      walkDir = 'up_right';
    } else {
      walkDir = 'up_left';
    }

    const walkAnimKey = `${obj.agent.id}_walk_${walkDir}`;
    if (this.anims.exists(walkAnimKey)) {
      obj.sprite.play(walkAnimKey);
    }

    const dist = Phaser.Math.Distance.Between(obj.container.x, obj.container.y, toX, toY);
    const duration = Math.max(dist * 7, 750);

    this.tweens.add({
      targets: obj.container,
      x: toX,
      y: toY,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        // Continuous isometric depth sorting while moving
        obj.container.setDepth(Math.round(obj.container.y));
      },
      onComplete: () => {
        obj.sprite.stop();
        obj.isMoving = false;
        obj.container.setDepth(Math.round(toY));
        this.updateAgentVisuals(obj);
        this.resolveBubbleCollisions();
        if (onArrival) onArrival();
      },
    });
  }

  public triggerTemporaryBubble(obj: AgentContainerObj, durationMs: number = 4500) {
    if (obj.bubbleDismissTimer) {
      obj.bubbleDismissTimer.remove(false);
    }
    obj.isBubbleTemporarilyVisible = true;
    this.updateAgentVisuals(obj);
    this.resolveBubbleCollisions();

    obj.bubbleDismissTimer = this.time.delayedCall(durationMs, () => {
      obj.isBubbleTemporarilyVisible = false;
      this.updateAgentVisuals(obj);
      this.resolveBubbleCollisions();
    });
  }

  public syncAgents(updatedAgents: Agent[]) {
    if (!this.agentMap || this.agentMap.size === 0) return;

    for (const updated of updatedAgents) {
      const obj = this.agentMap.get(updated.id);
      if (!obj) continue;

      const oldStatus = obj.agent.status;
      const oldTask = obj.agent.task;
      const oldDraft = obj.agent.draft;

      const statusChanged = oldStatus !== updated.status;
      const taskChanged = oldTask !== updated.task;
      const draftChanged = oldDraft !== updated.draft;

      if (statusChanged || taskChanged || draftChanged) {
        obj.agent.status = updated.status;
        obj.agent.task = updated.task;
        obj.agent.draft = updated.draft;

        this.updateAgentVisuals(obj);

        if (updated.status === 'santai' && oldStatus !== 'santai') {
          const spot = obj.agent.chillSpot || { x: 460, y: 530 };
          this.moveAgent(updated.id, spot.x, spot.y, () => {
            obj.sprite.setFrame(24);
          });
        } else if (updated.status !== 'santai' && oldStatus === 'santai') {
          this.moveAgent(updated.id, obj.agent.x, obj.agent.y);
          this.triggerTemporaryBubble(obj, 4500);
        } else if (statusChanged || taskChanged) {
          if (updated.status !== 'santai') {
            this.triggerTemporaryBubble(obj, 4500);
          }
        }
      }
    }
    this.resolveBubbleCollisions();
  }

  public updateAgentStatus(agentId: string, newStatus: AgentStatus, newTask?: string) {
    const obj = this.agentMap.get(agentId);
    if (!obj) return;

    const oldStatus = obj.agent.status;
    obj.agent.status = newStatus;
    if (newTask) obj.agent.task = newTask;

    this.updateAgentVisuals(obj);

    if (newStatus === 'santai' && oldStatus !== 'santai') {
      // Biru: Berjalan ke chill spot (lounge / game room / cafe), lalu sitting
      const spot = obj.agent.chillSpot || { x: 460, y: 530 };
      this.moveAgent(agentId, spot.x, spot.y, () => {
        obj.sprite.setFrame(24);
      });
    } else if (newStatus !== 'santai' && oldStatus === 'santai') {
      // Kembali dari santai ke meja kerja
      this.moveAgent(agentId, obj.agent.x, obj.agent.y);
      this.triggerTemporaryBubble(obj, 4500);
    } else {
      this.resolveBubbleCollisions();
      if (newStatus !== 'santai') {
        this.triggerTemporaryBubble(obj, 4500);
      }
    }
  }

  // Camera Drag & Zoom Controls
  private setupCameraControls() {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isCalibrating) return;
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging || this.isCalibrating) return;
      const dx = (pointer.x - this.dragStartX) / this.cameras.main.zoom;
      const dy = (pointer.y - this.dragStartY) / this.cameras.main.zoom;
      this.cameras.main.scrollX = this.camStartX - dx;
      this.cameras.main.scrollY = this.camStartY - dy;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Mouse scroll zoom
    this.input.on('wheel', (pointer: any, gameObjects: any, deltaX: number, deltaY: number) => {
      const zoomFactor = deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomFactor, 0.5, 2.5);
      this.cameras.main.zoomTo(newZoom, 150);
    });

    this.input.addPointer(2);
  }

  // Setup Calibration Mode Drag and Drop
  private setupCalibrationDrag() {
    this.input.on('dragstart', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      if (!this.isCalibrating) return;
      gameObject.setScale(1.15);
      gameObject.setDepth(10000);
    });

    this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container, dragX: number, dragY: number) => {
      if (!this.isCalibrating) return;
      gameObject.x = Math.round(dragX);
      gameObject.y = Math.round(dragY);

      const agentId = (gameObject as any).agentId;
      const obj = this.agentMap.get(agentId);
      if (obj) {
        obj.coordBadge.setText(`(${Math.round(dragX)}, ${Math.round(dragY)})`);
        obj.agent.x = Math.round(dragX);
        obj.agent.y = Math.round(dragY);
        this.resolveBubbleCollisions();
        if (this.callbacks.onPositionChange) {
          this.callbacks.onPositionChange(agentId, Math.round(dragX), Math.round(dragY));
        }
      }
    });

    this.input.on('dragend', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Container) => {
      if (!this.isCalibrating) return;
      gameObject.setScale(1.0);
      gameObject.setDepth(Math.round(gameObject.y));
      this.resolveBubbleCollisions();
    });
  }

  public setCalibrationMode(active: boolean) {
    this.isCalibrating = active;

    this.agentMap.forEach((obj) => {
      this.input.setDraggable(obj.container, active);
      obj.coordBadge.setVisible(active);
      if (active) {
        obj.halo.setVisible(true);
      } else {
        obj.halo.setVisible(false);
      }
    });
  }

  public getPositions(): { id: string; x: number; y: number }[] {
    const list: { id: string; x: number; y: number }[] = [];
    this.agentMap.forEach((obj, id) => {
      list.push({ id, x: Math.round(obj.container.x), y: Math.round(obj.container.y) });
    });
    return list;
  }

  public resetCamera() {
    this.centerCamera();
  }

  public zoomIn() {
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * 1.25, 0.5, 2.5);
    this.cameras.main.zoomTo(newZoom, 200);
  }

  public zoomOut() {
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * 0.8, 0.5, 2.5);
    this.cameras.main.zoomTo(newZoom, 200);
  }

  public selectAgent(agentId: string | null) {
    const prevId = this.selectedAgentId;
    this.selectedAgentId = agentId;
    if (prevId && prevId !== agentId) {
      const prevObj = this.agentMap.get(prevId);
      if (prevObj) this.updateAgentVisuals(prevObj);
    }
    if (agentId) {
      const newObj = this.agentMap.get(agentId);
      if (newObj) this.updateAgentVisuals(newObj);
    }
    this.resolveBubbleCollisions();
  }

  public focusAgent(agentId: string) {
    const obj = this.agentMap.get(agentId);
    if (!obj) return;
    this.selectAgent(agentId);
    this.cameras.main.pan(obj.container.x, obj.container.y - 25, 500, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.35, 500, 'Sine.easeInOut');
  }

  private getStatusColor(status: AgentStatus): number {
    switch (status) {
      case 'kerja':
        return 0x10b981; // Hijau
      case 'nunggu':
        return 0xf59e0b; // Kuning
      case 'santai':
        return 0x38bdf8; // Biru
    }
  }
}

export const OfficeScene = forwardRef<OfficeSceneHandle, OfficeSceneProps>(
  ({ agents, isCalibrating, onSelectAgent, onHoverAgent, onPositionChange }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<PhaserOfficeScene | null>(null);

    useImperativeHandle(ref, () => ({
      updateAgentStatus: (agentId: string, newStatus: AgentStatus, newTask?: string) => {
        if (sceneRef.current) {
          sceneRef.current.updateAgentStatus(agentId, newStatus, newTask);
        }
      },
      syncAgents: (updatedAgents: Agent[]) => {
        if (sceneRef.current) {
          sceneRef.current.syncAgents(updatedAgents);
        }
      },
      focusAgent: (agentId: string) => {
        if (sceneRef.current) {
          sceneRef.current.focusAgent(agentId);
        }
      },
      selectAgent: (agentId: string | null) => {
        if (sceneRef.current) {
          sceneRef.current.selectAgent(agentId);
        }
      },
      setCalibrationMode: (active: boolean) => {
        if (sceneRef.current) {
          sceneRef.current.setCalibrationMode(active);
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
      getPositions: () => {
        if (sceneRef.current) {
          return sceneRef.current.getPositions();
        }
        return [];
      },
    }));

    useEffect(() => {
      let isMounted = true;

      const initPhaser = async () => {
        if (!containerRef.current || gameRef.current) return;

        const width = containerRef.current.clientWidth || window.innerWidth;
        const height = containerRef.current.clientHeight || window.innerHeight;

        const scene = new PhaserOfficeScene();
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

        game.events.once('ready', () => {
          if (!isMounted) return;
          scene.scene.start('PhaserOfficeScene', {
            agents,
            isCalibrating,
            callbacks: {
              onSelectAgent,
              onHoverAgent,
              onPositionChange,
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

    // Sync calibration mode changes
    useEffect(() => {
      if (sceneRef.current) {
        sceneRef.current.setCalibrationMode(isCalibrating);
      }
    }, [isCalibrating]);

    // Reactive sync: When agents prop updates from API polling or approvals, sync to Phaser canvas!
    useEffect(() => {
      if (sceneRef.current && agents && agents.length > 0) {
        sceneRef.current.syncAgents(agents);
      }
    }, [agents]);

    return (
      <div
        ref={containerRef}
        id="office-scene-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          cursor: isCalibrating ? 'crosshair' : 'grab',
          overflow: 'hidden',
          touchAction: 'none',
          imageRendering: 'pixelated',
        }}
      />
    );
  }
);

OfficeScene.displayName = 'OfficeScene';
export default OfficeScene;
