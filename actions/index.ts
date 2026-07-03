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
} from './orders'

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
  subscribeToNewsletter,
  confirmNewsletter,
  unsubscribeFromNewsletter,
} from './reviews'

export {
  createStripeCheckoutSession,
  createRazorpayOrder,
} from './payments'
