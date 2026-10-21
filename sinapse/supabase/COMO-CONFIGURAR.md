# Ligar o Supabase e o login com Google (tudo gratuito)

O código já está pronto. Faltam só os passos que usam a sua conta. Leva uns 15 minutos.

Endereço do app: `https://paulosergio4.github.io/meus-projetos/sinapse/`

## 1. Criar o projeto no Supabase

1. Entre em https://supabase.com e crie a conta (dá para entrar com o GitHub).
2. **New project**: nome `sinapse`, região **South America (São Paulo)**, crie uma senha do banco e guarde.
3. Espere o projeto ficar pronto (1 a 2 minutos).

## 2. Criar a tabela

1. No menu lateral, **SQL Editor → New query**.
2. Cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.

## 3. Endereços do app

Em **Authentication → URL Configuration**:

- **Site URL**: `https://paulosergio4.github.io/meus-projetos/sinapse/`
- **Redirect URLs**: adicione `https://paulosergio4.github.io/meus-projetos/sinapse/` e `http://localhost:8080/`

## 4. Login com Google

No Google Cloud (https://console.cloud.google.com/apis/credentials):

1. Crie um projeto `sinapse` e configure a **Tela de consentimento OAuth** (Externo, nome Sinapse, seu e-mail).
2. **Criar credenciais → ID do cliente OAuth → Aplicativo da Web**.
3. **Origens JavaScript autorizadas**: `https://paulosergio4.github.io`
4. **URIs de redirecionamento autorizados**: copie a "Callback URL" que aparece no Supabase em **Authentication → Sign In / Providers → Google** (algo como `https://SEU-PROJETO.supabase.co/auth/v1/callback`).
5. Copie o **ID do cliente** e a **Chave secreta do cliente**.

De volta ao Supabase, em **Authentication → Sign In / Providers → Google**: ative, cole o ID e a chave secreta e salve.

A chave secreta do Google fica só no painel do Supabase. Não coloque no código.

## 5. Colocar no app

Em **Project Settings → API Keys** (ou **API**), copie:

- **Project URL**
- **Publishable key** (`sb_publishable_...`) ou a antiga **anon public**

Cole em `js/config.js`:

```js
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_...';
```

Essas duas podem ficar públicas: quem protege os dados são as regras de segurança da tabela (cada pessoa só acessa a própria linha).

Ou mande os dois valores para o Claude, que ele atualiza e publica.

## Como funciona

- **Entrar com Google** leva ao login do Google e volta para o app já conectado.
- O progresso é salvo na conta alguns segundos depois de cada mudança.
- Em outro aparelho, ao entrar com a mesma conta, o progresso é carregado.
- **Sair** salva o que faltar e limpa o aparelho.
- **Continuar sem conta** segue funcionando como antes, só no aparelho.
