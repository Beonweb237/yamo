import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Wallet, Smartphone, Loader2, CheckCircle2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createOrder, type PaymentMethod } from '../lib/orders';
import { activeCities, getNeighborhoods } from '../data/locations';

interface SavedAddress {
  id: string;
  label: string;
  city: string;
  neighborhood: string;
  landmark: string;
  fullText: string;
}

const ADDRESSES_KEY = 'yamo_saved_addresses';

function readAddresses(): SavedAddress[] {
  try {
    return JSON.parse(localStorage.getItem(ADDRESSES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

const paymentOptions: {
  value: PaymentMethod;
  label: string;
  description: string;
  icon: typeof Wallet;
  swatch: string;
  confirmation: string;
}[] = [
    {
      value: 'cash',
      label: 'Paiement à la livraison',
      description: 'Espèces remises au livreur',
      icon: Wallet,
      swatch: 'bg-text-secondary',
      confirmation: 'Réglez en espèces directement au livreur à la remise de votre commande.',
    },
    {
      value: 'mtn_momo',
      label: 'MTN Mobile Money',
      description: 'Paiement via MTN MoMo',
      icon: Smartphone,
      swatch: 'bg-[#FFCC00]',
      confirmation: 'Vous recevrez une demande de confirmation MTN MoMo sur ce numéro. Validez-la pour finaliser le paiement.',
    },
    {
      value: 'orange_money',
      label: 'Orange Money',
      description: 'Paiement via Orange Money',
      icon: Smartphone,
      swatch: 'bg-[#FF6600]',
      confirmation: 'Vous recevrez une demande de confirmation Orange Money sur ce numéro. Validez-la pour finaliser le paiement.',
    },
  ];

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [useOtherNeighborhood, setUseOtherNeighborhood] = useState(false);
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const savedAddresses = useMemo(() => readAddresses(), []);

  const neighborhoods = getNeighborhoods(city);
  const effectiveNeighborhood = useOtherNeighborhood ? customNeighborhood.trim() : neighborhood;

  const applySavedAddress = (addr: SavedAddress) => {
    setCity(addr.city);
    const knownNeighborhoods = getNeighborhoods(addr.city);
    if (knownNeighborhoods.includes(addr.neighborhood)) {
      setUseOtherNeighborhood(false);
      setCustomNeighborhood('');
      setNeighborhood(addr.neighborhood);
    } else {
      setUseOtherNeighborhood(true);
      setCustomNeighborhood(addr.neighborhood);
      setNeighborhood('');
    }
    setLandmark(addr.landmark);
  };

  useEffect(() => {
    if (!useOtherNeighborhood && !neighborhoods.includes(neighborhood) && neighborhood) {
      setNeighborhood('');
    }
  }, [city, neighborhood, neighborhoods, useOtherNeighborhood]);

  useEffect(() => {
    if (!user) {
      navigate('/connexion', { state: { from: '/checkout' } });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (items.length === 0 && !placedOrderId) {
      navigate('/restaurants');
    }
  }, [items.length, placedOrderId, navigate]);

  const deliveryFee = 0;
  const total = totalPrice + deliveryFee;

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const restaurantId = items[0].item.restaurantId;
      const order = await createOrder({
        customerId: user.id,
        restaurantId,
        restaurantName: '',
        contactPhone: user.phone,
        items,
        subtotal: totalPrice,
        deliveryFee,
        total,
        paymentMethod,
        address: { city, neighborhood: effectiveNeighborhood, landmark, fullText: `${effectiveNeighborhood}, ${city} — ${landmark}` },
        notes,
      });
      setPlacedOrderId(order.id);
      clearCart();
    } catch {
      setError('Impossible de valider la commande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  if (placedOrderId) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-xl border border-border-custom shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-8 text-center my-12">
          <CheckCircle2 className="w-14 h-14 text-success mx-auto mb-4" />
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">
            Commande confirmée !
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-6">
            Référence : <span className="font-semibold text-text-primary">{placedOrderId.slice(0, 8)}</span>
          </p>
          <button
            onClick={() => navigate('/commandes')}
            className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors"
          >
            Suivre ma commande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      <div className="max-w-[720px] mx-auto px-4 sm:px-6 py-10">
        <h1 className="font-poppins font-bold text-text-primary text-2xl sm:text-3xl mb-6">
          Finaliser la commande
        </h1>

        {/* Address */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-green-primary" />
            <h2 className="font-poppins font-semibold text-text-primary text-lg">
              Adresse de livraison
            </h2>
          </div>

          {savedAddresses.length > 0 && (
            <div className="mb-4">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Adresses enregistrées
              </label>
              <select
                onChange={(e) => {
                  const addr = savedAddresses.find(a => a.id === e.target.value);
                  if (addr) applySavedAddress(addr);
                }}
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none"
                defaultValue=""
              >
                <option value="" disabled>Sélectionner une adresse</option>
                {savedAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label || addr.fullText}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Ville</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none"
              >
                {activeCities.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">Quartier</label>
              {useOtherNeighborhood ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="Nom de votre quartier"
                    className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setUseOtherNeighborhood(false); setCustomNeighborhood(''); }}
                    className="shrink-0 px-3 h-12 rounded-lg border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary"
                  >
                    Liste
                  </button>
                </div>
              ) : (
                <select
                  value={neighborhood}
                  onChange={(e) => {
                    if (e.target.value === '__other__') {
                      setUseOtherNeighborhood(true);
                      setNeighborhood('');
                    } else {
                      setNeighborhood(e.target.value);
                    }
                  }}
                  className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none"
                  required
                >
                  <option value="">Sélectionnez un quartier</option>
                  {neighborhoods.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="__other__">Mon quartier n&apos;est pas listé</option>
                </select>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Point de repère
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Ex. Près de la pharmacie, portail bleu"
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Instructions pour le livreur (optionnel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted resize-none"
              />
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
            Mode de paiement
          </h2>
          <div className="space-y-3">
            {paymentOptions.map((opt) => (
              <div key={opt.value}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod(opt.value)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${paymentMethod === opt.value
                    ? 'border-green-primary bg-green-light'
                    : 'border-border-custom hover:bg-bg-secondary'
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${opt.swatch}`} />
                  <opt.icon className="w-5 h-5 text-green-primary shrink-0" />
                  <div>
                    <p className="font-inter font-semibold text-text-primary text-sm">{opt.label}</p>
                    <p className="text-text-muted text-xs font-inter">{opt.description}</p>
                  </div>
                </button>
                {paymentMethod === opt.value && (
                  <p className="text-text-secondary text-xs font-inter mt-1.5 px-3">
                    {opt.confirmation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Summary */}
        <section className="bg-white rounded-xl border border-border-custom p-5 sm:p-6 mb-6">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
            Récapitulatif
          </h2>
          <div className="space-y-2 mb-4">
            {items.map(({ item, quantity }) => (
              <div key={item.id} className="flex justify-between text-sm font-inter">
                <span className="text-text-secondary">{quantity} × {item.name}</span>
                <span className="text-text-primary">{(item.price * quantity).toLocaleString()} FCFA</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border-light pt-3 space-y-2">
            <div className="flex justify-between text-sm font-inter text-text-secondary">
              <span>Sous-total</span>
              <span>{totalPrice.toLocaleString()} FCFA</span>
            </div>
            <div className="flex justify-between text-sm font-inter">
              <span className="text-text-secondary">Livraison</span>
              <span className="text-success font-medium">{deliveryFee === 0 ? 'Gratuit' : `${deliveryFee} FCFA`}</span>
            </div>
            <div className="border-t border-border-light pt-2 flex justify-between font-inter">
              <span className="text-text-primary font-bold text-lg">Total</span>
              <span className="text-text-primary font-bold text-lg">{total.toLocaleString()} FCFA</span>
            </div>
          </div>
        </section>

        {error && <p className="text-error text-sm font-inter mb-4">{error}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={submitting || !effectiveNeighborhood || !landmark}
          className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Validation...
            </>
          ) : (
            `Confirmer la commande — ${total.toLocaleString()} FCFA`
          )}
        </button>
      </div>
    </div>
  );
}
