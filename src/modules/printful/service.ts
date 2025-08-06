import { 
  OrderDTO,
  OrderLineItemDTO
} from "@medusajs/framework/types";
import { Logger } from "@medusajs/framework/types";
import {
  PrintfulConfig,
  PrintfulApiResponse,
  PrintfulOrderStatus,
  CreatePrintfulOrderRequest,
  CreatePrintfulOrderItem,
  PrintfulRecipient,
  PrintfulSyncProduct,
  PrintfulSyncVariant,
  PrintfulShippingRate,
  PrintfulWebhookPayload,
  PrintfulServiceResponse,
  PrintfulApiError,
  PrintfulCatalogProduct,
  PrintfulCatalogVariant
} from "./types";

export default class PrintfulService {
  private config: PrintfulConfig;
  private logger: Logger;
  private baseUrl: string;

  constructor(container: any, options: any) {
    
    this.logger = container.logger;
    this.baseUrl = options?.baseUrl || 'https://api.printful.com';
    
    // Load configuration from environment
    this.config = {
      apiKey: process.env.PRINTFUL_API_KEY || '',
      storeId: process.env.PRINTFUL_STORE_ID || '',
      webhookSecret: process.env.PRINTFUL_WEBHOOK_SECRET || '',
      baseUrl: this.baseUrl
    };

    if (!this.config.apiKey) {
      this.logger.warn('PRINTFUL_API_KEY not configured');
    }
  }

  /**
   * Make authenticated API request to Printful
   */
  private async makeRequest<T = any>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<PrintfulApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'MedusaJS-PrintfulIntegration/1.0'
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined
      });

      const responseData = await response.json() as PrintfulApiResponse<T>;

      if (!response.ok || responseData.code >= 400) {
        throw new PrintfulApiError({
          message: responseData.error?.message || 'Unknown API error',
          reason: responseData.error?.reason || 'api_error',
          code: responseData.code,
          name: 'PrintfulApiError'
        });
      }

      return responseData;
    } catch (error) {
      this.logger.error('Printful API request failed:', error);
      throw error;
    }
  }

  /**
   * Get store information
   */
  async getStoreInfo(): Promise<PrintfulServiceResponse> {
    try {
      const response = await this.makeRequest('/store');
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error('Failed to get store info:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Create a new order in Printful
   */
  async createOrder(order: OrderDTO): Promise<PrintfulServiceResponse<PrintfulOrderStatus>> {
    try {
      const printfulOrder = this.mapMedusaOrderToPrintful(order);
      const response = await this.makeRequest<PrintfulOrderStatus>('/orders', 'POST', printfulOrder);
      
      this.logger.info(`Created Printful order ${response.result.id} for Medusa order ${order.id}`);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error(`Failed to create Printful order for ${order.id}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get order status from Printful
   */
  async getOrder(printfulOrderId: string): Promise<PrintfulServiceResponse<PrintfulOrderStatus>> {
    try {
      const response = await this.makeRequest<PrintfulOrderStatus>(`/orders/${printfulOrderId}`);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error(`Failed to get Printful order ${printfulOrderId}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get all orders from Printful
   */
  async getOrders(status?: string, limit: number = 100, offset: number = 0): Promise<PrintfulServiceResponse<PrintfulOrderStatus[]>> {
    try {
      let endpoint = `/orders?limit=${limit}&offset=${offset}`;
      if (status) {
        endpoint += `&status=${status}`;
      }

      const response = await this.makeRequest<PrintfulOrderStatus[]>(endpoint);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error('Failed to get Printful orders:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Cancel an order in Printful
   */
  async cancelOrder(printfulOrderId: string): Promise<PrintfulServiceResponse> {
    try {
      const response = await this.makeRequest(`/orders/${printfulOrderId}`, 'DELETE');
      this.logger.info(`Canceled Printful order ${printfulOrderId}`);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error(`Failed to cancel Printful order ${printfulOrderId}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Confirm order for fulfillment
   */
  async confirmOrder(printfulOrderId: string): Promise<PrintfulServiceResponse<PrintfulOrderStatus>> {
    try {
      const response = await this.makeRequest<PrintfulOrderStatus>(`/orders/${printfulOrderId}/confirm`, 'POST');
      this.logger.info(`Confirmed Printful order ${printfulOrderId} for fulfillment`);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error(`Failed to confirm Printful order ${printfulOrderId}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get shipping rates for order
   */
  async getShippingRates(recipient: PrintfulRecipient, items: CreatePrintfulOrderItem[]): Promise<PrintfulServiceResponse<PrintfulShippingRate[]>> {
    try {
      const data = { recipient, items };
      const response = await this.makeRequest<PrintfulShippingRate[]>('/shipping/rates', 'POST', data);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error('Failed to get shipping rates:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get sync products (catalog)
   */
  async getSyncProducts(): Promise<PrintfulServiceResponse<PrintfulSyncProduct[]>> {
    try {
      const response = await this.makeRequest<PrintfulSyncProduct[]>('/sync/products');
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error('Failed to get sync products:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get sync product variants
   */
  async getSyncVariants(syncProductId: string): Promise<PrintfulServiceResponse<PrintfulSyncVariant[]>> {
    try {
      const response = await this.makeRequest<PrintfulSyncVariant[]>(`/sync/products/${syncProductId}`);
      return { success: true, data: response.result as PrintfulSyncVariant[] };
    } catch (error) {
      this.logger.error(`Failed to get sync variants for product ${syncProductId}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get catalog products
   */
  async getCatalogProducts(categoryId?: number): Promise<PrintfulServiceResponse<PrintfulCatalogProduct[]>> {
    try {
      let endpoint = '/products';
      if (categoryId) {
        endpoint += `?category_id=${categoryId}`;
      }

      const response = await this.makeRequest<PrintfulCatalogProduct[]>(endpoint);
      return { success: true, data: response.result };
    } catch (error) {
      this.logger.error('Failed to get catalog products:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Get catalog product variants
   */
  async getCatalogVariants(productId: number): Promise<PrintfulServiceResponse<PrintfulCatalogVariant[]>> {
    try {
      const response = await this.makeRequest<PrintfulCatalogVariant[]>(`/products/${productId}`);
      return { success: true, data: response.result as PrintfulCatalogVariant[] };
    } catch (error) {
      this.logger.error(`Failed to get catalog variants for product ${productId}:`, error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Handle incoming webhook
   */
  async handleWebhook(payload: PrintfulWebhookPayload, signature: string): Promise<PrintfulServiceResponse> {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(JSON.stringify(payload), signature)) {
        throw new Error('Invalid webhook signature');
      }

      this.logger.info(`Processing Printful webhook: ${payload.type}`);

      switch (payload.type) {
        case 'package_shipped':
          await this.handlePackageShipped(payload);
          break;
        case 'package_returned':
          await this.handlePackageReturned(payload);
          break;
        case 'order_failed':
          await this.handleOrderFailed(payload);
          break;
        case 'order_canceled':
          await this.handleOrderCanceled(payload);
          break;
        default:
          this.logger.warn(`Unhandled webhook type: ${payload.type}`);
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to handle webhook:', error);
      return { success: false, error: error as PrintfulApiError };
    }
  }

  /**
   * Verify webhook signature
   */
  private verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true; // Allow in development
    }

    // Implement HMAC verification
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Map Medusa order to Printful order format
   */
  private mapMedusaOrderToPrintful(order: OrderDTO): CreatePrintfulOrderRequest {
    const shippingAddress = order.shipping_address;
    
    if (!shippingAddress) {
      throw new Error('Order must have a shipping address');
    }

    const recipient: PrintfulRecipient = {
      name: `${shippingAddress.first_name} ${shippingAddress.last_name}`,
      company: shippingAddress.company || undefined,
      address1: shippingAddress.address_1 || '',
      address2: shippingAddress.address_2 || undefined,
      city: shippingAddress.city || '',
      state_code: shippingAddress.province || '',
      state_name: shippingAddress.province || '',
      country_code: shippingAddress.country_code?.toUpperCase() || 'US',
      country_name: shippingAddress.country_code?.toUpperCase() || 'US',
      zip: shippingAddress.postal_code || '',
      phone: shippingAddress.phone || undefined,
      email: order.email || ''
    };

    const items: CreatePrintfulOrderItem[] = order.items?.map((item: OrderLineItemDTO) => ({
      external_variant_id: item.variant_sku || item.id || '',
      quantity: item.quantity,
      retail_price: ((item.unit_price || 0) / 100).toString(), // Convert from cents
      name: item.title || ''
    })) || [];

    return {
      external_id: order.id,
      shipping: 'STANDARD', // Default shipping method
      recipient,
      items
    };
  }

  /**
   * Handle package shipped webhook
   */
  private async handlePackageShipped(payload: PrintfulWebhookPayload): Promise<void> {
    if (!payload.data.order || !payload.data.shipment) return;

    const order = payload.data.order;
    const shipment = payload.data.shipment;

    this.logger.info(`Order ${order.external_id} shipped with tracking: ${shipment.tracking_number}`);

    // TODO: Update Medusa order with tracking information
    // This would require injecting OrderService and updating the order
  }

  /**
   * Handle package returned webhook
   */
  private async handlePackageReturned(payload: PrintfulWebhookPayload): Promise<void> {
    if (!payload.data.order) return;

    const order = payload.data.order;
    this.logger.info(`Order ${order.external_id} was returned`);

    // TODO: Update Medusa order status
  }

  /**
   * Handle order failed webhook
   */
  private async handleOrderFailed(payload: PrintfulWebhookPayload): Promise<void> {
    if (!payload.data.order) return;

    const order = payload.data.order;
    this.logger.error(`Order ${order.external_id} failed in Printful`);

    // TODO: Update Medusa order status and notify admin
  }

  /**
   * Handle order canceled webhook
   */
  private async handleOrderCanceled(payload: PrintfulWebhookPayload): Promise<void> {
    if (!payload.data.order) return;

    const order = payload.data.order;
    this.logger.info(`Order ${order.external_id} was canceled in Printful`);

    // TODO: Update Medusa order status
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<PrintfulServiceResponse> {
    try {
      await this.getStoreInfo();
      return { success: true, data: { message: 'Connection successful' } };
    } catch (error) {
      return { success: false, error: error as PrintfulApiError };
    }
  }
}