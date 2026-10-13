// =========================================================
// CABEÇALHO: fundo ao rolar + menu mobile
// =========================================================
const header = document.querySelector('.site-header');
const nav = document.querySelector('.nav');
const menuButton = document.getElementById('menuButton');
const menuIcon = menuButton.querySelector('i');

function onScroll() {
    header.classList.toggle('scrolled', window.scrollY > 40);
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

function setMenu(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('no-scroll', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    menuIcon.className = open ? 'bx bx-x' : 'bx bx-menu-alt-right';
}

menuButton.addEventListener('click', () => setMenu(!nav.classList.contains('open')));

// Fecha o menu ao clicar em um link
document.querySelectorAll('#navLinks a').forEach((link) => {
    link.addEventListener('click', () => setMenu(false));
});

// Fecha com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) setMenu(false);
});

// Fecha se a tela crescer para o layout de desktop
window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => {
    if (e.matches) setMenu(false);
});

// =========================================================
// FOTOS DO PAINEL (dados/fotos.json)
// O painel em /admin edita esse arquivo. Se ele não carregar,
// o site continua com as fotos que já estão no HTML.
// =========================================================
function slugify(text) {
    return String(text)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

// O painel salva caminhos como "/meus-projetos/matheus/fotos/x.jpg".
// Aqui viram "fotos/x.jpg", que funciona em qualquer endereço do site.
function fixPath(path) {
    const p = String(path || '');
    const i = p.indexOf('fotos/');
    return p.startsWith('/') && i > 0 ? p.slice(i) : p;
}

async function loadSiteData() {
    try {
        // ?t= evita que o navegador mostre uma versão antiga depois de salvar no painel
        const res = await fetch(`dados/fotos.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function renderSlides(list) {
    const items = (list || []).filter((s) => s && s.foto);
    if (!items.length) return;
    const ul = document.querySelector('.hero .slides');
    ul.replaceChildren(...items.map((s, i) => {
        const li = document.createElement('li');
        li.className = 'slide' + (i === 0 ? ' is-active' : '');
        const img = document.createElement('img');
        img.src = fixPath(s.foto);
        img.alt = s.descricao || 'Ensaio fotográfico';
        if (i > 0) img.loading = 'lazy';
        li.appendChild(img);
        return li;
    }));
}

function renderAbout(sobre) {
    if (!sobre) return;
    const main = document.getElementById('sobreFoto1');
    const second = document.getElementById('sobreFoto2');
    if (sobre.foto_principal && main) main.src = fixPath(sobre.foto_principal);
    if (sobre.foto_secundaria && second) second.src = fixPath(sobre.foto_secundaria);
}

function renderCategories(list) {
    const cats = (list || []).filter((c) => c && c.nome && Array.isArray(c.fotos) && c.fotos.length);
    if (!cats.length) return;

    const galleries = {};
    const box = document.getElementById('categorias');
    box.replaceChildren(...cats.map((c) => {
        const slug = slugify(c.nome);
        galleries[slug] = { title: c.nome, images: c.fotos.filter(Boolean).map(fixPath) };

        const btn = document.createElement('button');
        btn.className = 'category reveal';
        btn.type = 'button';
        btn.dataset.category = slug;

        const img = document.createElement('img');
        img.src = fixPath(c.capa || c.fotos[0]);
        img.alt = '';
        img.loading = 'lazy';

        const info = document.createElement('span');
        info.className = 'category-info';
        const name = document.createElement('span');
        name.className = 'category-name';
        name.textContent = c.nome;
        const count = document.createElement('span');
        count.className = 'category-count';
        count.textContent = `${galleries[slug].images.length} fotos`;
        info.append(name, count);

        btn.append(img, info);
        return btn;
    }));

    // Usado pela galeria (modal.js)
    window.siteGalleries = galleries;
}

// =========================================================
// SLIDESHOW DO TOPO
// =========================================================
const SLIDE_TIME = 5000;
let slides = [];
let dots = [];
let slideIndex = 0;
let slideTimer = null;

function goToSlide(i) {
    if (!slides.length) return;
    slides[slideIndex].classList.remove('is-active');
    dots[slideIndex].classList.remove('is-active');
    slideIndex = (i + slides.length) % slides.length;
    slides[slideIndex].classList.add('is-active');
    dots[slideIndex].classList.add('is-active');
}

function restartTimer() {
    clearInterval(slideTimer);
    if (slides.length > 1) {
        slideTimer = setInterval(() => goToSlide(slideIndex + 1), SLIDE_TIME);
    }
}

function initSlideshow() {
    slides = Array.from(document.querySelectorAll('.hero .slide'));
    const dotsBox = document.querySelector('.slide-dots');
    slideIndex = slides.findIndex((s) => s.classList.contains('is-active'));
    if (slideIndex < 0) slideIndex = 0;

    // Cria um "pontinho" para cada foto
    dots = slides.map((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.setAttribute('aria-label', `Foto ${i + 1}`);
        dot.addEventListener('click', () => {
            goToSlide(i);
            restartTimer();
        });
        return dot;
    });
    dotsBox.replaceChildren(...dots);

    goToSlide(slideIndex);
    restartTimer();
}

document.querySelector('[data-slide="next"]').addEventListener('click', () => {
    goToSlide(slideIndex + 1);
    restartTimer();
});

document.querySelector('[data-slide="prev"]').addEventListener('click', () => {
    goToSlide(slideIndex - 1);
    restartTimer();
});

// Arrastar o dedo no celular
const hero = document.querySelector('.hero');
let touchStartX = 0;
hero.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
}, { passive: true });
hero.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diff) > 50) {
        goToSlide(slideIndex + (diff < 0 ? 1 : -1));
        restartTimer();
    }
});

// Pausa quando a aba não está visível
document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(slideTimer);
    else restartTimer();
});

// =========================================================
// ANIMAÇÃO DE ENTRADA AO ROLAR (anima só uma vez)
// =========================================================
const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

function initReveal() {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => revealObserver.observe(el));
}

// =========================================================
// ANOS DE EXPERIÊNCIA E ANO DO RODAPÉ (atualizam sozinhos)
// =========================================================
const currentYear = new Date().getFullYear();

document.querySelectorAll('[data-years-since]').forEach((el) => {
    el.textContent = currentYear - Number(el.dataset.yearsSince);
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = currentYear;

// =========================================================
// INÍCIO
// =========================================================
(async function start() {
    const data = await loadSiteData();
    if (data) {
        renderSlides(data.slideshow);
        renderAbout(data.sobre);
        renderCategories(data.categorias);
    }
    initSlideshow();
    initReveal();
})();
