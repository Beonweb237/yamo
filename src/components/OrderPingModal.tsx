import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { MapPin, Clock, Banknote, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from "react-i18next";

// Connexion Socket.io via le même hôte (nginx proxy) — pas de port hardcodé
const SOCKET_URL = ''; // chaîne vide = même origine

export default function OrderPingModal() {
    const { t } = useTranslation();
  const { user } = useAuth();
  const [incomingOrder, setIncomingOrder] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(15);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'livreur') return;

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔗 Connecté Smart Dispatch');
      socket.emit('register_user', user.id);
    });

    socket.on('ping_order_dispatch', ({ order, timeout }) => {
      console.log('🚨 Nouvelle commande Smart Dispatch', order?.id);
      setIncomingOrder(order);
      setTimeLeft(timeout || 15);
    });

    socket.on('ping_order_expired', ({ orderId }) => {
      setIncomingOrder((current: any) => {
        if (current && current.id === orderId) return null;
        return current;
      });
    });

    socket.on('ping_order_success', ({ orderId }) => {
      if (incomingOrder?.id === orderId) {
        window.location.reload();
      }
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Chronomètre
  useEffect(() => {
    if (!incomingOrder || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingOrder, timeLeft]);

  const handleAccept = () => {
    if (socketRef.current && incomingOrder) {
      socketRef.current.emit('accept_ping_order', {
        orderId: incomingOrder.id,
        driverId: user?.id,
      });
      setTimeLeft(999); // Bloque le timer en attendant la confirmation
    }
  };

  const handleReject = () => {
    if (socketRef.current && incomingOrder) {
      socketRef.current.emit('reject_ping_order', {
        orderId: incomingOrder.id,
        driverId: user?.id,
      });
      setIncomingOrder(null);
    }
  };

  if (!incomingOrder) return null;

  const progressPercentage = Math.max(0, (timeLeft / 15) * 100);
  const isExpired = timeLeft <= 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          className="bg-white border border-border-custom w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-green-primary p-4 text-center relative">
            <h2 className="text-xl font-bold uppercase tracking-wider text-white">{t("Nouvelle Livraison !")}</h2>
            <p className="text-green-100 text-sm mt-1">{t("Acceptez avant que le temps ne s'écoule")}</p>
          </div>

          {/* Barre de progression */}
          <div className="w-full bg-border-custom h-2">
            <motion.div
              className={`h-full transition-colors ${isExpired ? 'bg-error' : 'bg-green-primary'}`}
              initial={{ width: '100%' }}
              animate={{ width: `${progressPercentage}%` }}
              transition={{ ease: 'linear', duration: 1 }}
            />
          </div>

          <div className="p-6 space-y-4">
            {/* Gains + Distance */}
            <div className="flex justify-between items-center bg-bg-secondary p-4 rounded-xl">
              <div className="flex items-center gap-3">
                <Banknote className="w-8 h-8 text-green-primary" />
                <div>
                  <p className="text-sm text-text-muted">{t("Gains estimés")}</p>
                  <p className="text-2xl font-bold text-text-primary">
                    {incomingOrder.deliveryFee || incomingOrder.delivery_fee || 0} FCFA
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-text-muted">{t("Délai")}</p>
                <p className="text-lg font-semibold text-text-primary flex items-center gap-1">
                  <Clock className="w-4 h-4 text-green-primary" />
                  {isExpired ? 'Expiré' : `${timeLeft}s`}
                </p>
              </div>
            </div>

            {/* Parcours */}
            <div className="space-y-3 mt-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-green-primary mt-1 shrink-0" />
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold tracking-wider">{t("Collecte (Restaurant)")}</p>
                  <p className="text-sm font-medium mt-0.5 text-text-primary">
                    {incomingOrder.restaurantName || incomingOrder.restaurant_name || 'Restaurant'}
                  </p>
                </div>
              </div>

              <div className="w-0.5 h-6 bg-border-custom ml-2.5 my-1" />

              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gold-accent mt-1 shrink-0" />
                <div>
                  <p className="text-xs text-text-muted uppercase font-semibold tracking-wider">{t("Livraison (Client)")}</p>
                  <p className="text-sm font-medium mt-0.5 text-text-primary">
                    {incomingOrder.deliveryAddress || incomingOrder.delivery_address || 'Adresse du client'}
                  </p>
                </div>
              </div>
            </div>

            {/* Total commande */}
            <div className="bg-bg-secondary rounded-xl p-3 text-center">
              <p className="text-xs text-text-muted">{t("Valeur commande")}</p>
              <p className="text-lg font-bold text-text-primary">
                {(incomingOrder.total || incomingOrder.total || 0).toLocaleString()} FCFA
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 bg-bg-secondary/50 flex gap-3">
            <button
              onClick={handleReject}
              disabled={isExpired}
              className="flex-1 py-3.5 px-4 rounded-xl font-bold text-text-secondary bg-white border border-border-custom hover:bg-bg-secondary transition-colors flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <XCircle className="w-5 h-5" />
              {t("Refuser")}
            </button>
            <button
              onClick={handleAccept}
              disabled={isExpired}
              className="flex-1 py-3.5 px-4 rounded-xl font-bold text-white bg-green-primary hover:bg-green-dark shadow-lg shadow-green-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <CheckCircle className="w-5 h-5" />
              {isExpired ? 'EXPIRÉ' : `ACCEPTER (${timeLeft}s)`}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
