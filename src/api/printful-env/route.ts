import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  try {
    // Simple environment variable check without database calls
    const envCheck = {
      api_key_configured: !!process.env.PRINTFUL_API_KEY,
      api_key_length: process.env.PRINTFUL_API_KEY ? process.env.PRINTFUL_API_KEY.length : 0,
      store_id_configured: !!process.env.PRINTFUL_STORE_ID,
      store_id_value: process.env.PRINTFUL_STORE_ID || 'not_configured',
      webhook_secret_configured: !!process.env.PRINTFUL_WEBHOOK_SECRET,
      node_env: process.env.NODE_ENV,
      all_env_vars: Object.keys(process.env).filter(key => key.includes('PRINTFUL')).sort()
    };

    return res.json({
      success: true,
      message: "Printful environment check (no auth required)",
      environment: envCheck,
      next_steps: envCheck.api_key_configured 
        ? "Environment looks configured. Try testing connection with authentication."
        : "PRINTFUL_API_KEY missing. Add it to Railway environment variables."
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Failed to check environment",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}