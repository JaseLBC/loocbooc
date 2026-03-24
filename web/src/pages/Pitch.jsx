/**
 * Pitch Page - Investor/CTO Demo Landing
 * Shows Loocbooc value proposition with live demos
 */

import React, { useState, useEffect } from 'react';
import { TryOnViewer } from '../components/TryOnViewer';

export function PitchPage() {
  const [roiData, setRoiData] = useState(null);
  const [activeSection, setActiveSection] = useState('hero');

  useEffect(() => {
    // Fetch example ROI calculation
    fetch('/api/merchant/roi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        monthlyOrders: 5000,
        averageOrderValue: 120
      })
    })
      .then(r => r.json())
      .then(data => setRoiData(data.roi))
      .catch(console.error);
  }, []);

  const styles = {
    page: {
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#fff',
      color: '#1a1a1a'
    },
    section: {
      minHeight: '100vh',
      padding: '80px 40px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    hero: {
      textAlign: 'center',
      background: 'linear-gradient(180deg, #f8f7f5 0%, #fff 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40px'
    },
    logo: {
      fontSize: '14px',
      fontWeight: '700',
      letterSpacing: '4px',
      color: '#8b7355',
      marginBottom: '40px'
    },
    headline: {
      fontSize: '56px',
      fontWeight: '700',
      lineHeight: '1.1',
      marginBottom: '24px',
      color: '#1a1a1a'
    },
    subheadline: {
      fontSize: '24px',
      fontWeight: '400',
      color: '#6b5d4d',
      marginBottom: '48px',
      maxWidth: '600px'
    },
    statGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '40px',
      marginTop: '80px'
    },
    stat: {
      textAlign: 'center'
    },
    statValue: {
      fontSize: '48px',
      fontWeight: '700',
      color: '#3d3129'
    },
    statLabel: {
      fontSize: '14px',
      color: '#8b7355',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginTop: '8px'
    },
    sectionTitle: {
      fontSize: '40px',
      fontWeight: '700',
      marginBottom: '16px'
    },
    sectionSubtitle: {
      fontSize: '18px',
      color: '#6b5d4d',
      marginBottom: '48px',
      maxWidth: '600px'
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '60px',
      alignItems: 'center'
    },
    featureCard: {
      padding: '32px',
      background: '#f8f7f5',
      marginBottom: '24px'
    },
    featureTitle: {
      fontSize: '20px',
      fontWeight: '600',
      marginBottom: '12px'
    },
    featureDesc: {
      fontSize: '15px',
      color: '#6b5d4d',
      lineHeight: '1.6'
    },
    roiCard: {
      background: '#3d3129',
      color: '#fff',
      padding: '48px',
      textAlign: 'center'
    },
    roiTitle: {
      fontSize: '14px',
      textTransform: 'uppercase',
      letterSpacing: '2px',
      opacity: 0.7,
      marginBottom: '16px'
    },
    roiValue: {
      fontSize: '64px',
      fontWeight: '700'
    },
    roiDesc: {
      fontSize: '16px',
      opacity: 0.8,
      marginTop: '16px'
    },
    comparisonGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '0'
    },
    comparisonCol: (highlight) => ({
      padding: '40px',
      background: highlight ? '#3d3129' : '#f8f7f5',
      color: highlight ? '#fff' : '#1a1a1a'
    }),
    comparisonTitle: {
      fontSize: '14px',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '32px',
      opacity: 0.7
    },
    comparisonRow: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '16px 0',
      borderTop: '1px solid rgba(0,0,0,0.1)'
    },
    cta: {
      textAlign: 'center',
      padding: '120px 40px',
      background: '#f8f7f5'
    },
    ctaButton: {
      padding: '20px 48px',
      background: '#3d3129',
      color: '#fff',
      border: 'none',
      fontSize: '16px',
      fontWeight: '600',
      letterSpacing: '1px',
      cursor: 'pointer'
    },
    viewerSection: {
      padding: '80px 40px',
      background: '#1a1a1a'
    },
    viewerContainer: {
      maxWidth: '800px',
      margin: '0 auto'
    }
  };

  return (
    <div style={styles.page}>
      {/* Hero */}
      <section style={styles.hero}>
        <div style={styles.logo}>LOOCBOOC</div>
        <h1 style={styles.headline}>
          See Clothes on<br />Your Body
        </h1>
        <p style={styles.subheadline}>
          Create your avatar once. Try on any garment. Works everywhere.
        </p>
        
        <div style={styles.statGrid}>
          <div style={styles.stat}>
            <div style={styles.statValue}>35%</div>
            <div style={styles.statLabel}>Fashion Return Rate</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>60%</div>
            <div style={styles.statLabel}>Returns Due to Fit</div>
          </div>
          <div style={styles.stat}>
            <div style={styles.statValue}>$550B</div>
            <div style={styles.statLabel}>Global Fashion E-comm</div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>The Problem</h2>
        <p style={styles.sectionSubtitle}>
          Online fashion is broken. Customers can't see how clothes fit their body.
        </p>
        
        <div style={styles.grid2}>
          <div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>❌ Model photos don't help</div>
              <div style={styles.featureDesc}>
                A size M on a 5'10" model looks nothing like a size M on a 5'4" customer.
              </div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>❌ Size guides are confusing</div>
              <div style={styles.featureDesc}>
                Most customers don't know their measurements. Those who do, find size charts inconsistent.
              </div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>❌ Returns kill margins</div>
              <div style={styles.featureDesc}>
                Processing a return costs $15-30. At 35% return rates, it's unsustainable.
              </div>
            </div>
          </div>
          <div>
            {roiData && (
              <div style={styles.roiCard}>
                <div style={styles.roiTitle}>Annual Return Costs</div>
                <div style={styles.roiValue}>
                  ${(roiData.current.monthlyReturnCosts * 12).toLocaleString()}
                </div>
                <div style={styles.roiDesc}>
                  For a brand with {(5000).toLocaleString()} monthly orders
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>The Solution</h2>
        <p style={styles.sectionSubtitle}>
          A personal avatar that shows how ANY garment looks on YOUR body.
        </p>
        
        <div style={styles.grid2}>
          <div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>✓ Create once, use everywhere</div>
              <div style={styles.featureDesc}>
                2-minute setup. Your Loocbooc avatar works across all partner brands.
              </div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>✓ Accurate size recommendations</div>
              <div style={styles.featureDesc}>
                Know your size before you buy. No more guessing.
              </div>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureTitle}>✓ 3D visualization</div>
              <div style={styles.featureDesc}>
                See the garment on your body from every angle. Not a static image.
              </div>
            </div>
          </div>
          <div style={styles.viewerContainer}>
            <TryOnViewer
              avatar={{ measurements: { height: 165, bust: 90, waist: 70, hips: 95 } }}
              garment={{ properties: { category: 'dress', fit: 'regular' } }}
              color="#2d2519"
              style={{ height: '400px', background: '#f5f5f5', borderRadius: '8px' }}
            />
          </div>
        </div>
      </section>

      {/* ROI */}
      {roiData && (
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>The Business Case</h2>
          <p style={styles.sectionSubtitle}>
            Loocbooc pays for itself immediately.
          </p>
          
          <div style={styles.comparisonGrid}>
            <div style={styles.comparisonCol(false)}>
              <div style={styles.comparisonTitle}>Without Loocbooc</div>
              <div style={styles.comparisonRow}>
                <span>Monthly Returns</span>
                <strong>{roiData.current.monthlyReturns.toLocaleString()}</strong>
              </div>
              <div style={styles.comparisonRow}>
                <span>Return Rate</span>
                <strong>{roiData.current.returnRate}</strong>
              </div>
              <div style={styles.comparisonRow}>
                <span>Monthly Cost</span>
                <strong>${roiData.current.monthlyReturnCosts.toLocaleString()}</strong>
              </div>
            </div>
            <div style={styles.comparisonCol(true)}>
              <div style={styles.comparisonTitle}>With Loocbooc</div>
              <div style={styles.comparisonRow}>
                <span>Monthly Returns</span>
                <strong>{roiData.withLoocbooc.monthlyReturns.toLocaleString()}</strong>
              </div>
              <div style={styles.comparisonRow}>
                <span>Return Rate</span>
                <strong>{roiData.withLoocbooc.returnRate}</strong>
              </div>
              <div style={styles.comparisonRow}>
                <span>Annual Savings</span>
                <strong>${roiData.savings.annualSavings.toLocaleString()}</strong>
              </div>
            </div>
          </div>
          
          <div style={{ ...styles.roiCard, marginTop: '40px' }}>
            <div style={styles.roiTitle}>Total Annual Benefit</div>
            <div style={styles.roiValue}>
              ${roiData.savings.totalAnnualBenefit.toLocaleString()}
            </div>
            <div style={styles.roiDesc}>
              Return savings + conversion lift revenue
            </div>
          </div>
        </section>
      )}

      {/* Vision */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>The Vision</h2>
        <p style={styles.sectionSubtitle}>
          The universal standard for the global fashion industry.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
          <div style={styles.featureCard}>
            <div style={styles.featureTitle}>Retailers</div>
            <div style={styles.featureDesc}>
              Reduce returns. Increase conversions. Better customer experience.
            </div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureTitle}>Customers</div>
            <div style={styles.featureDesc}>
              Know your size. See how it looks. Buy with confidence.
            </div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureTitle}>Designers</div>
            <div style={styles.featureDesc}>
              Validate designs before production. Reduce waste.
            </div>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureTitle}>Stylists</div>
            <div style={styles.featureDesc}>
              Style clients remotely. Build looks on their avatar.
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={styles.cta}>
        <h2 style={{ ...styles.sectionTitle, marginBottom: '24px' }}>
          Ready to see it in action?
        </h2>
        <button style={styles.ctaButton} onClick={() => window.location.hash = '#/demo'}>
          Try the Demo
        </button>
      </section>
    </div>
  );
}

export default PitchPage;
