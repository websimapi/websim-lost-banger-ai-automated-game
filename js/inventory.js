export class NPCInventory {
  constructor() {
    this.items = [];
    this.maxSize = 10;
    this.element = document.getElementById('inventory-items');
    this.updateDisplay();
  }

  addItem(item) {
    if (this.items.length < this.maxSize) {
      this.items.push(item);
      this.updateDisplay();
      return true;
    }
    return false;
  }

  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      const removed = this.items.splice(index, 1)[0];
      this.updateDisplay();
      return removed;
    }
    return null;
  }

  updateDisplay() {
    if (!this.element) return;
    this.element.innerHTML = this.items.map((item, i) => `
          <div class="npc-inventory-item">
            <span style="color:${item.color}">${item.type}</span>
            <span>${item.value}</span>
          </div>
        `).join('');
  }

  show() {
    const inventoryDiv = document.getElementById('npc-inventory');
    inventoryDiv.classList.remove('hidden');
  }
}