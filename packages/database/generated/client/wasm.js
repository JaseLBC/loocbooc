
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.UserScalarFieldEnum = {
  id: 'id',
  email: 'email',
  emailVerified: 'emailVerified',
  phone: 'phone',
  fullName: 'fullName',
  displayName: 'displayName',
  avatarUrl: 'avatarUrl',
  role: 'role',
  status: 'status',
  stripeCustomerId: 'stripeCustomerId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  lastLoginAt: 'lastLoginAt'
};

exports.Prisma.BrandScalarFieldEnum = {
  id: 'id',
  ownerUserId: 'ownerUserId',
  name: 'name',
  slug: 'slug',
  description: 'description',
  logoUrl: 'logoUrl',
  websiteUrl: 'websiteUrl',
  country: 'country',
  currency: 'currency',
  shopifyStoreUrl: 'shopifyStoreUrl',
  shopifyAccessToken: 'shopifyAccessToken',
  stripeAccountId: 'stripeAccountId',
  verified: 'verified',
  tier: 'tier',
  settings: 'settings',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BrandMemberScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  userId: 'userId',
  role: 'role',
  createdAt: 'createdAt'
};

exports.Prisma.GarmentScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  name: 'name',
  styleCode: 'styleCode',
  category: 'category',
  subcategory: 'subcategory',
  gender: 'gender',
  season: 'season',
  year: 'year',
  description: 'description',
  techPackId: 'techPackId',
  status: 'status',
  tags: 'tags',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SKUScalarFieldEnum = {
  id: 'id',
  garmentId: 'garmentId',
  skuCode: 'skuCode',
  colour: 'colour',
  colourCode: 'colourCode',
  size: 'size',
  sizeSystem: 'sizeSystem',
  barcode: 'barcode',
  targetCost: 'targetCost',
  actualCost: 'actualCost',
  rrp: 'rrp',
  weightGrams: 'weightGrams',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ManufacturerScalarFieldEnum = {
  id: 'id',
  ownerUserId: 'ownerUserId',
  name: 'name',
  slug: 'slug',
  description: 'description',
  logoUrl: 'logoUrl',
  country: 'country',
  city: 'city',
  specialisations: 'specialisations',
  certifications: 'certifications',
  minOrderQty: 'minOrderQty',
  maxCapacityUnits: 'maxCapacityUnits',
  leadTimeDaysMin: 'leadTimeDaysMin',
  leadTimeDaysMax: 'leadTimeDaysMax',
  priceTier: 'priceTier',
  verified: 'verified',
  verifiedAt: 'verifiedAt',
  ratingAvg: 'ratingAvg',
  ratingCount: 'ratingCount',
  active: 'active',
  stripeAccountId: 'stripeAccountId',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AvatarScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  nickname: 'nickname',
  height: 'height',
  weightKg: 'weightKg',
  bust: 'bust',
  waist: 'waist',
  hips: 'hips',
  inseam: 'inseam',
  shoulderWidth: 'shoulderWidth',
  sleeveLength: 'sleeveLength',
  neck: 'neck',
  chest: 'chest',
  thigh: 'thigh',
  rise: 'rise',
  bodyShape: 'bodyShape',
  fitPreference: 'fitPreference',
  avatar3dUrl: 'avatar3dUrl',
  avatarImgUrl: 'avatarImgUrl',
  sizeAu: 'sizeAu',
  sizeUs: 'sizeUs',
  sizeEu: 'sizeEu',
  measurementMethod: 'measurementMethod',
  confidenceScore: 'confidenceScore',
  isPrimary: 'isPrimary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AvatarFitResultScalarFieldEnum = {
  id: 'id',
  avatarId: 'avatarId',
  skuId: 'skuId',
  fitScore: 'fitScore',
  fitNotes: 'fitNotes',
  recommendedSize: 'recommendedSize',
  renderUrl: 'renderUrl',
  createdAt: 'createdAt'
};

exports.Prisma.CampaignScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  garmentId: 'garmentId',
  title: 'title',
  description: 'description',
  slug: 'slug',
  status: 'status',
  retailPriceCents: 'retailPriceCents',
  backerPriceCents: 'backerPriceCents',
  depositPercent: 'depositPercent',
  currency: 'currency',
  moq: 'moq',
  currentBackingCount: 'currentBackingCount',
  moqReached: 'moqReached',
  moqReachedAt: 'moqReachedAt',
  stretchGoalQty: 'stretchGoalQty',
  campaignStart: 'campaignStart',
  campaignEnd: 'campaignEnd',
  estimatedShipDate: 'estimatedShipDate',
  manufacturerId: 'manufacturerId',
  manufacturerNotifiedAt: 'manufacturerNotifiedAt',
  shopifyProductId: 'shopifyProductId',
  shopifyStoreUrl: 'shopifyStoreUrl',
  coverImageUrl: 'coverImageUrl',
  galleryUrls: 'galleryUrls',
  techPackPreviewUrl: 'techPackPreviewUrl',
  availableSizes: 'availableSizes',
  sizeLimits: 'sizeLimits',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.BackingScalarFieldEnum = {
  id: 'id',
  campaignId: 'campaignId',
  userId: 'userId',
  orderId: 'orderId',
  size: 'size',
  quantity: 'quantity',
  totalCents: 'totalCents',
  depositCents: 'depositCents',
  remainingCents: 'remainingCents',
  currency: 'currency',
  stripePaymentIntentId: 'stripePaymentIntentId',
  stripeChargeId: 'stripeChargeId',
  depositStatus: 'depositStatus',
  finalPaymentStatus: 'finalPaymentStatus',
  shopifyOrderId: 'shopifyOrderId',
  shopifyLineItemId: 'shopifyLineItemId',
  status: 'status',
  cancelledAt: 'cancelledAt',
  refundedAt: 'refundedAt',
  refundStripeId: 'refundStripeId',
  shippingAddress: 'shippingAddress',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CampaignSizeBreakScalarFieldEnum = {
  id: 'id',
  campaignId: 'campaignId',
  size: 'size',
  backingCount: 'backingCount',
  capturedAt: 'capturedAt'
};

exports.Prisma.CampaignEventScalarFieldEnum = {
  id: 'id',
  campaignId: 'campaignId',
  eventType: 'eventType',
  actorId: 'actorId',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.OrderScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  brandId: 'brandId',
  orderType: 'orderType',
  status: 'status',
  subtotalCents: 'subtotalCents',
  discountCents: 'discountCents',
  shippingCents: 'shippingCents',
  taxCents: 'taxCents',
  totalCents: 'totalCents',
  currency: 'currency',
  stripePaymentIntentId: 'stripePaymentIntentId',
  stripeChargeId: 'stripeChargeId',
  shopifyOrderId: 'shopifyOrderId',
  shippingAddress: 'shippingAddress',
  billingAddress: 'billingAddress',
  notes: 'notes',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.OrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  skuId: 'skuId',
  quantity: 'quantity',
  unitPriceCents: 'unitPriceCents',
  totalCents: 'totalCents',
  campaignId: 'campaignId',
  metadata: 'metadata',
  createdAt: 'createdAt'
};

exports.Prisma.StylistScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  displayName: 'displayName',
  slug: 'slug',
  bio: 'bio',
  avatarUrl: 'avatarUrl',
  location: 'location',
  specialisations: 'specialisations',
  styleKeywords: 'styleKeywords',
  pricePerBriefCents: 'pricePerBriefCents',
  commissionPercent: 'commissionPercent',
  verified: 'verified',
  verifiedAt: 'verifiedAt',
  stripeAccountId: 'stripeAccountId',
  isAvailable: 'isAvailable',
  instagramHandle: 'instagramHandle',
  websiteUrl: 'websiteUrl',
  completedBriefs: 'completedBriefs',
  avgRating: 'avgRating',
  ratingCount: 'ratingCount',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StylistPortfolioItemScalarFieldEnum = {
  id: 'id',
  stylistId: 'stylistId',
  imageUrl: 'imageUrl',
  caption: 'caption',
  occasion: 'occasion',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.StyleBriefScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  title: 'title',
  budgetMinCents: 'budgetMinCents',
  budgetMaxCents: 'budgetMaxCents',
  currency: 'currency',
  occasion: 'occasion',
  styleNotes: 'styleNotes',
  brandPreferences: 'brandPreferences',
  excludedBrands: 'excludedBrands',
  sizeInfo: 'sizeInfo',
  avatarId: 'avatarId',
  status: 'status',
  stylistId: 'stylistId',
  assignedAt: 'assignedAt',
  deadline: 'deadline',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.StyleBriefLookbookScalarFieldEnum = {
  id: 'id',
  briefId: 'briefId',
  stylistId: 'stylistId',
  title: 'title',
  notes: 'notes',
  status: 'status',
  publishedAt: 'publishedAt',
  acceptedAt: 'acceptedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LookbookItemScalarFieldEnum = {
  id: 'id',
  lookbookId: 'lookbookId',
  campaignId: 'campaignId',
  skuId: 'skuId',
  externalUrl: 'externalUrl',
  productName: 'productName',
  brandName: 'brandName',
  priceCents: 'priceCents',
  currency: 'currency',
  imageUrl: 'imageUrl',
  stylistNote: 'stylistNote',
  sortOrder: 'sortOrder',
  purchasedAt: 'purchasedAt',
  purchaseOrderId: 'purchaseOrderId',
  commissionPaidAt: 'commissionPaidAt',
  createdAt: 'createdAt'
};

exports.Prisma.StylistRatingScalarFieldEnum = {
  id: 'id',
  stylistId: 'stylistId',
  userId: 'userId',
  briefId: 'briefId',
  rating: 'rating',
  review: 'review',
  createdAt: 'createdAt'
};

exports.Prisma.PLMRecordScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  skuId: 'skuId',
  styleName: 'styleName',
  styleCode: 'styleCode',
  season: 'season',
  stage: 'stage',
  targetCost: 'targetCost',
  currentCost: 'currentCost',
  costVariance: 'costVariance',
  costFlag: 'costFlag',
  manufacturerId: 'manufacturerId',
  assignedTo: 'assignedTo',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PLMMilestoneScalarFieldEnum = {
  id: 'id',
  plmRecordId: 'plmRecordId',
  stage: 'stage',
  completedAt: 'completedAt',
  completedBy: 'completedBy',
  notes: 'notes',
  createdAt: 'createdAt'
};

exports.Prisma.PLMCostEntryScalarFieldEnum = {
  id: 'id',
  plmRecordId: 'plmRecordId',
  entryType: 'entryType',
  colourway: 'colourway',
  amount: 'amount',
  currency: 'currency',
  notes: 'notes',
  recordedAt: 'recordedAt',
  recordedBy: 'recordedBy'
};

exports.Prisma.PLMSampleRoundScalarFieldEnum = {
  id: 'id',
  plmRecordId: 'plmRecordId',
  roundNumber: 'roundNumber',
  shippedAt: 'shippedAt',
  trackingNumber: 'trackingNumber',
  carrier: 'carrier',
  receivedAt: 'receivedAt',
  fitNotes: 'fitNotes',
  fitApproved: 'fitApproved',
  adjustments: 'adjustments',
  createdAt: 'createdAt'
};

exports.Prisma.SizeChartScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  garmentId: 'garmentId',
  name: 'name',
  category: 'category',
  sizeSystem: 'sizeSystem',
  rows: 'rows',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TasteSignalScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  avatarId: 'avatarId',
  signalType: 'signalType',
  entityId: 'entityId',
  entityType: 'entityType',
  payload: 'payload',
  sessionId: 'sessionId',
  processedAt: 'processedAt',
  createdAt: 'createdAt'
};

exports.Prisma.TastePreferenceModelScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  topCategories: 'topCategories',
  topColours: 'topColours',
  preferredBrands: 'preferredBrands',
  priceRangeMinCents: 'priceRangeMinCents',
  priceRangeMaxCents: 'priceRangeMaxCents',
  styleKeywords: 'styleKeywords',
  occasions: 'occasions',
  fitKeywords: 'fitKeywords',
  confirmedSizeAu: 'confirmedSizeAu',
  signalCount: 'signalCount',
  signalsSinceRebuild: 'signalsSinceRebuild',
  modelQuality: 'modelQuality',
  lastBuiltAt: 'lastBuiltAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RLHFFeedbackScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  recommendationId: 'recommendationId',
  entityId: 'entityId',
  entityType: 'entityType',
  feedback: 'feedback',
  context: 'context',
  payload: 'payload',
  createdAt: 'createdAt'
};

exports.Prisma.ManufacturerProfileScalarFieldEnum = {
  id: 'id',
  manufacturerId: 'manufacturerId',
  displayName: 'displayName',
  description: 'description',
  heroImageUrl: 'heroImageUrl',
  galleryImageUrls: 'galleryImageUrls',
  videoUrl: 'videoUrl',
  country: 'country',
  city: 'city',
  yearEstablished: 'yearEstablished',
  employeeCount: 'employeeCount',
  monthlyCapacityMin: 'monthlyCapacityMin',
  monthlyCapacityMax: 'monthlyCapacityMax',
  moqMin: 'moqMin',
  moqMax: 'moqMax',
  sampleLeadTimeDays: 'sampleLeadTimeDays',
  bulkLeadTimeDays: 'bulkLeadTimeDays',
  specialisations: 'specialisations',
  materials: 'materials',
  certifications: 'certifications',
  exportMarkets: 'exportMarkets',
  priceTier: 'priceTier',
  techPackFormats: 'techPackFormats',
  languages: 'languages',
  isVerified: 'isVerified',
  verifiedAt: 'verifiedAt',
  isFeatured: 'isFeatured',
  responseTimeHours: 'responseTimeHours'
};

exports.Prisma.ManufacturerRatingScalarFieldEnum = {
  id: 'id',
  manufacturerProfileId: 'manufacturerProfileId',
  brandId: 'brandId',
  overallScore: 'overallScore',
  qualityScore: 'qualityScore',
  communicationScore: 'communicationScore',
  timelinessScore: 'timelinessScore',
  review: 'review',
  ordersCompleted: 'ordersCompleted',
  isVerifiedPurchase: 'isVerifiedPurchase',
  createdAt: 'createdAt'
};

exports.Prisma.BrandManufacturerConnectionScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  manufacturerProfileId: 'manufacturerProfileId',
  status: 'status',
  enquiryMessage: 'enquiryMessage',
  respondedAt: 'respondedAt',
  connectedAt: 'connectedAt',
  createdAt: 'createdAt'
};

exports.Prisma.RetailProductScalarFieldEnum = {
  id: 'id',
  brandId: 'brandId',
  garmentId: 'garmentId',
  name: 'name',
  slug: 'slug',
  description: 'description',
  category: 'category',
  gender: 'gender',
  season: 'season',
  tags: 'tags',
  status: 'status',
  priceCents: 'priceCents',
  comparePriceCents: 'comparePriceCents',
  currency: 'currency',
  coverImageUrl: 'coverImageUrl',
  galleryUrls: 'galleryUrls',
  metaTitle: 'metaTitle',
  metaDescription: 'metaDescription',
  weightGrams: 'weightGrams',
  shopifyProductId: 'shopifyProductId',
  totalSold: 'totalSold',
  totalRevenueCents: 'totalRevenueCents',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ProductVariantScalarFieldEnum = {
  id: 'id',
  productId: 'productId',
  sku: 'sku',
  colour: 'colour',
  colourHex: 'colourHex',
  size: 'size',
  sizeSystem: 'sizeSystem',
  priceCents: 'priceCents',
  comparePriceCents: 'comparePriceCents',
  stock: 'stock',
  stockTracked: 'stockTracked',
  barcode: 'barcode',
  weightGrams: 'weightGrams',
  imageUrl: 'imageUrl',
  sortOrder: 'sortOrder',
  isAvailable: 'isAvailable',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CartScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  sessionToken: 'sessionToken',
  brandId: 'brandId',
  currency: 'currency',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.CartItemScalarFieldEnum = {
  id: 'id',
  cartId: 'cartId',
  variantId: 'variantId',
  quantity: 'quantity',
  addedAt: 'addedAt'
};

exports.Prisma.RetailOrderScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  brandId: 'brandId',
  status: 'status',
  subtotalCents: 'subtotalCents',
  discountCents: 'discountCents',
  shippingCents: 'shippingCents',
  taxCents: 'taxCents',
  totalCents: 'totalCents',
  currency: 'currency',
  stripePaymentIntentId: 'stripePaymentIntentId',
  stripeChargeId: 'stripeChargeId',
  shippingAddress: 'shippingAddress',
  billingAddress: 'billingAddress',
  notes: 'notes',
  trackingNumber: 'trackingNumber',
  trackingCarrier: 'trackingCarrier',
  shippedAt: 'shippedAt',
  deliveredAt: 'deliveredAt',
  metadata: 'metadata',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.RetailOrderItemScalarFieldEnum = {
  id: 'id',
  orderId: 'orderId',
  variantId: 'variantId',
  productName: 'productName',
  variantLabel: 'variantLabel',
  quantity: 'quantity',
  unitPriceCents: 'unitPriceCents',
  totalCents: 'totalCents',
  createdAt: 'createdAt'
};

exports.Prisma.LookbookItemProductScalarFieldEnum = {
  id: 'id',
  lookbookId: 'lookbookId',
  productId: 'productId',
  variantId: 'variantId',
  stylistNote: 'stylistNote',
  sortOrder: 'sortOrder',
  createdAt: 'createdAt'
};

exports.Prisma.NotificationScalarFieldEnum = {
  id: 'id',
  userId: 'userId',
  type: 'type',
  title: 'title',
  body: 'body',
  imageUrl: 'imageUrl',
  actionUrl: 'actionUrl',
  actionLabel: 'actionLabel',
  referenceType: 'referenceType',
  referenceId: 'referenceId',
  read: 'read',
  readAt: 'readAt',
  emailSent: 'emailSent',
  emailSentAt: 'emailSentAt',
  createdAt: 'createdAt',
  expiresAt: 'expiresAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.JsonNullValueInput = {
  JsonNull: Prisma.JsonNull
};

exports.Prisma.NullableJsonNullValueInput = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.JsonNullValueFilter = {
  DbNull: Prisma.DbNull,
  JsonNull: Prisma.JsonNull,
  AnyNull: Prisma.AnyNull
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.UserRole = exports.$Enums.UserRole = {
  consumer: 'consumer',
  brand: 'brand',
  stylist: 'stylist',
  manufacturer: 'manufacturer',
  admin: 'admin'
};

exports.UserStatus = exports.$Enums.UserStatus = {
  active: 'active',
  suspended: 'suspended',
  deleted: 'deleted'
};

exports.BrandTier = exports.$Enums.BrandTier = {
  starter: 'starter',
  growth: 'growth',
  enterprise: 'enterprise'
};

exports.GarmentStatus = exports.$Enums.GarmentStatus = {
  draft: 'draft',
  development: 'development',
  sampling: 'sampling',
  production: 'production',
  retail: 'retail',
  discontinued: 'discontinued'
};

exports.SKUStatus = exports.$Enums.SKUStatus = {
  active: 'active',
  discontinued: 'discontinued',
  archived: 'archived'
};

exports.CampaignStatus = exports.$Enums.CampaignStatus = {
  draft: 'draft',
  scheduled: 'scheduled',
  active: 'active',
  moq_reached: 'moq_reached',
  funded: 'funded',
  in_production: 'in_production',
  shipped: 'shipped',
  completed: 'completed',
  cancelled: 'cancelled',
  expired: 'expired'
};

exports.PaymentStatus = exports.$Enums.PaymentStatus = {
  pending: 'pending',
  processing: 'processing',
  succeeded: 'succeeded',
  failed: 'failed',
  refunded: 'refunded',
  not_required: 'not_required'
};

exports.BackingStatus = exports.$Enums.BackingStatus = {
  active: 'active',
  cancelled: 'cancelled',
  refunded: 'refunded',
  fulfilled: 'fulfilled'
};

exports.OrderType = exports.$Enums.OrderType = {
  retail: 'retail',
  back_it: 'back_it',
  styling: 'styling'
};

exports.OrderStatus = exports.$Enums.OrderStatus = {
  pending: 'pending',
  payment_processing: 'payment_processing',
  payment_failed: 'payment_failed',
  confirmed: 'confirmed',
  in_production: 'in_production',
  shipped: 'shipped',
  delivered: 'delivered',
  cancelled: 'cancelled',
  refunded: 'refunded'
};

exports.BriefStatus = exports.$Enums.BriefStatus = {
  open: 'open',
  assigned: 'assigned',
  in_progress: 'in_progress',
  delivered: 'delivered',
  accepted: 'accepted',
  closed: 'closed'
};

exports.LookbookStatus = exports.$Enums.LookbookStatus = {
  draft: 'draft',
  published: 'published',
  accepted: 'accepted',
  closed: 'closed'
};

exports.PLMStage = exports.$Enums.PLMStage = {
  DESIGN: 'DESIGN',
  TECH_PACK_SENT: 'TECH_PACK_SENT',
  TECH_PACK_APPROVED: 'TECH_PACK_APPROVED',
  SAMPLE_ORDERED: 'SAMPLE_ORDERED',
  SAMPLE_IN_PRODUCTION: 'SAMPLE_IN_PRODUCTION',
  SAMPLE_SHIPPED: 'SAMPLE_SHIPPED',
  SAMPLE_RECEIVED: 'SAMPLE_RECEIVED',
  FIT_SESSION: 'FIT_SESSION',
  ADJUSTMENTS_SENT: 'ADJUSTMENTS_SENT',
  COUNTER_SAMPLE_REQUESTED: 'COUNTER_SAMPLE_REQUESTED',
  COUNTER_SAMPLE_SHIPPED: 'COUNTER_SAMPLE_SHIPPED',
  COUNTER_SAMPLE_RECEIVED: 'COUNTER_SAMPLE_RECEIVED',
  BULK_APPROVED: 'BULK_APPROVED',
  IN_PRODUCTION: 'IN_PRODUCTION',
  SHIPPED: 'SHIPPED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED'
};

exports.ConnectionStatus = exports.$Enums.ConnectionStatus = {
  ENQUIRY: 'ENQUIRY',
  RESPONDED: 'RESPONDED',
  CONNECTED: 'CONNECTED',
  DECLINED: 'DECLINED',
  INACTIVE: 'INACTIVE'
};

exports.RetailProductStatus = exports.$Enums.RetailProductStatus = {
  draft: 'draft',
  active: 'active',
  archived: 'archived',
  out_of_stock: 'out_of_stock'
};

exports.NotificationType = exports.$Enums.NotificationType = {
  BACKING_CONFIRMED: 'BACKING_CONFIRMED',
  BACKING_MOQ_PROGRESS: 'BACKING_MOQ_PROGRESS',
  BACKING_MOQ_REACHED: 'BACKING_MOQ_REACHED',
  BACKING_FUNDED: 'BACKING_FUNDED',
  BACKING_IN_PRODUCTION: 'BACKING_IN_PRODUCTION',
  BACKING_SHIPPED: 'BACKING_SHIPPED',
  BACKING_DELIVERED: 'BACKING_DELIVERED',
  BACKING_CANCELLED: 'BACKING_CANCELLED',
  BACKING_REFUNDED: 'BACKING_REFUNDED',
  BRIEF_STYLIST_ASSIGNED: 'BRIEF_STYLIST_ASSIGNED',
  BRIEF_LOOKBOOK_READY: 'BRIEF_LOOKBOOK_READY',
  BRIEF_MESSAGE: 'BRIEF_MESSAGE',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
  ORDER_SHIPPED: 'ORDER_SHIPPED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  NEW_CAMPAIGN_MATCH: 'NEW_CAMPAIGN_MATCH',
  FIT_RECOMMENDATION: 'FIT_RECOMMENDATION',
  PRICE_DROP: 'PRICE_DROP',
  WELCOME: 'WELCOME',
  AVATAR_CREATED: 'AVATAR_CREATED',
  STYLIST_RATED: 'STYLIST_RATED'
};

exports.Prisma.ModelName = {
  User: 'User',
  Brand: 'Brand',
  BrandMember: 'BrandMember',
  Garment: 'Garment',
  SKU: 'SKU',
  Manufacturer: 'Manufacturer',
  Avatar: 'Avatar',
  AvatarFitResult: 'AvatarFitResult',
  Campaign: 'Campaign',
  Backing: 'Backing',
  CampaignSizeBreak: 'CampaignSizeBreak',
  CampaignEvent: 'CampaignEvent',
  Order: 'Order',
  OrderItem: 'OrderItem',
  Stylist: 'Stylist',
  StylistPortfolioItem: 'StylistPortfolioItem',
  StyleBrief: 'StyleBrief',
  StyleBriefLookbook: 'StyleBriefLookbook',
  LookbookItem: 'LookbookItem',
  StylistRating: 'StylistRating',
  PLMRecord: 'PLMRecord',
  PLMMilestone: 'PLMMilestone',
  PLMCostEntry: 'PLMCostEntry',
  PLMSampleRound: 'PLMSampleRound',
  SizeChart: 'SizeChart',
  TasteSignal: 'TasteSignal',
  TastePreferenceModel: 'TastePreferenceModel',
  RLHFFeedback: 'RLHFFeedback',
  ManufacturerProfile: 'ManufacturerProfile',
  ManufacturerRating: 'ManufacturerRating',
  BrandManufacturerConnection: 'BrandManufacturerConnection',
  RetailProduct: 'RetailProduct',
  ProductVariant: 'ProductVariant',
  Cart: 'Cart',
  CartItem: 'CartItem',
  RetailOrder: 'RetailOrder',
  RetailOrderItem: 'RetailOrderItem',
  LookbookItemProduct: 'LookbookItemProduct',
  Notification: 'Notification'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
