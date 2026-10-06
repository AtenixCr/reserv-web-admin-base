# admin-web

Panel de gestión para el personal de un negocio turístico. Reúne las herramientas para organizar reservas, registrar visitas y cobros y dar seguimiento a la operación diaria.

## Qué ofrece

- Consulta, creación, edición y cancelación de reservas.
- Registro de visitas con reserva y de visitantes sin reserva previa.
- Registro de cobros en efectivo, SINPE y tarjeta.
- Gestión de gastos, devoluciones y ajustes.
- Resumen de caja, conciliación y cierre de jornada.
- Reportes en PDF y Excel.
- Calendario de reservas y tareas compartidas.
- Consulta de actividad para el seguimiento administrativo.
- Configuración de información del negocio, horarios, cupos y tarifas.

## Organización del equipo

Las funciones disponibles dependen del rol de cada usuario. El personal cuenta con herramientas para atender visitantes y organizar tareas; los administradores disponen además de configuración, finanzas y consulta de actividad.

## Experiencia de uso

La interfaz ofrece español, inglés y portugués y se adapta a computadoras, tabletas y teléfonos. Los formularios permiten revisar la información y confirmar las operaciones que lo requieren.

## Parte del sistema

Este proyecto es el espacio de trabajo del personal dentro del sistema de gestión turística. Se complementa con customer-web, destinado a los visitantes, y business-api, que centraliza la información del negocio.

## Compilación para publicación

Ejecuta npm ci y npm run build con las versiones de Node y npm indicadas en package.json. Publica el contenido de dist/admin-web/browser/ en la raíz del sitio. La compilación de producción usa https://reserva.api.atenix.net/api/v1, definida en src/environments/environment.production.ts. npm start conserva la conexión local mediante /api/v1 y proxy.conf.json. Los archivos .env no configuran automáticamente Angular.

La API necesita su dominio HTTPS activo y permitir el origen de este sitio mediante CORS. Guía completa: https://github.com/AtenixCr/reserv-web-base-backend/blob/main/docs/render-deployment.md

## GitHub Pages

El flujo .github/workflows/deploy-pages.yml compila y publica automáticamente cada cambio en main. En Settings > Pages selecciona GitHub Actions como fuente y conserva el dominio personalizado. También puedes ejecutarlo desde Actions > Deploy Angular to GitHub Pages > Run workflow. Activa Enforce HTTPS cuando el certificado esté disponible.
