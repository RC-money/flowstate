export type CelestialKind = "sun" | "moon" | "asteroid" | "comet" | "gas-giant";

export interface Tether {
  id: string;
  sourceId: string;
  targetId: string;
  createdAt: number;
  strength: number;
}

export interface Constellation {
  id: string;
  memberIds: string[];
  centroid: { x: number; y: number };
  density: number;
  suggestedName: string;
  name?: string;
  createdAt: number;
  kind: "constellation" | "nursery";
}

export interface CelestialMeta {
  heat?: number;
  entropy?: number;
  position?: { x: number; y: number };
  lastUpdated?: number;
}
