/**
 * Zustand global store
 */

import { create } from 'zustand';
import type { Garment, LabelScanResult } from './api';

interface AppState {
  // API connection status
  apiConnected: boolean;
  setApiConnected: (connected: boolean) => void;

  // Recent garments
  garments: Garment[];
  addGarment: (garment: Garment) => void;
  updateGarment: (ugi: string, update: Partial<Garment>) => void;

  // Current scan
  currentScanUGI: string | null;
  setCurrentScanUGI: (ugi: string | null) => void;

  // Last label scan result
  lastLabelScan: LabelScanResult | null;
  setLastLabelScan: (result: LabelScanResult | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  apiConnected: false,
  setApiConnected: (connected) => set({ apiConnected: connected }),

  garments: [],
  addGarment: (garment) =>
    set((state) => ({ garments: [garment, ...state.garments] })),
  updateGarment: (ugi, update) =>
    set((state) => ({
      garments: state.garments.map((g) =>
        g.ugi === ugi ? { ...g, ...update } : g
      ),
    })),

  currentScanUGI: null,
  setCurrentScanUGI: (ugi) => set({ currentScanUGI: ugi }),

  lastLabelScan: null,
  setLastLabelScan: (result) => set({ lastLabelScan: result }),
}));
