-- ===== Timetable & accessibility on existing tables =====
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS first_departure time NOT NULL DEFAULT '05:30',
  ADD COLUMN IF NOT EXISTS last_departure time NOT NULL DEFAULT '22:30',
  ADD COLUMN IF NOT EXISTS frequency_min integer NOT NULL DEFAULT 15 CHECK (frequency_min BETWEEN 3 AND 180);

ALTER TABLE public.buses
  ADD COLUMN IF NOT EXISTS is_accessible boolean NOT NULL DEFAULT false;

-- backfill: modern buses in the sample fleet are low-floor / wheelchair accessible
UPDATE public.buses SET is_accessible = true WHERE bus_type IN ('AC', 'Electric', 'Deluxe');
UPDATE public.routes SET frequency_min = 10 WHERE route_number IN ('21G', '47A');
UPDATE public.routes SET frequency_min = 20 WHERE route_number IN ('70', '5E');

-- ===== Profiles =====
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  preferred_language text NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'ta')),
  needs_accessible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Admins can see everyone's roles (for user management)
CREATE POLICY "Admins read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- New accounts: first = admin, later = passenger. Also create a profile.
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(424242);
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'passenger');
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

INSERT INTO public.profiles (id, email) SELECT id, COALESCE(email, '') FROM auth.users ON CONFLICT (id) DO NOTHING;

-- ===== Favourite routes =====
CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  to_stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, from_stop_id, to_stop_id),
  CHECK (from_stop_id <> to_stop_id)
);
GRANT SELECT, INSERT, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own favorites select" ON public.favorites FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own favorites insert" ON public.favorites FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own favorites delete" ON public.favorites FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== Recent searches =====
CREATE TABLE public.recent_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  from_stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  to_stop_id uuid NOT NULL REFERENCES public.stops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX recent_searches_user_idx ON public.recent_searches (user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.recent_searches TO authenticated;
GRANT ALL ON public.recent_searches TO service_role;
ALTER TABLE public.recent_searches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own searches select" ON public.recent_searches FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own searches insert" ON public.recent_searches FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own searches delete" ON public.recent_searches FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ===== Bookings (written only by secure server functions) =====
CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text NOT NULL UNIQUE,
  user_id uuid NOT NULL,
  from_stop_id uuid REFERENCES public.stops(id) ON DELETE SET NULL,
  to_stop_id uuid REFERENCES public.stops(id) ON DELETE SET NULL,
  from_name text NOT NULL,
  to_name text NOT NULL,
  travel_at timestamptz NOT NULL,
  option_type text NOT NULL,
  legs jsonb NOT NULL DEFAULT '[]'::jsonb,
  passengers integer NOT NULL DEFAULT 1 CHECK (passengers BETWEEN 1 AND 6),
  fare_total numeric NOT NULL CHECK (fare_total >= 0),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'confirmed', 'cancelled', 'used')),
  created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  used_at timestamptz
);
CREATE INDEX bookings_user_idx ON public.bookings (user_id, travel_at DESC);
-- duplicate prevention: one active booking per passenger per journey and departure time
CREATE UNIQUE INDEX bookings_no_duplicates ON public.bookings (user_id, from_stop_id, to_stop_id, travel_at)
  WHERE status IN ('pending_payment', 'confirmed');
GRANT SELECT ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own bookings select" ON public.bookings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Staff read all bookings" ON public.bookings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'operator') OR public.has_role(auth.uid(), 'driver'));

-- ===== Payments (demo mode; written only by server functions) =====
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  mode text NOT NULL DEFAULT 'demo' CHECK (mode IN ('demo', 'provider')),
  status text NOT NULL CHECK (status IN ('initiated', 'succeeded', 'failed', 'refunded')),
  transaction_ref text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_booking_idx ON public.payments (booking_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payments select" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all payments" ON public.payments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));