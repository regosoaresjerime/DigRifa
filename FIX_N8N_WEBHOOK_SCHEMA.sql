-- Executar este SQL no Supabase para preparar o banco de dados para a integração com N8N e Pagamento Automático

-- 1. Adicionar suporte a CPF na tabela de clientes
ALTER TABLE customers ADD COLUMN IF NOT EXISTS cpf TEXT;

-- 2. Adicionar suporte para salvar informações de pagamento (Pix Copia e Cola, QR Code, ID da transação externa)
ALTER TABLE purchase_history ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}'::jsonb;

-- 3. (Opcional) Adicionar índice para busca rápida por CPF se necessário no futuro
CREATE INDEX IF NOT EXISTS idx_customers_cpf ON customers(cpf);

-- Nota: A configuração do Webhook N8N será salva na coluna 'payment_methods_config' da tabela 'profiles',
-- que já existe como JSONB, portanto não requer alteração de esquema.
