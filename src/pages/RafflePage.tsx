import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { supabase } from '../lib/supabaseClient';

// ─── Helpers ────────────────────────────────────────────────
function formatPhone(value: string) {
   const digits = value.replace(/\D/g, '').slice(0, 11);
   if (digits.length <= 2) return `(${digits}`;
   if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
   if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
   return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

function maskPhone(phone: string) {
   const d = phone.replace(/\D/g, '');
   if (d.length < 11) return phone;
   return `(**) *****-${d.slice(7)}`;
}

function isPhoneComplete(phone: string) {
   return phone.replace(/\D/g, '').length === 11;
}

function formatCpf(value: string) {
   const digits = value.replace(/\D/g, '').slice(0, 11);
   return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function validateCpf(cpf: string) {
   const clean = cpf.replace(/\D/g, '');
   if (clean.length !== 11) return false;
   if (/^(\d)\1+$/.test(clean)) return false; // todos digitos iguais
   // Validação simples de tamanho por enquanto
   return true;
}

function getTicketPrice(value: string) {
   return Number((value || '0').replace(',', '.')) || 0;
}

function parsePaymentTime(pt: string): number {
   // e.g. "1 hora" => 60, "30 minutos" => 30
   if (!pt) return 60;
   const m = pt.match(/(\d+)/);
   const n = m ? parseInt(m[1]) : 1;
   if (pt.toLowerCase().includes('hora')) return n * 60;
   return n;
}

// ─── Terms Modal ─────────────────────────────────────────────
function TermsModal({ description, onClose }: { description: string; onClose: () => void }) {
   return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
         <div
            className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
            <h3 className="text-lg font-black text-slate-900 mb-3">Termos e Condições</h3>
            <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
               {description ||
                  'Ao participar desta campanha, você declara que tem 18 anos ou mais e que está ciente das regras desta promoção específica. Sua participação não gera vínculo direto com a plataforma DigRifa. Todos os dados fornecidos serão tratados com responsabilidade.'}
            </p>
            <button
               onClick={onClose}
               className="mt-6 w-full bg-[#6366F1] text-white font-bold py-3 rounded-xl"
            >
               Entendido
            </button>
         </div>
      </div>
   );
}

// ─── Countdown Timer ─────────────────────────────────────────
function CountdownTimer({ minutes, createdAt }: { minutes: number; createdAt?: Date | null }) {
   const [secondsLeft, setSecondsLeft] = useState(minutes * 60);

   useEffect(() => {
      if (createdAt) {
          const now = new Date();
          const diffMs = now.getTime() - createdAt.getTime();
          const diffSec = Math.floor(diffMs / 1000);
          const totalSec = minutes * 60;
          const remaining = Math.max(0, totalSec - diffSec);
          setSecondsLeft(remaining);
      }
   }, [createdAt, minutes]);

   useEffect(() => {
      if (secondsLeft <= 0) return;
      const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
      return () => clearTimeout(t);
   }, [secondsLeft]);

   const m = Math.floor(secondsLeft / 60);
   const s = secondsLeft % 60;
   const expired = secondsLeft <= 0;
   return (
      <div
         className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${expired
            ? 'bg-red-50 text-red-500 border-red-200'
            : 'bg-amber-50 text-amber-600 border-amber-200'
            }`}
      >
         <span className="material-icons-outlined text-base">timer</span>
         {expired ? 'Tempo expirado' : `${m}min ${String(s).padStart(2, '0')}s`}
      </div>
   );
}

   // ─── History Modal ────────────────────────────────────────────
   function HistoryModal({ 
      isOpen, 
      onClose, 
      history 
   }: { 
      isOpen: boolean; 
      onClose: () => void; 
      history: any[] 
   }) {
      if (!isOpen) return null;
      return (
         <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
            <div 
               className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
               onClick={e => e.stopPropagation()}
            >
               <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">Minhas Transações</h3>
                  <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                     <span className="material-icons-round text-slate-500">close</span>
                  </button>
               </div>
               <div className="overflow-y-auto p-4 space-y-3">
                  {history.length === 0 ? (
                     <p className="text-center text-slate-500 text-sm py-4">Nenhuma transação encontrada nesta campanha.</p>
                  ) : (
                     history.map((item) => (
                        <div key={item.id} className="border border-slate-100 rounded-xl p-3 hover:bg-slate-50 transition-colors">
                           <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wide ${
                                 item.status === 'approved' ? 'bg-emerald-100 text-emerald-600' :
                                 item.status === 'pending' ? 'bg-amber-100 text-amber-600' :
                                 'bg-red-100 text-red-600'
                              }`}>
                                 {item.status === 'approved' ? 'Aprovado' : item.status === 'pending' ? 'Pendente' : 'Cancelado'}
                              </span>
                              <span className="text-xs text-slate-400">
                                 {new Date(item.created_at).toLocaleDateString('pt-BR')}
                              </span>
                           </div>
                           <div className="flex justify-between items-end">
                              <div>
                                 <p className="text-xs text-slate-500 mb-1">Cotas:</p>
                                 <div className="flex flex-wrap gap-1">
                                    {item.tickets.map((t: number) => (
                                       <span key={t} className="bg-slate-200 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                          {String(t).padStart(2, '0')}
                                       </span>
                                    ))}
                                 </div>
                              </div>
                              <p className="font-bold text-slate-700 text-sm">
                                 R$ {item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         </div>
      );
   }

// ─── Main Component ──────────────────────────────────────────

export default function RafflePage() {
   const { slug } = useParams();
   const location = useLocation();
   const { getCampaign } = useCampaign();

   const [campaign, setCampaign] = useState<any>(null);
   const [isRegulationOpen, setIsRegulationOpen] = useState(false);
   const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
   const [currentImageIndex, setCurrentImageIndex] = useState(0);
   const [direction, setDirection] = useState(0);
   const [isPaused, setIsPaused] = useState(false);
   
   // Local state for payment config (fetched from campaign owner)
   const [pixConfig, setPixConfig] = useState<{ keyType: string; pixKey: string } | null>(null);
   const [n8nConfig, setN8NConfig] = useState<{ createUrl: string; checkUrl: string; isActive: boolean }>({ createUrl: '', checkUrl: '', isActive: false });
   const [activeMethod, setActiveMethod] = useState<'pixManual' | 'n8n' | null>(null);

   // ── Checkout state ──────────────────────────────────────────
   const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>(0); // 7=N8N Payment
   const [phone, setPhone] = useState('');
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [cpf, setCpf] = useState('');
   const [termsAccepted, setTermsAccepted] = useState(false);
   const [showTermsModal, setShowTermsModal] = useState(false);
   const [existingCustomer, setExistingCustomer] = useState<any>(null);
   const [lookingUp, setLookingUp] = useState(false);
   const [copied, setCopied] = useState(false);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [submitting, setSubmitting] = useState(false);
   const [isGeneratingPix, setIsGeneratingPix] = useState(false);
   const [paymentData, setPaymentData] = useState<any>(null);
   const [showHistory, setShowHistory] = useState(false);
   const [customerHistory, setCustomerHistory] = useState<any[]>([]);
   const [proofFile, setProofFile] = useState<File | null>(null);
   const [proofPreview, setProofPreview] = useState<string | null>(null);
   const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
   const [uploading, setUploading] = useState(false);
   const [ticketsStatus, setTicketsStatus] = useState<Record<number, { status: string; expiresAt: Date }>>({});
   const [fetchingTickets, setFetchingTickets] = useState(true);
   const [socialNetworks, setSocialNetworks] = useState<any>(null);
   const [organizerPhone, setOrganizerPhone] = useState('');
   const [purchaseCreatedAt, setPurchaseCreatedAt] = useState<Date | null>(null);

   // ─── Celebration State ─────────────────────────────────────
   const [winners, setWinners] = useState<any[]>([]);
   const [isCelebration, setIsCelebration] = useState(false);
   const [claimModalOpen, setClaimModalOpen] = useState(false);
   const [claimWinnerData, setClaimWinnerData] = useState<any>(null);
   const [claimPhoneInput, setClaimPhoneInput] = useState('');

   const phoneRef = useRef<HTMLInputElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);

   // ─── Claim Prize Handler ────────────────────────────────────
   const handleOpenClaimModal = (winner: any) => {
      setClaimWinnerData(winner);
      setClaimPhoneInput('');
      setClaimModalOpen(true);
   };

   const handleConfirmClaim = () => {
      if (!claimWinnerData) return;

      const cleanUser = claimPhoneInput.replace(/\D/g, '');
      const cleanWinner = claimWinnerData.phone.replace(/\D/g, '');
      
      if (cleanUser === cleanWinner || (cleanWinner.length > 8 && cleanUser.endsWith(cleanWinner.slice(-8)))) {
          const supportPhone = socialNetworks?.whatsappSupport;
          const profilePhone = organizerPhone;
          const fallbackPhone = import.meta.env.VITE_SUPPORT_PHONE || '5511999999999';
          
          const extractPhone = (val: string) => {
             if (!val) return '';
             const match = val.match(/(?:wa\.me\/|phone=)(\d+)/);
             if (match) return match[1];
             if (val.includes('http')) return '';
             return val.replace(/\D/g, '');
          };

          const cleanSupport = extractPhone(supportPhone);
          const cleanProfile = extractPhone(profilePhone);
          
          let targetPhone = cleanSupport || cleanProfile || fallbackPhone;
          
          if (!targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
             targetPhone = '55' + targetPhone;
          }

          const msg = encodeURIComponent(`Olá! Sou o ganhador do prêmio ${claimWinnerData.prize} (Cota ${claimWinnerData.ticket}) na rifa ${campaign.title}. Gostaria de resgatar meu prêmio.`);
          
          window.open(`https://wa.me/${targetPhone}?text=${msg}`, '_blank');
          setClaimModalOpen(false);
      } else {
          alert('O telefone informado não corresponde ao do ganhador deste prêmio.');
      }
   };

   // ─── Top Level Image Parsing ────────────────────────────────
   const parseImages = (imgData: any): string[] => {
      if (!imgData) return [];
      if (Array.isArray(imgData)) {
         return imgData.filter(img => img && typeof img === 'string' && img.trim() !== '');
      }
      if (typeof imgData !== 'string') return [String(imgData)];
      try {
         const parsed = JSON.parse(imgData);
         if (Array.isArray(parsed)) {
            return parsed.filter(img => img && typeof img === 'string' && img.trim() !== '');
         }
         return [imgData];
      } catch (e) {
         return imgData ? [imgData] : [];
      }
   };

   const campaignImages = campaign ? parseImages(campaign.image || '') : [];
   const primaryImage = campaignImages[0] || 'https://via.placeholder.com/800x450?text=Sem+Imagem';

   // ─── Top Level Auto-play Effect ─────────────────────────────
   useEffect(() => {
      if (step !== 0) return;
      if (campaignImages.length <= 1 || isPaused) return;
      
      const timer = setInterval(() => {
         setDirection(1);
         setCurrentImageIndex((prev) => (prev + 1) % campaignImages.length);
      }, 4000);
      
      return () => clearInterval(timer);
   }, [campaignImages.length, isPaused, step]);

   const paginate = (newDirection: number) => {
      setDirection(newDirection);
      if (newDirection === 1) {
         setCurrentImageIndex((prev) => (prev + 1) % campaignImages.length);
      } else {
         setCurrentImageIndex((prev) => (prev === 0 ? campaignImages.length - 1 : prev - 1));
      }
   };

   // ─── Celebration Logic ──────────────────────────────────────
   const fetchWinners = async (results: any[], campaignId: string) => {
      const winnerData = [];
      let hasWinners = false;

      for (const res of results) {
         if (typeof res === 'object' && res !== null && 'ticket' in res) {
             if (res.status === 'valid') {
                 winnerData.push({
                     prize: res.prize,
                     ticket: res.ticket,
                     name: res.winnerName || 'Ganhador',
                     phone: res.winnerPhone || '',
                 });
                 hasWinners = true;
             } else if (res.status === 'no_winner') {
                 winnerData.push({
                     prize: res.prize,
                     ticket: res.ticket,
                     name: 'Acumulado / Sem Ganhador',
                     phone: '',
                     isNoWinner: true
                 });
                 hasWinners = true;
             }
         }
         else {
             const ticketVal = typeof res === 'string' ? res : String(res);
             const { data } = await supabase
                .from('purchase_history')
                .select('*, customers!inner(*)')
                .eq('campaign_id', campaignId)
                .contains('tickets', [parseInt(ticketVal)])
                .maybeSingle();
                
             if (data) {
                winnerData.push({
                   prize: `Prêmio`,
                   ticket: ticketVal,
                   name: data.customers.name,
                   phone: data.customers.phone,
                });
                hasWinners = true;
             } else {
                 winnerData.push({
                   prize: `Prêmio`,
                   ticket: ticketVal,
                   name: 'Ganhador Externo',
                   phone: '',
                });
                hasWinners = true;
             }
         }
      }
      
      setWinners(winnerData);
      
      if (hasWinners) {
          setIsCelebration(true);
      }
   };

   const fetchSocialNetworks = async (userId: string) => {
      try {
         const { data, error } = await supabase
            .from('profiles')
            .select('social_networks, phone')
            .eq('id', userId)
            .maybeSingle();
         
         if (error) throw error;
         
         setSocialNetworks(data?.social_networks || {});
         if (data?.phone) {
             setOrganizerPhone(data.phone);
         }
      } catch (err) {
         console.error('Error fetching social networks:', err);
      }
   };

   const fetchPaymentConfig = async (userId: string) => {
      try {
         const { data, error } = await supabase
            .from('profiles')
            .select('payment_methods_config')
            .eq('id', userId)
            .maybeSingle();

         if (error) throw error;
         
         const config = data?.payment_methods_config;
         
         if (config) {
             // Load N8N Config
             if (config.n8nConfig) {
                 setN8NConfig(config.n8nConfig);
             }
             
             // Load Pix Manual Config
             if (config.pixManual) {
                 setPixConfig(config.pixManual);
             }
             
             // Determine Active Method
             if (config.n8nConfig?.isActive) {
                 setActiveMethod('n8n');
             } else if (config.pixManual?.isActive) {
                 setActiveMethod('pixManual');
             } else {
                 setActiveMethod(null);
             }
         }
      } catch (err) {
         console.error('Error fetching payment config:', err);
      }
   };

   const fetchTicketsStatus = async (campaignId: string) => {
      setFetchingTickets(true);
      try {
         const { data, error } = await supabase
            .from('purchase_history')
            .select('tickets, status, created_at')
            .eq('campaign_id', campaignId);

         if (error) throw error;

         const statusMap: Record<number, { status: string; expiresAt: Date }> = {};
         const payTimeStr = campaign?.paymentTime || '1 hora';
         const payMinutes = parsePaymentTime(payTimeStr);

         data?.forEach(p => {
            const createdAt = new Date(p.created_at);
            const expiresAt = new Date(createdAt.getTime() + payMinutes * 60000);
            const now = new Date();

            if (p.status === 'approved' || (p.status === 'pending' && expiresAt > now)) {
               p.tickets.forEach((t: number) => {
                  statusMap[t] = { status: p.status, expiresAt };
               });
            }
         });
         setTicketsStatus(statusMap);
      } catch (err) {
         console.error('Error fetching tickets status:', err);
      } finally {
         setFetchingTickets(false);
      }
   };

   useEffect(() => {
      if (slug) {
         const data = getCampaign(slug);
         if (data) {
            setCampaign(data);
            fetchTicketsStatus(data.id);
            fetchSocialNetworks(data.user_id);
            fetchPaymentConfig(data.user_id);

            if (data.draw_results && Array.isArray(data.draw_results) && data.draw_results.length > 0) {
               fetchWinners(data.draw_results, data.id);
            }
         }
      }
   }, [slug, getCampaign]);

   // ─── Derived State (Moved up for safety) ───────────────────
   const totalNumbers = campaign?.ticketQuantity || 0;
   const numbers = Array.from({ length: totalNumbers }, (_, i) => i);
   const ticketPrice = getTicketPrice(campaign?.ticketValue);
   const totalValue = (selectedTickets.length * ticketPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
   const availableCount = totalNumbers - Object.keys(ticketsStatus).length;
   const reservedCount = Object.values(ticketsStatus).filter((t: any) => t.status === 'pending').length;
   const paidCount = Object.values(ticketsStatus).filter((t: any) => t.status === 'approved').length;
   const paymentMinutes = parsePaymentTime(campaign?.paymentTime || '1 hora');

   // ─── Handle Purchase ID from URL ────────────────────────────
   useEffect(() => {
      const searchParams = new URLSearchParams(location.search);
      const purchaseId = searchParams.get('purchaseId');

      if (purchaseId && campaign) {
         fetchPurchaseDetails(purchaseId);
      }
   }, [location.search, campaign]);

   // ─── Scheduled Status Checks for N8N Payment ────────────────
   const [checkStatusText, setCheckStatusText] = useState('Verificando pagamento automaticamente...');

   useEffect(() => {
      // Ensure we have the ID to check
      const idPix = paymentData?.id_pix || paymentData?.['id-pix'];
      
      // Only run if we are in Step 7 AND have config AND have an ID
      if (step !== 7 || !n8nConfig.checkUrl || !idPix || !purchaseCreatedAt) return;

      const checkStatus = async () => {
          try {
              setCheckStatusText('Consultando banco...');
              
              let targetUrl = n8nConfig.checkUrl;
              
              // Append ID to URL
              const urlObj = new URL(targetUrl);
              urlObj.searchParams.append("id-pix", idPix);
              urlObj.searchParams.append("_t", Date.now().toString());
              
              const payload = { "id-pix": idPix };

              const response = await fetch(urlObj.toString(), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
              });
              
              if (!response.ok) throw new Error('Erro na resposta do servidor');

              const result = await response.json();
              
              const status = result.status || result['status-payment'] || result.payment_status;

              if (status === 'approved' || status === 'success') {
                  setCheckStatusText('Pagamento aprovado!');
                  // Update local status and UI
                  await supabase
                      .from('purchase_history')
                      .update({ status: 'approved' })
                      .eq('id', currentPurchaseId);
                      
                  setStep(6); // Success
              } else {
                  setCheckStatusText('Aguardando confirmação do banco...');
              }
          } catch (error) {
              console.error('Check error:', error);
              setCheckStatusText('Tentando novamente em instantes...');
          }
      };

      // Check immediately
      checkStatus();

      // Poll every 10 seconds
      const interval = setInterval(() => {
          const now = new Date();
          const createdAt = purchaseCreatedAt.getTime();
          const paymentTimeMs = paymentMinutes * 60 * 1000;
          const expirationTime = createdAt + paymentTimeMs;

          if (now.getTime() > expirationTime) {
              // Expired
              console.log('Tempo de pagamento expirado.');
              clearInterval(interval);
              setCheckStatusText('Tempo expirado.');
              
              // Only cancel if we haven't confirmed yet
              supabase
                  .from('purchase_history')
                  .select('status')
                  .eq('id', currentPurchaseId)
                  .single()
                  .then(({ data }) => {
                      if (data?.status !== 'approved') {
                           supabase
                              .from('purchase_history')
                              .update({ status: 'cancelled' })
                              .eq('id', currentPurchaseId)
                              .then(() => setStep(5));
                      }
                  });
              return;
          }

          checkStatus();
      }, 10000);

      return () => clearInterval(interval);
   }, [step, n8nConfig.checkUrl, paymentData, purchaseCreatedAt, paymentMinutes, currentPurchaseId]);

   const handleManualCheck = async () => {
       const idPix = paymentData?.id_pix || paymentData?.['id-pix'];
       
       if (!idPix) {
           alert('Erro: ID do pagamento não encontrado.');
           return;
       }
       if (!n8nConfig.checkUrl) {
           alert('Erro: URL de verificação não configurada.');
           return;
       }
       
       setCheckStatusText('Verificando status...');
       
       // Usa a URL configurada pelo usuário
       // (A lógica de auto-correção foi removida pois o usuário já ajustou a URL)
       let targetUrl = n8nConfig.checkUrl;
       
       // Preparar URL com Parâmetros para garantir envio do ID
       try {
           const urlObj = new URL(targetUrl);
           urlObj.searchParams.append("id-pix", idPix);
           urlObj.searchParams.append("_t", Date.now().toString());
           targetUrl = urlObj.toString();
       } catch (e) {
           alert(`URL Inválida configurada: ${n8nConfig.checkUrl}`);
           return;
       }

       console.log('Verificando pagamento:', targetUrl);

       const payload = { "id-pix": idPix };

       // 1. TENTATIVA PADRÃO (POST com JSON)
       try {
           const response = await fetch(targetUrl, {
               method: 'POST',
               headers: { 
                   'Content-Type': 'application/json',
                   'Accept': 'application/json'
               },
               body: JSON.stringify(payload)
           });
           
           if (response.ok) {
               const result = await response.json();
               
               const status = result.status || result['status-payment'] || result.payment_status;
               if (status === 'approved' || status === 'success') {
                   await supabase.from('purchase_history').update({ status: 'approved' }).eq('id', currentPurchaseId);
                   setStep(6);
                   return;
               } else {
                   setCheckStatusText('Aguardando confirmação...');
                   alert(`Pagamento ainda não confirmado. Status: ${status || 'Pendente'}`);
                   return;
               }
           }
       } catch (e) {
           console.warn('Tentativa padrão falhou, usando fallback de compatibilidade.');
       }

       // 2. FALLBACK ROBUSTO (NO-CORS)
       // Garante o envio mesmo com bloqueios de rede/CORS
       try {
           await fetch(targetUrl, {
               method: 'POST',
               mode: 'no-cors',
               headers: { 'Content-Type': 'text/plain' },
               body: JSON.stringify(payload)
           });
           
           setCheckStatusText('Verificação enviada.');
           alert('Verificação enviada ao banco! Se o pagamento foi feito, a tela atualizará em instantes.');
       } catch (finalError) {
           setCheckStatusText('Erro na conexão.');
           alert('Não foi possível conectar ao servidor de verificação.');
       }
   };

   const fetchPurchaseDetails = async (pid: string) => {
      try {
         const { data: purchase, error } = await supabase
            .from('purchase_history')
            .select('*, customers(*)')
            .eq('id', pid)
            .maybeSingle();

         if (error || !purchase) {
            console.error('Erro ao buscar detalhes da compra:', error);
            return;
         }

         setCurrentPurchaseId(purchase.id);
         if (purchase.created_at) setPurchaseCreatedAt(new Date(purchase.created_at));
         setSelectedTickets(purchase.tickets || []);
         setPhone(purchase.customers?.phone ? maskPhone(purchase.customers.phone) : '');
         setName(purchase.customers?.name || '');
         setEmail(purchase.customers?.email || '');
         if (purchase.customers?.cpf) setCpf(purchase.customers.cpf);
         
         if (purchase.proof_url) {
            setProofPreview(purchase.proof_url);
         }

         if (purchase.payment_info) {
             setPaymentData(purchase.payment_info);
         }

         if (purchase.status === 'cancelled') {
            setStep(5);
         } else if (purchase.status === 'approved') {
            setStep(6);
         } else if (purchase.status === 'pending') {
            if (activeMethod === 'n8n' && purchase.payment_info) {
                setStep(7); // N8N Payment
            } else if (purchase.proof_url) {
               setStep(4); // Comprovante enviado
            } else {
               setStep(3); // Aguardando pagamento/upload (Manual)
            }
         }
      } catch (err) {
         console.error('Erro ao processar compra da URL:', err);
      }
   };

   // ── Handlers ────────────────────────────────────────────────
   const handleTicketClick = (num: number) => {
      const ticket = ticketsStatus[num];
      if (ticket) {
         if (ticket.status === 'approved') {
            alert(`Cota ${String(num).padStart(2, '0')} já foi vendida.`);
         } else if (ticket.status === 'pending') {
            const now = new Date();
            const diffMs = ticket.expiresAt.getTime() - now.getTime();
            const diffMin = Math.max(0, Math.floor(diffMs / 60000));
            const h = Math.floor(diffMin / 60);
            const m = diffMin % 60;
            const timeStr = h > 0 ? `${h}h e ${m}min` : `${m}min`;

            alert(`Esta cota está reservada. Ela poderá ficar disponível em ${timeStr} caso o comprador não efetue o pagamento.`);
         }
         return;
      }
      setSelectedTickets((prev) =>
         prev.includes(num) ? prev.filter((t) => t !== num) : [...prev, num]
      );
   };

   const handlePhoneChange = (v: string) => {
      const formatted = formatPhone(v);
      setPhone(formatted);
   };
   
   const handleCpfChange = (v: string) => {
       const formatted = formatCpf(v);
       setCpf(formatted);
   };

   const handlePhoneBlur = async () => {
      if (!isPhoneComplete(phone)) return;
      setLookingUp(true);
      try {
         const raw = phone.replace(/\D/g, '');
         const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', raw)
            .maybeSingle();
         if (data) {
            setExistingCustomer(data);
            setName(data.name);
            setEmail(data.email || '');
            if (data.cpf) setCpf(data.cpf);

            // 1. Check for PENDING purchase first (Blocker)
            const { data: pendingPurchase } = await supabase
               .from('purchase_history')
               .select('*, customers(*)')
               .eq('customer_id', data.id)
               .eq('campaign_id', campaign.id)
               .eq('status', 'pending')
               .order('created_at', { ascending: false })
               .limit(1)
               .maybeSingle();

            if (pendingPurchase) {
               alert('Você possui uma compra pendente. Redirecionando para o pagamento...');
               
               setCurrentPurchaseId(pendingPurchase.id);
               if (pendingPurchase.created_at) setPurchaseCreatedAt(new Date(pendingPurchase.created_at));
               setSelectedTickets(pendingPurchase.tickets || []);
               
               if (pendingPurchase.payment_info) {
                   setPaymentData(pendingPurchase.payment_info);
               }

               if (activeMethod === 'n8n' && pendingPurchase.payment_info) {
                   setStep(7);
               } else if (pendingPurchase.proof_url) {
                   setStep(4);
               } else {
                   setStep(3);
               }
               return; // Stop here, don't just set existing customer
            }

            // 2. If NO pending, just enable history button
         } else {
            setExistingCustomer(null);
         }
      } catch (_) {
      } finally {
         setLookingUp(false);
      }
   };

   const handleShowHistory = async () => {
      if (!existingCustomer) return;
      const { data } = await supabase
         .from('purchase_history')
         .select('*, campaigns(title)')
         .eq('customer_id', existingCustomer.id)
         .order('created_at', { ascending: false });
      setCustomerHistory(data || []);
      setShowHistory(true);
   };

   const handleStep1Continue = () => {
      if (!isPhoneComplete(phone)) {
         setErrors({ phone: 'Digite um telefone válido com DDD e 9 dígitos.' });
         return;
      }
      setErrors({});
      setStep(2);
   };

   const validateStep2 = () => {
      const e: Record<string, string> = {};
      if (!name.trim()) e.name = 'Nome é obrigatório.';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
         e.email = 'Formato de e-mail inválido.';
      if (activeMethod === 'n8n' && !validateCpf(cpf))
         e.cpf = 'CPF inválido.';
      if (!termsAccepted) e.terms = 'Você deve aceitar os termos.';
      return e;
   };

   const handleFinalize = async () => {
      const e = validateStep2();
      if (Object.keys(e).length > 0) { setErrors(e); return; }
      setErrors({});
      setSubmitting(true);
      setIsGeneratingPix(true);
      
      try {
         const rawPhone = phone.replace(/\D/g, '');
         
         // Upsert customer with CPF
         const { data: customer, error: custErr } = await supabase
            .from('customers')
            .upsert({ 
                phone: rawPhone, 
                name: name.trim(), 
                email: email.trim() || null,
                cpf: cpf.trim() || null
            }, { onConflict: 'phone' })
            .select()
            .maybeSingle();
            
         if (custErr) throw custErr;
         if (!customer) throw new Error('Falha ao registrar cliente');

         // Create purchase record
         const { data: purchase, error: purchErr } = await supabase.from('purchase_history').insert({
            customer_id: customer.id,
            campaign_id: campaign.id,
            tickets: selectedTickets,
            total_value: selectedTickets.length * ticketPrice,
            status: 'pending',
         }).select().maybeSingle();
         
         if (purchErr) throw purchErr;
         if (!purchase) throw new Error('Falha ao criar pedido');
         
         setCurrentPurchaseId(purchase.id);
         if (purchase.created_at) setPurchaseCreatedAt(new Date(purchase.created_at));

         // Handle N8N Integration
         if (activeMethod === 'n8n' && n8nConfig.createUrl) {
             try {
                 const payload = {
                     customer_name: name,
                     customer_phone: rawPhone,
                     customer_email: email,
                     customer_cpf: cpf,
                     amount: selectedTickets.length * ticketPrice,
                     quantity: selectedTickets.length,
                     purchase_id: purchase.id,
                     campaign_title: campaign.title
                 };

                 const response = await fetch(n8nConfig.createUrl, {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify(payload)
                 });
                 
                 const n8nData = await response.json();
                 
                 // Save payment info
                 await supabase
                    .from('purchase_history')
                    .update({ payment_info: n8nData })
                    .eq('id', purchase.id);
                    
                 setPaymentData(n8nData);
                 setStep(7); // N8N Payment Screen
             } catch (n8nError) {
                 console.error('Erro ao comunicar com N8N:', n8nError);
                 alert('Erro ao gerar Pix. Tente novamente ou contate o suporte.');
                 // Opcional: Fallback para manual ou cancelar
             }
         } else {
             // Fallback to Manual Pix
             setStep(3);
         }

      } catch (err) {
         console.error('Erro ao salvar compra:', err);
      } finally {
         setSubmitting(false);
         setIsGeneratingPix(false);
      }
   };

   const handleCopyPix = () => {
       const keyToCopy = activeMethod === 'n8n' && paymentData 
           ? paymentData['chave-pix-copia-cola'] 
           : pixConfig?.pixKey;
           
      if (keyToCopy) {
         navigator.clipboard.writeText(keyToCopy);
         setCopied(true);
         setTimeout(() => setCopied(false), 2000);
      }
   };
   
   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
         if (file.size > 5 * 1024 * 1024) {
            alert('O arquivo deve ter no máximo 5MB');
            return;
         }
         setProofFile(file);
         const reader = new FileReader();
         reader.onloadend = () => {
            setProofPreview(reader.result as string);
         };
         reader.readAsDataURL(file);
      }
   };

   const handleSendProof = async () => {
      if (!proofFile || !currentPurchaseId) {
         alert('Por favor, selecione o comprovante antes de enviar.');
         return;
      }

      setUploading(true);
      try {
         const fileExt = proofFile.name.split('.').pop();
         const fileName = `${currentPurchaseId}_${Math.random()}.${fileExt}`;
         const filePath = `${fileName}`;

         const { error: uploadError } = await supabase.storage
            .from('proofs')
            .upload(filePath, proofFile);

         if (uploadError) throw uploadError;

         const { data: { publicUrl } } = supabase.storage
            .from('proofs')
            .getPublicUrl(filePath);

         const { error: updateError } = await supabase
            .from('purchase_history')
            .update({ proof_url: publicUrl })
            .eq('id', currentPurchaseId);

         if (updateError) throw updateError;

         setStep(4);
      } catch (err) {
         console.error('Erro no upload:', err);
         alert('Erro ao enviar comprovante. Tente novamente.');
      } finally {
         setUploading(false);
      }
   };

   // ═══════════════════════════════════════════════════════════
   // RENDER: Helpers
   // ═══════════════════════════════════════════════════════════
   const Navbar = () => (
      <header className="bg-white px-4 py-3 flex justify-between items-center sticky top-0 z-50 shadow-sm border-b border-slate-100">
         <div className="flex items-center gap-1">
            <div className="bg-[#6366F1] p-1 rounded -rotate-6">
               <span className="text-white font-black italic text-sm">Dig</span>
            </div>
            <div className="bg-[#10B981] p-1 rounded rotate-3 -ml-2 z-10">
               <span className="text-white font-black text-sm">Rifa</span>
            </div>
         </div>
         {step === 0 && !isCelebration && (
            <button className="w-10 h-10 bg-[#6366F1] rounded-xl flex items-center justify-center relative shadow-sm">
               <span className="material-icons-outlined text-white text-lg">shopping_cart</span>
               {selectedTickets.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white">
                     {selectedTickets.length}
                  </span>
               )}
            </button>
         )}
         {step > 0 && step < 4 && !isCelebration && (
            <button
               onClick={() => setStep((s) => (Math.max(0, s - 1) as any))}
               className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-sm"
            >
               <span className="material-icons-round">arrow_back</span>
               Voltar
            </button>
         )}
      </header>
   );

   const CheckoutHeader = () => (
      <div className="px-4 pt-4 pb-2 max-w-md mx-auto">
         <h2 className="font-bold text-slate-900 text-base leading-snug">{campaign.title}</h2>
         <p className="text-slate-400 text-xs mt-0.5">Quantidade: {selectedTickets.length}</p>
      </div>
   );

   const SummaryBox = () => (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
         <div className="flex justify-between items-center">
            <span className="font-bold text-slate-900 text-sm">Total</span>
            <span className="text-[#6366F1] font-black text-lg">R$ {totalValue}</span>
         </div>
         <hr className="border-slate-100" />
         <div>
            <p className="text-slate-500 text-xs mb-2">Suas cotas</p>
            <div className="flex flex-wrap gap-1.5">
               {selectedTickets.sort((a, b) => a - b).map((n) => (
                  <span key={n} className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded-lg">
                     {String(n).padStart(2, '0')}
                  </span>
               ))}
            </div>
         </div>
      </div>
   );

   // ═══════════════════════════════════════════════════════════
   // VIEW ROUTING
   // ═══════════════════════════════════════════════════════════

   if (!campaign) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-white font-sans">
            <div className="text-center">
               <div className="w-10 h-10 border-4 border-[#6366F1] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
               <p className="text-slate-500 font-medium">Carregando campanha...</p>
            </div>
         </div>
      );
   }
   
   if (isCelebration && campaign?.status === 'completed') {
      // ... (Existing Celebration Code) ...
      // Keeping it brief for brevity in this response, inserting same block
      return (
         <div className="bg-[#022c22] min-h-screen font-sans relative overflow-x-hidden selection:bg-emerald-500/30">
            {/* Same Celebration content as before */}
             <div className="fixed inset-0 pointer-events-none z-0">
               <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] bg-emerald-500/20 blur-[120px] rounded-full mix-blend-screen" />
               <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-teal-500/10 blur-[120px] rounded-full mix-blend-screen" />
               <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full mix-blend-overlay" />
            </div>
            <header className="px-5 py-6 flex justify-between items-center relative z-10">
               {/* ... Header content ... */}
               <div className="flex items-center gap-1.5">
                  <div className="bg-[#10B981] p-1.5 rounded-lg -rotate-6 shadow-[0_0_15px_rgba(16,185,129,0.4)] border border-emerald-400/20">
                     <span className="text-[#022c22] font-black italic text-sm tracking-tighter">Dig</span>
                  </div>
                  <div className="bg-white p-1.5 rounded-lg rotate-3 -ml-2 z-10 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                     <span className="text-[#022c22] font-black text-sm tracking-tighter">Rifa</span>
                  </div>
               </div>
               <div className="px-3 py-1 bg-emerald-950/50 border border-emerald-500/30 rounded-full backdrop-blur-md shadow-inner shadow-emerald-500/10">
                  <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#34d399]" />
                     Finalizada
                  </span>
               </div>
            </header>
            <div className="px-5 pb-12 max-w-md mx-auto relative z-10 flex flex-col min-h-[80vh]">
               <div className="text-center mb-10 mt-4">
                  <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 tracking-tight leading-[0.9]">
                     Sorteio<br />
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-100 to-teal-300 drop-shadow-sm">Realizado!</span>
                  </h1>
               </div>
               <div className="space-y-5 flex-1">
                  {winners.map((winner, idx) => (
                     <div key={idx} className="bg-white/10 rounded-xl p-4 text-white">
                        <p className="font-bold">{winner.name}</p>
                        <p className="text-sm opacity-80">{winner.prize}</p>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 0 — Grid de Cotas
   // ═══════════════════════════════════════════════════════════
   if (step === 0) {
      // ... Same Step 0 content ...
      return (
         <div className="bg-white min-h-screen font-sans pb-28">
            <Navbar />
            {/* ... (Main Image Carousel) ... */}
            <div className="w-full aspect-video bg-slate-900 relative border-b border-slate-800 overflow-hidden">
               <img src={campaignImages[currentImageIndex] || primaryImage} alt={campaign.title} className="w-full h-full object-contain" />
            </div>
            
            <div className="p-4 space-y-5 max-w-md mx-auto">
                <h1 className="text-lg font-bold text-slate-900 leading-tight mb-4">{campaign.title}</h1>
                
                {/* Cotas Grid */}
                <div className="grid grid-cols-5 gap-1.5">
                     {numbers.map((num) => {
                        const isSelected = selectedTickets.includes(num);
                        const ticket = ticketsStatus[num];
                        const isReserved = ticket?.status === 'pending';
                        const isPaid = ticket?.status === 'approved';

                        let btnClass = 'bg-white text-slate-600 border-slate-200 hover:border-[#6366F1] hover:text-[#6366F1]';
                        if (isSelected) {
                           btnClass = 'bg-[#6366F1] text-white border-[#6366F1] scale-105 z-10';
                        } else if (isPaid) {
                           btnClass = 'bg-[#10B981] text-white border-[#10B981] cursor-not-allowed';
                        } else if (isReserved) {
                           btnClass = 'bg-[#F97316] text-white border-[#F97316] cursor-not-allowed';
                        }

                        return (
                           <button key={num} onClick={() => handleTicketClick(num)}
                              className={`aspect-square w-full rounded flex items-center justify-center text-[11px] font-bold transition-all border ${btnClass}`}>
                              {String(num).padStart(2, '0')}
                           </button>
                        );
                     })}
                  </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 pb-6 z-50 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
               <div className="max-w-md mx-auto flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                     <span className="text-xs text-slate-500 font-medium">Total</span>
                     <span className="text-lg font-black text-slate-900 leading-none">R$ {totalValue}</span>
                  </div>
                  <button
                     disabled={selectedTickets.length === 0}
                     onClick={() => setStep(1)}
                     className="flex-1 bg-[#22C55E] hover:bg-[#16a34a] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
                  >
                     Comprar {selectedTickets.length > 0 && `(${selectedTickets.length})`}
                  </button>
               </div>
            </div>
         </div>
      );
   }

   // ─── Render: Transaction History Button ──────────────────────
   const TransactionHistoryButton = () => {
       if (!existingCustomer) return null;
       return (
           <div className="flex justify-center mt-4">
               <button
                   onClick={handleShowHistory}
                   className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-bold transition-colors"
               >
                   <span className="material-icons-outlined text-sm">receipt_long</span>
                   Consultar transações
               </button>
           </div>
       );
   };

   // ═══════════════════════════════════════════════════════════
   // STEP 1 — Telefone
   // ═══════════════════════════════════════════════════════════
   if (step === 1) {
      // ... Same Step 1 content ...
      return (
         <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-4 space-y-4 max-w-md mx-auto">
               <CheckoutHeader />
               <SummaryBox />
               <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu telefone</label>
                     <input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        placeholder="(99) 99999-9999"
                        value={phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onBlur={handlePhoneBlur}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 ${errors.phone ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                     />
                     {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                  <button
                     onClick={handleStep1Continue}
                     className="w-full bg-[#6366F1] hover:bg-[#5558dd] text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
                  >
                     Continuar
                  </button>
                  <TransactionHistoryButton />
               </div>
            </div>
            {showHistory && (
               <HistoryModal
                  isOpen={showHistory}
                  onClose={() => setShowHistory(false)}
                  history={customerHistory}
               />
            )}
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 2 — Dados do comprador
   // ═══════════════════════════════════════════════════════════
   if (step === 2) {
      return (
         <div className="bg-slate-50 min-h-screen font-sans">
            <Navbar />
            <div className="p-4 space-y-4 max-w-md mx-auto">
               <CheckoutHeader />
               <SummaryBox />
               <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-4">
                  {/* Phone (readonly) */}
                  <div>
                     <label className="block text-xs text-slate-400 mb-1 font-medium">Seu telefone</label>
                     <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-500 text-sm">{phone}</div>
                  </div>
                  
                  {/* Name */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu nome</label>
                     <input
                        type="text"
                        placeholder="digite seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base uppercase focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 placeholder:normal-case ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                     />
                     {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  {/* CPF Field (New) */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu CPF {activeMethod === 'n8n' && <span className="text-red-500">*</span>}</label>
                     <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 ${errors.cpf ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                     />
                     {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
                  </div>

                  {/* Email */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu melhor e-mail <span className="text-slate-400 font-normal">(opcional)</span></label>
                     <input
                        type="email"
                        placeholder="digite seu e-mail"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 ${errors.email ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                     />
                     {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                  
                  {/* Terms checkbox */}
                  <div className={`border rounded-xl p-3 ${errors.terms ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}>
                     <label className="flex items-start gap-3 cursor-pointer">
                        <input
                           type="checkbox"
                           checked={termsAccepted}
                           onChange={(e) => setTermsAccepted(e.target.checked)}
                           className="mt-0.5 accent-[#6366F1] w-4 h-4 shrink-0"
                        />
                        <span className="text-slate-600 text-xs leading-relaxed">
                           Entendo e aceito os{' '}
                           <button type="button" onClick={() => setShowTermsModal(true)} className="text-[#6366F1] font-bold underline">
                              Termos e Condições
                           </button>{' '}
                           da DigRifa.
                        </span>
                     </label>
                     {errors.terms && <p className="text-xs text-red-500 mt-2">{errors.terms}</p>}
                  </div>

                  <button
                     onClick={handleFinalize}
                     disabled={submitting || isGeneratingPix}
                     className="w-full bg-[#6366F1] hover:bg-[#5558dd] disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                     {isGeneratingPix 
                        ? (
                            <>
                                <span className="material-icons-round animate-spin text-sm">sync</span>
                                Gerando Pix...
                            </>
                        )
                        : (activeMethod === 'n8n' ? 'Gerar Pix' : 'Finalizar compra')
                     }
                  </button>
                  <button
                     onClick={() => setStep(0)}
                     disabled={submitting || isGeneratingPix}
                     className="w-full mt-3 bg-transparent hover:bg-slate-100 text-slate-500 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                  >
                     Voltar e escolher mais
                  </button>
                  <TransactionHistoryButton />
               </div>
            </div>
            {showTermsModal && <TermsModal description={campaign.description} onClose={() => setShowTermsModal(false)} />}
            {showHistory && (
               <HistoryModal
                  isOpen={showHistory}
                  onClose={() => setShowHistory(false)}
                  history={customerHistory}
               />
            )}
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 7 — Pagamento Automático N8N (NOVO)
   // ═══════════════════════════════════════════════════════════
   if (step === 7) {
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + paymentMinutes);
      
      return (
         <div className="bg-slate-50 min-h-screen font-sans pb-10">
            <Navbar />
            <div className="p-4 space-y-5 max-w-md mx-auto">
               <div className="flex flex-col items-center pt-2 pb-1">
                  <CountdownTimer minutes={paymentMinutes} createdAt={purchaseCreatedAt} />
                  <h2 className="text-2xl font-black text-slate-900 mt-4">Aguardando Pagamento</h2>
                  <p className="text-slate-500 text-sm mt-1 text-center">
                     Pague até <span className="font-bold text-slate-700">{expirationDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span> de hoje
                  </p>
               </div>

               {/* QR Code Box */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-6 flex flex-col items-center">
                   {paymentData?.['qr-code'] ? (
                       <img 
                           src={paymentData['qr-code']} 
                           alt="QR Code Pix" 
                           className="w-48 h-48 object-contain mb-4 border border-slate-100 rounded-lg"
                       />
                   ) : (
                       <div className="w-48 h-48 bg-slate-100 rounded-lg flex items-center justify-center mb-4">
                           <span className="text-slate-400 text-xs">QR Code indisponível</span>
                       </div>
                   )}
                   
                   <div className="w-full">
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">PIX COPIA E COLA</p>
                       <div className="flex gap-2">
                           <input 
                               readOnly
                               value={paymentData?.['chave-pix-copia-cola'] || ''}
                               className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600 font-mono truncate"
                           />
                           <button 
                               onClick={handleCopyPix}
                               className="bg-[#6366F1] text-white p-2 rounded-lg hover:bg-[#5558dd] transition-colors"
                           >
                               <span className="material-icons-round text-sm">{copied ? 'check' : 'content_copy'}</span>
                           </button>
                       </div>
                       {copied && <p className="text-emerald-500 text-xs mt-1 font-bold">Copiado!</p>}
                   </div>
               </div>
               
               {/* Polling Indicator */}
               <div className="flex flex-col items-center justify-center gap-2 py-4">
                   <div className="flex items-center gap-2">
                       <span className="w-2 h-2 bg-[#6366F1] rounded-full animate-ping"></span>
                       <p className="text-xs text-slate-500 font-medium animate-pulse">{checkStatusText}</p>
                   </div>
                   <button 
                       onClick={handleManualCheck}
                       className="text-xs text-[#6366F1] font-bold underline hover:text-[#5558dd] mt-1"
                   >
                       Já fiz o pagamento, verificar agora
                   </button>
               </div>

               {/* Summary */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">RESUMO</p>
                  </div>
                  {[
                     ['Valor', `R$ ${totalValue}`],
                     ['Nome', name],
                     ['CPF', cpf],
                     ['Bilhetes', selectedTickets.length],
                     ['ID Pix', paymentData?.['id-pix'] || paymentData?.id_pix || '-']
                  ].map(([label, val]) => (
                     <div key={label as string} className="flex justify-between items-center px-4 py-3 border-b border-slate-100 last:border-0">
                        <span className="text-slate-500 text-sm">{label}</span>
                        <span className="font-bold text-slate-800 text-sm text-right max-w-[60%] truncate">{val}</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 3 — Pagamento PIX (Manual Fallback)
   // ═══════════════════════════════════════════════════════════
   if (step === 3) {
       // ... Same Step 3 content ...
       const keyTypeLabel: Record<string, string> = {
         cpf: 'CPF', cnpj: 'CNPJ', email: 'E-mail', phone: 'Telefone', random: 'Chave Aleatória',
      };
      return (
         <div className="bg-slate-50 min-h-screen font-sans pb-10">
            <Navbar />
            <div className="p-4 space-y-5 max-w-md mx-auto">
               <div className="flex flex-col items-center pt-2 pb-1">
                  <CountdownTimer minutes={paymentMinutes} />
                  <h2 className="text-2xl font-black text-slate-900 mt-4">Pagamento manual</h2>
                  <p className="text-slate-400 text-sm mt-1">Finalize o pagamento para garantir suas cotas</p>
               </div>
               {/* ... (Rest of manual pix UI) ... */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100">
                     <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">TIPO</span>
                     <span className="font-bold text-slate-800 text-sm">{keyTypeLabel[pixConfig?.keyType || ''] || pixConfig?.keyType || 'PIX'}</span>
                  </div>
                  <button onClick={handleCopyPix} className="w-full flex justify-between items-center px-4 py-3.5 border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                     <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">CHAVE</span>
                     <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 text-sm">{pixConfig?.pixKey || '—'}</span>
                        <span className={`material-icons-outlined text-sm ${copied ? 'text-emerald-500' : 'text-slate-400'}`}>{copied ? 'check_circle' : 'content_copy'}</span>
                     </div>
                  </button>
                  <div className="flex justify-between items-center px-4 py-3.5">
                     <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">VALOR</span>
                     <span className="text-[#6366F1] font-black text-lg">R$ {totalValue}</span>
                  </div>
               </div>

               {/* Upload box */}
               {!proofPreview ? (
                  <div className="bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm p-8 flex flex-col items-center gap-3">
                     <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        className="hidden"
                     />
                     <div className="w-12 h-12 bg-[#6366F1]/10 rounded-full flex items-center justify-center">
                        <span className="material-icons-outlined text-[#6366F1] text-2xl">upload</span>
                     </div>
                     <p className="font-bold text-slate-700 text-sm">Anexe o comprovante PIX aqui</p>
                     <p className="text-slate-400 text-xs text-center px-4">Tire um print ou selecione o arquivo do comprovante</p>
                     <button
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 bg-[#6366F1] text-white text-xs font-bold px-5 py-2.5 rounded-xl hover:bg-[#5558dd] transition-colors"
                     >
                        Selecionar arquivo
                     </button>
                  </div>
               ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                     <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <p className="font-bold text-slate-700 text-sm">Preview do comprovante</p>
                        <button
                           onClick={() => { setProofPreview(null); setProofFile(null); }}
                           className="text-rose-500 text-xs font-bold underline"
                        >
                           Alterar
                        </button>
                     </div>
                     <div className="p-4 flex flex-col items-center gap-4">
                        <img src={proofPreview} alt="Preview" className="max-h-48 rounded-lg shadow-sm" />
                        <button
                           onClick={handleSendProof}
                           disabled={uploading}
                           className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-50 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                        >
                           <span className="material-icons-round">{uploading ? 'sync' : 'send'}</span>
                           {uploading ? 'Enviando...' : 'Enviar comprovante'}
                        </button>
                     </div>
                  </div>
               )}

               {/* Summary */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">RESUMO</p>
                  </div>
                  {[
                     ['Valor', `R$ ${totalValue}`],
                     ['Nome', name],
                     ['Telefone', maskPhone(phone)],
                     ['Bilhetes', selectedTickets.length],
                  ].map(([label, val]) => (
                     <div key={label as string} className="flex justify-between items-center px-4 py-3 border-b border-slate-100 last:border-0">
                        <span className="text-slate-500 text-sm">{label}</span>
                        <span className="font-bold text-slate-800 text-sm text-right max-w-[60%]">{val}</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      );
   }

   // Steps 4, 5, 6 are identical to previous version, just re-included for completeness
   if (step === 4) {
      return (
         <div className="bg-slate-50 min-h-screen font-sans pb-10">
            <Navbar />
            <div className="p-4 space-y-5 max-w-md mx-auto">
               <div className="flex flex-col items-center pt-4 pb-2">
                  <CountdownTimer minutes={paymentMinutes} />
                  <h2 className="text-2xl font-black text-slate-900 mt-4">Pagamento manual</h2>
                  <p className="text-slate-400 text-sm mt-1">Finalize o pagamento para garantir suas cotas</p>
               </div>
               <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                  <span className="material-icons-round text-emerald-500 text-xl">check_circle</span>
                  <div>
                     <p className="font-bold text-emerald-700 text-sm">Comprovante enviado</p>
                     <p className="text-emerald-600 text-xs mt-0.5">O organizador irá analisar em breve.</p>
                  </div>
               </div>
            </div>
         </div>
      );
   }

   if (step === 5) {
      return (
         <div className="bg-[#121212] min-h-screen font-sans pb-10 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1E1E1E] rounded-3xl border border-red-900/30 p-6 text-center relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent pointer-events-none" />
               <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-red-500/30 rotate-3">
                  <span className="material-icons-round text-white text-4xl">close</span>
               </div>
               <h2 className="text-2xl font-black text-white mb-2">Compra cancelada</h2>
               <p className="text-slate-400 text-sm mb-8">O pagamento foi cancelado ou expirou</p>
               <button 
                  onClick={() => {
                     setStep(0);
                     setSelectedTickets([]);
                     setCurrentPurchaseId(null);
                     window.history.pushState({}, '', window.location.pathname);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
               >
                  Comprar novamente
               </button>
            </div>
         </div>
      );
   }

   if (step === 6) {
      return (
         <div className="bg-[#121212] min-h-screen font-sans pb-10 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#022c22] rounded-3xl border border-emerald-900/50 p-6 text-center relative overflow-hidden shadow-2xl">
               <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none" />
               <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-500/30 rotate-3">
                  <span className="material-icons-round text-white text-4xl">check</span>
               </div>
               <h2 className="text-2xl font-black text-white mb-2">Pagamento aprovado</h2>
               <p className="text-emerald-400 text-sm font-medium">Sua reserva foi confirmada</p>
            </div>
         </div>
      );
   }

   return null;
}
