import { NavLink } from 'react-router-dom';
import { IconFlask, IconHanger, IconHome, IconSparkle, IconWheel } from './Icons';
import { useI18n } from '../i18n';

export function BottomNav() {
  const { t } = useI18n();
  const cls = ({ isActive }: { isActive: boolean }) => `bnav-item ${isActive ? 'active' : ''}`;
  return (
    <nav className="bnav" aria-label="Main">
      <NavLink to="/" end className={cls}>
        <IconHome />
        {t('nav.home')}
      </NavLink>
      <NavLink to="/wardrobe" className={cls}>
        <IconHanger />
        {t('nav.wardrobe')}
      </NavLink>
      <div style={{ position: 'relative', display: 'grid', placeItems: 'center', height: '100%' }}>
        <NavLink to="/spin" className={({ isActive }) => `bnav-spin ${isActive ? 'active' : ''}`} aria-label={t('nav.spin')}>
          <IconWheel />
        </NavLink>
        <span className="bnav-spin-label" aria-hidden="true">
          {t('nav.spin')}
        </span>
      </div>
      <NavLink to="/lab" className={cls}>
        <IconFlask />
        {t('nav.lab')}
      </NavLink>
      <NavLink to="/discover" className={cls}>
        <IconSparkle />
        {t('nav.discover')}
      </NavLink>
    </nav>
  );
}
