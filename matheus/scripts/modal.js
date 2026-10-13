// =========================================================
// GALERIA DE ENSAIOS (LIGHTBOX)
// Para adicionar fotos, basta incluir o caminho na lista da categoria.
// =========================================================
const galleries = {
    empresarial: {
        title: 'Empresarial',
        images: [
            'fotos/empresarial/ft11.webp',
            'fotos/empresarial/empresarial1.webp',
            'fotos/empresarial/empresarial2.webp',
            'fotos/empresarial/empresarial3.webp',
        ],
    },
    gestante: {
        title: 'Gestante',
        images: [
            'fotos/gestante/ft15.webp',
            'fotos/gestante/ft3.webp',
            'fotos/gestante/ft12.webp',
            'fotos/gestante/ft16.jpg',
            'fotos/gestante/ft17.jpg',
        ],
    },
    feminino: {
        title: 'Feminino',
        images: [
            'fotos/feminino/fem1.webp',
            'fotos/feminino/fem2.webp',
            'fotos/feminino/fem3.webp',
            'fotos/feminino/fem4.webp',
            'fotos/feminino/fem5.webp',
            'fotos/feminino/fem6.webp',
        ],
    },
    casal: {
        title: 'Casal',
        images: [
            'fotos/casal/ft4.webp',
            'fotos/casal/ft5.webp',
            'fotos/casal/casal3.webp',
            'fotos/casal/casal4.webp',
        ],
    },
};

const lightbox = document.getElementById('lightbox');
const lbImage = document.getElementById('lbImage');
const lbCaption = document.getElementById('lbCaption');
const lbThumbs = document.getElementById('lbThumbs');

let gallery = null;      // categoria aberta
let photoIndex = 0;      // foto atual
let lastFocused = null;  // para devolver o foco ao fechar

function openGallery(category) {
    gallery = galleries[category];
    if (!gallery) return;

    lastFocused = document.activeElement;

    // Miniaturas
    lbThumbs.innerHTML = '';
    gallery.images.forEach((src, i) => {
        const thumb = document.createElement('button');
        thumb.type = 'button';
        thumb.setAttribute('aria-label', `Ver foto ${i + 1}`);
        thumb.innerHTML = `<img src="${src}" alt="" loading="lazy">`;
        thumb.addEventListener('click', () => showPhoto(i));
        lbThumbs.appendChild(thumb);
    });

    showPhoto(0);
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    lightbox.querySelector('.lb-close').focus();
}

function closeGallery() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    if (lastFocused) lastFocused.focus();
}

function showPhoto(i) {
    const total = gallery.images.length;
    photoIndex = (i + total) % total;

    lbImage.classList.add('is-loading');
    lbImage.onload = () => lbImage.classList.remove('is-loading');
    lbImage.src = gallery.images[photoIndex];
    lbImage.alt = `Ensaio ${gallery.title} – foto ${photoIndex + 1}`;
    lbCaption.textContent = `${gallery.title} · ${photoIndex + 1} / ${total}`;

    lbThumbs.querySelectorAll('button').forEach((btn, n) => {
        btn.classList.toggle('is-active', n === photoIndex);
    });
    const active = lbThumbs.children[photoIndex];
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    // Pré-carrega a próxima foto
    new Image().src = gallery.images[(photoIndex + 1) % total];
}

// Botões das categorias
document.querySelectorAll('[data-category]').forEach((btn) => {
    btn.addEventListener('click', () => openGallery(btn.dataset.category));
});

// Controles
lightbox.querySelector('.lb-close').addEventListener('click', closeGallery);
lightbox.querySelector('.lb-prev').addEventListener('click', () => showPhoto(photoIndex - 1));
lightbox.querySelector('.lb-next').addEventListener('click', () => showPhoto(photoIndex + 1));

// Clicar no fundo escuro fecha
lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox || e.target.classList.contains('lb-stage')) closeGallery();
});

// Teclado: setas e ESC
document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeGallery();
    if (e.key === 'ArrowRight') showPhoto(photoIndex + 1);
    if (e.key === 'ArrowLeft') showPhoto(photoIndex - 1);
});

// Arrastar o dedo no celular
let lbTouchX = 0;
lightbox.addEventListener('touchstart', (e) => {
    lbTouchX = e.touches[0].clientX;
}, { passive: true });
lightbox.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - lbTouchX;
    if (Math.abs(diff) > 50) showPhoto(photoIndex + (diff < 0 ? 1 : -1));
});
