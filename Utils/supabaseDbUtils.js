import { supabase } from '../config/supabase.js';

// Utility to get a single row by id from a table
export async function getById(table, id) {
  const { data, error } = await supabase.from(table).select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

// Utility to update a row by id
export async function updateById(table, id, updateData) {
  const { data, error } = await supabase.from(table).update(updateData).eq('id', id).select();
  if (error) throw error;
  return data[0];
}

// Utility to find a single row by filters
export async function findOne(table, filters) {
  let query = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query.single();
  if (error) throw error;
  return data;
}

// Utility to find all rows by filters
export async function findAll(table, filters) {
  let query = supabase.from(table).select('*');
  Object.entries(filters).forEach(([key, value]) => {
    query = query.eq(key, value);
  });
  const { data, error } = await query;
  if (error) throw error;
  return data;
}
