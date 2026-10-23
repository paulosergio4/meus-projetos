"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const C = {};
  function lerCores() {
    const cs = getComputedStyle(document.documentElement);
    [
      "sage",
      "olive",
      "moss",
      "copper",
      "gold",
      "sand",
      "line",
      "panel",
      "panel2",
      "muted",
      "txt",
      "good",
      "bad",
    ].forEach((k) => (C[k] = cs.getPropertyValue("--" + k).trim()));
  }
  lerCores();
  (function () {
    const salvo = (() => {
      try {
        return localStorage.getItem("locus-tema");
      } catch (e) {
        return null;
      }
    })();
    if (salvo) document.documentElement.dataset.tema = salvo;
  })();
  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
  const num = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
  const pct = (v, d = 1) =>
    new Intl.NumberFormat("pt-BR", {
      style: "percent",
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }).format(isFinite(v) ? v : 0);
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const MESL = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const ENTRADAS = ["vendas / receita de serviços", "outras entradas"];
  const norm = (s) =>
    String(s ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  /* ---------- dados de exemplo ---------- */
  function exemplo() {
    const r = [],
      add = (y, m, d, desc, v, t, c) =>
        r.push({ date: new Date(y, m - 1, d), desc, valor: v, tipo: t, cat: c });
    [7, 8, 9].forEach((m) => {
      add(2026, m, 5, "Recebimentos cartão/PIX", 58000 + m * 900, "Entrada", "Vendas / Receita de serviços");
      add(2026, m, 10, "Boleto distribuidora", 31000 + m * 400, "Saída", "Fornecedores / Mercadorias");
      add(2026, m, 6, "Folha de pagamento", 9800, "Saída", "Folha e encargos");
      add(2026, m, 20, "DAS Simples Nacional", 3600 + m * 50, "Saída", "Impostos");
      add(2026, m, 5, "Aluguel loja", 3200, "Saída", "Aluguel e condomínio");
      add(2026, m, 15, "Energia e internet", 1450, "Saída", "Energia, água e internet");
      add(2026, m, 28, "Retirada sócio", 6000, "Saída", "Pró-labore e retiradas");
      add(2026, m, 30, "Tarifas e juros", 480 + (m - 7) * 120, "Saída", "Tarifas bancárias e juros");
      add(2026, m, 12, "Impulsionamento", 350, "Saída", "Marketing");
    });
    return { cliente: "Empresa Exemplo", rows: r, exemplo: true };
  }

  /* ---------- leitura da planilha ---------- */
  function toNumber(v) {
    if (typeof v === "number") return v;
    if (v == null) return NaN;
    let s = String(v).replace(/[R$\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(s);
  }
  function toDate(v) {
    if (v instanceof Date && !isNaN(v)) return v;
    if (typeof v === "number" && v > 20000 && v < 80000) {
      const d = XLSX.SSF.parse_date_code(v);
      return new Date(d.y, d.m - 1, d.d);
    }
    if (typeof v === "string") {
      const m = v.trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
      if (m) {
        let y = +m[3];
        if (y < 100) y += 2000;
        return new Date(y, +m[2] - 1, +m[1]);
      }
      const m2 = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m2) return new Date(+m2[1], +m2[2] - 1, +m2[3]);
    }
    return null;
  }
  function lerPlanilha(buf, nomeArquivo) {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    let nome = wb.SheetNames.find((n) => norm(n).includes("lancamento")) || wb.SheetNames[0];
    const ws = wb.Sheets[nome];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    let h = -1,
      col = {};
    for (let i = 0; i < Math.min(aoa.length, 40); i++) {
      const row = aoa[i].map(norm);
      const iData = row.findIndex((x) => x === "data"),
        iVal = row.findIndex((x) => x.startsWith("valor"));
      if (iData >= 0 && iVal >= 0) {
        h = i;
        col = {
          data: iData,
          valor: iVal,
          desc: row.findIndex((x) => x.startsWith("descri")),
          tipo: row.findIndex((x) => x === "tipo"),
          cat: row.findIndex((x) => x.startsWith("categ")),
        };
        break;
      }
    }
    if (h < 0)
      throw new Error("Não encontrei as colunas Data e Valor. Use a Planilha de Lançamentos da Lócus.");
    let cliente = "";
    for (let i = 0; i < h; i++) {
      const row = aoa[i] || [];
      for (let j = 0; j < row.length; j++) {
        const t = norm(row[j]).replace(/:$/, "");
        if (t === "empresa" || t === "cliente") {
          const v = row.slice(j + 1).find((x) => x != null && String(x).trim() !== "");
          if (v) cliente = String(v).trim();
        }
      }
    }
    if (!cliente) cliente = nomeArquivo.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    let rows = [];
    for (let i = h + 1; i < aoa.length; i++) {
      const r = aoa[i];
      if (!r) continue;
      const date = toDate(r[col.data]);
      const v = toNumber(r[col.valor]);
      if (!date || !isFinite(v) || v === 0) continue;
      const desc = col.desc >= 0 ? String(r[col.desc] ?? "") : "";
      const cat =
        col.cat >= 0 && r[col.cat]
          ? String(r[col.cat]).trim()
          : v < 0
            ? "Outras despesas"
            : "Outras entradas";
      let tipo = col.tipo >= 0 ? norm(r[col.tipo]) : "";
      tipo = tipo.startsWith("e")
        ? "Entrada"
        : tipo.startsWith("s")
          ? "Saída"
          : v < 0
            ? "Saída"
            : ENTRADAS.includes(norm(cat))
              ? "Entrada"
              : "Saída";
      rows.push({ date, desc, valor: Math.abs(v), tipo, cat });
    }
    const reais = rows.filter((r) => !norm(r.desc).startsWith("exemplo"));
    if (reais.length) rows = reais;
    if (!rows.length) throw new Error("A planilha não tem lançamentos preenchidos.");
    return { cliente, rows, exemplo: false };
  }

  /* ---------- cálculos ---------- */
  function calcular(d) {
    const key = (dt) => dt.getFullYear() * 100 + dt.getMonth();
    const meses = [...new Set(d.rows.map((r) => key(r.date)))].sort((a, b) => a - b).slice(-12);
    const M = meses.map((k) => ({ k, ano: Math.floor(k / 100), mes: k % 100, ent: 0, sai: 0 }));
    const idx = new Map(meses.map((k, i) => [k, i]));
    const cats = {},
      catMes = {};
    d.rows.forEach((r) => {
      const i = idx.get(key(r.date));
      if (i == null) return;
      if (r.tipo === "Entrada") M[i].ent += r.valor;
      else {
        M[i].sai += r.valor;
        cats[r.cat] = (cats[r.cat] || 0) + r.valor;
        (catMes[norm(r.cat)] ??= meses.map(() => 0))[i] += r.valor;
      }
    });
    M.forEach((m) => {
      m.res = m.ent - m.sai;
      m.mar = m.ent ? m.res / m.ent : 0;
    });
    const n = M.length || 1,
      ent = M.reduce((a, m) => a + m.ent, 0),
      sai = M.reduce((a, m) => a + m.sai, 0),
      res = ent - sai;
    const lista = Object.entries(cats)
      .map(([c, v]) => ({ c, v, m: v / n }))
      .sort((a, b) => b.v - a.v);
    const porNome = (t) => lista.filter((x) => norm(x.c).includes(t)).reduce((a, x) => a + x.v, 0);
    return { M, n, ent, sai, res, mar: ent ? res / ent : 0, lista, catMes, porNome };
  }

  /* ---------- desenho ---------- */
  function spark(id, vals, cor) {
    const el = $(id);
    if (vals.length < 2) {
      el.innerHTML = "";
      return;
    }
    const mn = Math.min(...vals),
      mx = Math.max(...vals),
      r = mx - mn || 1;
    const pts = vals.map((v, i) => [(i / (vals.length - 1)) * 196 + 2, 34 - ((v - mn) / r) * 28]);
    const p = pts.map((q) => q.join(",")).join(" ");
    el.innerHTML = `<defs><linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".35"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
  <polygon class="sarea" points="2,38 ${p} 198,38" fill="url(#g${id})"/><polyline class="sline" pathLength="1" points="${p}" fill="none" stroke="${cor}" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>`;
  }
  function variacao(vals, inverso) {
    if (vals.length < 2 || !vals[0]) return { t: "", c: "neu" };
    const v = (vals[vals.length - 1] - vals[0]) / Math.abs(vals[0]);
    const bom = inverso ? v <= 0 : v >= 0;
    return { t: `${v >= 0 ? "▲" : "▼"} ${pct(Math.abs(v))} do 1º ao último mês`, c: bom ? "up" : "down" };
  }
  function ring(v, cor, nome) {
    const r = 46,
      c = 2 * Math.PI * r,
      f = Math.max(0, Math.min(1, v));
    return `<div class="ring"><svg viewBox="0 0 120 120" role="img" aria-label="${esc(nome)}: ${pct(v)}">
   <circle cx="60" cy="60" r="${r}" fill="none" stroke="${C.line}" stroke-width="11"/>
   ${f > 0.005 ? `<circle cx="60" cy="60" r="${r}" fill="none" stroke="${cor}" stroke-width="11" stroke-linecap="round" class="arc" data-dash="${c * f}" data-tot="${c}" stroke-dasharray="${c * f} ${c}" transform="rotate(-90 60 60)"/>` : ""}
   <text x="60" y="66" text-anchor="middle" fill="${C.txt}" font-family="IBM Plex Mono, monospace" font-size="19" font-weight="500" data-count="${v}" data-fmt="pct">${pct(v)}</text></svg>
   <span class="n">${esc(nome)}</span></div>`;
  }
  function nice(mx) {
    if (mx <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(mx)));
    const f = mx / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  const num1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  function kfmt(v) {
    return Math.abs(v) >= 1000 ? num1.format(v / 1000) + " mil" : num.format(v);
  }
  const cw = (id) => Math.max(300, Math.min(680, Math.round($(id).clientWidth || 640)));
  function barras(M) {
    const W = cw("bars"),
      H = Math.round(W < 480 ? 230 : 260),
      L = 58,
      R = 12,
      T = 14,
      B = 30,
      iw = W - L - R,
      ih = H - T - B;
    const top = nice(Math.max(1, ...M.map((m) => Math.max(m.ent, m.sai))));
    const y = (v) => T + ih - (v / top) * ih,
      g = iw / M.length,
      bw = Math.min(34, g * 0.32);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas por mês">`;
    for (let i = 0; i <= 4; i++) {
      const v = (top * i) / 4;
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.line}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" fill="${C.muted}" font-size="11" font-family="IBM Plex Mono, monospace">${kfmt(v)}</text>`;
    }
    M.forEach((m, i) => {
      const cx = L + g * i + g / 2;
      s += `<rect style="--i:${i}" x="${cx - bw - 3}" y="${y(m.ent)}" width="${bw}" height="${Math.max(0, T + ih - y(m.ent))}" rx="5" fill="${C.sage}"><title>Entradas ${MES[m.mes]}: ${brl.format(m.ent)}</title></rect>`;
      s += `<rect style="--i:${i}" x="${cx + 3}" y="${y(m.sai)}" width="${bw}" height="${Math.max(0, T + ih - y(m.sai))}" rx="5" fill="${C.copper}"><title>Saídas ${MES[m.mes]}: ${brl.format(m.sai)}</title></rect>`;
      s += `<text x="${cx}" y="${H - 8}" text-anchor="middle" fill="${C.muted}" font-size="12" font-family="Montserrat, sans-serif">${MES[m.mes]}/${String(m.ano).slice(2)}</text>`;
    });
    return s + "</svg>";
  }
  function linha(M) {
    const W = cw("line"),
      H = W < 480 ? 210 : 230,
      L = 58,
      R = 28,
      T = 28,
      B = 30,
      iw = W - L - R,
      ih = H - T - B;
    const vals = M.map((m) => m.res),
      mn = Math.min(0, ...vals),
      mxr = Math.max(0, ...vals);
    const top = nice(Math.max(Math.abs(mn), mxr)) * (mxr > 0 ? 1 : 0) || 1,
      bot = mn < 0 ? -nice(Math.abs(mn)) : 0;
    const y = (v) => T + ((top - v) / (top - bot)) * ih,
      x = (i) => (M.length > 1 ? L + (i / (M.length - 1)) * iw : L + iw / 2);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Resultado mês a mês"><defs><linearGradient id="gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.sage}" stop-opacity=".3"/><stop offset="1" stop-color="${C.sage}" stop-opacity="0"/></linearGradient></defs>`;
    for (let i = 0; i <= 4; i++) {
      const v = bot + ((top - bot) * i) / 4;
      s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? C.muted : C.line}" ${v === 0 ? 'stroke-dasharray="3 4"' : ""}/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" fill="${C.muted}" font-size="11" font-family="IBM Plex Mono, monospace">${kfmt(v)}</text>`;
    }
    const pts = M.map((m, i) => [x(i), y(m.res)]);
    let d = `M${pts[0][0]},${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1],
        [x1, y1] = pts[i],
        cx = (x0 + x1) / 2;
      d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
    }
    if (pts.length > 1)
      s += `<path d="${d} L${pts[pts.length - 1][0]},${y(Math.max(bot, 0))} L${pts[0][0]},${y(Math.max(bot, 0))}Z" fill="url(#gl)"/><path d="${d}" fill="none" stroke="${C.sage}" stroke-width="3" stroke-linecap="round"/>`;
    M.forEach((m, i) => {
      const [px, py] = pts[i],
        cor = m.res < 0 ? C.bad : C.gold;
      s += `<circle class="pt" style="--ad:${(0.9 + i * 0.2).toFixed(2)}s" cx="${px}" cy="${py}" r="5.5" fill="${cor}" stroke="${C.panel}" stroke-width="2"/><text class="ptl" style="--ad:${(0.9 + i * 0.2).toFixed(2)}s" x="${Math.min(W - R, Math.max(L + 20, px))}" y="${py - 12}" text-anchor="${i === M.length - 1 && M.length > 1 ? "end" : i === 0 && M.length > 1 ? "start" : "middle"}" fill="${C.txt}" font-size="11.5" font-weight="600" font-family="IBM Plex Mono, monospace">${brl.format(m.res)}</text>
    <text x="${px}" y="${H - 8}" text-anchor="middle" fill="${C.muted}" font-size="12" font-family="Montserrat, sans-serif">${MES[m.mes]}/${String(m.ano).slice(2)}</text>`;
    });
    return s + "</svg>";
  }
  function rosca(lista, total) {
    const cores = [C.copper, C.gold, C.sage, C.olive, C.sand, C.moss];
    const top = lista.slice(0, 5),
      resto = lista.slice(5).reduce((a, x) => a + x.v, 0);
    const fatias = top.map((x) => ({ n: x.c, v: x.v }));
    if (resto > 0) fatias.push({ n: "Demais despesas", v: resto });
    const r = 70,
      c = 2 * Math.PI * r;
    let acc = 0;
    let s = `<svg viewBox="0 0 190 190" role="img" aria-label="Para onde vai o dinheiro"><g transform="rotate(-90 95 95)">`;
    fatias.forEach((f, i) => {
      const fr = total ? f.v / total : 0;
      s += `<circle cx="95" cy="95" r="${r}" fill="none" stroke="${cores[i]}" stroke-width="26" class="slice" style="--ad:${(0.3 + i * 0.15).toFixed(2)}s" data-dash="${Math.max(0, c * fr - 2)}" data-tot="${c}" stroke-dasharray="${Math.max(0, c * fr - 2)} ${c}" stroke-dashoffset="${-c * acc}"><title>${esc(f.n)}: ${pct(fr)}</title></circle>`;
      acc += fr;
    });
    s += `</g><text x="95" y="90" text-anchor="middle" fill="${C.muted}" font-size="10" font-family="Montserrat, sans-serif" letter-spacing="1.5">SAÍDAS</text>
  <text x="95" y="110" text-anchor="middle" fill="${C.txt}" font-size="15" font-weight="600" font-family="IBM Plex Mono, monospace" data-count="${total}" data-fmt="kfmt">${kfmt(total)}</text></svg>`;
    s +=
      "<ul>" +
      fatias
        .map(
          (f, i) =>
            `<li><i style="background:${cores[i]}"></i><span>${esc(f.n)}</span><b>${pct(total ? f.v / total : 0, 0)}</b></li>`,
        )
        .join("") +
      "</ul>";
    return s;
  }

  /* ---------- render ---------- */
  let ultimo = null;
  function render(d) {
    ultimo = d;
    lerCores();
    const k = calcular(d),
      M = k.M;
    $("cliente").textContent = d.cliente;
    const a = M[0],
      b = M[M.length - 1];
    $("periodo").textContent =
      M.length === 1
        ? `${MESL[a.mes]} de ${a.ano}`
        : `${MESL[a.mes][0].toUpperCase() + MESL[a.mes].slice(1)}${a.ano !== b.ano ? " de " + a.ano : ""} a ${MESL[b.mes]} de ${b.ano} · ${M.length} meses`;
    const bd = $("badge");
    bd.textContent = d.exemplo ? "Dados de exemplo" : `${d.rows.length} lançamentos`;
    bd.className = "badge" + (d.exemplo ? "" : " ok");

    const ent = M.map((m) => m.ent),
      sai = M.map((m) => m.sai),
      res = M.map((m) => m.res),
      mar = M.map((m) => m.mar);
    $("k-rec").textContent = brl.format(k.ent / k.n);
    $("k-rec").dataset.count = k.ent / k.n;
    $("k-rec").dataset.fmt = "brl";
    let v = variacao(ent);
    $("k-rec-s").textContent = v.t;
    $("k-rec-s").className = "sub " + v.c;
    $("k-desp").textContent = brl.format(k.sai / k.n);
    $("k-desp").dataset.count = k.sai / k.n;
    $("k-desp").dataset.fmt = "brl";
    v = variacao(sai, true);
    $("k-desp-s").textContent = v.t;
    $("k-desp-s").className = "sub " + v.c;
    $("k-res").textContent = brl.format(k.res / k.n);
    $("k-res").dataset.count = k.res / k.n;
    $("k-res").dataset.fmt = "brl";
    $("k-res").className = "val " + (k.res < 0 ? "down" : "");
    $("k-res-s").textContent = k.res >= 0 ? "Empresa no azul" : "Empresa no vermelho";
    $("k-res-s").className = "sub " + (k.res >= 0 ? "up" : "down");
    $("k-mar").textContent = pct(k.mar);
    $("k-mar").dataset.count = k.mar;
    $("k-mar").dataset.fmt = "pct";
    $("k-mar-s").textContent = k.mar >= 0.1 ? "Saudável, acima de 10%" : "Atenção, abaixo de 10%";
    $("k-mar-s").className = "sub " + (k.mar >= 0.1 ? "up" : "down");
    spark("s-rec", ent, C.sage);
    spark("s-desp", sai, C.copper);
    spark("s-res", res, C.gold);
    spark("s-mar", mar, C.olive);

    const R = (x) => (k.ent ? x / k.ent : 0);
    $("rings").innerHTML =
      ring(k.mar, C.sage, "Margem") +
      ring(R(k.porNome("imposto")), C.gold, "Impostos") +
      ring(R(k.porNome("folha")), C.copper, "Folha e encargos") +
      ring(R(k.porNome("fornecedor")), C.sand, "Fornecedores");

    $("tab").innerHTML =
      `<tr><th>Mês</th><th>Entradas</th><th>Saídas</th><th>Resultado</th></tr>` +
      M.map(
        (m) =>
          `<tr><td>${MES[m.mes]}/${String(m.ano).slice(2)}</td><td style="color:${C.sage}">${brl.format(m.ent)}</td><td style="color:${C.copper}">${brl.format(m.sai)}</td><td style="color:${m.res < 0 ? C.bad : C.txt}">${brl.format(m.res)}</td></tr>`,
      ).join("") +
      `<tr class="avg"><td>Média</td><td>${brl.format(k.ent / k.n)}</td><td>${brl.format(k.sai / k.n)}</td><td>${brl.format(k.res / k.n)}</td></tr>`;

    $("bars").innerHTML = barras(M);
    $("line").innerHTML = linha(M);
    $("donut").innerHTML = k.sai
      ? rosca(k.lista, k.sai)
      : '<p style="color:var(--muted)">Sem saídas no período.</p>';
    const mx = k.lista[0]?.m || 1,
      cores = [C.copper, C.gold, C.sage, C.sage, C.olive, C.olive, C.moss, C.moss];
    $("rank").innerHTML =
      k.lista
        .slice(0, 8)
        .map(
          (x, i) =>
            `<div class="rk"><span title="${esc(x.c)}">${esc(x.c)}</span><div class="bar"><i style="--i:${i};width:${Math.max(2, (x.m / mx) * 100)}%;background:${cores[i]}"></i></div><b data-count="${x.m}" data-fmt="brl">${brl.format(x.m)}</b></div>`,
        )
        .join("") || '<p style="color:var(--muted)">Sem saídas no período.</p>';

    // alertas
    const al = [];
    if (k.lista[0])
      al.push([
        C.copper,
        `Maior despesa: <b>${esc(k.lista[0].c)}</b>, com ${pct(R(k.lista[0].v), 0)} da receita.`,
      ]);
    const j = k.catMes[norm("Tarifas bancárias e juros")];
    if (j && j[0] > 0 && j[j.length - 1] > j[0])
      al.push([
        C.gold,
        `Juros e tarifas subiram ${pct((j[j.length - 1] - j[0]) / j[0], 0)} no período. Vale renegociar com o banco.`,
      ]);
    else if (j) al.push([C.sage, "Juros e tarifas estáveis no período."]);
    const ret = k.lista
      .filter((x) => /retirada|pro-labore|pro labore/.test(norm(x.c)))
      .reduce((a, x) => a + x.v, 0);
    if (ret > 0)
      al.push(
        ret > k.res
          ? [C.copper, "Retiradas dos sócios acima do resultado: o caixa da empresa está diminuindo."]
          : [C.sage, "Retiradas dos sócios dentro do resultado da empresa."],
      );
    const imp = k.porNome("imposto");
    if (imp > 0)
      al.push([
        C.gold,
        `Impostos consomem ${pct(R(imp))} da receita. Vale conferir se o regime tributário é o mais vantajoso.`,
      ]);
    const fol = k.porNome("folha");
    if (fol > 0) al.push([C.sage, `Folha e encargos representam ${pct(R(fol), 0)} da receita.`]);
    const neg = M.filter((m) => m.res < 0).length;
    if (neg) al.push([C.bad, `${neg} ${neg > 1 ? "meses" : "mês"} com resultado negativo no período.`]);
    al.push(
      k.mar < 0.1
        ? [C.copper, `Margem de ${pct(k.mar)}, abaixo de 10%: revisar preços, compras e despesas fixas.`]
        : [C.good, `Margem de ${pct(k.mar)}, em nível saudável.`],
    );
    $("alerts").innerHTML = al
      .map(([c, t]) => `<li><i style="background:${c}"></i><span>${t}</span></li>`)
      .join("");
    if (typeof animarIndicadores === "function")
      requestAnimationFrame(() => requestAnimationFrame(animarIndicadores));
  }

  /* ---------- arquivo ---------- */
  function abrir(f) {
    if (!f) return;
    const err = $("err");
    err.hidden = true;
    if (typeof XLSX === "undefined") {
      err.textContent =
        "Não consegui carregar o leitor de planilhas. Verifique a internet e recarregue a página.";
      err.hidden = false;
      return;
    }
    const rd = new FileReader();
    rd.onload = (e) => {
      try {
        render(lerPlanilha(new Uint8Array(e.target.result), f.name));
        window.__reanimar && window.__reanimar();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (x) {
        err.textContent = x.message || "Não consegui ler esta planilha.";
        err.hidden = false;
      }
    };
    rd.readAsArrayBuffer(f);
  }
  const inp = $("file");
  $("btn-open").onclick = () => inp.click();
  $("btn-open2").onclick = () => inp.click();
  inp.onchange = () => {
    abrir(inp.files[0]);
    inp.value = "";
  };
  $("btn-pdf").onclick = () => window.print();
  const dz = $("drop");
  ["dragenter", "dragover"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("over");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    document.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === "drop" || e.target === document.documentElement) dz.classList.remove("over");
    }),
  );
  document.addEventListener("drop", (e) => {
    dz.classList.remove("over");
    abrir(e.dataTransfer.files[0]);
  });

  /* ---------- animação dos indicadores ---------- */
  const semMov = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const FMT = { brl: (v) => brl.format(v), pct: (v) => pct(v), kfmt: (v) => kfmt(v) };
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  function contar(el, atraso) {
    const alvo = +el.dataset.count,
      f = FMT[el.dataset.fmt] || ((v) => v);
    if (!isFinite(alvo)) return;
    const dur = 1300,
      t0 = performance.now() + atraso * 1000;
    el.textContent = f(0);
    (function passo(t) {
      const x = Math.max(0, Math.min(1, (t - t0) / dur));
      el.textContent = f(alvo * ease(x));
      if (x < 1 && !el._parar) requestAnimationFrame(passo);
      else el.textContent = f(alvo);
    })(performance.now());
  }
  function animarQuadro(q) {
    if (semMov) return;
    const base = parseFloat(getComputedStyle(q).getPropertyValue("--d")) || 0.2;
    q.querySelectorAll(".arc,.slice").forEach((a) => {
      const tot = a.dataset.tot;
      a.style.transition = "none";
      a.style.opacity = 0;
      a.setAttribute("stroke-dasharray", "0 " + tot);
      if (!a.style.getPropertyValue("--ad")) a.style.setProperty("--ad", base + 0.3 + "s");
      else a.style.setProperty("--ad", base + parseFloat(a.style.getPropertyValue("--ad")) + "s");
      void a.getBoundingClientRect();
      a.style.transition = "";
      requestAnimationFrame(() => {
        a.style.opacity = 1;
        a.setAttribute("stroke-dasharray", a.dataset.dash + " " + tot);
      });
    });
    q.querySelectorAll(".sline").forEach((l) => {
      l.style.transition = "none";
      l.style.strokeDasharray = 1;
      l.style.strokeDashoffset = 1;
      l.style.setProperty("--ad", base + 0.25 + "s");
      void l.getBoundingClientRect();
      l.style.transition = "";
      requestAnimationFrame(() => (l.style.strokeDashoffset = 0));
      const fim = () => {
        l.style.transition = "none";
        l.style.strokeDasharray = "";
        l.style.strokeDashoffset = "";
      };
      l.addEventListener("transitionend", fim, { once: true });
      setTimeout(fim, (base + 2.2) * 1000);
    });
    q.querySelectorAll(".sarea").forEach((a) => {
      a.style.transition = "none";
      a.style.opacity = 0;
      a.style.setProperty("--ad", base + 0.25 + "s");
      void a.getBoundingClientRect();
      a.style.transition = "";
      requestAnimationFrame(() => (a.style.opacity = 1));
    });
    q.querySelectorAll(".pt,.ptl").forEach((p) => {
      p.classList.remove("go");
      const d = parseFloat(p.style.getPropertyValue("--ad")) || 0.9;
      p.style.setProperty("--ad", base + d + "s");
      void p.getBoundingClientRect();
      p.classList.add("go");
    });
    q.querySelectorAll("[data-count]").forEach((el) => contar(el, base + 0.25));
  }
  let obsQ = null;
  function animarIndicadores() {
    if (semMov) return;
    const qs = [...document.querySelectorAll(".grid > .p")];
    if (obsQ) obsQ.disconnect();
    obsQ =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            (es) =>
              es.forEach((e) => {
                if (e.isIntersecting) {
                  animarQuadro(e.target);
                  obsQ.unobserve(e.target);
                }
              }),
            { threshold: 0.15 },
          )
        : null;
    qs.forEach((q) => (obsQ ? obsQ.observe(q) : animarQuadro(q)));
  }
  window.addEventListener("beforeprint", () => {
    document.querySelectorAll("[data-count]").forEach((el) => {
      el._parar = true;
      el.textContent = (FMT[el.dataset.fmt] || ((v) => v))(+el.dataset.count);
    });
    document.querySelectorAll(".arc,.slice").forEach((a) => {
      a.style.transition = "none";
      a.style.opacity = 1;
      a.setAttribute("stroke-dasharray", a.dataset.dash + " " + a.dataset.tot);
    });
    document.querySelectorAll(".sline").forEach((l) => {
      l.style.transition = "none";
      l.style.strokeDashoffset = 0;
    });
    document.querySelectorAll(".sarea").forEach((a) => {
      a.style.transition = "none";
      a.style.opacity = 1;
    });
  });
  render(exemplo());
  function escuroAgora() {
    const t = document.documentElement.dataset.tema;
    return t === "escuro"; // abre sempre no claro
  }
  function corBarra() {
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = escuroAgora() ? "#12160D" : "#F3EEE3";
  }
  corBarra();
  $("btn-tema").onclick = () => {
    const novo = escuroAgora() ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("locus-tema", novo);
    } catch (e) {}
    corBarra();
    if (ultimo) render(ultimo);
  };
  if (window.matchMedia)
    matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
      corBarra();
      if (ultimo && !document.documentElement.dataset.tema) render(ultimo);
    });
  let rt;
  window.addEventListener("resize", () => {
    clearTimeout(rt);
    rt = setTimeout(() => ultimo && render(ultimo), 150);
  });
})();

/* ===== animação dos quadros ===== */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  var els = [].slice.call(document.querySelectorAll(".head > div, .head .badge, .drop, .grid > .p"));
  var vh = window.innerHeight,
    io =
      "IntersectionObserver" in window
        ? new IntersectionObserver(
            function (es) {
              es.forEach(function (e) {
                if (e.isIntersecting) {
                  e.target.classList.remove("pre");
                  io.unobserve(e.target);
                }
              });
            },
            { threshold: 0.1, rootMargin: "0px 0px -6% 0px" },
          )
        : null;
  var k = 0;
  els.forEach(function (el) {
    if (el.getBoundingClientRect().top < vh * 0.95) {
      el.style.setProperty("--d", 0.2 + k * 0.1 + "s");
      el.classList.add("anim");
      k++;
    } else if (io) {
      el.classList.add("sr", "pre");
      var col = el.offsetLeft > el.parentNode.offsetWidth / 3 ? 1 : 0;
      el.style.setProperty("--d", 0.15 + col * 0.12 + "s");
      io.observe(el);
    }
  });
  // ao abrir uma nova planilha, os quadros entram de novo
  var grid = document.getElementById("grid");
  window.__reanimar = function () {
    [].slice.call(grid.children).forEach(function (el, i) {
      el.classList.remove("anim", "sr", "pre");
      void el.offsetWidth;
      el.style.setProperty("--d", 0.15 + Math.min(i, 8) * 0.07 + "s");
      el.classList.add("anim");
    });
  };
})();
