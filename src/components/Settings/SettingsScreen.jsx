import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { UserIcon, Cog6ToothIcon, SwatchIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import { categoryService } from '../../services/api';
import UserManagement from './UserManagement';
import { useGlobalBarcode } from '../../context/BarcodeContext';

const SettingsScreen = () => {
  const { user } = useAuth();
  const { suspendScanning, resumeScanning } = useGlobalBarcode();
  useEffect(() => {
    suspendScanning();
    return () => {
      resumeScanning();
    };
  }, []);
  const { settings, updateSettings, t } = useSettings();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [localSettings, setLocalSettings] = useState({
    lowStockThreshold: settings.lowStockThreshold || '',
    theme: settings.theme || 'light',
    language: settings.language || 'en',
    receiptFooter: settings.receiptFooter || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setLocalSettings(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    try {
      // Update the global settings
      updateSettings(localSettings);
      toast.success(t('settingsSaved'));
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Error saving settings:', error);
    }
  };

  const tabs = [
    {
      id: 'general',
      name: t('generalSettings'),
      icon: Cog6ToothIcon,
      component: GeneralSettings
    }
  ];

  // Add User Management tab only for admins
  if (user?.role === 'admin') {
    tabs.push({
      id: 'categories',
      name: 'Categories',
      icon: Squares2X2Icon,
      component: CategoryManager
    });
    tabs.push({
      id: 'customize',
      name: 'Customization',
      icon: SwatchIcon,
      component: () => (
        <CustomizationSettings colors={colors} settings={localSettings} handleChange={handleChange} handleSubmit={handleSubmit} />
      )
    });
    tabs.push({
      id: 'users',
      name: 'User Management',
      icon: UserIcon,
      component: UserManagement
    });
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || GeneralSettings;

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className={`text-2xl font-bold mb-6 ${colors.text.primary}`}>{t('settings')}</h1>

      {/* Tab Navigation */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} mb-6`}>
        <div className={`border-b ${colors.border.primary}`}>
          <nav className="-mb-px flex space-x-8 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                    : `border-transparent ${colors.text.secondary} hover:${colors.text.primary} hover:border-gray-300 dark:hover:border-gray-600`
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <ActiveComponent 
        settings={localSettings}
        handleChange={handleChange}
        handleSubmit={handleSubmit}
        colors={colors}
      />
    </div>
  );
};

// General Settings Component
const GeneralSettings = ({ settings, handleChange, handleSubmit, colors }) => {
  const { t } = useSettings();

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-6 ${colors.text.primary}`}>Business Information</h2>
        <div className="flex flex-col items-center space-y-6">
          {/* Business Logo */}
          <div className="flex flex-col items-center space-y-4">
            <img 
              src="\src\assets\jbologo.png" alt="JBO Arts and Crafts Trading Logo" 
              className="w-32 h-32 object-contain rounded-full shadow-lg border-4 border-yellow-300"
            />
            <div className="text-center">
              <h3 className={`text-2xl font-bold ${colors.text.primary} mb-2`}>JBO Arts & Crafts Trading</h3>
              <p className={`${colors.text.secondary}`}>Your trusted partner for arts and crafts supplies</p>
            </div>
          </div>
          
          {/* Business Contact Information */}
          <div className={`w-full grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t ${colors.border.primary}`}>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm ${colors.text.secondary}`}>Email</p>
                  <p className={`font-medium ${colors.text.primary}`}>jboartsandcrafts@gmail.com</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm ${colors.text.secondary}`}>Phone</p>
                  <p className={`font-medium ${colors.text.primary}`}>0932 868 7911</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm ${colors.text.secondary}`}>Address</p>
                  <p className={`font-medium ${colors.text.primary}`}>#303 B1A J.R. Blvd Tagapo, Santa Rosa, Philippines</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className={`text-sm ${colors.text.secondary}`}>Business Hours</p>
                  <p className={`font-medium ${colors.text.primary}`}>Mon-Sat: 8:00 AM - 6:00 PM</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>{t('systemSettings')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="lowStockThreshold">
              {t('lowStockThreshold')}
            </label>
            <input
              type="number"
              id="lowStockThreshold"
              name="lowStockThreshold"
              value={settings.lowStockThreshold}
              onChange={handleChange}
              className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                placeholder:${colors.text.tertiary} px-4 py-3 font-medium ${colors.text.primary}
                hover:${colors.border.secondary} hover:shadow-lg`}
              min="0"
            />
          </div>

          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="language">
              {t('language')}
            </label>
            <select
              id="language"
              name="language"
              value={settings.language}
              onChange={handleChange}
              className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
                disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
                px-4 py-3 font-medium ${colors.text.primary}
                hover:${colors.border.secondary} hover:shadow-lg`}
            >
              <option value="en">English</option>
              <option value="fil">Filipino</option>
            </select>
          </div>
        </div>
      </div>

      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>{t('receiptSettings')}</h2>
        <div>
          <label className={`block text-sm font-medium ${colors.text.primary} mb-1`} htmlFor="receiptFooter">
            {t('receiptFooter')}
          </label>
          <textarea
            id="receiptFooter"
            name="receiptFooter"
            value={settings.receiptFooter}
            onChange={handleChange}
            className={`block w-full rounded-lg border-2 ${colors.border.primary} shadow-md ${colors.card.primary}
              focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 focus:shadow-lg sm:text-sm
              disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200
              placeholder:${colors.text.tertiary} px-4 py-3 font-medium ${colors.text.primary}
              hover:${colors.border.secondary} hover:shadow-lg resize-vertical`}
            rows="3"
            placeholder={t('thankYou')}
          />
          <p className={`text-sm ${colors.text.secondary} mt-2`}>
            This message will appear at the bottom of all receipts
          </p>
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary">
          {t('save')} Settings
        </button>
      </div>
    </form>
  );
};

export default SettingsScreen;

// Lightweight, stable CategoryManager (admin-only)
function CategoryManager() {
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = async () => {
    try {
      const list = await categoryService.getAll();
      setCategories(list || []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await categoryService.create(name.trim(), description.trim());
    setName('');
    setDescription('');
    await load();
  };

  const remove = async (catName) => {
    await categoryService.delete(catName);
    await load();
  };

  return (
    <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
      <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>Manage Categories</h2>
      <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <input
          type="text"
          className={`md:col-span-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
          placeholder="Category name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
        />
        <input
          type="text"
          className={`md:col-span-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
          placeholder="Description (optional)"
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
        />
        <button type="submit" className="btn-primary md:col-span-1">Add</button>
      </form>

      <div className="divide-y">
        {categories.map((c) => (
          <div key={c.name} className="flex items-center justify-between py-3">
            <div>
              <div className={`font-medium ${colors.text.primary}`}>{c.name}</div>
              {c.description && <div className={`text-sm ${colors.text.secondary}`}>{c.description}</div>}
            </div>
            <button onClick={()=>remove(c.name)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-700/50 dark:text-red-300 dark:hover:bg-red-900/20 transition-colors">
              Remove
            </button>
          </div>
        ))}
        {categories.length === 0 && (
          <div className={`text-sm ${colors.text.secondary} py-6`}>No categories yet.</div>
        )}
      </div>
    </div>
  );
}

// Customization settings
const CustomizationSettings = ({ colors, settings, handleChange, handleSubmit }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>Color Scheme</h2>
        <div className="flex items-center gap-3">
          <button type="button" onClick={toggleTheme} className="btn-secondary">Toggle {isDarkMode ? 'Light' : 'Dark'}</button>
        </div>
      </div>
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} p-6`}>
        <h2 className={`text-lg font-semibold mb-4 ${colors.text.primary}`}>Dashboard Layout</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Show Top Products</label>
            <select name="showTopProducts" onChange={handleChange} value={settings.showTopProducts ?? 'yes'} className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label className={`block text-sm font-medium ${colors.text.primary} mb-1`}>Show Recent Transactions Count</label>
            <select name="recentCount" onChange={handleChange} value={settings.recentCount ?? 5} className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}>
              <option value={3}>3</option>
              <option value={5}>5</option>
              <option value={10}>10</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button type="submit" className="btn-primary">Save Customization</button>
        </div>
      </div>
    </form>
  );
};