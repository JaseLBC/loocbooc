/**
 * Admin Dashboard - Shopify-style merchant admin
 * Uses Polaris-inspired design language
 */

import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export function AdminDashboard({ shop = 'charcoal-clothing.myshopify.com' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [roiParams, setRoiParams] = useState({
    monthlyOrders: 2000,
    averageOrderValue: 150
  });
  const [roiResult, setRoiResult] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, [shop, dateRange]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchant/dashboard/${shop}`);
      const result = await res.json();
      setData(result);
      setRoiResult(result.projectedROI);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateROI = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/merchant/roi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roiParams)
      });
      const result = await res.json();
      setRoiResult(result.roi);
    } catch (err) {
      console.error('ROI calculation failed:', err);
    }
  };

  const styles = {
    page: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "San Francisco", "Segoe UI", Roboto, sans-serif',
      background: '#f4f6f8',
      minHeight: '100vh'
    },
    header: {
      background: '#1a1a1a',
      padding: '16px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px'
    },
    logo: {
      color: '#fff',
      fontSize: '18px',
      fontWeight: '600'
    },
    shopName: {
      color: 'rgba(255,255,255,0.7)',
      fontSize: '14px'
    },
    content: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '24px'
    },
    pageTitle: {
      fontSize: '24px',
      fontWeight: '600',
      color: '#1a1a1a',
      marginBottom: '24px'
    },
    card: {
      background: '#fff',
      borderRadius: '8px',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.1)',
      marginBottom: '16px'
    },
    cardHeader: {
      padding: '16px 20px',
      borderBottom: '1px solid #e1e3e5',
      fontWeight: '600',
      fontSize: '16px'
    },
    cardBody: {
      padding: '20px'
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '16px'
    },
    metric: {
      textAlign: 'center',
      padding: '16px'
    },
    metricValue: {
      fontSize: '32px',
      fontWeight: '600',
      color: '#1a1a1a'
    },
    metricLabel: {
      fontSize: '13px',
      color: '#6d7175',
      marginTop: '4px'
    },
    metricTrend: (positive) => ({
      fontSize: '12px',
      color: positive ? '#007f5f' : '#d72c0d',
      marginTop: '4px'
    }),
    tabs: {
      display: 'flex',
      gap: '4px',
      marginBottom: '16px'
    },
    tab: (active) => ({
      padding: '8px 16px',
      border: '1px solid #c9cccf',
      background: active ? '#fff' : 'transparent',
      color: active ? '#1a1a1a' : '#6d7175',
      fontSize: '14px',
      fontWeight: '500',
      borderRadius: '4px',
      cursor: 'pointer'
    }),
    input: {
      padding: '10px 12px',
      border: '1px solid #c9cccf',
      borderRadius: '4px',
      fontSize: '14px',
      width: '100%'
    },
    inputGroup: {
      marginBottom: '16px'
    },
    inputLabel: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '500',
      color: '#1a1a1a',
      marginBottom: '4px'
    },
    button: (primary) => ({
      padding: '10px 20px',
      background: primary ? '#008060' : '#fff',
      color: primary ? '#fff' : '#1a1a1a',
      border: primary ? 'none' : '1px solid #c9cccf',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    }),
    roiHighlight: {
      background: 'linear-gradient(135deg, #008060 0%, #006e52 100%)',
      color: '#fff',
      padding: '24px',
      borderRadius: '8px',
      textAlign: 'center'
    },
    roiValue: {
      fontSize: '48px',
      fontWeight: '700'
    },
    roiLabel: {
      fontSize: '14px',
      opacity: 0.8,
      marginTop: '8px'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse'
    },
    th: {
      textAlign: 'left',
      padding: '12px 16px',
      borderBottom: '1px solid #e1e3e5',
      fontSize: '13px',
      fontWeight: '600',
      color: '#6d7175'
    },
    td: {
      padding: '12px 16px',
      borderBottom: '1px solid #f4f6f8',
      fontSize: '14px'
    },
    badge: (type) => ({
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '12px',
      fontWeight: '500',
      background: type === 'success' ? '#aee9d1' : type === 'warning' ? '#ffea8a' : '#ffc3b6',
      color: type === 'success' ? '#004d3d' : type === 'warning' ? '#7d5200' : '#990000'
    }),
    loading: {
      textAlign: 'center',
      padding: '60px',
      color: '#6d7175'
    }
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <header style={styles.header}>
          <span style={styles.logo}>Loocbooc</span>
          <span style={styles.shopName}>{shop}</span>
        </header>
        <div style={styles.content}>
          <div style={styles.loading}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  const analytics = data?.analytics || {};
  const funnel = analytics.conversionFunnel || {};

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <span style={styles.logo}>Loocbooc</span>
        <span style={styles.shopName}>{shop}</span>
      </header>

      <div style={styles.content}>
        <h1 style={styles.pageTitle}>Dashboard</h1>

        {/* Date range */}
        <div style={styles.tabs}>
          {['24h', '7d', '30d', '90d'].map(range => (
            <button
              key={range}
              style={styles.tab(dateRange === range)}
              onClick={() => setDateRange(range)}
            >
              {range === '24h' ? 'Today' : range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
            </button>
          ))}
        </div>

        {/* Key metrics */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>Performance</div>
          <div style={styles.cardBody}>
            <div style={styles.grid}>
              <div style={styles.metric}>
                <div style={styles.metricValue}>{analytics.totalEvents || 0}</div>
                <div style={styles.metricLabel}>Total Events</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricValue}>{analytics.uniqueUsers || 0}</div>
                <div style={styles.metricLabel}>Unique Users</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricValue}>{funnel.avatarCreated || 0}</div>
                <div style={styles.metricLabel}>Avatars Created</div>
              </div>
              <div style={styles.metric}>
                <div style={styles.metricValue}>{funnel.addToCartFromTryon || 0}</div>
                <div style={styles.metricLabel}>Try-On → Cart</div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion funnel */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>Conversion Funnel</div>
          <div style={styles.cardBody}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Step</th>
                  <th style={styles.th}>Count</th>
                  <th style={styles.th}>Conversion</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={styles.td}>Button Clicks</td>
                  <td style={styles.td}>{funnel.buttonClicks || 0}</td>
                  <td style={styles.td}>—</td>
                </tr>
                <tr>
                  <td style={styles.td}>Modal Opens</td>
                  <td style={styles.td}>{funnel.modalOpens || 0}</td>
                  <td style={styles.td}>
                    {funnel.buttonClicks ? `${Math.round(funnel.modalOpens / funnel.buttonClicks * 100)}%` : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={styles.td}>Avatar Created</td>
                  <td style={styles.td}>{funnel.avatarCreated || 0}</td>
                  <td style={styles.td}>
                    {funnel.modalOpens ? `${Math.round(funnel.avatarCreated / funnel.modalOpens * 100)}%` : '—'}
                  </td>
                </tr>
                <tr>
                  <td style={styles.td}>Added to Cart</td>
                  <td style={styles.td}>{funnel.addToCartFromTryon || 0}</td>
                  <td style={styles.td}>
                    {funnel.avatarCreated ? `${Math.round(funnel.addToCartFromTryon / funnel.avatarCreated * 100)}%` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ROI Calculator */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>ROI Calculator</div>
          <div style={styles.cardBody}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
              <div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Monthly Orders</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={roiParams.monthlyOrders}
                    onChange={(e) => setRoiParams({ ...roiParams, monthlyOrders: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Average Order Value ($)</label>
                  <input
                    type="number"
                    style={styles.input}
                    value={roiParams.averageOrderValue}
                    onChange={(e) => setRoiParams({ ...roiParams, averageOrderValue: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <button style={styles.button(true)} onClick={calculateROI}>
                  Calculate ROI
                </button>
              </div>
              
              {roiResult && (
                <>
                  <div>
                    <h4 style={{ marginBottom: '16px', fontWeight: '600' }}>Without Loocbooc</h4>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#6d7175' }}>Monthly Returns: </span>
                      <strong>{roiResult.current.monthlyReturns.toLocaleString()}</strong>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: '#6d7175' }}>Return Rate: </span>
                      <strong>{roiResult.current.returnRate}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#6d7175' }}>Monthly Cost: </span>
                      <strong>${roiResult.current.monthlyReturnCosts.toLocaleString()}</strong>
                    </div>
                  </div>
                  
                  <div style={styles.roiHighlight}>
                    <div style={styles.roiValue}>
                      ${roiResult.savings.totalAnnualBenefit.toLocaleString()}
                    </div>
                    <div style={styles.roiLabel}>Annual Benefit</div>
                    <div style={{ marginTop: '16px', fontSize: '14px' }}>
                      {roiResult.roi.monthlyROI} monthly ROI
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
