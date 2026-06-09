-- =============================================
-- TÍPICS — Schema Supabase
-- Pega este SQL en: Supabase > SQL Editor > New query
-- =============================================

-- Proveedores
create table proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  iban text,
  condiciones_pago text,
  notas text,
  created_at timestamptz default now()
);

-- Productos
create table productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  proveedor_id uuid references proveedores(id) on delete set null,
  pvp numeric(10,2) not null,
  coste_proveedor numeric(10,2) not null,
  unidad text default 'ud',
  descripcion text,
  activo boolean default true,
  created_at timestamptz default now()
);

-- Tiendas
create table tiendas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  zona text,
  contacto_nombre text,
  contacto_email text,
  contacto_telefono text,
  alquiler_fijo_mensual numeric(10,2) default 0,
  comision_variable_pct numeric(5,2) default 10,
  activa boolean default true,
  created_at timestamptz default now()
);

-- Stock por tienda (estado actual)
create table stock_tienda (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  unidades_actuales numeric(10,2) default 0,
  fecha_ultimo_recuento date,
  unique(tienda_id, producto_id)
);

-- Recuentos mensuales (historial)
create table recuentos (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id) on delete cascade,
  producto_id uuid references productos(id) on delete cascade,
  stock_anterior numeric(10,2) not null,
  stock_nuevo numeric(10,2) not null,
  unidades_vendidas numeric(10,2) generated always as (stock_anterior - stock_nuevo) stored,
  fecha date not null default current_date,
  notas text,
  created_at timestamptz default now()
);

-- Liquidaciones mensuales
create table liquidaciones (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid references tiendas(id) on delete cascade,
  periodo_mes integer not null,
  periodo_anyo integer not null,
  importe_cobrar_tienda numeric(10,2) default 0,
  alquiler_fijo numeric(10,2) default 0,
  comision_variable numeric(10,2) default 0,
  importe_pagar_proveedor numeric(10,2) default 0,
  margen_tipics numeric(10,2) default 0,
  estado text default 'pendiente' check (estado in ('pendiente', 'cobrado', 'pagado', 'cerrado')),
  notas text,
  created_at timestamptz default now(),
  unique(tienda_id, periodo_mes, periodo_anyo)
);

-- =============================================
-- Row Level Security (RLS) — básico
-- Permite acceso total a usuarios autenticados
-- =============================================
alter table proveedores enable row level security;
alter table productos enable row level security;
alter table tiendas enable row level security;
alter table stock_tienda enable row level security;
alter table recuentos enable row level security;
alter table liquidaciones enable row level security;

create policy "Acceso autenticado" on proveedores for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on productos for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on tiendas for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on stock_tienda for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on recuentos for all using (auth.role() = 'authenticated');
create policy "Acceso autenticado" on liquidaciones for all using (auth.role() = 'authenticated');

-- =============================================
-- Datos de ejemplo para empezar
-- =============================================
insert into proveedores (nombre, contacto_nombre, contacto_email, condiciones_pago) values
  ('Típics (propio)', 'Aleix Camps', 'aleix@tipics.cat', 'Producto propio');

insert into productos (nombre, proveedor_id, pvp, coste_proveedor, unidad) values
  ('Galetes Senyors i Senyores', (select id from proveedores where nombre = 'Típics (propio)'), 6.50, 2.80, 'ud'),
  ('Produc te 2 (edita-me)', (select id from proveedores where nombre = 'Típics (propio)'), 5.00, 2.00, 'ud');
