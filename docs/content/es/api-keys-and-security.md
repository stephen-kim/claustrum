# Claves API y seguridad

En Claustrum, la regla es simple: la clave se muestra una sola vez y en base de datos se guarda solo el hash.

## Modelo de seguridad

- nunca se guarda la API key en texto plano
- solo se guarda `api_keys.key_hash`
- ni siquiera un admin puede recuperar una key ya emitida
- cada usuario puede crear sus propias keys
- admin puede revocar y resetear keys
- el reset entrega un enlace de vista única (TTL por defecto: 15 min)

## Flujo principal

### 1) Autoemisión

- `POST /v1/api-keys`
- devuelve la key en texto plano una sola vez

### 2) Listado

- `GET /v1/api-keys` (usuario actual)
- `GET /v1/users/:userId/api-keys` (admin o propio usuario)
- solo devuelve metadatos

### 3) Revocar

- `POST /v1/api-keys/:id/revoke`
- lo puede hacer el dueño de la key o un admin

### 4) Reset administrativo + one-time link

- `POST /v1/users/:userId/api-keys/reset`
- revoca keys activas y crea una nueva
- no devuelve la key directa; devuelve URL one-time

### 5) One-time view

- `GET /v1/api-keys/one-time/:token`
- solo una vez
- si está expirado o reutilizado: `410 Gone`

## Eventos de auditoría

- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## Recomendaciones operativas

- usa `device_label` por dispositivo
- revoca keys que ya no se usan
- si sospechas filtración, resetea de inmediato

Última actualización: 2026-02-19
