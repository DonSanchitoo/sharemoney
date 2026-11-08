/** Devine une catégorie à partir du titre saisi (seulement si l'utilisateur n'a rien choisi). */
const SOURCES: [string, string][] = [
  [String.raw`avion|vol|ryanair|easyjet|air ?france|transavia|vueling|lufthansa|klm|billet d.avion`, 'flight'],
  [String.raw`train|sncf|tgv|ouigo|tram|m[ée]tro|bus|uber|taxi|bolt|vtc|navigo|ferry|bateau|blablacar`, 'transport'],
  [String.raw`airbnb|h[ôo]tel|booking|g[iî]te|camping|auberge|logement|location appart|nuit[ée]e?s?`, 'lodging'],
  [String.raw`resto|restaurant|d[ée]j(eu)?ner|d[îi]ner|brunch|pizza|burger|kebab|sushi|caf[ée]|cr[êe]pe|mcdo|tapas`, 'restaurant'],
  [String.raw`courses|supermarch[ée]|carrefour|leclerc|lidl|auchan|intermarch[ée]|monoprix|franprix|casino|aldi|picard|march[ée]|boulangerie|pain`, 'groceries'],
  [String.raw`bi[èe]res?|vins?|ap[ée]ro|bar|cocktails?|alcool|champagne|boissons?|soft`, 'drinks'],
  [String.raw`essence|carburant|plein|gasoil|diesel|sans.plomb|recharge`, 'fuel'],
  [String.raw`p[ée]age|parking|autoroute|stationnement`, 'toll'],
  [String.raw`location (de )?voiture|loueur|hertz|europcar|sixt|avis|getaround`, 'carRental'],
  [String.raw`mus[ée]e|visite|entr[ée]es?|concert|cin[ée]ma|activit[ée]|excursion|parc|ski|forfait|plong[ée]e|surf|kayak|escape`, 'activities'],
  [String.raw`uber ?eats|deliveroo|livraison|just ?eat`, 'delivery'],
  [String.raw`cadeau|gift|bouquet|fleurs`, 'gift'],
  [String.raw`d[ée]co|ballons?|guirlandes?`, 'decoration'],
  [String.raw`edf|engie|[ée]lectricit[ée]|gaz|chauffage`, 'energy'],
  [String.raw`internet|box|free|orange|sfr|bouygues|netflix|spotify|abonnement|disney`, 'internet'],
  [String.raw`m[ée]nage|produits?|lessive|ikea|bricolage|leroy`, 'household'],
  [String.raw`garage|r[ée]paration|entretien|vidange|pneus?|contr[ôo]le technique`, 'maintenance'],
  [String.raw`assurance`, 'insurance'],
  [String.raw`pharmacie|m[ée]decin|docteur|m[ée]dicaments?`, 'health'],
  [String.raw`terrain|salle|five|court`, 'venue'],
  [String.raw`traiteur`, 'catering'],
  [String.raw`licence|inscription|cotisation`, 'fees'],
  [String.raw`mat[ée]riel|ballon|raquette|[ée]quipement`, 'equipment'],
];

// Bornes de mots compatibles avec les lettres accentuées (pas de lookbehind : Safari < 16.4).
const RULES: [RegExp, string][] = SOURCES.map(([src, cat]) => [new RegExp('(?:^|[^\\p{L}])(?:' + src + ')(?=$|[^\\p{L}])', 'iu'), cat]);

export function guessCategory(title: string, allowed: string[]): string | undefined {
  for (const [re, cat] of RULES) if (re.test(title) && allowed.includes(cat)) return cat;
  return undefined;
}
