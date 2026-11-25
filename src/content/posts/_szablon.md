---
# Post template for the GitHub web editor (ADR 0001 §10). Files whose name starts with "_" are never published.
#
# 1. Copy this file to src/content/posts/<slug>.md. The slug is your keyword without Polish letters, with
#    hyphens: "jak dbać o kurtkę skórzaną" -> jak-dbac-o-kurtke-skorzana.md.
# 2. Replace every [placeholder] below and in the text. Write the post in Polish.
# 3. Put your own photo, with location data removed (npm run images:strip), in src/assets/posts/<slug>/.
# 4. Set draft to false and open a pull request. The build names every field that is missing or wrong.
#
# Rules, checklist and a filled-in example: docs/handoff/post-template.md (the Drive version of this template).

# Exactly one of: kurtka skórzana na zimę | kurtka skórzana z podpinką | ramoneska skórzana |
# jak dbać o kurtkę skórzaną | jak dobrać rozmiar kurtki skórzanej
keyword: "[słowo kluczowe dokładnie w tej formie]"

# At most 70 characters. Contains the keyword exactly (capital letters don't matter).
title: "[Tytuł ze słowem kluczowym: co czytelnik z niego wyniesie]"

# At most 160 characters. Google shows it under the title.
description: "[Jedno albo dwa zdania o tym, co jest we wpisie.]"

# File name of your entry in src/content/authors/, without .yaml: milosz, filip or nishanth.
author: "[autor]"

# Publish date, YYYY-MM-DD.
published: "[RRRR-MM-DD]"

# „W skrócie”: the answer to the keyword's question, 80–400 characters. The site shows it first.
answer: "[Odpowiedź w 2–3 zdaniach.]"

photo:
  # Your own photo, never an AI-generated one.
  src: ../../assets/posts/[slug]/[plik].jpg
  # What the photo shows, for people who can't see it. At least 10 characters.
  alt: "[Co widać na zdjęciu]"
  # Who took it. The site shows „Zdjęcie: …”.
  by: "[Imię N.]"
  own: true

# The product card under the post. One of: ramoneska-skorzana-z-podpinka, kurtka-skorzana-na-podpinke,
# plaszcz-skorzany-z-podpinka, kurtka-jeansowa-na-podpinke, podpinka-pikowana
product: "[produkt]"

# „Jak pomogło AI”: what AI did and what is yours, at least 30 characters. If you used none:
# „Przy tym wpisie nie korzystaliśmy z AI.” Every AI use is also a row in the report's AI-use log.
aiUse: "[Co zrobiło AI, a co jest Twoje.]"

# true keeps the post off the site. Set it to false when the post is ready.
draft: true
---

[Pierwszy akapit: o czym jest wpis i co sprawdzasz.]

## [Śródtytuł ze słowem kluczowym w dokładnej formie]

[Twój test albo doświadczenie: co, kiedy, czym i co z tego wyszło. Każda liczba, której nie zmierzysz osobiście, ma link
do źródła. O produktach MONSUN piszemy w czasie przyszłym, bo jeszcze ich nie uszyliśmy.]

## [Kolejny śródtytuł]

[Tekst.]
