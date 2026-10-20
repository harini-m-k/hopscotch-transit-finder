-- ===== Roles =====
create type public.app_role as enum ('admin', 'user');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "Users can read own roles" on public.user_roles
  for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- First registered account becomes admin automatically
create or replace function public.handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(424242);
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'user');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created_role
  after insert on auth.users
  for each row execute function public.handle_new_user_role();

-- ===== Stops =====
create table public.stops (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  area text not null default '',
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);
grant select on public.stops to anon;
grant select, insert, update, delete on public.stops to authenticated;
grant all on public.stops to service_role;
alter table public.stops enable row level security;
create policy "Anyone can view stops" on public.stops for select to anon, authenticated using (true);
create policy "Admins insert stops" on public.stops for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update stops" on public.stops for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete stops" on public.stops for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ===== Routes =====
create table public.routes (
  id uuid primary key default gen_random_uuid(),
  route_number text not null unique,
  name text not null,
  color text not null default '#2563eb',
  avg_speed_kmph numeric not null default 20 check (avg_speed_kmph > 0),
  base_fare numeric not null default 10 check (base_fare >= 0),
  fare_per_km numeric not null default 1.5 check (fare_per_km >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.routes to anon;
grant select, insert, update, delete on public.routes to authenticated;
grant all on public.routes to service_role;
alter table public.routes enable row level security;
create policy "Anyone can view routes" on public.routes for select to anon, authenticated using (true);
create policy "Admins insert routes" on public.routes for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update routes" on public.routes for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete routes" on public.routes for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ===== Route stops (ordered) =====
create table public.route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routes(id) on delete cascade,
  stop_id uuid not null references public.stops(id) on delete cascade,
  stop_order integer not null check (stop_order > 0),
  unique (route_id, stop_order),
  unique (route_id, stop_id)
);
grant select on public.route_stops to anon;
grant select, insert, update, delete on public.route_stops to authenticated;
grant all on public.route_stops to service_role;
alter table public.route_stops enable row level security;
create policy "Anyone can view route stops" on public.route_stops for select to anon, authenticated using (true);
create policy "Admins insert route stops" on public.route_stops for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update route stops" on public.route_stops for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete route stops" on public.route_stops for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- Replace a route's ordered stop list in one transaction (runs with caller's permissions, so RLS applies)
create or replace function public.set_route_stops(_route_id uuid, _stop_ids uuid[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins can change route stops';
  end if;
  if coalesce(array_length(_stop_ids, 1), 0) < 2 then
    raise exception 'A route needs at least 2 stops';
  end if;
  delete from public.route_stops where route_id = _route_id;
  insert into public.route_stops (route_id, stop_id, stop_order)
  select _route_id, s.stop_id, s.ord::int
  from unnest(_stop_ids) with ordinality as s(stop_id, ord);
end;
$$;
grant execute on function public.set_route_stops(uuid, uuid[]) to authenticated;

-- ===== Buses =====
create table public.buses (
  id uuid primary key default gen_random_uuid(),
  bus_number text not null unique,
  route_id uuid references public.routes(id) on delete set null,
  bus_type text not null default 'Ordinary' check (bus_type in ('Ordinary','Deluxe','AC','Electric')),
  capacity integer not null default 50 check (capacity > 0 and capacity <= 200),
  status text not null default 'active' check (status in ('active','maintenance','inactive')),
  driver_name text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.buses to anon;
grant select, insert, update, delete on public.buses to authenticated;
grant all on public.buses to service_role;
alter table public.buses enable row level security;
create policy "Anyone can view buses" on public.buses for select to anon, authenticated using (true);
create policy "Admins insert buses" on public.buses for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins update buses" on public.buses for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete buses" on public.buses for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

-- ===== Sample data (Chennai) =====
insert into public.stops (name, area, latitude, longitude) values
  ('Chennai Central', 'Park Town', 13.0827, 80.2757),
  ('Egmore', 'Egmore', 13.0732, 80.2609),
  ('Marina Beach', 'Triplicane', 13.0500, 80.2824),
  ('Mylapore', 'Mylapore', 13.0339, 80.2619),
  ('T. Nagar', 'Thyagaraya Nagar', 13.0418, 80.2341),
  ('Vadapalani', 'Vadapalani', 13.0500, 80.2121),
  ('Koyambedu', 'Koyambedu', 13.0694, 80.1948),
  ('Anna Nagar', 'Anna Nagar', 13.0850, 80.2101),
  ('Saidapet', 'Saidapet', 13.0213, 80.2231),
  ('Guindy', 'Guindy', 13.0067, 80.2206),
  ('Adyar', 'Adyar', 13.0012, 80.2565),
  ('Thiruvanmiyur', 'Thiruvanmiyur', 12.9830, 80.2594),
  ('Velachery', 'Velachery', 12.9815, 80.2180),
  ('Porur', 'Porur', 13.0382, 80.1565),
  ('Airport', 'Meenambakkam', 12.9941, 80.1709),
  ('Tambaram', 'Tambaram', 12.9249, 80.1000);

insert into public.routes (route_number, name, color, avg_speed_kmph, base_fare, fare_per_km) values
  ('21G', 'Chennai Central – Tambaram', '#1d4ed8', 22, 10, 1.2),
  ('47A', 'Anna Nagar – Adyar', '#0891b2', 18, 8, 1.5),
  ('29C', 'Marina Beach – Velachery', '#7c3aed', 20, 8, 1.4),
  ('70', 'Koyambedu – Tambaram', '#ea580c', 25, 10, 1.1),
  ('M15', 'Chennai Central – Thiruvanmiyur', '#16a34a', 20, 12, 1.6),
  ('5E', 'Egmore – Velachery', '#db2777', 19, 8, 1.3);

insert into public.route_stops (route_id, stop_id, stop_order)
select r.id, s.id, v.ord
from (values
  ('21G','Chennai Central',1),('21G','Egmore',2),('21G','T. Nagar',3),('21G','Saidapet',4),('21G','Guindy',5),('21G','Airport',6),('21G','Tambaram',7),
  ('47A','Anna Nagar',1),('47A','Koyambedu',2),('47A','Vadapalani',3),('47A','T. Nagar',4),('47A','Mylapore',5),('47A','Adyar',6),
  ('29C','Marina Beach',1),('29C','Mylapore',2),('29C','Adyar',3),('29C','Thiruvanmiyur',4),('29C','Velachery',5),
  ('70','Koyambedu',1),('70','Porur',2),('70','Airport',3),('70','Tambaram',4),
  ('M15','Chennai Central',1),('M15','Marina Beach',2),('M15','Mylapore',3),('M15','Adyar',4),('M15','Thiruvanmiyur',5),
  ('5E','Egmore',1),('5E','Vadapalani',2),('5E','Guindy',3),('5E','Velachery',4)
) as v(rn, sn, ord)
join public.routes r on r.route_number = v.rn
join public.stops s on s.name = v.sn;

insert into public.buses (bus_number, route_id, bus_type, capacity, status, driver_name)
select v.bn, r.id, v.bt, v.cap, v.st, v.dr
from (values
  ('TN-01-AN-2101','21G','Ordinary',55,'active','Murugan K'),
  ('TN-01-AN-2102','21G','Deluxe',50,'active','Selvi R'),
  ('TN-01-AN-2103','21G','AC',45,'maintenance','Arjun P'),
  ('TN-01-AN-4701','47A','Ordinary',55,'active','Lakshmi S'),
  ('TN-01-AN-4702','47A','Electric',40,'active','Karthik V'),
  ('TN-01-AN-2901','29C','Deluxe',50,'active','Priya M'),
  ('TN-01-AN-2902','29C','Ordinary',55,'inactive','Ravi T'),
  ('TN-01-AN-7001','70','AC',45,'active','Divya N'),
  ('TN-01-AN-7002','70','Ordinary',55,'active','Suresh B'),
  ('TN-01-AN-1501','M15','Electric',40,'active','Anitha G'),
  ('TN-01-AN-0501','5E','Ordinary',55,'active','Vignesh L'),
  ('TN-01-AN-0502','5E','Deluxe',50,'active','Meena J')
) as v(bn, rn, bt, cap, st, dr)
join public.routes r on r.route_number = v.rn;