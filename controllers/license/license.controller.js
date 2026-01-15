import { getFirestore, FieldValue } from "firebase-admin/firestore";
import generateLicencePDFBuffer from "../../services/pdf/generateLicencePDF.service.js";
import { uploadPDFToFirebaseStorage } from "../../services/firebaseStorage.service.js";
import sendEmailWithAttachment from "../../Utils/sendEmailWithAttachment.js";
import savePDFRecord from "../../services/pdf/savePdfRecord.service.js";
import generateKeyReplacementEmail from "../../services/emails/generateKeyReplacementEmail.js";

const replaceKeyAndGenerateLicensePdf = async (req, res) => {
  const {
    feedback,
    productId,
    orderId,
    orderNumber,
    userId: uid,
    requestId,
  } = req.body;
  console.log("uid", uid);

  try {
    const db = getFirestore();

    // 1️⃣ Get replacement request
    const requestRef = db.collection("keys_replacment_req").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new Error("Replacement request not found");

    const requestData = requestSnap.data();
    if (requestData.status !== "pending")
      throw new Error("Request already processed");

    // 2️⃣ Get user b2bSupplierId
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new Error("User not found");
    const { b2bSupplierId, companyCountry, email } = userSnap.data();

    const ordersRef = db.collection("orders").doc(orderId);
    const licenseKeysRef = db.collection("licenseKeys");

    let newKey; // to hold the replaced key

    // 3️⃣ Run transaction
    // 3️⃣ Run transaction
    let fullOrderDataForPDF;

    await db.runTransaction(async (tx) => {
      console.log(
        `🔄 Transaction started - order=${orderId}, product=${productId}`
      );

      // A. Fetch the existing order document to get all products
      const orderSnap = await tx.get(ordersRef);
      if (!orderSnap.exists) {
        throw new Error(`Order ${orderId} not found`);
      }
      const orderData = orderSnap.data();

      // B. Get one available license key
      const snapshot = await tx.get(
        licenseKeysRef
          .where("status", "==", "available")
          .where("productId", "==", productId)
          .limit(1)
      );

      if (snapshot.empty) {
        throw new Error(`No available license keys for product ${productId}`);
      }

      const keyDoc = snapshot.docs[0];
      newKey = keyDoc.data().key;
      const oldKey = requestData.licenseKey;

      // 4️⃣ Update new license key to 'used'
      tx.update(keyDoc.ref, {
        status: "used",
        orderId,
        orderNumber,
        usedAt: FieldValue.serverTimestamp(),
        b2bSupplierId,
        uid,
        adminNote: "Key replacement",
      });

      // 5️⃣ Update orders collection with replacement history
      tx.update(ordersRef, {
        feedback,
        feedbackUpdatedAt: FieldValue.serverTimestamp(),
        keyReplaced: true,
        keyReplacements: FieldValue.arrayUnion({
          productId,
          productName: requestData.productName,
          oldKey: oldKey,
          newKey,
          reason: requestData.reason,
          replacedAt: new Date(),
          replacedBy: uid,
          requestId,
        }),
      });

      // 6️⃣ Update replacement request status
      tx.update(requestRef, {
        status: "resolved",
        newLicenseKey: newKey,
        processedAt: FieldValue.serverTimestamp(),
        processedBy: uid,
      });

      // C. Prepare full licenseData for PDF generation while inside/based on transaction data
      // We map over ALL products from the original order
      const updatedProducts = (orderData.products || []).map((p) => {
        // If this is the product where the key was replaced
        if (p.id === productId) {
          return {
            ...p,
            // Replace the old key string with the new key string in the array
            licenseKeys: (p.licenseKeys || []).map((k) =>
              k === oldKey ? newKey : k
            ),
            // Add this property so the HTML template applies the blue style/icon
            newLicenseKeys: [newKey],
          };
        }
        // Return other products (like Windows or Office) unchanged
        return p;
      });

      fullOrderDataForPDF = {
        customer: orderData.customer || {
          name: requestData.customerName || "",
          businessName: requestData.customerBusinessName || "",
          address: requestData.customerAddress || {
            line1: "",
            postalCode: "",
            country: "",
          },
        },
        order: {
          id: orderId,
          number: orderNumber,
          // Use original order date if available, otherwise current
          date: orderData.createdAt?.seconds || new Date().getTime() / 1000,
        },
        products: updatedProducts,
      };

      console.log(`✅ Key replaced: ${oldKey} → ${newKey}`);
    });

    // 8️⃣ Generate PDF with the full order data
    // The 'true' flag activates keyReplacement logic in your HTML generator
    const pdfBuffer = await generateLicencePDFBuffer(
      fullOrderDataForPDF,
      companyCountry,
      true
    );
    const licensePdfUrl = await uploadPDFToFirebaseStorage(
      orderId,
      orderNumber,
      pdfBuffer
    );
    await savePDFRecord(`${orderNumber}-license`, licensePdfUrl);

    let emailAttachemnts = [
      {
        filename: `License-${orderNumber}.pdf`,
        content: pdfBuffer, // Buffer or string
        contentType: pdfBuffer.contentType || "application/pdf",
      },
    ];

    const emailContent = generateKeyReplacementEmail(companyCountry);

    await sendEmailWithAttachment(
      emailContent.subject,
      emailContent.html,
      email,
      process.env.EMAIL_USER,
      process.env.EMAIL_USER,
      emailAttachemnts
    );
    // 9️⃣ Send PDF as response
    res
      .status(200)
      .json({ success: true, message: "email with PDF sent successfully" });
  } catch (error) {
    console.error("❌ Error replacing key and generating PDF:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  replaceKeyAndGenerateLicensePdf,
};
