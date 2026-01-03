/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type PopulateProductMutationVariables = AdminTypes.Exact<{
  product: AdminTypes.ProductCreateInput;
}>;


export type PopulateProductMutation = { productCreate?: AdminTypes.Maybe<{ product?: AdminTypes.Maybe<(
      Pick<AdminTypes.Product, 'id' | 'title' | 'handle' | 'status'>
      & { variants: { edges: Array<{ node: Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'> }> } }
    )> }> };

export type UpdateVariantMutationVariables = AdminTypes.Exact<{
  productId: AdminTypes.Scalars['ID']['input'];
  variants: Array<AdminTypes.ProductVariantsBulkInput> | AdminTypes.ProductVariantsBulkInput;
}>;


export type UpdateVariantMutation = { productVariantsBulkUpdate?: AdminTypes.Maybe<{ productVariants?: AdminTypes.Maybe<Array<Pick<AdminTypes.ProductVariant, 'id' | 'price' | 'barcode' | 'createdAt'>>> }> };

interface GeneratedQueryTypes {
}

interface GeneratedMutationTypes {
  "#graphql\n\t\t\t\tmutation populateProduct($product: ProductCreateInput!) {\n\t\t\t\t\tproductCreate(product: $product) {\n\t\t\t\t\t\tproduct {\n\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\ttitle\n\t\t\t\t\t\t\thandle\n\t\t\t\t\t\t\tstatus\n\t\t\t\t\t\t\tvariants(first: 10) {\n\t\t\t\t\t\t\t\tedges {\n\t\t\t\t\t\t\t\t\tnode {\n\t\t\t\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\t\t\t\tprice\n\t\t\t\t\t\t\t\t\t\tbarcode\n\t\t\t\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t\t}\n\t\t\t\t\t\t\t}\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}": {return: PopulateProductMutation, variables: PopulateProductMutationVariables},
  "#graphql\n\t\t\t\tmutation updateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {\n\t\t\t\t\tproductVariantsBulkUpdate(productId: $productId, variants: $variants) {\n\t\t\t\t\t\tproductVariants {\n\t\t\t\t\t\t\tid\n\t\t\t\t\t\t\tprice\n\t\t\t\t\t\t\tbarcode\n\t\t\t\t\t\t\tcreatedAt\n\t\t\t\t\t\t}\n\t\t\t\t\t}\n\t\t\t\t}": {return: UpdateVariantMutation, variables: UpdateVariantMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
