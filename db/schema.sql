-- ============================================================
--  Sistema de Parking — esquema
--
--  Este archivo es la FUENTE DE VERDAD del esquema.
--  TypeORM corre con synchronize: false y nunca emite DDL.
--  Las entidades solo describen lo que aquí se define.
--
--  Ejecutar:  psql -U postgres -d ParkingDB -f db/schema.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
--  updated_at automático
--
--  Se mantiene en Postgres, no en Node. La diferencia importa:
--  un UPDATE hecho a mano por psql también actualiza la columna.
--  @UpdateDateColumn de TypeORM solo cubre lo que pasa por el ORM.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
--  parking_lots
-- ------------------------------------------------------------
CREATE TABLE parking_lots (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  address     TEXT,
  is_active   BOOLEAN       NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_parking_lots_updated_at
  BEFORE UPDATE ON parking_lots
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
--  parking_spaces
--
--  Inventario de cajones con estado, NO ocupación.
--  Existe para poder inhabilitar cajones sueltos (is_active)
--  y que la capacidad se corrija sola.
-- ------------------------------------------------------------
CREATE TABLE parking_spaces (
  id            SERIAL       PRIMARY KEY,
  lot_id        INTEGER      NOT NULL REFERENCES parking_lots (id) ON DELETE RESTRICT,
  level         VARCHAR(10)  NOT NULL,
  section       VARCHAR(10)  NOT NULL,
  space_number  VARCHAR(10)  NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Restricción COMPUESTA: solo rechaza el mismo cajón físico
  -- dado de alta dos veces. (1,'1','B','1') y (1,'1','B','2')
  -- conviven sin problema.
  CONSTRAINT uq_parking_spaces_location
    UNIQUE (lot_id, level, section, space_number)
);

CREATE TRIGGER trg_parking_spaces_updated_at
  BEFORE UPDATE ON parking_spaces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
--  vehicles
--
--  plate se guarda YA NORMALIZADA (mayúsculas, sin guiones ni
--  espacios). La normalización ocurre en el service, antes del
--  INSERT. El UNIQUE es sobre el valor normalizado.
-- ------------------------------------------------------------
CREATE TABLE vehicles (
  id          SERIAL       PRIMARY KEY,
  plate       VARCHAR(15)  NOT NULL UNIQUE,
  color       VARCHAR(30),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON vehicles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
--  rates
--
--  La tarifa vigente de un lot es la que tiene valid_to IS NULL.
--  Cerrar una tarifa = ponerle valid_to; abrir la nueva = insertar
--  otra fila con valid_to NULL.
--
--  PENDIENTE (decisión aplazada): no hay CHECK que impida
--  valid_to <= valid_from, ni validación de traslape de vigencias.
-- ------------------------------------------------------------
CREATE TABLE rates (
  id              SERIAL         PRIMARY KEY,
  lot_id          INTEGER        NOT NULL REFERENCES parking_lots (id) ON DELETE RESTRICT,
  price_per_hour  NUMERIC(10,2)  NOT NULL,
  min_charge      NUMERIC(10,2)  NOT NULL,
  daily_max       NUMERIC(10,2),
  grace_minutes   INTEGER        NOT NULL DEFAULT 0,
  valid_from      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  valid_to        TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_rates_updated_at
  BEFORE UPDATE ON rates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
--  ticket_code_seq
--
--  Secuencia suelta, independiente de cualquier SERIAL. Alimenta
--  el ticket_code que teclea el usuario:  T-${año}-${nextval:0000}
--  Se separa del id para poder cambiar el formato del código sin
--  tocar la llave primaria.
-- ------------------------------------------------------------
CREATE SEQUENCE ticket_code_seq;


-- ------------------------------------------------------------
--  parking_sessions
--
--  NO referencia parking_spaces: nadie captura en qué cajón quedó
--  el coche. La disponibilidad SIEMPRE se calcula por conteo.
--
--  Tres estados, no un booleano, porque el pago ocurre ANTES de
--  la salida:
--    active  -> adentro, sin pagar
--    paid    -> pagó, sigue adentro   <- OCUPA LUGAR IGUAL
--    closed  -> salió
-- ------------------------------------------------------------
CREATE TABLE parking_sessions (
  id               SERIAL       PRIMARY KEY,
  ticket_code      VARCHAR(20)  NOT NULL UNIQUE,
  lot_id           INTEGER      NOT NULL REFERENCES parking_lots (id) ON DELETE RESTRICT,
  vehicle_id       INTEGER      NOT NULL REFERENCES vehicles (id)     ON DELETE RESTRICT,
  entry_time       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  entry_estimated  BOOLEAN      NOT NULL DEFAULT false,
  exit_time        TIMESTAMPTZ,
  status           VARCHAR(10)  NOT NULL DEFAULT 'active',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT chk_sessions_status
    CHECK (status IN ('active', 'paid', 'closed')),

  CONSTRAINT chk_sessions_exit_after_entry
    CHECK (exit_time IS NULL OR exit_time >= entry_time)
);

-- Un vehículo no puede estar dentro dos veces.
--
-- Índice ÚNICO PARCIAL: la unicidad de vehicle_id solo aplica a
-- las filas que cumplen el WHERE. Las sesiones 'closed' quedan
-- fuera del índice, así que un vehículo puede tener historial
-- ilimitado pero a lo sumo UNA sesión vigente.
--
-- Esto hace que el 409 de "segunda entrada" lo garantice Postgres,
-- no un SELECT previo en el service (que tendría carrera).
CREATE UNIQUE INDEX uq_sessions_vehicle_inside
  ON parking_sessions (vehicle_id)
  WHERE status IN ('active', 'paid');

CREATE TRIGGER trg_parking_sessions_updated_at
  BEFORE UPDATE ON parking_sessions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ------------------------------------------------------------
--  payments
--
--  Fuera del MVP: la tabla existe, la API no la toca y no hay
--  entidad de TypeORM para ella.
--
--  amount está CONGELADO: es un hecho histórico, no se recalcula
--  aunque cambie la tarifa. Por eso no lleva updated_at ni trigger.
--  paid_at cubre el rol de created_at.
-- ------------------------------------------------------------
CREATE TABLE payments (
  id          SERIAL         PRIMARY KEY,
  session_id  INTEGER        NOT NULL REFERENCES parking_sessions (id) ON DELETE RESTRICT,
  amount      NUMERIC(10,2)  NOT NULL,
  method      VARCHAR(10)    NOT NULL,
  paid_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),

  CONSTRAINT chk_payments_method
    CHECK (method IN ('cash', 'card', 'app'))
);

COMMIT;
