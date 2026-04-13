/**
 * @deprecated Import from `@/lib/buyer-vendor-import` — sellers are Company rows with `isSeller`.
 */
export type {
  BuyerVendorImportPayload as SellerImportPayload,
  BuyerVendorImportResult as SellerImportResult
} from '@/lib/buyer-vendor-import';
export {
  runSellerVendorImport as runSellerImport,
  isSellerVendorImportBody as isSellerImportBody
} from '@/lib/buyer-vendor-import';
