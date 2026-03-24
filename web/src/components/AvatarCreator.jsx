/**
 * AvatarCreator - Component for creating/editing avatar
 * Supports manual measurements and photo upload
 */

import React, { useState } from 'react';

export function AvatarCreator({ onSave, onCancel, initialData }) {
  const [mode, setMode] = useState('measurements'); // 'measurements' | 'photos'
  const [measurements, setMeasurements] = useState(initialData?.measurements || {
    height: '',
    weight: '',
    bust: '',
    waist: '',
    hips: '',
    inseam: '',
    shoulders: '',
    armLength: ''
  });
  const [bodyType, setBodyType] = useState(initialData?.bodyType || '');
  const [photos, setPhotos] = useState({ front: null, side: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleMeasurementChange = (field, value) => {
    setMeasurements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePhotoUpload = (type, file) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotos(prev => ({
        ...prev,
        [type]: e.target.result
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = mode === 'measurements' 
        ? { measurements, bodyType, source: 'measurements' }
        : { photos, measurements, source: 'photos' };
      
      await onSave(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isValid = () => {
    if (mode === 'measurements') {
      return measurements.height && measurements.bust && measurements.waist && measurements.hips;
    } else {
      return photos.front && photos.side;
    }
  };

  const styles = {
    container: {
      fontFamily: 'Inter, sans-serif',
      padding: '24px',
      maxWidth: '500px'
    },
    title: {
      fontSize: '24px',
      fontWeight: '700',
      marginBottom: '8px',
      color: '#3d3129'
    },
    subtitle: {
      fontSize: '14px',
      color: '#6b5d4d',
      marginBottom: '24px'
    },
    tabs: {
      display: 'flex',
      gap: '8px',
      marginBottom: '24px'
    },
    tab: (active) => ({
      padding: '12px 24px',
      border: 'none',
      background: active ? '#3d3129' : '#e5e0d8',
      color: active ? '#e5e0d8' : '#3d3129',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s'
    }),
    fieldGroup: {
      marginBottom: '16px'
    },
    label: {
      display: 'block',
      fontSize: '12px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      color: '#6b5d4d',
      marginBottom: '6px'
    },
    input: {
      width: '100%',
      padding: '12px',
      border: '1px solid #d9d5ce',
      fontSize: '16px',
      fontFamily: 'inherit',
      outline: 'none',
      boxSizing: 'border-box'
    },
    row: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px'
    },
    uploadBox: {
      border: '2px dashed #d9d5ce',
      padding: '40px',
      textAlign: 'center',
      cursor: 'pointer',
      marginBottom: '16px',
      transition: 'all 0.2s'
    },
    uploadedImage: {
      width: '100%',
      height: '200px',
      objectFit: 'cover',
      marginBottom: '16px'
    },
    button: (primary) => ({
      padding: '14px 28px',
      border: 'none',
      background: primary ? '#3d3129' : 'transparent',
      color: primary ? '#e5e0d8' : '#3d3129',
      fontSize: '14px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      cursor: 'pointer',
      marginRight: '12px'
    }),
    error: {
      background: '#fee',
      color: '#c00',
      padding: '12px',
      marginBottom: '16px',
      fontSize: '14px'
    },
    hint: {
      fontSize: '12px',
      color: '#8b7355',
      marginTop: '4px'
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Create Your Avatar</h2>
      <p style={styles.subtitle}>
        Your measurements are saved to your Loocbooc account and work across all brands.
      </p>
      
      {/* Mode tabs */}
      <div style={styles.tabs}>
        <button 
          style={styles.tab(mode === 'measurements')}
          onClick={() => setMode('measurements')}
        >
          Enter Measurements
        </button>
        <button 
          style={styles.tab(mode === 'photos')}
          onClick={() => setMode('photos')}
        >
          Upload Photos
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {mode === 'measurements' ? (
        <>
          {/* Height & Weight */}
          <div style={styles.row}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Height (cm) *</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.height}
                onChange={(e) => handleMeasurementChange('height', e.target.value)}
                placeholder="165"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Weight (kg)</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.weight}
                onChange={(e) => handleMeasurementChange('weight', e.target.value)}
                placeholder="60"
              />
            </div>
          </div>
          
          {/* Bust, Waist, Hips */}
          <div style={styles.row}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Bust (cm) *</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.bust}
                onChange={(e) => handleMeasurementChange('bust', e.target.value)}
                placeholder="90"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Waist (cm) *</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.waist}
                onChange={(e) => handleMeasurementChange('waist', e.target.value)}
                placeholder="70"
              />
            </div>
          </div>
          
          <div style={styles.row}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Hips (cm) *</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.hips}
                onChange={(e) => handleMeasurementChange('hips', e.target.value)}
                placeholder="95"
              />
            </div>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Inseam (cm)</label>
              <input
                type="number"
                style={styles.input}
                value={measurements.inseam}
                onChange={(e) => handleMeasurementChange('inseam', e.target.value)}
                placeholder="76"
              />
            </div>
          </div>
          
          {/* Body Type */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Body Type (optional)</label>
            <select
              style={styles.input}
              value={bodyType}
              onChange={(e) => setBodyType(e.target.value)}
            >
              <option value="">Select...</option>
              <option value="hourglass">Hourglass</option>
              <option value="pear">Pear</option>
              <option value="apple">Apple</option>
              <option value="rectangle">Rectangle</option>
              <option value="inverted-triangle">Inverted Triangle</option>
            </select>
            <p style={styles.hint}>Helps us create a more accurate avatar</p>
          </div>
        </>
      ) : (
        <>
          {/* Photo upload */}
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Front Photo *</label>
            {photos.front ? (
              <img src={photos.front} alt="Front" style={styles.uploadedImage} />
            ) : (
              <div 
                style={styles.uploadBox}
                onClick={() => document.getElementById('front-photo').click()}
              >
                <p>Click to upload front-facing photo</p>
                <p style={styles.hint}>Stand straight, arms slightly away from body</p>
              </div>
            )}
            <input
              id="front-photo"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhotoUpload('front', e.target.files[0])}
            />
          </div>
          
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Side Photo *</label>
            {photos.side ? (
              <img src={photos.side} alt="Side" style={styles.uploadedImage} />
            ) : (
              <div 
                style={styles.uploadBox}
                onClick={() => document.getElementById('side-photo').click()}
              >
                <p>Click to upload side-facing photo</p>
                <p style={styles.hint}>Stand straight, profile view</p>
              </div>
            )}
            <input
              id="side-photo"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handlePhotoUpload('side', e.target.files[0])}
            />
          </div>
          
          <p style={styles.hint}>
            Photos are processed securely and used only to estimate your measurements.
            For best results, wear form-fitting clothing.
          </p>
        </>
      )}
      
      {/* Actions */}
      <div style={{ marginTop: '24px' }}>
        <button 
          style={styles.button(true)}
          onClick={handleSubmit}
          disabled={!isValid() || loading}
        >
          {loading ? 'Creating...' : 'Create Avatar'}
        </button>
        {onCancel && (
          <button style={styles.button(false)} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default AvatarCreator;
