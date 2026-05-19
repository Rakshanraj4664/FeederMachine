import React from 'react';
import { motion } from 'framer-motion';
import MainLayout from './layouts/MainLayout';

// Lazy load sections to isolate errors
const HeaderSection = React.lazy(() => import('./sections/HeaderSection').then(m => ({ default: m.HeaderSection })));
const WidthControlSection = React.lazy(() => import('./sections/WidthControlSection').then(m => ({ default: m.WidthControlSection })));
const RollerStatusSection = React.lazy(() => import('./sections/RollerStatusSection').then(m => ({ default: m.RollerStatusSection })));
const DiagnosticsSection = React.lazy(() => import('./sections/DiagnosticsSection').then(m => ({ default: m.DiagnosticsSection })));
const SettingsSection = React.lazy(() => import('./sections/SettingsSection').then(m => ({ default: m.SettingsSection })));

// Simple error boundary
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: string}> {
  constructor(props: {children: React.ReactNode}) {
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

// Loading fallback
const SectionLoader = () => (
  <div className="w-full h-32 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  return (
    <MainLayout>
      <ErrorBoundary>
        <React.Suspense fallback={<SectionLoader />}>
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <HeaderSection />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          >
            <WidthControlSection />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
          >
            <RollerStatusSection />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
          >
            <DiagnosticsSection />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
          >
            <SettingsSection />
          </motion.div>
        </React.Suspense>
      </ErrorBoundary>
    </MainLayout>
  );
};

export default App;