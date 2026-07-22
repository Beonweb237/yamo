import { useRef, useState } from 'react';
import { UploadCloud, X, Loader2, FileCheck2, AlertCircle } from 'lucide-react';
import { processFormImage } from '../lib/media';
import type { KycDocStatus } from '../lib/kyc';

interface Props {
  label: string;
  value: string | null;              // URL de la pièce (ou null)
  onChange: (url: string | null) => void;
  required?: boolean;
  disabled?: boolean;
  /** Verdict de la pièce (fiche KYC) — bordure colorée + libellé. */
  status?: KycDocStatus;
  statusNote?: string | null;
}

// Uploader d'une pièce KYC : compresse + envoie vers /api/media (via
// processFormImage), affiche l'aperçu, permet le remplacement/suppression.
export default function DocumentUploader({ label, value, onChange, required, disabled, status, statusNote }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = () => { if (!disabled && !uploading) inputRef.current?.click(); };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const url = await processFormImage(file, 'kyc');
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload échoué');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const border = status === 'approved' ? 'border-green-primary/50'
    : status === 'rejected' ? 'border-red-300'
    : value ? 'border-border-custom' : 'border-dashed border-border-custom';

  return (
    <div>
      <div className="flex items-center gap-1 mb-1">
        <span className="text-text-muted text-xs font-inter">{label}</span>
        {required && <span className="text-error text-xs">*</span>}
        {status === 'approved' && <span className="ml-auto text-[10px] font-semibold text-green-primary bg-green-light rounded-full px-2 py-0.5">Validé</span>}
        {status === 'rejected' && <span className="ml-auto text-[10px] font-semibold text-red-700 bg-red-50 rounded-full px-2 py-0.5">Refusé</span>}
        {status === 'pending' && value && <span className="ml-auto text-[10px] font-semibold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">En attente</span>}
      </div>

      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])} disabled={disabled} />

      {value ? (
        <div className={`relative rounded-xl border ${border} overflow-hidden bg-bg-secondary group`}>
          <img src={value} alt={label} className="w-full h-32 object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            {!disabled && (
              <>
                <button type="button" onClick={pick} className="text-xs font-medium bg-white/90 text-text-primary rounded-lg px-2.5 h-8">
                  Remplacer
                </button>
                <button type="button" onClick={() => onChange(null)} aria-label="Supprimer" className="w-8 h-8 rounded-lg bg-white/90 text-error flex items-center justify-center">
                  <X className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {statusNote && status === 'rejected' && (
            <p className="text-[11px] text-red-700 bg-red-50 px-2 py-1 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" />{statusNote}</p>
          )}
        </div>
      ) : (
        <button type="button" onClick={pick} disabled={disabled || uploading}
          className={`w-full h-32 rounded-xl border ${border} bg-bg-secondary flex flex-col items-center justify-center gap-1.5 text-text-muted hover:border-green-primary/40 hover:text-green-primary transition-colors disabled:opacity-60`}>
          {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <UploadCloud className="w-6 h-6" />}
          <span className="text-xs font-inter">{uploading ? 'Envoi…' : 'Ajouter une photo'}</span>
        </button>
      )}

      {error && <p className="text-[11px] text-error mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{error}</p>}
      {status === 'approved' && !error && (
        <p className="text-[11px] text-green-primary mt-1 flex items-center gap-1"><FileCheck2 className="w-3 h-3" />Pièce validée</p>
      )}
    </div>
  );
}
