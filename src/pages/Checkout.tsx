import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Wallet, Smartphone, Loader2, CheckCircle2, UserRound, Phone } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createOrder, type PaymentMethod } from '../lib/orders';
import { validateOrder, initiateMoMoPayment } from '../lib/payments';
import { isSupabaseConfigured } from '../lib/supabase';
import { useRestaurant } from '../hooks/useCatalog';
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
  const { items, restaurantId, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { restaurant: cartRestaurant } = useRestaurant(restaurantId ?? undefined);

  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [useOtherNeighborhood, setUseOtherNeighborhood] = useState(false);
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');

  // Lock city/neighborhood to the restaurant's location
  const restaurantCity = cartRestaurant?.city ?? '';
  const restaurantNeighborhood = cartRestaurant?.neighborhood ?? '';
  const locationLocked = Boolean(restaurantCity);

  useEffect(() => {
    if (restaurantCity) setCity(restaurantCity);
  }, [restaurantCity]);

  useEffect(() => {
    if (restaurantNeighborhood) setNeighborhood(restaurantNeighborhood);
  }, [restaurantNeighborhood]);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentPhone, setPaymentPhone] = useState(() => user?.phone ?? '');
  const [orderForSomeoneElse, setOrderForSomeoneElse] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [callRecipientOnArrivalOnly, setCallRecipientOnArrivalOnly] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState('');

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

  // Frais de livraison réels du restaurant du panier (0 tant que non chargé)
  const deliveryFee = cartRestaurant && cartRestaurant.id === restaurantId
    ? cartRestaurant.deliveryFee
    : 0;
  const total = totalPrice + deliveryFee;
  const recipientMissing = orderForSomeoneElse && (!recipientName.trim() || !recipientPhone.trim());

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0 || !restaurantId) return;
    setError('');
    setSubmitting(true);
    try {
      if (recipientMissing) {
        setError('Renseignez le nom et le numéro du bénéficiaire.');
        return;
      }

      const recipient = orderForSomeoneElse
        ? {
          name: recipientName.trim(),
          phone: recipientPhone.trim(),
          contactInstructions: callRecipientOnArrivalOnly ? "Appeler le bénéficiaire uniquement à l'arrivée." : undefined,
        }
        : null;

      let serverSubtotal = totalPrice;
      let serverDeliveryFee = deliveryFee;
      let serverTotal = total;

      // Validation serveur (prix, disponibilité, minimum de commande, promo)
      // quand Supabase est configuré — les montants serveur font foi.
      if (isSupabaseConfigured) {
        try {
          const validation = await validateOrder({
            restaurantId,
            items: items.map(({ item, quantity }) => ({ menuItemId: item.id, quantity })),
            promoCode: promoCode.trim() || undefined,
          });
          serverSubtotal = validation.subtotal;
          serverDeliveryFee = validation.deliveryFee;
          serverTotal = validation.total;
          setAppliedDiscount(validation.discount ?? 0);
        } catch (validationErr) {
          const message = (validationErr as Error).message;
          // Erreurs métier explicites (restaurant fermé, minimum non atteint…)
          if (message && !message.startsWith('HTTP') && !message.includes('fetch')) {
            setError(message);
            setSubmitting(false);
            return;
          }
          // Edge function injoignable : on continue avec les montants client.
        }
      }

      const order = await createOrder({
        customerId: user.id,
        restaurantId,
        restaurantName: cartRestaurant?.name ?? '',
        contactPhone: user.phone,
        recipient,
        items,
        subtotal: serverSubtotal,
        deliveryFee: serverDeliveryFee,
        total: serverTotal,
        paymentMethod,
        address: { city, neighborhood: effectiveNeighborhood, landmark, fullText: `${effectiveNeighborhood}, ${city} — ${landmark}` },
        notes,
      });

      // Paiement MTN MoMo : déclenche la demande de confirmation sur le téléphone
      if (paymentMethod === 'mtn_momo' && isSupabaseConfigured) {
        try {
          const payment = await initiateMoMoPayment({
            orderId: order.id,
            amount: serverTotal,
            phone: paymentPhone || user.phone,
          });
          setPaymentNotice(payment.message || 'Demande de paiement MTN MoMo envoyée. Validez-la sur votre téléphone.');
        } catch {
          setPaymentNotice("Le paiement MoMo n'a pas pu être initié. Vous pourrez régler à la livraison.");
        }
      } else if (paymentMethod === 'orange_money') {
        setPaymentNotice('Le paiement Orange Money sera confirmé avec vous par le support. En attendant, la commande est enregistrée.');
      }

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
      <div className="pt-[72px] min-h-screen bg-gradient-to-b from-green-50/50 to-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center my-12">
          <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-primary" />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">
            Commande confirmée !
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-6">
            Référence : <span className="font-semibold text-text-primary">{placedOrderId.slice(0, 8)}</span>
          </p>
          {paymentNotice && (
            <p className="text-text-secondary font-inter text-sm mb-6 bg-bg-secondary rounded-lg p-3">
              {paymentNotice}
            </p>
          )}
          <button
            onClick={() => navigate('/commandes')}
            className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark hover:shadow-lg active:scale-95 transition-all"
          >
            Suivre ma commande
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary">
      {/* ════════════════════════════════════════════════════
          Immersive Hero (Restaurants-style)
          ════════════════════════════════════════════════════ */}
      <section className="bg-green-primary pt-12 pb-16 sm:pt-16 sm:pb-20 relative">
        <div className="max-w-[720px] mx-auto px-4 sm:px-6">
          <div className="text-white/60 text-xs font-inter mb-4">
            <Link to="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="mx-2">/</span>
            <Link to="/restaurants" className="hover:text-white transition-colors">Restaurants</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Commander</span>
          </div>
          <h1 className="font-poppins font-semibold text-white text-3xl sm:text-4xl tracking-normal mb-3">
            Finaliser la commande
          </h1>
          <p className="text-white/75 font-inter text-base">
            {items.length} article{items.length !== 1 ? 's' : ''} · {total.toLocaleString()} FCFA
          </p>
        </div>
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-12 space-y-6">

        {/* Recipient */}
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="w-5 h-5 text-green-primary" />
            <h2 className="font-poppins font-semibold text-text-primary text-lg">
              Destinataire
            </h2>
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border-custom bg-bg-secondary/50 p-3 cursor-pointer">
            <input
              type="checkbox"
              checked={orderForSomeoneElse}
              onChange={(e) => setOrderForSomeoneElse(e.target.checked)}
              className="mt-1 h-4 w-4 accent-green-primary"
            />
            <span>
              <span className="block font-inter font-semibold text-text-primary text-sm">
                Je commande pour quelqu&apos;un d&apos;autre
              </span>
              <span className="block text-text-muted text-xs font-inter mt-0.5">
                Le livreur contactera ce bénéficiaire à la livraison.
              </span>
            </span>
          </label>

          {orderForSomeoneElse && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Nom du bénéficiaire</label>
                <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                  <UserRound className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Ex. Paul Mbarga"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required={orderForSomeoneElse}
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">Téléphone du bénéficiaire</label>
                <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-12">
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                  <input
                    type="tel"
                    value={recipientPhone}
                    onChange={(e) => setRecipientPhone(e.target.value)}
                    placeholder="+237 6XX XX XX XX"
                    className="flex-1 bg-transparent text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted"
                    required={orderForSomeoneElse}
                  />
                </div>
              </div>
              <label className="sm:col-span-2 flex items-start gap-3 rounded-lg bg-green-light/60 px-3 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={callRecipientOnArrivalOnly}
                  onChange={(e) => setCallRecipientOnArrivalOnly(e.target.checked)}
                  className="mt-1 h-4 w-4 accent-green-primary"
                />
                <span className="text-text-secondary text-xs font-inter">
                  Appeler le bénéficiaire uniquement quand le livreur arrive.
                </span>
              </label>
            </div>
          )}
        </section>

        {/* Address */}
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
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
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Ville
                {locationLocked && <span className="text-green-primary text-[11px] ml-1">(restaurant)</span>}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={locationLocked}
                className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {activeCities.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                Quartier
                {locationLocked && <span className="text-green-primary text-[11px] ml-1">(restaurant)</span>}
              </label>
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
                  className="w-full bg-bg-secondary rounded-lg px-3 h-12 text-text-primary font-inter text-[15px] outline-none disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={locationLocked}
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
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
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
                  <div className="mt-1.5 px-3">
                    <p className="text-text-secondary text-xs font-inter">
                      {opt.confirmation}
                    </p>
                    {(opt.value === 'mtn_momo' || opt.value === 'orange_money') && (
                      <input
                        type="tel"
                        value={paymentPhone}
                        onChange={(e) => setPaymentPhone(e.target.value)}
                        placeholder="Numéro Mobile Money (ex: 6XXXXXXXX)"
                        className="mt-2 w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Summary */}
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
            Récapitulatif
          </h2>
          {orderForSomeoneElse && (
            <div className="mb-4 rounded-lg bg-green-light/60 px-3 py-2 text-xs font-inter text-text-secondary">
              Pour <span className="font-semibold text-text-primary">{recipientName || 'bénéficiaire'}</span>
              {recipientPhone && <span> · {recipientPhone}</span>}
            </div>
          )}
          <div className="space-y-2 mb-4">
            {items.map(({ item, quantity }) => (
              <div key={item.id} className="flex justify-between text-sm font-inter">
                <span className="text-text-secondary">{quantity} × {item.name}</span>
                <span className="text-text-primary">{(item.price * quantity).toLocaleString()} FCFA</span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setAppliedDiscount(0); }}
              placeholder="Code promo (ex: AKWA1000)"
              className="w-full bg-bg-secondary rounded-lg px-3 py-2 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted uppercase"
            />
            <p className="text-text-muted text-xs font-inter mt-1">
              Le code sera vérifié à la confirmation de la commande.
            </p>
          </div>
          <div className="border-t border-border-light pt-3 space-y-2">
            <div className="flex justify-between text-sm font-inter text-text-secondary">
              <span>Sous-total</span>
              <span>{totalPrice.toLocaleString()} FCFA</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between text-sm font-inter">
                <span className="text-text-secondary">Remise ({promoCode})</span>
                <span className="text-success font-medium">-{appliedDiscount.toLocaleString()} FCFA</span>
              </div>
            )}
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
          className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark hover:shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
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
