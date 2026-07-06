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

function updateRow(sheet, data) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][2].toString().toLowerCase() === data.Productnaam.toString().toLowerCase() &&
        values[i][0].toString().toLowerCase() === data.Opslagplaats.toString().toLowerCase()) {
      if (data.Aantal !== undefined) sheet.getRange(i+1, 5).setValue(data.Aantal);
      if (data.Opslagplaats_nieuw !== undefined) sheet.getRange(i+1, 1).setValue(data.Opslagplaats_nieuw);
      if (data.Vervaldatum !== undefined) sheet.getRange(i+1, 4).setValue(data.Vervaldatum);
      if (data.Comment !== undefined) sheet.getRange(i+1, 6).setValue(data.Comment);
      if (data.GrPerStuk !== undefined) sheet.getRange(i+1, 7).setValue(data.GrPerStuk);
      if (data.Foto !== undefined) sheet.getRange(i+1, 8).setValue(data.Foto);
      return {success: true};
    }
  }
  return {error: 'Product niet gevonden: ' + data.Productnaam + ' op ' + data.Opslagplaats};
}

function addRow(sheet, data) {
  sheet.appendRow([
    data.Opslagplaats || '',
    data.Categorieën || '',
    data.Productnaam || '',
    data.Vervaldatum || '',
    data.Aantal || 1,
    data.Comment || '',
    data.GrPerStuk || '',
    data.Foto || ''
  ]);
  return {success: true};
}

function deleteRow(sheet, data) {
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][2].toString().toLowerCase() === data.Productnaam.toString().toLowerCase() &&
        values[i][0].toString().toLowerCase() === data.Opslagplaats.toString().toLowerCase()) {
      sheet.deleteRow(i+1);
      return {success: true};
    }
  }
  return {error: 'Product niet gevonden'};
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
    var rij = -1;
    var oudFileId = '';
    for (var i = 1; i < values.length; i++) {
      if (values[i][2].toString().toLowerCase() === data.Productnaam.toString().toLowerCase() &&
          values[i][0].toString().toLowerCase() === data.Opslagplaats.toString().toLowerCase()) {
        rij = i;
        oudFileId = values[i][7] ? values[i][7].toString() : '';
        break;
      }
    }
    if (rij === -1) return {error: 'Product niet gevonden'};

    // Gooi bestaand bestand weg als dat er is
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

    sheet.getRange(rij + 1, 8).setValue(fileId);
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
    for (var i = 1; i < values.length; i++) {
      if (values[i][2].toString().toLowerCase() === data.Productnaam.toString().toLowerCase() &&
          values[i][0].toString().toLowerCase() === data.Opslagplaats.toString().toLowerCase()) {
        var fileId = values[i][7] ? values[i][7].toString() : '';
        if (fileId) {
          try { DriveApp.getFileById(fileId).setTrashed(true); } catch(e) {}
        }
        sheet.getRange(i + 1, 8).setValue('');
        return {success: true};
      }
    }
    return {error: 'Product niet gevonden'};
  } catch(e) {
    return {error: e.toString()};
  }
}
