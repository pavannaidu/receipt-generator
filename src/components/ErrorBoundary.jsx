import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '20px',
          fontFamily: 'Arial, sans-serif', background: '#1a1a2e', color: '#fff'
        }}>
          <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Something went wrong</h1>
          <p style={{ color: '#aaa', marginBottom: '24px', textAlign: 'center', maxWidth: '500px' }}>
            The application encountered an unexpected error. Your data is safe.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '10px 24px', background: '#e94560', color: '#fff',
              border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px'
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
