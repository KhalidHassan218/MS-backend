import { supabase } from '../config/supabase.js';

/**
 * Uploads a PDF buffer to Supabase Storage and returns the public URL.
 * @param {string|number} orderNumber
 * @param {Buffer} pdfBuffer
 * @param {string} [type="License"]
 * @returns {Promise<string>} Public URL of the uploaded PDF
 */
export async function uploadPDFToSupabaseStorage(orderNumber, pdfBuffer, type = "License") {
  const filePath = `${type}/${type}-${orderNumber}.pdf`;
  const { data, error } = await supabase.storage
    .from('pdfs') // Make sure you have a 'pdfs' bucket in Supabase Storage
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (error) throw error;

  // Get public URL
  const { data: publicUrlData } = supabase.storage.from('pdfs').getPublicUrl(filePath);
  return publicUrlData.publicUrl;
}
