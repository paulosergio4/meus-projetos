"use strict";

(function () {
  const $ = (id) => document.getElementById(id);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const I = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    guia: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    up: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    chat: '<path d="M4 5h16v11H8l-4 4z"/>',
    users:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    inbox: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    cam: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    out: '<path d="M14 4h5v16h-5M10 16l4-4-4-4M14 12H4"/>',
  };
  const ic = (n, s = "") =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${s}>${I[n]}</svg>`;

  /* ---------- dados de exemplo ---------- */
  const D = {
    empresa: "Mercado Bom Preço",
    resp: "Carla",
    meses: [
      ["abr", 58.2],
      ["mai", 61.0],
      ["jun", 59.4],
      ["jul", 64.3],
      ["ago", 65.2],
      ["set", 66.1],
    ],
    guias: [
      { id: "das", n: "DAS · Simples Nacional", c: "Setembro/2026", v: 4050.12, venc: "20/11", st: "due" },
      { id: "fgts", n: "FGTS Digital", c: "Setembro/2026", v: 784.0, venc: "20/10", st: "ok" },
      { id: "inss", n: "DCTFWeb · INSS", c: "Setembro/2026", v: 1612.4, venc: "20/10", st: "ok" },
      { id: "iss", n: "ISS Pompéu", c: "Setembro/2026", v: 212.55, venc: "10/10", st: "ok" },
      { id: "das8", n: "DAS · Simples Nacional", c: "Agosto/2026", v: 4000.0, venc: "20/09", st: "ok" },
    ],
    docs: [
      { n: "Extrato Itaú setembro.pdf", d: "hoje, 08:12", st: "new" },
      { n: "Nota de compra · Distribuidora.xml", d: "ontem", st: "ok" },
      { n: "Atestado · João.jpg", d: "14/10", st: "ok" },
    ],
    chamados: [
      { n: "Admissão · Ana Paula", d: "aberto ontem", st: "due" },
      { n: "Dúvida sobre pró-labore", d: "respondido", st: "ok" },
    ],
    clientes: [
      { n: "Mercado Bom Preço", r: "Simples · Anexo I", pend: 1, st: "due", cor: "#C0743F" },
      { n: "Padaria Silva", r: "Simples · Anexo I", pend: 3, st: "bad", cor: "#B03A2E" },
      { n: "Auto Peças Pompéu", r: "Lucro Presumido", pend: 0, st: "ok", cor: "#3F6E22" },
      { n: "Clínica Vida", r: "Simples · Anexo III", pend: 0, st: "ok", cor: "#3F6E22" },
      { n: "Loja Estilo", r: "MEI → ME", pend: 2, st: "due", cor: "#C0743F" },
    ],
  };
  let role = "cli",
    tab = "inicio",
    stack = [],
    logged = false;

  /* ---------- abas ---------- */
  const TABS = {
    cli: [
      ["inicio", "Início", "home"],
      ["guias", "Guias", "guia", 1],
      ["enviar", "Enviar", "up"],
      ["painel", "Painel", "chart"],
      ["falar", "Falar", "chat"],
    ],
    eq: [
      ["clientes", "Clientes", "users"],
      ["prazos", "Prazos", "cal"],
      ["entrada", "Entrada", "inbox", 4],
      ["publicar", "Publicar", "up"],
      ["eqchat", "Chamados", "chat", 2],
    ],
  };
  function renderTabs() {
    $("tabs").innerHTML = TABS[role]
      .map(
        ([k, l, i, b]) =>
          `<button type="button" data-tab="${k}" ${tab === k ? 'aria-current="page"' : ""}>${ic(i)}${l}${b ? `<span class="badge">${b}</span>` : ""}</button>`,
      )
      .join("");
  }
  const LEG = {
    cli: [
      ["1", "Início", "Resumo do mês, próximo vencimento e avisos."],
      ["2", "Guias", "Todas as guias com código de barras e PIX para copiar."],
      ["3", "Enviar", "Foto do celular ou arquivo: notas, extratos, atestados."],
      ["4", "Painel", "Faturamento, margem e impostos todo mês."],
      ["5", "Falar", "Chamados e conversa com a Lócus, com histórico."],
    ],
    eq: [
      ["1", "Clientes", "Carteira com pendências de cada empresa."],
      ["2", "Prazos", "Calendário de obrigações do mês."],
      ["3", "Entrada", "Documentos que os clientes enviaram."],
      ["4", "Publicar", "Subir guia ou relatório e avisar o cliente."],
      ["5", "Chamados", "Pedidos dos clientes com prazo."],
    ],
  };
  function renderLegend() {
    $("legend").innerHTML =
      `<span class="eb" style="font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:var(--copper)">${role === "cli" ? "Área do cliente" : "Área da equipe"}</span>` +
      LEG[role].map(([n, t, d]) => `<div><i>${n}</i><span><b>${t}</b>${d}</span></div>`).join("");
  }

  /* ---------- telas ---------- */
  function spark() {
    const v = D.meses.map((m) => m[1]),
      mn = Math.min(...v) - 3,
      mx = Math.max(...v) + 1;
    const pts = v.map((x, i) => [(i / (v.length - 1)) * 300, 50 - ((x - mn) / (mx - mn)) * 44]);
    const p = pts.map((q) => q.join(",")).join(" ");
    return `<svg class="spark" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#B9C38E" stop-opacity=".35"/><stop offset="1" stop-color="#B9C38E" stop-opacity="0"/></linearGradient></defs><polygon points="0,54 ${p} 300,54" fill="url(#sg)"/><polyline points="${p}" fill="none" stroke="#B9C38E" stroke-width="2.5" vector-effect="non-scaling-stroke"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4" fill="#C0743F"/></svg>`;
  }
  function temaAtual() {
    try {
      return localStorage.getItem("locus-app-tema") || "auto";
    } catch (_) {
      return "auto";
    }
  }
  const pill = (st) =>
    ({
      ok: '<span class="pill p-ok">Pago</span>',
      due: '<span class="pill p-due">A pagar</span>',
      bad: '<span class="pill p-bad">Atrasado</span>',
      new: '<span class="pill p-new">Novo</span>',
    })[st];
  const S = {
    inicio:
      () => `<div class="hdr"><div class="who"><small>Bom dia, ${D.resp}</small><b>${D.empresa}</b></div><span class="acts"><button type="button" class="tbtn" data-act="tema" aria-label="Mudar entre fundo claro e escuro"><svg class="lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg><svg class="sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><button type="button" class="av" data-go="perfil" aria-label="Perfil">MB</button></span></div>
  <div class="hero"><small>Faturamento de setembro</small><div class="big">R$ 66,1 mil</div>${spark()}
   <div class="row"><div>Margem<b>8,6%</b></div><div>Impostos<b>6,1%</b></div><div>vs agosto<b style="color:var(--hero-line)">+1,4%</b></div></div></div>
  <div class="sec">Próximo vencimento</div>
  <button type="button" class="item" data-guia="das"><span class="ic">${ic("guia")}</span><span class="tx"><b>DAS · Simples Nacional</b><span>vence 20/11 · faltam 30 dias</span></span><span class="vl">${brl(4050.12)}</span></button>
  <div class="sec">Avisos da Lócus</div>
  <div class="stack">
   <div class="item"><span class="ic" style="color:var(--copper)">${ic("bell")}</span><span class="tx"><b>Painel de setembro pronto</b><span>Sua margem subiu 0,4 ponto</span></span>${pill("new")}</div>
   <div class="item"><span class="ic">${ic("file")}</span><span class="tx"><b>Falta o extrato do Sicoob</b><span>Envie até 05/11 para fechar o mês</span></span></div>
  </div>`,
    guias: () => `<h2 class="t">Guias</h2><p class="s">Toque para ver o código de barras ou o PIX.</p>
  <div class="seg" role="group"><button type="button" aria-pressed="true">Todas</button><button type="button" aria-pressed="false">A pagar</button><button type="button" aria-pressed="false">Pagas</button></div>
  <div class="stack">${D.guias.map((g) => `<button type="button" class="item" data-guia="${g.id}"><span class="ic">${ic("guia")}</span><span class="tx"><b>${g.n}</b><span>${g.c} · vence ${g.venc}</span></span><span class="vl">${brl(g.v)}<br>${pill(g.st)}</span></button>`).join("")}</div>`,
    enviar:
      () => `<h2 class="t">Enviar documento</h2><p class="s">Notas, extratos, atestados ou qualquer papel da empresa.</p>
  <div class="grid2" style="margin-bottom:12px"><button type="button" class="drop" data-act="foto">${ic("cam")}<b>Tirar foto</b><span style="font-size:12px">Nota ou recibo</span></button><button type="button" class="drop" data-act="arquivo">${ic("file")}<b>Arquivo</b><span style="font-size:12px">PDF, XML ou planilha</span></button></div>
  <div class="field"><label for="e-tipo">Tipo de documento</label><select id="e-tipo"><option>Extrato bancário</option><option>Nota de compra</option><option>Atestado / férias</option><option>Contrato</option><option>Outro</option></select></div>
  <div class="sec">Enviados recentemente</div>
  <div class="stack">${D.docs.map((d) => `<div class="item"><span class="ic">${ic("file")}</span><span class="tx"><b>${d.n}</b><span>${d.d}</span></span>${d.st === "new" ? '<span class="pill p-new">Em análise</span>' : '<span class="pill p-ok">Recebido</span>'}</div>`).join("")}</div>`,
    painel: () => `<h2 class="t">Painel</h2><p class="s">Setembro de 2026 · atualizado pela Lócus em 08/10</p>
  <div class="grid2"><div class="kpi"><small>Faturamento</small><b>R$ 66,1 mil</b><em class="up">▲ 1,4%</em></div><div class="kpi"><small>Despesas</small><b>R$ 60,2 mil</b><em class="down">▲ 1,0%</em></div><div class="kpi"><small>Resultado</small><b>R$ 5,9 mil</b><em class="up">▲ 5,9%</em></div><div class="kpi"><small>Margem</small><b>8,6%</b><em class="down">abaixo de 10%</em></div></div>
  <div class="sec">Faturamento · 6 meses</div>
  <div class="card">${(() => {
    const mx = Math.max(...D.meses.map((m) => m[1]));
    return `<div style="display:flex;align-items:flex-end;gap:10px;height:130px">${D.meses.map((m, i) => `<div style="flex:1;display:grid;gap:6px;justify-items:center"><span style="font-family:var(--mono);font-size:10.5px;color:var(--muted)">${String(m[1]).replace(".", ",")}</span><div style="width:100%;height:${(m[1] / mx) * 90}px;border-radius:8px 8px 4px 4px;background:${i === D.meses.length - 1 ? "var(--olive)" : "color-mix(in srgb,var(--olive) 35%,transparent)"}"></div><span style="font-size:11px;color:var(--muted)">${m[0]}</span></div>`).join("")}</div>`;
  })()}</div>
  <div class="sec">Para onde vai o dinheiro</div>
  <div class="card stack">${[
    ["Fornecedores", 57, "#C0743F"],
    ["Folha e encargos", 16, "#C9962E"],
    ["Retiradas", 10, "#56623A"],
    ["Impostos", 7, "#8C9866"],
    ["Outros", 10, "#B9C38E"],
  ]
    .map(
      ([n, p, c]) =>
        `<div><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:5px"><span>${n}</span><b style="font-family:var(--mono);font-weight:500">${p}%</b></div><div class="bar"><i style="width:${p}%;background:${c}"></i></div></div>`,
    )
    .join("")}</div>`,
    falar: () => `<h2 class="t">Falar com a Lócus</h2><p class="s">Abra um pedido ou mande uma mensagem.</p>
  <div class="grid2" style="margin-bottom:6px">${["Admissão", "Rescisão", "Férias", "Dúvida"].map((t) => `<button type="button" class="item" style="justify-content:center;font-weight:600" data-act="pedido" data-t="${t}">${t}</button>`).join("")}</div>
  <div class="sec">Seus pedidos</div><div class="stack">${D.chamados.map((c) => `<div class="item"><span class="ic">${ic("chat")}</span><span class="tx"><b>${c.n}</b><span>${c.d}</span></span>${c.st === "ok" ? '<span class="pill p-ok">Respondido</span>' : '<span class="pill p-due">Em andamento</span>'}</div>`).join("")}</div>
  <div class="sec">Conversa</div>
  <div class="chat"><div class="msg them">Oi, Carla! Seu painel de setembro já está no app. A margem melhorou 👍<small>Bruno · 08/10</small></div><div class="msg me">Que ótimo! E o extrato do Sicoob, mando por aqui?<small>você · 08/10</small></div><div class="msg them">Isso, pela aba Enviar. Até dia 05.<small>Bruno · 08/10</small></div></div>`,
    perfil:
      () => `<button type="button" class="back" data-back>${ic("back")}Voltar</button><h2 class="t">Minha empresa</h2><p class="s">CNPJ 12.345.678/0001-90</p>
  <div class="card stack" style="gap:12px">${[
    ["Regime", "Simples Nacional · Anexo I"],
    ["Responsável na Lócus", "Bruno"],
    ["Funcionários", "8"],
    ["Plano", "Gestão"],
  ]
    .map(
      ([a, b]) =>
        `<div style="display:flex;justify-content:space-between;gap:10px"><span style="color:var(--muted)">${a}</span><b>${b}</b></div>`,
    )
    .join("")}</div>
  <div class="sec">Aparência</div>
  <div class="seg" role="group" aria-label="Aparência do app">${[
    ["auto", "Automático"],
    ["light", "Claro"],
    ["dark", "Escuro"],
  ]
    .map(
      ([k, l]) => `<button type="button" data-tema="${k}" aria-pressed="${temaAtual() === k}">${l}</button>`,
    )
    .join("")}</div>
  <div class="sec">Preferências</div>
  <div class="stack"><div class="item"><span class="ic">${ic("bell")}</span><span class="tx"><b>Avisos no WhatsApp</b><span>Guia nova e vencimento em 3 dias</span></span><span class="pill p-ok">Ligado</span></div></div>
  <div style="height:16px"></div><button type="button" class="btn ghost" data-act="sair">${ic("out")}Sair</button>`,

    /* ----- equipe ----- */
    clientes:
      () => `<div class="hdr"><div class="who"><small>Equipe Lócus</small><b>Bom dia, Paulo</b></div><span class="acts"><button type="button" class="tbtn" data-act="tema" aria-label="Mudar entre fundo claro e escuro"><svg class="lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/></svg><svg class="sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button><span class="av">PS</span></span></div>
  <div class="grid2"><div class="kpi"><small>Clientes ativos</small><b>5</b><em class="up">meta: 15</em></div><div class="kpi"><small>Pendências</small><b>6</b><em class="down">2 atrasadas</em></div></div>
  <div class="sec">Carteira</div>
  <div class="stack">${D.clientes
    .map(
      (c, i) =>
        `<button type="button" class="item" data-cli="${i}"><span class="ic" style="font-weight:700;color:${c.cor}">${c.n
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join(
            "",
          )}</span><span class="tx"><b>${c.n}</b><span>${c.r}</span></span>${c.pend ? `<span class="pill ${c.st === "bad" ? "p-bad" : "p-due"}">${c.pend} pend.</span>` : '<span class="pill p-ok">Em dia</span>'}</button>`,
    )
    .join("")}</div>`,
    cliente: (i) => {
      const c = D.clientes[i];
      return `<button type="button" class="back" data-back>${ic("back")}Clientes</button><h2 class="t">${c.n}</h2><p class="s">${c.r}</p>
  <div class="grid2"><div class="kpi"><small>Faturamento set.</small><b>R$ 66,1 mil</b></div><div class="kpi"><small>Margem</small><b>8,6%</b></div></div>
  <div class="sec">Checklist de outubro</div>
  <div class="card stack" style="gap:12px">${[
    ["Notas importadas do SEFAZ", 1],
    ["Extratos recebidos", 0],
    ["Folha calculada", 1],
    ["DAS gerado e publicado", 1],
    ["Painel do mês enviado", 1],
  ]
    .map(
      ([t, d]) =>
        `<div style="display:flex;gap:10px;align-items:center"><span style="width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:${d ? "var(--olive)" : "var(--soft)"};color:#fff">${d ? ic("check", 'style="width:14px;height:14px"') : ""}</span><span style="${d ? "" : "font-weight:600"}">${t}</span>${d ? "" : '<span class="pill p-due" style="margin-left:auto">Falta</span>'}</div>`,
    )
    .join("")}</div>
  <div style="height:12px"></div><button type="button" class="btn" data-act="cobrar">Lembrar cliente no WhatsApp</button>`;
    },
    prazos: () => `<h2 class="t">Prazos de outubro</h2><p class="s">Obrigações de todos os clientes.</p>
  <div class="card"><div class="cal">${["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<span class="h">${d}</span>`).join("")}${Array.from({ length: 3 }, () => "<span></span>").join("")}${Array.from(
    { length: 31 },
    (_, k) => {
      const d = k + 1;
      const c = [20].includes(d) ? "d1" : [25].includes(d) ? "d2" : "";
      return `<span class="${c} ${d === 21 ? "td" : ""}">${d}</span>`;
    },
  ).join("")}</div></div>
  <div class="sec">Próximos</div>
  <div class="stack">${[
    ["25/10", "EFD-Contribuições", "Auto Peças Pompéu", "due"],
    ["31/10", "DCTFWeb", "3 clientes", "due"],
    ["07/11", "FGTS Digital", "4 clientes", "due"],
    ["20/11", "DAS · Simples", "4 clientes", "due"],
  ]
    .map(
      ([d, n, c]) =>
        `<div class="item"><span class="ic" style="font-family:var(--mono);font-size:11px;font-weight:600">${d.slice(0, 2)}</span><span class="tx"><b>${n}</b><span>${c}</span></span><span class="pill p-due">${d}</span></div>`,
    )
    .join("")}</div>`,
    entrada: () => `<h2 class="t">Entrada</h2><p class="s">Documentos que os clientes enviaram.</p>
  <div class="stack">${[
    ["Extrato Itaú setembro.pdf", "Mercado Bom Preço", "hoje 08:12"],
    ["Notas de compra (14).zip", "Padaria Silva", "hoje 07:40"],
    ["Atestado · João.jpg", "Mercado Bom Preço", "ontem"],
    ["Contrato social alterado.pdf", "Loja Estilo", "ontem"],
  ]
    .map(
      ([n, c, d], i) =>
        `<div class="item"><span class="ic">${ic("file")}</span><span class="tx"><b>${n}</b><span>${c} · ${d}</span></span><button type="button" class="pill p-new" data-act="ok" aria-label="Marcar como conferido">Conferir</button></div>`,
    )
    .join("")}</div>`,
    publicar:
      () => `<h2 class="t">Publicar para o cliente</h2><p class="s">A guia aparece no app e o cliente recebe aviso.</p>
  <div class="field"><label for="p-cli">Cliente</label><select id="p-cli">${D.clientes.map((c) => `<option>${c.n}</option>`).join("")}</select></div>
  <div class="field"><label for="p-tipo">O que é</label><select id="p-tipo"><option>Guia DAS</option><option>Guia FGTS</option><option>Holerites</option><option>Painel do mês</option><option>Balancete</option></select></div>
  <div class="grid2"><div class="field"><label for="p-val">Valor</label><input id="p-val" value="R$ 4.050,12"></div><div class="field"><label for="p-venc">Vencimento</label><input id="p-venc" value="20/11/2026"></div></div>
  <button type="button" class="drop" style="width:100%;margin-bottom:14px" data-act="arquivo">${ic("up")}<b>Anexar PDF</b><span style="font-size:12px">ou importar do Domínio</span></button>
  <button type="button" class="btn" data-act="publicar">Publicar e avisar cliente</button>`,
    eqchat: () => `<h2 class="t">Chamados</h2><p class="s">Pedidos com prazo de resposta.</p>
  <div class="stack">${[
    ["Admissão · Ana Paula", "Mercado Bom Preço", "prazo hoje", "p-bad"],
    ["Rescisão · Marcos", "Padaria Silva", "prazo 23/10", "p-due"],
    ["Dúvida sobre pró-labore", "Clínica Vida", "respondido", "p-ok"],
  ]
    .map(
      ([n, c, d, p]) =>
        `<div class="item"><span class="ic">${ic("chat")}</span><span class="tx"><b>${n}</b><span>${c}</span></span><span class="pill ${p}">${d}</span></div>`,
    )
    .join("")}</div>`,
  };

  function render(anim = true) {
    const v = $("view");
    const top = stack.at(-1);
    v.innerHTML = top ? S[top.s](top.a) : S[tab]();
    v.classList.remove("anim");
    if (anim) {
      void v.offsetWidth;
      v.classList.add("anim");
    }
    v.scrollTop = 0;
    renderTabs();
    renderLegend();
  }
  function go(t) {
    tab = t;
    stack = [];
    render();
  }
  function push(s, a) {
    stack.push({ s, a });
    render();
  }
  let tt;
  function toast(t) {
    $("toastTx").textContent = t;
    $("toast").classList.add("on");
    clearTimeout(tt);
    tt = setTimeout(() => $("toast").classList.remove("on"), 2200);
  }
  function sheet(h) {
    $("sheetBody").innerHTML = h;
    $("sheet").classList.add("on");
    $("sheetBg").classList.add("on");
  }
  function closeSheet() {
    $("sheet").classList.remove("on");
    $("sheetBg").classList.remove("on");
  }
  $("sheetBg").onclick = closeSheet;

  document.addEventListener("click", (e) => {
    const t = e.target.closest(
      "[data-tema],[data-tab],[data-go],[data-back],[data-guia],[data-cli],[data-act],.seg button",
    );
    if (!t) return;
    if (t.dataset.tema) {
      aplicarTema(t.dataset.tema);
      t.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t));
      return toast(
        t.dataset.tema === "auto"
          ? "O app segue o tema do celular."
          : "Tema " + (t.dataset.tema === "dark" ? "escuro" : "claro") + " ativado.",
      );
    }
    if (t.dataset.tab) return go(t.dataset.tab);
    if (t.dataset.go) return push(t.dataset.go);
    if (t.hasAttribute("data-back")) {
      stack.pop();
      return render();
    }
    if (t.dataset.cli) return push("cliente", +t.dataset.cli);
    if (t.matches(".seg button")) {
      t.parentNode.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", b === t));
      return;
    }
    if (t.dataset.guia) {
      const g = D.guias.find((x) => x.id === t.dataset.guia);
      return sheet(`<h2 class="t">${g.n}</h2><p class="s">${g.c} · vence ${g.venc}</p><div class="kpi" style="margin-bottom:12px"><small>Valor</small><b style="font-size:26px">${brl(g.v)}</b></div>
    <div class="sec" style="margin-top:0">Código de barras</div><div class="code">85810000040-5 50120385202-6 61120002026-1 09120003213-4</div><div style="height:10px"></div>
    <button type="button" class="btn" data-act="copiar">${ic("copy")}Copiar código</button><div style="height:8px"></div><button type="button" class="btn ghost" data-act="pix">Pagar com PIX</button>`);
    }
    const a = t.dataset.act;
    if (a === "tema") {
      aplicarTema(escuroAgora() ? "light" : "dark");
      return;
    }
    if (a === "copiar") {
      try {
        navigator.clipboard.writeText("85810000040550120385202661120002026109120003213 4").catch(() => {});
      } catch (_) {}
      closeSheet();
      return toast("Código copiado. Cole no app do seu banco.");
    }
    if (a === "pix") {
      closeSheet();
      return toast("Código PIX copiado.");
    }
    if (a === "foto" || a === "arquivo") {
      return toast("No app de verdade, abre a câmera ou os arquivos.");
    }
    if (a === "pedido") {
      return sheet(
        `<h2 class="t">Novo pedido · ${t.dataset.t}</h2><p class="s">A equipe responde em até 1 dia útil.</p><div class="field"><label for="pd-tx">Detalhes</label><textarea id="pd-tx" rows="4">Nome, data de início, salário e função.</textarea></div><button type="button" class="btn" data-act="enviarPedido">Enviar pedido</button>`,
      );
    }
    if (a === "enviarPedido") {
      closeSheet();
      return toast("Pedido enviado. Você recebe a resposta aqui.");
    }
    if (a === "cobrar") return toast("Mensagem enviada para o WhatsApp do cliente.");
    if (a === "ok") {
      t.outerHTML = '<span class="pill p-ok">Conferido</span>';
      return toast("Documento conferido.");
    }
    if (a === "publicar") return toast("Guia publicada. O cliente recebeu um aviso.");
    if (a === "sair") {
      logged = false;
      $("login").hidden = false;
      return;
    }
  });

  /* ---------- login e papel ---------- */
  function entrar() {
    logged = true;
    $("login").hidden = true;
    stack = [];
    tab = role === "cli" ? "inicio" : "clientes";
    render();
  }
  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    entrar();
  });
  $("bio").onclick = entrar;
  const QUEM = {
    empresa: ["CNPJ da empresa", "12.345.678/0001-90", "numeric"],
    socio: ["CPF do dono ou sócio", "123.456.789-00", "numeric"],
    func: ["E-mail do funcionário", "carla@mercadobompreco.com.br", "email"],
  };
  document.querySelectorAll("[data-quem]").forEach(
    (b) =>
      (b.onclick = () => {
        document.querySelectorAll("[data-quem]").forEach((x) => x.setAttribute("aria-pressed", x === b));
        const [l, v, m] = QUEM[b.dataset.quem];
        $("l-lab").textContent = l;
        const i = $("l-user");
        i.value = v;
        i.inputMode = m;
        i.type = m === "email" ? "email" : "text";
      }),
  );
  $("google").onclick = () => {
    const g = $("google");
    g.disabled = true;
    g.lastChild.textContent = "Conectando ao Google…";
    setTimeout(() => {
      g.disabled = false;
      g.lastChild.textContent = "Entrar com Google";
      entrar();
    }, 1100);
  };
  function setRole(r) {
    role = r;
    $("as-cli").setAttribute("aria-pressed", r === "cli");
    $("as-eq").setAttribute("aria-pressed", r === "eq");
    $("m-role").textContent = r === "cli" ? "Ver como equipe" : "Ver como cliente";
    tab = r === "cli" ? "inicio" : "clientes";
    stack = [];
    closeSheet();
    if (logged) render();
    else {
      renderLegend();
    }
  }
  $("as-cli").onclick = () => setRole("cli");
  $("as-eq").onclick = () => setRole("eq");
  $("m-role").onclick = () => setRole(role === "cli" ? "eq" : "cli");

  /* ---------- abertura ---------- */
  function abrir() {
    const s = $("splash");
    s.classList.remove("out", "gone");
    const c = s.cloneNode(true);
    s.replaceWith(c);
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => c.classList.add("out"), reduce ? 300 : 4400);
    setTimeout(() => c.classList.add("gone"), reduce ? 900 : 5150);
  }
  $("replay").onclick = () => {
    logged = false;
    $("login").hidden = false;
    abrir();
  };
  $("m-replay").onclick = $("replay").onclick;
  function escuroAgora() {
    const r = document.documentElement;
    return r.dataset.theme
      ? r.dataset.theme === "dark"
      : !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function aplicarTema(k) {
    const r = document.documentElement;
    if (k === "auto") delete r.dataset.theme;
    else r.dataset.theme = k;
    try {
      localStorage.setItem("locus-app-tema", k);
    } catch (_) {}
    corBarra();
    setTimeout(corBarra, 350);
  }
  function corBarra() {
    const bg =
      (getComputedStyle(document.documentElement).getPropertyValue("--bg") || "").trim() ||
      (escuroAgora() ? "#14180F" : "#F6F2E9");
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
    const m = document.createElement("meta");
    m.name = "theme-color";
    m.content = bg;
    document.head.appendChild(m);
  }
  $("themeBtn").onclick = () => aplicarTema(escuroAgora() ? "light" : "dark");
  try {
    const t = localStorage.getItem("locus-app-tema");
    if (t) aplicarTema(t);
  } catch (_) {}
  corBarra();
  try {
    matchMedia("(prefers-color-scheme: dark)").addEventListener("change", corBarra);
  } catch (_) {}

  /* relógio */
  function hora() {
    const d = new Date();
    $("clock").textContent = d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0");
  }
  hora();
  setInterval(hora, 30000);

  renderTabs();
  renderLegend();
  render(false);
  abrir();
})();
