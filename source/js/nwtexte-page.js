(function () {
  'use strict';

  function editor() {
    if (!window.sebNwtexteEditor) throw new Error('Moteur nwtexte indisponible.');
    return window.sebNwtexteEditor;
  }

  function setMenuVisible(visible) {
    const menu = document.getElementById('menu-fichier');
    if (menu) menu.style.display = visible ? 'block' : 'none';
  }

  function toggleMenu() {
    const menu = document.getElementById('menu-fichier');
    if (!menu) return;
    setMenuVisible(menu.style.display !== 'block');
  }

  function preserveSelectionOnMouseDown(element, preventDefault) {
    if (!element) return;
    element.addEventListener('mousedown', function (event) {
      editor().saveSelection();
      if (preventDefault) event.preventDefault();
    });
  }

  function navigateNext() {
    editor().saveEvaluation();
    if (!window.sebParcours?.goNext) throw new Error('Registre de parcours indisponible.');
    window.sebParcours.goNext('nwtexte');
  }

  function install() {
    const formatButtons = {
      'btn-bold':'bold',
      'btn-italic':'italic',
      'btn-underline':'underline',
      'btn-ul':'insertUnorderedList',
      'btn-ol':'insertOrderedList',
      'btn-left':'justifyLeft',
      'btn-center':'justifyCenter',
      'btn-right':'justifyRight'
    };
    Object.entries(formatButtons).forEach(function ([id, command]) {
      const button = document.getElementById(id);
      if (!button) return;
      preserveSelectionOnMouseDown(button, true);
      button.addEventListener('click', function () { editor().format(command); });
    });

    const cut = document.getElementById('btn-cut');
    const copy = document.getElementById('btn-copy');
    const paste = document.getElementById('btn-paste');
    [[cut,'cutSelection'],[copy,'copySelection'],[paste,'pasteFromClipboard']].forEach(function ([button, method]) {
      if (!button) return;
      preserveSelectionOnMouseDown(button, true);
      button.addEventListener('click', function () { editor()[method](); });
    });

    const font = document.getElementById('nw-font');
    const size = document.getElementById('nw-size');
    const lineHeight = document.getElementById('nw-line-height');
    [font,size,lineHeight].forEach(function (select) { preserveSelectionOnMouseDown(select, false); });
    font?.addEventListener('change', function () { editor().format('fontName', font.value); });
    size?.addEventListener('change', function () { editor().setFontSize(size.value); });
    lineHeight?.addEventListener('change', function () { editor().setLineHeight(lineHeight.value); });

    const textColorButton = document.getElementById('nw-text-color-button');
    const highlightButton = document.getElementById('nw-highlight-color-button');
    preserveSelectionOnMouseDown(textColorButton, true);
    preserveSelectionOnMouseDown(highlightButton, true);
    textColorButton?.addEventListener('click', function () { editor().toggleColorPicker('text'); });
    highlightButton?.addEventListener('click', function () { editor().toggleColorPicker('highlight'); });

    document.querySelectorAll('[data-seb-color-type][data-seb-color]').forEach(function (swatch) {
      preserveSelectionOnMouseDown(swatch, true);
      swatch.addEventListener('click', function () {
        editor().selectColor(swatch.dataset.sebColorType, swatch.dataset.sebColor);
      });
    });

    const customText = document.getElementById('custom-text-color');
    const customHighlight = document.getElementById('custom-highlight-color');
    preserveSelectionOnMouseDown(customText, false);
    preserveSelectionOnMouseDown(customHighlight, false);
    customText?.addEventListener('change', function () { editor().selectColor('text', customText.value); });
    customHighlight?.addEventListener('change', function () { editor().selectColor('highlight', customHighlight.value); });

    document.getElementById('nw-file-menu-button')?.addEventListener('click', toggleMenu);
    document.getElementById('nw-file-open')?.addEventListener('click', function () {
      setMenuVisible(false);
      window.sebNwtexteDialogs?.openDocument();
    });
    document.getElementById('nw-file-save')?.addEventListener('click', function () {
      setMenuVisible(false);
      window.sebNwtexteSave?.save();
    });
    document.getElementById('nw-file-save-as')?.addEventListener('click', function () {
      setMenuVisible(false);
      window.sebNwtexteSave?.saveAs();
    });
    document.getElementById('nw-file-close')?.addEventListener('click', function () { setMenuVisible(false); });
    document.getElementById('nw-image-button')?.addEventListener('click', function () {
      window.sebNwtexteDialogs?.openImage();
    });

    document.getElementById('nw-skip')?.addEventListener('click', function () {
      if (confirm('Voulez-vous vraiment passer sans sauvegarder ?')) navigateNext();
    });
    document.getElementById('btn-score')?.addEventListener('click', navigateNext);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once:true });
  else install();
})();
