/** 65 culinary root crops — six functional groups (educational plot catalog). */
export type RootGroupId = 1 | 2 | 3 | 4 | 5 | 6;

export type RootSpeciesDef = {
  id: number;
  name: string;
  scientificName: string;
  group: string;
  groupId: RootGroupId;
  summary: string;
  climate: string;
  growNotes: string;
};

const G1 = "Everyday supermarket basics";
const G2 = "Common international cultivars";
const G3 = "Lesser-known & regional specialties";
const G4 = "Andean lost crops";
const G5 = "Wild & foraged roots";
const G6 = "Rare global varieties";

export const ROOT_SPECIES: RootSpeciesDef[] = [
  { id: 1, name: "Carrot", scientificName: "Daucus carota", group: G1, groupId: 1, summary: "Crisp, sweet, and highly versatile.", climate: "Cool seasons; USDA zones 3–10.", growNotes: "Loose, stone-free soil; steady moisture. Harvest when shoulders reach full color." },
  { id: 2, name: "Potato", scientificName: "Solanum tuberosum", group: G1, groupId: 1, summary: "The world’s staple stem tuber.", climate: "Temperate; zones 3–10.", growNotes: "Hill soil as plants grow. Cure tubers in dark, humid air after digging." },
  { id: 3, name: "Sweet potato", scientificName: "Ipomoea batatas", group: G1, groupId: 1, summary: "Naturally sweet, rich in beta-carotene.", climate: "Warm; zones 8–11 (short-season cultivars farther north).", growNotes: "Needs heat and loose soil. Leaves are edible; cure roots before storage." },
  { id: 4, name: "Beetroot", scientificName: "Beta vulgaris", group: G1, groupId: 1, summary: "Earthy, sweet, and ruby red.", climate: "Cool to mild; zones 2–11.", growNotes: "Direct sow; thin seedlings. Best flavor after light frost in fall." },
  { id: 5, name: "Radish", scientificName: "Raphanus sativus", group: G1, groupId: 1, summary: "Crunchy, quick-growing, mildly peppery.", climate: "Cool; zones 2–11.", growNotes: "One of the fastest roots—ready in weeks. Avoid heat for best texture." },
  { id: 6, name: "Turnip", scientificName: "Brassica rapa", group: G1, groupId: 1, summary: "Mildly bitter white-fleshed taproot.", climate: "Cool; zones 3–10.", growNotes: "Sow late summer for fall harvest. Greens are edible and nutritious." },
  { id: 7, name: "Parsnip", scientificName: "Pastinaca sativa", group: G1, groupId: 1, summary: "Pale, cream-colored carrot relative.", climate: "Cold-hardy; zones 2–9.", growNotes: "Long season; sweetness improves after frost. Needs deep, loose soil." },
  { id: 8, name: "Onion", scientificName: "Allium cepa", group: G1, groupId: 1, summary: "Foundation of global culinary aromatics.", climate: "Wide range; day-length varieties match latitude.", growNotes: "Match long- or short-day types to your region. Cure bulbs dry before storage." },
  { id: 9, name: "Garlic", scientificName: "Allium sativum", group: G1, groupId: 1, summary: "Pungent, multi-cloved seasoning bulb.", climate: "Temperate; zones 4–9.", growNotes: "Plant cloves in fall (most regions). Harvest when lower leaves brown." },
  { id: 10, name: "Ginger", scientificName: "Zingiber officinale", group: G1, groupId: 1, summary: "Pungent rhizome used worldwide.", climate: "Tropical/subtropical; zones 9–11 or greenhouse.", growNotes: "Start rhizome pieces in warm, humid soil. Harvest after 8–10 months." },
  { id: 11, name: "Daikon", scientificName: "Raphanus sativus var. longipinnatus", group: G2, groupId: 2, summary: "Large, mild East Asian white radish.", climate: "Cool; zones 2–11.", growNotes: "Needs depth for long roots. Pickled, fermented, or fresh in salads." },
  { id: 12, name: "Cassava", scientificName: "Manihot esculenta", group: G2, groupId: 2, summary: "Starchy tropical staple (tapioca source).", climate: "Frost-free; zones 9–11.", growNotes: "Cook before eating—removes cyanogenic compounds. 8–12 month crop." },
  { id: 13, name: "True yam", scientificName: "Dioscorea spp.", group: G2, groupId: 2, summary: "Bark-skinned African/Asian tuber staple.", climate: "Tropical; zones 9–11.", growNotes: "Climbing vine; long season. Distinct from sweet potato." },
  { id: 14, name: "Taro", scientificName: "Colocasia esculenta", group: G2, groupId: 2, summary: "Starchy purple-flecked tropical corm.", climate: "Humid warm; zones 8–11.", growNotes: "Needs constant moisture. Cook thoroughly; some cultivars need long cooking." },
  { id: 15, name: "Jicama", scientificName: "Pachyrhizus erosus", group: G2, groupId: 2, summary: "Crunchy, juicy Mexican yam bean.", climate: "Frost-free; zones 9–11.", growNotes: "Eat tuber only—other plant parts are toxic. Sow after soil warms." },
  { id: 16, name: "Turmeric", scientificName: "Curcuma longa", group: G2, groupId: 2, summary: "Vibrant, earthy orange rhizome.", climate: "Tropical; zones 8–11.", growNotes: "Similar culture to ginger. Harvest rhizomes when leaves die back." },
  { id: 17, name: "Shallot", scientificName: "Allium ascalonicum", group: G2, groupId: 2, summary: "Delicate, sweet multi-bulb allium.", climate: "Temperate; zones 4–10.", growNotes: "Plant sets or seeds. Milder than onion; stores well cured." },
  { id: 18, name: "Leek", scientificName: "Allium ampeloprasum", group: G2, groupId: 2, summary: "Mild, sweet blanched stem base.", climate: "Cool; zones 5–10.", growNotes: "Hill or trench to blanch white shanks. Very frost-tolerant." },
  { id: 19, name: "Fennel bulb", scientificName: "Foeniculum vulgare", group: G2, groupId: 2, summary: "Crisp, anise-flavored bulb.", climate: "Mediterranean; zones 6–10.", growNotes: "Choose bulbing varieties. Tie bulbs to blanch; harvest before bolt." },
  { id: 20, name: "Horseradish", scientificName: "Armoracia rusticana", group: G2, groupId: 2, summary: "Intensely pungent perennial root.", climate: "Cold-hardy; zones 3–9.", growNotes: "Persistent—contain with barriers. Grate fresh for peak heat." },
  { id: 21, name: "Celeriac", scientificName: "Apium graveolens", group: G3, groupId: 3, summary: "Knobby root with intense celery flavor.", climate: "Cool; zones 5–9.", growNotes: "Long season from seed. Remove outer skin before cooking." },
  { id: 22, name: "Rutabaga", scientificName: "Brassica napobrassica", group: G3, groupId: 3, summary: "Starchy turnip–cabbage cross (swede).", climate: "Cold; zones 3–9.", growNotes: "Sow mid-summer. Sweetens after frost; stores for months." },
  { id: 23, name: "Lotus root", scientificName: "Nelumbo nucifera", group: G3, groupId: 3, summary: "Hollow-chambered aquatic rhizome.", climate: "Warm ponds; zones 5–11.", growNotes: "Needs standing water or flooded beds. Crunchy when stir-fried." },
  { id: 24, name: "Burdock", scientificName: "Arctium lappa", group: G3, groupId: 3, summary: "Slender bittersweet Japanese gobo root.", climate: "Temperate; zones 3–9.", growNotes: "Deep taproot—loose soil essential. Peel and soak to reduce bitterness." },
  { id: 25, name: "Jerusalem artichoke", scientificName: "Helianthus tuberosus", group: G3, groupId: 3, summary: "Nutty sunflower tuber (sunchoke).", climate: "Hardy; zones 3–9.", growNotes: "Spreads aggressively—give space. Inulin-rich; harvest after frost." },
  { id: 26, name: "Malanga", scientificName: "Xanthosoma sagittifolium", group: G3, groupId: 3, summary: "Crisp tropical corm like taro.", climate: "Frost-free; zones 9–11.", growNotes: "Rich soil and heat. Cook before eating; popular in Caribbean cuisine." },
  { id: 27, name: "Arrowroot", scientificName: "Maranta arundinacea", group: G3, groupId: 3, summary: "Starch crop for gluten-free thickening.", climate: "Tropical; zones 10–11.", growNotes: "Harvest rhizomes at 10–12 months. Process into fine starch flour." },
  { id: 28, name: "Wasabi", scientificName: "Eutrema japonicum", group: G3, groupId: 3, summary: "Pungent green rhizome for sushi.", climate: "Cool, shaded streams; zones 7–10 (challenging).", growNotes: "Needs constant cool water and shade. Grate fresh—heat fades quickly." },
  { id: 29, name: "Galangal", scientificName: "Alpinia galanga", group: G3, groupId: 3, summary: "Citrusy, pine-scented Thai rhizome.", climate: "Tropical; zones 9–11.", growNotes: "Related to ginger; essential in Southeast Asian curry pastes." },
  { id: 30, name: "Water chestnut", scientificName: "Eleocharis dulcis", group: G3, groupId: 3, summary: "Crisp aquatic corm.", climate: "Warm wetlands; zones 9–11.", growNotes: "Grow in containers of mud under shallow water. Stays crunchy when cooked." },
  { id: 31, name: "Chervil root", scientificName: "Chaerophyllum bulbosum", group: G3, groupId: 3, summary: "European root with sweet chestnut notes.", climate: "Cool; zones 4–8.", growNotes: "Heirloom crop; long season. Roasting brings out sweetness." },
  { id: 32, name: "Hamburg parsley", scientificName: "Petroselinum crispum", group: G3, groupId: 3, summary: "Parsley grown for its white taproot.", climate: "Cool; zones 5–9.", growNotes: "Dual-use leaves and root. Deep soil for straight taproots." },
  { id: 33, name: "Salsify", scientificName: "Tragopogon porrifolius", group: G3, groupId: 3, summary: "Pale root with subtle oyster flavor.", climate: "Cool; zones 5–9.", growNotes: "Nicknamed “oyster plant.” Slow-growing; harvest fall through winter." },
  { id: 34, name: "Black salsify", scientificName: "Scorzonera hispanica", group: G3, groupId: 3, summary: "Dark-skinned sweet salsify relative.", climate: "Cool; zones 5–9.", growNotes: "Sticky latex when peeled—use gloves. Excellent roasted." },
  { id: 35, name: "Skirret", scientificName: "Sium sisarum", group: G3, groupId: 3, summary: "Historic clustered sweet European root.", climate: "Temperate; zones 5–8.", growNotes: "Medieval staple; divide clumps to propagate. Taste between parsnip and potato." },
  { id: 36, name: "Oca", scientificName: "Oxalis tuberosa", group: G4, groupId: 4, summary: "Bright tangy Andean tubers.", climate: "Highland cool; zones 6–9.", growNotes: "Short days trigger tuber formation. Sun-dry to reduce oxalic tang." },
  { id: 37, name: "Ulluco", scientificName: "Ullucus tuberosus", group: G4, groupId: 4, summary: "Smooth tuber with beet-like texture.", climate: "Cool Andean; zones 7–9.", growNotes: "Waxy skins in yellow, purple, and green. Boils quickly; don’t overcook." },
  { id: 38, name: "Mashua", scientificName: "Tropaeolum tuberosum", group: G4, groupId: 4, summary: "Peppery tuber related to nasturtiums.", climate: "Cool; zones 7–9.", growNotes: "Edible leaves and tubers. Vigorous climber; deters some pests." },
  { id: 39, name: "Yacón", scientificName: "Smallanthus sonchifolius", group: G4, groupId: 4, summary: "Juicy, fruit-like prebiotic root.", climate: "Frost-free start; zones 7–11.", growNotes: "Tubers sweeten in storage. Eat raw like apple; syrup from juice." },
  { id: 40, name: "Maca", scientificName: "Lepidium meyenii", group: G4, groupId: 4, summary: "High-altitude adaptogenic radish relative.", climate: "Andean highlands; zones 6–8.", growNotes: "Often dried and powdered. Needs cold nights and poor rocky soil." },
  { id: 41, name: "Arracacha", scientificName: "Arracacia xanthorrhiza", group: G4, groupId: 4, summary: "Tastes like carrot, celery, and cabbage.", climate: "Cool tropics; zones 9–11.", growNotes: "Slow crop (~12 months). Creamy texture when boiled or mashed." },
  { id: 42, name: "Mauka", scientificName: "Mirabilis expansa", group: G4, groupId: 4, summary: "Hardy Inca starch root (chago).", climate: "High elevation; zones 6–9.", growNotes: "Extremely cold-tolerant. Sun-cure tubers to sweeten before eating." },
  { id: 43, name: "Ahipa", scientificName: "Pachyrhizus ahipa", group: G4, groupId: 4, summary: "Andean yam bean related to jicama.", climate: "Highland warm days, cool nights; zones 8–10.", growNotes: "No frost. Sweet crisp tubers; shorter season than many Andean crops." },
  { id: 44, name: "Dandelion root", scientificName: "Taraxacum officinale", group: G5, groupId: 5, summary: "Roasted as a bitter coffee alternative.", climate: "Worldwide temperate; zones 3–10.", growNotes: "Forage from clean areas. Dig fall roots; roast for chicory-like beverage." },
  { id: 45, name: "Chicory root", scientificName: "Cichorium intybus", group: G5, groupId: 5, summary: "Industry crop for inulin and coffee blend.", climate: "Temperate; zones 3–9.", growNotes: "First-year taproot largest. Forced witloof uses roots indoors." },
  { id: 46, name: "Cattail rhizome", scientificName: "Typha spp.", group: G5, groupId: 5, summary: "Wild survival starch from wetlands.", climate: "Shallow freshwater worldwide.", growNotes: "Harvest rhizomes in mud; process starch from fibers. Know water quality." },
  { id: 47, name: "Groundnut", scientificName: "Apios americana", group: G5, groupId: 5, summary: "High-protein North American woodland tuber.", climate: "Eastern US; zones 3–8.", growNotes: "Native legume; fixes nitrogen. Slow to establish; rich nutty flavor." },
  { id: 48, name: "Arrowhead", scientificName: "Sagittaria latifolia", group: G5, groupId: 5, summary: "Aquatic tuber (wapato).", climate: "Wetlands; zones 3–10.", growNotes: "Traditional food of many Indigenous peoples. Roast or boil tubers." },
  { id: 49, name: "Prairie turnip", scientificName: "Pediomelum esculentum", group: G5, groupId: 5, summary: "High-protein plains breadroot.", climate: "Great Plains; zones 4–8.", growNotes: "Perennial prairie legume. Slow-growing; culturally significant harvest." },
  { id: 50, name: "Blue camas", scientificName: "Camassia quamash", group: G5, groupId: 5, summary: "Sweet Pacific Northwest bulb staple.", climate: "Western North America; zones 4–8.", growNotes: "Pit-cooked traditionally. Never confuse with toxic death camas." },
  { id: 51, name: "Indian cucumber root", scientificName: "Medeola virginiana", group: G5, groupId: 5, summary: "Small crisp root with cucumber taste.", climate: "Eastern forests; zones 3–8.", growNotes: "Wild slow-growing plant—harvest sustainably if at all." },
  { id: 52, name: "Sego lily bulb", scientificName: "Calochortus nuttallii", group: G5, groupId: 5, summary: "Historic Utah survival starch bulb.", climate: "Intermountain West; zones 4–8.", growNotes: "State flower of Utah. Bulbs small—cook thoroughly; respect protected areas." },
  { id: 53, name: "Trout lily bulb", scientificName: "Erythronium americanum", group: G5, groupId: 5, summary: "Small edible spring woodland bulb.", climate: "Eastern forests; zones 3–7.", growNotes: "Colonies take years to establish. Leaves also edible in moderation." },
  { id: 54, name: "Evening primrose root", scientificName: "Oenothera biennis", group: G5, groupId: 5, summary: "Peppery taproot like turnip–radish.", climate: "Temperate; zones 4–9.", growNotes: "Biennial—harvest first-year roots in fall. Seeds yield evening primrose oil." },
  { id: 55, name: "Spring beauty", scientificName: "Claytonia lanceolata", group: G5, groupId: 5, summary: "Tiny wild tubers (“fairy spuds”).", climate: "Mountain West; zones 3–7.", growNotes: "Underground tubers pea-sized. Delicate flavor; forage ethically." },
  { id: 56, name: "Bistort root", scientificName: "Polygonum bistortoides", group: G5, groupId: 5, summary: "Starchy alpine wild root.", climate: "High meadows; zones 4–8.", growNotes: "Traditional boiled or dried staple. Sour leaves used as flavoring." },
  { id: 57, name: "Chufa", scientificName: "Cyperus esculentus", group: G5, groupId: 5, summary: "Nutty sedge tubers for horchata.", climate: "Warm; zones 8–11.", growNotes: "Also a weed in crops. Soak dried tubers for Spanish horchata de chufa." },
  { id: 58, name: "Konjac", scientificName: "Amorphophallus konjac", group: G6, groupId: 6, summary: "Source of shirataki noodles.", climate: "Subtropical; zones 6–10.", growNotes: "Processed corm yields glucomannan. Strong odor when flowering." },
  { id: 59, name: "Nagaimo", scientificName: "Dioscorea polystachya", group: G6, groupId: 6, summary: "Slender yam eaten raw or grated.", climate: "Temperate Asia; zones 5–9.", growNotes: "Climbing vine; mucilaginous texture. Used in tororo and binding." },
  { id: 60, name: "Fingerroot", scientificName: "Boesenbergia rotunda", group: G6, groupId: 6, summary: "Clustered rhizome in Cambodian cooking.", climate: "Tropical; zones 9–11.", growNotes: "Also called krachai. Essential in fish curry pastes and stir-fries." },
  { id: 61, name: "Black radish", scientificName: "Raphanus sativus niger", group: G6, groupId: 6, summary: "Heirloom pungent European radish.", climate: "Cool; zones 3–9.", growNotes: "Black skin, white flesh. Sharp flavor—grate with honey or vinegar." },
  { id: 62, name: "Ube", scientificName: "Dioscorea alata", group: G6, groupId: 6, summary: "Famous purple Filipino yam.", climate: "Tropical; zones 9–11.", growNotes: "Vivid color in desserts. Long season vine; cure tubers after harvest." },
  { id: 63, name: "Elephant garlic", scientificName: "Allium ampeloprasum", group: G6, groupId: 6, summary: "Giant mild bulb closer to leek.", climate: "Temperate; zones 4–9.", growNotes: "Large cloves; mild flavor. Plant like garlic; fewer cloves per bulb." },
  { id: 64, name: "Ramps", scientificName: "Allium tricoccum", group: G6, groupId: 6, summary: "Wild spring allium with intense flavor.", climate: "Eastern hardwood forests; zones 3–7.", growNotes: "Sustainable harvest: one leaf per plant. Bulbs illegal to harvest in some states." },
  { id: 65, name: "Murnong", scientificName: "Microseris lanceolata", group: G6, groupId: 6, summary: "Sweet Australian yam daisy root.", climate: "Southern Australia; Mediterranean-like zones.", growNotes: "Revived Aboriginal staple. Roasted roots taste coconut-like." },
];

export const PLOT_COUNT = ROOT_SPECIES.length;

export function getRootSpecies(id: number): RootSpeciesDef {
  return ROOT_SPECIES[id - 1] ?? ROOT_SPECIES[0];
}

export const ROOT_GROUP_LABELS: Record<RootGroupId, string> = {
  1: G1,
  2: G2,
  3: G3,
  4: G4,
  5: G5,
  6: G6,
};
