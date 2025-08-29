import { useState, useEffect, useRef } from 'react';
import { XMarkIcon, PhotoIcon, CloudArrowUpIcon, CameraIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { useGlobalBarcode } from '../../context/BarcodeContext';
import { categoryService } from '../../services/api';

const ProductModal = ({ product, onClose, onSave, prefilledBarcode }) => {
  const { colors } = useTheme();
  const { suspendScanning, resumeScanning } = useGlobalBarcode();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Foods', // Default category
    price: '',
    costPrice: '',
    quantity: '',
    lowStockThreshold: '',
    barcode: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [originalImageUrl, setOriginalImageUrl] = useState(null); // Track original image for deletion
  const [isUploading, setIsUploading] = useState(false);
  const [isScanningBarcode, setIsScanningBarcode] = useState(false);
  
  const barcodeBufferRef = useRef('');
  const barcodeTimeoutRef = useRef(null);
  const barcodeInputRef = useRef(null);

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || '',
        description: product.description || '',
        category: product.category || 'Foods',
        price: product.price || '',
        costPrice: product.costPrice || '',
        quantity: product.quantity || '',
        lowStockThreshold: product.lowStockThreshold || '',
        barcode: product.barcode || ''
      });
      
      // Store original image URL for potential deletion
      const originalUrl = product.imageUrl && product.imageUrl.trim() !== '' ? product.imageUrl : null;
      setOriginalImageUrl(originalUrl);
      
      // Set image preview from existing product
      setImagePreview(originalUrl);
      
      // Clear any uploaded file when editing an existing product
      setImageFile(null);
    } else {
      // Reset everything for new product
      setFormData({
        name: '',
        description: '',
        category: 'Foods',
        price: '',
        costPrice: '',
        quantity: '',
        lowStockThreshold: '',
        barcode: prefilledBarcode || '' // Use prefilled barcode from inventory scanning
      });
      setImagePreview(null);
      setImageFile(null);
      setOriginalImageUrl(null);
    }
  }, [product, prefilledBarcode]);

  // Load categories from server
  useEffect(() => {
    const load = async () => {
      try {
        const list = await categoryService.getAll();
        const names = (list || []).map(c => c.name);
        setCategories(names.length ? names : ['Uncategorized']);
        // If current category not in list, set default
        setFormData(prev => ({ ...prev, category: names.includes(prev.category) ? prev.category : (names[0] || 'Uncategorized') }));
      } catch (e) {
        setCategories(['Uncategorized']);
      }
    };
    load();
  }, []);

  // Function to delete old image from server
  const deleteOldImage = async (imageUrl) => {
    if (!imageUrl || !imageUrl.startsWith('/uploads/')) {
      return; // Only delete local uploaded images
    }
    
    try {
      const response = await fetch('/api/delete-image', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        console.log('Old image deleted successfully:', data.message);
      } else {
        console.warn('Failed to delete old image:', data.error);
      }
    } catch (error) {
      console.error('Error deleting old image:', error);
      // Don't fail the entire operation if image deletion fails
    }
  };

  // Barcode scanning functionality
  useEffect(() => {
    const handleBarcodeKeyDown = (event) => {
      if (!isScanningBarcode) return;

      // Don't interfere with other input fields
      if (event.target !== barcodeInputRef.current && 
          (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA')) {
        return;
      }

      // Clear previous timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Handle Enter key (end of barcode scan)
      if (event.key === 'Enter') {
        event.preventDefault();
        if (barcodeBufferRef.current.length > 6) {
          setFormData(prev => ({
            ...prev,
            barcode: barcodeBufferRef.current.trim()
          }));
          toast.success('Barcode scanned successfully!', { icon: '📦' });
          barcodeBufferRef.current = '';
          setIsScanningBarcode(false);
        }
        return;
      }

      // Handle regular characters for barcode
      if (/^[a-zA-Z0-9]$/.test(event.key)) {
        event.preventDefault();
        barcodeBufferRef.current += event.key;
        
        // Auto-submit after 100ms of no input
        barcodeTimeoutRef.current = setTimeout(() => {
          if (barcodeBufferRef.current.length > 6) {
            setFormData(prev => ({
              ...prev,
              barcode: barcodeBufferRef.current.trim()
            }));
            toast.success('Barcode scanned successfully!', { icon: '📦' });
            barcodeBufferRef.current = '';
            setIsScanningBarcode(false);
          } else {
            barcodeBufferRef.current = '';
          }
        }, 100);
      }
    };

    if (isScanningBarcode) {
      window.addEventListener('keydown', handleBarcodeKeyDown);
      // Focus on barcode input when scanning starts
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }

    return () => {
      window.removeEventListener('keydown', handleBarcodeKeyDown);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [isScanningBarcode]);

  const toggleBarcodeScanning = () => {
    setIsScanningBarcode(!isScanningBarcode);
    barcodeBufferRef.current = '';
    if (!isScanningBarcode) {
      toast.success('Barcode scanning started. Scan or type barcode.', { icon: '🔍' });
    } else {
      toast.info('Barcode scanning stopped.', { icon: '⏹️' });
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      setImageFile(file);
      
      // Create preview from uploaded file
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToServer = async () => {
    if (!imageFile) return null;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        // Handle specific error codes
        switch (data.code) {
          case 'FILE_TOO_LARGE':
            throw new Error('Image is too large. Please choose an image smaller than 5MB.');
          case 'INVALID_FILE_TYPE':
            throw new Error('Invalid file type. Please choose a JPG, PNG, or GIF image.');
          case 'NO_FILE':
            throw new Error('No image file was selected.');
          default:
            throw new Error(data.error || 'Failed to upload image');
        }
      }
      
      return data.imageUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      let finalFormData = { ...formData };
      let newImageUploaded = false;
      
      // Handle image logic
      if (imageFile) {
        // New file uploaded - upload it first
        const uploadedImageUrl = await uploadImageToServer();
        if (uploadedImageUrl) {
          finalFormData.imageUrl = uploadedImageUrl;
          newImageUploaded = true;
        }
      } else if (originalImageUrl && imagePreview === originalImageUrl) {
        // No new upload, keep existing image URL
        finalFormData.imageUrl = originalImageUrl;
      } else if (!imagePreview) {
        // No image at all
        finalFormData.imageUrl = '';
      }
      
      // Call the save function
      await onSave(finalFormData);
      
      // After successful save, delete old image if a new one was uploaded
      if (newImageUploaded && originalImageUrl && originalImageUrl !== finalFormData.imageUrl) {
        await deleteOldImage(originalImageUrl);
      }
      
      // Success notification will be handled by parent component
      
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Error saving product. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 dark:bg-black bg-opacity-50 dark:bg-opacity-50 flex items-center justify-center z-50" onMouseEnter={suspendScanning} onMouseLeave={resumeScanning}>
      <div className={`${colors.card.primary} rounded-lg p-8 max-w-2xl w-full border ${colors.border.primary} shadow-xl`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-2xl font-bold ${colors.text.primary}`}>
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button
            onClick={onClose}
            className={`${colors.text.secondary} hover:${colors.text.primary} transition-colors`}
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="name">
                Product Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                required
              />
            </div>

            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="category">
                Category
              </label>
              <select
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                required
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="price">
                Price (₱)
              </label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="costPrice">
                Cost Price (₱)
              </label>
              <input
                type="number"
                id="costPrice"
                name="costPrice"
                value={formData.costPrice}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="quantity">
                Quantity
              </label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                min="0"
                required
              />
            </div>

            <div>
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="lowStockThreshold">
                Low Stock Alert
              </label>
              <input
                type="number"
                id="lowStockThreshold"
                name="lowStockThreshold"
                value={formData.lowStockThreshold}
                onChange={handleChange}
                className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                min="0"
                required
              />
            </div>

            <div className="col-span-2">
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="barcode">
                Barcode
              </label>
              <div className="flex space-x-2">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  id="barcode"
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  className={`flex-1 border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="Scan or enter barcode"
                />
                <button
                  type="button"
                  onClick={toggleBarcodeScanning}
                  className={`px-4 py-2 border rounded-lg transition-colors ${
                    isScanningBarcode 
                      ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-300 dark:border-green-600' 
                      : `${colors.bg.secondary} ${colors.text.secondary} border-gray-300 dark:border-gray-600 hover:${colors.text.primary}`
                  }`}
                >
                  {isScanningBarcode ? 'Stop Scan' : 'Start Scan'}
                </button>
              </div>
              {isScanningBarcode && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                  🔍 Barcode scanning active - point scanner at barcode or type manually
                </p>
              )}
              {prefilledBarcode && !product && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  ✅ Barcode "{prefilledBarcode}" was scanned from inventory page
                </p>
              )}
            </div>

            <div className="col-span-2">
              <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`}>
                Product Image
              </label>
              <div className="space-y-4">
                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative">
                    <img 
                      src={imagePreview} 
                      alt="Product preview" 
                      className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600"
                    />
                    <button
                      type="button"
                      onClick={removeImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <XMarkIcon className="h-4 w-4" />
                    </button>
                  </div>
                )}
                
                {/* Upload Controls */}
                <div className="flex gap-4">
                  <div>
                    <input
                      type="file"
                      id="imageFile"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="imageFile"
                      className="flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-600 cursor-pointer transition-colors"
                    >
                      <CloudArrowUpIcon className="h-5 w-5 mr-2" />
                      Upload Image
                    </label>
                  </div>
                  
                  <div className={`text-sm ${colors.text.secondary} flex items-center`}>
                    <PhotoIcon className="h-4 w-4 mr-1" />
                    Max 5MB, JPG/PNG
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className={`form-label text-sm font-medium ${colors.text.primary} mb-1 block`} htmlFor="description">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              className={`w-full border rounded-lg px-3 py-2 ${colors.input.primary} focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
              rows="3"
            />
          </div>

          <div className="flex justify-end space-x-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 border ${colors.border.primary} rounded-lg ${colors.text.secondary} hover:${colors.bg.secondary} transition-colors`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isUploading ? 'Uploading...' : (product ? 'Update' : 'Create') + ' Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal; 