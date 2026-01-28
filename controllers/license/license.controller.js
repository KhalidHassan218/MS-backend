// Firebase Firestore removed. Use Supabase instead.
import generateLicencePDFBuffer from "../../services/pdf/generateLicencePDF.service.js";
import { uploadPDFToSupabaseStorage } from "../../services/supabaseStorage.service.js";
import sendEmailWithAttachment from "../../Utils/sendEmailWithAttachment.js";
// import savePDFRecord from "../../services/pdf/savePdfRecord.service.js";
import generateKeyReplacementEmail from "../../services/emails/generateKeyReplacementEmail.js";


import { getById, updateById, findOne, findAll } from '../../Utils/supabaseDbUtils.js';

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
    // 1️⃣ Get replacement request
    const requestData = await getById('replacement_requests', requestId);
    if (requestData.status !== 'pending') throw new Error('Request already processed');

    // 2️⃣ Get user data
    const userData = await getById('profiles', uid);
    const { b2b_supplier_id: b2bSupplierId, company_country: companyCountry, email } = userData;

    // 3️⃣ Get order and products
    const orderData = await getById('orders', orderId);
    let products = orderData.products || [];

    // 4️⃣ Find available new license key
    const availableKeys = await findAll('license_keys', { status: 'available', product_id: productId });
    if (!availableKeys.length) throw new Error('No available license keys');
    const newKeyObj = availableKeys[0];
    const newKey = newKeyObj.key_value;

    // 5️⃣ Find old key
    const oldKey = requestData.license_key;
    const oldKeyObj = (await findAll('license_keys', { key_value: oldKey, product_id: productId }))[0];

    // 6️⃣ Update products array in order
    const productIndex = products.findIndex((p) => p.productId === productId);
    if (productIndex === -1) throw new Error('Product not found in order');
    const product = products[productIndex];
    const oldKeyIndex = product.licenseKeys.findIndex((k) => k.key === oldKey && k.status === 'active');
    if (oldKeyIndex === -1) throw new Error('Old key not found or already replaced');
    product.licenseKeys[oldKeyIndex] = {
      ...product.licenseKeys[oldKeyIndex],
      status: 'replaced',
      replacedAt: new Date().toISOString(),
      replacementReason: requestData.reason,
    };
    product.licenseKeys.push({
      key: newKey,
      status: 'active',
      isReplacement: true,
      addedAt: new Date().toISOString(),
      replacedOldKey: oldKey,
      licenseDocId: newKeyObj.id,
    });
    product.replacementHistory = product.replacementHistory || [];
    product.replacementHistory.push({
      replacementId: `repl_${Date.now()}`,
      oldKey,
      newKey,
      reason: requestData.reason,
      replacedAt: new Date().toISOString(),
      replacedBy: uid,
      requestId,
    });
    products[productIndex] = product;

    // 7️⃣ Update license_keys table
    await updateById('license_keys', newKeyObj.id, {
      status: 'used',
      order_id: orderId,
      key_value: newKey,
      used_at: new Date().toISOString(),
      notes: 'Key replacement',
      is_replacement: true,
    });
    if (oldKeyObj) {
      await updateById('license_keys', oldKeyObj.id, {
        status: 'replaced',
        notes: requestData.reason,
        is_replacement: false,
      });
    }

    // 8️⃣ Update order
    await updateById('orders', orderId, {
      products,
      // Optionally: add a key_replacements array or log
    });

    // 9️⃣ Update replacement_requests
    await updateById('replacement_requests', requestId, {
      status: 'resolved',
      new_key: newKey,
      processed_at: new Date().toISOString(),
      processed_by: uid,
    });

    // 10️⃣ Prepare PDF data
    const updatedProducts = products.map((p) => {
      const activeKeys = p.licenseKeys.filter((k) => k.status === 'active').map((k) => k.key);
      const newKeys = p.licenseKeys.filter((k) => k.status === 'active' && k.isReplacement).map((k) => k.key);
      return { ...p, licenseKeys: activeKeys, newLicenseKeys: newKeys };
    });
    const fullOrderDataForPDF = {
      customer: orderData.customer || {
        name: orderData.company_name || '',
        businessName: orderData.company_name || '',
      },
      order: {
        id: orderId,
        number: orderNumber,
        date: orderData.created_at || Date.now() / 1000,
      },
      products: updatedProducts,
    };

    // 11️⃣ Generate PDF
    const pdfBuffer = await generateLicencePDFBuffer(fullOrderDataForPDF, companyCountry, true);
    const licensePdfUrl = await uploadPDFToSupabaseStorage(orderNumber, pdfBuffer, 'License');

    // 12️⃣ Email
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
          contentType: 'application/pdf',
        },
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Email with PDF sent successfully',
      oldKey,
      newKey,
    });
  } catch (error) {
    console.error('❌ Error replacing key:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  replaceKeyAndGenerateLicensePdf,
};
