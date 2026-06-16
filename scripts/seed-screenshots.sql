-- Realistic demo data for App Store screenshots (local DB only).
-- Tagged `shot-%` so it's easy to remove:
--   DELETE FROM checkouts WHERE checkout_token LIKE 'shot-%';  (alerts cascade)
-- Re-run safely: it clears its own rows first.

DELETE FROM checkouts
WHERE shop = 'cart-radar-dev-store.myshopify.com' AND checkout_token LIKE 'shot-%';

INSERT INTO checkouts (
  shop, checkout_token, total_price, currency, item_count,
  customer_name, customer_email, line_items, status,
  checkout_created_at, last_activity_at, alerted_at,
  recovered_at, recovered_order_id, recovered_amount, recovery_match, updated_at
)
SELECT
  'cart-radar-dev-store.myshopify.com',
  'shot-' || i,
  (g.price * g.qty)::numeric(12, 2),
  'USD',
  g.qty,
  g.cust,
  lower(replace(g.cust, ' ', '.')) || '@example.com',
  jsonb_build_array(
    jsonb_build_object(
      'title', g.prod, 'quantity', g.qty, 'price', g.price::text,
      'variantTitle', NULL, 'sku', NULL, 'variantId', NULL
    )
  ),
  g.status,
  g.last_active - interval '20 minutes',
  g.last_active,
  CASE WHEN g.status IN ('alerted', 'recovered') THEN g.last_active + interval '90 minutes' END,
  CASE WHEN g.status = 'recovered' THEN g.last_active + make_interval(hours => 3 + (i % 12)) END,
  CASE WHEN g.status = 'recovered' THEN '90' || (1000 + i)::text END,
  CASE WHEN g.status = 'recovered' THEN (g.price * g.qty)::numeric(12, 2) END,
  CASE WHEN g.status = 'recovered' THEN (CASE WHEN i % 3 = 0 THEN 'email' ELSE 'token' END) END,
  now()
FROM generate_series(1, 25) AS i
CROSS JOIN LATERAL (
  SELECT
    (ARRAY['Olivia Bennett','Liam Carter','Emma Rodriguez','Noah Patel','Ava Thompson',
           'Sophia Nguyen','Mason Walker','Isabella Rossi','Ethan Park','Mia Johansson',
           'Lucas Meyer','Charlotte Dubois'])[1 + (i % 12)] AS cust,
    (ARRAY['Aurora Wool Coat','Maple Lounge Chair','Halcyon Headphones','Nimbus Running Shoes',
           'Verde Cast-Iron Set','Lumen Desk Lamp','Cobalt Travel Bag','Sienna Leather Wallet',
           'Drift Linen Bedding','Pulse Smartwatch'])[1 + ((i * 3) % 10)] AS prod,
    (ARRAY[389.00,799.00,249.00,159.00,219.00,129.00,459.00,99.00,329.00,279.00])[1 + ((i * 3) % 10)] AS price,
    1 + (i % 3) AS qty,
    CASE
      WHEN i % 5 = 0 THEN 'abandoned'
      WHEN i % 5 IN (1, 2) THEN 'recovered'
      ELSE 'alerted'
    END AS status,
    now() - make_interval(days => i, hours => (i * 7) % 24) AS last_active
) AS g;

-- Email alert for every alerted/recovered cart.
INSERT INTO alerts (shop, checkout_id, channel, recipient, status, is_test, sent_at, created_at)
SELECT shop, id, 'email', 'alerts@example.com', 'sent', false, alerted_at, alerted_at
FROM checkouts
WHERE shop = 'cart-radar-dev-store.myshopify.com'
  AND checkout_token LIKE 'shot-%'
  AND status IN ('alerted', 'recovered');

-- Slack alert too on recovered carts (shows both channels in play).
INSERT INTO alerts (shop, checkout_id, channel, recipient, status, is_test, sent_at, created_at)
SELECT shop, id, 'slack', 'slack', 'sent', false, alerted_at, alerted_at
FROM checkouts
WHERE shop = 'cart-radar-dev-store.myshopify.com'
  AND checkout_token LIKE 'shot-%'
  AND status = 'recovered';

-- Put the store on Pro so the dashboard/billing screenshots are clean (no free-limit banner).
UPDATE shops SET billing_active = true, pro_access_until = NULL
WHERE shop = 'cart-radar-dev-store.myshopify.com';
