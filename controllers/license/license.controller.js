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

  try {
    const db = getFirestore();

    // 1️⃣ Get replacement request (OUTSIDE transaction is OK)
    const requestRef = db.collection("keys_replacment_req").doc(requestId);
    const requestSnap = await requestRef.get();
    if (!requestSnap.exists) throw new Error("Replacement request not found");

    const requestData = requestSnap.data();
    if (requestData.status !== "pending") {
      throw new Error("Request already processed");
    }

    // 2️⃣ Get user data
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) throw new Error("User not found");

    const { b2bSupplierId, companyCountry, email } = userSnap.data();

    const ordersRef = db.collection("orders").doc(orderId);
    const licenseKeysRef = db.collection("licenseKeys");

    let newKey = null;
    let oldKey = requestData.licenseKey;
    let fullOrderDataForPDF = null;

    // 3️⃣ Transaction
    await db.runTransaction(async (tx) => {
      // ============
      // 🔹 ALL READS
      // ============

      const orderSnap = await tx.get(ordersRef);
      if (!orderSnap.exists) throw new Error("Order not found");
      const orderData = orderSnap.data();

      const newKeySnap = await tx.get(
        licenseKeysRef
          .where("status", "==", "available")
          .where("productId", "==", productId)
          .limit(1)
      );
      if (newKeySnap.empty) {
        throw new Error("No available license keys");
      }

      const newKeyDoc = newKeySnap.docs[0];
      newKey = newKeyDoc.data().key;

      const oldKeySnap = await tx.get(
        licenseKeysRef
          .where("key", "==", oldKey)
          .where("productId", "==", productId)
          .limit(1)
      );

      const oldKeyDoc = oldKeySnap.empty ? null : oldKeySnap.docs[0];

      // ============
      // 🔹 DATA PREP
      // ============

      const productIndex = orderData.products.findIndex(
        (p) => p.productId === productId
      );
      if (productIndex === -1) {
        throw new Error("Product not found in order");
      }

      const product = orderData.products[productIndex];

      const oldKeyIndex = product.licenseKeys.findIndex(
        (k) => k.key === oldKey && k.status === "active"
      );
      if (oldKeyIndex === -1) {
        throw new Error("Old key not found or already replaced");
      }

      // Update old key in order
      product.licenseKeys[oldKeyIndex] = {
        ...product.licenseKeys[oldKeyIndex],
        status: "replaced",
        replacedAt: Date.now(),
        replacementReason: requestData.reason,
      };

      // Add new key
      product.licenseKeys.push({
        key: newKey,
        status: "active",
        isReplacement: true,
        addedAt: Date.now(),
        replacedOldKey: oldKey,
        licenseDocId: newKeyDoc.id,
      });

      product.replacementHistory = product.replacementHistory || [];
      product.replacementHistory.push({
        replacementId: `repl_${Date.now()}`,
        oldKey,
        newKey,
        reason: requestData.reason,
        replacedAt: Date.now(),
        replacedBy: uid,
        requestId,
      });

      orderData.products[productIndex] = product;

      // ============
      // 🔹 ALL WRITES
      // ============

      tx.update(newKeyDoc.ref, {
        status: "used",
        orderId,
        orderNumber,
        usedAt: FieldValue.serverTimestamp(),
        b2bSupplierId,
        uid,
        adminNote: "Key replacement",
      });

      if (oldKeyDoc) {
        tx.update(oldKeyDoc.ref, {
          status: "replaced",
          replacedAt: FieldValue.serverTimestamp(),
          replacementReason: requestData.reason,
          replacedBy: uid,
          newKey,
          requestId,
        });
      }

      tx.update(ordersRef, {
        products: orderData.products,
        keyReplacements: FieldValue.arrayUnion({
          feedback,
          feedbackUpdatedAt: new Date(),
          keyReplaced: true,
          productId,
          productName: requestData.productName,
          oldKey,
          newKey,
          reason: requestData.reason,
          replacedAt: new Date(),
          replacedBy: uid,
          requestId,
        }),
      });

      tx.update(requestRef, {
        status: "resolved",
        newLicenseKey: newKey,
        processedAt: FieldValue.serverTimestamp(),
        processedBy: uid,
      });

      // ============
      // 🔹 PDF DATA
      // ============

      const updatedProducts = orderData.products.map((p) => {
        const activeKeys = p.licenseKeys
          .filter((k) => k.status === "active")
          .map((k) => k.key);

        const newKeys = p.licenseKeys
          .filter((k) => k.status === "active" && k.isReplacement)
          .map((k) => k.key);

        return {
          ...p,
          licenseKeys: activeKeys,
          newLicenseKeys: newKeys,
        };
      });

      fullOrderDataForPDF = {
        customer: orderData.customer || {
          name: orderData.bussinessName || "",
          businessName: orderData.bussinessName || "",
        },
        order: {
          id: orderId,
          number: orderNumber,
          date: orderData.createdAt?.seconds || Date.now() / 1000,
        },
        products: updatedProducts,
      };
    });

    // 4️⃣ Generate PDF
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

    // 5️⃣ Email
    const emailContent = generateKeyReplacementEmail(companyCountry);

    await sendEmailWithAttachment(
      emailContent.subject,
      emailContent.html,
      email,
      process.env.EMAIL_USER,
      process.env.EMAIL_USER,
      [
        {
          filename: `License-${orderNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ]
    );

    res.status(200).json({
      success: true,
      message: "Email with PDF sent successfully",
      oldKey,
      newKey,
    });
  } catch (error) {
    console.error("❌ Error replacing key:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export default {
  replaceKeyAndGenerateLicensePdf,
};
