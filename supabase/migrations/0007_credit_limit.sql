-- Cupo de la tarjeta de crédito.
--
-- Nullable a propósito: las tarjetas que ya existen quedan sin cupo y la
-- app simplemente no muestra "disponible" hasta que el usuario lo llene.
-- Sin backfill, sin valor por defecto que mienta.
--
-- bigint y no numeric porque en esta app el dinero SIEMPRE es un entero de
-- pesos (ver src/domain/types.ts). Un cupo de 12 millones cabe de sobra.
alter table public.payment_methods
  add column if not exists credit_limit bigint;
