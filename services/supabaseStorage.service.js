import { supabase, supabaseAdmin } from '../config/supabase.js';

export async function uploadPDFToSupabaseStorage(orderNumber, pdfBuffer, type = "License") {
  const filePath = `${type}/${type}-${orderNumber}.pdf`;

  // 👇 CHANGE THIS LINE: Use supabaseAdmin here!
  const { data, error } = await supabaseAdmin.storage 
    .from('pdfs') 
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  // You can use standard 'supabase' here for the URL
  const { data: publicUrlData } = supabase.storage
    .from('pdfs')
    .getPublicUrl(filePath);

  return publicUrlData.publicUrl;
}