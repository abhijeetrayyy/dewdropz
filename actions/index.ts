export {
  signup,
  login,
  logout,
  resetPassword,
  updatePassword,
  signInWithProvider,
  updateProfile,
  getProfile,
  getSession,
  getUser,
  requireAuth,
  requireAdmin,
} from './auth'

export {
  getAllCollectionsAdmin,
  createCollection,
  updateCollection,
  deleteCollection,
} from './collections'

export {
  getNewsletterSubscribers,
  exportNewsletterSubscribersCsv,
} from './newsletter'

export {
  uploadAdminImage,
  deleteAdminImage,
} from './media'

export {
  getProducts,
  getProductBySlug,
  getProductById,
  getCollections,
  getCollectionBySlug,
  getFeaturedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductVariants,
  createProductVariant,
  updateProductVariant,
  archiveProduct,
  getAllProducts,
  toggleProductActive,
  bulkSetProductsActive,
  bulkArchiveProducts,
} from './products'

export {
  addToCart,
  updateCartItemQuantity,
  removeFromCart,
  getCart,
  clearCart,
  mergeGuestCart,
  getCartTotal,
  validateCoupon,
} from './cart'

export {
  createOrder,
  getOrder,
  getOrderByNumber,
  getUserOrders,
  updateOrderStatus,
  updatePaymentStatus,
  getAllOrders,
  addTrackingInfo,
  cancelOrder,
  refundOrder,
  bulkUpdateOrderStatus,
} from './orders'

export {
  getShippingZones,
  createShippingZone,
  updateShippingZone,
  deleteShippingZone,
  createShippingRate,
  updateShippingRate,
  deleteShippingRate,
  calculateShippingCost,
} from './shipping'

export {
  getStoreSettings,
  updateStoreSettings,
} from './settings'

export {
  createAddress,
  updateAddress,
  deleteAddress,
  getAddresses,
  getDefaultAddress,
  setDefaultAddress,
} from './addresses'

export {
  createReview,
  getProductReviews,
  getProductRating,
  getAllReviews,
  approveReview,
  deleteReview,
  subscribeToNewsletter,
  confirmNewsletter,
  unsubscribeFromNewsletter,
} from './reviews'

export {
  createStripeCheckoutSession,
  createRazorpayOrder,
  getPaymentsLedger,
  getPaymentsSummary,
  getWebhookEvents,
} from './payments'

export {
  getAnalyticsSummary,
} from './analytics'

// Admin: coupons
export {
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from './coupons'

// Admin: product taxonomy
export {
  getCategories,
  getCategoryTree,
  getCategoryBySlug,
  getProductCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  setProductCategories,
  reorderCategories,
} from './categories'

export {
  getTags,
  getProductTags,
  createTag,
  updateTag,
  deleteTag,
  setProductTags,
} from './tags'

export {
  getAttributes,
  getAttributeById,
  getProductAttributes,
  createAttribute,
  updateAttribute,
  deleteAttribute,
  createAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  reorderAttributeValues,
  setProductAttributes,
} from './attributes'

export {
  getProductVariantsAdmin,
  generateVariants,
  updateVariant,
  deleteVariant,
  deleteAllVariantsForProduct,
  getInventoryMovements,
  adjustStock,
  getLowStockReport,
} from './variants'
