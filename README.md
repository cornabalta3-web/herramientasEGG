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
Agenda de riego y abono para plantas de interior, huerta y exterior. Muestra qué regar hoy y en los próximos 7 días, ajusta las frecuencias según la estación (hemisferio sur o norte), incluye una guía de 27 especies comunes con toxicidad para mascotas (según la ASPCA), historial y galería de fotos por planta, recordatorios exportables a Google/Apple Calendar (.ics) y respaldo en JSON (con fotos). Los datos se guardan solo en el navegador.

**Diagnóstico con IA (opcional):** sacale una foto a una planta y Claude detecta problemas (riego, luz, plagas, hongos), sugiere qué hacer, propone ajustar la frecuencia de riego, reconoce la especie y programa una foto de control para seguir la evolución. Usa la API de Claude directo desde el navegador con tu propia API key (se carga en Ajustes y se paga por uso; [crear una key](https://platform.claude.com/settings/keys)), igual que ROGADOR: no hace falta servidor.

## Uso

Cada carpeta contiene un archivo `index.html` autocontenido. Para usar cualquier herramienta:

1. Descargá el archivo `index.html` de la carpeta correspondiente
2. Abrilo con cualquier navegador moderno (Chrome, Edge, Firefox)
3. No requiere instalación ni conexión a internet, salvo que se use la función de completado por IA

## Licencia

Uso interno — Escribanía General de Gobierno, Provincia de Córdoba.
