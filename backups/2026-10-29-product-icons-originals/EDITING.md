# Значки продуктов 1–17

Исходный архив: `C:\Users\bdv\Desktop\images\images.7z`. Оригинальные `1.png` … `17.png` распакованы в эту папку и сохранены без изменений. Порядок соответствует номерам продуктов.

Фон удалён встроенным инструментом imagegen, режим `background-extraction`, с настоящим альфа-каналом. CLI и API-ключ не использовались. После обработки значки приведены к единому масштабу и преобразованы в WebP 128 × 128 средствами Canvas. На сайте они отображаются размером 64 px на компьютере и 56 px на телефоне.

Результаты: `public/assets/product-icon-01.webp` … `public/assets/product-icon-17.webp`. Общий размер — 171 576 байт. У всех файлов проверена прозрачность; альфа-канал во всех четырёх углах равен нулю. Подложки в карточках также прозрачные.

`processed-contact-sheet.png` — общий лист всех значков в правильном порядке. `processing-report.json` — размеры файлов и результаты проверки прозрачности.

## Запрос обработки первого значка

Use case: background-extraction. Edit target: the attached source screenshot, specifically the single small circular red-and-pink metallic badge in its upper-left corner. Remove ALL white canvas outside the badge, including the large unused white area to the right and below. Isolate and tightly crop this exact existing circular badge, centered on a square transparent canvas with only 4% clear padding. Keep every interior pixel and symbol design as faithful as possible: concentric glossy metallic rings, pink/red face, red arch and blue circular dot. Do not redesign, simplify, add lettering, alter colors, add new graphic elements or change the circular silhouette. Keep white highlights INSIDE the badge opaque; only the exterior background becomes genuine alpha transparency. Preserve the subtle existing outer shadow as semitransparent alpha, with no white halo. This is a faithful cutout of an existing logo for a website, not a new logo. Output one standalone transparent badge.

## Шаблон запросов для значков 2–17

Use case: background-extraction. Edit target: the supplied screenshot, which contains one small {subject} in the upper-left corner of a large white canvas. Extract ONLY that existing badge. Remove the large unused white area and every white background pixel outside its outer circular silhouette. Produce a tightly cropped, centered square transparent icon with approximately 4% clear padding. Preserve the exact original central emblem, all tiny lettering if present, original colors, ring count, proportions, highlights and circular shape. Do not invent or redraw a different symbol, do not add text or decorative details. White regions INSIDE the circular badge stay opaque. Preserve a subtle semitransparent outer shadow without any white halo. No stray dots, detached pixels, solid background, checkerboard or frame. One standalone faithful cutout with actual alpha transparency, not a logo redesign.

Подстановка `{subject}`:

2. cyan and dark blue circular metallic badge with the small white stylized face/judicial emblem
3. green circular metallic badge with the green magic wand and three stars
4. gold and yellow circular metallic badge with the white pentagonal shield and magnifying glass
5. red and orange circular metallic badge with the white upright architectural/letter-T symbol inside a pentagon
6. magenta circular metallic badge with the white document and cloud symbol
7. orange circular metallic badge with the white cogwheel and central small briefcase/equals mark
8. green circular metallic badge with the white-and-green shield
9. blue circular metallic badge with the blue checklist, three dots and tick symbol
10. light blue circular metallic badge with three dark-blue interlocking hexagons
11. bronze circular metallic badge with the fine line eye and connected circular network nodes
12. dark navy and blue circular metallic badge with the large white @ symbol and curved lines
13. pink circular metallic badge with the white video play-triangle on a pink rounded square
14. teal circular metallic badge with the dark teal geometric checkmark
15. teal circular metallic badge with the dark teal geometric checkmark and tiny white W in a turquoise square
16. yellow circular metallic badge with the exact existing overlapping dark and white Cyrillic/Latin letter-like symbol
17. coral-red circular metallic badge with the white pentagonal outline and small document/bag emblem containing a red lowercase e
