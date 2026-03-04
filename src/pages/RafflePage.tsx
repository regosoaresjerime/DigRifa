import React, { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useCampaign } from '../context/CampaignContext';
import { supabase } from '../lib/supabaseClient';
import confetti from 'canvas-confetti';

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

   let sum = 0;
   let remainder;

   for (let i = 1; i <= 9; i++) 
       sum = sum + parseInt(clean.substring(i - 1, i)) * (11 - i);
   
   remainder = (sum * 10) % 11;

   if ((remainder === 10) || (remainder === 11)) remainder = 0;
   if (remainder !== parseInt(clean.substring(9, 10))) return false;

   sum = 0;
   for (let i = 1; i <= 10; i++) 
       sum = sum + parseInt(clean.substring(i - 1, i)) * (12 - i);
   
   remainder = (sum * 10) % 11;

   if ((remainder === 10) || (remainder === 11)) remainder = 0;
   if (remainder !== parseInt(clean.substring(10, 11))) return false;

   return true;
}

function formatCpfOrPhone(value: string) {
   const digits = value.replace(/\D/g, '');
   if (digits.length > 11) {
       // CNPJ ou erro, mas vamos assumir CPF formatado
       return formatCpf(digits);
   }
   // Tenta inferir se é CPF ou Telefone pelo contexto ou deixa o usuário escolher
   // Para simplificar a UX, se tiver 11 digitos, formatamos como CPF se começar com 0, 1, 2... 
   // Mas telefones também têm 11. 
   // Vamos formatar como telefone por padrão se <= 11, a menos que o usuário explicitamente selecione CPF.
   // Melhor: Vamos formatar apenas como números se for ambíguo, ou usar duas máscaras.
   // Vou usar uma lógica simples: Se < 11 -> Telefone parcial. Se 11 -> Telefone.
   // O usuário terá um seletor "Buscar por: [Telefone] [CPF]" no modal.
   return formatPhone(value);
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

function CustomerSelectionModal({ 
   isOpen, 
   onClose, 
   customers, 
   onSelect 
}: { 
   isOpen: boolean; 
   onClose: () => void; 
   customers: any[]; 
   onSelect: (customer: any) => void; 
}) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
         <div className="bg-white w-full max-w-md rounded-2xl p-6 m-4 shadow-2xl animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <span className="material-icons-round text-[#6366F1]">people</span>
                  Selecione seu cadastro
               </h3>
               <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <span className="material-icons-round text-slate-500">close</span>
               </button>
            </div>
            
            <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-sm mb-4 flex gap-2">
               <span className="material-icons-round text-base mt-0.5">info</span>
               <p>Encontramos múltiplos cadastros com este telefone. Por favor, identifique qual é o seu.</p>
            </div>
            
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
               {customers.map((c) => (
                  <button
                     key={c.id}
                     onClick={() => onSelect(c)}
                     className="w-full text-left p-4 rounded-xl border border-slate-200 hover:border-[#6366F1] hover:bg-slate-50 transition-all group relative overflow-hidden"
                  >
                     <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold group-hover:bg-[#6366F1] group-hover:text-white transition-colors">
                           {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div>
                           <div className="font-bold text-slate-800 group-hover:text-[#6366F1] transition-colors">{c.name}</div>
                           <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                                 CPF: {c.cpf ? `***.${c.cpf.substr(4, 3)}.${c.cpf.substr(8, 3)}-**` : 'Não informado'}
                              </span>
                           </div>
                        </div>
                        <div className="ml-auto">
                           <span className="material-icons-round text-slate-300 group-hover:text-[#6366F1] transition-colors">chevron_right</span>
                        </div>
                     </div>
                  </button>
               ))}
            </div>
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
   const [showPhoneModal, setShowPhoneModal] = useState(false);

   // Debug para monitorar mudanças no estado do modal
   useEffect(() => {
      console.log('Estado do showPhoneModal mudou para:', showPhoneModal);
   }, [showPhoneModal]);
   const [consultPhone, setConsultPhone] = useState('');
   const [consultCustomer, setConsultCustomer] = useState<any>(null);
   const [consultCustomers, setConsultCustomers] = useState<any[]>([]); // Lista para seleção
   const [showConsultSelectionModal, setShowConsultSelectionModal] = useState(false); // Controle do modal de seleção
   const [consultHistory, setConsultHistory] = useState<any[]>([]);
   const [loadingHistory, setLoadingHistory] = useState(false);
   const [proofFile, setProofFile] = useState<File | null>(null);
   const [proofPreview, setProofPreview] = useState<string | null>(null);
   const [currentPurchaseId, setCurrentPurchaseId] = useState<string | null>(null);
   const [uploading, setUploading] = useState(false);
   const [ticketsStatus, setTicketsStatus] = useState<Record<number, { status: string; expiresAt: Date }>>({});
   const [fetchingTickets, setFetchingTickets] = useState(true);
   const [socialNetworks, setSocialNetworks] = useState<any>(null);
   const [organizerPhone, setOrganizerPhone] = useState('');
   const [purchaseCreatedAt, setPurchaseCreatedAt] = useState<Date | null>(null);

   // ─── Uniqueness Validation State ─────────────────────────────
   const [isCheckingUniqueness, setIsCheckingUniqueness] = useState(false);
   const [uniquenessErrors, setUniquenessErrors] = useState<{phone?: string, cpf?: string}>({});

   // ─── Edit State ──────────────────────────────────────────────
   const [isEditing, setIsEditing] = useState(false);
   const [hasChanges, setHasChanges] = useState(false);
   const [isUpdating, setIsUpdating] = useState(false);
   const [originalData, setOriginalData] = useState<{phone: string, email: string}>({ phone: '', email: '' });

   useEffect(() => {
      if (step !== 2) {
         setUniquenessErrors({});
         return;
      }

      const check = async () => {
         setIsCheckingUniqueness(true);
         const errors: {phone?: string, cpf?: string} = {};
         
         const cleanPhone = phone.replace(/\D/g, '');
         const cleanCpf = cpf.replace(/\D/g, '');
         
         try {
            // Check Phone Uniqueness
            /* REMOVIDO PARA PERMITIR DUPLICIDADE DE TELEFONE
            if (cleanPhone.length >= 10) {
               if (existingCustomer && cleanPhone === existingCustomer.phone) {
                   // OK
               } else {
                   let query = supabase.from('customers').select('id').eq('phone', cleanPhone);
                   if (existingCustomer) query = query.neq('id', existingCustomer.id);
                   const { data } = await query.limit(1).maybeSingle();
                   if (data) errors.phone = 'Telefone já cadastrado em outra conta.';
               }
            }
            */
            
            // Check CPF Uniqueness
            if (cleanCpf.length === 11) {
               const formattedCpf = formatCpf(cleanCpf);
               
               if (existingCustomer && (cleanCpf === existingCustomer.cpf || formattedCpf === existingCustomer.cpf)) {
                   // OK
               } else {
                   // Busca sequencial para garantir que o .or() não falhe
                   let found = false;
                   
                   // 1. Tenta Formatado
                   let query1 = supabase.from('customers').select('id').eq('cpf', formattedCpf);
                   if (existingCustomer) query1 = query1.neq('id', existingCustomer.id);
                   const { data: d1 } = await query1.limit(1).maybeSingle();
                   
                   if (d1) {
                       found = true;
                   } else {
                       // 2. Tenta Limpo
                       let query2 = supabase.from('customers').select('id').eq('cpf', cleanCpf);
                       if (existingCustomer) query2 = query2.neq('id', existingCustomer.id);
                       const { data: d2 } = await query2.limit(1).maybeSingle();
                       if (d2) found = true;
                   }
                   
                   if (found) errors.cpf = 'CPF já cadastrado em outra conta.';
               }
            }
         } catch (e) {
            console.error(e);
         } finally {
            setUniquenessErrors(errors);
            setIsCheckingUniqueness(false);
         }
      };

      const timer = setTimeout(check, 800);
      return () => clearTimeout(timer);
   }, [step, phone, cpf, existingCustomer]);

   // Monitorar mudanças nos campos editáveis para clientes existentes
   useEffect(() => {
      if (!existingCustomer) {
         setHasChanges(false);
         setIsEditing(false);
         return;
      }
      
      const phoneChanged = phone !== originalData.phone;
      const emailChanged = email !== originalData.email;
      
      setHasChanges(phoneChanged || emailChanged);
   }, [phone, email, existingCustomer, originalData]);

   // Atualizar dados originais quando cliente é carregado
   useEffect(() => {
      if (existingCustomer) {
         setOriginalData({
            phone: formatPhone(existingCustomer.phone),
            email: existingCustomer.email || ''
         });
      }
   }, [existingCustomer]);

   // ─── Celebration State ─────────────────────────────────────
   const [winners, setWinners] = useState<any[]>([]);
   const [isCelebration, setIsCelebration] = useState(false);
   const [claimModalOpen, setClaimModalOpen] = useState(false);
   const [claimWinnerData, setClaimWinnerData] = useState<any>(null);
   const [claimPhoneInput, setClaimPhoneInput] = useState('');

   const phoneRef = useRef<HTMLInputElement>(null);
   const fileInputRef = useRef<HTMLInputElement>(null);

   // Hook para confetti quando step === 6
   useEffect(() => {
      if (step === 6) {
         console.log('[DEBUG] Step 6 useEffect executado, iniciando confetti');
         const duration = 3000;
         const end = Date.now() + duration;

         (function frame() {
            confetti({
               particleCount: 4,
               angle: 60,
               spread: 55,
               origin: { x: 0 },
               colors: ['#22c55e', '#10b981', '#ffffff']
            });
            confetti({
               particleCount: 4,
               angle: 120,
               spread: 55,
               origin: { x: 1 },
               colors: ['#22c55e', '#10b981', '#ffffff']
            });

            if (Date.now() < end) {
               requestAnimationFrame(frame);
            }
         }());
      }
   }, [step]); // Executa sempre que step mudar

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
   const [checkStatusText, setCheckStatusText] = useState('Verificando manualmente...');

   // Polling automático a cada 30 segundos
   useEffect(() => {
      console.log('[DEBUG] Polling useEffect executado. Step:', step, 'currentPurchaseId:', currentPurchaseId);
      
      if (step !== 7 || !currentPurchaseId) {
         console.log('[DEBUG] Polling não ativado. Condições não atendidas.');
         return;
      }

      console.log('[DEBUG] Polling ativado! Iniciando intervalo...');

      const checkStatus = async () => {
         console.log('[DEBUG] Polling: Verificando status...');
         setCheckStatusText('Verificando status...');
         await fetchPurchaseDetails(currentPurchaseId);
         setTimeout(() => setCheckStatusText('Verificando manualmente...'), 2000);
      };

      const intervalId = setInterval(checkStatus, 30000); // 30 segundos
      console.log('[DEBUG] Intervalo configurado com ID:', intervalId);

      return () => {
         console.log('[DEBUG] Limpando intervalo:', intervalId);
         clearInterval(intervalId);
      };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [step, currentPurchaseId]);

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
      console.log('[DEBUG] fetchPurchaseDetails iniciado com ID:', pid);
      try {
         const { data: purchase, error } = await supabase
            .from('purchase_history')
            .select('*, customers(*)')
            .eq('id', pid)
            .maybeSingle();

         console.log('[DEBUG] Supabase resposta:', { data: purchase, error });

         if (error || !purchase) {
            console.error('[DEBUG] Erro ao buscar detalhes da compra:', error);
            return;
         }

         console.log('[DEBUG] Compra encontrada:', {
            id: purchase.id,
            status: purchase.status,
            payment_info: purchase.payment_info,
            proof_url: purchase.proof_url
         });

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

         console.log('[DEBUG] Status da compra:', purchase.status);
         console.log('[DEBUG] Active method:', activeMethod);

         if (purchase.status === 'cancelled') {
            console.log('[DEBUG] Status é cancelled, mudando para Step 5');
            setTimeout(() => {
               console.log('[DEBUG] Executando setStep(5)');
               setStep(5);
            }, 100);
         } else if (purchase.status === 'approved') {
            console.log('[DEBUG] Status é approved, mudando para Step 6');
            setTimeout(() => {
               console.log('[DEBUG] Executando setStep(6)');
               setStep(6);
            }, 100);
         } else if (purchase.status === 'pending') {
            console.log('[DEBUG] Status é pending, verificando método de pagamento');
            if (activeMethod === 'n8n' && purchase.payment_info) {
                console.log('[DEBUG] Método N8N com payment_info, mudando para Step 7');
                setTimeout(() => {
                   console.log('[DEBUG] Executando setStep(7)');
                   setStep(7); // N8N Payment
                }, 100);
            } else if (purchase.proof_url) {
               console.log('[DEBUG] Tem proof_url, mudando para Step 4');
               setTimeout(() => {
                  console.log('[DEBUG] Executando setStep(4)');
                  setStep(4); // Comprovante enviado
               }, 100);
            } else {
               console.log('[DEBUG] Método manual, mudando para Step 3');
               setTimeout(() => {
                  console.log('[DEBUG] Executando setStep(3)');
                  setStep(3); // Aguardando pagamento/upload (Manual)
               }, 100);
            }
         } else {
            console.log('[DEBUG] Status desconhecido:', purchase.status);
         }
      } catch (err) {
         console.error('[DEBUG] Erro ao processar compra da URL:', err);
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
      const clean = v.replace(/\D/g, '');
      if (clean.length <= 11) {
          setPhone(formatPhone(v));
      } else {
          setPhone(formatCpf(v));
      }
   };
   
   const handleCpfChange = (v: string) => {
       const formatted = formatCpf(v);
       setCpf(formatted);
   };

   const handlePhoneBlur = async () => {
      const cleanVal = phone.replace(/\D/g, '');
      if (cleanVal.length < 10) return; 
      
      setLookingUp(true);
      try {
         const formattedCpf = formatCpf(cleanVal);
         let customer = null;

         // 1. Busca por Telefone (prioridade)
         const { data: phoneRes } = await supabase
            .from('customers')
            .select('*')
            .eq('phone', cleanVal)
            .limit(1)
            .maybeSingle();
            
         if (phoneRes) {
             customer = phoneRes;
         } else if (cleanVal.length === 11) {
             // 2. Busca por CPF (se não achou por telefone e tem 11 dígitos)
             // Tenta formatado
             const { data: cpfResFmt } = await supabase
                .from('customers')
                .select('*')
                .eq('cpf', formattedCpf)
                .limit(1)
                .maybeSingle();
                
             if (cpfResFmt) {
                 customer = cpfResFmt;
             } else {
                 // Tenta limpo
                 const { data: cpfResClean } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('cpf', cleanVal)
                    .limit(1)
                    .maybeSingle();
                 customer = cpfResClean;
             }
         } else {
         }
            
         if (customer) {
            setExistingCustomer(customer);
            setName(customer.name);
            setEmail(customer.email || '');
            if (customer.cpf) setCpf(customer.cpf);
            
            // Se achou por CPF, garantir que o telefone no input seja o do cliente
            if (cleanVal !== customer.phone && customer.phone) {
                setPhone(formatPhone(customer.phone));
            }

            // 1. Check for PENDING purchase first (Blocker)
            const { data: pendingPurchase } = await supabase
               .from('purchase_history')
               .select('*, customers(*)')
               .eq('customer_id', customer.id)
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
               return; 
            }
         } else {
            setExistingCustomer(null);
            // Se não achou, pré-configura os campos para novo cadastro
            // Só copia para CPF se parecer CPF (pontos) e não parecer telefone (parênteses)
            const hasDots = phone.includes('.');
            const hasParenthesis = phone.includes('(');
            
            if ((validateCpf(phone) || hasDots) && !hasParenthesis) {
                setCpf(phone);
            }
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

   const handleConsultPhoneChange = (v: string) => {
      // O modal controla a formatação baseada na aba ativa
      setConsultPhone(v);
   };

   const loadCustomerHistory = async (customer: any) => {
         setConsultCustomer(customer);
         console.log('Cliente selecionado:', customer);
         setLoadingHistory(true);
         
         try {
             // Buscar histórico de compras da campanha vigente
             const { data: history, error: historyError } = await supabase
                .from('purchase_history')
                .select('*')
                .eq('customer_id', customer.id)
                .eq('campaign_id', campaign.id)
                .order('created_at', { ascending: false });
             
             console.log('Histórico encontrado:', history, 'Erro:', historyError);
             setConsultHistory(history || []);
         } catch (error) {
             console.error('Erro ao carregar histórico:', error);
         } finally {
             setLoadingHistory(false);
             setShowConsultSelectionModal(false);
         }
   };

   const handleConsultPhoneBlur = async () => {
      const cleanVal = consultPhone.replace(/\D/g, '');
      if (cleanVal.length < 11) return; // Mínimo aceitável
      
      console.log('Iniciando consulta para:', cleanVal);
      setLoadingHistory(true);
      setConsultCustomer(null);
      setConsultHistory([]);
      
      try {
         const formattedCpf = formatCpf(cleanVal);
         
         const { data: customers, error: searchError } = await supabase
            .from('customers')
            .select('*')
            .or(`phone.eq.${cleanVal},cpf.eq.${formattedCpf},cpf.eq.${cleanVal}`); // Tenta todas as variações
         
         console.log('Resultado da busca:', customers, 'Erro:', searchError);
         
         if (!customers || customers.length === 0) {
            // Cliente não encontrado - O modal vai mostrar o botão de cadastro
            setConsultCustomer(null);
            setConsultHistory([]);
            setLoadingHistory(false);
            return;
         }
         
         // Se encontrou mais de um cliente (mesmo telefone), abre modal de seleção
         if (customers.length > 1) {
             setConsultCustomers(customers);
             setShowConsultSelectionModal(true);
             setLoadingHistory(false);
             return;
         }
         
         // Se encontrou apenas 1, carrega direto
         const customerFound = customers[0];
         await loadCustomerHistory(customerFound);
         
      } catch (error) {
         console.error('Erro ao consultar histórico:', error);
         alert('Erro ao consultar histórico. Tente novamente.');
      } finally {
         setLoadingHistory(false);
      }
   };

   const handleFinalizePendingPurchase = async (purchaseId: string) => {
      try {
         const { data: purchase } = await supabase
            .from('purchase_history')
            .select('*')
            .eq('id', purchaseId)
            .maybeSingle();
         
         if (!purchase) {
            alert('Compra não encontrada.');
            return;
         }
         
         // Redirecionar para o pagamento da compra pendente
         setCurrentPurchaseId(purchase.id);
         if (purchase.created_at) setPurchaseCreatedAt(new Date(purchase.created_at));
         setSelectedTickets(purchase.tickets || []);
         
         if (purchase.payment_info) {
            setPaymentData(purchase.payment_info);
         }
         
         // Fechar modais
         setShowPhoneModal(false);
         setConsultPhone('');
         setConsultCustomer(null);
         setConsultHistory([]);
         
         // Ir para a tela de pagamento apropriada
         if (activeMethod === 'n8n' && purchase.payment_info) {
            setStep(7);
         } else if (purchase.proof_url) {
            setStep(4);
         } else {
            setStep(3);
         }
         
      } catch (error) {
         console.error('Erro ao finalizar compra pendente:', error);
         alert('Erro ao processar compra. Tente novamente.');
      }
   };

   const handleUpdateCustomer = async () => {
      if (!existingCustomer || !hasChanges) return;
      
      setIsUpdating(true);
      try {
         const cleanPhone = phone.replace(/\D/g, '');
         
         // Validar unicidade do telefone antes de atualizar
         /* REMOVIDO PARA PERMITIR DUPLICIDADE DE TELEFONE
         if (cleanPhone !== existingCustomer.phone) {
            const { data: phoneCheck } = await supabase
               .from('customers')
               .select('id')
               .eq('phone', cleanPhone)
               .neq('id', existingCustomer.id)
               .maybeSingle();
               
            if (phoneCheck) {
               alert('Este telefone já está cadastrado em outra conta.');
               setIsUpdating(false);
               return;
            }
         }
         */
         
         // Atualizar no banco
         const { error } = await supabase
            .from('customers')
            .update({ 
               phone: cleanPhone,
               email: email.trim() || null
            })
            .eq('id', existingCustomer.id);
            
         if (error) throw error;
         
         // Atualizar cliente local e dados originais
         const updatedCustomer = {
            ...existingCustomer,
            phone: cleanPhone,
            email: email.trim() || null
         };
         
         setExistingCustomer(updatedCustomer);
         setOriginalData({
            phone: formatPhone(cleanPhone),
            email: email.trim() || null
         });
         
         setIsEditing(false);
         setHasChanges(false);
         
         alert('Dados atualizados com sucesso!');
         
      } catch (error) {
         console.error('Erro ao atualizar cliente:', error);
         alert('Erro ao atualizar dados. Tente novamente.');
      } finally {
         setIsUpdating(false);
      }
   };

   const handleStep1Continue = () => {
      // Se já temos um cliente identificado, usamos os dados dele
      if (existingCustomer) {
         setPhone(formatPhone(existingCustomer.phone));
         setCpf(existingCustomer.cpf ? formatCpf(existingCustomer.cpf) : '');
         setName(existingCustomer.name || '');
         setEmail(existingCustomer.email || '');
         setErrors({});
         setStep(2);
         return;
      }

      const clean = phone.replace(/\D/g, '');
      const hasDots = phone.includes('.');
      const hasParenthesis = phone.includes('(') || phone.includes(')');
      
      let isCpf = false;
      
      if (hasDots) {
          isCpf = true;
      } else if (hasParenthesis) {
          isCpf = false;
      } else {
          // Apenas números ou hifens
          if (validateCpf(phone)) {
              isCpf = true;
          } else {
              // Heurística para desempate
              const ddd = parseInt(clean.substring(0, 2));
              const third = clean[2];
              if (ddd >= 11 && ddd <= 99 && third === '9') {
                  isCpf = false;
              } else {
                  isCpf = true; // Assume CPF por padrão se não parecer telefone
              }
          }
      }

      if (isCpf) {
          if (!validateCpf(phone)) {
              setErrors({ phone: 'CPF inválido. Verifique os dígitos.' });
              return;
          }
          setCpf(phone);
          setPhone(''); 
          setErrors({});
          setStep(2);
          return;
      } else {
          // Telefone
          if (clean.length < 10 || clean.length > 11) {
             setErrors({ phone: 'Telefone inválido.' });
             return;
          }
          setCpf('');
          setErrors({});
          setStep(2);
          return;
      }
   };

   const validateStep2 = () => {
      const e: Record<string, string> = {};
      if (!name.trim()) e.name = 'Nome é obrigatório.';
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
         e.email = 'Formato de e-mail inválido.';
      if (activeMethod === 'n8n' && !validateCpf(cpf))
         e.cpf = 'CPF inválido.';
      if (!isPhoneComplete(phone)) e.phone = 'Telefone obrigatório.';
      if (!termsAccepted) e.terms = 'Você deve aceitar os termos.';
      return e;
   };

   const handleFinalize = async () => {
      const e = validateStep2();
      if (Object.keys(e).length > 0) { setErrors(e); return; }

      const cleanPhone = phone.replace(/\D/g, '');
      const cleanCpf = cpf.replace(/\D/g, '');
      const formattedCpf = cleanCpf ? formatCpf(cleanCpf) : null;

      // Validação de duplicidade e atualização
      if (!existingCustomer) {
         // Novo cliente: verificar apenas CPF duplicado (telefone pode repetir)
         
         if (cleanCpf) {
             const { data: cpfCheck } = await supabase.from('customers').select('id').or(`cpf.eq.${formattedCpf},cpf.eq.${cleanCpf}`).limit(1).maybeSingle();
             if (cpfCheck) { setErrors({ cpf: 'Este CPF já está vinculado a outra conta.' }); return; }
         }
      } else {
         // Cliente existente: verificar se mudou o CPF para um já existente
         if (cleanCpf && cleanCpf !== existingCustomer.cpf) {
             const { data: cpfCheck } = await supabase.from('customers').select('id').or(`cpf.eq.${formattedCpf},cpf.eq.${cleanCpf}`).neq('id', existingCustomer.id).limit(1).maybeSingle();
             if (cpfCheck) { setErrors({ cpf: 'Este CPF já está vinculado a outra conta.' }); return; }
         }
      }

      setErrors({});
      setSubmitting(true);
      setIsGeneratingPix(true);
      
      try {
         let customer;
         const rawPhone = cleanPhone;

         // Verificar se devemos criar novo ou atualizar
         // Se existingCustomer existe, mas o CPF foi alterado para um NOVO, então é um NOVO cadastro
         let shouldCreateNew = !existingCustomer;
         if (existingCustomer) {
             const currentCpfClean = existingCustomer.cpf ? existingCustomer.cpf.replace(/\D/g, '') : '';
             // Se tinha CPF e agora mudou para outro (que não é vazio), então é novo cliente
             if (currentCpfClean && cleanCpf && cleanCpf !== currentCpfClean) {
                 shouldCreateNew = true;
             }
         }

         if (!shouldCreateNew) {
             // Atualizar cliente existente
             const { data, error } = await supabase
                .from('customers')
                .update({ 
                    name: name.trim(), 
                    email: email.trim() || null,
                    phone: rawPhone
                })
                .eq('id', existingCustomer.id)
                .select()
                .single();
                
             if (error) throw error;
             customer = data;
         } else {
             // Criar novo cliente
             const { data, error } = await supabase
                .from('customers')
                .insert({ 
                    phone: rawPhone, 
                    name: name.trim(), 
                    email: email.trim() || null,
                    cpf: formattedCpf || null
                })
                .select()
                .single();
                
             if (error) throw error;
             customer = data;
         }
            
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
            <button 
               onClick={() => {
                  console.log('Botão Consultar clicado');
                  setShowPhoneModal(true);
               }}
               className="bg-[#6366F1] hover:bg-[#5558dd] text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 relative shadow-lg shadow-indigo-500/30 transition-all active:scale-[0.98] animate-pulse"
            >
               <span className="material-icons-outlined text-white text-lg">search</span>
               <span className="font-bold text-sm">Consultar</span>
               {selectedTickets.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-white animate-none">
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

   console.log('[DEBUG] VIEW ROUTING - Step atual:', step, 'isCelebration:', isCelebration);

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

            {/* Phone Consultation Modal */}
            <PhoneConsultModal
               isOpen={showPhoneModal}
               onClose={() => {
                  setShowPhoneModal(false);
                  setConsultPhone('');
                  setConsultCustomer(null);
                  setConsultHistory([]);
               }}
               phone={consultPhone}
               onPhoneChange={handleConsultPhoneChange}
               onPhoneBlur={handleConsultPhoneBlur}
               customer={consultCustomer}
               history={consultHistory}
               loading={loadingHistory}
               onFinalizePurchase={handleFinalizePendingPurchase}
            />

            {/* Modal de Seleção de Cliente (Múltiplos Encontrados) */}
            <CustomerSelectionModal 
               isOpen={showConsultSelectionModal}
               onClose={() => setShowConsultSelectionModal(false)}
               customers={consultCustomers}
               onSelect={loadCustomerHistory}
            />

            {/* History Modal for existing customer */}
            {showHistory && (
               <HistoryModal
                  isOpen={showHistory}
                  onClose={() => setShowHistory(false)}
                  history={customerHistory}
               />
            )}

            {/* Terms Modal */}
            {showTermsModal && (
               <TermsModal 
                  description={campaign.description} 
                  onClose={() => setShowTermsModal(false)} 
               />
            )}
            
            {/* Claim Prize Modal */}
            {claimModalOpen && (
               <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                  <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl">
                     <h3 className="font-bold text-slate-900 mb-4">Resgatar Prêmio</h3>
                     <p className="text-sm text-slate-600 mb-4">
                        Confirme seu telefone para resgatar o prêmio: <strong>{claimWinnerData?.prize}</strong>
                     </p>
                     <input
                        type="tel"
                        placeholder="Seu telefone"
                        value={claimPhoneInput}
                        onChange={(e) => setClaimPhoneInput(e.target.value)}
                        className="w-full border rounded-xl px-4 py-3 text-slate-800 mb-4 focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none"
                     />
                     <div className="flex gap-3">
                        <button
                           onClick={() => setClaimModalOpen(false)}
                           className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-colors"
                        >
                           Cancelar
                        </button>
                        <button
                           onClick={handleConfirmClaim}
                           className="flex-1 bg-[#6366F1] hover:bg-[#5558dd] text-white font-bold py-3 rounded-xl transition-colors"
                        >
                           Confirmar
                        </button>
                     </div>
                  </div>
               </div>
            )}
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
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">CPF ou Telefone</label>
                     <input
                        ref={phoneRef}
                        type="tel"
                        inputMode="numeric"
                        placeholder="Informe seu CPF ou Telefone"
                        value={phone}
                        onChange={(e) => {
                           const v = e.target.value;
                           const d = v.replace(/\D/g, '');
                           
                           if (d.length <= 10) {
                              setPhone(formatPhone(d));
                           } else {
                              const ddd = parseInt(d.substring(0, 2));
                              const third = d[2];
                              if (ddd >= 11 && ddd <= 99 && third === '9') {
                                 setPhone(formatPhone(d));
                              } else {
                                 setPhone(formatCpf(d));
                              }
                           }
                        }}
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
                  {/* Phone */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu telefone {activeMethod === 'n8n' && <span className="text-red-500">*</span>}</label>
                     <input
                        type="tel"
                        placeholder="(99) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 ${errors.phone || uniquenessErrors.phone ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
                     />
                     {errors.phone && !isPhoneComplete(phone) && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                     {uniquenessErrors.phone && <p className="text-xs text-red-500 mt-1 font-bold">{uniquenessErrors.phone}</p>}
                  </div>
                  
                  {/* Name */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu nome</label>
                     <input
                        type="text"
                        placeholder="digite seu nome"
                        value={name}
                        onChange={(e) => setName(e.target.value.toUpperCase())}
                        disabled={!!existingCustomer}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base uppercase focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 placeholder:normal-case ${errors.name ? 'border-red-400 bg-red-50' : 'border-slate-200'} ${existingCustomer ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                     />
                     {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  {/* CPF Field */}
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Seu CPF {activeMethod === 'n8n' && <span className="text-red-500">*</span>}</label>
                     <input
                        type="tel"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        disabled={!!existingCustomer}
                        className={`w-full border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 ${errors.cpf || uniquenessErrors.cpf ? 'border-red-400 bg-red-50' : 'border-slate-200'} ${existingCustomer ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                     />
                     {errors.cpf && <p className="text-xs text-red-500 mt-1">{errors.cpf}</p>}
                     {uniquenessErrors.cpf && <p className="text-xs text-red-500 mt-1 font-bold">{uniquenessErrors.cpf}</p>}
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

                  {/* Botões de ação */}
                  {existingCustomer && hasChanges ? (
                     <button
                        onClick={handleUpdateCustomer}
                        disabled={isUpdating || isCheckingUniqueness || Object.keys(uniquenessErrors).length > 0}
                        className="w-full bg-[#10B981] hover:bg-[#059669] disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                     >
                        {isUpdating ? (
                           <>
                              <span className="material-icons-round animate-spin text-sm">sync</span>
                              Atualizando...
                           </>
                        ) : (
                           <>
                              <span className="material-icons-round text-sm">update</span>
                              Atualizar
                           </>
                        )}
                     </button>
                  ) : (
                     <button
                        onClick={handleFinalize}
                        disabled={submitting || isGeneratingPix || isCheckingUniqueness || Object.keys(uniquenessErrors).length > 0 || (existingCustomer && hasChanges)}
                        className="w-full bg-[#6366F1] hover:bg-[#5558dd] disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
                     >
                        {isCheckingUniqueness ? (
                           <>
                              <span className="material-icons-round animate-spin text-sm">sync</span>
                              Verificando dados...
                           </>
                        ) : isGeneratingPix ? (
                           <>
                              <span className="material-icons-round animate-spin text-sm">sync</span>
                              Gerando Pix...
                           </>
                        ) : (activeMethod === 'n8n' ? 'Gerar Pix' : 'Finalizar compra')}
                     </button>
                  )}
                  <button
                     onClick={() => setStep(0)}
                     disabled={submitting || isGeneratingPix || isUpdating}
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
      console.log('[DEBUG] Step 7 renderizado - Aguardando Pagamento');
      
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
      console.log('[DEBUG] Step 6 renderizado! Confetti será exibido.');
      
      return (
         <div className="bg-[#0f172a] min-h-screen font-sans flex flex-col items-center justify-center p-4 relative">
            <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl relative z-10">
               {/* Header Verde */}
               <div className="bg-emerald-500 p-8 text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                  <div className="w-20 h-20 bg-white rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg animate-bounce">
                     <span className="material-icons-round text-emerald-500 text-5xl">check</span>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-1">Pagamento Aprovado!</h2>
                  <p className="text-emerald-100 text-sm font-medium">Sua participação está confirmada</p>
               </div>
               
               {/* Detalhes do Pedido */}
               <div className="p-6 space-y-6">
                  <div className="text-center">
                     <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">PARTICIPANTE</p>
                     <p className="text-slate-800 font-bold text-lg">{name}</p>
                  </div>
                  
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                     <div>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">DATA</p>
                        <p className="text-slate-700 font-medium">{new Date().toLocaleDateString('pt-BR')}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">VALOR TOTAL</p>
                        <p className="text-emerald-600 font-black text-xl">R$ {totalValue}</p>
                     </div>
                  </div>
                  
                  <div>
                     <div className="flex justify-between items-end mb-3">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">COTAS ADQUIRIDAS ({selectedTickets.length})</p>
                     </div>
                     <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                        {selectedTickets.map(ticket => (
                           <span key={ticket} className="bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-lg text-sm border border-slate-200">
                              {String(ticket).padStart(2, '0')}
                           </span>
                        ))}
                     </div>
                  </div>
                  
                  <button 
                     onClick={() => window.location.reload()}
                     className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2"
                  >
                     <span className="material-icons-round">shopping_bag</span>
                     Comprar mais cotas
                  </button>
               </div>
            </div>
            
            <p className="text-slate-500 text-xs mt-6 text-center max-w-xs">
               Você receberá o comprovante também no seu e-mail cadastrado. Boa sorte!
            </p>
         </div>
      );
   }

   return null;
}

function PhoneConsultModal({ 
   isOpen, 
   onClose, 
   phone, 
   onPhoneChange, 
   onPhoneBlur, 
   customer, 
   history, 
   loading,
   onFinalizePurchase
}: { 
   isOpen: boolean; 
   onClose: () => void; 
   phone: string; 
   onPhoneChange: (v: string) => void; 
   onPhoneBlur: () => void; 
   customer: any; 
   history: any[]; 
   loading: boolean;
   onFinalizePurchase: (purchaseId: string) => void;
}) {
   const [viewMode, setViewMode] = useState<'search' | 'register'>('search');
   
   // Registration State
   const [regName, setRegName] = useState('');
   const [regPhone, setRegPhone] = useState('');
   const [regCpf, setRegCpf] = useState('');
   const [regLoading, setRegLoading] = useState(false);

   // Reset state on open
   useEffect(() => {
      if (isOpen) {
         setViewMode('search');
         setRegName('');
         setRegPhone('');
         setRegCpf('');
      }
   }, [isOpen]);

   const handleRegister = async () => {
      if (!regName.trim() || !isPhoneComplete(regPhone) || !validateCpf(regCpf)) {
         alert('Preencha todos os dados corretamente.');
         return;
      }
      
      setRegLoading(true);
      try {
         const cleanPhone = regPhone.replace(/\D/g, '');
         const cleanCpf = regCpf.replace(/\D/g, '');
         
         /* REMOVIDO PARA PERMITIR DUPLICIDADE DE TELEFONE
         // Verificar se telefone já existe
         const { data: phoneCheck } = await supabase
            .from('customers')
            .select('id')
            .eq('phone', cleanPhone)
            .maybeSingle();
            
         if (phoneCheck) {
            alert('Este telefone já possui cadastro.');
            setRegLoading(false);
            return;
         }
         */
         
         // Verificar CPF
         const { data: cpfCheck } = await supabase
            .from('customers')
            .select('id')
            .eq('cpf', cleanCpf)
            .maybeSingle();
            
         if (cpfCheck) {
            alert('Este CPF já está vinculado a outra conta.');
            setRegLoading(false);
            return;
         }
         
         const { data, error } = await supabase
            .from('customers')
            .insert({
               name: regName.toUpperCase(),
               phone: cleanPhone,
               cpf: cleanCpf
            })
            .select()
            .single();
            
         if (error) throw error;
         
         alert('Cadastro realizado com sucesso!');
         
         // Simulate search with new data
         onPhoneChange(cleanPhone); // Update main phone state to trigger search logic if needed
         // However, main component handles search logic via onPhoneBlur or similar.
         // Let's force a "found" state by calling onPhoneChange then onPhoneBlur?
         // Better: Just reset view and let user search, or auto-search.
         
         setViewMode('search');
         onPhoneChange(formatPhone(cleanPhone));
         // We need to trigger the search in parent. The parent uses onPhoneBlur.
         // Let's manually trigger it or ask user to click search.
         
      } catch (err) {
         console.error('Erro no cadastro:', err);
         alert('Erro ao cadastrar. Verifique se o telefone já existe.');
      } finally {
         setRegLoading(false);
      }
   };

   if (!isOpen) return null;
   
   return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
         <div 
            className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
         >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
               <h3 className="font-bold text-slate-800">
                  {viewMode === 'search' ? 'Consultar Compras' : 'Cadastrar Cliente'}
               </h3>
               <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition-colors">
                  <span className="material-icons-round text-slate-500">close</span>
               </button>
            </div>
            
            {viewMode === 'search' ? (
               <>
                  <div className="p-4 border-b border-slate-100 space-y-3">
                     <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">
                           Informe seu Telefone ou CPF
                        </label>
                        <div className="flex gap-2">
                           <input
                              type="tel"
                              inputMode="numeric"
                              placeholder="(99) 99999-9999 ou CPF"
                              value={phone}
                              onChange={(e) => {
                                 const v = e.target.value;
                                 const clean = v.replace(/\D/g, '');
                                 
                                 // Smart formatting
                                 if (v.includes('.') && !v.includes('(')) {
                                    onPhoneChange(formatCpf(v));
                                 } else if (clean.length === 11 && validateCpf(clean)) {
                                    onPhoneChange(formatCpf(v));
                                 } else {
                                    onPhoneChange(formatPhone(v));
                                 }
                              }}
                              className="flex-1 border rounded-xl px-4 py-3 text-slate-800 text-base focus:ring-2 focus:ring-[#6366F1] focus:border-transparent outline-none placeholder-slate-300 border-slate-200"
                           />
                           <button 
                              onClick={onPhoneBlur}
                              disabled={loading}
                              className="bg-[#6366F1] text-white px-4 rounded-xl font-bold hover:bg-[#5558dd] transition-colors disabled:opacity-50"
                           >
                              <span className="material-icons-round">search</span>
                           </button>
                        </div>
                     </div>
                  </div>
                  
                  <div className="overflow-y-auto p-4 space-y-3 flex-1">
                     {loading && (
                        <div className="text-center py-8">
                           <div className="w-6 h-6 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                           <p className="text-slate-500 text-sm">Consultando...</p>
                        </div>
                     )}
                     
                     {!loading && !customer && phone.length > 5 && (
                        <div className="text-center py-8">
                           <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                              <span className="material-icons-round text-slate-300 text-3xl">person_off</span>
                           </div>
                           <p className="text-slate-800 font-bold mb-1">Cliente não encontrado</p>
                           <p className="text-slate-500 text-sm mb-4">Gostaria de realizar o cadastro?</p>
                           <button 
                              onClick={() => {
                                 setViewMode('register');
                                 const clean = phone.replace(/\D/g, '');
                                 if (validateCpf(clean)) {
                                    setRegCpf(formatCpf(clean));
                                    setRegPhone('');
                                 } else {
                                    setRegPhone(formatPhone(clean));
                                    setRegCpf('');
                                 }
                              }}
                              className="bg-[#6366F1] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#5558dd] transition-colors text-sm shadow-lg shadow-indigo-500/20"
                           >
                              Cadastrar Agora
                           </button>
                        </div>
                     )}
                     
                     {!loading && customer && history.length === 0 && (
                        <div className="text-center py-8">
                           <span className="material-icons-round text-slate-300 text-4xl mb-2">receipt_long</span>
                           <p className="text-slate-500 text-sm">Nenhuma compra encontrada nesta campanha</p>
                        </div>
                     )}
                     
                     {!loading && customer && history.length > 0 && (
                        <div className="space-y-3">
                           <div className="bg-slate-50 rounded-lg p-3 mb-3 border border-slate-100">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-[#6366F1]/10 rounded-full flex items-center justify-center text-[#6366F1] font-bold">
                                    {customer.name.charAt(0)}
                                 </div>
                                 <div>
                                    <p className="text-sm font-bold text-slate-800">{customer.name}</p>
                                    <p className="text-xs text-slate-500 flex items-center gap-2">
                                       <span>{maskPhone(customer.phone)}</span>
                                       {customer.cpf && <span className="w-1 h-1 bg-slate-300 rounded-full"></span>}
                                       {customer.cpf && <span>CPF: ***.{customer.cpf.slice(4,7)}***-**</span>}
                                    </p>
                                 </div>
                              </div>
                           </div>
                           
                           {history.map((item) => (
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
                                    <div className="text-right">
                                       <p className="font-bold text-slate-700 text-sm">
                                          R$ {item.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                       </p>
                                       {item.status === 'pending' && (
                                          <button
                                             onClick={() => onFinalizePurchase(item.id)}
                                             className="text-xs bg-[#6366F1] text-white px-2 py-1 rounded mt-1 hover:bg-[#5558dd] transition-colors"
                                          >
                                             Finalizar
                                          </button>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               </>
            ) : (
               <div className="p-4 space-y-4">
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Nome completo</label>
                     <input
                        type="text"
                        placeholder="Digite seu nome"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value.toUpperCase())}
                        className="w-full border rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-[#6366F1] outline-none border-slate-200 uppercase"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">Telefone (WhatsApp)</label>
                     <input
                        type="tel"
                        placeholder="(99) 99999-9999"
                        value={regPhone}
                        onChange={(e) => setRegPhone(formatPhone(e.target.value))}
                        className="w-full border rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-[#6366F1] outline-none border-slate-200"
                     />
                  </div>
                  <div>
                     <label className="block text-sm font-bold text-slate-700 mb-1.5">CPF</label>
                     <input
                        type="tel"
                        placeholder="000.000.000-00"
                        value={regCpf}
                        onChange={(e) => setRegCpf(formatCpf(e.target.value))}
                        className="w-full border rounded-xl px-4 py-3 text-slate-800 focus:ring-2 focus:ring-[#6366F1] outline-none border-slate-200"
                     />
                  </div>
                  <div className="flex gap-3 pt-2">
                     <button
                        onClick={() => setViewMode('search')}
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-3 rounded-xl transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        onClick={handleRegister}
                        disabled={regLoading}
                        className="flex-1 bg-[#6366F1] hover:bg-[#5558dd] text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                     >
                        {regLoading && <span className="material-icons-round animate-spin text-sm">sync</span>}
                        Cadastrar
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
