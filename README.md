# Herramientas Notariales — Escribanía General de Gobierno de la Provincia de Córdoba

Colección de herramientas web (HTML/JS, sin backend) desarrolladas para automatizar tareas de producción documental notarial en el marco de la Ley Provincial 9811 (Escrituración Gratuita de Viviendas Sociales) y otros trámites de la Escribanía General de Gobierno (EGG).

Todas las herramientas corren 100% en el navegador (no requieren servidor), procesando los archivos localmente.

## Herramientas incluidas

### 📄 [ROGADOR](./rogador)
Lee escrituras (.docx) bajo Ley 9811 y genera automáticamente el PDF de Rogación del Registro General correspondiente. Extrae datos registrales (prioriza texto en rojo), sincroniza domicilio y datos del cónyuge, y ofrece completado asistido por IA para campos faltantes.

### 📝 [Primer Testimoniador](./primer-testimoniador)
Convierte una escritura de protocolo (.docx) en su primer testimonio: agrega el encabezado de folio, detecta automáticamente la escribana interviniente (Assaad / Feliciotti) y genera el nombre de archivo con conversión de número a palabras.

### ✍️ [Amanuense](./amanuense)
_(Agregar descripción)_

## Otras herramientas

### 🌱 [Brote — Cuidado de plantas](./cuidado-plantas)
App para el celular (se instala con ícono, como Déficit Tracker) con la agenda de riego y abono de tus plantas, avisos en el celular cuando alguna necesita algo, ajuste según la estación, guía de 27 especies con toxicidad para mascotas, galería de fotos por planta y una sección de **Cuidados** para resolver qué le pasa a cada planta: por foto (Claude te dice qué tiene y qué hacer) o marcando síntomas, con planes de tratamiento paso a paso y 17 fichas de problemas frecuentes. Se publica en Netlify, con la clave de Claude guardada en el servidor. Instrucciones en [cuidado-plantas/README.md](./cuidado-plantas/README.md).

## Uso

Cada carpeta contiene un archivo `index.html` autocontenido. Para usar cualquier herramienta:

1. Descargá el archivo `index.html` de la carpeta correspondiente
2. Abrilo con cualquier navegador moderno (Chrome, Edge, Firefox)
3. No requiere instalación ni conexión a internet, salvo que se use la función de completado por IA

## Licencia

Uso interno — Escribanía General de Gobierno, Provincia de Córdoba.
