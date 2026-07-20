import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchMyFoodRequests, acceptBid, cancelFoodRequest, type FoodRequest } from '../lib/foodRequests';
import PageHeader from '../components/PageHeader';
import { UtensilsCrossed, MapPin, Clock, CheckCircle2, XCircle, Timer, MessageCircle, ChevronRight, Plus, Sparkles } from 'lucide-react';

const STATUS_CONFIG: Record<FoodRequest['status'], { label: string; color: string; icon: typeof Timer }> = {
  open: { label: 'En attente', color: 'bg-gold-light text-amber-700 border-gold-accent/30', icon: Timer },
  accepted: { label: 'Acceptée', color: 'bg-green-light text-green-primary border-green-primary/30', icon: CheckCircle2 },
  expired: { label: 'Expirée', color: 'bg-bg-secondary text-text-muted border-border-custom', icon: XCircle },
  cancelled: { label: 'Annulée', color: 'bg-error/5 text-error border-error/30', icon: XCircle },
};

function formatBudget(min: number, max: number) {
  return `${min.toLocaleString()} – ${max.toLocaleString()} FCFA`;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "À l'instant";
  if (hours < 24) return `Il y a ${hours}h`;
  return `Il y a ${Math.floor(hours / 24)}j`;
}

function expiresIn(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 'Expiré';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h restantes`;
  return `${Math.floor(hours / 24)}j restants`;
}

export default function FoodRequestList() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<FoodRequest | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const justCreated = (location.state as { justCreated?: boolean } | null)?.justCreated;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/demandes/mes-demandes' } });
    }
  }, [authLoading, user, navigate]);

  const load = useCallback(async () => {
    if (!user) return;
    const data = await fetchMyFoodRequests(user.id);
    setRequests(data);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const handleAcceptBid = async (requestId: string, bidId: string) => {
    setAccepting(bidId);
    try {
      await acceptBid(requestId, bidId);
      await load();
      setSelectedRequest(null);
    } finally {
      setAccepting(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Annuler cette demande ?')) return;
    await cancelFoodRequest(requestId);
    load();
  };

  if (authLoading || loading) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary pb-16">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-6">
        <PageHeader
          icon={UtensilsCrossed}
          title="Mes demandes"
          subtitle="Gérez vos demandes culinaires et les offres reçues"
          action={
            <Link
              to="/demandes/nouvelle"
              className="flex items-center gap-2 px-4 h-10 bg-white/15 hover:bg-white/25 text-white rounded-lg text-sm font-inter font-semibold backdrop-blur-sm transition-colors"
            >
              <Plus className="w-4 h-4" /> Nouvelle
            </Link>
          }
        />

        {justCreated && (
          <div className="mb-6 p-4 bg-green-light border border-green-primary/20 rounded-xl flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-green-primary shrink-0" />
            <div>
              <p className="text-sm font-inter font-medium text-green-primary">Demande publiée avec succès !</p>
              <p className="text-xs font-inter text-green-primary/80">Les restaurants de votre ville peuvent maintenant soumissionner.</p>
            </div>
          </div>
        )}

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-12 text-center">
            <UtensilsCrossed className="w-12 h-12 mx-auto text-text-muted mb-4" />
            <h3 className="text-lg font-poppins font-semibold text-text-primary mb-2">Aucune demande pour le moment</h3>
            <p className="text-sm font-inter text-text-secondary mb-6">Publiez votre première demande et laissez les restaurants vous faire des propositions !</p>
            <Link
              to="/demandes/nouvelle"
              className="inline-flex items-center gap-2 px-6 h-11 bg-green-primary text-white rounded-xl font-inter font-semibold hover:bg-green-dark transition-all"
            >
              <Plus className="w-4 h-4" /> Créer une demande
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((req) => {
              const statusCfg = STATUS_CONFIG[req.status];
              const StatusIcon = statusCfg.icon;
              const acceptedBid = req.bids.find((b) => b.id === req.acceptedBidId);

              return (
                <div key={req.id} className="bg-white rounded-2xl border border-border-custom shadow-sm overflow-hidden hover:shadow-md transition-all">
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-inter font-semibold text-text-primary truncate">{req.title}</h3>
                        <p className="text-sm font-inter text-text-secondary mt-1 line-clamp-2">{req.description}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-inter font-medium border ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs font-inter text-text-muted mb-3">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {req.city}</span>
                      <span className="flex items-center gap-1">💰 {formatBudget(req.budgetMin, req.budgetMax)}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {expiresIn(req.expiresAt)}</span>
                      {req.bids.length > 0 && (
                        <span className="flex items-center gap-1 text-green-primary font-medium">
                          <MessageCircle className="w-3 h-3" /> {req.bids.length} offre{req.bids.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {req.dietaryTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {req.dietaryTags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-bg-secondary text-text-secondary rounded-full text-xs font-inter">{tag}</span>
                        ))}
                      </div>
                    )}

                    {acceptedBid && (
                      <div className="p-3 bg-green-light border border-green-primary/20 rounded-xl mb-3">
                        <p className="text-sm font-inter font-medium text-green-primary">
                          ✅ Acceptée : {acceptedBid.restaurantName} — {acceptedBid.price.toLocaleString()} FCFA
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {req.status === 'open' && req.bids.length > 0 && (
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1.5 px-4 h-9 bg-green-primary text-white rounded-lg text-sm font-inter font-medium hover:bg-green-dark transition-all"
                        >
                          Voir les offres ({req.bids.length}) <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {req.status === 'open' && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="px-4 h-9 text-text-secondary hover:text-error text-sm font-inter transition-colors"
                        >
                          Annuler
                        </button>
                      )}
                      {req.status === 'accepted' && acceptedBid && (
                        <Link
                          to="/commandes"
                          className="flex items-center gap-1.5 px-4 h-9 bg-bg-secondary text-text-secondary rounded-lg text-sm font-inter font-medium hover:bg-border-light transition-all"
                        >
                          Voir la commande
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bid selection modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedRequest(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-border-light px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-poppins font-bold text-text-primary">Offres reçues</h3>
                <button onClick={() => setSelectedRequest(null)} className="p-1 text-text-muted hover:text-text-primary">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm font-inter text-text-secondary truncate">{selectedRequest.title}</p>
            </div>
            <div className="p-6 space-y-4">
              {selectedRequest.bids.map((bid) => (
                <div
                  key={bid.id}
                  className={`p-4 rounded-xl border ${bid.status === 'accepted' ? 'bg-green-light border-green-primary/30' : bid.status === 'rejected' ? 'bg-bg-secondary border-border-custom opacity-50' : 'bg-white border-border-custom hover:border-green-primary/30 transition-all'
                    }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-inter font-semibold text-text-primary">{bid.restaurantName}</p>
                      <p className="text-lg font-poppins font-bold text-green-primary mt-1">{bid.price.toLocaleString()} FCFA</p>
                    </div>
                    {bid.status === 'pending' && (
                      <button
                        onClick={() => handleAcceptBid(selectedRequest.id, bid.id)}
                        disabled={accepting === bid.id}
                        className="px-4 h-9 bg-green-primary hover:bg-green-dark disabled:opacity-60 text-white rounded-lg text-sm font-inter font-semibold transition-all"
                      >
                        {accepting === bid.id ? '...' : 'Accepter'}
                      </button>
                    )}
                    {bid.status === 'accepted' && <CheckCircle2 className="w-6 h-6 text-green-primary" />}
                    {bid.status === 'rejected' && <XCircle className="w-6 h-6 text-text-muted" />}
                  </div>
                  {bid.comment && (
                    <p className="text-sm font-inter text-text-secondary bg-bg-secondary rounded-lg p-3 mt-2 italic">"{bid.comment}"</p>
                  )}
                  <p className="text-xs font-inter text-text-muted mt-2">{timeAgo(bid.createdAt)}</p>
                </div>
              ))}
              {selectedRequest.bids.length === 0 && (
                <p className="text-center text-text-muted font-inter py-8">Aucune offre pour le moment. Patience !</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
