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
// SLIDESHOW DO TOPO
// =========================================================
const slides = document.querySelectorAll('.hero .slide');
const dotsBox = document.querySelector('.slide-dots');
const SLIDE_TIME = 5000;
let slideIndex = 0;
let slideTimer = null;

// Cria um "pontinho" para cada foto
const dots = Array.from(slides, (_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Foto ${i + 1}`);
    dot.addEventListener('click', () => {
        goToSlide(i);
        restartTimer();
    });
    dotsBox.appendChild(dot);
    return dot;
});

function goToSlide(i) {
    slides[slideIndex].classList.remove('is-active');
    dots[slideIndex].classList.remove('is-active');
    slideIndex = (i + slides.length) % slides.length;
    slides[slideIndex].classList.add('is-active');
    dots[slideIndex].classList.add('is-active');
}

function restartTimer() {
    clearInterval(slideTimer);
    slideTimer = setInterval(() => goToSlide(slideIndex + 1), SLIDE_TIME);
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

goToSlide(0);
restartTimer();

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

document.querySelectorAll('.reveal').forEach((el) => revealObserver.observe(el));

// =========================================================
// ANOS DE EXPERIÊNCIA E ANO DO RODAPÉ (atualizam sozinhos)
// =========================================================
const currentYear = new Date().getFullYear();

document.querySelectorAll('[data-years-since]').forEach((el) => {
    el.textContent = currentYear - Number(el.dataset.yearsSince);
});

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = currentYear;
