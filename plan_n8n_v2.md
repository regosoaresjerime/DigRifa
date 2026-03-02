# Plano de Implementação V2: Pagamento Automático N8N (PagBank)

Este plano revisado incorpora o fluxo de **Consulta de Status** via Webhook secundário, exibição de **Data Limite** e a gestão de configuração dos webhooks no painel administrativo.

## 1. Banco de Dados (Supabase)
*Status: SQL já criado (FIX_N8N_WEBHOOK_SCHEMA.sql). Apenas garantir execução.*
- `customers.cpf`: Necessário para emissão do Pix.
- `purchase_history.payment_info`: Armazenará o JSON completo do N8N (`chave-pix-copia-cola`, `qr-code`, `id_pix`).

## 2. Configuração de Pagamento (Admin)
Local: `src/pages/PaymentMethods.tsx` e `src/context/PaymentContext.tsx`

### Interface
1.  **Card "N8N PagBank"**:
    - Adicionar ao grid de métodos de pagamento.
    - Status: "Configurado" (verde) ou "Não configurado" (cinza).
    - Botão/Toggle "Ativar":
        - Ao ativar, deve desativar automaticamente o "Pix Manual" (exclusividade).
        - Exibir modal de confirmação ao trocar.

### Modal de Configuração (Drawer)
Campos para salvar:
1.  **Webhook de Criação (Gerar Pix)**: URL para onde enviaremos os dados do cliente.
2.  **Webhook de Consulta (Status)**: URL para verificar o pagamento (ex: `https://n8n.mentoriajrs.com/webhook/...`).

*Persistência:* Salvar no JSON `payment_methods_config` do perfil do admin.

## 3. Fluxo de Compra (Checkout)
Local: `src/pages/RafflePage.tsx`

### Step 2: Dados do Comprador
- Adicionar input **CPF** (Obrigatório, com máscara `999.999.999-99`).
- Botão de ação: Alterar de "Finalizar compra" para **"Gerar Pix"** (se N8N ativo).

### Lógica de Criação (Ao clicar em Gerar Pix)
1.  Validar CPF.
2.  Salvar cliente e criar registro de compra (`pending`).
3.  Chamar **Webhook de Criação** (POST) com:
    - `customer`: { nome, cpf, telefone, email }
    - `purchase`: { id, valor, campanha }
4.  Receber resposta JSON do N8N:
    ```json
    {
      "chave-pix-copia-cola": "...",
      "qr-code": "url_ou_base64",
      "id_pix": "..." // ID da transação no PagBank/Gateway
    }
    ```
    *(Nota: O N8N deve ser configurado para retornar o `id_pix` gerado).*
5.  Salvar resposta em `purchase_history.payment_info`.
6.  Avançar para Step de Pagamento.

### Step de Pagamento (Novo Design)
Substituir a tela de upload manual por:

1.  **Timer e Data Limite**:
    - Manter o contador regressivo (ícone relógio).
    - **Novo:** Exibir texto claro: *"Pague até [HH:mm] de [DD/MM/AAAA]"*.
    - Cálculo: `Data Compra + paymentTime` da campanha.

2.  **Dados do Pix**:
    - Imagem do **QR Code** (usar link/base64 retornado).
    - Campo **Pix Copia e Cola** com botão de cópia.

3.  **Consulta de Status (Agendada)**:
    - **Estratégia**: Substituir o polling contínuo por duas verificações pontuais.
    - **Check 1**: 10 minutos após a geração do Pix (criação da compra).
    - **Check 2**: 30 segundos antes do tempo limite expirar.
    - **Ação**:
        - Chamar **Webhook de Consulta** (POST) enviando: `{ "id-pix": "..." }`.
        - Se retornar `"approved"`: Atualizar status da compra no Supabase para `approved`, e mostrar tela de Sucesso (Step 6).
        - **Apenas no Check 2 (Final)**: Se não retornar `approved`, atualizar status da compra no Supabase para `cancelled`, liberando os bilhetes, e mostrar tela de Cancelamento (Step 5).

## 4. Tarefas Técnicas

1.  **Atualizar Contexto (`PaymentContext`)**:
    - Tipagem para `n8nConfig` (createUrl, checkUrl, isActive).
    - Funções para salvar/carregar.

2.  **Tela de Configuração (`PaymentMethods`)**:
    - Implementar UI do card e formulário.

3.  **Tela de Rifa (`RafflePage`)**:
    - Implementar input CPF e máscara.
    - Implementar integração com Webhook 1 (Criação).
    - Criar nova view de Pagamento Automático.
    - Implementar lógica de Polling no Webhook 2 (Consulta).
    - Lógica de expiração visual (Data Limite).

## 5. Próximos Passos
Iniciar pela atualização do Contexto e Tela de Configuração para permitir cadastrar os Webhooks.
