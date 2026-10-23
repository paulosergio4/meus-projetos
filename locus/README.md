# Lócus Contabilidade Estratégica

Páginas estáticas da Lócus, publicadas pelo GitHub Pages. Não há etapa de build: cada pasta abre direto no navegador.

## Estrutura

```
locus/
├── index.html          Site institucional
├── css/style.css       Estilos do site
├── js/main.js          Tema claro/escuro, menu, animações de rolagem e contadores
├── painel/
│   ├── index.html      Painel de diagnóstico financeiro
│   ├── css/style.css
│   ├── js/main.js      Leitura da planilha (SheetJS), indicadores e gráficos
│   └── Planilha_Lancamentos_Locus.xlsx
├── app/
│   ├── index.html      Protótipo do app (clientes e equipe)
│   ├── css/style.css
│   └── js/main.js      Abertura animada, login, telas e troca de tema
├── equipe/
│   ├── index.html      Área da equipe no computador (protótipo)
│   ├── css/style.css
│   └── js/main.js      Clientes, chamados, entrada, prazos e publicar
└── marca/              Logo e ícones em PNG
```

## Convenções

- HTML só com estrutura e conteúdo: sem `<style>`, `<script>` embutido nem atributos `style` ou `onclick`.
- CSS com as cores em variáveis no `:root`. O tema escuro troca só essas variáveis.
- JavaScript carregado com `defer` e em modo estrito (`"use strict"`).
- Formatação com Prettier (`.prettierrc.json`) e EditorConfig (`.editorconfig`).

Para formatar depois de editar:

```
npx prettier --write "**/*.{html,css,js}"
```

## Links

- Site: https://paulosergio4.github.io/meus-projetos/locus/
- Painel: https://paulosergio4.github.io/meus-projetos/locus/painel/
- App: https://paulosergio4.github.io/meus-projetos/locus/app/
- Equipe: https://paulosergio4.github.io/meus-projetos/locus/equipe/
