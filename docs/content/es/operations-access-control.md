# Control de acceso operativo

Guía operativa para lanzar un workspace con control de acceso estable.

## Onboarding de un workspace nuevo

1. crear workspace
2. conectar GitHub App
3. ejecutar repo sync
4. verificar links repo -> project
5. ejecutar permission sync en dry-run y luego apply
6. conectar OIDC y validar login gate
7. configurar group mappings (si aplica)
8. revisar auditoría de todo el flujo

## Procedimiento con GitHub

### Install / Sync

1. abrir GitHub Integration del workspace
2. conectar installation
3. ejecutar `Sync repos`
4. verificar proyectos vinculados

### Permission Sync

1. ejecutar dry-run
2. revisar usuarios no vinculados
3. vincular `Claustrum user <-> GitHub login`
4. ejecutar apply sync

## Procedimiento con OIDC

1. configurar metadata del provider
2. validar issuer / client
3. confirmar creación por `(issuer, subject)`
4. configurar group mapping con IDs estables
5. verificar que OIDC gate proteja endpoints

## Orden recomendado para debugging

1. verificar OIDC gate
2. verificar membership en workspace
3. verificar instalación GitHub activa
4. verificar repo sync + links
5. verificar user link de GitHub
6. revisar permission preview (direct/team max)
7. revisar estado de webhook deliveries
8. revisar auditoría de recálculo y apply

## Eventos de auditoría clave

- `github.webhook.received`
- `github.webhook.signature_failed`
- `github.repos.synced`
- `github.permissions.computed`
- `github.permissions.applied`
- `github.permissions.recomputed`
- `github.user_link.created`
- `github.user_link.deleted`

## Recomendaciones

- empezar con `add_only`
- pasar a `add_and_remove` cuando confíes en auditoría
- mantener owner protection activo
- preferir recálculo parcial frente a recálculo completo

Última actualización: 2026-02-19
