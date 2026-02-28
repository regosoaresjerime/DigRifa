-- Adiciona a coluna webhook_url na tabela campaigns
ALTER TABLE public.campaigns 
ADD COLUMN webhook_url TEXT;

-- (Opcional) Adiciona um comentário para documentação
COMMENT ON COLUMN public.campaigns.webhook_url IS 'URL do webhook n8n para integração de sorteio com IA';
