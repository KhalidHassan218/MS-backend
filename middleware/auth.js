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

    // 3. Attach both User and the Client
    req.user = user;
    req.supabase = scopedClient; // Pass this to your routes

    next();
  } catch (err) {
    console.error("Middleware Error:", err);
    res.status(500).json({ error: 'Server Error' });
  }
};

export default requireAuth;