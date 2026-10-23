import type {
  BulkCreateListItemsRequest,
  MealBoard,
  MealSlotEntry,
  RecipeDetail,
} from "@/lib/types";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MEAL_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

export interface PlannedEntryRef {
  dayIndex: number;
  mealType: string;
  entry: MealSlotEntry;
}

export interface ReviewRow {
  id: string; // stable per (entry, ingredient index) or manual row id
  text: string;
  selected: boolean;
  // Labels of every meal that contributed to this row; only present when two or more
  // meals listed the same ingredient and their lines were folded into this one.
  mergedFrom?: string[];
}

export interface RecipeGroup {
  key: string;
  label: string;
  rows: ReviewRow[];
}

export interface NoIngredientGroup {
  key: string;
  label: string;
  manualRows: ReviewRow[]; // starts empty; the UI appends manual rows
}

// A recipe-backed meal whose detail fetch failed for a non-404 reason. Rendered as a
// retryable per-meal error row; it contributes no ingredient rows and no manual rows.
export interface ErrorGroup {
  key: string;
  label: string;
  recipeId: string;
}

// Per-recipe fetch outcome the UI passes in (built by useRecipeDetails in Task 5):
//   loaded  → detail available
//   missing → 404 (deleted recipe) → honest "no recipe ingredients"
//   error   → non-404 failure → retryable per-meal error row
export type RecipeResolution =
  | { status: "loaded"; detail: RecipeDetail }
  | { status: "missing" }
  | { status: "error" };

export interface ReviewModel {
  recipeGroups: RecipeGroup[];
  noIngredientGroups: NoIngredientGroup[];
  errorGroups: ErrorGroup[];
}

function isRecipeBacked(entry: MealSlotEntry): boolean {
  return entry.sourceType === "recipe" && entry.recipeId !== null;
}

export function collectPlannedEntries(board: MealBoard): PlannedEntryRef[] {
  const refs: PlannedEntryRef[] = [];
  for (const day of board.days) {
    for (const slot of day.slots) {
      const entries = [slot.primary, ...slot.extras].filter(
        (e): e is MealSlotEntry => e !== null,
      );
      for (const entry of entries) {
        refs.push({ dayIndex: day.dayIndex, mealType: slot.mealType, entry });
      }
    }
  }
  return refs;
}

export function hasRecipeBackedEntry(board: MealBoard): boolean {
  return collectPlannedEntries(board).some((ref) => isRecipeBacked(ref.entry));
}

export function distinctRecipeIds(board: MealBoard): string[] {
  const ids = new Set<string>();
  for (const ref of collectPlannedEntries(board)) {
    if (isRecipeBacked(ref.entry) && ref.entry.recipeId)
      ids.add(ref.entry.recipeId);
  }
  return [...ids];
}

function label(ref: PlannedEntryRef): string {
  return `${WEEKDAY_LABELS[ref.dayIndex]} · ${MEAL_LABELS[ref.mealType]} — ${ref.entry.title}`;
}

function groupKey(ref: PlannedEntryRef): string {
  return `${ref.dayIndex}:${ref.mealType}:${ref.entry.id}`;
}

export function buildReviewModel(
  board: MealBoard,
  resolutionsById: Record<string, RecipeResolution | undefined>,
): ReviewModel {
  const recipeGroups: RecipeGroup[] = [];
  const noIngredientGroups: NoIngredientGroup[] = [];
  const errorGroups: ErrorGroup[] = [];

  for (const ref of collectPlannedEntries(board)) {
    const key = groupKey(ref);

    // Quick meals (and any entry without a recipe id) never have recipe ingredients.
    if (!isRecipeBacked(ref.entry) || !ref.entry.recipeId) {
      noIngredientGroups.push({ key, label: label(ref), manualRows: [] });
      continue;
    }

    const resolution = resolutionsById[ref.entry.recipeId];

    // Non-404 failure (or an unresolved id) → retryable error row; never silently dropped
    // and never treated as "no recipe ingredients".
    if (resolution === undefined || resolution.status === "error") {
      errorGroups.push({
        key,
        label: label(ref),
        recipeId: ref.entry.recipeId,
      });
      continue;
    }

    // 404 (deleted recipe) → honest "no recipe ingredients".
    if (resolution.status === "missing") {
      noIngredientGroups.push({ key, label: label(ref), manualRows: [] });
      continue;
    }

    // Loaded: one verbatim row per ingredient, or the no-ingredient section when empty.
    const ingredients = resolution.detail.ingredients;
    if (ingredients.length > 0) {
      recipeGroups.push({
        key,
        label: label(ref),
        rows: ingredients.map((text, index) => ({
          id: `${key}#${index}`,
          text,
          selected: true,
        })),
      });
    } else {
      noIngredientGroups.push({ key, label: label(ref), manualRows: [] });
    }
  }

  return mergeDuplicateIngredients({
    recipeGroups,
    noIngredientGroups,
    errorGroups,
  });
}

// ---------------------------------------------------------------------------
// Merging the same ingredient across meals
//
// A week that plans the same recipe twice, or two recipes that both call for
// "1 onion", should land on the grocery list once with the quantities added up
// rather than as repeated lines. Lines are parsed into quantity / unit / name;
// rows whose unit and name match are folded into the first occurrence. Lines
// without a quantity ("salt to taste") are deduplicated verbatim. Anything the
// parser does not understand is left alone, so an odd line is never mangled.
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS: Record<string, number> = {
  "½": 0.5,
  "⅓": 1 / 3,
  "⅔": 2 / 3,
  "¼": 0.25,
  "¾": 0.75,
  "⅛": 0.125,
  "⅜": 0.375,
  "⅝": 0.625,
  "⅞": 0.875,
};

// Rendered fractions for merged totals, keyed by the fractional part (3 dp).
const NICE_FRACTIONS: Array<[number, string]> = [
  [0.125, "1/8"],
  [0.25, "1/4"],
  [0.333, "1/3"],
  [0.375, "3/8"],
  [0.5, "1/2"],
  [0.625, "5/8"],
  [0.667, "2/3"],
  [0.75, "3/4"],
  [0.875, "7/8"],
];

// canonical unit → every spelling that maps to it. The canonical form is what two
// lines must share to merge; the first line's own spelling is kept when rendering.
const UNIT_SPELLINGS: Record<string, string[]> = {
  cup: ["cup", "cups", "c"],
  tablespoon: ["tablespoon", "tablespoons", "tbsp", "tbsps", "tbs", "tbl"],
  teaspoon: ["teaspoon", "teaspoons", "tsp", "tsps"],
  ounce: ["ounce", "ounces", "oz"],
  pound: ["pound", "pounds", "lb", "lbs"],
  gram: ["gram", "grams", "g"],
  kilogram: ["kilogram", "kilograms", "kg"],
  milliliter: ["milliliter", "milliliters", "millilitre", "millilitres", "ml"],
  liter: ["liter", "liters", "litre", "litres", "l"],
  pint: ["pint", "pints", "pt"],
  quart: ["quart", "quarts", "qt"],
  gallon: ["gallon", "gallons", "gal"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  bottle: ["bottle", "bottles"],
  box: ["box", "boxes"],
  bag: ["bag", "bags"],
  package: ["package", "packages", "pkg", "pkgs"],
  container: ["container", "containers"],
  bunch: ["bunch", "bunches"],
  head: ["head", "heads"],
  stalk: ["stalk", "stalks"],
  sprig: ["sprig", "sprigs"],
  slice: ["slice", "slices"],
  stick: ["stick", "sticks"],
  piece: ["piece", "pieces"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  handful: ["handful", "handfuls"],
};

const UNIT_BY_SPELLING: Record<string, string> = Object.fromEntries(
  Object.entries(UNIT_SPELLINGS).flatMap(([canonical, spellings]) =>
    spellings.map((spelling) => [spelling, canonical]),
  ),
);

// Spellings that are abbreviations never take a plural "s" ("2 tbsp", "3 oz").
const ABBREVIATIONS = new Set(
  Object.entries(UNIT_SPELLINGS).flatMap(([canonical, spellings]) =>
    spellings.filter(
      (spelling) =>
        spelling !== canonical && spelling !== pluralWord(canonical),
    ),
  ),
);

interface ParsedLine {
  quantity: number;
  // Optional size note between the quantity and the unit: "1 (8 ounce) package".
  sizeNote: string;
  unitSpelling: string; // "" when the line has no unit ("2 onions")
  unitCanonical: string; // "" when the line has no unit
  name: string;
}

const QUANTITY = String.raw`(\d+\s+\d+/\d+|\d+/\d+|\d*[½⅓⅔¼¾⅛⅜⅝⅞]|\d+(?:\.\d+)?)`;
const LINE = new RegExp(
  String.raw`^${QUANTITY}(?=[\s(]|$)\s*(\([^)]*\)\s*)?([A-Za-z.]+)?\s*(.*)$`,
);

function parseQuantity(raw: string): number | null {
  const text = raw.trim();
  const unicode = text.match(/^(\d*)([½⅓⅔¼¾⅛⅜⅝⅞])$/);
  if (unicode) {
    return (
      (unicode[1] ? Number(unicode[1]) : 0) + UNICODE_FRACTIONS[unicode[2]]
    );
  }
  const mixed = text.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denominator = Number(mixed[3]);
    return denominator === 0
      ? null
      : Number(mixed[1]) + Number(mixed[2]) / denominator;
  }
  const fraction = text.match(/^(\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator === 0 ? null : Number(fraction[1]) / denominator;
  }
  const decimal = Number(text);
  return Number.isFinite(decimal) ? decimal : null;
}

function parseLine(text: string): ParsedLine | null {
  const match = text.trim().match(LINE);
  if (!match) return null;
  const quantity = parseQuantity(match[1]);
  if (quantity === null) return null;
  const sizeNote = (match[2] ?? "").trim();
  const word = match[3] ?? "";
  const unitCanonical = UNIT_BY_SPELLING[word.toLowerCase().replace(/\.$/, "")];
  // The word after the quantity is either a unit or the start of the name.
  const unitSpelling = unitCanonical ? word : "";
  const name = (unitCanonical ? match[4] : `${word} ${match[4]}`).trim();
  if (name.length === 0) return null;
  return {
    quantity,
    sizeNote,
    unitSpelling,
    unitCanonical: unitCanonical ?? "",
    name,
  };
}

function pluralWord(word: string): string {
  const lower = word.toLowerCase();
  if (lower === "tomato" || lower === "potato") return `${word}es`;
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  if (/[^aeiou]y$/i.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function singularWord(word: string): string {
  if (/ies$/i.test(word)) return `${word.slice(0, -3)}y`;
  if (/(ches|shes|xes|zes|ses|oes)$/i.test(word)) return word.slice(0, -2);
  if (/[^s]s$/i.test(word)) return word.slice(0, -1);
  return word;
}

// The "head" of a name is the part before any preparation note, which is where the
// countable noun lives: "onion, diced" → "onion"; "chicken breast (boneless)" → "chicken breast".
function splitHead(name: string): { head: string; rest: string } {
  const index = name.search(/[,(]/);
  return index === -1
    ? { head: name, rest: "" }
    : { head: name.slice(0, index).trimEnd(), rest: name.slice(index) };
}

function mapLastWord(text: string, fn: (word: string) => string): string {
  const words = text.split(/\s+/);
  const last = words.length - 1;
  words[last] = fn(words[last]);
  return words.join(" ");
}

function normaliseText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "").trim();
}

function mergeKey(parsed: ParsedLine): string {
  const { head, rest } = splitHead(normaliseText(parsed.name));
  const singularHead = mapLastWord(head, singularWord);
  return [
    parsed.unitCanonical,
    normaliseText(parsed.sizeNote),
    `${singularHead}${rest}`,
  ].join("|");
}

function formatQuantity(total: number): string {
  const whole = Math.floor(total);
  const fraction = total - whole;
  if (fraction < 0.001) return String(whole);
  const nice = NICE_FRACTIONS.find(
    ([value]) => Math.abs(value - fraction) < 0.01,
  );
  if (nice) return whole === 0 ? nice[1] : `${whole} ${nice[1]}`;
  return String(Math.round(total * 100) / 100);
}

function pluralUnit(spelling: string, total: number): string {
  if (total === 1 || ABBREVIATIONS.has(spelling.toLowerCase())) return spelling;
  const canonical = UNIT_BY_SPELLING[spelling.toLowerCase()];
  const already = spelling.toLowerCase() === pluralWord(canonical);
  return already ? spelling : pluralWord(spelling);
}

// Picks the name to render: a contributor that already listed a plural ("2 onions")
// wins over pluralising "onion" by rule, which is a guess.
function mergedName(contributors: ParsedLine[], total: number): string {
  const first = contributors[0];
  if (first.unitCanonical !== "" || total === 1) return first.name;
  const plural = contributors.find((c) => c.quantity !== 1);
  if (plural) return plural.name;
  const { head, rest } = splitHead(first.name);
  return `${mapLastWord(head, pluralWord)}${rest}`;
}

function renderMerged(contributors: ParsedLine[]): string {
  const total = contributors.reduce((sum, c) => sum + c.quantity, 0);
  const first = contributors[0];
  return [
    formatQuantity(total),
    first.sizeNote,
    first.unitSpelling === "" ? "" : pluralUnit(first.unitSpelling, total),
    mergedName(contributors, total),
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

interface MergeBucket {
  groupIndex: number;
  rowIndex: number;
  contributors: ParsedLine[]; // empty for unquantified lines (verbatim dedupe)
  labels: string[];
}

export function mergeDuplicateIngredients(model: ReviewModel): ReviewModel {
  const buckets = new Map<string, MergeBucket>();
  const rows: ReviewRow[][] = model.recipeGroups.map((g) => [...g.rows]);
  const dropped = new Set<string>();

  model.recipeGroups.forEach((group, groupIndex) => {
    group.rows.forEach((row, rowIndex) => {
      const parsed = parseLine(row.text);
      const key = parsed
        ? `q|${mergeKey(parsed)}`
        : `t|${normaliseText(row.text)}`;
      const bucket = buckets.get(key);
      if (!bucket) {
        buckets.set(key, {
          groupIndex,
          rowIndex,
          contributors: parsed ? [parsed] : [],
          labels: [group.label],
        });
        return;
      }
      if (parsed) bucket.contributors.push(parsed);
      bucket.labels.push(group.label);
      dropped.add(row.id);
    });
  });

  for (const bucket of buckets.values()) {
    if (bucket.labels.length < 2) continue;
    const row = rows[bucket.groupIndex][bucket.rowIndex];
    rows[bucket.groupIndex][bucket.rowIndex] = {
      ...row,
      text:
        bucket.contributors.length > 0
          ? renderMerged(bucket.contributors)
          : row.text,
      mergedFrom: bucket.labels,
    };
  }

  const recipeGroups = model.recipeGroups
    .map((group, index) => ({
      ...group,
      rows: rows[index].filter((row) => !dropped.has(row.id)),
    }))
    .filter((group) => group.rows.length > 0);

  return { ...model, recipeGroups };
}

export function toBulkItemsRequest(
  model: ReviewModel,
): BulkCreateListItemsRequest {
  const rows: ReviewRow[] = [
    ...model.recipeGroups.flatMap((g) => g.rows),
    ...model.noIngredientGroups.flatMap((g) => g.manualRows),
  ];
  return {
    items: rows
      .filter((row) => row.selected && row.text.trim().length > 0)
      .map((row) => ({ text: row.text.trim() })), // uncategorized in v1
  };
}
