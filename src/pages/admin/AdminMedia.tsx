// ============================================================
// MiamExpress — Admin : Médiathèque
// Interface pro style WordPress simplifié
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, Trash2, Copy, Check, Search, Grid3X3, List,
  FolderOpen, Image, X, Download, Loader2, Plus,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = '/api/media';
const ITEMS_PER_PAGE_OPTIONS = [12, 24, 48, 96];

interface MediaItem {
  id: string;
  filename: string;
  originalName: string;
  folder: string;
  path: string;
  thumbnail: string | null;
  mimetype: string;
  size: number;
  width: number | null;
  height: number | null;
  uploadedAt: string;
  url: string;
  thumbUrl: string | null;
}

const FOLDERS = [
  { id: 'all', label: 'Tous les médias', icon: Image },
  { id: 'dishes', label: 'Plats', icon: Image },
  { id: 'restaurants', label: 'Restaurants', icon: Image },
  { id: 'categories', label: 'Catégories', icon: Image },
  { id: 'banners', label: 'Bannières', icon: Image },
  { id: 'branding', label: 'Branding', icon: Image },
  { id: 'general', label: 'Général', icon: FolderOpen },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

async function downloadMedia(item: MediaItem) {
  try {
    const res = await fetch(item.url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = item.originalName || item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    toast.success('Téléchargement lancé');
  } catch {
    // Fallback: open in new tab
    window.open(item.url, '_blank');
  }
}

export default function AdminMedia() {
  const [allMedia, setAllMedia] = useState<MediaItem[]>([]);
  const [folder, setFolder] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [preview, setPreview] = useState<MediaItem | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(24);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const fetchMedia = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (folder !== 'all') params.set('folder', folder);
      if (search) params.set('search', search);
      params.set('limit', '500');
      const res = await fetch(`${API_BASE}?${params}`);
      const data = await res.json();
      setAllMedia(data.items || []);
    } catch {
      toast.error('Impossible de charger les médias.');
    } finally {
      setLoading(false);
    }
  }, [folder, search]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);
  // Reset page when folder/search changes
  useEffect(() => { setPage(1); }, [folder, search]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(allMedia.length / perPage));
  const safePage = Math.min(page, totalPages);
  const paginatedMedia = allMedia.slice((safePage - 1) * perPage, safePage * perPage);

  const goToPage = (p: number) => setPage(Math.max(1, Math.min(p, totalPages)));

  const handleUpload = async (files: FileList | File[]) => {
    setUploading(true);
    let count = 0;
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const folderParam = folder !== 'all' ? folder : 'general';
        const res = await fetch(`${API_BASE}/upload?folder=${folderParam}`, {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          count++;
        } else {
          const err = await res.json();
          toast.error(`${file.name}: ${err.error}`);
        }
      } catch {
        toast.error(`Échec upload: ${file.name}`);
      }
    }
    setUploading(false);
    if (count > 0) toast.success(`${count} fichier(s) uploadé(s)`);
    fetchMedia();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAllMedia(prev => prev.filter(m => m.id !== id));
        toast.success('Média supprimé.');
      }
    } catch {
      toast.error('Échec de la suppression.');
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selected.size} média(s) ?`)) return;
    let count = 0;
    for (const id of selected) {
      try {
        await fetch(`${API_BASE}/${id}`, { method: 'DELETE' });
        count++;
      } catch { }
    }
    setSelected(new Set());
    toast.success(`${count} média(s) supprimé(s).`);
    fetchMedia();
  };

  const copyUrl = (url: string, id: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedId(id);
      toast.success('URL copiée !');
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Pagination component
  const Pagination = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border-light">
      <div className="flex items-center gap-2 text-text-muted text-xs font-inter">
        <span>{allMedia.length} fichier{allMedia.length > 1 ? 's' : ''}</span>
        <span>·</span>
        <select
          value={perPage}
          onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
          className="bg-bg-secondary border border-border-custom rounded px-2 py-1 text-xs outline-none"
        >
          {ITEMS_PER_PAGE_OPTIONS.map(n => (
            <option key={n} value={n}>{n} par page</option>
          ))}
        </select>
        <span>· Page {safePage} / {totalPages}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => goToPage(1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded hover:bg-border-light disabled:opacity-30 transition-colors"
          title="Première page"
        >
          <ChevronsLeft className="w-4 h-4 text-text-muted" />
        </button>
        <button
          onClick={() => goToPage(safePage - 1)}
          disabled={safePage <= 1}
          className="p-1.5 rounded hover:bg-border-light disabled:opacity-30 transition-colors"
          title="Page précédente"
        >
          <ChevronLeft className="w-4 h-4 text-text-muted" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (safePage <= 3) {
            pageNum = i + 1;
          } else if (safePage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = safePage - 2 + i;
          }
          return (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              className={`w-8 h-8 rounded text-xs font-inter font-medium transition-colors ${
                pageNum === safePage
                  ? 'bg-green-primary text-white'
                  : 'text-text-secondary hover:bg-border-light'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => goToPage(safePage + 1)}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded hover:bg-border-light disabled:opacity-30 transition-colors"
          title="Page suivante"
        >
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={safePage >= totalPages}
          className="p-1.5 rounded hover:bg-border-light disabled:opacity-30 transition-colors"
          title="Dernière page"
        >
          <ChevronsRight className="w-4 h-4 text-text-muted" />
        </button>
      </div>
    </div>
  );

  const empty = allMedia.length === 0 && !loading;

  return (
    <div className="min-h-screen bg-bg-secondary">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
              <Image className="w-6 h-6 text-green-primary" />
              Médiathèque
            </h1>
            <p className="text-text-secondary font-inter text-sm mt-1">
              Gérez vos images, photos de plats, bannières et ressources visuelles.
            </p>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-green-primary text-white font-inter font-medium text-sm px-5 h-11 rounded-lg hover:bg-green-dark transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {uploading ? 'Upload...' : 'Ajouter des médias'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
            className="hidden"
          />
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-xl border border-border-custom p-3 mb-6 flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-9 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un média..."
              className="flex-1 bg-transparent text-text-primary font-inter text-sm outline-none placeholder:text-text-muted"
            />
          </div>

          {/* Folder filter */}
          <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5 overflow-x-auto">
            {FOLDERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFolder(f.id)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-inter font-medium transition-colors whitespace-nowrap ${
                  folder === f.id
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <f.icon className="w-3 h-3 inline mr-1" />
                {f.label}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-1 bg-bg-secondary rounded-lg p-0.5 ml-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-white shadow-sm' : 'text-text-muted'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-white shadow-sm' : 'text-text-muted'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Bulk delete */}
          {selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 text-error font-inter text-xs font-medium hover:bg-error/5 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer ({selected.size})
            </button>
          )}
        </div>

        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`rounded-xl border-2 border-dashed transition-colors mb-6 ${
            dragOver
              ? 'border-green-primary bg-green-light/30'
              : 'border-border-custom bg-white/50'
          } ${empty ? 'py-16' : 'py-4 px-4'}`}
        >
          {empty ? (
            <div className="text-center">
              <Image className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary font-inter text-sm mb-2">
                Aucun média dans ce dossier.
              </p>
              <p className="text-text-muted text-xs font-inter">
                Glissez-déposez vos images ici ou cliquez sur &quot;Ajouter des médias&quot;.
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                  {paginatedMedia.map(item => (
                    <div
                      key={item.id}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                        selected.has(item.id)
                          ? 'border-green-primary ring-2 ring-green-primary/20'
                          : 'border-transparent hover:border-border-custom'
                      }`}
                      onClick={(e) => {
                        if (e.ctrlKey || e.metaKey) {
                          toggleSelect(item.id);
                        } else {
                          setPreview(item);
                        }
                      }}
                    >
                      <div className="aspect-square bg-bg-secondary flex items-center justify-center overflow-hidden">
                        <img
                          src={item.thumbUrl || item.url}
                          alt={item.originalName}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </div>
                      {/* Hover actions */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end gap-1 p-2 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); downloadMedia(item); }}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-text-primary transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); copyUrl(item.url, item.id); }}
                          className="p-1.5 rounded-lg bg-white/90 hover:bg-white text-text-primary transition-colors"
                          title="Copier l'URL"
                        >
                          {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-green-primary" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {/* Selection checkbox */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                        className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          selected.has(item.id)
                            ? 'bg-green-primary border-green-primary'
                            : 'bg-white/80 border-white hover:border-green-primary'
                        }`}
                      >
                        {selected.has(item.id) && <Check className="w-3 h-3 text-white" />}
                      </button>
                      {/* Filename */}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-white text-[10px] font-inter truncate">{item.originalName}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-border-light">
                  {paginatedMedia.map(item => (
                    <div key={item.id} className="flex items-center gap-3 py-2 px-2 hover:bg-bg-secondary rounded-lg transition-colors">
                      <img src={item.thumbUrl || item.url} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-inter text-sm text-text-primary truncate">{item.originalName}</p>
                        <p className="text-text-muted text-[10px] font-inter">
                          {item.width}×{item.height} · {formatSize(item.size)} · {item.folder}
                        </p>
                      </div>
                      <button onClick={() => downloadMedia(item)} className="p-1.5 rounded hover:bg-border-light transition-colors" title="Télécharger">
                        <Download className="w-3.5 h-3.5 text-text-muted" />
                      </button>
                      <button onClick={() => copyUrl(item.url, item.id)} className="p-1.5 rounded hover:bg-border-light transition-colors">
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-green-primary" /> : <Copy className="w-3.5 h-3.5 text-text-muted" />}
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded hover:bg-error/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5 text-text-muted hover:text-error" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              <Pagination />

              {/* Drop hint */}
              <p className="text-center text-text-muted text-[11px] font-inter mt-4">
                Glissez-déposez des images ici · Ctrl+clic pour sélection multiple
              </p>
            </>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-green-primary" />
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-[90vw] max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={preview.url}
              alt={preview.originalName}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 rounded-b-lg">
              <p className="text-white font-inter text-sm font-medium">{preview.originalName}</p>
              <p className="text-white/70 text-xs font-inter">
                {preview.width}×{preview.height} · {formatSize(preview.size)}
              </p>
            </div>
            {/* Top-right action buttons */}
            <button
              onClick={() => setPreview(null)}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white text-text-primary flex items-center justify-center shadow-lg hover:bg-bg-secondary transition-colors"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={() => downloadMedia(preview)}
              className="absolute -top-2 right-8 w-8 h-8 rounded-full bg-white text-text-primary flex items-center justify-center shadow-lg hover:bg-bg-secondary transition-colors"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => copyUrl(preview.url, preview.id)}
              className="absolute -top-2 right-[4.5rem] w-8 h-8 rounded-full bg-white text-text-primary flex items-center justify-center shadow-lg hover:bg-bg-secondary transition-colors"
              title="Copier l'URL"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
