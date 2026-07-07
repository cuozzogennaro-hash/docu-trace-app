INSERT INTO public.subscriptions (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment)
VALUES ('d08339c1-dae1-45eb-85d4-0eb8589d826e', 'demo_sub_tutorial', 'demo_cus_tutorial', 'haccp_pro', 'haccp_pro_yearly', 'active', now(), now() + interval '10 years', false, 'sandbox')
ON CONFLICT (paddle_subscription_id) DO UPDATE SET status='active', current_period_end=now() + interval '10 years', cancel_at_period_end=false, updated_at=now();

INSERT INTO public.subscriptions (user_id, paddle_subscription_id, paddle_customer_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment)
VALUES ('d08339c1-dae1-45eb-85d4-0eb8589d826e', 'demo_sub_tutorial_live', 'demo_cus_tutorial_live', 'haccp_pro', 'haccp_pro_yearly', 'active', now(), now() + interval '10 years', false, 'live')
ON CONFLICT (paddle_subscription_id) DO UPDATE SET status='active', current_period_end=now() + interval '10 years', cancel_at_period_end=false, updated_at=now();