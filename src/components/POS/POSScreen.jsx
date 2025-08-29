import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { productService, transactionService } from '../../services/api';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { useTheme } from '../../context/ThemeContext';
import { MagnifyingGlassIcon, XMarkIcon, ShoppingCartIcon, BanknotesIcon, CameraIcon } from '@heroicons/react/24/outline';
import { memo, useMemo } from 'react';
import { resolveImageUrl, handleImageError } from '../../utils/imageUtils';
import { useSettings } from '../../context/SettingsContext';

const POSScreen = () => {
  const { t } = useSettings();
  const { colors } = useTheme();

  const [cart, setCart] = useState([]);
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  
  const location = useLocation();
  const { barcodeData, clearBarcodeData } = useGlobalBarcode();
  const processedBarcodeRef = useRef(null);
  const lastNavigationProductRef = useRef(null);

  useEffect(() => {
    loadProducts();
  }, []);

  // Global key handling for POS: Enter opens checkout, Enter in modal submits if valid, Escape closes modal
  useEffect(() => {
    const handleGlobalKeys = (e) => {
      if (e.key === 'Escape') {
        if (showCheckout) {
          e.preventDefault();
          setShowCheckout(false);
        }
        return;
      }
      if (e.key === 'Enter') {
        // If modal open, attempt checkout only when eligible
        if (showCheckout) {
          e.preventDefault();
          const total = calculateTotal();
          const canCheckout = !isProcessing && cart.length > 0 && (
            (paymentMethod === 'cash' && parseFloat(receivedAmount || '0') >= total) ||
            (paymentMethod !== 'cash' && referenceNumber.trim().length > 0)
          );
          if (canCheckout) {
            handleCheckout();
          }
        } else {
          // Open modal if cart has items
          if (cart.length > 0) {
            e.preventDefault();
            setShowCheckout(true);
          }
        }
      }
    };
    document.addEventListener('keydown', handleGlobalKeys, true);
    return () => document.removeEventListener('keydown', handleGlobalKeys, true);
  }, [showCheckout, cart, isProcessing, paymentMethod, receivedAmount, referenceNumber]);

  // Handle global barcode scanning
  useEffect(() => {
    if (barcodeData && barcodeData.product && barcodeData.timestamp) {
      // Prevent processing the same barcode data twice
      if (processedBarcodeRef.current !== barcodeData.timestamp) {
        console.log('POS: Processing barcode data from context:', barcodeData);
        processedBarcodeRef.current = barcodeData.timestamp;
      handleBarcodeScanned(barcodeData.product);
      clearBarcodeData();
      }
    }
  }, [barcodeData]);

  // Handle product passed from navigation (when coming from other pages via barcode)
  useEffect(() => {
    if (location.state?.barcodeProduct) {
      const product = location.state.barcodeProduct;
      // Prevent processing the same navigation product twice
      if (lastNavigationProductRef.current !== product.id) {
        console.log('POS: Processing product from navigation:', product);
        lastNavigationProductRef.current = product.id;
        handleBarcodeScanned(product);
        
      // Clear the state to prevent re-adding on page refresh
        const newState = { ...location.state };
        delete newState.barcodeProduct;
        window.history.replaceState(newState, document.title);
        
        // Reset the navigation ref after a delay to allow quantity increases
        setTimeout(() => {
          lastNavigationProductRef.current = null;
        }, 1000);
      }
    }
  }, [location.state]);

  const loadProducts = async () => {
    try {
      const data = await productService.getAll();
      setProducts(data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Failed to load products');
    }
  };

  const handleBarcodeScanned = async (product) => {
    try {
      console.log('POS: handleBarcodeScanned called with:', product);
      
      // Get the latest product data to ensure stock is current
      const currentProduct = await productService.getById(product.id);
      
      if (currentProduct.quantity > 0) {
        await addToCart(currentProduct);
        toast.success(`${currentProduct.name} added to cart!`, { 
          icon: '✅',
          duration: 1500 
        });
      } else {
        toast.error(`${currentProduct.name} is out of stock`);
      }
    } catch (error) {
      console.error('Error processing barcode in POS:', error);
      toast.error('Error processing barcode');
    }
  };

  const addToCart = async (product) => {
    // Check stock availability in real-time
    try {
      const currentProduct = await productService.getById(product.id);
      const cartItem = cart.find(item => item.id === product.id);
      const currentCartQuantity = cartItem ? cartItem.quantity : 0;
      
      if (currentProduct.quantity <= currentCartQuantity) {
        toast.error(`Insufficient stock. Only ${currentProduct.quantity} available.`);
        return;
      }

      setCart(prevCart => {
        const existingItem = prevCart.find(item => item.id === product.id);
        if (existingItem) {
          return prevCart.map(item =>
            item.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }
        return [...prevCart, { ...product, quantity: 1 }];
      });
    } catch (error) {
      console.error('Error checking stock:', error);
      toast.error('Error checking stock availability');
    }
  };

  const removeFromCart = (productId) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = async (productId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(productId);
      return;
    }

    // Check stock availability in real-time
    try {
      const product = await productService.getById(productId);
      if (product.quantity < newQuantity) {
        toast.error(`Insufficient stock. Only ${product.quantity} available.`);
        return;
      }

      setCart(prevCart =>
        prevCart.map(item =>
          item.id === productId
            ? { ...item, quantity: newQuantity }
            : item
        )
      );
    } catch (error) {
      console.error('Error checking stock:', error);
      toast.error('Error updating quantity');
    }
  };

  const calculateSubtotal = () => {
    return cart.reduce((total, item) => total + (parseFloat(item.price || 0) * item.quantity), 0);
  };

  const calculateTax = (subtotal) => {
    return subtotal * 0.12; // 12% tax
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    return subtotal + calculateTax(subtotal);
  };

  const getChange = () => {
    if (receivedAmount) {
      return parseFloat(receivedAmount) - calculateTotal();
    }
    return 0;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }

    const total = calculateTotal();
    let received = parseFloat(receivedAmount);
    if (paymentMethod === 'cash') {
      if (!received || received < total) {
        toast.error('Insufficient payment amount');
        return;
      }
    } else {
      // Card/GCash: require reference number, auto-set received
      if (!referenceNumber.trim()) {
        toast.error('Please enter the reference number');
        return;
      }
      received = total;
    }

    try {
      setIsProcessing(true);

      // Process transaction
      const transactionData = {
        id: `TXN-${Date.now()}`,
        timestamp: new Date().toISOString(),
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          category: item.category || item.category_name || 'Uncategorized',
          price: parseFloat(item.price || 0),
          quantity: item.quantity,
          subtotal: parseFloat(item.price || 0) * item.quantity
        })),
        subtotal: calculateSubtotal(),
        tax: calculateTax(calculateSubtotal()),
        total: calculateTotal(),
        paymentMethod,
        receivedAmount: received,
        change: paymentMethod === 'cash' ? getChange() : 0,
        referenceNumber: paymentMethod === 'cash' ? undefined : referenceNumber.trim()
      };

      console.log('Transaction data to save:', transactionData);
      
      // Save transaction
      const savedTransaction = await transactionService.create(transactionData);
      console.log('Transaction saved successfully:', savedTransaction);

      // Update inventory in real-time
      console.log('Updating inventory for', cart.length, 'items');
      const inventoryUpdates = cart.map(async (item) => {
        try {
          const currentProduct = await productService.getById(item.id);
          const newQuantity = currentProduct.quantity - item.quantity;
          
          const updatedProduct = await productService.update(item.id, {
            ...currentProduct,
            quantity: Math.max(0, newQuantity)
          });
          console.log(`Updated ${item.name}: ${currentProduct.quantity} -> ${newQuantity}`);
          return updatedProduct;
        } catch (error) {
          console.error(`Error updating inventory for ${item.name}:`, error);
          throw error;
        }
      });

      await Promise.all(inventoryUpdates);
      console.log('All inventory updates completed');

      // Refresh products to reflect updated inventory
      await loadProducts();

      toast.success('Transaction completed successfully!', { 
        duration: 4000,
        icon: '✅' 
      });
      
      // Receipt available in Sales page
      console.log('Receipt data:', transactionData);
      
      // Reset cart and checkout
      setCart([]);
      setShowCheckout(false);
      setReceivedAmount('');
      setReferenceNumber('');
      
    } catch (error) {
      console.error('Error processing transaction:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('Failed to create transaction')) {
        toast.error('Failed to save transaction. Please check server connection.');
      } else if (error.message?.includes('Failed to fetch')) {
        toast.error('Cannot connect to server. Please check if server is running.');
      } else if (error.message?.includes('database')) {
        toast.error('Database error. Please check database connection.');
      } else {
        toast.error(`Transaction failed: ${error.message || 'Unknown error'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualBarcodeSubmit = (e) => {
    e.preventDefault();
    if (manualBarcode.trim()) {
      console.log('Manual barcode input:', manualBarcode.trim());
      
      // Find product by barcode
      const product = products.find(p => 
        p.barcode === manualBarcode.trim() || 
        p.barcode?.toString() === manualBarcode.trim() ||
        p.id?.toString() === manualBarcode.trim()
      );
      
      if (product) {
        console.log('Manual barcode - found product:', product);
        handleBarcodeScanned(product);
        setManualBarcode('');
      } else {
        console.log('Manual barcode - product not found:', manualBarcode.trim());
        toast.error(`Product with barcode "${manualBarcode}" not found`, { icon: '❌' });
      }
    }
  };

  const filteredProducts = useMemo(() => {
    const term = (searchTerm || '').toLowerCase();
    return products.filter(product => {
      const matchesSearch = !term || product.name.toLowerCase().includes(term);
      const matchesCategory = !selectedCategory || product.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const getUniqueCategories = () => {
    const categories = [...new Set(products.map(p => p.category_name))];
    return categories.filter(Boolean);
  };

  const getStockWarning = (product) => {
    if (product.quantity <= 0) return 'Out of stock';
    if (product.quantity <= (product.lowStockThreshold || 10)) return 'Low stock';
    return null;
  };

  const handleProductSelect = (product) => {
    addToCart(product);
  };

  const updateCartItemQuantity = (productId, newQuantity) => {
    updateQuantity(productId, newQuantity);
  };

  const ProductCard = memo(({ product, onSelect }) => {
    const stockWarning = getStockWarning(product);
    const isOutOfStock = stockWarning === 'Out of stock';
    
    return (
      <div
        className={`${colors.card.primary} rounded-lg p-3 cursor-pointer transition-all duration-200 border ${colors.border.primary} ${
          isOutOfStock 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:shadow-lg hover:scale-105'
        }`}
        onClick={() => !isOutOfStock && onSelect(product)}
      >
        <div className="aspect-square mb-2 overflow-hidden rounded-md">
          {product.imageUrl ? (
            <img 
              src={resolveImageUrl(product.imageUrl)} 
              alt={product.name} 
              className="w-full h-full object-cover"
              loading="lazy"
              onError={handleImageError}
            />
          ) : (
            <div className={`w-full h-full ${colors.bg.tertiary} flex items-center justify-center`}>
              <CameraIcon className={`h-6 w-6 ${colors.text.tertiary}`} />
            </div>
          )}
        </div>
        <h3 className={`font-medium text-xs mb-1.5 line-clamp-2 ${colors.text.primary}`}>{product.name}</h3>
        <p className={`text-base font-bold text-blue-600 dark:text-blue-400 mb-0.5`}>₱{parseFloat(product.price || 0).toFixed(2)}</p>
        <p className={`text-[11px] ${colors.text.secondary}`}>Stock: {product.quantity}</p>
        {stockWarning && (
          <p className={`text-[11px] mt-1 ${
            stockWarning === 'Out of stock' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            {stockWarning}
          </p>
        )}
      </div>
    );
  });

  const CartItem = ({ item, onUpdateQuantity, onRemove }) => (
    <div className={`${colors.card.secondary} rounded-md p-3`}>
      <div className="flex items-center justify-between mb-1.5">
        <h3 className={`font-medium text-xs ${colors.text.primary}`}>{item.name}</h3>
        <button
          onClick={() => onRemove(item.id)}
          className="text-red-500 hover:text-red-700 transition-colors"
        >
          <XMarkIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className={`text-xs ${colors.text.secondary} mb-2.5`}>₱{parseFloat(item.price || 0).toFixed(2)} each</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5">
          <button
            className={`w-7 h-7 rounded-md ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary} transition-colors`}
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
          >
            -
          </button>
          <span className={`w-7 text-center text-sm font-medium ${colors.text.primary}`}>{item.quantity}</span>
          <button
            className={`w-7 h-7 rounded-md ${colors.bg.tertiary} ${colors.text.secondary} hover:${colors.text.primary} transition-colors`}
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
          >
            +
          </button>
        </div>
        <span className={`font-semibold text-sm ${colors.text.primary}`}>
          ₱{(parseFloat(item.price || 0) * item.quantity).toFixed(2)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-hidden">
      <div className="h-full max-w-7xl mx-auto px-4 lg:px-6 flex gap-4">
      {/* Left Side - Products */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Search and Filters - Fixed at top */}
        <div className={`${colors.card.primary} rounded-xl p-3 mb-3 shadow-sm border ${colors.border.primary} flex-shrink-0`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-2.5 lg:space-y-0 lg:space-x-3">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <MagnifyingGlassIcon className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${colors.text.tertiary}`} />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg border ${colors.input.primary}`}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div className="flex-1 max-w-xs">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`w-full p-2.5 rounded-lg border ${colors.input.primary}`}
              >
                <option value="">All Categories</option>
                {getUniqueCategories().map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid - Scrollable content */}
        <div className={`flex-1 min-h-0 ${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} overflow-hidden`}>
          <div className="h-full overflow-y-auto p-3 scrollbar-thin">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <CameraIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                <p className={`${colors.text.secondary}`}>No products found</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onSelect={handleProductSelect} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="w-80 flex flex-col h-full">
        <div className={`flex-1 ${colors.card.primary} rounded-xl shadow-sm border ${colors.border.primary} flex flex-col overflow-hidden`}>
          {/* Cart Header */}
          <div className={`p-4 border-b ${colors.border.primary} flex-shrink-0`}>
            <h2 className={`text-lg font-semibold ${colors.text.primary}`}>Current Order</h2>
          </div>

          {/* Cart Items - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCartIcon className={`h-12 w-12 mx-auto mb-4 ${colors.text.tertiary}`} />
                <p className={`${colors.text.secondary}`}>Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <CartItem key={item.id} item={item} onUpdateQuantity={updateCartItemQuantity} onRemove={removeFromCart} />
                ))}
              </div>
            )}
          </div>

          {/* Cart Footer - Fixed at bottom */}
          <div className={`p-4 border-t ${colors.border.primary} flex-shrink-0`}>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${colors.text.secondary}`}>Subtotal</span>
                <span className={`text-sm font-semibold ${colors.text.primary}`}>₱{calculateSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${colors.text.secondary}`}>Tax (12%)</span>
                <span className={`text-sm font-semibold ${colors.text.primary}`}>₱{calculateTax(calculateSubtotal()).toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-base font-medium ${colors.text.primary}`}>Total</span>
                <span className={`text-base font-bold ${colors.text.primary}`}>₱{calculateTotal().toFixed(2)}</span>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                disabled={cart.length === 0}
                className={`w-full py-2.5 px-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg font-medium 
                  hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed
                  transition-colors duration-200`}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`${colors.card.primary} rounded-lg shadow-xl max-w-md w-full mx-4 border ${colors.border.primary}`}>
            <div className={`flex justify-between items-center p-6 border-b ${colors.border.primary}`}>
              <h2 className={`text-xl font-bold ${colors.text.primary}`}>{t('checkout')}</h2>
              <button 
                onClick={() => setShowCheckout(false)}
                className={`${colors.text.tertiary} hover:${colors.text.secondary} transition-colors`}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className={`${colors.bg.secondary} p-4 rounded-lg`}>
                <div className="flex justify-between items-center mb-2">
                  <span className={`font-semibold ${colors.text.primary}`}>{t('total')} Amount:</span>
                  <span className={`text-xl font-bold ${colors.text.primary}`}>₱{calculateTotal().toFixed(2)}</span>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                  {t('paymentMethod')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button type="button" onClick={() => setPaymentMethod('cash')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${paymentMethod === 'cash' ? 'bg-green-50 border-green-500 text-green-700' : 'bg-white/70 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600'}`}>
                    <BanknotesIcon className="h-5 w-5" /> Cash
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('card')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${paymentMethod === 'card' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-white/70 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600'}`}>
                    Card
                  </button>
                  <button type="button" onClick={() => setPaymentMethod('gcash')} className={`flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors ${paymentMethod === 'gcash' ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white/70 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600'}`}>
                    GCash
                  </button>
                </div>
              </div>

              <div>
                {paymentMethod === 'cash' ? (
                  <div>
                    <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                      {t('amountReceived')}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                      placeholder="0.00"
                      value={receivedAmount}
                      onChange={(e) => setReceivedAmount(e.target.value)}
                    />
                    {receivedAmount && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded">
                        <div className="flex justify-between">
                          <span className={colors.text.primary}>{t('change')}:</span>
                          <span className={`font-semibold ${getChange() < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                            ₱{getChange().toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className={`block text-sm font-medium ${colors.text.primary} mb-2`}>
                      Reference Number
                    </label>
                    <input
                      type="text"
                      className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary}`}
                      placeholder="Enter reference number"
                      value={referenceNumber}
                      onChange={(e) => setReferenceNumber(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className={`flex gap-3 p-6 border-t ${colors.border.primary}`}>
              <button
                onClick={() => setShowCheckout(false)}
                className={`flex-1 px-4 py-2 ${colors.text.secondary} border ${colors.border.primary} rounded-lg hover:${colors.bg.secondary} transition-colors`}
                disabled={isProcessing}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleCheckout}
                disabled={isProcessing || getChange() < 0}
                className="flex-1 px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isProcessing ? 'Processing...' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* No post-checkout receipt; view in Sales page */}
      </div>
    </div>
  );
};

export default POSScreen; 