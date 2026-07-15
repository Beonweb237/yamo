// ============================================================
// MiamExpress — Villes et quartiers du Cameroun
// Données géolocalisées pour autocomplétion d'adresses
// Source : OpenStreetMap / Nominatim
// ============================================================

export interface CameroonCity {
  name: string;
  lat: number;
  lng: number;
  neighborhoods: CameroonNeighborhood[];
}

export interface CameroonNeighborhood {
  name: string;
  lat: number;
  lng: number;
}

export const CAMEROON_CITIES: CameroonCity[] = [
  {
    name: "Douala",
    lat: 4.0511, lng: 9.7679,
    neighborhoods: [
      { name: "Bonapriso", lat: 4.0431, lng: 9.7531 },
      { name: "Bonamoussadi", lat: 4.0690, lng: 9.7380 },
      { name: "Bonanjo", lat: 4.0460, lng: 9.6905 },
      { name: "Akwa", lat: 4.0525, lng: 9.7061 },
      { name: "Bali", lat: 4.0420, lng: 9.7200 },
      { name: "Deïdo", lat: 4.0612, lng: 9.7123 },
      { name: "Makepe", lat: 4.0715, lng: 9.7450 },
      { name: "Ndokotti", lat: 4.0456, lng: 9.7654 },
      { name: "Logbaba", lat: 4.0380, lng: 9.7800 },
      { name: "Bepanda", lat: 4.0250, lng: 9.7200 },
      { name: "Kotto", lat: 4.0580, lng: 9.7280 },
      { name: "Cité des Palmiers", lat: 4.0330, lng: 9.7100 },
      { name: "Ndogbong", lat: 4.0520, lng: 9.7620 },
      { name: "New Bell", lat: 4.0340, lng: 9.7100 },
      { name: "PK 14", lat: 4.1000, lng: 9.7800 },
    ],
  },
  {
    name: "Yaoundé",
    lat: 3.8480, lng: 11.5021,
    neighborhoods: [
      { name: "Bastos", lat: 3.8800, lng: 11.5150 },
      { name: "Mvog-Mbi", lat: 3.8480, lng: 11.5050 },
      { name: "Mvan", lat: 3.8300, lng: 11.4900 },
      { name: "Biyem-Assi", lat: 3.8350, lng: 11.4800 },
      { name: "Mendong", lat: 3.8200, lng: 11.4700 },
      { name: "Nlongkak", lat: 3.8700, lng: 11.5200 },
      { name: "Etoa-Meki", lat: 3.8600, lng: 11.4900 },
      { name: "Ekounou", lat: 3.8400, lng: 11.5300 },
      { name: "Ngousso", lat: 3.9000, lng: 11.5100 },
      { name: "Nkolbisson", lat: 3.8600, lng: 11.4500 },
      { name: "Odza", lat: 3.8100, lng: 11.5200 },
      { name: "Essos", lat: 3.8700, lng: 11.5100 },
      { name: "Mokolo", lat: 3.8600, lng: 11.4900 },
      { name: "Tsuga", lat: 3.8500, lng: 11.4800 },
      { name: "Centre-ville", lat: 3.8650, lng: 11.5200 },
    ],
  },
  {
    name: "Bafoussam",
    lat: 5.4778, lng: 10.4175,
    neighborhoods: [
      { name: "Tyo", lat: 5.4800, lng: 10.4100 },
      { name: "Banengo", lat: 5.4700, lng: 10.4300 },
      { name: "Djeleng", lat: 5.4850, lng: 10.4200 },
      { name: "Tougang", lat: 5.4600, lng: 10.4000 },
      { name: "Koptchoum", lat: 5.4900, lng: 10.4100 },
      { name: "Marché B", lat: 5.4760, lng: 10.4200 },
      { name: "Ndiengdam", lat: 5.4720, lng: 10.4150 },
      { name: "Ngouatche", lat: 5.4800, lng: 10.4250 },
    ],
  },
  {
    name: "Bamenda",
    lat: 5.9630, lng: 10.1591,
    neighborhoods: [
      { name: "Nkwen", lat: 5.9800, lng: 10.1500 },
      { name: "Mankon", lat: 5.9700, lng: 10.1700 },
      { name: "Mile 4", lat: 5.9500, lng: 10.1450 },
      { name: "Mile 3", lat: 5.9550, lng: 10.1550 },
      { name: "Commercial Avenue", lat: 5.9630, lng: 10.1600 },
      { name: "Old Town", lat: 5.9580, lng: 10.1500 },
    ],
  },
  {
    name: "Garoua",
    lat: 9.3019, lng: 13.3934,
    neighborhoods: [
      { name: "Plateau", lat: 9.3100, lng: 13.3900 },
      { name: "Lainde", lat: 9.2950, lng: 13.4000 },
      { name: "Yelwa", lat: 9.2900, lng: 13.3850 },
      { name: "Bockle", lat: 9.3000, lng: 13.4050 },
      { name: "Poumpoumre", lat: 9.3050, lng: 13.3800 },
    ],
  },
  {
    name: "Maroua",
    lat: 10.5953, lng: 14.3247,
    neighborhoods: [
      { name: "Doualaré", lat: 10.5900, lng: 14.3200 },
      { name: "Doursoungo", lat: 10.6000, lng: 14.3300 },
      { name: "Pitoaré", lat: 10.5850, lng: 14.3150 },
      { name: "Kakataré", lat: 10.5950, lng: 14.3100 },
      { name: "Hardéo", lat: 10.6050, lng: 14.3250 },
    ],
  },
  {
    name: "Ngaoundéré",
    lat: 7.3270, lng: 13.5837,
    neighborhoods: [
      { name: "Toungo", lat: 7.3300, lng: 13.5800 },
      { name: "Baladji", lat: 7.3200, lng: 13.5900 },
      { name: "Bamyanga", lat: 7.3250, lng: 13.5750 },
      { name: "Dang", lat: 7.3350, lng: 13.5900 },
    ],
  },
  {
    name: "Kribi",
    lat: 2.9325, lng: 9.9103,
    neighborhoods: [
      { name: "Dombe", lat: 2.9400, lng: 9.9100 },
      { name: "Mokolo", lat: 2.9300, lng: 9.9200 },
      { name: "Mpalla", lat: 2.9250, lng: 9.9000 },
      { name: "Petit Paris", lat: 2.9350, lng: 9.9050 },
      { name: "Ebome", lat: 2.9200, lng: 9.9150 },
    ],
  },
  {
    name: "Limbé",
    lat: 4.0235, lng: 9.2063,
    neighborhoods: [
      { name: "Mile 4", lat: 4.0300, lng: 9.2000 },
      { name: "Mile 2", lat: 4.0200, lng: 9.2100 },
      { name: "Down Beach", lat: 4.0150, lng: 9.2150 },
      { name: "Bota", lat: 4.0180, lng: 9.1950 },
      { name: "Mokunda", lat: 4.0280, lng: 9.2100 },
    ],
  },
  {
    name: "Ebolowa",
    lat: 2.9130, lng: 11.1500,
    neighborhoods: [
      { name: "Nko'ovos", lat: 2.9200, lng: 11.1450 },
      { name: "Mekalat", lat: 2.9100, lng: 11.1550 },
      { name: "Centre-ville", lat: 2.9130, lng: 11.1500 },
      { name: "Abang", lat: 2.9050, lng: 11.1400 },
    ],
  },
  {
    name: "Edéa",
    lat: 3.7980, lng: 10.1220,
    neighborhoods: [
      { name: "Mokanda", lat: 3.8000, lng: 10.1200 },
      { name: "Bilalang", lat: 3.7900, lng: 10.1300 },
      { name: "Pongo", lat: 3.7950, lng: 10.1150 },
    ],
  },
  {
    name: "Bertoua",
    lat: 4.5770, lng: 13.6820,
    neighborhoods: [
      { name: "Mokolo", lat: 4.5800, lng: 13.6800 },
      { name: "Gan chari", lat: 4.5700, lng: 13.6900 },
      { name: "Tigaza", lat: 4.5850, lng: 13.6750 },
    ],
  },
];

/** Recherche rapide dans les quartiers locaux */
export function searchLocal(query: string): { display: string; lat: number; lng: number }[] {
  const q = query.toLowerCase().trim();
  if (q.length < 2) return [];

  const results: { display: string; lat: number; lng: number }[] = [];

  for (const city of CAMEROON_CITIES) {
    // Match ville
    if (city.name.toLowerCase().includes(q)) {
      results.push({ display: `${city.name} (Centre)`, lat: city.lat, lng: city.lng });
    }
    // Match quartiers
    for (const n of city.neighborhoods) {
      if (n.name.toLowerCase().includes(q)) {
        results.push({ display: `${n.name}, ${city.name}`, lat: n.lat, lng: n.lng });
      }
    }
  }

  return results.slice(0, 8);
}

/** Trouve une ville par son nom */
export function findCity(name: string): CameroonCity | undefined {
  return CAMEROON_CITIES.find(c => c.name.toLowerCase() === name.toLowerCase());
}

/** Flat list de tous les quartiers pour recherche */
export const ALL_NEIGHBORHOODS = CAMEROON_CITIES.flatMap(c =>
  c.neighborhoods.map(n => ({ ...n, city: c.name }))
);
