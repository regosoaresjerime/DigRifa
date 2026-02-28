
-- Substitua '5588999999999' pelo SEU número de WhatsApp real (com DDD e código do país 55)
-- Mantenha apenas números, sem espaços ou traços.

UPDATE profiles 
SET phone = '5588999999999',
    social_networks = jsonb_set(
        COALESCE(social_networks, '{}'::jsonb),
        '{whatsappSupport}',
        '"5588999999999"'
    )
WHERE id = '7e16274c-568a-4640-81ff-b1f23b00ae4f';

-- Confirmação
SELECT phone, social_networks FROM profiles WHERE id = '7e16274c-568a-4640-81ff-b1f23b00ae4f';
