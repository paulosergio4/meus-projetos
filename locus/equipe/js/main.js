"use strict";

/* Área da equipe Lócus no computador (protótipo com dados de exemplo) */
(function () {
  const $ = (id) => document.getElementById(id);
  const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const P = {
    geral: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    clientes:
      '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    chamados: '<path d="M4 5h16v11H8l-4 4z"/>',
    entrada: '<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    prazos: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    publicar: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
  };
  const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${P[n]}</svg>`;

  /* ---------- dados de exemplo ---------- */
  const CLIENTES = [
    {
      n: "Mercado Bom Preço",
      cnpj: "12.345.678/0001-90",
      r: "Simples · Anexo I",
      resp: "Paulo",
      fat: 66.1,
      marg: 8.6,
      pend: 1,
      st: "due",
    },
    {
      n: "Padaria Silva",
      cnpj: "23.456.789/0001-01",
      r: "Simples · Anexo I",
      resp: "Bruno",
      fat: 38.4,
      marg: 6.2,
      pend: 3,
      st: "bad",
    },
    {
      n: "Auto Peças Pompéu",
      cnpj: "34.567.890/0001-12",
      r: "Lucro Presumido",
      resp: "Bruno",
      fat: 142.7,
      marg: 12.9,
      pend: 0,
      st: "ok",
    },
    {
      n: "Clínica Vida",
      cnpj: "45.678.901/0001-23",
      r: "Simples · Anexo III",
      resp: "Paulo",
      fat: 51.0,
      marg: 21.4,
      pend: 0,
      st: "ok",
    },
    {
      n: "Loja Estilo",
      cnpj: "56.789.012/0001-34",
      r: "MEI → ME",
      resp: "Paulo",
      fat: 9.8,
      marg: 14.1,
      pend: 2,
      st: "due",
    },
  ];
  const CHAMADOS = [
    {
      n: "Admissão · Ana Paula",
      cli: "Mercado Bom Preço",
      prazo: "hoje",
      st: "bad",
      resp: "Paulo",
      dados: [
        ["Nome", "Ana Paula Souza"],
        ["CPF", "321.654.987-00"],
        ["Início", "27/10/2026"],
        ["Função", "Repositora"],
        ["Salário", "R$ 1.850,00"],
        ["Horário", "seg a sáb, 8h às 17h"],
      ],
      anexos: [
        ["Contrato de trabalho", "cliente e funcionária assinam"],
        ["Ficha de registro", "só para guardar"],
      ],
    },
    {
      n: "Rescisão · Marcos",
      cli: "Padaria Silva",
      prazo: "23/10",
      st: "due",
      resp: "Bruno",
      dados: [
        ["Nome", "Marcos Oliveira"],
        ["Último dia", "22/10/2026"],
        ["Tipo", "Pedido de demissão"],
        ["Aviso prévio", "Trabalhado"],
      ],
      anexos: [
        ["Termo de rescisão", "cliente e funcionário assinam"],
        ["Guia do FGTS", "só para guardar"],
      ],
    },
    {
      n: "Férias · João Pereira",
      cli: "Mercado Bom Preço",
      prazo: "concluído",
      st: "ok",
      resp: "Paulo",
      dados: [
        ["Nome", "João Pereira"],
        ["Início", "01/12/2026"],
        ["Dias", "30"],
        ["Abono", "Não"],
        ["Adiantar 13º", "Não"],
      ],
      anexos: [
        ["Aviso de férias", "assinado pela empresa"],
        ["Recibo de férias", "assinado pela empresa"],
        ["Holerite de férias", "só para guardar"],
      ],
    },
    {
      n: "Dúvida · pró-labore",
      cli: "Clínica Vida",
      prazo: "24/10",
      st: "due",
      resp: "Paulo",
      dados: [
        ["Assunto", "Pró-labore"],
        ["Dúvida", "Posso baixar o pró-labore em dezembro?"],
      ],
      anexos: [],
    },
  ];
  const ENTRADA = [
    ["Extrato Itaú setembro.pdf", "Mercado Bom Preço", "hoje 08:12", "enviado"],
    ["Notas de compra (14 XML)", "Padaria Silva", "hoje 07:40", "automático"],
    ["Atestado · João.jpg", "Mercado Bom Preço", "ontem", "enviado"],
    ["Contrato social alterado.pdf", "Loja Estilo", "ontem", "enviado"],
    ["Extrato Sicoob outubro", "Auto Peças Pompéu", "ontem", "automático"],
  ];
  const PRAZOS = {
    20: ["DAS · 4 clientes", "FGTS Digital"],
    25: ["EFD-Contribuições"],
    31: ["DCTFWeb · 3 clientes"],
    15: ["INSS autônomos"],
    10: ["ISS Pompéu"],
  };

  let view = "geral",
    selCli = 0,
    selCh = 0;
  const conferidos = new Set();

  const pill = (st, t) =>
    `<span class="pill ${{ ok: "p-ok", due: "p-due", bad: "p-bad", new: "p-new" }[st]}">${t}</span>`;

  /* ---------- menu ---------- */
  const MENU = [
    ["geral", "Visão geral"],
    ["clientes", "Clientes"],
    ["chamados", "Chamados", () => CHAMADOS.filter((c) => c.st !== "ok").length],
    ["entrada", "Entrada", () => ENTRADA.length - conferidos.size],
    ["prazos", "Prazos"],
    ["publicar", "Publicar"],
  ];
  function renderMenu() {
    $("menu").innerHTML = MENU.map(([k, l, n]) => {
      const c = n ? n() : 0;
      return `<button type="button" data-view="${k}" ${view === k ? 'aria-current="page"' : ""}>${ic(k)}${l}${c ? `<span class="cnt">${c}</span>` : ""}</button>`;
    }).join("");
  }

  /* ---------- telas ---------- */
  const ph = (t, s, extra = "") => `<div class="ph"><div><h1>${t}</h1><p>${s}</p></div>${extra}</div>`;

  function tabelaChamados(clicavel) {
    return `<div class="tbl"><table><thead><tr><th>Pedido</th><th>Cliente</th><th>Responsável</th><th>Prazo</th></tr></thead><tbody>${CHAMADOS.map(
      (c, i) =>
        `<tr class="${clicavel ? "click" : ""}${clicavel && i === selCh ? " sel" : ""}" data-ch="${i}"><td><b>${c.n}</b></td><td>${c.cli}</td><td>${c.resp}</td><td>${pill(c.st, c.prazo)}</td></tr>`,
    ).join("")}</tbody></table></div>`;
  }

  const V = {
    geral: () => {
      const abertos = CHAMADOS.filter((c) => c.st !== "ok").length;
      return `${ph("Bom dia, Paulo", "Sexta-feira, 23 de outubro de 2026")}
  <div class="kpis">
    <div class="kpi"><small>Clientes ativos</small><b>${CLIENTES.length}</b><em class="up">meta: 15 até março</em></div>
    <div class="kpi"><small>Pendências dos clientes</small><b>${CLIENTES.reduce((a, c) => a + c.pend, 0)}</b><em class="down">2 atrasadas</em></div>
    <div class="kpi"><small>Chamados abertos</small><b>${abertos}</b><em class="down">1 vence hoje</em></div>
    <div class="kpi"><small>Documentos para conferir</small><b>${ENTRADA.length - conferidos.size}</b><em>2 chegaram sozinhos</em></div>
  </div>
  <div class="grid2">
    <section class="box"><div class="box-h"><h2>Chamados com prazo</h2><button type="button" class="btn ghost sm" data-view="chamados">Ver todos</button></div>${tabelaChamados(false)}</section>
    <section class="box"><div class="box-h"><h2>Próximos prazos</h2><button type="button" class="btn ghost sm" data-view="prazos">Calendário</button></div>
      <div class="tbl"><table style="min-width:0"><tbody>${[
        ["25/10", "EFD-Contribuições", "Auto Peças Pompéu"],
        ["31/10", "DCTFWeb", "3 clientes"],
        ["07/11", "FGTS Digital", "4 clientes"],
        ["20/11", "DAS · Simples", "4 clientes"],
      ]
        .map(([d, n, c]) => `<tr><td><b>${d}</b></td><td>${n}<span class="sub">${c}</span></td></tr>`)
        .join("")}</tbody></table></div></section>
  </div>`;
    },

    clientes: () => {
      const c = CLIENTES[selCli];
      return `${ph("Clientes", "Carteira do escritório. Clique numa empresa para ver o checklist do mês.", '<button type="button" class="btn" data-act="novo">+ Novo cliente</button>')}
  <div class="grid2">
    <section class="box"><div class="tbl"><table class="compacta"><thead><tr><th>Empresa</th><th>Regime</th><th>Resp.</th><th>Fat. set.</th><th>Situação</th></tr></thead><tbody>${CLIENTES.map(
      (x, i) =>
        `<tr class="click${i === selCli ? " sel" : ""}" data-cli="${i}"><td><b>${x.n}</b><span class="sub">${x.cnpj}</span></td><td>${x.r}</td><td>${x.resp}</td><td>R$ ${String(x.fat).replace(".", ",")} mil</td><td>${x.pend ? pill(x.st, x.pend + " pend.") : pill("ok", "Em dia")}</td></tr>`,
    ).join("")}</tbody></table></div></section>
    <aside class="box det"><div class="box-h"><h2>${c.n}</h2>${c.pend ? pill(c.st, c.pend + " pend.") : pill("ok", "Em dia")}</div><div class="box-b">
      <div class="linhas"><div><span>CNPJ</span><b>${c.cnpj}</b></div><div><span>Regime</span><b>${c.r}</b></div><div><span>Responsável</span><b>${c.resp}</b></div><div><span>Margem</span><b>${String(c.marg).replace(".", ",")}%</b></div></div>
      <h3 style="font-size:13px;margin:20px 0 10px">Checklist de outubro</h3>
      <div class="check">${[
        ["Notas importadas da SEFAZ", 1],
        ["Extratos recebidos", c.pend ? 0 : 1],
        ["Folha calculada", 1],
        ["DAS gerado e publicado", c.pend > 2 ? 0 : 1],
        ["Painel do mês enviado", 1],
      ]
        .map(
          ([t, ok]) =>
            `<div><i class="${ok ? "ok" : ""}">${ok ? ic("check") : ""}</i><span>${t}</span>${ok ? "" : pill("due", "Falta")}</div>`,
        )
        .join("")}</div>
      <div class="acoes"><button type="button" class="btn" data-act="lembrar">Lembrar no WhatsApp</button><button type="button" class="btn ghost" data-view="publicar">Publicar guia</button></div>
    </div></aside>
  </div>`;
    },

    chamados: () => {
      const c = CHAMADOS[selCh];
      return `${ph("Chamados", "Pedidos dos clientes. Clique para responder e concluir.")}
  <div class="grid2">
    <section class="box">${tabelaChamados(true)}</section>
    <aside class="box det"><div class="box-h"><h2>${c.n}</h2>${pill(c.st, c.prazo)}</div><div class="box-b">
      <p class="muted" style="margin:0 0 12px">${c.cli}</p>
      <div class="linhas">${c.dados.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join("")}</div>
      <div class="campo"><label for="ch-resp">Responsável</label><select id="ch-resp"><option ${c.resp === "Paulo" ? "selected" : ""}>Paulo</option><option ${c.resp === "Bruno" ? "selected" : ""}>Bruno</option></select></div>
      <div class="campo"><label>Arquivos para o cliente</label>
        <div class="anexos">${c.anexos.map(([n, s]) => `<div class="anexo">${ic("file")}<b>${n}</b><small>${s}</small></div>`).join("") || '<p class="tiny">Nenhum arquivo ainda.</p>'}</div>
        <button type="button" class="drop" data-act="anexar">Arraste os PDFs aqui ou clique para anexar</button>
      </div>
      <div class="campo"><label for="ch-msg">Mensagem para o cliente</label><textarea id="ch-msg" rows="3" placeholder="Ex.: o pagamento precisa cair na conta até 28/11"></textarea></div>
      <div class="acoes"><button type="button" class="btn" data-act="concluir">${ic("check")}Concluir e avisar cliente</button></div>
    </div></aside>
  </div>`;
    },

    entrada: () =>
      `${ph("Entrada", "Documentos que os clientes enviaram e os que chegaram sozinhos.")}
  <section class="box"><div class="tbl"><table><thead><tr><th>Documento</th><th>Cliente</th><th>Chegou</th><th>Origem</th><th></th></tr></thead><tbody>${ENTRADA.map(
    ([n, c, d, o], i) =>
      `<tr><td><b>${n}</b></td><td>${c}</td><td>${d}</td><td>${pill(o === "automático" ? "new" : "ok", o)}</td><td style="text-align:right">${conferidos.has(i) ? pill("ok", "Conferido") : `<button type="button" class="btn ghost sm" data-act="conferir" data-i="${i}">Conferir</button>`}</td></tr>`,
  ).join("")}</tbody></table></div></section>`,

    prazos: () => {
      const dias = ["D", "S", "T", "Q", "Q", "S", "S"].map((d) => `<div class="h">${d}</div>`).join("");
      const vazios = Array.from({ length: 4 }, () => '<div class="dia vazio"></div>').join("");
      const cel = Array.from({ length: 31 }, (_, k) => {
        const d = k + 1;
        return `<div class="dia${d === 23 ? " hoje" : ""}"><b>${d}</b>${(PRAZOS[d] || []).map((t) => `<span title="${t}">${t}</span>`).join("")}</div>`;
      }).join("");
      return `${ph("Prazos de outubro", "Obrigações de todos os clientes no mês.")}
  <section class="box"><div class="box-b"><div class="cal">${dias}${vazios}${cel}</div></div></section>`;
    },

    publicar: () =>
      `${ph("Publicar para o cliente", "A guia ou o relatório aparece no app do cliente, com aviso no celular e no WhatsApp.")}
  <section class="box"><div class="box-b"><form class="form" id="pub-form" novalidate>
    <div class="campo"><label for="p-cli">Cliente</label><select id="p-cli">${CLIENTES.map((c) => `<option>${c.n}</option>`).join("")}</select></div>
    <div class="campo"><label for="p-tipo">O que é</label><select id="p-tipo"><option>Guia DAS</option><option>Guia FGTS</option><option>Holerites</option><option>Painel do mês</option><option>Balancete</option></select></div>
    <div class="campo"><label for="p-val">Valor</label><input id="p-val" inputmode="decimal" placeholder="Ex.: R$ 4.050,12" /></div>
    <div class="campo"><label for="p-venc">Vencimento</label><input id="p-venc" type="date" /></div>
    <div class="campo full"><label>Arquivo</label><button type="button" class="drop" data-act="anexar">Arraste o PDF aqui ou importe do Domínio</button></div>
    <div class="campo full"><label for="p-msg">Mensagem</label><textarea id="p-msg" rows="3" placeholder="Ex.: DAS de outubro. Pague até o dia 20 para evitar multa."></textarea></div>
    <div class="acoes full"><button type="submit" class="btn">Publicar e avisar cliente</button></div>
  </form></div></section>`,
  };

  function render() {
    $("view").innerHTML = V[view]();
    renderMenu();
  }
  function ir(v) {
    view = v;
    render();
    $("view").focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  let tt;
  function toast(t) {
    const el = $("toast");
    el.textContent = t;
    el.classList.add("on");
    clearTimeout(tt);
    tt = setTimeout(() => el.classList.remove("on"), 2600);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-view],[data-cli],[data-ch],[data-act]");
    if (!t) return;
    if (t.dataset.view) return ir(t.dataset.view);
    if (t.dataset.cli) {
      selCli = +t.dataset.cli;
      return render();
    }
    if (t.dataset.ch) {
      selCh = +t.dataset.ch;
      if (view !== "chamados") return ir("chamados");
      return render();
    }
    const a = t.dataset.act;
    if (a === "concluir") {
      CHAMADOS[selCh].st = "ok";
      CHAMADOS[selCh].prazo = "concluído";
      render();
      return toast("Pedido concluído. O cliente recebeu o aviso no app e no WhatsApp.");
    }
    if (a === "conferir") {
      conferidos.add(+t.dataset.i);
      render();
      return toast("Documento conferido.");
    }
    if (a === "anexar") return toast("Prévia: aqui abriria a escolha de arquivos.");
    if (a === "lembrar") return toast("Mensagem enviada para o WhatsApp do cliente.");
    if (a === "novo") return toast("Prévia: aqui abriria o cadastro de um novo cliente.");
  });
  document.addEventListener("submit", (e) => {
    e.preventDefault();
    if (e.target.id === "login-form") {
      $("login").hidden = true;
      $("shell").hidden = false;
      return render();
    }
    if (e.target.id === "pub-form") toast("Publicado. O cliente recebeu o aviso no app.");
  });
  $("sair").addEventListener("click", () => {
    $("shell").hidden = true;
    $("login").hidden = false;
  });
  $("busca").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const q = e.target.value.trim().toLowerCase();
    const i = CLIENTES.findIndex((c) => c.n.toLowerCase().includes(q) || c.cnpj.includes(q));
    if (q && i >= 0) {
      selCli = i;
      ir("clientes");
    } else if (q) toast("Nenhum cliente encontrado com esse nome ou CNPJ.");
  });
})();
