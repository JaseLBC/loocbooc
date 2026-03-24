/**
 * MerchantDashboard - Admin view for brands using Loocbooc
 * Shows conversion metrics, try-on engagement, size insights
 */

import React, { useState, useEffect } from 'react';

export function MerchantDashboard({ shop, apiBaseUrl = '/api' }) {
  const [metrics, setMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    loadData();
  }, [shop, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, analyticsRes] = await Promise.all([
        fetch(`${apiBaseUrl}/analytics/shop/${shop}/conversion`),
        fetch(`${apiBaseUrl}/analytics/shop/${shop}`)
      ]);
      
      const metricsData = await metricsRes.json();
      const analyticsData = await analyticsRes.json();
      
      setMetrics(metricsData.metrics);
      setAnalytics(analyticsData.analytics);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, sans-serif',
      padding: '32px',
      maxWidth: '1200px',
      margin: '0 auto'
    },
    header: {
      marginBottom: '32px'
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#3d3129',
      marginBottom: '8px'
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b5d4d'
    },
    controls: {
      display: 'flex',
      gap: '8px',
      marginBottom: '32px'
    },
    dateButton: (active) => ({
      padding: '8px 16px',
      border: '1px solid #d9d5ce',
      background: active ? '#3d3129' : '#fff',
      color: active ? '#fff' : '#3d3129',
      fontSize: '13px',
      fontWeight: '600',
      cursor: 'pointer'
    }),
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '20px',
      marginBottom: '32px'
    },
    metricCard: {
      background: '#fff',
      padding: '24px',
      border: '1px solid #e5e0d8'
    },
    metricLabel: {
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: '#8b7355',
      marginBottom: '8px'
    },
    metricValue: {
      fontSize: '36px',
      fontWeight: '700',
      color: '#3d3129'
    },
    metricSubtext: {
      fontSize: '13px',
      color: '#6b5d4d',
      marginTop: '8px'
    },
    section: {
      marginBottom: '32px'
    },
    sectionTitle: {
      fontSize: '16px',
      fontWeight: '700',
      color: '#3d3129',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '1px solid #e5e0d8'
    },
    funnelContainer: {
      background: '#fff',
      padding: '24px',
      border: '1px solid #e5e0d8'
    },
    funnelStep: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: '16px'
    },
    funnelBar: (width) => ({
      height: '32px',
      background: '#3d3129',
      width: `${width}%`,
      minWidth: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingRight: '12px',
      color: '#fff',
      fontSize: '13px',
      fontWeight: '600'
    }),
    funnelLabel: {
      marginLeft: '16px',
      fontSize: '14px',
      color: '#3d3129'
    },
    loading: {
      textAlign: 'center',
      padding: '60px',
      color: '#6b5d4d'
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  const funnel = analytics?.conversionFunnel || {};
  const maxFunnel = Math.max(
    funnel.buttonClicks || 0,
    funnel.modalOpens || 0,
    funnel.avatarCreated || 0,
    funnel.addToCartFromTryon || 0,
    1
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Loocbooc Dashboard</h1>
        <p style={styles.subtitle}>{shop}</p>
      </div>

      {/* Date range controls */}
      <div style={styles.controls}>
        {['24h', '7d', '30d', '90d'].map(range => (
          <button
            key={range}
            style={styles.dateButton(dateRange === range)}
            onClick={() => setDateRange(range)}
          >
            {range === '24h' ? 'Today' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
          </button>
        ))}
      </div>

      {/* Key metrics */}
      <div style={styles.grid}>
        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Try-On Rate</div>
          <div style={styles.metricValue}>{metrics?.tryOnRate || 'N/A'}</div>
          <div style={styles.metricSubtext}>Visitors who completed try-on</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Try-On → Cart</div>
          <div style={styles.metricValue}>{metrics?.tryOnToCartRate || 'N/A'}</div>
          <div style={styles.metricSubtext}>Try-on users who added to cart</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Conversion Lift</div>
          <div style={styles.metricValue}>{metrics?.tryOnLift || 'N/A'}</div>
          <div style={styles.metricSubtext}>vs non-try-on visitors</div>
        </div>

        <div style={styles.metricCard}>
          <div style={styles.metricLabel}>Avatars Created</div>
          <div style={styles.metricValue}>{funnel.avatarCreated || 0}</div>
          <div style={styles.metricSubtext}>Active try-on users</div>
        </div>
      </div>

      {/* Conversion funnel */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Try-On Funnel</h2>
        <div style={styles.funnelContainer}>
          <div style={styles.funnelStep}>
            <div style={styles.funnelBar((funnel.buttonClicks / maxFunnel) * 100)}>
              {funnel.buttonClicks || 0}
            </div>
            <span style={styles.funnelLabel}>Button Clicks</span>
          </div>

          <div style={styles.funnelStep}>
            <div style={styles.funnelBar((funnel.modalOpens / maxFunnel) * 100)}>
              {funnel.modalOpens || 0}
            </div>
            <span style={styles.funnelLabel}>Modal Opens</span>
          </div>

          <div style={styles.funnelStep}>
            <div style={styles.funnelBar((funnel.avatarCreated / maxFunnel) * 100)}>
              {funnel.avatarCreated || 0}
            </div>
            <span style={styles.funnelLabel}>Avatars Created</span>
          </div>

          <div style={styles.funnelStep}>
            <div style={styles.funnelBar((funnel.sizeSelected / maxFunnel) * 100)}>
              {funnel.sizeSelected || 0}
            </div>
            <span style={styles.funnelLabel}>Size Selected</span>
          </div>

          <div style={styles.funnelStep}>
            <div style={styles.funnelBar((funnel.addToCartFromTryon / maxFunnel) * 100)}>
              {funnel.addToCartFromTryon || 0}
            </div>
            <span style={styles.funnelLabel}>Added to Cart</span>
          </div>
        </div>
      </div>

      {/* Event breakdown */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Event Summary</h2>
        <div style={styles.grid}>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Total Events</div>
            <div style={styles.metricValue}>{analytics?.totalEvents || 0}</div>
          </div>
          <div style={styles.metricCard}>
            <div style={styles.metricLabel}>Unique Users</div>
            <div style={styles.metricValue}>{analytics?.uniqueUsers || 0}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MerchantDashboard;
