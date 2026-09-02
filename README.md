# Actividades

App web para organizar tareas personales y de trabajo.

La sesión se guarda en una **cookie**. Las actividades se guardan en un **Markdown privado** (Gist secreto de GitHub), para que las veas en cualquier navegador al iniciar sesión.

## En vivo

https://jesusali.github.io/todo/

## Cómo usarla

1. Crea un [token clásico de GitHub](https://github.com/settings/tokens/new?scopes=gist&description=Actividades%20TODO) con el permiso **gist**.
2. Inicia sesión en la app. Quedará una cookie por 30 días.
3. Agrega actividades con tipo **Personal** o **Trabajo** y fecha límite.
4. Muévelas entre **Por hacer**, **En progreso** y **Hecho**.

El token debe ser **clásico** (empieza con `ghp_`). Los tokens *fine-grained* (`github_pat_`) no sirven porque GitHub no les da acceso a la API de Gists.

También puedes entrar con **Usar solo en este navegador**, sin cuenta. En ese modo las actividades se quedan en ese dispositivo.

La base de datos es el archivo `actividades.md` dentro de un Gist secreto. No se publica en el repositorio de GitHub Pages.
