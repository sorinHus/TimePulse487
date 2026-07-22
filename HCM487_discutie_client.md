# HCM487 (fost TimePulse487) — Discuție cerințe client

**Status:** discuție conceptuală, fără implementare, în așteptarea contractului semnat și a detaliilor suplimentare de la client.

**Stack existent:** Django 5 + DRF + PostgreSQL, React + Vite + CSS Modules, JWT. Model single-tenant (container + bază de date separată per client), plan de deployment pe subdomenii `clientname.hcm.487.ro`, găzduit pe VPS Hetzner.

---

## 1. Clock-in / Clock-out

- Angajatul face **doar clock-in**; clock-out se face **automat**, la finalul programului, pentru a evita ore suplimentare neintenționate.
- Dacă angajatul ajunge **mai devreme**: se înregistrează ora de start a programului (nu ora reală de sosire).
- Dacă angajatul **întârzie**: se înregistrează ora reală de clock-in, iar întârzierea apare **evidențiată vizual** în foaia de prezență a managerului.
- **De discutat cu clientul:** ce se întâmplă dacă angajatul pleacă mai devreme — rămâne posibilitate de clock-out manual opțional, sau se închide mereu automat la ora de final de program?
- **Ture de noapte:** necesită gestionare eficientă (sesiunea de lucru trebuie legată de ziua de start a turei, chiar dacă se termină după miezul nopții).
- **Program 12h + 1h pauză:** pe foaia colectivă de pontaj lunar trebuie să apară **8 ore/zi** (fix), indiferent de programul real, pentru ca angajatul să primească tichete de masă pentru fiecare zi. Concluzie arhitecturală: orele reale (pt. prezență/întârzieri) și orele "oficiale" de pontaj (pt. tichete/salarizare) trebuie ținute ca valori separate în model, nu calculate una din alta.

## 2. Program diferențiat pe departamente

- Program **fix per departament** (ore start/stop + durata pauzei).
- Fiecare "tip de program" (normal, tură 12h, tură de noapte) ar trebui să aibă propriile ore reale așteptate + orele echivalente pentru tichete de masă.
- **De clarificat:** dacă toate departamentele cu tură de 12h primesc aceleași 8h fixe pe pontaj, sau diferă în funcție de tipul turei.

## 3. Acces rețea — angajați vs. manageri/admini

- **Angajați:** acces doar din rețeaua internă a hotelului.
- **Manageri/admini:** acces de oriunde.
- **Recomandare:** combinație rol + IP whitelist (verificare la nivel de backend/reverse proxy: dacă rolul e "angajat", IP-ul sursă trebuie să fie în lista albă a hotelului, stocată în DB per client; managerii/adminii au acces neîngrădit). Variantă flexibilă pentru un produs multi-client.
- **De aflat:** hotelul are IP public static sau dinamic? (Static = simplu de implementat; dinamic = necesită soluție alternativă sau IP static cerut de la ISP.)

## 4. Backup — infrastructură pe Hetzner

Două straturi recomandate, independente:

1. **Snapshot server** (Hetzner Backup add-on): activare din panoul Hetzner, cost ~20% din prețul VPS-ului, până la 7 backup-uri păstrate. Restaurează tot serverul, nu selectiv.
2. **Backup logic al bazei de date** (recomandat suplimentar): `pg_dump` programat via cron, trimis pe un **Hetzner Storage Box** separat (de la ~3,20 €/lună pentru 1 TB), prin WebDAV/SFTP/rsync. Oferă granularitate (restore la o zi anume) și redundanță (locație separată de server).

**Lecții din atacul cibernetic ANCPI (iulie 2026), aplicabile la backup:**
- Atacatorul ar fi folosit un cont de admin Veeam pentru a șterge backup-urile înainte de a bloca sistemele — backup-ul trebuie **izolat**, nu doar separat.
- Credențiale de backup **diferite** de cele ale VPS-ului principal, niciodată reutilizate.
- Acces **write-only/append-only** dinspre VPS către destinația de backup (nu poate șterge/suprascrie backup-uri vechi).
- Cel puțin o copie cu retenție imutabilă, ca variantă de ultimă instanță.
- Principiul minimelor privilegii: contul de backup nu trebuie să fie totuna cu un cont de admin general.
- Dependințe și servicii actualizate; nimic expus inutil pe același server/rețea.
- Monitorizare/alertare pentru eșecuri de backup sau ștergeri neobișnuite.
- Testare periodică a restaurării, nu doar prezența fișierului de backup.

## 5. Roluri și conturi

Patru tipuri de cont: **admin, director general, manager departament, angajat**.

- **Manager departament:** generează foaia de pontaj (tichete de masă) pentru propriul departament.
- **Director general:** aprobă toate foile de pontaj la final de lună; singurul rol care supraveghează mai multe departamente simultan (tratat ca acces global, nu ca asignare explicită pe departamente).
- **Delegare temporară:** când un manager de departament intră în concediu, cererea de concediu trebuie să nominalizeze cel puțin un înlocuitor (subaltern din departament sau alt manager de departament), care preia drepturile/atribuțiile pe perioada respectivă. De implementat ca mecanism temporal legat de cererea de concediu (nu ca schimbare permanentă de rol), cu expirare automată la finalul perioadei.
- **Flux de aprobare pontaj:** necesită stare/status (draft → generat de manager → aprobat de DG), cu urmărire cine/când, pentru audit.
- **Nedecis încă:** dacă un contabil/auditor extern are nevoie de acces direct în sistem sau doar de rapoarte exportate.

## Întrebări deschise pentru client

- Ce se întâmplă la plecarea mai devreme a angajatului (clock-out manual opțional sau mereu automat)?
- Diferă orele fixe de pontaj (tichete de masă) în funcție de tipul turei (zi/noapte)?
- Hotelul are IP public static sau dinamic?
- Dacă DG respinge un pontaj la aprobare, se poate retrimite la manager pentru corectură, sau DG modifică direct?
- Ce regulă la delegare dacă înlocuitorul nominalizat nu e disponibil (suprapunere de concedii)?
- Are nevoie un contabil/auditor extern de acces direct sau doar de exporturi?

---

*Document conceptual, actualizat pe măsură ce vin detalii suplimentare de la client. Nu conține implementare de cod.*
