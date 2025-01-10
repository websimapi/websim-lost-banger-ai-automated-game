import { GameState } from './gameState.js';
import { Chunk } from './chunk.js';
import { NPCInventory } from './inventory.js';
import { NPCCrafting } from './crafting.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.stateIndicator = document.getElementById('state-indicator');
    this.actionLog = document.getElementById('action-log');
    this.skipBtn = document.getElementById('skip-btn');
    this.startBtn = document.getElementById('start-btn');
    this.audio = document.getElementById('bgMusic');
    this.countdownTimer = document.getElementById('countdown-timer');
    this.timerValue = document.getElementById('timer-value');
    this.countdownInterval = null;
    this.currentState = null;
    this.cooldown = false;
    this.started = false;
    this.actionHistory = [];
    this.autonomousInterval = null;
    this.chunks = new Map();
    this.chunkSize = 1000;
    this.loadedChunks = new Set();
    this.lastChunkUpdate = 0;
    this.lastAutonomousMove = Date.now();
    this.audioContext = null;
    this.audioAnalyser = null;
    this.audioData = null;
    this.collectibles = [];
    this.inventory = new NPCInventory();
    this.crafting = new NPCCrafting(this.inventory, this);
    this.structures = [];
    this.spawnedStructures = [];
    if (!localStorage.getItem('baseCollectibles')) {
      localStorage.setItem('baseCollectibles', JSON.stringify([{
        type: 'stardust',
        color: '#00ffff',
        value: 10
      }, {
        type: 'cosmicShard',
        color: '#ff00ff',
        value: 20
      }, {
        type: 'voidEssence',
        color: '#ffff00',
        value: 30
      }]));
    }
    if (!localStorage.getItem('godIdeas')) {
      localStorage.setItem('godIdeas', JSON.stringify([]));
    }
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', () => this.skipCooldown());
    }
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => this.startGame());
    }
    this.skipBtn?.classList.add('hidden');
    this.stateIndicator?.classList.add('hidden');
    this.actionLog?.classList.add('hidden');
    this.countdownTimer?.classList.add('hidden');
    this.targetPosition = { x: 0, y: 0 };
    this.currentPosition = { x: 0, y: 0 };
    this.movementSpeed = 0.5; // Lower = slower movement
    this.isMoving = false;
    this.lastBehaviorTime = Date.now();
    this.behaviorCooldown = 2000; // Time between autonomous behaviors
    this.placedObjects = [];
    this.baseColors = ['#ffffff', '#88ffff', '#ff88ff', '#ffff88'];
    this.currentColorIndex = 0;
    this.colorTransitionSpeed = 0.01;

    this.startIdleAnimation();
  }

  createNPC() {
    const npcSvg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    npcSvg.setAttribute("cx", 0);
    npcSvg.setAttribute("cy", 0);
    npcSvg.setAttribute("r", "20");
    npcSvg.setAttribute("fill", "white");
    npcSvg.classList.add('npc');
    this.canvas.appendChild(npcSvg);
    return npcSvg;
  }

  logAction(action) {
    if (!this.actionLog) return;
    this.actionHistory.unshift(`[${new Date().toLocaleTimeString()}] ${action}`);
    if (this.actionHistory.length > 10) this.actionHistory.pop();
    this.actionLog.innerHTML = this.actionHistory.join('<br>');
  }

  initialize() {
    if (!this.npc) {
      this.npc = this.createNPC();
    }
    this.updateVisibleChunks();
  }

  updateVisibleChunks() {
    const npcX = parseFloat(this.npc?.getAttribute("cx")) || 0;
    const npcY = parseFloat(this.npc?.getAttribute("cy")) || 0;
    const currentChunkX = Math.floor(npcX / this.chunkSize);
    const currentChunkY = Math.floor(npcY / this.chunkSize);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const chunkX = currentChunkX + dx;
        const chunkY = currentChunkY + dy;
        const key = `${chunkX},${chunkY}`;
        if (!this.chunks.has(key)) {
          const chunk = new Chunk(chunkX, chunkY);
          this.chunks.set(key, chunk);
          this.canvas.appendChild(chunk.element);
          chunk.collectibles.forEach(c => this.collectibles.push(c));
        }
      }
    }
    for (const [key, chunk] of this.chunks) {
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x - currentChunkX) > 3 || Math.abs(y - currentChunkY) > 3) {
        chunk.element.remove();
        this.chunks.delete(key);
        chunk.collectibles.forEach(c => {
          const index = this.collectibles.indexOf(c);
          if (index > -1) this.collectibles.splice(index, 1);
        });
      }
    }
  }

  startGame() {
    if (this.started) return;
    this.started = true;
    this.startBtn?.classList.add('hidden');
    this.skipBtn?.classList.remove('hidden');
    this.stateIndicator?.classList.remove('hidden');
    this.actionLog?.classList.remove('hidden');
    this.countdownTimer?.classList.remove('hidden');
    this.audio?.play().catch(e => console.log('Audio playback failed:', e));
    this.initAudio();
    this.startGameLoop();
    this.startCountdown(180);
    this.startAutonomousBehavior();
    this.inventory.show();
  }

  async getAIAction(state) {
    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: `Generate a creative action for the ${state} state in the Lost Banger game.
For NPC: Focus on movement patterns, interactions with structures, and emotional states.
For God: Create grand cosmic structures and environmental effects that persist and can be interacted with.
For Ambient: Generate atmospheric changes that enhance the space theme.

Current structures in world: ${this.structures.length}
NPC position: (${this.npc?.getAttribute("cx") || 0}, ${this.npc?.getAttribute("cy") || 0})
Last 3 actions: ${this.actionHistory.slice(0, 3).join(', ')}

<typescript-interface>
interface Response {
  action: string;
  description: string;
  parameters: {
    x?: number;
    y?: number;
    color?: string;
    scale?: number;
    effect?: string;
    duration?: number;
    intensity?: number;
    pattern?: string;
    structure?: {
      type: string;
      interactive: boolean;
      size: number;
    }
  }
}
</typescript-interface>
`,
          data: {
            currentState: state,
            gameTime: Date.now(),
            previousActions: this.actionHistory
          }
        })
      });
      return await response.json();
    } catch (error) {
      console.error('AI Action Error:', error);
      return null;
    }
  }

  async executeState() {
    this.lastAutonomousMove = Date.now() + 10000;
    const states = [GameState.NPC, GameState.GOD, GameState.AMBIENT];
    this.currentState = states[Math.floor(Math.random() * states.length)];
    if (this.stateIndicator) {
      this.stateIndicator.textContent = `Current State: ${this.currentState}`;
      this.stateIndicator.style.background = this.currentState === GameState.NPC ? 'rgba(0,255,255,0.3)' : this.currentState === GameState.GOD ? 'rgba(255,0,255,0.3)' : 'rgba(255,255,0,0.3)';
    }
    try {
      const action = await this.getAIAction(this.currentState);
      if (action) {
        this.logAction(`${this.currentState}: ${action.description}`);
        switch (this.currentState) {
          case GameState.NPC:
            this.handleNPCAction(action);
            break;
          case GameState.GOD:
            this.handleGodAction(action);
            break;
          case GameState.AMBIENT:
            this.handleAmbientAction(action);
            break;
        }
      }
    } catch (error) {
      console.error('Error executing state:', error);
    }
  }

  handleNPCAction(action) {
    if (!action || !action.parameters) return;
    const duration = action.parameters.duration || 4000;
    const targetX = action.parameters.x || parseFloat(this.npc?.getAttribute("cx")) || 0;
    const targetY = action.parameters.y || parseFloat(this.npc?.getAttribute("cy")) || 0;
    this.animateNPCTo(targetX, targetY, duration);
    if (action.parameters.color) {
      this.npc?.setAttribute("fill", action.parameters.color);
    }
    if (action.parameters.pattern === 'trail') {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          const trail = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          trail.setAttribute("cx", this.npc?.getAttribute("cx") || 0);
          trail.setAttribute("cy", this.npc?.getAttribute("cy") || 0);
          trail.setAttribute("r", "5");
          trail.setAttribute("fill", action.parameters.color || "white");
          trail.style.opacity = "0.5";
          trail.style.animation = "glow 2s infinite";
          this.canvas.appendChild(trail);
          setTimeout(() => trail.remove(), 2000);
        }, i * 200);
      }
    }
  }

  handleGodAction(action) {
    if (!action || !action.parameters) return;
    const duration = action.parameters.duration || 3000;
    let godIdeas = JSON.parse(localStorage.getItem('godIdeas') || '[]');
    godIdeas.push({
      timestamp: Date.now(),
      action: action,
      implemented: false
    });
    localStorage.setItem('godIdeas', JSON.stringify(godIdeas));
    const structure = document.createElementNS("http://www.w3.org/2000/svg", "g");
    structure.classList.add('god-structure');
    const patterns = ['observatory', 'portal', 'crystal', 'nebula'];
    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    switch (pattern) {
      case 'observatory':
        structure.innerHTML = `<path d="M-50,-50 L50,50 M-50,50 L50,-50" stroke="${action.parameters.color || '#fff'}"/>`;
        break;
      case 'portal':
        structure.innerHTML = `<circle r="30" fill="none" stroke="${action.parameters.color || '#fff'}"/>`;
        break;
      case 'crystal':
        structure.innerHTML = `<polygon points="0,-40 35,20 -35,20" stroke="${action.parameters.color || '#fff'}" fill="none"/>`;
        break;
      case 'nebula':
        structure.innerHTML = `<path d="M0,0 C50,50 100,50 150,0" stroke="${action.parameters.color || '#fff'}" fill="none"/>`;
        break;
    }
    const posX = action.parameters.x || 0;
    const posY = action.parameters.y || 0;
    structure.setAttribute('transform', `translate(${posX},${posY})`);
    this.canvas.appendChild(structure);
    this.structures.push(structure);
    if (action.parameters.effect === 'invert') {
      document.body.style.filter = 'invert(1)';
      setTimeout(() => document.body.style.filter = '', duration);
    } else if (action.parameters.effect === 'psychedelic') {
      document.body.style.animation = `hue-rotate ${duration}ms linear`;
      setTimeout(() => {
        document.body.style.animation = '';
      }, duration);
    }
    if (action.parameters.intensity) {
      const shake = Math.min(action.parameters.intensity * 20, 50);
      this.canvas.style.transform = `translate(${shake}px, ${shake}px)`;
      setTimeout(() => {
        this.canvas.style.transform = `translate(0px, 0px)`;
      }, duration);
    }
    document.body.classList.add('god-active');
    setTimeout(() => document.body.classList.remove('god-active'), duration);
    const implementPastIdea = () => {
      const unimplementedIdeas = godIdeas.filter(idea => !idea.implemented);
      if (unimplementedIdeas.length > 0) {
        const idea = unimplementedIdeas[Math.floor(Math.random() * unimplementedIdeas.length)];
        const element = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const patterns = ['spiral', 'orbit', 'pulse', 'wave'];
        const pattern = patterns[Math.floor(Math.random() * patterns.length)];
        switch (pattern) {
          case 'spiral':
            for (let i = 0; i < 10; i++) {
              const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
              circle.setAttribute("r", 5);
              circle.setAttribute("fill", idea.action.parameters.color || "#fff");
              circle.style.animation = `spiral${i} ${duration}ms infinite`;
              element.appendChild(circle);
            }
            break;
        }
        this.canvas.appendChild(element);
        idea.implemented = true;
        localStorage.setItem('godIdeas', JSON.stringify(godIdeas));
      }
    };
    implementPastIdea();
    if (Math.random() < 0.3) {
      this.spawnCollectible(posX, posY);
    }
    if (Math.random() < 0.3) {
      const newRecipe = {
        inputs: [this.inventory.items[0]?.type || 'stardust', this.inventory.items[1]?.type || 'cosmicShard'],
        output: {
          type: (action.parameters.structure?.type || 'celestial') + 'Essence',
          color: action.parameters.color || '#ffffff',
          value: Math.floor(Math.random() * 50 + 25)
        }
      };
      this.crafting.recipes.push(newRecipe);
    }
  }

  handleAmbientAction(action) {
    if (!action || !action.parameters) return;
    const duration = action.parameters.duration || 3000;
    const effects = ['spaceStorm', 'nebulaMist', 'solarWind', 'cosmicRain'];
    const effect = effects[Math.floor(Math.random() * effects.length)];
    document.body.style.animation = `${effect} ${duration}ms ease-in-out`;
    if (action.parameters.pattern === 'particles') {
      for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'ambient-effect';
        particle.style.width = '10px';
        particle.style.height = '10px';
        particle.style.background = action.parameters.color || '#fff';
        particle.style.left = Math.random() * window.innerWidth + 'px';
        particle.style.top = Math.random() * window.innerHeight + 'px';
        particle.style.filter = `blur(${Math.random() * 5}px)`;
        document.body.appendChild(particle);
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 + 50;
        particle.style.transform = `translate(
              ${Math.cos(angle) * speed}px,
              ${Math.sin(angle) * speed}px
            )`;
        setTimeout(() => particle.remove(), duration);
      }
    }
    document.body.classList.add('ambient-active');
    setTimeout(() => {
      document.body.classList.remove('ambient-active');
      document.body.style.animation = '';
    }, duration);
  }

  startGameLoop() {
    this.executeState();
    setInterval(() => {
      if (!this.cooldown) {
        this.lastAutonomousMove = Date.now() + 5000;
        this.cooldown = true;
        this.executeState();
        setTimeout(() => {
          this.cooldown = false;
        }, 180000);
      }
    }, 1000);
    this.updateViewBox();
    setInterval(() => {
      if (Date.now() - this.lastChunkUpdate > 1000) {
        this.updateVisibleChunks();
        this.lastChunkUpdate = Date.now();
      }
    }, 1000);
    requestAnimationFrame(() => this.gameLoop());
  }

  gameLoop() {
    this.checkCollisions();
    this.visualizeAudio();
    requestAnimationFrame(() => this.gameLoop());
  }

  checkCollisions() {
    if (!this.npc) return;
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    const pickupDistance = 30;
    this.collectibles.forEach(collectible => {
      if (!collectible.collected) {
        const dx = npcX - collectible.x;
        const dy = npcY - collectible.y;
        const distance = Math.hypot(dx, dy);
        if (distance < pickupDistance) {
          collectible.collected = true;
          collectible.element.remove();
          this.collectibles.splice(this.collectibles.indexOf(collectible), 1);
          const baseItems = JSON.parse(localStorage.getItem('baseCollectibles'));
          if (baseItems && baseItems.length) {
            const randomItem = baseItems[Math.floor(Math.random() * baseItems.length)];
            this.inventory.addItem(randomItem);
            this.logAction(`Collected ${randomItem.type}`);
            this.crafting.checkAndCraft();
            this.npc.classList.remove('npc-collecting');
          }
        }
      }
    });
  }

  spawnCollectible(x, y) {
    const collectible = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    collectible.setAttribute("cx", x);
    collectible.setAttribute("cy", y);
    collectible.setAttribute("r", 8);
    collectible.setAttribute("fill", "yellow");
    collectible.classList.add('collectible');
    this.canvas.appendChild(collectible);
    this.collectibles.push({
      element: collectible,
      x: x,
      y: y,
      collected: false
    });
  }

  wander() {
    if (!this.npc) {
      this.initialize();
      return;
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 300 + 200;
    const currentX = parseFloat(this.npc.getAttribute("cx")) || 0;
    const currentY = parseFloat(this.npc.getAttribute("cy")) || 0;
    const newX = currentX + Math.cos(angle) * distance;
    const newY = currentY + Math.sin(angle) * distance;
    this.animateNPCTo(newX, newY, 3000);
  }

  startAutonomousBehavior() {
    if (!this.npc) {
      this.initialize();
    }

    this.autonomousInterval = setInterval(() => {
      if (Date.now() - this.lastAutonomousMove > 2000 && !this.cooldown) {
        this.autonomousMove();
      }
    }, 1000);
  }

  autonomousMove() {
    const now = Date.now();
    if (now - this.lastBehaviorTime < this.behaviorCooldown) return;

    this.lastBehaviorTime = now;

    const nearestCollectible = this.findNearestCollectible();

    if (nearestCollectible && Math.random() < 0.7) {
      this.moveToCollectible(nearestCollectible);
    } else if (this.inventory.items.length > 0 && Math.random() < 0.3) {
      this.placeInventoryItem();
    } else {
      const behaviors = [
        { fn: () => this.explore(), weight: 2 },
        { fn: () => this.wander(), weight: 1 },
        { fn: () => this.orbitNearestStructure(), weight: 1 }
      ];

      const totalWeight = behaviors.reduce((sum, b) => sum + b.weight, 0);
      let random = Math.random() * totalWeight;

      for (let behavior of behaviors) {
        random -= behavior.weight;
        if (random <= 0) {
          behavior.fn();
          break;
        }
      }
    }
  }

  placeInventoryItem() {
    if (!this.npc || this.inventory.items.length === 0) return;

    const item = this.inventory.items[Math.floor(Math.random() * this.inventory.items.length)];
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));

    const placedItem = document.createElementNS("http://www.w3.org/2000/svg", "g");
    placedItem.innerHTML = `
      <circle r="10" fill="${item.color}" class="placed-item" />
      <circle r="12" fill="none" stroke="${item.color}" stroke-width="2" class="item-glow" />
    `;
    placedItem.setAttribute("transform", `translate(${npcX},${npcY})`);
    this.canvas.appendChild(placedItem);

    this.placedObjects.push({
      element: placedItem,
      x: npcX,
      y: npcY,
      type: item.type,
      value: item.value,
      color: item.color
    });

    this.inventory.removeItem(this.inventory.items.indexOf(item));
    this.logAction(`Placed ${item.type} in space`);
  }

  findNearestCollectible() {
    if (!this.npc) return null;

    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));

    let nearest = null;
    let minDist = Infinity;

    const allCollectibles = [...this.collectibles, ...this.placedObjects]
      .filter(obj => !obj.collected);

    for (let obj of allCollectibles) {
      const dx = obj.x - npcX;
      const dy = obj.y - npcY;
      const dist = Math.hypot(dx, dy);

      if (dist < minDist) {
        minDist = dist;
        nearest = obj;
      }
    }

    return nearest;
  }

  moveToCollectible(collectible) {
    if (!this.npc || !collectible) return;

    this.isMoving = true;
    this.npc.setAttribute("fill", "#ffffff");
    this.animateNPCTo(collectible.x, collectible.y, 3000);

    setTimeout(() => {
      this.isMoving = false;
    }, 3000);
  }

  animateNPCTo(targetX, targetY, duration) {
    if (!this.npc) return;

    const startX = parseFloat(this.npc.getAttribute("cx"));
    const startY = parseFloat(this.npc.getAttribute("cy"));
    const startTime = performance.now();

    this.isMoving = true;

    const animate = (currentTime) => {
      if (!this.npc || !this.isMoving) return;

      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = this.easeInOutCubic(progress);

      const currentX = startX + (targetX - startX) * easeProgress;
      const currentY = startY + (targetY - startY) * easeProgress;

      this.npc.setAttribute("cx", currentX);
      this.npc.setAttribute("cy", currentY);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.isMoving = false;
      }
    };

    requestAnimationFrame(animate);
  }

  startIdleAnimation() {
    const updateIdleState = () => {
      this.currentColorIndex = (this.currentColorIndex + this.colorTransitionSpeed) % this.baseColors.length;
      const color1 = this.baseColors[Math.floor(this.currentColorIndex)];
      const color2 = this.baseColors[Math.ceil(this.currentColorIndex) % this.baseColors.length];
      const t = this.currentColorIndex % 1;

      if (this.npc) {
        if (!this.isMoving && !this.cooldown) {
          this.npc.setAttribute("fill", this.lerpColor(color1, color2, t));
        }

        const pulseScale = 1 + Math.sin(Date.now() / 1000) * 0.1;
        this.npc.setAttribute("r", 20 * pulseScale);
      }

      requestAnimationFrame(updateIdleState);
    };

    requestAnimationFrame(updateIdleState);
  }

  lerpColor(color1, color2, t) {
    const c1 = this.hexToRgb(color1);
    const c2 = this.hexToRgb(color2);

    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);

    return `rgb(${r},${g},${b})`;
  }

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  startCountdown(seconds) {
    if (!this.timerValue) return;
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    const updateTimer = () => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      this.timerValue.textContent = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };
    updateTimer();
    this.countdownInterval = setInterval(() => {
      seconds--;
      updateTimer();
      if (seconds <= 0) {
        clearInterval(this.countdownInterval);
        this.startCountdown(180);
      }
    }, 1000);
  }

  skipCooldown() {
    if (this.cooldown) {
      this.cooldown = false;
      this.skipBtn.style.opacity = '0.5';
      setTimeout(() => {
        this.skipBtn.style.opacity = '1';
      }, 1000);
      this.startCountdown(180);
    }
  }

  easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  initAudio() {
    this.audioContext = new AudioContext();
    this.audioAnalyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaElementSource(this.audio);
    source.connect(this.audioAnalyser);
    this.audioAnalyser.connect(this.audioContext.destination);
    this.audioAnalyser.fftSize = 256;
    this.audioData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
  }

  visualizeAudio() {
    const stars = this.canvas.querySelectorAll('.star');
    this.audioAnalyser.getByteFrequencyData(this.audioData);
    stars.forEach((star, i) => {
      const audioIndex = i % this.audioData.length;
      const audioValue = this.audioData[audioIndex] / 255;
      if (audioValue > 0.8) {
        star.style.animation = 'starAudioPulse 0.5s infinite';
        if (Math.random() < 0.001) {
          star.classList.add('star-rainbow');
          setTimeout(() => {
            const cx = parseFloat(star.getAttribute("cx"));
            const cy = parseFloat(star.getAttribute("cy"));
            this.spawnCollectible(cx, cy);
            star.classList.remove('star-rainbow');
          }, 2000);
        }
      } else {
        star.style.animation = 'twinkle 3s infinite';
      }
    });
    if (Math.random() < 0.001) {
      const x = Math.random() * 10000 - 5000;
      const y = Math.random() * 10000 - 5000;
      this.spawnCollectible(x, y);
    }
  }

  updateViewBox() {
    if (!this.npc) return;
    const x = parseFloat(this.npc.getAttribute('cx'));
    const y = parseFloat(this.npc.getAttribute('cy'));
    const viewBoxWidth = window.innerWidth;
    const viewBoxHeight = window.innerHeight;
    this.canvas.setAttribute('viewBox', `${x - viewBoxWidth / 2} ${y - viewBoxHeight / 2} ${viewBoxWidth} ${viewBoxHeight}`);
    requestAnimationFrame(() => this.updateViewBox());
  }
}