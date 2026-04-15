<script>
  import AgencyIndexTable from "$lib/components/AgencyIndexTable.svelte";
</script>

# Sobre los datos

## Qué contiene

Missouri requiere que las agencias policiales reporten datos sobre cada parada de tráfico al Fiscal General del estado: quién fue detenido, por qué, qué ocurrió y si se realizó una búsqueda. Extraemos esos datos de los informes anuales en PDF publicados por la oficina del Fiscal General.

> **Nota sobre los nombres de las métricas:** Los nombres de tablas, secciones y métricas se mantienen en inglés en toda la herramienta para preservar la fidelidad con los datos fuente y evitar ambigüedades en la traducción de términos técnicos o legales.

Este conjunto de datos incluye conteos y tasas, desglosados por la raza del conductor. Las métricas rastreadas incluyen:

- **Stops**: paradas totales, paradas de residentes, paradas de no residentes
- **Outcomes**: arrestos, citaciones, búsquedas y contrabando encontrado
- **Rates**: tasa de arresto, tasa de citación, tasa de búsqueda, tasa de aciertos de contrabando, tasa de parada, tasa de parada de residentes
- **Arrest reason** (p. ej., infracción de drogas)
- **Citation/warning reason** (p. ej., infracción de tránsito)
- **Driver age** (17 y menores, 18–29, 30–39, 40–64, 65+)
- **Driver gender** (masculino, femenino)
- **Location of stop** (calle de la ciudad, carretera del condado, autopista interestatal, etc.)
- **Officer assignment** (tráfico dedicado, patrulla general, asignación especial)
- **Reason for stop** (investigativo, en movimiento, equipo, etc.)
- **Stop outcome** (arresto, citación, advertencia, sin acción, etc.)
- **Type of contraband found** (drogas, armas, etc.)
- **Type of search / probable cause** (consentimiento, incidente de arresto, etc.)
- **Search duration** (0–15 min, 16–30 min, 31+ min)
- **What was searched** (propiedad del vehículo, conductor, propiedad del conductor)
- **Population estimates** del Censo Decenal y de la Encuesta sobre la Comunidad Estadounidense (ACS)

## De dónde vino

El Fiscal General de Missouri tiene la [obligación legal](http://revisor.mo.gov/main/OneSection.aspx?section=590.650&bid=30357&hl=) de compilar y publicar el Informe de Paradas de Vehículos.

Cada informe típicamente incluye un resumen ejecutivo, totales estatales, informes por agencia y un documento separado de comentarios de las agencias (si fueron enviados). Extraemos datos estructurados de los informes por agencia y de las respuestas de las agencias, que luego se combinan.

Los informes fuente y los comentarios están disponibles en la oficina del Fiscal General:

- [Página de inicio del Informe de Paradas de Vehículos](https://ago.mo.gov/get-help/vehicle-stops-report/)
- PDFs de informes por agencia:
  - 2024: https://ago.mo.gov/wp-content/uploads/2024-VSR-Agency-Specific-Reports.pdf
  - 2023: https://ago.mo.gov/wp-content/uploads/VSRreport2023.pdf
  - 2022: https://ago.mo.gov/wp-content/uploads/vsrreport2022.pdf
  - 2021: https://ago.mo.gov/wp-content/uploads/2021-VSR-Agency-Specific-Report.pdf
  - 2020: https://ago.mo.gov/wp-content/uploads/2020-VSR-Agency-Specific-Report.pdf
- PDFs de respuestas de agencias:
  - 2024: https://ago.mo.gov/wp-content/uploads/2024-Agency-Responses-1.pdf
  - 2023: https://ago.mo.gov/wp-content/uploads/VSRagencynotes2023.pdf
  - 2022: https://ago.mo.gov/wp-content/uploads/2022-agency-comments-ago.pdf
  - 2021: https://ago.mo.gov/wp-content/uploads/2021-VSR-Agency-Comments.pdf
  - 2020: https://ago.mo.gov/wp-content/uploads/2020-VSR-Agency-Comments.pdf

Actualmente, extraemos datos de los informes de **2020–2024** (publicados entre 2021 y 2025).

Los metadatos de las agencias (nombres, direcciones, información de contacto) provienen de una copia de 2025 de la base de datos de agencias de orden público de Missouri proporcionada por Jesse Bogan de The Marshall Project. La versión más reciente de estos datos está [disponible a través de data.mo.gov](https://data.mo.gov/Public-Safety/Missouri-Law-Enforcement-Agencies/cgbu-k38b/about_data) y se integrará después de que se publique el VSR 2025 (primavera de 2026).

Dado que los nombres de las agencias varían entre la base de datos de agencias y el VSR, creamos un puente de conexión para unir su información.

La dirección de los datos de las agencias se procesa a través de Geocod.io para adjuntar identificadores geográficos a cada jurisdicción y geocodificar la dirección de la agencia. Estos identificadores se combinan con [archivos de límites cartográficos del Censo](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html) para mostrar mapas de jurisdicción y relaciones espaciales.

El proceso de procesamiento es un [proyecto de código abierto Python/Dagster](https://github.com/eads/missouri-vsr-processing) desarrollado originalmente en The Marshall Project.

## Cómo están estructurados los datos

### Modelo de filas (la tabla central)

El conjunto de datos central es una tabla basada en filas donde cada fila representa una métrica para una agencia y un año. Campos clave:

- `agency` — el nombre de la agencia tal como aparece en el informe
- `year` — año del informe
- `table`, `section`, `metric` — etiquetas legibles para humanos
- `table_id`, `section_id`, `metric_id` — identificadores en formato slug
- `row_key` — `table_id--section_id--metric_id` (estable ante cambios de numeración de tablas)
- `row_id` — `year-agency-row_key` (globalmente único)
- Columnas de raza: `Total`, `White`, `Black`, `Hispanic`, `Native American`, `Asian`, `Other`

Todos los valores son numéricos o nulos (`.` en el PDF se convierte en `null`).

### Filas de tasas y normalización

Las tasas en los informes (p. ej., "search rate") se capturan tal como se proporcionan. Sin embargo:

- Las **tasas estatales** se **recomputan** a partir de los totales para mayor consistencia; no sumamos filas de tasas.
- Los campos `YYYY ACS pop` se normalizan a `acs-pop` para que las variables de población sean comparables entre años.
- En los primeros años (2020–2021), las filas de población con formato `YYYY-pop` también se mapean a `acs-pop`.

### Comentarios de las agencias

Los comentarios de las agencias se extraen de los PDFs de respuesta separados y se adjuntan al conjunto de datos. Cada entrada de comentario tiene:

- `agency`
- `year`
- `comment` (cadena de texto, con saltos de párrafo preservados como `\n\n`)
- `has_comment`
- `source_url`

Los saltos de línea dentro de los párrafos se colapsan en un solo espacio. Los saltos de párrafo se preservan.

## Descargas y formatos de archivo

Todas las descargas públicas están en:

`https://data.vsr.recoveredfactory.net/`

### JSON combinado (todos los conjuntos de datos)

Este archivo contiene **todos** los conjuntos de datos en un objeto JSON con claves:

- `vsr_statistics`
- `agency_index`
- `agency_comments`

Descarga:

- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_downloads.json

### CSV + Parquet por conjunto de datos

Para análisis en pandas/R/SQL, cada conjunto de datos también está disponible como CSV y Parquet:

**Estadísticas VSR (con filas de rango/percentil/porcentaje)**

- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_vsr_statistics.csv
- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_vsr_statistics.parquet

**Índice de agencias (nombres + metadatos)**

- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_agency_index.csv
- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_agency_index.parquet

**Comentarios de agencias**

- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_agency_comments.csv
- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_agency_comments.parquet

### Manifiesto de descargas

El manifiesto incluye tamaños de archivo para interfaces de descarga dinámicas:

- https://data.vsr.recoveredfactory.net/downloads/missouri_vsr_2020_2024_downloads_manifest.json

### Totales estatales (subconjunto)

Un resumen estatal simplificado utilizado para los gráficos de la página principal:

- https://data.vsr.recoveredfactory.net/statewide_year_sums_subset.json

Row_keys incluidos:
- rates-by-race--totals--all-stops
- search-statistics--probable-cause--consent
- number-of-stops-by-race--stop-outcome--arrests
- number-of-stops-by-race--stop-outcome--citation
- number-of-stops-by-race--stop-outcome--warning
- number-of-stops-by-race--stop-outcome--no-action

### Descargas por agencia (conveniencia)

Estos archivos son convenientes para uso de una sola agencia, pero la forma **principal** de obtener los datos sigue siendo las descargas combinadas anteriores.

| Recurso | Patrón de URL | Notas |
|---|---|---|
| JSON de agencia por año | `https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/[agency_slug]/[year].json` | Un archivo por agencia por año — solicitar cada año por separado |
| GeoJSON del límite de agencia | `https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries/[agency_id].geojson` | FeatureCollection único con límite + vecinos |
| Índice de límites de agencia | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries_index.json | Lista qué archivos de límites existen (por slug) |

### Archivos de agencia por año (índice)

En v2, los datos de las agencias están divididos en un archivo por año. Para obtener todos los datos de una agencia, solicite cada año individualmente usando el patrón `agency_year/[slug]/[year].json`. Años disponibles: 2005–2024.
<AgencyIndexTable
  filterLabel="Filtrar"
  filterPlaceholder="slug o nombre"
  ofLabel="de"
  slugHeading="Slug de la agencia"
  yearsHeading="Años reportados"
  urlHeading="URL"
  loadingLabel="Cargando índice de agencias…"
  errorLabel="No se pudo cargar el índice de agencias."
/>
## Peculiaridades de formato y notas de implementación

### Índice de agencias (`agency_index`)

El índice de agencias es una agregación de metadatos de agencias y los nombres del VSR. Campos destacados:

- `agency_slug` — nombre canónico en formato slug (apóstrofes eliminados, puntuación colapsada)
- `names` — **arreglo de nombres conocidos** para la agencia (canónico, puente de conexión y variantes del VSR)
- `city`, `zip`, `phone`, `county` — de la base de datos de referencia de agencias
- `census_geoid` — identificador geográfico del Censo de EE. UU. (GEOID) para la jurisdicción de la agencia
- `rates-by-race--totals--all-stops` y `all_stops_total` — las paradas totales más recientes, para ponderación/búsqueda

**Peculiaridad del CSV:** `names` se serializa como una cadena de arreglo JSON en CSV (p. ej., `"[\"Agency A\", \"Agency A PD\"]"`).
En Parquet y JSON, es una lista nativa.

### Comentarios de agencias (`agency_comments`)

- `comment` preserva los saltos de párrafo como `\n\n`.
- Los saltos de línea dentro de un párrafo se colapsan en espacios.
- El texto está mínimamente limpio; los caracteres extraños presentes en los PDFs fuente se preservan.

### Totales estatales (`statewide_year_sums`)

- Las filas que terminan en `-rate` están **excluidas de la suma**; las tasas estatales se **recomputan** a partir de los totales.
- `no-mshp--*` excluye a la Patrulla de Carreteras del Estado de Missouri.
- `avg-no-mshp--*` es un promedio entre agencias (excluyendo MSHP), no una suma.

### Estadísticas VSR (`reports_with_rank_percentile`)

Se agregan filas derivadas por métrica:

- `-rank` (rango denso, 1 = más alto)
- `-percentile` (escala 0–1)
- `-percentage` para métricas que no son tasas (raza ÷ total)

## Definiciones de métricas (tasas)

Las tasas se definen según la documentación del VSR:

- **Stop rate**: (paradas / población ACS del año anterior) × 100
- **Resident stop rate**: (paradas de residentes / población ACS del año anterior) × 100
- **Search rate**: (búsquedas / paradas) × 100
- **Contraband hit rate**: (búsquedas con contrabando encontrado / total de búsquedas) × 100
- **Arrest rate**: (arrestos / paradas) × 100
- **Citation rate**: (citaciones / paradas) × 100

## Métricas rastreadas (lista de row_key)

Algunas métricas aparecen solo en ciertos años (p. ej., el índice de disparidad se descontinuó después de 2022). Los errores ortográficos de los informes originales se preservan (p. ej., "parol", "equpiment").

Por conveniencia, cada clave de fila tiene un archivo JSON por métrica en:
`https://data.vsr.recoveredfactory.net/metric_year/[row_key].json`
Son útiles para uso de una sola métrica, pero las descargas combinadas son la interfaz principal.

**Todos los row_keys actualmente presentes:**

| Category | Row key | Metric file |
|---|---|---|
| disparity-index-by-race | disparity-index-by-race--disparity-index--all-stops | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--all-stops.json |
| disparity-index-by-race | disparity-index-by-race--disparity-index--all-stops-acs | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--all-stops-acs.json |
| disparity-index-by-race | disparity-index-by-race--disparity-index--all-stops-dec | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--all-stops-dec.json |
| disparity-index-by-race | disparity-index-by-race--disparity-index--resident-stops | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--resident-stops.json |
| disparity-index-by-race | disparity-index-by-race--disparity-index--resident-stops-acs | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--resident-stops-acs.json |
| disparity-index-by-race | disparity-index-by-race--disparity-index--resident-stops-dec | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--disparity-index--resident-stops-dec.json |
| disparity-index-by-race | disparity-index-by-race--population--2019-population | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2019-population.json |
| disparity-index-by-race | disparity-index-by-race--population--2019-population-pct | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2019-population-pct.json |
| disparity-index-by-race | disparity-index-by-race--population--2020-decennial-pop | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2020-decennial-pop.json |
| disparity-index-by-race | disparity-index-by-race--population--2020-decennial-pop-pct | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2020-decennial-pop-pct.json |
| disparity-index-by-race | disparity-index-by-race--population--2020-population | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2020-population.json |
| disparity-index-by-race | disparity-index-by-race--population--2020-population-pct | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--2020-population-pct.json |
| disparity-index-by-race | disparity-index-by-race--population--acs-pop | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--acs-pop.json |
| disparity-index-by-race | disparity-index-by-race--population--acs-pop-pct | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--population--acs-pop-pct.json |
| disparity-index-by-race | disparity-index-by-race--resident-stops-acs--all-stops-dec | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--resident-stops-acs--all-stops-dec.json |
| disparity-index-by-race | disparity-index-by-race--resident-stops-acs--resident-stops-dec | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--resident-stops-acs--resident-stops-dec.json |
| disparity-index-by-race | disparity-index-by-race--stops--all-stops | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--stops--all-stops.json |
| disparity-index-by-race | disparity-index-by-race--stops--resident-stops | https://data.vsr.recoveredfactory.net/metric_year/disparity-index-by-race--stops--resident-stops.json |
| number-of-stops-by-race | number-of-stops-by-race--all-stops | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--all-stops.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--drug-violation | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--drug-violation.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--dwi-bac | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--dwi-bac.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--off-against-person | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--off-against-person.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--other | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--other.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--outstanding-warrent | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--outstanding-warrent.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--property | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--property.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--resist-arrest | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--resist-arrest.json |
| number-of-stops-by-race | number-of-stops-by-race--arrest-violation--traffic | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--arrest-violation--traffic.json |
| number-of-stops-by-race | number-of-stops-by-race--citation-warning-violation--equipment | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--citation-warning-violation--equipment.json |
| number-of-stops-by-race | number-of-stops-by-race--citation-warning-violation--license-registration | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--citation-warning-violation--license-registration.json |
| number-of-stops-by-race | number-of-stops-by-race--citation-warning-violation--moving | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--citation-warning-violation--moving.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--17-and-under | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--17-and-under.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--18-29 | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--18-29.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--30-39 | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--30-39.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--40-64 | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--40-64.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--40-and-over | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--40-and-over.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-age--65-and-over | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-age--65-and-over.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-gender--female | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-gender--female.json |
| number-of-stops-by-race | number-of-stops-by-race--driver-gender--male | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--driver-gender--male.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--city-street | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--city-street.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--county-road | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--county-road.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--interstate-hwy | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--interstate-hwy.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--other | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--other.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--state-hwy | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--state-hwy.json |
| number-of-stops-by-race | number-of-stops-by-race--location-of-stop--us-hwy | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--location-of-stop--us-hwy.json |
| number-of-stops-by-race | number-of-stops-by-race--non-resident-stops | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--non-resident-stops.json |
| number-of-stops-by-race | number-of-stops-by-race--officer-assignment--dedicated-traffic | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--officer-assignment--dedicated-traffic.json |
| number-of-stops-by-race | number-of-stops-by-race--officer-assignment--general-parol | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--officer-assignment--general-parol.json |
| number-of-stops-by-race | number-of-stops-by-race--officer-assignment--special-assignment | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--officer-assignment--special-assignment.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--called-for-service | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--called-for-service.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--det-crime-bulletin | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--det-crime-bulletin.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--equpiment | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--equpiment.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--investigative | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--investigative.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--license | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--license.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--moving | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--moving.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--officer-initiative | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--officer-initiative.json |
| number-of-stops-by-race | number-of-stops-by-race--reason-for-stop--other | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--reason-for-stop--other.json |
| number-of-stops-by-race | number-of-stops-by-race--resident-stops | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--resident-stops.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--arrests | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--arrests.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--citation | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--citation.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--contraband | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--contraband.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--no-action | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--no-action.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--searches | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--searches.json |
| number-of-stops-by-race | number-of-stops-by-race--stop-outcome--warning | https://data.vsr.recoveredfactory.net/metric_year/number-of-stops-by-race--stop-outcome--warning.json |
| rates-by-race | rates-by-race--contraband-hit-rate--arrest-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--contraband-hit-rate--arrest-rate.json |
| rates-by-race | rates-by-race--contraband-hit-rate--citation-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--contraband-hit-rate--citation-rate.json |
| rates-by-race | rates-by-race--population--2019-population | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2019-population.json |
| rates-by-race | rates-by-race--population--2019-population-pct | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2019-population-pct.json |
| rates-by-race | rates-by-race--population--2020-decennial-pop | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2020-decennial-pop.json |
| rates-by-race | rates-by-race--population--2020-decennial-pop-pct | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2020-decennial-pop-pct.json |
| rates-by-race | rates-by-race--population--2020-population | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2020-population.json |
| rates-by-race | rates-by-race--population--2020-population-pct | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--2020-population-pct.json |
| rates-by-race | rates-by-race--population--acs-pop | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--acs-pop.json |
| rates-by-race | rates-by-race--population--acs-pop-pct | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--population--acs-pop-pct.json |
| rates-by-race | rates-by-race--rates--arrest-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--arrest-rate.json |
| rates-by-race | rates-by-race--rates--citation-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--citation-rate.json |
| rates-by-race | rates-by-race--rates--contraband-hit-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--contraband-hit-rate.json |
| rates-by-race | rates-by-race--rates--search-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--search-rate.json |
| rates-by-race | rates-by-race--rates--stop-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--stop-rate.json |
| rates-by-race | rates-by-race--rates--stop-rate-residents | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--rates--stop-rate-residents.json |
| rates-by-race | rates-by-race--stop-rate-residents--arrest-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--stop-rate-residents--arrest-rate.json |
| rates-by-race | rates-by-race--stop-rate-residents--citation-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--stop-rate-residents--citation-rate.json |
| rates-by-race | rates-by-race--stop-rate-residents--contraband-hit-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--stop-rate-residents--contraband-hit-rate.json |
| rates-by-race | rates-by-race--stop-rate-residents--search-rate | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--stop-rate-residents--search-rate.json |
| rates-by-race | rates-by-race--totals--all-stops | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--all-stops.json |
| rates-by-race | rates-by-race--totals--arrests | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--arrests.json |
| rates-by-race | rates-by-race--totals--citations | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--citations.json |
| rates-by-race | rates-by-race--totals--contraband | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--contraband.json |
| rates-by-race | rates-by-race--totals--resident-stops | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--resident-stops.json |
| rates-by-race | rates-by-race--totals--searches | https://data.vsr.recoveredfactory.net/metric_year/rates-by-race--totals--searches.json |
| search-statistics | search-statistics--arrest-charge--drug-violation | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--arrest-charge--drug-violation.json |
| search-statistics | search-statistics--arrest-charge--dwi-bac | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--arrest-charge--dwi-bac.json |
| search-statistics | search-statistics--arrest-charge--off-against-person | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--arrest-charge--off-against-person.json |
| search-statistics | search-statistics--arrest-charge--other | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--arrest-charge--other.json |
| search-statistics | search-statistics--arrest-charge--outstanding-warrant | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--arrest-charge--outstanding-warrant.json |
| search-statistics | search-statistics--contraband-found--alcohol | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--contraband-found--alcohol.json |
| search-statistics | search-statistics--contraband-found--drugs | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--contraband-found--drugs.json |
| search-statistics | search-statistics--contraband-found--other | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--contraband-found--other.json |
| search-statistics | search-statistics--contraband-found--weapons | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--contraband-found--weapons.json |
| search-statistics | search-statistics--search-duration--0-15-min | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-duration--0-15-min.json |
| search-statistics | search-statistics--search-duration--16-30-min | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-duration--16-30-min.json |
| search-statistics | search-statistics--search-duration--31-min-or-more | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-duration--31-min-or-more.json |
| search-statistics | search-statistics--search-duration--unknown | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-duration--unknown.json |
| search-statistics | search-statistics--search-reason--consent | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--consent.json |
| search-statistics | search-statistics--search-reason--frisked | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--frisked.json |
| search-statistics | search-statistics--search-reason--incident-to-arrest | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--incident-to-arrest.json |
| search-statistics | search-statistics--search-reason--inventory | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--inventory.json |
| search-statistics | search-statistics--search-reason--other | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--other.json |
| search-statistics | search-statistics--search-reason--probable-cause | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--probable-cause.json |
| search-statistics | search-statistics--search-reason--probable-cause-vehicle | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--probable-cause-vehicle.json |
| search-statistics | search-statistics--search-reason--probable-cause-vehicle-person | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--probable-cause-vehicle-person.json |
| search-statistics | search-statistics--search-reason--search-warrant | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--search-warrant.json |
| search-statistics | search-statistics--search-reason--special-circumstances | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--search-reason--special-circumstances.json |
| search-statistics | search-statistics--searched--driver | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--searched--driver.json |
| search-statistics | search-statistics--searched--driver-property | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--searched--driver-property.json |
| search-statistics | search-statistics--searched--vehicle | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--searched--vehicle.json |
| search-statistics | search-statistics--searched--vehicle-property | https://data.vsr.recoveredfactory.net/metric_year/search-statistics--searched--vehicle-property.json |