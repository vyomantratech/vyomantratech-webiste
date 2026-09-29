/**
 * ===================================================================
 * VYOMANTRA TECHNOLOGIES - ADVANCED DUAL-SIDED 30PX SCROLL ENGINE
 * & FULL-SCREEN 100-PIXEL LINE-BY-LINE SCROLL DOWN ANIMATION
 * 
 * Features:
 *  1. Full-Screen 100px Line-by-Line Background Video Engine:
 *     - Dynamic 60 FPS Procedural Cosmic Nebula & 3D Cyber Horizon
 *     - Rotating Holographic Wireframe Polyhedron
 *     - 100-Pixel Digital Matrix Rows with Glowing Cyber Hex Glyphs
 *     - Smooth Sweeping Laser Scanline Beam that Decodes Line by Line on Scroll
 *     - Live HUD Scanner Badge (100PX MATRIX STREAM)
 * 
 *  2. Two-Sided Front & Back AI Focal Viewer:
 *     - Mathematical Aspect-Ratio Centering & Correct 1:1 Scale
 *     - Zero distortion, zero cropping at bottom
 *     - Ultra-sharp 4K crystal clarity on load
 *     - Smooth 30px digital pixel decode on scroll between Front & Back
 *     - Interactive click to flip front and back
 * ===================================================================
 */

// ===================================================================
// 1. SECONDARY PAGES AMBIENT NEURAL BACKGROUND
// ===================================================================
class AmbientBackgroundEngine {
  constructor() {
    this.canvas = document.getElementById('ambientBgCanvas');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'ambientBgCanvas';
      document.body.prepend(this.canvas);
    }
    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.particleCount = 55;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.scrollSpeed = 0;
    this.lastScrollY = window.scrollY;

    this.init();
  }

  init() {
    this.resize();
    this.createParticles();
    this.bindEvents();
    this.loop();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.particleCount; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1,
        color: Math.random() > 0.5 ? '0, 240, 255' : '139, 92, 246',
        alpha: Math.random() * 0.5 + 0.2
      });
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('scroll', () => {
      const currentScroll = window.scrollY;
      this.scrollSpeed = (currentScroll - this.lastScrollY) * 0.15;
      this.lastScrollY = currentScroll;
    }, { passive: true });
  }

  loop() {
    this.render();
    requestAnimationFrame(() => this.loop());
  }

  render() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.scrollSpeed *= 0.92;

    const count = this.particles.length;

    // Connect particles
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = this.particles[i].x - this.particles[j].x;
        const dy = this.particles[i].y - this.particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 130) {
          const lineAlpha = (1 - dist / 130) * 0.16;
          this.ctx.strokeStyle = `rgba(0, 240, 255, ${lineAlpha})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.beginPath();
          this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
          this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
          this.ctx.stroke();
        }
      }
    }

    // Update and draw particles
    for (let i = 0; i < count; i++) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy - this.scrollSpeed;

      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${p.color}, ${p.alpha})`;
      this.ctx.fill();
    }
  }
}

// ===================================================================
// 2. TWO-SIDED (FRONT & BACK) 30PX SCROLL DECODE ENGINE
//    WITH MATHEMATICAL CENTERING & PRECISE 1:1 SCALE
// ===================================================================
class TwoSidedPixelScrollEngine {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.wrapper = this.canvas.closest('.pixel-canvas-wrapper');
    this.ctx = this.canvas.getContext('2d');

    // Front & Back Image Sources
    this.frontSrc = this.canvas.getAttribute('data-front-image') || this.canvas.getAttribute('data-image') || 'assets/ai/vyomantra_ai_core.jpg';
    this.backSrc = this.canvas.getAttribute('data-back-image') || 'assets/ai/vyomantra_ai_nexus.jpg';

    // 30-Pixel max block size
    this.maxBlockSize = parseInt(this.canvas.getAttribute('data-max-block') || '30', 10);
    this.currentBlockSize = 1;
    this.targetBlockSize = 1;

    this.isHero = !!this.canvas.closest('.hero');
    this.activeSide = 'front';
    this.flipAngle = 0;

    // Load images
    this.frontImg = new Image();
    this.backImg = new Image();
    this.frontLoaded = false;
    this.backLoaded = false;

    // Offscreen Canvas for pixelation downscaling
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d');

    // HUD Elements
    this.counterElId = this.canvas.getAttribute('data-hud-counter');
    this.counterEl = this.counterElId ? document.getElementById(this.counterElId) : null;
    this.statusElId = this.canvas.getAttribute('data-hud-status');
    this.statusEl = this.statusElId ? document.getElementById(this.statusElId) : null;

    this.init();
  }

  init() {
    this.frontImg.src = this.frontSrc;
    this.backImg.src = this.backSrc;

    let loadedCount = 0;
    const checkReady = () => {
      loadedCount++;
      if (loadedCount >= 2) {
        this.onBothImagesReady();
      }
    };

    if (this.frontImg.complete && this.frontImg.naturalWidth > 0) loadedCount++;
    else this.frontImg.onload = checkReady;

    if (this.backImg.complete && this.backImg.naturalWidth > 0) loadedCount++;
    else this.backImg.onload = checkReady;

    if (loadedCount >= 2) this.onBothImagesReady();
  }

  onBothImagesReady() {
    this.frontLoaded = true;
    this.backLoaded = true;
    this.resizeCanvas();
    this.bindEvents();
    this.startLoop();

    // Always start crystal clear immediately (no disturbing pixel blocks)
    this.currentBlockSize = 1;
    this.targetBlockSize = 1;
    this.onScroll();
  }

  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.round(rect.width || 480);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.displaySize = size;
    this.canvas.width = Math.max(64, Math.round(size * dpr));
    this.canvas.height = Math.max(64, Math.round(size * dpr));
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resizeCanvas(), { passive: true });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });

    if (this.wrapper) {
      this.wrapper.style.cursor = 'pointer';
      this.wrapper.addEventListener('click', () => {
        this.toggleSide();
      });
    }
  }

  triggerEntranceDecode() {
    this.currentBlockSize = this.maxBlockSize;
    this.targetBlockSize = 1;
    const startTime = performance.now();
    const duration = 400;

    const step = (now) => {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      this.currentBlockSize = Math.max(1, Math.round(this.maxBlockSize * (1 - ease)));

      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        this.currentBlockSize = 1;
        this.targetBlockSize = 1;
      }
    };
    requestAnimationFrame(step);
  }

  onScroll() {
    const windowH = window.innerHeight || 800;
    const rect = this.canvas.getBoundingClientRect();

    let scrollProgress = 0;

    if (this.isHero) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      scrollProgress = Math.max(0, Math.min(1, scrollY / 420));
      if (scrollProgress < 0.5) {
        this.activeSide = 'front';
        this.targetBlockSize = 1;
      } else {
        this.activeSide = 'back';
        this.targetBlockSize = 1;
      }
      if (this.wrapper) {
        const tilt = (scrollProgress - 0.5) * 6;
        this.wrapper.style.transform = `perspective(1000px) rotateY(${tilt}deg)`;
      }
    } else {
      // In-page section cards (Spotlight Architecture, Services, CTA):
      // ALWAYS SHOW THE IMAGE CLEARLY! Zero disturbing pixel blocks while reading!
      const totalH = windowH + rect.height;
      const current = windowH - rect.top;
      scrollProgress = Math.max(0, Math.min(1, current / totalH));

      // Smoothly switch active side as user scrolls past midpoint
      this.activeSide = scrollProgress < 0.5 ? 'front' : 'back';
      
      // Always show crystal clear 4K native image
      this.targetBlockSize = 1;

      if (this.wrapper) {
        const tilt = (scrollProgress - 0.5) * 4;
        this.wrapper.style.transform = `perspective(1000px) rotateY(${tilt}deg)`;
      }
    }
  }

  toggleSide() {
    this.activeSide = this.activeSide === 'front' ? 'back' : 'front';
    this.targetBlockSize = this.maxBlockSize;
    this.triggerEntranceDecode();
  }

  startLoop() {
    const tick = () => {
      this.render();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  render() {
    if (!this.frontLoaded || !this.backLoaded) return;

    this.currentBlockSize += (this.targetBlockSize - this.currentBlockSize) * 0.35;
    if (Math.abs(this.currentBlockSize - this.targetBlockSize) < 0.1) {
      this.currentBlockSize = this.targetBlockSize;
    }
    const roundedBlock = Math.max(1, Math.round(this.currentBlockSize));

    const totalW = this.canvas.width;
    const totalH = this.canvas.height;
    if (totalW === 0 || totalH === 0) return;

    this.ctx.clearRect(0, 0, totalW, totalH);

    const activeImg = this.activeSide === 'front' ? this.frontImg : this.backImg;
    if (!activeImg || !activeImg.complete || !activeImg.naturalWidth) return;

    // ============================================================
    // MATHEMATICAL ASPECT-RATIO CENTERING & CORRECT 1:1 SCALE
    // (Prevents stretching, distortion, or cropping at bottom)
    // ============================================================
    const imgAspect = activeImg.naturalWidth / activeImg.naturalHeight; // 1.0 (1024x1024)
    const canvasAspect = totalW / totalH;

    let drawW = totalW;
    let drawH = totalH;
    let drawX = 0;
    let drawY = 0;

    if (canvasAspect > imgAspect) {
      drawW = totalH * imgAspect;
      drawX = Math.round((totalW - drawW) / 2);
    } else {
      drawH = totalW / imgAspect;
      drawY = Math.round((totalH - drawH) / 2);
    }

    if (roundedBlock > 1) {
      // 30px Downscale buffer
      const scaledW = Math.max(2, Math.floor(drawW / roundedBlock));
      const scaledH = Math.max(2, Math.floor(drawH / roundedBlock));

      this.offscreen.width = scaledW;
      this.offscreen.height = scaledH;

      this.offCtx.imageSmoothingEnabled = true;
      this.offCtx.drawImage(activeImg, 0, 0, scaledW, scaledH);

      // Upscale without smoothing (crisp 30-pixel matrix)
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.drawImage(this.offscreen, 0, 0, scaledW, scaledH, drawX, drawY, drawW, drawH);

      // Subtle Cyber Grid Lines
      if (roundedBlock >= 4) {
        this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        for (let x = drawX; x < drawX + drawW; x += roundedBlock * 2) {
          this.ctx.moveTo(x, drawY);
          this.ctx.lineTo(x, drawY + drawH);
        }
        for (let y = drawY; y < drawY + drawH; y += roundedBlock * 2) {
          this.ctx.moveTo(drawX, y);
          this.ctx.lineTo(drawX + drawW, y);
        }
        this.ctx.stroke();
      }
    } else {
      // Ultra-sharp 4K native render
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.drawImage(activeImg, drawX, drawY, drawW, drawH);
    }

    this.updateHud(roundedBlock);
  }

  updateHud(blockSize) {
    if (this.counterEl) {
      if (blockSize <= 1) {
        this.counterEl.textContent = 'RES: 4K DECODED';
        this.counterEl.style.color = '#00f0ff';
        this.counterEl.style.borderColor = 'rgba(0, 240, 255, 0.6)';
      } else {
        this.counterEl.textContent = `BLOCK: ${blockSize}px`;
        this.counterEl.style.color = '#c084fc';
        this.counterEl.style.borderColor = 'rgba(192, 132, 252, 0.4)';
      }
    }

    if (this.statusEl) {
      const sideLabel = this.activeSide === 'front' ? 'FRONT' : 'BACK';
      if (blockSize <= 1) {
        this.statusEl.textContent = `${sideLabel} ACTIVE (100%)`;
      } else {
        const pct = Math.round((1 - (blockSize / this.maxBlockSize)) * 100);
        this.statusEl.textContent = `${sideLabel} MORPHING (${pct}%)`;
      }
    }
  }
}

// ===================================================================
// 3. FULL-SCREEN BACKGROUND VIDEO & 100-PIXEL LINE-BY-LINE SCROLL ENGINE
// ===================================================================
class Fullscreen100PxVideoEngine {
  constructor() {
    this.canvas = document.getElementById('fullscreenPixelBg');
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.id = 'fullscreenPixelBg';
      document.body.prepend(this.canvas);
    }

    this.ctx = this.canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.lineHeight = 100; // 100-pixel line by line resolution
    this.time = 0;
    this.currentScanY = 0;
    this.targetScanY = 0;
    this.scrollProgress = 0;
    this.sparks = [];

    // Minimal HUD Telemetry Badge
    this.hudEl = document.getElementById('fullscreenScanHud');

    // Offscreen 60FPS Video Render Buffer
    this.buffer = document.createElement('canvas');
    this.bCtx = this.buffer.getContext('2d');

    // Low-res Block Downsampler Buffer
    this.downBuffer = document.createElement('canvas');
    this.dCtx = this.downBuffer.getContext('2d');

    // Hex glyphs for 100px block matrix encryption
    this.hexGlyphs = ['0x00', '0xFF', '0x7A', '0x1C', '0xE4', '0x3D', '0x99', '0xA1', '101', '010', '110', 'AI', 'CORE'];

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
    this.onScroll();
    this.loop();
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.buffer.width = this.width;
    this.buffer.height = this.height;
  }

  onScroll() {
    const params = new URLSearchParams(window.location.search);
    const forcedScroll = params.get('scroll');
    const scrollY = forcedScroll !== null ? parseFloat(forcedScroll) : (window.scrollY || window.pageYOffset || 0);
    const docH = document.documentElement.scrollHeight - window.innerHeight;
    
    // Line-by-line sweep calibrated across 1200px of scrolling (Hero + Services)
    const sweepRange = Math.min(docH > 0 ? docH : 1200, 1200);
    const fullProgress = sweepRange > 0 ? Math.min(1, Math.max(0, scrollY / sweepRange)) : 0;
    this.scrollProgress = fullProgress;
    this.targetScanY = fullProgress * (this.height + this.lineHeight);
  }

  loop() {
    this.time += 0.018;
    this.currentScanY += (this.targetScanY - this.currentScanY) * 0.12;

    this.renderVideoBuffer();
    this.renderLineByLine100Px();
    this.updateHud();

    requestAnimationFrame(() => this.loop());
  }

  renderVideoBuffer() {
    const W = this.width;
    const H = this.height;
    const ctx = this.bCtx;
    const t = this.time;

    // 1. Deep Space Cosmic Canvas Base
    const bgGrad = ctx.createRadialGradient(W * 0.65, H * 0.45, 60, W * 0.5, H * 0.5, Math.max(W, H) * 0.95);
    bgGrad.addColorStop(0, 'rgba(18, 12, 42, 0.96)');
    bgGrad.addColorStop(0.5, 'rgba(6, 10, 26, 0.98)');
    bgGrad.addColorStop(1, '#02040d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Harmonic Undulating Cyber Nebula (Dual Plasma Orbs)
    const orb1X = W * (0.68 + 0.08 * Math.cos(t * 0.7));
    const orb1Y = H * (0.42 + 0.08 * Math.sin(t * 0.9));
    const pGrad1 = ctx.createRadialGradient(orb1X, orb1Y, 10, orb1X, orb1Y, 440);
    pGrad1.addColorStop(0, 'rgba(0, 240, 255, 0.24)');
    pGrad1.addColorStop(0.6, 'rgba(0, 240, 255, 0.06)');
    pGrad1.addColorStop(1, 'transparent');
    ctx.fillStyle = pGrad1;
    ctx.fillRect(0, 0, W, H);

    const orb2X = W * (0.32 + 0.1 * Math.sin(t * 0.6));
    const orb2Y = H * (0.64 + 0.09 * Math.cos(t * 0.8));
    const pGrad2 = ctx.createRadialGradient(orb2X, orb2Y, 10, orb2X, orb2Y, 500);
    pGrad2.addColorStop(0, 'rgba(139, 92, 246, 0.28)');
    pGrad2.addColorStop(0.7, 'rgba(139, 92, 246, 0.05)');
    pGrad2.addColorStop(1, 'transparent');
    ctx.fillStyle = pGrad2;
    ctx.fillRect(0, 0, W, H);

    // 3. Volumetric 3D Cyber Horizon & Perspective Lines
    const horizonY = H * 0.48;
    ctx.lineWidth = 1;
    const numPerspLines = 20;
    for (let i = 0; i <= numPerspLines; i++) {
      const bottomX = (W / numPerspLines) * i;
      ctx.strokeStyle = i % 3 === 0 ? 'rgba(0, 240, 255, 0.18)' : 'rgba(139, 92, 246, 0.10)';
      ctx.beginPath();
      ctx.moveTo(W * 0.5, horizonY);
      ctx.lineTo(bottomX, H);
      ctx.stroke();
    }

    // Moving horizontal grid lines travelling towards viewer
    const gridSpeed = (t * 75) % 80;
    for (let y = horizonY; y < H; y += Math.max(14, (y - horizonY) * 0.18)) {
      const movingY = y + gridSpeed * ((y - horizonY) / (H - horizonY));
      if (movingY > horizonY && movingY < H) {
        const lineAlpha = ((movingY - horizonY) / (H - horizonY)) * 0.25;
        ctx.strokeStyle = `rgba(0, 240, 255, ${lineAlpha})`;
        ctx.beginPath();
        ctx.moveTo(0, movingY);
        ctx.lineTo(W, movingY);
        ctx.stroke();
      }
    }

    // 4. Rotating Holographic 3D Wireframe Polyhedron
    this.renderHoloPolyhedron(ctx, W * 0.70, H * 0.50, t);
  }

  renderHoloPolyhedron(ctx, cx, cy, t) {
    const r = Math.min(this.width * 0.16, 170);
    const vertices = [
      [-1, 0, 0], [1, 0, 0], [0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1]
    ];
    const rotX = t * 0.6;
    const rotY = t * 0.85;

    const projected = vertices.map(v => {
      let x = v[0], y = v[1], z = v[2];
      let x1 = x * Math.cos(rotY) + z * Math.sin(rotY);
      let z1 = -x * Math.sin(rotY) + z * Math.cos(rotY);
      let y2 = y * Math.cos(rotX) - z1 * Math.sin(rotX);
      let z2 = y * Math.sin(rotX) + z1 * Math.cos(rotX);
      const scale = (z2 + 2.5) / 2.5;
      return {
        x: cx + x1 * r * scale,
        y: cy + y2 * r * scale,
        z: z2
      };
    });

    const edges = [
      [0,2],[0,3],[0,4],[0,5],
      [1,2],[1,3],[1,4],[1,5],
      [2,4],[2,5],[3,4],[3,5]
    ];

    ctx.save();
    edges.forEach(([i, j]) => {
      const p1 = projected[i];
      const p2 = projected[j];
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    });

    // Glowing Nodes
    projected.forEach((p, idx) => {
      ctx.fillStyle = idx % 2 === 0 ? '#00f0ff' : '#c084fc';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  renderLineByLine100Px() {
    const W = this.width;
    const H = this.height;
    const ctx = this.ctx;
    const numLines = Math.ceil(H / this.lineHeight);
    const scanY = this.currentScanY;

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < numLines; i++) {
      const y0 = i * this.lineHeight;
      const y1 = Math.min(H, (i + 1) * this.lineHeight);
      const sliceH = y1 - y0;

      if (y1 <= scanY) {
        // ========================================================
        // 1. FULLY DECODED ROW (1px crystal clarity)
        // ========================================================
        ctx.drawImage(this.buffer, 0, y0, W, sliceH, 0, y0, W, sliceH);

        // Subtle scanline texture
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0, 240, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)';
        ctx.fillRect(0, y0, W, sliceH);

      } else if (y0 <= scanY && scanY < y1) {
        // ========================================================
        // 2. ACTIVE SCANLINE TRANSITION ROW (100px -> 1px Decode)
        // ========================================================
        const rowProgress = (scanY - y0) / this.lineHeight;
        const blk = Math.max(1, Math.round(100 * (1 - rowProgress)));

        if (blk <= 2) {
          ctx.drawImage(this.buffer, 0, y0, W, sliceH, 0, y0, W, sliceH);
        } else {
          const downW = Math.max(1, Math.ceil(W / blk));
          const downH = Math.max(1, Math.ceil(sliceH / blk));
          this.downBuffer.width = downW;
          this.downBuffer.height = downH;

          this.dCtx.imageSmoothingEnabled = false;
          this.dCtx.drawImage(this.buffer, 0, y0, W, sliceH, 0, 0, downW, downH);

          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(this.downBuffer, 0, 0, downW, downH, 0, y0, W, sliceH);
          ctx.imageSmoothingEnabled = true;
        }

        ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y0, W, sliceH);

      } else {
        // ========================================================
        // 3. ENCRYPTED ROW (Heavy 100px Digital Blocks & Matrix Glyphs)
        // ========================================================
        const blk = 100;
        const downW = Math.max(1, Math.ceil(W / blk));
        const downH = Math.max(1, Math.ceil(sliceH / blk));
        this.downBuffer.width = downW;
        this.downBuffer.height = downH;

        this.dCtx.imageSmoothingEnabled = false;
        this.dCtx.drawImage(this.buffer, 0, y0, W, sliceH, 0, 0, downW, downH);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.downBuffer, 0, 0, downW, downH, 0, y0, W, sliceH);
        ctx.imageSmoothingEnabled = true;

        // Overlay Cyber Matrix Glyphs and 100px Grid Outlines
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.16)';
        ctx.lineWidth = 1;
        ctx.strokeRect(0, y0, W, sliceH);

        ctx.font = '11px monospace';
        ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let bx = 0; bx < W; bx += 100) {
          ctx.strokeRect(bx, y0, 100, sliceH);
          const glyphIdx = (Math.floor(bx / 100) + i + Math.floor(this.time * 2)) % this.hexGlyphs.length;
          ctx.fillText(this.hexGlyphs[glyphIdx], bx + 50, y0 + sliceH * 0.5);
        }
      }
    }

    // ============================================================
    // 4. DRAW SWEEPING LASER SCANLINE BEAM AT scanY
    // ============================================================
    if (scanY > 0 && scanY < H + 50) {
      ctx.save();
      const laserGrad = ctx.createLinearGradient(0, scanY, W, scanY);
      laserGrad.addColorStop(0, 'rgba(0, 240, 255, 0.2)');
      laserGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.9)');
      laserGrad.addColorStop(0.5, '#ffffff');
      laserGrad.addColorStop(0.7, 'rgba(192, 132, 252, 0.9)');
      laserGrad.addColorStop(1, 'rgba(139, 92, 246, 0.2)');

      ctx.strokeStyle = laserGrad;
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 16;
      ctx.lineWidth = 2.5;

      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(W, scanY);
      ctx.stroke();

      // Laser spark particles
      if (Math.random() > 0.4) {
        this.sparks.push({
          x: Math.random() * W,
          y: scanY + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 2,
          life: 1.0,
          color: Math.random() > 0.5 ? '#00f0ff' : '#ffffff'
        });
      }

      // Floating scanline telemetry flag
      const activeLineNum = Math.min(numLines, Math.floor(scanY / this.lineHeight) + 1);
      ctx.fillStyle = 'rgba(5, 7, 20, 0.85)';
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 1;
      const tagW = 210;
      const tagH = 22;
      const tagX = W - tagW - 24;
      const tagY = Math.max(10, Math.min(H - tagH - 10, scanY - tagH - 6));
      ctx.fillRect(tagX, tagY, tagW, tagH);
      ctx.strokeRect(tagX, tagY, tagW, tagH);

      ctx.fillStyle = '#00f0ff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`► 100PX SCAN: ROW 0${activeLineNum}/${numLines} DECODED`, tagX + 8, tagY + tagH * 0.5);

      ctx.restore();
    }

    // Render & update sparks
    ctx.save();
    for (let s = this.sparks.length - 1; s >= 0; s--) {
      const sp = this.sparks[s];
      sp.x += sp.vx;
      sp.y += sp.vy;
      sp.life -= 0.05;
      if (sp.life <= 0) {
        this.sparks.splice(s, 1);
      } else {
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.life;
        ctx.fillRect(sp.x, sp.y, 2, 2);
      }
    }
    ctx.restore();
  }

  updateHud() {
    if (!this.hudEl) return;
    const numLines = Math.ceil(this.height / this.lineHeight);
    const currLine = Math.min(numLines, Math.floor(this.currentScanY / this.lineHeight) + 1);
    const pct = Math.round(this.scrollProgress * 100);
    this.hudEl.innerHTML = `<span class="hud-pulse-dot"></span><span>100PX MATRIX STREAM • ROW 0${currLine}/${numLines} DECODE • ${pct}%</span>`;
  }
}

// Global initialization
window.pixelEngines = [];
window.ambientBg = null;
window.fullscreen100PxVideo = null;

function initEngine() {
  const isIndex = window.location.pathname.endsWith('index.html') || 
                  window.location.pathname.endsWith('/') || 
                  window.location.pathname === '' ||
                  !!document.getElementById('fullscreenPixelBg');

  // 1. Initialize Full-Screen 100px Line-by-Line Video Engine on index.html
  if (isIndex) {
    if (!window.fullscreen100PxVideo) {
      window.fullscreen100PxVideo = new Fullscreen100PxVideoEngine();
    }
  } else {
    // 2. Initialize Ambient Neural Background on secondary pages
    if (!window.ambientBg) {
      window.ambientBg = new AmbientBackgroundEngine();
    }
  }

  // 3. Initialize all Two-Sided 30px Scroll Canvases
  const canvases = document.querySelectorAll('canvas[data-pixel-scroll="true"]');
  canvases.forEach(canvas => {
    if (!canvas.__pixelEngine) {
      const engine = new TwoSidedPixelScrollEngine(canvas);
      canvas.__pixelEngine = engine;
      window.pixelEngines.push(engine);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEngine);
} else {
  initEngine();
}
