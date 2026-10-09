import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildOverpassQuery,
  formatOsmAddress,
  OverpassPlaceSource,
  NominatimGeocoder,
  WebEvidenceProvider,
  CachedPlaceStore,
} from "../src/index";
import type { Place, StoreType, WebSearchProvider } from "@veylo/core";

test("buildOverpassQuery produces valid Overpass QL with radius and tags", () => {
  const query = buildOverpassQuery({ lat: 47.6062, lon: -122.3321 }, 5000, ["electronics", "hardware"]);
  assert.ok(query.includes("[out:json][timeout:25];"));
  assert.ok(query.includes('(around:5000,47.606200,-122.332100)'));
  assert.ok(query.includes('node["shop"="electronics"]'));
  assert.ok(query.includes('way["shop"="electronics"]'));
  assert.ok(query.includes('node["shop"="hardware"]'));
  assert.ok(query.includes('out center tags;'));
});

test("formatOsmAddress formats street, city, and postal codes", () => {
  const full = formatOsmAddress({
    "addr:housenumber": "123",
    "addr:street": "Main St",
    "addr:city": "Seattle",
    "addr:postcode": "98101",
  });
  assert.equal(full, "123 Main St, Seattle, 98101");

  const streetOnly = formatOsmAddress({
    "addr:housenumber": "500",
    "addr:street": "Pine Ave",
  });
  assert.equal(streetOnly, "500 Pine Ave");

  const empty = formatOsmAddress({});
  assert.equal(empty, undefined);
});

test("OverpassPlaceSource parses nodes and ways and populates Place objects", async () => {
  const mockFetch = async () =>
    new Response(
      JSON.stringify({
        elements: [
          {
            type: "node",
            id: 101,
            lat: 47.61,
            lon: -122.33,
            tags: {
              name: "Seattle Electronics",
              shop: "electronics",
              phone: "+1 206 555 0100",
              website: "https://seattle-elec.com",
              "addr:housenumber": "100",
              "addr:street": "Pike St",
              opening_hours: "Mo-Sa 10:00-19:00",
            },
          },
          {
            type: "way",
            id: 202,
            center: { lat: 47.62, lon: -122.34 },
            tags: {
              name: "Hardware Hub",
              shop: "hardware",
              "contact:phone": "+1 206 555 0200",
            },
          },
          {
            // Missing coordinates, should be skipped
            type: "node",
            id: 303,
            tags: { name: "No Coords Store", shop: "electronics" },
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );

  const source = new OverpassPlaceSource({ fetch: mockFetch as any });
  const places = await source.search({
    center: { lat: 47.61, lon: -122.33 },
    radiusMeters: 3000,
    storeTypes: ["electronics", "hardware"],
  });

  assert.equal(places.length, 2);

  const p1 = places.find((p) => p.id === "osm:node/101")!;
  assert.ok(p1);
  assert.equal(p1.name, "Seattle Electronics");
  assert.equal(p1.storeType, "electronics");
  assert.equal(p1.lat, 47.61);
  assert.equal(p1.lon, -122.33);
  assert.equal(p1.phone, "+1 206 555 0100");
  assert.equal(p1.website, "https://seattle-elec.com");
  assert.equal(p1.address, "100 Pike St");
  assert.equal(p1.openingHours, "Mo-Sa 10:00-19:00");
  assert.equal(p1.source, "OpenStreetMap");
  assert.equal(p1.sourceType, "osm");

  const p2 = places.find((p) => p.id === "osm:way/202")!;
  assert.ok(p2);
  assert.equal(p2.name, "Hardware Hub");
  assert.equal(p2.storeType, "hardware");
  assert.equal(p2.lat, 47.62);
  assert.equal(p2.lon, -122.34);
  assert.equal(p2.phone, "+1 206 555 0200");
});

test("NominatimGeocoder parses direct lat,lon without HTTP and geocodes text queries", async () => {
  let fetchCalled = false;
  const mockFetch = async (url: string) => {
    fetchCalled = true;
    assert.ok(url.includes("format=json"));
    return new Response(
      JSON.stringify([
        {
          lat: "47.6062",
          lon: "-122.3321",
          display_name: "Seattle, King County, Washington, USA",
        },
      ]),
      { status: 200 },
    );
  };

  const geocoder = new NominatimGeocoder({ fetch: mockFetch as any });

  // Direct coordinate should bypass fetch
  const direct = await geocoder.geocode("30.2672,-97.7431");
  assert.ok(direct);
  assert.equal(direct.lat, 30.2672);
  assert.equal(direct.lon, -97.7431);
  assert.equal(fetchCalled, false);

  // Text location should call fetch and return parsed float coordinates
  const textResult = await geocoder.geocode("Seattle, WA");
  assert.ok(textResult);
  assert.equal(fetchCalled, true);
  assert.equal(textResult.lat, 47.6062);
  assert.equal(textResult.lon, -122.3321);

  // Cached call should not call fetch again
  fetchCalled = false;
  const cached = await geocoder.geocode("Seattle, WA");
  assert.ok(cached);
  assert.equal(fetchCalled, false);
});

test("WebEvidenceProvider produces first-party and third-party signals", async () => {
  const fakePlace: Place = {
    id: "osm:node/99",
    name: "Best Tech Store",
    storeType: "electronics",
    lat: 47.6,
    lon: -122.3,
    website: "https://besttechstore.com",
    source: "OpenStreetMap",
    sourceType: "osm",
    retrievedAt: new Date().toISOString(),
  };

  const mockWebSearch: WebSearchProvider = {
    name: "MockWebSearch",
    search: async () => [
      {
        title: "USB-C to HDMI Adapter at Best Tech Store",
        url: "https://besttechstore.com/products/usbc-hdmi",
        snippet: "Buy USB-C to HDMI adapter today in store",
      },
      {
        title: "Best Tech Store Review on TechRadar",
        url: "https://techradar.com/best-tech-store-accessories",
        snippet: "They stock cables and adapters",
      },
    ],
  };

  const provider = new WebEvidenceProvider({ webSearch: mockWebSearch });
  const signals = await provider.lookup({ place: fakePlace, product: "USB-C to HDMI adapter" });

  assert.equal(signals.length, 2);

  const firstParty = signals.find((s) => s.firstParty);
  assert.ok(firstParty);
  assert.equal(firstParty.kind, "product_listed");
  assert.equal(firstParty.confidence, 0.75);

  const thirdParty = signals.find((s) => !s.firstParty);
  assert.ok(thirdParty);
  assert.equal(thirdParty.kind, "product_mentioned");
  assert.equal(thirdParty.confidence, 0.45);
});

test("CachedPlaceStore stores and retrieves places with TTL support", async () => {
  const store = new CachedPlaceStore({ ttlMs: 5000 });
  const place: Place = {
    id: "osm:node/1",
    name: "Local Electronics",
    storeType: "electronics",
    lat: 40.71,
    lon: -74.0,
    source: "OpenStreetMap",
    sourceType: "osm",
    retrievedAt: new Date().toISOString(),
  };

  await store.putMany([place]);
  const fetched = await store.get("osm:node/1");
  assert.ok(fetched);
  assert.equal(fetched.name, "Local Electronics");

  const missing = await store.get("osm:node/999");
  assert.equal(missing, undefined);
});
