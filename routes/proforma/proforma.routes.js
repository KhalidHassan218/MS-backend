import express from "express";
const router = express.Router()
import proformaConrtollers from "../../controllers/proforma/proforma.controller.js"


router.put("/generate-proforma/order/:orderId", proformaConrtollers?.generateProformaPdf)



export default router