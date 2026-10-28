---
title: V-Dem (Varieties of Democracy)
category: Measuring democracy
url: https://www.v-dem.net/data/the-v-dem-dataset/
version: v16 (2026)
poland_coverage: 1789–2025
status: in-use
owner: unassigned
---
**What it measures:** Hundreds of indicators from country-expert ratings, aggregated into electoral, liberal, participatory, deliberative and egalitarian democracy indices (0–1).

**Who judges:** Thousands of country experts, combined with a Bayesian measurement model. Each estimate comes with **uncertainty intervals** (`_codelow` / `_codehigh` columns). The brief explicitly asks us not to drop these.

**Caveats:** It's expert judgement, not observation. The codebook is long and worth reading before we lean on any sub-index.

**In repo:** `data/vdem_ldi_comparison.csv`, `data/vdem_poland_components.csv` (central estimates, via Our World in Data). Next step: pull intervals from the CY-Core file.
