import { useCallback, useMemo, useState } from 'react';
import { CheckCircle, EyeOff, MessageSquare, Search, Star } from 'lucide-react';
import { toast } from 'sonner';
import { usePolling } from '../../hooks/usePolling';
import { useRestaurants } from '../../hooks/useCatalog';
import { Skeleton } from '../../components/ui/skeleton';
import {
  fetchAdminReviews,
  moderateReview,
  moderateOwnerReply,
  resolveReviewReport,
  type OwnerReply,
  type Review,
  type ReviewStatus,
  type ReviewTargetType,
} from '../../lib/reviews';
import { useTranslation } from "react-i18next";

type TargetFilter = ReviewTargetType | 'all';
type StatusFilter = ReviewStatus | 'all';

const targetLabels: Record<ReviewTargetType, string> = {
  restaurant: 'Restaurant',
  driver: 'Livraison',
  dish: 'Plat',
};

const statusLabels: Record<ReviewStatus, string> = {
  published: 'Publié',
  pending: 'À vérifier',
  hidden: 'Masqué',
};

function renderStars(rating: number) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating} sur 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={`w-3.5 h-3.5 ${index < rating ? 'fill-gold-accent text-gold-accent' : 'text-border-custom'}`}
        />
      ))}
    </div>
  );
}

function statusClass(status: ReviewStatus): string {
  if (status === 'published') return 'bg-green-light text-green-primary';
  if (status === 'pending') return 'bg-gold-light text-amber-700';
  return 'bg-error/10 text-error';
}

export default function AdminReviews() {
    const { t } = useTranslation();
  const { restaurants } = useRestaurants();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [query, setQuery] = useState('');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [reportedOnly, setReportedOnly] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setReviews(await fetchAdminReviews());
    } finally {
      setLoading(false);
    }
  }, []);
  usePolling(load, 30000);

  const restaurantNameById = useMemo(
    () => Object.fromEntries(restaurants.map((restaurant) => [restaurant.id, restaurant.name])),
    [restaurants]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reviews.filter((review) => {
      if (targetFilter !== 'all' && review.targetType !== targetFilter) return false;
      if (statusFilter !== 'all' && review.status !== statusFilter) return false;
      if (reportedOnly && review.ownerReport?.status !== 'open') return false;
      if (!q) return true;
      const targetName = restaurantNameById[review.restaurantId] ?? '';
      return [
        review.comment,
        review.authorName,
        review.orderId,
        review.targetId,
        targetName,
        ...review.tags,
      ].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [query, reportedOnly, restaurantNameById, reviews, statusFilter, targetFilter]);

  const stats = useMemo(() => ({
    total: reviews.length,
    published: reviews.filter((review) => review.status === 'published').length,
    hidden: reviews.filter((review) => review.status === 'hidden').length,
    reported: reviews.filter((review) => review.ownerReport?.status === 'open').length,
  }), [reviews]);

  const applyStatus = async (review: Review, status: ReviewStatus) => {
    setUpdatingId(review.id);
    try {
      await moderateReview(
        review.id,
        status,
        status === 'hidden' ? 'Masqué par modération admin.' : undefined
      );
      toast.success(status === 'hidden' ? 'Avis masque.' : 'Avis publie.');
      await load();
    } catch (err) {
      toast.error((err as Error).message || "Impossible de moderer l'avis.");
    } finally {
      setUpdatingId(null);
    }
  };

  const dismissReport = async (review: Review) => {
    setUpdatingId(review.id);
    try {
      await resolveReviewReport(review.id);
      toast.success('Signalement classé sans action.');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Impossible de classer le signalement.');
    } finally {
      setUpdatingId(null);
    }
  };

  const applyReplyStatus = async (review: Review, status: OwnerReply['status']) => {
    setUpdatingId(review.id);
    try {
      await moderateOwnerReply(
        review.id,
        status,
        status === 'hidden' ? 'Masquée par modération admin.' : undefined
      );
      toast.success(status === 'hidden' ? 'Reponse masquee.' : 'Reponse publiee.');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Impossible de moderer la reponse.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-poppins font-bold text-text-primary text-2xl flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-green-primary" />
            {t("Avis clients")}
          </h1>
          <p className="text-text-secondary text-sm font-inter mt-1">
            {t("Avis vérifiés issus des commandes livrées.")}
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ['Total', stats.total],
            ['Publiés', stats.published],
            ['Masqués', stats.hidden],
            ['Signalés', stats.reported],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-border-custom rounded-lg px-3 py-2">
              <p className="text-[11px] text-text-muted font-inter">{label}</p>
              <p className="text-text-primary font-poppins font-semibold text-lg">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-custom p-4 mb-5">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto] gap-3">
          <label className="flex items-center gap-2 bg-bg-secondary rounded-lg px-3 h-11">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par commentaire, client, restaurant..."
              className="flex-1 bg-transparent outline-none text-sm font-inter text-text-primary placeholder:text-text-muted"
            />
          </label>
          <select
            value={targetFilter}
            onChange={(event) => setTargetFilter(event.target.value as TargetFilter)}
            className="h-11 rounded-lg bg-bg-secondary px-3 text-sm font-inter text-text-primary outline-none"
          >
            <option value="all">{t("Tous les types")}</option>
            <option value="restaurant">{t("Restaurants")}</option>
            <option value="driver">{t("Livraisons")}</option>
            <option value="dish">{t("Plats")}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="h-11 rounded-lg bg-bg-secondary px-3 text-sm font-inter text-text-primary outline-none"
          >
            <option value="all">{t("Tous les statuts")}</option>
            <option value="published">{t("Publiés")}</option>
            <option value="pending">{t("À vérifier")}</option>
            <option value="hidden">{t("Masqués")}</option>
          </select>
          <label className="flex items-center gap-2 h-11 px-3 rounded-lg bg-bg-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={reportedOnly}
              onChange={(event) => setReportedOnly(event.target.checked)}
              className="accent-green-primary"
            />
            <span className="text-sm font-inter text-text-primary whitespace-nowrap">
              {t("Signalés uniquement")}
              {stats.reported > 0 && (
                <span className="ml-1.5 bg-gold-light text-amber-700 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
                  {stats.reported}
                </span>
              )}
            </span>
          </label>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border-custom overflow-hidden">
        {loading ? (
          <div className="p-4 sm:p-5 space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <MessageSquare className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-secondary font-inter text-sm">{t("Aucun avis ne correspond aux filtres.")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map((review) => {
                const { t } = useTranslation();
              const restaurantName = restaurantNameById[review.restaurantId] ?? review.restaurantId;
              return (
                <div key={review.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-inter font-semibold text-text-primary text-sm">
                        {review.authorName || 'Client vérifié'}
                      </span>
                      <span className={`text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full ${statusClass(review.status)}`}>
                        {statusLabels[review.status]}
                      </span>
                      <span className="text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full bg-bg-secondary text-text-secondary">
                        {targetLabels[review.targetType]}
                      </span>
                      {review.isVerifiedOrder && (
                        <span className="text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full bg-green-light text-green-primary">
                          {t("Commande vérifiée")}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {renderStars(review.rating)}
                      <span className="text-xs text-text-muted font-inter">
                        {restaurantName} · #{review.orderId.slice(0, 8)} · {new Date(review.createdAt).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    {review.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {review.tags.map((tag) => (
                          <span key={tag} className="bg-bg-secondary text-text-secondary text-[11px] font-inter px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {review.comment ? (
                      <p className="text-text-primary text-sm font-inter leading-relaxed">{review.comment}</p>
                    ) : (
                      <p className="text-text-muted text-sm font-inter italic">{t("Aucun commentaire.")}</p>
                    )}

                    {/* Signalement du restaurant — file de traitement admin */}
                    {review.ownerReport && (
                      <div className={`mt-3 rounded-lg p-3 border-l-2 ${review.ownerReport.status === 'open' ? 'bg-gold-light/50 border-gold-accent' : 'bg-bg-secondary border-border-custom'}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-inter font-semibold text-amber-700 uppercase tracking-wide">
                            {t("Signalé par le restaurant")}
                          </span>
                          <span className={`text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full ${review.ownerReport.status === 'open' ? 'bg-gold-light text-amber-700' : 'bg-bg-secondary text-text-muted'}`}>
                            {review.ownerReport.status === 'open' ? 'A traiter' : 'Traite'}
                          </span>
                          <span className="text-[11px] text-text-muted font-inter">
                            {new Date(review.ownerReport.createdAt).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <p className="text-text-primary text-sm font-inter leading-relaxed">
                          {t("Motif :")} {review.ownerReport.reason}
                        </p>
                        {review.ownerReport.status === 'open' && (
                          <p className="text-text-muted text-xs font-inter mt-1">
                            {t("Masquer ou re-publier l&apos;avis clôt le signalement, ou classez-le sans action :")}
                          </p>
                        )}
                        {review.ownerReport.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => dismissReport(review)}
                            disabled={updatingId === review.id}
                            className="mt-2 inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-bg-secondary text-text-secondary text-xs font-inter font-semibold hover:bg-text-secondary hover:text-white transition-colors disabled:opacity-60"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t("Classer sans action")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Réponse du restaurant — modérable indépendamment de l'avis */}
                    {review.ownerReply && (
                      <div className={`mt-3 rounded-lg p-3 border-l-2 ${review.ownerReply.status === 'hidden' ? 'bg-error/5 border-error' : 'bg-bg-secondary border-green-primary'}`}>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-inter font-semibold text-text-secondary uppercase tracking-wide">
                            {t("Reponse du restaurant")}
                          </span>
                          <span className={`text-[11px] font-inter font-semibold px-2 py-0.5 rounded-full ${review.ownerReply.status === 'hidden' ? 'bg-error/10 text-error' : 'bg-green-light text-green-primary'}`}>
                            {review.ownerReply.status === 'hidden' ? 'Masquée' : 'Publiée'}
                          </span>
                          <span className="text-[11px] text-text-muted font-inter">
                            {new Date(review.ownerReply.createdAt).toLocaleString('fr-FR')}
                            {review.ownerReply.updatedAt && ' · modifiee'}
                          </span>
                        </div>
                        <p className="text-text-primary text-sm font-inter leading-relaxed">{review.ownerReply.text}</p>
                        {review.ownerReply.status === 'hidden' && review.ownerReply.moderationReason && (
                          <p className="text-error text-xs font-inter mt-1">{t("Motif :")} {review.ownerReply.moderationReason}</p>
                        )}
                        <div className="flex gap-2 mt-2">
                          {review.ownerReply.status !== 'published' && (
                            <button
                              type="button"
                              onClick={() => applyReplyStatus(review, 'published')}
                              disabled={updatingId === review.id}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-green-light text-green-primary text-xs font-inter font-semibold hover:bg-green-primary hover:text-white transition-colors disabled:opacity-60"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {t("Publier la réponse")}
                            </button>
                          )}
                          {review.ownerReply.status !== 'hidden' && (
                            <button
                              type="button"
                              onClick={() => applyReplyStatus(review, 'hidden')}
                              disabled={updatingId === review.id}
                              className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-error/10 text-error text-xs font-inter font-semibold hover:bg-error hover:text-white transition-colors disabled:opacity-60"
                            >
                              <EyeOff className="w-3.5 h-3.5" />
                              {t("Masquer la réponse")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {review.status !== 'published' && (
                      <button
                        type="button"
                        onClick={() => applyStatus(review, 'published')}
                        disabled={updatingId === review.id}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-green-light text-green-primary text-xs font-inter font-semibold hover:bg-green-primary hover:text-white transition-colors disabled:opacity-60"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {t("Publier")}
                      </button>
                    )}
                    {review.status !== 'hidden' && (
                      <button
                        type="button"
                        onClick={() => applyStatus(review, 'hidden')}
                        disabled={updatingId === review.id}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-error/10 text-error text-xs font-inter font-semibold hover:bg-error hover:text-white transition-colors disabled:opacity-60"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        {t("Masquer")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
