var FOTO_MAP_NAAM = 'Voorraad-fotos'; // naam van de Drive-map; wordt aangemaakt als die niet bestaat

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var ss = SpreadsheetApp.openById('1wYs_AMc-ZP5iJA50S2xeNHrzYTwh2B2w-dZOBELfo8M');
  var sheet = ss.getSheetByName('Mijn voorraad');
  var action = e.parameter.action || (e.postData ? JSON.parse(e.postData.contents).action : '');

  var result;

  if (action === 'read') {
    result = readAll(sheet);
  } else if (action === 'update') {
    var data = JSON.parse(e.postData.contents);
    result = updateRow(sheet, data);
  } else if (action === 'add') {
    var data = JSON.parse(e.postData.contents);
    result = addRow(sheet, data);
  } else if (action === 'delete') {
    var data = JSON.parse(e.postData.contents);
    result = deleteRow(sheet, data);
  } else if (action === 'uploadFoto') {
    var data = JSON.parse(e.postData.contents);
    result = uploadFoto(sheet, data);
  } else if (action === 'getFoto') {
    var data = JSON.parse(e.postData.contents);
    result = getFoto(data);
  } else if (action === 'deleteFoto') {
    var data = JSON.parse(e.postData.contents);
    result = deleteFoto(sheet, data);
  } else {
    result = {error: 'Onbekende actie'};
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function readAll(sheet) {
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    rows.push(row);
  }
  return {rows: rows};
}

// Zoekt elke kolom op zijn kopnaam, zodat kolommen in de Sheet vrij verplaatst kunnen worden.
// Accenten tellen niet mee: de kop met e-trema heet hier 'Categorieen'.
function getCategorie(data) {
  return data.Categorieen !== undefined ? data.Categorieen : data['Categorie\u00ebn'];
}

function getKolommen(headers) {
  var kolommen = {};
  for (var j = 0; j < headers.length; j++) {
    var naam = headers[j].toString().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (naam) kolommen[naam] = j;
  }
  var verplicht = ['Opslagplaats', 'Categorieen', 'Productnaam', 'Vervaldatum', 'Aantal', 'Comment', 'GrPerStuk', 'Foto'];
  for (var k = 0; k < verplicht.length; k++) {
    if (kolommen[verplicht[k]] === undefined) {
      throw new Error('Kolom "' + verplicht[k] + '" niet gevonden in de Sheet');
    }
  }
  return kolommen;
}

// Geeft de rij-index terug van het product op die opslagplaats, of -1.
function zoekRij(values, kolommen, data) {
  for (var i = 1; i < values.length; i++) {
    if (values[i][kolommen.Productnaam].toString().toLowerCase() === data.Productnaam.toString().toLowerCase() &&
        values[i][kolommen.Opslagplaats].toString().toLowerCase() === data.Opslagplaats.toString().toLowerCase()) {
      return i;
    }
  }
  return -1;
}

function updateRow(sheet, data) {
  try {
    var values = sheet.getDataRange().getValues();
    var kolommen = getKolommen(values[0]);
    var i = zoekRij(values, kolommen, data);
    if (i === -1) return {error: 'Product niet gevonden: ' + data.Productnaam + ' op ' + data.Opslagplaats};

    var schrijf = function(kolomNaam, waarde) {
      if (waarde !== undefined) sheet.getRange(i + 1, kolommen[kolomNaam] + 1).setValue(waarde);
    };
    schrijf('Aantal', data.Aantal);
    schrijf('Opslagplaats', data.Opslagplaats_nieuw);
    schrijf('Vervaldatum', data.Vervaldatum);
    schrijf('Comment', data.Comment);
    schrijf('GrPerStuk', data.GrPerStuk);
    schrijf('Foto', data.Foto);
    schrijf('Categorieen', getCategorie(data));
    return {success: true};
  } catch(e) {
    return {error: e.toString()};
  }
}

function addRow(sheet, data) {
  try {
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var kolommen = getKolommen(headers);
    var rij = [];
    for (var j = 0; j < headers.length; j++) rij.push('');
    rij[kolommen.Opslagplaats] = data.Opslagplaats || '';
    rij[kolommen.Categorieen] = getCategorie(data) || '';
    rij[kolommen.Productnaam] = data.Productnaam || '';
    rij[kolommen.Vervaldatum] = data.Vervaldatum || '';
    rij[kolommen.Aantal] = data.Aantal || 1;
    rij[kolommen.Comment] = data.Comment || '';
    rij[kolommen.GrPerStuk] = data.GrPerStuk || '';
    rij[kolommen.Foto] = data.Foto || '';
    sheet.appendRow(rij);
    return {success: true};
  } catch(e) {
    return {error: e.toString()};
  }
}

function deleteRow(sheet, data) {
  try {
    var values = sheet.getDataRange().getValues();
    var i = zoekRij(values, getKolommen(values[0]), data);
    if (i === -1) return {error: 'Product niet gevonden'};
    sheet.deleteRow(i + 1);
    return {success: true};
  } catch(e) {
    return {error: e.toString()};
  }
}

// Geeft de Drive-map terug; maakt hem aan als hij niet bestaat
function getFotoMap() {
  var folders = DriveApp.getFoldersByName(FOTO_MAP_NAAM);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(FOTO_MAP_NAAM);
}

// Ontvangt base64-foto, slaat op in Drive, schrijft file-id naar Sheet
function uploadFoto(sheet, data) {
  try {
    var values = sheet.getDataRange().getValues();
    var kolommen = getKolommen(values[0]);
    var rij = zoekRij(values, kolommen, data);
    if (rij === -1) return {error: 'Product niet gevonden'};

    // Gooi bestaand bestand weg als dat er is
    var oudFileId = values[rij][kolommen.Foto] ? values[rij][kolommen.Foto].toString() : '';
    if (oudFileId) {
      try { DriveApp.getFileById(oudFileId).setTrashed(true); } catch(e) {}
    }

    var map = getFotoMap();
    var bestandsnaam = data.Productnaam.replace(/[^a-zA-Z0-9_\-]/g, '_') + '.jpg';
    var blob = Utilities.newBlob(
      Utilities.base64Decode(data.fotoBase64),
      data.mimeType || 'image/jpeg',
      bestandsnaam
    );
    var bestand = map.createFile(blob);
    var fileId = bestand.getId();

    sheet.getRange(rij + 1, kolommen.Foto + 1).setValue(fileId);
    return {success: true, fileId: fileId};
  } catch(e) {
    return {error: e.toString()};
  }
}

// Geeft foto-bytes terug als base64 op basis van file-id
function getFoto(data) {
  try {
    var bestand = DriveApp.getFileById(data.fileId);
    var base64 = Utilities.base64Encode(bestand.getBlob().getBytes());
    return {success: true, data: base64, mimeType: bestand.getMimeType()};
  } catch(e) {
    return {error: e.toString()};
  }
}

// Verwijdert foto uit Drive en wist file-id uit Sheet
function deleteFoto(sheet, data) {
  try {
    var values = sheet.getDataRange().getValues();
    var kolommen = getKolommen(values[0]);
    var i = zoekRij(values, kolommen, data);
    if (i === -1) return {error: 'Product niet gevonden'};
    var fileId = values[i][kolommen.Foto] ? values[i][kolommen.Foto].toString() : '';
    if (fileId) {
      try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
    }
    sheet.getRange(i + 1, kolommen.Foto + 1).setValue('');
    return {success: true};
  } catch(e) {
    return {error: e.toString()};
  }
}
