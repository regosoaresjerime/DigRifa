
-- COPIE ESTE CÓDIGO INTEIRO --
-- Vá no Supabase Dashboard -> SQL Editor -> New Query
-- Cole este código e clique em RUN (botão verde)

-- O problema é que a tabela de perfis (profiles) está privada, 
-- impedindo que o público veja o telefone do organizador.
-- Este script torna a LEITURA dos perfis pública para que o botão do WhatsApp funcione.

-- 1. Habilita a segurança (RLS) na tabela profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 2. Remove políticas antigas de leitura para evitar conflitos
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;

-- 3. CRIA A NOVA POLÍTICA DE LEITURA PÚBLICA
-- Permite que qualquer pessoa veja os dados do organizador (nome, telefone, redes sociais)
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles FOR SELECT
USING (true);

-- 4. Garante que apenas o dono possa ALTERAR seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

-- 5. Confirmação visual
SELECT 'Permissões de perfil corrigidas! Agora o telefone será visível.' as status;
