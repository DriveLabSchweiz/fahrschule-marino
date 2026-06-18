// Zentrale Datenquelle für die gesamte Website
// Alle festen Fakten, die 1:1 übernommen werden müssen

export interface Location {
  slug: string;
  name: string;          // Ortschaft
  nameShort: string;     // Kurzform für Nav
  canton: string;        // Kürzel (SZ, SG, GL, ZH)
  address: {
    street: string;
    zip: string;
    city: string;
  };
  geo: {
    lat: number;
    lng: number;
  };
  tier: 1 | 2;           // 1 = Hauptstandort, 2 = erweiterter Standort
  nearby: string[];      // benachbarte Standort-Slugs
}

export interface Service {
  slug: string;
  name: string;
  shortName: string;
  icon: string;          // SVG icon name
  description: string;
  keywords: string[];
  duration?: string;
}

export const company = {
  name: 'Fahrschule Antonio Marino',
  legalName: 'Fahrschule Antonio Marino',
  domain: 'fahrschule-marino.ch',
  url: 'https://fahrschule-marino.ch',
  owner: 'Antonio Marino',
  phone: '078 826 10 61',
  phoneRaw: '+41788261061',
  email: 'Antoniomarino@gmx.ch',
  languages: ['Deutsch', 'Englisch', 'Italienisch', 'Französisch', 'Spanisch'],
  socialMedia: {
    facebook: 'https://www.facebook.com/antonio.marino.98031506/',
    instagram: 'https://www.instagram.com/fahrschuleantoniomarino/',
  },
  partner: 'DriveLab',
  priceRange: '€€',
  established: '2013',
} as const;

// 6 physische Standorte
export const physicalLocations: Location[] = [
  {
    slug: 'lachen',
    name: 'Lachen SZ',
    nameShort: 'Lachen',
    canton: 'SZ',
    address: { street: 'Bahnhofplatz 10', zip: '8853', city: 'Lachen' },
    geo: { lat: 47.1438, lng: 8.8564 },
    tier: 1,
    nearby: ['buttikon', 'ziegelbruecke', 'siebnen', 'wangener'],
  },
  {
    slug: 'buttikon',
    name: 'Buttikon',
    nameShort: 'Buttikon',
    canton: 'SZ',
    address: { street: 'Schufelistr. 4', zip: '8863', city: 'Buttikon' },
    geo: { lat: 47.1667, lng: 8.9000 },
    tier: 1,
    nearby: ['lachen', 'ziegelbruecke', 'benken', 'schmerikon'],
  },
  {
    slug: 'ziegelbruecke',
    name: 'Ziegelbrücke',
    nameShort: 'Ziegelbrücke',
    canton: 'SG',
    address: { street: 'Fabrikstr. 10', zip: '8866', city: 'Ziegelbrücke' },
    geo: { lat: 47.1389, lng: 9.0711 },
    tier: 1,
    nearby: ['buttikon', 'niederurnen', 'weesen', 'benken'],
  },
  {
    slug: 'zuerich',
    name: 'Zürich',
    nameShort: 'Zürich',
    canton: 'ZH',
    address: { street: 'Tessinerplatz 12', zip: '8002', city: 'Zürich' },
    geo: { lat: 47.3723, lng: 8.5272 },
    tier: 1,
    nearby: ['duebendorf', 'uster', 'wetzikon', 'rapperswil-jona'],
  },
  {
    slug: 'uznach',
    name: 'Uznach',
    nameShort: 'Uznach',
    canton: 'SG',
    address: { street: 'Gasterstr. 45', zip: '8730', city: 'Uznach' },
    geo: { lat: 47.2267, lng: 9.0783 },
    tier: 1,
    nearby: ['schmerikon', 'siebnen', 'kaltbrunn', 'rapperswil-jona'],
  },
  {
    slug: 'rapperswil-jona',
    name: 'Rapperswil-Jona',
    nameShort: 'Rapperswil',
    canton: 'SG',
    address: { street: 'St. Gallerstr. 29', zip: '8645', city: 'Rapperswil-Jona' },
    geo: { lat: 47.2271, lng: 8.8160 },
    tier: 1,
    nearby: ['wollerau', 'freienbach', 'altendorf', 'uznach'],
  },
];

// Erweiterte Standorte (Tier 2) — bedient, aber keine physische Adresse
export const extendedLocations: Location[] = [
  {
    slug: 'pfaeffikon-sz',
    name: 'Pfäffikon SZ',
    nameShort: 'Pfäffikon SZ',
    canton: 'SZ',
    address: { street: '', zip: '8808', city: 'Pfäffikon SZ' },
    geo: { lat: 47.2011, lng: 8.7794 },
    tier: 2,
    nearby: ['wollerau', 'freienbach', 'altendorf', 'hurden'],
  },
  {
    slug: 'wollerau',
    name: 'Wollerau',
    nameShort: 'Wollerau',
    canton: 'SZ',
    address: { street: '', zip: '8832', city: 'Wollerau' },
    geo: { lat: 47.1939, lng: 8.7394 },
    tier: 2,
    nearby: ['pfaeffikon-sz', 'freienbach', 'altendorf', 'rapperswil-jona'],
  },
  {
    slug: 'siebnen',
    name: 'Siebnen',
    nameShort: 'Siebnen',
    canton: 'SZ',
    address: { street: '', zip: '8854', city: 'Siebnen' },
    geo: { lat: 47.1739, lng: 8.9014 },
    tier: 2,
    nearby: ['lachen', 'glarus', 'wangener', 'uznach'],
  },
  {
    slug: 'glarus',
    name: 'Glarus',
    nameShort: 'Glarus',
    canton: 'GL',
    address: { street: '', zip: '8750', city: 'Glarus' },
    geo: { lat: 47.0405, lng: 9.0678 },
    tier: 2,
    nearby: ['niederurnen', 'netstal', 'mollis', 'ziegelbruecke'],
  },
  {
    slug: 'altendorf',
    name: 'Altendorf',
    nameShort: 'Altendorf',
    canton: 'SZ',
    address: { street: '', zip: '8835', city: 'Altendorf' },
    geo: { lat: 47.1853, lng: 8.8047 },
    tier: 2,
    nearby: ['wollerau', 'freienbach', 'pfaeffikon-sz', 'rapperswil-jona'],
  },
  {
    slug: 'freienbach',
    name: 'Freienbach',
    nameShort: 'Freienbach',
    canton: 'SZ',
    address: { street: '', zip: '8807', city: 'Freienbach' },
    geo: { lat: 47.1989, lng: 8.7644 },
    tier: 2,
    nearby: ['wollerau', 'pfaeffikon-sz', 'altendorf', 'hurden'],
  },
  {
    slug: 'schmerikon',
    name: 'Schmerikon',
    nameShort: 'Schmerikon',
    canton: 'SG',
    address: { street: '', zip: '8718', city: 'Schmerikon' },
    geo: { lat: 47.2233, lng: 8.9372 },
    tier: 2,
    nearby: ['uznach', 'benken', 'rapperswil-jona', 'siebnen'],
  },
  {
    slug: 'benken',
    name: 'Benken',
    nameShort: 'Benken',
    canton: 'SG',
    address: { street: '', zip: '8724', city: 'Benken' },
    geo: { lat: 47.2106, lng: 8.9686 },
    tier: 2,
    nearby: ['schmerikon', 'ziegelbruecke', 'buttikon', 'uznach'],
  },
  {
    slug: 'kaltbrunn',
    name: 'Kaltbrunn',
    nameShort: 'Kaltbrunn',
    canton: 'SG',
    address: { street: '', zip: '8722', city: 'Kaltbrunn' },
    geo: { lat: 47.2264, lng: 9.0153 },
    tier: 2,
    nearby: ['uznach', 'schmerikon', 'gommiswald', 'rietbach'],
  },
  {
    slug: 'tuggen',
    name: 'Tuggen',
    nameShort: 'Tuggen',
    canton: 'SZ',
    address: { street: '', zip: '8852', city: 'Tuggen' },
    geo: { lat: 47.1806, lng: 8.9175 },
    tier: 2,
    nearby: ['siebnen', 'wangener', 'lachen', 'uttwil'],
  },
  {
    slug: 'wangener',
    name: 'Wangen SZ',
    nameShort: 'Wangen',
    canton: 'SZ',
    address: { street: '', zip: '8855', city: 'Wangen' },
    geo: { lat: 47.1925, lng: 8.8678 },
    tier: 2,
    nearby: ['tuggen', 'lachen', 'siebnen', 'glarus'],
  },
  {
    slug: 'hurden',
    name: 'Hurden',
    nameShort: 'Hurden',
    canton: 'SZ',
    address: { street: '', zip: '8840', city: 'Hurden' },
    geo: { lat: 47.2153, lng: 8.8208 },
    tier: 2,
    nearby: ['freienbach', 'pfaeffikon-sz', 'altendorf', 'rapperswil-jona'],
  },
  {
    slug: 'weesen',
    name: 'Weesen',
    nameShort: 'Weesen',
    canton: 'SG',
    address: { street: '', zip: '8862', city: 'Weesen' },
    geo: { lat: 47.1289, lng: 9.0839 },
    tier: 2,
    nearby: ['ziegelbruecke', 'niederurnen', 'glarus', 'weesen'],
  },
  {
    slug: 'niederurnen',
    name: 'Niederurnen',
    nameShort: 'Niederurnen',
    canton: 'GL',
    address: { street: '', zip: '8868', city: 'Niederurnen' },
    geo: { lat: 47.0922, lng: 9.0561 },
    tier: 2,
    nearby: ['ziegelbruecke', 'netstal', 'glarus', 'weesen'],
  },
  {
    slug: 'netstal',
    name: 'Netstal',
    nameShort: 'Netstal',
    canton: 'GL',
    address: { street: '', zip: '8752', city: 'Netstal' },
    geo: { lat: 47.0736, lng: 9.0725 },
    tier: 2,
    nearby: ['glarus', 'niederurnen', 'mollis', 'enna'],
  },
  {
    slug: 'mollis',
    name: 'Mollis',
    nameShort: 'Mollis',
    canton: 'GL',
    address: { street: '', zip: '8753', city: 'Mollis' },
    geo: { lat: 47.0917, lng: 9.0906 },
    tier: 2,
    nearby: ['netstal', 'glarus', 'niederurnen', 'naefels'],
  },
  {
    slug: 'rueti-zh',
    name: 'Rüti ZH',
    nameShort: 'Rüti',
    canton: 'ZH',
    address: { street: '', zip: '8620', city: 'Rüti' },
    geo: { lat: 47.2567, lng: 8.8206 },
    tier: 2,
    nearby: ['wetzikon', 'wolfhausen', 'bubikon', 'duernten'],
  },
  {
    slug: 'wetzikon',
    name: 'Wetzikon',
    nameShort: 'Wetzikon',
    canton: 'ZH',
    address: { street: '', zip: '8620', city: 'Wetzikon' },
    geo: { lat: 47.3272, lng: 8.7958 },
    tier: 2,
    nearby: ['duebendorf', 'uster', 'rueti-zh', 'hinwil'],
  },
  {
    slug: 'uster',
    name: 'Uster',
    nameShort: 'Uster',
    canton: 'ZH',
    address: { street: '', zip: '8610', city: 'Uster' },
    geo: { lat: 47.3486, lng: 8.7178 },
    tier: 2,
    nearby: ['duebendorf', 'wetzikon', 'greifensee', 'schwerzenbach'],
  },
  {
    slug: 'duebendorf',
    name: 'Dübendorf',
    nameShort: 'Dübendorf',
    canton: 'ZH',
    address: { street: '', zip: '8600', city: 'Dübendorf' },
    geo: { lat: 47.3981, lng: 8.6186 },
    tier: 2,
    nearby: ['zuerich', 'uster', 'schwerzenbach', 'volketswil'],
  },
  {
    slug: 'wald-zh',
    name: 'Wald ZH',
    nameShort: 'Wald',
    canton: 'ZH',
    address: { street: '', zip: '8639', city: 'Wald' },
    geo: { lat: 47.3067, lng: 8.8994 },
    tier: 2,
    nearby: ['rueti-zh', 'wetzikon', 'bauma', 'hintischtwil'],
  },
];

// Alle Standorte kombiniert
export const allLocations: Location[] = [...physicalLocations, ...extendedLocations];

// Dienstleistungen
export const services: Service[] = [
  {
    slug: 'fahrstunden',
    name: 'Fahrstunden',
    shortName: 'Fahrstunden',
    icon: 'car',
    description: 'Individuelle Fahrstunden mit erfahrenem Fahrlehrer – abgeholt an deinem Wunschort.',
    keywords: ['Fahrstunden', 'Autofahrstunden', 'Fahrunterricht', 'Autofahren lernen', 'Führerschein machen'],
    duration: '60–90 Min',
  },
  {
    slug: 'verkehrskundeunterricht',
    name: 'Verkehrskundeunterricht (VKU)',
    shortName: 'VKU',
    icon: 'book',
    description: 'Pflichtkurs für alle Lernfahrenden – 8 Stunden Theorie in kleinen Gruppen.',
    keywords: ['VKU', 'Verkehrskunde', 'Verkehrskundeunterricht', 'VKU Kurs'],
    duration: '8 Stunden',
  },
  {
    slug: 'nothelferkurs',
    name: 'Nothelferkurs',
    shortName: 'Nothelferkurs',
    icon: 'first-aid',
    description: 'Pflichtkurs vor dem Lernfahrausweis – Erste Hilfe am Unfallort.',
    keywords: ['Nothelferkurs', 'Nothilfekurs', 'Erste Hilfe Kurs', 'Nothelferkurs Schweiz'],
    duration: '10 Stunden',
  },
  {
    slug: 'fahrpruefung',
    name: 'Prüfungsvorbereitung',
    shortName: 'Prüfungsvorbereitung',
    icon: 'check',
    description: 'Gezielte Vorbereitung auf die praktische Fahrprüfung – wir kennen die Prüfungsrouten.',
    keywords: ['Fahrprüfung', 'praktische Prüfung', 'Führerscheinprüfung', 'Prüfungsvorbereitung'],
    duration: 'nach Bedarf',
  },
  {
    slug: 'kontrollfahrt',
    name: 'Kontrollfahrt-Vorbereitung',
    shortName: 'Kontrollfahrt',
    icon: 'globe',
    description: 'Vorbereitung auf die Kontrollfahrt für Personen mit ausländischem Führerausweis.',
    keywords: ['Kontrollfahrt', 'ausländischer Führerausweis', 'Umschreibung Führerausweis', 'Kontrollfahrt Schweiz'],
    duration: 'nach Bedarf',
  },
  {
    slug: 'motorradgrundkurs',
    name: 'Motorradgrundkurs',
    shortName: 'Motorradkurs',
    icon: 'motorcycle',
    description: 'Grundkurs für Motorrad-Lernfahrende – Basis-Fahrtechnik auf geschlossenem Gelände.',
    keywords: ['Motorradgrundkurs', 'Motorrad Fahrschule', 'Motorrad Fahrstunden'],
    duration: '12 Stunden',
  },
];

// Hauptnavigation
export const mainNav = [
  { label: 'Fahrschule', href: '/fahrstunden' },
  { label: 'Leistungen', href: '/leistungen', children: [
    { label: 'Fahrstunden', href: '/fahrstunden' },
    { label: 'VKU', href: '/verkehrskundeunterricht' },
    { label: 'Nothelferkurs', href: '/nothelferkurs' },
    { label: 'Prüfungsvorbereitung', href: '/fahrpruefung' },
    { label: 'Kontrollfahrt', href: '/kontrollfahrt' },
    { label: 'Motorradgrundkurs', href: '/motorradgrundkurs' },
  ]},
  { label: 'Standorte', href: '/standorte', children: physicalLocations.map(l => ({ label: l.nameShort, href: `/fahrschule-${l.slug}` })) },
  { label: 'Preise', href: '/preise' },
  { label: 'Über uns', href: '/ueber-uns' },
  { label: 'Blog', href: '/blog' },
  { label: 'Kontakt', href: '/kontakt' },
] as const;

// Footer-Links
export const footerNav = {
  leistungen: [
    { label: 'Fahrstunden', href: '/fahrstunden' },
    { label: 'Verkehrskundeunterricht', href: '/verkehrskundeunterricht' },
    { label: 'Nothelferkurs', href: '/nothelferkurs' },
    { label: 'Prüfungsvorbereitung', href: '/fahrpruefung' },
    { label: 'Kontrollfahrt', href: '/kontrollfahrt' },
    { label: 'Motorradgrundkurs', href: '/motorradgrundkurs' },
  ],
  rechtliches: [
    { label: 'Impressum', href: '/impressum' },
    { label: 'Datenschutz', href: '/datenschutz' },
    { label: 'AGB', href: '/agb' },
  ],
} as const;

// ── PREISE ────────────────────────────────────────────────────────────────
// Echte Preise (verifiziert via DriveLab-Profil). Swiss-Formatierung:
// Tausender mit Apostroph (1'350), Rappen mit Punkt (171.60).
// `price` ist IMMER ein String (z. B. "103", "171.60") OHNE "CHF"-Präfix —
// das Präfix setzt die View. `priceOnRequest:true` ⇒ price weglassen.

export interface PriceItem {
  name: string;
  description: string;
  price?: string;          // numerischer String ohne Währung, z. B. "171.60"
  priceOnRequest: boolean;
  duration?: string;       // z. B. "45 Min", "135 Min (3 Lektionen)"
  unit?: string;           // z. B. "pro Lektion", "einmalig"
  popular?: boolean;       // hebt die empfohlene Variante hervor
}

// EINZELLEKTIONEN — die 4 echten Einzel-/Block-Preise.
// HINWEIS: SEO.astro mappt priceList → OfferCatalog (nutzt name/description).
export const priceList: PriceItem[] = [
  {
    name: 'Fahrlektion 45 Min',
    description: 'Individuelle Fahrstunde mit Antonio Marino, inkl. Abholservice',
    price: '103',
    duration: '45 Min',
    priceOnRequest: false,
  },
  {
    name: 'Fahrlektion 75 Min',
    description: 'Die beliebteste Variante – mehr Zeit, schnellerer Fortschritt',
    price: '171.60',
    duration: '75 Min',
    popular: true,
    priceOnRequest: false,
  },
  {
    name: 'Intensivblock 3 Lektionen',
    description: 'Drei Lektionen am Stück (135 Min) für intensives Training',
    price: '282',
    duration: '135 Min',
    priceOnRequest: false,
  },
  {
    name: 'Intensivblock 4 Lektionen',
    description: 'Vier Lektionen am Stück (180 Min) – maximaler Lernfortschritt',
    price: '369',
    duration: '180 Min',
    priceOnRequest: false,
  },
];

// ABOS & SPARPAKETE — die 5 echten Pakete/Intensivkurse.
export interface Abo {
  name: string;
  lessons: number;
  price: string;           // numerischer String ohne Währung, z. B. "1'350"
  savings: string;         // Ersparnis ohne Währung, z. B. "195"
  popular?: boolean;
}

export const abos: Abo[] = [
  { name: '10er-Abo',        lessons: 10, price: '930',    savings: '100' },
  { name: '15er-Abo',        lessons: 15, price: "1'350",  savings: '195', popular: true },
  { name: 'Intensivkurs S',  lessons: 21, price: "1'860",  savings: '303' },
  { name: 'Intensivkurs M',  lessons: 32, price: "2'880",  savings: '416' },
  { name: 'Intensivkurs L',  lessons: 44, price: "3'960",  savings: '572' },
];

// KURSE OHNE ÖFFENTLICHEN PREIS — niemals erfinden! "Preis auf Anfrage".
// CTA verlinkt auf /kontakt.
export const onRequestList: PriceItem[] = [
  {
    name: 'Verkehrskundeunterricht (VKU)',
    description: 'Pflichtkurs in kleinen Gruppen, inkl. Materialien',
    priceOnRequest: true,
  },
  {
    name: 'Nothelferkurs',
    description: 'Zertifizierter Nothilfekurs vor dem Lernfahrausweis, inkl. Bestätigung',
    priceOnRequest: true,
  },
  {
    name: 'Motorradgrundkurs',
    description: 'Basis-Fahrtechnik auf geschlossenem Gelände',
    priceOnRequest: true,
  },
];

// Einmalige Administrationsgebühr (ab 2. Buchung).
export const adminFee = {
  amount: '130',           // numerischer String ohne Währung
  note: 'Administrationsgebühr einmalig (ab 2. Buchung).',
} as const;

// Bewertungs-Daten (für AggregateRating Schema)
// Quelle: Google-Rating via DriveLab — 4.9/5 aus 63 Bewertungen.
export const reviews = {
  ratingValue: '4.9',
  reviewCount: 63,
  reviews: [
    {
      author: 'Google Nutzer',
      rating: 5,
      text: 'Sehr kompetente und geduldige Fahrschule. Empfehlenswert!',
    },
  ],
};

// Hilfsfunktion: Standort per Slug finden
export function getLocation(slug: string): Location | undefined {
  return allLocations.find(l => l.slug === slug);
}

// Hilfsfunktion: Alle Slugs für statische Generierung
export function getAllLocationSlugs(): string[] {
  return allLocations.map(l => l.slug);
}
