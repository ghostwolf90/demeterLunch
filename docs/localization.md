# Website languages

The editable site is in `web/`. Traditional Chinese copy remains in its original HTML, JavaScript, and reviewed public data. `web/locales/en.js` contains English copy and sentence templates. Both language files load in the document head; `web/i18n.js` translates parser additions and later renders before the next paint, without changing application state.

Language priority is a supported explicit `demeter-language` device preference, then the first supported browser language, then Traditional Chinese (`zh-Hant`). English variants use `en`; Chinese variants use `zh-Hant`. Settings offers automatic browser matching, Traditional Chinese, and English. Automatic matching removes the explicit preference. Storage failures do not prevent a selection from working on the current page.

Only display text and accessible labels are translated. Original text is retained in memory for switching back without reloading or clearing forms. No account or source data is written to browser storage by this feature. `LunchI18n.keep(elementOrTextNode)` protects the current text nodes containing official dish names, school names, family names, quotes, or notes. Call it after assigning source text and before appending a new element. Protection follows those text nodes, so replacing the content with a later interface status remains translatable.

Add exact-copy entries for new interface text. For sentences with inserted data, use numbered placeholders in the same order as the Chinese sentence. Captured values remain verbatim; only explicitly listed `labelSlots` or `dateSlots` in the runtime are localized. Do not apply label translation to user-entered fields. Use `translate="no"` for persistent static opt-outs, such as the language names in the selector. Translation is text-only; English catalog values must never be rendered as HTML.

Validation:

- `python3 -m unittest discover -s tests -v` includes static page and authored family-content translation coverage.
- `npm run test:worker` includes language priority, storage failure, live switching, dynamic notices, and preservation of original data. Use the project's required Node version (22.13 or newer).
- `node --check web/app.js` and `node --check web/i18n.js` check frontend syntax.
- `python3 scripts/build_static_site.py` refreshes `dist/` without increasing the release version. Formal publication still requires the normal release build and latest remote Site source workflow.

Browser automation is prohibited by project instructions. Manually verify desktop and mobile layouts, English text wrapping, first-paint language, keyboard operation of the language selector, and switching languages with a partially completed family form. Official menus, school and ingredient names, source articles, and family-written content intentionally retain their original language.
