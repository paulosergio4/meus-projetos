"use strict";

document.getElementById("form-contato").addEventListener("submit", function (e) {
  e.preventDefault();
  var nome = document.getElementById("f-nome");
  var msg = document.getElementById("form-msg");
  if (!nome.value.trim()) {
    msg.textContent = "Preencha o seu nome para continuar.";
    nome.focus();
    return;
  }
  msg.textContent =
    "Obrigado, " +
    nome.value.trim().split(" ")[0] +
    ". Esta é uma versão de demonstração; o envio será ativado quando o site for publicado no domínio da Lócus.";
});

/* ===== Efeitos de rolagem ===== */
(function () {
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hdr = document.getElementById("topo"),
    bar = document.getElementById("progress");
  var panel = document.querySelector(".hero .panel");
  var links = [].slice.call(document.querySelectorAll(".nav ul a"));
  var secs = links.map(function (a) {
    return document.querySelector(a.getAttribute("href"));
  });
  var ticking = false;
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
    if (hdr) hdr.classList.toggle("scrolled", y > 24);
    if (panel && !reduce && window.innerWidth > 900)
      panel.style.transform = "translateY(" + Math.min(60, y * 0.12) + "px)";
    var cur = -1;
    secs.forEach(function (s, i) {
      if (s && s.getBoundingClientRect().top < window.innerHeight * 0.4) cur = i;
    });
    links.forEach(function (a, i) {
      a.classList.toggle("active", i === cur);
    });
    ticking = false;
  }
  window.addEventListener(
    "scroll",
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(onScroll);
      }
    },
    { passive: true },
  );
  onScroll();

  // painel de exemplo: linha, área, ponto e números contando quando o painel aparece
  var line = document.querySelector(".draw"),
    area = document.querySelector(".chart .area"),
    dot = document.querySelector(".chart circle");
  if (line && line.getTotalLength) line.style.setProperty("--len", Math.ceil(line.getTotalLength()));
  var counters = [].slice.call(document.querySelectorAll(".kpi [data-to]"));
  function fmt(el, v) {
    var d = +el.dataset.dec || 0;
    return (
      (el.dataset.pre || "") +
      v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d }) +
      (el.dataset.suf || "")
    );
  }
  function contar(el, atraso) {
    var alvo = +el.dataset.to,
      dur = 1500,
      t0 = performance.now() + atraso;
    el.textContent = fmt(el, 0);
    (function passo(t) {
      var x = Math.max(0, Math.min(1, (t - t0) / dur));
      el.textContent = fmt(el, alvo * (1 - Math.pow(1 - x, 3)));
      if (x < 1) requestAnimationFrame(passo);
      else el.textContent = fmt(el, alvo);
    })(performance.now());
  }
  var kpis = [].slice.call(document.querySelectorAll(".hero .kpi"));
  function playPanel() {
    if (line) line.classList.add("on");
    if (area) area.classList.remove("pre");
    if (dot) dot.classList.remove("pre");
    kpis.forEach(function (k) {
      k.classList.remove("pre");
    });
    counters.forEach(function (el, i) {
      contar(el, 150 + Math.floor(i / 2) * 110);
    });
  }
  if (!reduce && panel) {
    if (area) area.classList.add("pre");
    if (dot) dot.classList.add("pre");
    kpis.forEach(function (k, i) {
      k.classList.add("sr", "pre");
      k.style.setProperty("--d", 0.1 + i * 0.1 + "s");
    });
    counters.forEach(function (el) {
      el.textContent = fmt(el, 0);
    });
    if ("IntersectionObserver" in window) {
      var po = new IntersectionObserver(
        function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) {
              po.disconnect();
              requestAnimationFrame(function () {
                requestAnimationFrame(playPanel);
              });
            }
          });
        },
        { threshold: 0.25 },
      );
      po.observe(panel);
    } else playPanel();
  } else if (line) {
    line.classList.add("on");
  }

  if (reduce || !("IntersectionObserver" in window)) return;
  var groups = [
    [".sec-head > div", "from-left"],
    [".sec-head > .lede", "from-right"],
    [".service", "svc"],
    [".step", ""],
    [".feature", "from-left"],
    [".phone", "zoom"],
    [".cta", "zoom"],
    [".doc", "doc"],
    [".mvv article", ""],
    [".value", ""],
    [".person", ""],
    [".contact > div", "from-left"],
    [".contact form", "from-right"],
    [".hero-meta > div", ""],
  ];
  var vh = window.innerHeight,
    els = [];
  groups.forEach(function (g) {
    var list = [].slice.call(document.querySelectorAll(g[0]));
    list.forEach(function (el, i) {
      el.classList.add("sr");
      if (g[1] && g[1] !== "doc") el.classList.add(g[1]);
      var cols = g[1] === "svc" ? (window.innerWidth > 900 ? 3 : window.innerWidth > 580 ? 2 : 1) : 1;
      el.style.setProperty(
        "--d",
        (g[1] === "doc"
          ? 0.18 + i * 0.07
          : g[1] === "svc"
            ? 0.05 + ((i % cols) + Math.floor(i / cols)) * 0.09
            : 0.04 + Math.min(i, 5) * 0.05) + "s",
      );
      // só esconde o que ainda está abaixo da tela: a página fica completa ao carregar
      if (el.getBoundingClientRect().top > vh * 0.92) {
        el.classList.add("pre");
        els.push(el);
      }
    });
  });
  var io = new IntersectionObserver(
    function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.remove("pre");
          io.unobserve(e.target);
        }
      });
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.12 },
  );
  els.forEach(function (el) {
    io.observe(el);
  });
  // segurança: se algo não disparar, mostra tudo depois de alguns segundos parado no fim
  window.addEventListener(
    "scroll",
    function () {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
        els.forEach(function (el) {
          el.classList.remove("pre");
        });
      }
    },
    { passive: true },
  );
})();

/* ===== claro / escuro ===== */
(function () {
  var root = document.documentElement,
    KEY = "locus-tema-site";
  try {
    var salvo = localStorage.getItem(KEY);
    if (salvo === "light" || salvo === "dark") root.setAttribute("data-theme", salvo);
  } catch (e) {}
  function escuro() {
    var t = root.getAttribute("data-theme");
    if (t) return t === "dark";
    return !!(window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
  }
  function barra() {
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute("content", escuro() ? "#181C12" : "#56623A");
  }
  barra();
  var b = document.getElementById("tema-btn");
  if (b)
    b.addEventListener("click", function () {
      var novo = escuro() ? "light" : "dark";
      root.setAttribute("data-theme", novo);
      try {
        localStorage.setItem(KEY, novo);
      } catch (e) {}
      barra();
    });
})();
