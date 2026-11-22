# Taste, scored.
The live link: https://xiqixu.github.io/Taste-Scored/
The presentation link: https://xiqixu.github.io/Taste-Scored/presentation-2026-11-22/

Run `python3 -m http.server 8000` from this folder and open
[Act 3 in the local preview](http://localhost:8000/#act3-production).
The data and basemap are local. The page loads D3 and fonts from their CDNs.

## Original cupping data

The original site credits the Coffee Quality Institute database, accessed
through [Fatih Boyar’s May 2023 scrape](https://github.com/fatih-boyar/coffee-quality-data-CQI).
The figures and the taste-print use the same [207 prepared Arabica lots](data/cqi-2023.json),
including the recorded variety, processing group, altitude and sensory scores.

In Act 5, the selected lot shows its highest cupping marks. The written
tasting notes refer to a named coffee from the same origin, sourced from
Firstbloom Data, [Fujin Coffee](https://www.fujincoffee.com.tw/products/f20250701104),
or [Là Việt Coffee](https://laviet.coffee/san-pham/da-lat-serie-2-datanla/).
The public CQI snapshot supplies numerical scores.

## Espresso opening

The opening uses three live-action clips under the
[Mixkit Stock Video Free License](https://mixkit.co/license/#videoFree).

- [Tamping coffee for a coffee maker](https://mixkit.co/free-stock-video/tamping-coffee-for-a-coffee-maker-3572/) shows the pressed puck from above.
- [Person working with the machines in a cafeteria](https://mixkit.co/free-stock-video/person-working-with-the-machines-in-a-cafeteria-41228/) follows the portafilter as it is raised and locked.
- [Coffee maker making coffee](https://mixkit.co/free-stock-video/coffee-maker-making-coffee-3578/) supplies the extraction. The edit ends when espresso starts to flow. A timed transition follows the stream into the title.

The locally edited, silent MP4 plays automatically on the opening page, with separate framing for wide and tall viewports. Readers can skip the intro. Section links and reduced-motion settings open the story directly.

## Generated illustration

Act 4 uses an illustration made with the built-in OpenAI ImageGen tool.

<details>
<summary>Asset and generation prompt</summary>

- [Arabica branch](assets/scene/arabica-branch.webp). Use case: scientific-educational botanical editorial illustration for an interactive coffee data story. Paint a single recognizable Coffea arabica branch with paired pointed glossy green leaves, visible slender woody stem and two small axillary clusters of ripe dark red coffee cherries. The branch enters at the upper right and bends diagonally down to the left toward mid-height, with a clearly exposed stem junction near the middle at about 55% across and 42% down; reserve a small gap immediately below this short stem so an animated cherry can be composited there. Place the existing red cherries off to the sides, leaving the bottom third of the frame open for that cherry to drop. Authentic leaf veins and subtle stippling in a restrained vintage botanical field-guide gouache and colored-pencil style, deep olive foliage, muted red cherries, clean silhouette, natural botanical shapes. Wide landscape framing, entire leaves readable at mobile size, object isolated on genuine alpha transparency. Transparent background, no paper texture behind the branch, no border, no background, no text or labels, no hands.

</details>

## Green coffee production, 1961–2024

[`data/coffee-production.csv`](data/coffee-production.csv) contains
5,127 annual observations covering 85 reporting areas. The
symbols use the tonnage from [FAOSTAT QCL](https://www.fao.org/faostat/en/#data/QCL)
([normalized bulk download](https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data_%28Normalized%29.zip)),
filtered to Coffee, green (item 656) and Production (element 5510), in tonnes.
The `faostat_area_code` and `faostat_flag` columns preserve the source identifiers
and observation flags.

The names, three-letter codes and comparison values come from the
[Our World in Data series](https://ourworldindata.org/grapher/coffee-bean-production)
([CSV download](https://ourworldindata.org/grapher/coffee-bean-production.csv)).
OWID also sources this series from FAOSTAT. The two downloads were compared
on 19 November 2026. Differences are limited to reporting precision.

The map excludes world, regional and other aggregates. It includes Ethiopia's
former reporting area through 1992, placed at the modern Ethiopia symbol's
position. Missing and zero values have no bubble. The U.S. symbol is
positioned over Hawaiʻi. All years use the same area scale.

The producer map zooms from the world to continents and country outlines.
Country labels, groupings and supplementary island outlines come from
Natural Earth's 1:50m country and map-unit data. Small hollow locator rings
help identify low-volume producers. Bubble areas share a tonnage scale in
world and continental views.

Country close-ups show annual national production and an example coffee
profile where one is available. [`data/producer-profiles.json`](data/producer-profiles.json)
joins single-origin releases to their regions, named varieties and roaster
tasting notes from [Firstbloom Data](https://github.com/alexcaza/firstbloom-data/tree/a6cb0026d1af9642724793c799bbc48dc189ba35)
by Alex Caza ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
Firstbloom entries retain the release ID for verification. Two profiles use
the project's CQI sample data for origin and variety. The sample fields are
independent of the year selected for national production.

The 78 mapped entries for 2024 sum to 11,133,143.04 t. FAOSTAT publishes a separate world
total of 11,284,877.41 t, which is the denominator for the Brazil and Vietnam
comparison in the story.

## Green coffee trade, 1995–2024

[`data/coffee-trade.json`](data/coffee-trade.json) contains 106,684 annual
exporter–importer tonnage records across 230 reporting areas. It combines
HS 090111 (unroasted, non-decaffeinated coffee) and 090112 (unroasted,
decaffeinated coffee) from CEPII BACI HS92 v202601, which reconciles UN
Comtrade declarations. The world view and the area filters each show up
to eight routes, ranked by mapped tonnage. Arrow widths share one scale
across years. Curves connect reporting-area label points. Re-exports can
appear on multiple routes.

The [coffee extract](https://github.com/warrenrross/World_Coffee_Trade_EDA/blob/00ca7e2502f04a0289da5441673b733599ab4c4e/data/coffee_bilateral_trade_BACI.csv)
was checked against the complete 1995 and 2024 coffee records in the
[official BACI archive](https://www.cepii.fr/DATA_DOWNLOAD/baci/data/BACI_HS92_V202601.zip).
We used the archive's numerical reporting-area IDs and Natural Earth's
1:50m country and map-unit label locations. Flows with absent or zero tonnage,
and flows involving the unmapped groupings Other Asia, nes, U.S. Miscellaneous
Pacific Islands, or the former Southern African Customs Union, are omitted.

Source: Gaulier, G. and Zignago, S. (2010), *BACI: International Trade
Database at the Product-Level*, CEPII Working Paper 2010-23. Data release
v202601 under Etalab Open Licence 2.0.
