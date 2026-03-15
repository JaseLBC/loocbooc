# Loocbooc Scanner — iOS App

The brand-facing scanning app for Loocbooc. Scan garments for 3D reconstruction and care labels for fabric physics extraction.

## Quick Start (Expo Go)

1. **Install Expo Go** on your iPhone (App Store — search "Expo Go")
2. **Install dependencies:**
   ```bash
   cd packages/mobile
   npm install
   ```
3. **Start the dev server:**
   ```bash
   npx expo start
   ```
4. **Scan the QR code** with your iPhone camera (iOS 16+) or the Expo Go app

> **Tip:** Use `npx expo start --tunnel` if your phone and computer are on different networks.

## What's in the App

### 📸 Garment Scanner
- Full-screen camera with scanning overlay
- 60-second capture session at 2fps
- Real-time quality indicators (lighting, motion, frame coverage)
- IMU data capture (gyroscope for camera orientation)
- Upload to Loocbooc API → 3D model generation
- Progress ring with pipeline stage display
- Mock mode for offline demo (30-second simulated processing)

### 🏷️ Label Scanner
- Photo capture for care labels
- Sends to Loocbooc OCR API (Claude vision)
- Animated reveal of fabric composition
- Physics parameters displayed as animated bars:
  - Drape, Stretch, Weight, Stiffness, Recovery
- Mock mode returns realistic random fabric results

### 🗂️ Garment Detail
- Physics-accurate parameters
- UGI (Universal Garment Identifier) displayed + tap to copy
- 3D model viewer (WebView — full Three.js viewer in production build)
- Virtual try-on placeholder

## Configuration

Set the API URL in a `.env` file:
```
EXPO_PUBLIC_API_URL=http://your-server:8000
EXPO_PUBLIC_DEMO_MODE=true  # Force mock mode
```

When `EXPO_PUBLIC_API_URL` is not set, defaults to `http://localhost:8000`.

Every API call has a mock fallback — the app is fully demoable offline.

## Tech Stack

- **Expo SDK 51** — managed workflow, no Xcode needed
- **expo-camera** — camera capture and frames
- **expo-sensors** — gyroscope IMU data
- **Expo Router** — file-based navigation
- **Zustand** — global state
- **React Query** — API data fetching
- **React Native Reanimated** — smooth animations
- **react-native-webview** — 3D model viewer

## Expo Go Compatibility

✅ All features work in Expo Go without a custom build.

Features that require a custom build (EAS Build or Xcode):
- **LiDAR depth capture** — iPhone Pro 12+ millimetre depth maps
- **Background frame processing** — beyond Expo Go's sandbox limits
- **Push notifications** for scan completion

## API Endpoints Used

```
POST /api/v1/garments              — Create garment, get UGI
POST /api/v1/garments/{ugi}/files  — Upload scan frames
GET  /api/v1/garments/{ugi}/scan/status — Poll processing progress
POST /api/v1/scan/label            — OCR care label
GET  /api/v1/garments/{ugi}        — Fetch garment details
```

## Development Notes

### Running on device vs simulator
- Simulator: Camera works in simulator but returns black frames on some machines
- Device via Expo Go: Full camera functionality including LiDAR detection

### Frame capture
Currently captures 2fps using `takePictureAsync` with quality 0.4. 
This generates ~7MB per minute of scanning. For production, consider:
- Video recording + frame extraction server-side
- Adaptive quality based on available storage
- Local caching before upload

### LiDAR note
LiDAR is not accessible via expo-camera in managed workflow. Detected via `Platform.OS` + device model string. Falls back gracefully to standard RGB capture on all devices.
