import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  CubeIcon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CurrencyDollarIcon,
  ChartBarIcon,
  DocumentTextIcon,
  EyeIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CalendarIcon,
  UsersIcon,
  TruckIcon,
  ShoppingBagIcon
} from '@heroicons/react/24/outline';
import { productService, transactionService } from '../../services/api';
import { resolveImageUrl, handleImageError } from '../../utils/imageUtils';
import { useTheme } from '../../context/ThemeContext';

const DashboardScreen = () => {
  const navigate = useNavigate();
  const { colors } = useTheme();
  
  const [summary, setSummary] = useState({
    totalProducts: 0,
    lowStock: 0,
    outOfStock: 0,
    totalStock: 0
  });

  const [salesMetrics, setSalesMetrics] = useState({
    totalSales: 0,
    dailySales: 0,
    weeklySales: 0,
    monthlySales: 0,
    weeklyGrowth: 0,
    monthlyGrowth: 0,
    averageOrderValue: 0,
    totalTransactions: 0
  });

  const [recentTransactions, setRecentTransactions] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('weekly');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const calculateDateRanges = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

    return {
      today,
      weekAgo,
      monthAgo,
      twoWeeksAgo,
      twoMonthsAgo
    };
  };

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Load products and transactions
      const [products, transactions] = await Promise.all([
        productService.getAll(),
        transactionService.getAll()
      ]);

      console.log('Dashboard: Loaded products:', products.length);
      console.log('Dashboard: Loaded transactions:', transactions.length);

      // Calculate summary stats
      const totalProducts = products.length;
      const lowStock = products.filter(p => p.quantity <= (p.lowStockThreshold || 10) && p.quantity > 0).length;
      const outOfStock = products.filter(p => p.quantity === 0).length;
      const totalStock = products.reduce((sum, p) => sum + (p.quantity || 0), 0);

      setSummary({
        totalProducts,
        lowStock,
        outOfStock,
        totalStock
      });

      // Calculate sales metrics with real analytics
      const { today, weekAgo, monthAgo, twoWeeksAgo, twoMonthsAgo } = calculateDateRanges();
      
      // Filter transactions by date ranges
      const dailyTransactions = transactions.filter(t => new Date(t.timestamp) >= today);
      const weeklyTransactions = transactions.filter(t => new Date(t.timestamp) >= weekAgo);
      const monthlyTransactions = transactions.filter(t => new Date(t.timestamp) >= monthAgo);
      const previousWeekTransactions = transactions.filter(t => {
        const date = new Date(t.timestamp);
        return date >= twoWeeksAgo && date < weekAgo;
      });
      const previousMonthTransactions = transactions.filter(t => {
        const date = new Date(t.timestamp);
        return date >= twoMonthsAgo && date < monthAgo;
      });

      // Calculate sales totals
      const dailySales = dailyTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
      const weeklySales = weeklyTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
      const monthlySales = monthlyTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
      const totalSales = transactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
      
      const previousWeekSales = previousWeekTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
      const previousMonthSales = previousMonthTransactions.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

      // Calculate growth percentages
      const weeklyGrowth = previousWeekSales > 0 
        ? ((weeklySales - previousWeekSales) / previousWeekSales * 100).toFixed(1)
        : weeklySales > 0 ? 100 : 0;
        
      const monthlyGrowth = previousMonthSales > 0 
        ? ((monthlySales - previousMonthSales) / previousMonthSales * 100).toFixed(1)
        : monthlySales > 0 ? 100 : 0;

      const averageOrderValue = transactions.length > 0 ? totalSales / transactions.length : 0;

      setSalesMetrics({
        totalSales,
        dailySales,
        weeklySales,
        monthlySales,
        weeklyGrowth: parseFloat(weeklyGrowth),
        monthlyGrowth: parseFloat(monthlyGrowth),
        averageOrderValue,
        totalTransactions: transactions.length
      });

      // Get recent transactions (compact view, show up to 5)
      const recent = transactions
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 5)
        .map(t => ({
          id: t.id,
          productName: t.items?.[0]?.name || 'Multiple Items',
          date: new Date(t.timestamp).toLocaleDateString(),
          time: new Date(t.timestamp).toLocaleTimeString(),
          amount: (parseFloat(t.total) || 0).toFixed(2),
          status: 'completed',
          items: t.items?.length || 1
        }));

      setRecentTransactions(recent);

      // Calculate top products from transactions
      const productSales = {};
      transactions.forEach(transaction => {
        transaction.items?.forEach(item => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = {
              id: item.productId,
              name: item.name,
              category: item.category || 'Uncategorized',
              sales: 0,
              revenue: 0,
              image: item.imageUrl || null
            };
          }
          productSales[item.productId].sales += item.quantity || 0;
          productSales[item.productId].revenue += (item.quantity || 0) * (item.price || 0);
        });
      });

      const topProductsList = Object.values(productSales)
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

      setTopProducts(topProductsList);

      // Generate alerts
      const alertsList = [];
      if (outOfStock > 0) {
        alertsList.push({
          id: 'out-of-stock',
          type: 'danger',
          title: 'Stock Alert',
          message: `${outOfStock} products are completely out of stock`,
          action: 'View Inventory',
          actionUrl: '/inventory?filter=outOfStock'
        });
      }
      if (lowStock > 0) {
        alertsList.push({
          id: 'low-stock',
          type: 'warning',
          title: 'Low Stock Warning',
          message: `${lowStock} products have low stock levels`,
          action: 'Restock Items',
          actionUrl: '/inventory?filter=lowStock'
        });
      }
      if (alertsList.length === 0) {
        alertsList.push({
          id: 'all-good',
          type: 'success',
          title: 'Inventory Status',
          message: 'All products have adequate stock levels',
          action: 'View Reports',
          actionUrl: '/analytics'
        });
      }

      setAlerts(alertsList);
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlertAction = (alert) => {
    if (alert.actionUrl) {
      navigate(alert.actionUrl);
      toast.success(`Navigating to ${alert.action}`);
    }
  };

  const handleRestockItems = () => {
    navigate('/inventory?filter=lowStock');
    toast.info('Showing low stock items');
  };

  const getCurrentPeriodData = () => {
    switch (selectedPeriod) {
      case 'weekly':
        return {
          sales: salesMetrics.weeklySales,
          growth: salesMetrics.weeklyGrowth,
          period: 'This Week'
        };
      case 'monthly':
        return {
          sales: salesMetrics.monthlySales,
          growth: salesMetrics.monthlyGrowth,
          period: 'This Month'
        };
      default:
        return {
          sales: salesMetrics.weeklySales,
          growth: salesMetrics.weeklyGrowth,
          period: 'This Week'
        };
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-6"></div>
          <p className={`text-lg font-medium ${colors.text.primary}`}>Loading dashboard data...</p>
          <p className={`text-sm mt-2 ${colors.text.secondary}`}>Please wait while we fetch your analytics</p>
        </div>
      </div>
    );
  }

  const currentPeriodData = getCurrentPeriodData();

  const StatCard = ({ title, value, icon: Icon, gradient, trend, trendValue, description, onClick }) => (
    <div 
      className={`relative overflow-hidden bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-white/80 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold mb-2">{value}</p>
          {trend && (
            <div className="flex items-center space-x-2">
              {trend === 'up' ? (
                <ArrowUpIcon className="h-4 w-4 text-green-300" />
              ) : trend === 'down' ? (
                <ArrowDownIcon className="h-4 w-4 text-red-300" />
              ) : null}
              <span className="text-sm text-white/90">{trendValue}</span>
            </div>
          )}
          {description && (
            <p className="text-xs text-white/70 mt-1">{description}</p>
          )}
        </div>
        <div className="flex-shrink-0">
          <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
            <Icon className="h-8 w-8 text-white" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Total Products"
          value={summary.totalProducts.toLocaleString()}
          icon={CubeIcon}
          gradient="from-blue-500 to-blue-600"
          description="Items in inventory"
          onClick={() => navigate('/inventory')}
        />
        
        <StatCard
          title={currentPeriodData.period + " Sales"}
          value={`₱${currentPeriodData.sales.toLocaleString()}`}
          icon={CurrencyDollarIcon}
          gradient="from-emerald-500 to-emerald-600"
          trend={currentPeriodData.growth > 0 ? 'up' : currentPeriodData.growth < 0 ? 'down' : null}
          trendValue={`${currentPeriodData.growth > 0 ? '+' : ''}${currentPeriodData.growth}%`}
          description="vs previous period"
        />
        
        <StatCard
          title="Low Stock Items"
          value={summary.lowStock.toLocaleString()}
          icon={ExclamationTriangleIcon}
          gradient="from-amber-500 to-amber-600"
          description="Need restocking"
          onClick={handleRestockItems}
        />
        
        <StatCard
          title="Average Order"
          value={`₱${salesMetrics.averageOrderValue.toLocaleString()}`}
          icon={ArrowTrendingUpIcon}
          gradient="from-purple-500 to-purple-600"
          description="Per transaction"
        />
      </div>

      {/* Period Selection and Detailed Metrics */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Sales Analytics</h3>
            <p className={`text-sm ${colors.text.secondary}`}>Real-time sales performance</p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedPeriod('weekly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedPeriod === 'weekly'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setSelectedPeriod('monthly')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedPeriod === 'monthly'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="text-center">
            <p className={`text-xl font-bold ${colors.text.primary}`}>₱{currentPeriodData.sales.toLocaleString()}</p>
            <p className={`text-xs ${colors.text.secondary}`}>{currentPeriodData.period} Sales</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${currentPeriodData.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {currentPeriodData.growth > 0 ? '+' : ''}{currentPeriodData.growth}%
            </p>
            <p className={`text-xs ${colors.text.secondary}`}>Growth</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${colors.text.primary}`}>{salesMetrics.totalTransactions}</p>
            <p className={`text-xs ${colors.text.secondary}`}>Total Transactions</p>
          </div>
          <div className="text-center">
            <p className={`text-xl font-bold ${colors.text.primary}`}>₱{salesMetrics.averageOrderValue.toFixed(0)}</p>
            <p className={`text-xs ${colors.text.secondary}`}>Avg Order Value</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Two columns, each with two sections stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left column */}
        <div className="grid grid-rows-[auto_1fr] gap-4 min-h-0">
          {/* Quick Actions */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3`}>
            <h3 className={`text-base font-semibold ${colors.text.primary} mb-3`}>Quick Actions</h3>
            <div className="space-y-2.5">
              <Link
                to="/pos"
                className="flex items-center space-x-3 p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all duration-200 group"
              >
                <ShoppingBagIcon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                <div>
                  <p className="font-medium">New Sale</p>
                  <p className="text-xs text-purple-100">Start POS transaction</p>
                </div>
              </Link>
              
              <Link
                to="/inventory"
                className="flex items-center space-x-3 p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 transition-all duration-200 group"
              >
                <CubeIcon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                <div>
                  <p className="font-medium">Manage Inventory</p>
                  <p className="text-xs text-emerald-100">Add or edit products</p>
                </div>
              </Link>
              
              <Link
                to="/analytics"
                className="flex items-center space-x-3 p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all duration-200 group"
              >
                <ChartBarIcon className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
                <div>
                  <p className="font-medium">View Analytics</p>
                  <p className="text-xs text-blue-100">Detailed reports</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3` }>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Recent Transactions</h3>
                <p className={`text-sm ${colors.text.secondary}`}>Latest sales activity</p>
              </div>
              <Link 
                to="/sales" 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center space-x-1"
              >
                <span>View All</span>
                <EyeIcon className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="space-y-2.5">
              {recentTransactions.length === 0 ? (
                <div className="text-center py-8">
                  <DocumentTextIcon className={`h-12 w-12 mx-auto mb-3 ${colors.text.tertiary}`} />
                  <p className={`${colors.text.secondary}`}>No recent transactions</p>
                  <p className={`text-sm ${colors.text.tertiary}`}>Start your first sale in POS</p>
                </div>
              ) : (
                recentTransactions.map(transaction => (
                  <div key={transaction.id} className={`flex items-center justify-between p-4 ${colors.bg.secondary} hover:${colors.bg.tertiary} rounded-xl transition-colors group`}>
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <div>
                        <p className={`font-medium ${colors.text.primary}`}>{transaction.productName}</p>
                        <div className={`flex items-center space-x-2 text-sm ${colors.text.secondary}`}>
                          <CalendarIcon className="h-4 w-4" />
                          <span>{transaction.date}</span>
                          <span>•</span>
                          <span>{transaction.items} item{transaction.items > 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${colors.text.primary}`}>₱{transaction.amount}</p>
                      <p className="text-xs text-green-600">completed</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="grid grid-rows-[auto_1fr] gap-4 min-h-0">
          {/* Alerts */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3`}>
            <h3 className={`text-base font-semibold ${colors.text.primary} mb-3`}>System Alerts</h3>
            <div className="space-y-2.5">
              {alerts.slice(0, 2).map(alert => (
                <div 
                  key={alert.id} 
                  className={`p-4 rounded-xl border-l-4 ${
                    alert.type === 'danger' 
                      ? 'bg-red-50 dark:bg-red-900/20 border-red-500' 
                      : alert.type === 'warning'
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
                      : 'bg-green-50 dark:bg-green-900/20 border-green-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium ${
                        alert.type === 'danger' 
                          ? 'text-red-900 dark:text-red-200' 
                          : alert.type === 'warning'
                          ? 'text-yellow-900 dark:text-yellow-200'
                          : 'text-green-900 dark:text-green-200'
                      }`}>
                        {alert.title}
                      </p>
                      <p className={`text-sm ${
                        alert.type === 'danger' 
                          ? 'text-red-700 dark:text-red-300' 
                          : alert.type === 'warning'
                          ? 'text-yellow-700 dark:text-yellow-300'
                          : 'text-green-700 dark:text-green-300'
                      }`}>
                        {alert.message}
                      </p>
                    </div>
                    <button 
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        alert.type === 'danger'
                          ? 'bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-700'
                          : alert.type === 'warning'
                          ? 'bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-700'
                          : 'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-700'
                      }`}
                      onClick={() => handleAlertAction(alert)}
                    >
                      {alert.action}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Products */}
          <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-3`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className={`text-lg font-semibold ${colors.text.primary}`}>Top Products</h3>
                <p className={`text-sm ${colors.text.secondary}`}>Best selling items</p>
              </div>
              <Link 
                to="/analytics" 
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium text-sm flex items-center space-x-1"
              >
                <span>View Analytics</span>
                <ChartBarIcon className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="space-y-2.5">
              {topProducts.length === 0 ? (
                <div className="text-center py-8">
                  <CubeIcon className={`h-12 w-12 mx-auto mb-3 ${colors.text.tertiary}`} />
                  <p className={`${colors.text.secondary}`}>No sales data yet</p>
                  <p className={`text-sm ${colors.text.tertiary}`}>Complete some transactions to see top products</p>
                </div>
              ) : (
                topProducts.map((product, index) => (
                  <div key={product.id} className={`flex items-center space-x-4 p-4 ${colors.bg.secondary} hover:${colors.bg.tertiary} rounded-xl transition-colors group`}>
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium ${colors.text.primary} truncate`}>{product.name}</p>
                      <p className={`text-sm ${colors.text.secondary}`}>{product.category}</p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${colors.text.primary}`}>{product.sales} sold</p>
                      <p className={`text-sm ${colors.text.secondary}`}>₱{product.revenue.toLocaleString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen; 