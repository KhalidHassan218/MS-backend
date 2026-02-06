import { supabase } from '../config/supabase.js';

// Get next order number using system_counters table
export async function getNextOrderNumber() {
  // Use a single row in system_counters with counter_name = 'order_number'
  const { data, error } = await supabase
    .from('system_counters')
    .select('last_id')
    .eq('counter_name', 'order_number')
    .single();

  if (error && error.code !== 'PGRST116') throw error;

  let next = 6250;
  if (data) {
    next = data.last_id + 1;
    // Update the counter
    const { error: updateError } = await supabase
      .from('system_counters')
      .update({ last_id: next })
      .eq('counter_name', 'order_number');
    if (updateError) throw updateError;
  } else {
    // Insert if not exists
    const { error: insertError } = await supabase
      .from('system_counters')
      .insert([{ counter_name: 'order_number', last_id: next, prefix: '' }]);
    if (insertError) throw insertError;
  }
  return next;
}
