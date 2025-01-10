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
    this.isCrafting = false;
    this.isMoving = false;
    this.started = false;
    this.actionHistory = [];
    this.autonomousInterval = null;
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.chunkSize = 1000;
    this.visibleChunkRadius = 3;
    this.chunks = new Map();
    this.targetPosition = { x: 0, y: 0 };
    this.moveSpeed = 0.3; 
    this.collectibles = [];
    this.inventory = new NPCInventory();
    this.crafting = new NPCCrafting(this.inventory, this);
    this.structures = [];
    this.spawnedStructures = [];
    this.npc = null;
    this.lastAutonomousMove = Date.now();
    this.lastChunkUpdateX = null;
    this.lastChunkUpdateY = null;
    this.moveAnimation = null;
    this.idleTimeout = 15000; 
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
    this.initialize();
    requestAnimationFrame(() => {
      this.updateCamera();
      this.startAutonomousBehavior();
    });
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
      this.npc.setAttribute("cx", "0");
      this.npc.setAttribute("cy", "0");
    }
    this.updateVisibleChunks();
    this.updateCamera(); 
    this.lastAutonomousMove = Date.now();
    this.autonomousMove();
  }

  updateVisibleChunks() {
    const npcX = parseFloat(this.npc?.getAttribute("cx")) || 0;
    const npcY = parseFloat(this.npc?.getAttribute("cy")) || 0;
    const currentChunkX = Math.floor(npcX / this.chunkSize);
    const currentChunkY = Math.floor(npcY / this.chunkSize);

    for (let dx = -this.visibleChunkRadius; dx <= this.visibleChunkRadius; dx++) {
      for (let dy = -this.visibleChunkRadius; dy <= this.visibleChunkRadius; dy++) {
        const distance = Math.hypot(dx, dy);
        if (distance <= this.visibleChunkRadius) {
          const chunkX = currentChunkX + dx;
          const chunkY = currentChunkY + dy;
          const key = `${chunkX},${chunkY}`;
          
          if (!this.chunks.has(key)) {
            const chunk = new Chunk(chunkX, chunkY);
            this.chunks.set(key, chunk);
            this.canvas.appendChild(chunk.element);
            chunk.collectibles.forEach(c => this.collectibles.push(c));
            chunk.structures.forEach(s => this.structures.push(s));
          }
        }
      }
    }

    for (const [key, chunk] of this.chunks.entries()) {
      const [x, y] = key.split(',').map(Number);
      const distance = Math.hypot(x - currentChunkX, y - currentChunkY);
      if (distance > this.visibleChunkRadius + 1) {
        chunk.cleanup();
        this.chunks.delete(key);
      }
    }
  }

  findNearestCollectible() {
    if (!this.npc || this.collectibles.length === 0) return null;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    
    let nearest = null;
    let minDist = Infinity;
    
    const activeCollectibles = this.collectibles.filter(c => !c.collected);
    
    if (activeCollectibles.length === 0) {
      return null;
    }

    activeCollectibles.forEach(collectible => {
      const dx = collectible.x - npcX;
      const dy = collectible.y - npcY;
      const distance = Math.hypot(dx, dy);
      
      if (distance < minDist) {
        minDist = distance;
        nearest = collectible;
      }
    });
    
    return nearest;
  }

  checkNextAction() {
    if (this.cooldown || this.isCrafting || this.isMoving) return;

    if (this.inventory && this.inventory.items.length >= 2) {
      this.crafting.checkAndCraft();
      return;
    }

    const nearest = this.findNearestCollectible();
    if (nearest) {
      this.moveTowardsCollectible(nearest);
      return;
    }

    this.exploreNewChunks();
  }

  exploreNewChunks() {
    if (!this.npc) return;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    
    const directions = [
      {x: 1000, y: 0},
      {x: -1000, y: 0},
      {x: 0, y: 1000},
      {x: 0, y: -1000}
    ];
    
    let bestDirection = null;
    let leastExplored = Infinity;
    
    directions.forEach(dir => {
      const checkX = Math.floor((npcX + dir.x) / this.chunkSize);
      const checkY = Math.floor((npcY + dir.y) / this.chunkSize);
      
      let exploredCount = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const key = `${checkX + i},${checkY + j}`;
          if (this.chunks.has(key)) {
            exploredCount++;
          }
        }
      }
      
      if (exploredCount < leastExplored) {
        leastExplored = exploredCount;
        bestDirection = dir;
      }
    });
    
    if (bestDirection) {
      this.moveTowards(npcX + bestDirection.x, npcY + bestDirection.y, 5000);
    }
  }

  updateCamera() {
    if (!this.npc) return;
    
    const x = parseFloat(this.npc.getAttribute("cx"));
    const y = parseFloat(this.npc.getAttribute("cy"));
    
    const viewBoxWidth = this.viewportWidth;
    const viewBoxHeight = this.viewportHeight;
    
    const viewBox = `${x - viewBoxWidth/2} ${y - viewBoxHeight/2} ${viewBoxWidth} ${viewBoxHeight}`;
    this.canvas.setAttribute('viewBox', viewBox);

    if (Math.abs(x - (this.lastChunkUpdateX || 0)) > 200 || 
        Math.abs(y - (this.lastChunkUpdateY || 0)) > 200) {
      this.updateVisibleChunks();
      this.lastChunkUpdateX = x;
      this.lastChunkUpdateY = y;
    }
  }

  moveTowards(targetX, targetY, duration = 3000) {
    if (!this.npc || this.isMoving) return;
    
    this.isMoving = true;
    const startX = parseFloat(this.npc.getAttribute("cx"));
    const startY = parseFloat(this.npc.getAttribute("cy"));
    const startTime = performance.now();
    
    if (Math.abs(targetX - startX) < 1 && Math.abs(targetY - startY) < 1) {
      this.isMoving = false;
      this.npc.classList.remove('npc-collecting');
      setTimeout(() => this.checkNextAction(), 0);
      return;
    }
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = 0.5 - Math.cos(progress * Math.PI) / 2;
      
      const currentX = startX + (targetX - startX) * easeProgress;
      const currentY = startY + (targetY - startY) * easeProgress;
      
      this.npc.setAttribute("cx", currentX);
      this.npc.setAttribute("cy", currentY);
      this.updateCamera();
      
      if (progress < 1) {
        this.moveAnimation = requestAnimationFrame(animate);
      } else {
        this.isMoving = false;
        this.moveAnimation = null;
        this.npc.classList.remove('npc-collecting');
        setTimeout(() => this.checkNextAction(), 0);
      }
    };
    
    this.moveAnimation = requestAnimationFrame(animate);
  }

  moveTowardsCollectible(collectible) {
    if (!collectible || collectible.collected) return;
    
    const duration = 2000;
    this.npc.classList.add('npc-collecting');
    this.moveTowards(collectible.x, collectible.y, duration);
  }

  autonomousMove() {
    if (!this.npc || this.isMoving || this.cooldown) return;

    this.checkNextAction();
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
      collected: false,
      type: 'stardust',
      value: Math.floor(Math.random() * 20) + 10,
    });
  }

  checkCollisions() {
    if (!this.npc) return;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    const pickupDistance = 40;

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const collectible = this.collectibles[i];
      if (!collectible.collected) {
        const dx = npcX - collectible.x;
        const dy = npcY - collectible.y;
        const distance = Math.hypot(dx, dy);
        
        if (distance < pickupDistance) {
          collectible.collected = true;
          collectible.element.remove();
          
          const item = {
            type: collectible.type,
            color: '#ffff00',
            value: collectible.value
          };
          
          this.inventory.addItem(item);
          this.logAction(`Collected ${item.type} (${item.value})`);
          this.crafting.checkAndCraft();
          
          this.collectibles.splice(i, 1);
          
          setTimeout(() => this.checkNextAction(), 100);
        }
      }
    }
  }

  startAutonomousBehavior() {
    if (this.autonomousInterval) {
      clearInterval(this.autonomousInterval);
    }

    this.autonomousInterval = setInterval(() => {
      if (!this.cooldown) {
        this.autonomousMove();
      }
    }, 500);
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
    this.moveTowards(targetX, targetY, duration);
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
    if (this.audioAnalyser) {
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
              const worldX = cx + (this.currentChunkX || 0) * this.chunkSize;
              const worldY = cy + (this.currentChunkY || 0) * this.chunkSize;
              this.spawnCollectible(worldX, worldY);
              star.classList.remove('star-rainbow');
            }, 2000);
          }
        } else {
          star.style.animation = 'twinkle 3s infinite';
        }
      });
    }

    if (Math.random() < 0.001) {
      const npcX = parseFloat(this.npc?.getAttribute("cx") || 0);
      const npcY = parseFloat(this.npc?.getAttribute("cy") || 0);
      const spread = 500;
      const x = npcX + (Math.random() - 0.5) * spread;
      const y = npcY + (Math.random() - 0.5) * spread;
      this.spawnCollectible(x, y);
    }
  }
}