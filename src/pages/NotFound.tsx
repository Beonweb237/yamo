import { Link } from 'react-router-dom';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="pt-[72px] min-h-screen bg-bg-secondary flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <p className="font-poppins font-bold text-green-primary text-7xl mb-2">404</p>
        <h1 className="font-poppins font-bold text-text-primary text-2xl mb-3">
          Page introuvable
        </h1>
        <p className="text-text-secondary font-inter text-sm mb-8">
          Cette page n&apos;existe pas ou a été déplacée. Retournez à l&apos;accueil ou explorez nos restaurants.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 bg-green-primary text-white font-inter font-medium text-sm h-11 px-6 rounded-lg hover:bg-green-dark transition-colors"
          >
            <Home className="w-4 h-4" />
            Accueil
          </Link>
          <Link
            to="/restaurants"
            className="inline-flex items-center justify-center gap-2 border border-border-custom text-text-primary font-inter font-medium text-sm h-11 px-6 rounded-lg hover:bg-white transition-colors"
          >
            <Search className="w-4 h-4" />
            Restaurants
          </Link>
        </div>
      </div>
    </div>
  );
}
