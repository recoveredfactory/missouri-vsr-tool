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
- Formato 2020+ — PDFs de informes por agencia:
  - 2024: https://ago.mo.gov/wp-content/uploads/2024-VSR-Agency-Specific-Reports.pdf
  - 2023: https://ago.mo.gov/wp-content/uploads/VSRreport2023.pdf
  - 2022: https://ago.mo.gov/wp-content/uploads/vsrreport2022.pdf
  - 2021: https://ago.mo.gov/wp-content/uploads/2021-VSR-Agency-Specific-Report.pdf
  - 2020: https://ago.mo.gov/wp-content/uploads/2020-VSR-Agency-Specific-Report.pdf
- Formato 2020+ — PDFs de respuestas de agencias:
  - 2024: https://ago.mo.gov/wp-content/uploads/2024-Agency-Responses-1.pdf
  - 2023: https://ago.mo.gov/wp-content/uploads/VSRagencynotes2023.pdf
  - 2022: https://ago.mo.gov/wp-content/uploads/2022-agency-comments-ago.pdf
  - 2021: https://ago.mo.gov/wp-content/uploads/2021-VSR-Agency-Comments.pdf
  - 2020: https://ago.mo.gov/wp-content/uploads/2020-VSR-Agency-Comments.pdf
- Formato pre‑2020 (2000–2019): un único PDF estatal combinado por año que lista todas las agencias en secuencia, con bastantes menos métricas por agencia. No existen PDFs separados de comentarios de agencias para estos años.
  - 2019: https://ago.mo.gov/wp-content/uploads/2019agencyreports.pdf
  - 2018: https://ago.mo.gov/wp-content/uploads/2018agencyreports.pdf
  - 2017: https://ago.mo.gov/wp-content/uploads/2017agencyreports.pdf
  - 2016: https://ago.mo.gov/wp-content/uploads/2016agencyreports.pdf
  - 2015: https://ago.mo.gov/wp-content/uploads/2015agencyreports.pdf
  - 2014: https://ago.mo.gov/wp-content/uploads/2014agencyreports.pdf
  - 2013: https://ago.mo.gov/wp-content/uploads/2013-agency-reports.pdf
  - 2012: https://ago.mo.gov/wp-content/uploads/2012agencyreport.pdf
  - 2011: https://ago.mo.gov/wp-content/uploads/2011agencyreport.pdf
  - 2010: https://ago.mo.gov/wp-content/uploads/2010agencyreports.pdf
  - 2009: https://ago.mo.gov/wp-content/uploads/2009agencyreports.pdf
  - 2008: https://ago.mo.gov/wp-content/uploads/2008agencyreports.pdf
  - 2007: https://ago.mo.gov/wp-content/uploads/2007agencyreports.pdf
  - 2006: https://ago.mo.gov/wp-content/uploads/2006agencyreports.pdf
  - 2005: https://ago.mo.gov/wp-content/uploads/2005agencyreports.pdf
  - 2004: https://ago.mo.gov/wp-content/uploads/2004agencyreports.pdf
  - 2003: https://ago.mo.gov/wp-content/uploads/2003agencyreports.pdf
  - 2002: https://ago.mo.gov/wp-content/uploads/2002agencyreports.pdf
  - 2001: https://ago.mo.gov/wp-content/uploads/2001agencyreports.pdf
  - 2000: https://ago.mo.gov/wp-content/uploads/2000agencyreports.pdf

Actualmente, extraemos datos de los informes de **2000–2024** (publicados entre 2001 y 2025). El informe de 2000 está incluido en las descargas de parquet/CSV pero se suprime en la interfaz web porque su cobertura es demasiado escasa para graficar de forma significativa. Los informes pre‑2020 usan un formato distinto y reportan un conjunto más pequeño de métricas; consulte **Normalización de claves** abajo para entender cómo se reconcilian las dos eras. La cobertura en los años más tempranos (2000–2003) es parcial: aproximadamente la mitad de las agencias faltan en esos años debido a columnas de raza vacías en los PDFs fuente.

Los metadatos de las agencias (nombres, direcciones, información de contacto) provienen de una copia de 2025 de la base de datos de agencias de orden público de Missouri proporcionada por Jesse Bogan de The Marshall Project. La versión más reciente de estos datos está [disponible a través de data.mo.gov](https://data.mo.gov/Public-Safety/Missouri-Law-Enforcement-Agencies/cgbu-k38b/about_data) y se integrará después de que se publique el VSR 2025 (primavera de 2026).

Dado que los nombres de las agencias varían entre la base de datos de agencias y el VSR, creamos un puente de conexión para unir su información.

La dirección de los datos de las agencias se procesa a través de Geocod.io para adjuntar identificadores geográficos a cada jurisdicción y geocodificar la dirección de la agencia. Estos identificadores se combinan con [archivos de límites cartográficos del Censo](https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.html) para mostrar mapas de jurisdicción y relaciones espaciales.

El proceso de procesamiento es un [proyecto de código abierto Python/Dagster](https://github.com/eads/missouri-vsr-processing) desarrollado originalmente en The Marshall Project.

## Cómo están estructurados los datos

### Modelo de filas (la tabla central)

El conjunto de datos central es una tabla basada en filas donde cada fila representa una métrica para una agencia y un año. Campos clave:

- `agency` — el nombre canónico de la agencia (consulte **Normalización de nombres** abajo)
- `year` — año del informe
- `table`, `section`, `metric` — etiquetas legibles para humanos
- `table_id`, `section_id`, `metric_id` — identificadores en formato slug
- `row_key` — `table_id--section_id--metric_id` específico de la era (el identificador original del formato fuente)
- `canonical_key` — identificador de métrica independiente de la era, compartido entre los formatos pre‑2020 y 2020+ (consulte **Normalización de claves** abajo)
- `row_id` — `year-agency-row_key` (globalmente único)
- Columnas de raza: `Total`, `White`, `Black`, `Hispanic`, `Native American`, `Asian`, `Other`. Los informes pre‑2020 usan el encabezado `Am. Indian`; el paso de combinación lo colapsa en `Native American` para que la columna esté poblada en todos los años.

Todos los valores son numéricos o nulos (`.` en el PDF se convierte en `null`).

### Normalización de nombres

Los nombres de agencias varían entre los informes del Fiscal General y la base de datos de referencia, y varían año tras año dentro de los propios informes (mayúsculas/minúsculas, abreviaturas, "Department" vs "Dept", espacios, notas entre paréntesis, artefactos de OCR). El pipeline incluye un CSV de puente de conexión (`data/src/agency_crosswalk.csv`) que asigna cada variante observada a un único **nombre canónico**.

- El conjunto de datos combinado reemplaza los nombres crudos con su forma canónica antes del procesamiento posterior.
- El `agency_slug` se deriva del nombre canónico y es estable entre años.
- El `agency_index` mantiene cada variante observada en un arreglo `names` para que los consumidores aún puedan emparejar por un nombre crudo de un PDF fuente.

### Normalización de claves

Los informes pre‑2020 (2000–2019) y los 2020+ usan distintos diseños de tabla y distintas cadenas de `row_key` para conceptos equivalentes. Para soportar análisis entre eras, cada fila lleva un `canonical_key` poblado desde un puente de conexión (`data/src/canonical_crosswalk.csv`).

Ejemplos:

| `row_key` pre‑2020 | `row_key` 2020+ | `canonical_key` |
|---|---|---|
| `key-indicators--stops` | `rates-by-race--totals--all-stops` | `stops` |
| `key-indicators--searches` | `rates-by-race--totals--searches` | `searches` |
| `search-stats--probable-cause--consent` | `search-statistics--search-reason--consent` | `probable-cause--consent` |

En las salidas dist publicadas de v2, el `row_key` se reemplaza por `canonical_key` para que los consumidores frontend vean un único identificador independiente de la era.

### Filas de tasas y normalización

Las tasas en los informes (p. ej., "search rate") se capturan tal como se proporcionan. El pipeline también calcula sus propias tasas por agencia a partir de los conteos crudos en la capa de normalización:

- `search-rate`, `arrest-rate` (todos los años) y `contraband-hit-rate` (2020+) se recomputan por agencia y por raza desde los conteos crudos numerador/denominador. Las filas computadas usan claves canónicas (p. ej. `search-rate`); las tasas precomputadas del PDF se conservan para validación.
- Las **tasas estatales** se **recomputan** a partir de los totales para mayor consistencia; no sumamos filas de tasas.
- Los campos `YYYY ACS pop` se normalizan a `acs-pop` para que las variables de población sean comparables entre años.
- En los primeros años (2020–2021), las filas de población con formato `YYYY-pop` también se mapean a `acs-pop`.

### Versionado

Las publicaciones de datos siguen versionado semántico (`vMAJOR.MINOR`).

- **Mayor** — cambio de esquema incompatible: columnas renombradas/eliminadas, estructura de `row_key`/`canonical_key` cambiada, definiciones de métricas canónicas revisadas.
- **Menor** — adición compatible hacia atrás: nuevos años agregados, nuevas métricas canónicas agregadas, nuevas columnas derivadas agregadas.

El diseño del bucket S3 es:

```
s3://{bucket}/
  releases/
    v1/    ← v1 congelado (2020–2024, row_keys específicos por era)
    v2/    ← publicación actual (2000–2024, canonical_key, normalización de nombres)
  manifest.json   ← puntero de nivel superior a la publicación actual del frontend
```

Cada directorio de publicación contiene un `manifest.json` que describe la versión, la fecha de publicación, los años cubiertos, la versión del esquema, la lista de `canonical_metrics` y un changelog. La publicación actual es **v2.0** — agrega los datos del formato pre‑2020 de 2000–2019, normaliza los nombres de agencias mediante el puente de conexión, reemplaza `row_key` con `canonical_key` en las salidas dist y particiona el JSON por agencia por año.

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

- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_downloads.json

### CSV + Parquet por conjunto de datos

Para análisis en pandas/R/SQL, cada conjunto de datos también está disponible como CSV y Parquet:

**Estadísticas VSR (con filas de rango/percentil/porcentaje)**

- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_vsr_statistics.csv
- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_vsr_statistics.parquet

**Índice de agencias (nombres + metadatos)**

- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_agency_index.csv
- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_agency_index.parquet

**Comentarios de agencias**

- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_agency_comments.csv
- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_agency_comments.parquet

### Manifiesto de descargas

El manifiesto incluye tamaños de archivo para interfaces de descarga dinámicas:

- https://data.vsr.recoveredfactory.net/releases/v2/downloads/missouri_vsr_2000_2024_downloads_manifest.json

### Totales estatales (subconjunto)

Un resumen estatal simplificado utilizado para los gráficos de la página principal:

- https://data.vsr.recoveredfactory.net/releases/v2/dist/statewide_year_sums_subset.json

Claves canónicas incluidas:
- `stops`
- `probable-cause--consent`
- `stop-outcome--arrests`
- `stop-outcome--citation`
- `stop-outcome--warning`
- `stop-outcome--no-action`

### Descargas por agencia (conveniencia)

Estos archivos son convenientes para uso de una sola agencia, pero la forma **principal** de obtener los datos sigue siendo las descargas combinadas anteriores.

| Recurso | Patrón de URL | Notas |
|---|---|---|
| JSON de agencia por año | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/{agency_slug}/{year}.json | Un archivo por agencia por año — solicitar cada año por separado |
| GeoJSON del límite de agencia | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries/{agency_id}.geojson | FeatureCollection único con límite + vecinos |
| Índice de límites de agencia | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_boundaries_index.json | Lista qué archivos de límites existen (por slug) |
| JSON por métrica (canónica) | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/{canonical_key}.json | Un archivo por métrica canónica, todos los años y agencias |
| Subconjunto de métricas (página principal) | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year_subset/{canonical_key}.json | Subconjunto compacto para la página principal, también disponible por año en `metric_year_subset/by_year/{year}.json` |

### Archivos de agencia por año (índice)

En v2, los datos de las agencias están divididos en un archivo por año. Para obtener todos los datos de una agencia, solicite cada año individualmente usando el patrón `releases/v2/dist/agency_year/{slug}/{year}.json`. Años disponibles: **2000–2024** (con cobertura escasa en los años más tempranos).
<!-- AGENCY_SLUGS_START -->
| Slug de agencia | URL base |
|---|---|
| adair-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/adair-county-sheriffs-dept/ |
| adair-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/adair-police-dept/ |
| adrian-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/adrian-police-dept/ |
| advance-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/advance-police-dept/ |
| alma-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/alma-police-dept/ |
| alton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/alton-police-dept/ |
| anderson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/anderson-police-dept/ |
| andrew-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/andrew-county-sheriffs-dept/ |
| annapolis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/annapolis-police-dept/ |
| anniston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/anniston-police-dept/ |
| appleton-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/appleton-city-police-dept/ |
| arbyrd-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arbyrd-police-dept/ |
| arcadia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arcadia-police-dept/ |
| archie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/archie-police-dept/ |
| armstrong-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/armstrong-police-dept/ |
| arnold-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/arnold-police-dept/ |
| ash-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ash-grove-police-dept/ |
| ashland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ashland-police-dept/ |
| atchison-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/atchison-county-sheriffs-dept/ |
| atlanta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/atlanta-police-dept/ |
| audrain-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/audrain-county-sheriffs-dept/ |
| augusta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/augusta-police-dept/ |
| aurora-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/aurora-police-dept/ |
| auxvasse-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/auxvasse-police-dept/ |
| ava-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ava-police-dept/ |
| b-sf-railway-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/b-sf-railway-police/ |
| ballwin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ballwin-police-dept/ |
| barry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/barry-county-sheriffs-dept/ |
| barton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/barton-county-sheriffs-dept/ |
| bates-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bates-city-police-dept/ |
| bates-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bates-county-sheriffs-dept/ |
| battlefield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/battlefield-police-dept/ |
| bel-nor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bel-nor-police-dept/ |
| bel-ridge-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bel-ridge-police-dept/ |
| bell-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bell-city-police-dept/ |
| bella-villa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bella-villa-police-dept/ |
| belle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/belle-police-dept/ |
| bellefontaine-neighbors-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bellefontaine-neighbors-pd/ |
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
| bevier-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bevier-police-dept/ |
| billings-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/billings-police-dept/ |
| birch-tree-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/birch-tree-police-dept/ |
| birmingham-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/birmingham-police-dept/ |
| bismarck-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bismarck-police-dept/ |
| blackburn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/blackburn-police-dept/ |
| bland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bland-police-dept/ |
| bloomfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bloomfield-police-dept/ |
| blue-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/blue-springs-police-dept/ |
| bnsf-railway-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bnsf-railway-police/ |
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
| browning-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/browning-police-dept/ |
| brunswick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/brunswick-police-dept/ |
| buchanan-county-drug-strike-force | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buchanan-county-drug-strike-force/ |
| buchanan-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buchanan-county-sheriffs-dept/ |
| bucklin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bucklin-police-dept/ |
| buckner-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buckner-police-dept/ |
| buffalo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/buffalo-police-dept/ |
| bull-creek-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bull-creek-police-dept/ |
| bunceton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bunceton-police-dept/ |
| bunker-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/bunker-police-dept/ |
| burlington-northern-and-santa-fe-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/burlington-northern-and-santa-fe-pd/ |
| burlington-northern-santa-fe-rail-co | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/burlington-northern-santa-fe-rail-co/ |
| butler-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butler-county-sheriffs-dept/ |
| butler-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butler-police-dept/ |
| butterfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/butterfield-police-dept/ |
| byrnes-mill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/byrnes-mill-police-dept/ |
| cabool-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cabool-police-dept/ |
| caldwell-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/caldwell-county-sheriffs-dept/ |
| california-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/california-police-dept/ |
| callao-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/callao-police-dept/ |
| callaway-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/callaway-county-sheriffs-dept/ |
| calverton-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/calverton-park-police-dept/ |
| camden-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/camden-county-sheriffs-dept/ |
| camden-point-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/camden-point-police-dept/ |
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
| catron-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/catron-police-dept/ |
| cedar-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cedar-county-sheriffs-dept/ |
| center-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/center-police-dept/ |
| centerview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/centerview-police-dept/ |
| centralia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/centralia-police-dept/ |
| chaffee-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chaffee-police-dept/ |
| chamois-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chamois-police-dept/ |
| chariton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chariton-county-sheriffs-dept/ |
| charlack-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/charlack-police-dept/ |
| charleston-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/charleston-dept-of-public-safety/ |
| charleston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/charleston-police-dept/ |
| chesterfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chesterfield-police-dept/ |
| chilhowee-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chilhowee-police-dept/ |
| chillicothe-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/chillicothe-police-dept/ |
| christian-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/christian-county-sheriffs-dept/ |
| city-of-bellerive-acres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-bellerive-acres-police-dept/ |
| city-of-california-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-california-police-dept/ |
| city-of-oakland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/city-of-oakland-police-dept/ |
| clarence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarence-police-dept/ |
| clark-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clark-county-sheriffs-dept/ |
| clark-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clark-police-dept/ |
| clarksburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarksburg-police-dept/ |
| clarksdale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarksdale-police-dept/ |
| clarkson-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarkson-valley-police-dept/ |
| clarkton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clarkton-police-dept/ |
| clay-county-parks-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clay-county-parks-dept/ |
| clay-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clay-county-sheriffs-dept/ |
| claycomo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/claycomo-police-dept/ |
| clayton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clayton-police-dept/ |
| cleveland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cleveland-police-dept/ |
| clever-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clever-police-dept/ |
| clinton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clinton-county-sheriffs-dept/ |
| clinton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/clinton-police-dept/ |
| cmsu-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cmsu-dept-of-public-safety/ |
| cole-camp-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cole-camp-police-dept/ |
| cole-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cole-county-sheriffs-dept/ |
| columbia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/columbia-police-dept/ |
| concordia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/concordia-police-dept/ |
| conway-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/conway-police-dept/ |
| cool-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cool-valley-police-dept/ |
| cooper-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cooper-county-sheriffs-dept/ |
| cooter-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cooter-police-dept/ |
| corder-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/corder-police-dept/ |
| cottleville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cottleville-police-dept/ |
| country-club-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/country-club-hills-police-dept/ |
| country-club-village-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/country-club-village-police-dept/ |
| cowgill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cowgill-police-dept/ |
| crane-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crane-police-dept/ |
| crawford-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crawford-county-sheriffs-dept/ |
| creighton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/creighton-police-dept/ |
| crestwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crestwood-police-dept/ |
| creve-coeur-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/creve-coeur-police-dept/ |
| crocker-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crocker-police-dept/ |
| crystal-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crystal-city-police-dept/ |
| crystal-lakes-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/crystal-lakes-police-dept/ |
| cuba-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/cuba-police-dept/ |
| curryville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/curryville-police-dept/ |
| dade-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dade-county-sheriffs-dept/ |
| dallas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dallas-county-sheriffs-dept/ |
| dardenne-prairie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dardenne-prairie-police-dept/ |
| daviess-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/daviess-county-sheriffs-dept/ |
| deepwater-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/deepwater-police-dept/ |
| dekalb-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dekalb-county-sheriffs-dept/ |
| dellwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dellwood-police-dept/ |
| delta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/delta-police-dept/ |
| dent-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dent-county-sheriffs-dept/ |
| des-peres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/des-peres-police-dept/ |
| desloge-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/desloge-police-dept/ |
| desoto-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/desoto-police-dept/ |
| dewitt-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dewitt-police-dept/ |
| dexter-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dexter-police-dept/ |
| diamond-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/diamond-police-dept/ |
| dixon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dixon-police-dept/ |
| doniphan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/doniphan-police-dept/ |
| doolittle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/doolittle-police-dept/ |
| douglas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/douglas-county-sheriffs-dept/ |
| drexel-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/drexel-police-dept/ |
| dudley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/dudley-police-dept/ |
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
| ellington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ellington-police-dept/ |
| ellisville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ellisville-police-dept/ |
| ellsinore-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ellsinore-police-dept/ |
| elsberry-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/elsberry-police-dept/ |
| eminence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/eminence-police-dept/ |
| emma-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/emma-police-dept/ |
| eolia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/eolia-police-dept/ |
| essex-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/essex-police-dept/ |
| eureka-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/eureka-police-dept/ |
| everton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/everton-police-dept/ |
| excelsior-springs-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/excelsior-springs-police-dept/ |
| exeter-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/exeter-police-dept/ |
| fair-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fair-grove-police-dept/ |
| fair-play-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fair-play-police-dept/ |
| fairfax-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fairfax-police-dept/ |
| fairview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fairview-police-dept/ |
| farber-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/farber-police-dept/ |
| farmington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/farmington-police-dept/ |
| fayette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fayette-police-dept/ |
| ferguson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ferguson-police-dept/ |
| ferrelview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ferrelview-police-dept/ |
| festus-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/festus-police-dept/ |
| fisk-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fisk-police-dept/ |
| fleming-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fleming-police-dept/ |
| flordell-hills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/flordell-hills-police-dept/ |
| florissant-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/florissant-police-dept/ |
| florissant-valley-comm-college-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/florissant-valley-comm-college-pd/ |
| foley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/foley-police-dept/ |
| fordland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fordland-police-dept/ |
| forest-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/forest-city-police-dept/ |
| foristell-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/foristell-police-dept/ |
| forsyth-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/forsyth-police-dept/ |
| frankford-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/frankford-police-dept/ |
| franklin-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/franklin-county-sheriffs-dept/ |
| fredericktown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fredericktown-police-dept/ |
| freeman-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/freeman-police-dept/ |
| frontenac-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/frontenac-police-dept/ |
| fulton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/fulton-police-dept/ |
| gainesville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gainesville-police-dept/ |
| galena-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/galena-police-dept/ |
| gallatin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gallatin-police-dept/ |
| garden-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/garden-city-police-dept/ |
| gasconade-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gasconade-county-sheriffs-dept/ |
| gasconade-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gasconade-police-dept/ |
| gentry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gentry-county-sheriffs-dept/ |
| gerald-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gerald-police-dept/ |
| gideon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gideon-police-dept/ |
| gilman-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gilman-city-police-dept/ |
| gladstone-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gladstone-dept-of-public-safety/ |
| glasgow-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glasgow-police-dept/ |
| glen-echo-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glen-echo-park-police-dept/ |
| glendale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glendale-police-dept/ |
| glenwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/glenwood-police-dept/ |
| golden-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/golden-city-police-dept/ |
| goodman-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/goodman-police-dept/ |
| gordonville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gordonville-police-dept/ |
| gower-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/gower-police-dept/ |
| grain-valley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grain-valley-police-dept/ |
| granby-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/granby-police-dept/ |
| grandin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grandin-police-dept/ |
| grandview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grandview-police-dept/ |
| grant-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grant-city-police-dept/ |
| green-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/green-city-police-dept/ |
| green-ridge-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/green-ridge-police-dept/ |
| greene-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greene-county-sheriffs-dept/ |
| greenfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greenfield-police-dept/ |
| greenville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greenville-police-dept/ |
| greenwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/greenwood-police-dept/ |
| grundy-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/grundy-county-sheriffs-dept/ |
| hale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hale-police-dept/ |
| hallsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hallsville-police-dept/ |
| hamilton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hamilton-police-dept/ |
| hannibal-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hannibal-police-dept/ |
| hardin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hardin-police-dept/ |
| harrison-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/harrison-county-sheriffs-dept/ |
| harrisonville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/harrisonville-police-dept/ |
| hartville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hartville-police-dept/ |
| hawk-point-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hawk-point-police-dept/ |
| hayti-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hayti-heights-police-dept/ |
| hayti-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hayti-police-dept/ |
| hazelwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hazelwood-police-dept/ |
| henrietta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/henrietta-police-dept/ |
| henry-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/henry-county-sheriffs-dept/ |
| herculaneum-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/herculaneum-police-dept/ |
| hermann-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hermann-police-dept/ |
| hickory-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hickory-county-sheriffs-dept/ |
| higbee-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/higbee-police-dept/ |
| higginsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/higginsville-police-dept/ |
| high-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/high-hill-police-dept/ |
| highlandville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/highlandville-police-dept/ |
| hillsboro-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hillsboro-police-dept/ |
| hillsdale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hillsdale-police-dept/ |
| holcomb-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holcomb-police-dept/ |
| holden-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holden-police-dept/ |
| holland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holland-police-dept/ |
| hollister-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hollister-police-dept/ |
| holt-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holt-county-sheriffs-dept/ |
| holt-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holt-police-dept/ |
| holts-summit-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/holts-summit-police-dept/ |
| hornersville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hornersville-police-dept/ |
| houston-lake-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/houston-lake-police-dept/ |
| houston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/houston-police-dept/ |
| howard-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howard-county-sheriffs-dept/ |
| howardville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howardville-police-dept/ |
| howell-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/howell-county-sheriffs-dept/ |
| humansville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/humansville-police-dept/ |
| huntsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/huntsville-police-dept/ |
| hurley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/hurley-police-dept/ |
| iberia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iberia-police-dept/ |
| independence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/independence-police-dept/ |
| indian-point-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/indian-point-police-dept/ |
| iron-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iron-county-sheriffs-dept/ |
| iron-mountain-lake-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/iron-mountain-lake-police-dept/ |
| irondale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/irondale-police-dept/ |
| ironton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ironton-police-dept/ |
| jackson-county-drug-task-force | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jackson-county-drug-task-force/ |
| jackson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jackson-county-sheriffs-dept/ |
| jackson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jackson-police-dept/ |
| jamestown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jamestown-police-dept/ |
| jasco-metropolitan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jasco-metropolitan-police-dept/ |
| jasper-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jasper-county-sheriffs-dept/ |
| jasper-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jasper-police-dept/ |
| jefferson-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-city-police-dept/ |
| jefferson-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-college-police-dept/ |
| jefferson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jefferson-county-sheriffs-dept/ |
| jennings-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jennings-police-dept/ |
| johnson-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/johnson-county-sheriffs-dept/ |
| jonesburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/jonesburg-police-dept/ |
| joplin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/joplin-police-dept/ |
| kahoka-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kahoka-police-dept/ |
| kansas-city-intl-airport-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kansas-city-intl-airport-police/ |
| kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kansas-city-police-dept/ |
| kearney-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kearney-police-dept/ |
| kelso-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kelso-police-dept/ |
| kennett-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kennett-police-dept/ |
| keytesville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/keytesville-police-dept/ |
| kimberling-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimberling-city-police-dept/ |
| kimmswick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimmswick-police-dept/ |
| kimmwsick-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kimmwsick-police-dept/ |
| king-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/king-city-police-dept/ |
| kingsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kingsville-police-dept/ |
| kinloch-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kinloch-police-dept/ |
| kirksville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kirksville-police-dept/ |
| kirkwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/kirkwood-police-dept/ |
| knob-noster-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/knob-noster-police-dept/ |
| knox-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/knox-county-sheriffs-dept/ |
| la-grange-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/la-grange-police-dept/ |
| labelle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/labelle-police-dept/ |
| laclede-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laclede-county-sheriffs-dept/ |
| laddonia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laddonia-police-dept/ |
| ladue-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ladue-police-dept/ |
| lafayette-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lafayette-county-sheriffs-dept/ |
| lake-annette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-annette-police-dept/ |
| lake-lafayette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-lafayette-police-dept/ |
| lake-lotawana-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-lotawana-police-dept/ |
| lake-ozark-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-ozark-police-dept/ |
| lake-st-louis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-st-louis-police-dept/ |
| lake-tapawingo-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-tapawingo-police-dept/ |
| lake-timberline-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-timberline-police-dept/ |
| lake-waukomis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-waukomis-police-dept/ |
| lake-winnebago-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lake-winnebago-police-dept/ |
| lakeshire-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lakeshire-police-dept/ |
| lamar-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lamar-police-dept/ |
| lambert-airport-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lambert-airport-police-dept/ |
| lambert-st-louis-airport-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lambert-st-louis-airport-police-dept/ |
| lamonte-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lamonte-police-dept/ |
| lanagan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lanagan-police-dept/ |
| lancaster-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lancaster-police-dept/ |
| laplata-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laplata-police-dept/ |
| lathrop-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lathrop-police-dept/ |
| latour-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/latour-police-dept/ |
| laurie-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/laurie-police-dept/ |
| lawrence-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lawrence-county-sheriffs-dept/ |
| lawson-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lawson-police-dept/ |
| leadington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leadington-police-dept/ |
| leadwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leadwood-police-dept/ |
| leasburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leasburg-police-dept/ |
| lebanon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lebanon-police-dept/ |
| lees-summit-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lees-summit-police-dept/ |
| leeton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/leeton-police-dept/ |
| lewis-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lewis-county-sheriffs-dept/ |
| lexington-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lexington-police-dept/ |
| liberal-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/liberal-police-dept/ |
| liberty-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/liberty-police-dept/ |
| licking-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/licking-police-dept/ |
| lilbourn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lilbourn-police-dept/ |
| lincoln-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-county-sheriffs-dept/ |
| lincoln-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-police-dept/ |
| lincoln-univ-dps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-univ-dps/ |
| lincoln-university-dept-of-public-saf | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-university-dept-of-public-saf/ |
| lincoln-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lincoln-university-police-dept/ |
| linn-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-county-sheriffs-dept/ |
| linn-creek-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-creek-police-dept/ |
| linn-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/linn-police-dept/ |
| livingston-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/livingston-county-sheriffs-dept/ |
| lockwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/lockwood-police-dept/ |
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
| marthasville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/marthasville-police-dept/ |
| martinsburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/martinsburg-police-dept/ |
| maryland-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maryland-heights-police-dept/ |
| maryville-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maryville-dept-of-public-safety/ |
| matthews-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/matthews-police-dept/ |
| maysville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/maysville-police-dept/ |
| mayview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mayview-police-dept/ |
| mcdonald-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mcdonald-county-sheriffs-dept/ |
| memphis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/memphis-police-dept/ |
| meramec-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/meramec-college-police-dept/ |
| mercer-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mercer-county-sheriffs-dept/ |
| merriam-woods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/merriam-woods-police-dept/ |
| metropolitan-comm-coll-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/metropolitan-comm-coll-pd/ |
| metropolitan-comm-college-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/metropolitan-comm-college-pd/ |
| metropolitan-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/metropolitan-community-college-police-dept/ |
| mexico-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mexico-police-dept/ |
| milan-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/milan-police-dept/ |
| miller-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miller-county-sheriffs-dept/ |
| miller-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miller-police-dept/ |
| miner-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miner-police-dept/ |
| mineral-area-college-dps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mineral-area-college-dps/ |
| miramiguoa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/miramiguoa-police-dept/ |
| mississippi-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mississippi-county-sheriffs-dept/ |
| missouri-all-agencies.json | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-all-agencies.json/ |
| missouri-capitol-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-capitol-police/ |
| missouri-dept-natural-resources-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-natural-resources-park-rangers/ |
| missouri-dept-nr-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-nr-park-rangers/ |
| missouri-dept-ntrl-res-park-ranger | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-ntrl-res-park-ranger/ |
| missouri-dept-of-conservation-protection-branch | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-of-conservation-protection-branch/ |
| missouri-dept-of-natural-resources | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-dept-of-natural-resources/ |
| missouri-southern-st-univ-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-southern-st-univ-pd/ |
| missouri-southern-state-university | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-southern-state-university/ |
| missouri-state-highway-patrol | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-state-highway-patrol/ |
| missouri-state-water-patrol | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-state-water-patrol/ |
| missouri-univ-of-sci-tech-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-univ-of-sci-tech-pd/ |
| missouri-univ-s-t-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-univ-s-t-police-dept/ |
| missouri-univ-sandt-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-univ-sandt-police-dept/ |
| missouri-univ-sci-and-tech-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-univ-sci-and-tech-pd/ |
| missouri-university-of-sci-tech-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-university-of-sci-tech-pd/ |
| missouri-western-st-univ-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-western-st-univ-pd/ |
| missouri-western-state-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/missouri-western-state-university-police-dept/ |
| moberly-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moberly-police-dept/ |
| mokane-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mokane-police-dept/ |
| moline-acres-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moline-acres-police-dept/ |
| monett-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monett-police-dept/ |
| moniteau-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moniteau-county-sheriffs-dept/ |
| monroe-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monroe-city-police-dept/ |
| monroe-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/monroe-county-sheriffs-dept/ |
| montgomery-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/montgomery-city-police-dept/ |
| montgomery-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/montgomery-county-sheriffs-dept/ |
| montrose-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/montrose-police-dept/ |
| morehouse-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morehouse-police-dept/ |
| morgan-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morgan-county-sheriffs-dept/ |
| morley-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morley-police-dept/ |
| morrisville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/morrisville-police-dept/ |
| mosby-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mosby-police-dept/ |
| moscow-mills-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/moscow-mills-police-dept/ |
| mound-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mound-city-police-dept/ |
| mount-vernon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mount-vernon-police-dept/ |
| mountain-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mountain-grove-police-dept/ |
| mountain-view-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/mountain-view-police-dept/ |
| napoleon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/napoleon-police-dept/ |
| naylor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/naylor-police-dept/ |
| neelyville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/neelyville-police-dept/ |
| neosho-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/neosho-police-dept/ |
| nevada-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nevada-police-dept/ |
| new-bloomfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-bloomfield-police-dept/ |
| new-cambria-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-cambria-police-dept/ |
| new-florence-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-florence-police-dept/ |
| new-franklin-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-franklin-police-dept/ |
| new-haven-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-haven-police-dept/ |
| new-london-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-london-police-dept/ |
| new-madrid-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-madrid-county-sheriffs-dept/ |
| new-madrid-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-madrid-police-dept/ |
| new-melle-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/new-melle-police-dept/ |
| newburg-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/newburg-police-dept/ |
| newton-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/newton-county-sheriffs-dept/ |
| niangua-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/niangua-police-dept/ |
| nixa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nixa-police-dept/ |
| nixa-schools-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nixa-schools-police-dept/ |
| nodaway-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nodaway-county-sheriffs-dept/ |
| noel-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/noel-police-dept/ |
| norborne-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/norborne-police-dept/ |
| norfolk-southern-railway-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/norfolk-southern-railway-police-dept/ |
| normandy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/normandy-police-dept/ |
| north-county-police-cooperative | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/north-county-police-cooperative/ |
| north-kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/north-kansas-city-police-dept/ |
| northmoor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northmoor-police-dept/ |
| northwest-mo-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northwest-mo-university-police-dept/ |
| northwoods-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/northwoods-police-dept/ |
| norwood-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/norwood-police-dept/ |
| novinger-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/novinger-police-dept/ |
| nw-mo-state-university-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/nw-mo-state-university-police-dept/ |
| oak-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oak-grove-police-dept/ |
| oakview-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/oakview-police-dept/ |
| odessa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/odessa-police-dept/ |
| ofallon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ofallon-police-dept/ |
| old-monroe-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/old-monroe-police-dept/ |
| olivette-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/olivette-police-dept/ |
| olympian-village-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/olympian-village-police-dept/ |
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
| randolph-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/randolph-police-dept/ |
| ray-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ray-county-sheriffs-dept/ |
| raymore-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/raymore-police-dept/ |
| raytown-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/raytown-police-dept/ |
| reeds-spring-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/reeds-spring-police-dept/ |
| republic-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/republic-police-dept/ |
| revere-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/revere-police-dept/ |
| reynolds-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/reynolds-county-sheriffs-dept/ |
| rich-hill-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/rich-hill-police-dept/ |
| richland-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richland-police-dept/ |
| richmond-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richmond-heights-police-dept/ |
| richmond-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/richmond-police-dept/ |
| ripley-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ripley-county-sheriffs-dept/ |
| risco-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/risco-police-dept/ |
| riverside-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/riverside-dept-of-public-safety/ |
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
| se-mo-st-univ-dps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/se-mo-st-univ-dps/ |
| se-mo-state-university-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/se-mo-state-university-dept-of-public-safety/ |
| sedalia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sedalia-police-dept/ |
| seligman-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seligman-police-dept/ |
| senath-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/senath-police-dept/ |
| seneca-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seneca-police-dept/ |
| seymour-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/seymour-police-dept/ |
| shannon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shannon-county-sheriffs-dept/ |
| shelbina-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shelbina-police-dept/ |
| shelby-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shelby-county-sheriffs-dept/ |
| shelbyville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shelbyville-police-dept/ |
| sheldon-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sheldon-police-dept/ |
| shrewsbury-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/shrewsbury-police-dept/ |
| sikeston-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sikeston-police-dept/ |
| silex-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/silex-police-dept/ |
| slater-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/slater-police-dept/ |
| smithton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/smithton-police-dept/ |
| smithville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/smithville-police-dept/ |
| southeast-missouri-st-univ-dps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/southeast-missouri-st-univ-dps/ |
| southwest-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/southwest-city-police-dept/ |
| sparta-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/sparta-police-dept/ |
| springfield-bran-natl-airport-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-bran-natl-airport-pd/ |
| springfield-branson-airport-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-airport-pd/ |
| springfield-branson-nat-airport-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-nat-airport-pd/ |
| springfield-branson-national-airport-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-national-airport-police/ |
| springfield-branson-natl-airport-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-natl-airport-pd/ |
| springfield-branson-ntl-airport-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-branson-ntl-airport-pd/ |
| springfield-greene-co-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-greene-co-park-rangers/ |
| springfield-greene-county-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-greene-county-park-rangers/ |
| springfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-police-dept/ |
| springfield-school-police | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/springfield-school-police/ |
| st-ann-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-ann-police-dept/ |
| st-charles-city-parks-and-recreation-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-city-parks-and-recreation-dept/ |
| st-charles-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-community-college-police-dept/ |
| st-charles-county-parks-rec | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-county-parks-rec/ |
| st-charles-county-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-county-police-dept/ |
| st-charles-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-county-sheriffs-dept/ |
| st-charles-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-charles-police-dept/ |
| st-clair-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-clair-county-sheriffs-dept/ |
| st-clair-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-clair-police-dept/ |
| st-francois-county-sheriffs | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-francois-county-sheriffs/ |
| st-francois-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-francois-county-sheriffs-dept/ |
| st-george-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-george-police-dept/ |
| st-james-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-james-police-dept/ |
| st-john-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-john-police-dept/ |
| st-joseph-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-joseph-police-dept/ |
| st-louis-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-city-police-dept/ |
| st-louis-comm-coll-forest-park | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-comm-coll-forest-park/ |
| st-louis-community-college-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-community-college-pd/ |
| st-louis-community-college-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-community-college-police-dept/ |
| st-louis-county-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-county-park-rangers/ |
| st-louis-county-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-county-police-dept/ |
| st-louis-park-rangers | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-louis-park-rangers/ |
| st-mary-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-mary-police-dept/ |
| st-marys-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-marys-police-dept/ |
| st-peters-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-peters-police-dept/ |
| st-peters-ranger-enforcement-div | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-peters-ranger-enforcement-div/ |
| st-robert-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/st-robert-police-dept/ |
| stanberry-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stanberry-police-dept/ |
| ste-genevieve-co-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ste-genevieve-co-sheriffs-dept/ |
| ste-genevieve-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ste-genevieve-police-dept/ |
| steele-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/steele-police-dept/ |
| steelville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/steelville-police-dept/ |
| stewartsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/stewartsville-police-dept/ |
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
| tallapoosa-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tallapoosa-police-dept/ |
| taney-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/taney-county-sheriffs-dept/ |
| taos-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/taos-police-dept/ |
| tarkio-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tarkio-police-dept/ |
| terminal-railroad-asso-of-st-louis | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/terminal-railroad-asso-of-st-louis/ |
| terminal-railroad-association-of-stl | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/terminal-railroad-association-of-stl/ |
| terre-du-lac-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/terre-du-lac-police-dept/ |
| texas-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/texas-county-sheriffs-dept/ |
| thayer-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/thayer-police-dept/ |
| theodosia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/theodosia-police-dept/ |
| three-rivers-comm-college-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/three-rivers-comm-college-pd/ |
| three-rivers-community-college | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/three-rivers-community-college/ |
| tipton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tipton-police-dept/ |
| town-and-country-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/town-and-country-police-dept/ |
| town-of-west-sullivan-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/town-of-west-sullivan-pd/ |
| tracy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/tracy-police-dept/ |
| trenton-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/trenton-police-dept/ |
| trimble-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/trimble-police-dept/ |
| troy-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/troy-police-dept/ |
| truesdale-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/truesdale-police-dept/ |
| truman-state-univ-dept-of-ps | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/truman-state-univ-dept-of-ps/ |
| ucm-dept-of-public-safety | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/ucm-dept-of-public-safety/ |
| union-pacific-rr-police-kansas-city-st-louis | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/union-pacific-rr-police-kansas-city-st-louis/ |
| union-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/union-police-dept/ |
| union-star-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/union-star-police-dept/ |
| unionville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/unionville-police-dept/ |
| university-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-city-police-dept/ |
| university-of-missouri-columbia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-columbia-police-dept/ |
| university-of-missouri-kansas-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-kansas-city-police-dept/ |
| university-of-missouri-st-louis-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-missouri-st-louis-police-dept/ |
| university-of-mo-st-louis-pd | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/university-of-mo-st-louis-pd/ |
| uplands-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/uplands-park-police-dept/ |
| urbana-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/urbana-police-dept/ |
| urich-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/urich-police-dept/ |
| van-buren-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/van-buren-police-dept/ |
| vandalia-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vandalia-police-dept/ |
| velda-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/velda-city-police-dept/ |
| vernon-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vernon-county-sheriffs-dept/ |
| verona-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/verona-police-dept/ |
| versailles-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/versailles-police-dept/ |
| viburnum-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/viburnum-police-dept/ |
| vienna-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vienna-police-dept/ |
| vinita-park-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vinita-park-police-dept/ |
| vinita-terrace-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/vinita-terrace-police-dept/ |
| walker-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/walker-police-dept/ |
| walnut-grove-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/walnut-grove-police-dept/ |
| wardell-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wardell-police-dept/ |
| wardsville-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wardsville-police-dept/ |
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
| winchester-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/winchester-police-dept/ |
| windsor-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/windsor-police-dept/ |
| winfield-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/winfield-police-dept/ |
| winona-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/winona-police-dept/ |
| wood-heights-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wood-heights-police-dept/ |
| woodson-terrace-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/woodson-terrace-police-dept/ |
| worth-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/worth-county-sheriffs-dept/ |
| wright-city-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wright-city-police-dept/ |
| wright-county-sheriffs-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wright-county-sheriffs-dept/ |
| wyatt-police-dept | https://data.vsr.recoveredfactory.net/releases/v2/dist/agency_year/wyatt-police-dept/ |
<!-- AGENCY_SLUGS_END -->
## Peculiaridades de formato y notas de implementación

### Índice de agencias (`agency_index`)

El índice de agencias es una agregación de metadatos de agencias y los nombres del VSR. Campos destacados:

- `agency_slug` — nombre canónico en formato slug (apóstrofes eliminados, puntuación colapsada)
- `canonical_name` — el único nombre canónico de la agencia (consulte **Normalización de nombres**)
- `names` — **arreglo de nombres conocidos** para la agencia (canónico, puente de conexión y variantes del VSR)
- `city`, `zip`, `phone`, `county` — de la base de datos de referencia de agencias
- `census_geoid` — identificador geográfico del Censo de EE. UU. (GEOID) para la jurisdicción de la agencia
- `stops` y `all_stops_total` — las paradas totales más recientes, para ponderación/búsqueda
- `years_with_data` — arreglo de años en los que la agencia reportó al menos un valor no nulo
- `latest_year_with_data` — el año más reciente en `years_with_data` (o `null`)

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

## Métricas rastreadas (lista de claves canónicas)

En v2, las salidas dist indexan las métricas por `canonical_key` en lugar del `row_key` específico de la era. Algunas métricas solo aparecen en ciertos años (p. ej., el índice de disparidad se descontinuó después de 2022; las tasas por raza y los totales de contrabando son solo de 2020+). Los errores ortográficos preservados de los informes originales incluyen `parol` y `equpiment`.

Por conveniencia, cada clave canónica tiene un archivo JSON por métrica en:
`https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/{canonical_key}.json`
Son útiles para uso de una sola métrica, pero las descargas combinadas son la interfaz principal.

**Todas las claves canónicas actualmente presentes:**

<!-- METRIC_KEYS_START -->
| Categoría | Clave canónica | Archivo de métrica |
|---|---|---|
| arrest-charge | arrest-charge--drug-violation | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--drug-violation.json |
| arrest-charge | arrest-charge--dwi-bac | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--dwi-bac.json |
| arrest-charge | arrest-charge--off-against-person | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--off-against-person.json |
| arrest-charge | arrest-charge--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--other.json |
| arrest-charge | arrest-charge--outstanding-warrant | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--outstanding-warrant.json |
| arrest-charge | arrest-charge--property-offense | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--property-offense.json |
| arrest-charge | arrest-charge--resist-arrest | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--resist-arrest.json |
| arrest-charge | arrest-charge--traffic-violation | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-charge--traffic-violation.json |
| arrest-rate | arrest-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrest-rate.json |
| arrests | arrests | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/arrests.json |
| citation-rate | citation-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/citation-rate.json |
| citation-warning | citation-warning--equipment | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/citation-warning--equipment.json |
| citation-warning | citation-warning--license-registration | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/citation-warning--license-registration.json |
| citation-warning | citation-warning--moving | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/citation-warning--moving.json |
| citations | citations | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/citations.json |
| contraband-found | contraband-found--alcohol | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--alcohol.json |
| contraband-found | contraband-found--currency | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--currency.json |
| contraband-found | contraband-found--drugs-alcohol | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--drugs-alcohol.json |
| contraband-found | contraband-found--drugs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--drugs.json |
| contraband-found | contraband-found--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--other.json |
| contraband-found | contraband-found--stolen-property | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--stolen-property.json |
| contraband-found | contraband-found--weapon | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-found--weapon.json |
| contraband-hit-rate | contraband-hit-rate--arrest-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-hit-rate--arrest-rate.json |
| contraband-hit-rate | contraband-hit-rate--citation-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-hit-rate--citation-rate.json |
| contraband-hit-rate | contraband-hit-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-hit-rate.json |
| contraband-total | contraband-total | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/contraband-total.json |
| disparity-index | disparity-index--all-stops-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--all-stops-acs.json |
| disparity-index | disparity-index--all-stops-dec | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--all-stops-dec.json |
| disparity-index | disparity-index--all-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--all-stops.json |
| disparity-index | disparity-index--population-2019 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-2019.json |
| disparity-index | disparity-index--population-2020-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-2020-acs.json |
| disparity-index | disparity-index--population-2020-decennial | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-2020-decennial.json |
| disparity-index | disparity-index--population-2021-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-2021-acs.json |
| disparity-index | disparity-index--population-pct-2019 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-pct-2019.json |
| disparity-index | disparity-index--population-pct-2020-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-pct-2020-acs.json |
| disparity-index | disparity-index--population-pct-2020-decennial | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-pct-2020-decennial.json |
| disparity-index | disparity-index--population-pct-2021-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--population-pct-2021-acs.json |
| disparity-index | disparity-index--resident-stops-acs--all-stops-dec | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--resident-stops-acs--all-stops-dec.json |
| disparity-index | disparity-index--resident-stops-acs--resident-stops-dec | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--resident-stops-acs--resident-stops-dec.json |
| disparity-index | disparity-index--resident-stops-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--resident-stops-acs.json |
| disparity-index | disparity-index--resident-stops-dec | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--resident-stops-dec.json |
| disparity-index | disparity-index--resident-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--resident-stops.json |
| disparity-index | disparity-index--stops--all-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--stops--all-stops.json |
| disparity-index | disparity-index--stops--resident-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/disparity-index--stops--resident-stops.json |
| driver-age | driver-age--17-and-under | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--17-and-under.json |
| driver-age | driver-age--18-29 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--18-29.json |
| driver-age | driver-age--30-39 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--30-39.json |
| driver-age | driver-age--40-64 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--40-64.json |
| driver-age | driver-age--40-and-over | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--40-and-over.json |
| driver-age | driver-age--65-and-over | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-age--65-and-over.json |
| driver-gender | driver-gender--female | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-gender--female.json |
| driver-gender | driver-gender--male | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/driver-gender--male.json |
| equipment-stop-rate | equipment-stop-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/equipment-stop-rate.json |
| license-stop-rate | license-stop-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/license-stop-rate.json |
| location-of-stop | location-of-stop--city-street | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--city-street.json |
| location-of-stop | location-of-stop--county-road | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--county-road.json |
| location-of-stop | location-of-stop--interstate-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--interstate-hwy.json |
| location-of-stop | location-of-stop--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--other.json |
| location-of-stop | location-of-stop--state-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--state-hwy.json |
| location-of-stop | location-of-stop--us-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/location-of-stop--us-hwy.json |
| male-driver-rate | male-driver-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/male-driver-rate.json |
| moving-stop-rate | moving-stop-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/moving-stop-rate.json |
| non-resident-stops | non-resident-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/non-resident-stops.json |
| officer-assignment | officer-assignment--dedicated-traffic | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/officer-assignment--dedicated-traffic.json |
| officer-assignment | officer-assignment--general-patrol | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/officer-assignment--general-patrol.json |
| officer-assignment | officer-assignment--special-assignment | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/officer-assignment--special-assignment.json |
| pre2020-disparity-index-2010 | pre2020-disparity-index-2010 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-disparity-index-2010.json |
| pre2020-disparity-index-acs | pre2020-disparity-index-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-disparity-index-acs.json |
| pre2020-disparity-index | pre2020-disparity-index | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-disparity-index.json |
| pre2020-local-population-pct-2010 | pre2020-local-population-pct-2010 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-local-population-pct-2010.json |
| pre2020-local-population-pct-acs | pre2020-local-population-pct-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-local-population-pct-acs.json |
| pre2020-local-population-pct | pre2020-local-population-pct | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-local-population-pct.json |
| pre2020-statewide-population-pct | pre2020-statewide-population-pct | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/pre2020-statewide-population-pct.json |
| probable-cause | probable-cause--consent | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--consent.json |
| probable-cause | probable-cause--drug-alcohol-odor | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--drug-alcohol-odor.json |
| probable-cause | probable-cause--drug-dog-alert | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--drug-dog-alert.json |
| probable-cause | probable-cause--incident-to-arrest | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--incident-to-arrest.json |
| probable-cause | probable-cause--inventory | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--inventory.json |
| probable-cause | probable-cause--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--other.json |
| probable-cause | probable-cause--plain-view-contra | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--plain-view-contra.json |
| probable-cause | probable-cause--reas-susp-weapon | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/probable-cause--reas-susp-weapon.json |
| rates-population-2019 | rates-population-2019 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2019.json |
| rates-population-2020-acs | rates-population-2020-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2020-acs.json |
| rates-population-2020-decennial | rates-population-2020-decennial | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2020-decennial.json |
| rates-population-2021-acs | rates-population-2021-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2021-acs.json |
| rates-population-2022-acs | rates-population-2022-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2022-acs.json |
| rates-population-2023-acs | rates-population-2023-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-2023-acs.json |
| rates-population-pct-2019 | rates-population-pct-2019 | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2019.json |
| rates-population-pct-2020-acs | rates-population-pct-2020-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2020-acs.json |
| rates-population-pct-2020-decennial | rates-population-pct-2020-decennial | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2020-decennial.json |
| rates-population-pct-2021-acs | rates-population-pct-2021-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2021-acs.json |
| rates-population-pct-2022-acs | rates-population-pct-2022-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2022-acs.json |
| rates-population-pct-2023-acs | rates-population-pct-2023-acs | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/rates-population-pct-2023-acs.json |
| reason-for-stop | reason-for-stop--called-for-service | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--called-for-service.json |
| reason-for-stop | reason-for-stop--det-crime-bulletin | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--det-crime-bulletin.json |
| reason-for-stop | reason-for-stop--equipment | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--equipment.json |
| reason-for-stop | reason-for-stop--investigative | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--investigative.json |
| reason-for-stop | reason-for-stop--license | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--license.json |
| reason-for-stop | reason-for-stop--moving | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--moving.json |
| reason-for-stop | reason-for-stop--officer-initiative | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--officer-initiative.json |
| reason-for-stop | reason-for-stop--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/reason-for-stop--other.json |
| resident-stop-rate | resident-stop-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/resident-stop-rate.json |
| resident-stops | resident-stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/resident-stops.json |
| search-duration | search-duration--0-15-minutes | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-duration--0-15-minutes.json |
| search-duration | search-duration--16-30-minutes | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-duration--16-30-minutes.json |
| search-duration | search-duration--31-minutes | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-duration--31-minutes.json |
| search-rate | search-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-rate.json |
| search-stats | search-stats--arrest-charge--charge-warrant | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--charge-warrant.json |
| search-stats | search-stats--arrest-charge--drug-violation | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--drug-violation.json |
| search-stats | search-stats--arrest-charge--dwi-bac | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--dwi-bac.json |
| search-stats | search-stats--arrest-charge--offense-against | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--offense-against.json |
| search-stats | search-stats--arrest-charge--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--other.json |
| search-stats | search-stats--arrest-charge--outstanding-warrant | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--outstanding-warrant.json |
| search-stats | search-stats--arrest-charge--person | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--person.json |
| search-stats | search-stats--arrest-charge--property-offense | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--property-offense.json |
| search-stats | search-stats--arrest-charge--resist-arrest | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/search-stats--arrest-charge--resist-arrest.json |
| searches | searches | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/searches.json |
| stop-outcome | stop-outcome--contraband | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-outcome--contraband.json |
| stop-outcome | stop-outcome--no-action | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-outcome--no-action.json |
| stop-outcome | stop-outcome--warning | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-outcome--warning.json |
| stop-rate-residents | stop-rate-residents--arrest-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate-residents--arrest-rate.json |
| stop-rate-residents | stop-rate-residents--citation-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate-residents--citation-rate.json |
| stop-rate-residents | stop-rate-residents--contraband-hit-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate-residents--contraband-hit-rate.json |
| stop-rate-residents | stop-rate-residents--search-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate-residents--search-rate.json |
| stop-rate-residents | stop-rate-residents | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate-residents.json |
| stop-rate | stop-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stop-rate.json |
| stops | stops | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/stops.json |
| vehicle-stop-stats | vehicle-stop-stats--equipment | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--equipment.json |
| vehicle-stop-stats | vehicle-stop-stats--investigative | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--investigative.json |
| vehicle-stop-stats | vehicle-stop-stats--license | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--license.json |
| vehicle-stop-stats | vehicle-stop-stats--location-of-stop--ci-ty-street | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--location-of-stop--ci-ty-street.json |
| vehicle-stop-stats | vehicle-stop-stats--location-of-stop--co-unty-road | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--location-of-stop--co-unty-road.json |
| vehicle-stop-stats | vehicle-stop-stats--location-of-stop--oth-er | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--location-of-stop--oth-er.json |
| vehicle-stop-stats | vehicle-stop-stats--reas-on-moving | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--reas-on-moving.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--ci-tation | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--ci-tation.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--city-street | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--city-street.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--county-road | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--county-road.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--of-stop-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--of-stop-hwy.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--other | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--other.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--state-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--state-hwy.json |
| vehicle-stop-stats | vehicle-stop-stats--stop-outcome--us-hwy | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/vehicle-stop-stats--stop-outcome--us-hwy.json |
| warning-rate | warning-rate | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/warning-rate.json |
| what-searched | what-searched--car-property | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/what-searched--car-property.json |
| what-searched | what-searched--driver-property | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/what-searched--driver-property.json |
| what-searched | what-searched--driver | https://data.vsr.recoveredfactory.net/releases/v2/dist/metric_year/what-searched--driver.json |
<!-- METRIC_KEYS_END -->
