<template>
  <canvas
    ref="canvasRef"
    class="confetti-canvas"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";

const props = withDefaults(defineProps<{
  particleCount?: number;
}>(), {
  particleCount: 800,
});

const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationId: number | null = null;

interface Particle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  tiltX: number;
  tiltY: number;
  tiltXSpeed: number;
  tiltYSpeed: number;
  osc1Amp: number;
  osc1Speed: number;
  osc1Offset: number;
  osc2Amp: number;
  osc2Speed: number;
  osc2Offset: number;
  drift: number;
  opacity: number;
  shape: "rect" | "circle" | "strip";
  fallen: boolean;
}

const COLORS = [
  "#ff6b6b",
  "#ffd93d",
  "#6bcb77",
  "#4d96ff",
  "#ff922b",
  "#cc5de8",
  "#20c997",
  "#ff6b81",
  "#74b9ff",
  "#fdcb6e",
  "#e17055",
  "#00b894",
];

const SHAPES: Array<"rect" | "circle" | "strip"> = ["rect", "circle", "strip"];

const createParticle = (canvasWidth: number, canvasHeight: number): Particle => {
  const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)]!;
  const w = shape === "strip" ? 4 + Math.random() * 2 : 8 + Math.random() * 4;
  const h = shape === "strip" ? 20 + Math.random() * 6 : w;

  const t = 1 - Math.pow(Math.random(), 3);

  return {
    x: Math.random() * canvasWidth,
    y: -20 - t * canvasHeight * 1.2,
    w,
    h,
    color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
    vx: (Math.random() - 0.5) * 2,
    vy: 2 + Math.random() * 1.4,
    rotation: Math.random() * Math.PI * 2,
    rotationSpeed: (Math.random() - 0.5) * 0.15,
    tiltX: Math.random() * Math.PI * 2,
    tiltY: Math.random() * Math.PI * 2,
    tiltXSpeed: 0.008 + Math.random() * 0.015,
    tiltYSpeed: 0.008 + Math.random() * 0.015,
    osc1Amp: 0.2 + Math.random() * 0.5,
    osc1Speed: 0.015 + Math.random() * 0.02,
    osc1Offset: Math.random() * Math.PI * 2,
    osc2Amp: 0.1 + Math.random() * 0.3,
    osc2Speed: 0.03 + Math.random() * 0.04,
    osc2Offset: Math.random() * Math.PI * 2,
    drift: (Math.random() - 0.5) * 0.3,
    opacity: 0.9 + Math.random() * 0.1,
    shape,
    fallen: false,
  };
};

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.scale(dpr, dpr);

  const canvasWidth = window.innerWidth;
  const canvasHeight = window.innerHeight;

  const particles: Particle[] = [];
  for (let i = 0; i < props.particleCount; i++) {
    particles.push(createParticle(canvasWidth, canvasHeight));
  }

  let frameCount = 0;

  const animate = () => {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    let allFallen = true;

    for (const p of particles) {
      if (p.fallen) continue;

      allFallen = false;

      p.x += p.vx + p.drift
        + Math.sin(frameCount * p.osc1Speed + p.osc1Offset) * p.osc1Amp
        + Math.sin(frameCount * p.osc2Speed + p.osc2Offset) * p.osc2Amp;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      p.tiltX += p.tiltXSpeed;
      p.tiltY += p.tiltYSpeed;

      if (p.y > canvasHeight + 20) {
        p.fallen = true;
        continue;
      }

      const scaleX = 0.4 + 0.6 * Math.abs(Math.cos(p.tiltY));
      const scaleY = 0.4 + 0.6 * Math.abs(Math.cos(p.tiltX));

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.scale(scaleX, scaleY);

      if (p.shape === "rect") {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      } else if (p.shape === "circle") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }

      ctx.restore();
    }

    if (allFallen) {
      animationId = null;
      return;
    }

    frameCount++;
    animationId = requestAnimationFrame(animate);
  };

  animationId = requestAnimationFrame(animate);
});

onUnmounted(() => {
  if (animationId !== null) {
    cancelAnimationFrame(animationId);
  }
});
</script>

<style scoped>
.confetti-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 9999;
}
</style>
