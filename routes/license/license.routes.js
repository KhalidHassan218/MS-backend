import express from "express";
const router = express.Router()
import licenseConrtollers from "../../controllers/license/license.controller.js"


router.post("/generate-with-key-replacement", licenseConrtollers?.replaceKeyAndGenerateLicensePdf)



export default router