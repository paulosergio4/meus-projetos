"""
Otimiza as fotos do site para carregar e rolar liso.

- Reduz cada foto para no máximo 2400 px no lado maior (qualidade 82),
  mantendo o mesmo nome e formato. Fotos já pequenas não são tocadas.
- Gera uma miniatura de 900 px em fotos/mini/<mesmo caminho>,
  usada nos cards das categorias e nas miniaturas da galeria.
- Corrige a rotação de fotos tiradas com o celular/câmera de lado (EXIF).

Uso:  python matheus/scripts/otimizar_fotos.py
Requer: pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageOps

FOTOS = Path(__file__).resolve().parent.parent / "fotos"
MINI = FOTOS / "mini"
MAX_FULL = 2400
MAX_MINI = 900
QUALIDADE = 82
EXTS = {".jpg", ".jpeg", ".png", ".webp"}
# Arquivos que não são fotos de ensaio
IGNORAR = {"favicon-32x32.png"}
LOGO = "logo1.png"
MAX_LOGO = 256


def salvar(img: Image.Image, destino: Path) -> None:
    destino.parent.mkdir(parents=True, exist_ok=True)
    ext = destino.suffix.lower()
    if ext in (".jpg", ".jpeg"):
        img.convert("RGB").save(destino, "JPEG", quality=QUALIDADE, optimize=True, progressive=True)
    elif ext == ".webp":
        img.save(destino, "WEBP", quality=QUALIDADE, method=6)
    else:
        img.save(destino, "PNG", optimize=True)


def reduzida(img: Image.Image, lado: int) -> Image.Image:
    copia = img.copy()
    copia.thumbnail((lado, lado), Image.LANCZOS)
    return copia


def main() -> None:
    antes = depois = 0
    for arq in sorted(FOTOS.rglob("*")):
        if not arq.is_file() or arq.suffix.lower() not in EXTS:
            continue
        if MINI in arq.parents or arq.name in IGNORAR:
            continue

        tamanho_antes = arq.stat().st_size
        antes += tamanho_antes
        with Image.open(arq) as aberta:
            img = ImageOps.exif_transpose(aberta)
            img.load()

        limite = MAX_LOGO if arq.name == LOGO else MAX_FULL
        if max(img.size) > limite:
            salvar(reduzida(img, limite), arq)
            print(f"otimizada  {arq.relative_to(FOTOS)}  {tamanho_antes // 1024} KB -> {arq.stat().st_size // 1024} KB")
        depois += arq.stat().st_size

        if arq.name == LOGO:
            continue
        mini = MINI / arq.relative_to(FOTOS)
        if not mini.exists() or mini.stat().st_mtime < arq.stat().st_mtime:
            salvar(reduzida(img, MAX_MINI), mini)
            print(f"miniatura  mini/{arq.relative_to(FOTOS)}")

    print(f"\nTotal das fotos: {antes / 1048576:.1f} MB -> {depois / 1048576:.1f} MB")


if __name__ == "__main__":
    main()
