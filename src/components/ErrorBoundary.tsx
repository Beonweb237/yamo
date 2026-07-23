import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Change de valeur (ex. pathname) → réinitialise le boundary à la navigation. */
  resetKey?: string;
}
interface State {
  hasError: boolean;
}

/**
 * Filet de sécurité global : un crash de rendu (ex. donnée malformée) affiche un
 * écran de secours au lieu d'une page BLANCHE. Se réinitialise automatiquement à
 * la navigation (via resetKey = pathname) pour que l'utilisateur puisse repartir.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Trace pour le diagnostic ; ne remonte jamais à l'utilisateur.
    console.error('[ErrorBoundary]', error, info);
  }

  componentDidUpdate(prev: Props) {
    // La navigation (resetKey change) relance un rendu propre de la nouvelle page.
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-bg-secondary flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-border-custom shadow-sm p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-primary/10 grid place-items-center mx-auto mb-4">
            <span className="text-3xl" role="img" aria-label="oups">🍽️</span>
          </div>
          <h1 className="font-poppins font-bold text-text-primary text-lg mb-1">Oups, un souci d'affichage</h1>
          <p className="text-text-secondary text-sm mb-6">
            Cette page n'a pas pu s'afficher correctement. Réessayez ou revenez à l'accueil.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button
              onClick={() => window.location.reload()}
              className="h-11 px-5 rounded-xl bg-green-primary text-white font-inter font-semibold text-sm hover:bg-green-dark transition-colors"
            >
              Réessayer
            </button>
            <a
              href="/"
              className="h-11 px-5 rounded-xl border border-border-custom text-text-secondary font-inter font-medium text-sm inline-flex items-center hover:bg-bg-secondary transition-colors"
            >
              Accueil
            </a>
          </div>
        </div>
      </div>
    );
  }
}
