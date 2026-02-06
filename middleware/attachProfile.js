// middleware/attachProfile.js

// Ensure you use the correct path and .js extension if using ESM
import { supabase } from "../config/supabase.js";

const attachProfile = async (req, res, next) => {
  try {
    // 1. Safety Check: Ensure the user is authenticated
    // This middleware is designed to run AFTER requireAuth
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'User not authenticated. Please run requireAuth first.' });
    }

    // 2. Determine which client to use
    // If requireAuth created a 'scoped client' (req.supabase), use it to respect RLS.
    // Otherwise, fall back to the global 'supabase' client.
    const client = req.supabase || supabase;

    // 3. Fetch the profile
    const { data: profile, error } = await client
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single(); // Returns an object instead of an array

    if (error) {
      // Error code 'PGRST116' means no rows found (User exists in Auth but not in Profiles)
      if (error.code === 'PGRST116') {
        console.warn(`Profile missing for user ${req.user.id}`);
        req.profile = null; // Set to null so routes know it's missing
        return next();
      }

      console.error("Profile Fetch Error:", error.message);
      return res.status(500).json({ error: 'Failed to retrieve profile data' });
    }

    // 4. Attach profile to the request object
    req.profile = profile;

    next();
  } catch (err) {
    console.error("AttachProfile Middleware Error:", err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export default attachProfile;