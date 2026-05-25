import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import MainLayout from './layouts/MainLayout';

import { HeaderSection } from './sections/HeaderSection';
import { WidthControlSection } from './sections/WidthControlSection';
import { RollerStatusSection } from './sections/RollerStatusSection';
import { DiagnosticsSection } from './sections/DiagnosticsSection';
import { SettingsSection } from './sections/SettingsSection';
import { MachineLockScreen } from './components/MachineLockScreen';
import { type AuthState } from './services/plc';

// Simple error boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 border border-red-200 rounded-xl m-4">
          <h2 className="text-red-600 font-bold text-lg mb-2">Something went wrong:</h2>
          <pre className="text-red-800 text-sm whitespace-pre-wrap">{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [unauthReason, setUnauthReason] = useState<AuthState | null>(null);

  useEffect(() => {
    const handleAuthFailure = (e: Event) => {
      const customEvent = e as CustomEvent<AuthState>;
      setUnauthReason(customEvent.detail || 'UNAUTHORIZED');
    };
    window.addEventListener('machine-unauthorized', handleAuthFailure);
    return () => window.removeEventListener('machine-unauthorized', handleAuthFailure);
  }, []);

  if (unauthReason) {
    return <MachineLockScreen state={unauthReason} />;
  }

  return (
    <MainLayout>
      <ErrorBoundary>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        >
          <HeaderSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05, ease: 'easeOut' }}
        >
          <WidthControlSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
        >
          <RollerStatusSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        >
          <DiagnosticsSection />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2, ease: 'easeOut' }}
        >
          <SettingsSection />
        </motion.div>
      </ErrorBoundary>
    </MainLayout>
  );
};

export default App;