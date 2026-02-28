import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { usePayment } from '../context/PaymentContext';

export default function PaymentMethods() {
  const navigate = useNavigate();
  const [isPixDrawerOpen, setIsPixDrawerOpen] = useState(false);

  const gateways = [
    {
      id: 'efi',
      name: 'efi BANK',
      logo: (
        <div className="flex items-center gap-1 font-bold text-xl text-white">
          <span>efi</span>
          <span className="text-[10px] uppercase text-slate-400 mt-1">BANK</span>
        </div>
      ),
      status: 'Não configurado',
      description: 'Gateway de pagamentos com baixa automática'
    },
    {
      id: 'pay2m',
      name: 'Pay2m',
      logo: (
        <div className="flex items-center gap-1 font-bold text-xl text-white">
          <span className="material-icons-round text-white">account_balance_wallet</span>
          <span>Pay2m</span>
        </div>
      ),
      status: 'Não configurado',
      description: 'Gateway de pagamentos com baixa automática'
    },
    {
      id: 'xgate',
      name: 'XGATE',
      logo: (
        <div className="font-black text-xl text-white tracking-widest border-2 border-white px-1">
          XGATE
        </div>
      ),
      status: 'Não configurado',
      description: 'Gateway de pagamentos com baixa automática'
    },
    {
      id: 'getpay',
      name: 'Getpay',
      logo: (
        <div className="flex items-center gap-1 font-bold text-xl text-white">
          <span className="text-green-500">$</span>
          <span>Getpay</span>
        </div>
      ),
      status: 'Não configurado',
      description: 'Gateway de pagamentos com baixa automática'
    },
    {
      id: 'fluxsis',
      name: 'FLUXSIS',
      logo: (
        <div className="font-bold text-xl text-slate-500">
          FLUX<span className="text-slate-300">SIS</span>
        </div>
      ),
      status: 'Não configurado',
      description: 'Gateway de pagamentos com baixa automática'
    },
    {
      id: 'pix',
      name: 'PIX Manual',
      logo: (
        <div className="flex items-center gap-1 font-bold text-xl text-white">
          <span className="material-icons-round text-[#32BCAD]">pix</span>
          <span className="text-slate-300">pix</span>
        </div>
      ),
      status: 'Não configurado',
      description: 'Receba via PIX with aprovação manual',
      onClick: () => setIsPixDrawerOpen(true),
      isManualPix: true
    }
  ];

  const { pixManual, setPixManual } = usePayment();
  const [pixForm, setPixForm] = useState({
    keyType: pixManual.keyType || '',
    pixKey: pixManual.pixKey || '',
    accountHolder: pixManual.accountHolder || ''
  });

  React.useEffect(() => {
    setPixForm({
      keyType: pixManual.keyType || '',
      pixKey: pixManual.pixKey || '',
      accountHolder: pixManual.accountHolder || ''
    });
  }, [pixManual]);

  const handleSavePix = async () => {
    if (!pixForm.keyType || !pixForm.pixKey || !pixForm.accountHolder) {
      alert('Por favor, preencha todos os campos.');
      return;
    }
    await setPixManual({
      ...pixForm,
      isConfigured: true
    });
    setIsPixDrawerOpen(false);
  };

  return (
    <div className="bg-[#F9FAFB] dark:bg-[#121212] text-slate-900 dark:text-slate-100 min-h-screen font-sans flex">
      {/* Sidebar for Desktop */}
      <div className="hidden lg:block h-screen sticky top-0">
        <Sidebar />
      </div>

      <div className="flex-1 flex flex-col min-h-screen relative">
        {/* Header */}
        <div className="h-16 w-full bg-[#F9FAFB] dark:bg-[#121212] sticky top-0 z-40 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 lg:border-none">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="w-8 h-8 bg-[#6366F1] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">Dig</span>
            </div>
            <span className="text-[#6366F1] font-bold text-sm hidden sm:block">Rifa</span>
          </div>

          {/* Desktop Spacer */}
          <div className="hidden lg:block"></div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="relative">
              <span className="material-icons-outlined text-slate-500 dark:text-slate-400">notifications</span>
              <span className="absolute -top-1 -right-1 bg-[#6366F1] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center border-2 border-[#F9FAFB] dark:border-[#121212]">1</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1E1E1E] px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800">
              <span className="material-icons-outlined text-sm">settings_input_component</span>
              <span className="text-xs font-medium">Sistema</span>
            </div>
          </div>
        </div>

        <main className="px-4 py-2 space-y-6 pb-24 lg:pb-8 lg:px-8 max-w-5xl w-full">

          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-medium mb-4 bg-[#1E1E1E] px-3 py-1.5 rounded-lg w-fit border border-slate-800 transition-colors"
            >
              <span className="material-icons-round text-sm">arrow_back</span>
              Voltar
            </button>
            <h1 className="text-2xl font-bold mb-1">Métodos de Pagamento</h1>
            <p className="text-slate-400 text-sm">Clique em um card para configurar e ativar um novo método de pagamento</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {gateways.map((gateway) => {
              const isConfigured = gateway.isManualPix ? pixManual.isConfigured : false;
              return (
                <div
                  key={gateway.id}
                  onClick={gateway.onClick}
                  className="bg-[#1E1E1E] border border-slate-800 rounded-xl p-6 hover:border-[#6366F1]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="h-8 flex items-center">
                      {gateway.logo}
                    </div>
                    <div className={`flex items-center gap-1 text-xs ${isConfigured ? 'text-green-500' : 'text-slate-500'}`}>
                      <span className="material-icons-round text-sm">{isConfigured ? 'check_circle' : 'close'}</span>
                      <span>{isConfigured ? 'Configurado' : gateway.status}</span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm group-hover:text-slate-300 transition-colors">
                    {gateway.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs mt-8">
            <span className="material-icons-outlined text-sm">info</span>
            <p>Configure pelo menos um método de pagamento para começar a receber pagamentos</p>
          </div>

        </main>

        {/* PIX Drawer */}
        {isPixDrawerOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-50 transition-opacity backdrop-blur-sm"
              onClick={() => setIsPixDrawerOpen(false)}
            />
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#121212] border-l border-slate-800 z-50 p-6 shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-in-out">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-1">PIX Manual</h2>
                <p className="text-slate-400 text-sm">Receba via PIX com aprovação manual</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">Tipo de chave</label>
                  <div className="relative">
                    <select
                      value={pixForm.keyType}
                      onChange={(e) => setPixForm({ ...pixForm, keyType: e.target.value })}
                      className="w-full bg-[#181818] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none appearance-none"
                    >
                      <option value="" disabled>Selecione</option>
                      <option value="cpf">CPF</option>
                      <option value="cnpj">CNPJ</option>
                      <option value="email">E-mail</option>
                      <option value="phone">Telefone</option>
                      <option value="random">Chave Aleatória</option>
                    </select>
                    <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">Chave pix</label>
                  <input
                    type="text"
                    placeholder="Digite sua chave pix"
                    value={pixForm.pixKey}
                    onChange={(e) => setPixForm({ ...pixForm, pixKey: e.target.value })}
                    className="w-full bg-[#181818] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-500"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">Titular da conta</label>
                  <input
                    type="text"
                    placeholder="Digite o titular da conta"
                    value={pixForm.accountHolder}
                    onChange={(e) => setPixForm({ ...pixForm, accountHolder: e.target.value })}
                    className="w-full bg-[#181818] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-500"
                  />
                </div>

                <div className="bg-[#1E1E1E] border border-[#6366F1]/30 rounded-xl p-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 bg-[#6366F1]/20 p-1 rounded-full">
                      <span className="material-icons-round text-[#6366F1] text-sm">info</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-slate-200 font-medium text-sm">Repassar taxas ao cliente</h3>
                        <div className="w-10 h-5 bg-[#181818] rounded-full relative cursor-pointer border border-slate-700">
                          <div className="w-3 h-3 bg-slate-500 rounded-full absolute top-1 left-1"></div>
                        </div>
                      </div>
                      <p className="text-slate-500 text-xs">Sem taxas - transferência direta para sua conta</p>
                    </div>
                  </div>

                  <div className="h-px bg-slate-800 w-full"></div>

                  <div>
                    <h3 className="text-white font-bold text-sm mb-2">Taxas do Provedor</h3>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">Taxa:</span>
                      <span className="text-white font-bold">0%</span>
                    </div>
                  </div>

                  <div className="h-px bg-[#6366F1] w-full"></div>

                  <p className="text-slate-400 text-xs">
                    Sem taxas, mas requer aprovação manual dos pagamentos
                  </p>
                </div>

                <button
                  onClick={handleSavePix}
                  className="w-full bg-[#6366F1] hover:bg-[#5558dd] text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-[#6366F1]/20 mt-8"
                >
                  Salvar Chave
                  <span className="material-icons-round text-lg">arrow_forward</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
