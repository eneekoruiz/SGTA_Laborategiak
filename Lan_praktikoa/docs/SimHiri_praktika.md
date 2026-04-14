# PRAKTIKA: SimHiri WEB APLIKAZIOAREN GARAPENA

## 1. DESKRIBAPEN OROKORRA

Praktika honetan SimCity 2000 joko klasikoan inspiratutako hiri-eraikuntza simulazio joko baten web aplikazioa garatuko da. **Proiektu hau guztiz hezkuntzarakoa da** eta ez du marka erregistratuen aurka jotzeko asmorik. Jokoaren mekanika SimCity 2000 joko klasikoaren inspiraziotik dator, interfaze grafikoa 2D grafiko isometrikoak erabiliz diseinatuko da. Jokoak erabiltzaileei erregistratzeko, hiriak kudeatzeko eta GroQ/GitHub Models hizkuntza-ereduekin bultzatutako adimen artifizialak kudeatzen duen aurkari hiri baten aurka lehiatzeko aukera emango die.

Joko originalean ez bezala (denbora errealekoa dena), web bertsio honek **hileko tick sistema** bat erabiliko du: jokalari bakoitzak (gizakia eta AA) bere erabakiak hartzen ditu (zonak jarri, azpiegiturak eraiki, aurrekontua doitu, ordenantzak aktibatu) eta ondoren hilabete bat aurreratzen da, simulazioak hiriaren egoera kalkulatzen duelarik (biztanle hazkundea, RCI eskaria, diru-sarrerak/gastuak, zerbitzuen estaldura, etab.).

Proiektua 3 pertsonako talde batek garatzeko diseinatuta dago, bakoitzak rol espezifiko bana duelarik: Frontend Developer, Backend Developer eta AI/ML Specialist. Egitura honek lanaren banaketa orekatua ahalbidetuko du eta sistemaren osagai ezberdinen garapen paraleloa erraztuko du.

## 2. HELBURUAK

* JavaScript/TypeScript-eko frontend eta Python-eko backend-arekin web aplikazio funtzional bat garatzea
* Hiri-eraikuntza simulazio joko klasikoetan inspiratutako interfaze grafiko isometriko bat inplementatzea
* Hileko tick sistema bat diseinatzea denbora errealeko joko baten mekanikak web ingurunera egokitzeko
* GroQ/GitHub Models adimen artifiziala integratzea aurkari hiri-kudeatzaile gisa
* Web garapena, API-ak, eta bezero-zerbitzari komunikazioaren ezagutzak aplikatzea
* AA generatiboa erabiltzea baliabideak sortzeko (irudiak, mapak, soinuak) helburu hezigarrietarako soilik
* Simulazio sistema konplexuak (ekonomia, azpiegiturak, zerbitzuak) inplementatzeko trebetasunak garatzea

## 3. FUNTZIONALITATE ESKAKIZUNAK

### 3.1. Erabiltzaile eta Partida Sistema

#### Erabiltzaileen Kudeaketa
* Erabiltzaile erregistro eta autentikazio sistema
* Kredentzialen biltegiratze segurua
* Oinarrizko erabiltzaile profilak
* Joko saio iraunkorrak

#### Partiden Kudeaketa
* Partidak eskuz gordetzea edozein momentutan
* Hilabete bakoitzaren amaieran auto-gordetzeko sistema
* Gordetako partidak kargatzea
* Erabiltzaileko partida erabilgarriak zerrendatzea
* Partidak JSON formatuan gordetzea
* Eszenatokien aukeraketa partida berri bat hastean (lurralde ezberdinak)

### 3.2. Joko Sistema

#### Hileko Tick Mekanika
* Jokoa hilabeteka garatuko da: jokalariaren hilabetea → simulazioa → AA-ren hilabetea → simulazioa
* Hilabete bakoitzak fase hauek barneratuko ditu:
  - **Zonifikazio fasea**: Erresidentzial, Komertziala edo Industriala zonak jarri (arin edo trinkoa)
  - **Azpiegitura fasea**: Errepideak, trenbideak, energia lineak eta ur-hodiak jarri
  - **Eraikuntza fasea**: Zerbitzu eraikinak (polizia, suhiltzaileak, ospitaleak, eskolak), zentral elektrikoak eta garraio-azpiegiturak eraiki
  - **Aurrekontu fasea**: Zerga tasak doitu (R/C/I banaka), sailkako finantzaketa doitu
  - **Ordenantza fasea**: Hiri ordenantzak aktibatu edo desaktibatu
  - **Aurrerapen fasea**: Hilabetea aurreratu → simulazio motorrak kalkulatzen du: biztanle hazkundea, RCI eskaria, diru-sarrerak/gastuak, zerbitzu estaldura, kutsadura, krimena, lur-balioa
* Urtarrilean aurrekontua berriz kalkulatzen da urterako

#### Eszenatokiak
* Gutxienez eszenatoki jokagarri oso bat inplementatu behar da
* Eszenatoki bakoitzak hauek izan behar ditu:
  - Altuera sistema duen lurralde mapa bat (itsasoa, ibaiak, mendiak, lautadak)
  - Hasierako diru kopurua zailtasun mailaren arabera (§20.000 erreza, §10.000 ertaina, §5.000 zaila)
  - Hasierako urtea (normalean 1900)
  - Aurkari AA hirirako kokapena mapa ertzean
  - Lurralde berezitasunak (ur iturburuak, zuhaitzak)

#### Hiriaren Kudeaketa
* Jokalari bakoitzak (gizakia eta AA) hiri bat kudeatzen du mapa berdinean
* Hiri bakoitzak ezaugarri hauek ditu:
  - Zonifikazioa (Erresidentziala, Komertziala, Industriala — arin eta trinkoa)
  - Azpiegitura sarea (errepideak, energia, ura)
  - Zerbitzu eraikinak (polizia, su, osasun, hezkuntza)
  - Aurrekontu sistema (zergak, sailkako finantzaketa, bonuak)
  - Biztanleria, krimena, kutsadura, lur-balioa eta beste metrika guztiak

#### Ekonomia eta Aurrekontu Sistema
* Diru-sarrerak:
  - Jabetza zergak (R/C/I banaka, %0-%20 tartean, lehenetsia %7)
  - Ordenantzen bidezko diru-sarrerak (joko legalizazioa, etab.)
* Gastuak:
  - Sailkako finantzaketa (Garraioa, Polizia, Suhiltzaileak, Osasuna, Hezkuntza): %0-%100+ sliding
  - Azpiegitura mantentzea
  - Ordenantzen kostuak
* Bonuak: Dirua maileguan hartu (~§10.000 bonu bakoitzeko, %20ko interesa ~20 urteko epean, gehienez 10 bonu)
* Urteroko aurrekontua Urtarrilean berriz kalkulatzen da

### 3.3. Mapako Elementuak

#### Zonak
* 6 zona mota:
  - Erresidentzial Arina (§5/lauki) eta Trinkoa (§10/lauki)
  - Komertziala Arina (§5/lauki) eta Trinkoa (§10/lauki)
  - Industriala Arina (§5/lauki) eta Trinkoa (§10/lauki)
* Zonak garatzeko baldintzak: energia, ura, errepide sarbidea (~3 lauki tartean)
* Zonak mailatan hazten dira (1x1 → 2x2 → 3x3 eraikinei) baldintzen arabera
* Zona abandonatuak (kutsadura altua, krimena, energia/ur falta)

#### Azpiegiturak
* **Errepideak** (§10/lauki): Oinarrizko garraioa. Beharrezkoa zona garapenerako.
* **Energia lineak** (§2/lauki): Elektrizitatea zentral elektrikoetatik zonetara transmititzen dute. Energia alboko garapen-lauki guztietatik hedatzen da.
* **Ur-hodiak** (§1/lauki): Lurpeko sarea. Ur-ponpak zonetara konektatzeko. Lurpeko bistan jartzen dira.
* **Trenbideak** (§3/lauki + §500 geltokia): Garraio masa. Trafiko murrizten du.

#### Eraikinak eta Zerbitzuak

##### Zentral Elektrikoak
| Zentrala | Kostua | Potentzia (MW) | Kutsadura | Eskuragarri | Iraupena |
|-----------|--------|----------------|-----------|-------------|----------|
| Ikatza | §4.000 | 200 | Altua | 1900 | 50 urte |
| Hidroelektrikoa | §400/lauki | 20/presa | Ezer ez | 1900 | Betikoa |
| Petrolioa | §6.500 | 220 | Ertain-altua | 1900 | 50 urte |
| Gas naturala | §2.000 | 50 | Baxua | 1950 | 50 urte |
| Nuklearra | §15.000 | 500 | Ezer ez* | 1955 | 50 urte |
| Haize-errota | §100 | 4 | Ezer ez | 1980 | Betikoa |
| Eguzki-energia | §1.300 | 50 | Ezer ez | 1990 | 50 urte |
| Mikrouhin | §28.000 | 1.600 | Ezer ez | 2020 | 50 urte |
| Fusioa | §40.000 | 2.500 | Ezer ez | 2050 | 50 urte |

*Nuklear zentralak erradiazio kutsadura sor dezakete hondamendi kasuan.
Zentral elektrikoak 50 urte eta gero lehertzen dira (hidroelektrikoa eta haize-errota izan ezik).

##### Hiri Zerbitzuak
| Zerbitzua | Kostua | Estaldura | Efektua |
|-----------|--------|-----------|---------|
| Polizia Etxea | §500 | ~15-20 lauki | Krimena murrizten du |
| Suhiltzaile Parkea | §500 | ~15-20 lauki | Sute arriskua murrizten du |
| Ospitalea | §500 | Hiri osoa | Osasun Koefizientea (HQ) hobetzen du |
| Kartzela | §3.000 | Hiri osoa | Krimena murrizten du |

##### Hezkuntza Eraikinak
| Eraikina | Kostua | Efektua |
|----------|--------|---------|
| Eskola | §250 | Gazteak hezten ditu, Hezkuntza Koefizientea (EQ) igotzen du |
| Unibertsitatea | §1.000 | Goi hezkuntza, EQ gehiago igotzen du |
| Liburutegia | §500 | Hezkuntza osagarria, EQ apur bat igotzen du |
| Museoa | §1.000 | Kultura/hezkuntza, EQ lagungarria |

##### Garraio Azpiegiturak
| Garraioa | Kostua | Funtzioa |
|----------|--------|---------|
| Errepidea | §10/lauki | Oinarrizko garraioa |
| Autobidea | §25/lauki | Ahalmen handiagoa |
| Autobide Sarrera | §25 | Autobidea errepidearekin konektatu |
| Autobus Geltokia | §250 | Errepide trafikoa murrizten du |
| Trenbide Geltokia | §500 | Bizilagunentzako trena |
| Metroa | §5/lauki (tunela) + §500 (geltokia) | Lurpeko garraio masa |
| Aireportua | Zona gisa | Merkataritza hazkundea sustatzen du |
| Portua | Zona gisa | Industria merkataritza ahalbidetzen du |

#### Lurraldea
* Lauki bakoitzak altuera maila du (0-31)
* Eraikinak lur lau gainean bakarrik jar daitezke
* Ura itsas mailaren azpitik betetzen da
* Zuhaitzak jar daitezke (§3/lauki) — kutsadura murriztu, lur-balioa igo
* Lurpeko geruza ur-hodiak eta metroa ikusteko

### 3.4. Lehia Sistema

SimCity 2000-n ez dago borroka militarrik. Hiri-eraikuntza jokoa izanik, lehia **hiri metriken arabera** eta **hondamendi erasoen bidez** gauzatzen da.

#### Metrika Lehia
* Bi hiriak (jokalariaren eta AA-rena) ondorengo metriketan lehiatzen dira:
  - **Biztanleria**: Hiriaren tamaina
  - **Hezkuntza Koefizientea (EQ)**: Eskola, unibertsitate, liburutegi eta museoen araberakoa
  - **Osasun Koefizientea (HQ)**: Ospitale eta kutsadura mailaren araberakoa
  - **Alkatearen Onarpena**: Herritarren gogobetetasuna
  - **Altxorra**: Hiriaren diru kopurua
  - **Lur-balioa**: Batez besteko lur-balioa
* Puntuazio konposatua: Biztanleria %40 + EQ %15 + HQ %15 + Lur-balioa %15 + Krimena baxua %10 + Kutsadura baxua %5

#### Hondamendi Erasoak
* Jokalariak (eta AA-k) aurkariaren hiriari hondamendiak eragin diezazkioke:
  - Eraso bakoitzak kostu ekonomiko bat du (§5.000 - §50.000)
  - Hilabeteko eraso kopurua mugatuta dago (gehienez 1 erasoa 6 hilabetero)
  - Eraso motak: Suteak, Tornadoreak, Lurrikarak, Uholdeak (eraso bakoitzak kostu eta kalte maila ezberdina du)
* Defentsa: Suhiltzaileen estaldura onak kaltearen %50 murriztu dezake

#### Garaipena Baldintzak
| Garaipena | Baldintza |
|-----------|-----------|
| **Populazio Garaipena** | Lehenengo hiria 100.000 biztanlera iristen dena irabazten du |
| **Puntuazio Garaipena** | 100 joko-urteko (1.200 txanda) ondoren, puntuazio konposatu altuena duen hiria irabazten du |
| **Aurkariaren Porrot Ekonomikoa** | Aurkariaren altxorra < -§100.000 12 hilabete jarraian → Irabazi duzu |
| **Zure Porrot Ekonomikoa** | Zure altxorra < -§100.000 12 hilabete jarraian → Galdu duzu (Game Over) |
| **Arkologia Irteera** | *(4. taldeko modulua soilik)* 50+ Jaurtiketa Arkologia eraiki → Irteera gertaera → Garaipen berezia |

### 3.5. Adimen Artifiziala

* GroQ/GitHub Models modeloen bitartez AA aurkari hiri kudeatzaile bat implementatzea
* AA-k ondorengoa egin beharko du:
  - Bere hiriaren egoeraren informazioa JSON formatuan jaso
  - Jokalariaren hiriari buruzko informazio mugatua jaso (biztanleria, puntuazioa — baina ez xehetasun guztiak)
  - Hiri kudeaketa erabakiak hartu: zonifikazioa, eraikuntza, aurrekontua, ordenantzak
  - Hondamendi erasoak estrategikoki erabaki
  - Jokoaren arauak errespetatu (aurrekontu mugak, eraikuntza baldintzak)
  - Jokalariari erronka egoki bat eskaini
* Hainbat modeloentzako ordezko sistema:
  - Hainbat GroQ/GitHub Models endpoint konfiguratzea
  - Aldaketa automatikoa 429 erroreetan (token muga)
  - Ereduen artean aldatzean testuingurua mantentzea
* AA alkate nortasun ezberdinak (hedatzailea, ekologista, industrialista, orekatua, zerga-biltzailea)

### 3.6. Trikimailu Modua

* Probak errazteko trikimailu kode sistema bat implementatzea
* Jokalariak Ctrl+Tab sakatuz txat leihoa aktibatu dezake mapan
* Ondorengo kodeak sartzeak berehalako efektuak izango ditu:
  - **diru_asko** — Altxorra §1.000.000-ra igotzen da
  - **zona_guztiak** — Zona guztiak berehalakoan garatzen dira maila maximora
  - **hondamendi_bat** — Ausazko hondamendi bat gertatzen da zure hirian
  - **energia_mugagabea** — Energia mugagabea hiri osorako
  - **populazio_maximoa** — Biztanleria 10.000 biztanle igotzen da berehalakoan
  - **zerga_zero** — Zergak %0-ra jaisten dira ondorio negatibo gabe (eskaria ez da murrizten)
  - **arkologia_ireki** — Arkologiak desblokeatzen dira (soilik 4. taldeko modulurako)
  - **eraiki_dena** — Zerbitzu eraikin guztiak berehalakoan eraikitzen dira
  - **garaipena** — Partida berehala irabaztea
  - **porrota** — Partida berehala galtzea
* Kodeak log batean erregistratu behar dira arazketa errazteko
  - Produkzio ingurunean kodeak desaktibatzeko aukera egon behar da

## 4. ESKAKIZUN TEKNIKOAK

**GARRANTZITSUA!**: Talde bakoitzari frontend eta backend teknologia konbinazio espezifiko bat esleituko zaio. **Guztiz derrigorrezkoa da bakarrik esleitutako teknologiak erabiltzea**. Betekizun hau betetzen ez duten proiektuak **EZ DIRA EBALUATUKO**, haien funtzionalitatea edo kalitatea edozein izanda ere.

### 4.1. Teknologien eta Moduluen Esleipena Taldeka

| Taldea | Frontend | Backend | Modulu Berezia |
|--------|----------|---------|----------------|
| 1 | React | Flask | Hondamendiak |
| 2 | React | FastAPI | Garraio Aurreratua |
| 3 | Angular | Flask | Ordenantzak |
| 4 | Angular | FastAPI | Arkologiak |
| 5 | Vue | Flask | Egunkaria |
| 6 | Vue | FastAPI | Auzokide Hiriak |
| 7 | Svelte | Flask | Ur Sistema |
| 8 | Svelte | FastAPI | Hezkuntza & Osasuna |
| 9 | React | Flask | Lurralde Sistema |
| 10 | Vue | FastAPI | Energia Aurreratua |
| 11 | Angular | Flask | Hondamendiak |
| 12 | Svelte | FastAPI | Garraio Aurreratua |

Oinarrizko jokoaz gain, talde bakoitzak **modulu espezifiko bakarra** inplementatu behar du, mekanikak zabaltzen dituena. Moduluen deskribapen xehatuak 9. sekzioan daude.

### 4.2. Frontend

* Esleitutako frontend teknologia hauetako bat izango da:
  - React
  - Angular
  - Vue
  - Svelte
* TypeScript erabiltzea gomendatzen da kodearen sendotasuna hobetzeko
* Node.js ingurunea dependentziak eta build kudeatzeko
* Ondorengo bisten inplementazioa:
  - **Hiri mapa bista** (isometrikoa): Zonak, eraikinak, azpiegiturak, lurraldea
  - **Lurpeko bista**: Ur-hodiak eta metro tunelak
  - **Aurrekontu panela**: Zerga tasak, sailkako finantzaketa, bonuak, ekonomia laburpena
  - **Zona tresna-barra**: R/C/I arin/trinkoa hautatzailea
  - **Datu gainjarriak**: Krimena, kutsadura, lur-balioa, trafikoa, energia, ur estaldura
  - **Aurkari hiriaren bista**: AA-ren hiriaren egoera ikusteko
  - **RCI eskari adierazlea**: Erresidentzial/Komertziala/Industriala barra grafikoa
* Hiri-eraikuntza joko klasikoetan inspiratutako interfaze grafiko originala:
  - Estilo bisual koherentea isometrikoa (panelak, ikonoak, etab.)
  - 2D grafiko originalak edo AA bidez sortuak (etiketa egokiarekin)
  - Oinarrizko animazioak (eraikuntza, hondamendiak)

### 4.3. AA-ren Txandaren Bistaratze Sistema

* AA-ren txandarako bistaratze modua bi aukera inplementatuekin:
  - **1. Aukera - Bista aldaketa**: AA-ren txanda iritsitakoan, jokalariaren bista aldi baterako AA-ren hirira aldatzen da, ekintzak denbora errealean erakutsiz. AA-ren txanda amaitzean, jokalariaren hirira itzultzen da.
  - **2. Aukera - Pantaila zatitua**: AA-ren txandan, pantaila bi zatitan banatzen da:
    * Ezkerraldea: Jokalariaren hiriaren bista (estatikoa)
    * Eskuinaldea: AA-ren hiriaren bista (dinamikoa) ekintzak erakutsiz
* AA-ren ekintzen bistaratze argi eta zehatza:
  - Zona berrien jartzea kolore nabarmenduekin
  - Eraikin berrien eraikuntza animazioa
  - Aurrekontu aldaketen adierazleak
  - Hondamendi erasoen bistaratze dramatikoa
* AA-ren ekintzen bistaratze abiaduraren kontrola (normal, azkarra, bat-batekoa)
* Zehaztasuneko bistaratze hau aktibatu/desaktibatzeko aukera

### 4.4. Backend

* Esleitutako backend teknologia hauetako bat izango da:
  - Flask
  - FastAPI
* REST API inplementazioa honetarako:
  - Jokoaren egoeraren kudeaketa
  - Autentikazioa eta erabiltzaile kudeaketa
  - Partidak gordetzea eta kargatzea
  - Hileko tick simulazio motorra
  - GroQ/GitHub Models modeloekin komunikazioa
* Autentikazio sistema liburutegi finkatu eta frogatuetan oinarritua:
  - JWT autentikazio tokenetarako
  - OAuth2 FastAPI/Flask luzapenen bidez
  - Auth0, Firebase Authentication, etab. bezalako zerbitzuak erabiltzeko aukera

### 4.5. LLM Deietarako Osagaia

* GroQ/GitHub Models modeloekin interakziorako modulu espezifikoa
* Funtzionalitateak:
  - Hiri kudeaketaren deskribapena duten prompt-en prestaketa
  - Hiriaren uneko egoera JSON formatuan bidaltzea
  - Erantzunen kudeaketa (zonak, eraikinak, aurrekontua, ordenantzak, erasoak)
  - Erroreen kudeaketa eta ordezko modeloetara aldatzea
  - Erabilitako token kopuruaren kontrola

### 4.6. Osagaien arteko Komunikazioa

* Frontend → Backend:
  - HTTP REST eskaeren bidezko komunikazioa
  - JSON formatua datuen trukerako
  - Jokoko ekintza guztietarako endpoint-ak (zonifikazioa, eraikuntza, aurrekontua, ordenantzak, hondamendi erasoa)

* Backend → LLM:
  - GroQ/GitHub Models API-ra deiak
  - Hiriaren deskribapena eta arauak dituen hasierako prompt-a
  - AA-rentzat ikusgai den egoeraren eguneratzea (jokalariaren hiriari buruzko informazio mugatua)
  - Erantzunak hiri kudeaketa ekintzetara itzultzeko prozesatzea

* LLM → Backend:
  - Erantzunak JSON formatuan jasotzea
  - Proposatutako ekintzen balidazioa (aurrekontu mugak, eraikuntza baldintzak)
  - Ekintza baliozkoen inplementazioa

* Backend → Frontend:
  - Ekintzen emaitzak dituzten HTTP erantzunak
  - Gertaeren jakinarazpenak (WebSockets aukeran)
  - Jokoaren egoeraren eguneraketak

## 5. SISTEMAREN ARKITEKTURA

### 5.1. Osagaiak

Sistema lau osagai nagusik osatuko dute, bakoitza bere Docker edukiontzi bereiziean:

1. **Frontend**: React/Angular/Vue/Svelte-n oinarritutako web aplikazioa
2. **Backend**: Flask/FastAPI-n REST API-a
3. **MongoDB datu-basea**: Erabiltzaileen, partiden eta eszenatokien biltegiratzerako
4. **AA Zerbitzua**: GroQ/GitHub Models modeloetarako deiak kudeatzeko osagaia

### 5.2. Osagaien arteko Komunikazioa

* Frontend → Backend:
  - HTTP REST eskaeren bidezko komunikazioa
  - JSON formatua datuen trukerako
  - Jokoko ekintza guztietarako endpoint-ak

* Backend → MongoDB:
  - Erabiltzaile datuen biltegiraketa
  - Gordetako partiden eta auto-gordetzeen iraunkortasuna
  - Eszenatoki erabilgarrien kudeaketa

* Backend → AA Zerbitzua:
  - AA-ren erabakiak lortzeko eskaerak
  - Eredu ezberdinen arteko aldaketen kudeaketa
  - Jokoaren testuinguruaren eguneratzea

* AA Zerbitzua → GroQ/GitHub Models:
  - GroQ/GitHub Models kanpoko API-ra deiak
  - Tokenen eta API-aren mugaketen kudeaketa
  - Erantzunen prozesatzea

## 6. HEDAPENA

* Docker bidezko edukiontzi osoa:
  - Frontend-erako Dockerfile
  - Backend-erako Dockerfile
  - AA Zerbitzurako Dockerfile
  - Orkestraziorako Docker Compose

* Hedapen eskakizunak:
  - Ingurune aldagaien bidezko konfigurazioa
  - Datuen iraunkortasuna (Docker bolumenak)
  - Hedapen prozesurako dokumentazio argia

* Exekuzio jarraibideak:
  - Biltegi klonaketa
  - Ingurune aldagaiak konfiguratu (.env)
  - `docker compose up --build` exekutatu
  - Aplikaziora nabigatzaile bidez sartu

## 7. AA BIDEZ SORTUTAKO BALIABIDEAK

* AA generatiboa erabiltzea honetarako:
  - Eraikinen eta zoneen irudiak (isometrikoak)
  - Maparako lursailak (belarra, ura, mendiak, zuhaitzak)
  - Azpiegituren ikonoak (errepideak, energia lineak, hodiak)
  - Oinarrizko soinu efektuak (aukeran)
  - Atzeko musika (aukeran)

* Sortze prozesuaren dokumentazioa:
  - Erabilitako prompt-ak
  - Erabilitako tresnak
  - Aplikatutako post-prozesatzea

### 7.1. AA Bidez Edukia Sortzeko Baliabide Gomendatuak

Kostu handiegiak sortu gabe baliabideak sortzea errazteko, ondorengo tresnak gomendatzen dira. **Garrantzitsua da AA bidez sortutako baliabide guztiek adierazpen argi bat eramatea, helburu hezigarrietarako soilik AA bidez sortu direla adieraziz**, bai metadatuetan zein proiektuaren dokumentazioan.

#### AA bidez sortutako baliabideentzako adierazpen beharrezkoak
* "AA bidez sortua SimHiri hezkuntza proiekturako" esaldia gehitzea hemen:
  - Fitxategi bakoitzaren metadatuetan ahal denean
  - Irudien beheko eskuin aldean (tamaina txikian baina irakurgarria)
  - Sortutako baliabide guztien zerrendarekin dokumentazio teknikoan
  - Baliabide hauek erabiltzen direnean kodean iruzkinekin
* Audio fitxategientzat, ohar labur bat README-n eta dokumentazioan jartzea
* Karpeta bereizi bat mantentzea (adib: `/assets/ai-generated/`) AA bidez sortutako baliabide guztientzat

#### Irudiak eta Grafikoak
* **Stable Diffusion** (inplementazio lokala edo Google Colab doakoaren bidez)
* **Leonardo.ai** (plan doakoa, sortze-kopuru mugatuekin)
* **Midjourney** (oinarrizko harpidetza hilabetez, taldean partekatuta)
* **DALL-E mini / Craiyon** (doakoa, kalitate baxuagokoa)
* **Bing Image Creator** (doakoa eguneko muga batekin)
* **RunwayML** (bertsio doakoa mugak dituena)

#### Sprite-ak eta Lursailak (Isometrikoak)
* **PixelMe** (sprite pixelatuak sortzeko)
* **Pixelicious** (irudiak pixel art estilora eraldatzeko)
* **Pixelorama** (sortutako irudiak fintzeko doako editorea)

#### Musika eta Soinu Efektuak
* **AIVA** (bertsio doakoaren muga batzuekin)
* **Mubert** (oinarrizko soinu efektuetarako plan doakoa)
* **Soundraw** (proba epea)
* **Riffusion** (Stable Diffusion-en oinarritutako musika sorkuntza, kode irekikoa)
* **FreeSound** (lizentzia libreko soinu efektuen liburutegia)

#### Bihurketa eta Post-prozesatzea
* **GIMP** (irudiak doitzeko doako editorea)
* **Inkscape** (ikonoetarako doako editore bektoriala)
* **Audacity** (audioa editatzeko doako programa)

Tresna hauek guztiek aukera doakoak edo kostu baxukoak eskaintzen dituzte, proiektuaren helburua betetzeko nahikoak direnak.

## 8. LANAREN ANTOLAKETA

### 8.1. Rol eta Erantzukizunen Banaketa

3 pertsonako talde bat izanik, ondorengo rol banaketa gomendatzen da:

#### 1. Rola: Frontend Developer
* Erantzukizunak:
  - Erabiltzaile-interfazearen inplementazio osoa
  - Diseinu bisual isometrikoa SimCity 2000-en inspiratuta
  - Backend-aren API-arekin integrazioa
  - Bista ezberdinen inplementazioa (hiri mapa, lurpeko bista, aurrekontua, datu gainjarriak)
  - Erabiltzaile eta partida kudeaketarako interfazea
  - AA bidez baliabide bisualen sortzea eta egokitzea
  - AA-ren txandaren bistaratze sistemaren inplementazioa
  - Trikimailu moduaren interfazearen garapena

#### 2. Rola: Backend Developer
* Erantzukizunak:
  - REST API-aren diseinua eta inplementazioa
  - Hileko tick simulazio motoraren logika (RCI eskaria, hazkundea, zerbitzuak, ekonomia)
  - Energia eta ur sare hedapenaren algoritmoak
  - Kutsadura, krimena eta lur-balioaren simulazioa
  - Autentikazioa eta erabiltzaile kudeaketa
  - MongoDB-rekin integrazioa
  - Docker-ekin hedapenaren konfigurazioa
  - Trikimailu moduaren logikarako inplementazioa

#### 3. Rola: AI/ML Specialist
* Erantzukizunak:
  - GroQ/GitHub Models modeloekin integrazioa
  - AA hiri kudeatzailerako prompt eta datu formatuaren diseinua
  - AA alkate nortasunen inplementazioa
  - Hainbat eredu eta ordezko sistemaren kudeaketa
  - Edukiaren sortzea (egunkari titularrak, aholkulari esaldiak) AA bidez
  - Partidak gorde/kargatzeko datu egitura
  - Sistemaren dokumentazioa eta erabiltzaile manuala
  - AA-ren portaera optimizatzea hiri kudeaketa estrategiak simulatzeko

### 8.2. Garapen Plan Gomendatua

| Astea | 1. Rola (Frontend) | 2. Rola (Backend) | 3. Rola (AI/ML) |
|-------|---------------------|-------------------|------------------|
| 1 | Hasierako UI diseinua eta isometriko bista prototipoa | API diseinua eta datu ereduak | GroQ/GitHub Models-en ikerketa |
| 2 | Erregistro/login + mapa bista oinarrizkoa | MongoDB + autentikazioa + zona/eraikin ereduak | JSON partida formatuaren diseinua |
| 3 | Zona tresna-barra + datu gainjarriak | Hileko tick motorra (RCI, hazkundea) | Prompt diseinua + alkate nortasunak |
| 4 | Aurrekontu panela + lurpeko bista | Energia/ur sare algoritmoak + aurrekontu logika | GroQ/GitHub Models integrazioa |
| 5 | Aurkari bista + hondamendi bistaratze + trikimailu sistema | Hondamendi sistema + lehia logika + garaipena | Eredu anitzeko ordezko sistema |
| 6 | AA txandaren bistaratzea + fintzea | Docker hedapena + optimizazioa | Dokumentazioa + eduki sortzea |

### 8.3. Taldearen Koordinazioa

Taldekideen artean koordinazio mekanismoak ezartzea ezinbestekoa da:

* Asteko jarraipen bilerak
* Proiektu kudeaketa tresnen erabilera (Trello, Jira, etab.)
* Git bidezko bertsio kontrola eta integrazio pull request-en bidez
* Erabaki teknikoen dokumentazio partekatua
* Hasieran adostutako kode estandarrak eta konbentzioak

## 9. TALDEKO MODULU ESPEZIFIKOAK

Talde bakoitzak oinarrizko jokoaz gain, **modulu espezifiko bakarra** inplementatu behar du jokoaren mekanikak zabaltzen dituena. Moduluek hiru rolen arteko lan koordinatua eskatzen dute. Modulu bakoitzaren zehaztapen teknikoak (endpoint-ak, datu-ereduak, formulak eta onarpen irizpideak) SPECS.md §6 dokumentuan daude.

### 9.1. 1. Modulua: Hondamendiak (1. Taldea)

Hondamendi sistema zehatza inplementatu, oinarrizko nukleotik haratago.

* **Mekanika**:
  - 10+ hondamendi mota: sutea, uholdea, tornadoa, lurrikara, istiluak, munstroa, UFO, sumendian, meteoroa, fusio nuklearra
  - Hondamendi hedapena: suteak lauki batetik bestera hedatzen dira haize- eta dentsitate-faktoreen arabera
  - Suhiltzaileen estaldura kaltea murrizteko mekanismoa
  - Lurrikara osteko birgaikuntza (aftershock) %30 probabilitatearekin
  - Berreskuratze kostua: jatorrizko eraikinaren kostuaren %50
  - Hondamendi historia erregistroa
  - Nuklear hondamendiak erradiazio zona sortzen du (120 hilabetez)

* **Frontend**: Hondamendi animazioak (suaren hedapena, uholdea...), hondamendi historia bista, kalte txostenen panela, erradiazio gainjarria
* **Backend**: Hondamendi hedapen algoritmoa, kalte kalkuluak, berreskuratze logika, historia erregistroa
* **LLM**: AA-k hondamendi erasoak estrategikoki erabiltzen ditu aurkariari kalte handiena eragiteko

### 9.2. 2. Modulua: Garraio Aurreratua (2. Taldea)

Garraio sistema aurreratua trafiko simulazioarekin.

* **Mekanika**:
  - Trafiko simulazioa: errepide bakoitzeko kongestio maila kalkulatua
  - Garraio publiko motak: autobusa (depositu bidez), trena (geltoki bidez), metroa (lurpeko geltoki bidez)
  - Garraio publiko bakoitzak trafiko murrizteko eragin ezberdina du
  - Autobidea errepidea baino ahalmen handiagoa
  - Bidai denbora kalkulua zona garapenean eragiten du
  - Trafiko altuak kutsadura igotzen du eta zona garapena moteltzen du
  - Aireportua eta portua merkataritza/industria eskariari eragiten diote

* **Frontend**: Trafiko bero-mapa (heatmap), garraio ibilbideen bistaratzea, kongestio adierazleak, garraio estatistika panela
* **Backend**: Trafiko simulazio algoritmoa, bidai denbora kalkuluak, garraio publiko ibilbide sistema, kongestio efektuak
* **LLM**: AA-k garraio azpiegitura planifikatzen du trafiko murrizteko

### 9.3. 3. Modulua: Ordenantzak (3. Taldea)

Hiri ordenantza sistema zabala 20+ ordenantzarekin.

* **Mekanika**:
  - 20+ ordenantza inplementatu, bakoitza efektu eta kostu zehatzekin
  - Ordenantzak aktibatu/desaktibatu daitezke
  - Efektu motak: krimena, kutsadura, RCI eskaria, zerga diru-sarrerak, osasuna, ur/energia eskaria
  - Diru-sarrera sortzen duten ordenantzak (joko legalizazioa, hiri turismoa...) eta kostu dutenak
  - Aurreikusitako efektuak adierazle gisa erakusten dira aktibatu aurretik
  - Ordenantza konbinazioak efektuak pilatzen dituzte

* **Frontend**: Ordenantza kudeaketa panela, efektu aurreikuspen adierazleak, aktibatu/desaktibatu botoiak, urteko kostua/sarrera laburpena
* **Backend**: Ordenantza efektu kalkuluak, aurrekontu integrazioa, RCI eta metriketan eragina, 20+ ordenantzen datuak
* **LLM**: AA-k ordenantzak aktibatzen ditu bere hiri estrategiaren arabera

### 9.4. 4. Modulua: Arkologiak (4. Taldea)

Arkologia eraikin handiak eta Irteera (exodus) garaipen berezia.

* **Mekanika**:
  - 4 arkologia mota: Plymouth, Forest, Darco, Launch
  - Arkologiak desblokeatzeko biztanleria (≥120.000) eta urte baldintzak
  - Arkologia bakoitzak biztanleria handia gehitzen du eremu txikian (4x4 lauki)
  - Jaurtiketa Arkologia (Launch Arco) berezia: 50+ eraikitzean Irteera gertaera abiarazten da
  - Irteera = garaipen berezia (soilik talde honentzat)
  - Eraikuntza kostuak itzultzen dira Irteera gertaeran

* **Frontend**: Arkologia eraikin bista isometrikoan, desblokeatze adierazleak, Irteera animazioa (arkologiak espaziora abiatzen), garaipen pantaila berezia
* **Backend**: Desblokeatze baldintza logika, biztanleria kalkuluak, Irteera gertaera eta garaipen berezia, kostu berreskurapena
* **LLM**: AA-k arkologiak eraikitzeko estrategia garatu dezake biztanleria handitzeko

### 9.5. 5. Modulua: Egunkaria (5. Taldea)

Hiri egunkaria LLM bidez sortutako edukiarekin.

* **Mekanika**:
  - Egunkaria urtero automatikoki agertzen da (Urtarrilean)
  - Eskuz ere irekitzeko aukera edozein momentutan
  - Eduki motak: hiri berriak, herritarren inkesta, aurkari hiriaren laburpena, titular umoretsuak, aholkulariaren iritzi zutabea
  - Egunkari izenak ausazkoak dira (Berria, Posta, Kronika...)
  - Inkestek hiriaren benetako arazoak islatzen dituzte (zergak, krimena, garraioa...)
  - Egunkari prezioak inflazioa islatzen du (urteen arabera igotzen da)

* **Frontend**: Egunkari popup-a diseinu klasikoarekin (egunkari itxura), inkesta grafikoak, artikulu diseinua, zabaltzeko/ixteko interakzioa
* **Backend**: Egunkaria sortzen duen logika (hiri arazoen analisia, inkesta datuak), LLM deiak eduki sortzeko
* **LLM**: Titular umoretsuak, aholkulari esaldiak eta herritarren iritziak sortzen ditu hiriaren egoera errealean oinarrituta

### 9.6. 6. Modulua: Auzokide Hiriak (6. Taldea)

Maparen ertzeko auzokide NPC hiriekin elkarrekintza.

* **Mekanika**:
  - 2-4 auzokide NPC hiri maparen ertzetan
  - Konexioa automatikoki detektatzen da errepidea/autobidea/trenbidea ertzeraino iristen denean
  - Energia eta ur saldaketak bi norabideetan (erosi/saldu)
  - Langileen joan-etorria: erresidentzial eskariari eta langabeziari eragiten du
  - Saldaketa akordioek hileko diru-sarrera/gastu finkoa sortzen dute
  - Auzokideen egoera aldakorra (biztanleria hazi/murriztu daiteke)

* **Frontend**: Maparen ertzeko konexio adierazleak, auzokide kudeaketa panela, saldaketa akordio interfazea, joan-etorri statistikak
* **Backend**: Ertz detekzio algoritmoa, joan-etorri kalkuluak, energia/ur trukaketa logika, aurrekontu integrazioa
* **LLM**: AA-k auzokideekin akordioek optimizatzen ditu bere baliabide estrategiaren arabera

### 9.7. 7. Modulua: Ur Sistema (7. Taldea)

Ur sistema zehatza presioarekin eta kutsadurarekin.

* **Mekanika**:
  - Ur-ponpa eraginkortasuna ur iturburuaren hurbiltasunaren araberakoa
  - Ur presioa hodien bidez murrizten da (distantzia faktorearen arabera)
  - Ur kutsadura industrialaren isurketatik sortzen da, tratamendu planteekin kontrolatuta
  - Ura gabeko zonak garapen maila baxua dute
  - Lurpeko bista ur-hodien sarea eta presioa erakusten du
  - Tratamendu planta bakoitzak kutsadura kopuru jakin bat garbitzen du

* **Frontend**: Lurpeko bista ur-hodi sarea erakusten du, presio mapa (kolore gainjarria), ur kalitate adierazleak, ponpa eraginkortasun bista
* **Backend**: BFS ur hedapena presio kalkuluekin, ponpa eraginkortasun algoritmoa iturburu hurbiltasunaren arabera, kutsadura/tratamendu balantzea
* **LLM**: AA-k ur azpiegitura planifikatzen du estaldura optimizatzeko

### 9.8. 8. Modulua: Hezkuntza & Osasuna (8. Taldea)

Hezkuntza (EQ) eta osasun (HQ) sistema zehatza.

* **Mekanika**:
  - EQ (Education Quotient): belaunaldien artean motela den metrika. Eskolak, ikastetxeak, liburutegiak eta museoek eragiten dute.
  - HQ (Health Quotient): ospitaleen estaldura eta kutsaduraren araberakoa
  - EQ altuak industria garbiagoa sortzen du (high-tech), krimena murrizten du eta lur-balioa igotzen du
  - HQ-k biztanle iraupena eta hilkortasun tasa kontrolatzen du
  - Hezkuntza eta osasun eraikinentzako finantzaketa maila doitu daiteke, zuzeneko eragina sortuz
  - EQ aldaketak hamarkadak behar ditu eraginkorra izateko (belaunaldi artekoa)

* **Frontend**: EQ eta HQ grafiko dinamikoak, hezkuntza/osasun estaldura mapak, finantzaketa doikuntza panela, high-tech industria adierazleak
* **Backend**: EQ/HQ kalkulu formulak, finantzaketa efektu logika, belaunaldi arteko aldaketa algoritmoa, industria mota kalkulua
* **LLM**: AA-k hezkuntza eta osasun eraikinak lehentasunez jartzen ditu EQ/HQ optimizatzeko

### 9.9. 9. Modulua: Lurralde Sistema (9. Taldea)

Altuera sistema eta lurralde eraldaketa tresnak.

* **Mekanika**:
  - Altuera mapa: 0-31 tartea, itsas maila konfiguragarria
  - Lurra igo, jaitsi eta berdintzeko tresnak (kostu bidez)
  - Ura altuera baxuko eremuetan betetzen da automatikoki
  - Eraikinak lur lau gainean soilik jar daitezke
  - Tunelak: errepideak mendi baten zehar
  - Zubiak: errepideak automatikoki sortzen dituzte urazpitik
  - Ur-jauziak: altuera diferentzia handia + ura → hidroelektriko zentraletarako
  - Zuhaitz jartzeak kutsadura murrizten du eta lur-balioa igotzen du

* **Frontend**: Altuera mapa isometrikoan itzalekin, lurralde tresna-barra (igo/jaitsi/berdindu/zuhaitzak), tunel eta zubi bistaratzea, ur-jauzi animazioa
* **Backend**: Altuera mapa kudeaketa, ur betetzeko algoritmoa, tunel/zubi detekzioa, zuhaitz efektuak kutsadura/lur-balioan
* **LLM**: AA-k lurraldea eraldatzen du hiri zabalkundea optimizatzeko

### 9.10. 10. Modulua: Energia Aurreratua (10. Taldea)

Energia sistema oso zehatza zentral elektriko mota guztiekin.

* **Mekanika**:
  - 9 zentral elektriko mota teknologia urteekin desblokeatuta (ikatza 1900, nuklearra 1955, fusioa 2050...)
  - Zentral zahartze sistema: osasun adierazlea %100-tik %0-ra, ondoren leherketa
  - Leherketa alerta 45 urtetik aurrera (nuklearrak/ikatzak)
  - Eguzki-energia eguraldiaren araberakoa (eraginkortasun aldakorra)
  - Mikrouhin izpide zentralaren erratu gertaera (40 urte baino zaharragoa → %1 aukera/hilabeteko sutea sortuz)
  - Energia sare brownout-ak: eskaria > ahalmena denean, urruneko zonak energia gabe geratzen dira
  - Teknologia timeline bistaratze grafikoa

* **Frontend**: Zentral osasun adierazleak, leherketa alerta ikonoak, teknologia timeline grafikoa, brownout zona bistaratzea, eguzki eraginkortasun barra
* **Backend**: Zentral zahartze kalkuluak, leherketa logika, eguzki eguraldi faktore kalkulua, mikrouhin erratu gertaera, BFS brownout kalkulua
* **LLM**: AA-k energia azpiegitura planifikatzen du teknologia aurreraketa eta eskariaren arabera

## 10. ENTREGAGARRIAK

1. Iturburu kode osoa Git biltegian
2. Dokumentazio teknikoa:
   - Sistemaren arkitektura
   - API endpoint-ak
   - Datu eredua
   - GroQ/GitHub Models-rekin integrazioa
   - Gordetako partiden egitura
   - **AA bidez sortutako baliabideen inbentario zehatza** hauekin:
     - Erabilitako tresna
     - Aplikatutako prompt-a
     - Sortze data
     - Proiektuan erabilera
3. Originaltasun eta erabilera hezigarriaren adierazpena (proiektua hezigarria soilik dela eta ez komertziala baieztatzea)
4. Erabiltzaile manuala
5. Proiektuaren aurkezpena
6. Hedapenerako Docker fitxategiak (4 edukiontzi)
7. Proiektuaren memoria hauek dituela:
   - Kide bakoitzaren ekarpena
   - Izandako erronkak eta konponbideak
   - Diseinu eta inplementazio erabakiak

## 11. EBALUAZIO IRIZPIDEAK

### 11.1. Ezinbesteko Eskakizuna

**KONTUZ!**: Praktika gainditzeko, **APLIKAZIOAK ZUZEN FUNTZIONATU BEHAR DU** eta **ESLEITUTAKO TEKNOLOGIEKIN GARATUTA EGON BEHAR DU**. Hauek dira eskakizun guztiz ezinbestekoak eta negoziaezinak. Aplikazioak ez badu funtzionatzen proba ingurunean zehaztutako hedapen prozeduraren bidez (docker compose up) edo esleitutako teknologiez bestelakoak erabili badira, praktika automatikoki suspenditua geldituko da, kodearen edo dokumentazioaren kalitatea edozein izanda ere.

"Zuzen funtzionatzea" horrela ulertzen da:
- Aplikazioa errorerik gabe hasten da
- Gutxienez eszenatoki oso bat hasieratik amaieraraino jokagarria da
- Hileko tick simulazio mekanikak zehaztapenei jarraiki funtzionatzen dute
- Zona, eraikuntza eta aurrekontu kudeaketa funtzionalak dira
- GroQ/GitHub Models-rekin integrazioak egoki erantzuten du
- Ez daude joko esperientzia eragozten duten errore kritikorik

### 11.2. Talde Ebaluazioa (70%)

| Irizpidea | Portzentajea |
|-----------|------------|
| Funtzionalitate osoa | 25% |
| Kodearen kalitatea | 15% |
| GroQ/GitHub Models-rekin integrazioa | 10% |
| Interfaze grafikoa | 10% |
| Hedapen zuzena | 5% |
| Dokumentazioa | 5% |

### 11.3. Banakako Ebaluazioa (30%)

| Irizpidea | Portzentajea |
|-----------|------------|
| Kodera ekarpena (commit-ak) | 10% |
| Banakako lanaren kalitatea | 10% |
| Esleitutako erantzukizunen betetzea | 5% |
| Aurkezpenean parte-hartzea | 5% |

Taldean parekoen arteko ebaluazioa egingo da banakako ekarpenak balidatzeko.

### 11.4. Lege eta Etika Alderdiak

* **Erabilera hezigarria**: Proiektu honek helburu hezigarria soilik du, merkataritza helbururik gabe.
* **Edukiaren originaltasuna**:
  - Joko komertzialetatik datozen aktibo grafikoen, audioen edo kodearen erabilera debekatuta dago.
  - Eduki guztia originala, domeinu publikokoa edo AA bidez sortua izan behar da.
* **AA bidez sortutako edukia**:
  - AA bidez sortutako eduki guztia argi etiketatuta egon behar da.
  - Erabilitako prompt-en erregistro zehatza mantendu behar da.
  - AA bidez sortutako irudiek ur-marka edo aipamen bisual diskretua izan behar dute.
* **Egilearen aitormena**:
  - Hirugarrenen liburutegien erabilera behar bezala aitortu behar da.
  - Domeinu publikoko baliabideen erabilera dokumentatu behar da beren lizentziekin.
* **Gardentasuna**:
  - Dokumentazioak baliabide guztien jatorriari buruzko atal espezifiko bat izan behar du.
  - Argi adierazi behar da jokoa hiri-eraikuntza simulazio joko klasikoetan "inspiratuta" dagoela, marka erregistratuak aipatu gabe.

## 12. ERANSKINA: KOMUNIKAZIO ETA ARKITEKTURAREN DESKRIBAPEN TEKNIKOA

### 12.1. Sistemaren Arkitektura Orokorra

```
+------------------+       +-----------------+       +------------------+
|                  |       |                 |       |                  |
|     FRONTEND     |<----->|     BACKEND     |<----->|   AA ZERBITZUA   |
|                  |  HTTP |                 |  HTTP |                  |
| (React/Angular/  |  REST | (Flask/FastAPI) |       | (GroQ kudeatzail)|
|  Vue/Svelte)     |       |                 |       |                  |
+------------------+       +-----------------+       +------------------+
                                   ^ |                       |
                                   | v                       v
                           +----------------+        +------------------+
                           |                |        |                  |
                           |    MONGODB     |        | GROQ / GITHUB    |
                           |                |        | MODELS           |
                           | (Erabiltzaile, |        |    (LLMs)        |
                           |  Partidak)     |        |                  |
                           +----------------+        +------------------+
```

### 12.2. Frontend-Backend Komunikazioa

```
+----------------+       HTTP Eskaera        +----------------+
|                |  ---------------------->  |                |
|    Frontend    |                           |    Backend     |
|    (Node.js)   |  <----------------------  |    (Python)    |
|                |       HTTP Erantzuna      |                |
+----------------+                           +----------------+
```

#### AA Txandaren Bistaratzeko Komunikazioa

```
+------------------+                               +------------------+
|                  |  1. POST /api/game/endMonth   |                  |
|     Frontend     |  ----------------------->     |     Backend      |
| (React/Vue/etc.) |                               |   (FastAPI)      |
|                  |  2. Jokalariaren hilabetea    |                  |
|                  |     simulatzen                |                  |
|                  |  3. AA-ren txanda hasten      |                  |
|                  |     (LLM deia)                |                  |
|                  |  4. AA-ren ekintzak eta       |                  |
|                  |     bi hirien egoera          |                  |
|                  |     itzultzen ditu            |                  |
|                  |  <-----------------------     |                  |
|                  |                               |                  |
|   AA txandaren   |  5. Ekintzak sekuentzialki    |                  |
|   bistaratze     |     erreproduzitzen ditu      |                  |
|   zatitua        |     (animazioa)               |                  |
+------------------+                               +------------------+
```

#### Komunikazio fluxua:

1. **Autentikazioa eta Erabiltzaile Kudeaketa**:
   - Erabiltzaile berriaren erregistroa (POST /api/auth/register)
   - Erabiltzaile login-a (POST /api/auth/login)
   - Erabiltzaile profila lortzea (GET /api/auth/profile)
   - Profila eguneratzea (PUT /api/auth/profile)

2. **Partiden Kudeaketa**:
   - Gordetako partidak zerrendatzea (GET /api/games)
   - Partida berria sortzea (POST /api/games)
   - Uneko partida gordetzea (POST /api/games/{gameId}/save)
   - Gordetako partida kargatzea (GET /api/games/{gameId})
   - Eszenatoki erabilgarriak zerrendatzea (GET /api/scenarios)

3. **Jokalariaren hilabetean**:
   - Zona jartzea (POST /api/games/{gameId}/zone)
   - Azpiegitura jartzea (POST /api/games/{gameId}/infrastructure)
   - Eraikina eraikitzea (POST /api/games/{gameId}/build)
   - Eraikina/zona ezabatzea (POST /api/games/{gameId}/demolish)
   - Aurrekontua doitzea (POST /api/games/{gameId}/budget)
   - Ordenantza aktibatu/desaktibatu (POST /api/games/{gameId}/ordinance)
   - Hondamendi erasoa aurkariaren hirira (POST /api/games/{gameId}/attack)

4. **Hilabete amaieran**:
   - Frontend-ak hilabete amaiera eskaera bidaltzen du (POST /api/games/{gameId}/endMonth)
   - Backend-ak jokalariaren hiriaren simulazioa kalkulatzen du
   - Backend-ak uneko egoera gordetzen du (auto-gordetzea)
   - Backend-ak AA-ren txanda hasten du (LLM deia)
   - Backend-ak AA-ren ekintzak prozesatu eta bere hiriaren simulazioa kalkulatzen du
   - Backend-ak bi hirien egoera berria eta AA ekintza sekuentzia itzultzen du

5. **Trikimailu Sistema**:
   - Frontend-ak Ctrl+Tab konbinazioa detektatzen du eta txat interfazea erakusten du
   - Frontend-ak trikimailu kodea bidaltzen du (POST /api/games/{gameId}/cheat)
   - Backend-ak kodea balidatzen du eta dagozkion efektuak aplikatzen ditu
   - Backend-ak jokoaren egoera berria itzultzen du aplikatutako aldaketekin

### 12.3. Backend-MongoDB Komunikazioa

```
+----------------+      MongoDB Driver       +----------------+
|                |  ---------------------->  |                |
|    Backend     |                           |    MongoDB     |
|    (Python)    |  <----------------------  |                |
|                |       Kontsulta Emaitzak  |                |
+----------------+                           +----------------+
```

#### Datu-basearen Egitura:

1. **Erabiltzaile Bilduma**:
   ```json
   {
     "_id": "ObjectId",
     "username": "string",
     "email": "string",
     "password_hash": "string",
     "created_at": "date",
     "last_login": "date"
   }
   ```

2. **Partida Bilduma**:
   ```json
   {
     "_id": "ObjectId",
     "user_id": "ObjectId",
     "name": "string",
     "scenario_id": "string",
     "created_at": "date",
     "last_saved": "date",
     "is_autosave": "boolean",
     "cheats_used": ["string"],
     "game_state": {
       "current_date": {"year": "number", "month": "number"},
       "current_player": "string",
       "player_city": {
         "name": "string",
         "population": "number",
         "treasury": "number",
         "zones": [...],
         "buildings": [...],
         "infrastructure": {...},
         "budget": {...},
         "ordinances": [...],
         "metrics": {
           "eq": "number",
           "hq": "number",
           "crime_rate": "number",
           "pollution": "number",
           "land_value_avg": "number",
           "approval": "number",
           "rci_demand": {"r": "number", "c": "number", "i": "number"}
         }
       },
       "ai_city": {
         "name": "string",
         "population": "number",
         "treasury": "number",
         "zones": [...],
         "buildings": [...],
         "infrastructure": {...},
         "budget": {...},
         "ordinances": [...],
         "metrics": {...}
       },
       "map": {
         "size": {"width": "number", "height": "number"},
         "tiles": [...],
         "terrain_heightmap": [...]
       },
       "victory_status": "string"
     }
   }
   ```

3. **Eszenatoki Bilduma**:
   ```json
   {
     "_id": "ObjectId",
     "name": "string",
     "description": "string",
     "difficulty": "string",
     "starting_year": "number",
     "starting_funds": {"easy": "number", "medium": "number", "hard": "number"},
     "map_size": {"width": "number", "height": "number"},
     "terrain": {...},
     "player_start": {"x": "number", "y": "number"},
     "ai_start": {"x": "number", "y": "number"}
   }
   ```

### 12.4. Backend-AA Zerbitzua Komunikazioa

```
+----------------+       API Eskaera         +------------------+
|                |  ---------------------->  |                  |
|    Backend     |                           | GroQ / GitHub    |
|    (Python)    |  <----------------------  | Models           |
|                |       API Erantzuna       |                  |
+----------------+                           +------------------+
```

#### Komunikazio fluxua:

1. **AA Hasieratzea**:
   - Backend-ak hasierako prompt-a bidaltzen du hiri kudeaketaren deskribapena eta arauak dituena
   - Backend-ak elkarrizketa testuingurua gordetzen du

2. **AA-ren Hilabetea**:
   - Backend-ak AA-ren hiriari buruzko egoera osoa prestatzen du (JSON)
   - Backend-ak jokalariaren hiriari buruzko informazio mugatua gehitzen du (biztanleria, puntuazioa, zonalde kopurua)
   - Backend-ak egoera GroQ/GitHub Models-en lehen mailako modelora bidaltzen du
   - 429 errorea badago (token muga), ordezko modelora aldatzen da
   - GroQ/GitHub Models-ek AA-ren hiri kudeaketa erabakiak JSON formatuan itzultzen ditu
   - Backend-ak AA-ren ekintzak balidatzen eta exekutatzen ditu
   - Backend-ak AA-ren hiriaren simulazioa kalkulatzen du
   - Backend-ak ekintzen sekuentzia bidaltzen dio frontend-ari bisualizaziorako

3. **Testuinguruaren Kudeaketa**:
   - Backend-ak ekintza garrantzitsuen laburpen historia mantentzen du
   - Testuingurua mugatzen da token mugak ez gainditzeko
   - Hilabeteon artean ikasitako estrategiak gordetzen dira

4. **AA-ren Ekintzen Bistaratzea**:
   - Backend-ak egindako ekintzen zerrenda ordenatua sortzen du
   - Ekintza bakoitzak aurretiko eta ondorengo egoera barne hartzen du
   - Sekuentzia osoa frontend-ari bidaltzen zaio animaziorako

## 13. ERANSKINA: PARTIDEN DATU EGITURA

### 13.1 Gordetako Partidaren Formatua

```json
{
  "game_id": "65f1a2b3c4d5e6f7a8b9c0d1",
  "name": "Nire hiriaren partida",
  "scenario_id": "kostaldea_1",
  "created_at": "2026-04-01T18:30:22.123Z",
  "last_saved": "2026-04-01T19:45:33.456Z",
  "current_date": {"year": 1925, "month": 6},
  "current_player": "player",
  "cheats_used": ["diru_asko"],
  "player_city": {
    "name": "Bilbo",
    "population": 15420,
    "treasury": 45230,
    "months_bankrupt": 0,
    "zones": [
      {
        "id": "zone1",
        "type": "residential_light",
        "position": {"x": 10, "y": 15},
        "size": {"w": 3, "h": 3},
        "development_level": 2,
        "powered": true,
        "watered": true,
        "road_access": true,
        "abandoned": false
      },
      {
        "id": "zone2",
        "type": "commercial_dense",
        "position": {"x": 20, "y": 18},
        "size": {"w": 4, "h": 4},
        "development_level": 3,
        "powered": true,
        "watered": true,
        "road_access": true,
        "abandoned": false
      }
    ],
    "buildings": [
      {
        "id": "bldg1",
        "type": "coal_power_plant",
        "position": {"x": 5, "y": 5},
        "built_year": 1900,
        "age_years": 25,
        "powered": true,
        "output_mw": 200
      },
      {
        "id": "bldg2",
        "type": "police_station",
        "position": {"x": 12, "y": 16},
        "built_year": 1910,
        "coverage_radius": 18,
        "funding_pct": 100
      },
      {
        "id": "bldg3",
        "type": "school",
        "position": {"x": 14, "y": 20},
        "built_year": 1905,
        "funding_pct": 80
      }
    ],
    "infrastructure": {
      "roads": [
        {"from": {"x": 8, "y": 15}, "to": {"x": 25, "y": 15}},
        {"from": {"x": 15, "y": 10}, "to": {"x": 15, "y": 25}}
      ],
      "power_lines": [
        {"from": {"x": 5, "y": 7}, "to": {"x": 10, "y": 7}}
      ],
      "water_pipes": [
        {"from": {"x": 5, "y": 5}, "to": {"x": 20, "y": 5}}
      ],
      "rail": [],
      "subway": []
    },
    "budget": {
      "tax_rates": {"residential": 7, "commercial": 7, "industrial": 8},
      "funding": {
        "transportation": 100,
        "police": 100,
        "fire": 80,
        "health": 90,
        "education": 80
      },
      "bonds_active": [
        {"amount": 10000, "interest_rate": 20, "years_remaining": 15}
      ],
      "last_year_income": 12500,
      "last_year_expenses": 9800
    },
    "ordinances": ["parking_fines", "pro_reading"],
    "metrics": {
      "eq": 85,
      "hq": 72,
      "crime_rate": 23,
      "pollution_air": 35,
      "pollution_water": 12,
      "land_value_avg": 450,
      "approval": 68,
      "unemployment": 5,
      "traffic_avg": 42,
      "rci_demand": {"r": 120, "c": 45, "i": -30},
      "composite_score": 5820
    },
    "power_grid": {
      "total_capacity_mw": 200,
      "total_demand_mw": 145,
      "coverage_pct": 92
    },
    "water_system": {
      "total_capacity": 150,
      "total_demand": 98,
      "coverage_pct": 85
    }
  },
  "ai_city": {
    "name": "Zumaia",
    "population": 12800,
    "treasury": 38900,
    "months_bankrupt": 0,
    "personality": "balanced",
    "zones": [...],
    "buildings": [...],
    "infrastructure": {...},
    "budget": {...},
    "ordinances": [...],
    "metrics": {
      "eq": 78,
      "hq": 65,
      "crime_rate": 28,
      "pollution_air": 40,
      "land_value_avg": 380,
      "approval": 62,
      "rci_demand": {"r": 90, "c": 60, "i": 10},
      "composite_score": 4950
    }
  },
  "map": {
    "size": {"width": 64, "height": 64},
    "terrain": [
      [5, 5, 5, 4, 3, 2, 1, 0, 0],
      [5, 5, 4, 4, 3, 2, 1, 0, 0],
      [6, 5, 5, 4, 3, 2, 2, 1, 0]
    ],
    "water_level": 2,
    "trees": [
      {"x": 30, "y": 30},
      {"x": 31, "y": 30}
    ]
  },
  "disaster_attacks": {
    "player_attacks_remaining": 1,
    "ai_attacks_remaining": 1,
    "last_attack_month": {"year": 1924, "month": 12}
  }
}
```

### 13.2 AA Hilabete Bistaratzearen Egitura

AA-ren hilabetearen bistaratzea errazteko, ondorengo JSON formatua erabiliko da:

```json
{
  "ai_turn_id": "65f1a2b3c4d5e6f7a8b9c0d2",
  "game_id": "65f1a2b3c4d5e6f7a8b9c0d1",
  "game_date": {"year": 1925, "month": 7},
  "actions": [
    {
      "action_id": 1,
      "type": "placeZone",
      "zone_type": "residential_light",
      "position": {"x": 42, "y": 28},
      "size": {"w": 3, "h": 3},
      "cost": 45,
      "state_before": { "treasury": 38900, "zones_count": 15 },
      "state_after": { "treasury": 38855, "zones_count": 16 },
      "timestamp": "2026-04-01T19:40:15.123Z"
    },
    {
      "action_id": 2,
      "type": "buildStructure",
      "building_type": "fire_station",
      "position": {"x": 44, "y": 30},
      "cost": 500,
      "state_before": { "treasury": 38855 },
      "state_after": { "treasury": 38355 },
      "timestamp": "2026-04-01T19:40:18.456Z"
    },
    {
      "action_id": 3,
      "type": "adjustBudget",
      "changes": {
        "tax_rates": {"industrial": 9},
        "funding": {"police": 90}
      },
      "state_before": { "tax_rates": {"industrial": 7}, "funding": {"police": 100} },
      "state_after": { "tax_rates": {"industrial": 9}, "funding": {"police": 90} },
      "timestamp": "2026-04-01T19:40:22.789Z"
    },
    {
      "action_id": 4,
      "type": "enactOrdinance",
      "ordinance": "pollution_controls",
      "cost_annual": 50,
      "timestamp": "2026-04-01T19:40:25.123Z"
    },
    {
      "action_id": 5,
      "type": "endMonth",
      "simulation_results": {
        "population_change": +320,
        "treasury_change": -150,
        "new_buildings_developed": 3,
        "zones_abandoned": 0
      },
      "timestamp": "2026-04-01T19:40:30.456Z"
    }
  ],
  "reasoning": "Erresidentzial zona berriak jarri ditut hegoaldean, biztanleria hazkundea sustatzeko. Suhiltzaile parke bat eraiki dut zona berrien babesean. Industria zergak apur bat igo ditut diru-sarrerak areagotzeko, eta kutsadura kontrolak aktibatu ditut hegoaldeko zonaren inguruko lur-balioa babesteko."
}
```

### 13.3 Trikimailu Sistemaren Formatua

**Eskaera:**
```json
{
  "game_id": "65f1a2b3c4d5e6f7a8b9c0d1",
  "cheat_code": "diru_asko",
  "target": {
    "type": "city",
    "city": "player"
  }
}
```

**Erantzuna:**
```json
{
  "success": true,
  "message": "Altxorra §1.000.000-ra igo da",
  "affected_entity": {
    "type": "city",
    "changes": {
      "treasury": {"before": 45230, "after": 1000000}
    }
  },
  "game_state": {
    "/* Jokoaren egoera eguneratua */"
  }
}
```

## 14. ERANSKINA: LLM-RAKO HASIERAKO PROMPTA

Jarraian GroQ/GitHub Models modeloei hiriaren kudeaketa deskribatzeko bidaliko zaien hasierako promptaren adibide bat erakusten da:

```
Hona hemen jokoaren uneko egoera:

<game_state>
{{GAME_STATE}}
</game_state>

Zu SimCity 2000-n inspiratutako hiri-eraikuntza simulazio jokoan jokatzen ari den AA alkate bat zara. Zure helburua da zure hiria kudeatzea eta garatzea, jokalariaren hiriarekin lehiatuz. Hilabete bakoitzean hiriaren egoera jasoko duzu eta zure erabakiak hartu behar dituzu.

Zure zeregina da hiriaren egoera aztertzea, estrategia bat formulatzea, eta hilabete honetako zure ekintzak zehaztea. Jarraitu urrats hauei:

1. Aztertu hiriaren egoera, hauek kontuan hartuz:
   - Zure hiriko zonak, eraikinak eta azpiegiturak
   - RCI eskari adierazlea (Erresidentziala, Komertziala, Industriala)
   - Energia eta ur sarearen egoera
   - Aurrekontuaren egoera (diru-sarrerak vs gastuak, altxorra)
   - Hiri metrikak: biztanleria, EQ, HQ, krimena, kutsadura, lur-balioa
   - Hiri zerbitzu estaldura (polizia, suhiltzaileak, osasuna, hezkuntza)
   - Jokalariaren hiriari buruzko informazio mugatua (biztanleria, puntuazioa)
   - Garaipena baldintzekiko zure posizioa

2. Formulatu estrategia bat lehentasun hauetan oinarrituta:
   - Eskari altueneko zonak garatzea
   - Azpiegitura sarea hedatzea (energia, ura, errepideak)
   - Zerbitzu estaldura hobetzea krimena eta osasuna kontrolatzeko
   - Aurrekontua orekatua mantentzea
   - Hezkuntza eta osasun koefizienteak hobetzea epe luzerako
   - Jokalariaren hiriarekin lehiatzea metriketan

3. Sortu ekintza multzo bat hilabete honetarako. Ekintza mota posibleak dira:
   - placeZone: Zona berri bat jartzea (type, position, size)
   - buildStructure: Eraikin bat eraikitzea (type, position)
   - placeInfrastructure: Azpiegitura jartzea (type, from, to)
   - demolish: Zona/eraikina ezabatzea (position)
   - adjustBudget: Zerga tasak edo sailkako finantzaketa doitzea
   - enactOrdinance: Ordenantza bat aktibatzea
   - repealOrdinance: Ordenantza bat desaktibatzea
   - issueBond: Bonua ematea (dirua maileguan hartzea)
   - attackRival: Hondamendi eraso bat aurkariaren hirira (disaster_type)
   - endMonth: Hilabetea amaitu

Zure azken erantzuna eman aurretik, idatzi zure hausnarketa-prozesua eta estrategia-gogoetak <strategic_planning> etiketen artean. Atal honetan:

1. Laburbildu hiriaren uneko egoera: biztanleria, altxorra, metrikak, azpiegitura estaldura.
2. Aztertu RCI eskaria eta identifikatu zer motatako zonak behar diren.
3. Identifikatu azpiegitura ahuleziak (energia falta, ur falta, zerbitzu hutsuneak).
4. Ebaluatu aurrekontuaren osasuna eta zerga doitzeko beharra.
5. Alderatze lehiakorra: zure hiria vs jokalariaren hiria.
6. Erabaki hondamendi eraso bat merezi duen ala ez.

Zure azken erantzuna ondorengo JSON formatuan izan behar da:

{
  "actions": [
    {
      "type": "actionType",
      "details": {
        // Ekintzarako xehetasunak
      }
    },
    // ... ekintza gehiago ...
    {
      "type": "endMonth"
    }
  ],
  "reasoning": "Zure estrategiaren eta hurrengo hilabeteetarako planen azalpen zehatza",
  "analysis": "Hiri egoeraren eta lehiakidearen posizioaren azterketa laburra"
}

Hona ekintzen formatuaren adibide bat:

{
  "actions": [
    {
      "type": "placeZone",
      "details": {
        "zone_type": "residential_dense",
        "position": {"x": 15, "y": 20},
        "size": {"w": 4, "h": 4}
      }
    },
    {
      "type": "buildStructure",
      "details": {
        "building_type": "police_station",
        "position": {"x": 16, "y": 22}
      }
    },
    {
      "type": "placeInfrastructure",
      "details": {
        "type": "road",
        "from": {"x": 14, "y": 20},
        "to": {"x": 20, "y": 20}
      }
    },
    {
      "type": "adjustBudget",
      "details": {
        "tax_rates": {"residential": 7, "commercial": 8, "industrial": 9},
        "funding": {"police": 100, "fire": 80, "education": 90}
      }
    },
    {
      "type": "enactOrdinance",
      "details": {
        "ordinance": "pro_reading"
      }
    },
    {
      "type": "endMonth"
    }
  ],
  "reasoning": "Erresidentzial zona trinkoa jarri dut eskari altua dagoenez...",
  "analysis": "Nire hiria 15.420 biztanlerekin jokalariaren 12.800-en aurretik dago..."
}

Gogoan izan:
- Aurrekontua kontrolpean mantendu (ez gastatu altxorrak duen baino gehiago)
- Zonak energia, ura eta errepide sarbidea behar dute garatzeko
- Zentral elektrikoak 50 urte eta gero lehertzen dira (ordeztu aurretik)
- Zerga altuegiek biztanleria ihesarazten dute
- Zerbitzu estaldura ona ezinbestekoa da krimena eta osasuna kontrolatzeko
- Beti amaitu zure hilabetea "endMonth" ekintzarekin
```

## 15. ERANSKINA: AA TXANDAREN BISTARATZEA INPLEMENTATZEA

AA-ren hilabetearen bistaratzea zuzen gauzatzeko, ondorengo jarraibideak jarraitu behar dira:

### 15.1. Bistaratzearako Datu Egitura

Backend-ak frontend-ari datu egitura bat eskaini behar dio AA-k egindako ekintzak sekuentzialki animatzeko:

```json
{
  "ai_turn_summary": {
    "total_actions": 5,
    "main_focus": "residential_growth",
    "treasury_change": -695,
    "population_change": +320,
    "zones_placed": 1,
    "buildings_built": 1,
    "ordinances_changed": 1,
    "disaster_attack": null
  },
  "ai_actions_sequence": [
    {
      "id": 1,
      "action_type": "placeZone",
      "entity": {"type": "residential_light", "position": {"x": 42, "y": 28}, "size": {"w": 3, "h": 3}},
      "cost": 45,
      "state_snapshot_before": {...},
      "state_snapshot_after": {...}
    },
    ...
  ]
}
```

### 15.2. Bistaratze Moduak

Sistemak gutxienez bi bistaratze modu eskaini behar ditu AA-ren hilabeterako:

1. **Pantaila Osoko Modua**:
   - AA-ren hilabetean, bista AA-ren hirira aldatzen da
   - Ekintza guztien animazio sekuentziala erakusten da
   - Informazio testuinguruko albo-panel bat barne hartzen da
   - Amaitzean, automatikoki jokalariaren hirira itzultzen da

2. **Pantaila Zatitutako Modua**:
   - Pantaila horizontalki bi zatitan banatzen da
   - Ezkerraldean: jokalariaren hiriaren bista estatikoa
   - Eskuinaldean: AA-ren hiriaren bista dinamikoa ekintzak erakutsiz

### 15.3. Erreprodukzio Kontrolak

- Erreprodukzio pausatzea/jarraitzea
- Pausoka aurreratzea (hurrengo ekintza)
- Pausoka atzera egitea (aurreko ekintza)
- Erreprodukzio abiadura doitzea (normala, azkarra, bat-batekoa)
- Zuzenean amaierako emaitzara jauzi egitea

### 15.4. Elementu Bisualak

- Zona berrien kolorezko nabarmentzea
- Eraikin berrien eraikuntza efektua
- Aurrekontua aldaketen zenbaki adierazleak
- Hondamendi erasoen animazio dramatikoa
- Egoera aldaketen aurretik/ondoren konparaketa

## 16. ERANSKINA: GAMEPLAY-AREN INPLEMENTAZIOA

SimCity 2000 bezalako hiri-eraikuntza simulazio jokoen funtsa jasotzeko, garrantzitsua da ondorengo joko-mekanikak gauzatzea:

### 16.1. Hileko Tick Simulazio Sistema

* **Hilabete bakoitzean simulazio motorrak kalkulatzen du**:
  - RCI eskaria (Erresidentziala, Komertziala, Industriala)
  - Zona garapen mailak (baldintzen arabera hazten edo abandonatzen)
  - Biztanle hazkundea (RCI eskaria + zerbitzuak + zergak)
  - Diru-sarreren eta gastuen kalkulua
  - Zerbitzu estaldura eguneratzea
  - Kutsadura, krimena eta lur-balioaren hedapena
  - Energia eta ur sare estaldura
  - Eraikinak zahartzea (zentral elektrikoak 50 urte)
* **Urtarrilean gainera**:
  - Urteroko aurrekontu berrikuspena
  - Bonu interesak ordaintzea
  - Zentral elektriko zahartuen alerta

### 16.2. RCI Eskaria Sistema

* **Erresidentzial eskaria** honetan oinarritzen da:
  - Lanpostu erabilgarriak (Komertzial + Industrial zonatatik)
  - Hiri bizigarritasun baldintzak (krimena baxua, hezkuntza ona, zerbitzuak)
  - Zerga maila baxua
* **Komertzial eskaria** honetan oinarritzen da:
  - Biztanleria (bezeroak)
  - Garraio sarbidea
  - EQ maila altua
  - Aireportuaren presentzia
* **Industrial eskaria** honetan oinarritzen da:
  - Garraio sarbidea (errepideak, trenbidea, portua)
  - Langile erabilgarriak
  - Industria zerga maila baxua
* Hiru sektoreak **elkarren menpekoak** dira

### 16.3. Energia eta Ur Sare Sistema

* **Energia sarea**: Zentral elektrikoetatik alboko lauki garatu guztietara hedatzen da (BFS algoritmoa). Energia lineek eremoak konektatzeko balio dute.
* **Ur sarea**: Ur-ponpetatik ur-hodi sarearen bidez hedatzen da. Lurpeko bistan kudeatzen da.
* Zonak energia eta ura behar dute garatzeko. Energia/ur gabe zonak gaizki garatzen dira edo abandonatzen dira.

### 16.4. Zerbitzu Estaldura

* Polizia, suhiltzaile, ospitale eta hezkuntza eraikinek estaldura erradioa dute
* Finantzaketa portzentajeak estaldura erradioan eragiten du (%80 finantzaketa = %80 erradioa)
* Estaldura gabeko eremuek krimena altuagoa, sute arrisku handiagoa eta osasun txarragoa dute
* Estaldura mapak datu gainjarre gisa bistaratu behar dira

### 16.5. Kutsadura, Krimena eta Lur-balioa

* **Kutsadura**: Industria zonak eta zentral elektriko batzuek kutsadura sortzen dute. Zuhaitzek eta kutsadura kontrolak murrizten dute. Kutsadura altuak lur-balioa jaisten du eta biztanleak uxatzen ditu.
* **Krimena**: Polizia estaldura faltak krimena igotzen du. Hezkuntza ona eta enplegua krimena jaisten du. Krimena altuak zonak abandonatzera eramaten du.
* **Lur-balioa**: Ur-ertza, parkeak, zerbitzu estaldura, hezkuntza, krimena baxua eta kutsadura baxua lur-balioa igotzen dute. Industria, zentral elektrikoak, krimena eta kutsadurak jaisten dute.

### 16.6. Hondamendi Sistema

Jokoan hondamendiak hiru modutara gerta daitezke:
1. **Ausazkoak**: Denboran zehar ausazko hondamendiak gerta daitezke (desgaitu daiteke)
2. **Trikimailu bidez**: Jokalariak `hondamendi_bat` kodea erabil dezake
3. **Eraso gisa**: Jokalariak edo AA-k aurkariaren hiriari hondamendiak eragin diezazkioke (§5.000-§50.000 kostu)

Hondamendi motak eta kalte mailak:
| Hondamendi | Kalte Maila | Eraso Kostua | Deskribapena |
|------------|------------|-------------|-------------|
| Sutea | Ertaina | §5.000 | Lauki batetik bestera hedatzen da |
| Uholdea | Ertaina | §10.000 | Altuera baxuko eremuak kaltetu |
| Tornadorea | Altua | §20.000 | Ibilbide batean eraikinak suntsitu |
| Lurrikara | Oso altua | §50.000 | Hiri osoan eraikin eta azpiegiturak kaltetu |

### 16.7. Garaipena Egiaztatzea

* Hilabete bakoitzaren amaieran garaipena baldintzak egiaztatzen dira:
  - Biztanleria ≥ 100.000 → **Populazio Garaipena**
  - Aurkariaren altxorra < -§100.000 x 12 hilabetez → **Aurkariaren Porrota**
  - Zure altxorra < -§100.000 x 12 hilabetez → **Game Over**
  - 1.200 hilabete igaro → **Puntuazio konparaketa** (ikus §3.4)
  - 50+ Jaurtiketa Arkologia *(4. taldeko modulua)* → **Arkologia Irteera**

## 17. INPLEMENTAZIORAKO AHOLKUAK

## 17.1. Espezifikazio Fitxategien eta Agentearen Erabilera

1. **SPECS.md**:  
   Edozein osagai inplementatu aurretik kontsultatu. API kontratuak, datu-ereduak eta arau zehatzak jasotzen ditu.

2. **AGENT-*.md**:  
   Kargatu VSCode Copilot-en agentearen jarraibide gisa. Agentea automatikoki dagokion rolaren zereginetan zentratuko da.

3. **Gomendatutako workflow-a**:
   - Ireki *SPECS.md* eta bilatu dagokion atala  
   - Onarpen-irizpideak checklist gisa kopiatu  
   - Dagokion agentearen laguntzarekin inplementatu  
   - Onarpen-irizpideen arabera balioztatu  
   - Commit egin eta pull request sortu

### 17.2. Garapen Estrategiak

1. **Fasetan garatu**:
   - 1. Fasea: Erabiltzaile eta partida oinarrizko sistema inplementatu
   - 2. Fasea: Mapa isometrikoa eta oinarrizko zona jartzea inplementatu
   - 3. Fasea: Energia eta ur sare sistema gehitu
   - 4. Fasea: Aurrekontu sistema eta zerga/finantzaketa logika
   - 5. Fasea: Hileko tick simulazio motorra (RCI, hazkundea, zerbitzuak)
   - 6. Fasea: GroQ/GitHub Models-rekin AA integratu
   - 7. Fasea: Lehia sistema (metrikak + hondamendi erasoak)
   - 8. Fasea: Findu eta optimizatu

2. **Rolen araberako garapen paraleloa**:
   - Frontend: API-aren simulazioekin hasi daiteke backend-aren menpekotasunik gabe aurreratzeko
   - Backend: Hasiera batean erantzun estatikoak dituzten endpoint-ak inplementatu daitezke
   - AI/ML: GroQ/GitHub Models-rekin integrazio finala baino lehen modelo lokalekin lan egin daiteke

3. **Hedadura murriztea** (ikasle bakoitzak 50 ordu mantentzearren):
   - Zona mota kopurua murriztu (3 mota: R, C, I bakarrik, dentsitate bakar bat)
   - Zentral elektriko mota gutxiago (3-4 nahikoa)
   - Zerbitzu eraikin kopurua minimora mugatu
   - Funtzionalitatea lehenetsi diseinu bisualaren aurretik
   - Elementu aukerakoak minimizatu (soinuak, animazioak)

### 17.3. Simplifikatzeko Gomendio Zehatzak

* **Mapa tamaina ertaina**: 64x64 lauki nahikoa da bi hirientzako
* **Zona mota murriztu**: 3 oinarrizkoak (R, C, I) nahikoa dira mekanika erakusteko, trinkoa/arina aukerakoa
* **Zentral elektriko sinplifikatuak**: 3-4 mota soilik (ikatza, nuklearra, eguzki-energia, fusioa)
* **Zerbitzu eraikin sinpleak**: Polizia, suhiltzaileak eta eskola soilik hasieran
* **Aurrekontu sinplifikatua**: Zerga tasa bakarra R/C/I guztientzat, sailkako finantzaketa fintzerik gabe
* **Lurralde laua**: Altuera sistema aukerakoa da, lur laua askoz sinpleagoa
* **AA alkate sinplea**: Nortasun bakarra (orekatua) nahikoa da hasieran
* **Hondamendi eraso bakarra**: Sute mota bakarra nahikoa da lehia sistema erakusteko

### 17.4. Frontend Optimizazioak

* **Mapa isometrikoa**: Lauki isometrikoen sprite-sheet sistema. 2:1 ratioa (zabalera:altuera).
* **Bistaratze optimizazioa**: Soilik pantailan ikusten diren laukiak errendatzea (viewport culling)
* **Canvas vs DOM**: Canvas gomendagarria da mapa handientzako, DOM elementuak UI paneletarako
* **Datu gainjarriak**: Kolore gardenen bidez maparen gainean errendatu
* **Zona koloreak**: R = berdea, C = urdina, I = horia (SimCity 2000 konbentzioa)

### 17.5. Backend Optimizazioak

* **Tick simulazioa**: Hileko kalkuluak modu eraginkorrean egitea. BFS algoritmoa energia/ur sare hedapenerako.
* **Egoera inmutable**: Aldaketak egoera berri bat sortzea, auto-gordetzea errazteko
* **Simulazio sinplifikatuak**: Kutsadura eta krimena hedapena lauki inguruko batez bestekoekin kalkulatu
* **Datu estatikoak**: Eraikin, zentral eta zerbitzu ezaugarriak JSON fitxategi statikoetan mantendu

### 17.6. AA-ren Hausnarketa Denbora Hobetzeko

* **Aurreko hilabeteetan ikasitakoa gehitu**: AA-ri lagungarria izango zaion historial bat mantendu
* **Erabaki-zuhaitzak sinplifikatu**: AA-ren erabaki aukerak murriztu ikuspegi ezberdinetan fokua jartzeko
* **Erantzunaren tokenak mugatu**: Prompt-ek erantzun formatua argi definitu behar dute token kopurua murrizteko
* **Hiri egoeraren laburpena**: JSON osoa bidali beharrean, laburpen numeriko bat sortu token aurrezteko

### 17.7. Jokagarritasuna Ziurtatzeko Garapen Lehentasunak

1. Oinarrizko mapa isometrikoa eta zona jartzea
2. Energia sare sistema (zentral elektrikoa + energia banatzea)
3. Errepide sarea eta zona garapen baldintzak
4. Hileko tick simulazioa (RCI eskaria + hazkundea)
5. Aurrekontu sistema (zergak + finantzaketa)
6. Zerbitzu eraikinak eta estaldura
7. Ur sare sistema
8. AA aurkari oinarrizkoa (LLM bidez)
9. Lehia sistema (metrikak + hondamendi erasoak)
10. Garaipena baldintzen egiaztatzea
11. Partiden gordetze eta kargatze sistema
12. Trikimailu sistema

Proiektuaren lehen fasean funtzionalitate hauek inplementatzera mugatu, eta behin funtzionala denean, edozein hedapen edo konplexutasun gehigarri gehitu.
