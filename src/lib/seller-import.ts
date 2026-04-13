/**
 * @deprecated Import from `@/lib/buyer-vendor-import` — buyers are Company rows with `isBuyer`.
 */
export type {
  BuyerVendorImportPayload as SellerImportPayload,
  BuyerVendorImportResult as SellerImportResult
} from '@/lib/buyer-vendor-import';
export {
  runBuyerVendorImport as runSellerImport,
  isBuyerVendorImportBody as isSellerImportBody
} from '@/lib/buyer-vendor-import';
