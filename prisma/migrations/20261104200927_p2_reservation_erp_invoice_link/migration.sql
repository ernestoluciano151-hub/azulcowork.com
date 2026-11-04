-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "erpInvoiceId" TEXT;

-- AddForeignKey
ALTER TABLE "ErpInvoice" ADD CONSTRAINT "ErpInvoice_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
