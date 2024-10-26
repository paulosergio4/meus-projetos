const changSlideButton = document.querySelectorAll('[data-change-slide-button]')

let slideIndex = 0;
const slides = document.querySelectorAll('.slide');
const nextButton = document.querySelector('[data-change-slide-button="next"]');
const prevButton = document.querySelector('[data-change-slide-button="previous"]');
let slideInterval = setInterval(showNextSlide, 5000); // Altera o slide a cada 5 segundos

function showNextSlide() {
    slides[slideIndex].removeAttribute('data-active'); // Remove a classe "ativa" do slide atual
    slideIndex = (slideIndex + 1) % slides.length; // Incrementa o índice do slide
    slides[slideIndex].setAttribute('data-active', true); // Mostra o próximo slide
}

function showPreviousSlide() {
    slides[slideIndex].removeAttribute('data-active'); // Remove a classe "ativa" do slide atual
    slideIndex = (slideIndex - 1 + slides.length) % slides.length; // Decrementa o índice do slide
    slides[slideIndex].setAttribute('data-active', true); // Mostra o slide anterior
}

// Função para pausar o slide automático ao clicar nos botões de próximo/anterior
function pauseSlideshow() {
    clearInterval(slideInterval);
    slideInterval = setInterval(showNextSlide, 5000); // Retoma o slideshow após a pausa
}

// Adiciona eventos de clique aos botões para controle manual
nextButton.addEventListener('click', () => {
    showNextSlide();
    pauseSlideshow();
});

prevButton.addEventListener('click', () => {
    showPreviousSlide();
    pauseSlideshow();
});

function openMenu(){
    const nav = document.querySelector('nav');
    nav.classList.toggle('open');
}

const myObserver = new IntersectionObserver((entries) => {
    entries.forEach( (entry) => {
        if  (entry.isIntersecting){
            entry.target.classList.add('show')
        }  else {
            entry.target.classList.remove('show')
        }


    })
})

const elements = document.querySelectorAll('.hidden')

elements.forEach((element) => myObserver.observe(element))


// Função para mudar o slide
function changeSlide(n) {
    currentSlide = (currentSlide + n + currentImages.length) % currentImages.length;
    showSlide(currentSlide);
}

// Adicionando eventos aos botões de categoria

