# Cortes Studio

App de Windows que pega um vídeo (link do YouTube ou arquivo), transcreve, escolhe os melhores trechos e gera cortes verticais de 1 a 2 minutos com legenda animada. Depois posta no YouTube Shorts e no TikTok.

> Use só com vídeos que você tem direito de usar: seus, de canais que autorizaram cortes ou Creative Commons.

## Instalação (uma vez)

1. Extraia esta pasta num lugar fixo (ex.: `C:\Cortes Studio`).
2. Dê dois cliques em **INSTALAR.bat**.
   - Se o Python não estiver instalado, ele instala e pede para abrir o INSTALAR.bat de novo.
   - Ele instala o ffmpeg, o Deno (o YouTube exige para baixar), as bibliotecas e cria o aplicativo.
3. No final aparece o atalho **Cortes Studio** na Área de Trabalho.

A primeira transcrição baixa o modelo de voz (uns 500 MB no modo Equilibrado). Depois fica salvo.

## Usando o app

**Criar cortes:** cole o link ou escolha um arquivo, ajuste quantidade, duração e precisão e clique em **Gerar cortes**.
- *Rápido*: transcreve mais depressa, erra mais nas legendas.
- *Equilibrado*: bom para a maioria dos vídeos.
- *Preciso*: melhor legenda, bem mais lento.

**Biblioteca:** todos os cortes, com miniatura, duração e onde já foram postados.

**Postar:** escolhe YouTube e/ou TikTok e posta os próximos da fila. Nada é postado duas vezes.
- *Postar automaticamente*: posta nos horários definidos enquanto o app está aberto.
- *Agendar no Windows*: cria tarefas no Agendador do Windows que postam nos horários mesmo com o app fechado (o PC precisa estar ligado).

**Configurações:** chaves e contas (veja abaixo).

### Teclado e mouse
| Atalho | O que faz |
|---|---|
| Ctrl+1 / 2 / 3 / 4 | Criar · Biblioteca · Postar · Configurações |
| Ctrl+O | Escolher arquivo de vídeo |
| Enter / Ctrl+Enter | Gerar cortes (ou Postar, na tela Postar) |
| Ctrl+V, Ctrl+C, Ctrl+X, Ctrl+A | Colar, copiar, recortar, selecionar tudo (funciona com Caps Lock) |
| Ctrl+S | Salvar configurações |
| F5 | Atualizar a tela |
| F1 | Lista de atalhos |
| Botão direito num campo | Recortar, copiar, colar, limpar, selecionar tudo |
| Botão direito num corte | Assistir, abrir pasta, copiar título, marcar como postado, voltar pra fila, excluir |
| Duplo clique num corte | Assistir |
| Arrastar e soltar | Solte um vídeo na janela para usá-lo |

## Conectando as contas

### IA Claude (opcional, recomendado)
Crie uma chave em console.anthropic.com → API Keys e cole em Configurações. Sem chave, o app escolhe os trechos pelo ritmo da fala.

### YouTube (~10 min)
1. Acesse console.cloud.google.com e crie um projeto.
2. Em **APIs e serviços → Biblioteca**, ative a **YouTube Data API v3**.
3. Em **Tela de consentimento OAuth**: tipo *Externo*, e adicione seu e-mail como **usuário de teste**.
4. Em **Credenciais → Criar credenciais → ID do cliente OAuth → App para computador**, baixe o JSON.
5. No app: Configurações → **Selecionar…** (escolha o JSON) → **Conectar YouTube** e autorize no navegador.

### TikTok
1. Em developers.tiktok.com, crie um app e adicione **Login Kit** e **Content Posting API**.
2. Cadastre uma **Redirect URI** (uma página do seu site, só precisa existir).
3. No app: preencha Client Key, Client Secret e Redirect URI → **Conectar TikTok**.
4. Autorize no navegador, copie o endereço da página para onde foi levado e cole na janela do app.

**Modos do TikTok:**
- *Rascunho* (padrão): o vídeo chega na caixa de entrada do app TikTok, você toca na notificação e posta. Funciona sem aprovação. Até 5 pendentes por dia.
- *Direto*: publica sozinho, mas até o TikTok auditar seu app, os vídeos saem como privados.

## Problemas comuns
- **"ffmpeg is not installed"**: `winget install Gyan.FFmpeg` e abra o app de novo.
- **"No supported JavaScript runtime"**: `winget install DenoLand.Deno` e abra o app de novo.
- **YouTube parou de baixar**: atualize o yt-dlp com `python -m pip install -U "yt-dlp[default]"` e rode o INSTALAR.bat de novo.

## Onde ficam as coisas
- Cortes: `Documentos\Cortes Studio` (dá pra mudar em Configurações).
- Contas, chaves e histórico: `%APPDATA%\CortesStudio`. Não compartilhe essa pasta.
- Log das postagens agendadas: `%APPDATA%\CortesStudio\app.log`.

## Linha de comando (opcional)
Os scripts também funcionam sem o app:
```
python gerar_cortes.py "https://www.youtube.com/watch?v=XXXX" --cortes 5 --min 60 --max 120
python postar.py --youtube --tiktok --simular
```
