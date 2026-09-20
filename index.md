---
layout: home
title: null
quest: true
---

<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow">Big Data Institute · Department of Statistics · Oxford</div>
      <h1 class="mega">Duncan Palmer</h1>
      <p class="lede">
        Senior Research Fellow in statistical genetics. I co-lead the
        <a class="link" href="{{ site.links.brava }}" target="_blank" rel="noopener">Biobank Rare-Variant Consortium</a>
        and build methods for rare variation at biobank scale.
      </p>
      <div class="cta-row">
        <a class="btn btn--solid" href="#play">▶ Play</a>
        <a class="btn" href="{{ '/research/' | relative_url }}">Research</a>
        <a class="btn" href="{{ '/publications/' | relative_url }}">Publications</a>
        <a class="btn" href="mailto:{{ site.email }}">Email</a>
      </div>
    </div>
    <div class="portrait">
      <img src="{{ '/assets/me.jpg' | relative_url }}" alt="Duncan Palmer">
    </div>
  </div>
</section>

<section id="play" style="padding-top:2.5rem;">
  <div class="wrap">
    <p class="prose reveal" style="margin-bottom:1.2rem;">
      Run around, walk up to a building, read the sign. Eight facts, three people to annoy, six
      reviewers. Press F to rebut, Space to jump over them. Don't stay too long.
    </p>

    <div class="quest" id="quest">
      <div class="q-view"></div>

      <div class="q-hud">
        <span class="q-pill">FACTS <span data-hud="found">0</span>/<span data-hud="total">8</span> · REVISIONS <span data-hud="revisions">0</span> · ACCEPTED <span data-hud="accepted">0</span><span class="q-hits" hidden> · <span data-hud="hits">♥♥♥♥♥</span></span></span>
        <span class="q-pill q-keys">WASD MOVE · SPACE JUMP · F TALK / REBUT · DRAG ORBIT</span>
        <button type="button" class="q-pill q-music" data-music aria-pressed="false">♫ OFF</button>
      </div>

      <div class="q-start" role="button" tabindex="0" aria-label="Start the game">
        <div>
          <div class="q-logo">PALMER’S<br>PROGRESS</div>
          <div class="q-sub">A 64-BIT* ADVENTURE IN STATISTICAL GENETICS<br>*BITS APPROXIMATE · 🔊 SOUND ON</div>
          <div class="q-press">▶ PRESS START</div>
        </div>
      </div>

      <div class="q-prompt" hidden>F</div>
      <div class="q-cross" hidden aria-hidden="true"></div>
      <div class="q-hurt" hidden aria-hidden="true"></div>
      <div class="q-over" hidden role="alert">
        <div class="q-over__word">REJECTED!</div>
        <div class="q-over__sub">TOO MANY REVISIONS · PRESS START TO RESUBMIT</div>
      </div>
      <div class="q-toast" hidden></div>

      <div class="q-dialog" hidden>
        <p class="q-dialog__title"></p>
        <p class="q-dialog__body"></p>
        <a class="q-dialog__link" href="#" hidden></a>
        <span class="q-dialog__hint"></span>
      </div>

      <div class="q-pad" aria-label="Move">
        <button type="button" data-pad="up" aria-label="Up">▲</button>
        <button type="button" data-pad="left" aria-label="Left">◀</button>
        <button type="button" data-pad="right" aria-label="Right">▶</button>
        <button type="button" data-pad="down" aria-label="Down">▼</button>
      </div>
      <button type="button" class="q-act" data-pad="act" aria-label="Interact">A</button>
      <button type="button" class="q-act q-act--b" data-pad="jump" aria-label="Jump">B</button>
    </div>

    <div class="q-caption reveal">
      <span class="q-kbd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to run · <kbd>Space</kbd> to jump · <kbd>F</kbd> to talk or rebut · drag or <kbd>Q</kbd>/<kbd>E</kbd> to orbit · scroll to zoom</span>
      <span class="q-touch">D-pad to run · <kbd>A</kbd> to talk · <kbd>B</kbd> to jump · drag to orbit</span>
      <span><a class="link" href="#boring">Skip to the boring version ↓</a> · <a class="link" href="#play" data-quest-reset>Reset progress</a></span>
    </div>
  </div>
</section>


<section id="boring">
  <div class="wrap">
    <div class="section-head reveal">
      <span class="num">01</span><h2>About</h2><span class="rule"></span>
    </div>
    <div class="prose reveal">
      <p>
        I develop statistical and computational methods to understand disease mechanisms, combining
        genetic, phenotypic and functional data across very large, globally distributed cohorts, with
        a particular interest in the rare end of the allele frequency spectrum.
      </p>
      <p>
        SMARTbiomed Senior Research Fellow at the Big Data Institute and Department of Statistics,
        Oxford, where I co-lead the (gen)omics theme. Previously a postdoc with Ben Neale, Nick
        Patterson and Cecilia Lindgren at MGH, the Broad Institute and Oxford. DPhil in Statistics at
        Oxford with Dame Angela McLean and Gil McVean. Master's in Mathematics and Statistics at Warwick.
      </p>
    </div>
  </div>
</section>

<section>
  <div class="wrap">
    <div class="section-head reveal">
      <span class="num">02</span><h2>Selected work</h2><span class="rule"></span>
    </div>
    <ul class="pubs reveal">
      <li class="pub">
        <div class="yr">2026</div>
        <div>
          <p class="ttl"><a href="https://www.medrxiv.org/content/10.64898/2026.05.21.26353759v1" target="_blank" rel="noopener">The Biobank Rare Variant consortium powers the discovery of rare genetic associations through global collaboration</a></p>
          <p class="au"><em>Palmer DS</em>, Hill B, Hodgson S, Jäeloo M, Kalantzis G, Kousathanas A, <em>et al.</em>, Neale BM</p>
          <span class="ven">medRxiv</span><span class="badge">Preprint</span>
        </div>
      </li>
      <li class="pub">
        <div class="yr">2023</div>
        <div>
          <p class="ttl"><a href="https://doi.org/10.1126/science.abn8455" target="_blank" rel="noopener">Analysis of genetic dominance in the UK Biobank</a></p>
          <p class="au"><em>Palmer DS</em>, Zhou W, Abbott L, Wigdor EM, Baya N, Churchhouse C, <em>et al.</em></p>
          <span class="ven">Science 379:1341–1348</span>
        </div>
      </li>
      <li class="pub">
        <div class="yr">2022</div>
        <div>
          <p class="ttl"><a href="https://doi.org/10.1038/s41588-022-01034-x" target="_blank" rel="noopener">Exome sequencing in bipolar disorder identifies <em>AKAP11</em> as a risk gene shared with schizophrenia</a></p>
          <p class="au"><em>Palmer DS</em>, Howrigan DP, Chapman SB, Adolfsson R, Bass N, <em>et al.</em></p>
          <span class="ven">Nature Genetics 54:541–547</span>
        </div>
      </li>
      <li class="pub">
        <div class="yr">2019</div>
        <div>
          <p class="ttl"><a href="https://doi.org/10.1038/s41467-019-10724-w" target="_blank" rel="noopener">Mapping the drivers of within-host pathogen evolution using massive data sets</a></p>
          <p class="au"><em>Palmer DS</em>, Turner I, Fidler S, Frater J, Goedhals D, Goulder P, <em>et al.</em>, McLean AR, McVean G</p>
          <span class="ven">Nature Communications 10:3017</span>
        </div>
      </li>
    </ul>
    <div class="cta-row reveal">
      <a class="btn btn--solid" href="{{ '/publications/' | relative_url }}">All publications →</a>
      <a class="btn" href="{{ site.links.scholar }}" target="_blank" rel="noopener">Google Scholar</a>
    </div>
  </div>
</section>
