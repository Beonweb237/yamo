import { Link } from 'react-router-dom';
import { Home, Search, MapPin } from 'lucide-react';
import { useTranslation } from "react-i18next";

export default function NotFound() {
    const { t } = useTranslation();
  return (
    <div className="pt-[72px] min-h-screen bg-gradient-to-b from-green-50/50 to-bg-secondary flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-border-custom shadow-sm p-8 sm:p-10 text-center max-w-md w-full">
        <div className="w-20 h-20 rounded-2xl bg-green-light flex items-center justify-center mx-auto mb-5">
          <MapPin className="w-10 h-10 text-green-primary" />
        </div>
        <p className="font-poppins font-bold text-green-primary text-6xl mb-2">404</p>
        <h1 className="font-poppins font-bold text-text-primary text-xl mb-3">
          {t("Page introuvable")}
        </h1>
        <p className="text-text-secondary font-inter text-sm mb-8">
          {t("Cette page n’existe pas ou a été déplacée. Retournez à l’accueil ou explorez nos restaurants.")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-green-primary text-white font-inter font-medium text-sm h-11 px-6 rounded-xl hover:bg-green-dark hover:shadow-lg active:scale-95 transition-all"
          >
            <Home className="w-4 h-4" />
            {t("Accueil")}
          </Link>
          <Link
            to="/restaurants"
            className="inline-flex items-center justify-center gap-2 border border-border-custom text-text-primary font-inter font-medium text-sm h-11 px-6 rounded-xl hover:bg-bg-secondary transition-colors"
          >
            <Search className="w-4 h-4" />
            {t("Restaurants")}
          </Link>
        </div>
      </div>
    </div>
  );
}
