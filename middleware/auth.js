// middleware/auth.js
import { createClient } from '@supabase/supabase-js';
// Import the KEYS, not the global client
import { supabaseUrl, supabaseAnonKey } from "../config/supabase.js";

const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing Auth Header' });

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'Invalid Token' });
    }

    // 1. Create a fresh client specifically for THIS request
    // This avoids the "Auth session missing" error because we inject the token directly
    const scopedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        persistSession: false, // Critical for server-side
      }
    });

    // 2. Verify user
    const { data: { user }, error } = await scopedClient.auth.getUser();

    if (error || !user) {
      console.error("Auth Error:", error?.message);
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // 3. Read user_role from the JWT claim set by custom_access_token_hook.
    //    The claim is: { ..., user_role: "admin" | "user" }
    //    We decode the payload (middle segment, base64url) without re-verifying
    //    the signature — Supabase already verified it in step 2.
    let userRole = 'user';
    try {
      const jwtPayload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8')
      );
      userRole = jwtPayload.user_role || 'user';
    } catch (jwtErr) {
      // Non-fatal: fall back to 'user' if decode fails
      console.warn('[Auth] Could not decode JWT payload:', jwtErr.message);
    }

    // 4. Attach user, role flags, and scoped client to the request
    req.user     = user;
    req.userRole = userRole;
    req.isAdmin  = userRole === 'admin';
    req.supabase = scopedClient;

    next();
  } catch (err) {
    console.error("Middleware Error:", err);
    res.status(500).json({ error: 'Server Error' });
  }
};

export default requireAuth;
