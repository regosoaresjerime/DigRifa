import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { useCampaign } from '../context/CampaignContext';
import { supabase } from '../lib/supabaseClient';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { validatePhone, generateWhatsAppMessage, openWhatsApp, logAudit } from '../utils/whatsapp';
import RaffleManager from '../components/RaffleManager';
import RankingManager from '../components/RankingManager';

// ─── Types ───────────────────────────────────────────────────
type PurchaseStatus = 'pending' | 'approved' | 'cancelled';

interface Purchase {
   id: string;
   customer_id: string;
   campaign_id: string;
   tickets: number[];
   total_value: number;
   status: PurchaseStatus;
   proof_url?: string;
   created_at: string;
   customers?: {
      name: string;
      phone: string;
      email?: string;
   };
}

// ─── Helpers ────────────────────────────────────────────────
function parsePaymentTime(pt: string): number {
   if (!pt) return 60;
   const m = pt.match(/(\d+)/);
   const n = m ? parseInt(m[1]) : 1;
   if (pt.toLowerCase().includes('hora')) return n * 60;
   return n;
}

// ─── Status Badge ────────────────────────────────────────────
function StatusBadge({ status }: { status: PurchaseStatus }) {
   const map: Record<PurchaseStatus, { label: string; cls: string }> = {
      pending: { label: 'Pagamento pendente', cls: 'bg-amber-100 text-amber-700' },
      approved: { label: 'Pagamento aprovado', cls: 'bg-emerald-100 text-emerald-600' },
      cancelled: { label: 'Pagamento cancelado', cls: 'bg-red-100 text-red-500' },
   };
   const { label, cls } = map[status] || map.pending;
   return (
      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${cls}`}>{label}</span>
   );
}

// ─── Payment Analysis Modal ──────────────────────────────────
function PaymentModal({
   purchase,
   onClose,
   onStatusChange,
}: {
   purchase: Purchase;
   onClose: () => void;
   onStatusChange: (id: string, status: PurchaseStatus) => void;
}) {
   const [loading, setLoading] = useState(false);

   const handleAction = async (newStatus: PurchaseStatus) => {
      setLoading(true);
      try {
         await supabase
            .from('purchase_history')
            .update({ status: newStatus })
            .eq('id', purchase.id);
         onStatusChange(purchase.id, newStatus);
         onClose();
      } catch (err) {
         console.error(err);
      } finally {
         setLoading(false);
      }
   };

   const isPending = purchase.status === 'pending';
   const isApproved = purchase.status === 'approved';
   const isCancelled = purchase.status === 'cancelled';

   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
         <div
            className="bg-[#1E1E1E] w-full max-w-sm rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
         >
            {/* Header */}
            <div className="p-4 border-b border-slate-700 flex justify-between items-start bg-[#181818]">
               <div>
                  <h3 className="font-bold text-white text-base">
                     {isApproved ? 'Pagamento Aprovado' : isCancelled ? 'Pagamento Cancelado' : 'Análise de Pagamento'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                     Verifique o comprovante abaixo.
                  </p>
               </div>
               <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                  <span className="material-icons-round text-lg">close</span>
               </button>
            </div>

            {/* Top Action Buttons */}
            <div className="p-3 gap-2 flex flex-col sm:flex-row bg-[#1E1E1E]">
               {isPending && (
                  <>
                     <button
                        onClick={() => handleAction('approved')}
                        disabled={loading}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-70 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                     >
                        <span className="material-icons-outlined text-sm">check_circle</span>
                        Aprovar
                     </button>
                     <button
                        onClick={() => handleAction('cancelled')}
                        disabled={loading}
                        className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-70 text-white text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                     >
                        <span className="material-icons-outlined text-sm">cancel</span>
                        Cancelar
                     </button>
                  </>
               )}
               {isApproved && (
                  <button
                     onClick={() => handleAction('cancelled')}
                     disabled={loading}
                     className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                     <span className="material-icons-outlined text-sm">undo</span>
                     Reverter / Cancelar Compra
                  </button>
               )}
               {isCancelled && (
                  <button
                     onClick={() => handleAction('approved')}
                     disabled={loading}
                     className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 text-xs font-bold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                     <span className="material-icons-outlined text-sm">restore</span>
                     Reativar / Aprovar Compra
                  </button>
               )}
            </div>

            {/* Proof image (Centered) */}
            <div className="flex-1 overflow-y-auto bg-black/20 p-4 flex items-center justify-center min-h-[200px]">
               {purchase.proof_url ? (
                  <img
                     src={purchase.proof_url}
                     alt="Comprovante"
                     className="w-full h-auto object-contain rounded-lg border border-slate-700 shadow-lg"
                  />
               ) : (
                  <div className="flex flex-col items-center justify-center text-slate-500">
                     <span className="material-icons-outlined text-4xl mb-2 opacity-50">image_not_supported</span>
                     <p className="text-xs">Nenhum comprovante anexado</p>
                  </div>
               )}
            </div>

            {/* Bottom Download Button */}
            {purchase.proof_url && (
               <div className="p-3 border-t border-slate-700 bg-[#181818]">
                  <a
                     href={purchase.proof_url}
                     download={`comprovante-${purchase.id}`}
                     target="_blank"
                     rel="noreferrer"
                     className="w-full flex items-center justify-center gap-2 text-xs font-bold text-slate-300 bg-[#252525] border border-slate-600 hover:bg-[#2A2A2A] hover:text-white rounded-lg py-2.5 transition-colors"
                  >
                     <span className="material-icons-outlined text-sm">download</span>
                     Baixar Comprovante Original
                  </a>
               </div>
            )}
         </div>
      </div>
   );
}

// ─── Purchase Card ───────────────────────────────────────────
function PurchaseCard({
   purchase,
   onAnalyze,
   isMenuOpen,
   setIsMenuOpen,
   onStatusChange
}: {
   purchase: Purchase;
   onAnalyze: (p: Purchase) => void;
   isMenuOpen: boolean;
   setIsMenuOpen: (open: boolean) => void;
   onStatusChange: (id: string, status: PurchaseStatus) => void;
}) {
   const [copySuccess, setCopySuccess] = useState(false);
   const [showData, setShowData] = useState(false);
   const [whatsAppLoading, setWhatsAppLoading] = useState(false);
   const [whatsAppFeedback, setWhatsAppFeedback] = useState<'success' | 'error' | null>(null);

   const customer = purchase.customers;
   const maskedPhone = customer?.phone
      ? `(**) *****-${customer.phone.slice(-4)}`
      : '(**)  *****-****';
   const maskedEmail = customer?.email
      ? customer.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
      : '---';

   const handleWhatsAppClick = () => {
      if (!customer?.phone) {
         setWhatsAppFeedback('error');
         setTimeout(() => setWhatsAppFeedback(null), 3000);
         return;
      }

      setWhatsAppLoading(true);
      const validPhone = validatePhone(customer.phone);

      if (!validPhone) {
         setWhatsAppLoading(false);
         setWhatsAppFeedback('error');
         alert('Número de telefone inválido para envio via WhatsApp.');
         setTimeout(() => setWhatsAppFeedback(null), 3000);
         return;
      }

      try {
         const message = generateWhatsAppMessage(purchase, window.location.origin);
         logAudit('whatsapp_send_attempt', { purchaseId: purchase.id, status: purchase.status, phone: validPhone });
         
         // Pequeno delay para feedback visual
         setTimeout(() => {
            openWhatsApp(validPhone, message);
            setWhatsAppLoading(false);
            setWhatsAppFeedback('success');
            setTimeout(() => setWhatsAppFeedback(null), 3000);
         }, 500);
      } catch (error) {
         console.error('Erro ao enviar WhatsApp:', error);
         setWhatsAppLoading(false);
         setWhatsAppFeedback('error');
      }
   };

   const formattedDate = new Date(purchase.created_at).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
   });

   const displayPhone = showData && customer?.phone ? customer.phone : maskedPhone;
   const displayEmail = showData && customer?.email ? customer.email : maskedEmail;

   return (
      <div
         className={`bg-[#1E1E1E] rounded-xl border border-slate-800 relative overflow-hidden ${isMenuOpen ? 'z-50' : 'z-0'}`}
         style={{ isolation: 'isolate' }}
      >
         <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 rounded-t-xl">
            <StatusBadge status={purchase.status} />
            <div className="flex items-center gap-1 relative">
               <button
                  onClick={() => setShowData(!showData)}
                  className={`text-slate-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5 ${showData ? 'text-indigo-400' : ''}`}
                  title={showData ? "Ocultar Dados" : "Mostrar Dados"}
               >
                  <span className="material-icons-outlined text-lg">{showData ? 'visibility_off' : 'visibility'}</span>
               </button>
               
               {purchase.proof_url && (
                  <button
                     onClick={() => onAnalyze(purchase)}
                     className="text-orange-500 hover:text-orange-400 transition-colors p-1.5 rounded-lg hover:bg-orange-500/10"
                     title="Ver Comprovante"
                  >
                     <span className="material-icons-outlined text-lg">receipt_long</span>
                  </button>
               )}

               <button
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className={`text-slate-400 hover:text-white transition-all p-1.5 rounded-lg hover:bg-white/5 ${isMenuOpen ? 'bg-white/10 text-white' : ''}`}
               >
                  <span className="material-icons-outlined text-lg">more_vert</span>
               </button>
            </div>
         </div>

         {/* Dropdown Sidebar Menu - Framed in Card - COMPACT VERSION */}
         <div className={`absolute inset-0 z-[60] bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsMenuOpen(false)} />
         
         <div className={`absolute top-0 right-0 h-full w-[180px] bg-[#181818] border-l border-slate-800 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="h-full flex flex-col relative z-[80]">
               <div className="p-2 border-b border-white/5 flex justify-between items-center bg-[#1E1E1E]">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Opções</span>
                  <button onClick={() => setIsMenuOpen(false)} className="text-slate-500 hover:text-white p-0.5 hover:bg-white/5 rounded transition-colors">
                     <span className="material-icons-outlined text-xs">close</span>
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="p-1 space-y-0.5">
                     <button
                        onClick={() => {
                           const link = `${window.location.origin}/r/${purchase.id}`;
                           navigator.clipboard.writeText(link);
                           setCopySuccess(true);
                           setTimeout(() => setCopySuccess(false), 2000);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-slate-300 hover:text-white hover:bg-white/5 rounded-md transition-colors group"
                     >
                        <span className="material-icons-outlined text-xs text-slate-500 group-hover:text-[#6366F1] transition-colors">{copySuccess ? 'check_circle' : 'open_in_new'}</span>
                        <span>{copySuccess ? 'Copiado!' : 'Link da compra'}</span>
                     </button>
                     <button
                        onClick={handleWhatsAppClick}
                        disabled={whatsAppLoading}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] rounded-md transition-colors group ${
                           whatsAppFeedback === 'success' 
                              ? 'text-emerald-400 bg-emerald-400/10' 
                              : whatsAppFeedback === 'error'
                                 ? 'text-red-400 bg-red-400/10'
                                 : 'text-slate-300 hover:text-white hover:bg-white/5'
                        }`}
                     >
                        {whatsAppLoading ? (
                           <div className="w-3 h-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                           <span className={`material-icons-outlined text-xs transition-colors ${
                              whatsAppFeedback === 'success' ? 'text-emerald-400' : 
                              whatsAppFeedback === 'error' ? 'text-red-400' : 
                              'text-slate-500 group-hover:text-emerald-500'
                           }`}>
                              {whatsAppFeedback === 'success' ? 'check' : whatsAppFeedback === 'error' ? 'error_outline' : 'messenger_outline'}
                           </span>
                        )}
                        <span>
                           {whatsAppLoading ? 'Enviando...' : 
                            whatsAppFeedback === 'success' ? 'Enviado!' : 
                            whatsAppFeedback === 'error' ? 'Erro' : 
                            'Entrar em contato'}
                        </span>
                     </button>
                  </div>

                  <div className="p-2 border-y border-white/5 bg-white/[0.01]">
                     <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Status</span>
                  </div>
                  <div className="p-1 space-y-0.5">
                     <button
                        onClick={() => { onStatusChange(purchase.id, 'approved'); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-slate-300 hover:text-emerald-400 hover:bg-emerald-400/5 rounded-md transition-colors group"
                     >
                        <span className="material-icons-outlined text-xs text-slate-500 group-hover:text-emerald-500 transition-colors">check_circle_outline</span>
                        <span>Aprovar compra</span>
                     </button>
                     <button
                        onClick={() => { onStatusChange(purchase.id, 'cancelled'); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-[10px] text-slate-300 hover:text-red-400 hover:bg-red-400/5 rounded-md transition-colors group"
                     >
                        <span className="material-icons-outlined text-xs text-slate-500 group-hover:text-red-500 transition-colors">highlight_off</span>
                        <span>Cancelar compra</span>
                     </button>
                  </div>
               </div>
            </div>
         </div>
         <div className="p-4">
            <p className="font-bold text-[#6366F1] text-sm mb-3">{customer?.name || 'Comprador'}</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-400">
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">email</span>
                  {displayEmail}
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">phone</span>
                  {displayPhone}
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">confirmation_number</span>
                  {purchase.tickets?.length || 0} bilhete{(purchase.tickets?.length || 0) !== 1 ? 's' : ''}
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">event</span>
                  {formattedDate}
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">attach_money</span>
                  R$ {Number(purchase.total_value).toFixed(2).replace('.', ',')}
               </div>
               <div className="flex items-center gap-1.5">
                  <span className="material-icons-outlined text-sm">pix</span>
                  Pago via PIX Manual
               </div>
            </div>

            {purchase.tickets?.length > 0 && (
               <div className="mt-3">
                  <p className="text-[10px] text-slate-500 mb-2 font-bold uppercase tracking-wider">Bilhetes comprados</p>
                  <div className="flex flex-wrap gap-1.5">
                     {purchase.tickets.sort((a, b) => a - b).map((t) => (
                        <span key={t} className="bg-[#181818] border border-slate-700 text-slate-300 text-xs font-bold px-2 py-0.5 rounded-lg">
                           {String(t).padStart(2, '0')}
                        </span>
                     ))}
                  </div>
               </div>
            )}
         </div>
      </div >
   );
}

// ─── Sales History View ──────────────────────────────────────
function SalesHistoryView({
   campaignId,
   purchases,
   loading,
   refreshPurchases,
   handleStatusChange
}: {
   campaignId: string,
   purchases: Purchase[],
   loading: boolean,
   refreshPurchases: () => void,
   handleStatusChange: (id: string, status: PurchaseStatus) => void
}) {
   const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
   const [statusFilter, setStatusFilter] = useState<'all' | PurchaseStatus>('all');
   const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

   const filtered = (statusFilter === 'all' ? purchases : purchases.filter((p) => p.status === statusFilter)) as Purchase[];

   return (
      <div className="space-y-4">
         <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Histórico de vendas</h2>
            <div className="flex gap-2">
               <button onClick={refreshPurchases} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-[#1E1E1E] border border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors">
                  <span className="material-icons-round text-sm">refresh</span>
                  Atualizar
               </button>
               <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-[#1E1E1E] border border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors">
                  <span className="material-icons-outlined text-sm">tune</span>
                  Filtros
               </button>
               <button className="flex items-center gap-1 text-xs text-slate-400 hover:text-white bg-[#1E1E1E] border border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors">
                  <span className="material-icons-outlined text-sm">upload</span>
                  Exportar
               </button>
            </div>
         </div>

         {/* Quick filter chips */}
         <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'approved', 'cancelled'] as const).map((f) => {
               const labels: Record<string, string> = { all: 'Todos', pending: 'Pendentes', approved: 'Aprovados', cancelled: 'Cancelados' };
               return (
                  <button
                     key={f}
                     onClick={() => setStatusFilter(f)}
                     className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${statusFilter === f ? 'bg-[#6366F1] border-[#6366F1] text-white' : 'bg-[#1E1E1E] border-slate-700 text-slate-400 hover:border-slate-500'}`}
                  >
                     {labels[f]}
                  </button>
               );
            })}
         </div>

         {loading ? (
            <div className="text-slate-500 text-sm text-center py-10">Carregando pedidos...</div>
         ) : filtered.length === 0 ? (
            <div className="text-slate-500 text-sm text-center py-10">
               <span className="material-icons-outlined text-4xl block mb-2 text-slate-700">receipt_long</span>
               Nenhum pedido encontrado.
            </div>
         ) : (
            <div className="space-y-4">
               {filtered.map((p) => (
                  <div
                     key={p.id}
                     className={`relative transition-all duration-200 ${activeMenuId === p.id ? 'z-50' : 'z-0'}`}
                  >
                     <PurchaseCard
                        purchase={p}
                        onAnalyze={(purchase: Purchase) => setSelectedPurchase(purchase)}
                        onStatusChange={handleStatusChange}
                        isMenuOpen={activeMenuId === p.id}
                        setIsMenuOpen={(open) => setActiveMenuId(open ? p.id : null)}
                     />
                  </div>
               ))}
            </div>
         )}

         {selectedPurchase && (
            <PaymentModal
               purchase={selectedPurchase}
               onClose={() => setSelectedPurchase(null)}
               onStatusChange={handleStatusChange}
            />
         )}
      </div>
   );
}

// ─── Main CampaignManager ────────────────────────────────────
export default function CampaignManager() {
   const { id } = useParams();
   const { getCampaign } = useCampaign();
   const campaign = getCampaign(id || '');
   const [showBalance, setShowBalance] = useState(false);
   const [activeTab, setActiveTab] = useState<'details' | 'sales' | 'ranking' | 'raffle'>('details');

   // ─── Real Data Fetching ──────────────────────────────────────
   const [purchases, setPurchases] = useState<Purchase[]>([]);
   const [loadingPurchases, setLoadingPurchases] = useState(true);

   const fetchPurchases = async () => {
      if (!campaign?.id) return;
      setLoadingPurchases(true);
      try {
         const { data } = await supabase
            .from('purchase_history')
            .select('*, customers(name, phone, email)')
            .eq('campaign_id', campaign.id)
            .order('created_at', { ascending: false });

         const rawPurchases = (data || []) as Purchase[];

         // ─── Logic to check expiration ───
         const payMinutes = parsePaymentTime(campaign.paymentTime || '1 hora');
         const now = new Date();
         const expiredIds: string[] = [];

         const updatedPurchases = rawPurchases.map(p => {
            if (p.status === 'pending') {
               const createdAt = new Date(p.created_at);
               const expiresAt = new Date(createdAt.getTime() + payMinutes * 60000);
               if (now > expiresAt) {
                  expiredIds.push(p.id);
                  return { ...p, status: 'cancelled' as PurchaseStatus };
               }
            }
            return p;
         });

         setPurchases(updatedPurchases);

         // Update DB in background if there are expired ones
         if (expiredIds.length > 0) {
            supabase
               .from('purchase_history')
               .update({ status: 'cancelled' })
               .in('id', expiredIds)
               .then(({ error }) => {
                  if (error) console.error('Error auto-cancelling expired payments:', error);
                  else console.log(`Auto-cancelled ${expiredIds.length} expired payments.`);
               });
         }
      } catch (err) {
         console.error('Error fetching purchases:', err);
      } finally {
         setLoadingPurchases(false);
      }
   };

   useEffect(() => {
      fetchPurchases();
   }, [campaign?.id]);

   const handleStatusChange = (pid: string, newStatus: PurchaseStatus) => {
      setPurchases((prev) =>
         prev.map((p) => (p.id === pid ? { ...p, status: newStatus } : p))
      );
      // Optional: fetch again to ensure everything is in sync
      // fetchPurchases();
   };

   if (!campaign) {
      return <div className="text-center p-10 text-slate-500">Campanha não encontrada</div>;
   }

   // ─── Computed Stats ──────────────────────────────────────────
   const approvedPurchases = purchases.filter(p => p.status === 'approved');
   const pendingPurchases = purchases.filter(p => p.status === 'pending');

   const totalApprovedValue = approvedPurchases.reduce((sum, p) => sum + Number(p.total_value), 0);
   const totalPendingValue = pendingPurchases.reduce((sum, p) => sum + Number(p.total_value), 0);

   const ticketsApproved = approvedPurchases.reduce((sum, p) => sum + (p.tickets?.length || 0), 0);
   const ticketsPending = pendingPurchases.reduce((sum, p) => sum + (p.tickets?.length || 0), 0);

   const ticketsTotal = campaign.ticketQuantity || 0;
   const ticketsAvailable = ticketsTotal - (ticketsApproved + ticketsPending);

   const progress = ticketsTotal > 0 ? (ticketsApproved / ticketsTotal) * 100 : 0;

   // ─── Chart Data (last 7 days) ────────────────────────────────
   const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
   }).reverse();

   const chartData = last7Days.map(date => {
      const dayApproved = approvedPurchases.filter(p => p.created_at.startsWith(date));
      const value = dayApproved.reduce((sum, p) => sum + (p.tickets?.length || 0), 0);
      return {
         name: date.split('-').reverse().slice(0, 2).join('/'),
         value
      };
   });

   const menuItems = [
      { icon: 'info', label: 'Detalhes da Campanha', tab: 'details' as const },
      { icon: 'show_chart', label: 'Histórico de Vendas', tab: 'sales' as const },
      { icon: 'star', label: 'Melhorias na Campanha', tab: null },
      { icon: 'emoji_events', label: 'Bilhetes Premiados', tab: null },
      { icon: 'card_giftcard', label: 'Caixas/Roletas Premiadas', tab: null },
      { icon: 'bar_chart', label: 'Maior ou Menor Cota', tab: null },
      { icon: 'schedule', label: 'Horário Premiado', tab: null },
      { icon: 'groups', label: 'Ranking', tab: 'ranking' as const },
      { icon: 'emoji_events', label: 'Sortear', tab: 'raffle' as const },
   ];

   return (
      <div className="bg-[#F9FAFB] dark:bg-[#121212] text-slate-900 dark:text-slate-100 min-h-screen font-sans flex">
         <div className="hidden lg:block h-screen sticky top-0">
            <Sidebar />
         </div>
         <div className="flex-1 flex flex-col min-h-screen relative">
            <Header />
            <main className="px-4 py-2 space-y-6 pb-24 lg:pb-8 lg:px-8 max-w-6xl w-full mx-auto">
               <div className="flex items-center gap-2 mb-4">
                  <h1 className="text-xl font-bold">Gerenciador</h1>
               </div>

               {/* Grid Menu */}
               <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                  {menuItems.map((item, index) => {
                     const isActive = item.tab ? activeTab === item.tab : false;
                     return (
                        <div
                           key={index}
                           onClick={() => item.tab && setActiveTab(item.tab)}
                           className={`flex flex-col items-center justify-center p-3 rounded-xl border cursor-pointer transition-colors ${isActive ? 'bg-[#1E1E1E] border-[#6366F1] text-[#6366F1]' : 'bg-[#1E1E1E] border-slate-800 text-slate-400 hover:border-slate-600'}`}
                        >
                           <span className="material-icons-outlined mb-1">{item.icon}</span>
                           <span className="text-[10px] text-center font-medium leading-tight">{item.label}</span>
                        </div>
                     );
                  })}
               </div>

               {/* ── Sales History Tab ── */}
               {activeTab === 'sales' && (
                  <SalesHistoryView
                     campaignId={campaign.id}
                     purchases={purchases}
                     loading={loadingPurchases}
                     refreshPurchases={fetchPurchases}
                     handleStatusChange={handleStatusChange}
                  />
               )}

               {/* ── Ranking Tab ── */}
               {activeTab === 'ranking' && (
                  <RankingManager campaign={campaign} />
               )}

               {/* ── Raffle Tab ── */}
               {activeTab === 'raffle' && (
                  <RaffleManager campaign={campaign} />
               )}

               {/* ── Details Tab ── */}
               {activeTab === 'details' && (
                  <>
                     {/* Campaign Details Card */}
                     <div className="space-y-2">
                        <h2 className="text-lg font-bold">Detalhes</h2>
                        <div className="bg-[#1E1E1E] rounded-xl border border-slate-800 p-4 flex flex-col md:flex-row items-center gap-4">
                           <div className="w-24 h-24 bg-white rounded-lg overflow-hidden flex-shrink-0">
                              {(() => {
                                 let imgUrl = campaign.image || '';
                                 if (imgUrl.startsWith('[') || imgUrl.startsWith('{')) {
                                    try {
                                       const parsed = JSON.parse(imgUrl);
                                       imgUrl = Array.isArray(parsed) ? parsed[0] : imgUrl;
                                    } catch (e) { }
                                 }
                                 return (
                                    <img
                                       src={imgUrl || 'https://via.placeholder.com/400x400?text=Sem+Imagem'}
                                       alt={campaign.title}
                                       className="w-full h-full object-contain p-1"
                                       referrerPolicy="no-referrer"
                                    />
                                 );
                              })()}
                           </div>
                           <div className="flex-1 w-full">
                              <div className="flex justify-between items-start">
                                 <div>
                                    <span className="text-xs text-slate-500 uppercase font-bold">Título</span>
                                    <h3 className="text-lg font-bold text-white">{campaign.title}</h3>
                                 </div>
                                 <div className="flex gap-2">
                                    <Link to={`/campaigns/${campaign.id}/edit`} className="bg-[#181818] hover:bg-[#252525] border border-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors">
                                       <span className="material-icons-outlined text-sm">edit</span> Editar
                                    </Link>
                                    <Link to={`/rifas/${campaign.slug}`} target="_blank" className="bg-[#181818] hover:bg-[#252525] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors">
                                       <span className="material-icons-outlined text-sm">open_in_new</span>
                                    </Link>
                                    <button className="bg-[#181818] hover:bg-[#252525] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors">
                                       <span className="material-icons-outlined text-sm">share</span>
                                    </button>
                                    <button className="bg-[#181818] hover:bg-[#252525] border border-slate-700 text-slate-400 hover:text-white p-1.5 rounded-lg transition-colors">
                                       <span className="material-icons-outlined text-sm">settings</span>
                                    </button>
                                 </div>
                              </div>
                              <div className="mt-4">
                                 <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-400">Progresso</span>
                                    <span className="bg-[#6366F1] text-white px-1.5 rounded text-[10px] font-bold">{progress.toFixed(0)}%</span>
                                 </div>
                                 <div className="w-full bg-slate-800 rounded-full h-2">
                                    <div className="bg-gradient-to-r from-[#6366F1] to-[#818cf8] h-2 rounded-full relative" style={{ width: `${progress}%` }}>
                                       <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-white rounded-full shadow-lg" />
                                    </div>
                                 </div>
                              </div>
                           </div>
                        </div>
                     </div>

                     {/* Faturamento e Reservas */}
                     <div className="bg-[#1E1E1E] rounded-xl border border-slate-800 overflow-hidden">
                        <div className="p-4 border-b border-slate-800">
                           <h2 className="text-lg font-bold text-white">Faturamento e Reservas</h2>
                           <p className="text-xs text-slate-500">Visualize o faturamento e as reservas da sua rifa ao longo do tempo</p>
                        </div>
                        <div className="p-4 space-y-6">
                           <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-center mb-2">
                                 <span className="text-xs text-slate-500">Faturamento</span>
                                 <button onClick={() => setShowBalance(!showBalance)} className="text-slate-500 hover:text-white">
                                    <span className="material-icons-outlined text-sm">visibility</span>
                                 </button>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                 {[
                                    { icon: '$', color: 'text-emerald-500', label: 'Total aprovado', value: showBalance ? `R$ ${totalApprovedValue.toFixed(2).replace('.', ',')}` : 'R$ ****' },
                                    { icon: '$', color: 'text-orange-500', label: 'Total pendente', value: showBalance ? `R$ ${totalPendingValue.toFixed(2).replace('.', ',')}` : 'R$ ****' },
                                    { icon: 'check_circle', color: 'text-blue-500', label: 'Bilhetes aprovados', value: ticketsApproved.toString(), isIcon: true },
                                    { icon: 'confirmation_number', color: 'text-orange-500', label: 'Bilhetes pendentes', value: ticketsPending.toString(), isIcon: true },
                                 ].map((stat) => (
                                    <div key={stat.label} className="bg-[#181818] border border-slate-800 rounded-lg p-3 flex items-center gap-2">
                                       {stat.isIcon ? (
                                          <span className={`material-icons-outlined ${stat.color} text-sm`}>{stat.icon}</span>
                                       ) : (
                                          <span className={`${stat.color} font-bold`}>{stat.icon}</span>
                                       )}
                                       <div>
                                          <p className="text-[10px] text-slate-500">{stat.label}</p>
                                          <p className={`${stat.color} font-bold text-sm`}>{stat.value}</p>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div>
                              <p className="text-xs text-slate-500 mb-2">Compras e reservas</p>
                              <div className="grid grid-cols-4 text-center border-b border-slate-800 pb-2 mb-2">
                                 {['Bilhetes', 'Disponíveis', 'Reservados', 'Comprados'].map((h) => (
                                    <span key={h} className="text-xs text-slate-500">{h}</span>
                                 ))}
                              </div>
                              <div className="grid grid-cols-4 text-center">
                                 <span className="text-xl font-bold text-white">{ticketsTotal}</span>
                                 <span className="text-xl font-bold text-white">{ticketsAvailable}</span>
                                 <span className="text-xl font-bold text-white">{ticketsPending}</span>
                                 <span className="text-xl font-bold text-white">{ticketsApproved}</span>
                              </div>
                           </div>

                           <div>
                              <div className="flex justify-between items-center mb-4">
                                 <p className="text-xs text-slate-500">Vendas p/dia</p>
                                 <div className="bg-[#181818] border border-slate-800 rounded px-2 py-1 flex items-center gap-1 text-xs text-white">
                                    <span className="material-icons-outlined text-sm">calendar_today</span>
                                    {chartData[0].name.replace('/', '-')} - {chartData[chartData.length - 1].name.replace('/', '-')}
                                 </div>
                              </div>
                              <div className="h-64 w-full bg-[#181818] rounded-xl p-4">
                                 <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                       <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                       <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} orientation="right" />
                                       <Tooltip
                                          contentStyle={{ backgroundColor: '#1E1E1E', borderColor: '#334155', color: '#fff' }}
                                          itemStyle={{ color: '#fff' }}
                                          cursor={{ fill: 'transparent' }}
                                       />
                                       <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                          {chartData.map((_, i) => <Cell key={i} fill="#6366F1" />)}
                                       </Bar>
                                    </BarChart>
                                 </ResponsiveContainer>
                              </div>
                           </div>
                        </div>
                     </div>
                  </>
               )}
            </main>
         </div>
      </div>
   );
}
