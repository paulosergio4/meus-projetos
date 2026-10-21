# Sinapse

App de revisões e flashcards de medicina com repetição espaçada. Acompanha o estudante do 1º período até a prova de residência.

Esta pasta tem o **protótipo 0.2**: um app web instalável (PWA) que funciona offline, sem dependências e sem servidor.

- App no ar: https://paulosergio4.github.io/meus-projetos/sinapse/
- Especificação completa: [documento do projeto](https://claude.ai/artifact/JBiZiVvTYQRgeir8dUdS1s)
- Telas de referência: [mockups](https://claude.ai/artifact/JThCGn7LizGnhw5kqoDtDP)

## O que já funciona

| Tela | O que faz |
| --- | --- |
| Login | Animação de rede neural, entrar com Google ou continuar sem conta |
| Onboarding | Nome, fase do curso, prova e data da prova |
| Início | Revisões do dia, plano de hoje (revisões e questões), sequência, contagem até a prova, decks por grande área |
| Estudar | Revisão do dia, modo 5 minutos, reforço dos erros (sem alterar a agenda), revisão por área, criar card, gerar com IA |
| Revisão | Frente e verso, lacuna e oclusão de imagem (ECG). Nas lacunas, a pessoa **digita a resposta**: o app aceita sinônimos, ignora acentos, tolera pequenos erros de digitação e sugere a nota |
| Questões | Treino por área com comentário imediato; **simulado** cronometrado (3 min por questão) com gabarito comentado; alternativas embaralhadas a cada tentativa |
| Caderno de erros | Toda questão errada entra no caderno e vira um card de revisão do conceito; sai do caderno quando a pessoa acerta |
| Casos clínicos | Casos em etapas (dor torácica, gestante com cefaleia): a cada etapa chega uma informação nova e a pessoa decide a conduta |
| Cronograma | Contagem até a prova, cards novos por dia calculados para terminar o conteúdo uma semana antes, reta final só de revisão, foco nas áreas mais fracas |
| Desempenho | Acerto dos cards, mapa por grande área e subtema, acerto em questões por área, histórico de simulados |
| Ajustes | Conta, digitar resposta (liga/desliga), cards novos por dia, meta de questões, avançar o relógio para testar, apagar progresso |

O agendamento usa o algoritmo **FSRS-4.5** com os pesos padrão (`js/fsrs.js`), com testes em `tests/`.
O progresso fica salvo no `localStorage` do navegador.

> Os 29 cards de exemplo (`js/data.js`), as 24 questões autorais e os 2 casos clínicos (`js/questions.js`) servem para testar o app. Não são questões oficiais de nenhuma banca. Todo conteúdo médico precisa ser revisado por um profissional antes de uso real.

## Rodar no computador

Precisa de Python 3 (para o servidor local) e Node.js 18+ (para testes e build).

```bash
git clone https://github.com/paulosergio4/meus-projetos
cd meus-projetos/sinapse
python3 -m http.server 8080
```

Abra `http://localhost:8080`. No Windows, use `py -m http.server 8080` se `python3` não existir.

Para testar no celular na mesma rede Wi-Fi, descubra o IP do computador (`ipconfig` no Windows, `ip addr` no Linux) e abra `http://SEU-IP:8080` no celular. A instalação como app e o modo offline exigem HTTPS, então funcionam pelo GitHub Pages ou pelo `localhost`.

## Comandos

```bash
npm test         # testes do FSRS, da correção das lacunas, do cronograma e do conteúdo
npm run build    # gera dist/sinapse.html, o app inteiro em um único arquivo
npm start        # servidor local na porta 8080
```

## Ativar o login com Google

Sem configuração, o botão do Google entra em **modo demonstração**. Para o login real:

1. Abra https://console.cloud.google.com/apis/credentials e crie um projeto (ex.: `sinapse`).
2. Configure a **Tela de consentimento OAuth** (tipo Externo, nome Sinapse, seu e-mail de suporte).
3. Em **Criar credenciais → ID do cliente OAuth**, escolha **Aplicativo da Web**.
4. Em **Origens JavaScript autorizadas**, adicione `https://paulosergio4.github.io` e `http://localhost:8080`.
5. Copie o ID (termina em `.apps.googleusercontent.com`) e cole em `js/config.js`:

```js
export const GOOGLE_CLIENT_ID = '1234567890-abc.apps.googleusercontent.com';
```

O Client ID não é segredo e pode ficar no repositório. No protótipo, os dados da conta (nome, e-mail, foto) são lidos no próprio aparelho; no MVP o login passa a ser validado pelo backend (Supabase Auth).

## Publicação

A pasta é servida pelo GitHub Pages do repositório `meus-projetos`. Todo push na branch `main` atualiza o app em
https://paulosergio4.github.io/meus-projetos/sinapse/

## Instalar no celular

- **Android (Chrome):** abra o link, toque nos três pontinhos e em **Instalar app**.
- **iPhone (Safari):** abra o link, toque em **Compartilhar** e em **Adicionar à Tela de Início**.

## Estrutura

```
index.html              página do app
css/styles.css          tema (escuro e claro), componentes
js/fsrs.js              algoritmo de repetição espaçada
js/match.js             correção tolerante das respostas digitadas
js/plan.js              cronograma reverso até a prova
js/questions.js         questões e casos clínicos
js/fx.js                animação da tela de login
js/config.js            Client ID do login com Google
js/data.js              grandes áreas, subtemas e cards de exemplo
js/store.js             estado e persistência local
js/app.js               telas e interações
sw.js                   cache para uso offline
manifest.webmanifest    instalação como app
scripts/build.mjs       gera a versão em arquivo único
tests/                  testes (node --test)
```

## Próximos passos (MVP)

1. Portar para Flutter (Android, iOS e web) mantendo o motor FSRS e o modelo de dados.
2. Backend no Supabase: login, sincronização entre aparelhos e armazenamento de PDFs.
3. Geração real de cards por IA a partir de PDF, via Edge Function.
4. Importação de decks do Anki (`.apkg`).
5. Cronograma reverso até a data da prova.
