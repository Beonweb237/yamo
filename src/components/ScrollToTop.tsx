import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut de la page"
      className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 z-30 w-11 h-11 rounded-full bg-white border border-border-custom shadow-lg text-text-secondary hover:text-green-primary hover:border-green-primary hover:shadow-xl transition-all flex items-center justify-center ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
