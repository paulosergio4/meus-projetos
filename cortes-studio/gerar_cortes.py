#!/usr/bin/env python3
"""
Gerador de cortes verticais (TikTok / Shorts / Reels).

Use APENAS com vídeos que você tem direito de usar: seus próprios,
de canais que autorizaram cortes (programas de clipping) ou Creative Commons.

Fluxo:
  1. baixa o vídeo (link do YouTube) ou usa um arquivo local
  2. transcreve o áudio com Whisper (timestamps por palavra)
  3. escolhe os melhores trechos
       - com ANTHROPIC_API_KEY definida: Claude analisa a transcrição
       - sem chave: heurística (ritmo de fala + perguntas/exclamações)
  4. corta em 9:16 (fundo desfocado + vídeo centralizado) com legenda animada

Uso:
  python gerar_cortes.py "https://youtube.com/watch?v=..." --cortes 5
  python gerar_cortes.py video.mp4 --min 60 --max 120 --idioma pt
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

LARGURA, ALTURA = 1080, 1920


# ---------------------------------------------------------------- 1. download
SEM_JANELA = {"creationflags": 0x08000000} if os.name == "nt" else {}  # sem console no Windows
FONTE_LEGENDA = "Arial Black" if os.name == "nt" else "DejaVu Sans"
FFMPEG = os.environ.get("FFMPEG_BIN", "ffmpeg")


def baixar(url: str, pasta: Path, progresso=None) -> Path:
    import yt_dlp

    pasta.mkdir(parents=True, exist_ok=True)

    def gancho(d):
        if progresso and d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            if total:
                progresso(d.get("downloaded_bytes", 0) / total)

    opcoes = {
        "format": "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b",
        "merge_output_format": "mp4",
        "outtmpl": str(pasta / "%(id)s.%(ext)s"),
        "quiet": True,
        "noprogress": True,
        "progress_hooks": [gancho],
        # o YouTube exige um runtime JavaScript (Deno) para liberar os formatos
        "js_runtimes": {"deno": {"path": os.environ["DENO_BIN"]}} if os.environ.get("DENO_BIN") else {"deno": {}},
        # se os scripts do desafio não vierem no pacote, baixa do GitHub do yt-dlp
        "remote_components": ["ejs:github"],
    }
    ff = os.environ.get("FFMPEG_BIN")
    if ff and os.path.isabs(ff):
        opcoes["ffmpeg_location"] = ff
    with yt_dlp.YoutubeDL(opcoes) as ydl:
        info = ydl.extract_info(url, download=True)
        caminho = Path(ydl.prepare_filename(info)).with_suffix(".mp4")
    print(f"[download] {info.get('title')} -> {caminho.name}")
    return caminho


# ------------------------------------------------------------ 2. transcrição
def transcrever(video: Path, idioma: str | None, modelo: str, progresso=None) -> list[dict]:
    """Retorna lista de palavras: {"w": texto, "s": inicio, "e": fim}."""
    cache = video.with_suffix(f".{modelo}.palavras.json")
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))

    from faster_whisper import WhisperModel

    print(f"[whisper] transcrevendo com modelo '{modelo}' (pode demorar)...")
    try:
        m = WhisperModel(modelo, device="auto", compute_type="int8")
    except Exception:  # GPU sem bibliotecas CUDA: usa o processador
        m = WhisperModel(modelo, device="cpu", compute_type="int8")
    segmentos, info = m.transcribe(
        str(video), language=idioma, word_timestamps=True, vad_filter=True
    )
    palavras = []
    for seg in segmentos:
        for p in seg.words or []:
            if p.word.strip():
                palavras.append({"w": p.word.strip(), "s": round(p.start, 2), "e": round(p.end, 2)})
        if progresso and info.duration:
            progresso(min(seg.end / info.duration, 1.0))
    cache.write_text(json.dumps(palavras, ensure_ascii=False), encoding="utf-8")
    print(f"[whisper] idioma {info.language}, {len(palavras)} palavras")
    return palavras


def frases(palavras: list[dict]) -> list[dict]:
    """Agrupa palavras em frases (quebra em pontuação ou pausa > 0.8s)."""
    out, atual = [], []
    for i, p in enumerate(palavras):
        atual.append(p)
        prox = palavras[i + 1] if i + 1 < len(palavras) else None
        fim = re.search(r"[.!?…]$", p["w"]) or prox is None or prox["s"] - p["e"] > 0.8
        if fim:
            out.append({
                "s": atual[0]["s"], "e": atual[-1]["e"],
                "t": " ".join(x["w"] for x in atual),
            })
            atual = []
    return out


# ------------------------------------------------------- 3. escolher trechos
def escolher_com_claude(fr: list[dict], n: int, dmin: int, dmax: int) -> list[dict]:
    import anthropic

    texto = "\n".join(f"[{f['s']:.1f}-{f['e']:.1f}] {f['t']}" for f in fr)
    prompt = f"""Você é editor de cortes virais para TikTok/Shorts.
Abaixo está a transcrição de um vídeo com timestamps em segundos.
Escolha os {n} melhores trechos para virar cortes independentes.

Regras:
- cada corte entre {dmin} e {dmax} segundos
- começa com um gancho forte (frase que prende nos 3 primeiros segundos)
- tem começo, meio e fim: faz sentido sem o resto do vídeo
- termina numa frase completa, nunca no meio de uma ideia
- não se sobrepõem
- use exatamente os timestamps de início/fim das frases

Responda SOMENTE com JSON:
[{{"inicio": 12.3, "fim": 58.1, "titulo": "título curto chamativo", "motivo": "por que viraliza"}}]

TRANSCRIÇÃO:
{texto}"""
    cliente = anthropic.Anthropic()
    resp = cliente.messages.create(
        model=os.environ.get("MODELO_CLAUDE", "claude-sonnet-5-5"),
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    bruto = resp.content[0].text
    bruto = bruto[bruto.find("["): bruto.rfind("]") + 1]
    cortes = json.loads(bruto)
    return [
        {"inicio": float(c["inicio"]), "fim": float(c["fim"]),
         "titulo": c.get("titulo", ""), "motivo": c.get("motivo", "")}
        for c in cortes
    ]


def escolher_heuristica(fr: list[dict], n: int, dmin: int, dmax: int) -> list[dict]:
    """Janela que começa e termina em frase; pontua ritmo e intensidade."""
    candidatos = []
    for i in range(len(fr)):
        for j in range(i, len(fr)):
            dur = fr[j]["e"] - fr[i]["s"]
            if dur > dmax:
                break
            if dur < dmin:
                continue
            bloco = fr[i: j + 1]
            texto = " ".join(f["t"] for f in bloco)
            n_pal = len(texto.split())
            ritmo = n_pal / dur                                   # palavras/seg
            intensidade = texto.count("!") * 2 + texto.count("?") * 1.5
            gancho = 2 if re.search(r"[?!]", bloco[0]["t"]) else 0
            pausas = sum(
                max(0, bloco[k + 1]["s"] - bloco[k]["e"]) for k in range(len(bloco) - 1)
            )
            score = ritmo * 3 + intensidade + gancho - pausas * 0.5
            candidatos.append((score, fr[i]["s"], fr[j]["e"], bloco[0]["t"]))

    candidatos.sort(reverse=True)
    escolhidos = []
    for score, s, e, primeira in candidatos:
        if all(e <= c["inicio"] or s >= c["fim"] for c in escolhidos):
            titulo = " ".join(primeira.split()[:8])
            escolhidos.append({"inicio": s, "fim": e, "titulo": titulo,
                               "motivo": f"score {score:.1f}"})
        if len(escolhidos) == n:
            break
    return sorted(escolhidos, key=lambda c: c["inicio"])


# --------------------------------------------------------------- 4. legendas
def _tempo_ass(t: float) -> str:
    h, r = divmod(max(t, 0), 3600)
    m, s = divmod(r, 60)
    return f"{int(h)}:{int(m):02d}:{s:05.2f}"


def gerar_ass(palavras: list[dict], inicio: float, fim: float, destino: Path,
              por_tela: int = 3) -> None:
    """Legenda estilo TikTok: grupos de ~3 palavras, palavra falada em amarelo."""
    trecho = [p for p in palavras if p["s"] >= inicio - 0.05 and p["e"] <= fim + 0.05]
    cab = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {LARGURA}
PlayResY: {ALTURA}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Corte,{FONTE_LEGENDA},88,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,3,2,60,60,520,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    linhas = []
    for g in range(0, len(trecho), por_tela):
        grupo = trecho[g: g + por_tela]
        for k, atual in enumerate(grupo):
            ini = atual["s"] - inicio
            prox = grupo[k + 1]["s"] if k + 1 < len(grupo) else atual["e"]
            fim_l = max(prox, atual["e"]) - inicio
            partes = []
            for x in grupo:
                w = x["w"].upper().replace("{", "").replace("}", "")
                partes.append(r"{\c&H00E5FF&\fscx110\fscy110}" + w + r"{\r}" if x is atual else w)
            linhas.append(
                f"Dialogue: 0,{_tempo_ass(ini)},{_tempo_ass(fim_l)},Corte,,0,0,0,,"
                + " ".join(partes)
            )
    destino.write_text(cab + "\n".join(linhas) + "\n", encoding="utf-8")


# ----------------------------------------------------------------- 5. render
def renderizar(video: Path, corte: dict, ass: Path, saida: Path) -> None:
    dur = corte["fim"] - corte["inicio"]
    ass_esc = str(ass.resolve()).replace("\\", "/").replace(":", r"\:").replace("'", r"\'")
    filtro = (
        f"[0:v]split=2[a][b];"
        f"[a]scale={LARGURA}:{ALTURA}:force_original_aspect_ratio=increase,"
        f"crop={LARGURA}:{ALTURA},boxblur=30:3,eq=brightness=-0.12[fundo];"
        f"[b]scale={LARGURA}:-2[frente];"
        f"[fundo][frente]overlay=(W-w)/2:(H-h)/2-120,"
        f"subtitles='{ass_esc}',setsar=1,format=yuv420p[v]"
    )
    cmd = [
        FFMPEG, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{corte['inicio']:.2f}", "-i", str(video), "-t", f"{dur:.2f}",
        "-filter_complex", filtro, "-map", "[v]", "-map", "0:a?",
        "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-r", "30",
        "-c:a", "aac", "-b:a", "160k", "-ar", "44100",
        "-movflags", "+faststart", str(saida),
    ]
    subprocess.run(cmd, check=True, **SEM_JANELA)


def miniatura(video: Path, destino: Path, t: float = 2.0) -> None:
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-ss", str(t), "-i", str(video),
                    "-frames:v", "1", "-vf", "scale=270:-2", str(destino)],
                   check=False, **SEM_JANELA)


def nome_arquivo(i: int, titulo: str) -> str:
    base = re.sub(r"[^\w\s-]", "", titulo, flags=re.UNICODE).strip().lower()
    base = re.sub(r"\s+", "_", base)[:50] or "corte"
    return f"{i:02d}_{base}.mp4"


# ----------------------------------------------------------- pipeline completo
def gerar(origem: str, n: int = 5, dmin: int = 60, dmax: int = 120, idioma: str | None = None,
          modelo: str = "small", saida: Path = Path("cortes_prontos"),
          downloads: Path = Path("downloads"), usar_claude: bool = True,
          progresso=None) -> Path:
    """Roda tudo e devolve a pasta com os cortes. progresso(fração 0–1, texto)."""
    def etapa(ini, fim, texto):
        return (lambda f: progresso(ini + (fim - ini) * f, texto)) if progresso else None

    if re.match(r"https?://", origem):
        print("[download] baixando vídeo...")
        video = baixar(origem, Path(downloads), etapa(0, 0.15, "Baixando vídeo"))
    else:
        video = Path(origem)
        if not video.exists():
            raise FileNotFoundError(f"Arquivo não encontrado: {video}")

    if progresso:
        progresso(0.15, "Transcrevendo áudio")
    palavras = transcrever(video, idioma, modelo, etapa(0.15, 0.6, "Transcrevendo áudio"))
    if not palavras:
        raise RuntimeError("Nenhuma fala detectada no vídeo.")
    fr = frases(palavras)

    if progresso:
        progresso(0.6, "Escolhendo os melhores trechos")
    if os.environ.get("ANTHROPIC_API_KEY") and usar_claude:
        print("[seleção] Claude analisando a transcrição...")
        cortes = escolher_com_claude(fr, n, dmin, dmax)
    else:
        print("[seleção] usando heurística (configure a chave do Claude para seleção com IA)")
        cortes = escolher_heuristica(fr, n, dmin, dmax)
    if not cortes:
        raise RuntimeError("Nenhum trecho com essa duração. Tente um vídeo maior ou diminua a duração mínima.")

    nome_video = re.sub(r"[^\w-]", "", video.stem)[:30]
    pasta = Path(saida) / (time.strftime("%Y%m%d_%H%M%S") + "_" + nome_video)
    pasta.mkdir(parents=True, exist_ok=True)
    relatorio = []
    for i, c in enumerate(cortes, 1):
        if progresso:
            progresso(0.65 + 0.35 * (i - 1) / len(cortes), f"Renderizando corte {i} de {len(cortes)}")
        arq = pasta / nome_arquivo(i, c["titulo"])
        ass = arq.with_suffix(".ass")
        print(f"[corte {i}] {c['inicio']:.1f}s → {c['fim']:.1f}s  {c['titulo']}")
        gerar_ass(palavras, c["inicio"], c["fim"], ass)
        renderizar(video, c, ass, arq)
        ass.unlink(missing_ok=True)
        miniatura(arq, arq.with_suffix(".jpg"))
        relatorio.append({**c, "arquivo": arq.name, "origem": str(origem)})

    (pasta / "cortes.json").write_text(
        json.dumps(relatorio, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    if progresso:
        progresso(1.0, "Pronto")
    print(f"Pronto: {len(relatorio)} cortes em '{pasta}'")
    return pasta


# ------------------------------------------------------------------ main
def main() -> None:
    ap = argparse.ArgumentParser(description="Gera cortes verticais com legenda.")
    ap.add_argument("origem", help="link do YouTube ou caminho de um vídeo")
    ap.add_argument("--cortes", type=int, default=5, help="quantos cortes (padrão 5)")
    ap.add_argument("--min", type=int, default=60, help="duração mínima em s")
    ap.add_argument("--max", type=int, default=120, help="duração máxima em s")
    ap.add_argument("--idioma", default=None, help="ex.: pt, en (padrão: detecta)")
    ap.add_argument("--modelo", default="small", help="modelo Whisper: tiny/base/small/medium/large-v3")
    ap.add_argument("--saida", default="cortes_prontos", help="pasta de saída")
    ap.add_argument("--sem-claude", action="store_true", help="força a heurística")
    a = ap.parse_args()
    try:
        gerar(a.origem, a.cortes, a.min, a.max, a.idioma, a.modelo, Path(a.saida),
              usar_claude=not a.sem_claude)
    except (FileNotFoundError, RuntimeError) as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main()
