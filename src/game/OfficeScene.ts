import * as Phaser from 'phaser';
import { Agent, AgentStatus } from '../types/agent';
import { gridToScreen, calculateDepth, TILE_WIDTH, TILE_HEIGHT } from './IsometricUtils';

export interface OfficeSceneCallbacks {
  onSelectAgent: (agent: Agent) => void;
  onHoverAgent: (agent: Agent | null) => void;
}

interface AgentGameObject {
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
  exclamationIcon?: Phaser.GameObjects.Image;
  currentGridX: number;
  currentGridY: number;
  isMoving: boolean;
  breathTween?: Phaser.Tweens.Tween;
  actionTween?: Phaser.Tweens.Tween;
  walkTween?: Phaser.Tweens.Tween;
  dotPulseTween?: Phaser.Tweens.Tween;
}

export class OfficeScene extends Phaser.Scene {
  private agentsData: Agent[] = [];
  private agentObjects: Map<string, AgentGameObject> = new Map();
  private callbacks?: OfficeSceneCallbacks;

  // Origin point of isometric grid
  private originX: number = 640;
  private originY: number = 240;

  // Camera pan & zoom tracking
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private camStartX: number = 0;
  private camStartY: number = 0;

  // Ambient elements
  private plants: Phaser.GameObjects.Image[] = [];
  private neonTvs: Phaser.GameObjects.Image[] = [];
  private monitors: Phaser.GameObjects.Image[] = [];
  private cityWindows: Phaser.GameObjects.Image[] = [];
  private dustEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor() {
    super({ key: 'OfficeScene' });
  }

  public init(data: { agents: Agent[]; callbacks: OfficeSceneCallbacks }) {
    this.agentsData = data.agents || [];
    this.callbacks = data.callbacks;
  }

  public preload() {
    // 1. Tiles
    this.load.image('floor_wood', '/assets/tiles/floor_wood.png');
    this.load.image('floor_meeting', '/assets/tiles/floor_meeting.png');
    this.load.image('floor_builder', '/assets/tiles/floor_builder.png');
    this.load.image('floor_open_workspace', '/assets/tiles/floor_open_workspace.png');
    this.load.image('floor_game', '/assets/tiles/floor_game.png');
    this.load.image('floor_lounge', '/assets/tiles/floor_lounge.png');
    this.load.image('floor_cafe', '/assets/tiles/floor_cafe.png');
    this.load.image('floor_hallway', '/assets/tiles/floor_hallway.png');
    this.load.image('wall_window_city', '/assets/tiles/wall_window_city.png');
    this.load.image('glass_partition', '/assets/tiles/glass_partition.png');

    // 2. Furniture
    this.load.image('desk_wood_boss', '/assets/furniture/desk_wood_boss.png');
    this.load.image('chesterfield_sofa', '/assets/furniture/chesterfield_sofa.png');
    this.load.image('bookshelf', '/assets/furniture/bookshelf.png');
    this.load.image('meeting_table', '/assets/furniture/meeting_table.png');
    this.load.image('work_desk_multimonitor', '/assets/furniture/work_desk_multimonitor.png');
    this.load.image('server_rack', '/assets/furniture/server_rack.png');
    this.load.image('billiard_table', '/assets/furniture/billiard_table.png');
    this.load.image('arcade_cabinet', '/assets/furniture/arcade_cabinet.png');
    this.load.image('neon_tv', '/assets/furniture/neon_tv.png');
    this.load.image('bean_bag', '/assets/furniture/bean_bag.png');
    this.load.image('lounge_sofa', '/assets/furniture/lounge_sofa.png');
    this.load.image('coffee_table', '/assets/furniture/coffee_table.png');
    this.load.image('cafe_bar', '/assets/furniture/cafe_bar.png');
    this.load.image('bar_stool', '/assets/furniture/bar_stool.png');
    this.load.image('round_table', '/assets/furniture/round_table.png');
    this.load.image('potted_plant', '/assets/furniture/potted_plant.png');

    // 3. Characters (Spritesheets: 6 frames of 32x48)
    const charIds = ['elfano', 'pompom', 'zekky', 'bobby', 'kunyuk', 'amoy', 'jojo', 'oyen'];
    charIds.forEach((id) => {
      this.load.spritesheet(`char_${id}`, `/assets/characters/${id}.png`, {
        frameWidth: 32,
        frameHeight: 48,
      });
    });

    // 4. Effects
    this.load.image('dust_particle', '/assets/effects/dust_particle.png');
    this.load.image('exclamation', '/assets/effects/exclamation.png');
    this.load.image('selection_halo', '/assets/effects/selection_halo.png');
  }

  public create() {
    this.cameras.main.setBackgroundColor('#0b1530');

    // Build the isometric layout
    this.buildNorthWallAndWindows();
    this.buildFloorGrid();
    this.buildZoneDividers();
    this.buildFurniture();
    this.setupAmbientLightingAndParticles();

    // Spawn agents
    this.spawnAgents();

    // Setup interactive camera
    this.setupCameraControls();

    // Initial camera position centered on office
    const centerPt = gridToScreen(10, 10, this.originX, this.originY);
    this.cameras.main.centerOn(centerPt.x, centerPt.y);
    this.cameras.main.setZoom(1.05);
  }

  // 1. NORTH WALL & WINDOWS WITH CITY SKYLINE
  private buildNorthWallAndWindows() {
    for (let gx = 1; gx <= 19; gx += 2) {
      const pt = gridToScreen(gx, 0.5, this.originX, this.originY);
      const wall = this.add.image(pt.x, pt.y - 32, 'wall_window_city');
      wall.setOrigin(0.5, 0.85);
      wall.setDepth(calculateDepth(gx, 0, -50));
      this.cityWindows.push(wall);

      // Subtle twinkling ambient on window
      this.tweens.add({
        targets: wall,
        alpha: { from: 0.92, to: 1 },
        duration: 2400 + Math.random() * 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // 2. ISOMETRIC FLOOR GRID
  private buildFloorGrid() {
    // 20 x 20 isometric office floor
    for (let gy = 1; gy <= 19; gy++) {
      for (let gx = 1; gx <= 19; gx++) {
        let tileKey = 'floor_hallway';

        // Zone 1: Ruang Bos (kiri atas)
        if (gx >= 1 && gx <= 6 && gy >= 1 && gy <= 6) {
          tileKey = 'floor_wood';
        }
        // Zone 2: Ruang Meeting Kaca (tengah atas)
        else if (gx >= 8 && gx <= 13 && gy >= 1 && gy <= 6) {
          tileKey = 'floor_meeting';
        }
        // Zone 3: Ruang Kaca Kanan Atas (Builder)
        else if (gx >= 15 && gx <= 19 && gy >= 1 && gy <= 6) {
          tileKey = 'floor_builder';
        }
        // Zone 4: Area Kerja Terbuka
        else if (gx >= 6 && gx <= 14 && gy >= 7 && gy <= 12) {
          tileKey = 'floor_open_workspace';
        }
        // Zone 5: Game Room (kiri bawah)
        else if (gx >= 1 && gx <= 5 && gy >= 12 && gy <= 19) {
          tileKey = 'floor_game';
        }
        // Zone 6: Lounge (tengah bawah)
        else if (gx >= 7 && gx <= 12 && gy >= 13 && gy <= 19) {
          tileKey = 'floor_lounge';
        }
        // Zone 7: Cafe (kanan bawah)
        else if (gx >= 14 && gx <= 19 && gy >= 13 && gy <= 19) {
          tileKey = 'floor_cafe';
        }

        const pt = gridToScreen(gx, gy, this.originX, this.originY);
        const tile = this.add.image(pt.x, pt.y, tileKey);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(0); // Floors stay on base layer
      }
    }
  }

  // 3. ZONE DIVIDERS & GLASS PARTITIONS
  private buildZoneDividers() {
    // Glass walls for Meeting Room
    const glassPoints = [
      { gx: 7.5, gy: 2 },
      { gx: 7.5, gy: 4 },
      { gx: 7.5, gy: 6 },
      { gx: 10, gy: 6.5 },
      { gx: 12, gy: 6.5 },
      // Builder Room Glass
      { gx: 14.5, gy: 2 },
      { gx: 14.5, gy: 4 },
      { gx: 14.5, gy: 6 },
    ];

    glassPoints.forEach(({ gx, gy }) => {
      const pt = gridToScreen(gx, gy, this.originX, this.originY);
      const glass = this.add.image(pt.x, pt.y - 12, 'glass_partition');
      glass.setOrigin(0.5, 0.7);
      glass.setDepth(calculateDepth(gx, gy, 15));
      glass.setAlpha(0.85);
    });
  }

  // 4. FURNITURE PLACEMENT ACROSS ALL 8 ZONES
  private buildFurniture() {
    // ZONE 1: Ruang Bos (kiri atas)
    this.placeFurniture('bookshelf', 2, 2, 0.5, 0.85);
    this.placeFurniture('desk_wood_boss', 3.5, 4, 0.5, 0.75);
    this.placeFurniture('chesterfield_sofa', 4.5, 6, 0.5, 0.7);
    this.placePlant(2, 5.5);

    // ZONE 2: Ruang Meeting Kaca (tengah atas)
    this.placeFurniture('meeting_table', 10.5, 3.8, 0.5, 0.7);
    this.placePlant(8.2, 2);
    this.placePlant(13, 2);

    // ZONE 3: Ruang Kaca Kanan Atas (Builder Room)
    this.placeFurniture('server_rack', 18, 2.5, 0.5, 0.85);
    this.placeFurniture('work_desk_multimonitor', 16, 4, 0.5, 0.75);
    this.placePlant(18, 5.5);

    // ZONE 4: Area Kerja Terbuka (4 meja dengan 2-3 monitor)
    const monitor1 = this.placeFurniture('work_desk_multimonitor', 7.5, 8, 0.5, 0.75);
    const monitor2 = this.placeFurniture('work_desk_multimonitor', 11.5, 8, 0.5, 0.75);
    const monitor3 = this.placeFurniture('work_desk_multimonitor', 7.5, 10.5, 0.5, 0.75);
    const monitor4 = this.placeFurniture('work_desk_multimonitor', 11.5, 10.5, 0.5, 0.75);
    this.monitors.push(monitor1, monitor2, monitor3, monitor4);

    this.placePlant(6, 7);
    this.placePlant(13, 7);
    this.placePlant(6, 12);
    this.placePlant(13, 12);

    // ZONE 5: Game Room (kiri bawah)
    this.placeFurniture('billiard_table', 3.5, 14.5, 0.5, 0.7);
    this.placeFurniture('arcade_cabinet', 2, 12.5, 0.5, 0.85);
    const tv = this.placeFurniture('neon_tv', 2, 16.5, 0.5, 0.8);
    this.neonTvs.push(tv);
    this.placeFurniture('bean_bag', 4.5, 17.5, 0.5, 0.65);
    this.placeFurniture('bean_bag', 3, 18, 0.5, 0.65);

    // Neon TV pulsing ambient glow
    this.tweens.add({
      targets: tv,
      alpha: { from: 0.85, to: 1.0 },
      scaleY: { from: 1, to: 1.03 },
      duration: 1200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ZONE 6: Lounge (tengah bawah)
    this.placeFurniture('lounge_sofa', 9, 14.5, 0.5, 0.7);
    this.placeFurniture('coffee_table', 9.5, 16, 0.5, 0.7);
    this.placePlant(7.5, 17.5);
    this.placePlant(11.5, 17.5);

    // ZONE 7: Cafe (kanan bawah)
    this.placeFurniture('cafe_bar', 16, 13.5, 0.5, 0.75);
    this.placeFurniture('bar_stool', 14.5, 14.2, 0.5, 0.8);
    this.placeFurniture('bar_stool', 16.5, 14.5, 0.5, 0.8);
    this.placeFurniture('round_table', 17.5, 17, 0.5, 0.7);
    this.placePlant(14, 18.5);

    // Corridor decoration plants
    this.placePlant(1, 1);
    this.placePlant(19, 1);
  }

  private placeFurniture(
    key: string,
    gx: number,
    gy: number,
    originX: number = 0.5,
    originY: number = 0.75
  ): Phaser.GameObjects.Image {
    const pt = gridToScreen(gx, gy, this.originX, this.originY);
    const item = this.add.image(pt.x, pt.y, key);
    item.setOrigin(originX, originY);
    item.setDepth(calculateDepth(gx, gy, 10));
    return item;
  }

  private placePlant(gx: number, gy: number): Phaser.GameObjects.Image {
    const pt = gridToScreen(gx, gy, this.originX, this.originY);
    const plant = this.add.image(pt.x, pt.y, 'potted_plant');
    plant.setOrigin(0.5, 0.85);
    plant.setDepth(calculateDepth(gx, gy, 12));
    this.plants.push(plant);

    // Ambient: plant gentle swaying animation
    this.tweens.add({
      targets: plant,
      angle: { from: -1.5, to: 1.5 },
      duration: 2500 + Math.random() * 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return plant;
  }

  // 5. AMBIENT PARTICLES (FLOATING LIGHT DUST)
  private setupAmbientLightingAndParticles() {
    // Ambient dust particles floating in the light beams
    const particles = this.add.particles(0, 0, 'dust_particle', {
      x: { min: 200, max: 1100 },
      y: { min: 100, max: 700 },
      speedX: { min: -6, max: 6 },
      speedY: { min: -10, max: -3 },
      scale: { start: 0.5, end: 1.1 },
      alpha: { start: 0, end: 0.7, ease: 'Sine.easeInOut' },
      lifespan: 6000,
      frequency: 250,
      blendMode: 'ADD',
    });
    particles.setDepth(9999);
    this.dustEmitters.push(particles);
  }

  // 6. SPAWN AGENTS WITH ANIMATIONS & LABELS
  private spawnAgents() {
    this.agentsData.forEach((agent) => {
      // Determine starting grid position
      const deskPos = agent.desk || { x: agent.x, y: agent.y };
      const targetGrid = agent.status === 'santai' ? agent.chillSpot : deskPos;
      const pt = gridToScreen(targetGrid.x, targetGrid.y, this.originX, this.originY);

      // Main container for character & overlays
      const container = this.add.container(pt.x, pt.y);
      container.setDepth(calculateDepth(targetGrid.x, targetGrid.y, 20));

      // 1. Soft floor shadow
      const shadow = this.add.ellipse(0, 4, 22, 10, 0x000000, 0.35);
      container.add(shadow);

      // 2. Selection / Hover Halo (hidden by default)
      const halo = this.add.image(0, 4, 'selection_halo');
      halo.setOrigin(0.5, 0.5);
      halo.setVisible(false);
      halo.setAlpha(0.8);
      container.add(halo);

      // 3. Character Sprite (using generated spritesheet)
      const sprite = this.add.sprite(0, -18, `char_${agent.id}`, 0);
      sprite.setOrigin(0.5, 0.5);
      container.add(sprite);

      // 4. Name Label (Dark rounded pill with status dot)
      const labelContainer = this.add.container(0, -46);
      const labelBg = this.add.graphics();
      const labelText = this.add.text(8, 0, agent.name, {
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#f8fafc',
      }).setOrigin(0, 0.5);

      const statusCol = this.getStatusColorHex(agent.status);

      // Pulsing glow circle for yellow/green
      const statusDotPulse = this.add.circle(0, 0, 5, statusCol, 0.4);
      const statusDot = this.add.circle(0, 0, 3.5, statusCol, 1);

      labelContainer.add([labelBg, statusDotPulse, statusDot, labelText]);
      container.add(labelContainer);

      // 5. Speech Bubble
      const bubbleContainer = this.add.container(0, -78);
      const bubbleBg = this.add.graphics();
      const bubbleTail = this.add.triangle(0, 16, -5, 0, 5, 0, 0, 8, 0x0f172a);
      const bubbleText = this.add.text(0, 0, '', {
        fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        fontSize: '11px',
        color: '#f1f5f9',
        wordWrap: { width: 170 },
        align: 'center',
      }).setOrigin(0.5, 0.5);

      bubbleContainer.add([bubbleBg, bubbleTail, bubbleText]);
      container.add(bubbleContainer);

      // 6. Exclamation mark for yellow status
      const exclamationIcon = this.add.image(14, -48, 'exclamation');
      exclamationIcon.setOrigin(0.5, 0.5);
      exclamationIcon.setVisible(agent.status === 'nunggu');
      container.add(exclamationIcon);

      // Interactive hit area on container
      container.setSize(44, 60);
      container.setInteractive({ useHandCursor: true });

      // Save state object
      const agentObj: AgentGameObject = {
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
        currentGridX: targetGrid.x,
        currentGridY: targetGrid.y,
        isMoving: false,
      };

      this.agentObjects.set(agent.id, agentObj);

      // Draw initial UI elements
      this.updateAgentVisuals(agentObj);

      // Setup Events: Hover & Click
      container.on('pointerover', () => {
        halo.setVisible(true);
        this.tweens.add({
          targets: [container],
          scale: 1.08,
          duration: 150,
          ease: 'Back.easeOut',
        });
        if (this.callbacks) this.callbacks.onHoverAgent(agent);
      });

      container.on('pointerout', () => {
        halo.setVisible(false);
        this.tweens.add({
          targets: [container],
          scale: 1.0,
          duration: 150,
          ease: 'Quad.easeOut',
        });
        if (this.callbacks) this.callbacks.onHoverAgent(null);
      });

      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        // Prevent trigger during pan drag
        if (pointer.getDistance() > 6) return;
        if (this.callbacks) {
          this.callbacks.onSelectAgent(agent);
        }
      });
    });
  }

  // 7. VISUAL UPDATES & ANIMATIONS BASED ON STATUS
  private updateAgentVisuals(obj: AgentGameObject) {
    const { agent, labelBg, labelText, statusDot, statusDotPulse, bubbleContainer, bubbleBg, bubbleText, exclamationIcon } = obj;

    // A. Update Status Dot Colors
    const statusCol = this.getStatusColorHex(agent.status);
    statusDot.setFillStyle(statusCol, 1);
    statusDotPulse.setFillStyle(statusCol, 0.4);

    // Stop existing pulse tween
    if (obj.dotPulseTween) obj.dotPulseTween.stop();

    if (agent.status === 'nunggu') {
      // Yellow pulsing dot
      obj.dotPulseTween = this.tweens.add({
        targets: statusDotPulse,
        scale: { from: 1, to: 2.2 },
        alpha: { from: 0.6, to: 0 },
        duration: 1000,
        repeat: -1,
      });
      if (exclamationIcon) {
        exclamationIcon.setVisible(true);
        this.tweens.add({
          targets: exclamationIcon,
          y: { from: -48, to: -54 },
          duration: 600,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      if (exclamationIcon) exclamationIcon.setVisible(false);
      statusDotPulse.setScale(1).setAlpha(0);
    }

    // B. Draw Rounded Pill Label
    const textBounds = labelText.getBounds();
    const pillW = textBounds.width + 28;
    const pillH = 20;
    labelBg.clear();
    labelBg.fillStyle(0x0f172a, 0.92);
    labelBg.lineStyle(1.2, 0x334155, 0.9);
    labelBg.fillRoundedRect(-14, -pillH / 2, pillW, pillH, 10);
    labelBg.strokeRoundedRect(-14, -pillH / 2, pillW, pillH, 10);

    // C. Speech Bubble Setup
    // Status kuning: "Nunggu keputusanmu: <tugas>"
    // Status hijau: "Aku lagi mengerjakan: <tugas>"
    // Status biru: tanpa bubble!
    if (agent.status === 'santai') {
      // Hide bubble with smooth fade out
      this.tweens.add({
        targets: bubbleContainer,
        scale: 0,
        alpha: 0,
        duration: 200,
        ease: 'Quad.easeIn',
        onComplete: () => bubbleContainer.setVisible(false),
      });
    } else {
      let message = '';
      let accentBorder = 0x3b82f6;

      if (agent.status === 'nunggu') {
        message = `Nunggu keputusanmu: ${agent.task}`;
        accentBorder = 0xf59e0b;
      } else if (agent.status === 'kerja') {
        message = `Aku lagi mengerjakan: ${agent.task}`;
        accentBorder = 0x10b981;
      }

      bubbleText.setText(message);
      const bBounds = bubbleText.getBounds();
      const bW = Math.max(bBounds.width + 20, 100);
      const bH = bBounds.height + 14;

      bubbleBg.clear();
      // Dark rounded speech bubble with glowing border
      bubbleBg.fillStyle(0x0b1329, 0.96);
      bubbleBg.lineStyle(1.5, accentBorder, 0.85);
      bubbleBg.fillRoundedRect(-bW / 2, -bH / 2, bW, bH, 10);
      bubbleBg.strokeRoundedRect(-bW / 2, -bH / 2, bW, bH, 10);

      // Tail color
      obj.bubbleTail.setFillStyle(0x0b1329);

      // Pop Animation (0 -> 1.1 -> 1.0)
      bubbleContainer.setVisible(true);
      bubbleContainer.setScale(0);
      bubbleContainer.setAlpha(0);
      this.tweens.add({
        targets: bubbleContainer,
        scale: { from: 0, to: 1.0 },
        alpha: { from: 0, to: 1.0 },
        duration: 350,
        ease: 'Back.easeOut',
      });
    }

    // D. Character Animations: Idle breath, Typing/Work, or Chill walk
    this.applyCharacterAnimation(obj);
  }

  private applyCharacterAnimation(obj: AgentGameObject) {
    const { agent, sprite } = obj;

    // Stop existing tweens
    if (obj.breathTween) obj.breathTween.stop();
    if (obj.actionTween) obj.actionTween.stop();

    if (agent.status === 'kerja') {
      // Status hijau: animasi mengetik di keyboard
      // Rapid frame oscillation between 0 and 4 (typing frame)
      sprite.setFrame(4);
      obj.actionTween = this.tweens.add({
        targets: sprite,
        y: { from: -18, to: -19 },
        duration: 180,
        yoyo: true,
        repeat: -1,
        ease: 'Linear',
      });
    } else if (agent.status === 'nunggu') {
      // Status kuning: melambai / alert frame
      sprite.setFrame(5);
      obj.actionTween = this.tweens.add({
        targets: sprite,
        angle: { from: -2, to: 2 },
        y: { from: -18, to: -20 },
        duration: 400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      // Status biru: santai / idle breathing
      sprite.setFrame(0);
      obj.breathTween = this.tweens.add({
        targets: sprite,
        y: { from: -18, to: -20 },
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  // 8. TRANSITION AGENT BETWEEN DESK AND CHILL SPOT
  public moveAgent(agentId: string, toSpot: { x: number; y: number }) {
    const obj = this.agentObjects.get(agentId);
    if (!obj || obj.isMoving) return;

    obj.isMoving = true;
    const destScreen = gridToScreen(toSpot.x, toSpot.y, this.originX, this.originY);

    // Alternate walking frames during movement
    let walkTimer: Phaser.Time.TimerEvent | undefined = this.time.addEvent({
      delay: 200,
      callback: () => {
        const cur = obj.sprite.frame.name;
        obj.sprite.setFrame(cur === '2' ? 3 : 2);
      },
      loop: true,
    });

    const dist = Phaser.Math.Distance.Between(obj.container.x, obj.container.y, destScreen.x, destScreen.y);
    const duration = Math.max(dist * 7, 800); // realistic walking pace

    this.tweens.add({
      targets: obj.container,
      x: destScreen.x,
      y: destScreen.y,
      duration,
      ease: 'Linear',
      onUpdate: () => {
        // Dynamically update depth while walking
        const curGrid = this.estimateCurrentGrid(obj.container.x, obj.container.y);
        obj.container.setDepth(calculateDepth(curGrid.x, curGrid.y, 20));
      },
      onComplete: () => {
        if (walkTimer) {
          walkTimer.remove();
          walkTimer = undefined;
        }
        obj.currentGridX = toSpot.x;
        obj.currentGridY = toSpot.y;
        obj.isMoving = false;
        obj.container.setDepth(calculateDepth(toSpot.x, toSpot.y, 20));
        this.updateAgentVisuals(obj);
      },
    });
  }

  // 9. UPDATE STATUS FROM REACT
  public updateAgentStatus(agentId: string, newStatus: AgentStatus, newTask?: string) {
    const obj = this.agentObjects.get(agentId);
    if (!obj) return;

    const oldStatus = obj.agent.status;
    obj.agent.status = newStatus;
    if (newTask) obj.agent.task = newTask;

    // If switching to 'santai', walk to chill spot
    if (newStatus === 'santai' && oldStatus !== 'santai') {
      this.moveAgent(agentId, obj.agent.chillSpot);
    }
    // If switching from 'santai' to 'kerja' or 'nunggu', walk back to desk!
    else if (newStatus !== 'santai' && oldStatus === 'santai') {
      const deskPos = obj.agent.desk || { x: obj.agent.x, y: obj.agent.y };
      this.moveAgent(agentId, deskPos);
    } else {
      this.updateAgentVisuals(obj);
    }
  }

  // 10. CAMERA CONTROLS (PAN & ZOOM)
  private setupCameraControls() {
    // Pointer Drag for Panning
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dx = (pointer.x - this.dragStartX) / this.cameras.main.zoom;
      const dy = (pointer.y - this.dragStartY) / this.cameras.main.zoom;
      this.cameras.main.scrollX = this.camStartX - dx;
      this.cameras.main.scrollY = this.camStartY - dy;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Scroll Wheel for Zooming
    this.input.on('wheel', (pointer: Phaser.Input.Pointer, gameObjects: any, deltaX: number, deltaY: number) => {
      const zoomFactor = deltaY > 0 ? 0.92 : 1.08;
      const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * zoomFactor, 0.65, 2.2);
      this.cameras.main.zoomTo(newZoom, 150);
    });
  }

  // Public camera helper methods
  public resetCamera() {
    const centerPt = gridToScreen(10, 10, this.originX, this.originY);
    this.cameras.main.pan(centerPt.x, centerPt.y, 600, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.05, 600, 'Sine.easeInOut');
  }

  public zoomIn() {
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * 1.25, 0.65, 2.2);
    this.cameras.main.zoomTo(newZoom, 250);
  }

  public zoomOut() {
    const newZoom = Phaser.Math.Clamp(this.cameras.main.zoom * 0.8, 0.65, 2.2);
    this.cameras.main.zoomTo(newZoom, 250);
  }

  public focusAgent(agentId: string) {
    const obj = this.agentObjects.get(agentId);
    if (!obj) return;
    this.cameras.main.pan(obj.container.x, obj.container.y - 40, 500, 'Sine.easeInOut');
    this.cameras.main.zoomTo(1.4, 500, 'Sine.easeInOut');
  }

  private getStatusColorHex(status: AgentStatus): number {
    switch (status) {
      case 'kerja':
        return 0x10b981; // emerald green
      case 'nunggu':
        return 0xf59e0b; // amber yellow
      case 'santai':
        return 0x38bdf8; // sky blue
    }
  }

  private estimateCurrentGrid(sx: number, sy: number) {
    const dx = sx - this.originX;
    const dy = sy - this.originY;
    const gx = (dx / (TILE_WIDTH / 2) + dy / (TILE_HEIGHT / 2)) / 2;
    const gy = (dy / (TILE_HEIGHT / 2) - dx / (TILE_WIDTH / 2)) / 2;
    return { x: Math.round(gx), y: Math.round(gy) };
  }
}
