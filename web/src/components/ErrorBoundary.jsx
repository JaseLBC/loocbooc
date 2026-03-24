/**
 * ErrorBoundary - Catch React errors gracefully
 */

import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to analytics
    console.error('Loocbooc Error:', error, errorInfo);
    
    // Could send to error tracking service
    if (window.Loocbooc?.track) {
      window.Loocbooc.track('error', {
        message: error.message,
        stack: error.stack,
        component: errorInfo.componentStack
      });
    }
  }

  render() {
    if (this.state.hasError) {
      const styles = {
        container: {
          padding: '40px',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, sans-serif'
        },
        icon: {
          fontSize: '48px',
          marginBottom: '16px'
        },
        title: {
          fontSize: '20px',
          fontWeight: '600',
          color: '#3d3129',
          marginBottom: '8px'
        },
        message: {
          fontSize: '14px',
          color: '#6b5d4d',
          marginBottom: '24px'
        },
        button: {
          padding: '12px 24px',
          background: '#3d3129',
          color: '#fff',
          border: 'none',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer'
        },
        details: {
          marginTop: '24px',
          padding: '16px',
          background: '#f5f5f5',
          fontSize: '12px',
          textAlign: 'left',
          overflow: 'auto',
          maxHeight: '200px'
        }
      };

      return (
        <div style={styles.container}>
          <div style={styles.icon}>😕</div>
          <h2 style={styles.title}>Something went wrong</h2>
          <p style={styles.message}>
            {this.props.fallbackMessage || 'We encountered an error. Please try again.'}
          </p>
          <button 
            style={styles.button}
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              this.props.onRetry?.();
            }}
          >
            Try Again
          </button>
          
          {this.props.showDetails && this.state.error && (
            <pre style={styles.details}>
              {this.state.error.toString()}
              {this.state.errorInfo?.componentStack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Loading - Consistent loading state
 */
export function Loading({ message = 'Loading...', size = 'medium' }) {
  const sizes = {
    small: { container: '40px', spinner: '20px', text: '12px' },
    medium: { container: '80px', spinner: '32px', text: '14px' },
    large: { container: '120px', spinner: '48px', text: '16px' }
  };
  
  const s = sizes[size] || sizes.medium;

  const styles = {
    container: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: s.container,
      fontFamily: 'Inter, -apple-system, sans-serif'
    },
    spinner: {
      width: s.spinner,
      height: s.spinner,
      border: '3px solid #e5e0d8',
      borderTopColor: '#3d3129',
      borderRadius: '50%',
      animation: 'loocbooc-spin 1s linear infinite'
    },
    text: {
      marginTop: '12px',
      fontSize: s.text,
      color: '#6b5d4d'
    }
  };

  return (
    <>
      <style>
        {`@keyframes loocbooc-spin { to { transform: rotate(360deg); } }`}
      </style>
      <div style={styles.container}>
        <div style={styles.spinner} />
        {message && <div style={styles.text}>{message}</div>}
      </div>
    </>
  );
}

/**
 * Skeleton - Loading placeholder
 */
export function Skeleton({ width = '100%', height = '20px', rounded = false }) {
  const styles = {
    skeleton: {
      width,
      height,
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'loocbooc-shimmer 1.5s infinite',
      borderRadius: rounded ? '50%' : '4px'
    }
  };

  return (
    <>
      <style>
        {`@keyframes loocbooc-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}
      </style>
      <div style={styles.skeleton} />
    </>
  );
}

/**
 * Empty - No data state
 */
export function Empty({ icon = '📭', title, message, action, onAction }) {
  const styles = {
    container: {
      textAlign: 'center',
      padding: '60px 20px',
      fontFamily: 'Inter, -apple-system, sans-serif'
    },
    icon: {
      fontSize: '48px',
      marginBottom: '16px'
    },
    title: {
      fontSize: '18px',
      fontWeight: '600',
      color: '#3d3129',
      marginBottom: '8px'
    },
    message: {
      fontSize: '14px',
      color: '#6b5d4d',
      marginBottom: '20px'
    },
    button: {
      padding: '10px 20px',
      background: '#3d3129',
      color: '#fff',
      border: 'none',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer'
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.icon}>{icon}</div>
      {title && <h3 style={styles.title}>{title}</h3>}
      {message && <p style={styles.message}>{message}</p>}
      {action && onAction && (
        <button style={styles.button} onClick={onAction}>{action}</button>
      )}
    </div>
  );
}

export default ErrorBoundary;
