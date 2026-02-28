import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CampaignProvider } from './context/CampaignContext';
import { PaymentProvider } from './context/PaymentContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocialNetworkProvider } from './context/SocialNetworkContext';
import Login from './pages/Login';
import Profile from './pages/Profile';
import NewCampaign from './pages/NewCampaign';
import CampaignEditGeneral from './pages/CampaignEditGeneral';
import CampaignEditMedia from './pages/CampaignEditMedia';
import CampaignEditPrizes from './pages/CampaignEditPrizes';
import CampaignDashboard from './pages/CampaignDashboard';
import CampaignManager from './pages/CampaignManager';
import PaymentMethods from './pages/PaymentMethods';
import CustomizeRaffles from './pages/CustomizeRaffles';
import RafflePage from './pages/RafflePage';
import RedirectToRaffle from './pages/RedirectToRaffle';
import SocialNetworks from './pages/Social';

export default function App() {
  return (
    <ThemeProvider>
      <PaymentProvider>
        <SocialNetworkProvider>
          <CampaignProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/dashboard" element={<CampaignDashboard />} />
                <Route path="/pix" element={<PaymentMethods />} />
                <Route path="/social" element={<SocialNetworks />} />
                <Route path="/customize" element={<CustomizeRaffles />} />
                {/* Route updated */}
                <Route path="/campaigns/new" element={<NewCampaign />} />
                <Route path="/campaigns/:id/setup" element={<NewCampaign />} />
                <Route path="/campaigns/:id/manage" element={<CampaignManager />} />
                <Route path="/campaigns/:id/edit" element={<CampaignEditGeneral />} />
                <Route path="/campaigns/:id/media" element={<CampaignEditMedia />} />
                <Route path="/campaigns/:id/prizes" element={<CampaignEditPrizes />} />
                <Route path="/rifas/:slug" element={<RafflePage />} />
                <Route path="/r/:id" element={<RedirectToRaffle />} />
              </Routes>
            </BrowserRouter>
          </CampaignProvider>
        </SocialNetworkProvider>
      </PaymentProvider>
    </ThemeProvider>
  );
}
