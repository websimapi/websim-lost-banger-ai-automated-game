export class Chunk {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.element = document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.element.classList.add('chunk');
    this.element.setAttribute('transform', `translate(${x * 1000}, ${y * 1000})`);
    this.generated = false;
    this.collectibles = [];
    this.generate();
  }
  generate() {
    if (this.generated) return;
    const starCount = Math.floor(Math.random() * 50) + 50;
    for (let i = 0; i < starCount; i++) {
      const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const cx = Math.random() * 1000;
      const cy = Math.random() * 1000;
      star.setAttribute("cx", cx);
      star.setAttribute("cy", cy);
      star.setAttribute("r", Math.random() * 2 + 1);
      star.setAttribute("fill", `rgba(255,255,255,${Math.random() * 0.5 + 0.5})`);
      star.classList.add('star');
      this.element.appendChild(star);
    }
    for (let i = 0; i < 10; i++) {
      const collectible = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const cx = Math.random() * 1000;
      const cy = Math.random() * 1000;
      collectible.setAttribute("cx", cx);
      collectible.setAttribute("cy", cy);
      collectible.setAttribute("r", 8);
      collectible.setAttribute("fill", "yellow");
      collectible.classList.add('collectible');
      this.element.appendChild(collectible);
      this.collectibles.push({
        element: collectible,
        x: cx,
        y: cy,
        collected: false
      });
    }
    if (Math.random() < 0.1) {
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
      const posX = Math.random() * 1000;
      const posY = Math.random() * 1000;
      structure.setAttribute('transform', `translate(${posX},${posY})`);
      this.element.appendChild(structure);
    }
    this.generated = true;
  }
}