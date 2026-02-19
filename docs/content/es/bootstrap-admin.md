# Configuración de administrador de Bootstrap

Claustrum admite un flujo de administración de arranque de primera ejecución para una instalación inicial limpia.

## Cuenta inicial

- El correo electrónico se corrigió en el primer arranque: `admin@example.com`
- Bootstrap se ejecuta sólo cuando la tabla `users` está vacía.
- El servidor imprime la contraseña inicial una vez en el flujo de registro del servidor.

Salida de ejemplo:

```text
Bootstrap admin created: admin@example.com
Initial password (shown once): <random-password>
```
## Primer requisito de inicio de sesión

Después de iniciar sesión con las credenciales de arranque, se debe completar la configuración antes de usar la plataforma:

1. Cambiar correo electrónico (obligatorio, no puede permanecer en `admin@example.com`)
2. Cambiar contraseña (obligatorio)
3. Establecer nombre para mostrar (opcional)

Hasta que se complete la configuración:
- `/v1/auth/me`, `/v1/auth/complete-setup`, `/v1/auth/logout` están permitidos.
- Otras API `/v1/*` están bloqueadas con `403`.

## Reinstalar/restablecer comportamiento

- Si se restablece la base de datos y `users` está vacía nuevamente, bootstrap se ejecutará nuevamente e imprimirá una nueva contraseña de un solo uso.
- Si ya existe algún usuario, el arranque no se ejecuta y no se imprime ninguna contraseña.

## Recomendaciones de seguridad

- Trate la salida de la contraseña de arranque como material secreto confidencial.
- Cambie inmediatamente a una contraseña personal real.
- Prefiera receptores de registros seguros y evite exponer públicamente los registros de inicio.