export interface City {
  id: string;
  name: string;
  /** Service de livraison actif */
  isActive: boolean;
  neighborhoods: string[];
}

export const cities: City[] = [
  {
    id: 'douala',
    name: 'Douala',
    isActive: true,
    neighborhoods: [
      'Akwa',
      'Bali',
      'Bonanjo',
      'Bonapriso',
      'Deido',
      'Logpom',
      'Makepe',
      'New Bell',
      'Pk8',
      'Pk12',
    ],
  },
  {
    id: 'yaounde',
    name: 'Yaoundé',
    isActive: true,
    neighborhoods: [
      'Bastos',
      'Biyem-Assi',
      'Elig-Essono',
      'Essos',
      'Melen',
      'Mokolo',
      'Mvan',
      'Nlongkak',
      'Obili',
      'Odza',
    ],
  },
  {
    id: 'bafoussam',
    name: 'Bafoussam',
    isActive: true,
    neighborhoods: ['Tamdja', 'Banengo', 'Djeleng', 'Kamkop', 'Tougang', 'Centre-ville'],
  },
  {
    id: 'bamenda',
    name: 'Bamenda',
    isActive: true,
    neighborhoods: ['Commercial Avenue', 'Nkwen', 'Mankon', 'Mile 4', 'Up Station', 'Old Town'],
  },
  {
    id: 'garoua',
    name: 'Garoua',
    isActive: true,
    neighborhoods: ['Plateau', 'Poumpoumré', 'Roumdé Adjia', 'Marouaré', 'Laindé', 'Centre-ville'],
  },
  {
    id: 'maroua',
    name: 'Maroua',
    isActive: true,
    neighborhoods: ['Domayo', 'Pitoaré', 'Douggoï', 'Djarengol', 'Founangué', 'Centre-ville'],
  },
  {
    id: 'ngaoundere',
    name: 'Ngaoundéré',
    isActive: true,
    neighborhoods: ['Burkina', 'Joli Soir', 'Mardock', 'Sabongari', 'Université', 'Centre-ville'],
  },
  {
    id: 'bertoua',
    name: 'Bertoua',
    isActive: true,
    neighborhoods: ['Mokolo', 'Nkolbikon', 'Tigaza', 'Enia', 'Centre-ville'],
  },
  {
    id: 'ebolowa',
    name: 'Ebolowa',
    isActive: true,
    neighborhoods: ['Angalé', 'Mekalat', 'Nko’ovos', 'Ngalane', 'Centre-ville'],
  },
  {
    id: 'buea',
    name: 'Buea',
    isActive: true,
    neighborhoods: ['Molyko', 'Great Soppo', 'Bonduma', 'Clerks Quarters', 'Mile 17', 'Check Point'],
  },
  {
    id: 'limbe',
    name: 'Limbe',
    isActive: true,
    neighborhoods: ['Down Beach', 'Mile 4', 'Bota', 'Mokundange', 'New Town', 'Church Street'],
  },
  {
    id: 'kumba',
    name: 'Kumba',
    isActive: true,
    neighborhoods: ['Fiango', 'Buea Road', 'Kosala', 'Mbonge Road', 'Kumba Town', 'Three Corners'],
  },
  {
    id: 'kribi',
    name: 'Kribi',
    isActive: true,
    neighborhoods: ['Dombe', 'Mboamanga', 'Ngoyé', 'Nziou', 'Grand Batanga', 'Centre-ville'],
  },
  {
    id: 'nkongsamba',
    name: 'Nkongsamba',
    isActive: true,
    neighborhoods: ['Bonangoh', 'Ekangté', 'Mbaressoumtou', 'Quartier 1', 'Centre-ville'],
  },
  {
    id: 'edea',
    name: 'Edéa',
    isActive: true,
    neighborhoods: ['Bisseke', 'Delangue', 'Pongo', 'Kellé', 'Centre-ville'],
  },
  {
    id: 'dschang',
    name: 'Dschang',
    isActive: true,
    neighborhoods: ['Foto', 'Foréké', 'Tsinbing', 'Université', 'Centre-ville'],
  },
  {
    id: 'foumban',
    name: 'Foumban',
    isActive: true,
    neighborhoods: ['Njinka', 'Njiyouom', 'Manka', 'Marché Central', 'Centre-ville'],
  },
  {
    id: 'bafang',
    name: 'Bafang',
    isActive: true,
    neighborhoods: ['Bankondji', 'Bassap', 'Bakou', 'Marché Central', 'Centre-ville'],
  },
  {
    id: 'mbouda',
    name: 'Mbouda',
    isActive: true,
    neighborhoods: ['Bamesso', 'Batcham', 'Bamendjinda', 'Marché Central', 'Centre-ville'],
  },
  {
    id: 'foumbot',
    name: 'Foumbot',
    isActive: true,
    neighborhoods: ['Marché Central', 'Manga', 'Njinka', 'Centre-ville'],
  },
  {
    id: 'sangmelima',
    name: 'Sangmélima',
    isActive: true,
    neighborhoods: ['Akon', 'Monavebe', 'Nkolotou', 'Centre-ville'],
  },
  {
    id: 'mbalmayo',
    name: 'Mbalmayo',
    isActive: true,
    neighborhoods: ['Oyack', 'Nkolnguet', 'New Town', 'Centre-ville'],
  },
  {
    id: 'tiko',
    name: 'Tiko',
    isActive: true,
    neighborhoods: ['Mutengene', 'Likomba', 'Long Street', 'Tiko Town', 'Centre-ville'],
  },
  {
    id: 'kousseri',
    name: 'Kousséri',
    isActive: true,
    neighborhoods: ['Madana', 'Lacka', 'Miskine', 'Centre-ville'],
  },
  {
    id: 'yagoua',
    name: 'Yagoua',
    isActive: true,
    neighborhoods: ['Dana', 'Kalfou', 'Marché Central', 'Centre-ville'],
  },
  {
    id: 'meiganga',
    name: 'Meiganga',
    isActive: true,
    neighborhoods: ['Kongolo', 'Sabongari', 'Marché Central', 'Centre-ville'],
  },
  {
    id: 'guider',
    name: 'Guider',
    isActive: true,
    neighborhoods: ['Bibémi', 'Dourbey', 'Marché Central', 'Centre-ville'],
  },
];

export const activeCities = cities.filter((c) => c.isActive);

export function getCityByName(name: string): City | undefined {
  return cities.find((c) => c.name === name);
}

export function getNeighborhoods(cityName: string): string[] {
  return getCityByName(cityName)?.neighborhoods ?? [];
}

/** Extrait la ville depuis une adresse texte (ex. « Bonapriso, Douala »). */
export function parseCityFromAddress(address: string): string {
  for (const city of cities) {
    if (address.includes(city.name)) return city.name;
  }
  return activeCities[0]?.name ?? 'Douala';
}

/** Extrait le quartier depuis une adresse texte. */
export function parseNeighborhoodFromAddress(address: string, cityName?: string): string {
  const city = cityName ?? parseCityFromAddress(address);
  const neighborhoods = getNeighborhoods(city);
  for (const n of neighborhoods) {
    if (address.includes(n)) return n;
  }
  const parts = address.split(',').map((p) => p.trim());
  for (const part of parts) {
    if (part !== city && !part.includes(city)) return part;
  }
  return parts[0] ?? '';
}

export function formatAddress(neighborhood: string, city: string): string {
  return neighborhood ? `${neighborhood}, ${city}` : city;
}

/** Recherche ville ou quartier dans une chaîne libre (barre de recherche accueil). */
export function matchLocationQuery(query: string): { city?: string; neighborhood?: string } {
  const q = query.trim().toLowerCase();
  if (!q) return {};

  for (const city of cities) {
    if (city.name.toLowerCase().includes(q) || q.includes(city.name.toLowerCase())) {
      return { city: city.name };
    }
    for (const n of city.neighborhoods) {
      if (n.toLowerCase().includes(q) || q.includes(n.toLowerCase())) {
        return { city: city.name, neighborhood: n };
      }
    }
  }
  return {};
}
