var meaningsPromise = null;

function normalizeArabic(value) {
  return String(value || '')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function normalizeWord(value) {
  return normalizeArabic(value).replace(/[^\u0621-\u064A\u0671]/g, '');
}

function normalizeText(value) {
  var source = String(value || ''), text = '', positions = [];
  for (var i = 0; i < source.length; i++) {
    var character = source.charAt(i);
    if (/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/.test(character)) continue;
    if (/[٠-٩]/.test(character)) character = String('٠١٢٣٤٥٦٧٨٩'.indexOf(character));
    character = character.replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
    for (var j = 0; j < character.length; j++) {
      var normalizedCharacter = character.charAt(j);
      if (!/[\u0621-\u064A\u0671a-z0-9-]/i.test(normalizedCharacter)) normalizedCharacter = ' ';
      if (normalizedCharacter === ' ' && (!text || text.charAt(text.length - 1) === ' ')) continue;
      text += normalizedCharacter;
      positions.push(i);
    }
  }
  while (text.charAt(text.length - 1) === ' ') {
    text = text.slice(0, -1);
    positions.pop();
  }
  return { text: text, positions: positions };
}

function loadMeanings() {
  if (!meaningsPromise) {
    meaningsPromise = fetch('./json/meanings.json').then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (dataset) {
      if (!dataset || !dataset.license || !Array.isArray(dataset.data)) {
        throw new Error('تنسيق ملف معاني غريب القرآن غير صالح');
      }
      return dataset;
    }).catch(function (error) {
      meaningsPromise = null;
      throw error;
    });
  }
  return meaningsPromise;
}

function findMeaning(request) {
  return loadMeanings().then(function (dataset) {
    var entry = dataset.data.find(function (item) {
      return item && item.surah === request.surah && item.ayah === request.ayah;
    });
    var books = entry && Array.isArray(entry.meanings) ? entry.meanings : [];
    var selectedKey = normalizeWord(request.word);
    if (!selectedKey) return '';
    var supportedBookIds = [491, 327, 1424];
    var availableBooks = books.filter(function (book) {
      return book && book.book_info && supportedBookIds.indexOf(+book.book_info.id) >= 0 &&
        Array.isArray(book.words);
    });
    availableBooks.sort(function (a, b) {
      return (+a.book_info.id === +request.bookId ? -1 : 0) -
        (+b.book_info.id === +request.bookId ? -1 : 0);
    });
    for (var i = 0; i < availableBooks.length; i++) {
      var book = availableBooks[i];
      var match = book.words.find(function (item) {
        if (!item || !item.text || !item.meaning) return false;
        var entryKey = normalizeWord(item.text);
        var entryWords = item.text.split(/\s+/).map(normalizeWord);
        return entryKey === selectedKey || entryWords.indexOf(selectedKey) >= 0 ||
          (selectedKey.length >= 4 && entryKey.indexOf(selectedKey) >= 0);
      });
      if (match) return { text: match.meaning, word: match.text, book: book.book_info.name };
    }
    return '';
  });
}

self.addEventListener('message', function (event) {
  var request = event.data;
  if (!request || !Number.isInteger(request.id)) return;
  var operation = request.type === 'meaning' ? findMeaning(request) :
    Promise.reject(new Error('عملية بيانات غير معروفة'));
  operation.then(function (result) {
    self.postMessage({ id: request.id, result: result });
  }).catch(function (error) {
    self.postMessage({ id: request.id, error: error && error.message ? error.message : 'تعذر تحميل بيانات التحليل' });
  });
});
