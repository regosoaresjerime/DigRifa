import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';

export default function NewCampaign() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { addCampaign, getCampaign, updateCampaign } = useCampaign();

  const [name, setName] = useState('');
  const [ticketQuantity, setTicketQuantity] = useState(25);
  const [ticketValue, setTicketValue] = useState('');
  const [drawMethod, setDrawMethod] = useState('app');
  const [selectionMethod, setSelectionMethod] = useState<'manual' | 'aleatória'>('manual');
  const [estimatedRevenue, setEstimatedRevenue] = useState(0);
  const [creating, setCreating] = useState(false);

  const formatCurrency = (value: string) => {
    const numericValue = value.replace(/\D/g, '');
    const amount = Number(numericValue) / 100;
    return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleTicketValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = rawValue.replace(/\D/g, '');

    if (numericValue === '') {
      setTicketValue('');
      return;
    }

    const formatted = formatCurrency(numericValue);
    setTicketValue(formatted);
  };

  useEffect(() => {
    const numericTicketValue = Number(ticketValue.replace(/\./g, '').replace(',', '.')) || 0;
    setEstimatedRevenue(ticketQuantity * numericTicketValue);
  }, [ticketQuantity, ticketValue]);

  useEffect(() => {
    if (id) {
      const data = getCampaign(id);
      if (data) {
        setName(data.title);
        setTicketQuantity(data.ticketQuantity);
        if (data.ticketValue) {
          const valNum = Number(data.ticketValue);
          if (!isNaN(valNum)) {
            setTicketValue(valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          } else {
            setTicketValue(String(data.ticketValue).replace('.', ','));
          }
        }
        if (data.drawMethod) setDrawMethod(data.drawMethod);
        if (data.selectionMethod) setSelectionMethod(data.selectionMethod as any);
      }
    } else {
      const draftStr = sessionStorage.getItem('draft_campaign');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          if (draft.title) setName(draft.title);
          if (draft.ticketQuantity) setTicketQuantity(draft.ticketQuantity);
          if (draft.ticketValue) setTicketValue(draft.ticketValue.replace('.', ',')); // format back to view
          if (draft.drawMethod) setDrawMethod(draft.drawMethod);
          if (draft.selectionMethod) setSelectionMethod(draft.selectionMethod);
        } catch (e) { }
      }
    }
  }, [id, getCampaign]);

  const handleNext = async () => {
    if (!name || !ticketQuantity || !ticketValue || !drawMethod) {
      alert('Por favor, preencha todos os campos obrigatórios');
      return;
    }

    const numericTicketValueStr = ticketValue.replace(/\./g, '').replace(',', '.');

    if (id) {
      try {
        setCreating(true);
        await updateCampaign(id, {
          title: name,
          ticketQuantity,
          ticketValue: numericTicketValueStr,
          selectionMethod,
          drawMethod
        });
        navigate(`/campaigns/${id}/edit`);
      } catch (err: any) {
        console.error(err);
        alert('Erro ao salvar as alterações da campanha.');
      } finally {
        setCreating(false);
      }
    } else {
      const slug = `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now().toString().slice(-4)}`;
      const newCampaignData = {
        slug,
        title: name,
        ticketQuantity,
        ticketValue: numericTicketValueStr,
        selectionMethod,
        drawMethod,
        status: 'Pendente',
        image: 'https://via.placeholder.com/400x400?text=Sem+Imagem'
      };

      const existingDraftStr = sessionStorage.getItem('draft_campaign');
      let mergedDraft = newCampaignData;
      if (existingDraftStr) {
        try {
          const existingDraft = JSON.parse(existingDraftStr);
          mergedDraft = { ...existingDraft, ...newCampaignData };
        } catch (e) { }
      }

      sessionStorage.setItem('draft_campaign', JSON.stringify(mergedDraft));
      navigate('/campaigns/new/edit');
    }
  };


  return (
    <div className="bg-[#f8fafc] dark:bg-[#121212] text-slate-900 dark:text-slate-100 min-h-screen pb-24 font-sans">
      <header className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d]">
            <span className="material-icons-round text-[#6366f1]">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold">{id ? 'Editar Campanha' : 'Nova Campanha'}</h1>
        </div>
        <div className="relative">
          <span className="material-icons-round text-slate-400">notifications</span>
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#6366f1] text-[10px] text-white flex items-center justify-center rounded-full border-2 border-[#121212]">1</span>
        </div>
      </header>

      <main className="px-5 space-y-8">
        <div className="mb-4">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10"></div>
            <div className="absolute top-1/2 left-0 h-0.5 bg-[#6366f1] -translate-y-1/2 -z-10 transition-all duration-500" style={{ width: '0%' }}></div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#6366f1] text-white flex items-center justify-center shadow-lg shadow-[#6366f1]/30 ring-4 ring-[#f8fafc] dark:ring-[#121212]">
                <span className="material-icons-round text-xl">confirmation_number</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-sm">
                <span className="material-icons-round text-sm">image</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-sm">
                <span className="material-icons-round text-sm">card_giftcard</span>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-2 px-1 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
            <span className="text-[#6366f1]">Geral</span>
            <span>Mídia</span>
            <span>Prêmios</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Nome da campanha</label>
            <input
              className="w-full h-14 bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl px-4 focus:ring-2 focus:ring-[#6366f1] focus:border-transparent outline-none transition-all"
              placeholder="Ex: iPhone 15 Pro Max"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Como os números serão escolhidos?</label>
            <div className="grid grid-cols-1 gap-3">
              {/* Manual Selection Card */}
              <button
                type="button"
                onClick={() => setSelectionMethod('manual')}
                className={`w-full text-left relative p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${selectionMethod === 'manual'
                  ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-md shadow-[#6366f1]/5'
                  : 'border-slate-200 dark:border-[#2d2d2d] bg-slate-100 dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectionMethod === 'manual' ? 'border-[#6366f1]' : 'border-slate-300 dark:border-slate-600'}`}>
                  {selectionMethod === 'manual' && <div className="w-2.5 h-2.5 bg-[#6366f1] rounded-full animate-in zoom-in duration-200"></div>}
                </div>
                <div>
                  <p className={`font-bold transition-colors ${selectionMethod === 'manual' ? 'text-[#6366f1]' : 'text-slate-700 dark:text-slate-300'}`}>Escolha manual</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">O usuário seleciona os números manualmente</p>
                </div>
              </button>

              {/* Random Selection Card */}
              <button
                type="button"
                onClick={() => setSelectionMethod('aleatória')}
                className={`w-full text-left relative p-4 rounded-2xl border-2 transition-all flex items-start gap-4 ${selectionMethod === 'aleatória'
                  ? 'border-[#6366f1] bg-[#6366f1]/5 shadow-md shadow-[#6366f1]/5'
                  : 'border-slate-200 dark:border-[#2d2d2d] bg-slate-100 dark:bg-[#1e1e1e] hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
              >
                <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectionMethod === 'aleatória' ? 'border-[#6366f1]' : 'border-slate-300 dark:border-slate-600'}`}>
                  {selectionMethod === 'aleatória' && <div className="w-2.5 h-2.5 bg-[#6366f1] rounded-full animate-in zoom-in duration-200"></div>}
                </div>
                <div>
                  <p className={`font-bold transition-colors ${selectionMethod === 'aleatória' ? 'text-[#6366f1]' : 'text-slate-700 dark:text-slate-300'}`}>Escolha aleatória</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Após aprovação do pagamento os números são gerados aleatoriamente</p>
                </div>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Quantidade de bilhetes</label>
                <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Até 10 Milhões</span>
              </div>
              <input
                className="w-full h-14 bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl px-4 focus:ring-2 focus:ring-[#6366f1] outline-none"
                type="number"
                value={ticketQuantity}
                onChange={(e) => setTicketQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Valor do bilhete</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">R$</span>
                <input
                  className="w-full h-14 bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl pl-12 pr-4 focus:ring-2 focus:ring-[#6366f1] outline-none"
                  placeholder="0,00"
                  type="text"
                  value={ticketValue}
                  onChange={handleTicketValueChange}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400 ml-1">Por onde será feito o sorteio?</label>
            <div className="relative">
              <select
                className="w-full h-14 bg-slate-100 dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2d2d2d] rounded-2xl px-4 appearance-none focus:ring-2 focus:ring-[#6366f1] outline-none"
                value={drawMethod}
                onChange={(e) => setDrawMethod(e.target.value)}
              >
                <option disabled value="">Selecione</option>
                <option value="loteria">Loteria Federal</option>
                <option value="app">Próprio App</option>
              </select>
              <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-[#1e1e1e] rounded-3xl p-6 space-y-4 border border-slate-200 dark:border-[#2d2d2d]">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-lg">Resumo financeiro</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200 dark:border-[#2d2d2d]">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Bilhetes</p>
              <p className="text-lg font-bold">{ticketQuantity}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">Valor unitário</p>
              <p className="text-lg font-bold text-slate-400">{ticketValue ? `R$ ${ticketValue}` : '-'}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-emerald-500 font-medium">Arrecadação estimada</span>
              <span className="text-sm text-emerald-500 font-bold">
                + {estimatedRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-[#f8fafc]/80 dark:bg-[#121212]/80 backdrop-blur-xl border-t border-slate-200 dark:border-[#2d2d2d] z-40">
        <button
          onClick={handleNext}
          disabled={creating}
          className="w-full bg-[#6366f1] hover:bg-indigo-600 text-white font-bold h-14 rounded-2xl shadow-lg shadow-[#6366f1]/20 flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? 'Criando...' : (
            <>
              Próximo
              <span className="material-icons-round text-[20px]">arrow_forward</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
