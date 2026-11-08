# Norm audit

**Date:** 2026-11-08 · **Roadmap:** `docs/CRITIQUE_AND_ROADMAP_2026-10.md`, Phase 1 item 11 and §2 (norm hygiene)
**Code:** `src/data/normSources.js` (provenance per analysis), `src/data/norms.js` (`isApproximateSd`, `sdStatus`)

## What this audit did and didn't do

- **Done:** every analysis that ships a norm (in `Data/AnalysisMeasurements.csv` and the presets in `norms.js`) now has a provenance entry. Each entry gives the source, the population where known, and whether that source published standard deviations. PMIDs and DOIs were added only where PubMed confirmed them.
- **Not done:** no norm value was checked row by row against a paper's table, because that needs the papers, as the airway work did. "Published" below means only that the source reports SDs, **not** that the app's numbers match it.
- **Not done:** no non-Caucasian norm set was added. The candidate papers are listed below; their values need the full text.

## What changes in the app

The interpretation, normogram and report already flagged Steiner's and Tweed's SDs as approximate. That flag now covers every norm whose SD isn't from a source known to publish one:

| SD status | Meaning | Tag | Norm rows |
|---|---|---|---|
| `published` | The cited source reports means with SDs | none | 46 |
| `approximate` | The source gave means or ranges only, or the row copies Steiner's conventional ±2° | **SD approx.** | 53 |
| `unsourced` | No primary source with SDs has been traced | **SD unsourced** | 154 |

That's 253 norm rows in all. Flagged rows still get a z-score and colour, but the grade reads as indicative. Norm presets you create yourself are never flagged.

## By analysis

| Analysis | Source | PubMed | SD status | Notes |
|---|---|---|---|---|
| Downs | Downs 1948, Am J Orthod 34:812 | [18882558](https://doi.org/10.1016/0002-9416(48)90015-3) | published | 20 adolescents (12–17 y), excellent occlusion |
| McNamara | McNamara 1984, Am J Orthod 86:449 | [6594933](https://doi.org/10.1016/s0002-9416(84)90352-x) | published | Lengths are size- and sex-dependent |
| Wits | Jacobson 1975, Am J Orthod 67:125 | [1054214](https://doi.org/10.1016/0002-9416(75)90065-2) | published | Women 0 mm, men 1 mm (abstract). The app has one 0 ± 2 row: **check the SD and split by sex** |
| Legan & Burstone | Legan & Burstone 1980, J Oral Surg 38:744 | 6932485 | published | |
| COGS | Burstone et al. 1978, J Oral Surg 36:269 | 273073 | published | Sex-specific in the source; the app has one set |
| Arnett | Arnett et al. 1999, AJODO 116:239 | 10474095 | published | Sex-specific in the source; the app has one set |
| Moorrees mesh | Moorrees et al. 1976, Am J Orthod 69:57 | [1061501](https://doi.org/10.1016/0002-9416(76)90098-1) | published | Age- and sex-specific in the source |
| Kim (ODI, APDI, CF) | Kim 1974; Kim & Vietas 1978 | [4524490](https://doi.org/10.1016/0002-9416(74)90255-3), [276266](https://doi.org/10.1016/0002-9416(78)90223-3) | published | **APDI 81.4° ± 3.79** (n = 102, abstract). Norms stay withheld until the composite indicators are implemented |
| Steiner, General Ceph | Steiner 1953 | not indexed | approximate | Means only |
| Tweed | Tweed 1954 | not indexed | approximate | Target values |
| Holdaway | Holdaway 1983, Am J Orthod 84:1 | [6575614](https://doi.org/10.1016/0002-9416(83)90144-6) | approximate | Ideal values and ranges |
| Merrifield Z-angle | Merrifield 1966, Am J Orthod 52:804 | [5223046](https://doi.org/10.1016/0002-9416(66)90250-8) | approximate | Ideal value with a range |
| Ricketts, Ricketts PA | Ricketts 1960; Ricketts et al. 1982 | not indexed | unsourced | The "clinical deviations" come from later work and haven't been traced |
| Björk, Jarabak (Jarv-Bjork) | Björk 1947; Jarabak & Fizzell 1972 | not indexed | unsourced | Björk's tables have SDs, but the app's values aren't traced to them |
| Grummons (both) | Grummons 1987, J Clin Orthod 21:448 | 3476493 | unsourced | Construction only |
| Di Paolo quadrilateral | Di Paolo et al. 1983, Am J Orthod 83:19 | [6571768](https://doi.org/10.1016/0002-9416(83)90267-1) | unsourced | Individualized ratios, not population norms |
| Grayson multiplane | Grayson et al. 1983, Am J Orthod 84:217 | [6577794](https://doi.org/10.1016/0002-9416(83)90129-x) | unsourced | |
| Sassouni | Sassouni 1969, Am J Orthod 55:109 | [5249177](https://doi.org/10.1016/0002-9416(69)90122-5) | unsourced | A classification |
| Hand-wrist | Fishman 1982, Angle Orthod 52:88 | [6980608](https://doi.org/10.1043/0003-3219(1982)052<0088:REOSM>2.0.CO;2) | unsourced | |
| Harvold, Riedel, Wylie, Coben, Eastman, Delaire, Svanholt-Solow, Epker, Farkas, Hasund, Schwarz, Gugino, CVM, ABO DI | Books or unindexed journals | not verified | unsourced | Citations in `normSources.js` are unverified |
| Bimler, Lautrou, Tollaro, Cagliari, Chieti, McGann, Basis, Van Arsdale, Hewitt, General PA/SMV/OPG, photo analyses | **No source known** | — | unsourced | Values of unknown origin; the first to replace or withdraw |

Steiner, Tweed, Ricketts and Björk-Jarabak predate reliable PubMed indexing, so their DOIs weren't verified. "Not indexed" doesn't mean the citation is wrong.

## Findings that need a decision

1. **Values of unknown origin.** Bimler, Lautrou, Tollaro, Cagliari, Chieti, McGann, Basis and Van Arsdale ship 67 norm rows with no known source; most have integer SDs. I'd keep the measurements and withdraw these norms until a source is found.
2. **Sex- and age-specific tables collapsed into one set.** COGS, Arnett, Moorrees and Wits publish separate values. The app shows one set, so a woman is compared against a pooled or male value. These need the papers' tables.
3. **APDI and ODI.** The sourced values exist (APDI 81.4° ± 3.79; Obamiyi et al. 2019 give African-American children ODI 70.9° and APDI 78.1°), but the app measures only one of each indicator's angles. Implementing the composites would let these norms return.

## Population norm sets: papers to supply

None of these were added; adding them needs each paper's tables. Each entry was found and checked on PubMed. As with the airway work, place the PDFs in `Research papers/Norms/` and I'll read the tables from them.

| Population | Paper | DOI | Covers |
|---|---|---|---|
| Egyptian adolescents | Bishara, Abdalla & Hoppens 1990, AJODO 97:413 | [10.1016/0889-5406(90)70113-Q](https://doi.org/10.1016/0889-5406(90)70113-Q) | 35 parameters, 39 boys / 51 girls, 12.5 y |
| Egyptian | Loutfy, Ponitz & Harris 1971, Egypt Dent J 17:91 (PMID 5281924) | — | Standards for the "normal Egyptian face" |
| Saudi adults | Shalhoub, Sarhan & Shaikh 1987, Br J Orthod 14:273 | [10.1179/bjo.14.4.273](https://doi.org/10.1179/bjo.14.4.273) | 24 men / 24 women |
| Saudi adults (Najran) | Ahmed 2022, Bioinformation 18:1173 | [10.6026/973206300181173](https://doi.org/10.6026/973206300181173) | Eastman measures, 30 / 30 |
| Omani adults (Arab) | Govinakovi et al. 2018, SQUMJ 18:e182 | [10.18295/squmj.2018.18.02.010](https://doi.org/10.18295/squmj.2018.18.02.010) | n = 150, 20–29 y |
| Libyan adults | Elkaseh et al. 2021, Asian J Surg 45:1089 | [10.1016/j.asjsur.2021.08.050](https://doi.org/10.1016/j.asjsur.2021.08.050) | 92 parameters, n = 100 |
| Palestinian (soft tissue) | Hussein et al. 2011, Saudi Dent J 23:191 | [10.1016/j.sdentj.2011.08.003](https://doi.org/10.1016/j.sdentj.2011.08.003) | Holdaway, n = 93 |
| Iranian children | Hajighadimi et al. 1981, Am J Orthod 79:192 | [10.1016/0002-9416(81)90317-1](https://doi.org/10.1016/0002-9416(81)90317-1) | Tweed and Steiner, n = 67 |
| Japanese | Miura, Inoue & Suzuki 1965, Am J Orthod 51:288 | [10.1016/0002-9416(65)90103-x](https://doi.org/10.1016/0002-9416(65)90103-x) | Steiner analysis |
| Southern Chinese | Cooke & Wei 1989, Angle Orthod 59:131 | [10.1043/0003-3219(1989)059<0131:ACSOSC>2.0.CO;2](https://doi.org/10.1043/0003-3219(1989)059<0131:ACSOSC>2.0.CO;2) | 12-year-old boys |
| Chinese adults (soft tissue) | Lew et al. 1992, J Oral Maxillofac Surg 50:1184 | [10.1016/0278-2391(92)90151-o](https://doi.org/10.1016/0278-2391(92)90151-o) | Legan & Burstone, Holdaway |
| North Indian | Garg & Alexander 2015, J Maxillofac Oral Surg 14:271 | [10.1007/s12663-014-0636-6](https://doi.org/10.1007/s12663-014-0636-6) | COGS + Legan & Burstone, 50 / 50 |
| North Indian (soft tissue) | Sachan et al. 2012, J Orthod Sci 1:92 | [10.4103/2278-0203.105877](https://doi.org/10.4103/2278-0203.105877) | 30 / 30 |
| African American | Flynn et al. 1989, J Oral Maxillofac Surg 47:30 | [10.1016/0278-2391(89)90120-1](https://doi.org/10.1016/0278-2391(89)90120-1) | COGS, n = 33 |
| African American and white children | Huang et al. 1998, Angle Orthod 68:503 | [10.1043/0003-3219(1998)068<0503:DCNFCA>2.3.CO;2](https://doi.org/10.1043/0003-3219(1998)068<0503:DCNFCA>2.3.CO;2) | By age and sex, 6–18 y |
| African American children | Obamiyi et al. 2019, Angle Orthod 89:897 | [10.2319/021619-116.1](https://doi.org/10.2319/021619-116.1) | ODI, APDI |

No Korean or Nigerian set turned up in this search. Korean norms are mostly in the Korean Journal of Orthodontics, which needs a separate search.

## Rules for adding a norm (same as the airway module)

- Cite the paper, table and page; the PMID/DOI goes in `normSources.js`.
- Record the population, n, age range and sex. Keep sex- or age-specific values separate; don't pool them.
- Only use the paper's own construction. If the app's measure differs, don't attach the norm.
- Set `sd: "published"` only when the SDs come from that paper.
