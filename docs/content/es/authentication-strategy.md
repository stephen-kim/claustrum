# Estrategia de autenticación

Claustrum usa una estrategia por fases para equilibrar seguridad y simplicidad operativa.

## Fase 1 (actual): API Key

- Método: `Authorization: Bearer <api_key>`
- La key se muestra una sola vez al crearla
- Se puede revocar
- El reset de admin usa enlace de un solo uso

Almacenamiento en servidor:
- Nunca guardar la key en texto plano
- Guardar solo `key_hash`
- `key_prefix` para mostrar sin exponer
- `device_label` obligatorio
- `expires_at` opcional

Alcance:
- API key con alcance por workspace (`workspace_id`)
- Sin acceso cruzado entre workspaces

Almacenamiento local (MCP adapter):
- `~/.claustrum/state.json`
- Se fuerza `chmod 600` al escribir
- Si el archivo tiene permisos débiles, se avisa y se endurece

Comportamiento de seguridad:
- No loggear keys ni tokens
- En debug/error, secretos enmascarados
- Si el gateway devuelve 401/403, mostrar guía de re-login

Eventos de auditoría:
- `api_key.created`
- `api_key.revoked`
- `api_key.reset`
- `api_key.one_time_view`

## Ventajas de Fase 1

- Onboarding rápido
- Operación simple en entornos locales y remotos
- No exige IdP externo para uso de CLI

## Limitaciones de Fase 1

- Key en texto plano en `state.json` (decisión explícita en esta fase)
- Si no defines `expires_at`, la key puede durar mucho tiempo

## Fase 2 (plan): Device Flow + Keychain

- OAuth Device Flow para login interactivo
- Access token de corta vida + refresh token rotativo
- Refresh token guardado en keychain del SO
- Revocación por dispositivo y mejor control de sesiónes

Compatibilidad:
- Usuarios actuales con API key siguen funcionando
- Device Flow pasa a ser el camino recomendado para nuevos logins

## Ruta de migración

1. Mantener estables endpoints y auditoría de API key
2. Añadir endpoints de Device Flow
3. Introducir abstracción de proveedor de credenciales en el adapter
4. Migrar de API key en `state.json` a refresh token en keychain
5. Mantener fallback con API key durante ventana de compatibilidad
