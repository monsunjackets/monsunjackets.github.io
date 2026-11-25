---
# Fixture for the M6 end-to-end check (ADR 0001 §3). Copy it into src/content/posts/ and build: the build must fail
# with „Śródtytuł (## lub ###) musi zawierać słowo kluczowe”. The front matter is meant to pass the schema, so set
# `author` to a seeded author id if `milosz` is not one. Never commit it under src/content/posts/.
title: 'Ramoneska skórzana: jak ją nosić od jesieni do wiosny'
description: 'Wpis testowy. Słowo kluczowe jest w tytule i w tekście, ale w żadnym śródtytule ## ani ###.'
keyword: ramoneska skórzana
author: milosz
published: 2026-11-27
answer: 'Ramoneska skórzana sprawdza się od jesieni do wiosny, jeśli ma podpinkę. Ten wpis jest celowo błędny: żaden śródtytuł nie zawiera słowa kluczowego w dokładnej formie.'
photo:
  src: ../../assets/dev/placeholder.jpg
  alt: Zdjęcie zastępcze do testu kompilacji
  by: Zespół MONSUN
  own: true
product: ramoneska-skorzana-z-podpinka
aiUse: Plik testowy przygotowany z Claude do sprawdzenia reguł bloga.
---

Ramoneska skórzana to kurtka, o którą pytacie najczęściej. Słowo kluczowe jest w tym akapicie, ale akapit się nie
liczy.

## Jak nosić ramoneskę skórzaną

Odmieniona forma („ramoneskę skórzaną”) to nie słowo kluczowe.

### Ramoneski skórzane w naszym teście

Liczba mnoga też nie.

#### Ramoneska skórzana w praktyce

Nagłówek czwartego poziomu się nie liczy: liczą się tylko ## i ###.
