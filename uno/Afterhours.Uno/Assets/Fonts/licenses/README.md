# Font licences

All fonts here are under the SIL Open Font License 1.1 (the matching `*-OFL.txt`).

- `DMSans_*.ttf`, `BarlowCondensed_ExtraBold.ttf`, `SpaceGrotesk_Bold.ttf`: unmodified static instances.
- `AfterhoursSymbols_Regular.ttf`: a subset of Noto Sans Symbols 2, Noto Sans Symbols (weight 400) and the
  U+2100–2BFF glyphs of Noto Emoji (weight 400, scaled to 1000 units per em), merged into one font for the
  symbols the UI draws (✦ ✳ ◉ ♫ ♡ ✓ …). Made with fontTools (subset, varLib.instancer, scaleUpem, merge).
- `NotoEmoji_Regular.ttf`: Noto Emoji at weight 400, U+1F000 and up. Loaded only when an emoji is drawn.

The renamed merge is a Modified Version under the OFL; it does not use the Reserved Font Name.
