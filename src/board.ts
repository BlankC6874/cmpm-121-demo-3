import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell> = new Map();

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    // ...
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    // ...
    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, { i, j });
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    return this.getCanonicalCell({
      i: Math.floor(point.lat / this.tileWidth),
      j: Math.floor(point.lng / this.tileWidth),
      // ...
    });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    // ...
    const { i, j } = cell;
    const topLeft = leaflet.latLng(i * this.tileWidth, j * this.tileWidth);
    const bottomRight = leaflet.latLng(
      (i + 1) * this.tileWidth,
      (j + 1) * this.tileWidth,
    );
    return leaflet.latLngBounds(topLeft, bottomRight);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    const { i: originI, j: originJ } = originCell;
    for (
      let i = originI - this.tileVisibilityRadius;
      i <= originI + this.tileVisibilityRadius;
      i++
    ) {
      for (
        let j = originJ - this.tileVisibilityRadius;
        j <= originJ + this.tileVisibilityRadius;
        j++
      ) {
        resultCells.push(this.getCanonicalCell({ i, j }));
      }
    }
    // ...
    return resultCells;
  }
}
