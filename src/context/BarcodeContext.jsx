import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { productService } from '../services/api';
import { debounce } from '../utils/debounce';

const BarcodeContext = createContext();

export const BarcodeProvider = ({ children }) => {
  const [barcodeData, setBarcodeData] = useState(null);
  const [isScanning, setIsScanning] = useState(true); // Always scanning
  const suspendedCountRef = useRef(0);
  const [products, setProducts] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const bufferRef = useRef('');
  const timeoutRef = useRef(null);
  const isProcessingRef = useRef(false);
  const lastProcessedRef = useRef('');
  const lastProcessedTimeRef = useRef(0);
  const lastRefreshRef = useRef(0);

  // Create a debounced version of loadProducts
  const debouncedLoadProducts = useCallback(
    debounce(async () => {
      const now = Date.now();
      // Only refresh if it's been more than 2 seconds since last refresh
      if (now - lastRefreshRef.current < 2000) {
        console.log('BarcodeContext: Skipping refresh, too soon since last refresh');
        return;
      }
      
      try {
        console.log('BarcodeContext: Refreshing products...');
        const data = await productService.getAll();
        const productList = data || [];
        console.log('BarcodeContext: Loaded', productList.length, 'products');
        console.log('BarcodeContext: Product list:', productList.map(p => ({ name: p.name, barcode: p.barcode, id: p.id })));
        setProducts(productList);
        lastRefreshRef.current = now;
      } catch (error) {
        console.error('BarcodeContext: Error loading products for barcode scanning:', error);
      }
    }, 500), // 500ms debounce
    []
  );

  // Load products on mount
  useEffect(() => {
    debouncedLoadProducts();
  }, [debouncedLoadProducts]);

  // Expose the debounced version as loadProducts
  const loadProducts = debouncedLoadProducts;

  // Global barcode scanning handler
  const handleKeyDown = (event) => {
    // Suspend scanning when requested by UI
    if (suspendedCountRef.current > 0) {
      return;
    }
    // Don't interfere with input fields, textareas, or editable content
    if (
      event.target.tagName === 'INPUT' || 
      event.target.tagName === 'TEXTAREA' || 
      event.target.isContentEditable ||
      event.target.getAttribute('role') === 'textbox'
    ) {
      return;
    }

    // Exclude inventory page from global scanning (it has its own barcode handling)
    if (location.pathname === '/inventory') {
      return;
    }

    // Don't process if already processing a barcode
    if (isProcessingRef.current) {
      return;
    }

    // Ignore special keys except Enter
    if (event.key.length > 1 && event.key !== 'Enter') {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Handle Enter key (end of barcode scan)
    if (event.key === 'Enter') {
      event.preventDefault();
      const barcode = bufferRef.current.trim();
      if (barcode.length >= 4) { // Minimum barcode length
        console.log('Enter key detected, processing barcode:', barcode);
        processBarcodeData(barcode);
      }
      bufferRef.current = '';
      return;
    }

    // Handle regular characters (alphanumeric and some special chars for barcodes)
    if (/^[a-zA-Z0-9\-_.]$/.test(event.key)) {
      bufferRef.current += event.key;
      console.log('Building barcode:', bufferRef.current);
      
      // Auto-submit after 150ms of no input (typical for barcode scanners)
      timeoutRef.current = setTimeout(() => {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= 4) { // Minimum barcode length
          console.log('Auto-submitting barcode after timeout:', barcode);
          processBarcodeData(barcode);
        } else {
          console.log('Clearing short buffer:', barcode);
        }
        bufferRef.current = '';
      }, 150);
    }
  };

  const processBarcodeData = async (barcode) => {
    // Prevent duplicate processing with shorter timeout for same page
    const now = Date.now();
    const duplicateTimeout = location.pathname === '/pos' ? 500 : 2000; // Shorter timeout for POS page
    
    if (
      isProcessingRef.current || 
      (lastProcessedRef.current === barcode && (now - lastProcessedTimeRef.current) < duplicateTimeout)
    ) {
      console.log('Skipping duplicate barcode processing:', barcode, 'timeout:', duplicateTimeout);
      return;
    }
    
    try {
      isProcessingRef.current = true;
      lastProcessedRef.current = barcode;
      lastProcessedTimeRef.current = now;
      
      console.log('Processing barcode:', barcode);
      console.log('Available products for matching:', products.map(p => ({ name: p.name, barcode: p.barcode, id: p.id })));
      
      // Find product by barcode
      const product = products.find(p => {
        const matches = p.barcode === barcode || 
                       p.barcode?.toString() === barcode ||
                       p.id?.toString() === barcode;
        console.log(`Checking product ${p.name}: barcode=${p.barcode}, matches=${matches}`);
        return matches;
      });
      
      console.log('Found product:', product);
      
      if (product) {
        // Check stock
        if (product.quantity <= 0) {
          toast.error(`${product.name} is out of stock`, { icon: '❌' });
          return;
        }

        // Navigate to POS if not already there (but don't add to cart yet)
        if (location.pathname !== '/pos') {
          toast.success(`Product found: ${product.name}. Navigating to POS...`, { 
            icon: '📦',
            duration: 2000 
          });
          // Only navigate, let POS screen handle adding to cart
          navigate('/pos', { state: { barcodeProduct: product } });
        } else {
          // If already on POS, set the barcode data for the POS screen to handle
          setBarcodeData({ barcode, product, timestamp: now });
          toast.success(`${product.name} found`, { icon: '📦', duration: 1000 });
        }
      } else {
        console.log(`No product found with barcode "${barcode}"`);
        toast.error(`Product with barcode "${barcode}" not found`, { 
          icon: '❌',
          duration: 3000 
        });
      }
    } catch (error) {
      console.error('Error processing barcode:', error);
      toast.error('Error processing barcode');
    } finally {
      // Reset processing flag after a shorter delay
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    }
  };

  // Inventory-specific barcode handler
  const handleInventoryBarcode = (barcode) => {
    console.log('Inventory barcode scan:', barcode);
    console.log('BarcodeContext: Current products count:', products.length);
    console.log('BarcodeContext: Checking against products:', products.map(p => ({ name: p.name, barcode: p.barcode, id: p.id })));
    
    // Check if product already exists
    const existingProduct = products.find(p => 
      p.barcode === barcode || 
      p.barcode?.toString() === barcode ||
      p.id?.toString() === barcode
    );
    
    if (existingProduct) {
      console.log('BarcodeContext: Found existing product:', existingProduct.name);
      toast.error(`Product "${existingProduct.name}" already exists with this barcode`, { 
        icon: '⚠️',
        duration: 3000 
      });
    } else {
      console.log('BarcodeContext: No existing product found, proceeding to add new product');
      toast.success(`New barcode scanned: ${barcode}. Opening add product form...`, { 
        icon: '✅',
        duration: 2000 
      });
      // Navigate to add product with barcode pre-filled
      navigate('/inventory?action=add&barcode=' + encodeURIComponent(barcode));
    }
  };

  // Special handling for inventory page
  const handleInventoryKeyDown = (event) => {
    if (suspendedCountRef.current > 0) {
      return;
    }
    // Don't interfere with input fields, textareas, or editable content
    if (
      event.target.tagName === 'INPUT' || 
      event.target.tagName === 'TEXTAREA' || 
      event.target.isContentEditable ||
      event.target.getAttribute('role') === 'textbox'
    ) {
      return;
    }

    // Don't process if already processing a barcode
    if (isProcessingRef.current) {
      return;
    }

    // Ignore special keys except Enter
    if (event.key.length > 1 && event.key !== 'Enter') {
      return;
    }

    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Handle Enter key (end of barcode scan)
    if (event.key === 'Enter') {
      event.preventDefault();
      const barcode = bufferRef.current.trim();
      if (barcode.length >= 4) {
        console.log('Inventory page - Enter key detected, processing barcode:', barcode);
        handleInventoryBarcode(barcode);
      }
      bufferRef.current = '';
      return;
    }

    // Handle regular characters
    if (/^[a-zA-Z0-9\-_.]$/.test(event.key)) {
      bufferRef.current += event.key;
      console.log('Inventory page - Building barcode:', bufferRef.current);
      
      // Auto-submit after 150ms of no input
      timeoutRef.current = setTimeout(() => {
        const barcode = bufferRef.current.trim();
        if (barcode.length >= 4) {
          console.log('Inventory page - Auto-submitting barcode after timeout:', barcode);
          handleInventoryBarcode(barcode);
        } else {
          console.log('Inventory page - Clearing short buffer:', barcode);
        }
        bufferRef.current = '';
      }, 150);
    }
  };

  const clearBarcodeData = () => {
    setBarcodeData(null);
  };

  // Add global keyboard event listener
  useEffect(() => {
    const handleGlobalKeyDown = (event) => {
      if (location.pathname === '/inventory') {
        handleInventoryKeyDown(event);
      } else {
        handleKeyDown(event);
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [products, location.pathname]);

  // Clear barcode data after processing
  useEffect(() => {
    if (barcodeData) {
      const timer = setTimeout(() => {
        setBarcodeData(null);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [barcodeData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const value = {
    barcodeData,
    isScanning,
    clearBarcodeData,
    refreshProducts: loadProducts,
    manualScan: processBarcodeData, // For manual testing
    inventoryBarcodeScan: handleInventoryBarcode, // For inventory page
    suspendScanning: () => { suspendedCountRef.current += 1; },
    resumeScanning: () => { suspendedCountRef.current = Math.max(0, suspendedCountRef.current - 1); }
  };

  return (
    <BarcodeContext.Provider value={value}>
      {children}
    </BarcodeContext.Provider>
  );
};

export const useGlobalBarcode = () => {
  const context = useContext(BarcodeContext);
  if (!context) {
    throw new Error('useGlobalBarcode must be used within a BarcodeProvider');
  }
  return context;
}; 