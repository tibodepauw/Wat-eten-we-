# Beveiligings- en bugaudit rapport: Wat eten we

Dit document bevat een grondige technische analyse van de codebase van het project Wat eten we. De audit richt zich op beveiligingsrisico's, dataintegriteit, architectuur, prestaties en functionele bugs.

---

## Samenvatting van de bevindingen

De applicatie beschikt over een werkende basis met scrypt-wachtwoordhashing, atomaire bestandsoverschrijving en een centrale synchronisatielaag. Tijdens de diepgaande inspectie zijn echter verschillende kritieke en middelgrote aandachtspunten vastgesteld op het gebied van autorisatie, inputvalidatie, concurrency, databasestructuur en frontend afhandeling.

### Overzicht per categorie

| Categorie | Ernst | Aantal punten |
| :--- | :--- | :--- |
| Authenticatie en autorisatie | Hoog | 3 |
| Concurrency en dataintegriteit | Hoog | 3 |
| Inputvalidatie en denial of service | Medium | 4 |
| Prestaties en geheugenbeheer | Medium | 3 |
| Frontend en gebruikerservaring | Laag / Medium | 4 |
| Overbodige configuratiebestanden | Laag | 1 |

---

## 1. Authenticatie en autorisatie

### 1.1 Ontbreken van sessie- of tokenvalidatie op API endpoints
- **Locatie**: `server.ts` (alle endpoints behalve `/api/members/login`)
- **Ernst**: Hoog
- **Beschrijving**: Het endpoint `/api/members/login` controleert het wachtwoord via `verifyPassword()`, maar genereert geen sessietoken (zoals JWT of beveiligde HTTP-only cookie). De frontend slaat enkel de gebruikersnaam op in `localStorage.setItem('we_active_user', name)`. Alle API mutaties (`POST /api/dishes`, `DELETE /api/dishes/:id`, `PUT /api/members/:id`, `DELETE /api/members/:id`, `POST /api/shopping_list`, `DELETE /api/shopping_list/:id`) kunnen door iedereen direct worden aangeroepen zonder enige authenticatieheader of identiteitscontrole.
- **Impact**: Iedereen die toegang heeft tot de netwerkpoort kan willekeurige gerechten verwijderen, leden aanpassen of verwijderen, en wachtwoorden overschrijven zonder in te loggen.
- **Aanbevolen oplossing**: Implementeer een eenvoudige stateless token (zoals HMAC-ondertekende JWT of sessiecookie) die bij succesvol inloggen wordt meegegeven en geverifieerd via Express middleware op alle muterende endpoints.

### 1.2 Geen rolgebaseerde toegangscontrole bij bewerken en verwijderen van leden
- **Locatie**: `server.ts` (`PUT /api/members/:id`, `DELETE /api/members/:id`)
- **Ernst**: Hoog
- **Beschrijving**: Elk familielid kan via de interface of een directe API-call elk ander familielid bewerken, diens wachtwoord overschrijven of het profiel verwijderen. Er is geen beheerdersrol of verificatie of de ingelogde gebruiker daadwerkelijk de eigenaar van het profiel is.
- **Impact**: Onbedoelde overschrijvingen of sabotage van accounts binnen het huishouden.
- **Aanbevolen oplossing**: Valideer op de server dat een gebruiker alleen zijn eigen profiel kan aanpassen, of vereis het huidige wachtwoord bij profielwijzigingen.

### 1.3 CORS en binding op alle netwerkinterfaces
- **Locatie**: `server.ts` (regel 741: `app.listen(PORT, '0.0.0.0', ...)`)
- **Ernst**: Medium
- **Beschrijving**: De server bindt op `0.0.0.0` zonder geconfigureerde CORS policy. Als de server op een lokaal netwerk (of VPS met open poort 3000) draait, kan elke client in hetzelfde netwerk zonder beperkingen verzoeken sturen.
- **Aanbevolen oplossing**: Voeg `cors` middleware toe met strikte origin-beperking of bind in ontwikkelmodus enkel op `127.0.0.1`.

---

## 2. Concurrency en dataintegriteit

### 2.1 Race condition bij gelijktijdige database-schrijfopdrachten (lost updates)
- **Locatie**: `server.ts` (`readDB()` en `writeDB()`)
- **Ernst**: Hoog
- **Beschrijving**: De helperfuncties `readDB()` en `writeDB()` werken synchroon op bestandsniveau, maar Express verwerkt verzoeken asynchroon. Wanneer twee gebruikers tegelijkertijd een actie uitvoeren (bijvoorbeeld tegelijk een gerecht beoordelen of boodschappen toevoegen), lezen beide verzoeken dezelfde status in, waarna de laatste `writeDB()` de wijziging van het eerdere verzoek overschrijft.
- **Impact**: Verlies van beoordelingen, maaltijden of boodschappenlijst-items bij gelijktijdig gebruik.
- **AanbevolenMarkdown oplossing**: Implementeer een asynchrone write-queue (mutatie-wachtrij of mutex) in het geheugen zodat databasebewerkingen strikt sequentieel worden uitgevoerd.

### 2.2 Opslag van base64 afbeeldingen in db.json (database bloat)
- **Locatie**: `server.ts` (`express.json({ limit: '15mb' })`), `src/components/AddDishForm.tsx`, `src/components/DishList.tsx`
- **Ernst**: Medium
- **Beschrijving**: Geüploade afbeeldingen worden als base64 data-URL rechtstreeks in `data/db.json` opgeslagen. Bij 20 tot 30 gerechten kan `db.json` groeien naar 15MB tot 30MB. Omdat `db.json` bij vrijwel elk API verzoek (`readDB()`) volledig wordt ingelezen en geparsed met `JSON.parse()`, leidt dit tot ernstige CPU- en geheugenpieken.
- **Impact**: Hoge latency bij elke synchronisatiecyclus en verhoogd risico op geheugenuitputting (OOM crash).
- **Aanbevolen oplossing**: Sla geüploade afbeeldingen op als losse bestanden in een `uploads/` map op schijf en bewaar in de database uitsluitend het relatieve bestandspad (bijv. `/uploads/dish-uuid.jpg`).

### 2.3 Onvolledige cascade bij verwijderen van gerechten en leden
- **Locatie**: `server.ts` (`DELETE /api/dishes/:id`, `DELETE /api/members/:id`)
- **Ernst**: Medium
- **Beschrijving**:
  - Bij het verwijderen van een lid (`DELETE /api/members/:id`) worden beoordelingen opgeschoond, maar ingeplande maaltijden of boodschappenitems toegevoegd door dit lid behouden de oude `addedBy` naam.
  - Bij het hernoemen van een lid in `PUT /api/members/:id` worden `dishes`, `ratings` en `shopping_list` bijgewerkt, maar niet `planned_meals`.
- **Aanbevolen oplossing**: Zorg voor een consistente cascade- en referentiestructuur over alle entiteiten.

---

## 3. Inputvalidatie en denial of service

### 3.1 Onvoldoende validatie op rating scores
- **Locatie**: `server.ts` (`POST /api/ratings`)
- **Ernst**: Medium
- **Beschrijving**: De score wordt omgezet via `Number(score)` zonder te valideren of de waarde binnen het toegestane bereik valt (bijvoorbeeld 1 tot 10). Een client kan ongeldige waarden sturen zoals negatieve getallen, getallen boven de 10, of `NaN`.
- **Impact**: Een score van `NaN` of negatief verstoort de gewichtsberekening in `SpinWheel.tsx` en `DishList.tsx`, waardoor het rad kan blokkeren of fouten gooit.
- **Aanbevolen oplossing**: Valideer strikt: `if (typeof score !== 'number' || isNaN(score) || score < 1 || score > 10)`.

### 3.2 Geheugenlek in login rate limiter
- **Locatie**: `server.ts` (regel 46: `const loginAttempts = new Map<string, { count: number; resetAt: number }>();`)
- **Ernst**: Medium
- **Beschrijving**: Verlopen IP-adressen worden nooit opgeruimd uit de `loginAttempts` Map. Bij een server die langdurig draait met wisselende IP-adressen groeit deze Map oneindig door in het RAM-geheugen.
- **Aanbevolen oplossing**: Voeg een periodieke opschoning toe (bijvoorbeeld via `setInterval` elke 10 minuten) die entries verwijdert waarvan `Date.now() > resetAt`.

### 3.3 Rate limiting en reverse proxy IP detectie
- **Locatie**: `server.ts` (regel 311: `const ip = req.ip || req.socket.remoteAddress || 'unknown';`)
- **Ernst**: Laag / Medium
- **Beschrijving**: Zonder `app.set('trust proxy', 1)` ziet Express bij gebruik achter een reverse proxy (zoals Nginx of Cloudflare) het IP-adres van de proxy zelf (`127.0.0.1`). Hierdoor geldt de limiet van 10 inlogpogingen per minuut voor alle gebruikers tegelijk.
- **Aanbevolen oplossing**: Configureer `app.set('trust proxy', true)` wanneer de applicatie achter een reverse proxy wordt ingezet.

### 3.4 Synchrone CPU-intensieve scrypt operaties
- **Locatie**: `server.ts` (`hashPassword`, `verifyPassword`, `readDB` migratie)
- **Ernst**: Medium
- **Beschrijving**: `crypto.scryptSync` blokkeert de Node.js event loop tijdens de berekening. Bij meerdere gelijktijdige inlogverzoeken of databasemigraties worden alle andere HTTP-verzoeken geblokkeerd totdat de hash klaar is.
- **Aanbevolen oplossing**: Gebruik de asynchrone callback- of Promise-variant: `crypto.scrypt(password, salt, keylen, callback)`.

---

## 4. Frontend en gebruikerservaring

### 4.1 SyncEngine blijft pollen bij verborgen tabblad
- **Locatie**: `src/lib/db.ts` (`SyncEngine.startPollingIfNeeded`)
- **Ernst**: Medium
- **Beschrijving**: De pollinglus van 2500ms blijft onverminderd doorlopen wanneer het browservenster geminimaliseerd is of de gebruiker naar een ander tabblad switcht. Dit verbruikt onnodig netwerkverkeer, CPU en batterij op mobiele apparaten.
- **Aanbevolen oplossing**: Gebruik de Page Visibility API (`document.addEventListener('visibilitychange', ...)`). Pauzeer polling wanneer `document.hidden` waar is en voer direct een `pollSync()` uit zodra het tabblad weer actief wordt.

### 4.2 Tijdzoneverschuiving bij datumverwerking
- **Locatie**: `src/components/CalendarView.tsx`, `src/App.tsx`
- **Ernst**: Medium
- **Beschrijving**: Datums worden opgeslagen als string (`YYYY-MM-DD`). Op verschillende plekken wordt `new Date(selectedDateStr + 'T12:00:00')` of `new Date(item.plannedDate)` gebruikt. Afhankelijk van de lokale tijdzone van de gebruiker (met name rond middernacht of bij zomertijdovergangen) kan dit leiden tot een verschuiving van 1 dag bij weergave in de kalender.
- **Aanbevolen oplossing**: Parse datumstrings strikt op basis van jaar, maand en dag componenten zonder afhankelijkheid van lokale UTC-conversies.

### 4.3 Eenheden parseren in boodschappenlijst
- **Locatie**: `server.ts` (`mergeAmounts`)
- **Ernst**: Laag
- **Beschrijving**: De functie `mergeAmounts` ondersteunt grammen (`g`, `gr`, `gram`), maar kan eenheden zoals `1 kg` en `500 g` niet combineren (geeft `1 kg + 500 g`). Tevens worden breuken zoals `1/2` niet herkend door `parseFloat`.
- **Aanbevolen oplossing**: Verbeter de parseringslogica met ondersteuning voor standaard kilo/gram en liter/milliliter conversies.

### 4.4 Resterend speciaal karakter in SpinWheel rating weergave
- **Locatie**: `src/components/SpinWheel.tsx` (regel 204: `score: avg.toFixed(1) + ' ★'`)
- **Ernst**: Laag (stijlconformiteit)
- **Beschrijving**: In regel 204 staat nog een ster-karakter (`★`) in de geretourneerde string, wat in strijd is met het strikte ascii-formaat.
- **Aanbevolen oplossing**: Vervang dit door een tekstuele notatie of render het icoon via een Lucide React component in plaats van een hardcoded teken.

---

## 5. Overbodige configuratiebestanden

### 5.1 Ongebruikte Firebase en Firestore configuratie
- **Locatie**: `firestore.rules`, `firebase-applet-config.json`, `firebase-blueprint.json`
- **Ernst**: Laag
- **Beschrijving**: Het project is volledig gemigreerd naar een Express server met een JSON database en `SyncEngine`. De Firestore-beveiligingsregels en Firebase applet configuratiebestanden worden nergens meer gebruikt, maar kunnen verwarring scheppen over het beveiligingsmodel van het project.
- **Aanbevolen oplossing**: Verwijder deze bestanden of documenteer expliciet dat het project nu zelfstandig draait op Express.

---

## Prioriteitenoverzicht voor opvolging

1. **Prioriteit 1 (Kritiek)**:
   - Sessievalidatie / tokens toevoegen aan mutatie-endpoints.
   - Concurrency lock / queue toevoegen rond `readDB()` en `writeDB()`.
   - Afbeeldingen opslaan in bestandssysteem in plaats van base64 in `db.json`.

2. **Prioriteit 2 (Belangrijk)**:
   - Strikte inputvalidatie op `POST /api/ratings` en `POST /api/dishes`.
   - Periodieke opschoning van `loginAttempts` Map tegen geheugenlekken.
   - Asynchrone scrypt hashing (`crypto.scrypt` i.p.v. `crypto.scryptSync`).
   - Page Visibility API integratie in `SyncEngine` om polling te pauzeren op inactieve tabs.

3. **Prioriteit 3 (Verfijning)**:
   - Tijdzone-veilige datumverwerking in de kalender.
   - Opschonen van overbodige Firebase bestanden.
   - Verbetering van eenhedensamenvoeging in de boodschappenlijst.
