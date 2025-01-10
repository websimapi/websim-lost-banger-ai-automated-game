export class Chunk {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.element = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.element.classList.add('chunk');
    this.element.setAttribute('transform', `translate(${x * 1000}, ${y * 1000})`);
    this.radius = 600; // Circular chunk radius
    this.collectibles = [];
    this.stars = [];
    this.structures = [];
    this.generated = false;
    this.generate();
  }

  isInRadius(x, y) {
    const centerX = this.x * 1000 + 500;
    const centerY = this.y * 1000 + 500;
    const distance = Math.hypot(x - centerX, y - centerY);
    return distance <= this.radius;
  }

  generate() {
    if (this.generated) return;

    // Generate stars in a circular pattern
    const starCount = Math.floor(Math.random() * 50) + 50;
    for (let i = 0; i < starCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * this.radius;
      const x = 500 + Math.cos(angle) * distance;
      const y = 500 + Math.sin(angle) * distance;
      
      const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      star.setAttribute("cx", x);
      star.setAttribute("cy", y);
      star.setAttribute("r", Math.random() * 2 + 1);
      star.setAttribute("fill", `rgba(255,255,255,${Math.random() * 0.5 + 0.5})`);
      star.classList.add('star');
      this.element.appendChild(star);
      this.stars.push(star);
    }

    // Generate collectibles
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (this.radius - 50);
      const x = 500 + Math.cos(angle) * distance;
      const y = 500 + Math.sin(angle) * distance;

      const collectible = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      collectible.setAttribute("cx", x);
      collectible.setAttribute("cy", y);
      collectible.setAttribute("r", 8);
      collectible.setAttribute("fill", "yellow");
      collectible.classList.add('collectible');
      this.element.appendChild(collectible);
      
      this.collectibles.push({
        element: collectible,
        x: x + this.x * 1000,
        y: y + this.y * 1000,
        collected: false
      });
    }

    // Possibly generate a structure
    if (Math.random() < 0.2) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * (this.radius - 100);
      const x = 500 + Math.cos(angle) * distance;
      const y = 500 + Math.sin(angle) * distance;

      const structure = document.createElementNS("http://www.w3.org/2000/svg", "g");
      structure.classList.add('god-structure');
      
      const patterns = ['observatory', 'portal', 'crystal', 'nebula'];
      const pattern = patterns[Math.floor(Math.random() * patterns.length)];
      
      switch (pattern) {
        case 'observatory':
          structure.innerHTML = `<path d="M-50,-50 L50,50 M-50,50 L50,-50" stroke="#fff"/>`;
          break;
        case 'portal':
          structure.innerHTML = `<circle r="30" fill="none" stroke="#fff"/>`;
          break;
        case 'crystal':
          structure.innerHTML = `<polygon points="0,-40 35,20 -35,20" stroke="#fff" fill="none"/>`;
          break;
        case 'nebula':
          structure.innerHTML = `<path d="M0,0 C50,50 100,50 150,0" stroke="#fff" fill="none"/>`;
          break;
      }

      structure.setAttribute('transform', `translate(${x},${y})`);
      this.element.appendChild(structure);
      this.structures.push({
        element: structure,
        x: x + this.x * 1000,
        y: y + this.y * 1000,
        pattern
      });
    }

    this.generated = true;
  }

  cleanup() {
    this.element.remove();
    this.collectibles = [];
    this.stars = [];
    this.structures = [];
  }
}