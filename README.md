# Actividades

App web para organizar tareas personales y de trabajo. Se guarda en el navegador (no necesita servidor ni base de datos).

## En vivo

https://jesusali.github.io/todo/

## Cómo usarla

1. Escribe una actividad, selecciona **Personal** o **Trabajo** y asigna su fecha límite.
2. Muévela a **En progreso** cuando la empieces.
3. Márcala como **Hecho** al terminarla.
4. Usa la búsqueda y los filtros para encontrar tareas por tipo o vencimiento.

Cada actividad muestra automáticamente su fecha de creación. Las tareas vencidas se resaltan en rojo y las próximas se ordenan por fecha límite.

## Desarrollo local

Abre `index.html` en el navegador, o sirve la carpeta:

```bash
python -m http.server 8080
```
