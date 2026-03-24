import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { TryOnModal } from './components/TryOnModal';
import { TryOnViewer } from './components/TryOnViewer';
import { AvatarCreator } from './components/AvatarCreator';
import { MerchantDashboard } from './components/MerchantDashboard';
import { DemoPage } from './pages/Demo';
import { PitchPage } from './pages/Pitch';
import { AdminDashboard } from './pages/AdminDashboard';

// Simple hash router
function App() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  
  // Listen for hash changes
  React.useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Route matching
  if (route === '#/demo' || route === '#demo') {
    return <DemoPage />;
  }
  
  if (route === '#/dashboard' || route === '#dashboard') {
    return <AdminDashboard shop="charcoal-clothing.myshopify.com" />;
  }
  
  if (route === '#/pitch' || route === '#pitch') {
    return <PitchPage />;
  }

  // Default: Developer preview
  return <DeveloperPreview />;
}

// Demo product for testing
const DEMO_PRODUCT = {
  id: '123456',
  title: 'Charcoal Linen Midi Dress',
  images: [
    'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=600&fit=crop',
  ],
  variants: [
    { id: '1', option1: 'XS', title: 'XS' },
    { id: '2', option1: 'S', title: 'S' },
    { id: '3', option1: 'M', title: 'M' },
    { id: '4', option1: 'L', title: 'L' },
    { id: '5', option1: 'XL', title: 'XL' },
  ],
  loocboocGarmentId: 'garment-123'
};

// Demo avatar
const DEMO_AVATAR = {
  id: 'avatar-1',
  measurements: {
    height: 165,
    bust: 90,
    waist: 70,
    hips: 95
  }
};

function DeveloperPreview() {
  const [showModal, setShowModal] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [avatar, setAvatar] = useState(DEMO_AVATAR);

  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px',
      fontFamily: 'Inter, -apple-system, sans-serif'
    },
    header: {
      textAlign: 'center',
      marginBottom: '60px'
    },
    logo: {
      fontSize: '32px',
      fontWeight: '700',
      letterSpacing: '-1px',
      marginBottom: '8px',
      color: '#3d3129'
    },
    tagline: {
      fontSize: '16px',
      color: '#6b5d4d'
    },
    nav: {
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      marginTop: '24px'
    },
    navLink: {
      padding: '8px 16px',
      background: '#f5f5f5',
      color: '#3d3129',
      textDecoration: 'none',
      fontSize: '13px',
      fontWeight: '600'
    },
    section: {
      marginBottom: '60px'
    },
    sectionTitle: {
      fontSize: '14px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      marginBottom: '24px',
      color: '#8b7355'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
      gap: '24px'
    },
    card: {
      background: '#fff',
      padding: '24px',
      border: '1px solid #e5e0d8'
    },
    cardTitle: {
      fontSize: '18px',
      fontWeight: '600',
      marginBottom: '12px',
      color: '#3d3129'
    },
    cardDesc: {
      fontSize: '14px',
      color: '#6b5d4d',
      marginBottom: '20px',
      lineHeight: '1.6'
    },
    button: {
      padding: '14px 28px',
      background: '#3d3129',
      color: '#fff',
      border: 'none',
      fontSize: '13px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      cursor: 'pointer'
    },
    viewerContainer: {
      background: '#fff',
      padding: '24px',
      border: '1px solid #e5e0d8'
    },
    status: {
      marginTop: '40px',
      padding: '20px',
      background: '#e8f5e9',
      border: '1px solid #c8e6c9'
    },
    statusTitle: {
      fontWeight: '600',
      marginBottom: '8px',
      color: '#2e7d32'
    }
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>LOOCBOOC</div>
        <p style={styles.tagline}>Virtual Try-On Platform</p>
        <nav style={styles.nav}>
          <a style={styles.navLink} href="#/">Developer</a>
          <a style={styles.navLink} href="#/demo">Store Demo</a>
          <a style={styles.navLink} href="#/pitch">Pitch Deck</a>
          <a style={styles.navLink} href="#/dashboard">Dashboard</a>
        </nav>
      </header>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Development Preview</h2>
        <div style={styles.grid}>
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Try-On Modal</h3>
            <p style={styles.cardDesc}>
              The full try-on experience as it will appear on product pages.
              Includes avatar creation, 3D viewer, and fit analysis.
            </p>
            <button style={styles.button} onClick={() => setShowModal(true)}>
              Open Try-On
            </button>
          </div>

          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Avatar Creator</h3>
            <p style={styles.cardDesc}>
              Standalone avatar creation flow. Supports quiz, manual measurements,
              and photo upload.
            </p>
            <button style={styles.button} onClick={() => setShowCreator(true)}>
              Create Avatar
            </button>
          </div>
        </div>
      </section>

      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>3D Viewer Component</h2>
        <div style={styles.viewerContainer}>
          <TryOnViewer
            avatar={{ measurements: avatar.measurements }}
            garment={{ properties: { category: 'dress', fit: 'regular' } }}
            size="M"
            color="#2d2519"
            style={{ height: '400px' }}
          />
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b5d4d', textAlign: 'center' }}>
            Drag to rotate • Scroll to zoom • Parametric body model
          </p>
        </div>
      </section>

      <section style={styles.status}>
        <div style={styles.statusTitle}>✓ API Status: Running</div>
        <p style={{ fontSize: '14px', color: '#2e7d32' }}>
          Backend is live at localhost:3000. Database pending Supabase setup.
        </p>
      </section>

      {/* Modals */}
      <TryOnModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        product={DEMO_PRODUCT}
        avatar={avatar}
        onAvatarCreated={setAvatar}
        apiBaseUrl="http://localhost:3000/api"
      />

      {showCreator && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }} onClick={() => setShowCreator(false)}>
          <div style={{ background: '#fff', maxWidth: '500px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <AvatarCreator
              onSave={async (data) => {
                console.log('Avatar data:', data);
                setAvatar({ id: 'new', ...data });
                setShowCreator(false);
              }}
              onCancel={() => setShowCreator(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
