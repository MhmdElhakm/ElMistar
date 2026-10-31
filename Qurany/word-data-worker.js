var meaningsPromise = null;
var lamasatPromise = null;

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
    var book = books.find(function (item) {
      return item && item.book_info && +item.book_info.id === +request.bookId;
    });
    var selectedKey = normalizeWord(request.word);
    if (!book || !selectedKey || !Array.isArray(book.words)) return '';
    var match = book.words.find(function (item) {
      if (!item || !item.text || !item.meaning) return false;
      var entryKey = normalizeWord(item.text);
      var entryWords = item.text.split(/\s+/).map(normalizeWord);
      return entryKey === selectedKey || entryWords.indexOf(selectedKey) >= 0 ||
        (selectedKey.length >= 4 && entryKey.indexOf(selectedKey) >= 0);
    });
    return match ? { text: match.meaning, word: match.text, book: book.book_info.name } : '';
  });
}

function loadLamasat() {
  if (!lamasatPromise) {
    lamasatPromise = fetch('./json/lamasat_bayani_words.json').then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    }).then(function (dataset) {
      if (!dataset || !dataset.metadata || !Array.isArray(dataset.entries)) {
        throw new Error('تنسيق ملف اللمسات البيانية غير صالح');
      }
      return {
        author: dataset.metadata.author || '',
        entries: dataset.entries.filter(function (entry) {
          return entry && typeof entry.why_this_word_or_form_here === 'string';
        }).map(function (entry) {
          return {
            surah: entry.surah_context ? normalizeText(entry.surah_context).text : '',
            context: entry.surah_context || '',
            word: entry.word_or_expression || '',
            title: entry.section_title || '',
            reason: entry.why_this_word_or_form_here,
            references: Array.isArray(entry.verse_references_as_written) ? entry.verse_references_as_written : []
          };
        })
      };
    }).catch(function (error) {
      lamasatPromise = null;
      throw error;
    });
  }
  return lamasatPromise;
}

function findLamasat(request) {
  return loadLamasat().then(function (dataset) {
    var surahName = normalizeText(request.surahName).text;
    var ayah = +request.ayah;
    var matches = [];
    dataset.entries.forEach(function (entry) {
      var matchingReferences = entry.references.filter(function (reference) {
        if (!reference || !reference.surah_text ||
            normalizeText(reference.surah_text).text !== surahName) return false;
        var firstText = String(reference.ayah || '').replace(/[٠-٩]/g, function (digit) {
          return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
        });
        var lastText = String(reference.ayah_end || '').replace(/[٠-٩]/g, function (digit) {
          return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
        });
        var first = parseInt(firstText.replace(/\D/g, ''), 10);
        var last = reference.ayah_end ? parseInt(lastText.replace(/\D/g, ''), 10) : first;
        return Number.isFinite(first) && Number.isFinite(last) &&
          ayah >= Math.min(first, last) && ayah <= Math.max(first, last);
      });
      var contextMatch = entry.surah === surahName;
      if (!matchingReferences.length && !contextMatch) return;
      matches.push({
        title: entry.title,
        word: entry.word,
        reason: entry.reason,
        context: entry.context,
        references: matchingReferences,
        rank: matchingReferences.length ? 0 : 1
      });
    });
    matches.sort(function (a, b) { return a.rank - b.rank; });
    return { author: dataset.author, matches: matches.slice(0, 3) };
  });
}

self.addEventListener('message', function (event) {
  var request = event.data;
  if (!request || !Number.isInteger(request.id)) return;
  var operation = request.type === 'meaning' ? findMeaning(request) :
    request.type === 'lamasat' ? findLamasat(request) :
      Promise.reject(new Error('عملية بيانات غير معروفة'));
  operation.then(function (result) {
    self.postMessage({ id: request.id, result: result });
  }).catch(function (error) {
    self.postMessage({ id: request.id, error: error && error.message ? error.message : 'تعذر تحميل بيانات التحليل' });
  });
});
