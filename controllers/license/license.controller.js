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
    let fullOrderDataForPDF;

    // 3️⃣ Run transaction
    await db.runTransaction(async (tx) => {
      console.log(
        `🔄 Transaction started - order=${orderId}, product=${productId}`
      );

      // A. Fetch the existing order document
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
      const newKeyData = keyDoc.data();
      newKey = newKeyData.key;
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

      // 5️⃣ Find the product and update its licenseKeys array
      const productIndex = orderData.products.findIndex(
        (p) => p.productId === productId
      );

      if (productIndex === -1) {
        throw new Error(`Product ${productId} not found in order`);
      }

      const product = orderData.products[productIndex];

      // Find the old key object and mark it as replaced
      const oldKeyIndex = product.licenseKeys.findIndex(
        (k) => k.key === oldKey && k.status === "active"
      );

      if (oldKeyIndex === -1) {
        throw new Error("Old key not found or already replaced");
      }

      // Update old key object
      product.licenseKeys[oldKeyIndex] = {
        ...product.licenseKeys[oldKeyIndex],
        status: "replaced",
        replacedAt: Date.now(),
        replacementReason: requestData.reason,
      };

      // Create new key object
      const newKeyObject = {
        key: newKey,
        status: "active",
        isReplacement: true, // 🎨 For PDF highlighting
        addedAt: Date.now(),
        replacedAt: null,
        replacementReason: null,
        licenseDocId: keyDoc.id,
        replacedOldKey: oldKey,
      };

      // Add new key to array
      product.licenseKeys.push(newKeyObject);

      // Add to replacement history
      if (!product.replacementHistory) {
        product.replacementHistory = [];
      }

      product.replacementHistory.push({
        replacementId: `repl_${Date.now()}`,
        oldKey: oldKey,
        newKey: newKey,
        reason: requestData.reason,
        replacedAt: Date.now(),
        replacedBy: uid,
        requestId: requestId,
      });

      // Update the products array
      orderData.products[productIndex] = product;

      // 6️⃣ Update orders document
      tx.update(ordersRef, {
        products: orderData.products,
        feedback,
        feedbackUpdatedAt: FieldValue.serverTimestamp(),
        keyReplaced: true,
        // Optional: Keep global keyReplacements array for quick reference
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

      // 7️⃣ Update replacement request status
      tx.update(requestRef, {
        status: "resolved",
        newLicenseKey: newKey,
        processedAt: FieldValue.serverTimestamp(),
        processedBy: uid,
      });

      // C. Prepare full order data for PDF generation
      const updatedProducts = orderData.products.map((p) => {
        // Get only ACTIVE keys for PDF
        const activeKeys = p.licenseKeys
          .filter((k) => k.status === "active")
          .map((k) => k.key);

        // Get newly replaced keys (for highlighting in PDF)
        const newlyReplacedKeys = p.licenseKeys
          .filter((k) => k.status === "active" && k.isReplacement === true)
          .map((k) => k.key);

        return {
          ...p,
          licenseKeys: activeKeys, // Only active keys
          newLicenseKeys: newlyReplacedKeys, // Keys to highlight
        };
      });

      fullOrderDataForPDF = {
        customer: orderData.customer || {
          name: requestData.customerName || orderData.bussinessName || "",
          businessName: requestData.customerBusinessName || orderData.bussinessName || "",
          address: requestData.customerAddress || {
            line1: orderData.address1 || "",
            postalCode: orderData.postal_code || "",
            country: orderData.country || "",
          },
        },
        order: {
          id: orderId,
          number: orderNumber,
          date: orderData.createdAt?.seconds || new Date().getTime() / 1000,
        },
        products: updatedProducts,
      };

      console.log(`✅ Key replaced: ${oldKey} → ${newKey}`);
    });

    // 8️⃣ Generate PDF with the full order data
    const pdfBuffer = await generateLicencePDFBuffer(
      fullOrderDataForPDF,
      companyCountry,
      true // keyReplacement flag
    );

    const licensePdfUrl = await uploadPDFToFirebaseStorage(
      orderId,
      orderNumber,
      pdfBuffer
    );
    
    await savePDFRecord(`${orderNumber}-license`, licensePdfUrl);

    // 9️⃣ Send email with PDF
    let emailAttachments = [
      {
        filename: `License-${orderNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];

    const emailContent = generateKeyReplacementEmail(companyCountry);

    await sendEmailWithAttachment(
      emailContent.subject,
      emailContent.html,
      email,
      process.env.EMAIL_USER,
      process.env.EMAIL_USER,
      emailAttachments
    );

    // 🔟 Send response
    res.status(200).json({
      success: true,
      message: "Email with PDF sent successfully",
      oldKey: requestData.licenseKey,
      newKey: newKey,
    });
  } catch (error) {
    console.error("❌ Error replacing key and generating PDF:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  replaceKeyAndGenerateLicensePdf,
};