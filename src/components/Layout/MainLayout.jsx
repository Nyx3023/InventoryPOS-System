import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { 
  HomeIcon, 
  ShoppingCartIcon, 
  ChartBarIcon, 
  CubeIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  CalculatorIcon,
  BellIcon,
  UserCircleIcon,
  SunIcon,
  MoonIcon
} from '@heroicons/react/24/outline';
import { ClockIcon } from '@heroicons/react/24/outline';
import { useSync } from '../../context/SyncContext';
import { CloudIcon, CloudArrowUpIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const MainLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { t } = useSettings();
  const { colors, isDarkMode, toggleTheme } = useTheme();
  const { isScanning } = useGlobalBarcode();
  const { status: syncStatus, lastRun, pendingCount } = useSync();

  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(intervalId);
  }, []);

  const navigation = [
    { name: t('dashboard'), icon: HomeIcon, href: '/', gradient: 'from-blue-500 to-blue-600' },
    { name: t('inventory'), icon: CubeIcon, href: '/inventory', gradient: 'from-emerald-500 to-emerald-600' },
    { name: t('sales'), icon: DocumentTextIcon, href: '/sales', gradient: 'from-amber-500 to-amber-600' },
    { name: 'Point of Sale', icon: CalculatorIcon, href: '/pos', gradient: 'from-purple-500 to-purple-600' },
    { name: 'Analytics', icon: ChartBarIcon, href: '/analytics', gradient: 'from-teal-500 to-teal-600' },
    { name: t('settings'), icon: Cog6ToothIcon, href: '/settings', gradient: 'from-slate-500 to-slate-600' },
  ];

  const isActivePath = (path) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    const currentNav = navigation.find(nav => isActivePath(nav.href));
    return currentNav?.name || 'Dashboard';
  };

  const isPOS = location.pathname.startsWith('/pos');

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden brand-sand">
      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

        {/* Top Header */}
        <header className={`brand-header border-b border-white/10 px-6 py-3 flex items-center justify-between shadow-sm backdrop-blur-sm relative`}>
          <div className="flex items-center space-x-4">
            {/* No sidebar toggle */}
            <div>
              <h1 className={`text-2xl font-bold text-white`}>{getPageTitle()}</h1>
              <p className={`text-sm text-white/80`}>Welcome back, {user?.name || 'User'}</p>
            </div>
          </div>
          {/* Tabs */}
          <nav className="hidden md:flex items-center gap-2 absolute left-1/2 -translate-x-1/2">
            {navigation
              .filter(item => ['/', '/inventory', '/sales', '/pos', '/analytics'].includes(item.href))
              .map((item) => {
                const active = isActivePath(item.href);
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`brand-tab ${active ? 'brand-tab-active' : ''}`}
                  >
                    {String(item.name).toUpperCase()}
                  </Link>
                );
              })}
          </nav>

          <div className="flex items-center gap-3">
            {/* Sync Indicator (icons only) */}
            <div 
              className={`hidden sm:flex items-center justify-center p-2 rounded-full bg-white/10`}
              title={syncStatus === 'syncing' ? 'Syncing changes to cloud' : syncStatus === 'error' ? 'Sync error - see console' : syncStatus === 'disabled' ? 'Cloud sync disabled (missing Firebase config)' : lastRun ? `Last sync: ${new Date(lastRun).toLocaleTimeString()}` : 'Synced'}
            >
              {syncStatus === 'syncing' ? (
                <CloudArrowUpIcon className="h-5 w-5 text-blue-300 animate-pulse" />
              ) : syncStatus === 'error' || syncStatus === 'disabled' ? (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-300" />
              ) : (
                <CheckCircleIcon className="h-5 w-5 text-green-300" />
              )}
            </div>
            {/* Date & Time */}
            <div className={`hidden sm:flex items-center px-3 py-1 rounded-lg bg-white/10 text-white`} title={currentDateTime.toLocaleString()}>
              <ClockIcon className={`h-5 w-5 mr-2 text-white/80`} />
              <span className={`text-sm font-medium`}>
                {currentDateTime.toLocaleDateString()} {currentDateTime.toLocaleTimeString()}
              </span>
            </div>
            {/* Settings */}
            <Link 
              to="/settings"
              className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10`}
              title="Settings"
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </Link>
            {/* Logout */}
            <button
              onClick={handleLogout}
              className={`hidden sm:inline-flex p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10`}
              title="Logout"
            >
              <ArrowRightOnRectangleIcon className="h-6 w-6" />
            </button>
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-all duration-200 text-white/80 hover:bg-white/10`}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <SunIcon className="h-6 w-6" />
              ) : (
                <MoonIcon className="h-6 w-6" />
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className={`flex-1 ${isPOS ? 'overflow-hidden' : 'overflow-y-auto'} transition-colors duration-300 bg-transparent dark:bg-slate-900`}>
          <div className={`${isPOS ? 'w-full h-full p-6' : 'max-w-7xl mx-auto p-6'}`}>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainLayout; 