import express from "express";
const router = express.Router()
import licenseConrtollers from "../../controllers/license/license.controller.js"


router.post("/generate-with-key-replacement", licenseConrtollers?.replaceKeyAndGenerateLicensePdf)
router.put("/generate-license/order/:orderId", licenseConrtollers?.generateLicensePdf)



export default router