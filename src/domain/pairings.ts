// Hand-studied layering pairings (written by reading each perfume's published
// notes, not generated at runtime). Matched by brand + name, so they work for
// anyone who owns both bottles. `base` goes on first (closer to the skin),
// `top` over it. Score is a subjective vibe, like every score in the Lab.

export interface CuratedPairing {
  base: { brand: string; name: string };
  top: { brand: string; name: string };
  score: number;
  /** Notes the two share or that hand over from one to the other. */
  bridge: string[];
  occasions: string[];
  seasons: string[];
  it: { title: string; spray: string; why: string; feel: string };
  en: { title: string; spray: string; why: string; feel: string };
}

export interface CuratedAvoid {
  a: { brand: string; name: string };
  b: { brand: string; name: string };
  it: string;
  en: string;
}

const p = (brand: string, name: string) => ({ brand, name });

export const CURATED_PAIRINGS: CuratedPairing[] = [
  {
    base: p('Amouage', 'Beloved Man'),
    top: p('Amouage', 'Reflection Man'),
    score: 88,
    bridge: ['orris', 'jasmine', 'vetiver', 'cedarwood', 'patchouli'],
    occasions: ['work', 'formal'],
    seasons: ['autumn', 'winter', 'spring'],
    it: {
      title: 'Iris in giacca',
      spray: '1 spruzzo di Beloved Man sul petto, 2 di Reflection Man su collo e polsi',
      why: 'Stessa casa, stessa grammatica: iris, gelsomino, vetiver e cedro sono in entrambi. Beloved porta zafferano e cuoio, Reflection ci appoggia sopra neroli e rosmarino e lo rende più luminoso.',
      feel: 'Elegante, pulito ma con una scia di cuoio sotto.',
    },
    en: {
      title: 'Iris in a tailored jacket',
      spray: '1 spray of Beloved Man on the chest, 2 of Reflection Man on neck and wrists',
      why: 'Same house, same grammar: orris, jasmine, vetiver and cedar are in both. Beloved brings saffron and leather; Reflection lays neroli and rosemary on top and brightens it.',
      feel: 'Elegant and clean, with a trail of leather underneath.',
    },
  },
  {
    base: p('Electimuss', 'Mercurial Cashmere'),
    top: p('Amouage', 'Reflection Man'),
    score: 87,
    bridge: ['orris', 'iris', 'sandalwood', 'cedarwood'],
    occasions: ['formal', 'date'],
    seasons: ['autumn', 'winter'],
    it: {
      title: 'Cashmere e fiori d’arancio',
      spray: '1 spruzzo di Mercurial Cashmere sul petto, 2 di Reflection Man sul collo',
      why: 'L’iris li collega. Mercurial Cashmere è ambra, vaniglia e caramello: da solo può essere denso. Reflection gli dà aria con neroli, rosmarino e gelsomino, senza spegnerne il calore.',
      feel: 'Morbido e caldo vicino alla pelle, fresco e floreale nella scia.',
    },
    en: {
      title: 'Cashmere and orange blossom',
      spray: '1 spray of Mercurial Cashmere on the chest, 2 of Reflection Man on the neck',
      why: 'Orris links them. Mercurial Cashmere is amber, vanilla and caramel and can feel dense alone; Reflection opens it up with neroli, rosemary and jasmine without cooling it down.',
      feel: 'Soft and warm close to the skin, fresh and floral in the trail.',
    },
  },
  {
    base: p('Parfums de Marly', 'Galloway'),
    top: p('Atyab Al Marshoud', 'All Over Spray Salt'),
    score: 86,
    bridge: ['lemon', 'lime', 'musk'],
    occasions: ['casual', 'work'],
    seasons: ['summer', 'spring'],
    it: {
      title: 'Limone sul mare',
      spray: '2 spruzzi di Galloway su petto e collo, poi Salt su tutto il corpo',
      why: 'Agrumi e muschio in tutti e due. Galloway dà durata con ambrox e muschio; Salt aggiunge lime e la nota salina che manca a Galloway. È l’estate in due passaggi.',
      feel: 'Pelle dopo il bagno, limone e sale. Leggero ma dura.',
    },
    en: {
      title: 'Lemon by the sea',
      spray: '2 sprays of Galloway on chest and neck, then Salt all over the body',
      why: 'Citrus and musk in both. Galloway gives staying power with ambrox and musk; Salt adds lime and the salty note Galloway lacks. Summer in two steps.',
      feel: 'Skin after a swim, lemon and salt. Light but lasting.',
    },
  },
  {
    base: p('Initio', 'Oud for Greatness'),
    top: p('Eight & Bob', 'Egypt'),
    score: 85,
    bridge: ['lavender', 'nutmeg', 'patchouli'],
    occasions: ['nightlife', 'special'],
    seasons: ['autumn', 'winter'],
    it: {
      title: 'Oud da barbiere',
      spray: '1 solo spruzzo di Oud for Greatness sul petto, 2 di Egypt sul collo',
      why: 'Lavanda e noce moscata sono in entrambi. Oud for Greatness è potentissimo (durata e scia 5/5): basta un colpo. Egypt aggiunge limone, muschio e cuoio e lo rende più portabile.',
      feel: 'Oud e zafferano, ma pulito e curato come una barberia di lusso.',
    },
    en: {
      title: 'Barbershop oud',
      spray: 'Just 1 spray of Oud for Greatness on the chest, 2 of Egypt on the neck',
      why: 'Lavender and nutmeg are in both. Oud for Greatness is very powerful (5/5 longevity and sillage): one spray is enough. Egypt adds lemon, moss and leather and makes it easier to wear.',
      feel: 'Oud and saffron, but clean and groomed like a luxury barbershop.',
    },
  },
  {
    base: p('Pantheon Roma', 'Annone'),
    top: p('Alexandre.J', 'Mandarine Sultane'),
    score: 84,
    bridge: ['saffron', 'bergamot', 'amber'],
    occasions: ['date', 'special'],
    seasons: ['autumn', 'winter'],
    it: {
      title: 'Frutta d’oro e zafferano',
      spray: '1 spruzzo di Annone sul petto, 2 di Mandarine Sultane su collo e polsi',
      why: 'Zafferano, bergamotto e ambra li legano. Annone (mango, iris, oud) è enorme: va dosato. Mandarine Sultane ci mette mandarino, fiori d’arancio e rum e porta la frutta in primo piano.',
      feel: 'Dorato, fruttato e speziato. Da serata importante.',
    },
    en: {
      title: 'Golden fruit and saffron',
      spray: '1 spray of Annone on the chest, 2 of Mandarine Sultane on neck and wrists',
      why: 'Saffron, bergamot and amber tie them together. Annone (mango, iris, oud) is huge and needs a light hand; Mandarine Sultane adds mandarin, orange blossom and rum and brings the fruit forward.',
      feel: 'Golden, fruity and spicy. For a big night.',
    },
  },
  {
    base: p('Afnan', '9 PM Elixir'),
    top: p('Parfums de Marly', 'Percival'),
    score: 83,
    bridge: ['lavandin', 'lavender', 'vanilla', 'tonka bean'],
    occasions: ['date', 'casual'],
    seasons: ['autumn', 'spring'],
    it: {
      title: '9 PM anche di giorno',
      spray: '1 spruzzo di 9 PM Elixir sul petto, 2 di Percival sul collo',
      why: 'Lavanda da una parte, lavandino dall’altra; vaniglia e tonka fanno da ponte nel fondo. Percival schiarisce l’elixir con il bergamotto e lo fa uscire dalla sera.',
      feel: 'Speziato e dolce sotto, fresco e lavandoso sopra.',
    },
    en: {
      title: '9 PM, in daylight',
      spray: '1 spray of 9 PM Elixir on the chest, 2 of Percival on the neck',
      why: 'Lavender on one side, lavandin on the other; vanilla and tonka bridge the base. Percival brightens the elixir with bergamot and takes it out of the night.',
      feel: 'Spicy and sweet underneath, fresh and lavender-led on top.',
    },
  },
  {
    base: p('Alexandre.J', 'Mandarine Sultane'),
    top: p('Parfums de Marly', 'Percival'),
    score: 82,
    bridge: ['bergamot', 'citrus'],
    occasions: ['work', 'casual'],
    seasons: ['spring', 'summer'],
    it: {
      title: 'Agrumi in ufficio',
      spray: '1 spruzzo di Mandarine Sultane sul petto, 2 di Percival su collo e polsi',
      why: 'Il bergamotto è in tutti e due. Mandarine Sultane è luminosa ma un po’ dolce (rum, pesca); Percival la asciuga con lavanda e la rende ordinata, da giorno.',
      feel: 'Agrumato, pulito, sorridente.',
    },
    en: {
      title: 'Citrus at the office',
      spray: '1 spray of Mandarine Sultane on the chest, 2 of Percival on neck and wrists',
      why: 'Bergamot is in both. Mandarine Sultane is bright but a little sweet (rum, peach); Percival dries it out with lavender and makes it tidy, a daytime scent.',
      feel: 'Citrusy, clean, smiling.',
    },
  },
  {
    base: p('Eight & Bob', 'Egypt'),
    top: p('Amouage', 'Reflection Man'),
    score: 81,
    bridge: ['lemon', 'sandalwood', 'patchouli'],
    occasions: ['work', 'formal'],
    seasons: ['spring', 'autumn'],
    it: {
      title: 'Camicia bianca',
      spray: '2 spruzzi di Egypt sul petto, 1 di Reflection Man sul collo',
      why: 'Sandalo e patchouli in comune; il limone di Egypt e il neroli di Reflection si parlano. Egypt dà il carattere aromatico e il cuoio, Reflection la finitura floreale.',
      feel: 'Aromatico ed elegante, perfetto per il lavoro.',
    },
    en: {
      title: 'White shirt',
      spray: '2 sprays of Egypt on the chest, 1 of Reflection Man on the neck',
      why: 'Sandalwood and patchouli in common; Egypt’s lemon and Reflection’s neroli talk to each other. Egypt brings the aromatic side and leather, Reflection the floral finish.',
      feel: 'Aromatic and elegant, made for work.',
    },
  },
  {
    base: p('Initio', 'Absolute Aphrodisiac'),
    top: p('Parfums de Marly', 'Percival'),
    score: 80,
    bridge: ['vanilla', 'tonka bean', 'musk'],
    occasions: ['date'],
    seasons: ['autumn', 'winter', 'spring'],
    it: {
      title: 'Vaniglia con aria',
      spray: '1 spruzzo di Absolute Aphrodisiac sul petto, 2 di Percival sul collo',
      why: 'Vaniglia da una parte, tonka dall’altra. Absolute Aphrodisiac è vaniglia animale (castoreo): Percival la rinfresca con bergamotto e lavanda e la rende più facile da portare.',
      feel: 'Sensuale ma pulito. Appuntamento.',
    },
    en: {
      title: 'Vanilla with air',
      spray: '1 spray of Absolute Aphrodisiac on the chest, 2 of Percival on the neck',
      why: 'Vanilla on one side, tonka on the other. Absolute Aphrodisiac is animalic vanilla (castoreum); Percival freshens it with bergamot and lavender and makes it easier to wear.',
      feel: 'Sensual but clean. Date night.',
    },
  },
  {
    base: p('Pantheon Roma', 'Annone'),
    top: p('Amouage', 'Beloved Man'),
    score: 79,
    bridge: ['saffron', 'orris', 'iris'],
    occasions: ['special', 'formal'],
    seasons: ['winter'],
    it: {
      title: 'Zafferano e cuoio',
      spray: '1 spruzzo di Annone sul petto, 1 di Beloved Man sul collo. Non di più',
      why: 'Zafferano e iris in entrambi; il cuoio di Beloved incontra l’oud di Annone. Sono due profumi pieni: dosati poco danno un risultato lussuoso, esagerando diventano pesanti.',
      feel: 'Ricco, scuro, da grande occasione d’inverno.',
    },
    en: {
      title: 'Saffron and leather',
      spray: '1 spray of Annone on the chest, 1 of Beloved Man on the neck. No more',
      why: 'Saffron and orris in both; Beloved’s leather meets Annone’s oud. Both are full scents: a light hand gives a luxurious result, too much turns heavy.',
      feel: 'Rich and dark, for a big winter occasion.',
    },
  },
  {
    base: p('Parfums de Marly', 'Carlisle'),
    top: p('Parfums de Marly', 'Galloway'),
    score: 78,
    bridge: ['musk'],
    occasions: ['casual', 'work'],
    seasons: ['spring', 'autumn'],
    it: {
      title: 'Carlisle di giorno',
      spray: '1 spruzzo di Carlisle sul petto, 2 di Galloway su collo e polsi',
      why: 'Stessa casa. Carlisle (mela, tonka, patchouli) è da sera; il limone e il muschio di Galloway lo alleggeriscono e lo rendono portabile anche di giorno.',
      feel: 'Mela e patchouli con una luce di limone sopra.',
    },
    en: {
      title: 'Carlisle by day',
      spray: '1 spray of Carlisle on the chest, 2 of Galloway on neck and wrists',
      why: 'Same house. Carlisle (apple, tonka, patchouli) is an evening scent; Galloway’s lemon and musk lighten it so it works in daytime too.',
      feel: 'Apple and patchouli with a flash of lemon on top.',
    },
  },
  {
    base: p('Nabeel', 'Irth Boom'),
    top: p('Parfums de Marly', 'Galloway'),
    score: 76,
    bridge: ['fruit', 'citrus', 'musk'],
    occasions: ['casual'],
    seasons: ['spring', 'summer'],
    it: {
      title: 'Frutta con il limone',
      spray: '1 spruzzo di Irth Boom sul petto, 2 di Galloway sul collo',
      why: 'Irth Boom è un’esplosione di frutta, spezie e oud. Il limone e il muschio pulito di Galloway tagliano la dolcezza e lo rendono più fresco, per le giornate calde.',
      feel: 'Frutta matura e succosa, con una spruzzata di limone.',
    },
    en: {
      title: 'Fruit with a squeeze of lemon',
      spray: '1 spray of Irth Boom on the chest, 2 of Galloway on the neck',
      why: 'Irth Boom is a burst of fruit, spice and oud. Galloway’s lemon and clean musk cut the sweetness and freshen it for warm days.',
      feel: 'Ripe, juicy fruit with a squeeze of lemon.',
    },
  },
  {
    base: p('Initio', 'Oud for Happiness'),
    top: p('Atyab Al Marshoud', 'All Over Spray Salt'),
    score: 74,
    bridge: ['bergamot', 'lime', 'ginger'],
    occasions: ['nightlife'],
    seasons: ['summer'],
    it: {
      title: 'Oud d’estate',
      spray: '1 spruzzo di Oud for Happiness sul petto, poi Salt su braccia e collo',
      why: 'Abbinamento insolito: zenzero e bergamotto di Oud for Happiness incontrano lime e sale. L’oud resta sotto, ma il sale lo rende arioso per le sere d’estate.',
      feel: 'Oud luminoso, salato, da serata al mare.',
    },
    en: {
      title: 'Summer oud',
      spray: '1 spray of Oud for Happiness on the chest, then Salt on arms and neck',
      why: 'An unusual pairing: the ginger and bergamot of Oud for Happiness meet lime and salt. The oud stays underneath, but the salt makes it airy for summer nights.',
      feel: 'Bright, salty oud for a night by the sea.',
    },
  },
];

export const CURATED_AVOID: CuratedAvoid[] = [
  {
    a: p('Nabeel', 'Irth'),
    b: p('Nabeel', 'Irth Boom'),
    it: 'Quasi la stessa piramide: insieme si sommano decine di note e il risultato diventa confuso. Meglio uno solo.',
    en: 'Almost the same pyramid: together they stack dozens of notes and turn muddy. Wear one.',
  },
  {
    a: p('Initio', 'Oud for Greatness'),
    b: p('Pantheon Roma', 'Annone'),
    it: 'Due profumi con durata e scia al massimo e lo stesso asse oud-zafferano: si coprono a vicenda e saturano la stanza.',
    en: 'Two scents at maximum longevity and sillage on the same oud-saffron axis: they drown each other and fill the room.',
  },
  {
    a: p('Initio', 'Absolute Aphrodisiac'),
    b: p('Electimuss', 'Mercurial Cashmere'),
    it: 'Vaniglia su vaniglia (più caramello e tonka): diventa stucchevole. Meglio un fresco sopra a uno dei due.',
    en: 'Vanilla on vanilla (plus caramel and tonka): it turns cloying. Put something fresh over one of them instead.',
  },
  {
    a: p('Afnan', '9 PM Elixir'),
    b: p('Nabeel', 'Irth Boom'),
    it: 'Spezie, vaniglia, labdano e frutta dolce da entrambe le parti: un insieme pesante e indistinto.',
    en: 'Spice, vanilla, labdanum and sweet fruit on both sides: heavy and indistinct.',
  },
];
