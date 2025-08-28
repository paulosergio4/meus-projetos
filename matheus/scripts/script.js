const slides = document.querySelectorAll('.slide');
const nextButton = document.querySelector('[data-change-slide-button="next"]');
const prevButton = document.querySelector('[data-change-slide-button="previous"]');
let slideIndex = 0;
let slideInterval = setInterval(nextSlide, 5000);

function updateSlide(newIndex) {
    slides[slideIndex].removeAttribute('data-active');
    slideIndex = (newIndex + slides.length) % slides.length;
    slides[slideIndex].setAttribute('data-active', true);
}

function nextSlide() {
    updateSlide(slideIndex + 1);
}

function prevSlide() {
    updateSlide(slideIndex - 1);
}

function resetSlideshow() {
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 5000);
}

nextButton.addEventListener('click', () => {
    nextSlide();
    resetSlideshow();
});

prevButton.addEventListener('click', () => {
    prevSlide();
    resetSlideshow();
});

function openMenu() {
    document.querySelector('nav').classList.toggle('open');
}

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        entry.target.classList.toggle('show', entry.isIntersecting);
    });
});

document.querySelectorAll('.hidden').forEach(el => observer.observe(el));