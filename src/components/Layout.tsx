import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from './Navbar';
import Footer from './Footer';
import MobileBottomNav from './MobileBottomNav';
import ActiveOperationsBar from './ActiveOperationsBar';
import NetworkBanner from './NetworkBanner';
import OnboardingOverlay, { shouldShowOnboarding } from './OnboardingOverlay';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [onboardingPending, setOnboardingPending] = useState(shouldShowOnboarding);
  // Onboarding : première visite uniquement, sur l'accueil (jamais sur un lien
  // profond partagé — resto, checkout — où l'overlay casserait le parcours),
  // et jamais pour un utilisateur déjà connecté (compte antérieur au flag).
  const showOnboarding = onboardingPending && !authLoading && !user && location.pathname === '/';

  return (
    <div className="min-h-screen bg-bg-main font-inter">
      <Navbar />
      <NetworkBanner topOffset={72} />
      <main>{children}</main>
      <Footer />
      <ActiveOperationsBar />
      <MobileBottomNav />
      {showOnboarding && <OnboardingOverlay onClose={() => setOnboardingPending(false)} />}
    </div>
  );
}
