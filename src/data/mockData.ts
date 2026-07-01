export interface Restaurant {
  id: string;
  name: string;
  image: string;
  category: string;
  rating: number;
  reviewCount: number;
  deliveryTime: string;
  deliveryFee: number;
  minOrder: number;
  priceRange: string;
  address: string;
  phone: string;
  hours: string;
  isOpen: boolean;
  tags: string[];
  isPremium: boolean;
  description: string;
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

export const restaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Chez Mama',
    image: '/resto-ndole.jpg',
    category: 'Camerounaise',
    rating: 4.8,
    reviewCount: 234,
    deliveryTime: '25-35 min',
    deliveryFee: 0,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Bonapriso, Douala',
    phone: '+237 677 77 77 71',
    hours: '08:00 - 22:00',
    isOpen: true,
    tags: ['Camerounaise', 'Traditionnel'],
    isPremium: true,
    description: 'Authentique cuisine camerounaise pr\u00e9par\u00e9e avec amour selon les recettes traditionnelles de la r\u00e9gion du Littoral. Sp\u00e9cialit\u00e9s : Ndol\u00e9, Poulet DG, Eru, et grillades maison.',
  },
  {
    id: '2',
    name: 'Poulet DG Royal',
    image: '/resto-pouletdg.jpg',
    category: 'Camerounaise',
    rating: 4.6,
    reviewCount: 189,
    deliveryTime: '30-40 min',
    deliveryFee: 0,
    minOrder: 2500,
    priceRange: '\u20ac\u20ac',
    address: 'Akwa, Douala',
    phone: '+237 677 77 77 72',
    hours: '10:00 - 23:00',
    isOpen: true,
    tags: ['Camerounaise', 'Poulet DG'],
    isPremium: false,
    description: 'Le meilleur Poulet DG de Douala, pr\u00e9par\u00e9 avec des plantains parfaitement frits et une sauce savoureuse. Une exp\u00e9rience culinaire inoubliable.',
  },
  {
    id: '3',
    name: 'Le B\u00fbcheron',
    image: '/resto-grill.jpg',
    category: 'Grillades',
    rating: 4.7,
    reviewCount: 156,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1500,
    priceRange: '\u20ac',
    address: 'Deido, Douala',
    phone: '+237 677 77 77 73',
    hours: '11:00 - 00:00',
    isOpen: true,
    tags: ['Grillades', 'Brochettes'],
    isPremium: false,
    description: 'Grillades au feu de bois, brochettes de b\u0153uf, poulet brais\u00e9 et poisson grill\u00e9. L\'authenticit\u00e9 du barbecue camerounais.',
  },
  {
    id: '4',
    name: 'Douala Boulangerie',
    image: '/resto-boulangerie.jpg',
    category: 'P\u00e2tisseries',
    rating: 4.9,
    reviewCount: 312,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1000,
    priceRange: '\u20ac\u20ac',
    address: 'Bonanjo, Douala',
    phone: '+237 677 77 77 74',
    hours: '06:00 - 20:00',
    isOpen: true,
    tags: ['P\u00e2tisseries', 'Caf\u00e9'],
    isPremium: true,
    description: 'Boulangerie franco-camerounaise avec des pains artisanaux, des p\u00e2tisseries fra\u00eeches et des viennoiseries dor\u00e9es. Parfait pour le petit-d\u00e9jeuner.',
  },
  {
    id: '5',
    name: 'Saveurs de la Mer',
    image: '/resto-seafood.jpg',
    category: 'Fruits de Mer',
    rating: 4.5,
    reviewCount: 98,
    deliveryTime: '35-45 min',
    deliveryFee: 1000,
    minOrder: 5000,
    priceRange: '\u20ac\u20ac\u20ac',
    address: 'Bonapriso, Douala',
    phone: '+237 677 77 77 75',
    hours: '12:00 - 23:00',
    isOpen: true,
    tags: ['Fruits de Mer', 'Poisson'],
    isPremium: true,
    description: 'Fruits de mer frais p\u00each\u00e9s du jour : crevettes, homard, poisson grill\u00e9. Une exp\u00e9rience gastronomique au c\u0153ur de Douala.',
  },
  {
    id: '6',
    name: 'Le DG',
    image: '/resto-pouletdg.jpg',
    category: 'Fast-Food',
    rating: 4.3,
    reviewCount: 145,
    deliveryTime: '20-25 min',
    deliveryFee: 0,
    minOrder: 1500,
    priceRange: '\u20ac\u20ac',
    address: 'Makepe, Douala',
    phone: '+237 677 77 77 76',
    hours: '10:00 - 22:00',
    isOpen: true,
    tags: ['Fast-Food', 'Burgers'],
    isPremium: false,
    description: 'Burgers gourmet, sandwiches gourmands et frites maison. Fast-food de qualit\u00e9 avec des ingr\u00e9dients frais.',
  },
  {
    id: '7',
    name: 'Boukarou Grill',
    image: '/resto-grill.jpg',
    category: 'Grillades',
    rating: 4.4,
    reviewCount: 87,
    deliveryTime: '25-35 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '\u20ac',
    address: 'Yaound\u00e9, Bastos',
    phone: '+237 677 77 77 77',
    hours: '11:00 - 23:00',
    isOpen: true,
    tags: ['Grillades', 'Traditionnel'],
    isPremium: false,
    description: 'Sp\u00e9cialiste du boukarou camerounais. Viandes marin\u00e9es et grill\u00e9es au feu de bois dans un cadre traditionnel.',
  },
  {
    id: '8',
    name: 'Mama Grace Kitchen',
    image: '/resto-ndole.jpg',
    category: 'Camerounaise',
    rating: 4.7,
    reviewCount: 201,
    deliveryTime: '30-40 min',
    deliveryFee: 0,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Yaound\u00e9, Mokolo',
    phone: '+237 677 77 77 78',
    hours: '08:00 - 21:00',
    isOpen: true,
    tags: ['Camerounaise', 'Familial'],
    isPremium: false,
    description: 'Cuisine camerounaise familiale pr\u00e9par\u00e9e par Mama Grace elle-m\u00eame. Portions g\u00e9n\u00e9reuses et saveurs authentiques.',
  },
  {
    id: '9',
    name: 'Suya Express',
    image: '/resto-grill.jpg',
    category: 'Grillades',
    rating: 4.2,
    reviewCount: 134,
    deliveryTime: '15-25 min',
    deliveryFee: 0,
    minOrder: 1000,
    priceRange: '\u20ac',
    address: 'Douala, Akwa',
    phone: '+237 677 77 77 79',
    hours: '10:00 - 02:00',
    isOpen: true,
    tags: ['Grillades', 'Suya', 'Street Food'],
    isPremium: false,
    description: 'Suya traditionnel \u00e9pici\u00e9, pr\u00e9par\u00e9 \u00e0 la demande sur charbon de bois. Le go\u00fbt authentique du street food nig\u00e9rian et camerounais.',
  },
  {
    id: '10',
    name: 'La Fourchette Royale',
    image: '/resto-seafood.jpg',
    category: 'Fruits de Mer',
    rating: 4.6,
    reviewCount: 76,
    deliveryTime: '40-50 min',
    deliveryFee: 1000,
    minOrder: 5000,
    priceRange: '\u20ac\u20ac\u20ac',
    address: 'Douala, Bonapriso',
    phone: '+237 677 77 77 80',
    hours: '12:00 - 23:00',
    isOpen: true,
    tags: ['Fruits de Mer', 'Gastronomique'],
    isPremium: true,
    description: 'Haute gastronomie fran\u00e7aise et camerounaise. Plats raffin\u00e9s, pr\u00e9sentation soign\u00e9e et ingr\u00e9dients d\'exception.',
  },
  {
    id: '11',
    name: 'Chez Kadi',
    image: '/resto-boulangerie.jpg',
    category: 'P\u00e2tisseries',
    rating: 4.5,
    reviewCount: 112,
    deliveryTime: '20-30 min',
    deliveryFee: 500,
    minOrder: 1500,
    priceRange: '\u20ac\u20ac',
    address: 'Yaound\u00e9, Tokoin',
    phone: '+237 677 77 77 81',
    hours: '07:00 - 19:00',
    isOpen: true,
    tags: ['P\u00e2tisseries', 'Caf\u00e9', 'Th\u00e9'],
    isPremium: false,
    description: 'Salon de th\u00e9 et p\u00e2tisserie. G\u00e2teaux faits maison, cr\u00eapes, glaces artisanales et caf\u00e9s aromatiques.',
  },
  {
    id: '12',
    name: 'Bantu Cuisine',
    image: '/resto-ndole.jpg',
    category: 'Camerounaise',
    rating: 4.4,
    reviewCount: 167,
    deliveryTime: '25-35 min',
    deliveryFee: 500,
    minOrder: 2000,
    priceRange: '\u20ac\u20ac',
    address: 'Douala, Bali',
    phone: '+237 677 77 77 82',
    hours: '09:00 - 22:00',
    isOpen: true,
    tags: ['Camerounaise', 'R\u00e9gionale'],
    isPremium: false,
    description: 'Cuisine bantu authentique du Cameroun. Ndol\u00e9, Koki, Eru, et autres sp\u00e9cialit\u00e9s r\u00e9gionales pr\u00e9par\u00e9es traditionnellement.',
  },
];

export const menuItems: MenuItem[] = [
  {
    id: 'm1',
    restaurantId: '1',
    name: 'Ndol\u00e9 avec B\u0153uf et Crevettes',
    description: 'Feuilles de ndol\u00e9 mijot\u00e9es dans une sauce riche aux arachides, accompagn\u00e9es de b\u0153uf tendre et de crevettes fra\u00ecches.',
    price: 3500,
    category: 'Plats Principaux',
    image: '/plat-ndole.jpg',
    isPopular: true,
  },
  {
    id: 'm2',
    restaurantId: '1',
    name: 'Poulet DG Traditionnel',
    description: 'Poulet brais\u00e9 avec des cubes de plantain dor\u00e9s, des poivrons color\u00e9s et une sauce tomate \u00e9pic\u00e9e.',
    price: 4000,
    category: 'Plats Principaux',
    image: '/plat-pouletdg.jpg',
    isPopular: true,
  },
  {
    id: 'm3',
    restaurantId: '1',
    name: 'Brochettes de B\u0153uf (6 pcs)',
    description: 'Brochettes de b\u0153uf marin\u00e9es grill\u00e9es au charbon de bois, servies avec oignons et tomates.',
    price: 2500,
    category: 'Grillades',
    image: '/plat-brochettes.jpg',
    isPopular: true,
  },
  {
    id: 'm4',
    restaurantId: '1',
    name: 'Riz Sauce Tomate + Poisson',
    description: 'Riz parfum\u00e9 \u00e0 la sauce tomate avec du poisson tilapia grill\u00e9 et des bananes plantain frites.',
    price: 3000,
    category: 'Plats Principaux',
    image: '/plat-rizpoisson.jpg',
    isPopular: true,
  },
  {
    id: 'm5',
    restaurantId: '1',
    name: 'Eru aux Feuilles de Waterleaf',
    description: 'Eru traditionnel aux feuilles de waterleaf avec du poisson fum\u00e9 et de la viande de b\u0153uf.',
    price: 3500,
    category: 'Plats Principaux',
    image: '/plat-ndole.jpg',
    isPopular: false,
  },
  {
    id: 'm6',
    restaurantId: '1',
    name: 'Koki avec Banane Plantain',
    description: 'G\u00e2teau de koki \u00e0 base de haricots rouges, servi avec des bananes plantain bouillies.',
    price: 2000,
    category: 'Plats Principaux',
    image: '/plat-ndole.jpg',
    isPopular: false,
  },
  {
    id: 'm7',
    restaurantId: '1',
    name: 'Poisson Brais\u00e9 Complet',
    description: 'Poisson bar entier brais\u00e9 au charbon, servi avec des l\u00e9gumes grill\u00e9s et de l\'alloco.',
    price: 5000,
    category: 'Grillades',
    image: '/plat-rizpoisson.jpg',
    isPopular: false,
  },
  {
    id: 'm8',
    restaurantId: '1',
    name: 'Poulet Brais\u00e9 + Frites',
    description: 'Poulet entier brais\u00e9 \u00e0 la braise avec des frites de plantain et une salade fra\u00eeche.',
    price: 3500,
    category: 'Grillades',
    image: '/plat-brochettes.jpg',
    isPopular: false,
  },
  {
    id: 'm9',
    restaurantId: '1',
    name: 'Beignets Haricot',
    description: 'Beignets croustillants de haricots servis avec une sauce piment\u00e9e maison.',
    price: 1000,
    category: 'Entr\u00e9es',
    image: '/plat-ndole.jpg',
    isPopular: false,
  },
  {
    id: 'm10',
    restaurantId: '1',
    name: 'Jus de Bissap Frais',
    description: 'Jus de bissap (hibiscus) frais, l\u00e9g\u00e8rement sucr\u00e9 avec un zeste de gingembre.',
    price: 800,
    category: 'Boissons',
    image: '/cat-boissons.jpg',
    isPopular: false,
  },
  {
    id: 'm11',
    restaurantId: '1',
    name: 'Jus de Gingembre Maison',
    description: 'Jus de gingembre \u00e9pic\u00e9 et rafra\u00eechissant, pr\u00e9par\u00e9 maison tous les jours.',
    price: 800,
    category: 'Boissons',
    image: '/cat-boissons.jpg',
    isPopular: true,
  },
  {
    id: 'm12',
    restaurantId: '1',
    name: 'Coca-Cola 33cl',
    description: 'Canette de Coca-Cola fra\u00eeche 33cl.',
    price: 700,
    category: 'Boissons',
    image: '/cat-boissons.jpg',
    isPopular: false,
  },
  {
    id: 'm13',
    restaurantId: '1',
    name: 'Eau Min\u00e9rale 50cl',
    description: 'Bouteille d\'eau min\u00e9rale 50cl.',
    price: 500,
    category: 'Boissons',
    image: '/cat-boissons.jpg',
    isPopular: false,
  },
  {
    id: 'm14',
    restaurantId: '1',
    name: 'Tarte au Chocolat',
    description: 'Tarte au chocolat noir fondant sur un fond de pâte sabl\u00e9e croustillante.',
    price: 1500,
    category: 'Desserts',
    image: '/cat-patisseries.jpg',
    isPopular: false,
  },
  {
    id: 'm15',
    restaurantId: '1',
    name: 'Salade de Fruits',
    description: 'Assortiment de fruits frais de saison avec un sirop l\u00e9ger.',
    price: 1200,
    category: 'Desserts',
    image: '/cat-patisseries.jpg',
    isPopular: false,
  },
  {
    id: 'm16',
    restaurantId: '2',
    name: 'Poulet DG Sp\u00e9cial',
    description: 'Notre sp\u00e9cialit\u00e9 : poulet DG avec plantains parfaitement frits et l\u00e9gumes croquants.',
    price: 4500,
    category: 'Plats Principaux',
    image: '/plat-pouletdg.jpg',
    isPopular: true,
  },
  {
    id: 'm17',
    restaurantId: '2',
    name: 'Poulet DG Family',
    description: 'Portion familiale de Poulet DG pour 4 personnes avec des accompagnements g\u00e9n\u00e9reux.',
    price: 12000,
    category: 'Plats Principaux',
    image: '/plat-pouletdg.jpg',
    isPopular: true,
  },
  {
    id: 'm18',
    restaurantId: '2',
    name: 'Alloco + Haricots',
    description: 'Alloco (bananes plantain frites) avec haricots rouges mijot\u00e9s et \u00e9pices.',
    price: 1500,
    category: 'Accompagnements',
    image: '/plat-rizpoisson.jpg',
    isPopular: false,
  },
  {
    id: 'm19',
    restaurantId: '3',
    name: 'Brochettes de B\u0153uf Marin\u00e9es',
    description: 'Brochettes de b\u0153uf dans une marinade secr\u00e8te \u00e9pic\u00e9e, grill\u00e9es \u00e0 la perfection.',
    price: 2000,
    category: 'Grillades',
    image: '/plat-brochettes.jpg',
    isPopular: true,
  },
  {
    id: 'm20',
    restaurantId: '3',
    name: 'Poulet Brais\u00e9 Entier',
    description: 'Poulet entier marin\u00e9 et brais\u00e9 au charbon de bois avec une peau croustillante.',
    price: 6000,
    category: 'Grillades',
    image: '/plat-brochettes.jpg',
    isPopular: true,
  },
];

export const customerReviews: Review[] = [
  {
    id: 'r1',
    name: 'Marie-Claire N.',
    avatar: '/testimonial-avatar-1.jpg',
    initial: 'M',
    rating: 5,
    comment: 'Yamo a chang\u00e9 mes pauses d\u00e9jeuner \u00e0 Douala. La vari\u00e9t\u00e9 des restaurants est incroyable, et la livraison est toujours ponctuelle !',
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
    comment: 'En tant que m\u00e8re de famille, Yamo me simplifie la vie. La qualit\u00e9 des plats est toujours au rendez-vous et les enfants adorent.',
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
    comment: 'Gr\u00e2ce \u00e0 Yamo, nous avons doubl\u00e9 notre chiffre d\'affaires en 3 mois. Le syst\u00e8me est simple et l\'\u00e9quipe est toujours disponible.',
    date: 'il y a 1 mois',
    role: 'Propri\u00e9taire, Chez Mama',
  },
  {
    id: 'p2',
    name: 'Aminata D.',
    initial: 'A',
    rating: 5,
    comment: 'La visibilit\u00e9 que Yamo nous apporte est incroyable. Des clients nous d\u00e9couvrent chaque jour. C\'est devenu notre canal de vente le plus important.',
    date: 'il y a 2 semaines',
    role: 'G\u00e9rante, Poulet DG Royal',
  },
  {
    id: 'p3',
    name: 'Jean-Claude N.',
    initial: 'J',
    rating: 5,
    comment: 'Je n\'avais jamais fait de livraison avant. L\'\u00e9quipe Yamo m\'a accompagn\u00e9 \u00e0 chaque \u00e9tape. Aujourd\'hui, 40% de mon CA vient de la livraison.',
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
    comment: 'J\'ai commenc\u00e9 \u00e0 livrer le week-end pour compl\u00e9ter mes revenus. En 3 mois, j\'ai pu quitter mon ancien travail. Yamo m\'a chang\u00e9 la vie.',
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
    question: 'Quelles villes sont couvertes par Yamo ?',
    answer: 'Yamo est actuellement disponible \u00e0 Douala et Yaound\u00e9. Nous pr\u00e9voyons d\'\u00e9tendre notre service \u00e0 d\'autres villes camerounaises tr\u00e8s prochainement.',
    category: 'G\u00e9n\u00e9ral',
  },
  {
    question: 'Comment contacter le support ?',
    answer: 'Vous pouvez nous contacter par email \u00e0 support@yamo.cm, par t\u00e9l\u00e9phone au +237 677 77 77 77, ou via le formulaire de contact.',
    category: 'Support',
  },
];

export const partnerFAQ: FAQItem[] = [
  {
    question: 'Quelle est la commission de Yamo ?',
    answer: 'Yamo pr\u00e9l\u00e8ve une commission de 15% sur chaque commande. Il n\'y a aucun frais d\'inscription ni d\'abonnement mensuel.',
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
    question: 'Yamo fournit-il des photos professionnelles ?',
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
    question: 'Yamo fournit-il le sac thermique ?',
    answer: 'Oui, nous vous fournissons un sac thermique de livraison Yamo, un T-shirt officiel et un badge professionnel apr\u00e8s votre inscription.',
  },
  {
    question: 'Puis-je livrer \u00e0 v\u00e9lo ?',
    answer: 'Oui, vous pouvez livrer \u00e0 v\u00e9lo, en moto ou en voiture, selon ce qui vous convient le mieux.',
  },
];
