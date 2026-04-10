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
| JSON de agencia por año | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/{agency_slug}/{year}.json | Un archivo por agencia por año — solicitar cada año por separado |
| GeoJSON del límite de agencia | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries/{agency_id}.geojson | FeatureCollection único con límite + vecinos |
| Índice de límites de agencia | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries_index.json | Lista qué archivos de límites existen (por slug) |

### Archivos de agencia por año (índice)

En v2, los datos de las agencias están divididos en un archivo por año. Para obtener todos los datos de una agencia, solicite cada año individualmente usando el patrón `agency_year/{slug}/{year}.json`. Años disponibles: 2005–2024.
<!-- AGENCY_SLUGS_START -->
| Agency slug | URL base |
|---|---|
| adair-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/adair-county-sheriffs-dept/ |
| adrian-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/adrian-police-dept/ |
| advance-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/advance-police-dept/ |
| alma-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/alma-police-dept/ |
| alton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/alton-police-dept/ |
| anderson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/anderson-police-dept/ |
| andrew-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/andrew-county-sheriffs-dept/ |
| annapolis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/annapolis-police-dept/ |
| appleton-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/appleton-city-police-dept/ |
| arbyrd-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arbyrd-police-dept/ |
| arcadia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arcadia-police-dept/ |
| archie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/archie-police-dept/ |
| arnold-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arnold-police-dept/ |
| ash-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ash-grove-police-dept/ |
| ashland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ashland-police-dept/ |
| atchison-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/atchison-county-sheriffs-dept/ |
| audrain-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/audrain-county-sheriffs-dept/ |
| aurora-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/aurora-police-dept/ |
| auxvasse-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/auxvasse-police-dept/ |
| ava-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ava-police-dept/ |
| ballwin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ballwin-police-dept/ |
| barry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/barry-county-sheriffs-dept/ |
| barton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/barton-county-sheriffs-dept/ |
| bates-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bates-city-police-dept/ |
| bates-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bates-county-sheriffs-dept/ |
| battlefield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/battlefield-police-dept/ |
| bel-nor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bel-nor-police-dept/ |
| bel-ridge-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bel-ridge-police-dept/ |
| bella-villa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bella-villa-police-dept/ |
| belle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/belle-police-dept/ |
| bellefontaine-neighbors-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bellefontaine-neighbors-police-dept/ |
| bellflower-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bellflower-police-dept/ |
| belton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/belton-police-dept/ |
| benton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/benton-county-sheriffs-dept/ |
| benton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/benton-police-dept/ |
| berger-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/berger-police-dept/ |
| berkeley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/berkeley-police-dept/ |
| bernie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bernie-police-dept/ |
| bertrand-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bertrand-police-dept/ |
| bethany-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bethany-police-dept/ |
| beverly-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/beverly-hills-police-dept/ |
| billings-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/billings-police-dept/ |
| birch-tree-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/birch-tree-police-dept/ |
| bismarck-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bismarck-police-dept/ |
| bland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bland-police-dept/ |
| bloomfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bloomfield-police-dept/ |
| blue-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/blue-springs-police-dept/ |
| bolivar-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bolivar-police-dept/ |
| bollinger-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bollinger-county-sheriffs-dept/ |
| bonne-terre-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bonne-terre-police-dept/ |
| boone-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/boone-county-sheriffs-dept/ |
| boonville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/boonville-police-dept/ |
| bourbon-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bourbon-dept-of-public-safety/ |
| bowling-green-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bowling-green-police-dept/ |
| branson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/branson-police-dept/ |
| branson-west-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/branson-west-police-dept/ |
| braymer-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/braymer-police-dept/ |
| breckenridge-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/breckenridge-hills-police-dept/ |
| brentwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/brentwood-police-dept/ |
| bridgeton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bridgeton-police-dept/ |
| brookfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/brookfield-police-dept/ |
| brunswick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/brunswick-police-dept/ |
| buchanan-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buchanan-county-sheriffs-dept/ |
| buckner-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buckner-police-dept/ |
| buffalo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buffalo-police-dept/ |
| butler-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butler-county-sheriffs-dept/ |
| butler-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butler-police-dept/ |
| butterfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butterfield-police-dept/ |
| byrnes-mill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/byrnes-mill-police-dept/ |
| cabool-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cabool-police-dept/ |
| caldwell-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/caldwell-county-sheriffs-dept/ |
| callaway-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/callaway-county-sheriffs-dept/ |
| calverton-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/calverton-park-police-dept/ |
| camden-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/camden-county-sheriffs-dept/ |
| camden-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/camden-police-dept/ |
| camdenton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/camdenton-police-dept/ |
| cameron-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cameron-police-dept/ |
| campbell-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/campbell-police-dept/ |
| canadian-pacific-kansas-city-ltd-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/canadian-pacific-kansas-city-ltd-police-dept/ |
| canalou-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/canalou-police-dept/ |
| canton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/canton-police-dept/ |
| cape-girardeau-co-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cape-girardeau-co-sheriffs-dept/ |
| cape-girardeau-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cape-girardeau-police-dept/ |
| cardwell-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cardwell-police-dept/ |
| carl-junction-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carl-junction-police-dept/ |
| carroll-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carroll-county-sheriffs-dept/ |
| carrollton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carrollton-police-dept/ |
| carter-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carter-county-sheriffs-dept/ |
| carterville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carterville-police-dept/ |
| carthage-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/carthage-police-dept/ |
| caruthersville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/caruthersville-police-dept/ |
| cass-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cass-county-sheriffs-dept/ |
| cassville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cassville-police-dept/ |
| cedar-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cedar-county-sheriffs-dept/ |
| center-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/center-police-dept/ |
| centralia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/centralia-police-dept/ |
| chaffee-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chaffee-police-dept/ |
| chariton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chariton-county-sheriffs-dept/ |
| charleston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/charleston-police-dept/ |
| chesterfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chesterfield-police-dept/ |
| chillicothe-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chillicothe-police-dept/ |
| christian-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/christian-county-sheriffs-dept/ |
| city-of-bellerive-acres | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-bellerive-acres/ |
| city-of-bellerive-acres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-bellerive-acres-police-dept/ |
| city-of-california-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-california-police-dept/ |
| city-of-oakland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-oakland-police-dept/ |
| clarence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarence-police-dept/ |
| clark-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clark-county-sheriffs-dept/ |
| clark-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clark-police-dept/ |
| clarkton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarkton-police-dept/ |
| clay-county-parks-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clay-county-parks-dept/ |
| clay-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clay-county-sheriffs-dept/ |
| claycomo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/claycomo-police-dept/ |
| clayton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clayton-police-dept/ |
| cleveland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cleveland-police-dept/ |
| clever-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clever-police-dept/ |
| clinton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clinton-county-sheriffs-dept/ |
| clinton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clinton-police-dept/ |
| cole-camp-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cole-camp-police-dept/ |
| cole-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cole-county-sheriffs-dept/ |
| columbia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/columbia-police-dept/ |
| concordia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/concordia-police-dept/ |
| cool-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cool-valley-police-dept/ |
| cooper-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cooper-county-sheriffs-dept/ |
| corder-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/corder-police-dept/ |
| cottleville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cottleville-police-dept/ |
| country-club-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/country-club-hills-police-dept/ |
| country-club-village-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/country-club-village-police-dept/ |
| crane-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crane-police-dept/ |
| crawford-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crawford-county-sheriffs-dept/ |
| crestwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crestwood-police-dept/ |
| creve-coeur-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/creve-coeur-police-dept/ |
| crocker-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crocker-police-dept/ |
| crystal-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crystal-city-police-dept/ |
| crystal-lakes-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crystal-lakes-police-dept/ |
| cuba-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cuba-police-dept/ |
| dade-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dade-county-sheriffs-dept/ |
| dallas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dallas-county-sheriffs-dept/ |
| dardenne-prairie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dardenne-prairie-police-dept/ |
| daviess-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/daviess-county-sheriffs-dept/ |
| dekalb-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dekalb-county-sheriffs-dept/ |
| dellwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dellwood-police-dept/ |
| delta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/delta-police-dept/ |
| dent-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dent-county-sheriffs-dept/ |
| des-peres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/des-peres-police-dept/ |
| desloge-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/desloge-police-dept/ |
| desoto-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/desoto-police-dept/ |
| dexter-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dexter-police-dept/ |
| diamond-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/diamond-police-dept/ |
| dixon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dixon-police-dept/ |
| doniphan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/doniphan-police-dept/ |
| doolittle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/doolittle-police-dept/ |
| douglas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/douglas-county-sheriffs-dept/ |
| drexel-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/drexel-police-dept/ |
| duenweg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/duenweg-police-dept/ |
| dunklin-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dunklin-county-sheriffs-dept/ |
| duquesne-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/duquesne-police-dept/ |
| east-lynne-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/east-lynne-police-dept/ |
| east-prairie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/east-prairie-police-dept/ |
| easton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/easton-police-dept/ |
| edgar-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/edgar-springs-police-dept/ |
| edgerton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/edgerton-police-dept/ |
| edina-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/edina-police-dept/ |
| edmundson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/edmundson-police-dept/ |
| el-dorado-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/el-dorado-springs-police-dept/ |
| eldon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/eldon-police-dept/ |
| ellisville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ellisville-police-dept/ |
| ellsinore-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ellsinore-police-dept/ |
| elsberry-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/elsberry-police-dept/ |
| emma-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/emma-police-dept/ |
| eureka-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/eureka-police-dept/ |
| excelsior-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/excelsior-springs-police-dept/ |
| exeter-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/exeter-police-dept/ |
| fair-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fair-grove-police-dept/ |
| fair-play-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fair-play-police-dept/ |
| fairview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fairview-police-dept/ |
| farber-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/farber-police-dept/ |
| farmington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/farmington-police-dept/ |
| fayette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fayette-police-dept/ |
| ferguson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ferguson-police-dept/ |
| ferrelview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ferrelview-police-dept/ |
| festus-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/festus-police-dept/ |
| fleming-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fleming-police-dept/ |
| flordell-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/flordell-hills-police-dept/ |
| florissant-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/florissant-police-dept/ |
| foley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/foley-police-dept/ |
| fordland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fordland-police-dept/ |
| foristell-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/foristell-police-dept/ |
| forsyth-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/forsyth-police-dept/ |
| frankford-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/frankford-police-dept/ |
| franklin-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/franklin-county-sheriffs-dept/ |
| fredericktown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fredericktown-police-dept/ |
| frontenac-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/frontenac-police-dept/ |
| fulton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fulton-police-dept/ |
| galena-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/galena-police-dept/ |
| gallatin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gallatin-police-dept/ |
| garden-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/garden-city-police-dept/ |
| gasconade-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gasconade-county-sheriffs-dept/ |
| gasconade-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gasconade-police-dept/ |
| gentry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gentry-county-sheriffs-dept/ |
| gerald-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gerald-police-dept/ |
| gideon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gideon-police-dept/ |
| gladstone-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gladstone-dept-of-public-safety/ |
| glasgow-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glasgow-police-dept/ |
| glen-echo-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glen-echo-park-police-dept/ |
| glendale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glendale-police-dept/ |
| goodman-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/goodman-police-dept/ |
| gower-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gower-police-dept/ |
| grain-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grain-valley-police-dept/ |
| granby-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/granby-police-dept/ |
| grandview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grandview-police-dept/ |
| greene-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greene-county-sheriffs-dept/ |
| greenfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greenfield-police-dept/ |
| greenwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greenwood-police-dept/ |
| grundy-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grundy-county-sheriffs-dept/ |
| hallsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hallsville-police-dept/ |
| hamilton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hamilton-police-dept/ |
| hannibal-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hannibal-police-dept/ |
| hardin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hardin-police-dept/ |
| harrison-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/harrison-county-sheriffs-dept/ |
| harrisonville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/harrisonville-police-dept/ |
| hartville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hartville-police-dept/ |
| hawk-point-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hawk-point-police-dept/ |
| hayti-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hayti-police-dept/ |
| hazelwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hazelwood-police-dept/ |
| henrietta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/henrietta-police-dept/ |
| henry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/henry-county-sheriffs-dept/ |
| herculaneum-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/herculaneum-police-dept/ |
| hermann-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hermann-police-dept/ |
| hickory-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hickory-county-sheriffs-dept/ |
| higginsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/higginsville-police-dept/ |
| high-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/high-hill-police-dept/ |
| highlandville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/highlandville-police-dept/ |
| hillsboro-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hillsboro-police-dept/ |
| hillsdale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hillsdale-police-dept/ |
| holcomb-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holcomb-police-dept/ |
| holden-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holden-police-dept/ |
| hollister-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hollister-police-dept/ |
| holt-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holt-county-sheriffs-dept/ |
| holts-summit-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holts-summit-police-dept/ |
| hornersville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hornersville-police-dept/ |
| houston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/houston-police-dept/ |
| howard-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howard-county-sheriffs-dept/ |
| howardville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howardville-police-dept/ |
| howell-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howell-county-sheriffs-dept/ |
| humansville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/humansville-police-dept/ |
| huntsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/huntsville-police-dept/ |
| iberia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iberia-police-dept/ |
| independence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/independence-police-dept/ |
| indian-point-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/indian-point-police-dept/ |
| iron-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iron-county-sheriffs-dept/ |
| iron-mountain-lake-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iron-mountain-lake-police-dept/ |
| ironton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ironton-police-dept/ |
| jackson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jackson-county-sheriffs-dept/ |
| jackson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jackson-police-dept/ |
| jamestown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jamestown-police-dept/ |
| jasper-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jasper-county-sheriffs-dept/ |
| jasper-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jasper-police-dept/ |
| jefferson-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-city-police-dept/ |
| jefferson-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-college-police-dept/ |
| jefferson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-county-sheriffs-dept/ |
| johnson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/johnson-county-sheriffs-dept/ |
| jonesburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jonesburg-police-dept/ |
| joplin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/joplin-police-dept/ |
| kahoka-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kahoka-police-dept/ |
| kansas-city-intl-airport-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kansas-city-intl-airport-police/ |
| kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kansas-city-police-dept/ |
| kearney-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kearney-police-dept/ |
| kelso-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kelso-police-dept/ |
| kennett-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kennett-police-dept/ |
| kimberling-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimberling-city-police-dept/ |
| kimmswick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimmswick-police-dept/ |
| kimmwsick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimmwsick-police-dept/ |
| kingsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kingsville-police-dept/ |
| kirksville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kirksville-police-dept/ |
| kirkwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kirkwood-police-dept/ |
| knob-noster-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/knob-noster-police-dept/ |
| knox-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/knox-county-sheriffs-dept/ |
| la-grange-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/la-grange-police-dept/ |
| laclede-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laclede-county-sheriffs-dept/ |
| laddonia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laddonia-police-dept/ |
| ladue-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ladue-police-dept/ |
| lafayette-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lafayette-county-sheriffs-dept/ |
| lake-lafayette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-lafayette-police-dept/ |
| lake-lotawana-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-lotawana-police-dept/ |
| lake-ozark-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-ozark-police-dept/ |
| lake-st-louis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-st-louis-police-dept/ |
| lake-tapawingo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-tapawingo-police-dept/ |
| lake-winnebago-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-winnebago-police-dept/ |
| lakeshire-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lakeshire-police-dept/ |
| lamar-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lamar-police-dept/ |
| lambert-airport-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lambert-airport-police-dept/ |
| lanagan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lanagan-police-dept/ |
| lancaster-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lancaster-police-dept/ |
| laplata-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laplata-police-dept/ |
| lathrop-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lathrop-police-dept/ |
| laurie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laurie-police-dept/ |
| lawrence-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lawrence-county-sheriffs-dept/ |
| lawson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lawson-police-dept/ |
| leadington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leadington-police-dept/ |
| leadwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leadwood-police-dept/ |
| lebanon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lebanon-police-dept/ |
| lees-summit-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lees-summit-police-dept/ |
| leeton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leeton-police-dept/ |
| lewis-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lewis-county-sheriffs-dept/ |
| lexington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lexington-police-dept/ |
| liberal-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/liberal-police-dept/ |
| liberty-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/liberty-police-dept/ |
| licking-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/licking-police-dept/ |
| lincoln-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-county-sheriffs-dept/ |
| lincoln-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-police-dept/ |
| lincoln-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-university-police-dept/ |
| linn-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-county-sheriffs-dept/ |
| linn-creek-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-creek-police-dept/ |
| linn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-police-dept/ |
| livingston-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/livingston-county-sheriffs-dept/ |
| logan-rogersville-school-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/logan-rogersville-school-police-dept/ |
| lone-jack-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lone-jack-police-dept/ |
| louisiana-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/louisiana-police-dept/ |
| lowry-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lowry-city-police-dept/ |
| macon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/macon-county-sheriffs-dept/ |
| macon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/macon-police-dept/ |
| madison-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/madison-county-sheriffs-dept/ |
| malden-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/malden-police-dept/ |
| manchester-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/manchester-police-dept/ |
| mansfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mansfield-police-dept/ |
| maplewood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maplewood-police-dept/ |
| marble-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marble-hill-police-dept/ |
| marceline-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marceline-police-dept/ |
| maries-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maries-county-sheriffs-dept/ |
| marion-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marion-county-sheriffs-dept/ |
| marionville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marionville-police-dept/ |
| marquand-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marquand-police-dept/ |
| marshall-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marshall-police-dept/ |
| marshfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marshfield-police-dept/ |
| marston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marston-police-dept/ |
| martinsburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/martinsburg-police-dept/ |
| maryland-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maryland-heights-police-dept/ |
| maryville-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maryville-dept-of-public-safety/ |
| matthews-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/matthews-police-dept/ |
| maysville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maysville-police-dept/ |
| mcdonald-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mcdonald-county-sheriffs-dept/ |
| memphis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/memphis-police-dept/ |
| mercer-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mercer-county-sheriffs-dept/ |
| merriam-woods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/merriam-woods-police-dept/ |
| metropolitan-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/metropolitan-community-college-police-dept/ |
| mexico-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mexico-police-dept/ |
| milan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/milan-police-dept/ |
| miller-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miller-county-sheriffs-dept/ |
| miner-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miner-police-dept/ |
| mississippi-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mississippi-county-sheriffs-dept/ |
| missouri-capitol-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-capitol-police/ |
| missouri-dept-natural-resources-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-natural-resources-park-rangers/ |
| missouri-dept-of-conservation-protection-branch | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-of-conservation-protection-branch/ |
| missouri-southern-state-university | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-southern-state-university/ |
| missouri-state-highway-patrol | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-state-highway-patrol/ |
| missouri-univ-sandt-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-univ-sandt-police-dept/ |
| missouri-western-state-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-western-state-university-police-dept/ |
| moberly-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moberly-police-dept/ |
| moline-acres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moline-acres-police-dept/ |
| monett-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monett-police-dept/ |
| moniteau-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moniteau-county-sheriffs-dept/ |
| monroe-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monroe-city-police-dept/ |
| monroe-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monroe-county-sheriffs-dept/ |
| montgomery-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/montgomery-city-police-dept/ |
| montgomery-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/montgomery-county-sheriffs-dept/ |
| morehouse-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morehouse-police-dept/ |
| morgan-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morgan-county-sheriffs-dept/ |
| morley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morley-police-dept/ |
| morrisville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morrisville-police-dept/ |
| moscow-mills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moscow-mills-police-dept/ |
| mound-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mound-city-police-dept/ |
| mount-vernon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mount-vernon-police-dept/ |
| mountain-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mountain-grove-police-dept/ |
| mountain-view-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mountain-view-police-dept/ |
| napoleon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/napoleon-police-dept/ |
| neosho-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/neosho-police-dept/ |
| nevada-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nevada-police-dept/ |
| new-bloomfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-bloomfield-police-dept/ |
| new-florence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-florence-police-dept/ |
| new-haven-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-haven-police-dept/ |
| new-london-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-london-police-dept/ |
| new-madrid-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-madrid-county-sheriffs-dept/ |
| new-madrid-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-madrid-police-dept/ |
| newburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/newburg-police-dept/ |
| newton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/newton-county-sheriffs-dept/ |
| niangua-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/niangua-police-dept/ |
| nixa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nixa-police-dept/ |
| nixa-schools-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nixa-schools-police-dept/ |
| nodaway-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nodaway-county-sheriffs-dept/ |
| noel-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/noel-police-dept/ |
| norfolk-southern-railway-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/norfolk-southern-railway-police-dept/ |
| normandy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/normandy-police-dept/ |
| north-county-police-cooperative | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/north-county-police-cooperative/ |
| north-kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/north-kansas-city-police-dept/ |
| northmoor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northmoor-police-dept/ |
| northwest-mo-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northwest-mo-university-police-dept/ |
| northwoods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northwoods-police-dept/ |
| nw-mo-state-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nw-mo-state-university-police-dept/ |
| oak-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oak-grove-police-dept/ |
| oakview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oakview-police-dept/ |
| odessa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/odessa-police-dept/ |
| ofallon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ofallon-police-dept/ |
| old-monroe-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/old-monroe-police-dept/ |
| olivette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/olivette-police-dept/ |
| oran-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oran-police-dept/ |
| oregon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oregon-county-sheriffs-dept/ |
| oregon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oregon-police-dept/ |
| oronogo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oronogo-police-dept/ |
| orrick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/orrick-police-dept/ |
| osage-beach-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/osage-beach-police-dept/ |
| osage-co-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/osage-co-sheriffs-dept/ |
| osage-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/osage-county-sheriffs-dept/ |
| osceola-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/osceola-police-dept/ |
| otterville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/otterville-police-dept/ |
| overland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/overland-police-dept/ |
| owensville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/owensville-police-dept/ |
| ozark-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ozark-county-sheriffs-dept/ |
| ozark-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ozark-police-dept/ |
| pacific-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pacific-police-dept/ |
| pagedale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pagedale-police-dept/ |
| palmyra-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/palmyra-police-dept/ |
| park-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/park-hills-police-dept/ |
| parkville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/parkville-police-dept/ |
| parma-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/parma-police-dept/ |
| pasadena-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pasadena-park-police-dept/ |
| peculiar-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/peculiar-police-dept/ |
| pemiscot-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pemiscot-county-sheriffs-dept/ |
| perry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/perry-county-sheriffs-dept/ |
| perry-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/perry-police-dept/ |
| perryville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/perryville-police-dept/ |
| pettis-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pettis-county-sheriffs-dept/ |
| pevely-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pevely-police-dept/ |
| phelps-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/phelps-county-sheriffs-dept/ |
| piedmont-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/piedmont-police-dept/ |
| pierce-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pierce-city-police-dept/ |
| pike-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pike-county-sheriffs-dept/ |
| pilot-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pilot-grove-police-dept/ |
| pilot-knob-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pilot-knob-police-dept/ |
| pine-lawn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pine-lawn-police-dept/ |
| pineville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pineville-police-dept/ |
| platte-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/platte-city-police-dept/ |
| platte-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/platte-county-sheriffs-dept/ |
| platte-woods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/platte-woods-police-dept/ |
| plattsburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/plattsburg-police-dept/ |
| pleasant-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pleasant-hill-police-dept/ |
| pleasant-hope-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pleasant-hope-police-dept/ |
| pleasant-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pleasant-valley-police-dept/ |
| polk-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/polk-county-sheriffs-dept/ |
| polo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/polo-police-dept/ |
| poplar-bluff-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/poplar-bluff-police-dept/ |
| portageville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/portageville-police-dept/ |
| potosi-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/potosi-police-dept/ |
| prairie-home-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/prairie-home-police-dept/ |
| pulaski-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/pulaski-county-sheriffs-dept/ |
| purdy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/purdy-police-dept/ |
| putnam-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/putnam-county-sheriffs-dept/ |
| puxico-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/puxico-police-dept/ |
| queen-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/queen-city-police-dept/ |
| qulin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/qulin-police-dept/ |
| ralls-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ralls-county-sheriffs-dept/ |
| randolph-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/randolph-county-sheriffs-dept/ |
| ray-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ray-county-sheriffs-dept/ |
| raymore-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/raymore-police-dept/ |
| raytown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/raytown-police-dept/ |
| reeds-spring-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/reeds-spring-police-dept/ |
| republic-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/republic-police-dept/ |
| reynolds-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/reynolds-county-sheriffs-dept/ |
| rich-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rich-hill-police-dept/ |
| richland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richland-police-dept/ |
| richmond-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richmond-heights-police-dept/ |
| richmond-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richmond-police-dept/ |
| ripley-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ripley-county-sheriffs-dept/ |
| riverside-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/riverside-police-dept/ |
| riverview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/riverview-police-dept/ |
| rock-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rock-hill-police-dept/ |
| rock-port-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rock-port-police-dept/ |
| rockaway-beach-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rockaway-beach-police-dept/ |
| rogersville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rogersville-police-dept/ |
| rolla-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rolla-police-dept/ |
| rosebud-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rosebud-police-dept/ |
| salem-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/salem-police-dept/ |
| saline-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/saline-county-sheriffs-dept/ |
| salisbury-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/salisbury-police-dept/ |
| sarcoxie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sarcoxie-police-dept/ |
| savannah-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/savannah-police-dept/ |
| schuyler-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/schuyler-county-sheriffs-dept/ |
| scotland-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/scotland-county-sheriffs-dept/ |
| scott-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/scott-city-police-dept/ |
| scott-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/scott-county-sheriffs-dept/ |
| se-mo-state-university-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/se-mo-state-university-dept-of-public-safety/ |
| sedalia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sedalia-police-dept/ |
| seligman-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seligman-police-dept/ |
| senath-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/senath-police-dept/ |
| seneca-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seneca-police-dept/ |
| seymour-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seymour-police-dept/ |
| shannon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shannon-county-sheriffs-dept/ |
| shelbina-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shelbina-police-dept/ |
| shelby-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shelby-county-sheriffs-dept/ |
| shrewsbury-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shrewsbury-police-dept/ |
| sikeston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sikeston-police-dept/ |
| slater-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/slater-police-dept/ |
| smithton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/smithton-police-dept/ |
| smithville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/smithville-police-dept/ |
| southwest-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/southwest-city-police-dept/ |
| sparta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sparta-police-dept/ |
| springfield-branson-national-airport-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-national-airport-police/ |
| springfield-greene-county-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-greene-county-park-rangers/ |
| springfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-police-dept/ |
| springfield-school-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-school-police/ |
| st-ann-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-ann-police-dept/ |
| st-charles-city-parks-and-recreation-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-city-parks-and-recreation-dept/ |
| st-charles-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-community-college-police-dept/ |
| st-charles-county-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-county-police-dept/ |
| st-charles-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-county-sheriffs-dept/ |
| st-charles-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-police-dept/ |
| st-clair-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-clair-county-sheriffs-dept/ |
| st-clair-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-clair-police-dept/ |
| st-francois-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-francois-county-sheriffs-dept/ |
| st-james-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-james-police-dept/ |
| st-john-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-john-police-dept/ |
| st-joseph-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-joseph-police-dept/ |
| st-louis-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-city-police-dept/ |
| st-louis-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-community-college-police-dept/ |
| st-louis-county-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-county-park-rangers/ |
| st-louis-county-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-county-police-dept/ |
| st-peters-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-peters-police-dept/ |
| st-robert-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-robert-police-dept/ |
| ste-genevieve-co-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ste-genevieve-co-sheriffs-dept/ |
| ste-genevieve-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ste-genevieve-police-dept/ |
| steele-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/steele-police-dept/ |
| steelville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/steelville-police-dept/ |
| stockton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stockton-police-dept/ |
| stoddard-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stoddard-county-sheriffs-dept/ |
| stone-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stone-county-sheriffs-dept/ |
| stover-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stover-police-dept/ |
| strafford-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/strafford-police-dept/ |
| strasburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/strasburg-police-dept/ |
| sturgeon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sturgeon-police-dept/ |
| sugar-creek-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sugar-creek-police-dept/ |
| sullivan-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sullivan-county-sheriffs-dept/ |
| sullivan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sullivan-police-dept/ |
| summersville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/summersville-police-dept/ |
| sunrise-beach-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sunrise-beach-police-dept/ |
| sunset-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sunset-hills-police-dept/ |
| sweet-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sweet-springs-police-dept/ |
| sycamore-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sycamore-hills-police-dept/ |
| taney-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/taney-county-sheriffs-dept/ |
| tarkio-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tarkio-police-dept/ |
| terre-du-lac-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/terre-du-lac-police-dept/ |
| texas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/texas-county-sheriffs-dept/ |
| thayer-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/thayer-police-dept/ |
| tipton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tipton-police-dept/ |
| town-and-country-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/town-and-country-police-dept/ |
| tracy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tracy-police-dept/ |
| trenton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/trenton-police-dept/ |
| troy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/troy-police-dept/ |
| truesdale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/truesdale-police-dept/ |
| truman-state-univ-dept-of-ps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/truman-state-univ-dept-of-ps/ |
| ucm-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ucm-dept-of-public-safety/ |
| union-pacific-rr-police-kansas-city-st-louis | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/union-pacific-rr-police-kansas-city-st-louis/ |
| union-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/union-police-dept/ |
| unionville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/unionville-police-dept/ |
| university-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-city-police-dept/ |
| university-of-missouri-columbia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-columbia-police-dept/ |
| university-of-missouri-kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-kansas-city-police-dept/ |
| university-of-missouri-st-louis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-st-louis-police-dept/ |
| uplands-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/uplands-park-police-dept/ |
| van-buren-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/van-buren-police-dept/ |
| velda-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/velda-city-police-dept/ |
| vernon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vernon-county-sheriffs-dept/ |
| verona-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/verona-police-dept/ |
| versailles-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/versailles-police-dept/ |
| viburnum-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/viburnum-police-dept/ |
| vienna-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vienna-police-dept/ |
| vinita-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vinita-park-police-dept/ |
| walnut-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/walnut-grove-police-dept/ |
| warren-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/warren-county-sheriffs-dept/ |
| warrensburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/warrensburg-police-dept/ |
| warrenton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/warrenton-police-dept/ |
| warsaw-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/warsaw-police-dept/ |
| warson-woods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/warson-woods-police-dept/ |
| washburn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/washburn-police-dept/ |
| washington-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/washington-county-sheriffs-dept/ |
| washington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/washington-police-dept/ |
| washington-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/washington-university-police-dept/ |
| waverly-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/waverly-police-dept/ |
| wayne-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wayne-county-sheriffs-dept/ |
| waynesville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/waynesville-police-dept/ |
| weatherby-lake-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/weatherby-lake-police-dept/ |
| webb-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/webb-city-police-dept/ |
| webster-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/webster-county-sheriffs-dept/ |
| webster-groves-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/webster-groves-police-dept/ |
| weldon-spring-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/weldon-spring-police-dept/ |
| wellington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wellington-police-dept/ |
| wellston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wellston-police-dept/ |
| wellsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wellsville-police-dept/ |
| wentzville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wentzville-police-dept/ |
| west-plains-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/west-plains-police-dept/ |
| weston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/weston-police-dept/ |
| wheaton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wheaton-police-dept/ |
| willard-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/willard-police-dept/ |
| willard-school-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/willard-school-police-dept/ |
| williamsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/williamsville-police-dept/ |
| willow-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/willow-springs-police-dept/ |
| winfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/winfield-police-dept/ |
| winona-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/winona-police-dept/ |
| wood-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wood-heights-police-dept/ |
| woodson-terrace-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/woodson-terrace-police-dept/ |
| worth-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/worth-county-sheriffs-dept/ |
| wright-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wright-city-police-dept/ |
| wright-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wright-county-sheriffs-dept/ |
<!-- AGENCY_SLUGS_END -->
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
`https://data.vsr.recoveredfactory.net/metric_year/{row_key}.json`
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