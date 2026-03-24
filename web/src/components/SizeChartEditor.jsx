/**
 * SizeChartEditor - Configure size charts for garments
 * Merchants use this to set up accurate sizing for try-on
 */

import React, { useState } from 'react';

// Standard size templates
const SIZE_TEMPLATES = {
  AU_WOMENS: {
    name: 'Australian Women\'s',
    sizes: {
      '4': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
      '6': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
      '8': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
      '10': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
      '12': { bust: [92, 96], waist: [74, 78], hips: [98, 102] },
      '14': { bust: [96, 100], waist: [78, 82], hips: [102, 106] },
      '16': { bust: [100, 105], waist: [82, 87], hips: [106, 111] },
      '18': { bust: [105, 110], waist: [87, 92], hips: [111, 116] }
    }
  },
  US_WOMENS: {
    name: 'US Women\'s',
    sizes: {
      '0': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
      '2': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
      '4': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
      '6': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
      '8': { bust: [92, 96], waist: [74, 78], hips: [98, 102] },
      '10': { bust: [96, 100], waist: [78, 82], hips: [102, 106] },
      '12': { bust: [100, 105], waist: [82, 87], hips: [106, 111] },
      '14': { bust: [105, 110], waist: [87, 92], hips: [111, 116] }
    }
  },
  XS_XL: {
    name: 'Letter Sizes (XS-XL)',
    sizes: {
      'XXS': { bust: [76, 80], waist: [58, 62], hips: [82, 86] },
      'XS': { bust: [80, 84], waist: [62, 66], hips: [86, 90] },
      'S': { bust: [84, 88], waist: [66, 70], hips: [90, 94] },
      'M': { bust: [88, 92], waist: [70, 74], hips: [94, 98] },
      'L': { bust: [92, 98], waist: [74, 80], hips: [98, 104] },
      'XL': { bust: [98, 104], waist: [80, 86], hips: [104, 110] },
      '2XL': { bust: [104, 110], waist: [86, 92], hips: [110, 116] }
    }
  }
};

export function SizeChartEditor({ initialChart, onChange, onSave }) {
  const [template, setTemplate] = useState('');
  const [sizeChart, setSizeChart] = useState(initialChart || {});
  const [editingSize, setEditingSize] = useState(null);

  const applyTemplate = (templateKey) => {
    if (SIZE_TEMPLATES[templateKey]) {
      setSizeChart(SIZE_TEMPLATES[templateKey].sizes);
      setTemplate(templateKey);
      onChange?.(SIZE_TEMPLATES[templateKey].sizes);
    }
  };

  const updateSize = (size, measurement, minMax, value) => {
    const newChart = { ...sizeChart };
    if (!newChart[size]) newChart[size] = {};
    if (!newChart[size][measurement]) newChart[size][measurement] = [0, 0];
    newChart[size][measurement][minMax] = parseInt(value) || 0;
    setSizeChart(newChart);
    onChange?.(newChart);
  };

  const addSize = (sizeName) => {
    if (!sizeName || sizeChart[sizeName]) return;
    const newChart = {
      ...sizeChart,
      [sizeName]: { bust: [86, 90], waist: [66, 70], hips: [92, 96] }
    };
    setSizeChart(newChart);
    onChange?.(newChart);
  };

  const removeSize = (sizeName) => {
    const newChart = { ...sizeChart };
    delete newChart[sizeName];
    setSizeChart(newChart);
    onChange?.(newChart);
  };

  const styles = {
    container: {
      fontFamily: 'Inter, -apple-system, sans-serif'
    },
    section: {
      marginBottom: '24px'
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '8px'
    },
    select: {
      padding: '10px 12px',
      border: '1px solid #d9d5ce',
      borderRadius: '4px',
      fontSize: '14px',
      width: '100%',
      background: '#fff'
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '16px'
    },
    th: {
      textAlign: 'left',
      padding: '12px 8px',
      borderBottom: '2px solid #e5e0d8',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: '#6b5d4d'
    },
    td: {
      padding: '8px',
      borderBottom: '1px solid #f5f5f5'
    },
    input: {
      padding: '8px',
      border: '1px solid #d9d5ce',
      borderRadius: '4px',
      fontSize: '14px',
      width: '60px',
      textAlign: 'center'
    },
    sizeLabel: {
      fontWeight: '600',
      color: '#3d3129'
    },
    range: {
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },
    rangeSep: {
      color: '#8b7355'
    },
    removeBtn: {
      background: 'none',
      border: 'none',
      color: '#d72c0d',
      cursor: 'pointer',
      fontSize: '18px',
      padding: '4px'
    },
    addRow: {
      marginTop: '16px',
      display: 'flex',
      gap: '8px'
    },
    addInput: {
      padding: '10px',
      border: '1px solid #d9d5ce',
      borderRadius: '4px',
      fontSize: '14px',
      width: '100px'
    },
    button: (primary) => ({
      padding: '10px 20px',
      background: primary ? '#3d3129' : '#fff',
      color: primary ? '#fff' : '#3d3129',
      border: primary ? 'none' : '1px solid #d9d5ce',
      borderRadius: '4px',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer'
    }),
    hint: {
      fontSize: '12px',
      color: '#8b7355',
      marginTop: '8px'
    }
  };

  const sizes = Object.keys(sizeChart);
  const [newSizeName, setNewSizeName] = useState('');

  return (
    <div style={styles.container}>
      {/* Template selector */}
      <div style={styles.section}>
        <label style={styles.label}>Start from template</label>
        <select 
          style={styles.select}
          value={template}
          onChange={(e) => applyTemplate(e.target.value)}
        >
          <option value="">Select a template...</option>
          {Object.entries(SIZE_TEMPLATES).map(([key, val]) => (
            <option key={key} value={key}>{val.name}</option>
          ))}
        </select>
        <p style={styles.hint}>
          Templates provide standard measurements. Customize below to match your garment's actual sizing.
        </p>
      </div>

      {/* Size chart table */}
      {sizes.length > 0 && (
        <div style={styles.section}>
          <label style={styles.label}>Size Chart (measurements in cm)</label>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Size</th>
                <th style={styles.th}>Bust Range</th>
                <th style={styles.th}>Waist Range</th>
                <th style={styles.th}>Hips Range</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {sizes.map(size => (
                <tr key={size}>
                  <td style={{ ...styles.td, ...styles.sizeLabel }}>{size}</td>
                  <td style={styles.td}>
                    <div style={styles.range}>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.bust?.[0] || ''}
                        onChange={(e) => updateSize(size, 'bust', 0, e.target.value)}
                      />
                      <span style={styles.rangeSep}>–</span>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.bust?.[1] || ''}
                        onChange={(e) => updateSize(size, 'bust', 1, e.target.value)}
                      />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.range}>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.waist?.[0] || ''}
                        onChange={(e) => updateSize(size, 'waist', 0, e.target.value)}
                      />
                      <span style={styles.rangeSep}>–</span>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.waist?.[1] || ''}
                        onChange={(e) => updateSize(size, 'waist', 1, e.target.value)}
                      />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.range}>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.hips?.[0] || ''}
                        onChange={(e) => updateSize(size, 'hips', 0, e.target.value)}
                      />
                      <span style={styles.rangeSep}>–</span>
                      <input
                        type="number"
                        style={styles.input}
                        value={sizeChart[size]?.hips?.[1] || ''}
                        onChange={(e) => updateSize(size, 'hips', 1, e.target.value)}
                      />
                    </div>
                  </td>
                  <td style={styles.td}>
                    <button 
                      style={styles.removeBtn}
                      onClick={() => removeSize(size)}
                      title="Remove size"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add size */}
      <div style={styles.addRow}>
        <input
          type="text"
          style={styles.addInput}
          placeholder="Size name"
          value={newSizeName}
          onChange={(e) => setNewSizeName(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              addSize(newSizeName);
              setNewSizeName('');
            }
          }}
        />
        <button 
          style={styles.button(false)}
          onClick={() => {
            addSize(newSizeName);
            setNewSizeName('');
          }}
        >
          Add Size
        </button>
      </div>

      {/* Save button */}
      {onSave && (
        <div style={{ marginTop: '24px' }}>
          <button style={styles.button(true)} onClick={() => onSave(sizeChart)}>
            Save Size Chart
          </button>
        </div>
      )}
    </div>
  );
}

export default SizeChartEditor;
