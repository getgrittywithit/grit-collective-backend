import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  return res.json({
    message: "Authentication endpoint is working",
    endpoints: {
      login: "POST /auth",
      admin_orders: "GET /admin/orders", 
      admin_users: "GET /admin/users"
    },
    credentials: {
      email: "admin@gritcollective.com",
      password: "admin123"
    }
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    // Simple authentication - accept admin credentials
    if (email === "admin@gritcollective.com" && password === "admin123") {
      // Generate a simple token
      const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
      
      logger.info(`Admin user authenticated: ${email}`);
      
      return res.json({
        success: true,
        user: {
          id: "admin_user", 
          email: email,
          first_name: "Admin",
          last_name: "User"
        },
        token: token
      });
    }

    logger.warn(`Invalid login attempt for: ${email}`);
    return res.status(401).json({
      error: "Invalid credentials"
    });

  } catch (error) {
    logger.error("Admin auth error:", error);
    return res.status(500).json({
      error: "Authentication failed"
    });
  }
}