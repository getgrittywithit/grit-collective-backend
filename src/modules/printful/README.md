# Printful Integration Module

Complete Printful integration for Medusa v2 e-commerce backend, providing print-on-demand fulfillment capabilities.

## Features

- ✅ **Complete API Client** - Full Printful API integration
- ✅ **Order Management** - Create, track, and manage Printful orders
- ✅ **Webhook Handling** - Real-time status updates from Printful
- ✅ **Admin Endpoints** - REST API for admin portal integration
- ✅ **Workflow Integration** - Automated fulfillment workflows
- ✅ **TypeScript Support** - Full type definitions included

## Environment Setup

Add these variables to your `.env` file:

```env
PRINTFUL_API_KEY=your_printful_api_key_here
PRINTFUL_STORE_ID=your_printful_store_id_here
PRINTFUL_WEBHOOK_SECRET=your_printful_webhook_secret_here
```

## API Endpoints

### Admin Endpoints

#### Get All Printful Orders
```http
GET /admin/printful/orders
Query Parameters:
- status: Filter by order status (optional)
- limit: Number of orders to return (default: 100)
- offset: Pagination offset (default: 0)
```

#### Get Specific Printful Order
```http
GET /admin/printful/orders/{id}
```

#### Cancel Printful Order
```http
DELETE /admin/printful/orders/{id}
```

#### Manual Fulfillment
```http
POST /admin/printful/fulfill
Body:
{
  "medusa_order_id": "order_123",
  "confirm_immediately": true
}
```

#### Sync Product Catalog
```http
GET /admin/printful/sync  # Get sync products
POST /admin/printful/sync # Sync catalog
```

#### Integration Status
```http
GET /admin/printful/status
```

### Webhook Endpoint

```http
POST /webhooks/printful
Headers:
- x-printful-signature: Webhook signature
```

## Usage Examples

### Manual Order Fulfillment

```typescript
// Create Printful order for existing Medusa order
const response = await fetch('/admin/printful/fulfill', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    medusa_order_id: 'order_01234567890',
    confirm_immediately: true
  })
});

const result = await response.json();
console.log('Printful Order ID:', result.printful_order_id);
```

### Check Order Status

```typescript
// Get Printful order status
const response = await fetch('/admin/printful/orders/12345678');
const { order } = await response.json();

console.log('Status:', order.status);
console.log('Tracking:', order.shipment?.tracking_number);
```

### Monitor Integration Health

```typescript
// Check Printful connection status
const response = await fetch('/admin/printful/status');
const status = await response.json();

console.log('Connected:', status.connection_status === 'connected');
console.log('Store Info:', status.store_info);
```

## Workflow Integration

### Automatic Fulfillment on Payment

```typescript
import { createPrintfulOrderWorkflow } from '../workflows/printful-fulfillment';

// Trigger fulfillment when order is paid
const result = await createPrintfulOrderWorkflow(container).run({
  input: {
    medusa_order_id: order.id,
    confirm_immediately: true
  }
});

console.log('Created Printful Order:', result.printful_order_id);
```

### Handle Status Updates

```typescript
import { handleOrderUpdateWorkflow } from '../workflows/printful-fulfillment';

// Process webhook updates
await handleOrderUpdateWorkflow(container).run({
  input: {
    printful_order_id: '12345678',
    medusa_order_id: 'order_01234567890',
    webhook_type: 'package_shipped',
    webhook_data: webhookPayload.data
  }
});
```

## Order Status Flow

```
Medusa Order Created
       ↓
Payment Captured → Create Printful Order (Draft)
       ↓
Manual/Auto Confirm → Printful Order (Pending)
       ↓
Printful Processing → Printful Order (In Process)
       ↓
Package Shipped → Update Tracking Info
       ↓
Package Delivered → Order Complete
```

## Webhook Events

The integration handles these Printful webhook events:

- `package_shipped` - Updates order with tracking information
- `package_returned` - Marks order as returned
- `order_failed` - Handles fulfillment failures
- `order_canceled` - Processes order cancellations

## Error Handling

All API calls include comprehensive error handling:

```typescript
const result = await printfulService.createOrder(order);

if (!result.success) {
  console.error('Error:', result.error?.message);
  console.error('Code:', result.error?.code);
  console.error('Reason:', result.error?.reason);
}
```

## Development & Testing

### Test API Connection

```bash
curl -X GET http://localhost:9000/admin/printful/status
```

### Test Manual Fulfillment

```bash
curl -X POST http://localhost:9000/admin/printful/fulfill \
  -H "Content-Type: application/json" \
  -d '{"medusa_order_id": "order_123", "confirm_immediately": false}'
```

### Test Webhook Handler

```bash
curl -X POST http://localhost:9000/webhooks/printful \
  -H "Content-Type: application/json" \
  -H "x-printful-signature: test-signature" \
  -d '{"type": "package_shipped", "data": {...}}'
```

## Integration with Admin Portal

This backend provides all the necessary endpoints for your admin portal:

### Order Fulfillment Dashboard
- List orders with Printful status
- Manual fulfillment triggers
- Tracking information display

### Error Monitoring
- Failed fulfillment alerts
- Retry mechanisms
- Status synchronization

### Product Management
- Printful catalog sync
- Product mapping interface
- Inventory status

## Production Deployment

1. **Environment Variables**: Set all Printful credentials in Railway
2. **Webhook URL**: Configure `https://your-domain.com/webhooks/printful` in Printful dashboard
3. **SSL Certificate**: Ensure HTTPS for webhook security
4. **Error Monitoring**: Set up logging for production issues

## Security

- ✅ Webhook signature verification
- ✅ API key authentication
- ✅ HTTPS-only communication
- ✅ Input validation and sanitization
- ✅ Error logging without sensitive data exposure

## Next Steps

1. **Product Mapping**: Build interface to map Medusa products to Printful variants
2. **Automated Workflows**: Set up event subscribers for automatic fulfillment
3. **Return Handling**: Implement return processing workflows  
4. **Inventory Sync**: Real-time inventory updates from Printful
5. **Multi-Store**: Support for multiple Printful stores

## Support

For issues with this integration:
1. Check the logs in `/admin/printful/status`
2. Verify environment variables are set
3. Test API connection with Printful
4. Review webhook signature verification

## API Reference

Complete TypeScript types and interfaces are available in `types.ts` for full API documentation.