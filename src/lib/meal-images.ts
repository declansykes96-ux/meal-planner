/**
 * Stable food photograph references for the seed catalogue.
 * Prefer real dish-like photos over random generics; placeholders only when needed.
 *
 * Image URLs are persistent Unsplash CDN links (fixed photo ids) — not searched at render time.
 */

export type MealImageRef = {
  imageUrl: string;
  imageSource: "unsplash" | "local";
  imageAttribution: string;
};

const U = (id: string, sig: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=80&${sig}`;

/** Category → stable photo. Assigned once at seed/import time. */
export const MEAL_IMAGE_LIBRARY: Record<string, MealImageRef> = {
  eggs: {
    imageUrl: U("photo-1482049016688-2d3e1b311543", "s=eggs"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  toast: {
    imageUrl: U("photo-1525351484163-7529414344d8", "s=toast"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  oats: {
    imageUrl: U("photo-1517673400267-0251440c45dc", "s=oats"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  pancakes: {
    imageUrl: U("photo-1567620905732-2d1ec7ab7445", "s=pancakes"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  yoghurt: {
    imageUrl: U("photo-1488477181946-6428a0291777", "s=yoghurt"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  avocado: {
    imageUrl: U("photo-1541519227354-08bf04352c41", "s=avocado"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  wrap: {
    imageUrl: U("photo-1626700051175-6818013e1d4f", "s=wrap"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  sandwich: {
    imageUrl: U("photo-1528735602780-2552fd46c7af", "s=sandwich"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  salad: {
    imageUrl: U("photo-1512621776951-a57141f2eefd", "s=salad"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  soup: {
    imageUrl: U("photo-1547592166-23ac45744acd", "s=soup"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  pasta: {
    imageUrl: U("photo-1621996346565-e3dbc646d9a9", "s=pasta"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  curry: {
    imageUrl: U("photo-1585937421612-70a008356fbe", "s=curry"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  stirfry: {
    imageUrl: U("photo-1603133872878-684f208fb84b", "s=stirfry"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  chicken: {
    imageUrl: U("photo-1598103442097-8b74394b95c6", "s=chicken"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  beef: {
    imageUrl: U("photo-1544025166-accc0948341b", "s=beef"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  steak: {
    imageUrl: U("photo-1600891964092-4316c14c11f0", "s=steak"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  roast: {
    imageUrl: U("photo-1574672280600-4accfa5b6f98", "s=roast"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  fish: {
    imageUrl: U("photo-1519708227418-c8fd9a32b7a2", "s=fish"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  taco: {
    imageUrl: U("photo-1565299585323-38d6b0865b47", "s=taco"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  burger: {
    imageUrl: U("photo-1568901346375-23c9450c58cd", "s=burger"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  pizza: {
    imageUrl: U("photo-1513104890138-7c749659a591", "s=pizza"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  rice: {
    imageUrl: U("photo-1603133872878-684f208fb84b", "s=rice"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  noodles: {
    imageUrl: U("photo-1569718212165-3a8278d5f264", "s=noodles"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  pie: {
    imageUrl: U("photo-1624300629298-e9de39c13be5", "s=pie"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  casserole: {
    imageUrl: U("photo-1574484284002-952d92456975", "s=casserole"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  mediterranean: {
    imageUrl: U("photo-1540189549336-e6e99c3679fe", "s=med"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  breakfast_default: {
    imageUrl: U("photo-1533089860892-a7c6f0a88666", "s=bfast"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  lunch_default: {
    imageUrl: U("photo-1546069901-ba9599a7e63c", "s=lunch"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  dinner_default: {
    imageUrl: U("photo-1414235077428-338989a2e8c0", "s=dinner"),
    imageSource: "unsplash",
    imageAttribution: "Photo on Unsplash",
  },
  placeholder: {
    imageUrl: "/meals/plate-warm.svg",
    imageSource: "local",
    imageAttribution: "Local placeholder",
  },
};

const KEYWORD_TO_CATEGORY: Array<{ test: RegExp; category: keyof typeof MEAL_IMAGE_LIBRARY }> = [
  { test: /pancake|french toast|waffle/i, category: "pancakes" },
  { test: /oat|porridge|granola/i, category: "oats" },
  { test: /yoghurt|yogurt|parfait/i, category: "yoghurt" },
  { test: /avocado/i, category: "avocado" },
  { test: /egg|omelette|frittata|scrambled|benedict|bacon and/i, category: "eggs" },
  { test: /toast|muffin|baked bean/i, category: "toast" },
  { test: /wrap|burrito|roll/i, category: "wrap" },
  { test: /sandwich|toastie|baguette/i, category: "sandwich" },
  { test: /salad|caesar|greek salad/i, category: "salad" },
  { test: /soup|chowder|broth/i, category: "soup" },
  { test: /pasta|spaghetti|lasagne|lasagna|penne|carbonara|bolognese|ragu/i, category: "pasta" },
  { test: /curry|tikka|korma|vindaloo|massaman|butter chicken|dahl|dal/i, category: "curry" },
  { test: /stir[- ]?fry|pad thai|teriyaki/i, category: "stirfry" },
  { test: /noodle|ramen|udon|pho/i, category: "noodles" },
  { test: /taco|nacho|quesadilla|enchilada/i, category: "taco" },
  { test: /burger/i, category: "burger" },
  { test: /pizza/i, category: "pizza" },
  { test: /steak|scotch fillet|ribeye/i, category: "steak" },
  { test: /roast|sunday roast/i, category: "roast" },
  { test: /pie|pastry|sausage roll/i, category: "pie" },
  { test: /casserole|stew|hot.?pot|shepherd|cottage pie/i, category: "casserole" },
  { test: /fish|salmon|barramundi|prawn|seafood|tuna/i, category: "fish" },
  { test: /chicken|parmigiana|schnitzel/i, category: "chicken" },
  { test: /beef|lamb|pork|ribs/i, category: "beef" },
  { test: /rice|risotto|biryani|fried rice/i, category: "rice" },
  { test: /mediterranean|falafel|hummus|kebab/i, category: "mediterranean" },
];

export function resolveMealImage(input: {
  name: string;
  tags?: string[];
  breakfastSuitability: number;
  lunchSuitability: number;
  dinnerSuitability: number;
}): MealImageRef {
  const hay = `${input.name} ${(input.tags ?? []).join(" ")}`;
  for (const row of KEYWORD_TO_CATEGORY) {
    if (row.test.test(hay)) return MEAL_IMAGE_LIBRARY[row.category]!;
  }
  if (input.breakfastSuitability >= 0.6 && input.dinnerSuitability < 0.4) {
    return MEAL_IMAGE_LIBRARY.breakfast_default!;
  }
  if (input.lunchSuitability >= 0.55 && input.dinnerSuitability < 0.55) {
    return MEAL_IMAGE_LIBRARY.lunch_default!;
  }
  if (input.dinnerSuitability >= 0.55) return MEAL_IMAGE_LIBRARY.dinner_default!;
  return MEAL_IMAGE_LIBRARY.placeholder!;
}
