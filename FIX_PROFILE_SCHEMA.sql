
-- COPIE ESTE CÓDIGO INTEIRO --
-- Vá no Supabase Dashboard -> SQL Editor -> New Query
-- Cole este código e clique em RUN (botão verde)

-- O erro 400 acontece porque a coluna 'phone' provavelmente não existe na tabela de perfis.
-- Este script cria a coluna para resolver o problema.

-- 1. Adiciona a coluna 'phone' se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;
END $$;

-- 2. Adiciona a coluna 'social_networks' se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'social_networks') THEN
        ALTER TABLE profiles ADD COLUMN social_networks JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 3. Confirmação visual
SELECT 'Coluna PHONE criada com sucesso! O erro 400 deve sumir.' as status;
