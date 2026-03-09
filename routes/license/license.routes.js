import express from "express";
const router = express.Router()
import licenseConrtollers from "../../controllers/license/license.controller.js"
import requireAuth from "../../middleware/auth.js"


router.post("/generate-with-key-replacement", licenseConrtollers?.replaceKeyAndGenerateLicensePdf)
router.put("/generate-license/order/:orderId", licenseConrtollers?.generateLicensePdf)
router.post("/generate-customer-license/:orderId", requireAuth, licenseConrtollers?.generateCustomerLicensePdf)



export default router