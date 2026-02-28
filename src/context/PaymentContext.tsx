import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

interface PixManualConfig {
    keyType: string;
    pixKey: string;
    accountHolder: string;
    isConfigured: boolean;
}

interface PaymentContextType {
    pixManual: PixManualConfig;
    setPixManual: (config: PixManualConfig) => Promise<void>;
    loading: boolean;
}

const PaymentContext = createContext<PaymentContextType | undefined>(undefined);

export function PaymentProvider({ children }: { children: React.ReactNode }) {
    const [loading, setLoading] = useState(true);
    const [pixManual, setPixManualState] = useState<PixManualConfig>(() => {
        const saved = localStorage.getItem('pix_manual_config');
        return saved ? JSON.parse(saved) : {
            keyType: '',
            pixKey: '',
            accountHolder: '',
            isConfigured: false
        };
    });

    useEffect(() => {
        fetchPaymentConfig();

        // Listen for auth changes to reload config
        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchPaymentConfig();
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchPaymentConfig = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('payment_methods_config')
                .eq('id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching payment config:', error);
                return;
            }

            if (data?.payment_methods_config?.pixManual) {
                setPixManualState(data.payment_methods_config.pixManual);
                localStorage.setItem('pix_manual_config', JSON.stringify(data.payment_methods_config.pixManual));
            }
        } catch (error) {
            console.error('Error in fetchPaymentConfig:', error);
        } finally {
            setLoading(false);
        }
    };

    const setPixManual = async (config: PixManualConfig) => {
        setPixManualState(config);
        localStorage.setItem('pix_manual_config', JSON.stringify(config));

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                return;
            }

            // Fetch current config first to merge
            const { data: profile } = await supabase
                .from('profiles')
                .select('payment_methods_config')
                .eq('id', user.id)
                .maybeSingle();

            const currentConfig = profile?.payment_methods_config || {};

            const { error } = await supabase
                .from('profiles')
                .update({
                    payment_methods_config: {
                        ...currentConfig,
                        pixManual: config
                    }
                })
                .eq('id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error saving payment config:', error);
        }
    };

    return (
        <PaymentContext.Provider value={{ pixManual, setPixManual, loading }}>
            {children}
        </PaymentContext.Provider>
    );
}

export function usePayment() {
    const context = useContext(PaymentContext);
    if (context === undefined) {
        throw new Error('usePayment must be used within a PaymentProvider');
    }
    return context;
}
