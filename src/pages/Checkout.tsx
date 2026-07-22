import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MapPin, Wallet, Smartphone, Loader2, CheckCircle2, UserRound, Phone, Navigation, Clock, HeartHandshake, TrendingUp, Award } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { createOrder, CustomerBlockedError, type PaymentMethod } from '../lib/orders';
import { validateOrder, initiateMoMoPayment, isVpsApiEnabled, NetworkPaymentError } from '../lib/payments';
import { getPaymentMode, type PaymentMode } from '../lib/paymentMode';
import { Skeleton } from '../components/ui/skeleton';
import { useRestaurant } from '../hooks/useCatalog';
import { activeCities, getNeighborhoods, getNeighborhoodCoords } from '../data/locations';
import { haversineDistance, estimateTime } from '../lib/utils';
import { calculateDriverEarnings, isSurgeActive, getActiveSurgeMultiplier } from '../lib/distance';
import { DRIVER_PAY_CONFIG, LOYALTY_CONFIG, loyaltyEarnForSubtotal, loyaltyMaxRedeemForSubtotal } from '../data/launchConfig';
import { getLoyaltyBalance, type LoyaltyBalance } from '../lib/loyalty';
import LazyAddressPickerMap from '../components/LazyAddressPickerMap';
import { toast } from 'sonner';
import { displayCameroonPhone, normalizeCameroonPhone } from '../lib/phone';
import { useTranslation } from "react-i18next";
import { useSeo } from '../hooks/useSeo';

interface SavedAddress {
  id: string;
  label: string;
  city: string;
  neighborhood: string;
  landmark: string;
  fullText: string;
  lat?: number;
  lng?: number;
}

const DEFAULT_COORDS = { lat: 4.0511, lng: 9.7679 };

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
    const { t } = useTranslation();
  useSeo({ title: t('Finaliser ma commande'), noindex: true });
  const { items, restaurantId, totalPrice, totalItems, clearCart } = useCart();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { restaurant: cartRestaurant, loading: cartRestaurantLoading } = useRestaurant(restaurantId ?? undefined);

  const [city, setCity] = useState('Douala');
  const [neighborhood, setNeighborhood] = useState('');
  const [useOtherNeighborhood, setUseOtherNeighborhood] = useState(false);
  const [customNeighborhood, setCustomNeighborhood] = useState('');
  const [landmark, setLandmark] = useState('');

  // Lock city to the restaurant's location (customer must be in same city).
  // Neighborhood is free choice — customer can be in any neighborhood of that city.
  const restaurantCity = cartRestaurant?.city ?? '';
  const cityLocked = Boolean(restaurantCity);

  useEffect(() => {
    if (restaurantCity) setCity(restaurantCity);
  }, [restaurantCity]);

  // Delivery zone estimation — only once the customer has actually picked a
  // neighborhood. Falling back to the city center (as before) produced a
  // spurious "hors zone" warning on page load, before any selection, since a
  // city-wide center point can easily sit outside a restaurant's radius even
  // though most of the city is well within it.
  const deliveryInfo = useMemo(() => {
    if (!cartRestaurant?.lat || !cartRestaurant?.lng) return null;
    if (!neighborhood) return null;
    const restoLat = cartRestaurant.lat;
    const restoLng = cartRestaurant.lng;
    const radius = cartRestaurant.deliveryRadiusKm ?? 5;

    const coords = getNeighborhoodCoords(neighborhood);
    if (!coords) return { withinZone: true, distanceKm: null, estimatedMin: null, radius };

    const distKm = haversineDistance(restoLat, restoLng, coords.lat, coords.lng);
    const estimatedMin = estimateTime(distKm);
    return {
      withinZone: distKm <= radius,
      distanceKm: distKm,
      estimatedMin,
      radius,
    };
  }, [cartRestaurant, neighborhood, city]);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const neighborhoodCoords = useMemo(() => getNeighborhoodCoords(neighborhood || city), [neighborhood, city]);
  const mapCoords = pinCoords
    ?? neighborhoodCoords
    ?? (cartRestaurant?.lat != null && cartRestaurant?.lng != null ? { lat: cartRestaurant.lat, lng: cartRestaurant.lng } : DEFAULT_COORDS);

  const handleGeolocate = () => {
    if (!navigator.geolocation) {
      toast.error('Géolocalisation non supportée par votre navigateur');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPinCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setGeoLoading(false);
        toast.success('Position détectée — ajustez le repère sur la carte si besoin');
      },
      () => {
        toast.error('Géolocalisation refusée — placez le repère manuellement sur la carte');
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const [notes, setNotes] = useState('');
  const [tipAmount, setTipAmount] = useState(0);
  const surgeActive = isSurgeActive();
  // Série PAY — mode de paiement global effectif (adapte l'instruction affichée).
  const [orderPaymentMode, setOrderPaymentMode] = useState<PaymentMode>('cod');
  useEffect(() => { getPaymentMode().then(setOrderPaymentMode).catch(() => {}); }, []);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentPhone, setPaymentPhone] = useState(() => normalizeCameroonPhone(user?.phone ?? ''));
  const [orderForSomeoneElse, setOrderForSomeoneElse] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [callRecipientOnArrivalOnly, setCallRecipientOnArrivalOnly] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState(0);
  // Série LOY — MiamPoints : solde du client + choix d'utilisation au checkout.
  const [loyaltyBalance, setLoyaltyBalance] = useState<LoyaltyBalance | null>(null);
  const [useLoyalty, setUseLoyalty] = useState(false);
  useEffect(() => {
    if (!user) return;
    getLoyaltyBalance(user.id).then(setLoyaltyBalance).catch(() => setLoyaltyBalance(null));
  }, [user]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  // Délai estimé du restaurant, capturé au moment de la commande (le panier —
  // et donc cartRestaurant — est vidé juste après ; sans capture, l'écran de
  // confirmation ne pourrait plus l'afficher).
  const [placedEta, setPlacedEta] = useState<string | null>(null);
  const [paymentNotice, setPaymentNotice] = useState('');
  const [validationCountdown, setValidationCountdown] = useState(0);
  const [showMap, setShowMap] = useState(false);

  const savedAddresses = useMemo(() => readAddresses(), []);

  useEffect(() => {
    if (validationCountdown > 0) {
      const timer = setInterval(() => setValidationCountdown(c => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [validationCountdown]);

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
    setPinCoords(addr.lat != null && addr.lng != null ? { lat: addr.lat, lng: addr.lng } : null);
  };

  useEffect(() => {
    if (!useOtherNeighborhood && !neighborhoods.includes(neighborhood) && neighborhood) {
      setNeighborhood('');
    }
  }, [city, neighborhood, neighborhoods, useOtherNeighborhood]);

  useEffect(() => {
    // Wait for the auth session to finish resolving before deciding — otherwise
    // a genuinely logged-in user gets bounced to /connexion during the brief
    // window where `user` is still null while the session loads.
    if (!authLoading && !user) {
      navigate('/connexion', { state: { from: '/checkout' } });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (items.length === 0 && !placedOrderId) {
      navigate('/restaurants');
    }
  }, [items.length, placedOrderId, navigate]);

  // Le restaurant du panier doit être résolu avant d'afficher des montants :
  // tant qu'il charge, la ligne Livraison et le total montrent un état
  // d'attente au lieu d'un faux « Gratuit » (CONF-11), et le CTA est bloqué.
  const restaurantReady = Boolean(cartRestaurant && cartRestaurant.id === restaurantId);
  // Panier orphelin : le restaurant du panier n'existe plus (retiré du
  // catalogue entre-temps). Sans ce cas, l'écran resterait bloqué sur des
  // skeletons sans explication (QA-14).
  const cartRestaurantMissing = Boolean(restaurantId) && !cartRestaurantLoading && !restaurantReady;
  const deliveryFee = restaurantReady && cartRestaurant ? cartRestaurant.deliveryFee : 0;
  // Série LOY — réduction MiamPoints : au plus le solde, plafonnée à 50 % du
  // sous-total, et seulement si le solde atteint le minimum d'utilisation.
  const loyaltyEligible = (loyaltyBalance?.available ?? 0) >= LOYALTY_CONFIG.MIN_REDEEM_POINTS;
  const loyaltyDiscount = useLoyalty && loyaltyEligible
    ? Math.min(loyaltyBalance?.available ?? 0, loyaltyMaxRedeemForSubtotal(totalPrice))
    : 0;
  const total = Math.max(0, totalPrice + deliveryFee + tipAmount - loyaltyDiscount);
  const recipientMissing = orderForSomeoneElse && (!recipientName.trim() || !recipientPhone.trim());

  // Minimum de commande du restaurant (CONF-10) : affiché et bloquant tant
  // que le sous-total ne l'atteint pas. minOrder = 0 → aucune contrainte.
  const minOrder = restaurantReady && cartRestaurant ? (cartRestaurant.minOrder ?? 0) : 0;
  const belowMinimum = minOrder > 0 && totalPrice < minOrder;
  const missingForMinimum = belowMinimum ? minOrder - totalPrice : 0;

  // Certains restaurants (découverts via /explorer ou un plat, voir dishes.ts)
  // n'existent que dans le catalogue de démo local et n'ont pas de ligne
  // réelle en base — commander échouerait au dernier moment côté serveur
  // ("Restaurant introuvable"). Repère le même format d'ID que catalog.ts
  // (isMockId) pour bloquer la commande plus tôt, avec un message clair.
  const isPreviewOnlyRestaurant = isVpsApiEnabled
    && !!restaurantId
    && (!restaurantId.includes('-') || restaurantId.length < 30);

  const handlePlaceOrder = async () => {
    if (!user || items.length === 0 || !restaurantId) return;
    setError('');
    setSubmitting(true);
    try {
      if (isPreviewOnlyRestaurant) {
        setError("Ce restaurant est un aperçu de démonstration et n'est pas encore disponible à la commande. Choisissez un restaurant depuis la recherche pour commander.");
        return;
      }
      if (recipientMissing) {
        setError('Renseignez le nom et le numéro du bénéficiaire.');
        return;
      }
      if (!restaurantReady) {
        setError('Les informations du restaurant sont encore en cours de chargement. Patientez un instant.');
        return;
      }
      if (belowMinimum) {
        setError(`Commande minimum de ${minOrder.toLocaleString()} FCFA non atteinte.`);
        return;
      }

      const recipient = orderForSomeoneElse
        ? {
          name: recipientName.trim(),
          phone: normalizeCameroonPhone(recipientPhone),
          contactInstructions: callRecipientOnArrivalOnly ? "Appeler le bénéficiaire uniquement à l'arrivée." : undefined,
        }
        : null;

      // Série DRV — calcul de la rémunération livreur estimée
      const computeDriverEarnings = () => {
        const distanceKm = deliveryInfo?.distanceKm ?? 0;
        const earnings = calculateDriverEarnings(distanceKm);
        return {
          distanceKm,
          waitMinutes: 10,
          basePickup: earnings.basePickup,
          distancePay: earnings.distancePay,
          waitPay: earnings.waitPay,
          surgeMultiplier: earnings.surgeMultiplier,
          surgeBonus: earnings.surgeBonus,
          subtotal: earnings.subtotal,
          final: earnings.final,
          surgeActive: earnings.surgeActive,
        };
      };
      const driverEarnings = computeDriverEarnings();

      let serverSubtotal = totalPrice;
      let serverDeliveryFee = deliveryFee;
      let serverTotal = total;

      // Validation serveur (prix, disponibilité, minimum de commande, promo)
      // en mode VPS — les montants serveur font foi. En cas d'échec technique
      // la commande est BLOQUÉE : aucun repli silencieux sur les montants
      // client (CONF-03 / R-02 — intégrité des prix). En mode mock (dev sans
      // backend), les montants client restent la référence.
      if (isVpsApiEnabled) {
        try {
          const validation = await validateOrder({
            restaurantId,
            // baseItemId : id du plat au menu (item.id peut être un id
            // composite pour une personnalisation, inconnu du serveur).
            items: items.map(({ baseItemId, quantity }) => ({ menuItemId: baseItemId, quantity })),
            promoCode: promoCode.trim() || undefined,
          });
          serverSubtotal = validation.subtotal;
          serverDeliveryFee = validation.deliveryFee;
          serverTotal = validation.total;
          setAppliedDiscount(validation.discount ?? 0);
        } catch (validationErr) {
          if (validationErr instanceof NetworkPaymentError) {
            // Serveur injoignable / réponse invalide : on ne devine pas les
            // montants, on invite à réessayer (le panier est conservé).
            setError('Impossible de vérifier votre commande pour le moment (connexion instable). Vos articles sont conservés — réessayez dans un instant.');
          } else {
            // Erreur métier explicite (restaurant fermé, minimum non atteint,
            // plat indisponible…) : message serveur affiché tel quel.
            setError((validationErr as Error).message || 'Commande refusée par le serveur.');
          }
          return;
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
        // Série LOY — le total à payer est réduit des MiamPoints utilisés ;
        // le montant est enregistré (débit client + compensation resto serveur).
        total: Math.max(0, serverTotal + tipAmount - loyaltyDiscount),
        loyaltyRedeemed: loyaltyDiscount,
        paymentMethod,
        address: {
          city,
          neighborhood: effectiveNeighborhood,
          landmark,
          fullText: `${effectiveNeighborhood}, ${city} — ${landmark}`,
          lat: pinCoords?.lat,
          lng: pinCoords?.lng,
        },
        notes,
        tipAmount,
        driverEarnings,
      });

      // Paiement MTN MoMo : déclenche la demande de confirmation sur le téléphone
      if (paymentMethod === 'mtn_momo' && isVpsApiEnabled) {
        try {
          const payment = await initiateMoMoPayment({
            orderId: order.id,
            amount: serverTotal,
            phone: normalizeCameroonPhone(paymentPhone || user.phone),
          });
          setPaymentNotice(payment.message || 'Demande de paiement MTN MoMo envoyée. Validez-la sur votre téléphone.');
          setValidationCountdown(60);
        } catch {
          setPaymentNotice("Le paiement MoMo n'a pas pu être initié. Vous pourrez régler à la livraison.");
        }
      } else if (paymentMethod === 'orange_money') {
        setPaymentNotice('Le paiement Orange Money sera confirmé avec vous par le support. En attendant, la commande est enregistrée.');
        setValidationCountdown(60);
      }

      setPlacedEta(cartRestaurant?.deliveryTime ?? null);
      setPlacedOrderId(order.id);
      clearCart();
    } catch (err) {
      if (err instanceof CustomerBlockedError) {
        setError("Votre compte a été bloqué et ne peut plus passer de commande. Contactez le support via la page Contact pour en savoir plus.");
      } else {
        setError('Impossible de valider la commande. Réessayez.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Auth still resolving, or resolved and no session — never flash the
  // checkout form itself; the effect above handles the redirect.
  if (authLoading || !user) {
    return (
      <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <p className="text-text-secondary font-inter text-sm">{t("Chargement...")}</p>
      </div>
    );
  }

  if (placedOrderId) {
    if (validationCountdown > 0) {
      return (
        <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
          <div className="w-full max-w-[480px] bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center my-12">
            <div className="w-16 h-16 rounded-full bg-green-light flex items-center justify-center mx-auto mb-5 relative">
              <Loader2 className="w-8 h-8 text-green-primary animate-spin" />
              <div className="absolute inset-0 border-4 border-green-primary/30 rounded-full animate-pulse" />
            </div>
            <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">
              {t("Validation en attente")}
            </h1>
            <p className="text-text-secondary font-inter text-sm mb-6">
              {paymentNotice}
            </p>
            <div className="bg-bg-secondary rounded-lg p-4 mb-6">
              <span className="font-mono text-2xl font-bold text-green-primary">
                00:{validationCountdown.toString().padStart(2, '0')}
              </span>
              <p className="text-text-muted text-xs mt-1">
                {t("Le paiement devrait apparaître sur votre écran.")}
              </p>
            </div>
            <button
              onClick={() => setValidationCountdown(0)}
              className="w-full bg-bg-secondary text-text-primary font-inter font-medium h-[52px] rounded-xl hover:bg-border-light transition-all"
            >
              {t("Je n'ai rien reçu, continuer")}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="pt-[72px] min-h-screen bg-gradient-to-b from-green-50/50 to-bg-secondary flex items-center justify-center px-4">
        <div className="w-full max-w-[480px] bg-white rounded-2xl border border-border-custom shadow-sm p-6 sm:p-8 text-center my-12">
          <div className="w-16 h-16 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-green-primary" />
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl mb-2">
            {t("Commande confirmée !")}
          </h1>
          <p className="text-text-secondary font-inter text-sm mb-4">
            {t("Référence :")} <span className="font-semibold text-text-primary">{placedOrderId.slice(0, 8)}</span>
          </p>

          {/* Tracker visuel */}
          <div className="mb-6">
             <div className="flex justify-between items-center mb-2 px-2 relative">
                <div className="absolute top-1/2 left-6 right-6 h-1 bg-green-light -z-10 -translate-y-1/2" />
                <div className="flex flex-col items-center gap-1">
                   <div className="w-6 h-6 rounded-full bg-green-primary text-white flex items-center justify-center shadow-sm"><CheckCircle2 className="w-4 h-4"/></div>
                   <span className="text-[10px] font-semibold text-text-primary">{t("Confirmée")}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="w-6 h-6 rounded-full bg-bg-secondary border-2 border-border-custom text-text-muted flex items-center justify-center opacity-50"><div className="w-2 h-2 rounded-full bg-current" /></div>
                   <span className="text-[10px] font-medium text-text-muted opacity-50">{t("Préparation")}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="w-6 h-6 rounded-full bg-bg-secondary border-2 border-border-custom text-text-muted flex items-center justify-center opacity-50"><div className="w-2 h-2 rounded-full bg-current" /></div>
                   <span className="text-[10px] font-medium text-text-muted opacity-50">{t("En route")}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="w-6 h-6 rounded-full bg-bg-secondary border-2 border-border-custom text-text-muted flex items-center justify-center opacity-50"><div className="w-2 h-2 rounded-full bg-current" /></div>
                   <span className="text-[10px] font-medium text-text-muted opacity-50">{t("Livré")}</span>
                </div>
             </div>
          </div>

          {placedEta && (
            <p className="inline-flex items-center gap-1.5 bg-green-light text-green-primary font-inter text-sm font-medium px-3 py-1.5 rounded-full mb-6">
              <Clock className="w-4 h-4" />
              {t("Livraison estimée :")} {placedEta}
            </p>
          )}
          {!placedEta && <span className="block mb-4" />}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => navigate('/commandes')}
              className="flex-1 bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark hover:shadow-lg active:scale-95 transition-all"
            >
              {t("Suivre")}
            </button>
            <a
              href={`https://wa.me/237600000000?text=${encodeURIComponent(`Bonjour MiamExpress, je vous contacte concernant ma commande ${placedOrderId.slice(0, 8)}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#25D366]/10 text-[#25D366] font-inter font-semibold h-[52px] rounded-xl hover:bg-[#25D366]/20 transition-all flex items-center justify-center gap-2"
            >
              <Phone className="w-4 h-4" />
              {t("Support WhatsApp")}
            </a>
          </div>
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
            <Link to="/" className="hover:text-white transition-colors">{t("Accueil")}</Link>
            <span className="mx-2">/</span>
            <Link to="/restaurants" className="hover:text-white transition-colors">{t("Restaurants")}</Link>
            <span className="mx-2">/</span>
            <span className="text-white">{t("Commander")}</span>
          </div>
          <h1 className="font-poppins font-semibold text-white text-3xl sm:text-4xl tracking-normal mb-3">
            {t("Finaliser la commande")}
          </h1>
          <p className="text-white/75 font-inter text-base">
            {totalItems} {t("article")}{totalItems !== 1 ? 's' : ''} · {total.toLocaleString()} {t("FCFA")}
          </p>
        </div>
      </section>

      <div className="max-w-[720px] mx-auto px-4 sm:px-6 -mt-8 relative z-10 pb-12 space-y-6">

        {/* Recipient */}
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <UserRound className="w-5 h-5 text-green-primary" />
            <h2 className="font-poppins font-semibold text-text-primary text-lg">
              {t("Destinataire")}
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
                {t("Je commande pour quelqu’un d’autre")}
              </span>
              <span className="block text-text-muted text-xs font-inter mt-0.5">
                {t("Le livreur contactera ce bénéficiaire à la livraison.")}
              </span>
            </span>
          </label>

          {orderForSomeoneElse && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Nom du bénéficiaire")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
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
                <label className="block text-text-secondary font-inter text-sm mb-1.5">{t("Téléphone du bénéficiaire")}</label>
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border-custom px-4 h-12 focus-within:border-green-primary transition-all">
                  <Phone className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-text-primary font-inter text-[15px] font-medium shrink-0 select-none">+237</span>
                  <input
                    type="tel"
                    value={displayCameroonPhone(recipientPhone)}
                    onChange={(e) => setRecipientPhone(normalizeCameroonPhone(e.target.value))}
                    placeholder="6XX XX XX XX"
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
                  {t("Appeler le bénéficiaire uniquement quand le livreur arrive.")}
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
              {t("Adresse de livraison")}
            </h2>
          </div>

          {savedAddresses.length > 0 && (
            <div className="mb-4">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Adresses enregistrées")}
              </label>
              <select
                onChange={(e) => {
                  const addr = savedAddresses.find(a => a.id === e.target.value);
                  if (addr) applySavedAddress(addr);
                }}
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-[15px] outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
                defaultValue=""
              >
                <option value="" disabled>{t("Sélectionner une adresse")}</option>
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
                {t("Ville de livraison")}
                {cityLocked && <span className="text-green-primary text-[11px] ml-1">{t("(fixée par le restaurant)")}</span>}
              </label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={cityLocked}
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-[15px] outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {activeCities.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Quartier")}
              </label>
              {useOtherNeighborhood ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={customNeighborhood}
                    onChange={(e) => setCustomNeighborhood(e.target.value)}
                    placeholder="Nom de votre quartier"
                    className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => { setUseOtherNeighborhood(false); setCustomNeighborhood(''); }}
                    className="shrink-0 px-3 h-12 rounded-xl border border-border-custom text-text-secondary font-inter text-sm hover:bg-bg-secondary"
                  >
                    {t("Liste")}
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
                  className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-[15px] outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
                  required
                >
                  <option value="">{t("Sélectionnez un quartier")}</option>
                  {neighborhoods.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                  <option value="__other__">{t("Mon quartier n’est pas listé")}</option>
                </select>
              )}
            </div>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-text-secondary font-inter text-sm">
                  {t("Repère sur la carte")}
                </label>
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={geoLoading}
                  className="flex items-center gap-1.5 text-green-primary font-inter text-xs font-medium hover:underline disabled:opacity-50 min-h-11 px-1"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {geoLoading ? 'Détection...' : 'Me géolocaliser'}
                </button>
              </div>
              {!showMap ? (
                <button
                  type="button"
                  onClick={() => setShowMap(true)}
                  className="w-full bg-bg-secondary border border-border-custom border-dashed rounded-xl h-14 flex items-center justify-center gap-2 text-text-secondary font-inter text-sm hover:bg-border-light transition-colors"
                >
                  <MapPin className="w-4 h-4" />
                  {t("+ Afficher la carte pour plus de précision (optionnel)")}
                </button>
              ) : (
                <LazyAddressPickerMap
                  height="220px"
                  lat={mapCoords.lat}
                  lng={mapCoords.lng}
                  onChange={(lat, lng) => setPinCoords({ lat, lng })}
                />
              )}
              {pinCoords && (
                <p className="text-green-primary text-[11px] font-inter mt-1.5 font-medium">
                  {t("📍 Coordonnées :")} {pinCoords.lat.toFixed(6)}, {pinCoords.lng.toFixed(6)}
                </p>
              )}
              <p className="text-text-muted text-[11px] font-inter mt-1.5">
                {t("Déplacez le repère rouge à l’endroit exact de la livraison. Le point de repère ci-dessous reste indispensable (adressage informel).")}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Point de repère")}
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="Ex. Près de la pharmacie, portail bleu"
                className="w-full bg-white rounded-xl border border-border-custom px-4 h-12 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
                required
              />
            </div>
            {/* Delivery zone info */}
            {deliveryInfo && deliveryInfo.distanceKm != null && (
              <div className={`sm:col-span-2 rounded-xl p-3 text-xs font-inter flex items-center gap-2 ${deliveryInfo.withinZone ? 'bg-green-light text-green-primary' : 'bg-error/10 text-error'}`}>
                {deliveryInfo.withinZone ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {t("Livraison possible · ~")}{deliveryInfo.distanceKm?.toFixed(1)} {t("km · ~")}{deliveryInfo.estimatedMin} {t("min")}
                      {deliveryInfo.radius ? ` · Rayon ${deliveryInfo.radius} km` : ''}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-lg shrink-0">⚠️</span>
                    <span>{t("Hors zone de livraison (")}{deliveryInfo.distanceKm?.toFixed(1)} {t("km / max")} {deliveryInfo.radius} {t("km)")}</span>
                  </>
                )}
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-text-secondary font-inter text-sm mb-1.5">
                {t("Instructions pour le livreur (optionnel)")}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full bg-white rounded-xl border border-border-custom px-4 py-3 text-text-primary font-inter text-[15px] outline-none placeholder:text-text-muted resize-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
              />
            </div>
          </div>
        </section>

        {/* Payment */}
        <section className="bg-white rounded-2xl border border-border-custom shadow-sm p-5 sm:p-6 mb-6">
          <h2 className="font-poppins font-semibold text-text-primary text-lg mb-4">
            {t("Mode de paiement")}
          </h2>
          {orderPaymentMode === 'prepaid_restaurant' && (
            <div className="mb-4 rounded-xl bg-gold-light/50 border border-gold-accent/40 p-3 text-sm text-[#8A6D14] font-inter">
              <b>{t("Paiement d'avance au restaurant.")}</b>{' '}
              {t("Réglez le restaurant avant qu'il ne prépare votre commande ; la livraison est ensuite prise en charge par MiamExpress.")}
            </div>
          )}
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
                        value={displayCameroonPhone(paymentPhone)}
                        onChange={(e) => setPaymentPhone(normalizeCameroonPhone(e.target.value))}
                        placeholder="Numéro Mobile Money (ex: 6XXXXXXXX)"
                        className="mt-2 w-full bg-white rounded-xl border border-border-custom px-4 py-2.5 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
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
            {t("Récapitulatif")}
          </h2>
          {orderForSomeoneElse && (
            <div className="mb-4 rounded-lg bg-green-light/60 px-3 py-2 text-xs font-inter text-text-secondary">
              {t("Pour")} <span className="font-semibold text-text-primary">{recipientName || 'bénéficiaire'}</span>
              {recipientPhone && <span> · {displayCameroonPhone(recipientPhone)}</span>}
            </div>
          )}
          <div className="space-y-2 mb-4">
            {items.map(({ item, quantity }) => (
              <div key={item.id} className="flex justify-between text-sm font-inter">
                <span className="text-text-secondary">{quantity} × {item.name}</span>
                <span className="text-text-primary">{(item.price * quantity).toLocaleString()} {t("FCFA")}</span>
              </div>
            ))}
          </div>
          <div className="mb-4">
            <input
              type="text"
              value={promoCode}
              onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setAppliedDiscount(0); }}
              placeholder="Code promo (ex: AKWA1000)"
              className="w-full bg-white rounded-xl border border-border-custom px-4 py-2.5 text-text-primary font-inter text-sm outline-none placeholder:text-text-muted uppercase focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all"
            />
            <p className="text-text-muted text-xs font-inter mt-1">
              {t("Le code promo sera vérifié à la confirmation de la commande.")}
            </p>
          </div>
          <div className="border-t border-border-light pt-3 space-y-2">
            <div className="flex justify-between text-sm font-inter text-text-secondary">
              <span>{t("Sous-total")}</span>
              <span>{totalPrice.toLocaleString()} {t("FCFA")}</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between text-sm font-inter">
                <span className="text-text-secondary">{t("Remise (")}{promoCode})</span>
                <span className="text-success font-medium">-{appliedDiscount.toLocaleString()} {t("FCFA")}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-inter">
              <span className="text-text-secondary">{t("Livraison")}</span>
              {restaurantReady ? (
                <span className={deliveryFee === 0 ? 'text-success font-medium' : 'text-text-primary font-medium'}>
                  {deliveryFee === 0 ? 'Gratuit' : `${deliveryFee.toLocaleString()} FCFA`}
                </span>
              ) : (
                <Skeleton className="h-4 w-16" aria-label="Frais de livraison en cours de chargement" />
              )}
            </div>
            {/* Série DRV — Pourboire livreur */}
            <div className="border-t border-border-light pt-3">
              <p className="text-sm font-inter font-medium text-text-primary mb-2 flex items-center gap-1.5">
                <HeartHandshake className="w-4 h-4 text-gold-accent" />
                {t("Pourboire (optionnel)")}
              </p>
              <p className="text-xs text-text-muted font-inter mb-2">
                {t("Le pourboire est reversé intégralement au livreur.")}
              </p>
              <div className="flex flex-wrap gap-2">
                {DRIVER_PAY_CONFIG.TIP_FIXED_OPTIONS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setTipAmount(tipAmount === amount ? 0 : amount)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-inter font-medium transition-all ${
                      tipAmount === amount
                        ? 'bg-gold-light text-amber-700 border-2 border-gold-accent'
                        : 'bg-bg-secondary text-text-secondary border-2 border-transparent hover:border-gold-accent/30'
                    }`}
                  >
                    +{amount.toLocaleString()} FCFA
                  </button>
                ))}
              </div>
              {tipAmount > 0 && (
                <div className="flex justify-between text-sm font-inter mt-2 text-[#D4A843]">
                  <span>{t("Pourboire livreur")}</span>
                  <span className="font-medium">+{tipAmount.toLocaleString()} FCFA</span>
                </div>
              )}
            </div>
            {/* Série DRV — Indicateur surge */}
            {surgeActive && (
              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                <TrendingUp className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-inter font-medium text-amber-700">
                  {t("🔥 Pic de demande")}
                </span>
              </div>
            )}
            {/* Série LOY — utiliser ses MiamPoints (si solde suffisant) */}
            {loyaltyEligible && loyaltyMaxRedeemForSubtotal(totalPrice) >= LOYALTY_CONFIG.MIN_REDEEM_POINTS && (
              <div className="border-t border-border-light pt-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useLoyalty}
                    onChange={(e) => setUseLoyalty(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-green-primary shrink-0"
                  />
                  <span className="flex-1">
                    <span className="text-sm font-inter font-medium text-text-primary flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-green-primary" />
                      {t("Utiliser mes")} {LOYALTY_CONFIG.UNIT_NAME}
                    </span>
                    <span className="block text-xs text-text-muted font-inter mt-0.5">
                      {(loyaltyBalance?.available ?? 0).toLocaleString()} {LOYALTY_CONFIG.UNIT_NAME} {t("disponibles · jusqu'à")}{' '}
                      {Math.min(loyaltyBalance?.available ?? 0, loyaltyMaxRedeemForSubtotal(totalPrice)).toLocaleString()} {t("FCFA de réduction")}
                    </span>
                  </span>
                </label>
              </div>
            )}
            {loyaltyDiscount > 0 && (
              <div className="flex justify-between text-sm font-inter text-green-primary">
                <span>{t("Réduction")} {LOYALTY_CONFIG.UNIT_NAME}</span>
                <span className="font-medium">-{loyaltyDiscount.toLocaleString()} {t("FCFA")}</span>
              </div>
            )}
            <div className="border-t border-border-light pt-2 flex justify-between items-center font-inter">
              <span className="text-text-primary font-bold text-lg">{t("Total")}</span>
              {restaurantReady ? (
                <span className="text-text-primary font-bold text-lg">{total.toLocaleString()} {t("FCFA")}</span>
              ) : (
                <Skeleton className="h-6 w-24" aria-label="Total en cours de chargement" />
              )}
            </div>
            {/* Série LOY — aperçu du gain MiamPoints (crédités à la livraison) */}
            {loyaltyEarnForSubtotal(totalPrice) > 0 && (
              <div className="flex items-center justify-center gap-1.5 bg-green-light rounded-lg px-3 py-2 mt-2">
                <Award className="w-4 h-4 text-green-primary shrink-0" />
                <span className="text-green-primary font-inter text-xs font-medium">
                  {t("Vous gagnerez")} {loyaltyEarnForSubtotal(totalPrice).toLocaleString()} {LOYALTY_CONFIG.UNIT_NAME} {t("à la livraison")}
                </span>
              </div>
            )}
          </div>
        </section>

        {isPreviewOnlyRestaurant && (
          <p className="text-amber-700 bg-gold-light rounded-lg px-3 py-2 text-sm font-inter mb-4">
            {t("Ce restaurant est un aperçu de démonstration et n’est pas encore disponible à la commande.")}
          </p>
        )}
        {cartRestaurantMissing && (
          <div className="bg-error/10 text-error rounded-lg px-3 py-2.5 text-sm font-inter mb-4" role="alert">
            <span className="font-semibold">{t("Le restaurant de votre panier n’est plus disponible.")}</span>{' '}
            <Link to="/restaurants" className="underline font-medium hover:opacity-80">
              {t("Choisir un autre restaurant")}
            </Link>
          </div>
        )}
        {belowMinimum && (
          <div className="bg-gold-light text-amber-700 rounded-lg px-3 py-2.5 text-sm font-inter mb-4" role="status">
            <span className="font-semibold">{t("Commande minimum :")} {minOrder.toLocaleString()} {t("FCFA.")}</span>{' '}
            {t("Ajoutez")} {missingForMinimum.toLocaleString()} {t("FCFA d’articles pour valider.")}{' '}
            <Link to={`/restaurant/${restaurantId}`} className="underline font-medium hover:opacity-80">
              {t("Retourner au menu")}
            </Link>
          </div>
        )}
        {error && <p className="text-error text-sm font-inter mb-4" role="alert">{error}</p>}

        <button
          onClick={handlePlaceOrder}
          disabled={submitting || !effectiveNeighborhood || !landmark || isPreviewOnlyRestaurant || !restaurantReady || belowMinimum}
          className="w-full bg-green-primary text-white font-inter font-semibold h-[52px] rounded-xl hover:bg-green-dark hover:shadow-lg active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> {t("Validation...")}
            </>
          ) : (
            `Confirmer la commande — ${total.toLocaleString()} FCFA`
          )}
        </button>
      </div>
    </div>
  );
}
