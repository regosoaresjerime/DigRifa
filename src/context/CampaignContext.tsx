import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface Campaign {
  id: string;
  slug: string;
  title: string;
  description?: string;
  ticketQuantity: number;
  ticketValue: string;
  selectionMethod: string;
  drawMethod: string;
  status: string;
  created?: string;
  image?: string;
  minTickets?: number;
  maxTickets?: number;
  paymentTime?: string;
  prizes?: any[];
  promotions?: any[];
  drawDate?: string;
  drawResults?: any[];
  webhookUrl?: string; // New field for persistence
}

interface CampaignContextType {
  campaigns: Campaign[];
  loading: boolean;
  addCampaign: (campaign: Omit<Campaign, 'id'>) => Promise<void>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  getCampaign: (id: string) => Campaign | undefined;
  deleteCampaign: (id: string) => Promise<void>;
  refreshCampaigns: () => Promise<void>;
}

const CampaignContext = createContext<CampaignContextType | undefined>(undefined);

export function CampaignProvider({ children }: { children: React.ReactNode }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB fields to local state fields if necessary
      const mappedData = (data || []).map(item => ({
        ...item,
        ticketQuantity: item.ticket_quantity,
        ticketValue: item.ticket_value,
        selectionMethod: item.selection_method,
        drawMethod: item.draw_method,
        minTickets: item.min_tickets,
        maxTickets: item.max_tickets,
        paymentTime: item.payment_time,
        drawDate: item.draw_date,
        drawResults: item.draw_results || [],
        webhookUrl: item.webhook_url, // Map DB field
        created: new Date(item.created_at).toLocaleString('pt-BR')
      }));

      console.log('Campaigns fetched from DB:', data);
      setCampaigns(mappedData);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCampaign = async (campaign: Omit<Campaign, 'id'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          user_id: user.id,
          slug: campaign.slug,
          title: campaign.title,
          description: campaign.description,
          ticket_quantity: campaign.ticketQuantity,
          ticket_value: campaign.ticketValue,
          selection_method: campaign.selectionMethod,
          draw_method: campaign.drawMethod,
          status: campaign.status,
          image: campaign.image,
          min_tickets: campaign.minTickets,
          max_tickets: campaign.maxTickets,
          payment_time: campaign.paymentTime,
          prizes: campaign.prizes || [],
          promotions: campaign.promotions || [],
          draw_date: campaign.drawDate,
          draw_results: campaign.drawResults || [],
          webhook_url: campaign.webhookUrl // Insert
        }])
        .select()
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
          throw new Error('Erro ao criar campanha: Nenhum dado retornado.');
      }

      await fetchCampaigns(); // Refresh list
      return data; // Retorna os dados inseridos, incluindo o ID
    } catch (error) {
      console.error('Error adding campaign:', error);
      throw error;
    }
  };

  const updateCampaign = async (id: string, updates: Partial<Campaign>) => {
    try {
      const dbUpdates: any = { ...updates };

      // Map local field names back to DB field names and delete camelCase keys
      if (updates.ticketQuantity !== undefined) { dbUpdates.ticket_quantity = updates.ticketQuantity; delete dbUpdates.ticketQuantity; }
      if (updates.ticketValue !== undefined) { dbUpdates.ticket_value = updates.ticketValue; delete dbUpdates.ticketValue; }
      if (updates.selectionMethod !== undefined) { dbUpdates.selection_method = updates.selectionMethod; delete dbUpdates.selectionMethod; }
      if (updates.drawMethod !== undefined) { dbUpdates.draw_method = updates.drawMethod; delete dbUpdates.drawMethod; }
      if (updates.minTickets !== undefined) { dbUpdates.min_tickets = updates.minTickets; delete dbUpdates.minTickets; }
      if (updates.maxTickets !== undefined) { dbUpdates.max_tickets = updates.maxTickets; delete dbUpdates.maxTickets; }
      if (updates.paymentTime !== undefined) { dbUpdates.payment_time = updates.paymentTime; delete dbUpdates.paymentTime; }
      if (updates.drawDate !== undefined) { dbUpdates.draw_date = updates.drawDate; delete dbUpdates.drawDate; }
      if (updates.drawResults !== undefined) { dbUpdates.draw_results = updates.drawResults; delete dbUpdates.drawResults; }
      if (updates.webhookUrl !== undefined) { dbUpdates.webhook_url = updates.webhookUrl; delete dbUpdates.webhookUrl; }

      const { data: { user } } = await supabase.auth.getUser();
      console.log('Tentando atualizar campanha (v2):', id, dbUpdates);
      console.log('Usuário Logado:', user?.id);

      // Verificação de segurança local para debug
      const { data: checkOwner } = await supabase
        .from('campaigns')
        .select('user_id')
        .eq('id', id)
        .maybeSingle();
      
      console.log('[DEBUG RLS] Info:', {
          campaignId: id,
          campaignOwner: checkOwner?.user_id,
          currentUser: user?.id,
          match: checkOwner?.user_id === user?.id
      });

      if (checkOwner && user?.id && checkOwner.user_id !== user.id) {
         console.warn(`[CRÍTICO] Mismatch de Usuário! Dono da campanha: ${checkOwner.user_id} vs Usuário Atual: ${user.id}`);
         throw new Error('Permissão negada: Você não é o dono desta campanha.');
      }

      const { data, error } = await supabase
        .from('campaigns')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Erro no Supabase ao atualizar campanha:', error);
        throw error;
      }

      if (!data) {
         const msg = `A atualização não foi salva. Verifique: 1) Se você está logado com a conta correta. 2) Se você rodou o script de banco de dados (FIX_DB.sql) no Supabase.`;
         console.warn(`Atenção: A atualização da campanha ${id} não retornou dados.`, msg);
         throw new Error(msg);
      }

      console.log('Campanha atualizada com sucesso no banco:', data);
      
      // Optimistically update local state with returned data
      if (data) {
        const mappedItem = {
           ...data,
           ticketQuantity: data.ticket_quantity,
           ticketValue: data.ticket_value,
           selectionMethod: data.selection_method,
           drawMethod: data.draw_method,
           minTickets: data.min_tickets,
           maxTickets: data.max_tickets,
           paymentTime: data.payment_time,
           drawDate: data.draw_date,
           drawResults: data.draw_results || [],
           webhookUrl: data.webhook_url, // Update local
           created: new Date(data.created_at).toLocaleString('pt-BR')
        };
        
        setCampaigns(prev => prev.map(c => c.id === id ? mappedItem : c));
      } else {
        // Fallback if no data returned
        await fetchCampaigns();
      }

    } catch (error) {
      console.error('Error updating campaign:', error);
      throw error;
    }
  };

  const getCampaign = (id: string) => {
    return campaigns.find(c => c.id === id || c.slug === id);
  };

  const deleteCampaign = async (idOrSlug: string) => {
    try {
      // Resolve o ID real caso tenha sido passado o slug
      const target = getCampaign(idOrSlug);
      const actualId = target ? target.id : idOrSlug;

      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', actualId);

      if (error) throw error;

      setCampaigns(prev => prev.filter(c => c.id !== actualId));
    } catch (error: any) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  };

  return (
    <CampaignContext.Provider value={{
      campaigns,
      loading,
      addCampaign,
      updateCampaign,
      getCampaign,
      deleteCampaign,
      refreshCampaigns: fetchCampaigns
    }}>
      {children}
    </CampaignContext.Provider>
  );
}

export function useCampaign() {
  const context = useContext(CampaignContext);
  if (context === undefined) {
    throw new Error('useCampaign must be used within a CampaignProvider');
  }
  return context;
}
