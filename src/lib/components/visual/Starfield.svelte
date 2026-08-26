<script lang="ts">
  import { onMount } from 'svelte';
  let { subtle = false }: { subtle?: boolean } = $props();
  let canvas: HTMLCanvasElement;

  onMount(() => {
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame = 0;
    let width = 0;
    let height = 0;
    type Spark = {
      x: number;
      y: number;
      radius: number;
      velocityY: number;
      sway: number;
      phase: number;
      frequency: number;
      life: number;
      span: number;
      color: string;
    };
    let sparks: Spark[] = [];

    const makeSpark = (y?: number): Spark => ({
      x: Math.random() * width,
      y: y ?? height + Math.random() * height * 0.5,
      radius: 0.9 + Math.random() * 2.1,
      velocityY: -(0.09 + Math.random() * 0.2),
      sway: 0.18 + Math.random() * 0.5,
      phase: Math.random() * Math.PI * 2,
      frequency: 0.003 + Math.random() * 0.006,
      life: 0,
      span: 700 + Math.random() * 900,
      color: Math.random() < 0.24 ? '#ffd9a0' : Math.random() < 0.5 ? '#ffb367' : '#f0913f'
    });

    const seed = () => {
      sparks = Array.from({ length: Math.min(26, Math.round((width * height) / 34_000)) }, () =>
        makeSpark(Math.random() * height)
      );
    };
    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      seed();
    };
    const draw = () => {
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'lighter';
      for (let index = 0; index < sparks.length; index++) {
        const spark = sparks[index];
        spark.life++;
        spark.phase += spark.frequency;
        spark.y += spark.velocityY;
        spark.x += Math.sin(spark.phase) * spark.sway * 0.5;
        if (spark.y < -30 || spark.life > spark.span) {
          sparks[index] = makeSpark();
          continue;
        }
        const progress = spark.life / spark.span;
        const fade = Math.min(1, progress * 6) * Math.min(1, (1 - progress) * 2.6);
        const brightness =
          fade * (0.5 + 0.5 * Math.min(1, (height - spark.y) / Math.max(1, height * 0.7)));
        const alpha = brightness * (subtle ? 0.62 : 1);
        if (alpha <= 0.01) continue;
        const glow = context.createRadialGradient(
          spark.x,
          spark.y,
          0,
          spark.x,
          spark.y,
          spark.radius * 8
        );
        glow.addColorStop(0, spark.color);
        glow.addColorStop(1, 'rgba(240,145,63,0)');
        context.globalAlpha = alpha * 0.5;
        context.fillStyle = glow;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius * 8, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha = alpha * 0.8;
        context.fillStyle = spark.color;
        context.beginPath();
        context.arc(spark.x, spark.y, spark.radius, 0, Math.PI * 2);
        context.fill();
      }
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      frame = requestAnimationFrame(draw);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    frame = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
