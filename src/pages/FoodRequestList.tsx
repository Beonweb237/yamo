import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { UtensilsCrossed, MapPin, Clock, CheckCircle2, XCircle, Timer, MessageCircle, ChevronRight, Plus, Sparkles } from 'lucide-react';

interface Bid {
  id: string;
  restaurantId: string;
  restaurantName: string;
  price: number;
  comment: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
}

interface FoodRequest {
  id: string;
  title: string;
  description: string;
  city: string;
  budgetMin: number;
  budgetMax: number;
  dietaryTags: string[];
  status: 'open' | 'accepted' | 'expired' | 'cancelled';
  bidCount: number;
  bids: Bid[];
  createdAt: string;
  expiresAt: string;
  acceptedBidId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: 'En attente', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Timer },
  accepted: { label: 'Acceptée', color: 'bg-green-50 text-green-700 border-green-200', icon: CheckCircle2 },
  expired: { label: 'Expirée', color: 'bg-gray-50 text-gray-500 border-gray-200', icon: XCircle },
  cancelled: { label: 'Annulée', color: 'bg-red-50 text-red-500 border-red-200', icon: XCircle },
};

function formatBudget(min: number, max: number) {
  return `${min.toLocaleString()} – ${max.toLocaleString()} FCFA`;
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'À l\'instant';
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}

function expiresIn(date: string) {
  const diff = new Date(date).getTime() - Date.now();
  if (diff <= 0) return 'Expiré';
  const hours = Math.floor(diff / 3600000);
  if (hours < 24) return `${hours}h restantes`;
  return `${Math.floor(hours / 24)}j restants`;
}

export default function FoodRequestList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [requests, setRequests] = useState<FoodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<FoodRequest | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const justCreated = (location.state as any)?.justCreated;

  const fetchRequests = async () => {
    try {
      const { data, error: apiError } = await supabase
        .from('food-requests')
        .select('*')
        .order('created_at', { ascending: false });
      // Use the /mine endpoint instead
      const token = localStorage.getItem('miamexpress_session');
      const session = token ? JSON.parse(token) : null;
      const res = await fetch(`${(window as any).__API_BASE__ || ''}/api/food-requests/mine`, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setRequests(json.data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleAcceptBid = async (requestId: string, bidId: string) => {
    setAccepting(bidId);
    try {
      const token = localStorage.getItem('miamexpress_session');
      const session = token ? JSON.parse(token) : null;
      const res = await fetch(`${(window as any).__API_BASE__ || ''}/api/food-requests/${requestId}/accept/${bidId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error); }
      fetchRequests();
      setSelectedRequest(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAccepting(null);
    }
  };

  const handleCancel = async (requestId: string) => {
    if (!confirm('Annuler cette demande ?')) return;
    try {
      const token = localStorage.getItem('miamexpress_session');
      const session = token ? JSON.parse(token) : null;
      await fetch(`${(window as any).__API_BASE__ || ''}/api/food-requests/${requestId}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      });
      fetchRequests();
    } catch (err: any) { alert(err.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#FF6B35] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] pt-8 pb-20">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">🍽️ Mes demandes</h1>
            <p className="text-sm text-gray-500 mt-1">Gérez vos demandes culinaires et les offres reçues</p>
          </div>
          <Link
            to="/demandes/nouvelle"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FF6B35] text-white rounded-xl text-sm font-semibold hover:bg-[#E55A2B] transition-all shadow-lg shadow-[#FF6B35]/20"
          >
            <Plus size={16} /> Nouvelle
          </Link>
        </div>

        {justCreated && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
            <Sparkles size={20} className="text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-800">Demande publiée avec succès !</p>
              <p className="text-xs text-green-600">Les restaurants de votre ville peuvent maintenant soumissionner.</p>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
        )}

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <UtensilsCrossed size={48} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune demande pour le moment</h3>
            <p className="text-sm text-gray-500 mb-6">Publiez votre première demande et laissez les restaurants vous faire des propositions !</p>
            <Link
              to="/demandes/nouvelle"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#FF6B35] text-white rounded-xl font-semibold hover:bg-[#E55A2B] transition-all"
            >
              <Plus size={18} /> Créer une demande
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(req => {
              const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.open;
              const StatusIcon = statusCfg.icon;
              const acceptedBid = req.bids?.find(b => b.status === 'accepted');

              return (
                <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all">
                  {/* Header */}
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">{req.title}</h3>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{req.description}</p>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${statusCfg.color}`}>
                        <StatusIcon size={12} /> {statusCfg.label}
                      </span>
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {req.city}</span>
                      <span className="flex items-center gap-1">💰 {formatBudget(req.budgetMin, req.budgetMax)}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {expiresIn(req.expiresAt)}</span>
                      {req.bidCount > 0 && (
                        <span className="flex items-center gap-1 text-[#FF6B35] font-medium">
                          <MessageCircle size={12} /> {req.bidCount} offre{req.bidCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Dietary tags */}
                    {req.dietaryTags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {req.dietaryTags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Accepted bid summary */}
                    {acceptedBid && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl mb-3">
                        <p className="text-sm font-medium text-green-800">✅ Acceptée : {acceptedBid.restaurantName} — {acceptedBid.price.toLocaleString()} FCFA</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      {req.status === 'open' && req.bids?.length > 0 && (
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-[#FF6B35] text-white rounded-lg text-sm font-medium hover:bg-[#E55A2B] transition-all"
                        >
                          Voir les offres ({req.bids.length}) <ChevronRight size={14} />
                        </button>
                      )}
                      {req.status === 'open' && (
                        <button
                          onClick={() => handleCancel(req.id)}
                          className="px-4 py-2 text-gray-500 hover:text-red-500 text-sm transition-colors"
                        >
                          Annuler
                        </button>
                      )}
                      {req.status === 'accepted' && acceptedBid && (
                        <Link
                          to={`/commandes`}
                          className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all"
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
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Offres reçues</h3>
                <button onClick={() => setSelectedRequest(null)} className="p-1 text-gray-400 hover:text-gray-600">
                  <XCircle size={20} />
                </button>
              </div>
              <p className="text-sm text-gray-500 truncate">{selectedRequest.title}</p>
            </div>
            <div className="p-6 space-y-4">
              {selectedRequest.bids?.map(bid => (
                <div key={bid.id} className={`p-4 rounded-xl border ${bid.status === 'accepted' ? 'bg-green-50 border-green-200' : bid.status === 'rejected' ? 'bg-gray-50 border-gray-200 opacity-50' : 'bg-white border-gray-200 hover:border-[#FF6B35]/30 transition-all'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{bid.restaurantName}</p>
                      <p className="text-lg font-bold text-[#FF6B35] mt-1">{bid.price.toLocaleString()} FCFA</p>
                    </div>
                    {bid.status === 'pending' && (
                      <button
                        onClick={() => handleAcceptBid(selectedRequest.id, bid.id)}
                        disabled={accepting === bid.id}
                        className="px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold transition-all"
                      >
                        {accepting === bid.id ? '...' : 'Accepter'}
                      </button>
                    )}
                    {bid.status === 'accepted' && <CheckCircle2 size={24} className="text-green-500" />}
                    {bid.status === 'rejected' && <XCircle size={24} className="text-gray-400" />}
                  </div>
                  {bid.comment && (
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-2 italic">"{bid.comment}"</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">{timeAgo(bid.createdAt)}</p>
                </div>
              ))}
              {(!selectedRequest.bids || selectedRequest.bids.length === 0) && (
                <p className="text-center text-gray-400 py-8">Aucune offre pour le moment. Patience ! ⏳</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
