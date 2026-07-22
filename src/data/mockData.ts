import { slugify } from '../lib/utils';

export interface Restaurant {
  id: string;
  /** Slug URL-friendly unique, généré depuis le nom. Définitif après soumission. Auto-généré si absent. */
  slug?: string;
  /** users.id du compte propriétaire (mode VPS) — cible du reset mot de passe admin. */
  ownerId?: string;
  name: string;
  image: string;
  category: string;
  city: string;
  neighborhood: string;
  rating: number;
  /** Score bayesien utilise pour classer les restaurants quand des avis reels existent. */
  ratingWeighted?: number;
  /** Repartition dynamique des avis publies par note. */
  ratingBreakdown?: Record<1 | 2 | 3 | 4 | 5, number>;
  /** Nombre d'avis verifies issus de commandes livrees. */
  verifiedReviewCount?: number;
  /** Nombre d'avis dynamiques ajoutes par le systeme de notation. */
  dynamicReviewCount?: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  priceRange: string;
  address: string;
  phone: string;
  email?: string;
  hours: string;
  isOpen: boolean;
  tags: string[];
  isPremium: boolean;
  /** Restaurant vérifié par MiamExpress (badge de confiance). Activé automatiquement après X avis vérifiés, ou manuellement par l'admin. */
  verified?: boolean;
  description: string;
  gallery?: string[]; // Additional restaurant photos (interior, dishes, ambiance...)
  /** Taux de commission MiamExpress pour ce restaurant (0.15 = 15%). Défaut si absent : 0.15. */
  commissionRate?: number;
  lat?: number;
  lng?: number;
  deliveryRadiusKm?: number;
  /** Code marchand Mobile Money du resto — affiché au client pour payer la garantie (série PTS). Absent = garantie ignorée, paiement à la livraison uniquement. */
  merchantCode?: string;
  /** Numéro WhatsApp d'assistance du resto, affiché avec le code marchand à l'étape garantie (série PTS). */
  assistanceWhatsapp?: string;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isPopular: boolean;
  isAvailable?: boolean;
  hasImage?: boolean;
  variants?: { name: string; price: number }[];
  supplements?: { name: string; price: number }[];
  dietaryTags?: string[]; // Dietary/diet tags: "sans-sucre", "diabétique", "végétarien", "halal", etc.
  catalogDishId?: string; // Link to dish_catalog entry — admin-managed default image + tags
}

export interface DishCatalogEntry {
  id: string;
  name: string;
  category: string;
  defaultImage: string;
  tags: string[];
  description: string;
  approvedBy?: string; // admin user id
  approvedAt?: string;
}

export interface Review {
  id: string;
  name: string;
  avatar?: string;
  initial: string;
  rating: number;
  comment: string;
  date: string;
  location?: string;
  role?: string;
  order?: string;
}

export interface FAQItem {
  question: string;
  answer: string;
  category?: string;
}

export interface CuisineCategory {
  id: string;
  name: string;
  image: string;
}

export const cuisineCategories: CuisineCategory[] = [
  { id: '1', name: 'Camerounaise', image: '/cat-camerounaise.jpg' },
  { id: '2', name: 'Fast-Food', image: '/cat-fastfood.jpg' },
  { id: '3', name: 'Pizza', image: '/cat-pizza.jpg' },
  { id: '4', name: 'Grillades', image: '/cat-grillades.jpg' },
  { id: '5', name: 'Fruits de Mer', image: '/cat-fruitsmer.jpg' },
  { id: '6', name: 'P\u00e2tisseries', image: '/cat-patisseries.jpg' },
  { id: '7', name: 'Boissons', image: '/cat-boissons.jpg' },
  { id: '8', name: 'Petit-D\u00e9jeuner', image: '/cat-petitdej.jpg' },
];

export const restaurantMenuCategories = [
  'Entrées',
  'Plats Principaux',
  'Grillades',
  'Accompagnements',
  'Pizza',
  'Petit-Déjeuner',
  'Pâtisseries',
  'Boissons',
  'Desserts',
] as const;

export const mealCategoryImages: Record<string, string> = {
  Camerounaise: '/cat-camerounaise.jpg',
  'Fast-Food': '/cat-fastfood.jpg',
  Pizza: '/cat-pizza.jpg',
  Grillades: '/cat-grillades.jpg',
  'Fruits de Mer': '/cat-fruitsmer.jpg',
  'Pâtisseries': '/cat-patisseries.jpg',
  Boissons: '/cat-boissons.jpg',
  'Petit-Déjeuner': '/cat-petitdej.jpg',
  'Plats Principaux': '/plat-ndole.jpg',
  Entrées: '/cat-camerounaise.jpg',
  Accompagnements: '/cat-fastfood.jpg',
  Desserts: '/cat-patisseries.jpg',
};

export function getMealCategoryImage(category: string): string {
  return mealCategoryImages[category] ?? '/cat-camerounaise.jpg';
}

export const restaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Chez Mama',
    image: '/resto-ndole.jpg',
    category: 'Camerounaise',
    city: 'Douala',
    neighborhood: 'Bonapriso',
    rating: 4.8,
    reviewCount: 234,
    deliveryTime: '25-35 min',
    deliveryFee: 0,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Bonapriso, Douala',
    phone: '677 77 77 71',
    hours: '08:00 - 22:00',
    isOpen: true,
    tags: ['Camerounaise', 'Traditionnel'],
    isPremium: true,
    verified: true,
    description: 'Authentique cuisine camerounaise pr\u00e9par\u00e9e avec amour selon les recettes traditionnelles de la r\u00e9gion du Littoral. Sp\u00e9cialit\u00e9s : Ndol\u00e9, Poulet DG, Eru, et grillades maison.',
    gallery: [
      '/resto-ndole.jpg',
      '/plat-ndole.jpg',
      '/plat-pouletdg.jpg',
      '/menu-brochettes-boeuf.jpg',
    ],
    lat: 4.0511,
    lng: 9.7075,
    deliveryRadiusKm: 5,
    merchantCode: '057575',
    assistanceWhatsapp: '677777771',
  },
  {
    id: '2',
    name: 'Poulet DG Royal',
    image: '/resto-pouletdg.jpg',
    category: 'Camerounaise',
    city: 'Douala',
    neighborhood: 'Akwa',
    rating: 4.6,
    reviewCount: 189,
    deliveryTime: '30-40 min',
    deliveryFee: 0,
    minOrder: 2500,
    priceRange: '\u20ac\u20ac',
    address: 'Akwa, Douala',
    phone: '677 77 77 72',
    hours: '10:00 - 23:00',
    isOpen: true,
    tags: ['Camerounaise', 'Poulet DG'],
    isPremium: false,
    description: 'Le meilleur Poulet DG de Douala, pr\u00e9par\u00e9 avec des plantains parfaitement frits et une sauce savoureuse. Une exp\u00e9rience culinaire inoubliable.',
    gallery: [
      '/resto-pouletdg.jpg',
      '/plat-pouletdg.jpg',
      '/menu-alloco-epice.jpg',
    ],
    lat: 4.0500,
    lng: 9.7000,
    deliveryRadiusKm: 4,
    merchantCode: '058320',
    assistanceWhatsapp: '699887766',
  },
  {
    id: '3',
    name: 'Le B\u00fbcheron',
    image: '/resto-grill.jpg',
    category: 'Grillades',
    city: 'Douala',
    neighborhood: 'Deido',
    rating: 4.7,
    reviewCount: 156,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1500,
    priceRange: '\u20ac',
    address: 'Deido, Douala',
    phone: '677 77 77 73',
    hours: '11:00 - 00:00',
    isOpen: true,
    tags: ['Grillades', 'Brochettes'],
    isPremium: false,
    description: 'Grillades au feu de bois, brochettes de b\u0153uf, poulet brais\u00e9 et poisson grill\u00e9. L\'authenticit\u00e9 du barbecue camerounais.',
    lat: 4.0650,
    lng: 9.7150,
    deliveryRadiusKm: 3,
  },
  {
    id: '4',
    name: 'Douala Boulangerie',
    image: '/resto-boulangerie.jpg',
    category: 'P\u00e2tisseries',
    city: 'Douala',
    neighborhood: 'Bonanjo',
    rating: 4.9,
    reviewCount: 312,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1000,
    priceRange: '\u20ac\u20ac',
    address: 'Bonanjo, Douala',
    phone: '677 77 77 74',
    hours: '06:00 - 20:00',
    isOpen: true,
    tags: ['P\u00e2tisseries', 'Caf\u00e9'],
    isPremium: true,
    verified: true,
    description: 'Boulangerie franco-camerounaise avec des pains artisanaux, des p\u00e2tisseries fra\u00eeches et des viennoiseries dor\u00e9es. Parfait pour le petit-d\u00e9jeuner.',
    lat: 4.0450,
    lng: 9.6920,
    deliveryRadiusKm: 5,
  },
  {
    id: '5',
    name: 'Saveurs de la Mer',
    image: '/resto-seafood.jpg',
    category: 'Fruits de Mer',
    city: 'Douala',
    neighborhood: 'Bonapriso',
    rating: 4.5,
    reviewCount: 98,
    deliveryTime: '35-45 min',
    deliveryFee: 1000,
    minOrder: 5000,
    priceRange: '\u20ac\u20ac\u20ac',
    address: 'Bonapriso, Douala',
    phone: '677 77 77 75',
    hours: '12:00 - 23:00',
    isOpen: true,
    tags: ['Fruits de Mer', 'Poisson'],
    isPremium: true,
    verified: true,
    description: 'Fruits de mer frais p\u00each\u00e9s du jour : crevettes, homard, poisson grill\u00e9. Une exp\u00e9rience gastronomique au c\u0153ur de Douala.',
    lat: 4.0511,
    lng: 9.7075,
    deliveryRadiusKm: 6,
  },
  {
    id: '6',
    name: 'Le DG',
    image: '/menu-burger-mboa.jpg',
    category: 'Fast-Food',
    city: 'Douala',
    neighborhood: 'Makepe',
    rating: 4.3,
    reviewCount: 145,
    deliveryTime: '20-25 min',
    deliveryFee: 0,
    minOrder: 1500,
    priceRange: '\u20ac\u20ac',
    address: 'Makepe, Douala',
    phone: '677 77 77 76',
    hours: '10:00 - 22:00',
    isOpen: true,
    tags: ['Fast-Food', 'Burgers'],
    isPremium: false,
    description: 'Burgers gourmet, sandwiches gourmands et frites maison. Fast-food de qualit\u00e9 avec des ingr\u00e9dients frais.',
    lat: 4.0580,
    lng: 9.7350,
    deliveryRadiusKm: 4,
  },
  {
    id: '7',
    name: 'Boukarou Grill',
    image: '/menu-boukarou-boeuf.jpg',
    category: 'Grillades',
    city: 'Yaoundé',
    neighborhood: 'Bastos',
    rating: 4.4,
    reviewCount: 87,
    deliveryTime: '25-35 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '\u20ac',
    address: 'Bastos, Yaoundé',
    phone: '677 77 77 77',
    hours: '11:00 - 23:00',
    isOpen: true,
    tags: ['Grillades', 'Traditionnel'],
    isPremium: false,
    description: 'Sp\u00e9cialiste du boukarou camerounais. Viandes marin\u00e9es et grill\u00e9es au feu de bois dans un cadre traditionnel.',
    lat: 3.8750,
    lng: 11.5050,
    deliveryRadiusKm: 5,
  },
  {
    id: '8',
    name: 'Mama Grace Kitchen',
    image: '/menu-eru.jpg',
    category: 'Camerounaise',
    city: 'Yaoundé',
    neighborhood: 'Mokolo',
    rating: 4.7,
    reviewCount: 201,
    deliveryTime: '30-40 min',
    deliveryFee: 0,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Mokolo, Yaoundé',
    phone: '677 77 77 78',
    hours: '08:00 - 21:00',
    isOpen: true,
    tags: ['Camerounaise', 'Familial'],
    isPremium: false,
    description: 'Cuisine camerounaise familiale pr\u00e9par\u00e9e par Mama Grace elle-m\u00eame. Portions g\u00e9n\u00e9reuses et saveurs authentiques.',
    lat: 3.8650,
    lng: 11.5200,
    deliveryRadiusKm: 4,
  },
  {
    id: '9',
    name: 'Suya Express',
    image: '/menu-suya-boeuf.jpg',
    category: 'Grillades',
    city: 'Douala',
    neighborhood: 'Akwa',
    rating: 4.2,
    reviewCount: 134,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1000,
    priceRange: '\u20ac',
    address: 'Akwa, Douala',
    phone: '677 77 77 79',
    hours: '10:00 - 02:00',
    isOpen: true,
    tags: ['Grillades', 'Suya', 'Street Food'],
    isPremium: false,
    description: 'Suya traditionnel \u00e9pici\u00e9, pr\u00e9par\u00e9 \u00e0 la demande sur charbon de bois. Le go\u00fbt authentique du street food nig\u00e9rian et camerounais.',
    lat: 4.0500,
    lng: 9.7000,
    deliveryRadiusKm: 3,
  },
  {
    id: '10',
    name: 'La Fourchette Royale',
    image: '/menu-homard-thermidor.jpg',
    category: 'Fruits de Mer',
    city: 'Douala',
    neighborhood: 'Bonapriso',
    rating: 4.6,
    reviewCount: 76,
    deliveryTime: '40-50 min',
    deliveryFee: 1000,
    minOrder: 5000,
    priceRange: '\u20ac\u20ac\u20ac',
    address: 'Bonapriso, Douala',
    phone: '677 77 77 80',
    hours: '12:00 - 23:00',
    isOpen: true,
    tags: ['Fruits de Mer', 'Gastronomique'],
    isPremium: true,
    description: 'Haute gastronomie fran\u00e7aise et camerounaise. Plats raffin\u00e9s, pr\u00e9sentation soign\u00e9e et ingr\u00e9dients d\'exception.',
    lat: 4.0511,
    lng: 9.7075,
    deliveryRadiusKm: 7,
  },
  {
    id: '11',
    name: 'Chez Kadi',
    image: '/menu-gateau-chocolat.jpg',
    category: 'P\u00e2tisseries',
    city: 'Yaoundé',
    neighborhood: 'Nlongkak',
    rating: 4.5,
    reviewCount: 112,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1500,
    priceRange: '\u20ac\u20ac',
    address: 'Nlongkak, Yaoundé',
    phone: '677 77 77 81',
    hours: '07:00 - 19:00',
    isOpen: true,
    tags: ['P\u00e2tisseries', 'Caf\u00e9', 'Th\u00e9'],
    isPremium: false,
    description: 'Salon de th\u00e9 et p\u00e2tisserie. G\u00e2teaux faits maison, cr\u00eapes, glaces artisanales et caf\u00e9s aromatiques.',
    lat: 3.8800,
    lng: 11.4950,
    deliveryRadiusKm: 4,
  },
  {
    id: '12',
    name: 'Bantu Cuisine',
    image: '/menu-koki.jpg',
    category: 'Camerounaise',
    city: 'Douala',
    neighborhood: 'Bali',
    rating: 4.4,
    reviewCount: 167,
    deliveryTime: '25-35 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Bali, Douala',
    phone: '677 77 77 82',
    hours: '09:00 - 22:00',
    isOpen: true,
    lat: 4.0400,
    lng: 9.6850,
    deliveryRadiusKm: 4,
    tags: ['Camerounaise', 'R\u00e9gionale'],
    isPremium: false,
    description: 'Cuisine bantu authentique du Cameroun. Ndol\u00e9, Koki, Eru, et autres sp\u00e9cialit\u00e9s r\u00e9gionales pr\u00e9par\u00e9es traditionnellement.',
  },
  {
    id: '13',
    name: 'La Bella Pizza',
    image: '/menu-pizza-margherita.jpg',
    category: 'Pizza',
    city: 'Douala',
    neighborhood: 'Akwa',
    rating: 4.6,
    reviewCount: 185,
    deliveryTime: '30-40 min',
    deliveryFee: 500,
    minOrder: 3000,
    priceRange: '€€',
    address: 'Akwa, Douala',
    phone: '677 77 77 83',
    hours: '11:00 - 23:00',
    isOpen: true,
    tags: ['Pizza', 'Italienne'],
    isPremium: false,
    description: 'De délicieuses pizzas cuites au feu de bois avec des ingrédients frais et une pâte artisanale.',
    lat: 4.0500,
    lng: 9.7000,
    deliveryRadiusKm: 5,
  },
  {
    id: '14',
    name: 'Fresh Juice & Co',
    image: '/drink-passion.jpg',
    category: 'Boissons',
    city: 'Yaoundé',
    neighborhood: 'Bastos',
    rating: 4.8,
    reviewCount: 240,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1500,
    priceRange: '€',
    address: 'Bastos, Yaoundé',
    phone: '677 77 77 84',
    hours: '08:00 - 20:00',
    isOpen: true,
    tags: ['Boissons', 'Jus Frais', 'Smoothies'],
    isPremium: true,
    description: 'Jus de fruits frais, smoothies, cocktails detox et boissons rafraîchissantes pressés à la demande.',
    lat: 3.8750,
    lng: 11.5050,
    deliveryRadiusKm: 4,
  },
  {
    id: '15',
    name: 'Le Matin Doux',
    image: '/menu-omelette-complete.jpg',
    category: 'Petit-Déjeuner',
    city: 'Douala',
    neighborhood: 'Bonanjo',
    rating: 4.7,
    reviewCount: 150,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '€€',
    address: 'Bonanjo, Douala',
    phone: '677 77 77 85',
    hours: '06:00 - 14:00',
    isOpen: true,
    tags: ['Petit-Déjeuner', 'Brunch'],
    isPremium: false,
    description: 'Commencez votre journée du bon pied avec nos petits-déjeuners complets, omelettes, crêpes et boissons chaudes.',
    lat: 4.0450,
    lng: 9.6920,
    deliveryRadiusKm: 3,
  }, {
    id: '16',
    name: 'Burger Mboa',
    image: '/menu-burger-classic.jpg',
    category: 'Fast-Food',
    city: 'Bafoussam',
    neighborhood: 'Kamkop',
    rating: 4.4,
    reviewCount: 92,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1800,
    priceRange: '€€',
    address: 'Kamkop, Bafoussam',
    phone: '677 77 77 86',
    hours: '10:00 - 22:30',
    isOpen: true,
    tags: ['Fast-Food', 'Burgers', 'Snacks'],
    isPremium: false,
    description: 'Burgers, sandwichs chauds et accompagnements rapides préparés avec des produits frais du marché de Bafoussam.',
    lat: 5.4800,
    lng: 10.4100,
    deliveryRadiusKm: 5,
  },
  {
    id: '17',
    name: 'Snack Express Garoua',
    image: '/menu-shawarma-poulet.jpg',
    category: 'Fast-Food',
    city: 'Garoua',
    neighborhood: 'Plateau',
    rating: 4.3,
    reviewCount: 78,
    deliveryTime: '18-28 min',
    deliveryFee: 500,
    minOrder: 1500,
    priceRange: '€',
    address: 'Plateau, Garoua',
    phone: '677 77 77 87',
    hours: '09:00 - 23:00',
    isOpen: true,
    tags: ['Fast-Food', 'Shawarma', 'Alloco'],
    isPremium: false,
    description: 'Snack urbain pour repas rapides : shawarmas, alloco, samoussas et boissons fraîches.',
    lat: 9.3000,
    lng: 13.4000,
    deliveryRadiusKm: 5,
  },
  {
    id: '18',
    name: 'Pizza Mboa',
    image: '/menu-pizza-poulet-dg.jpg',
    category: 'Pizza',
    city: 'Yaoundé',
    neighborhood: 'Essos',
    rating: 4.5,
    reviewCount: 131,
    deliveryTime: '30-40 min',
    deliveryFee: 500,
    minOrder: 3500,
    priceRange: '€€',
    address: 'Essos, Yaoundé',
    phone: '677 77 77 88',
    hours: '11:00 - 23:30',
    isOpen: true,
    tags: ['Pizza', 'Fusion', 'Poulet DG'],
    isPremium: false,
    description: 'Pizzas généreuses avec une touche camerounaise : poulet DG, légumes frais et pâte maison.',
  },
  {
    id: '19',
    name: 'Pizza du Mont',
    image: '/menu-pizza-mont-cameroun.jpg',
    category: 'Pizza',
    city: 'Buea',
    neighborhood: 'Molyko',
    rating: 4.6,
    reviewCount: 106,
    deliveryTime: '25-35 min',
    deliveryFee: 500,
    minOrder: 3000,
    priceRange: '€€',
    address: 'Molyko, Buea',
    phone: '677 77 77 89',
    hours: '11:00 - 22:30',
    isOpen: true,
    tags: ['Pizza', 'Étudiant', 'Four à pierre'],
    isPremium: false,
    description: 'Pizzas croustillantes inspirées du Mont Cameroun, parfaites pour les groupes et soirées étudiantes.',
  },
  {
    id: '20',
    name: 'Kribi Seafood Corner',
    image: '/menu-crevettes-coco.jpg',
    category: 'Fruits de Mer',
    city: 'Kribi',
    neighborhood: 'Mboamanga',
    rating: 4.7,
    reviewCount: 119,
    deliveryTime: '35-45 min',
    deliveryFee: 1000,
    minOrder: 4500,
    priceRange: '€€€',
    address: 'Mboamanga, Kribi',
    phone: '677 77 77 90',
    hours: '11:00 - 22:00',
    isOpen: true,
    tags: ['Fruits de Mer', 'Poisson', 'Crevettes'],
    isPremium: true,
    description: 'Poissons, crevettes et spécialités de Kribi servis avec des accompagnements tropicaux.',
  },
  {
    id: '21',
    name: 'Café des Délices',
    image: '/menu-mille-feuille.jpg',
    category: 'Pâtisseries',
    city: 'Bamenda',
    neighborhood: 'Commercial Avenue',
    rating: 4.5,
    reviewCount: 84,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1200,
    priceRange: '€€',
    address: 'Commercial Avenue, Bamenda',
    phone: '677 77 77 91',
    hours: '06:30 - 20:00',
    isOpen: true,
    tags: ['Pâtisseries', 'Café', 'Gâteaux'],
    isPremium: false,
    description: 'Pâtisseries fines, cafés aromatiques et douceurs maison pour pauses gourmandes.',
  },
  {
    id: '22',
    name: 'Vitamin Bar Douala',
    image: '/drink-goyave.jpg',
    category: 'Boissons',
    city: 'Douala',
    neighborhood: 'Logpom',
    rating: 4.6,
    reviewCount: 141,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1500,
    priceRange: '€',
    address: 'Logpom, Douala',
    phone: '677 77 77 92',
    hours: '08:00 - 21:00',
    isOpen: true,
    tags: ['Boissons', 'Jus Frais', 'Détox'],
    isPremium: true,
    description: 'Bar à jus frais, smoothies et boissons vitaminées pressées à la commande.',
  },
  {
    id: '23',
    name: 'Smoothie Palace',
    image: '/drink-smoothie-baobab.jpg',
    category: 'Boissons',
    city: 'Bafoussam',
    neighborhood: 'Centre-ville',
    rating: 4.4,
    reviewCount: 73,
    deliveryTime: '15-25 min',
    deliveryFee: 500,
    minOrder: 1200,
    priceRange: '€',
    address: 'Centre-ville, Bafoussam',
    phone: '677 77 77 93',
    hours: '08:00 - 20:30',
    isOpen: true,
    tags: ['Boissons', 'Smoothies', 'Yaourts'],
    isPremium: false,
    description: 'Smoothies épais, jus locaux et yaourts tropicaux servis très frais.',
  },
  {
    id: '24',
    name: 'Brunch des Collines',
    image: '/menu-bouillie-beignets.jpg',
    category: 'Petit-Déjeuner',
    city: 'Yaoundé',
    neighborhood: 'Odza',
    rating: 4.5,
    reviewCount: 99,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '€€',
    address: 'Odza, Yaoundé',
    phone: '677 77 77 94',
    hours: '06:00 - 15:00',
    isOpen: true,
    tags: ['Petit-Déjeuner', 'Brunch', 'Café'],
    isPremium: false,
    description: 'Petits-déjeuners complets, bouillies locales, omelettes et cafés servis dès le matin.',
  },
  {
    id: '25',
    name: 'Morning House Limbe',
    image: '/menu-omelette-champignons.jpg',
    category: 'Petit-Déjeuner',
    city: 'Limbe',
    neighborhood: 'Down Beach',
    rating: 4.6,
    reviewCount: 88,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1800,
    priceRange: '€€',
    address: 'Down Beach, Limbe',
    phone: '677 77 77 95',
    hours: '06:00 - 14:30',
    isOpen: true,
    tags: ['Petit-Déjeuner', 'Brunch', 'Viennoiseries'],
    isPremium: false,
    description: 'Brunch de bord de mer : omelettes, pancakes, pains sucrés et boissons chaudes.',
  },
];

// Assigner les slugs auto-générés depuis le nom du restaurant
restaurants.forEach((r) => { if (!r.slug) r.slug = slugify(r.name); });

export const menuItems: MenuItem[] = [
  { id: 'm1', restaurantId: '1', name: 'Ndolé avec Bœuf et Crevettes', description: 'Feuilles de ndolé mijotées dans une sauce riche aux arachides, accompagnées de bœuf tendre et de crevettes fraîches.', price: 3500, category: 'Plats Principaux', image: '/plat-ndole.jpg', isPopular: true, dietaryTags: ['riche-en-protéines', 'halal'], catalogDishId: 'dc1' },
  { id: 'm2', restaurantId: '1', name: 'Poulet DG Traditionnel', description: 'Poulet braisé avec des cubes de plantain dorés, des poivrons colorés et une sauce tomate épicée.', price: 4000, category: 'Plats Principaux', image: '/plat-pouletdg.jpg', isPopular: true, dietaryTags: ['halal', 'épicé'], catalogDishId: 'dc2', variants: [{ name: 'Portion normale', price: 0 }, { name: 'Grande portion', price: 1500 }], supplements: [{ name: 'Suppl. plantain', price: 500 }, { name: 'Boisson gingembre', price: 800 }] },
  { id: 'm3', restaurantId: '1', name: 'Brochettes de Bœuf (6 pcs)', description: 'Brochettes de bœuf marinées grillées au charbon de bois, servies avec oignons et tomates.', price: 2500, category: 'Grillades', image: '/menu-brochettes-boeuf.jpg', isPopular: true, catalogDishId: 'dc3' },
  { id: 'm4', restaurantId: '1', name: 'Riz Sauce Tomate + Poisson', description: 'Riz parfumé à la sauce tomate avec du poisson tilapia grillé et des bananes plantain frites.', price: 3000, category: 'Plats Principaux', image: '/plat-rizpoisson.jpg', isPopular: true, catalogDishId: 'dc5' },
  { id: 'm5', restaurantId: '1', name: 'Eru aux Feuilles de Waterleaf', description: 'Eru traditionnel aux feuilles de waterleaf avec du poisson fumé et de la viande de bœuf.', price: 3500, category: 'Plats Principaux', image: '/menu-eru.jpg', isPopular: false, catalogDishId: 'dc6' },
  { id: 'm6', restaurantId: '1', name: 'Koki avec Banane Plantain', description: 'Gâteau de koki à base de haricots rouges, servi avec des bananes plantain bouillies.', price: 2000, category: 'Plats Principaux', image: '/menu-koki.jpg', isPopular: false, catalogDishId: 'dc13' },
  { id: 'm7', restaurantId: '1', name: 'Poisson Braisé Complet', description: 'Poisson bar entier braisé au charbon, servi avec des légumes grillés et de l\'alloco.', price: 5000, category: 'Grillades', image: '/menu-poisson-braise.jpg', isPopular: false, catalogDishId: 'dc4' },
  {
    id: 'm8',
    restaurantId: '1',
    name: 'Poulet Brais\u00e9 + Frites',
    description: 'Poulet entier brais\u00e9 \u00e0 la braise avec des frites de plantain et une salade fra\u00eeche.',
    price: 3500,
    category: 'Grillades',
    image: '/menu-poulet-braise.jpg',
    isPopular: false,
  },
  { id: 'm9', restaurantId: '1', name: 'Beignets Haricot', description: 'Beignets croustillants de haricots servis avec une sauce pimentée maison.', price: 1000, category: 'Entrées', image: '/menu-beignets-haricot.jpg', isPopular: false, catalogDishId: 'dc11' },
  { id: 'm10', restaurantId: '1', name: 'Jus de Bissap Frais', description: 'Jus de bissap (hibiscus) frais, pressé du jour et servi sans sucre ajouté.', price: 800, category: 'Boissons', image: '/drink-bissap.jpg', isPopular: false, catalogDishId: 'dc9' },
  { id: 'm11', restaurantId: '1', name: 'Jus de Gingembre Maison', description: 'Jus de gingembre frais pressé, rafraîchissant et préparé maison sans sucre ajouté.', price: 800, category: 'Boissons', image: '/drink-gingembre.jpg', isPopular: true, catalogDishId: 'dc8' },
  {
    id: 'm12',
    restaurantId: '1',
    name: 'Coca-Cola 33cl',
    description: 'Canette de Coca-Cola fra\u00eeche 33cl.',
    price: 700,
    category: 'Boissons',
    image: '/menu-coca-cola.jpg',
    isPopular: false,
  },
  { id: 'm13', restaurantId: '1', name: 'Eau Minérale 50cl', description: 'Bouteille d\'eau minérale 50cl, naturellement sans sucre.', price: 500, category: 'Boissons', image: '/menu-eau-minerale.jpg', isPopular: false, dietaryTags: ['sans-sucre'] },
  {
    id: 'm14',
    restaurantId: '1',
    name: 'Tarte au Chocolat',
    description: 'Tarte au chocolat noir fondant sur un fond de pâte sabl\u00e9e croustillante.',
    price: 1500,
    category: 'Desserts',
    image: '/menu-tarte-chocolat.jpg',
    isPopular: false,
  },
  { id: 'm15', restaurantId: '1', name: 'Salade de Fruits Bio', description: 'Assortiment de fruits bio de saison, portion légère et servie sans sucre ajouté.', price: 1200, category: 'Desserts', image: '/menu-salade-fruits.jpg', isPopular: false, dietaryTags: ['bio', 'sans-sucre', 'vegetarien', 'allege'], catalogDishId: 'dc10' },
  { id: 'm16', restaurantId: '2', name: 'Poulet DG Spécial', description: 'Notre spécialité : poulet DG avec plantains parfaitement frits et légumes croquants.', price: 4500, category: 'Plats Principaux', image: '/plat-pouletdg.jpg', isPopular: true, catalogDishId: 'dc2' },
  { id: 'm17', restaurantId: '2', name: 'Poulet DG Family', description: 'Portion familiale de Poulet DG pour 4 personnes avec des accompagnements généreux.', price: 12000, category: 'Plats Principaux', image: '/menu-poulet-dg-family.jpg', isPopular: true, catalogDishId: 'dc2' },
  { id: 'm18', restaurantId: '2', name: 'Alloco + Haricots', description: 'Alloco (bananes plantain frites) avec haricots rouges mijotés et épices.', price: 1500, category: 'Accompagnements', image: '/menu-alloco-haricots.jpg', isPopular: false, catalogDishId: 'dc7' },
  { id: 'm19', restaurantId: '3', name: 'Brochettes de Bœuf Marinées', description: 'Brochettes de bœuf dans une marinade secrète épicée, grillées à la perfection.', price: 2000, category: 'Grillades', image: '/menu-brochettes-boeuf.jpg', isPopular: true, catalogDishId: 'dc3' },
  {
    id: 'm20',
    restaurantId: '3',
    name: 'Poulet Brais\u00e9 Entier',
    description: 'Poulet entier marin\u00e9 et brais\u00e9 au charbon de bois avec une peau croustillante.',
    price: 6000,
    category: 'Grillades',
    image: '/menu-poulet-braise.jpg',
    isPopular: true,
    variants: [
      { name: 'Poulet seul', price: 0 },
      { name: 'Avec frites', price: 1000 },
      { name: 'Avec alloco', price: 800 },
    ],
    supplements: [
      { name: 'Sauce pimentée', price: 300 },
      { name: 'Mayo maison', price: 500 },
    ],
  },
  // Restaurant 4 — Douala Boulangerie
  { id: 'm21', restaurantId: '4', name: 'Croissant au Beurre', description: 'Croissant doré et croustillant, beurre AOP.', price: 800, category: 'Petit-Déjeuner', image: '/menu-croissant.jpg', isPopular: true },
  { id: 'm22', restaurantId: '4', name: 'Pain de Mie Artisanal', description: 'Pain de mie moelleux, tranché sur demande.', price: 1200, category: 'Pâtisseries', image: '/menu-pain-mie.jpg', isPopular: false },
  { id: 'm23', restaurantId: '4', name: 'Café Latte', description: 'Café arabica avec lait chaud.', price: 1000, category: 'Boissons', image: '/menu-cafe-latte.jpg', isPopular: true },
  // Restaurant 5 — Saveurs de la Mer
  { id: 'm24', restaurantId: '5', name: 'Crevettes Grillées', description: 'Crevettes géantes grillées au citron vert.', price: 6500, category: 'Plats Principaux', image: '/menu-crevettes-grillees.jpg', isPopular: true },
  { id: 'm25', restaurantId: '5', name: 'Poisson Bar Braisé', description: 'Poisson bar entier braisé aux épices.', price: 5500, category: 'Grillades', image: '/menu-poisson-braise.jpg', isPopular: true, catalogDishId: 'dc4' },
  { id: 'm26', restaurantId: '5', name: 'Soupe de Poisson Sel Réduit', description: 'Soupe de poisson frais aux légumes, bouillon maison pauvre en sel et sans cube.', price: 3500, category: 'Entrées', image: '/menu-soupe-poisson.jpg', isPopular: false, dietaryTags: ['pauvre-en-sel', 'sans-cube', 'riche-en-proteines', 'allege'] },
  // Restaurant 6 — Le DG
  { id: 'm27', restaurantId: '6', name: 'Burger Classic', description: 'Steak haché, salade, tomate, sauce maison.', price: 2500, category: 'Plats Principaux', image: '/menu-burger-mboa.jpg', isPopular: true },
  { id: 'm28', restaurantId: '6', name: 'Frites de Plantain', description: 'Frites de plantain croustillantes.', price: 1000, category: 'Accompagnements', image: '/menu-burger-mboa.jpg', isPopular: false },
  { id: 'm29', restaurantId: '6', name: 'Milkshake Vanille', description: 'Milkshake crémeux à la vanille.', price: 1500, category: 'Boissons', image: '/menu-burger-mboa.jpg', isPopular: false },
  // Restaurant 7 — Boukarou Grill
  { id: 'm30', restaurantId: '7', name: 'Boukarou de Bœuf', description: 'Viande de bœuf marinée et grillée au feu de bois.', price: 3500, category: 'Grillades', image: '/menu-boukarou-boeuf.jpg', isPopular: true },
  { id: 'm31', restaurantId: '7', name: 'Saucisses Braisées', description: 'Saucisses artisanales braisées aux épices.', price: 2000, category: 'Grillades', image: '/menu-boukarou-boeuf.jpg', isPopular: false },
  // Restaurant 8 — Mama Grace Kitchen
  { id: 'm32', restaurantId: '8', name: 'Eru Traditionnel', description: 'Eru aux feuilles de waterleaf et poisson fumé.', price: 3000, category: 'Plats Principaux', image: '/menu-eru.jpg', isPopular: true, catalogDishId: 'dc6' },
  { id: 'm33', restaurantId: '8', name: 'Koki Banane', description: 'Koki haricots rouges avec banane plantain.', price: 1800, category: 'Plats Principaux', image: '/menu-eru.jpg', isPopular: false, catalogDishId: 'dc13' },
  // Restaurant 9 — Suya Express
  { id: 'm34', restaurantId: '9', name: 'Suya de Bœuf', description: 'Brochettes de bœuf épicées style suya.', price: 1500, category: 'Grillades', image: '/menu-suya-boeuf.jpg', isPopular: true },
  { id: 'm35', restaurantId: '9', name: 'Suya de Poulet', description: 'Morceaux de poulet marinés aux épices suya.', price: 1200, category: 'Grillades', image: '/menu-suya-boeuf.jpg', isPopular: true },
  // Restaurant 10 — La Fourchette Royale
  { id: 'm36', restaurantId: '10', name: 'Homard Thermidor', description: 'Homard gratiné à la sauce crémeuse.', price: 12000, category: 'Plats Principaux', image: '/menu-homard-thermidor.jpg', isPopular: true },
  { id: 'm37', restaurantId: '10', name: 'Risotto aux Crevettes', description: 'Risotto crémeux aux crevettes fraîches.', price: 7500, category: 'Plats Principaux', image: '/menu-homard-thermidor.jpg', isPopular: false },
  // Restaurant 11 — Chez Kadi
  { id: 'm38', restaurantId: '11', name: 'Gâteau Chocolat', description: 'Gâteau au chocolat fondant maison.', price: 2000, category: 'Desserts', image: '/menu-gateau-chocolat.jpg', isPopular: true },
  { id: 'm39', restaurantId: '11', name: 'Thé à la Menthe', description: 'Thé vert à la menthe fraîche.', price: 800, category: 'Boissons', image: '/menu-gateau-chocolat.jpg', isPopular: false },
  // Restaurant 12 — Bantu Cuisine
  { id: 'm40', restaurantId: '12', name: 'Ndolé Végétarien', description: 'Ndolé aux légumes et arachides, sans viande.', price: 2500, category: 'Plats Principaux', image: '/menu-koki.jpg', isPopular: true, catalogDishId: 'dc1' },
  { id: 'm41', restaurantId: '12', name: 'Koki de Haricots', description: 'Gâteau de koki traditionnel bantu.', price: 1500, category: 'Plats Principaux', image: '/menu-koki.jpg', isPopular: false, catalogDishId: 'dc13' },
  // Restaurant 13 — La Bella Pizza
  { id: 'm42', restaurantId: '13', name: 'Pizza Margherita', description: 'Sauce tomate, mozzarella fraiche, basilic.', price: 4000, category: 'Pizza', image: '/menu-pizza-margherita.jpg', isPopular: true, catalogDishId: 'dc12' },
  { id: 'm43', restaurantId: '13', name: 'Pizza Royale', description: 'Sauce tomate, mozzarella, jambon, champignons, olives.', price: 5500, category: 'Pizza', image: '/menu-pizza-margherita.jpg', isPopular: true },
  { id: 'm44', restaurantId: '13', name: 'Pizza 4 Fromages', description: 'Sauce tomate, mozzarella, chèvre, emmental, gorgonzola.', price: 6000, category: 'Pizza', image: '/menu-pizza-margherita.jpg', isPopular: false },
  // Restaurant 14 — Fresh Juice & Co
  { id: 'm45', restaurantId: '14', name: 'Jus de Passion', description: 'Jus de fruit de la passion pressé à froid.', price: 1500, category: 'Boissons', image: '/drink-passion.jpg', isPopular: true },
  { id: 'm46', restaurantId: '14', name: 'Smoothie Mangue-Banane', description: 'Mélange onctueux de mangue et banane.', price: 2000, category: 'Boissons', image: '/drink-passion.jpg', isPopular: true },
  { id: 'm47', restaurantId: '14', name: 'Jus Détox Vert', description: 'Concombre, céleri, citron et gingembre bio, pressés du jour, sans sucre ajouté.', price: 2500, category: 'Boissons', image: '/drink-passion.jpg', isPopular: false, catalogDishId: 'dc15' },
  // Restaurant 15 — Le Matin Doux
  { id: 'm48', restaurantId: '15', name: 'Omelette Complète', description: '3 œufs, fromage, jambon, champignons, servie avec du pain.', price: 2500, category: 'Petit-Déjeuner', image: '/menu-omelette-complete.jpg', isPopular: true },
  { id: 'm49', restaurantId: '15', name: 'Pancakes au Sirop', description: 'Pile de 3 pancakes moelleux servis avec sirop d\'érable.', price: 2000, category: 'Petit-Déjeuner', image: '/menu-omelette-complete.jpg', isPopular: true },
  { id: 'm50', restaurantId: '15', name: 'Café Noir', description: 'Café moulu corsé.', price: 1000, category: 'Boissons', image: '/menu-omelette-complete.jpg', isPopular: false }, { id: 'm51', restaurantId: '17', name: 'Samoussa de Bœuf', description: 'Samoussas croustillants farcis au bœuf épicé et aux herbes.', price: 1200, category: 'Entrées', image: '/menu-shawarma-poulet.jpg', isPopular: true },
  { id: 'm52', restaurantId: '5', name: 'Salade Avocat Crevettes', description: 'Avocat frais, crevettes grillées, citron vert, crudités et assaisonnement pauvre en sel.', price: 2800, category: 'Entrées', image: '/menu-salade-avocat-crevettes.jpg', isPopular: false, catalogDishId: 'dc14' },
  { id: 'm53', restaurantId: '20', name: 'Accras de Poisson', description: 'Beignets de poisson dorés, servis avec une sauce piment doux.', price: 2200, category: 'Entrées', image: '/menu-crevettes-coco.jpg', isPopular: true },
  { id: 'm54', restaurantId: '12', name: 'Mini Beignets Pimentés', description: 'Petits beignets salés servis avec une sauce tomate relevée.', price: 1000, category: 'Entrées', image: '/menu-koki.jpg', isPopular: false },
  { id: 'm55', restaurantId: '8', name: 'Bobolo Vapeur', description: 'Bâton de manioc vapeur, traditionnel, vegan et naturellement sans gluten.', price: 700, category: 'Accompagnements', image: '/menu-eru.jpg', isPopular: false, catalogDishId: 'dc19' },
  { id: 'm56', restaurantId: '16', name: 'Frites de Patate Douce', description: 'Frites de patate douce croustillantes avec sauce maison.', price: 1200, category: 'Accompagnements', image: '/menu-burger-classic.jpg', isPopular: true },
  { id: 'm57', restaurantId: '17', name: 'Alloco Épicé', description: 'Bananes plantain dorées, piment doux et oignons croquants.', price: 1000, category: 'Accompagnements', image: '/menu-shawarma-poulet.jpg', isPopular: true, catalogDishId: 'dc7' },
  { id: 'm58', restaurantId: '20', name: 'Riz Coco Parfumé', description: 'Riz parfumé au lait de coco, citronnelle et herbes fraîches, sans gluten.', price: 1500, category: 'Accompagnements', image: '/menu-crevettes-coco.jpg', isPopular: false, dietaryTags: ['sans-gluten', 'vegan', 'allege'] },
  { id: 'm59', restaurantId: '21', name: 'Flan Coco Maison', description: 'Flan doux au lait de coco avec caramel léger.', price: 1600, category: 'Desserts', image: '/menu-mille-feuille.jpg', isPopular: true },
  { id: 'm60', restaurantId: '4', name: 'Tarte Banane Caramel', description: 'Tarte fondante à la banane et caramel maison.', price: 1800, category: 'Desserts', image: '/menu-tarte-banane-caramel.jpg', isPopular: false },
  { id: 'm61', restaurantId: '11', name: 'Crêpes Chocolat', description: 'Deux crêpes moelleuses nappées de chocolat chaud.', price: 1700, category: 'Desserts', image: '/menu-gateau-chocolat.jpg', isPopular: false },
  { id: 'm62', restaurantId: '24', name: 'Bouillie de Mil + Beignets', description: 'Bouillie chaude de mil accompagnée de beignets frais.', price: 1500, category: 'Petit-Déjeuner', image: '/menu-bouillie-beignets.jpg', isPopular: true },
  { id: 'm63', restaurantId: '25', name: 'Omelette Champignons', description: 'Omelette aux champignons et tomates, pauvre en sel, sans sucre ajouté et servie sans pain sur demande.', price: 2200, category: 'Petit-Déjeuner', image: '/menu-omelette-champignons.jpg', isPopular: true, catalogDishId: 'dc17' },
  { id: 'm64', restaurantId: '23', name: 'Yaourt Granola Bio Tropical', description: 'Yaourt bio maison, granola croustillant, mangue et banane fraîches.', price: 1800, category: 'Petit-Déjeuner', image: '/drink-smoothie-baobab.jpg', isPopular: false, catalogDishId: 'dc18' },
  { id: 'm65', restaurantId: '4', name: 'Pain au Chocolat', description: 'Viennoiserie dorée au chocolat fondant.', price: 900, category: 'Pâtisseries', image: '/menu-pain-chocolat.jpg', isPopular: true },
  { id: 'm66', restaurantId: '21', name: 'Mille-Feuille Vanille', description: 'Feuilletage croustillant et crème vanille légère.', price: 2200, category: 'Pâtisseries', image: '/menu-mille-feuille.jpg', isPopular: true },
  { id: 'm67', restaurantId: '21', name: 'Cupcake Passion', description: 'Cupcake moelleux avec crème fruit de la passion.', price: 1400, category: 'Pâtisseries', image: '/menu-mille-feuille.jpg', isPopular: false },
  { id: 'm68', restaurantId: '25', name: 'Brioche Sucrée', description: 'Brioche tendre légèrement sucrée, cuite du matin.', price: 1000, category: 'Pâtisseries', image: '/menu-omelette-champignons.jpg', isPopular: false },
  { id: 'm69', restaurantId: '11', name: 'Éclair Café', description: 'Éclair garni d’une crème café et glaçage brillant.', price: 1800, category: 'Pâtisseries', image: '/menu-gateau-chocolat.jpg', isPopular: false },
  { id: 'm70', restaurantId: '18', name: 'Pizza Poulet DG', description: 'Pizza fusion au poulet DG, plantains dorés et poivrons.', price: 6500, category: 'Pizza', image: '/menu-pizza-poulet-dg.jpg', isPopular: true },
  { id: 'm71', restaurantId: '19', name: 'Pizza Suya', description: 'Pizza au bœuf suya, oignons rouges et sauce épicée.', price: 6000, category: 'Pizza', image: '/menu-pizza-mont-cameroun.jpg', isPopular: true },
  { id: 'm72', restaurantId: '13', name: 'Pizza Végétarienne', description: 'Pizza aux légumes grillés, mozzarella et basilic frais.', price: 5000, category: 'Pizza', image: '/menu-pizza-margherita.jpg', isPopular: false },
  { id: 'm73', restaurantId: '18', name: 'Pizza Pepperoni', description: 'Pepperoni, mozzarella fondante et sauce tomate maison.', price: 5800, category: 'Pizza', image: '/menu-pizza-poulet-dg.jpg', isPopular: false },
  { id: 'm74', restaurantId: '19', name: 'Pizza Mont Cameroun', description: 'Pizza généreuse au poulet, champignons, olives et fromage.', price: 6200, category: 'Pizza', image: '/menu-pizza-mont-cameroun.jpg', isPopular: false },
  { id: 'm75', restaurantId: '16', name: 'Burger Mboa Signature', description: 'Burger au steak de bœuf, fromage, salade et sauce poivre.', price: 3000, category: 'Plats Principaux', image: '/menu-burger-classic.jpg', isPopular: true },
  { id: 'm76', restaurantId: '17', name: 'Shawarma Poulet', description: 'Pain roulé garni de poulet mariné, crudités et sauce blanche.', price: 2200, category: 'Plats Principaux', image: '/menu-shawarma-poulet.jpg', isPopular: true },
  { id: 'm77', restaurantId: '20', name: 'Crevettes Sauce Coco', description: 'Crevettes sautées dans une sauce coco citronnée.', price: 7000, category: 'Plats Principaux', image: '/menu-crevettes-coco.jpg', isPopular: true },
  { id: 'm78', restaurantId: '22', name: 'Jus Goyave Frais', description: 'Jus de goyave frais pressé du jour et servi très frais.', price: 1600, category: 'Boissons', image: '/drink-goyave.jpg', isPopular: true, dietaryTags: ['presse-du-jour'] },
  { id: 'm79', restaurantId: '22', name: 'Smoothie Ananas Gingembre', description: 'Ananas doux, gingembre frais et touche de citron.', price: 2200, category: 'Boissons', image: '/drink-goyave.jpg', isPopular: false },
  { id: 'm80', restaurantId: '23', name: 'Smoothie Baobab', description: 'Smoothie onctueux au fruit de baobab et lait frais.', price: 2000, category: 'Boissons', image: '/drink-smoothie-baobab.jpg', isPopular: true },
  { id: 'm81', restaurantId: '8', name: 'Ndolé Traditionnel', description: 'Ndolé camerounais aux arachides, viande tendre et poisson fumé.', price: 3200, category: 'Plats Principaux', image: '/menu-eru.jpg', isPopular: true, catalogDishId: 'dc1' },
  { id: 'm82', restaurantId: '12', name: 'Poulet DG Maison', description: 'Poulet DG maison avec plantains dorés, légumes sautés et sauce tomate épicée.', price: 4200, category: 'Plats Principaux', image: '/menu-koki.jpg', isPopular: true, catalogDishId: 'dc2' },
  { id: 'm83', restaurantId: '12', name: 'Eru du Village', description: 'Eru traditionnel aux feuilles de waterleaf, poisson fumé et viande.', price: 3300, category: 'Plats Principaux', image: '/menu-koki.jpg', isPopular: false, catalogDishId: 'dc6' },
  { id: 'm84', restaurantId: '8', name: 'Koki de Haricots', description: 'Koki traditionnel aux haricots rouges, servi avec banane plantain.', price: 1700, category: 'Plats Principaux', image: '/menu-eru.jpg', isPopular: false, catalogDishId: 'dc13' },
  { id: 'm85', restaurantId: '14', name: 'Jus de Gingembre Maison', description: 'Jus de gingembre frais pressé, citron et touche de menthe, sans sucre ajouté.', price: 1200, category: 'Boissons', image: '/drink-passion.jpg', isPopular: true, catalogDishId: 'dc8' },
  { id: 'm86', restaurantId: '22', name: 'Jus de Bissap Glacé', description: 'Bissap camerounais infusé, pressé du jour et servi sans sucre ajouté avec une note de gingembre.', price: 1300, category: 'Boissons', image: '/drink-goyave.jpg', isPopular: true, catalogDishId: 'dc9' },
  { id: 'm87', restaurantId: '14', name: 'Cocktail Passion-Goyave', description: 'Cocktail sans alcool passion, goyave et citron vert, pressé du jour sans sucre ajouté.', price: 1800, category: 'Boissons', image: '/drink-passion.jpg', isPopular: true, catalogDishId: 'dc16' },
  { id: 'm88', restaurantId: '22', name: 'Cocktail Bissap-Ananas', description: 'Cocktail sans alcool au bissap, ananas et gingembre, pressé du jour sans sucre ajouté.', price: 1800, category: 'Boissons', image: '/drink-goyave.jpg', isPopular: true, catalogDishId: 'dc16' },
  { id: 'm89', restaurantId: '20', name: 'Salade Avocat Crevettes Équilibre', description: 'Avocat, crevettes grillées, crudités croquantes et vinaigrette citron pauvre en sel.', price: 3200, category: 'Entrées', image: '/menu-crevettes-coco.jpg', isPopular: false, catalogDishId: 'dc14' },
  { id: 'm90', restaurantId: '15', name: 'Omelette Champignons Sel Réduit', description: 'Omelette aux champignons, tomates fraîches et herbes, préparée pauvre en sel.', price: 2300, category: 'Petit-Déjeuner', image: '/menu-omelette-complete.jpg', isPopular: false, catalogDishId: 'dc17' },
  { id: 'm91', restaurantId: '24', name: 'Yaourt Granola Bio', description: 'Yaourt bio maison avec granola croustillant, banane et mangue fraîches.', price: 1900, category: 'Petit-Déjeuner', image: '/menu-bouillie-beignets.jpg', isPopular: false, catalogDishId: 'dc18' },
  { id: 'm92', restaurantId: '12', name: 'Bobolo Manioc Vapeur', description: 'Bobolo de manioc vapeur, traditionnel, vegan et naturellement sans gluten.', price: 800, category: 'Accompagnements', image: '/menu-koki.jpg', isPopular: false, catalogDishId: 'dc19' },
];

export const dishCatalog: DishCatalogEntry[] = [
  { id: 'dc1', name: 'Ndolé', category: 'Plats Principaux', defaultImage: '/plat-ndole.jpg', tags: ['traditionnel', 'riche-en-proteines'], description: 'Plat traditionnel camerounais à base de feuilles de ndolé, arachides, viande ou poisson.' },
  { id: 'dc2', name: 'Poulet DG', category: 'Plats Principaux', defaultImage: '/plat-pouletdg.jpg', tags: ['traditionnel', 'riche-en-proteines', 'halal'], description: 'Poulet braisé avec plantains frits, poivrons et sauce tomate épicée.' },
  { id: 'dc3', name: 'Brochettes de Bœuf', category: 'Grillades', defaultImage: '/menu-brochettes-boeuf.jpg', tags: ['braise', 'riche-en-proteines', 'halal'], description: 'Brochettes marinées grillées au charbon de bois.' },
  { id: 'dc4', name: 'Poisson Braisé', category: 'Grillades', defaultImage: '/menu-poisson-braise.jpg', tags: ['braise', 'riche-en-proteines', 'allege'], description: 'Poisson frais grillé au feu de bois, servi avec banane plantain.' },
  { id: 'dc5', name: 'Riz Sauce Tomate', category: 'Plats Principaux', defaultImage: '/plat-rizpoisson.jpg', tags: ['allege', 'sans-cube'], description: 'Riz parfumé à la sauce tomate avec protéines au choix.' },
  { id: 'dc6', name: 'Eru', category: 'Plats Principaux', defaultImage: '/menu-eru.jpg', tags: ['traditionnel', 'riche-en-proteines'], description: 'Plat traditionnel à base de feuilles d\'eru, waterleaf, viande et poisson fumé.' },
  { id: 'dc7', name: 'Alloco', category: 'Accompagnements', defaultImage: '/menu-alloco-epice.jpg', tags: ['vegan', 'allege'], description: 'Bananes plantains frites croustillantes.' },
  { id: 'dc8', name: 'Jus Gingembre', category: 'Boissons', defaultImage: '/drink-gingembre.jpg', tags: ['sans-sucre', 'detox', 'presse-du-jour'], description: 'Jus de gingembre frais pressé, naturellement sans sucre ajouté.' },
  { id: 'dc9', name: 'Jus Bissap', category: 'Boissons', defaultImage: '/drink-bissap.jpg', tags: ['sans-alcool', 'presse-du-jour', 'sans-sucre'], description: 'Jus de feuilles d\'oseille (bissap), rafraîchissant et naturel.' },
  { id: 'dc10', name: 'Salade de Fruits Bio', category: 'Desserts', defaultImage: '/menu-salade-fruits.jpg', tags: ['vegetarien', 'allege', 'bio', 'sans-sucre'], description: 'Salade fraîche de fruits bio de saison, servie sans sucre ajouté.' },
  { id: 'dc11', name: 'Beignets Haricot', category: 'Petit-Déjeuner', defaultImage: '/menu-beignets-haricot.jpg', tags: ['fait-maison', 'vegetarien'], description: 'Beignets moelleux accompagnés de haricots mijotés.' },
  { id: 'dc12', name: 'Pizza Margherita', category: 'Pizza', defaultImage: '/menu-pizza-margherita.jpg', tags: ['vegetarien', 'fait-maison'], description: 'Pizza classique tomate, mozzarella, basilic frais.' },
  { id: 'dc13', name: 'Koki', category: 'Plats Principaux', defaultImage: '/menu-koki.jpg', tags: ['traditionnel', 'vegetarien', 'fait-maison', 'sans-gluten'], description: 'Gâteau camerounais de haricots rouges, souvent servi avec banane plantain.' },
  { id: 'dc14', name: 'Salade Avocat Crevettes', category: 'Entrées', defaultImage: '/menu-salade-avocat-crevettes.jpg', tags: ['diabetique', 'pauvre-en-sel', 'allege', 'riche-en-proteines'], description: 'Salade équilibrée aux crevettes grillées, adaptée aux repas pauvres en sucre et en sel.' },
  { id: 'dc15', name: 'Jus Détox Vert', category: 'Boissons', defaultImage: '/drink-detox-vert.jpg', tags: ['diabetique', 'sans-sucre', 'bio', 'detox', 'presse-du-jour'], description: 'Jus vert pressé du jour, sans sucre ajouté, avec concombre, céleri, citron et gingembre.' },
  { id: 'dc16', name: 'Cocktail Tropical', category: 'Boissons', defaultImage: '/drink-passion.jpg', tags: ['cocktail', 'sans-sucre', 'presse-du-jour', 'bio'], description: 'Cocktail de fruits sans alcool, pressé du jour et servi sans sucre ajouté.' },
  { id: 'dc17', name: 'Omelette Champignons', category: 'Petit-Déjeuner', defaultImage: '/menu-omelette-champignons.jpg', tags: ['diabetique', 'pauvre-en-sel', 'riche-en-proteines'], description: 'Omelette pauvre en sel, riche en protéines et adaptée aux repas à faible apport en sucre.' },
  { id: 'dc18', name: 'Yaourt Granola Bio', category: 'Petit-Déjeuner', defaultImage: '/menu-yaourt-granola.jpg', tags: ['bio', 'vegetarien', 'fait-maison'], description: 'Yaourt bio maison avec fruits tropicaux et granola croustillant.' },
  { id: 'dc19', name: 'Bobolo', category: 'Accompagnements', defaultImage: '/menu-bobolo.jpg', tags: ['traditionnel', 'vegan', 'sans-gluten'], description: 'Bâton de manioc vapeur, naturellement vegan et sans gluten.' },
];

export const customerReviews: Review[] = [
  {
    id: 'r1',
    name: 'Marie-Claire N.',
    avatar: '/testimonial-avatar-1.jpg',
    initial: 'M',
    rating: 5,
    comment: 'MiamExpress a chang\u00e9 mes pauses d\u00e9jeuner \u00e0 Douala. La vari\u00e9t\u00e9 des restaurants est incroyable, et la livraison est toujours ponctuelle !',
    date: 'il y a 2 semaines',
    location: 'Douala, Akwa',
    order: 'Ndol\u00e9 avec B\u0153uf et Crevettes',
  },
  {
    id: 'r2',
    name: 'Jean-Pierre K.',
    avatar: '/testimonial-avatar-2.jpg',
    initial: 'J',
    rating: 5,
    comment: 'J\'ai d\u00e9couvert des saveurs camerounaises authentiques que je ne connaissais pas. L\'application est super facile \u00e0 utiliser.',
    date: 'il y a 3 semaines',
    location: 'Yaound\u00e9, Bastos',
    order: 'Poulet DG Traditionnel',
  },
  {
    id: 'r3',
    name: 'Esther M.',
    avatar: '/testimonial-avatar-3.jpg',
    initial: 'E',
    rating: 5,
    comment: 'En tant que m\u00e8re de famille, MiamExpress me simplifie la vie. La qualit\u00e9 des plats est toujours au rendez-vous et les enfants adorent.',
    date: 'il y a 1 mois',
    location: 'Douala, Bonapriso',
    order: 'Riz Sauce Tomate + Poisson',
  },
];

export const partnerReviews: Review[] = [
  {
    id: 'p1',
    name: 'Kouam\u00e9 B.',
    initial: 'K',
    rating: 5,
    comment: 'Gr\u00e2ce \u00e0 MiamExpress, nous avons doubl\u00e9 notre chiffre d\'affaires en 3 mois. Le syst\u00e8me est simple et l\'\u00e9quipe est toujours disponible.',
    date: 'il y a 1 mois',
    role: 'Propri\u00e9taire, Chez Mama',
  },
  {
    id: 'p2',
    name: 'Aminata D.',
    initial: 'A',
    rating: 5,
    comment: 'La visibilit\u00e9 que MiamExpress nous apporte est incroyable. Des clients nous d\u00e9couvrent chaque jour. C\'est devenu notre canal de vente le plus important.',
    date: 'il y a 2 semaines',
    role: 'G\u00e9rante, Poulet DG Royal',
  },
  {
    id: 'p3',
    name: 'Jean-Claude N.',
    initial: 'J',
    rating: 5,
    comment: 'Je n\'avais jamais fait de livraison avant. L\'\u00e9quipe MiamExpress m\'a accompagn\u00e9 \u00e0 chaque \u00e9tape. Aujourd\'hui, 40% de mon CA vient de la livraison.',
    date: 'il y a 3 semaines',
    role: 'Chef, Le B\u00fbcheron',
  },
];

export const driverReviews: Review[] = [
  {
    id: 'd1',
    name: 'Pierre K.',
    initial: 'P',
    rating: 5,
    comment: 'J\'ai commenc\u00e9 \u00e0 livrer le week-end pour compl\u00e9ter mes revenus. En 3 mois, j\'ai pu quitter mon ancien travail. MiamExpress m\'a chang\u00e9 la vie.',
    date: 'il y a 1 mois',
    role: 'Livreur \u00e0 Douala, 6 mois',
  },
  {
    id: 'd2',
    name: 'Marie T.',
    initial: 'M',
    rating: 5,
    comment: 'L\'application est tr\u00e8s simple. Je re\u00e7ois une commande, je suivis l\'itin\u00e9raire GPS, je livre \u2014 et je suis pay\u00e9 le m\u00eame jour sur Mobile Money.',
    date: 'il y a 2 semaines',
    role: 'Livreuse \u00e0 Yaound\u00e9, 3 mois',
  },
  {
    id: 'd3',
    name: 'Serge N.',
    initial: 'S',
    rating: 5,
    comment: 'Les horaires sont vraiment flexibles. Quand j\'ai besoin d\'argent, je me connecte et je livre. C\'est moi qui g\u00e8re mon temps.',
    date: 'il y a 3 semaines',
    role: 'Livreur \u00e0 Douala, 1 an',
  },
];

export const homeFAQ: FAQItem[] = [
  {
    question: 'Quels sont les d\u00e9lais de livraison ?',
    answer: 'Les d\u00e9lais de livraison varient selon votre localisation et le restaurant choisi. En moyenne, comptez entre 25 et 45 minutes. Vous pouvez suivre votre commande en temps r\u00e9el depuis l\'application.',
  },
  {
    question: 'Comment puis-je payer ma commande ?',
    answer: 'Nous acceptons plusieurs modes de paiement : Mobile Money (MTN, Orange), carte bancaire, et paiement \u00e0 la livraison (selon les restaurants). Tous les paiements sont s\u00e9curis\u00e9s.',
  },
  {
    question: 'Puis-je annuler ou modifier ma commande ?',
    answer: 'Vous pouvez annuler votre commande gratuitement tant que le restaurant n\'a pas commenc\u00e9 la pr\u00e9paration. Pour modifier, contactez directement notre support client.',
  },
];

export const contactFAQ: FAQItem[] = [
  {
    question: 'Quels sont les d\u00e9lais de livraison ?',
    answer: 'Les d\u00e9lais de livraison varient selon votre localisation et le restaurant choisi. En moyenne, comptez entre 25 et 45 minutes.',
    category: 'Livraison',
  },
  {
    question: 'Comment puis-je payer ma commande ?',
    answer: 'Nous acceptons plusieurs modes de paiement : Mobile Money (MTN, Orange), carte bancaire, et paiement \u00e0 la livraison.',
    category: 'Paiement',
  },
  {
    question: 'Puis-je annuler ou modifier ma commande ?',
    answer: 'Vous pouvez annuler votre commande gratuitement tant que le restaurant n\'a pas commenc\u00e9 la pr\u00e9paration.',
    category: 'Commandes',
  },
  {
    question: 'Comment devenir partenaire restaurant ?',
    answer: 'Rendez-vous sur notre page Devenir Partenaire et remplissez le formulaire d\'inscription. Notre \u00e9quipe vous contactera sous 24h.',
    category: 'Partenaires',
  },
  {
    question: 'Quelles villes sont couvertes par MiamExpress ?',
    answer: 'MiamExpress couvre les grandes villes du Cameroun, avec une présence dans les principales capitales régionales et zones économiques du pays.',
    category: 'G\u00e9n\u00e9ral',
  },
  {
    question: 'Comment contacter le support ?',
    answer: 'Vous pouvez nous contacter par email \u00e0 support@miamexpress.cm, par t\u00e9l\u00e9phone au 677 77 77 77, ou via le formulaire de contact.',
    category: 'Support',
  },
];

export const partnerFAQ: FAQItem[] = [
  {
    question: 'Quelle est la commission de MiamExpress ?',
    answer: 'MiamExpress pr\u00e9l\u00e8ve une commission de 15% sur chaque commande. Il n\'y a aucun frais d\'inscription ni d\'abonnement mensuel.',
  },
  {
    question: 'Comment sont vers\u00e9s les paiements ?',
    answer: 'Les paiements sont vers\u00e9s directement sur votre compte Mobile Money ou bancaire chaque semaine, avec un relev\u00e9 d\'activit\u00e9 d\u00e9taill\u00e9.',
  },
  {
    question: 'Puis-je g\u00e9rer mon menu en ligne ?',
    answer: 'Oui, vous avez acc\u00e8s \u00e0 un tableau de bord complet o\u00f9 vous pouvez ajouter, modifier ou supprimer des plats en temps r\u00e9el.',
  },
  {
    question: 'Quels documents sont requis pour s\'inscrire ?',
    answer: 'Il vous faut une pi\u00e8ce d\'identit\u00e9, un registre de commerce, et un compte bancaire ou Mobile Money pour recevoir les paiements.',
  },
  {
    question: 'MiamExpress fournit-il des photos professionnelles ?',
    answer: 'Oui, notre \u00e9quipe peut venir prendre des photos professionnelles de vos plats gratuitement apr\u00e8s votre inscription.',
  },
];

export const driverFAQ: FAQItem[] = [
  {
    question: 'Quels sont les horaires de travail ?',
    answer: 'Vous choisissez vos propres horaires. Vous pouvez livrer quand vous voulez, selon vos disponibilit\u00e9s.',
  },
  {
    question: 'Comment suis-je pay\u00e9 ?',
    answer: 'Vous \u00eates pay\u00e9 par livraison compl\u00e9t\u00e9e, plus les pourboires des clients et les primes de performance. Les paiements sont effectu\u00e9s chaque semaine sur votre compte Mobile Money.',
  },
  {
    question: 'De quel \u00e9quipement ai-je besoin ?',
    answer: 'Vous avez besoin d\'un smartphone (Android ou iOS), d\'un moyen de transport (moto, v\u00e9lo, voiture) et d\'une pi\u00e8ce d\'identit\u00e9 valide.',
  },
  {
    question: 'MiamExpress fournit-il le sac thermique ?',
    answer: 'Oui, nous vous fournissons un sac thermique de livraison MiamExpress, un T-shirt officiel et un badge professionnel apr\u00e8s votre inscription.',
  },
  {
    question: 'Puis-je livrer \u00e0 v\u00e9lo ?',
    answer: 'Oui, vous pouvez livrer \u00e0 v\u00e9lo, en moto ou en voiture, selon ce qui vous convient le mieux.',
  },
];


