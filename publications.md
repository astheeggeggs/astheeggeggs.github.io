---
layout: page
title: Publications
permalink: /publications/
eyebrow: Selected bibliography
subtitle: A filtered view. Google Scholar has the exhaustive, less flattering version.
---

<div class="prose reveal" style="margin-bottom:2rem;">
  <p>
    Names in white are mine. Filter by theme below, or go straight to
    <a href="{{ site.links.scholar }}" target="_blank" rel="noopener">Google Scholar</a>
    for the full list, citation counts and everything I have quietly forgotten about.
  </p>
</div>

<div class="filters reveal">
  <button data-filter="all" aria-pressed="true">All</button>
  <button data-filter="lead" aria-pressed="false">First / senior author</button>
  <button data-filter="rare" aria-pressed="false">Rare variants &amp; biobanks</button>
  <button data-filter="methods" aria-pressed="false">Methods</button>
  <button data-filter="psych" aria-pressed="false">Psychiatric genetics</button>
  <button data-filter="repro" aria-pressed="false">Reproductive &amp; metabolic</button>
  <button data-filter="pathogen" aria-pressed="false">Pathogen evolution</button>
  <button data-filter="preprint" aria-pressed="false">Preprints</button>
</div>

<ul class="pubs">
  {% for p in site.data.publications %}
  <li class="pub reveal" data-tags="{{ p.tags }}">
    <div class="yr">{{ p.year }}</div>
    <div>
      <p class="ttl"><a href="{{ p.url }}" target="_blank" rel="noopener">{{ p.title }}</a></p>
      <p class="au">{{ p.authors }}</p>
      <span class="ven">{{ p.venue }}</span>
      {% if p.badge %}<span class="badge">{{ p.badge }}</span>{% endif %}
    </div>
  </li>
  {% endfor %}
</ul>
