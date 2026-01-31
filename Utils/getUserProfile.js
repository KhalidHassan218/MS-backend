import { supabase } from "../config/supabase.js";

export const getUserProfile = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single(); // .single() returns one object instead of an array

    if (error) throw error;

    console.log("User Profile:", data);
    return data;

  } catch (err) {
    console.error("Error fetching profile:", err.message);
    return null;
  }
};