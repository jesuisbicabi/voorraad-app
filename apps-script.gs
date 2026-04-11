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
    data.GrPerStuk || ''
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
