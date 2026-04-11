# CLAUDE.md

## Projectnaam
Spraakgestuurde Voorraad

## GitHub repo
jesuisbicabi/voorraad-app

## Lokaal pad
C:\Users\User\Documents\voorraad-app

## Structuur
Eén bestand: `index.html` (frontend + spraakherkenning + Claude AI-integratie)
GAS backend: `apps-script.gs` (Google Apps Script, apart gedeployd)

## GAS script URL
`https://script.google.com/macros/s/AKfycbzVeDtVUI1BLT-iW0yZUanH9iAC4z6ZSOV_UEODTeYwA5KewpP0CmzeB-WaXURRyv3P/exec`

## Sheet kolommen
| Kolom | Veld |
|-------|------|
| A | Opslagplaats |
| B | Categorieën |
| C | Productnaam |
| D | Vervaldatum |
| E | Aantal |
| F | Comment |
| G | GrPerStuk |

## API model
`claude-haiku-4-5-20251001` — gekozen boven Sonnet vanwege lagere kosten; voldoende voor voorraadcommando's.

## Bekende bugfixes
1. **fetchGAS slokte fouten stil** — opgelost met `resp.ok` check en throw bij niet-JSON antwoord. Zonder deze fix verscheen geen foutmelding bij verlopen GAS-autorisatie of HTTP-fouten.
2. **loadData() overschreef lokale wijzigingen na opslaan** — `await loadData()` verwijderd uit `verplaatsHoeveelheid`. Na succesvolle GAS-calls is de lokale staat al correct; handmatig sync via 'ververs'-commando of ↻-knop.
3. **Aantal werd null meegegeven bij verplaatsen** — In Comment-modus (gr/ml) werd `Aantal: bron.Aantal` meegestuurd in update-calls terwijl alleen Comment wijzigt; `null` overschreef de bestaande waarde. In Aantal-modus gaf `null - hoeveelheid` verkeerde rekenkunde. Opgelost door Aantal weg te laten uit Comment-modus payloads en `Number(bron.Aantal) || 0` te gebruiken in Aantal-modus.
4. **UI werd niet bijgewerkt na verplaatsing** — Na actie-uitvoering wordt `renderTab()` nu expliciet aangeroepen vanuit `processVoice`. Statusbericht wordt herbouwd vanuit bijgewerkte `allData` zodat nieuwe hoeveelheden direct zichtbaar zijn. Spraakcommando 'ververs' toegevoegd voor handmatige volledige sync met de sheet.
5. **Aantal-berekening in Comment-modus klopte niet** — Comment werd als totaalgewicht behandeld i.p.v. gewicht-per-pakket. Bij 2× 250gr werd de bron na verplaatsen van 250gr op 0 gezet i.p.v. 1. Opgelost door totaal te berekenen als `perPakket × bronAantal`, nieuw aantal af te leiden via `Math.round(nieuwTotaal / perPakket)`, en alleen Aantal (niet Comment) bij te werken voor bron en doel. `pakketsMoved = bronAantal - nieuwAantalBron` bepaalt hoeveel pakketten naar het doel gaan.
6. **App toonde oude data na verplaatsing** — Handmatige `allData`-updates in `verplaatsHoeveelheid` weken af van wat GAS daadwerkelijk had weggeschreven. Opgelost door na alle succesvolle GAS-calls `await loadData(true)` aan te roepen. De `silent`-parameter (toegevoegd aan `loadData`) slaat de laadspinner en "Voorraad bijgewerkt"-toast over, zodat alleen de verplaatsingssuccesmelding zichtbaar is.

8. **Info-vragen lokaal afgehandeld** — Opgelost 2026-04-11.
   - Queries zonder actiewoorden (verplaats, toevoegen, verwijderen, etc.) worden lokaal beantwoord vanuit `allData`, geen API-call.
   - Als er geen match gevonden wordt, valt het alsnog door naar de API.

7. **Kolom G (GrPerStuk) toegevoegd** — Opgelost 2026-04-10.
   - GrPerStuk (numeriek, bijv. 250) is de enige bron voor gram-berekeningen. Geen Comment-parsing meer.
   - Gram-modus: `totaalGr = GrPerStuk × Aantal`; na verplaatsen: `nieuwAantal = nieuwGr / GrPerStuk` (decimaal).
   - GAS: `updateRow` schrijft kolom 7; `addRow` bevat kolom G.
   - UI: badge toont totaalgrammen; meta toont `X st × Y gr`. Modal Aantal heeft `step="any"`.
   - AI-prompt en voice context bijgewerkt om GrPerStuk te gebruiken.

## Openstaande punten

1. **Lokale info-weergave toont niet correct GrPerStuk** — OPEN
   - Huidig: toont bijv. `8` of `8 (notitie)`
   - Gewenst: `8 zakjes × 15 gr = 120 gr`

2. **Handmatig aanpassen van velden verdwenen** — OPEN
   - Aantal, locatie en andere velden zijn niet meer bewerkbaar via de UI
   - Moet worden teruggezet

## Werkinstructie
Na elke bugfix of nieuwe feature dit CLAUDE.md bestand updaten met wat er gewijzigd is en waarom.

Alle code-aanpassingen altijd via Claude Code, nooit code in chat plakken.
