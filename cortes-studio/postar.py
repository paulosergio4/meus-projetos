#!/usr/bin/env python3
"""
Posta os cortes gerados por gerar_cortes.py no YouTube Shorts e no TikTok,
usando as APIs oficiais. Guarda o que já foi postado em postados.json
para nunca repetir um corte.

Exemplos:
  python postar.py --youtube --tiktok            # posta o próximo corte pendente
  python postar.py --youtube --quantidade 3      # posta 3 pendentes no YouTube
  python postar.py --tiktok --simular            # mostra o que faria, sem postar

Configuração (uma vez) está no README.md.
"""
import argparse
import json
import math
import os
import secrets
import sys
import time
import urllib.parse
from pathlib import Path

import requests

AQUI = Path(__file__).resolve().parent
REGISTRO = AQUI / "postados.json"
HASHTAGS_PADRAO = os.environ.get("HASHTAGS", "#cortes #viral #fyp")


# ----------------------------------------------------------------- registro
def carregar_registro() -> dict:
    if REGISTRO.exists():
        return json.loads(REGISTRO.read_text(encoding="utf-8"))
    return {"youtube": {}, "tiktok": {}}


def salvar_registro(reg: dict) -> None:
    REGISTRO.write_text(json.dumps(reg, ensure_ascii=False, indent=2), encoding="utf-8")


def todos_cortes(pasta: Path) -> list[dict]:
    """Lê todos os cortes.json da pasta (e subpastas), do mais antigo ao mais novo."""
    out = []
    for js in sorted(Path(pasta).rglob("cortes.json")):
        for c in json.loads(js.read_text(encoding="utf-8")):
            arq = js.parent / c["arquivo"]
            if arq.exists():
                out.append({**c, "caminho": arq, "chave": str(arq.resolve())})
    return out


def pendentes(pasta: Path, plataforma: str, reg: dict) -> list[dict]:
    return [c for c in todos_cortes(pasta) if c["chave"] not in reg[plataforma]]


def configurar_pasta_dados(pasta: Path) -> None:
    """Onde ficam tokens, client_secret.json e postados.json (usado pelo app)."""
    global REGISTRO, YT_SEGREDO, YT_TOKEN, TT_TOKEN
    pasta.mkdir(parents=True, exist_ok=True)
    REGISTRO = pasta / "postados.json"
    YT_SEGREDO = pasta / "client_secret.json"
    YT_TOKEN = pasta / "token_youtube.json"
    TT_TOKEN = pasta / "token_tiktok.json"


def _pedir_url_terminal(url: str) -> str:
    print("\n1) Abra este link, entre no TikTok e autorize:\n" + url)
    return input("\n2) Cole aqui a URL completa para onde o navegador foi redirecionado:\n> ")


# O app troca esta função por uma janela; no terminal usa input().
PEDIR_URL = _pedir_url_terminal


def legenda(c: dict) -> str:
    return f"{c['titulo']} {HASHTAGS_PADRAO}".strip()


# ================================================================== YOUTUBE
YT_ESCOPO = ["https://www.googleapis.com/auth/youtube.upload"]
YT_SEGREDO = AQUI / "client_secret.json"
YT_TOKEN = AQUI / "token_youtube.json"


def youtube_servico():
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    cred = None
    if YT_TOKEN.exists():
        cred = Credentials.from_authorized_user_file(str(YT_TOKEN), YT_ESCOPO)
    if not cred or not cred.valid:
        if cred and cred.expired and cred.refresh_token:
            cred.refresh(Request())
        else:
            if not YT_SEGREDO.exists():
                raise RuntimeError("Falta o client_secret.json do Google Cloud (veja o README).")
            fluxo = InstalledAppFlow.from_client_secrets_file(str(YT_SEGREDO), YT_ESCOPO)
            cred = fluxo.run_local_server(port=0)  # abre o navegador para você autorizar
        YT_TOKEN.write_text(cred.to_json())
    return build("youtube", "v3", credentials=cred)


def postar_youtube(c: dict, privacidade: str, simular: bool) -> str:
    titulo = c["titulo"][:90]
    if "#shorts" not in titulo.lower():
        titulo = f"{titulo} #Shorts"
    corpo = {
        "snippet": {
            "title": titulo[:100],
            "description": f"{c['titulo']}\n\n{HASHTAGS_PADRAO} #Shorts",
            "categoryId": "22",
        },
        "status": {"privacyStatus": privacidade, "selfDeclaredMadeForKids": False},
    }
    if simular:
        print(f"  [simulação] YouTube: '{corpo['snippet']['title']}' ({privacidade})")
        return "simulado"

    from googleapiclient.http import MediaFileUpload

    yt = youtube_servico()
    midia = MediaFileUpload(str(c["caminho"]), mimetype="video/mp4",
                            chunksize=8 * 1024 * 1024, resumable=True)
    req = yt.videos().insert(part="snippet,status", body=corpo, media_body=midia)
    resp = None
    while resp is None:
        status, resp = req.next_chunk()
        if status:
            print(f"  YouTube enviando... {int(status.progress() * 100)}%")
    vid = resp["id"]
    print(f"  YouTube OK: https://youtube.com/shorts/{vid}")
    return vid


# =================================================================== TIKTOK
TT_API = "https://open.tiktokapis.com"
TT_TOKEN = AQUI / "token_tiktok.json"


def tt_config() -> tuple[str, str, str]:
    chave = os.environ.get("TIKTOK_CLIENT_KEY")
    segredo = os.environ.get("TIKTOK_CLIENT_SECRET")
    redirect = os.environ.get("TIKTOK_REDIRECT_URI")
    if not (chave and segredo and redirect):
        raise RuntimeError("Configure a Client Key, Client Secret e Redirect URI do TikTok.")
    return chave, segredo, redirect


def tt_salvar_token(dados: dict) -> dict:
    dados["expira_em"] = time.time() + int(dados.get("expires_in", 0)) - 60
    TT_TOKEN.write_text(json.dumps(dados, indent=2))
    return dados


def tt_login(escopo: str) -> dict:
    """Login manual: abre o link, você autoriza e cola de volta a URL para onde foi redirecionado."""
    chave, segredo, redirect = tt_config()
    estado = secrets.token_urlsafe(16)
    url = "https://www.tiktok.com/v2/auth/authorize/?" + urllib.parse.urlencode({
        "client_key": chave, "scope": escopo, "response_type": "code",
        "redirect_uri": redirect, "state": estado,
    })
    volta = (PEDIR_URL(url) or "").strip()
    q = urllib.parse.parse_qs(urllib.parse.urlparse(volta).query)
    if q.get("state", [""])[0] != estado or "code" not in q:
        raise RuntimeError("URL inválida ou autorização negada no TikTok.")
    r = requests.post(f"{TT_API}/v2/oauth/token/", data={
        "client_key": chave, "client_secret": segredo, "code": q["code"][0],
        "grant_type": "authorization_code", "redirect_uri": redirect,
    }, timeout=30)
    dados = r.json()
    if "access_token" not in dados:
        raise RuntimeError(f"Erro no login do TikTok: {dados}")
    dados["escopo_pedido"] = escopo
    return tt_salvar_token(dados)


def tt_token(escopo: str) -> str:
    if TT_TOKEN.exists():
        dados = json.loads(TT_TOKEN.read_text())
        if escopo in dados.get("escopo_pedido", "") or escopo in dados.get("scope", ""):
            if time.time() < dados["expira_em"]:
                return dados["access_token"]
            chave, segredo, _ = tt_config()
            r = requests.post(f"{TT_API}/v2/oauth/token/", data={
                "client_key": chave, "client_secret": segredo,
                "grant_type": "refresh_token", "refresh_token": dados["refresh_token"],
            }, timeout=30).json()
            if "access_token" in r:
                r["escopo_pedido"] = dados.get("escopo_pedido", escopo)
                return tt_salvar_token(r)["access_token"]
    return tt_login(escopo)["access_token"]


def tt_pedacos(tamanho: int) -> tuple[int, int]:
    """Regras do TikTok: pedaços de 5–64 MB; até 64 MB vai inteiro; último pedaço absorve o resto."""
    if tamanho <= 64 * 1024 * 1024:
        return tamanho, 1
    pedaco = 10 * 1024 * 1024
    return pedaco, tamanho // pedaco


def tt_enviar_arquivo(upload_url: str, caminho: Path, pedaco: int, total: int) -> None:
    tamanho = caminho.stat().st_size
    with open(caminho, "rb") as f:
        for i in range(total):
            ini = i * pedaco
            fim = tamanho - 1 if i == total - 1 else ini + pedaco - 1
            f.seek(ini)
            dados = f.read(fim - ini + 1)
            r = requests.put(upload_url, data=dados, timeout=300, headers={
                "Content-Type": "video/mp4",
                "Content-Length": str(len(dados)),
                "Content-Range": f"bytes {ini}-{fim}/{tamanho}",
            })
            if r.status_code not in (200, 201, 206):
                raise RuntimeError(f"Falha no envio do pedaço {i + 1}: {r.status_code} {r.text[:200]}")
            print(f"  TikTok enviando... {int((i + 1) / total * 100)}%")


def tt_status(token: str, publish_id: str) -> str:
    for _ in range(30):
        r = requests.post(f"{TT_API}/v2/post/publish/status/fetch/",
                          headers={"Authorization": f"Bearer {token}",
                                   "Content-Type": "application/json; charset=UTF-8"},
                          json={"publish_id": publish_id}, timeout=30).json()
        st = r.get("data", {}).get("status", "")
        if st in ("SEND_TO_USER_INBOX", "PUBLISH_COMPLETE", "FAILED"):
            if st == "FAILED":
                print(f"  TikTok falhou: {r.get('data', {}).get('fail_reason')}")
            return st
        time.sleep(5)
    return "PROCESSANDO"


def postar_tiktok(c: dict, modo: str, simular: bool) -> str:
    """modo 'rascunho': vai para a caixa de entrada do app, você toca em postar.
       modo 'direto': publica direto (app não auditado = só privado)."""
    caminho: Path = c["caminho"]
    tamanho = caminho.stat().st_size
    pedaco, total = tt_pedacos(tamanho)
    fonte = {"source": "FILE_UPLOAD", "video_size": tamanho,
             "chunk_size": pedaco, "total_chunk_count": total}

    if simular:
        print(f"  [simulação] TikTok ({modo}): '{legenda(c)}' "
              f"{tamanho / 1e6:.1f} MB em {total} pedaço(s)")
        return "simulado"

    escopo = "video.upload" if modo == "rascunho" else "video.publish"
    token = tt_token(escopo)
    cab = {"Authorization": f"Bearer {token}", "Content-Type": "application/json; charset=UTF-8"}

    if modo == "rascunho":
        corpo = {"source_info": fonte}
        url = f"{TT_API}/v2/post/publish/inbox/video/init/"
    else:
        info = requests.post(f"{TT_API}/v2/post/publish/creator_info/query/",
                             headers=cab, timeout=30).json().get("data", {})
        opcoes = info.get("privacy_level_options", ["SELF_ONLY"])
        privacidade = "PUBLIC_TO_EVERYONE" if "PUBLIC_TO_EVERYONE" in opcoes else opcoes[0]
        corpo = {
            "post_info": {"title": legenda(c), "privacy_level": privacidade,
                          "disable_comment": False, "disable_duet": False,
                          "disable_stitch": False, "video_cover_timestamp_ms": 1000},
            "source_info": fonte,
        }
        url = f"{TT_API}/v2/post/publish/video/init/"

    r = requests.post(url, headers=cab, json=corpo, timeout=30).json()
    erro = r.get("error", {})
    if erro.get("code") not in (None, "ok"):
        raise RuntimeError(f"TikTok recusou: {erro.get('code')} - {erro.get('message')}")
    dados = r["data"]
    tt_enviar_arquivo(dados["upload_url"], caminho, pedaco, total)
    st = tt_status(token, dados["publish_id"])
    if st == "SEND_TO_USER_INBOX":
        print("  TikTok OK: abra o app e toque na notificação da caixa de entrada para postar.")
        print(f"  Legenda sugerida: {legenda(c)}")
    elif st == "PUBLISH_COMPLETE":
        print("  TikTok OK: publicado.")
    if st == "FAILED":
        raise RuntimeError("TikTok marcou o envio como falho.")
    return dados["publish_id"]


# ============================================================ fila de postagem
def postar_proximos(pasta: Path, youtube: bool, tiktok: bool, quantidade: int = 1,
                    yt_privacidade: str = "public", tt_modo: str = "rascunho",
                    simular: bool = False) -> list[tuple[str, str, bool, str]]:
    """Posta os próximos pendentes. Devolve [(plataforma, arquivo, ok, detalhe)]."""
    reg = carregar_registro()
    resultado = []
    for plat, ligado in (("youtube", youtube), ("tiktok", tiktok)):
        if not ligado:
            continue
        fila = pendentes(pasta, plat, reg)[:quantidade]
        if not fila:
            print(f"[{plat}] nada pendente.")
        for c in fila:
            print(f"[{plat}] {c['arquivo']}")
            try:
                if plat == "youtube":
                    ident = postar_youtube(c, yt_privacidade, simular)
                else:
                    ident = postar_tiktok(c, tt_modo, simular)
            except Exception as e:  # segue para o próximo em vez de travar tudo
                print(f"  ERRO: {e}")
                resultado.append((plat, c["arquivo"], False, str(e)))
                continue
            resultado.append((plat, c["arquivo"], True, ident))
            if not simular:
                reg[plat][c["chave"]] = {"id": ident, "quando": time.strftime("%Y-%m-%d %H:%M")}
                salvar_registro(reg)
    return resultado


# ===================================================================== main
def main() -> None:
    ap = argparse.ArgumentParser(description="Posta cortes no YouTube Shorts e TikTok.")
    ap.add_argument("--pasta", default="cortes_prontos", help="pasta com cortes.json")
    ap.add_argument("--youtube", action="store_true")
    ap.add_argument("--tiktok", action="store_true")
    ap.add_argument("--quantidade", type=int, default=1, help="cortes por plataforma nesta execução")
    ap.add_argument("--yt-privacidade", default="public", choices=["public", "unlisted", "private"])
    ap.add_argument("--tt-modo", default="rascunho", choices=["rascunho", "direto"])
    ap.add_argument("--simular", action="store_true", help="não posta nada, só mostra")
    a = ap.parse_args()

    if not (a.youtube or a.tiktok):
        sys.exit("Escolha ao menos uma plataforma: --youtube e/ou --tiktok")
    pasta = Path(a.pasta)
    if not any(pasta.rglob("cortes.json")):
        sys.exit(f"Nenhum corte em {pasta}/. Rode antes o gerar_cortes.py.")

    postar_proximos(pasta, a.youtube, a.tiktok, a.quantidade,
                    a.yt_privacidade, a.tt_modo, a.simular)


if __name__ == "__main__":
    main()
