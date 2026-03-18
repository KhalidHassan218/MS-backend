// Firebase Firestore removed. Use Supabase instead.
import generateLicencePDFBuffer from "../../services/pdf/generateLicencePDF.service.js";
import { uploadPDFToSupabaseStorage } from "../../services/supabaseStorage.service.js";
import sendEmailWithAttachment from "../../Utils/sendEmailWithAttachment.js";
// import savePDFRecord from "../../services/pdf/savePdfRecord.service.js";
import generateKeyReplacementEmail from "../../services/emails/generateKeyReplacementEmail.js";


import { getById, updateById, findOne, findAll } from '../../Utils/supabaseDbUtils.js';
import { getOrderWithProfile, updateOrder } from "../../Utils/supabaseOrderService.js";
import { supabaseAdmin } from '../../config/supabase.js';
import { logDocumentEvent, getMasqueradeFromRequest } from '../../services/auditTrail.service.js';

const replaceKeyAndGenerateLicensePdf = async (req, res) => {
  const {
    feedback,
    productId,
    orderId,
    orderNumber,
    user_id: uid,
    requestId,
  } = req.body;

  try {
    // 1️⃣ Get replacement request
    const requestData = await getById('replacement_requests', requestId);
    if (requestData.status !== 'pending') throw new Error('Request already processed');

    // 2️⃣ Get user data
    const userData = await getById('profiles', uid);
    const { b2b_supplier_id: b2b_supplier_id, company_country: companyCountry, email } = userData;

    // 3️⃣ Get order and products
    const orderData = await getById('orders', orderId);
    let products = orderData.products || [];

    // 4️⃣ Find available new license key
    const availableKeys = await findAll('license_keys', { status: 'available', product_id: productId });
    if (!availableKeys.length) throw new Error('No available license keys');
    const newKeyObj = availableKeys[0];
    console.log("newKeyObj", newKeyObj);
    console.log("requestData", requestData);

    const newKey = newKeyObj.license_key;

    // 5️⃣ Find old key
    const oldKey = requestData.old_key;
    const oldKeyObj = (await findAll('license_keys', { license_key: oldKey, product_id: productId }))[0];
    console.log("products", products);

    // 6️⃣ Update products array in order
    const productIndex = products.findIndex((p) => p.productId === productId);
    if (productIndex === -1) throw new Error('Product not found in order');
    const product = products[productIndex];
    console.log("product proooo", product);
    console.log("oldKey oldKey", oldKey);

    const oldKeyIndex = product.licenseKeys.findIndex((k) => k.key === oldKey && k.status === 'active');
    if (oldKeyIndex === -1) throw new Error('Old key not found or already replaced');
    product.licenseKeys[oldKeyIndex] = {
      ...product.licenseKeys[oldKeyIndex],
      status: 'replaced',
      replacedAt: new Date().toISOString(),
      replacementReason: requestData.reason,
    };
    product.licenseKeys.push({
      key: newKey.slice(-5),
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
      license_key: newKey,
      used_at: new Date().toISOString(),
      notes: 'Key replacement',
      user_id: uid,
      order_number: orderNumber,
      b2b_supplier_id: b2b_supplier_id,
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

    // 10️⃣ Prepare PDF data — fetch current install URLs from products table
    const replProductIds = products.map((p) => p.productId).filter(Boolean);
    const replInstallUrlLookup = {};
    if (replProductIds.length > 0) {
      const { data: currentProducts } = await supabaseAdmin
        .from('products')
        .select('id, install_url_en, install_url_de, install_url_fr, install_url_nl')
        .in('id', replProductIds);
      if (currentProducts) {
        for (const cp of currentProducts) {
          replInstallUrlLookup[cp.id] = cp;
        }
      }
    }
    const updatedProducts = products.map((p) => {
      const activeKeys = p.licenseKeys.filter((k) => k.status === 'active').map((k) => k.key);
      const newKeys = p.licenseKeys.filter((k) => k.status === 'active' && k.isReplacement).map((k) => k.key);
      const currentUrls = replInstallUrlLookup[p.productId] || {};
      return {
        ...p,
        licenseKeys: activeKeys,
        newLicenseKeys: newKeys,
        install_url_en: p.install_url_en || currentUrls.install_url_en || '',
        install_url_de: p.install_url_de || currentUrls.install_url_de || '',
        install_url_fr: p.install_url_fr || currentUrls.install_url_fr || '',
        install_url_nl: p.install_url_nl || currentUrls.install_url_nl || '',
      };
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
    // try {
    //   await sendEmailWithAttachment(
    //     emailContent.subject,
    //     emailContent.html,
    //     email,
    //     process.env.EMAIL_USER,
    //     process.env.EMAIL_USER,
    //     [
    //       {
    //         filename: `License-${orderNumber}.pdf`,
    //         content: pdfBuffer,
    //         contentType: 'application/pdf',
    //       },
    //     ]
    //   );
    // } catch (error) {
    //   console.log("error key replacment email", error);

    // }
    res.status(200).json({
      success: true,
      message: 'key replaced successfully',
      oldKey,
      newKey,
    });
  } catch (error) {
    console.error('❌ Error replacing key:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


const generateLicensePdf = async (req, res) => {
  const {
    orderId
  } = req.params;

  try {
    if (!orderId) throw new Error('Order ID is required');
    const userProfileFields = ['company_name', 'email', 'company_country', 'company_city', 'tax_id', 'company_house_number', 'company_street', 'company_zip_code'];
    const orderData = await getOrderWithProfile(orderId, userProfileFields);
    const {
      user_id,
      order_number,
      internal_status,
      payment_status,
      po_number,
      total_amount,
      currency,
      created_at,
      products,
      payment_due_date,
      profiles: {
        company_name,
        email,
        company_country,
        company_city,
        tax_id,
        company_house_number,
        company_street,
        company_zip_code
      } = {}
    } = orderData || {};

    // ✅ Now you can use them directly:
    console.log(company_name);
    console.log(total_amount);

    const data = {
      user_id: user_id,
      order_number: order_number,
      internal_status: internal_status,
      payment_status: payment_status,
      email: email,
      po_number: po_number,
      total_amount: total_amount,
      currency: currency,
      created_at: created_at,
      products: products.map((item) => ({
        productId: item?.productId,
        name: item?.name,
        quantity: item?.quantity,
        unitPrice: item?.unitPrice,
        totalPrice:
          item?.amount_total,
        isDigital:
          item?.isDigital === "true", // Retrieve from metadata
        pn: item?.pn,
        image_url: item?.image_url,
      })),
    };
    console.log("orderData", orderData);


    const licenseData = {
      customer: {
        name: company_name,
        businessName: company_name,
        address: {
          line1: company_country,
          postalCode: company_zip_code,
          country: company_country,
        },
      },
      order: {
        id: orderId,
        number: order_number,
        date: new Date(),
      },
      products: products,
    }



    const pdfBuffer = await generateLicencePDFBuffer(
      licenseData,
      company_country,
      false,
      company_name, company_city, company_street, company_house_number, company_zip_code, tax_id
    );



    const licensePdfUrl = await uploadPDFToSupabaseStorage(
      order_number,
      pdfBuffer,
      "License",
    );

    const result = await updateOrder(orderId, {
      license_url: licensePdfUrl,
    });

    res.status(200).json({
      success: true,
      message: 'license generated successfully',
    });
  } catch (error) {
    console.error('❌ Error generate license:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};



/**
 * POST /api/licenses/generate-customer-license/:orderId
 *
 * Generates a Customer License PDF containing ONLY the keys that the user has
 * revealed. The frontend sends the revealed key identifiers in the request body
 * (source of truth), so this endpoint does NOT rely on revealedAt being
 * persisted in the JSONB — it uses the client-supplied list to match keys,
 * fetches full values from license_keys table, generates the PDF, and also
 * persists revealedAt back into the JSONB via supabaseAdmin (service role)
 * so future page loads see the correct state.
 *
 * Body: { revealedKeys: [{ licenseDocId?, key? }, ...] }
 *
 * Flow:
 * 1. Auth — user must own the order or be admin
 * 2. Match client-supplied revealed keys against order products
 * 3. Fetch actual key values from license_keys table
 * 4. Persist revealedAt into order JSONB via supabaseAdmin (reliable)
 * 5. Generate PDF via Puppeteer pipeline
 * 6. Upload to Supabase Storage
 * 7. Update order with customer_license_url + customer_license_generated_at
 * 8. Log audit event
 * 9. Return { success, url, generatedAt, revealedKeysCount }
 */
const generateCustomerLicensePdf = async (req, res) => {
  const { orderId } = req.params;
  const { revealedKeys: clientRevealedKeys } = req.body || {};

  try {
    if (!orderId) throw new Error('Order ID is required');

    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });

    console.log(`📄 [CustomerLicense] orderId=${orderId}, clientRevealedKeys count=${Array.isArray(clientRevealedKeys) ? clientRevealedKeys.length : 0}`);
    console.log(`📄 [CustomerLicense] clientRevealedKeys:`, JSON.stringify(clientRevealedKeys));

    if (!Array.isArray(clientRevealedKeys) || clientRevealedKeys.length === 0) {
      return res.status(400).json({ success: false, message: 'No revealed keys provided' });
    }

    // 1. Fetch order with profile data
    const userProfileFields = [
      'company_name', 'email', 'company_country', 'company_city',
      'tax_id', 'company_house_number', 'company_street', 'company_zip_code',
    ];
    const orderData = await getOrderWithProfile(orderId, userProfileFields);

    if (!orderData) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // 2. Auth check — user must own the order or be admin
    if (orderData.user_id !== userId && !req.isAdmin) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const {
      order_number,
      products,
      profiles: {
        company_name,
        company_country,
        company_city,
        tax_id,
        company_house_number,
        company_street,
        company_zip_code,
      } = {},
    } = orderData;

    // 3. Build a lookup Set from the client-supplied revealed key identifiers
    const revealedByDocId = new Set();
    const revealedByKey = new Set();
    for (const rk of clientRevealedKeys) {
      if (rk.licenseDocId) revealedByDocId.add(rk.licenseDocId);
      else if (rk.key) revealedByKey.add(rk.key);
    }

    // 4. Match revealed keys, batch-fetch full values in ONE query, collect for PDF
    const revealedProducts = [];
    const now = new Date().toISOString();
    const updatedProducts = JSON.parse(JSON.stringify(products || []));

    // First pass: identify which keys are revealed and collect their licenseDocIds
    const allDocIds = []; // UUIDs to batch-fetch from license_keys table
    const revealedMap = []; // { pIdx, kIdx, keyId, fallbackKey }

    for (let pIdx = 0; pIdx < updatedProducts.length; pIdx++) {
      const product = updatedProducts[pIdx];
      for (let kIdx = 0; kIdx < (product.licenseKeys || []).length; kIdx++) {
        const k = product.licenseKeys[kIdx];
        if (k.status === 'replaced') continue;

        const isRevealed =
          (k.licenseDocId && revealedByDocId.has(k.licenseDocId)) ||
          (k.key && revealedByKey.has(k.key));
        if (!isRevealed) continue;

        // Stamp revealedAt if missing
        if (!k.revealedAt) {
          updatedProducts[pIdx].licenseKeys[kIdx].revealedAt = now;
        }

        const keyId = k.licenseDocId || k.id;
        if (keyId) allDocIds.push(keyId);
        revealedMap.push({ pIdx, kIdx, keyId, fallbackKey: k.key });
      }
    }

    // Batch-fetch all full key values in ONE query (handles 1000+ keys)
    const keyLookup = new Map(); // id -> license_key
    if (allDocIds.length > 0) {
      // Supabase .in() supports up to ~1000 items; chunk for safety
      const CHUNK = 500;
      for (let i = 0; i < allDocIds.length; i += CHUNK) {
        const chunk = allDocIds.slice(i, i + CHUNK);
        const { data: rows } = await supabaseAdmin
          .from('license_keys')
          .select('id, license_key')
          .in('id', chunk);
        if (rows) {
          for (const row of rows) {
            keyLookup.set(row.id, row.license_key);
          }
        }
      }
    }

    // Second pass: build revealedProducts using the lookup map
    // Group by product index
    const productKeysMap = new Map(); // pIdx -> [fullKeyValue, ...]
    for (const entry of revealedMap) {
      const fullKey = entry.keyId
        ? (keyLookup.get(entry.keyId) || entry.fallbackKey)
        : entry.fallbackKey;
      if (!fullKey) continue;

      if (!productKeysMap.has(entry.pIdx)) productKeysMap.set(entry.pIdx, []);
      productKeysMap.get(entry.pIdx).push({ key: fullKey });
    }

    // Fetch current install URLs from the products table (order data may predate these fields)
    const productIds = [...productKeysMap.keys()].map((pIdx) => updatedProducts[pIdx]?.productId).filter(Boolean);
    const installUrlLookup = {};
    if (productIds.length > 0) {
      const { data: currentProducts } = await supabaseAdmin
        .from('products')
        .select('id, install_url_en, install_url_de, install_url_fr, install_url_nl')
        .in('id', productIds);
      if (currentProducts) {
        for (const cp of currentProducts) {
          installUrlLookup[cp.id] = cp;
        }
      }
    }

    for (const [pIdx, keysWithValues] of productKeysMap) {
      const product = updatedProducts[pIdx];
      const currentUrls = installUrlLookup[product.productId] || {};
      revealedProducts.push({
        name: product.name,
        quantity: keysWithValues.length,
        pn: product.PN || product.pn || '',
        licenseKeys: keysWithValues,
        install_url_en: product.install_url_en || currentUrls.install_url_en || '',
        install_url_de: product.install_url_de || currentUrls.install_url_de || '',
        install_url_fr: product.install_url_fr || currentUrls.install_url_fr || '',
        install_url_nl: product.install_url_nl || currentUrls.install_url_nl || '',
      });
    }

    console.log(`📄 [CustomerLicense] revealedByDocId: ${[...revealedByDocId].length}, revealedByKey: ${[...revealedByKey].length}`);
    console.log(`📄 [CustomerLicense] matched revealedProducts: ${revealedProducts.length}, total keys: ${revealedProducts.reduce((s, p) => s + p.licenseKeys.length, 0)}`);

    if (revealedProducts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No matching revealed keys found for this order',
      });
    }

    // 5. Build license data structure for PDF generation
    const licenseData = {
      customer: {
        name: company_name,
        businessName: company_name,
        address: {
          line1: company_country,
          postalCode: company_zip_code,
          country: company_country,
        },
      },
      order: {
        id: orderId,
        number: order_number,
        date: new Date(),
      },
      products: revealedProducts,
    };

    // 6. Generate PDF
    const pdfBuffer = await generateLicencePDFBuffer(
      licenseData,
      company_country,
      false,
      company_name, company_city, company_street, company_house_number, company_zip_code, tax_id
    );

    // 7. Upload to Supabase Storage
    const licensePdfUrl = await uploadPDFToSupabaseStorage(
      order_number,
      pdfBuffer,
      'CustomerLicense',
    );

    // 8. Persist revealedAt + license URL in one update via supabaseAdmin
    const generatedAt = new Date().toISOString();
    await updateOrder(orderId, {
      products: updatedProducts,
      customer_license_url: licensePdfUrl,
      customer_license_generated_at: generatedAt,
    });

    // 9. Log audit event
    const totalRevealedKeys = revealedProducts.reduce((sum, p) => sum + p.licenseKeys.length, 0);

    logDocumentEvent.generated(
      'customer_license',
      orderId,
      order_number,
      orderData.user_id,
      {
        fileName: `CustomerLicense-${order_number}.pdf`,
        storageUrl: licensePdfUrl,
        revealedKeysCount: totalRevealedKeys,
      },
      getMasqueradeFromRequest(req)
    );

    // Append cache-bust param so the browser always fetches the fresh PDF
    const cacheBustedUrl = `${licensePdfUrl}?v=${Date.now()}`;

    res.status(200).json({
      success: true,
      url: cacheBustedUrl,
      generatedAt,
      revealedKeysCount: totalRevealedKeys,
    });
  } catch (error) {
    console.error('❌ Error generating customer license:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};


export default {
  replaceKeyAndGenerateLicensePdf,
  generateLicensePdf,
  generateCustomerLicensePdf,
};
