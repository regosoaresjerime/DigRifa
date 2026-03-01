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
function CountdownTimer({ minutes }: { minutes: number }) {
   const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
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

   // ── Checkout state ──────────────────────────────────────────
   const [step, setStep] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0); // 0=Grid, 1=Phone, 2=Details, 3=Payment, 4=ProofSent, 5=Cancelled, 6=Approved
   const [phone, setPhone] = useState('');
   const [name, setName] = useState('');
   const [email, setEmail] = useState('');
   const [termsAccepted, setTermsAccepted] = useState(false);
   const [showTermsModal, setShowTermsModal] = useState(false);
   const [existingCustomer, setExistingCustomer] = useState<any>(null);
   const [lookingUp, setLookingUp] = useState(false);
   const [copied, setCopied] = useState(false);
   const [errors, setErrors] = useState<Record<string, string>>({});
   const [submitting, setSubmitting] = useState(false);
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
      
      // Basic check: match full phone or last 8 digits (to be safe against country code issues)
      if (cleanUser === cleanWinner || (cleanWinner.length > 8 && cleanUser.endsWith(cleanWinner.slice(-8)))) {
          // Prioridade: WhatsApp de Suporte > Telefone do Perfil > Fallback
          const supportPhone = socialNetworks?.whatsappSupport;
          const profilePhone = organizerPhone;
          const fallbackPhone = import.meta.env.VITE_SUPPORT_PHONE || '5511999999999';
          
          // Função para extrair apenas o número de links do WhatsApp ou limpar formatação
          const extractPhone = (val: string) => {
             if (!val) return '';
             // Tenta extrair de wa.me/NUMBER ou phone=NUMBER
             const match = val.match(/(?:wa\.me\/|phone=)(\d+)/);
             if (match) return match[1];
             // Se não for link conhecido, remove não-números (cuidado com urls genéricas)
             if (val.includes('http')) return ''; // Evita extrair números de urls desconhecidas que resultariam em lixo
             return val.replace(/\D/g, '');
          };

          const cleanSupport = extractPhone(supportPhone);
          const cleanProfile = extractPhone(profilePhone);
          
          let targetPhone = cleanSupport || cleanProfile || fallbackPhone;
          
          console.log('[DEBUG] Phone Logic:', {
              rawSupport: supportPhone,
              cleanSupport,
              rawProfile: profilePhone,
              cleanProfile,
              final: targetPhone
          });
          
          // Adiciona DDI 55 se não tiver e parecer um número BR válido (10 ou 11 dígitos)
          if (!targetPhone.startsWith('55') && (targetPhone.length === 10 || targetPhone.length === 11)) {
             targetPhone = '55' + targetPhone;
          }

          const msg = encodeURIComponent(`Olá! Sou o ganhador do prêmio ${claimWinnerData.prize} (Cota ${claimWinnerData.ticket}) na rifa ${campaign.title}. Gostaria de resgatar meu prêmio.`);
          
          // Open WhatsApp
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
      // Only run auto-play on Step 0 (Grid)
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
         // Check if it's the new object format
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
                     isNoWinner: true // Flag for UI
                 });
                 hasWinners = true;
             }
         }
         // Legacy string format
         else {
             const ticketVal = typeof res === 'string' ? res : String(res);
             // Busca quem comprou o ticket na campanha
             const { data } = await supabase
                .from('purchase_history')
                .select('*, customers!inner(*)')
                .eq('campaign_id', campaignId)
                .contains('tickets', [parseInt(ticketVal)]) // ticket é string no JSON, mas int no array
                .maybeSingle();
                
             if (data) {
                winnerData.push({
                   prize: `Prêmio`, // Legacy fallback
                   ticket: ticketVal,
                   name: data.customers.name,
                   phone: data.customers.phone,
                });
                hasWinners = true;
             } else {
                 // Caso não ache (ex: sorteio manual sem venda no sistema), mostra só o número
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
      
      // ONLY show celebration screen if the campaign is explicitly marked as "completed" OR if all prizes are drawn?
      // Requirement: Show draws but don't finalize if not all won.
      // Current Logic: If there are winners, it shows celebration overlay.
      // New Logic: We will render winners INLINE in the main page instead of full screen overlay,
      // UNLESS the campaign status is 'completed'.
      
      // For now, let's keep using isCelebration but we will modify the RENDER to show it as a section
      // instead of blocking the whole page, if the campaign is still active.
      if (hasWinners) {
          setIsCelebration(true);
      }
   };

   // Confetti Loop removed for stability
   /*
   useEffect(() => {
      if (!isCelebration) return;
      // ... confetti logic ...
   }, [isCelebration]);
   */

   const fetchSocialNetworks = async (userId: string) => {
      try {
         console.log('[DEBUG] Fetching social networks for user:', userId);
         const { data, error } = await supabase
            .from('profiles')
            .select('social_networks, phone')
            .eq('id', userId)
            .maybeSingle();
         
         if (error) {
             console.error('[DEBUG] Error fetching profile:', error);
             throw error;
         }
         
         console.log('[DEBUG] Profile data fetched:', data);
         setSocialNetworks(data?.social_networks || {});
         if (data?.phone) {
             console.log('[DEBUG] Organizer phone found:', data.phone);
             setOrganizerPhone(data.phone);
         } else {
             console.log('[DEBUG] No phone found in profile');
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
         
         if (data?.payment_methods_config?.pixManual) {
            setPixConfig(data.payment_methods_config.pixManual);
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

            // Só considera reservado se não expirou ou se for approved
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

            // Check for draw results
            if (data.draw_results && Array.isArray(data.draw_results) && data.draw_results.length > 0) {
               fetchWinners(data.draw_results, data.id);
            }
         }
      }
   }, [slug, getCampaign]);

   // ─── Handle Purchase ID from URL ────────────────────────────
   useEffect(() => {
      const searchParams = new URLSearchParams(location.search);
      const purchaseId = searchParams.get('purchaseId');

      if (purchaseId && campaign) {
         fetchPurchaseDetails(purchaseId);
      }
   }, [location.search, campaign]);

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

         // Preencher estados
         setCurrentPurchaseId(purchase.id);
         setSelectedTickets(purchase.tickets || []);
         setPhone(purchase.customers?.phone ? maskPhone(purchase.customers.phone) : '');
         setName(purchase.customers?.name || '');
         setEmail(purchase.customers?.email || '');
         
         if (purchase.proof_url) {
            setProofPreview(purchase.proof_url);
         }

         // Definir Step baseado no status
         if (purchase.status === 'cancelled') {
            setStep(5);
         } else if (purchase.status === 'approved') {
            setStep(6);
         } else if (purchase.status === 'pending') {
            if (purchase.proof_url) {
               setStep(4); // Comprovante enviado
            } else {
               setStep(3); // Aguardando pagamento/upload
            }
         }
      } catch (err) {
         console.error('Erro ao processar compra da URL:', err);
      }
   };

   if (!campaign) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-white font-sans">
            <div className="text-center">
               <h2 className="text-xl font-bold text-slate-900">Campanha não encontrada</h2>
               <p className="text-slate-500 mt-2">Verifique o link e tente novamente.</p>
            </div>
         </div>
      );
   }

   const totalNumbers = campaign.ticketQuantity || 0;
   const numbers = Array.from({ length: totalNumbers }, (_, i) => i);
   const ticketPrice = getTicketPrice(campaign.ticketValue);
   const totalValue = (selectedTickets.length * ticketPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
   const availableCount = totalNumbers - Object.keys(ticketsStatus).length;
   const reservedCount = Object.values(ticketsStatus).filter((t: any) => t.status === 'pending').length;
   const paidCount = Object.values(ticketsStatus).filter((t: any) => t.status === 'approved').length;
   const paymentMinutes = parsePaymentTime(campaign.paymentTime || '1 hora');

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
         } else {
            setExistingCustomer(null);
         }
      } catch (_) {
         // Silently ignore lookup errors
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
      if (!termsAccepted) e.terms = 'Você deve aceitar os termos.';
      return e;
   };

   const handleFinalize = async () => {
      const e = validateStep2();
      if (Object.keys(e).length > 0) { setErrors(e); return; }
      setErrors({});
      setSubmitting(true);
      try {
         const rawPhone = phone.replace(/\D/g, '');
         // Upsert customer
         const { data: customer, error: custErr } = await supabase
            .from('customers')
            .upsert({ phone: rawPhone, name: name.trim(), email: email.trim() || null }, { onConflict: 'phone' })
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
      } catch (err) {
         console.error('Erro ao salvar compra:', err);
      } finally {
         setSubmitting(false);
      }
      setStep(3);
   };

   const handleCopyPix = () => {
      if (pixConfig?.pixKey) {
         navigator.clipboard.writeText(pixConfig.pixKey);
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

         // 1. Upload to Storage
         const { error: uploadError } = await supabase.storage
            .from('proofs')
            .upload(filePath, proofFile);

         if (uploadError) throw uploadError;

         // 2. Get Public URL
         const { data: { publicUrl } } = supabase.storage
            .from('proofs')
            .getPublicUrl(filePath);

         // 3. Update purchase_history
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
   // CELEBRATION VIEW (Mobile First Luxury Redesign)
   // ═══════════════════════════════════════════════════════════
   if (isCelebration && campaign?.status === 'completed') {
      return (
         <div className="bg-[#022c22] min-h-screen font-sans relative overflow-x-hidden selection:bg-emerald-500/30">
            {/* Ambient Background - Adjusted for mobile depth */}
            <div className="fixed inset-0 pointer-events-none z-0">
               <div className="absolute top-[-10%] left-[-20%] w-[80%] h-[60%] bg-emerald-500/20 blur-[120px] rounded-full mix-blend-screen" />
               <div className="absolute bottom-[-10%] right-[-20%] w-[80%] h-[60%] bg-teal-500/10 blur-[120px] rounded-full mix-blend-screen" />
               <div className="absolute top-[40%] left-[20%] w-[40%] h-[40%] bg-white/5 blur-[100px] rounded-full mix-blend-overlay" />
            </div>

            <header className="px-5 py-6 flex justify-between items-center relative z-10">
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
                  <div className="inline-block mb-3">
                     <span className="material-icons-round text-4xl text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.6)] animate-bounce">emoji_events</span>
                  </div>
                  <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 tracking-tight leading-[0.9]">
                     Sorteio<br />
                     <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-100 to-teal-300 drop-shadow-sm">Realizado!</span>
                  </h1>
                  <p className="text-emerald-100/70 text-sm font-medium leading-relaxed max-w-[280px] mx-auto">
                     O sorteio foi auditado e concluído. Confira os ganhadores abaixo.
                  </p>
               </div>

               <div className="space-y-5 flex-1">
                  {winners.map((winner, idx) => (
                     <div 
                        key={idx} 
                        className={`relative overflow-hidden rounded-3xl transition-all duration-500 transform hover:scale-[1.02] ${
                            winner.isNoWinner 
                            ? 'bg-gradient-to-br from-rose-950/80 to-rose-900/40 border border-rose-500/30 shadow-[0_8px_30px_-5px_rgba(225,29,72,0.15)]' 
                            : 'bg-gradient-to-br from-[#064e3b]/90 to-[#065f46]/40 border border-emerald-400/30 shadow-[0_8px_30px_-5px_rgba(16,185,129,0.15)]'
                        } backdrop-blur-xl group`}
                     >
                        {/* Decorative Shine */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                        <div className="p-1">
                           <div className="flex justify-between items-start px-4 pt-4 pb-2">
                              <span className={`text-[10px] font-black uppercase tracking-widest py-1 px-2.5 rounded-lg backdrop-blur-md ${
                                 winner.isNoWinner ? 'bg-rose-500/20 text-rose-200' : 'bg-emerald-400/20 text-emerald-100'
                              }`}>
                                 {winner.prize}
                              </span>
                              {!winner.isNoWinner && (
                                 <span className="material-icons-round text-emerald-400/50 text-xl">verified</span>
                              )}
                           </div>

                           <div className="px-5 pb-6">
                              <div className="flex flex-col items-center text-center">
                                 <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-2xl mb-4 border-4 p-1 ${
                                    winner.isNoWinner 
                                    ? 'bg-[#1e1215] border-rose-500/20 shadow-rose-900/20' 
                                    : 'bg-[#022c22] border-emerald-400/30 shadow-emerald-900/30'
                                 }`}>
                                    <div className={`w-full h-full rounded-full flex items-center justify-center ${
                                       winner.isNoWinner 
                                       ? 'bg-gradient-to-br from-rose-500 to-rose-700' 
                                       : 'bg-gradient-to-br from-emerald-400 to-teal-600'
                                    }`}>
                                       <span className="material-icons-round text-white text-3xl drop-shadow-md">
                                          {winner.isNoWinner ? 'close' : 'person'}
                                       </span>
                                    </div>
                                 </div>
                                 
                                 <p className={`text-xs font-bold uppercase tracking-widest mb-1 ${winner.isNoWinner ? 'text-rose-300/70' : 'text-emerald-200/70'}`}>
                                     {winner.isNoWinner ? 'Status' : 'Ganhador(a)'}
                                 </p>
                                 <p className="text-white font-black text-2xl leading-tight mb-2 tracking-tight line-clamp-1 w-full">{winner.name}</p>
                                 
                                 <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border mb-4 ${
                                    winner.isNoWinner 
                                    ? 'bg-rose-950/50 border-rose-500/20 text-rose-200' 
                                    : 'bg-emerald-950/50 border-emerald-400/20 text-emerald-100'
                                 }`}>
                                    <span className="text-[10px] uppercase font-bold opacity-60">Bilhete</span>
                                    <span className="text-base font-mono font-bold tracking-wider">{String(winner.ticket).padStart(2, '0')}</span>
                                 </div>

                                 {!winner.isNoWinner && (
                                     <button 
                                       onClick={() => handleOpenClaimModal(winner)}
                                       className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0e7569] text-white py-3.5 rounded-xl font-bold relative flex items-center justify-center transition-all shadow-[0_4px_20px_-5px_rgba(37,211,102,0.4)] hover:shadow-[0_8px_25px_-5px_rgba(37,211,102,0.5)] active:scale-[0.98] group overflow-hidden"
                                     >
                                        <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                                        <span className="material-icons-round text-xl absolute left-4 z-10">whatsapp</span>
                                        <span className="text-xs uppercase tracking-widest font-black relative z-10">Resgatar Prêmio</span>
                                     </button>
                                 )}
                              </div>
                           </div>
                        </div>
                     </div>
                  ))}
               </div>

               <div className="mt-12 text-center opacity-60 hover:opacity-100 transition-opacity">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black/20 border border-white/5 backdrop-blur-sm">
                     <span className="text-[10px] text-emerald-100 font-medium">Campanha auditada por</span>
                     <span className="text-white font-bold text-xs tracking-wide">DigRifa Security</span>
                  </div>
               </div>
            </div>

            {/* Claim Modal (Mobile Optimized) */}
            {claimModalOpen && (
               <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center" onClick={() => setClaimModalOpen(false)}>
                  <div className="absolute inset-0 bg-[#000]/90 backdrop-blur-sm transition-opacity" />
                  
                  <div 
                     className="bg-[#0f3930] w-full max-w-sm m-0 sm:m-4 rounded-t-[2rem] sm:rounded-3xl border-t sm:border border-emerald-500/30 p-6 sm:p-8 space-y-6 relative text-center shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-[slideUp_0.3s_ease-out]"
                     onClick={(e) => e.stopPropagation()}
                  >
                     <div className="w-12 h-1.5 bg-emerald-500/20 rounded-full mx-auto sm:hidden" />
                     
                     <button onClick={() => setClaimModalOpen(false)} className="absolute right-6 top-6 text-emerald-500/50 hover:text-emerald-400 transition-colors hidden sm:block">
                        <span className="material-icons-outlined text-2xl">close</span>
                     </button>

                     <div className="w-20 h-20 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center border border-emerald-500/20 mb-2 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                        <span className="material-icons-round text-emerald-400 text-4xl">lock</span>
                     </div>

                     <div className="space-y-2">
                        <h3 className="text-2xl font-black text-white tracking-tight">Confirme sua Identidade</h3>
                        <p className="text-emerald-100/60 text-sm leading-relaxed">
                           Digite seu telefone completo para liberar o acesso ao WhatsApp do organizador.
                        </p>
                     </div>

                     <div className="space-y-4 pt-2">
                        <div className="relative">
                           <input
                              type="tel"
                              placeholder="(DDD) 99999-9999"
                              value={claimPhoneInput}
                              onChange={(e) => setClaimPhoneInput(formatPhone(e.target.value))}
                              className="w-full bg-[#052e26] border border-emerald-500/30 rounded-2xl px-4 py-4 text-white text-center font-bold text-2xl tracking-widest focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 placeholder:text-emerald-500/20 placeholder:text-lg placeholder:font-normal placeholder:tracking-normal transition-all shadow-inner"
                              autoFocus
                           />
                        </div>
                        
                        <button 
                           onClick={handleConfirmClaim}
                           className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#022c22] font-black py-4 rounded-2xl text-base uppercase tracking-wider transition-all shadow-[0_4px_20px_-5px_rgba(16,185,129,0.4)] active:scale-[0.98]"
                        >
                           Confirmar Acesso
                        </button>
                     </div>
                  </div>
               </div>
            )}
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 0 — Grid de Cotas
   // ═══════════════════════════════════════════════════════════

   if (step === 0) {
      return (
         <div className="bg-white min-h-screen font-sans pb-28">
            <Navbar />
            <div 
               className="w-full aspect-video bg-slate-900 relative border-b border-slate-800 overflow-hidden group select-none"
               onMouseEnter={() => setIsPaused(true)}
               onMouseLeave={() => setIsPaused(false)}
               onTouchStart={() => setIsPaused(true)}
               onTouchEnd={() => setIsPaused(false)}
            >
               {/* Blurred Background for Ambiance */}
               <div
                  className="absolute inset-0 bg-cover bg-center blur-xl opacity-40 scale-110 transition-all duration-500"
                  style={{ backgroundImage: `url(${campaignImages[currentImageIndex] || primaryImage})` }}
               />
               
               {/* Main Image - Contained with simple transition */}
               <div className="absolute inset-0 flex items-center justify-center z-10 p-2 overflow-hidden">
                  <img
                     key={currentImageIndex}
                     src={campaignImages[currentImageIndex] || primaryImage}
                     alt={campaign.title}
                     className="max-w-full max-h-full object-contain shadow-2xl drop-shadow-lg absolute transition-opacity duration-300"
                     referrerPolicy="no-referrer"
                  />
               </div>

               {/* Navigation Arrows */}
               {campaignImages.length > 1 && (
                  <>
                     <button 
                        onClick={(e) => {
                           e.stopPropagation();
                           paginate(-1);
                        }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/50 transition-all z-20 backdrop-blur-sm opacity-0 group-hover:opacity-100 duration-300 hover:scale-110"
                     >
                        <span className="material-icons-round text-2xl">chevron_left</span>
                     </button>
                     <button 
                        onClick={(e) => {
                           e.stopPropagation();
                           paginate(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/20 text-white hover:bg-black/50 transition-all z-20 backdrop-blur-sm opacity-0 group-hover:opacity-100 duration-300 hover:scale-110"
                     >
                        <span className="material-icons-round text-2xl">chevron_right</span>
                     </button>
                  </>
               )}

               {/* Dots Indicator */}
               {campaignImages.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full z-20 shadow-lg">
                     {campaignImages.map((_, i) => (
                        <button 
                           key={i} 
                           onClick={(e) => {
                              e.stopPropagation();
                              setDirection(i > currentImageIndex ? 1 : -1);
                              setCurrentImageIndex(i);
                           }}
                           className={`w-2 h-2 rounded-full transition-all duration-300 ${i === currentImageIndex ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`} 
                        />
                     ))}
                  </div>
               )}
            </div>
            <div className="p-4 space-y-5 max-w-md mx-auto">
               <div>
                  <h1 className="text-lg font-bold text-slate-900 leading-tight mb-4">{campaign.title}</h1>
                  <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                     <div>
                        <p className="text-slate-400 text-[10px] uppercase mb-0.5 font-medium tracking-wide">Cota</p>
                        <p className="text-[#6366F1] font-black text-xl">R$ {campaign.ticketValue}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-slate-400 text-[10px] uppercase mb-0.5 font-medium tracking-wide">Sorteio</p>
                        <p className="text-slate-900 font-bold text-sm">{campaign.drawMethod === 'loteria' ? 'Loteria Federal' : 'Próprio App'}</p>
                     </div>
                  </div>
               </div>
               <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                  <button onClick={() => setIsRegulationOpen(!isRegulationOpen)} className="w-full p-3.5 flex justify-between items-center bg-white hover:bg-slate-50 transition-colors">
                     <div className="flex items-center gap-2 font-bold text-slate-700 text-sm">
                        <span className="material-icons-outlined text-lg">article</span>
                        Regulamento
                     </div>
                     <span className={`material-icons-round transition-transform text-slate-400 ${isRegulationOpen ? 'rotate-180' : ''}`}>expand_more</span>
                  </button>
                  {isRegulationOpen && (
                     <div className="p-4 border-t border-slate-100 text-sm text-slate-600 bg-slate-50 leading-relaxed">
                        <p>{campaign.description || 'Nenhum regulamento fornecido pelo organizador.'}</p>
                     </div>
                  )}
               </div>

               {/* Partial Winners Section - Show if there are winners but campaign is not completed */}
               {isCelebration && campaign?.status !== 'completed' && winners.length > 0 && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 p-5 shadow-sm">
                     <div className="flex items-center gap-2 mb-4">
                        <span className="material-icons-round text-emerald-600">emoji_events</span>
                        <h3 className="font-bold text-slate-900 text-base">Sorteios Realizados</h3>
                     </div>
                     <div className="space-y-3">
                        {winners.map((winner, idx) => (
                           <div key={idx} className="bg-white rounded-lg p-3 border border-emerald-100/50 shadow-sm flex items-center justify-between">
                              <div>
                                 <p className="text-[10px] font-bold uppercase text-emerald-600 mb-0.5">{winner.prize}</p>
                                 <p className="font-bold text-slate-800 text-sm">{winner.name}</p>
                              </div>
                              <div className="text-right">
                                 <span className="text-xs text-slate-500 block">Bilhete</span>
                                 <span className="font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{winner.ticket}</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               )}

               <div>
                  <div className="flex items-center gap-2 font-black text-slate-900 mb-1 text-lg">
                     <span className="material-icons-outlined text-xl">confirmation_number</span> Cotas
                  </div>
                  <p className="text-slate-500 text-xs mb-4">Selecione as cotas que deseja comprar</p>
                  <div className="space-y-1.5 mb-5">
                     {[['Todos', totalNumbers, 'bg-slate-100/80 text-slate-600'], ['Disponível', availableCount, 'bg-slate-100/80 text-slate-600'], ['Reservados', reservedCount, 'bg-orange-50 text-orange-500'], ['Pagos', paidCount, 'bg-emerald-50 text-emerald-500']].map(([l, v, cls]) => (
                        <div key={l as string} className={`flex justify-between items-center ${cls} px-3 py-2 rounded-lg text-xs font-bold`}>
                           <span>{l}</span><span>{v}</span>
                        </div>
                     ))}
                  </div>
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
               <div className="bg-slate-50 rounded-xl p-5 border border-slate-100 mt-6">
                  <div className="flex items-center gap-2 font-bold text-slate-900 mb-1 text-sm">
                     <span className="material-icons-outlined">people</span>Redes sociais
                  </div>
                  <p className="text-slate-500 text-xs mb-4">Acompanhe as redes sociais da campanha</p>
                  <div className="flex flex-wrap gap-2">
                     {socialNetworks?.whatsappGroup && (
                        <a href={socialNetworks.whatsappGroup} target="_blank" rel="noopener noreferrer"
                           className="bg-emerald-50 text-emerald-600 p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors border border-emerald-100">
                           <span className="material-icons-round text-sm">chat</span>Grupo WhatsApp
                        </a>
                     )}
                     {socialNetworks?.instagram && (
                        <a href={socialNetworks.instagram} target="_blank" rel="noopener noreferrer"
                           className="bg-pink-50 text-pink-600 p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-pink-100 transition-colors border border-pink-100">
                           <span className="material-icons-round text-sm">camera_alt</span>Instagram
                        </a>
                     )}
                     {socialNetworks?.facebook && (
                        <a href={socialNetworks.facebook} target="_blank" rel="noopener noreferrer"
                           className="bg-blue-50 text-blue-600 p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors border border-blue-100">
                           <span className="material-icons-round text-sm">facebook</span>Facebook
                        </a>
                     )}
                     {socialNetworks?.telegram && (
                        <a href={socialNetworks.telegram} target="_blank" rel="noopener noreferrer"
                           className="bg-sky-50 text-sky-600 p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-sky-100 transition-colors border border-sky-100">
                           <span className="material-icons-round text-sm">send</span>Telegram
                        </a>
                     )}
                     {socialNetworks?.youtube && (
                        <a href={socialNetworks.youtube} target="_blank" rel="noopener noreferrer"
                           className="bg-rose-50 text-rose-600 p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors border border-rose-100">
                           <span className="material-icons-round text-sm">play_circle</span>YouTube
                        </a>
                     )}
                     {socialNetworks?.tiktok && (
                        <a href={socialNetworks.tiktok} target="_blank" rel="noopener noreferrer"
                           className="bg-slate-900 text-white p-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors border border-slate-800">
                           <span className="material-icons-round text-sm">music_note</span>TikTok
                        </a>
                     )}
                     {(!socialNetworks || Object.values(socialNetworks).every(v => !v)) && (
                        <p className="text-slate-400 text-[10px] italic font-normal">Nenhuma rede social configurada.</p>
                     )}
                  </div>
               </div>
               <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center text-amber-400 font-bold border-2 border-amber-400 shrink-0">
                     <span className="text-xs">DR</span>
                  </div>
                  <div>
                     <p className="text-[10px] text-slate-500 font-medium">Organizado por</p>
                     <p className="font-bold text-slate-900 text-sm">DigRifa Demo</p>
                  </div>
               </div>
            </div>
            <div className="text-center py-6 pb-28 text-slate-400 text-xs flex items-center justify-center gap-1 font-medium">
               Feito com <span className="text-purple-500">♥</span> por
               <span className="bg-[#6366F1] text-white px-1.5 py-0.5 rounded ml-1 italic font-black text-[10px]">DigRifa</span>
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

   // ═══════════════════════════════════════════════════════════
   // STEP 1 — Telefone
   // ═══════════════════════════════════════════════════════════
   if (step === 1) {
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
                     {lookingUp && <p className="text-xs text-slate-400 mt-1">Verificando cadastro...</p>}
                     {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                  </div>
                  {existingCustomer && (
                     <div className="bg-[#6366F1]/5 border border-[#6366F1]/20 rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <span className="material-icons-round text-[#6366F1] text-sm">person_check</span>
                           <p className="text-sm font-bold text-[#6366F1]">Bem-vindo de volta!</p>
                        </div>
                        <button
                           onClick={handleShowHistory}
                           className="text-xs text-[#6366F1] font-bold underline"
                        >
                           Ver histórico
                        </button>
                     </div>
                  )}
                  <button
                     onClick={handleStep1Continue}
                     className="w-full bg-[#6366F1] hover:bg-[#5558dd] text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
                  >
                     Continuar
                  </button>
               </div>
            </div>

            {/* Customer History Sheet */}
            {showHistory && (
               <div className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-sm" onClick={() => setShowHistory(false)}>
                  <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                     <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />
                     <h3 className="font-black text-slate-900 text-lg mb-4">Meu Histórico</h3>
                     {customerHistory.length === 0 ? (
                        <p className="text-slate-400 text-sm">Nenhuma compra encontrada.</p>
                     ) : (
                        <div className="space-y-3">
                           {customerHistory.map((h) => (
                              <div key={h.id} className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                                 <div className="flex justify-between items-start">
                                    <p className="font-bold text-slate-800 text-sm">{h.campaigns?.title || 'Campanha'}</p>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${h.status === 'approved' ? 'bg-emerald-100 text-emerald-600' : h.status === 'cancelled' ? 'bg-red-100 text-red-500' : 'bg-amber-100 text-amber-600'}`}>
                                       {h.status === 'approved' ? 'Aprovado' : h.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                                    </span>
                                 </div>
                                 <p className="text-slate-500 text-xs mt-1">{h.tickets?.length} cotas · R$ {Number(h.total_value).toFixed(2).replace('.', ',')}</p>
                              </div>
                           ))}
                        </div>
                     )}
                     <button onClick={() => setShowHistory(false)} className="mt-5 w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-xl">Fechar</button>
                  </div>
               </div>
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
                           da DigRifa, sabendo que minha participação se refere apenas a esta promoção específica, sem vínculo direto com a plataforma DigRifa.
                        </span>
                     </label>
                     {errors.terms && <p className="text-xs text-red-500 mt-2">{errors.terms}</p>}
                  </div>
                  <button
                     onClick={handleFinalize}
                     disabled={submitting}
                     className="w-full bg-[#6366F1] hover:bg-[#5558dd] disabled:opacity-70 text-white font-bold py-3.5 rounded-xl flex items-center justify-center transition-all active:scale-[0.98]"
                  >
                     {submitting ? 'Salvando...' : 'Finalizar compra'}
                  </button>
               </div>
            </div>
            {showTermsModal && <TermsModal description={campaign.description} onClose={() => setShowTermsModal(false)} />}
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 3 — Pagamento PIX
   // ═══════════════════════════════════════════════════════════
   if (step === 3) {
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

               {/* PIX Info */}
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

   // ═══════════════════════════════════════════════════════════
   // STEP 4 — Confirmação de Envio
   // ═══════════════════════════════════════════════════════════
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

               {/* PIX Info (readonly) */}
               <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100">
                     <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">TIPO</span>
                     <span className="font-bold text-slate-800 text-sm">{pixConfig?.keyType?.toUpperCase() || 'PIX'}</span>
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

               {/* Success Badge */}
               <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center gap-3">
                  <span className="material-icons-round text-emerald-500 text-xl">check_circle</span>
                  <div>
                     <p className="font-bold text-emerald-700 text-sm">Comprovante enviado</p>
                     <p className="text-emerald-600 text-xs mt-0.5">O organizador irá analisar em breve.</p>
                  </div>
               </div>

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

   // ═══════════════════════════════════════════════════════════
   // STEP 5 — Compra Cancelada
   // ═══════════════════════════════════════════════════════════
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
                     // Opcional: limpar URL
                     window.history.pushState({}, '', window.location.pathname);
                  }}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-[0.98]"
               >
                  Comprar novamente
               </button>
            </div>

            {/* Detalhes (Readonly) */}
            <div className="w-full max-w-md mt-6 space-y-4">
               <div className="bg-[#1E1E1E] rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                     <span className="material-icons-outlined text-slate-500 text-sm">shopping_cart</span>
                     <p className="text-slate-300 text-sm font-bold">Detalhes da compra</p>
                  </div>
                  {[
                     ['Valor', `R$ ${totalValue}`],
                     ['Nome', name],
                     ['Telefone', maskPhone(phone)],
                     ['Data da compra', new Date().toLocaleString('pt-BR')], // Idealmente usar created_at real
                     ['Quantidade de tickets', selectedTickets.length],
                  ].map(([label, val]) => (
                     <div key={label as string} className="flex justify-between items-center px-4 py-3 border-b border-slate-800 last:border-0">
                        <span className="text-slate-500 text-sm">{label}</span>
                        <span className="font-bold text-slate-200 text-sm text-right max-w-[60%]">{val}</span>
                     </div>
                  ))}
               </div>

               <div className="bg-[#1E1E1E] rounded-2xl border border-slate-800 overflow-hidden">
                   <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                     <span className="material-icons-outlined text-slate-500 text-sm">confirmation_number</span>
                     <p className="text-slate-300 text-sm font-bold">Bilhetes <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] ml-1">{selectedTickets.length}</span></p>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                     {selectedTickets.sort((a, b) => a - b).map((n) => (
                        <span key={n} className="bg-[#121212] border border-slate-700 text-slate-400 text-xs font-bold px-3 py-1.5 rounded-lg">
                           {String(n).padStart(2, '0')}
                        </span>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      );
   }

   // ═══════════════════════════════════════════════════════════
   // STEP 6 — Compra Aprovada
   // ═══════════════════════════════════════════════════════════
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

            {/* Detalhes (Readonly) */}
            <div className="w-full max-w-md mt-6 space-y-4">
               <div className="bg-[#1E1E1E] rounded-2xl border border-slate-800 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                     <span className="material-icons-outlined text-slate-500 text-sm">shopping_cart</span>
                     <p className="text-slate-300 text-sm font-bold">Detalhes da compra</p>
                  </div>
                  {[
                     ['Valor', `R$ ${totalValue}`],
                     ['Nome', name],
                     ['Telefone', maskPhone(phone)],
                     ['Data da compra', new Date().toLocaleString('pt-BR')],
                     ['Quantidade de tickets', selectedTickets.length],
                  ].map(([label, val]) => (
                     <div key={label as string} className="flex justify-between items-center px-4 py-3 border-b border-slate-800 last:border-0">
                        <span className="text-slate-500 text-sm">{label}</span>
                        <span className="font-bold text-slate-200 text-sm text-right max-w-[60%]">{val}</span>
                     </div>
                  ))}
               </div>

               <div className="bg-[#1E1E1E] rounded-2xl border border-slate-800 overflow-hidden">
                   <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                     <span className="material-icons-outlined text-slate-500 text-sm">confirmation_number</span>
                     <p className="text-slate-300 text-sm font-bold">Bilhetes <span className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-[10px] ml-1">{selectedTickets.length}</span></p>
                  </div>
                  <div className="p-4 flex flex-wrap gap-2">
                     {selectedTickets.sort((a, b) => a - b).map((n) => (
                        <span key={n} className="bg-[#121212] border border-slate-700 text-slate-400 text-xs font-bold px-3 py-1.5 rounded-lg">
                           {String(n).padStart(2, '0')}
                        </span>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      );
   }

   return null;
}
