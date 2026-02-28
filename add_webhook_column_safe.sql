-- Verifica se a coluna webhook_url existe, caso contrário cria
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'webhook_url') THEN 
        ALTER TABLE campaigns ADD COLUMN webhook_url TEXT; 
    END IF; 
END $$;
