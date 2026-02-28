# Guia: Conectando Projeto Supabase de Outra Conta (Multi-Contas)

Este guia documenta como trabalhar em um projeto local conectado a uma conta Supabase (**Conta B**) enquanto seu ambiente CLI permanece autenticado em sua conta principal (**Conta A**).

## Cenário
- **CLI Global:** Logado na Conta A.
- **Projeto Atual:** Pertence à Conta B.
- **Objetivo:** Rodar a aplicação e comandos administrativos (migrations, types) na Conta B sem fazer logoff da Conta A.

---

## Passo 1: Conexão da Aplicação (Frontend)
Para que a aplicação (React/Vite) se comunique com o banco de dados correto em tempo de execução.

1.  Acesse o dashboard da **Conta B** via navegador.
2.  Vá em **Project Settings > API**.
3.  Copie a **Project URL** e a chave **anon public**.
4.  Atualize o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://id-do-projeto-b.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-da-conta-b
```

---

## Passo 2: Conexão do CLI (Terminal/Backend)
Para executar comandos administrativos (`db push`, `migration`, `gen types`) usando as permissões da Conta B.

### 1. Gerar Token de Acesso (Na Conta B)
1.  Logado na **Conta B**, acesse: [https://supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
2.  Clique em **"Generate new token"**.
3.  Dê um nome descritivo (ex: `CLI_DigRifa_Dev`).
4.  **Copie e salve o token** (ele começa com `sbp_...`). Você não poderá vê-lo novamente.

### 2. Vincular o Projeto (Link)
No terminal (PowerShell), utilize a variável de ambiente `SUPABASE_ACCESS_TOKEN` para autenticar a sessão atual com o token da Conta B.

Substitua `SEU_TOKEN` e `ID_DO_PROJETO` (o ID é a parte da URL do dashboard, ex: `mffggmvygquumdngthcf`):

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_SEU_TOKEN_COPIADO"; npx supabase link --project-ref ID_DO_PROJETO
```

> **Nota:** Se solicitado "Database Password", insira a senha do banco de dados definida na criação do projeto na Conta B.

### 3. Executar Comandos do Dia a Dia
Para qualquer comando subsequente do Supabase neste terminal, você deve garantir que o token esteja sendo usado.

**Opção A: Comando em Linha (Recomendado para uso esporádico)**
Define o token e executa o comando na mesma linha.

*Gerar Tipos TypeScript:*
```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_SEU_TOKEN_COPIADO"; npx supabase gen types typescript --linked > src/types/supabase.ts
```

*Puxar Schema do Banco:*
```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_SEU_TOKEN_COPIADO"; npx supabase db pull
```

**Opção B: Definir na Sessão (Recomendado para uso intenso)**
Define o token para durar enquanto a janela do terminal estiver aberta.

```powershell
$env:SUPABASE_ACCESS_TOKEN="sbp_SEU_TOKEN_COPIADO"
# Agora pode rodar os comandos normalmente nesta janela:
npx supabase db pull
npx supabase gen types typescript --linked
```

---

## Resumo de Segurança
- **Nunca comite** o arquivo `.env.local` ou seus Tokens de Acesso no Git.
- O Token de Acesso tem privilégios totais sobre a conta. Se vazado, revogue-o imediatamente no painel do Supabase.
