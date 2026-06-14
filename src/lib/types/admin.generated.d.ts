/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
import type * as AdminTypes from './admin.types.d.ts';

export type CartRadarBillingActivateMutationVariables = AdminTypes.Exact<{
  name: AdminTypes.Scalars['String']['input'];
  returnUrl: AdminTypes.Scalars['URL']['input'];
  lineItems: Array<AdminTypes.AppSubscriptionLineItemInput> | AdminTypes.AppSubscriptionLineItemInput;
  test?: AdminTypes.InputMaybe<AdminTypes.Scalars['Boolean']['input']>;
}>;


export type CartRadarBillingActivateMutation = { appSubscriptionCreate?: AdminTypes.Maybe<(
    Pick<AdminTypes.AppSubscriptionCreatePayload, 'confirmationUrl'>
    & { userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>>, appSubscription?: AdminTypes.Maybe<Pick<AdminTypes.AppSubscription, 'id'>> }
  )> };

export type CartRadarBillingCancelMutationVariables = AdminTypes.Exact<{
  id: AdminTypes.Scalars['ID']['input'];
}>;


export type CartRadarBillingCancelMutation = { appSubscriptionCancel?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>>, appSubscription?: AdminTypes.Maybe<Pick<AdminTypes.AppSubscription, 'id' | 'status'>> }> };

export type CartRadarSubscriptionQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type CartRadarSubscriptionQuery = { currentAppInstallation: { activeSubscriptions: Array<Pick<AdminTypes.AppSubscription, 'id' | 'status'>> } };

export type CartRadarDraftOrderCreateMutationVariables = AdminTypes.Exact<{
  input: AdminTypes.DraftOrderInput;
}>;


export type CartRadarDraftOrderCreateMutation = { draftOrderCreate?: AdminTypes.Maybe<{ userErrors: Array<Pick<AdminTypes.UserError, 'field' | 'message'>>, draftOrder?: AdminTypes.Maybe<Pick<AdminTypes.DraftOrder, 'id' | 'name' | 'invoiceUrl'>> }> };

export type CartRadarShopProfileQueryVariables = AdminTypes.Exact<{ [key: string]: never; }>;


export type CartRadarShopProfileQuery = { shop: Pick<AdminTypes.Shop, 'name' | 'currencyCode'> };

interface GeneratedQueryTypes {
  "#graphql\n\t\tquery CartRadarSubscription {\n\t\t\tcurrentAppInstallation {\n\t\t\t\tactiveSubscriptions {\n\t\t\t\t\tid\n\t\t\t\t\tstatus\n\t\t\t\t}\n\t\t\t}\n\t\t}": {return: CartRadarSubscriptionQuery, variables: CartRadarSubscriptionQueryVariables},
  "#graphql\n\t\t\tquery CartRadarShopProfile {\n\t\t\t\tshop {\n\t\t\t\t\tname\n\t\t\t\t\tcurrencyCode\n\t\t\t\t}\n\t\t\t}": {return: CartRadarShopProfileQuery, variables: CartRadarShopProfileQueryVariables},
}

interface GeneratedMutationTypes {
  "#graphql\n\t\tmutation CartRadarBillingActivate(\n\t\t\t$name: String!\n\t\t\t$returnUrl: URL!\n\t\t\t$lineItems: [AppSubscriptionLineItemInput!]!\n\t\t\t$test: Boolean\n\t\t) {\n\t\t\tappSubscriptionCreate(name: $name, returnUrl: $returnUrl, lineItems: $lineItems, test: $test) {\n\t\t\t\tuserErrors { field message }\n\t\t\t\tconfirmationUrl\n\t\t\t\tappSubscription { id }\n\t\t\t}\n\t\t}": {return: CartRadarBillingActivateMutation, variables: CartRadarBillingActivateMutationVariables},
  "#graphql\n\t\tmutation CartRadarBillingCancel($id: ID!) {\n\t\t\tappSubscriptionCancel(id: $id) {\n\t\t\t\tuserErrors { field message }\n\t\t\t\tappSubscription { id status }\n\t\t\t}\n\t\t}": {return: CartRadarBillingCancelMutation, variables: CartRadarBillingCancelMutationVariables},
  "#graphql\n\t\tmutation CartRadarDraftOrderCreate($input: DraftOrderInput!) {\n\t\t\tdraftOrderCreate(input: $input) {\n\t\t\t\tuserErrors { field message }\n\t\t\t\tdraftOrder { id name invoiceUrl }\n\t\t\t}\n\t\t}": {return: CartRadarDraftOrderCreateMutation, variables: CartRadarDraftOrderCreateMutationVariables},
}
declare module '@shopify/admin-api-client' {
  type InputMaybe<T> = AdminTypes.InputMaybe<T>;
  interface AdminQueries extends GeneratedQueryTypes {}
  interface AdminMutations extends GeneratedMutationTypes {}
}
