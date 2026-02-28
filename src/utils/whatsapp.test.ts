
import { describe, it, expect } from 'vitest'; // Assumindo vitest ou similar, ou apenas para estrutura
import { validatePhone, generateWhatsAppMessage, Purchase } from './whatsapp';

// Mock de compra para testes
const mockPurchase: Purchase = {
  id: '123',
  customer_id: 'cust_1',
  campaign_id: 'camp_1',
  tickets: [1, 2],
  total_value: 10,
  status: 'pending',
  created_at: '2023-01-01',
  customers: {
    name: 'João',
    phone: '11999998888',
    email: 'joao@test.com'
  }
};

const origin = 'https://digrifa.com';

// Testes manuais executáveis com tsx se vitest não estiver instalado
// Para rodar: npx tsx src/utils/whatsapp.test.ts

console.log('--- Iniciando Testes Unitários de WhatsApp Service ---');

// 1. Teste de Validação de Telefone
console.log('\n1. Testando Validação de Telefone');
const phones = [
  { input: '11999998888', expected: '5511999998888', desc: 'Sem código país' },
  { input: '5511999998888', expected: '5511999998888', desc: 'Com código país' },
  { input: '+55 (11) 99999-8888', expected: '5511999998888', desc: 'Formatado' },
  { input: '123', expected: null, desc: 'Muito curto' },
  { input: 'null', expected: null, desc: 'Inválido' },
];

let passed = 0;
let failed = 0;

phones.forEach(t => {
  const result = validatePhone(t.input);
  if (result === t.expected) {
    console.log(`✅ ${t.desc}: Passou`);
    passed++;
  } else {
    console.error(`❌ ${t.desc}: Falhou. Esperado ${t.expected}, recebido ${result}`);
    failed++;
  }
});

// 2. Teste de Geração de Mensagem
console.log('\n2. Testando Geração de Mensagem');

// Caso: Cancelado
const cancelledPurchase = { ...mockPurchase, status: 'cancelled' as const };
const msgCancelled = decodeURIComponent(generateWhatsAppMessage(cancelledPurchase, origin));
if (msgCancelled.includes('cancelada') && msgCancelled.includes(origin) && msgCancelled.includes('\n\n')) {
  console.log('✅ Mensagem Cancelado: Passou (com formatação)');
  passed++;
} else {
  console.error('❌ Mensagem Cancelado: Falhou', msgCancelled);
  failed++;
}

// Caso: Pendente sem comprovante
const pendingPurchase = { ...mockPurchase, status: 'pending' as const, proof_url: undefined };
const msgPending = decodeURIComponent(generateWhatsAppMessage(pendingPurchase, origin));
if (msgPending.includes('finalize seu pagamento') && msgPending.includes(origin)) {
  console.log('✅ Mensagem Pendente (sem comprovante): Passou');
  passed++;
} else {
  console.error('❌ Mensagem Pendente (sem comprovante): Falhou', msgPending);
  failed++;
}

// Caso: Pendente com comprovante
const reviewPurchase = { ...mockPurchase, status: 'pending' as const, proof_url: 'http://img.com' };
const msgReview = decodeURIComponent(generateWhatsAppMessage(reviewPurchase, origin));
if (msgReview.includes('recebemos seu comprovante') && msgReview.includes(origin)) {
  console.log('✅ Mensagem Em Análise: Passou');
  passed++;
} else {
  console.error('❌ Mensagem Em Análise: Falhou', msgReview);
  failed++;
}

// Caso: Aprovado
const approvedPurchase = { ...mockPurchase, status: 'approved' as const };
const msgApproved = decodeURIComponent(generateWhatsAppMessage(approvedPurchase, origin));
if (msgApproved.includes('aprovada') && msgApproved.includes(origin)) {
  console.log('✅ Mensagem Aprovado: Passou');
  passed++;
} else {
  console.error('❌ Mensagem Aprovado: Falhou', msgApproved);
  failed++;
}

console.log(`\n--- Resumo: ${passed} passaram, ${failed} falharam ---`);

if (failed > 0) process.exit(1);
