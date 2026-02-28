-- COPIE ESTE CÓDIGO INTEIRO --
-- Vá no Supabase Dashboard -> SQL Editor -> New Query
-- Cole este código e clique em RUN (botão verde)

-- 1. Garante que as colunas necessárias existam
DO $$ 
BEGIN
    -- Adiciona webhook_url se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'webhook_url') THEN
        ALTER TABLE campaigns ADD COLUMN webhook_url TEXT;
    END IF;

    -- Adiciona draw_results se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'draw_results') THEN
        ALTER TABLE campaigns ADD COLUMN draw_results JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Habilita a segurança (RLS) na tabela (caso esteja desabilitada)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas antigas para evitar conflitos e erros de permissão
DROP POLICY IF EXISTS "Public campaigns are viewable by everyone" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Authenticated users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Enable read access for all users" ON campaigns;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON campaigns;
DROP POLICY IF EXISTS "Enable update for users based on user_id" ON campaigns;
DROP POLICY IF EXISTS "Enable delete for users based on user_id" ON campaigns;

-- 4. Cria as novas políticas CORRETAS

-- Qualquer pessoa (logada ou não) pode VER as campanhas
CREATE POLICY "Public campaigns are viewable by everyone" 
ON campaigns FOR SELECT 
USING (true);

-- Usuários logados podem CRIAR campanhas
CREATE POLICY "Users can insert their own campaigns" 
ON campaigns FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- O dono da campanha pode ATUALIZAR (Isso corrige o erro de salvar URL)
CREATE POLICY "Users can update their own campaigns" 
ON campaigns FOR UPDATE 
USING (auth.uid() = user_id);

-- O dono da campanha pode DELETAR
CREATE POLICY "Users can delete their own campaigns" 
ON campaigns FOR DELETE 
USING (auth.uid() = user_id);

-- Confirmação visual no console do Supabase
SELECT 'Permissões corrigidas com sucesso!' as status;
