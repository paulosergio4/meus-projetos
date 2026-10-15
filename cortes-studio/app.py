#!/usr/bin/env python3
"""
Cortes Studio — app de Windows para gerar cortes verticais e postar
no YouTube Shorts e TikTok.

Rodar:          python app.py
Modo agendado:  "Cortes Studio.exe" --postar   (usado pelo Agendador do Windows)
"""
import json
import os
import queue
import shutil
import subprocess
import sys
import threading
import time
import traceback
import webbrowser
from pathlib import Path

# ------------------------------------------------------------------ caminhos
WINDOWS = os.name == "nt"
CONGELADO = getattr(sys, "frozen", False)  # rodando como .exe (PyInstaller)
RECURSOS = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
DADOS = (Path(os.environ.get("APPDATA", Path.home())) / "CortesStudio") if WINDOWS \
    else Path.home() / ".cortes_studio"
DADOS.mkdir(parents=True, exist_ok=True)
CONFIG = DADOS / "config.json"
LOG_ARQ = DADOS / "app.log"
DOCS = Path.home() / "Documents"

PADRAO = {
    "claude_key": "", "hashtags": "#cortes #viral #fyp",
    "tt_key": "", "tt_secret": "", "tt_redirect": "",
    "saida": str((DOCS if DOCS.exists() else Path.home()) / "Cortes Studio"),
    "cortes": 5, "dmin": 60, "dmax": 120, "idioma": "Automático",
    "precisao": "Equilibrado", "usar_ia": True,
    "post_youtube": True, "post_tiktok": True, "yt_priv": "public",
    "tt_modo": "rascunho", "qtd": 1, "horarios": "12:00, 19:00", "auto": False,
}
IDIOMAS = {"Automático": None, "Português": "pt", "Inglês": "en", "Espanhol": "es"}
PRECISAO = {"Rápido": "base", "Equilibrado": "small", "Preciso": "medium"}
SEM_JANELA = {"creationflags": 0x08000000} if WINDOWS else {}


def carregar_config() -> dict:
    cfg = dict(PADRAO)
    try:
        cfg.update(json.loads(CONFIG.read_text(encoding="utf-8")))
    except Exception:
        pass
    return cfg


def salvar_config(cfg: dict) -> None:
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding="utf-8")


def aplicar_ambiente(cfg: dict) -> None:
    """Passa as chaves para os módulos de geração e postagem."""
    for var, chave in (("ANTHROPIC_API_KEY", "claude_key"), ("TIKTOK_CLIENT_KEY", "tt_key"),
                       ("TIKTOK_CLIENT_SECRET", "tt_secret"), ("TIKTOK_REDIRECT_URI", "tt_redirect")):
        if cfg.get(chave):
            os.environ[var] = cfg[chave].strip()
        else:
            os.environ.pop(var, None)
    import postar
    postar.configurar_pasta_dados(DADOS)
    postar.HASHTAGS_PADRAO = cfg.get("hashtags", "").strip()


def _achar(nome: str, padroes: list) -> str | None:
    """Procura um programa no PATH e nas pastas onde o winget/instaladores costumam colocar."""
    achado = shutil.which(nome)
    if achado or not WINDOWS:
        return achado
    local = Path(os.environ.get("LOCALAPPDATA", ""))
    winget = local / "Microsoft" / "WinGet"
    candidatos = [winget / "Links" / f"{nome}.exe"]
    for base, padrao in padroes:
        candidatos += sorted(Path(base).glob(padrao))
    for c in candidatos:
        if c.exists():
            # coloca a pasta no PATH deste processo (o yt-dlp e o ffmpeg passam a enxergar)
            os.environ["PATH"] = str(c.parent) + os.pathsep + os.environ.get("PATH", "")
            return str(c)
    return None


def localizar_ferramentas() -> None:
    """Acha ffmpeg e deno mesmo que o PATH ainda não tenha sido atualizado após o winget."""
    winget = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
    ff = _achar("ffmpeg", [(winget, "Gyan.FFmpeg*/*/bin/ffmpeg.exe"), ("C:/ffmpeg", "bin/ffmpeg.exe")])
    if ff:
        os.environ["FFMPEG_BIN"] = ff
    dn = _achar("deno", [(winget, "DenoLand.Deno*/deno.exe"), (Path.home() / ".deno", "bin/deno.exe")])
    if dn:
        os.environ["DENO_BIN"] = dn


localizar_ferramentas()


def deno_ok() -> bool:
    return bool(os.environ.get("DENO_BIN") or shutil.which("deno"))


def ffmpeg_ok() -> bool:
    return shutil.which(os.environ.get("FFMPEG_BIN", "ffmpeg")) is not None


def abrir(caminho: Path) -> None:
    if WINDOWS:
        os.startfile(str(caminho))  # noqa
    else:
        subprocess.Popen(["xdg-open", str(caminho)])


# ============================================================ modo agendado
def modo_agendado() -> None:
    """Executado pelo Agendador do Windows: posta e fecha, sem janela."""
    sys.stdout = sys.stderr = open(LOG_ARQ, "a", encoding="utf-8")
    print(f"\n=== Postagem agendada {time.strftime('%Y-%m-%d %H:%M')} ===")
    cfg = carregar_config()
    aplicar_ambiente(cfg)
    import postar

    def sem_login(url):
        raise RuntimeError("TikTok precisa de login: abra o Cortes Studio e conecte a conta.")
    postar.PEDIR_URL = sem_login
    postar.postar_proximos(Path(cfg["saida"]), cfg["post_youtube"], cfg["post_tiktok"],
                           int(cfg["qtd"]), cfg["yt_priv"], cfg["tt_modo"])


if "--postar" in sys.argv:
    modo_agendado()
    sys.exit(0)

# ====================================================================== UI
import customtkinter as ctk  # noqa: E402
from PIL import Image  # noqa: E402

FONTE = "Segoe UI" if WINDOWS else "DejaVu Sans"
C = {
    "fundo": "#0E0E11", "lateral": "#141418", "card": "#1A1A20", "card2": "#22222A",
    "borda": "#2A2A33", "texto": "#F2F2F5", "suave": "#8B8B98", "apagado": "#5C5C68",
    "destaque": "#FFD21F", "destaque2": "#FFE15C", "sobre_destaque": "#111114",
    "ok": "#3DDC97", "erro": "#FF5A5F", "yt": "#FF3B3B", "tt": "#25F4EE",
}
ctk.set_appearance_mode("dark")


class Saida:
    """Recebe os print() dos módulos e manda para a tela de log."""
    def __init__(self, fila: queue.Queue, original):
        self.fila, self.original = fila, original

    def write(self, texto):
        if texto:
            self.fila.put(texto)
            try:
                if self.original:
                    self.original.write(texto)
            except Exception:
                pass

    def flush(self):
        pass

    def isatty(self):
        return False


def fmt_tempo(seg: float) -> str:
    seg = int(round(seg))
    return f"{seg // 60}:{seg % 60:02d}"


# ------------------------------------------------------------- componentes
def titulo(master, texto, sub=None):
    f = ctk.CTkFrame(master, fg_color="transparent")
    ctk.CTkLabel(f, text=texto, font=ctk.CTkFont(FONTE, 28, "bold"),
                 text_color=C["texto"]).pack(anchor="w")
    if sub:
        ctk.CTkLabel(f, text=sub, font=ctk.CTkFont(FONTE, 14),
                     text_color=C["suave"]).pack(anchor="w", pady=(2, 0))
    return f


def card(master, **kw):
    return ctk.CTkFrame(master, fg_color=C["card"], corner_radius=16,
                        border_width=1, border_color=C["borda"], **kw)


def rotulo(master, texto, tam=13, cor=None, peso="normal"):
    return ctk.CTkLabel(master, text=texto, font=ctk.CTkFont(FONTE, tam, peso),
                        text_color=cor or C["suave"], anchor="w", justify="left")


def botao_principal(master, texto, comando, **kw):
    return ctk.CTkButton(master, text=texto, command=comando, height=48, corner_radius=12,
                         fg_color=C["destaque"], hover_color=C["destaque2"],
                         text_color=C["sobre_destaque"], text_color_disabled="#5a5a5a",
                         font=ctk.CTkFont(FONTE, 15, "bold"), **kw)


def botao_sec(master, texto, comando, **kw):
    kw.setdefault("height", 36)
    return ctk.CTkButton(master, text=texto, command=comando, corner_radius=10,
                         fg_color=C["card2"], hover_color=C["borda"], text_color=C["texto"],
                         border_width=1, border_color=C["borda"],
                         font=ctk.CTkFont(FONTE, 13), **kw)


def entrada(master, placeholder="", **kw):
    return ctk.CTkEntry(master, placeholder_text=placeholder, height=42, corner_radius=10,
                        fg_color=C["fundo"], border_color=C["borda"], border_width=1,
                        text_color=C["texto"], placeholder_text_color=C["apagado"],
                        font=ctk.CTkFont(FONTE, 14), **kw)


class Segmentado(ctk.CTkSegmentedButton):
    """Botão segmentado com texto escuro na opção marcada (legível sobre o amarelo)."""
    def set(self, value, *a, **k):
        super().set(value, *a, **k)
        for v, b in self._buttons_dict.items():
            b.configure(text_color=C["sobre_destaque"] if v == self.get() else C["texto"])


def segmentado(master, valores, **kw):
    return Segmentado(
        master, values=valores, height=36, corner_radius=10,
        fg_color=C["fundo"], selected_color=C["destaque"], selected_hover_color=C["destaque2"],
        unselected_color=C["fundo"], unselected_hover_color=C["card2"],
        text_color=C["texto"], font=ctk.CTkFont(FONTE, 13), **kw)


def chave(master, texto, **kw):
    return ctk.CTkSwitch(master, text=texto, progress_color=C["destaque"],
                         button_color=C["texto"], button_hover_color="#ffffff",
                         fg_color=C["borda"], text_color=C["texto"],
                         font=ctk.CTkFont(FONTE, 14), **kw)


def menu(master, valores, **kw):
    return ctk.CTkOptionMenu(master, values=valores, height=36, corner_radius=10,
                             fg_color=C["fundo"], button_color=C["card2"],
                             button_hover_color=C["borda"], text_color=C["texto"],
                             dropdown_fg_color=C["card2"], dropdown_hover_color=C["borda"],
                             dropdown_text_color=C["texto"],
                             font=ctk.CTkFont(FONTE, 13), **kw)


# ==================================================================== App
class App(ctk.CTk):
    def __init__(self):
        super().__init__(fg_color=C["fundo"])
        self.title("Cortes Studio")
        self.geometry("1200x780")
        self.minsize(1040, 700)
        ico = RECURSOS / "icone.ico"
        if WINDOWS and ico.exists():
            self.iconbitmap(str(ico))

        self.cfg = carregar_config()
        self.fila_log: queue.Queue = queue.Queue()
        self.fila_ui: queue.Queue = queue.Queue()
        sys.stdout = Saida(self.fila_log, sys.__stdout__)
        sys.stderr = Saida(self.fila_log, sys.__stderr__)
        aplicar_ambiente(self.cfg)

        import postar
        postar.PEDIR_URL = self._pedir_url_tiktok
        self.ocupado = False
        self.ultimo_auto = ""
        self.pagina_atual = "criar"

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self._lateral()
        self.area = ctk.CTkFrame(self, fg_color="transparent")
        self.area.grid(row=0, column=1, sticky="nsew", padx=36, pady=30)
        self.area.grid_columnconfigure(0, weight=1)
        self.area.grid_rowconfigure(0, weight=1)

        self.paginas = {
            "criar": self._pagina_criar(),
            "biblioteca": self._pagina_biblioteca(),
            "postar": self._pagina_postar(),
            "config": self._pagina_config(),
        }
        self.mostrar("criar")
        self.after(80, self._loop)
        self.after(1500, self._auto_postagem)
        if not ffmpeg_ok():
            self.after(600, lambda: self.aviso(
                "ffmpeg não encontrado. No terminal: winget install Gyan.FFmpeg",
                erro=True, tempo=9000))
        elif not deno_ok():
            self.after(600, lambda: self.aviso(
                "Deno não encontrado (o YouTube exige). No terminal: winget install DenoLand.Deno",
                erro=True, tempo=9000))
        self._atalhos()
        self._menus_texto()
        self._arrastar_soltar()

    # ------------------------------------------------------------ infra
    def ui(self, fn):
        """Agenda fn para rodar na thread da interface."""
        self.fila_ui.put(fn)

    def _loop(self):
        try:
            while True:
                self.fila_ui.get_nowait()()
        except queue.Empty:
            pass
        partes = []
        try:
            while True:
                partes.append(self.fila_log.get_nowait())
        except queue.Empty:
            pass
        if partes:
            for caixa in (self.log_criar, self.log_postar):
                caixa.configure(state="normal")
                caixa.insert("end", "".join(partes))
                caixa.see("end")
                caixa.configure(state="disabled")
        self.after(80, self._loop)

    def em_segundo_plano(self, trabalho, ao_terminar=None, ao_falhar=None):
        def rodar():
            try:
                r = trabalho()
                if ao_terminar:
                    self.ui(lambda: ao_terminar(r))
            except Exception as e:
                traceback.print_exc()
                msg = str(e) or e.__class__.__name__
                if ao_falhar:
                    self.ui(lambda: ao_falhar(msg))
        threading.Thread(target=rodar, daemon=True).start()

    def aviso(self, texto, erro=False, tempo=4500):
        t = ctk.CTkFrame(self, fg_color=C["card2"], corner_radius=12, border_width=1,
                         border_color=C["erro"] if erro else C["ok"])
        ctk.CTkLabel(t, text=("✕  " if erro else "✓  ") + texto, text_color=C["texto"],
                     font=ctk.CTkFont(FONTE, 13), wraplength=420, justify="left"
                     ).pack(padx=18, pady=12)
        t.place(relx=0.985, rely=0.975, anchor="se")
        t.lift()
        self.after(tempo, t.destroy)

    # ------------------------------------------------------ teclado e mouse
    def _atalhos(self):
        """Atalhos globais de teclado."""
        def nav(pagina):
            return lambda _e: (self.mostrar(pagina), "break")[1]
        for i, pag in enumerate(("criar", "biblioteca", "postar", "config"), 1):
            self.bind_all(f"<Control-Key-{i}>", nav(pag))
        for tecla in ("<Control-o>", "<Control-O>"):
            self.bind_all(tecla, lambda _e: (self.mostrar("criar"), self._escolher_arquivo(), "break")[2])
        for tecla in ("<Control-Return>", "<Control-KP_Enter>"):
            self.bind_all(tecla, lambda _e: self._atalho_executar())
        for tecla in ("<Control-s>", "<Control-S>"):
            self.bind_all(tecla, lambda _e: self.salvar_configuracoes())
        self.bind_all("<F5>", lambda _e: self._atualizar_pagina())
        self.bind_all("<F1>", lambda _e: self._mostrar_atalhos())

    def _atalho_executar(self):
        if self.pagina_atual == "criar":
            self.gerar()
        elif self.pagina_atual == "postar":
            self.postar_agora()

    def _atualizar_pagina(self):
        if self.pagina_atual == "biblioteca":
            self.carregar_biblioteca()
        elif self.pagina_atual == "postar":
            self.atualizar_pendentes()
        self.atualizar_status()

    def _mostrar_atalhos(self):
        w = ctk.CTkToplevel(self, fg_color=C["fundo"])
        w.title("Atalhos")
        w.geometry("640x500")
        w.transient(self)
        w.bind("<Escape>", lambda _e: w.destroy())
        rotulo(w, "Atalhos", 22, C["texto"], "bold").pack(anchor="w", padx=26, pady=(22, 12))
        itens = [
            ("Ctrl + 1 / 2 / 3 / 4", "Criar · Biblioteca · Postar · Configurações"),
            ("Ctrl + O", "Escolher arquivo de vídeo"),
            ("Enter  /  Ctrl + Enter", "Gerar cortes  (ou Postar, na tela Postar)"),
            ("Ctrl + V", "Colar link"),
            ("Ctrl + A", "Selecionar todo o texto"),
            ("Ctrl + S", "Salvar configurações"),
            ("F5", "Atualizar a tela"),
            ("F1", "Esta lista"),
            ("Botão direito", "Recortar, copiar, colar  ·  ações do corte"),
            ("Duplo clique", "Assistir o corte"),
            ("Arrastar e soltar", "Solte um vídeo na janela para usá-lo"),
        ]
        for tecla, desc in itens:
            linha = ctk.CTkFrame(w, fg_color="transparent")
            linha.pack(fill="x", padx=26, pady=3)
            ctk.CTkLabel(linha, text=tecla, fg_color=C["card2"], corner_radius=6, height=26,
                         text_color=C["destaque"], font=ctk.CTkFont(FONTE, 12, "bold"),
                         width=170, anchor="w", padx=8).pack(side="left")
            rotulo(linha, "  " + desc, 12, C["texto"]).pack(side="left")
        w.after(100, lambda: (w.lift(), w.focus_force()))

    def _novo_menu(self):
        import tkinter as tk
        return tk.Menu(self, tearoff=0, bg=C["card2"], fg=C["texto"], activebackground=C["destaque"],
                       activeforeground=C["sobre_destaque"], bd=0, relief="flat",
                       font=(FONTE, 10))

    def _menus_texto(self):
        """Botão direito e Ctrl+A em todos os campos de texto do app."""
        def menu_campo(e):
            w = e.widget
            w.focus_set()
            m = self._novo_menu()
            leitura = str(w.cget("state")) == "disabled"
            if not leitura:
                m.add_command(label="Recortar", accelerator="Ctrl+X", command=lambda: w.event_generate("<<Cut>>"))
            m.add_command(label="Copiar", accelerator="Ctrl+C", command=lambda: w.event_generate("<<Copy>>"))
            if not leitura:
                m.add_command(label="Colar", accelerator="Ctrl+V", command=lambda: w.event_generate("<<Paste>>"))
                m.add_command(label="Limpar", command=lambda: self._limpar_campo(w))
            m.add_separator()
            m.add_command(label="Selecionar tudo", accelerator="Ctrl+A", command=lambda: self._selecionar_tudo(w))
            m.tk_popup(e.x_root, e.y_root)
            return "break"

        def sel_tudo(e):
            self._selecionar_tudo(e.widget)
            return "break"

        for classe in ("Entry", "Text"):
            self.bind_class(classe, "<Button-3>", menu_campo, add="+")
            self.bind_class(classe, "<Control-a>", sel_tudo)
            self.bind_class(classe, "<Control-A>", sel_tudo)
        # com Caps Lock ligado o Tk recebe Ctrl+V/C/X maiúsculos: trata também
        for tecla, ev in (("<Control-V>", "<<Paste>>"), ("<Control-C>", "<<Copy>>"), ("<Control-X>", "<<Cut>>")):
            self.bind_class("Entry", tecla, lambda e, ev=ev: (e.widget.event_generate(ev), "break")[1])

    @staticmethod
    def _selecionar_tudo(w):
        try:
            w.select_range(0, "end")
            w.icursor("end")
        except Exception:
            w.tag_add("sel", "1.0", "end-1c")

    @staticmethod
    def _limpar_campo(w):
        try:
            w.delete(0, "end")
        except Exception:
            w.delete("1.0", "end")

    def _colar_link(self):
        try:
            texto = self.clipboard_get().strip()
        except Exception:
            texto = ""
        if not texto:
            self.aviso("A área de transferência está vazia.", erro=True)
            return
        self.ent_origem.delete(0, "end")
        self.ent_origem.insert(0, texto)
        self.ent_origem.focus_set()

    def _arrastar_soltar(self):
        """Solte um arquivo de vídeo em qualquer lugar da janela (Windows)."""
        if not WINDOWS:
            return
        try:
            import windnd
        except ImportError:
            return

        def soltou(arquivos):
            caminhos = [a.decode("utf-8", "replace") if isinstance(a, bytes) else a for a in arquivos]
            videos = [c for c in caminhos if c.lower().endswith((".mp4", ".mov", ".mkv", ".webm", ".avi"))]
            if not videos:
                self.ui(lambda: self.aviso("Solte um arquivo de vídeo (mp4, mov, mkv, webm, avi).", erro=True))
                return

            def usar():
                self.mostrar("criar")
                self.ent_origem.delete(0, "end")
                self.ent_origem.insert(0, videos[0])
                self.aviso("Vídeo carregado. Clique em Gerar cortes ou tecle Enter.")
            self.ui(usar)
        try:
            windnd.hook_dropfiles(self, func=soltou, force_unicode=True)
        except TypeError:
            windnd.hook_dropfiles(self, func=soltou)

    def _menu_corte(self, e, c):
        m = self._novo_menu()
        m.add_command(label="▶  Assistir", command=lambda: abrir(c["caminho"]))
        m.add_command(label="Abrir pasta", command=lambda: abrir(Path(c["caminho"]).parent))
        m.add_command(label="Copiar título + hashtags",
                      command=lambda: self._copiar(f"{c.get('titulo', '')} {self.cfg.get('hashtags', '')}".strip()))
        m.add_separator()
        m.add_command(label="Marcar como postado no YouTube", command=lambda: self._marcar(c, "youtube"))
        m.add_command(label="Marcar como postado no TikTok", command=lambda: self._marcar(c, "tiktok"))
        m.add_command(label="Voltar para a fila", command=lambda: self._marcar(c, None))
        m.add_separator()
        m.add_command(label="Excluir corte", command=lambda: self._excluir(c))
        m.tk_popup(e.x_root, e.y_root)

    def _copiar(self, texto):
        self.clipboard_clear()
        self.clipboard_append(texto)
        self.aviso("Copiado.")

    def _marcar(self, c, plat):
        import postar
        reg = postar.carregar_registro()
        if plat:
            reg.setdefault(plat, {})[c["chave"]] = {"id": "manual", "quando": time.strftime("%Y-%m-%d %H:%M")}
        else:
            for p in ("youtube", "tiktok"):
                reg.setdefault(p, {}).pop(c["chave"], None)
        postar.salvar_registro(reg)
        self.carregar_biblioteca()

    def _excluir(self, c):
        from tkinter import messagebox
        if not messagebox.askyesno("Excluir corte", f"Excluir \"{c.get('titulo') or c['arquivo']}\"?\n\nO arquivo de vídeo será apagado."):
            return
        arq = Path(c["caminho"])
        js = arq.parent / "cortes.json"
        try:
            lista = json.loads(js.read_text(encoding="utf-8"))
            lista = [x for x in lista if x.get("arquivo") != arq.name]
            js.write_text(json.dumps(lista, ensure_ascii=False, indent=2), encoding="utf-8")
            arq.unlink(missing_ok=True)
            arq.with_suffix(".jpg").unlink(missing_ok=True)
        except Exception as ex:
            self.aviso(f"Não consegui excluir: {ex}", erro=True)
            return
        self.carregar_biblioteca()
        self.aviso("Corte excluído.")

    # ------------------------------------------------------------ lateral
    def _lateral(self):
        lat = ctk.CTkFrame(self, fg_color=C["lateral"], corner_radius=0, width=236)
        lat.grid(row=0, column=0, sticky="nsw")
        lat.grid_propagate(False)
        lat.grid_rowconfigure(6, weight=1)
        lat.grid_columnconfigure(0, weight=1)

        marca = ctk.CTkFrame(lat, fg_color="transparent")
        marca.grid(row=0, column=0, padx=20, pady=(28, 34), sticky="w")
        logo = ctk.CTkFrame(marca, width=38, height=38, corner_radius=10, fg_color=C["destaque"])
        logo.pack(side="left")
        logo.pack_propagate(False)
        ctk.CTkLabel(logo, text="▶", text_color=C["sobre_destaque"],
                     font=ctk.CTkFont(FONTE, 16, "bold")).pack(expand=True)
        txt = ctk.CTkFrame(marca, fg_color="transparent")
        txt.pack(side="left", padx=12)
        ctk.CTkLabel(txt, text="Cortes Studio", font=ctk.CTkFont(FONTE, 17, "bold"),
                     text_color=C["texto"]).pack(anchor="w")
        ctk.CTkLabel(txt, text="cortes no automático", font=ctk.CTkFont(FONTE, 11),
                     text_color=C["suave"]).pack(anchor="w")

        self.nav = {}
        itens = [("criar", "✂   Criar cortes"), ("biblioteca", "▦   Biblioteca"),
                 ("postar", "➤   Postar"), ("config", "⚙   Configurações")]
        for i, (k, nome) in enumerate(itens, 1):
            b = ctk.CTkButton(lat, text=nome, anchor="w", height=44, corner_radius=10,
                              fg_color="transparent", hover_color=C["card"],
                              text_color=C["suave"], font=ctk.CTkFont(FONTE, 14),
                              command=lambda k=k: self.mostrar(k))
            b.grid(row=i, column=0, padx=14, pady=3, sticky="ew")
            self.nav[k] = b

        self.status_box = ctk.CTkFrame(lat, fg_color=C["card"], corner_radius=12)
        self.status_box.grid(row=7, column=0, padx=14, pady=(20, 8), sticky="ew")
        ctk.CTkButton(lat, text="⌨  Atalhos  (F1)", anchor="w", height=32, corner_radius=8,
                      fg_color="transparent", hover_color=C["card"], text_color=C["apagado"],
                      font=ctk.CTkFont(FONTE, 12), command=self._mostrar_atalhos
                      ).grid(row=8, column=0, padx=14, pady=(0, 14), sticky="ew")
        self.atualizar_status()

    def atualizar_status(self):
        for w in self.status_box.winfo_children():
            w.destroy()
        import postar
        itens = [
            ("YouTube", postar.YT_TOKEN.exists()),
            ("TikTok", postar.TT_TOKEN.exists()),
            ("IA Claude", bool(self.cfg.get("claude_key"))),
            ("ffmpeg", ffmpeg_ok()),
            ("Deno", deno_ok()),
        ]
        rotulo(self.status_box, "CONEXÕES", 10, C["apagado"], "bold").pack(anchor="w", padx=14, pady=(12, 4))
        for nome, ok in itens:
            linha = ctk.CTkFrame(self.status_box, fg_color="transparent")
            linha.pack(fill="x", padx=14, pady=2)
            ctk.CTkLabel(linha, text="●", text_color=C["ok"] if ok else C["apagado"],
                         font=ctk.CTkFont(FONTE, 12)).pack(side="left")
            rotulo(linha, f"  {nome}", 12, C["texto"] if ok else C["suave"]).pack(side="left")
        ctk.CTkFrame(self.status_box, height=10, fg_color="transparent").pack()

    def mostrar(self, nome):
        for k, p in self.paginas.items():
            p.grid_forget()
            self.nav[k].configure(fg_color="transparent", text_color=C["suave"])
        self.paginas[nome].grid(row=0, column=0, sticky="nsew")
        self.pagina_atual = nome
        self.nav[nome].configure(fg_color=C["card"], text_color=C["destaque"])
        if nome == "biblioteca":
            self.carregar_biblioteca()
        elif nome == "postar":
            self.atualizar_pendentes()

    # =========================================================== CRIAR
    def _pagina_criar(self):
        p = ctk.CTkScrollableFrame(self.area, fg_color="transparent")
        p.grid_columnconfigure(0, weight=1)
        titulo(p, "Criar cortes",
               "Cole um link ou escolha um vídeo. O app transcreve, acha os melhores momentos e entrega pronto pra postar."
               ).grid(row=0, column=0, sticky="w", pady=(0, 22))

        # origem
        c1 = card(p)
        c1.grid(row=1, column=0, sticky="ew")
        c1.grid_columnconfigure(0, weight=1)
        rotulo(c1, "VÍDEO DE ORIGEM", 11, C["apagado"], "bold").grid(row=0, column=0, sticky="w", padx=22, pady=(18, 8))
        self.ent_origem = entrada(c1, "https://www.youtube.com/watch?v=...   ou escolha um arquivo")
        self.ent_origem.grid(row=1, column=0, sticky="ew", padx=(22, 10), pady=(0, 8))
        self.ent_origem.bind("<Return>", lambda _e: self.gerar())
        self.ent_origem.bind("<KP_Enter>", lambda _e: self.gerar())
        botoes = ctk.CTkFrame(c1, fg_color="transparent")
        botoes.grid(row=1, column=1, padx=(0, 22), pady=(0, 8))
        botao_sec(botoes, "Colar", self._colar_link, height=42, width=80).pack(side="left", padx=(0, 8))
        botao_sec(botoes, "Arquivo…", self._escolher_arquivo, height=42, width=110
                  ).pack(side="left")
        rotulo(c1, "Cole o link, escolha um arquivo ou arraste o vídeo para a janela. Use vídeos seus, autorizados ou Creative Commons.",
               12, C["apagado"]).grid(row=2, column=0, columnspan=2, sticky="w", padx=22, pady=(0, 18))

        # ajustes
        c2 = card(p)
        c2.grid(row=2, column=0, sticky="ew", pady=16)
        for i in range(2):
            c2.grid_columnconfigure(i, weight=1, uniform="a")

        col_a = ctk.CTkFrame(c2, fg_color="transparent")
        col_a.grid(row=0, column=0, sticky="nsew", padx=22, pady=20)
        rotulo(col_a, "QUANTIDADE DE CORTES", 11, C["apagado"], "bold").pack(anchor="w")
        self.seg_qtd = segmentado(col_a, ["3", "5", "8", "10"])
        self.seg_qtd.set(str(self.cfg["cortes"]) if str(self.cfg["cortes"]) in ("3", "5", "8", "10") else "5")
        self.seg_qtd.pack(anchor="w", fill="x", pady=(8, 20))

        cab = ctk.CTkFrame(col_a, fg_color="transparent")
        cab.pack(fill="x")
        rotulo(cab, "DURAÇÃO DE CADA CORTE", 11, C["apagado"], "bold").pack(side="left")
        self.lbl_dur = rotulo(cab, "", 14, C["destaque"], "bold")
        self.lbl_dur.pack(side="right")
        self.sl_min = self._slider(col_a, "Mínimo", self.cfg["dmin"])
        self.sl_max = self._slider(col_a, "Máximo", self.cfg["dmax"])
        self._atualiza_dur()

        col_b = ctk.CTkFrame(c2, fg_color="transparent")
        col_b.grid(row=0, column=1, sticky="nsew", padx=22, pady=20)
        rotulo(col_b, "PRECISÃO DA TRANSCRIÇÃO", 11, C["apagado"], "bold").pack(anchor="w")
        self.seg_prec = segmentado(col_b, list(PRECISAO))
        self.seg_prec.set(self.cfg["precisao"])
        self.seg_prec.pack(anchor="w", fill="x", pady=(8, 20))
        rotulo(col_b, "IDIOMA DO VÍDEO", 11, C["apagado"], "bold").pack(anchor="w")
        self.menu_idioma = menu(col_b, list(IDIOMAS))
        self.menu_idioma.set(self.cfg["idioma"])
        self.menu_idioma.pack(anchor="w", fill="x", pady=(8, 20))
        self.sw_ia = chave(col_b, "Escolher os trechos com IA (Claude)")
        if self.cfg["usar_ia"]:
            self.sw_ia.select()
        self.sw_ia.pack(anchor="w")
        self.lbl_ia = rotulo(col_b, "", 12, C["apagado"])
        self.lbl_ia.configure(wraplength=380)
        self.lbl_ia.pack(anchor="w", pady=(4, 0))
        self._atualiza_dica_ia()

        self.btn_gerar = botao_principal(p, "✂   Gerar cortes", self.gerar)
        self.btn_gerar.grid(row=3, column=0, sticky="ew", pady=(0, 16))

        # progresso
        c3 = card(p)
        c3.grid(row=4, column=0, sticky="ew")
        c3.grid_columnconfigure(0, weight=1)
        topo = ctk.CTkFrame(c3, fg_color="transparent")
        topo.grid(row=0, column=0, sticky="ew", padx=22, pady=(18, 8))
        self.lbl_etapa = rotulo(topo, "Pronto para começar", 15, C["texto"], "bold")
        self.lbl_etapa.pack(side="left")
        self.lbl_pct = rotulo(topo, "", 15, C["destaque"], "bold")
        self.lbl_pct.pack(side="right")
        self.barra = ctk.CTkProgressBar(c3, height=10, corner_radius=5, fg_color=C["fundo"],
                                        progress_color=C["destaque"])
        self.barra.set(0)
        self.barra.grid(row=1, column=0, sticky="ew", padx=22)
        self.acoes_fim = ctk.CTkFrame(c3, fg_color="transparent")
        self.acoes_fim.grid(row=2, column=0, sticky="w", padx=22, pady=(12, 0))
        self.log_criar = ctk.CTkTextbox(c3, height=130, fg_color=C["fundo"], corner_radius=10,
                                        text_color=C["suave"], font=ctk.CTkFont("Consolas" if WINDOWS else "DejaVu Sans Mono", 12),
                                        border_width=0, state="disabled")
        self.log_criar.grid(row=3, column=0, sticky="ew", padx=22, pady=(12, 20))
        return p

    def _slider(self, master, nome, valor):
        linha = ctk.CTkFrame(master, fg_color="transparent")
        linha.pack(fill="x", pady=(10, 0))
        rotulo(linha, nome, 12).configure(width=64)
        linha.winfo_children()[-1].pack(side="left")
        s = ctk.CTkSlider(linha, from_=15, to=180, number_of_steps=11, height=18,
                          progress_color=C["destaque"], button_color=C["destaque"],
                          button_hover_color=C["destaque2"], fg_color=C["fundo"],
                          command=lambda _v: self._atualiza_dur())
        s.set(valor)
        s.pack(side="right", fill="x", expand=True, padx=(14, 0))
        return s

    def _atualiza_dur(self):
        a, b = int(self.sl_min.get()), int(self.sl_max.get())
        if b <= a:
            b = min(180, a + 15)
            self.sl_max.set(b)
        self.lbl_dur.configure(text=f"{fmt_tempo(a)} – {fmt_tempo(b)}")

    def _atualiza_dica_ia(self):
        tem = bool(self.cfg.get("claude_key"))
        self.lbl_ia.configure(text="Chave configurada ✓" if tem else
                              "Sem chave: usa seleção automática por ritmo da fala. Configure em Configurações.")

    def _escolher_arquivo(self):
        from tkinter import filedialog
        f = filedialog.askopenfilename(title="Escolha um vídeo",
                                       filetypes=[("Vídeos", "*.mp4 *.mov *.mkv *.webm *.avi"), ("Todos", "*.*")])
        if f:
            self.ent_origem.delete(0, "end")
            self.ent_origem.insert(0, f)

    def gerar(self):
        origem = self.ent_origem.get().strip().strip('"')
        if not origem:
            self.aviso("Cole um link ou escolha um arquivo de vídeo.", erro=True)
            return
        if not ffmpeg_ok():
            self.aviso("ffmpeg não encontrado. Rode o INSTALAR.bat.", erro=True)
            return
        if self.ocupado:
            return
        self.cfg.update(cortes=int(self.seg_qtd.get()), dmin=int(self.sl_min.get()),
                        dmax=int(self.sl_max.get()), idioma=self.menu_idioma.get(),
                        precisao=self.seg_prec.get(), usar_ia=bool(self.sw_ia.get()))
        salvar_config(self.cfg)
        self.ocupado = True
        self.btn_gerar.configure(state="disabled", text="Gerando…")
        for w in self.acoes_fim.winfo_children():
            w.destroy()
        self.barra.set(0)
        self.lbl_pct.configure(text="0%", text_color=C["destaque"])
        self.barra.configure(progress_color=C["destaque"])

        def progresso(f, texto):
            self.ui(lambda: (self.barra.set(f), self.lbl_etapa.configure(text=texto),
                             self.lbl_pct.configure(text=f"{int(f * 100)}%")))

        def trabalho():
            import gerar_cortes as g
            cfg = self.cfg
            return g.gerar(origem, cfg["cortes"], cfg["dmin"], cfg["dmax"], IDIOMAS[cfg["idioma"]],
                           PRECISAO[cfg["precisao"]], Path(cfg["saida"]), DADOS / "downloads",
                           usar_claude=cfg["usar_ia"], progresso=progresso)

        def fim(pasta):
            self.ocupado = False
            self.btn_gerar.configure(state="normal", text="✂   Gerar cortes")
            self.lbl_etapa.configure(text="Cortes prontos!")
            self.barra.configure(progress_color=C["ok"])
            self.lbl_pct.configure(text="100%", text_color=C["ok"])
            botao_sec(self.acoes_fim, "▦  Ver na biblioteca", lambda: self.mostrar("biblioteca")).pack(side="left")
            botao_sec(self.acoes_fim, "Abrir pasta", lambda: abrir(pasta)).pack(side="left", padx=8)
            self.aviso("Cortes gerados com sucesso.")

        def falha(msg):
            self.ocupado = False
            self.btn_gerar.configure(state="normal", text="✂   Gerar cortes")
            self.lbl_etapa.configure(text="Algo deu errado")
            self.lbl_pct.configure(text="", text_color=C["erro"])
            self.barra.configure(progress_color=C["erro"])
            self.aviso(msg, erro=True, tempo=8000)

        self.em_segundo_plano(trabalho, fim, falha)

    # ======================================================= BIBLIOTECA
    def _pagina_biblioteca(self):
        p = ctk.CTkFrame(self.area, fg_color="transparent")
        p.grid_columnconfigure(0, weight=1)
        p.grid_rowconfigure(1, weight=1)
        topo = ctk.CTkFrame(p, fg_color="transparent")
        topo.grid(row=0, column=0, sticky="ew", pady=(0, 18))
        titulo(topo, "Biblioteca", "Todos os cortes gerados e onde já foram postados.").pack(side="left")
        botao_sec(topo, "Abrir pasta", lambda: abrir(self._pasta_saida())).pack(side="right")
        botao_sec(topo, "↻  Atualizar", self.carregar_biblioteca).pack(side="right", padx=8)
        self.grade = ctk.CTkScrollableFrame(p, fg_color="transparent")
        self.grade.grid(row=1, column=0, sticky="nsew")
        for i in range(4):
            self.grade.grid_columnconfigure(i, weight=1, uniform="g")
        self._imagens = []
        return p

    def _pasta_saida(self) -> Path:
        pasta = Path(self.cfg["saida"])
        pasta.mkdir(parents=True, exist_ok=True)
        return pasta

    def carregar_biblioteca(self):
        import postar
        for w in self.grade.winfo_children():
            w.destroy()
        self._imagens.clear()
        cortes = list(reversed(postar.todos_cortes(self._pasta_saida())))
        reg = postar.carregar_registro()
        if not cortes:
            vazio = card(self.grade)
            vazio.grid(row=0, column=0, columnspan=4, sticky="ew", pady=20)
            rotulo(vazio, "Nenhum corte ainda", 18, C["texto"], "bold").pack(pady=(40, 6))
            rotulo(vazio, "Gere os primeiros na aba Criar cortes.", 14).pack()
            botao_principal(vazio, "✂   Criar cortes", lambda: self.mostrar("criar"), width=220
                            ).pack(pady=(18, 40))
            return
        for i, c in enumerate(cortes):
            self._card_corte(c, reg).grid(row=i // 4, column=i % 4, sticky="nsew", padx=8, pady=8)

    def _card_corte(self, c, reg):
        k = card(self.grade)
        mini = Path(c["caminho"]).with_suffix(".jpg")
        if mini.exists():
            try:
                img = ctk.CTkImage(Image.open(mini), size=(150, 266))
                self._imagens.append(img)
                ctk.CTkLabel(k, image=img, text="", corner_radius=10).pack(padx=12, pady=(12, 8))
            except Exception:
                mini = None
        if not mini or not Path(mini).exists():
            ph = ctk.CTkFrame(k, width=150, height=266, fg_color=C["fundo"], corner_radius=10)
            ph.pack(padx=12, pady=(12, 8))
            ph.pack_propagate(False)
            ctk.CTkLabel(ph, text="▶", font=ctk.CTkFont(FONTE, 30), text_color=C["apagado"]).pack(expand=True)

        rotulo(k, c.get("titulo") or c["arquivo"], 13, C["texto"], "bold").pack(fill="x", padx=14)
        k.winfo_children()[-1].configure(wraplength=170)
        rotulo(k, f"Duração  {fmt_tempo(c['fim'] - c['inicio'])}", 12).pack(fill="x", padx=14, pady=(4, 6))

        tags = ctk.CTkFrame(k, fg_color="transparent")
        tags.pack(fill="x", padx=12)
        for plat, nome, cor in (("youtube", "YouTube", C["yt"]), ("tiktok", "TikTok", C["tt"])):
            feito = c["chave"] in reg.get(plat, {})
            ctk.CTkLabel(tags, text=("✓ " if feito else "") + nome, corner_radius=8,
                         fg_color=C["card2"], text_color=cor if feito else C["apagado"],
                         font=ctk.CTkFont(FONTE, 11, "bold"), height=24
                         ).pack(side="left", padx=2, expand=True, fill="x")

        acoes = ctk.CTkFrame(k, fg_color="transparent")
        acoes.pack(fill="x", padx=12, pady=12)
        botao_sec(acoes, "▶  Assistir", lambda: abrir(c["caminho"]), height=32
                  ).pack(side="left", expand=True, fill="x", padx=(0, 4))
        botao_sec(acoes, "↗", lambda: abrir(Path(c["caminho"]).parent), height=32, width=40
                  ).pack(side="left")

        def ligar(w):
            if isinstance(w, ctk.CTkButton):
                return
            w.bind("<Button-3>", lambda e: self._menu_corte(e, c), add="+")
            w.bind("<Double-Button-1>", lambda _e: abrir(c["caminho"]), add="+")
            for filho in w.winfo_children():
                ligar(filho)
        ligar(k)
        return k

    # ============================================================ POSTAR
    def _pagina_postar(self):
        p = ctk.CTkScrollableFrame(self.area, fg_color="transparent")
        p.grid_columnconfigure((0, 1), weight=1, uniform="p")
        titulo(p, "Postar", "Publica os próximos cortes da fila. Nada é postado duas vezes."
               ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 22))

        # YouTube
        yt = card(p)
        yt.grid(row=1, column=0, sticky="nsew", padx=(0, 8))
        self.sw_yt = chave(yt, "YouTube Shorts")
        self.sw_yt.configure(progress_color=C["yt"], font=ctk.CTkFont(FONTE, 16, "bold"))
        if self.cfg["post_youtube"]:
            self.sw_yt.select()
        self.sw_yt.pack(anchor="w", padx=22, pady=(20, 4))
        self.lbl_pend_yt = rotulo(yt, "", 13)
        self.lbl_pend_yt.pack(anchor="w", padx=22)
        rotulo(yt, "VISIBILIDADE", 11, C["apagado"], "bold").pack(anchor="w", padx=22, pady=(16, 6))
        self.seg_yt = segmentado(yt, ["Público", "Não listado", "Privado"])
        self.seg_yt.set({"public": "Público", "unlisted": "Não listado", "private": "Privado"}[self.cfg["yt_priv"]])
        self.seg_yt.pack(fill="x", padx=22, pady=(0, 22))

        # TikTok
        tt = card(p)
        tt.grid(row=1, column=1, sticky="nsew", padx=(8, 0))
        self.sw_tt = chave(tt, "TikTok")
        self.sw_tt.configure(progress_color=C["tt"], font=ctk.CTkFont(FONTE, 16, "bold"))
        if self.cfg["post_tiktok"]:
            self.sw_tt.select()
        self.sw_tt.pack(anchor="w", padx=22, pady=(20, 4))
        self.lbl_pend_tt = rotulo(tt, "", 13)
        self.lbl_pend_tt.pack(anchor="w", padx=22)
        rotulo(tt, "MODO", 11, C["apagado"], "bold").pack(anchor="w", padx=22, pady=(16, 6))
        self.seg_tt = segmentado(tt, ["Rascunho", "Direto"], command=lambda _v: self._dica_tt())
        self.seg_tt.set("Rascunho" if self.cfg["tt_modo"] == "rascunho" else "Direto")
        self.seg_tt.pack(fill="x", padx=22)
        self.lbl_dica_tt = rotulo(tt, "", 12, C["apagado"])
        self.lbl_dica_tt.configure(wraplength=360)
        self.lbl_dica_tt.pack(anchor="w", padx=22, pady=(8, 20))
        self._dica_tt()

        # ação
        acao = card(p)
        acao.grid(row=2, column=0, columnspan=2, sticky="ew", pady=16)
        acao.grid_columnconfigure(2, weight=1)
        rotulo(acao, "CORTES POR PLATAFORMA", 11, C["apagado"], "bold").grid(row=0, column=0, sticky="w", padx=22, pady=(18, 6))
        self.menu_qtd = menu(acao, ["1", "2", "3", "5"], width=110)
        self.menu_qtd.set(str(self.cfg["qtd"]))
        self.menu_qtd.grid(row=1, column=0, sticky="w", padx=22, pady=(0, 20))
        self.chk_sim = ctk.CTkCheckBox(acao, text="Só simular", fg_color=C["destaque"],
                                       hover_color=C["destaque2"], border_color=C["borda"],
                                       checkmark_color=C["sobre_destaque"], text_color=C["suave"],
                                       font=ctk.CTkFont(FONTE, 13))
        self.chk_sim.grid(row=1, column=1, sticky="w", pady=(0, 20))
        self.btn_postar = botao_principal(acao, "➤   Postar agora", self.postar_agora, width=240)
        self.btn_postar.grid(row=0, column=3, rowspan=2, padx=22, pady=18)

        # automático
        auto = card(p)
        auto.grid(row=3, column=0, columnspan=2, sticky="ew")
        auto.grid_columnconfigure(1, weight=1)
        self.sw_auto = chave(auto, "Postar automaticamente nos horários")
        if self.cfg["auto"]:
            self.sw_auto.select()
        self.sw_auto.configure(command=self._salvar_postar)
        self.sw_auto.grid(row=0, column=0, sticky="w", padx=22, pady=(20, 6))
        self.ent_horarios = entrada(auto, "12:00, 19:00", width=200)
        self.ent_horarios.insert(0, self.cfg["horarios"])
        self.ent_horarios.grid(row=0, column=1, sticky="w", padx=10, pady=(20, 6))
        rotulo(auto, "Funciona enquanto o app está aberto. Para postar mesmo com ele fechado, agende no Windows:",
               12, C["apagado"]).grid(row=1, column=0, columnspan=2, sticky="w", padx=22)
        botao_sec(auto, "Agendar no Windows", self.agendar_windows
                  ).grid(row=2, column=0, sticky="w", padx=22, pady=(10, 20))

        self.log_postar = ctk.CTkTextbox(p, height=150, fg_color=C["card"], corner_radius=12,
                                         border_width=1, border_color=C["borda"], text_color=C["suave"],
                                         font=ctk.CTkFont("Consolas" if WINDOWS else "DejaVu Sans Mono", 12),
                                         state="disabled")
        self.log_postar.grid(row=4, column=0, columnspan=2, sticky="ew", pady=16)
        self.log_postar.configure(state="normal")
        self.log_postar.insert("end", "Histórico de postagens desta sessão:\n")
        self.log_postar.configure(state="disabled")
        return p

    def _dica_tt(self):
        if self.seg_tt.get() == "Rascunho":
            t = "O vídeo chega na caixa de entrada do app TikTok; você toca na notificação e posta. Até 5 por dia."
        else:
            t = "Publica sozinho. Até o TikTok aprovar seu app, os vídeos saem como privados."
        self.lbl_dica_tt.configure(text=t)

    def _salvar_postar(self):
        self.cfg.update(
            post_youtube=bool(self.sw_yt.get()), post_tiktok=bool(self.sw_tt.get()),
            yt_priv={"Público": "public", "Não listado": "unlisted", "Privado": "private"}[self.seg_yt.get()],
            tt_modo="rascunho" if self.seg_tt.get() == "Rascunho" else "direto",
            qtd=int(self.menu_qtd.get()), horarios=self.ent_horarios.get().strip(),
            auto=bool(self.sw_auto.get()))
        salvar_config(self.cfg)

    def atualizar_pendentes(self):
        import postar
        reg = postar.carregar_registro()
        pasta = self._pasta_saida()
        n_yt = len(postar.pendentes(pasta, "youtube", reg))
        n_tt = len(postar.pendentes(pasta, "tiktok", reg))
        self.lbl_pend_yt.configure(text=f"{n_yt} corte(s) na fila")
        self.lbl_pend_tt.configure(text=f"{n_tt} corte(s) na fila")

    def postar_agora(self, automatico=False):
        if self.ocupado:
            if not automatico:
                self.aviso("Aguarde a tarefa atual terminar.", erro=True)
            return
        self._salvar_postar()
        if not (self.cfg["post_youtube"] or self.cfg["post_tiktok"]):
            self.aviso("Ligue o YouTube e/ou o TikTok.", erro=True)
            return
        self.ocupado = True
        self.btn_postar.configure(state="disabled", text="Postando…")
        simular = bool(self.chk_sim.get()) and not automatico
        cfg = dict(self.cfg)

        def trabalho():
            import postar
            return postar.postar_proximos(self._pasta_saida(), cfg["post_youtube"], cfg["post_tiktok"],
                                          cfg["qtd"], cfg["yt_priv"], cfg["tt_modo"], simular)

        def fim(res):
            self.ocupado = False
            self.btn_postar.configure(state="normal", text="➤   Postar agora")
            self.atualizar_pendentes()
            self.atualizar_status()
            ok = sum(1 for r in res if r[2])
            erros = [r for r in res if not r[2]]
            if not res:
                self.aviso("Nada na fila. Gere novos cortes.", erro=True)
            elif erros:
                self.aviso(f"{ok} postado(s), {len(erros)} com erro: {erros[0][3]}", erro=True, tempo=9000)
            else:
                self.aviso(f"{ok} corte(s) {'simulado(s)' if simular else 'enviado(s)'} com sucesso.")

        def falha(msg):
            self.ocupado = False
            self.btn_postar.configure(state="normal", text="➤   Postar agora")
            self.aviso(msg, erro=True, tempo=8000)

        self.em_segundo_plano(trabalho, fim, falha)

    def _horarios(self):
        out = []
        for h in self.cfg.get("horarios", "").replace(";", ",").split(","):
            h = h.strip()
            try:
                hh, mm = h.split(":")
                out.append(f"{int(hh):02d}:{int(mm):02d}")
            except ValueError:
                pass
        return out

    def _auto_postagem(self):
        if self.cfg.get("auto"):
            agora = time.strftime("%H:%M")
            marca = time.strftime("%Y-%m-%d ") + agora
            if agora in self._horarios() and marca != self.ultimo_auto:
                self.ultimo_auto = marca
                print(f"\n[auto] postagem das {agora}")
                self.postar_agora(automatico=True)
        self.after(20000, self._auto_postagem)

    def agendar_windows(self):
        self._salvar_postar()
        if not WINDOWS:
            self.aviso("O agendamento automático só existe no Windows.", erro=True)
            return
        horarios = self._horarios()
        if not horarios:
            self.aviso("Informe horários como 12:00, 19:00", erro=True)
            return
        if CONGELADO:
            comando = f'"{sys.executable}" --postar'
        else:
            pyw = Path(sys.executable).with_name("pythonw.exe")
            comando = f'"{pyw if pyw.exists() else sys.executable}" "{Path(__file__).resolve()}" --postar'
        criadas = 0
        # remove agendamentos antigos do app
        lista = subprocess.run(["schtasks", "/Query", "/FO", "CSV", "/NH"], capture_output=True,
                               text=True, **SEM_JANELA).stdout
        for linha in lista.splitlines():
            nome = linha.split(",")[0].strip('"').lstrip("\\")
            if nome.startswith("CortesStudio_"):
                subprocess.run(["schtasks", "/Delete", "/TN", nome, "/F"], capture_output=True, **SEM_JANELA)
        for h in horarios:
            r = subprocess.run(["schtasks", "/Create", "/SC", "DAILY", "/TN", f"CortesStudio_{h.replace(':', '')}",
                                "/TR", comando, "/ST", h, "/F"], capture_output=True, text=True, **SEM_JANELA)
            criadas += r.returncode == 0
            if r.returncode != 0:
                print(r.stderr)
        if criadas:
            self.aviso(f"Agendado no Windows: todos os dias às {', '.join(horarios)}.")
        else:
            self.aviso("Não consegui criar o agendamento. Veja o log.", erro=True)

    # ===================================================== CONFIGURAÇÕES
    def _pagina_config(self):
        p = ctk.CTkScrollableFrame(self.area, fg_color="transparent")
        p.grid_columnconfigure(0, weight=1)
        titulo(p, "Configurações", "Conecte suas contas uma vez e o resto fica no automático."
               ).grid(row=0, column=0, sticky="w", pady=(0, 22))
        self.campos = {}

        def secao(linha, nome, desc, cor=None):
            k = card(p)
            k.grid(row=linha, column=0, sticky="ew", pady=(0, 16))
            k.grid_columnconfigure(1, weight=1)
            cab = ctk.CTkFrame(k, fg_color="transparent")
            cab.grid(row=0, column=0, columnspan=3, sticky="ew", padx=22, pady=(18, 12))
            if cor:
                ctk.CTkLabel(cab, text="●", text_color=cor, font=ctk.CTkFont(FONTE, 14)).pack(side="left", padx=(0, 8))
            rotulo(cab, nome, 16, C["texto"], "bold").pack(side="left")
            rotulo(cab, "   " + desc, 12, C["apagado"]).pack(side="left")
            return k

        def campo(k, linha, nome, chave_cfg, segredo=False, placeholder=""):
            rotulo(k, nome, 13).grid(row=linha, column=0, sticky="w", padx=(22, 16), pady=6)
            e = entrada(k, placeholder, show="•" if segredo else "")
            e.insert(0, self.cfg.get(chave_cfg, ""))
            e.grid(row=linha, column=1, columnspan=2, sticky="ew", padx=(0, 22), pady=6)
            self.campos[chave_cfg] = e
            return e

        # Claude
        k = secao(1, "IA Claude", "escolhe os trechos com melhor gancho", C["destaque"])
        campo(k, 1, "Chave da API", "claude_key", True, "sk-ant-...")
        botao_sec(k, "Criar chave ↗", lambda: webbrowser.open("https://console.anthropic.com/settings/keys")
                  ).grid(row=2, column=1, sticky="w", pady=(4, 18))

        # YouTube
        k = secao(2, "YouTube", "Google Cloud → YouTube Data API v3 → OAuth (App para computador)", C["yt"])
        rotulo(k, "client_secret.json", 13).grid(row=1, column=0, sticky="w", padx=(22, 16), pady=6)
        self.lbl_secret = rotulo(k, "", 13, C["texto"])
        self.lbl_secret.grid(row=1, column=1, sticky="w")
        botao_sec(k, "Selecionar…", self._escolher_secret).grid(row=1, column=2, padx=(0, 22))
        linha = ctk.CTkFrame(k, fg_color="transparent")
        linha.grid(row=2, column=1, columnspan=2, sticky="w", pady=(8, 18))
        botao_sec(linha, "Conectar YouTube", self._conectar_youtube).pack(side="left")
        botao_sec(linha, "Abrir Google Cloud ↗", lambda: webbrowser.open("https://console.cloud.google.com/apis/library/youtube.googleapis.com")
                  ).pack(side="left", padx=8)
        self._atualiza_secret()

        # TikTok
        k = secao(3, "TikTok", "developers.tiktok.com → Login Kit + Content Posting API", C["tt"])
        campo(k, 1, "Client Key", "tt_key")
        campo(k, 2, "Client Secret", "tt_secret", True)
        campo(k, 3, "Redirect URI", "tt_redirect", placeholder="https://seusite.com/callback")
        linha = ctk.CTkFrame(k, fg_color="transparent")
        linha.grid(row=4, column=1, columnspan=2, sticky="w", pady=(8, 18))
        botao_sec(linha, "Conectar TikTok", self._conectar_tiktok).pack(side="left")
        botao_sec(linha, "Abrir TikTok Developers ↗", lambda: webbrowser.open("https://developers.tiktok.com/apps")
                  ).pack(side="left", padx=8)

        # Geral
        k = secao(4, "Geral", "")
        campo(k, 1, "Hashtags", "hashtags", placeholder="#cortes #viral #fyp")
        rotulo(k, "Pasta dos cortes", 13).grid(row=2, column=0, sticky="w", padx=(22, 16), pady=6)
        self.lbl_saida = rotulo(k, self.cfg["saida"], 13, C["texto"])
        self.lbl_saida.grid(row=2, column=1, sticky="w")
        botao_sec(k, "Alterar…", self._escolher_saida).grid(row=2, column=2, padx=(0, 22))
        rotulo(k, f"Dados do app: {DADOS}", 11, C["apagado"]).grid(row=3, column=0, columnspan=3, sticky="w", padx=22, pady=(6, 18))

        botao_principal(p, "Salvar configurações", self.salvar_configuracoes).grid(row=5, column=0, sticky="ew")
        return p

    def salvar_configuracoes(self, silencioso=False):
        for k, e in self.campos.items():
            self.cfg[k] = e.get().strip()
        salvar_config(self.cfg)
        aplicar_ambiente(self.cfg)
        self._atualiza_dica_ia()
        self.atualizar_status()
        if not silencioso:
            self.aviso("Configurações salvas.")

    def _atualiza_secret(self):
        import postar
        ok = postar.YT_SEGREDO.exists()
        self.lbl_secret.configure(text="Arquivo carregado ✓" if ok else "Nenhum arquivo",
                                  text_color=C["ok"] if ok else C["apagado"])

    def _escolher_secret(self):
        from tkinter import filedialog
        import postar
        f = filedialog.askopenfilename(title="client_secret.json do Google", filetypes=[("JSON", "*.json")])
        if f:
            shutil.copy(f, postar.YT_SEGREDO)
            self._atualiza_secret()
            self.aviso("Arquivo do Google carregado. Agora clique em Conectar YouTube.")

    def _escolher_saida(self):
        from tkinter import filedialog
        d = filedialog.askdirectory(title="Pasta onde salvar os cortes")
        if d:
            self.cfg["saida"] = d
            self.lbl_saida.configure(text=d)
            salvar_config(self.cfg)

    def _conectar_youtube(self):
        import postar
        if not postar.YT_SEGREDO.exists():
            self.aviso("Selecione primeiro o client_secret.json.", erro=True)
            return
        self.aviso("Abrindo o navegador para você autorizar o YouTube…")

        def ok(_):
            self.atualizar_status()
            self.aviso("YouTube conectado!")
        self.em_segundo_plano(postar.youtube_servico, ok, lambda m: self.aviso(m, erro=True, tempo=8000))

    def _conectar_tiktok(self):
        self.salvar_configuracoes(silencioso=True)
        import postar

        def ok(_):
            self.atualizar_status()
            self.aviso("TikTok conectado!")
        modo = "video.upload" if self.cfg["tt_modo"] == "rascunho" else "video.publish"
        self.em_segundo_plano(lambda: postar.tt_login(modo), ok, lambda m: self.aviso(m, erro=True, tempo=8000))

    def _pedir_url_tiktok(self, url: str) -> str:
        """Chamado pela thread de postagem: abre a janela e espera a resposta."""
        pronto, resp = threading.Event(), {"v": ""}

        def janela():
            w = ctk.CTkToplevel(self, fg_color=C["fundo"])
            w.title("Conectar TikTok")
            w.geometry("620x320")
            w.transient(self)
            w.grab_set()
            rotulo(w, "Conectar TikTok", 22, C["texto"], "bold").pack(anchor="w", padx=28, pady=(26, 4))
            rotulo(w, "1. Clique em Abrir, entre na sua conta e autorize.\n"
                      "2. Copie o endereço da página para onde você foi levado e cole abaixo.",
                   13).pack(anchor="w", padx=28)
            botao_sec(w, "Abrir TikTok ↗", lambda: webbrowser.open(url)).pack(anchor="w", padx=28, pady=16)
            e = entrada(w, "https://seusite.com/callback?code=...")
            e.pack(fill="x", padx=28)

            def confirmar():
                resp["v"] = e.get()
                w.destroy()
                pronto.set()
            botao_principal(w, "Confirmar", confirmar).pack(fill="x", padx=28, pady=18)
            w.protocol("WM_DELETE_WINDOW", lambda: (w.destroy(), pronto.set()))
            webbrowser.open(url)
        self.ui(janela)
        pronto.wait()
        return resp["v"]


if __name__ == "__main__":
    App().mainloop()
