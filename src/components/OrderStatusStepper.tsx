import { Check } from 'lucide-react';
import type { OrderStatus } from '../lib/orders';

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'confirmed', label: 'Confirmée' },
  { status: 'preparing', label: 'En préparation' },
  { status: 'ready', label: 'Prête' },
  { status: 'delivering', label: 'En livraison' },
  { status: 'delivered', label: 'Livrée' },
];

// picked_up and delivering both map onto the "En livraison" step visually.
function stepIndexForStatus(status: OrderStatus): number {
  if (status === 'pending') return -1;
  if (status === 'picked_up') return STEPS.findIndex((s) => s.status === 'delivering');
  return STEPS.findIndex((s) => s.status === status);
}

export default function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') {
    return (
      <div className="bg-error/10 text-error text-sm font-inter font-medium rounded-lg px-3 py-2">
        Commande annulée
      </div>
    );
  }

  const currentIndex = stepIndexForStatus(status);

  return (
    <div className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const current = i === currentIndex;
        return (
          <div key={step.status} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  done || current
                    ? 'bg-green-primary text-white'
                    : 'bg-bg-secondary text-text-muted border border-border-custom'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px] font-bold">{i + 1}</span>}
              </div>
              <span
                className={`text-[10px] font-inter text-center leading-tight max-w-[60px] ${
                  current ? 'text-green-primary font-semibold' : done ? 'text-text-secondary' : 'text-text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-[2px] mx-1 -mt-4 ${done ? 'bg-green-primary' : 'bg-border-custom'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
