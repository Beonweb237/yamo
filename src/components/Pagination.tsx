import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  // Calcul des pages visibles (toujours 5 au maximum)
  const getVisiblePages = (): (number | '...')[] => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | '...')[] = [];
    // Toujours montrer la première page
    pages.push(1);

    if (currentPage > 3) pages.push('...');

    // Pages autour de la page courante
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      if (i > 1 && i < totalPages) pages.push(i);
    }

    if (currentPage < totalPages - 2) pages.push('...');

    // Toujours montrer la dernière page
    if (totalPages > 1) pages.push(totalPages);

    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <nav className="flex items-center justify-center gap-1 py-4" aria-label="Pagination">
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Page précédente"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {visiblePages.map((page, i) =>
        page === '...' ? (
          <span key={`ellipsis-${i}`} className="w-9 h-9 flex items-center justify-center text-xs text-text-muted">
            ...
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`min-w-[36px] h-9 rounded-lg text-sm font-inter font-medium transition-colors ${page === currentPage
                ? 'bg-green-primary text-white'
                : 'text-text-secondary hover:bg-bg-secondary'
              }`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:bg-bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Page suivante"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </nav>
  );
}
