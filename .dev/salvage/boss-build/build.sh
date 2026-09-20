#!/bin/sh
# concatenate the parts, syntax check, and only then publish into the repo
D=/private/tmp/claude-501/-Users-dpalmer-Repositories-astheeggeggs-github-io/f5b11ed9-11aa-462e-928d-9244e9a80e8c/scratchpad/boss-build
cat $D/p1.js $D/p2.js $D/p3.js $D/p4.js $D/p5.js $D/p6.js $D/p7.js $D/p8.js $D/p9.js > $D/boss.js || exit 1
node -e "new Function(require('fs').readFileSync('$D/boss.js','utf8'))" || exit 1
cp $D/boss.js /Users/dpalmer/Repositories/astheeggeggs.github.io/assets/js/boss.js && wc -l $D/boss.js
