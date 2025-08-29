/**
 * Resolves the correct image URL for display
 * @param {string} imageUrl - The image URL from the database
 * @returns {string} - The resolved image URL
 */
export const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) {
    return '/placeholder-product.svg';
  }
  
  // If it's already a full URL (http/https), return as is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // If it's a local upload path, prepend the API base URL in production
  // In development, Vite proxy will handle this
  if (imageUrl.startsWith('/uploads/')) {
    // In development, the proxy will handle /uploads requests
    // In production, you might need to adjust this based on your deployment
    return imageUrl;
  }
  
  // Fallback to placeholder
  return '/placeholder-product.svg';
};

/**
 * Handles image load errors by setting a placeholder
 * @param {Event} event - The image error event
 */
export const handleImageError = (event) => {
  event.target.src = '/placeholder-product.svg';
  event.target.onerror = null; // Prevent infinite loop
}; 