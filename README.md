# Sistema de Parking — API

API de gestión de estacionamientos. NestJS + TypeORM + PostgreSQL.

El esquema SQL es la **fuente de verdad**. TypeORM corre con
`synchronize: false` y nunca emite DDL; las entidades solo describen
lo que `db/schema.sql` define.

---

## Levantar el proyecto

```bash
npm install
docker compose up -d

docker exec -i parkingdb psql -U postgres -d ParkingDB < db/schema.sql
docker exec -i parkingdb psql -U postgres -d ParkingDB < db/seed.sql

npm run start:dev
```

Base en `http://localhost:3000/api`

Con el seed intacto, `GET /api/lots/1/availability` devuelve
`capacity: 9, occupied: 2, available: 7`.

Para volver al estado inicial:

```bash
docker exec -i parkingdb psql -U postgres -d ParkingDB < db/seed.sql
```

---

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| `GET` | `/api/lots` | Lista los estacionamientos |
| `GET` | `/api/lots/:id/availability` | Capacidad, ocupación y disponibles |
| `GET` | `/api/sessions` | Lista sesiones. Filtros: `status`, `lotId` |
| `GET` | `/api/sessions/:ticketCode` | Consulta un ticket con el monto a pagar |
| `POST` | `/api/sessions` | Registra una entrada |
| `POST` | `/api/sessions/:ticketCode/exit` | Registra la salida |

### POST /api/sessions

```jsonc
// req
{ "lotId": 1, "plate": "abc-1234" }

// 201
{ "ticketCode": "T-2026-0010", "lotName": "Edificio Norte",
  "entryTime": "2026-09-11T17:45:40.789Z" }
```

La placa se normaliza —mayúsculas, sin guiones ni espacios— antes de
validarse. `abc-1234` se guarda como `ABC1234`.

### GET /api/sessions/:ticketCode

```jsonc
{ "ticketCode": "T-2026-0001", "plate": "VKR8321",
  "lotName": "Edificio Norte", "status": "active",
  "entryTime": "...", "exitTime": null,
  "minutesElapsed": 120, "hoursCharged": 2, "amountDue": 50 }
```

En una sesión cerrada el reloj se detiene en `exitTime`.

### POST /api/sessions/:ticketCode/exit

Sin body. Devuelve `amountCharged` y `previouslyPaid`.

---

## Errores

| Escenario | Código |
|---|---|
| Segunda entrada con placa que ya está dentro | `409` |
| `ticketCode` inexistente | `404` |
| Salir de una sesión ya cerrada | `409` |
| `lotId` inexistente o inactivo | `404` |
| Placa vacía, muy larga o con símbolos | `400` |
| Campo de más en el body | `400` |

Ninguno sale como `500`.

---

## Modelo

Seis tablas. `payments` existe en la base pero el MVP no la toca y no
tiene entidad de TypeORM.

```
parking_lots      id, name, address, is_active
parking_spaces    id, lot_id, level, section, space_number, is_active
vehicles          id, plate UNIQUE, color
rates             id, lot_id, price_per_hour, min_charge, daily_max,
                  grace_minutes, valid_from, valid_to
parking_sessions  id, ticket_code UNIQUE, lot_id, vehicle_id,
                  entry_time, entry_estimated, exit_time, status
payments          id, session_id, amount, method, paid_at
```

### Decisiones

**Tres estados, no un booleano.** El pago ocurre ANTES de la salida, así
que hay tres: `active` (dentro, sin pagar), `paid` (pagó, sigue dentro),
`closed` (salió). **`paid` ocupa lugar igual que `active`** — todo conteo
de ocupación usa `status IN ('active','paid')`.

Una sesión `paid` **sí puede salir**, y se cobra `0`: ya liquidó su
estancia. El MVP no lee `payments`, así que no hay contra qué calcular
una diferencia. Cuando esa tabla entre al alcance, pasa a ser
`max(0, amountDue - pagado)`.

**`parking_sessions` no referencia `parking_spaces`.** Nadie captura en
qué cajón quedó el coche. `parking_spaces` es inventario con estado, no
ocupación: existe para poder inhabilitar cajones sueltos y que la
capacidad se corrija sola. **La disponibilidad siempre se calcula por
conteo.**

**`ticket_code` es la llave pública**, separada del `id`. Sale de una
secuencia propia (`ticket_code_seq`) con formato `T-${año}-${nnnn}`.

**`rates` con `valid_from`/`valid_to`.** La tarifa vigente es la que
tiene `valid_to IS NULL`. Las tarifas no se actualizan: se cierran y se
abre una nueva, para que los cobros viejos sigan siendo explicables.
No se valida traslape de vigencias — limitación conocida.

**El dinero es `NUMERIC(10,2)`, nunca `FLOAT`.** El driver lo entrega
como string; un transformer compartido lo convierte a `number`.

### Restricciones que no viven en las entidades

```sql
CHECK (status IN ('active','paid','closed'))
CHECK (method IN ('cash','card','app'))
CHECK (exit_time IS NULL OR exit_time >= entry_time)

CREATE UNIQUE INDEX uq_sessions_vehicle_inside
  ON parking_sessions (vehicle_id)
  WHERE status IN ('active','paid');
```

Ese índice parcial es la pieza clave: hace que el `409` de doble entrada
lo garantice **Postgres**, no un `SELECT` previo en el service, que
tendría condición de carrera. El `23505` se traduce a `ConflictException`.

Las sesiones `closed` quedan fuera del índice, así que un vehículo puede
tener historial ilimitado pero a lo sumo una sesión vigente.

`updated_at` la mantiene un trigger (`set_updated_at()`), no
`@UpdateDateColumn`: así también se actualiza en escrituras que no pasan
por el ORM.

---

## Cálculo del monto

`src/common/calculate-amount.ts`. Función pura, sin dependencias de base
de datos.

```
1. si minutos <= grace_minutes            -> 0
2. horas  = techo(minutos / 60)
3. monto  = horas * price_per_hour
4. monto  = maximo(monto, min_charge)
5. si daily_max no es null:
       dias  = techo(minutos / 1440)
       monto = minimo(monto, dias * daily_max)
6. redondear a 2 decimales
```

Con la tarifa de Norte (25/h, mínimo 25, tope 180, gracia 15):

| minutos | monto | qué prueba |
|---|---|---|
| 10 | 0.00 | tolerancia |
| 16 | 25.00 | mínimo |
| 60 | 25.00 | frontera exacta |
| 61 | 50.00 | techo de fracción |
| 600 | 180.00 | tope diario |
| 1800 | 360.00 | dos días de tope |

---

## Postman

```bash
npx newman run postman/parking-management.postman_collection.json
```

21 peticiones, 48 aserciones. Importable desde Postman con **Import**.
Asume el seed intacto y está ordenada para el Runner.

---

## Datos sembrados

- 3 lots: Norte (activo), Sur (activo), Poniente (inactivo)
- Norte: 10 cajones, 1 inactivo → capacidad 9
- Sur: 8 cajones, 1 inactivo → capacidad 7
- 8 vehículos; Norte tiene además una tarifa ya cerrada, para detectar
  si el service olvida filtrar por `valid_to IS NULL`
- 9 sesiones cubriendo los tres estados

| ticket | lot | placa | estado |
|---|---|---|---|
| `T-2026-0001` | Norte | VKR8321 | `active` |
| `T-2026-0002` | Norte | XPL4409 | `paid` |
| `T-2026-0003` | Norte | TDN1157 | `closed` |
| `T-2026-0005` | Sur | QBF7741 | `active` |
| `T-2026-0006` | Sur | HJK2298 | `active` (10 min, dentro de la gracia) |
| `T-2026-0007` | Sur | ZNC5514 | `paid` |

---

## Fuera de alcance

Pagos · asignación de cajón · boleto perdido · histórico de tarifas ·
alta de lots/cajones/tarifas por API · disponibilidad por nivel ·
paginación de sesiones · autenticación · frontend.

El esquema soporta todo esto; la API no lo expone todavía.
