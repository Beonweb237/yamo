import HomeClassic from './HomeClassic';

// Template « Premium » de l'accueil — placeholder CP1.
// CP3 le remplacera par la vraie Home Premium (maquette validée, en-tête perso,
// « Pour vous », promos réelles, « Commander à nouveau »…). En attendant, il rend
// le template classique pour ne jamais afficher de page vide si « premium » est choisi.
export default function HomePremium() {
  return <HomeClassic />;
}
