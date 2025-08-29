import { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, EyeIcon, PrinterIcon, TrashIcon, CalendarIcon, CurrencyDollarIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';
import { transactionService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { toast } from 'react-hot-toast';
import ReceiptModal from './ReceiptModal';
import DeleteConfirmationModal from './DeleteConfirmationModal';

const SalesScreen = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: ''
  });
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalTransactions: 0,
    averageTransaction: 0,
    todaySales: 0
  });

  useEffect(() => {
    loadTransactions();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [transactions, searchTerm, dateFilter]);

  const loadTransactions = async () => {
    try {
      setIsLoading(true);
      const data = await transactionService.getAll();
      console.log('Loaded transactions:', data);
      setTransactions(data || []);
      calculateSummary(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSummary = (transactionList) => {
    const totalSales = transactionList.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);
    const totalTransactions = transactionList.length;
    const averageTransaction = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Get today's date in local timezone
    const today = new Date();
    const todayDateString = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0');
    
    const todaySales = transactionList
      .filter(t => {
        const transactionDate = new Date(t.timestamp);
        const transactionDateString = transactionDate.getFullYear() + '-' + 
          String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(transactionDate.getDate()).padStart(2, '0');
        return transactionDateString === todayDateString;
      })
      .reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

    console.log('Today sales calculation:', {
      todayDateString,
      totalTransactions: transactionList.length,
      todaysTransactions: transactionList.filter(t => {
        const transactionDate = new Date(t.timestamp);
        const transactionDateString = transactionDate.getFullYear() + '-' + 
          String(transactionDate.getMonth() + 1).padStart(2, '0') + '-' + 
          String(transactionDate.getDate()).padStart(2, '0');
        return transactionDateString === todayDateString;
      }).length,
      todaySales
    });

    setSummary({
      totalSales,
      totalTransactions,
      averageTransaction,
      todaySales
    });
  };

  const applyFilters = () => {
    let filtered = [...transactions];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(transaction => 
        transaction.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.items?.some(item => 
          item.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Date filter
    if (dateFilter.startDate || dateFilter.endDate) {
      filtered = filtered.filter(transaction => {
        const transactionDate = new Date(transaction.timestamp);
        
        if (dateFilter.startDate) {
          const startDate = new Date(dateFilter.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (transactionDate < startDate) return false;
        }
        
        if (dateFilter.endDate) {
          const endDate = new Date(dateFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (transactionDate > endDate) return false;
        }
        
        return true;
      });
    }

    setFilteredTransactions(filtered);
    // Don't recalculate summary when filtering - it should always show totals from all transactions
    // calculateSummary(filtered);
  };

  const viewReceipt = (transaction) => {
    setSelectedTransaction(transaction);
    setShowReceiptModal(true);
  };

  const printReceipt = (transaction) => {
    setSelectedTransaction(transaction);
    // Add small delay to ensure state is updated
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const initiateDeleteTransaction = (transaction) => {
    // Check if user is admin
    if (user?.role !== 'admin') {
      toast.error('Access denied. Only administrators can delete transactions.');
      return;
    }

    setTransactionToDelete(transaction);
    setShowDeleteModal(true);
  };

  const confirmDeleteTransaction = async () => {
    if (!transactionToDelete) return;

    try {
      await transactionService.delete(transactionToDelete.id, user.role);
      
      // Update the transactions list
      const updatedTransactions = transactions.filter(t => t.id !== transactionToDelete.id);
      setTransactions(updatedTransactions);
      
      toast.success('Transaction deleted successfully');
      setShowDeleteModal(false);
      setTransactionToDelete(null);
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast.error(error.message || 'Failed to delete transaction');
    }
  };

  const cancelDeleteTransaction = () => {
    setShowDeleteModal(false);
    setTransactionToDelete(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount) => {
    return `₱${(parseFloat(amount) || 0).toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className={`${colors.text.secondary}`}>Loading sales data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className={`text-2xl font-bold ${colors.text.primary}`}>Sales Management</h1>
        <div className={`text-sm ${colors.text.secondary}`}>
          Total Records: {filteredTransactions.length}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Total Sales</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.totalSales)}</p>
            </div>
          </div>
        </div>
        
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <ShoppingBagIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Transactions</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{summary.totalTransactions}</p>
            </div>
          </div>
        </div>
        
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CalendarIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Today's Sales</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.todaySales)}</p>
            </div>
          </div>
        </div>
        
        <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
          <div className="flex items-center">
            <CurrencyDollarIcon className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div className="ml-4">
              <p className={`text-sm ${colors.text.secondary}`}>Average Sale</p>
              <p className={`text-2xl font-bold ${colors.text.primary}`}>{formatCurrency(summary.averageTransaction)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={`${colors.card.primary} p-6 rounded-lg shadow border ${colors.border.primary}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="relative md:col-span-1">
            <MagnifyingGlassIcon className={`h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 ${colors.text.tertiary}`} />
            <input
              type="text"
              placeholder="Search by transaction ID or product..."
              className={`w-full pl-10 pr-4 py-2 border rounded-lg ${colors.input.primary}`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2 md:col-span-2">
            <input
              type="date"
              className={`flex-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateFilter.startDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
              placeholder="Start Date"
            />
            <span className={`${colors.text.secondary}`}>to</span>
            <input
              type="date"
              className={`flex-1 border rounded-lg px-3 py-2 ${colors.input.primary}`}
              value={dateFilter.endDate}
              onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
              placeholder="End Date"
            />
          </div>
          
          <button
            onClick={() => {
              setSearchTerm('');
              setDateFilter({ startDate: '', endDate: '' });
            }}
            className="px-4 py-2 bg-gray-600 dark:bg-gray-500 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 md:col-span-1"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Transactions Table */}
      <div className={`${colors.card.primary} rounded-lg shadow border ${colors.border.primary} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className={`min-w-full divide-y ${colors.border.primary}`}>
            <thead className={`${colors.bg.secondary}`}>
              <tr>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Transaction ID
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Date & Time
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Items
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Payment
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Total
                </th>
                <th className={`px-6 py-3 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="6" className={`px-6 py-8 text-center ${colors.text.secondary}`}>
                    No transactions found
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr 
                    key={transaction.id} 
                    className={`${colors.bg.hover} cursor-pointer`}
                    onClick={() => viewReceipt(transaction)}
                    title="Click to view receipt"
                  >
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {transaction.id}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      {formatDate(transaction.timestamp)}
                    </td>
                    <td className={`px-6 py-4 text-sm ${colors.text.secondary}`}>
                      <div className="max-w-xs">
                        {transaction.items?.slice(0, 2).map((item, index) => (
                          <div key={index} className="truncate">
                            {item.quantity}x {item.name}
                          </div>
                        ))}
                        {transaction.items?.length > 2 && (
                          <div className={`text-xs ${colors.text.tertiary}`}>
                            +{transaction.items.length - 2} more items
                          </div>
                        )}
                      </div>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        (transaction.payment_method || transaction.paymentMethod) === 'cash' 
                          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
                      }`}>
                        {(transaction.payment_method || transaction.paymentMethod || 'cash').toUpperCase()}
                      </span>
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                      {formatCurrency(transaction.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); printReceipt(transaction); }}
                          className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                          title="Print Receipt"
                        >
                          <PrinterIcon className="h-5 w-5" />
                        </button>
                        {user?.role === 'admin' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); initiateDeleteTransaction(transaction); }}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Delete Transaction (Admin Only)"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceiptModal && selectedTransaction && (
        <ReceiptModal
          transaction={selectedTransaction}
          onClose={() => {
            setShowReceiptModal(false);
            setSelectedTransaction(null);
          }}
          onPrint={() => {
            setShowReceiptModal(false);
            printReceipt(selectedTransaction);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && transactionToDelete && (
        <DeleteConfirmationModal
          transaction={transactionToDelete}
          onConfirm={confirmDeleteTransaction}
          onCancel={cancelDeleteTransaction}
        />
      )}
    </div>
  );
};

export default SalesScreen; 