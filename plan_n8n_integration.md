# Plano de Implementação: Pagamento Automático via N8N (PagBank)

Este plano detalha a implementação da integração com n8n para geração de Pix e baixa automática, substituindo o fluxo manual de envio de comprovantes quando configurado.

## 1. Banco de Dados
Precisamos preparar o banco para armazenar as novas informações.

### SQL (Executar no Supabase)
```sql
-- Adicionar CPF na tabela de clientes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Adicionar campo para armazenar dados do pagamento (payload do pix, qr code, id externo)
ALTER TABLE purchase_history ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}'::jsonb;

-- Garantir que payment_methods_config em profiles suporte n8n (já é JSONB, sem alteração de schema necessária)
```

## 2. Configuração de Pagamento (Admin)
Atualizar a tela de métodos de pagamento para permitir configurar o Webhook do N8N.

### Arquivos
- `src/context/PaymentContext.tsx`: Adicionar `n8nConfig` (webhookUrl, isActive) ao contexto e persistência.
- `src/pages/PaymentMethods.tsx`:
    - Adicionar card "N8N PagBank".
    - Criar modal/drawer para input do Webhook URL.
    - Salvar configuração no perfil do usuário.

## 3. Fluxo de Compra (Checkout)
Atualizar a página da rifa para coletar CPF e processar o pagamento via N8N.

### Arquivos
- `src/pages/RafflePage.tsx`:
    - **Step 2 (Dados)**:
        - Adicionar campo de input para **CPF** (obrigatório).
        - Validar formato do CPF.
        - Atualizar `handleFinalize` para salvar o CPF no cliente.
        - Alterar texto do botão para "Gerar Pix" (se N8N estiver ativo).
    
    - **Lógica de Pagamento**:
        - No `handleFinalize`, verificar se N8N está configurado.
        - Se SIM:
            - Enviar POST para o Webhook do N8N com:
                - `customer_name`, `customer_phone`, `customer_email`, `customer_cpf`
                - `amount` (valor total)
                - `purchase_id` (ID da compra)
                - `campaign_title`
            - Aguardar resposta do N8N contendo:
                - `pix_copy_paste` (String)
                - `qr_code_url` ou `qr_code_base64` (String)
            - Salvar resposta em `purchase_history.payment_info`.
            - Mudar para novo Step de Pagamento Automático.
        - Se NÃO (fluxo atual):
            - Seguir para Step 3 (Pix Manual com Upload).

    - **Novo Step (Pagamento N8N)**:
        - Exibir QR Code (imagem).
        - Exibir campo "Pix Copia e Cola" com botão de copiar.
        - Remover campo de upload de arquivo.
        - Adicionar instrução "Aguardando pagamento...".
        - Implementar *polling* ou *realtime* subscription para detectar quando o status mudar para 'approved' (baixa automática).

## 4. Integração N8N (Documentação)
O fluxo no n8n deve ser configurado para:
1. Receber o Webhook do App.
2. Gerar o Pix no PagBank (ou outro gateway).
3. Retornar JSON para o App: `{ "pixCopiaCola": "...", "qrCode": "..." }`.
4. (Assíncrono) Receber callback do PagBank e atualizar o status da compra no Supabase para `approved`.

## Perguntas para Validação
1. O N8N retornará o `pixCopiaCola` e a imagem do QR Code na resposta imediata do webhook? (Assumirei que sim).
2. Para a baixa automática, o N8N atualizará diretamente o banco Supabase ou devemos criar um endpoint específico? (Recomendado: N8N atualizar direto via Supabase Node ou API REST).
3. Caso o N8N falhe ou demore, devemos permitir fallback para o envio de comprovante manual? (Por simplificação, manteremos fluxos separados inicialmente).
