// Imagens de cada categoria
const images = {
    empresarial: ["fotos/empresarial/ft11.webp", "fotos/empresarial/empresarial1.webp", "fotos/empresarial/empresarial2.webp", "fotos/empresarial/empresarial3.webp"],
    gestante: ["fotos/gestante/ft15.webp", "fotos/gestante/ft3.webp", "fotos/gestante/ft12.webp", "fotos/gestante/ft16.jpg",  "fotos/gestante/ft17.jpg"],
    feminino: ["fotos/feminino/fem1.webp", "fotos/feminino/fem2.webp","fotos/feminino/fem3.webp","fotos/feminino/fem4.webp","fotos/feminino/fem5.webp","fotos/feminino/fem6.webp"],
    casal: ["fotos/casal/ft4.webp", "fotos/casal/ft5.webp", "fotos/casal/casal3.webp", "fotos/casal/casal4.webp"]
};
let currentSlide = 0;
let currentImages = [];

// Função para abrir o modal com a categoria de fotos
function openModal(category) {
    currentImages = images[category];
    currentSlide = 0;
    showSlide(currentSlide);
    document.getElementById("photoModal").style.display = "block";
}

// Função para fechar o modal
function closeModal() {
    document.getElementById("photoModal").style.display = "none";
}

// Função para mostrar um slide específico
function showSlide(n) {
    const modalContent = document.getElementById("modalContent");
    modalContent.innerHTML = `<img src="${currentImages[n]}" alt="Foto">`;
}

// Função para mudar o slide
function changeSlide(n) {
    currentSlide = (currentSlide + n + currentImages.length) % currentImages.length;
    showSlide(currentSlide);
}

// Adicionando eventos aos botões de categoria
document.getElementById("open-empresarial").onclick = () => openModal("empresarial");
document.getElementById("open-gestante").onclick = () => openModal("gestante");
document.getElementById("open-feminino").onclick = () => openModal("feminino");
document.getElementById("open-casal").onclick = () => openModal("casal");