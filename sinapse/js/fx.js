// Animação da tela de login: uma rede de neurônios em que sinais viajam
// pelas conexões e acendem cada nó ao chegar, como sinapses disparando.

export function startSynapseFx(canvas) {
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const color = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  const VIOLET = color('--violet', '#3D8BFF');
  const AMBER = color('--amber', '#FF9F43');

  let w = 0;
  let h = 0;
  let nodes = [];
  let pulses = [];
  let raf = 0;
  let last = performance.now();
  let spawnClock = 0;
  const LINK = 130;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.max(24, Math.min(70, Math.round((w * h) / 9000)));
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.18,
      vy: (Math.random() - 0.5) * 0.18,
      r: 1.6 + Math.random() * 1.8,
      glow: 0,
    }));
    pulses = [];
  }

  function neighbors(i) {
    const a = nodes[i];
    const out = [];
    nodes.forEach((b, j) => {
      if (j !== i && Math.hypot(a.x - b.x, a.y - b.y) < LINK) out.push(j);
    });
    return out;
  }

  function fire(from, depth) {
    const options = neighbors(from);
    if (!options.length) return;
    const to = options[Math.floor(Math.random() * options.length)];
    pulses.push({ from, to, t: 0, speed: 0.0011 + Math.random() * 0.0008, depth });
  }

  function step(dt) {
    for (const n of nodes) {
      n.x += n.vx * dt * 0.06;
      n.y += n.vy * dt * 0.06;
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
      n.glow = Math.max(0, n.glow - dt * 0.0018);
    }
    spawnClock -= dt;
    if (spawnClock <= 0) {
      fire(Math.floor(Math.random() * nodes.length), 0);
      spawnClock = 380 + Math.random() * 520;
    }
    pulses = pulses.filter((p) => {
      p.t += p.speed * dt;
      if (p.t < 1) return true;
      nodes[p.to].glow = 1;
      // O sinal segue para o próximo neurônio, formando uma cadeia curta.
      if (p.depth < 4 && Math.random() < 0.75) fire(p.to, p.depth + 1);
      return false;
    });
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < LINK) {
          ctx.globalAlpha = (1 - d / LINK) * 0.35;
          ctx.strokeStyle = VIOLET;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }
    for (const p of pulses) {
      const a = nodes[p.from];
      const b = nodes[p.to];
      const x = a.x + (b.x - a.x) * p.t;
      const y = a.y + (b.y - a.y) * p.t;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.globalAlpha = 1;
      ctx.fillStyle = AMBER;
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    for (const n of nodes) {
      ctx.globalAlpha = 0.55 + n.glow * 0.45;
      ctx.fillStyle = n.glow > 0.05 ? AMBER : VIOLET;
      if (n.glow > 0.05) { ctx.shadowColor = AMBER; ctx.shadowBlur = 16 * n.glow; }
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + n.glow * 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function loop(t) {
    const dt = Math.min(48, t - last);
    last = t;
    step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  if (reduce) {
    // Movimento reduzido: um quadro parado, com alguns nós acesos.
    nodes.slice(0, 5).forEach((n) => { n.glow = 0.8; });
    draw();
  } else {
    raf = requestAnimationFrame(loop);
  }

  return function stop() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
