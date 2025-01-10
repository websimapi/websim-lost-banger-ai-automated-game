export class NPCCrafting {
  constructor(inventory, game) {
    this.inventory = inventory;
    this.game = game;
    this.recipes = [{
      inputs: ['stardust', 'stardust'],
      output: {
        type: 'starEssence',
        color: '#88ffff',
        value: 25
      }
    }, {
      inputs: ['cosmicShard', 'voidEssence'],
      output: {
        type: 'spaceTime',
        color: '#ff88ff',
        value: 75
      }
    }];
    this.element = document.getElementById('npc-crafting');
    this.craftBar = document.getElementById('craft-bar');
    this.isCrafting = false;
  }

  checkAndCraft() {
    if (this.isCrafting) return;
    for (const recipe of this.recipes) {
      if (this.canCraft(recipe)) {
        this.startCrafting(recipe);
        break;
      }
    }
  }

  canCraft(recipe) {
    const itemCounts = {};
    this.inventory.items.forEach(item => {
      itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
    });
    return recipe.inputs.every(input => {
      return (itemCounts[input] || 0) > 0;
    });
  }

  startCrafting(recipe) {
    this.isCrafting = true;
    this.element.classList.add('active');
    this.craftBar.style.width = '0%';
    const craftDuration = 3000;
    const startTime = performance.now();
    const animate = currentTime => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / craftDuration, 1);
      this.craftBar.style.width = `${progress * 100}%`;
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.finishCrafting(recipe);
      }
    };
    requestAnimationFrame(animate);
  }

  finishCrafting(recipe) {
    recipe.inputs.forEach(input => {
      const index = this.inventory.items.findIndex(item => item.type === input);
      if (index !== -1) {
        this.inventory.removeItem(index);
      }
    });
    this.inventory.addItem(recipe.output);
    this.game.logAction(`Crafted ${recipe.output.type}`);
    this.isCrafting = false;
    this.element.classList.remove('active');
    this.checkAndCraft();
  }
}