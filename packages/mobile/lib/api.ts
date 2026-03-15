/**
 * Loocbooc API client
 * Connects to the Loocbooc backend. Falls back to mock data when API is unreachable.
 */

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';
const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Garment {
  ugi: string;
  name: string;
  category: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  created_at: string;
  model_url?: string;
  thumbnail_url?: string;
  composition?: string;
  physics?: PhysicsParams;
}

export interface PhysicsParams {
  drape: number;       // 0-1
  stretch: number;     // 0-1
  weight: number;      // 0-1
  stiffness: number;   // 0-1
  recovery: number;    // 0-1
}

export interface ScanStatus {
  ugi: string;
  status: 'queued' | 'processing' | 'reconstructing' | 'complete' | 'failed';
  progress: number;    // 0-100
  stage?: string;
  model_url?: string;
  error?: string;
}

export interface LabelScanResult {
  composition: string;
  fibres: Record<string, number>;
  confidence: number;
  physics: PhysicsParams;
  raw_text: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_GARMENTS: Garment[] = [
  {
    ugi: 'LB-2024-DEMO-001',
    name: 'Silk Midi Dress',
    category: 'dress',
    status: 'complete',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    composition: '100% Silk',
    physics: { drape: 0.92, stretch: 0.12, weight: 0.45, stiffness: 0.08, recovery: 0.78 },
  },
  {
    ugi: 'LB-2024-DEMO-002',
    name: 'Cotton Blazer',
    category: 'jacket',
    status: 'complete',
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    composition: '98% Cotton, 2% Elastane',
    physics: { drape: 0.45, stretch: 0.35, weight: 0.65, stiffness: 0.55, recovery: 0.82 },
  },
  {
    ugi: 'LB-2024-DEMO-003',
    name: 'Linen Trousers',
    category: 'pants',
    status: 'processing',
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    composition: '100% Linen',
    physics: { drape: 0.52, stretch: 0.05, weight: 0.55, stiffness: 0.62, recovery: 0.45 },
  },
];

let mockScanProgress = 0;
let mockScanInterval: ReturnType<typeof setInterval> | null = null;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// ─── API client ───────────────────────────────────────────────────────────────

export const api = {
  /**
   * Check if the API is reachable
   */
  healthCheck: async (): Promise<boolean> => {
    if (DEMO_MODE) return false;
    try {
      const res = await apiFetch('/health');
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Create a new garment and get a UGI
   */
  createGarment: async (name: string, category: string): Promise<Garment> => {
    if (DEMO_MODE) {
      return mockCreateGarment(name, category);
    }
    try {
      const res = await apiFetch('/garments', {
        method: 'POST',
        body: JSON.stringify({ name, category }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    } catch {
      console.warn('[API] createGarment fell back to mock');
      return mockCreateGarment(name, category);
    }
  },

  /**
   * Upload scan frames (base64 JPEG array)
   */
  uploadFrames: async (ugi: string, frames: string[], imuData?: object[]): Promise<void> => {
    if (DEMO_MODE) return;
    try {
      const formData = new FormData();
      frames.forEach((frame, i) => {
        // Convert base64 to blob
        const blob = base64ToBlob(frame, 'image/jpeg');
        formData.append('files', blob, `frame_${i.toString().padStart(4, '0')}.jpg`);
      });
      if (imuData) {
        formData.append('imu_data', JSON.stringify(imuData));
      }
      const res = await fetch(`${API_BASE}/api/v1/garments/${ugi}/files`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload error ${res.status}`);
    } catch (err) {
      console.warn('[API] uploadFrames failed:', err);
      // In demo mode just continue
    }
  },

  /**
   * Get scan processing status
   */
  getScanStatus: async (ugi: string): Promise<ScanStatus> => {
    if (DEMO_MODE) {
      return mockGetScanStatus(ugi);
    }
    try {
      const res = await apiFetch(`/garments/${ugi}/scan/status`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    } catch {
      return mockGetScanStatus(ugi);
    }
  },

  /**
   * Scan a care label image
   */
  scanLabel: async (imageBase64: string): Promise<LabelScanResult> => {
    if (DEMO_MODE) {
      return mockScanLabel();
    }
    try {
      const formData = new FormData();
      const blob = base64ToBlob(imageBase64, 'image/jpeg');
      formData.append('image', blob, 'label.jpg');
      const res = await fetch(`${API_BASE}/api/v1/scan/label`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    } catch {
      console.warn('[API] scanLabel fell back to mock');
      return mockScanLabel();
    }
  },

  /**
   * Get garment details
   */
  getGarment: async (ugi: string): Promise<Garment> => {
    if (DEMO_MODE) {
      return mockGetGarment(ugi);
    }
    try {
      const res = await apiFetch(`/garments/${ugi}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      return res.json();
    } catch {
      return mockGetGarment(ugi);
    }
  },

  /**
   * List recent garments
   */
  listGarments: async (): Promise<Garment[]> => {
    if (DEMO_MODE) {
      return MOCK_GARMENTS;
    }
    try {
      const res = await apiFetch('/garments?limit=10');
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      return data.items || data;
    } catch {
      return MOCK_GARMENTS;
    }
  },
};

// ─── Mock implementations ─────────────────────────────────────────────────────

function mockCreateGarment(name: string, category: string): Garment {
  const ugi = `LB-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  mockScanProgress = 0;
  return {
    ugi,
    name,
    category,
    status: 'pending',
    created_at: new Date().toISOString(),
  };
}

function mockGetScanStatus(ugi: string): ScanStatus {
  mockScanProgress = Math.min(100, mockScanProgress + 4);
  const stages = [
    { threshold: 20, stage: 'Extracting frames...' },
    { threshold: 40, stage: 'Analysing geometry...' },
    { threshold: 60, stage: 'Building point cloud...' },
    { threshold: 80, stage: 'Reconstructing mesh...' },
    { threshold: 95, stage: 'Applying textures...' },
    { threshold: 100, stage: 'Finalising model...' },
  ];
  const current = stages.find(s => mockScanProgress <= s.threshold) || stages[stages.length - 1];

  return {
    ugi,
    status: mockScanProgress >= 100 ? 'complete' : 'processing',
    progress: mockScanProgress,
    stage: current.stage,
    model_url: mockScanProgress >= 100 ? 'https://loocbooc.com/demo/model.glb' : undefined,
  };
}

function mockScanLabel(): LabelScanResult {
  const options = [
    {
      composition: '100% Silk',
      fibres: { silk: 100 },
      confidence: 0.97,
      physics: { drape: 0.92, stretch: 0.12, weight: 0.45, stiffness: 0.08, recovery: 0.78 },
      raw_text: 'COMPOSITION: 100% SOIE / SILK\nDRY CLEAN ONLY\nMADE IN FRANCE',
    },
    {
      composition: '95% Cotton, 5% Elastane',
      fibres: { cotton: 95, elastane: 5 },
      confidence: 0.94,
      physics: { drape: 0.55, stretch: 0.72, weight: 0.52, stiffness: 0.28, recovery: 0.88 },
      raw_text: 'FABRIC: 95% COTTON 5% ELASTANE\nMACHINE WASH 30°C\nMade in Portugal',
    },
    {
      composition: '80% Wool, 20% Polyamide',
      fibres: { wool: 80, polyamide: 20 },
      confidence: 0.91,
      physics: { drape: 0.68, stretch: 0.22, weight: 0.78, stiffness: 0.45, recovery: 0.72 },
      raw_text: '80% LAINE / WOOL\n20% POLYAMIDE\nDRY CLEAN / NETTOYAGE À SEC',
    },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function mockGetGarment(ugi: string): Garment {
  const found = MOCK_GARMENTS.find(g => g.ugi === ugi);
  if (found) return found;
  return {
    ugi,
    name: 'Scanned Garment',
    category: 'other',
    status: 'complete',
    created_at: new Date().toISOString(),
    composition: '95% Cotton, 5% Elastane',
    physics: { drape: 0.55, stretch: 0.72, weight: 0.52, stiffness: 0.28, recovery: 0.88 },
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function base64ToBlob(base64: string, contentType: string): Blob {
  const base64Data = base64.replace(/^data:[^;]+;base64,/, '');
  const byteCharacters = atob(base64Data);
  const byteArrays: Uint8Array[] = [];
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }
  return new Blob(byteArrays, { type: contentType });
}
