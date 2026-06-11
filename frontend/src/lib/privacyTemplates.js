import jsPDF from "jspdf";

const MARGIN = 18;

function addHeader(doc, title) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(title, MARGIN, 25);
  doc.setDrawColor(200);
  doc.line(MARGIN, 28, 210 - MARGIN, 28);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
}

function writeParagraph(doc, text, y, options = {}) {
  const width = options.width || 210 - MARGIN * 2;
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, MARGIN, y);
  return y + lines.length * 4.5 + (options.spaceAfter ?? 3);
}

function writeHeading(doc, text, y) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(text, MARGIN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  return y + 5;
}

function ensureSpace(doc, y, needed = 30) {
  if (y + needed > 280) {
    doc.addPage();
    return MARGIN + 5;
  }
  return y;
}

// ================= INFORMATIVA =================
export function generateInformativaPDF({ orgName = "UO Reumatologia", dpoEmail = "" }) {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString("it-IT");

  addHeader(doc, "Informativa Privacy (Art. 13 GDPR)");
  doc.setFontSize(9);
  doc.text(`Titolare del trattamento: ${orgName}`, MARGIN, 34);
  doc.text(`Data: ${today}`, MARGIN, 39);

  let y = 48;
  doc.setFontSize(10);

  y = writeHeading(doc, "1. Titolare del trattamento", y);
  y = writeParagraph(doc, `Il Titolare del trattamento dei dati personali è ${orgName}. Eventuali comunicazioni relative al trattamento dei dati possono essere inviate al Titolare${dpoEmail ? ` o al Responsabile della protezione dei dati (DPO) all'indirizzo: ${dpoEmail}` : ""}.`, y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "2. Finalità del trattamento e base giuridica", y);
  y = writeParagraph(doc, "I dati clinici (categorie particolari di dati - dati relativi alla salute, Art. 9 GDPR) sono trattati per finalità di CURA, DIAGNOSI, TRATTAMENTO SANITARIO e GESTIONE DEI SERVIZI SANITARI (Art. 9(2)(h) GDPR).", y);
  y = writeParagraph(doc, "Base giuridica: Art. 9(2)(h) GDPR - Regolamento UE 2016/679 - e Art. 2-septies del D.Lgs 196/2003 come modificato dal D.Lgs 101/2018. Per tali finalità NON è richiesto il consenso esplicito dell'interessato.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "3. Tipologia di dati trattati e pseudonimizzazione", y);
  y = writeParagraph(doc, "Il sistema informatico utilizzato applica misure di PSEUDONIMIZZAZIONE (Art. 4(5) GDPR): i dati clinici sono associati ad un codice identificativo e NON direttamente al nome/cognome dell'interessato. La tabella di corrispondenza codice↔identità è conservata separatamente, sotto forma cartacea o in archivio elettronico protetto, presso il Titolare.", y);
  y = writeParagraph(doc, "Categorie di dati trattati nell'applicativo: codice paziente, anno di nascita, sesso, diagnosi, valutazioni clinimetriche, esami di laboratorio, terapie in corso, profilo d'organo per patologie specifiche.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "4. Modalità del trattamento", y);
  y = writeParagraph(doc, "I dati sono trattati con strumenti informatici, con logiche strettamente correlate alle finalità indicate. Sono adottate misure di sicurezza adeguate (autenticazione multi-utente, cifratura in transito HTTPS, controllo accessi basato su ruoli, audit log).", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "5. Destinatari dei dati", y);
  y = writeParagraph(doc, "I dati possono essere comunicati esclusivamente a: personale sanitario autorizzato dell'UO, Autorità sanitarie e giudiziarie quando previsto dalla legge, fornitore del servizio informatico in qualità di Responsabile esterno (Art. 28 GDPR). I dati NON sono oggetto di diffusione, profilazione automatizzata o trasferimento extra-SEE.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "6. Periodo di conservazione", y);
  y = writeParagraph(doc, "I dati clinici sono conservati per il tempo necessario al perseguimento delle finalità di cura e comunque non oltre i termini previsti dalla normativa sanitaria (tipicamente 10 anni per la cartella clinica ambulatoriale, illimitato per la cartella clinica ospedaliera).", y);

  y = ensureSpace(doc, y, 50);
  y = writeHeading(doc, "7. Diritti dell'interessato", y);
  y = writeParagraph(doc, "L'interessato ha diritto di: accedere ai propri dati (Art. 15), richiederne la rettifica (Art. 16), cancellazione (Art. 17, nei limiti dell'obbligo di conservazione sanitaria), limitazione (Art. 18), portabilità (Art. 20), opposizione (Art. 21) e proporre reclamo all'Autorità Garante per la protezione dei dati personali (www.garanteprivacy.it).", y);
  y = writeParagraph(doc, `Per esercitare i diritti contattare: ${orgName}${dpoEmail ? ` - ${dpoEmail}` : ""}.`, y);

  y = ensureSpace(doc, y, 30);
  y = writeHeading(doc, "8. Presa visione dell'informativa", y);
  y = writeParagraph(doc, "Il presente documento è stato portato a conoscenza dell'interessato in forma scritta e/o orale in occasione della prima visita. La firma NON è richiesta quando la base giuridica è l'Art. 9(2)(h) GDPR (finalità di cura).", y);

  y += 6;
  doc.setDrawColor(180);
  doc.line(MARGIN, y, 90, y);
  doc.line(110, y, 200 - MARGIN, y);
  doc.setFontSize(8);
  doc.text("Data", MARGIN, y + 5);
  doc.text("Firma del paziente (facoltativa)", 110, y + 5);

  doc.save(`informativa_privacy_${Date.now()}.pdf`);
}

// ================= REGISTRO TRATTAMENTI =================
export function generateRegistroTrattamentiPDF({ orgName = "UO Reumatologia", dpoEmail = "" }) {
  const doc = new jsPDF();
  const today = new Date().toLocaleDateString("it-IT");

  addHeader(doc, "Registro delle attività di trattamento (Art. 30 GDPR)");
  doc.setFontSize(9);
  doc.text(`Titolare: ${orgName} - Data aggiornamento: ${today}`, MARGIN, 34);

  let y = 44;

  y = writeHeading(doc, "Sezione 1 - Titolare del trattamento", y);
  y = writeParagraph(doc, `Denominazione: ${orgName}`, y);
  y = writeParagraph(doc, `Sede: [INSERIRE INDIRIZZO]`, y);
  y = writeParagraph(doc, `Contatti: [INSERIRE EMAIL/TEL]`, y);
  y = writeParagraph(doc, `Responsabile protezione dati (DPO): ${dpoEmail || "[NON NOMINATO - facoltativo salvo Art. 37 GDPR]"}`, y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "Sezione 2 - Attività di trattamento: Gestione clinica ambulatoriale reumatologica", y);
  y = writeParagraph(doc, "Finalità: Erogazione prestazioni sanitarie ambulatoriali, valutazione clinimetrica, pianificazione terapeutica, follow-up longitudinale di pazienti affetti da malattie reumatiche.", y);
  y = writeParagraph(doc, "Base giuridica: Art. 9(2)(h) GDPR + Art. 2-septies D.Lgs 196/2003 + autorizzazione generale Garante Privacy.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "Sezione 3 - Categorie di interessati e di dati", y);
  y = writeParagraph(doc, "Interessati: pazienti ambulatoriali e loro rappresentanti legali.", y);
  y = writeParagraph(doc, "Dati comuni: codice identificativo paziente, anno di nascita, sesso, diagnosi.", y);
  y = writeParagraph(doc, "Dati particolari (categoria sensibile Art. 9 GDPR): dati clinici, valutazioni, esami, terapie, profili d'organo.", y);
  y = writeParagraph(doc, "Misure di pseudonimizzazione applicate: SI - i dati nominativi (nome, cognome, CF, data di nascita) NON sono memorizzati nel sistema informatico. La tabella di corrispondenza codice↔identità è mantenuta in archivio separato (cartaceo o elettronico protetto).", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "Sezione 4 - Destinatari dei dati", y);
  y = writeParagraph(doc, "Personale sanitario autorizzato dell'UO (autenticazione individuale, ruoli differenziati). Responsabile esterno del trattamento: fornitore della piattaforma informatica (designazione scritta ex Art. 28 GDPR). Trasferimenti extra-SEE: NO.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "Sezione 5 - Termini di cancellazione", y);
  y = writeParagraph(doc, "Conservazione per il tempo strettamente necessario alle finalità di cura e comunque in conformità alla normativa sanitaria vigente (es. cartella clinica ambulatoriale: 10 anni; cartella clinica ospedaliera: illimitato). Cancellazione automatica al termine del periodo o su richiesta dell'interessato (nei limiti dell'obbligo normativo di conservazione).", y);

  y = ensureSpace(doc, y, 50);
  y = writeHeading(doc, "Sezione 6 - Misure tecniche e organizzative di sicurezza (Art. 32 GDPR)", y);
  const misure = [
    "• Autenticazione multi-utente con password di complessità adeguata e scadenza periodica.",
    "• Controllo accessi basato su ruoli (RBAC): amministratore, membro.",
    "• Cifratura in transito (HTTPS/TLS) per tutte le comunicazioni client-server.",
    "• Audit log delle operazioni di creazione/modifica con identificazione dell'utente.",
    "• Backup periodici del database (JSON/CSV export disponibile on-demand).",
    "• Pseudonimizzazione dei dati personali identificativi diretti.",
    "• Sessioni con cookie HttpOnly Secure SameSite=None e timeout automatico.",
    "• Cancellazione sicura di dati obsoleti secondo la retention policy.",
  ];
  for (const m of misure) {
    y = ensureSpace(doc, y);
    y = writeParagraph(doc, m, y, { spaceAfter: 1 });
  }

  doc.addPage();
  y = MARGIN + 5;
  y = writeHeading(doc, "Sezione 7 - Valutazione impatto sulla protezione dei dati (DPIA)", y);
  y = writeParagraph(doc, "Il trattamento riguarda dati sanitari su larga scala? Valutare caso per caso: se SI, è richiesta una DPIA ai sensi dell'Art. 35 GDPR. Per UO ospedaliere rientra tipicamente nella DPIA aziendale preesistente.", y);

  y = ensureSpace(doc, y);
  y = writeHeading(doc, "Sezione 8 - Violazioni dei dati (data breach)", y);
  y = writeParagraph(doc, "In caso di violazione dei dati, il Titolare è tenuto a notificare al Garante entro 72 ore dalla scoperta (Art. 33 GDPR) e, ove necessario, ad informare gli interessati (Art. 34 GDPR). Predisporre registro interno dei data breach.", y);

  y += 8;
  doc.setDrawColor(180);
  doc.line(MARGIN, y, 200 - MARGIN, y);
  y += 5;
  doc.setFontSize(8);
  doc.text(`Documento redatto il ${today} - da aggiornare periodicamente o in caso di modifiche sostanziali del trattamento.`, MARGIN, y);
  y += 4;
  doc.text("Il presente registro è un documento interno del Titolare (non pubblico). Art. 30 GDPR.", MARGIN, y);

  doc.save(`registro_trattamenti_${Date.now()}.pdf`);
}

// ================= ETICHETTE CODICI =================
export function generateCodiceLabelPDF() {
  const doc = new jsPDF();
  addHeader(doc, "Tabella di corrispondenza codice paziente ↔ identità");
  doc.setFontSize(9);
  doc.text("Documento riservato - da conservare OFFLINE nel fascicolo cartaceo. NON inserire in sistemi informatici.", MARGIN, 34);
  doc.text(`Compilato il ______________  da ______________`, MARGIN, 40);

  // Table header
  let y = 50;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Codice paziente", MARGIN, y);
  doc.text("Cognome e Nome", MARGIN + 45, y);
  doc.text("Data nascita", MARGIN + 115, y);
  doc.text("CF", MARGIN + 145, y);
  doc.setFont("helvetica", "normal");
  y += 2;
  doc.setDrawColor(100);
  doc.line(MARGIN, y, 200 - MARGIN, y);
  y += 5;

  // Empty rows
  for (let i = 0; i < 30; i++) {
    doc.setDrawColor(220);
    doc.line(MARGIN, y + 3, 200 - MARGIN, y + 3);
    y += 8;
    if (y > 280) {
      doc.addPage();
      y = MARGIN + 5;
    }
  }

  doc.save(`corrispondenza_codici_${Date.now()}.pdf`);
}
