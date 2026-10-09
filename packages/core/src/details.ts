import type {
  ContactStoreInput, ContactStoreOutput, GetDirectionsInput, GetDirectionsOutput,
  GetPlaceDetailsInput, GetPlaceDetailsOutput,
} from "@veylo/types";
import type { CoreContext, Place } from "./context";
import { VeyloError } from "./errors";
import { STORE_TYPE_LABEL } from "./store-categories";

async function requirePlace(ctx: CoreContext, id: string): Promise<Place> {
  const place = await ctx.placeStore.get(id);
  if (!place) throw new VeyloError("NOT_FOUND", `Unknown place id "${id}". Run discover_local_places first.`, { id });
  return place;
}

/** OSM websites often lack a scheme. Returns a valid absolute URL or undefined. */
export function normalizeWebsite(raw: string | undefined): string | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    new URL(withScheme);
    return withScheme;
  } catch {
    return undefined;
  }
}

export async function getPlaceDetails(ctx: CoreContext, input: GetPlaceDetailsInput): Promise<GetPlaceDetailsOutput> {
  const place = await requirePlace(ctx, input.placeId);
  return {
    id: place.id,
    name: place.name,
    address: place.address,
    category: STORE_TYPE_LABEL[place.storeType],
    openingHours: place.openingHours,
    phone: place.phone,
    website: normalizeWebsite(place.website),
    source: place.source,
    evidence: [
      {
        source: place.source,
        sourceType: place.sourceType,
        timestamp: place.retrievedAt,
        confidence: 0.5,
        evidenceSummary: `Details as listed in ${place.source}; community-maintained and possibly out of date. Not verified with the store.`,
      },
    ],
  };
}

export async function getDirections(ctx: CoreContext, input: GetDirectionsInput): Promise<GetDirectionsOutput> {
  const place = await requirePlace(ctx, input.placeId);
  const mode = input.mode ?? "driving";
  const destination = `${place.lat.toFixed(6)},${place.lon.toFixed(6)}`;
  const params = new URLSearchParams({ api: "1", destination, travelmode: mode });
  if (input.origin?.trim()) params.set("origin", input.origin.trim());
  return {
    destination: [place.name, place.address].filter(Boolean).join(", "),
    url: `https://www.google.com/maps/dir/?${params.toString()}`,
    mode,
    source: "Google Maps URL (a link only; no routing service was called)",
  };
}

export async function contactStore(ctx: CoreContext, input: ContactStoreInput): Promise<ContactStoreOutput> {
  const place = await requirePlace(ctx, input.storeId);
  const website = normalizeWebsite(place.website);
  const base = { store: place.name, phone: place.phone, website, source: place.source };
  const caveat = "Veylo does not place calls or send messages.";
  if (place.phone) {
    return {
      ...base,
      contactMethod: "phone",
      actionUrl: `tel:${place.phone.replace(/[^\d+]/g, "")}`,
      note: `Call to ask whether they stock ${input.product ?? "the item"}. ${caveat}`,
    };
  }
  if (website) {
    return { ...base, contactMethod: "website", actionUrl: website, note: `No phone number is listed; use the website. ${caveat}` };
  }
  return {
    ...base,
    contactMethod: "none",
    note: `${place.source} lists no phone or website for this business. Use directions to visit in person. ${caveat}`,
  };
}
