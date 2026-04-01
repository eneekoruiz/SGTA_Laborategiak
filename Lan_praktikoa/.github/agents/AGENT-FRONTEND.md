# AGENT-FRONTEND.md — SimHiri: Copilot Agent-aren Argibideak (Frontend Garatzailea)

---

## ROLA

**Frontend** garapen agentea zara SimHiri proiektuan, hiri-eraikuntza estrategia joko web bat. Zure erantzukizun nagusia da erabiltzaile interfaze osoa inplementatzea: mapa isometrikoa, zona eta eraikin kudeaketa, aurrekontu panelak, datu gainjarriak, AA txandaren bistaratzea, eta jokalariaren esperientzia bisuala.

---

## TEKNOLOGIAK

- **Framework**: Kontsultatu SPECS.md § 6 taularen esleipena zure taldearentzat (React, Vue, Angular edo Svelte)
- **Hizkuntza**: TypeScript (gomendatua) edo JavaScript
- **Ingurunea**: Node.js
- **Estiloak**: CSS/SCSS hiri-eraikuntza estetikarekin (isometrikoa, kolore argiak)
- **Egoera**: Erabili framework-aren store natiboa (Redux/Zustand React-entzat, Pinia Vue-rentzat, NgRx Angular-entzat, Svelte stores Svelte-rentzat)
- **HTTP**: fetch API edo axios backend-arekin komunikatzeko
- **Routing**: React Router / Vue Router / Angular Router / SvelteKit routing

---

## FRONTEND ARKITEKTURA

```
frontend/
├── src/
│   ├── components/        # Osagai berrerabilgarriak (Button, Modal, Panel, Slider, etab.)
│   ├── views/             # Bista/orrialde nagusiak
│   │   ├── LandingPage
│   │   ├── LoginPage
│   │   ├── RegisterPage
│   │   ├── GameListPage
│   │   ├── NewGamePage
│   │   └── GamePage
│   ├── game/              # Jokoko osagai espezifikoak
│   │   ├── CityMapView
│   │   ├── UndergroundView
│   │   ├── ZoneToolbar
│   │   ├── BuildToolbar
│   │   ├── InfraToolbar
│   │   ├── BudgetPanel
│   │   ├── OrdinancePanel
│   │   ├── DataOverlaySelector
│   │   ├── RCIDemandBar
│   │   ├── RivalCityView
│   │   ├── DisasterPanel
│   │   ├── AITurnViewer
│   │   ├── GameHUD
│   │   ├── CheatConsole
│   │   └── NewspaperModal
│   ├── store/             # Aplikazioaren egoera globala
│   ├── services/          # HTTP deiak backend-era (api.ts)
│   ├── types/             # TypeScript motak (jokoaren interfazeak)
│   ├── assets/            # Irudiak, sprite-ak, ikonoak
│   │   └── ai-generated/  # AA bidez sortutako baliabideak (etiketatuak)
│   ├── utils/             # Utilitateak (formatua, UI kalkuluak, isometrikoa)
│   └── styles/            # Estilo globalak, hiri gaia
├── public/
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## BISTA NAGUSIAK — ZER INPLEMENTATU

### 1. LandingPage (`/`)
- Jokoaren logoa eta "SimHiri" izenburua
- Login eta Erregistro botoiak
- Hiri paisaia atzealde gisa

### 2. LoginPage (`/login`)
- Formularioa: username + pasahitza
- `POST /api/auth/login` deia
- JWT gordetzea store-an eta localStorage-n
- Login arrakastatsuaren ondoren GameListPage-ra birbideratu
- Autentikazio erroreak erakutsi

### 3. RegisterPage (`/register`)
- Formularioa: username + email + pasahitza + pasahitza konfirmatu
- Bezeroaren aldeko balidazioa bidali aurretik
- `POST /api/auth/register` deia
- Erregistro arrakastatsuaren ondoren GameListPage-ra birbideratu

### 4. GameListPage (`/games`)
- Gordetako partiden zerrenda (`GET /api/games`)
- "Partida Berria" botoia → NewGamePage-ra birbideratzea
- "Kargatu" botoia partida bakoitzean
- "Ezabatu" botoia baieztapenarekin
- Partida bakoitzaren info: izena, data (urtea/hilabetea), biztanleria, azken gordeketa

### 5. NewGamePage (`/games/new`)
- Eszenatokia aukeratu (`GET /api/scenarios`)
- Zailtasun maila hautatu (erraza / normala / zaila)
- Jokalariaren hiri izena sartu
- AA nortasuna aukeratu (hedatzailea / ekologista / industrialista / orekatua / zerga-biltzailea)
- Hondamendiak aktibatu/desaktibatu
- "Jokoa Hasi" botoia → `POST /api/games` → GamePage-ra birbideratu

### 6. GamePage (`/game/:id`)
**JOKOKO BISTA NAGUSIA** — Osagai hauek guztiak biltzen ditu:

---

## JOKOKO OSAGAI NAGUSIAK

### CityMapView
- **Mapa isometrikoa**: Zonak, eraikinak, azpiegiturak, lurraldea errendatu
- **Zoom eta panoramika**: Sagua gurpilarekin zoom, click-and-drag mugimendurako
- **Lauki hautatzailea**: Hover → lauki informazioa tooltip batean (mota, biztanleria, energia, ura)
- **Zona koloreak**: R=berde arina, C=urdin arina, I=hori arina. Garapen maila tintearen intentsitatearekin
- **Eraikin ikonoak**: Zentral elektrikoak, zerbitzuak, hezkuntza sistemaren ikonoak
- **Azpiegitura lerroak**: Errepideak gris, energia lerroak hori, trenbidea beltz

### UndergroundView
- **Lurpeko geruza bista**: Toggle botoia gainazala/lurpekoa aldatzeko
- Ur-hodiak urdin gisa erakutsi
- Metro tunelak gris ilun gisa erakutsi
- Lurpeko elementuak soilik editatzeko aukera modu honetan

### ZoneToolbar
- 6 zona mota aukeratzeko botoiak (R/C/I × arin/trinkoa)
- Drag-to-paint modua: sagua arrastatu zona jartzeko
- Aukeratutako zona mota eta kostua adierazlea

### BuildToolbar
- Eraikin kategoriak: Zentral Elektrikoak | Zerbitzuak | Hezkuntza | Garraioa | Ura
- Eraikin bakoitzaren kostua, tamaina eta efektuak tooltip-ean
- Eskuragarritasuna kontuan hartu (urte teknologikoa, dirua)
- Eraikin aukeratua → mapa gainean kokapena hautatu → berretsi

### InfraToolbar
- Azpiegitura motak: Errepidea | Autobidea | Energia Linea | Trenbidea | Ur-hodia | Metro Tunela
- Kostua lauki bakoitzeko adierazlea
- Lurpeko motak automatikoki UndergroundView-ra aldatu
- Click-and-drag segmentuak jartzeko

### BudgetPanel (zabaltzen den panel bat)
- **3 zerga slider**: Erresidentziala, Komertziala, Industriala (0-20%)
- **5 finantzaketa slider**: Garraioa, Polizia, Suhiltzaileak, Osasuna, Hezkuntza (0-120%)
- **Bonu kudeaketa**: Bonu berria eskatu botoia + bonu aktiboen zerrenda
- **Hileko laburpena**: Diru-sarrerak, gastuak, balantzea (kolore berdea/gorria)

### OrdinancePanel
- Ordenantza zerrenda taula formatuan
- Aktibatu/desaktibatu toggle bakoitzean
- Kostu/diru-sarrera zutabea
- Efektu laburpena tooltip-ean

### DataOverlaySelector
- Gainjarri aukerak botoien barra gisa:
  - Krimena (gorri degradatua)
  - Kutsadura airea (gris-beltz degradatua)
  - Kutsadura ura (marroi degradatua)
  - Lur-balioa (berde-urdin degradatua)
  - Trafikoa (laranja degradatua)
  - Energia (hori degradatua)
  - Ura (urdin degradatua)
  - Su estaldura (laranja-berde degradatua)
  - Polizia estaldura (urdin-berde degradatua)
- Gainjarri aktiboa mapa gainean transparentzia bidez erakusten da

### RCIDemandBar
- Beti ikusgai (GameHUD-ren parte)
- 3 barra bertikal: R (berdea), C (urdina), I (horia)
- Positiboa = gora, negatiboa = behera
- Eskari zenbakizko balioa tooltip-ean

### RivalCityView (panel txiki bat)
- AA hiriaren izena eta biztanleria
- Puntuazio konparaketa barrekin
- Metrika laburpena (EQ, HQ, krimena, kutsadura)
- Azken erasoaren informazioa (cooldown-a)

### DisasterPanel (zabaltzen den panel bat)
- Hondamendi eraso aukerak: Sutea, Uholdea, Tornadoa, Lurrikara
- Kostua bakoitzean adierazlea
- Cooldown kontadorea (6 hilabete)
- "Eraso!" botoia → baieztapen modal → `POST /api/games/{gameId}/attack`
- Kaltea txostena erantzunean

### AITurnViewer (gainjarri osagaia)
- "Hilabetea Amaitu" botoiaren ondoren aktibatzen da
- **Pantaila Osoko modua**: Jokalariaren bista ordezkatzen du
- **Pantaila Zatituko modua**: Ezkerrean jokalariaren hiriaren egoera, eskuinean AA-ren ekintzak

- Kontrolak: Play/Pausa, Aurrera/Atzera, Abiadura (Normala / Azkarra / Berehalakoa)
- Animazioak:
  - Zona berria: flash berde kolorearekin
  - Eraikina: eraikinak agertzen anima
  - Azpiegitura: lerroa marrazten
  - Erasoa: hondamendi efektua
- AA-ren arrazoiamendu testua eskuineko panelean
- "Emaitzara salto" botoia

### GameHUD
- **Goiko barra**: Data (urtea/hilabetea), Biztanleria, Altxorra, Puntuazioa, RCI Barra
- "Hilabetea Amaitu" botoia (nabarmendua)
- "Gorde" botoia
- Abiadura kontrolak (AA txandaren abiadura)

### CheatConsole (gainjarri osagaia)
- **Ctrl+Tab** tekla konbinazioarekin aktibatzen da
- Testu sarrera kodea idazteko
- Kode historia (aplikatutakoak)
- "Aplikatu" botoia → `POST /api/games/{gameId}/cheat`
- Emaitza bisuala (mezua + aldaketak)
- "Itxi" botoia edo Escape

### NewspaperModal (5. taldeko moduluarentzat)
- Popup modala egunkari formatuan
- Automatikoki urtero agertzen da (urtarrilean)
- Eskuz irekitzeko botoia GameHUD-en
- Titularrak, artikuluak, inkestak, umore zutabea

---

## API ZERBITZUA (services/api.ts)

HTTP dei guztietarako zerbitzu zentralizatua inplementatu:

```typescript
// services/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function request(method: string, path: string, body?: any) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || 'Eskaera huts egin du');
  }
  return res.json();
}

export const api = {
  // Autentikazioa
  login: (username: string, password: string) =>
    request('POST', '/api/auth/login', { username, password }),
  register: (username: string, email: string, password: string) =>
    request('POST', '/api/auth/register', { username, email, password }),
  getProfile: () =>
    request('GET', '/api/auth/profile'),

  // Partidak
  listGames: () =>
    request('GET', '/api/games'),
  createGame: (config: any) =>
    request('POST', '/api/games', config),
  loadGame: (gameId: string) =>
    request('GET', `/api/games/${gameId}`),
  saveGame: (gameId: string, name?: string) =>
    request('POST', `/api/games/${gameId}/save`, { name }),
  deleteGame: (gameId: string) =>
    request('DELETE', `/api/games/${gameId}`),

  // Jokoko ekintzak
  placeZone: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/zone`, data),
  placeInfrastructure: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/infrastructure`, data),
  build: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/build`, data),
  demolish: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/demolish`, data),
  updateBudget: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/budget`, data),
  toggleOrdinance: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/ordinance`, data),
  issueBond: (gameId: string, amount: number) =>
    request('POST', `/api/games/${gameId}/bond`, { amount }),
  attackRival: (gameId: string, data: any) =>
    request('POST', `/api/games/${gameId}/attack`, data),
  endMonth: (gameId: string) =>
    request('POST', `/api/games/${gameId}/endMonth`),
  submitCheat: (gameId: string, code: string) =>
    request('POST', `/api/games/${gameId}/cheat`, { cheat_code: code }),

  // Kontsultak
  getOverlay: (gameId: string, type: string) =>
    request('GET', `/api/games/${gameId}/overlay/${type}`),
  getStats: (gameId: string) =>
    request('GET', `/api/games/${gameId}/stats`),
  getScenarios: () =>
    request('GET', '/api/scenarios'),
};
```

---

## TYPESCRIPT MOTAK

Kontsultatu SPECS.md § 1 datu eredu osoetarako. TypeScript interfazeak sortu eredu horiek zehatz islatzen dituztenak:

```typescript
// types/game.ts — Sortu interfazeak:
interface User { ... }
interface Tile { ... }
interface Zone { ... }
interface Building { ... }
interface Infrastructure { ... }
interface Budget { ... }
interface Ordinance { ... }
interface Disaster { ... }
interface CityState { ... }
interface GameState { ... }
interface Scenario { ... }
interface AIAction { ... }
interface OverlayData { ... }
interface CheatResponse { ... }
```

---

## ESTILO BISUALA

- **Gaia**: Hiri-eraikuntza isometrikoa, argia eta koloretsua
- **Oinarri koloreak**: Zuria (#f0f0f0), berde arina (#a8d5ba), urdin arina (#87ceeb), hori leuna (#f5f5dc)
- **Zona koloreak**: Erresidentziala=berde (#4caf50), Komertziala=urdin (#2196f3), Industriala=hori (#ffeb3b)
- **Letrak**: Sans-serif interfazerako, monoespaciada datu numerikoetarako
- **Elementuak**: Botoiak borobilduak, panel zuriz itzaldun arinak, tooltip informatibo
- **Mapa**: Bista isometrikoa 2:1 ratio, laukiek 64x32 pixel dimentsioekin
- **Ikonoak**: AA bidez sortuak edo pixel art, AA bidez sortuak "ai-generated" karpetan etiketatuak

---

## TALDEKO MODULU ESPEZIFIKOA

Kontsultatu SPECS.md § 6 zure taldeari esleitutako moduluaren eskakizunetarako. Frontend-ak dagokion interfazea inplementatu behar du:

| Taldea | Modulua | Frontend gehigarria |
|--------|---------|---------------------|
| 1 | Hondamendiak | Hondamendi animazioak (sutea hedatzen, tornadoa, lurrikara), kaltea txostena bisuala |
| 2 | Garraio Aurreratua | Trafiko bero-mapa, garraio publiko ibilbideak, kongestio adierazleak |
| 3 | Ordenantzak | Ordenantza panel osoa 20+ elementurekin, efektu aurreikuspena |
| 4 | Arkologiak | Arkologia eraiki botoia, irteera animazioa (espaziora abiatzen), desblokeo adierazlea |
| 5 | Egunkaria | Egunkari popup osoa, urtero automatikoa, inkesta bistaratzea, AA sortutako edukia |
| 6 | Auzokide Hiriak | Maparen ertzeko konexioak, auzokide panela, saldaketa akordio interfazea |
| 7 | Ur Sistema | Lurpeko bista hobetua, ur presio mapa, ur-ponpa eraginkortasun adierazlea |
| 8 | Hezkuntza & Osasuna | EQ/HQ grafiko dinamikoak, hezkuntza/osasun zerbitzu panela xehatua |
| 9 | Lurralde Sistema | Altuera tresnak (igo/jaitsi/berdindu), zuhaitz jartzea, ur-jauzi bistaratzea |
| 10 | Energia Aurreratua | Zentral elektriko zahartzea adierazlea, brownout bistaratzea, teknologia denbora-lerroa |

---

## GARAPEN ARAUAK

1. **Kontsultatu SPECS.md** edozein endpoint edo osagai inplementatu aurretik
2. **Ez asmatu datuak** — erabili SPECS.md-ko eredu zehatzak
3. **Feedback bisuala**: Erabiltzailearen ekintza orok feedback berehalakoa izan behar du (kargatzea, arrakasta, errorea)
4. **Berrerabili osagaiak**: Panel, Modal, Button, Tooltip, Slider osagai partekatuak izan behar dute
5. **HTTP erroreen kudeaketa**: Harrapatu eta erakutsi erroreak modu atseginez
6. **JWT**: localStorage-n gorde, header-etan bidali, 401 jasotzen bada login-era birbideratu
7. **Ctrl+Tab trikimailu kontsola**: GamePage-tik funtzionatu behar du, tekla entzulea inplementatu
8. **AA baliabideak**: AA bidez sortutako baliabide bisual guztiak `/assets/ai-generated/` karpetan etiketatuak

---

## CHECKLIST — ENTREGATU AURRETIK

- [ ] Login/Register funtzionalak errore feedbackarekin
- [ ] GameListPage partida zerrenda eta partida berria sortzeko aukerarekin
- [ ] Mapa isometrikoa zonak, eraikinak eta azpiegiturak zuzen errendatzen ditu
- [ ] Zona jarrtzea drag-to-paint bidez funtzionatzen du
- [ ] Eraikin eta azpiegitura jartzea intuitiboa da
- [ ] BudgetPanel slider guztiekin eta hileko laburpenarekin
- [ ] Datu gainjarriak mapa gainean kolorezko degradatu gisa erakusten dira
- [ ] RCI eskari barra beti ikusgai dago
- [ ] Lurpeko bista ur-hodiak eta metroa erakusten ditu
- [ ] AA txandaren bistaratzea gutxienez modu 1ean funtzionatzen du
- [ ] RivalCityView aurkari hiriaren metrikak erakusten ditu
- [ ] DisasterPanel eraso bidalketa eta cooldown adierazlearekin
- [ ] CheatConsole funtzionala Ctrl+Tab bidez
- [ ] Hiri-eraikuntza estetika koherentea
- [ ] Nabigatzailearen kontsotan errorerik gabe
- [ ] Taldeko modulu espezifikoa inplementatuta
- [ ] Dockerfile funtzionala
