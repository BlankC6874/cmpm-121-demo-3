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

// Persistent storage keys
const STORAGE_KEYS = {
  PLAYER_POSITION: "playerPosition",
  PLAYER_COINS: "playerCoins",
  PLAYER_INVENTORY: "playerInventory",
  PLAYER_HISTORY: "playerHistory",
};

// Function to move the player marker
function movePlayer(latOffset: number, lngOffset: number) {
  const currentPos = playerMarker.getLatLng();
  const newPos = leaflet.latLng(
    currentPos.lat + latOffset,
    currentPos.lng + lngOffset,
  );
  playerMarker.setLatLng(newPos);
  gameMap.setView(newPos);
  updatePlayerHistory(newPos);
}

// Event listeners for the control buttons
document.getElementById("north")!.addEventListener("click", () => {
  movePlayer(TILE_SIZE, 0);
});
document.getElementById("south")!.addEventListener("click", () => {
  movePlayer(-TILE_SIZE, 0);
});
document.getElementById("west")!.addEventListener("click", () => {
  movePlayer(0, -TILE_SIZE);
});
document.getElementById("east")!.addEventListener("click", () => {
  movePlayer(0, TILE_SIZE);
});

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
const playerInventory: { i: number; j: number; serial: number }[] = [];
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
      .map((coin) =>
        `<span class="coin" data-i="${coin.i}" data-j="${coin.j}">${coin.i}:${coin.j}#${coin.serial}</span>`
      )
      .join("<br>");

    // Clicking the collect button transfers coins from the cache to the player
    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (coinValue > 0) {
          coinValue--;
          playerCoins++;
          const collectedCoin = _coins[coinValue];
          playerInventory.push(collectedCoin);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML =
            `${playerPoints} points accumulated, ${playerCoins} coins collected<br>Inventory: ${
              playerInventory
                .map((coin) => `${coin.i}:${coin.j}#${coin.serial}`)
                .join(", ")
            }`;
          coinListDiv.innerHTML = _coins
            .slice(0, coinValue)
            .map((coin) =>
              `<span class="coin" data-i="${coin.i}" data-j="${coin.j}">${coin.i}:${coin.j}#${coin.serial}</span>`
            )
            .join("<br>");
          saveGameState();
        }
      });

    // Clicking the deposit button transfers coins from the player to the cache
    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins > 0) {
          coinValue++;
          playerCoins--;
          const depositedCoin = playerInventory.pop();
          if (depositedCoin) {
            _coins.push(depositedCoin);
          }
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML =
            coinValue.toString();
          statusPanel.innerHTML =
            `${playerPoints} points accumulated, ${playerCoins} coins collected<br>Inventory: ${
              playerInventory
                .map((coin) => `${coin.i}:${coin.j}#${coin.serial}`)
                .join(", ")
            }`;
          coinListDiv.innerHTML = _coins
            .slice(0, coinValue)
            .map((coin) =>
              `<span class="coin" data-i="${coin.i}" data-j="${coin.j}">${coin.i}:${coin.j}#${coin.serial}</span>`
            )
            .join("<br>");
          saveGameState();
        }
      });

    // Clicking a coin identifier centers the map on the coin's home cache
    coinListDiv.querySelectorAll(".coin").forEach((coinElement) => {
      coinElement.addEventListener("click", () => {
        const i = parseInt(coinElement.getAttribute("data-i")!);
        const j = parseInt(coinElement.getAttribute("data-j")!);
        const cacheLocation = leaflet.latLng(
          CLASSROOM_LOCATION.lat + i * TILE_SIZE,
          CLASSROOM_LOCATION.lng + j * TILE_SIZE,
        );
        gameMap.setView(cacheLocation, ZOOM_LEVEL);
      });
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

// Function to save the game state to local storage
function saveGameState() {
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_POSITION,
    JSON.stringify(playerMarker.getLatLng()),
  );
  localStorage.setItem(STORAGE_KEYS.PLAYER_COINS, playerCoins.toString());
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_INVENTORY,
    JSON.stringify(playerInventory),
  );
  localStorage.setItem(
    STORAGE_KEYS.PLAYER_HISTORY,
    JSON.stringify(playerHistory),
  );
}

// Function to load the game state from local storage
function loadGameState() {
  const savedPosition = localStorage.getItem(STORAGE_KEYS.PLAYER_POSITION);
  if (savedPosition) {
    const position = JSON.parse(savedPosition);
    playerMarker.setLatLng(position);
    gameMap.setView(position);
  }
  const savedCoins = localStorage.getItem(STORAGE_KEYS.PLAYER_COINS);
  if (savedCoins) {
    playerCoins = parseInt(savedCoins);
  }
  const savedInventory = localStorage.getItem(STORAGE_KEYS.PLAYER_INVENTORY);
  if (savedInventory) {
    playerInventory.push(...JSON.parse(savedInventory));
  }
  const savedHistory = localStorage.getItem(STORAGE_KEYS.PLAYER_HISTORY);
  if (savedHistory) {
    playerHistory.push(...JSON.parse(savedHistory));
    renderPlayerHistory();
  }
}

// Function to update the player's movement history
const playerHistory: leaflet.LatLng[] = [];
function updatePlayerHistory(position: leaflet.LatLng) {
  playerHistory.push(position);
  renderPlayerHistory();
  saveGameState();
}

// Function to render the player's movement history
function renderPlayerHistory() {
  const polyline = leaflet.polyline(playerHistory, { color: "blue" });
  polyline.addTo(gameMap);
}

// Event listener for the sensor button
document.getElementById("sensor")!.addEventListener("click", () => {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition((position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      const newPos = leaflet.latLng(lat, lng);
      playerMarker.setLatLng(newPos);
      gameMap.setView(newPos);
      updatePlayerHistory(newPos);
    });
  } else {
    alert("Geolocation is not supported by this browser.");
  }
});

// Event listener for the reset button
document.getElementById("reset")!.addEventListener("click", () => {
  if (confirm("Are you sure you want to erase your game state?")) {
    localStorage.clear();
    location.reload();
  }
});

// Load the game state when the page loads
globalThis.addEventListener("load", loadGameState);
