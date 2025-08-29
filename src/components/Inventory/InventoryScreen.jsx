import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  ExclamationTriangleIcon, 
  ClipboardDocumentListIcon, 
  ArrowPathIcon, 
  CubeIcon, 
  MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon,
  EyeIcon,
  ChevronDownIcon,
  FunnelIcon,
  ViewColumnsIcon,
  Squares2X2Icon,
  ListBulletIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';
import ProductModal from './ProductModal';
import InventoryAuditModal from './InventoryAuditModal';
import { productService } from '../../services/api';
import { resolveImageUrl, handleImageError } from '../../utils/imageUtils';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { useTheme } from '../../context/ThemeContext';

const InventoryScreen = () => {
  console.log('InventoryScreen rendering');
  
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshProducts: refreshBarcodeProducts } = useGlobalBarcode();
  const { colors } = useTheme();
  
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    priceRange: '',
    stockStatus: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Handle URL parameters for barcode scanning
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const action = urlParams.get('action');
    const barcode = urlParams.get('barcode');
    
    if (action === 'add' && barcode) {
      console.log('Opening add product modal with barcode:', barcode);
      setPrefilledBarcode(barcode);
      setSelectedProduct(null);
      setIsModalOpen(true);
      
      // Clear URL parameters to prevent reopening on refresh
      navigate('/inventory', { replace: true });
    }
  }, [location.search, navigate]);

  const checkLowStock = useCallback((productList) => {
    const lowStock = productList.filter(product => 
      product.quantity <= (product.lowStockThreshold || 10)
    );
    setLowStockProducts(lowStock);
    
    // Show alert only for critical stock levels
    const criticalStock = lowStock.filter(product => product.quantity <= 5);
    if (criticalStock.length > 0) {
      toast.error(`Critical: ${criticalStock.length} products are critically low in stock!`, {
        duration: 8000,
        icon: '⚠️',
        id: 'critical-low-stock'
      });
    }
  }, []);

  const loadProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await productService.getAll();
      console.log('Products loaded:', data);
      const productList = data || [];
      setProducts(productList);
      checkLowStock(productList);
      setLastRefresh(new Date());
      
      // Also refresh barcode context products to keep them in sync
      await refreshBarcodeProducts();
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [checkLowStock, refreshBarcodeProducts]);

  useEffect(() => {
    loadProducts();
    
    // Set up real-time monitoring - refresh every 2 minutes instead of 30 seconds
    const interval = setInterval(() => {
      loadProducts();
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, [loadProducts]);

  const handleAddProduct = async (productData) => {
    try {
      console.log('Adding product:', productData);
      const newProduct = await productService.create(productData);
      console.log('Product added:', newProduct);
      const updatedProducts = [...products, newProduct];
      setProducts(updatedProducts);
      checkLowStock(updatedProducts);
      
      // Refresh barcode context products
      await refreshBarcodeProducts();
      
      toast.success('Product added successfully');
      setIsModalOpen(false);
      setPrefilledBarcode('');
    } catch (error) {
      console.error('Error adding product:', error);
      toast.error('Error adding product');
    }
  };

  const handleEditProduct = async (productData) => {
    try {
      console.log('Editing product:', productData);
      const updatedProduct = await productService.update(selectedProduct.id, productData);
      const updatedProducts = products.map(p => p.id === selectedProduct.id ? updatedProduct : p);
      setProducts(updatedProducts);
      checkLowStock(updatedProducts);
      
      // Refresh barcode context products
      await refreshBarcodeProducts();
      
      toast.success('Product updated successfully');
      setIsModalOpen(false);
      setSelectedProduct(null);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Error updating product');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        console.log('Deleting product:', productId);
        await productService.delete(productId);
        const updatedProducts = products.filter(p => p.id !== productId);
        setProducts(updatedProducts);
        checkLowStock(updatedProducts);
        
        // Refresh barcode context products
        await refreshBarcodeProducts();
        
        toast.success('Product deleted successfully');
      } catch (error) {
        console.error('Error deleting product:', error);
        toast.error('Error deleting product');
      }
    }
  };

  const handleAuditComplete = (auditData) => {
    // Process audit results and update inventory
    loadProducts();
    setIsAuditModalOpen(false);
    toast.success('Inventory audit completed successfully');
  };

  const getStockStatus = (product) => {
    if (product.quantity <= 0) return { status: 'Out of Stock', color: 'text-red-600', bg: 'bg-red-50' };
    if (product.quantity <= (product.lowStockThreshold || 10)) return { status: 'Low Stock', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { status: 'In Stock', color: 'text-green-600', bg: 'bg-green-50' };
  };

  // Ensure products is always an array
  const safeProducts = Array.isArray(products) ? products : [];
  console.log('Current products:', safeProducts);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredProducts = safeProducts.filter(product => {
    // Search filter
    if (debouncedSearch && !product.name.toLowerCase().includes(debouncedSearch.toLowerCase()) &&
        !product.barcode?.toLowerCase().includes(debouncedSearch.toLowerCase())) {
      return false;
    }
    
    // Category filter
    if (filters.category && product.category_name !== filters.category) return false;
    
    // Stock status filter
    if (filters.stockStatus) {
      if (filters.stockStatus === 'inStock' && product.quantity <= 0) return false;
      if (filters.stockStatus === 'outOfStock' && product.quantity > 0) return false;
      if (filters.stockStatus === 'lowStock' && product.quantity > (product.lowStockThreshold || 10)) return false;
    }
    
    return true;
  });

  const getUniqueCategories = () => {
    const categories = safeProducts.map(p => p.category_name).filter(Boolean);
    return [...new Set(categories)];
  };

  const getInventoryStats = () => {
    const totalProducts = filteredProducts.length;
    const lowStock = filteredProducts.filter(p => p.quantity <= (p.lowStockThreshold || 10)).length;
    const outOfStock = filteredProducts.filter(p => p.quantity <= 0).length;
    const inStock = totalProducts - outOfStock;
    
    return { totalProducts, lowStock, outOfStock, inStock };
  };

  const stats = getInventoryStats();

  const ProductCard = ({ product }) => {
    const stockInfo = getStockStatus(product);
    
    return (
              <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden hover:shadow-lg transition-all duration-300 group`}>
        <div className="aspect-w-16 aspect-h-9 bg-slate-100 relative overflow-hidden">
          {product.imageUrl ? (
            <img
              src={resolveImageUrl(product.imageUrl)}
              alt={product.name}
              className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={handleImageError}
            />
          ) : (
            <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
              <CubeIcon className="h-16 w-16 text-slate-400" />
            </div>
          )}
          <div className="absolute top-3 right-3">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockInfo.bg} ${stockInfo.color}`}>
              {stockInfo.status}
            </span>
          </div>
        </div>
        
        <div className="p-6">
          <div className="mb-4">
            <h3 className={`font-semibold ${colors.text.primary} text-lg mb-1 line-clamp-2`}>{product.name}</h3>
            <p className={`text-sm ${colors.text.secondary}`}>{product.category_name || 'Uncategorized'}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Price</p>
              <p className={`font-semibold ${colors.text.primary}`}>₱{parseFloat(product.price || 0).toFixed(2)}</p>
            </div>
            <div>
              <p className={`text-sm ${colors.text.secondary}`}>Stock</p>
              <p className={`font-semibold ${stockInfo.color}`}>
                {product.quantity || 0}
                {product.quantity <= (product.lowStockThreshold || 10) && (
                  <ExclamationTriangleIcon className="inline h-4 w-4 ml-1" />
                )}
              </p>
            </div>
          </div>
          
          {product.barcode && (
            <div className={`mb-4 p-2 ${colors.bg.secondary} rounded-lg`}>
              <p className={`text-xs ${colors.text.secondary}`}>Barcode</p>
              <p className={`font-mono text-sm ${colors.text.primary}`}>{product.barcode}</p>
            </div>
          )}
          
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setSelectedProduct(product);
                setIsModalOpen(true);
              }}
              className="flex-1 px-3 py-2 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <PencilIcon className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => handleDeleteProduct(product.id)}
              className="flex-1 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors text-sm font-medium flex items-center justify-center space-x-1"
            >
              <TrashIcon className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TableView = () => (
            <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className={`min-w-full divide-y ${colors.border.primary}`}>
          <thead className={`${colors.bg.secondary}`}>
            <tr>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Product
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Category
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Price
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Stock
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Status
              </th>
              <th className={`px-6 py-4 text-left text-xs font-medium ${colors.text.secondary} uppercase tracking-wider`}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className={`${colors.card.primary} divide-y ${colors.border.primary}`}>
            {filteredProducts.map((product) => {
              const stockInfo = getStockStatus(product);
              return (
                <tr key={product.id} className={`hover:${colors.bg.secondary} transition-colors`}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        {product.imageUrl ? (
                          <img
                            src={resolveImageUrl(product.imageUrl)}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover"
                            onError={handleImageError}
                          />
                        ) : (
                          <div className={`h-10 w-10 ${colors.bg.secondary} rounded-lg flex items-center justify-center`}>
                            <CubeIcon className={`h-6 w-6 ${colors.text.tertiary}`} />
                          </div>
                        )}
                      </div>
                      <div className="ml-4">
                        <div className={`text-sm font-medium ${colors.text.primary}`}>{product.name}</div>
                        {product.barcode && (
                          <div className={`text-sm ${colors.text.secondary}`}>{product.barcode}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm ${colors.text.secondary}`}>
                    {product.category_name || 'Uncategorized'}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${colors.text.primary}`}>
                    ₱{parseFloat(product.price || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <span className={stockInfo.color}>
                      {product.quantity || 0}
                      {product.quantity <= (product.lowStockThreshold || 10) && (
                        <ExclamationTriangleIcon className="inline h-4 w-4 ml-1" />
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${stockInfo.bg} ${stockInfo.color}`}>
                      {stockInfo.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsModalOpen(true);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 transition-colors p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title="Edit Product"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete Product"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-6"></div>
          <p className={`text-lg font-medium ${colors.text.primary}`}>Loading inventory...</p>
          <p className={`text-sm ${colors.text.secondary} mt-2`}>Please wait while we fetch your products</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Total Products</p>
              <p className="text-3xl font-bold">{stats.totalProducts}</p>
            </div>
            <CubeIcon className="h-10 w-10 text-blue-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium">In Stock</p>
              <p className="text-3xl font-bold">{stats.inStock}</p>
            </div>
            <CheckCircleIcon className="h-10 w-10 text-green-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm font-medium">Low Stock</p>
              <p className="text-3xl font-bold">{stats.lowStock}</p>
            </div>
            <ExclamationTriangleIcon className="h-10 w-10 text-amber-200" />
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium">Out of Stock</p>
              <p className="text-3xl font-bold">{stats.outOfStock}</p>
            </div>
            <XCircleIcon className="h-10 w-10 text-red-200" />
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-6`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          {/* Left side - Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 ${colors.text.tertiary}`} />
              <input
                type="text"
                placeholder="Search products, barcodes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
              />
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${
                showFilters 
                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400' 
                  : `${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`
              }`}
            >
              <AdjustmentsHorizontalIcon className="h-5 w-5" />
              <span>Filters</span>
            </button>

            <div className={`flex items-center rounded-xl p-1 ${colors.bg.tertiary}`}>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'grid' 
                    ? `${colors.card.primary} text-blue-600 dark:text-blue-400 shadow-sm` 
                    : `${colors.text.secondary} hover:${colors.text.primary}`
                }`}
              >
                <Squares2X2Icon className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  viewMode === 'table' 
                    ? `${colors.card.primary} text-blue-600 dark:text-blue-400 shadow-sm` 
                    : `${colors.text.secondary} hover:${colors.text.primary}`
                }`}
              >
                <ListBulletIcon className="h-5 w-5" />
              </button>
            </div>

            <button
              onClick={loadProducts}
              className={`px-4 py-2 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
            >
              <ArrowPathIcon className="h-5 w-5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add Product</span>
            </button>

            <button
              onClick={() => setIsAuditModalOpen(true)}
              className="px-4 py-2 bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/30 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2"
            >
              <ClipboardDocumentListIcon className="h-5 w-5" />
              <span>Audit</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className={`mt-6 pt-6 border-t ${colors.border.primary}`}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters({...filters, category: e.target.value})}
                  className={`w-full p-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
                >
                  <option value="">All Categories</option>
                  {getUniqueCategories().map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${colors.text.primary}`}>Stock Status</label>
                <select
                  value={filters.stockStatus}
                  onChange={(e) => setFilters({...filters, stockStatus: e.target.value})}
                  className={`w-full p-3 rounded-xl border transition-all duration-200 ${colors.input.primary}`}
                >
                  <option value="">All Status</option>
                  <option value="inStock">In Stock</option>
                  <option value="lowStock">Low Stock</option>
                  <option value="outOfStock">Out of Stock</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ category: '', priceRange: '', stockStatus: '' })}
                  className={`w-full px-4 py-3 rounded-xl font-medium transition-all duration-200 ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary}`}
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {filteredProducts.length === 0 ? (
        <div className={`${colors.card.primary} rounded-2xl shadow-sm border ${colors.border.primary} p-12 text-center`}>
          <CubeIcon className={`h-16 w-16 mx-auto mb-4 ${colors.text.tertiary}`} />
          <h3 className={`text-xl font-semibold mb-2 ${colors.text.primary}`}>No products found</h3>
          <p className={`mb-6 ${colors.text.secondary}`}>
            {searchTerm || filters.category || filters.stockStatus 
              ? 'Try adjusting your search or filters'
              : 'Get started by adding your first product'
            }
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 rounded-xl font-medium transition-all duration-200 flex items-center space-x-2 mx-auto"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add Product</span>
          </button>
        </div>
      ) : (
        <>
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <TableView />
          )}
        </>
      )}

      {/* Modals */}
      {isModalOpen && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
            setPrefilledBarcode('');
          }}
          onSave={selectedProduct ? handleEditProduct : handleAddProduct}
          product={selectedProduct}
          prefilledBarcode={prefilledBarcode}
        />
      )}

      {isAuditModalOpen && (
        <InventoryAuditModal
          isOpen={isAuditModalOpen}
          onClose={() => setIsAuditModalOpen(false)}
          onComplete={handleAuditComplete}
          products={safeProducts}
        />
      )}
    </div>
  );
};

export default InventoryScreen; 