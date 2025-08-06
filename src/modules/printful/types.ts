// Printful API Types and Interfaces

export interface PrintfulConfig {
  apiKey: string;
  storeId: string;
  webhookSecret: string;
  baseUrl?: string;
}

export interface PrintfulApiResponse<T = any> {
  code: number;
  result: T;
  error?: {
    message: string;
    reason: string;
  };
  paging?: {
    total: number;
    offset: number;
    limit: number;
  };
}

// Order Types
export interface PrintfulOrderStatus {
  id: number;
  external_id: string;
  status: 'draft' | 'pending' | 'failed' | 'canceled' | 'onhold' | 'inprocess' | 'partial' | 'fulfilled';
  shipping: string;
  shipping_service_name: string;
  created: number;
  updated: number;
  recipient: PrintfulRecipient;
  items: PrintfulOrderItem[];
  costs: PrintfulOrderCosts;
  retail_costs: PrintfulOrderCosts;
  shipment?: PrintfulShipment;
}

export interface PrintfulRecipient {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_code: string;
  state_name: string;
  country_code: string;
  country_name: string;
  zip: string;
  phone?: string;
  email: string;
}

export interface PrintfulOrderItem {
  id: number;
  external_id?: string;
  variant_id: number;
  sync_variant_id?: number;
  external_variant_id?: string;
  quantity: number;
  price: string;
  retail_price: string;
  name: string;
  product: PrintfulProduct;
  files?: PrintfulFile[];
  options?: PrintfulOption[];
}

export interface PrintfulProduct {
  variant_id: number;
  product_id: number;
  image: string;
  name: string;
}

export interface PrintfulFile {
  id: number;
  type: string;
  hash: string;
  url: string;
  filename: string;
  mime_type: string;
  size: number;
  width: number;
  height: number;
  dpi: number;
  status: string;
  created: number;
  thumbnail_url: string;
  preview_url: string;
  visible: boolean;
}

export interface PrintfulOption {
  id: string;
  value: string;
}

export interface PrintfulOrderCosts {
  currency: string;
  subtotal: string;
  discount: string;
  shipping: string;
  tax: string;
  total: string;
}

export interface PrintfulShipment {
  id: number;
  carrier: string;
  service: string;
  tracking_number: string;
  tracking_url: string;
  created: number;
  ship_date: string;
  shipped_at: number;
  reshipment: boolean;
  items: PrintfulShipmentItem[];
}

export interface PrintfulShipmentItem {
  item_id: number;
  quantity: number;
}

// Create Order Types
export interface CreatePrintfulOrderRequest {
  external_id: string;
  shipping: string;
  recipient: PrintfulRecipient;
  items: CreatePrintfulOrderItem[];
  packing_slip?: PrintfulPackingSlip;
  gift?: PrintfulGift;
}

export interface CreatePrintfulOrderItem {
  variant_id?: number;
  sync_variant_id?: number;
  external_variant_id?: string;
  quantity: number;
  price?: string;
  retail_price?: string;
  name?: string;
  product?: Partial<PrintfulProduct>;
  files?: PrintfulFile[];
  options?: PrintfulOption[];
}

export interface PrintfulPackingSlip {
  email?: string;
  phone?: string;
  message?: string;
  logo_url?: string;
  store_name?: string;
}

export interface PrintfulGift {
  subject: string;
  message: string;
}

// Webhook Types
export interface PrintfulWebhookPayload {
  type: 'package_shipped' | 'package_returned' | 'order_failed' | 'order_canceled' | 'stock_updated';
  created: number;
  retries: number;
  store: number;
  data: {
    order?: PrintfulOrderStatus;
    shipment?: PrintfulShipment;
  };
}

// Catalog Sync Types
export interface PrintfulSyncProduct {
  id: number;
  external_id: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url: string;
  is_ignored: boolean;
}

export interface PrintfulSyncVariant {
  id: number;
  external_id: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  main_category_id: number;
  warehouse_product_variant_id?: number;
  retail_price: string;
  sku: string;
  currency: string;
  product: PrintfulProduct;
  files: PrintfulFile[];
  options: PrintfulOption[];
  is_ignored: boolean;
}

// Shipping Rates
export interface PrintfulShippingRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  min_delivery_days: number;
  max_delivery_days: number;
}

// Product Catalog Types
export interface PrintfulCatalogProduct {
  id: number;
  main_category_id: number;
  type: string;
  description: string;
  type_name: string;
  title: string;
  brand: string;
  model: string;
  image: string;
  variant_count: number;
  currency: string;
  options: PrintfulCatalogOption[];
  dimensions: PrintfulDimensions;
  is_discontinued: boolean;
  avg_fulfillment_time: number;
  techniques: PrintfulTechnique[];
}

export interface PrintfulCatalogOption {
  id: string;
  title: string;
  type: string;
  values: Record<string, string>;
  additional_price?: string;
}

export interface PrintfulDimensions {
  front: string;
  back?: string;
  left?: string;
  right?: string;
}

export interface PrintfulTechnique {
  key: string;
  display_name: string;
  is_default: boolean;
}

export interface PrintfulCatalogVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  color_code2?: string;
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions: Record<string, string>;
  availability_status: PrintfulAvailabilityStatus[];
}

export interface PrintfulAvailabilityStatus {
  region: string;
  status: string;
}

// Error Types
export interface PrintfulError extends Error {
  message: string;
  reason: string;
  code: number;
  name: string;
}

export class PrintfulApiError extends Error {
  public readonly code: number;
  public readonly reason: string;

  constructor(error: PrintfulError) {
    super(error.message);
    this.name = 'PrintfulApiError';
    this.code = error.code;
    this.reason = error.reason;
  }
}

// Service Response Types
export interface PrintfulServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: PrintfulError;
}