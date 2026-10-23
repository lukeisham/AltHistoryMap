// What the heraldic and flag words on the crest maker and flag designer, and the nine philosophy squares
// of the Key Facts dialog, mean, for the pop-ups in termtip.js. Keys are `<group>:<id>`; the crest maker builds them from the id lists in crestcells.js
// and supporters.js, and the flag designer from its own tool and starter lists, so every option has
// a definition (terms.test.js checks that none is missing).

const TERMS = {
  "part:shield": ["Shield", "The main part of a coat of arms; its shape is a matter of style. Everything else on the arms is drawn on its face."],
  "part:division": ["Field", "The background of the shield. A division splits it into two colours along a line."],
  "part:ordinary": ["Ordinary", "A bold, simple band or shape laid across the shield, such as a cross or a chevron."],
  "part:charge": ["Charge", "Any emblem placed on the shield, such as a star, a crown or an animal."],
  "part:supporterLeft": ["Supporter, left", "Figures, usually animals, that stand beside the shield as if holding it up. This one is on the viewer's left, which heraldry calls the dexter side. Rampant means reared up on the hind legs."],
  "part:supporterRight": ["Supporter, right", "Figures, usually animals, that stand beside the shield as if holding it up. This one is on the viewer's right, which heraldry calls the sinister side. It faces the shield as a mirror image of the left one."],

  "part:supporterLeftFacing": ["Left supporter's facing", "Whether the animal on the viewer's left looks toward the shield or away from it. Supporters usually look toward it."],
  "part:supporterRightFacing": ["Right supporter's facing", "Whether the animal on the viewer's right looks toward the shield or away from it."],
  "part:compartment": ["Compartment", "The ground the supporters stand on, often drawn as a grassy mound or a rock. It sits below the shield and the supporters."],
  "part:ribbon": ["Motto ribbon", "A scroll of ribbon that carries the motto, held across the foot of the arms. Here the ribbon is plain; the motto itself belongs to the country's key facts."],

  "role:field": ["Field colour", "The main background colour of the shield."],
  "role:field2": ["Second field colour", "The colour of the second part when the field is divided."],
  "role:ordinaryColour": ["Ordinary colour", "The colour of the bold band or shape laid over the field."],
  "role:chargeColour": ["Charge colour", "The colour of the emblem at the centre of the shield."],
  "role:outline": ["Outline", "The line round the shield and round each animal. It also colours the animals' eyes."],
  "role:supporterLeftColour": ["Left animal colour", "The body colour of the animal on the left. Heraldry calls a colour a tincture."],
  "role:supporterRightColour": ["Right animal colour", "The body colour of the animal on the right. Heraldry calls a colour a tincture."],
  "part:topper": ["Top decoration", "An emblem above the shield, such as a crown. It marks rank or authority and sits between the supporters' heads."],
  "role:topperColour": ["Top decoration colour", "The colour of the crown or other decoration above the shield."],
  "role:compartmentColour": ["Compartment colour", "The colour of the mound the supporters stand on."],
  "role:ribbonColour": ["Ribbon colour", "The colour of the motto ribbon."],

  "shape:heater": ["Heater", "The classic flat-topped shield narrowing to a point, like the base of a flat iron. Common in medieval arms."],
  "shape:french": ["French", "Straight sides and a rounded base ending in a short point. Also called the French escutcheon."],
  "shape:oval": ["Oval", "An egg-shaped shield, also called a cartouche. Popular in decorated arms of the 1600s and 1700s."],
  "shape:lozenge": ["Lozenge", "A diamond shape. In British and many European customs, unmarried women and widows show their arms on a lozenge."],

  "division:plain": ["Plain", "The field is one colour."],
  "division:pale": ["Per pale", "Split down the middle by a vertical line. A pale is a vertical stripe."],
  "division:fess": ["Per fess", "Split across the middle by a horizontal line. A fess is a horizontal band."],
  "division:bend": ["Per bend", "Split by a diagonal line from the top left to the bottom right, as you look at it."],
  "division:bend-sinister": ["Per bend sinister", "Split by a diagonal line from the top right to the bottom left. Sinister means the left of the person carrying the shield, which is the viewer's right."],
  "division:quarterly": ["Quarterly", "Split into four equal parts by a vertical and a horizontal line, with the colours alternating."],
  "division:saltire": ["Per saltire", "Split by both diagonals, so the top and bottom share one colour and the two sides share the other."],

  "ordinary:none": ["No ordinary", "Nothing is laid over the field."],
  "ordinary:cross": ["Cross", "An upright bar and a crossbar meeting at the centre of the shield."],
  "ordinary:saltire": ["Saltire", "A diagonal cross shaped like an X. St Andrew's cross is a saltire."],
  "ordinary:pale": ["Pale", "A broad vertical stripe down the middle of the shield."],
  "ordinary:fess": ["Fess", "A broad horizontal band across the middle of the shield."],
  "ordinary:bend": ["Bend", "A broad diagonal band from the top left to the bottom right."],
  "ordinary:chevron": ["Chevron", "A band bent into an upward-pointing V, like the gable of a roof."],
  "ordinary:chief": ["Chief", "A broad band across the top of the shield."],
  "ordinary:bordure": ["Bordure", "A border running round the inside edge of the shield."],

  "charge:none": ["No charge", "No emblem at the centre of the shield."],
  "charge:star": ["Star", "A many-pointed star. In heraldry, a star with straight points is a mullet and one with wavy points is an estoile."],
  "charge:crescent": ["Crescent", "A crescent moon with its horns pointing up."],
  "charge:fleur": ["Fleur-de-lis", "A stylised lily with three petals. A long-standing emblem of the kings of France."],
  "charge:castle": ["Castle", "A tower with battlements, standing for strength or a fortified place."],
  "charge:crown": ["Crown", "A ruler's headdress: a band with raised points. It marks royal or sovereign authority."],
  "charge:sword": ["Sword", "A blade with a cross-guard. It stands for justice, war or honour."],
  "charge:tree": ["Tree", "A leafy tree. It stands for life, growth or a place named after one."],
  "charge:heart": ["Heart", "A heart shape, standing for love, loyalty or courage."],
  "charge:anchor": ["Anchor", "A ship's anchor, standing for the sea, hope or steadiness."],
  "charge:roundel": ["Roundel", "A plain filled circle. Its heraldic name follows its colour: a gold one is a bezant, a silver one a plate, a red one a torteau and a black one a pellet."],

  "supporter:none": ["No supporter", "Nothing stands on this side of the shield."],
  "supporter:lion": ["Lion", "Shown rampant, reared up with the forepaws raised. The lion is the commonest animal in heraldry and stands for courage and royalty."],
  "supporter:unicorn": ["Unicorn", "A horse with a single spiral horn, shown rampant. It stands for purity and power, and it is the national animal of Scotland."],
  "supporter:horse": ["Horse", "Shown rampant. It often stands for speed, readiness and service."],
  "supporter:stag": ["Stag", "A male deer with branching antlers, also called a hart. It often stands for a hunter's skill or for peace."],
  "supporter:bear": ["Bear", "A heavy animal reared on its hind legs. It often stands for strength and protectiveness."],
  "supporter:wolf": ["Wolf", "A lean hunter, shown rampant. It often stands for fierceness and loyalty to the pack."],
  "supporter:eagle": ["Eagle", "A bird of prey with a raised wing, drawn from the side. It often stands for authority, sharp sight and empire."],
  "supporter:dragon": ["Dragon", "A winged beast of legend, shown rampant. It often stands for power and watchfulness."],
  "supporter:soldier": ["Soldier", "A human supporter in a plumed helmet, with a shield on one arm and a spear held upright. It stands for a nation's defenders and its readiness to fight."],
  "supporter:griffin": ["Griffin", "A legendary creature with the head and wings of an eagle and the body of a lion. It stands for strength and watchfulness."],

  "facing:inward": ["Inward", "The animal looks toward the shield. This is the usual way to draw supporters."],
  "facing:outward": ["Outward", "The animal looks away from the shield, as if guarding it from outside."],

  "compartment:none": ["No compartment", "The supporters stand on nothing."],
  "compartment:mound": ["Mound", "A low heap of earth along the foot of the arms, with the supporters standing on it."],

  "topper:none": ["No top decoration", "Nothing is drawn above the shield."],
  "topper:crown": ["Crown", "A band with raised points, set above the shield. It stands for sovereignty and the authority of the state."],
  "ribbon:none": ["No ribbon", "No motto ribbon is drawn."],
  "ribbon:ribbon": ["Ribbon", "A band with forked ends across the foot of the shield, held by the supporters."],

  "tool:pencil": ["Pencil", "Paints one cell at a time in the pen colour. Drag to paint a line."],
  "tool:erase": ["Erase", "Paints cells white."],
  "tool:fill": ["Fill", "Floods the connected area of one colour with the pen colour."],
  "tool:crest": ["Crest", "Stamps the chosen coat of arms onto the flag, centred on the cell you click. A coat of arms or badge on a flag is called a charge."],
  "tool:shield-only": ["Shield only", "Stamps just the shield, without its supporters, so a small emblem fits the middle of a flag."],
  "tool:eyedropper": ["Eye dropper", "Picks a colour from anywhere on screen. A colour taken from a country on the map is that country's colour, not a new one."],
  "tool:mirror": ["Mirror", "Copies each cell you paint to the opposite side, left to right, so the design is symmetrical."],

  "starter:plain": ["Plain", "The whole flag in one colour. Flag designers call the background of a flag its field."],
  "starter:stripes-h": ["Stripes (horizontal)", "Three equal horizontal bands, called a triband. A tricolour is a triband in three different colours."],
  "starter:stripes-v": ["Stripes (vertical)", "Three equal vertical bands, as on the flags of France and Italy."],
  "starter:cross": ["Cross", "A Nordic cross: the upright is set toward the hoist, as on the flags of Denmark, Sweden and Norway."],
  "starter:saltire": ["Saltire", "A diagonal cross reaching the corners, as on the flags of Scotland and Jamaica."],

  "flag:hoist": ["Hoist", "The edge of the flag nearest the pole. Here, the left edge."],
  "flag:fly": ["Fly", "The free end of the flag, farthest from the pole. Here, the right edge."],
  "flag:canton": ["Canton", "The top corner nearest the pole, here the top left. Many flags put a small flag or emblem there, as Australia's flag does with the Union Jack."],

  "alignment:lawful-good": ["Lawful good", "A country that keeps strict laws and uses them to protect people: honest, orderly and kind. Typical of a just kingdom or a well-run commonwealth."],
  "alignment:neutral-good": ["Neutral good", "A country that simply tries to do right by its people, with or without strict rules. Typical of a friendly federation or a peaceful free city."],
  "alignment:chaotic-good": ["Chaotic good", "A country that values freedom and kindness above rules. Typical of a loose league of free towns or a land of wandering clans."],
  "alignment:lawful-neutral": ["Lawful neutral", "A country ruled by law, tradition or duty, without caring much whether the results are kind or cruel. Typical of a vast, orderly empire."],
  "alignment:true-neutral": ["True neutral", "A country that takes no side and keeps a balance, trading and bargaining rather than preaching or conquering."],
  "alignment:chaotic-neutral": ["Chaotic neutral", "A country that follows its own whims and prizes independence over order or mercy. Typical of restless clans and shifting alliances."],
  "alignment:lawful-evil": ["Lawful evil", "A country that uses strict law, hierarchy and discipline to serve those in power. Typical of a harsh empire or a ruthless junta."],
  "alignment:neutral-evil": ["Neutral evil", "A country that pursues wealth and power by any means, with no regard for others. Typical of scheming oligarchies."],
  "alignment:chaotic-evil": ["Chaotic evil", "A country that lives by plunder and violence, with no use for law. Typical of a marauding horde or a warlord's realm."],
};

/**
 * @param {string} key `<group>:<id>`, for example `division:pale`
 * @returns {{name: string, text: string} | null} null when the key has no definition
 */
export function termFor(key) {
  const entry = Object.hasOwn(TERMS, key) ? TERMS[key] : null;
  return entry ? { name: entry[0], text: entry[1] } : null;
}
