-- ============================================================
--  Sistema de Parking — datos de prueba
--
--  Re-ejecutable: trunca todo y reinicia las secuencias.
--
--  Ejecutar:  psql -U postgres -d ParkingDB -f db/seed.sql
--
--  Criterio de aceptación:
--    GET /lots/1/availability  ->  capacity 9, occupied 2, available 7
-- ============================================================

BEGIN;

TRUNCATE payments, parking_sessions, rates, parking_spaces, vehicles, parking_lots
  RESTART IDENTITY CASCADE;

ALTER SEQUENCE ticket_code_seq RESTART WITH 1;


-- ------------------------------------------------------------
--  parking_lots
-- ------------------------------------------------------------
INSERT INTO parking_lots (name, address, is_active) VALUES
  ('Edificio Norte',    'Av. Reforma 1200, Col. Centro',   true),
  ('Edificio Sur',      'Calz. del Valle 45, Col. Del Valle', true),
  ('Edificio Poniente', 'Blvd. Poniente 890, Col. Américas',  false);


-- ------------------------------------------------------------
--  parking_spaces
--
--  Norte (1): 10 cajones, 1 inactivo -> capacidad 9
--  Sur   (2):  8 cajones, 1 inactivo -> capacidad 7
--  Poniente (3): 4 cajones (el lot está inactivo)
-- ------------------------------------------------------------
INSERT INTO parking_spaces (lot_id, level, section, space_number, is_active) VALUES
  (1, '1', 'A', '01', true),
  (1, '1', 'A', '02', true),
  (1, '1', 'A', '03', true),
  (1, '1', 'A', '04', true),
  (1, '1', 'A', '05', true),
  (1, '1', 'B', '01', true),
  (1, '1', 'B', '02', true),
  (1, '1', 'B', '03', true),
  (1, '1', 'B', '04', true),
  (1, '1', 'B', '05', false),   -- cajón fuera de servicio

  (2, '1', 'A', '01', true),
  (2, '1', 'A', '02', true),
  (2, '1', 'A', '03', true),
  (2, '1', 'A', '04', true),
  (2, '2', 'A', '01', true),
  (2, '2', 'A', '02', true),
  (2, '2', 'A', '03', true),
  (2, '2', 'A', '04', false),   -- cajón fuera de servicio

  (3, '1', 'A', '01', true),
  (3, '1', 'A', '02', true),
  (3, '1', 'A', '03', true),
  (3, '1', 'A', '04', true);


-- ------------------------------------------------------------
--  vehicles  (placas ya normalizadas)
-- ------------------------------------------------------------
INSERT INTO vehicles (plate, color) VALUES
  ('VKR8321', 'blanco'),
  ('XPL4409', 'negro'),
  ('TDN1157', 'gris'),
  ('MRS9023', 'rojo'),
  ('QBF7741', 'azul'),
  ('HJK2298', NULL),
  ('ZNC5514', 'plata'),
  ('LWD6680', 'verde');


-- ------------------------------------------------------------
--  rates
--
--  La tarifa vigente es la que tiene valid_to IS NULL.
--  Norte lleva además una tarifa YA CERRADA: si el service
--  olvida filtrar por valid_to, va a traer dos filas y el bug
--  se nota aquí en vez de en producción.
--
--  Norte usa los valores de los casos de prueba del documento:
--  25/h, mínimo 25, tope 180, gracia 15.
-- ------------------------------------------------------------
INSERT INTO rates (lot_id, price_per_hour, min_charge, daily_max, grace_minutes, valid_from, valid_to) VALUES
  (1, 20.00, 20.00, 150.00, 15, now() - interval '180 days', now() - interval '30 days'),
  (1, 25.00, 25.00, 180.00, 15, now() - interval '30 days',  NULL),
  (2, 20.00, 20.00, 150.00, 15, now() - interval '90 days',  NULL),
  (3, 18.00, 18.00, 120.00, 10, now() - interval '90 days',  NULL);


-- ------------------------------------------------------------
--  parking_sessions
--
--  9 sesiones cubriendo los tres estados.
--
--  Norte (1) queda con exactamente 2 ocupando lugar:
--    T-2026-0001 active  +  T-2026-0002 paid
--  'paid' ocupa lugar igual que 'active'.
--
--  TDN1157 aparece en dos sesiones, ambas 'closed': el índice
--  único parcial solo aplica a active/paid, así que el
--  historial por vehículo es ilimitado.
-- ------------------------------------------------------------
INSERT INTO parking_sessions
  (ticket_code, lot_id, vehicle_id, entry_time, exit_time, status) VALUES
  -- Norte: 2 dentro, 2 cerradas
  ('T-2026-0001', 1, 1, now() - interval '2 hours',  NULL,                          'active'),
  ('T-2026-0002', 1, 2, now() - interval '5 hours',  NULL,                          'paid'),
  ('T-2026-0003', 1, 3, now() - interval '2 days',   now() - interval '2 days' + interval '3 hours', 'closed'),
  ('T-2026-0004', 1, 4, now() - interval '1 day',    now() - interval '1 day' + interval '45 minutes', 'closed'),

  -- Sur: 3 dentro, 1 cerrada
  ('T-2026-0005', 2, 5, now() - interval '30 minutes', NULL,                        'active'),
  ('T-2026-0006', 2, 6, now() - interval '10 minutes', NULL,                        'active'),
  ('T-2026-0007', 2, 7, now() - interval '8 hours',    NULL,                        'paid'),
  ('T-2026-0008', 2, 3, now() - interval '5 days',   now() - interval '5 days' + interval '26 hours', 'closed'),

  -- Poniente: 1 cerrada
  ('T-2026-0009', 3, 8, now() - interval '20 days',  now() - interval '20 days' + interval '2 hours', 'closed');

-- El siguiente nextval() devuelve 10, así que la API no choca
-- con los ticket_code sembrados.
SELECT setval('ticket_code_seq', 9, true);


-- ------------------------------------------------------------
--  payments
--
--  Fuera del MVP: la API no lee esta tabla. Van solo para que
--  las dos sesiones 'paid' no queden contradiciéndose.
-- ------------------------------------------------------------
INSERT INTO payments (session_id, amount, method) VALUES
  (2, 125.00, 'card'),
  (7, 160.00, 'app');

COMMIT;
