---
layout: page
title: Research
permalink: /research/
eyebrow: What I work on
subtitle: Rare variation, non-additivity, and the statistics of very large biobanks.
---

<div class="prose reveal">
  <p>
    My work sits at the point where statistical genetics stops being a clean estimation problem and
    starts being an engineering one. The questions are simple to state and awkward to answer: which
    genes carry rare variation that changes disease risk, how much of the genome acts in ways that
    are not simply additive, and how do we combine evidence across biobanks that were never designed
    to be combined?
  </p>
</div>

<div class="cards" style="margin-top:2.5rem;">

  <article class="card reveal">
    <div class="tag">01 · Consortium</div>
    <h3>The Biobank Rare-Variant Consortium</h3>
    <p>
      BRaVa is a global federated effort to analyse rare coding variation at scale. Sixteen biobanks
      and cohorts to date contribute association results under a shared protocol: harmonised phenotype
      definitions, a common variant annotation pipeline, and gene-based tests that can be meta-analysed
      without moving individual-level data across borders.
    </p>
    <p>
      The first flagship analysis spans over 1.2 million sequenced individuals across ten biobanks and
      diverse ancestries, covering 33 clinical endpoints and 11 quantitative traits. Around a third of
      the gene-level associations it recovers are invisible in any single contributing biobank, which is
      the entire argument for doing this the hard way.
    </p>
    <a class="link" href="{{ site.links.brava }}" target="_blank" rel="noopener">brava-genetics.github.io →</a>
  </article>

  <article class="card reveal">
    <div class="tag">02 · Method</div>
    <h3>Life beyond the additive model</h3>
    <p>
      Almost all of human complex trait genetics assumes additivity because it is convenient. I have
      spent a good deal of time asking what that assumption costs. That includes a genome-wide scan
      for dominance effects in the UK Biobank, exome-wide evidence for compound heterozygous effects,
      recessive meta-analysis across six global biobanks, and rare-variant-driven deviations from
      additivity at biobank scale.
    </p>
    <p>
      A related thread: individuals whose measured phenotype sits far from their polygenic expectation
      turn out to be enriched for rare damaging variants in genes that cause rare disease. Residuals
      are not noise, they are a screen.
    </p>
  </article>

  <article class="card reveal">
    <div class="tag">03 · Disease</div>
    <h3>Psychiatric, reproductive and metabolic traits</h3>
    <p>
      Exome sequencing across nearly 14,000 people with bipolar disorder implicated <em>AKAP11</em>,
      a gene shared with schizophrenia whose protein interacts with GSK3B, the presumed target of
      lithium. Alongside that, work on schizophrenia and autism gene discovery, a genome-wide study of
      infertility and reproductive hormones, and the genetic architecture of how adiposity changes
      across adulthood in electronic health records.
    </p>
  </article>

  <article class="card reveal">
    <div class="tag">04 · Phenome</div>
    <h3>Phenotypes are the bottleneck</h3>
    <p>
      Genotypes are cheap and standardised. Phenotypes are neither. I work on principled distillation
      of high-dimensional biobank phenotype data into interpretable structure, on curating phenotype
      definitions that mean the same thing in Helsinki and Osaka and Boston, and on the unglamorous
      machinery that makes cross-biobank comparison honest.
    </p>
  </article>

  <article class="card reveal">
    <div class="tag">05 · Origins</div>
    <h3>Pathogen evolution</h3>
    <p>
      My DPhil work built Bayesian models of HIV-1 evolution within and between hosts, using
      genealogical and dynamical modelling to infer rates of immune escape and reversion, and scaling
      those inferences to very large sequence databases while controlling for population structure and
      recombination. The statistical instincts carried over intact.
    </p>
    <a class="link" href="https://doi.org/10.1038/s41467-019-10724-w" target="_blank" rel="noopener">Nature Communications, 2019 →</a>
  </article>

  <article class="card reveal">
    <div class="tag">06 · Where</div>
    <h3>Oxford</h3>
    <p>
      I am a SMARTbiomed Senior Research Fellow, jointly based at the
      <a class="link" href="{{ site.links.bdi }}" target="_blank" rel="noopener">Big Data Institute</a> and the
      <a class="link" href="{{ site.links.oxford }}" target="_blank" rel="noopener">Department of Statistics</a>,
      where I also co-lead the (gen)omics theme.
      <a class="link" href="{{ site.links.smart }}" target="_blank" rel="noopener">SMARTbiomed</a> is a
      Novo Nordisk Foundation funded centre for biomedical data science.
    </p>
    <p>Always happy to hear from prospective students, postdocs and collaborators.</p>
    <a class="link" href="mailto:{{ site.email }}">{{ site.email }} →</a>
  </article>

</div>
