import { getFirestore } from "firebase-admin/firestore";


async function savePDFRecord(orderId, pdfUrl) {
    const db = getFirestore();
    await db.collection("pdfDocuments").add({
        orderId,
        pdfUrl,
        createdAt: new Date(),
    });
}


export default savePDFRecord;