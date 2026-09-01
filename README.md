# Wat eten we

Wat eten we is een complete gezinsapplicatie om maaltijden te plannen, favoriete gerechten te beheren en keuzestress aan tafel op te lossen met een interactief keuzerad.

## Over het project

Deze applicatie helpt gezinnen en huishoudens om eenvoudig recepten te verzamelen, maaltijden per week in te plannen en automatisch een boodschappenlijstje samen te stellen. Het ingebouwde rad van fortuin weegt maaltijden op basis van gezinsbeoordelingen en houdt automatisch rekening met een 7-dagen herhalingsrestrictie.

## Functionaliteiten

- Gezamenlijk kookboek: gerechten toevoegen, bewerken en categoriseren met bereidingstijd, ingrediënten en labels.
- Interactief keuzerad: dynamisch rad dat rekening houdt met beoordelingen, maaltijdmomenten en bereidingstijd.
- Weekkalender: maaltijden inplannen voor ontbijt, middag, avond en tussendoor met ingebouwde 7-dagen herhalingsbeveiliging.
- Slimme boodschappenlijst: automatische categorisering en hoeveelheid-samenvoeging per productgroep.
- Gezinsleden en profielen: veilige gebruikerskeuze met persoonlijke avatars, kleuren en wachtwoordbeveiliging.
- Realtime synchronisatie: directe gegevenssynchronisatie tussen apparaten via een geoptimaliseerde synchronisatielaag.

## Beveiliging en privacy

- Veilige wachtwoordhashing: wachtwoorden worden server-side versleuteld met salted scrypt hashes.
- Geen gevoelige gegevens in de browser: wachtwoorden worden niet opgeslagen in localStorage.
- Atomaire gegevensopslag: betrouwbare bestandsoverschrijving om databasecorruptie te voorkomen.
- Rate limiting: bescherming tegen geautomatiseerde inlogpogingen op de backend.

## Installatie en starten

### Vereisten

- Node.js 18 of hoger
- npm 9 of hoger

### Stappen

1. Installeer alle dependencies:
```bash
npm install
```

2. Start de ontwikkelserver:
```bash
npm run dev
```

De applicatie is nu bereikbaar via `http://localhost:3000`.

### Productie build

Om een geoptimaliseerde productiebundel te bouwen:

```bash
npm run build
npm start
```

## Licentie

Dit project is beschikbaar onder de Apache-2.0 licentie.
