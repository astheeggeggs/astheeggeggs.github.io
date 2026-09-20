#!/usr/bin/env python3
"""Bundle the home page + game into ONE self-contained HTML file for a private claude.ai artifact preview.
Usage:  bundle exec jekyll build && python3 .dev/bundle-artifact.py  →  .dev/tmp/palmers-progress.html
Then publish that file with the Artifact tool, passing url=<existing artifact URL> to keep the same link.
Internal pages do not exist in the bundle, so their links are pointed at Google Scholar / GitHub."""
import re, base64, pathlib, os
ROOT = pathlib.Path(__file__).resolve().parent.parent; os.chdir(ROOT)
SCHOLAR = 'https://scholar.google.com/citations?user=-OiUY4kAAAAJ&hl=en'; GH = 'https://github.com/astheeggeggs'
html = open('_site/index.html').read(); css = open('assets/css/swank.css').read()
js = {n: open('assets/js/%s.js' % n).read() for n in ('riff', 'boss', 'shmup', 'quest') if os.path.exists('assets/js/%s.js' % n)}
img = 'data:image/jpeg;base64,' + base64.b64encode(open('assets/me.jpg', 'rb').read()).decode()
body = html[html.index('<header'):html.index('</footer>') + len('</footer>')]
body = re.sub(r'<nav class="site-nav">.*?</nav>', '<nav class="site-nav"><a href="%s" target="_blank" rel="noopener">Scholar</a><a href="%s" target="_blank" rel="noopener">GitHub</a></nav>' % (SCHOLAR, GH), body, flags=re.S)
body = body.replace('<a class="brand" href="/">', '<a class="brand" href="#top">')
body = re.sub(r'<a class="btn" href="/research/">Research</a>\s*<a class="btn" href="/publications/">Publications</a>', '<a class="btn" href="%s" target="_blank" rel="noopener">Google Scholar</a>' % SCHOLAR, body)
body = body.replace('href="/publications/"', 'href="%s" target="_blank" rel="noopener"' % SCHOLAR).replace('src="/assets/me.jpg"', 'src="%s"' % img)
left = [m.group(0) for m in re.finditer(r'href="/[^"#]', body)]
assert not left, 'root-relative links left in body: %r' % left[:5]
q = js['quest']
q = q.replace("link: { href: '/publications/', label: 'Browse the publications', internal: true }", "link: { href: '%s', label: 'Google Scholar' }" % SCHOLAR)
q = q.replace("link: { href: '/code/', label: 'See the code', internal: true }", "link: { href: '%s', label: 'GitHub' }" % GH)
q = q.replace("publications: '/publications/', research: '/research/', code: '/code/'", "publications: '%s', research: '%s', code: '%s'" % (SCHOLAR, SCHOLAR, GH))
js['quest'] = q
for n, src in js.items():
    bad = re.findall(r"['\"]/(?:publications|research|code)/['\"]", src)
    assert not bad, '%s.js still has internal links: %r' % (n, bad)
scripts = '\n'.join('<script>\n%s\n</script>' % js[n] for n in ('riff', 'boss', 'shmup', 'quest') if n in js)
out = '''<title>Palmer's Progress</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Press+Start+2P&display=swap" rel="stylesheet">
<style>
%s
.preview-note { font-family: var(--mono); font-size: .68rem; letter-spacing: .08em; text-transform: uppercase; color: #0b0c10; background: #fcd34d; text-align: center; padding: .55rem 1rem; }
html { scroll-behavior: smooth; }
</style>
<a id="top"></a>
<div class="preview-note">Preview for a few people. Not the live site yet. The game runs best on a laptop with sound on.</div>
%s
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.min.js"></script>
%s
''' % (css, body, scripts)
dst = ROOT / '.dev' / 'tmp' / 'palmers-progress.html'; dst.parent.mkdir(parents=True, exist_ok=True); dst.write_text(out)
print('wrote', dst, len(out) // 1024, 'KB; modules:', ', '.join(js))
