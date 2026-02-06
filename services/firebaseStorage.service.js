// Firebase storage removed. Use Supabase instead.

export async function uploadPDFToFirebaseStorage(
  orderNumber,
  pdfBuffer,
  type = "License"
) {
  const bucket = getStorage().bucket("supplier-34b95.appspot.com"); // requires admin.initializeApp()
  const file = bucket.file(`${type}/${type}-${orderNumber}.pdf`);

  await file.save(pdfBuffer, {
    metadata: { contentType: "application/pdf" },
  });

  // Make file public OR use signed URL
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${type}/${type}-${orderNumber}.pdf`;
}
