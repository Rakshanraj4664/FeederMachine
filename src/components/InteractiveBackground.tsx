import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════
// IMPRESSIVE INTERACTIVE BACKGROUND
// White base with floating 3D elements, animated grid, cursor trail
// ═══════════════════════════════════════════════════════════════

interface ParticleData {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  angle: number;
  color: string;
}

interface FloatingShape {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
  duration: number;
  delay: number;
  type: 'circle' | 'square' | 'hexagon' | 'ring';
  color: string;
}

export const InteractiveBackground: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ParticleData[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, prevX: 0, prevY: 0 });
  const trailRef = useRef<{ x: number; y: number; age: number }[]>([]);
  const rafRef = useRef<number>(0);

  // Mouse tracking with spring physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 25, mass: 0.8 });
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 25, mass: 0.8 });

  // Parallax layers at different depths
  const layer1X = useTransform(smoothX, [-800, 800], [-15, 15]);
  const layer1Y = useTransform(smoothY, [-800, 800], [-15, 15]);
  const layer2X = useTransform(smoothX, [-800, 800], [-35, 35]);
  const layer2Y = useTransform(smoothY, [-800, 800], [-35, 35]);
  const layer3X = useTransform(smoothX, [-800, 800], [-60, 60]);
  const layer3Y = useTransform(smoothY, [-800, 800], [-60, 60]);
  const glowX = useTransform(smoothX, [-800, 800], [-100, 100]);
  const glowY = useTransform(smoothY, [-800, 800], [-100, 100]);

  // Generate floating shapes
  const floatingShapes = useMemo<FloatingShape[]>(() => {
    const shapes: FloatingShape[] = [];
    const colors = [
      'rgba(6, 182, 212, ',    // cyan
      'rgba(99, 102, 241, ',   // indigo
      'rgba(14, 165, 233, ',   // sky
      'rgba(59, 130, 246, ',   // blue
      'rgba(16, 185, 129, ',   // emerald
    ];

    for (let i = 0; i < 20; i++) {
      shapes.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 80 + 20,
        rotation: Math.random() * 360,
        opacity: Math.random() * 0.06 + 0.02,
        duration: Math.random() * 20 + 15,
        delay: Math.random() * 5,
        type: ['circle', 'square', 'hexagon', 'ring'][Math.floor(Math.random() * 4)] as any,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    return shapes;
  }, []);

  // Initialize canvas particles
  const initParticles = useCallback((width: number, height: number) => {
    const particles: ParticleData[] = [];
    const count = Math.min(60, Math.floor((width * height) / 25000));

    for (let i = 0; i < count; i++) {
      particles.push({
        id: i,
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        speed: Math.random() * 0.3 + 0.1,
        angle: Math.random() * Math.PI * 2,
        color: Math.random() > 0.6 ? 'rgba(6, 182, 212,' : 'rgba(148, 163, 184,',
      });
    }
    particlesRef.current = particles;
  }, []);

  // Canvas animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      initParticles(window.innerWidth, window.innerHeight);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.prevX = mouseRef.current.x;
      mouseRef.current.prevY = mouseRef.current.y;
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;

      mouseX.set(e.clientX - window.innerWidth / 2);
      mouseY.set(e.clientY - window.innerHeight / 2);

      // Add to trail
      trailRef.current.push({ x: e.clientX, y: e.clientY, age: 0 });
      if (trailRef.current.length > 30) trailRef.current.shift();
    };

    window.addEventListener('mousemove', handleMouseMove);

    let frame = 0;
    const animate = () => {
      frame++;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const mouse = mouseRef.current;

      ctx.clearRect(0, 0, w, h);

      // Draw cursor trail
      const trail = trailRef.current;
      if (trail.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
          const p = trail[i];
          p.age += 1;
          const alpha = Math.max(0, 1 - p.age / 40);
          if (alpha > 0) {
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
      }

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Move
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;
        p.angle += (Math.random() - 0.5) * 0.02;

        // Mouse repulsion
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
          const force = (150 - dist) / 150 * 2;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        // Wrap
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;

        // Draw connections
        if (i % 3 === 0) { // Only check some particles for performance
          for (let j = i + 1; j < Math.min(i + 8, particles.length); j++) {
            const p2 = particles[j];
            const cdx = p.x - p2.x;
            const cdy = p.y - p2.y;
            const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

            if (cdist < 120) {
              const alpha = (1 - cdist / 120) * 0.06;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.strokeStyle = `rgba(6, 182, 212, ${alpha})`;
              ctx.lineWidth = 0.5;
              ctx.stroke();
            }
          }
        }

        // Draw particle
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color} ${p.opacity})`;
        ctx.fill();
      }

      // Cursor glow
      const gradient = ctx.createRadialGradient(
        mouse.x, mouse.y, 0,
        mouse.x, mouse.y, 200
      );
      gradient.addColorStop(0, 'rgba(6, 182, 212, 0.04)');
      gradient.addColorStop(0.5, 'rgba(6, 182, 212, 0.01)');
      gradient.addColorStop(1, 'rgba(6, 182, 212, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [initParticles, mouseX, mouseY]);

  // Render floating shape
  const renderShape = (shape: FloatingShape) => {
    const baseStyle = {
      position: 'absolute' as const,
      left: `${shape.x}%`,
      top: `${shape.y}%`,
      width: shape.size,
      height: shape.size,
      opacity: shape.opacity,
    };

    switch (shape.type) {
      case 'circle':
        return (
          <motion.div
            key={shape.id}
            style={{
              ...baseStyle,
              borderRadius: '50%',
              border: `1.5px solid ${shape.color} 0.3)`,
              background: `${shape.color} 0.05)`,
            }}
            animate={{
              y: [0, -30, 0],
              x: [0, 15, 0],
              rotate: [shape.rotation, shape.rotation + 180, shape.rotation + 360],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: shape.delay,
            }}
          />
        );
      case 'square':
        return (
          <motion.div
            key={shape.id}
            style={{
              ...baseStyle,
              border: `1.5px solid ${shape.color} 0.3)`,
              background: `${shape.color} 0.05)`,
              borderRadius: '4px',
            }}
            animate={{
              y: [0, 20, -20, 0],
              rotate: [shape.rotation, shape.rotation + 90, shape.rotation + 180, shape.rotation],
              scale: [1, 0.9, 1.1, 1],
            }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: shape.delay,
            }}
          />
        );
      case 'ring':
        return (
          <motion.div
            key={shape.id}
            style={{
              ...baseStyle,
              borderRadius: '50%',
              border: `2px solid ${shape.color} 0.2)`,
              background: 'transparent',
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [shape.opacity, shape.opacity * 1.5, shape.opacity],
            }}
            transition={{
              duration: shape.duration * 0.7,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: shape.delay,
            }}
          />
        );
      case 'hexagon':
        return (
          <motion.div
            key={shape.id}
            style={{
              ...baseStyle,
              clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
              background: `${shape.color} 0.08)`,
            }}
            animate={{
              y: [0, -25, 0],
              rotate: [shape.rotation, shape.rotation + 60, shape.rotation],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: shape.duration,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: shape.delay,
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="fixed inset-0 z-0 overflow-hidden pointer-events-none">

      {/* ═══ BASE LAYER: White with subtle gradient ═══ */}
      <div className="absolute inset-0 bg-white" />
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 80%, rgba(6, 182, 212, 0.03) 0%, transparent 40%),
            radial-gradient(ellipse at 80% 20%, rgba(99, 102, 241, 0.03) 0%, transparent 40%),
            radial-gradient(ellipse at 50% 50%, rgba(241, 245, 249, 0.5) 0%, transparent 70%)
          `,
        }}
      />

      {/* ═══ LAYER 1: Fine dot grid (parallax) ═══ */}
      <motion.div 
        className="absolute inset-0"
        style={{ x: layer1X, y: layer1Y }}
      >
        <div 
          className="w-full h-full opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(circle, #0f172a 1.5px, transparent 1.5px)',
            backgroundSize: '24px 24px',
          }}
        />
      </motion.div>

      {/* ═══ LAYER 2: Structural lines (parallax) ═══ */}
      <motion.div 
        className="absolute inset-0"
        style={{ x: layer2X, y: layer2Y }}
      >
        <div 
          className="w-full h-full opacity-[0.025]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #0f172a 1px, transparent 1px),
              linear-gradient(to bottom, #0f172a 1px, transparent 1px)
            `,
            backgroundSize: '80px 80px',
          }}
        />
      </motion.div>

      {/* ═══ LAYER 3: Floating geometric shapes (parallax) ═══ */}
      <motion.div 
        className="absolute inset-0"
        style={{ x: layer3X, y: layer3Y }}
      >
        {floatingShapes.map(renderShape)}
      </motion.div>

      {/* ═══ LAYER 4: Canvas particles + cursor trail ═══ */}
      <canvas 
        ref={canvasRef} 
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.8 }}
      />

      {/* ═══ LAYER 5: Cursor-following glow ═══ */}
      <motion.div 
        className="absolute w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ 
          x: glowX, 
          y: glowY,
          left: '50%',
          top: '50%',
          marginLeft: '-200px',
          marginTop: '-200px',
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.04) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      {/* ═══ LAYER 6: Animated gradient orbs ═══ */}
      <motion.div 
        className="absolute top-[10%] left-[15%] w-[300px] h-[300px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, 50, 0],
          y: [0, -30, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div 
        className="absolute bottom-[15%] right-[10%] w-[350px] h-[350px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(99, 102, 241, 0.05) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
        animate={{
          x: [0, -40, 0],
          y: [0, 40, 0],
          scale: [1, 1.15, 1],
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div 
        className="absolute top-[40%] right-[30%] w-[250px] h-[250px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.04) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{
          x: [0, 30, 0],
          y: [0, 50, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 6 }}
      />

      {/* ═══ LAYER 7: Scan line effect ═══ */}
      <motion.div 
        className="absolute left-0 right-0 h-px bg-cyan-400/10"
        animate={{ top: ['0%', '100%', '0%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />

      {/* ═══ LAYER 8: Corner accents ═══ */}
      <div className="absolute top-4 left-4 w-16 h-16 border-l-2 border-t-2 border-cyan-500/20 rounded-tl-lg" />
      <div className="absolute top-4 right-4 w-16 h-16 border-r-2 border-t-2 border-cyan-500/20 rounded-tr-lg" />
      <div className="absolute bottom-4 left-4 w-16 h-16 border-l-2 border-b-2 border-cyan-500/20 rounded-bl-lg" />
      <div className="absolute bottom-4 right-4 w-16 h-16 border-r-2 border-b-2 border-cyan-500/20 rounded-br-lg" />

      {/* ═══ LAYER 9: Top accent bar ═══ */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 opacity-50" />

      {/* ═══ LAYER 10: Vignette ═══ */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(255,255,255,0.4) 100%)',
        }}
      />
    </div>
  );
};

export default InteractiveBackground;