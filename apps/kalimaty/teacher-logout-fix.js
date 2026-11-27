// Ensure the teacher account page exposes the existing logout flow.
// The main bundle wires the click handler, but its teacher view omitted the card.
(function () {
  function addTeacherLogoutCard() {
    if (typeof window.vTcClass !== "function" || typeof window.render !== "function") return;

    const original = window.vTcClass;
    if (original.__teacherLogoutPatched) return;

    function teacherViewWithLogout() {
      const html = original.apply(this, arguments);
      if (!html || !html.includes('class="screen au tc"') || html.includes('data-teacher-logout-card')) {
        return html;
      }

      const card = '<div class="card teacher-account-card" data-teacher-logout-card><b>تسجيل الخروج</b><small>الخروج من حساب المعلم على هذا الجهاز.</small><button class="btn ghost" style="margin-top:8px;min-height:42px" data-act="kx_tout">تسجيل الخروج</button></div>';
      const deleteStart = html.indexOf('<div class="card au-danger">');
      if (deleteStart < 0) {
        const end = html.lastIndexOf("</div>");
        return end < 0 ? html : html.slice(0, end) + card + html.slice(end);
      }

      const deleteEnd = html.indexOf("</div>", deleteStart) + 6;
      const deleteCard = html.slice(deleteStart, deleteEnd)
        .replace('<div class="card au-danger">', '<details class="card au-danger teacher-account-card">' + '<summary style="cursor:pointer;font-weight:800">إعدادات الحساب</summary>')
        .replace('<b>إعدادات الحساب</b>', '')
        .replace("</div>", "</details>");
      return html.slice(0, deleteStart) + card + deleteCard + html.slice(deleteEnd);
    }

    teacherViewWithLogout.__teacherLogoutPatched = true;
    window.vTcClass = teacherViewWithLogout;
    window.render(true);
  }

  window.addEventListener("load", addTeacherLogoutCard, { once: true });
})();
