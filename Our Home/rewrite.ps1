param($Path)

$src = [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)

# === PHASE 1: META/TITLE ===
$src = $src -replace '<meta name="theme-color" content="#F59E0B" />', '<meta name="theme-color" content="#3B82F6" />'
$src = $src -replace '<title>بيتنا - مشتريات البيت 🏠</title>', '<title>بيتنا</title>'

# === PHASE 2: REMOVE EMOJIS FROM UI TEXT (simple find/replace) ===
# Brand desc
$src = $src -replace 'طلبات البيت ومصاريفه في مكان واحد\.\.\. والجوهرة هي الحب ❤️', 'طلبات البيت ومصاريفه في مكان واحد... والجوهرة هي الحب'

# Button emojis
$src = $src -replace '🏠 عمل بيت جديد', 'عمل بيت جديد'
$src = $src -replace '🔗 انضم لبيت موجود', 'انضم لبيت موجود'
$src = $src -replace '↩️ رجوع', 'رجوع'
$src = $src -replace '🏠 عمل البيت', 'عمل البيت'
$src = $src -replace '📋 نسخ الكود', 'نسخ الكود'
$src = $src -replace '🚪 ادخل البيت', 'ادخل البيت'
$src = $src -replace '🔑 انضم للبيت', 'انضم للبيت'
$src = $src -replace '✅ يلا ندخل', 'يلا ندخل'
$src = $src -replace '➕ زوّد طلب', 'زوّد طلب'
$src = $src -replace '💾 حفظ', 'حفظ'
$src = $src -replace '↩️ لا', 'لا'
$src = $src -replace '↩️ رجوع', 'رجوع'
$src = $src -replace '🔄 الطلبات اللي بتتكرر', 'الطلبات اللي بتتكرر'
$src = $src -replace '📋 نسخ', 'نسخ'
$src = $src -replace '↗️ ابعت', 'ابعت'
$src = $src -replace '🗑️ مسح الكل', 'مسح الكل'
$src = $src -replace '💰 زوّد مصروف', 'زوّد مصروف'
$src = $src -replace '✅ جبتها يا بطل', 'جبتها يا بطل'
$src = $src -replace '✏️ تعديل الطلب', 'تعديل الطلب'

# Badge text
$src = $src -replace '✅ اتشترى', 'تم الشراء'
$src = $src -replace '📋 مطلوب', 'مطلوب'
$src = $src -replace '✅ خلاص', 'تم'

# Page titles
$src = $src -replace 'طلبات البيت 🏡', 'طلبات البيت'
$src = $src -replace 'الحساب يا معلم 💸', 'الحساب'
$src = $src -replace 'المصروفات 💰', 'المصروفات'
$src = $src -replace 'التقارير 📊', 'التقارير'
$src = $src -replace 'الإعدادات ⚙️', 'الإعدادات'

# Greetings
$src = $src -replace "صباح الخير ☀️", "صباح الخير"
$src = $src -replace "مساء النور 🌤️", "مساء النور"
$src = $src -replace "مساء الخير 🌙", "مساء الخير"
$src = $src -replace "👋", ""

# Greeting labels
$src = $src -replace "الطلبات 🛒", "الطلبات"

# Section headers - reports
$src = $src -replace "☀️ تقرير النهارده", "تقرير اليوم"
$src = $src -replace "📅 تقرير الأسبوع", "تقرير الأسبوع"
$src = $src -replace "📈 المصاريف", "المصاريف"
$src = $src -replace "🗓️ تقرير الشهر", "تقرير الشهر"
$src = $src -replace "📊 التوزيع على الأقسام", "التوزيع على الأقسام"
$src = $src -replace "📈 المصاريف اليومية", "المصاريف اليومية"
$src = $src -replace "🏆 ملخص كل شيء", "الملخص"
$src = $src -replace "عملية شراء 🎉", "عملية شراء"
$src = $src -replace "ذكريات المعركة 😂", "ذكريات المعركة"
$src = $src -replace "إحصائيات البيت", "إحصائيات البيت"

# Empty states
$src = $src -replace '_AddEmojiFromEmptyIcon', 'addEmptyIcon'  # placeholder
$src = $src -replace 'noxious icon: 📭', 'no'
$src = $src -replace 'noxious icon: 📊', 'no'

# Filter chips  
$src = $src -replace "📑 الكل", "الكل"

# Delete expense
$src = $src -replace "🗑️ شيل", "حذف"

# About section
$src = $src -replace "صُنع بـ ❤️ ل أهل بيتنا", "صُنع بحب لأهل بيتنا"
$src = $src -replace "بيتنا v2.0 • النسخة الكوميدية 😂", "بيتنا v2.0"

# Settings section title
$src = $src -replace "خطر ⚠️", "خطر"

# Order meta emojis
$src = $src -replace '📍 ${', '${'  # these are template literals, handle in code
$src = $src -replace '📝 ${', '${'

# Category query
$src = $src -replace '💡 مش عارفين القسم ده', 'مش عارفين القسم ده'

# Pharmacy note
$src = $src -replace '⚠️ ده قسم صيدلية', 'تنبيه: ده قسم صيدلية'

# Toast messages
$src = $src -replace 'تمام يا ستي ✓', 'تمام يا ستي'
$src = $src -replace '上帝يا حبيبي، تمام ✓', 'تمام يا حبيبي'
$src = $src -replace ' handled ✓', ' handled'
$src = $src -replace ' يس equalTo ✓', ' تمام'
$src = $src -replace 'تم النسخ ✓', 'تم النسخ'
$src = $src -replace 'تم التعديل ✓', 'تم التعديل'
$src = $src -replace 'اتمسح ✓', 'اتمسح'
$src = $src -replace 'تم المسح ✓', 'تم المسح'
$src = $src -replace 'تمام، الاسم اتحدث ✓', 'تمام، الاسم اتحدث'
$src = $src -replace 'اسم البيت اتحدث ✓', 'اسم البيت اتحدث'
$src = $src -replace 'اسم القسم اتحدث ✓', 'اسم القسم اتحدث'
$src = $src -replace 'تم النسخ/المشاركة ✓', 'تم النسخ/المشاركة'
$src = $src -replace 'تم تسجيل المصروف ✓', 'تم تسجيل المصروف'
$src = $src -replace 'زوّدت ${items.length} طلبات ✓ 😂', 'زوّدت ${items.length} طلبات'
$src = $src -replace 'أهلاً يا ${name}! 👋', 'أهلاً يا ${name}!'
$src = $src -replace "تم النسخ ✓", "تم النسخ"

# Share text
$src = $src -replace "تعالى ا joining بيتنا 🏠\nكود הבית: ${code}", "تعالى انضم لبيتنا\nكود البيت: ${code}"
$src = $src -replace "تعالى ا joining بيتنا 🏠`n", "تعالى انضم لبيتنا`n"

# Modal titles
$src = $src -replace "عمل بيت جديد 🏡", "عمل بيت جديد"
$src = $src -replace "ادخل بيت موجود 🔗", "ادخل بيت موجود"
$src = $src -replace "قولنا اسمك؟ 👋", "قولنا اسمك؟"
$src = $src -replace "🎉 اشترت", "اشترت"
$src = $src -replace "💰 مصروف جديد", "مصروف جديد"

# Confirm dialog
$src = $src -replace "'↩️ لا'", "'لا'"

# Toast success clean
$src = $src -replace '"تمام يا ستي ✓"', '"تمام يا ستي"'

[System.IO.File]::WriteAllText($Path, $src, [System.Text.Encoding]::UTF8)
Write-Host "Text replacements done"
