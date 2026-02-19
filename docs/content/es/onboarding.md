# Incorporación

El onboarding de Claustrum está pensado para equipos: simple, trazable y seguro.

## Flujo completo

1. Admin invita miembro
2. Comparte enlace de invitación
3. Miembro abre enlace y define contraseña
4. Inicia sesión
5. Completa Welcome Setup
   - generar API key (obligatorio)
   - instalar Git auto-capture (opcional, recomendado)

## Flujo de invitación (API)

- `POST /v1/workspaces/:key/invite`
  - input: `email`, `role`, `project_roles?`
  - output: `invite_url`, `expires_at`
- `GET /v1/invite/:token`
  - valida token y devuelve metadata
- `POST /v1/invite/:token/accept`
  - crea/actualiza usuario
  - asigna roles
  - marca token como usado

## Configuración inicial de bienvenida

Si el usuario no tiene API key activa tras login, entra a Welcome Setup.

Paso 1:
- generar API key (se muestra una sola vez)

Paso 2 (opcional):
- copiar comando de Git auto-capture
- registrar instalación (auditoría)

## Eventos de auditoría

- `invite.created`
- `invite.accepted`
- `api_key.created`
- `api_key.revoked`
- `git_capture.installed`

## Seguridad

- tokens de invitación almacenados con hash
- expiración de invitación: 24h
- API keys almacenadas solo como hash
- admin no puede recuperar plaintext de key existente

Última actualización: 2026-02-19
