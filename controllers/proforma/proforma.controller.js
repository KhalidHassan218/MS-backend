import { uploadPDFToSupabaseStorage } from "../../services/supabaseStorage.service.js";


import { getOrderWithProfile, updateOrder } from "../../Utils/supabaseOrderService.js";
import { generateProformaPDFBuffer } from "../../services/pdf/generateProformaPDF.service.js";

const generateProformaPdf = async (req, res) => {
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
        const proformaPdfBuffer = await generateProformaPDFBuffer(
            data,
            order_number,
            products,
            company_country,
            tax_id,
            company_city,
            company_house_number,
            company_street,
            company_zip_code,
            company_name,
            payment_due_date
        );
        const proformaPdfUrl = await uploadPDFToSupabaseStorage(
            order_number,
            proformaPdfBuffer,
            "Proforma",
        );
        
       const result = await updateOrder(orderId, {
            proforma_generated_at: new Date().toISOString(),
            proforma_url: proformaPdfUrl,
        });
        console.log("resultresult",result);
        
        res.status(200).json({
            success: true,
            message: 'proforma generated successfully',
        });
    } catch (error) {
        console.error('❌ Error generate proforma:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

export default {
    generateProformaPdf,
};
