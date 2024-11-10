import leaflet from "leaflet";

// Import stylesheets
import "leaflet/dist/leaflet.css";
import "./style.css";

// Fix for missing marker images
import "./leafletWorkaround.ts";

// Deterministic random number generator
import rng from "./luck.ts";

// Coordinates for the classroom location
const CLASSROOM_LOCATION = leaflet.latLng(
  36.98949379578401,
  -122.06277128548504,
);

// Gameplay configuration parameters
const ZOOM_LEVEL = 19;
const TILE_SIZE = 1e-4;
const AREA_SIZE = 8;
const CACHE_PROBABILITY = 0.1;

// Initialize the map (element with id "map" is defined in index.html)
const gameMap = leaflet.map(document.getElementById("map")!, {
  center: CLASSROOM_LOCATION,
  zoom: ZOOM_LEVEL,
  minZoom: ZOOM_LEVEL,
  maxZoom: ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Add a tile layer to the map
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(gameMap);

// Add a marker to represent the player
const playerMarker = leaflet.marker(CLASSROOM_LOCATION);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(gameMap);

// Display the player's points and coins
const playerPoints = 0;
let playerCoins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!; // element `statusPanel` is defined in index.html
statusPanel.innerHTML = "Check out the blue boxes of cache around you!";

// Function to convert latitude/longitude to global grid coordinates
function _latLngToGrid(lat: number, lng: number) {
  return {
    i: Math.floor(lat * 1e4),
    j: Math.floor(lng * 1e4),
  };
}

// Function to add caches to the map based on grid coordinates
function createCache(gridX: number, gridY: number) {
  // Convert grid coordinates to latitude/longitude bounds
  const origin = CLASSROOM_LOCATION;
  const bounds = leaflet.latLngBounds([
    [origin.lat + gridX * TILE_SIZE, origin.lng + gridY * TILE_SIZE],
    [
      origin.lat + (gridX + 1) * TILE_SIZE,
      origin.lng + (gridY + 1) * TILE_SIZE,
    ],
  ]);

  // Add a rectangle to the map to represent the cache
  const cacheRectangle = leaflet.rectangle(bounds);
  cacheRectangle.addTo(gameMap);

  // Handle interactions with the cache
  cacheRectangle.bindPopup(() => {
    // Each cache has a random coin value, mutable by the player
    let coinValue = Math.floor(
      rng([gridX, gridY, "initialValue"].toString()) * 10,
    );

    // Create unique coin identities
    const _coins = Array.from({ length: coinValue }, (_, serial) => ({
      i: gridX,
      j: gridY,
      serial,
    }));

    // The popup offers a description and buttons
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
                <div>A cache here at "${gridX},${gridY}". It has <span id="value">${coinValue}</span> coins.</div>
                <button id="collect">Collect</button>
                <button id="deposit">Deposit</button>
                <div id="coinList"></div>`;

    // Display the list of coins in the desired format
    const coinListDiv = popupDiv.querySelector<HTMLDivElement>("#coinList")!;
    coinListDiv.innerHTML = _coins
      .map((coin) => `${coin.i}:${coin.j}#${coin.serial}`)
      .join("<br>");

    // Clicking the collect button transfers coins from the cache to the player
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML =
            `${playerPoints} points accumulated, ${playerCoins} coins collected`;
          coinListDiv.innerHTML = _coins
            .slice(0, coinValue)
            .map((coin) => `${coin.i}:${coin.j}#${coin.serial}`)
            .join("<br>");
        }
      });

    // Clicking the deposit button transfers coins from the player to the cache
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          coinValue++;
          playerCoins--;
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML =
            `${playerPoints} points accumulated, ${playerCoins} coins collected`;
          coinListDiv.innerHTML = _coins
            .slice(0, coinValue)
            .map((coin) => `${coin.i}:${coin.j}#${coin.serial}`)
            .join("<br>");
        }
      });

    return popupDiv;
  });
}

// Scan the player's surrounding area for caches to spawn
for (let x = -AREA_SIZE; x < AREA_SIZE; x++) {
  for (let y = -AREA_SIZE; y < AREA_SIZE; y++) {
    // If the location (x, y) is lucky enough, spawn a cache!
    if (rng([x, y].toString()) < CACHE_PROBABILITY) {
      createCache(x, y);
    }
  }
}
