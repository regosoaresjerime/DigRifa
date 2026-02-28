import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';

export default function CampaignEditGeneral() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getCampaign, updateCampaign, deleteCampaign } = useCampaign();

  const [campaign, setCampaign] = useState<any>(null);
  const [description, setDescription] = useState('');
  const [minTickets, setMinTickets] = useState(1);
  const [maxTickets, setMaxTickets] = useState(500);
  const [paymentTime, setPaymentTime] = useState('10 minutos');
  const [saving, setSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (id === 'new') {
      const draftStr = sessionStorage.getItem('draft_campaign');
      if (draftStr) {
        try {
          const data = JSON.parse(draftStr);
          setCampaign({ ...data, id: 'new', title: data.title || 'Nova Campanha' });
          setDescription(data.description || '');
          setMinTickets(data.minTickets || 1);
          setMaxTickets(data.maxTickets || 500);
          setPaymentTime(data.paymentTime || '10 minutos');
        } catch (e) { }
      } else {
        navigate('/campaigns/new');
      }
    } else if (id) {
      const data = getCampaign(id);
      if (data) {
        setCampaign(data);
        setDescription(data.description || '');
        setMinTickets(data.minTickets || 1);
        setMaxTickets(data.maxTickets || 500);
        setPaymentTime(data.paymentTime || '10 minutos');
      }
    }
  }, [id, getCampaign, navigate]);

  const handleSave = async () => {
    if (id === 'new') {
      const draftStr = sessionStorage.getItem('draft_campaign');
      if (draftStr) {
        try {
          const draft = JSON.parse(draftStr);
          const updatedDraft = { ...draft, description, minTickets, maxTickets, paymentTime };
          sessionStorage.setItem('draft_campaign', JSON.stringify(updatedDraft));
          navigate('/campaigns/new/media');
        } catch (e) {
          console.error(e);
        }
      }
    } else if (id && campaign) {
      try {
        setSaving(true);
        await updateCampaign(campaign.id, {
          description,
          minTickets,
          maxTickets,
          paymentTime
        });
        navigate(`/campaigns/${id}/media`);
      } catch (err: any) {
        console.error(err);
        alert(`Erro ao salvar alterações: ${err.message || 'Verifique sua conexão.'}`);
      } finally {
        setSaving(false);
      }
    } else {
      alert('Campanha não carregada. Aguarde um momento.');
    }
  };

  if (!campaign) {
    return (
      <div className="bg-[#f9fafb] dark:bg-[#121212] min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#6366f1] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Carregando dados da campanha...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f9fafb] dark:bg-[#121212] text-slate-900 dark:text-slate-100 min-h-screen font-sans">
      <header className="sticky top-0 z-50 bg-[#f9fafb]/80 dark:bg-[#121212]/80 backdrop-blur-md px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <span className="material-icons-round text-2xl">chevron_left</span>
          </button>
          <h1 className="text-lg font-semibold">Editando: {campaign.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          {isDeleting ? (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  await deleteCampaign(id!);
                  navigate('/dashboard');
                } catch (err) {
                  console.error(err);
                }
              }}
              className="px-4 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-lg animate-in fade-in transition-all"
            >
              Certeza?
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleting(true);
                setTimeout(() => setIsDeleting(false), 3000);
              }}
              className="p-2 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              title="Excluir campanha"
            >
              <span className="material-icons-round">delete_outline</span>
            </button>
          )}
          <span className="material-icons-round text-[#6366f1]">info</span>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-32">
        <div className="mb-8 px-2">
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 -z-10"></div>
            <div className="absolute top-1/2 left-0 h-0.5 bg-[#6366f1] -translate-y-1/2 -z-10 transition-all duration-500" style={{ width: '50%' }}></div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#6366f1] text-white flex items-center justify-center shadow-lg shadow-[#6366f1]/30 ring-4 ring-[#f9fafb] dark:ring-[#121212]">
                <span className="material-icons-round text-xl">confirmation_number</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full bg-[#6366f1] text-white flex items-center justify-center shadow-lg shadow-[#6366f1]/30 ring-4 ring-[#f9fafb] dark:ring-[#121212]">
                <span className="material-icons-round text-xl">image</span>
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
            <span className="text-[#6366f1]">Mídia</span>
            <span>Prêmios</span>
          </div>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Descrição / Regulamento</label>
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-[#1e1e1e]">
              <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-icons-round text-base">format_bold</span></button>
                <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-icons-round text-base">format_italic</span></button>
                <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-icons-round text-base">format_underlined</span></button>
                <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1"></div>
                <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-icons-round text-base">format_list_bulleted</span></button>
                <button className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"><span className="material-icons-round text-base">link</span></button>
              </div>
              <textarea
                className="w-full p-4 bg-transparent border-none focus:ring-0 text-sm resize-none placeholder-slate-400 dark:placeholder-slate-600"
                placeholder="Escreva a descrição ou regulamento da campanha..."
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Qtd minima por compra</label>
              <div className="relative">
                <input
                  className="w-full bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                  type="number"
                  value={minTickets}
                  onChange={(e) => setMinTickets(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Qtd. maxima por compra</label>
              <div className="relative">
                <input
                  className="w-full bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6366f1] focus:border-transparent"
                  type="number"
                  value={maxTickets}
                  onChange={(e) => setMaxTickets(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 dark:text-slate-400">Tempo para pagamento</label>
            <div className="relative">
              <select
                className="w-full bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#6366f1] focus:border-transparent appearance-none"
                value={paymentTime}
                onChange={(e) => setPaymentTime(e.target.value)}
              >
                <option>10 minutos</option>
                <option>30 minutos</option>
                <option>1 hora</option>
                <option>24 horas</option>
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <span className="material-icons-round text-slate-400">expand_more</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#f9fafb]/90 dark:bg-[#121212]/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 z-50">
        <div className="max-w-md mx-auto flex gap-3">
          <button onClick={() => id === 'new' ? navigate('/campaigns/new') : navigate(-1)} className="flex-1 py-4 px-6 rounded-xl border border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-2">
            <span className="material-icons-round text-sm">arrow_back</span>
            Voltar
          </button>
          <button onClick={handleSave} className="flex-[2] py-4 px-6 rounded-xl bg-[#6366f1] text-white font-semibold shadow-lg shadow-[#6366f1]/25 hover:bg-opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
            Próximo
            <span className="material-icons-round text-sm">arrow_forward</span>
          </button>
        </div>
      </div>

      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-20 flex-col items-center py-8 gap-8 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e1e]">
        <div className="w-10 h-10 bg-[#6366f1] rounded-xl flex items-center justify-center text-white shadow-lg">
          <span className="material-icons-round">bolt</span>
        </div>
        <div className="flex flex-col gap-6">
          <span className="material-icons-round text-[#6366f1]">campaign</span>
          <span className="material-icons-round text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">group</span>
          <span className="material-icons-round text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">account_balance_wallet</span>
          <span className="material-icons-round text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">analytics</span>
          <span className="material-icons-round text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">person</span>
        </div>
        <div className="mt-auto">
          <span className="material-icons-round text-slate-400 hover:text-red-500 cursor-pointer">logout</span>
        </div>
      </div>
    </div>
  );
}
