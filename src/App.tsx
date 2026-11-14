import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BASE_URL } from './services/base';
import { StoreProvider, useStore } from './state/store';
import { UiProvider, useUi } from './state/ui';
import { I18nProvider, useI18n, translate } from './i18n';
import { BottomNav } from './components/BottomNav';
import { Home } from './screens/Home';
import { Wardrobe } from './screens/Wardrobe';
import { PerfumeDetail } from './screens/PerfumeDetail';
import { PerfumeEditor } from './screens/PerfumeEditor';
import { Onboarding } from './screens/Onboarding';
import { Flower } from './components/Icons';

const Spin = lazy(() => import('./screens/Spin'));
const LayerLab = lazy(() => import('./screens/LayerLab'));
const Discover = lazy(() => import('./screens/Discover'));
const Settings = lazy(() => import('./screens/Settings'));
const Stats = lazy(() => import('./screens/Stats'));
const Achievements = lazy(() => import('./screens/Achievements'));
const Catalog = lazy(() => import('./screens/Catalog'));

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function useSystemReducedMotion() {
  const [r, setR] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const h = () => setR(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return r;
}

function Shell() {
  const { ready, prefs } = useStore();
  const sysReduced = useSystemReducedMotion();
  const reduced = prefs.reduceMotion === 'on' || (prefs.reduceMotion === 'system' && sysReduced);

  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', prefs.theme);
    root.setAttribute('data-motion', prefs.reduceMotion === 'on' ? 'reduced' : prefs.reduceMotion === 'off' ? 'full' : 'system');
    root.lang = prefs.language;
    const dark = prefs.theme === 'dark' || (prefs.theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15131c' : '#F6F3ED');
  }, [prefs.theme, prefs.reduceMotion, prefs.language]);

  if (!ready) return <Splash />;

  return (
    <I18nProvider lang={prefs.language}>
      <UiProvider reducedMotion={reduced}>
        <BrowserRouter basename={BASE_URL.replace(/\/$/, '') || undefined}>
          <ErrorBoundary lang={prefs.language}>
            {prefs.onboarded ? <MainRoutes /> : <Onboarding />}
          </ErrorBoundary>
        </BrowserRouter>
      </UiProvider>
    </I18nProvider>
  );
}

function MainRoutes() {
  const loc = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [loc.pathname]);
  return (
    <div className="app-shell">
      <OfflineBanner />
      <Celebrations />
      <Suspense fallback={<div className="page" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/wardrobe" element={<Wardrobe />} />
          <Route path="/wardrobe/new" element={<PerfumeEditor key="new" />} />
          <Route path="/wardrobe/stats" element={<Stats />} />
          <Route path="/perfume/:id" element={<PerfumeDetail />} />
          <Route path="/perfume/:id/edit" element={<PerfumeEditor key="edit" />} />
          <Route path="/spin" element={<Spin />} />
          <Route path="/lab" element={<LayerLab />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/badges" element={<Achievements />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/index.html" element={<Navigate to="/" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <BottomNav />
    </div>
  );
}

function OfflineBanner() {
  const { online } = useStore();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      {t('common.offline')}
    </div>
  );
}

function Celebrations() {
  const { freshUnlocks, consumeUnlocks, prefs } = useStore();
  const { toast, confetti } = useUi();
  const { t, tk } = useI18n();
  useEffect(() => {
    if (!freshUnlocks.length) return;
    const ids = consumeUnlocks();
    if (!prefs.achievementsEnabled) return;
    for (const id of ids) toast(`★ ${t('ach.unlocked')}: ${tk(`ach.${id}`)}`, 'lime');
    confetti();
  }, [freshUnlocks, consumeUnlocks, prefs.achievementsEnabled, toast, confetti, t, tk]);
  return null;
}

function NotFound() {
  const { t } = useI18n();
  return (
    <main className="page">
      <div className="empty">
        <Flower size={120} className="wiggle" />
        <h2>{t('err.404')}</h2>
        <Link className="btn btn-primary" to="/">
          {t('err.goHome')}
        </Link>
      </div>
    </main>
  );
}

function Splash() {
  return (
    <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }} aria-busy="true">
      <Flower size={90} className="wiggle" />
    </div>
  );
}

class ErrorBoundary extends Component<{ children: ReactNode; lang: 'en' | 'it' }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('[ui]', error);
  }
  render() {
    if (!this.state.error) return this.props.children;
    const l = this.props.lang;
    return (
      <main className="page">
        <div className="empty">
          <Flower size={110} />
          <h2>{translate(l, 'err.pageTitle')}</h2>
          <p>{this.state.error.message}</p>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            {translate(l, 'err.reload')}
          </button>
        </div>
      </main>
    );
  }
}
