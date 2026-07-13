import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyApplications, type Application } from '../lib/applications';
import ApplicationForm from '../components/ApplicationForm';

export default function Candidature() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [existingApp, setExistingApp] = useState<Application | null>(null);

  const type = user?.role === 'restaurant' ? 'restaurant' : user?.role === 'livreur' ? 'livreur' : null;

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/candidature' } });
    }
  }, [authLoading, user, navigate]);

  // Check for existing application
  useEffect(() => {
    if (!user || !type) { setChecking(false); return; }
    let cancelled = false;
    setChecking(true);
    fetchMyApplications(user.id)
      .then((apps) => {
        if (cancelled) return;
        setExistingApp(apps.find((a) => a.type === type) ?? null);
      })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [user, type]);

  if (authLoading || checking) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <p className="text-text-secondary font-inter text-sm">Vérification de votre dossier...</p>
      </div>
    );
  }

  // Already has an application → show status
  if (existingApp) {
    const cfg = {
      pending: { icon: Clock, color: 'text-gold-accent', bg: 'bg-gold-light', title: "Candidature en cours d'examen", msg: 'Notre équipe vous contactera sous 24-48h.' },
      rejected: { icon: XCircle, color: 'text-error', bg: 'bg-error/10', title: 'Candidature rejetée', msg: existingApp.rejectionReason ? `Motif : ${existingApp.rejectionReason}` : 'Contactez notre support.' },
      approved: { icon: CheckCircle2, color: 'text-success', bg: 'bg-green-light', title: 'Candidature approuvée', msg: 'Votre compte est déjà validé.' },
    }[existingApp.status];
    const Icon = cfg.icon;

    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-xl border border-border-custom p-8 text-center my-12">
          <div className={`w-14 h-14 rounded-full ${cfg.bg} flex items-center justify-center mx-auto mb-4`}>
            <Icon className={`w-7 h-7 ${cfg.color}`} />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">{cfg.title}</h1>
          <p className="text-text-secondary font-inter text-sm mb-6">{cfg.msg}</p>
          {existingApp.status === 'approved' ? (
            <button onClick={() => navigate(type === 'restaurant' ? '/partenaires/dashboard' : '/livreurs/dashboard')}
              className="bg-green-primary text-white font-inter font-semibold px-6 h-11 rounded-lg hover:bg-green-dark">
              Accéder à mon espace
            </button>
          ) : (
            <button onClick={() => navigate('/')}
              className="bg-green-primary text-white font-inter font-semibold px-6 h-11 rounded-lg hover:bg-green-dark">
              Retour à l'accueil
            </button>
          )}
        </div>
      </div>
    );
  }

  // No existing application → show the form
  if (!type) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <p className="text-text-secondary font-inter text-sm">Rôle non reconnu.</p>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary px-4 py-8">
      <div className="max-w-[560px] mx-auto">
        <ApplicationForm type={type} />
      </div>
    </div>
  );
}
