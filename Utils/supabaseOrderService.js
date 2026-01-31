import { supabase } from '../config/supabase.js';

// Insert a new order
export async function insertOrder(orderData) {
  const company_info = {
    country: orderData?.country,
    company_name: orderData?.company_name,
    city: orderData?.city,
    address1: orderData?.address1,
    address2: orderData?.address2,
    postal_code: orderData?.postal_code,
    business_name: orderData?.businessName,
  };
  // Map orderData to Supabase columns
  const insertData = {
    order_number: orderData.orderNumber,
    user_id: orderData.user_id,
    email: orderData.email,
    country_code: orderData.countryCode,
    address_1: orderData.address1,
    total_amount: orderData.total_amount,
    currency: orderData.currency,
    payment_status: orderData.paymentStatus,
    internal_status: orderData.internalEntryStatus,
    invoice_url: orderData.invoiceUrl,
    license_url: orderData.licenseUrl,
    created_at: orderData.createdAt || new Date().toISOString(),
    po_number: orderData?.poNumber || null,
    company_info
    // Add more mappings as needed
  };
  const { data, error } = await supabase.from('orders').insert([insertData]).select();
  if (error) throw error;
  return data[0];
}

// Update an order by id
export async function updateOrder(orderId, updateData) {
  const { data, error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId)
    .select();
  if (error) throw error;
  return data[0];
}
