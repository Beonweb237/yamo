import { useRef } from 'react';

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

// Saisie de code OTP en cases individuelles : auto-avance, retour arrière,
// collage du code complet. `value` reste une simple chaîne de chiffres,
// compatible avec le state `code` existant des formulaires.
export default function OtpInput({ length = 6, value, onChange, disabled }: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const applyDigits = (start: number, digits: string) => {
    const chars = value.slice(0, length).split('');
    let pos = start;
    for (const d of digits) {
      if (pos >= length) break;
      chars[pos] = d;
      pos += 1;
    }
    onChange(chars.join(''));
    refs.current[Math.min(pos, length - 1)]?.focus();
  };

  return (
    <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label="Code de vérification">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={value[i] ?? ''}
          disabled={disabled}
          aria-label={`Chiffre ${i + 1} sur ${length}`}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            if (digits) applyDigits(i, digits);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (value[i]) {
                onChange(value.slice(0, i) + value.slice(i + 1));
              } else if (i > 0) {
                onChange(value.slice(0, i - 1) + value.slice(i));
                refs.current[i - 1]?.focus();
              }
            } else if (e.key === 'ArrowLeft' && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === 'ArrowRight' && i < length - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onFocus={(e) => {
            // Pas de trous dans le code : cliquer une case lointaine ramène
            // le focus sur la première case vide.
            if (i > value.length) {
              refs.current[value.length]?.focus();
              return;
            }
            e.target.select();
          }}
          className="w-full h-12 min-w-0 rounded-xl border border-border-custom bg-white text-center font-inter font-semibold text-lg text-text-primary outline-none focus:border-green-primary focus:ring-2 focus:ring-green-primary/10 transition-all disabled:opacity-60"
        />
      ))}
    </div>
  );
}
