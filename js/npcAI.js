export class NPCAI {
  constructor(npc, game) {
    this.npc = npc;
    this.game = game;
    this.currentGoal = null;
    this.idleTimeout = 15000;
    this.lastActionTime = Date.now();
    this.movementSpeed = 0.3;
    this.thinkingInterval = null;
    this.initAI();
  }

  initAI() {
    this.thinkingInterval = setInterval(() => this.think(), 500);
  }

  think() {
    if (this.game.isMoving || this.game.cooldown || this.game.isCrafting) return;

    const currentTime = Date.now();
    if (currentTime - this.lastActionTime > this.idleTimeout) {
      this.forceNewAction();
      return;
    }

    const priorities = this.evaluateCurrentSituation();
    this.actOnPriorities(priorities);
  }

  evaluateCurrentSituation() {
    const priorities = {
      collect: 0,
      craft: 0,
      place: 0,
      explore: 0,
      investigate: 0
    };

    // Evaluate collection priority
    const nearestCollectible = this.findNearestCollectible();
    if (nearestCollectible && this.game.inventory.items.length < this.game.inventory.maxSize) {
      const distance = this.getDistanceToCollectible(nearestCollectible);
      priorities.collect = distance < 1000 ? 100 - (distance / 10) : 50;

      if (this.game.inventory.items.length < 3) {
        priorities.collect += 50;
      }
    }

    // Evaluate crafting priority
    if (this.game.inventory.items.length >= 2) {
      const canCraft = this.game.crafting.recipes.some(recipe => 
        this.game.crafting.canCraft(recipe)
      );
      if (canCraft) {
        priorities.craft = 40 + (this.game.inventory.items.length * 10);
      }
    }

    // Evaluate placing priority
    const hasCraftedItems = this.game.inventory.items.some(item => 
      item.type.includes('Essence') || item.type.includes('Time')
    );
    if (hasCraftedItems) {
      priorities.place = 30 + Math.random() * 30;
    }

    // Evaluate exploration priority
    const idleTime = Date.now() - this.lastActionTime;
    priorities.explore = Math.min(40, Math.floor(idleTime / 300));

    // Evaluate investigation priority
    const hasUnexploredStructures = this.game.structures.some(s => !s.explored);
    if (hasUnexploredStructures) {
      priorities.investigate = 20 + Math.random() * 30;
    }

    return priorities;
  }

  actOnPriorities(priorities) {
    const highestPriority = Math.max(...Object.values(priorities));
    const action = Object.entries(priorities)
      .find(([_, value]) => value === highestPriority)?.[0];

    switch (action) {
      case 'collect':
        this.collectNearestStardust();
        break;
      case 'craft':
        this.game.crafting.checkAndCraft();
        break;
      case 'place':
        this.game.placeCreation();
        break;
      case 'explore':
        this.exploreSpace();
        break;
      case 'investigate':
        this.investigateStructures();
        break;
    }

    this.lastActionTime = Date.now();
  }

  findNearestCollectible() {
    if (!this.npc || this.game.collectibles.length === 0) return null;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    
    return this.game.collectibles
      .filter(c => !c.collected)
      .reduce((nearest, current) => {
        const currentDist = Math.hypot(current.x - npcX, current.y - npcY);
        const nearestDist = nearest ? 
          Math.hypot(nearest.x - npcX, nearest.y - npcY) : Infinity;
        return currentDist < nearestDist ? current : nearest;
      }, null);
  }

  getDistanceToCollectible(collectible) {
    if (!collectible || !this.npc) return Infinity;
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    return Math.hypot(collectible.x - npcX, collectible.y - npcY);
  }

  collectNearestStardust() {
    const nearest = this.findNearestCollectible();
    if (nearest) {
      this.game.moveTowardsCollectible(nearest);
    } else {
      this.exploreSpace();
    }
  }

  exploreSpace() {
    if (!this.npc) return;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    
    const angle = Math.random() * Math.PI * 2;
    const distance = 500 + Math.random() * 500;
    const targetX = npcX + Math.cos(angle) * distance;
    const targetY = npcY + Math.sin(angle) * distance;
    
    this.game.moveTowards(targetX, targetY);
  }

  investigateStructures() {
    if (!this.npc || this.game.structures.length === 0) return;
    
    const npcX = parseFloat(this.npc.getAttribute("cx"));
    const npcY = parseFloat(this.npc.getAttribute("cy"));
    
    const unexploredStructures = this.game.structures.filter(s => !s.explored);
    if (unexploredStructures.length === 0) {
      this.exploreSpace();
      return;
    }

    const nearest = unexploredStructures.reduce((nearest, current) => {
      const currentDist = Math.hypot(current.x - npcX, current.y - npcY);
      const nearestDist = nearest ? 
        Math.hypot(nearest.x - npcX, nearest.y - npcY) : Infinity;
      return currentDist < nearestDist ? current : nearest;
    }, null);

    if (nearest) {
      this.game.moveTowards(nearest.x, nearest.y);
      nearest.explored = true;
    }
  }

  forceNewAction() {
    const actions = [
      () => this.collectNearestStardust(),
      () => this.exploreSpace(),
      () => this.investigateStructures()
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    randomAction();
    this.lastActionTime = Date.now();
  }

  cleanup() {
    if (this.thinkingInterval) {
      clearInterval(this.thinkingInterval);
    }
  }
}