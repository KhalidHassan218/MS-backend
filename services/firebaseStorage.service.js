import { getStorage } from "firebase-admin/storage";

export async function uploadPDFToFirebaseStorage(
  orderId,
  orderNumber,
  pdfBuffer
) {
  const bucket = getStorage().bucket("supplier-34b95.appspot.com"); // requires admin.initializeApp()
  const file = bucket.file(`licence/Invoice-${orderId}.pdf`);

  await file.save(pdfBuffer, {
    metadata: { contentType: "application/pdf" },
  });

  // Make file public OR use signed URL
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/licence/Invoice-${orderId}.pdf`;
}
