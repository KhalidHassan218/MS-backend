import express from "express";
const router = express.Router()
import invoiceConrtollers from "../../controllers/invoice/invoice.controller.js"


router.put("/generate-invoice/order/:orderId", invoiceConrtollers?.generateInvoicePdf)



export default router